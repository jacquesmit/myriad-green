'use strict';

const {
  ObservedEventProcessor,
  ObservedTransactionExecutor
} = require('./observed-event-processor');
const { EventObserver } = require('./event-observer');
const { ReviewManager } = require('./review-manager');
const { RetryController } = require('./retry-controller');

function writerReasonCode(result = {}) {
  const text = String(result.error || '');
  const match = text.match(/^([A-Z0-9_]+)(?::|\s|$)/);
  return match ? match[1] : (result.state || 'UNKNOWN_WRITER_FAILURE');
}

class GovernedEventRunner {
  constructor({
    processor,
    writer,
    observer,
    reviewManager,
    retryController,
    executingStaleMs = Number(
      process.env.MAGOS_EXECUTING_STALE_MS || 60000
    )
  } = {}) {
    if (!processor) throw new Error('processor is required');
    if (!writer) throw new Error('writer is required');

    this.observer = observer || new EventObserver();
    this.reviewManager =
      reviewManager ||
      new ReviewManager({ ledger: this.observer.ledger });
    this.retryController =
      retryController ||
      new RetryController({ ledger: this.observer.ledger });
    this.rawProcessor = processor;
    this.writer = writer;
    this.executingStaleMs =
      Number.isFinite(executingStaleMs) && executingStaleMs >= 0
        ? executingStaleMs
        : 60000;

    this.processor = new ObservedEventProcessor({
      processor,
      observer: this.observer
    });
    this.executor = new ObservedTransactionExecutor({
      writer,
      observer: this.observer
    });
  }

  async run(envelope) {
    const current = await this.observer.ensure(envelope);

    if (current.event_state === 'RETRY_REQUIRED') {
      return this.retry(envelope);
    }

    if (current.event_state === 'EXECUTING') {
      return this.reconcileExecuting(envelope, current);
    }

    if ([
      'COMMITTED',
      'DUPLICATE',
      'REJECTED',
      'IGNORED',
      'FAILED'
    ].includes(current.event_state)) {
      return {
        state: current.event_state,
        terminal_no_op: true,
        observation: current
      };
    }

    if (current.event_state === 'REVIEW_REQUIRED') {
      return {
        state: 'REVIEW_REQUIRED',
        terminal_no_op: true,
        observation: current
      };
    }

    if (current.event_state !== 'RECEIVED') {
      throw new Error(
        'Cannot start normal decision flow from event_state=' +
        current.event_state
      );
    }

    const decision = await this.processor.decide(envelope);
    return this.executeDecision(envelope, decision);
  }

  executingAgeMs(current) {
    const raw =
      current?.state_changed_at ||
      current?.logged_at ||
      current?.started_at ||
      '';
    const changedAt = Date.parse(raw);
    if (!Number.isFinite(changedAt)) return Number.POSITIVE_INFINITY;
    return Math.max(0, Date.now() - changedAt);
  }

  async reconcileExecuting(envelope, current) {
    const ageMs = this.executingAgeMs(current);
    if (ageMs < this.executingStaleMs) {
      return {
        state: 'EXECUTING',
        terminal_no_op: true,
        recovery: 'WAITING_FOR_STALE_BOUNDARY',
        age_ms: ageMs,
        retry_after_ms: Math.max(0, this.executingStaleMs - ageMs),
        observation: current
      };
    }

    const decision = await this.rawProcessor.decide(envelope);

    if (decision.decision !== 'AUTO_WRITE' || !decision.transaction_plan) {
      const writerRun = this.writer.audit
        ? await this.writer.audit.findByKey(
          'Automation_Run_Log',
          'idempotency_key',
          envelope.idempotency_key
        )
        : null;

      if (
        writerRun?.object?.run_state === 'COMMITTED' &&
        decision.reason_code === 'DUPLICATE_EVENT'
      ) {
        await this.observer.transition(envelope, 'COMMITTED', {
          stage: 'EXECUTING_RECOVERY',
          reasonCode: 'STALE_EXECUTING_RECONCILED_COMMITTED',
          reason:
            'P3 audit is COMMITTED and source re-resolution confirms the source event already exists.',
          related: {
            writer_run_log_id: writerRun.object.run_log_id || ''
          }
        });
        return {
          state: 'COMMITTED',
          reconciled: true,
          reconciliation: {
            state: 'COMMITTED',
            reason_code: 'STALE_EXECUTING_RECONCILED_COMMITTED',
            writer_run: writerRun.object
          }
        };
      }

      await this.observer.transition(envelope, 'RETRY_REQUIRED', {
        stage: 'EXECUTING_RECOVERY',
        reasonCode: 'STALE_EXECUTING_REDECISION_NOT_AUTOWRITE',
        reason:
          'Stale EXECUTING recovery could not reproduce the original AUTO_WRITE plan. Re-enter governed retry/review using the same event lineage.'
      });
      return this.retry(envelope);
    }

    if (
      decision.transaction_plan.idempotency_key !==
      envelope.idempotency_key
    ) {
      await this.observer.transition(envelope, 'FAILED', {
        stage: 'EXECUTING_RECOVERY',
        reasonCode: 'STALE_EXECUTING_IDEMPOTENCY_MISMATCH',
        reason:
          'Recovered TransactionPlan changed the original event idempotency key.'
      });
      return {
        state: 'FAILED',
        decision,
        reconciliation: {
          state: 'FAILED',
          reason_code: 'STALE_EXECUTING_IDEMPOTENCY_MISMATCH'
        }
      };
    }

    if (typeof this.writer.reconcileStalePlan !== 'function') {
      await this.observer.transition(envelope, 'FAILED', {
        stage: 'EXECUTING_RECOVERY',
        reasonCode: 'STALE_EXECUTING_RECONCILER_UNAVAILABLE',
        reason:
          'Writer does not expose governed stale-execution reconciliation.'
      });
      return {
        state: 'FAILED',
        decision,
        reconciliation: {
          state: 'FAILED',
          reason_code: 'STALE_EXECUTING_RECONCILER_UNAVAILABLE'
        }
      };
    }

    const reconciliation = await this.writer.reconcileStalePlan(
      decision.transaction_plan
    );

    if (reconciliation.state === 'COMMITTED') {
      await this.observer.transition(envelope, 'COMMITTED', {
        stage: 'EXECUTING_RECOVERY',
        reasonCode:
          reconciliation.reason_code ||
          'STALE_EXECUTING_RECONCILED_COMMITTED',
        reason: reconciliation.reason || '',
        related: {
          transaction_id: reconciliation.transaction_id || '',
          writer_run_log_id:
            reconciliation.writer_run?.run_log_id || ''
        }
      });
      return {
        state: 'COMMITTED',
        decision,
        reconciled: true,
        reconciliation
      };
    }

    if (reconciliation.state === 'RETRY_REQUIRED') {
      await this.observer.transition(envelope, 'RETRY_REQUIRED', {
        stage: 'EXECUTING_RECOVERY',
        reasonCode:
          reconciliation.reason_code ||
          'STALE_EXECUTING_SAFE_RETRY',
        reason: reconciliation.reason || ''
      });
      return {
        state: 'RETRY_REQUIRED',
        decision,
        reconciliation,
        replay_rule:
          'Replay the original EventEnvelope with the same idempotency key.'
      };
    }

    await this.observer.transition(envelope, 'FAILED', {
      stage: 'EXECUTING_RECOVERY',
      reasonCode:
        reconciliation.reason_code ||
        'STALE_EXECUTING_RECONCILIATION_FAILED',
      reason:
        reconciliation.reason ||
        'Stale EXECUTING state could not be reconciled safely.'
    });
    return {
      state: 'FAILED',
      decision,
      reconciliation
    };
  }

  async retry(envelope) {
    const current = await this.observer.ensure(envelope);
    if (current.event_state !== 'RETRY_REQUIRED') {
      throw new Error(
        'Retry requires event_state=RETRY_REQUIRED; actual=' +
        current.event_state
      );
    }

    const decision = await this.rawProcessor.decide(envelope);

    if (decision.decision !== 'AUTO_WRITE' || !decision.transaction_plan) {
      await this.observer.transition(envelope, 'REVIEW_REQUIRED', {
        stage: 'RETRY_REDECISION',
        reasonCode: 'RETRY_REDECISION_NOT_AUTOWRITE',
        reason:
          'Re-resolving the original event no longer produced an AUTO_WRITE plan. Manual review is required before any further mutation.'
      });

      const reviewDecision = {
        schema_version: decision.schema_version || 'MAGOS-DECISION/V1',
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        decision: 'REVIEW_REQUIRED',
        reason_code: 'RETRY_REDECISION_NOT_AUTOWRITE',
        reason:
          'Retry re-decision returned ' +
          String(decision.decision || 'UNKNOWN') +
          '; preserve original event lineage and review.',
        rule_version:
          decision.rule_version || 'MAGOS-EVENT-PROCESSOR-01/V1',
        match: decision.match || null
      };
      const review = await this.reviewManager.open(
        envelope,
        reviewDecision
      );

      return {
        state: 'REVIEW_REQUIRED',
        decision,
        review
      };
    }

    if (
      decision.idempotency_key &&
      decision.idempotency_key !== envelope.idempotency_key
    ) {
      throw new Error('Retry changed event idempotency key');
    }

    return this.executeDecision(envelope, {
      ...decision,
      retried_event: true
    });
  }

  async resumeApproved(envelope, {
    approvedMatch,
    planner,
    duplicateChecker = async () => false
  } = {}) {
    const current = await this.observer.ensure(envelope);
    if (current.event_state !== 'REVIEW_REQUIRED') {
      throw new Error(
        'Approved review resume requires event_state=REVIEW_REQUIRED; actual=' +
        current.event_state
      );
    }

    const decision = await this.reviewManager.resume(envelope, {
      approvedMatch,
      planner,
      duplicateChecker
    });

    if (decision.decision !== 'AUTO_WRITE' || !decision.transaction_plan) {
      return {
        state: 'REVIEW_REQUIRED',
        decision
      };
    }

    await this.observer.transition(envelope, 'DECIDED', {
      stage: 'REVIEW_RESUME',
      reasonCode: 'APPROVED_REVIEW_MATCH',
      reason: 'Approved exact match restored deterministic event resolution.',
      related: decision.match?.canonical_ids || {}
    });
    await this.observer.transition(envelope, 'PLANNED', {
      stage: 'REVIEW_RESUME',
      reasonCode: 'TRANSACTION_PLAN_READY',
      related: {
        transaction_event_type:
          decision.transaction_plan?.event_type || ''
      }
    });

    return this.executeDecision(envelope, decision);
  }

  async executeDecision(envelope, decision) {
    if (decision.decision === 'REVIEW_REQUIRED') {
      const review = await this.reviewManager.open(envelope, decision);
      return {
        state: 'REVIEW_REQUIRED',
        decision,
        review
      };
    }

    if (decision.decision === 'REJECTED') {
      return {
        state: 'REJECTED',
        decision
      };
    }

    if (decision.decision === 'IGNORE') {
      return {
        state:
          decision.reason_code === 'DUPLICATE_EVENT'
            ? 'DUPLICATE'
            : 'IGNORED',
        decision
      };
    }

    if (decision.decision !== 'AUTO_WRITE') {
      throw new Error('Unsupported decision ' + decision.decision);
    }

    const writerResult = await this.executor.execute(envelope, decision);

    if (
      writerResult.state === 'COMMITTED' ||
      writerResult.state === 'DUPLICATE_NO_OP'
    ) {
      let reviewResolved = false;
      if (decision.resumed_from_review) {
        reviewResolved = await this.reviewManager.markCommitted(
          envelope.idempotency_key,
          envelope.evidence?.[0]?.ref || ''
        );
      }

      let followUpReview = null;
      if (
        writerResult.state === 'COMMITTED' &&
        decision.post_commit_review?.required
      ) {
        followUpReview = await this.reviewManager.openFollowUp(
          envelope,
          {
            reason_code:
              decision.post_commit_review.reason_code ||
              'POST_COMMIT_REVIEW_REQUIRED',
            reason: decision.post_commit_review.reason || '',
            context: {
              ...decision.post_commit_review
            },
            next_event_type:
              decision.post_commit_review.next_event_type || ''
          }
        );
      }

      return {
        state:
          writerResult.state === 'DUPLICATE_NO_OP'
            ? 'DUPLICATE'
            : 'COMMITTED',
        decision,
        writer: writerResult,
        review_resolved: reviewResolved,
        follow_up_review: followUpReview
      };
    }

    if (writerResult.state === 'RETRY_REQUIRED') {
      return this.handleRetryRequired(envelope, decision, writerResult);
    }

    return {
      state: 'FAILED',
      decision,
      writer: writerResult
    };
  }

  async handleRetryRequired(envelope, decision, writerResult) {
    const current = await this.observer.ensure(envelope);
    const retryCount = Number(current.retry_count || 0);
    const reasonCode = writerReasonCode(writerResult);
    const retryDecision = this.retryController.decide({
      reasonCode,
      retryCount
    });

    if (retryDecision.action === 'RETRY') {
      return {
        state: 'RETRY_REQUIRED',
        decision,
        writer: writerResult,
        retry: retryDecision,
        replay_rule:
          'Replay the original EventEnvelope with the same idempotency key.'
      };
    }

    if (retryDecision.action === 'REVIEW_REQUIRED') {
      await this.observer.transition(envelope, 'REVIEW_REQUIRED', {
        stage: 'RETRY_POLICY',
        reasonCode: retryDecision.reason_code,
        reason:
          'Writer failure ' + reasonCode +
          ' requires review rather than automatic retry.'
      });

      const reviewDecision = {
        schema_version: 'MAGOS-DECISION/V1',
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        decision: 'REVIEW_REQUIRED',
        reason_code: retryDecision.reason_code,
        reason:
          'Writer failure ' + reasonCode +
          ' is not approved for automatic retry.',
        rule_version: 'MAGOS-RETRY-POLICY-01/V1',
        match: decision.match || null
      };
      const review = await this.reviewManager.open(
        envelope,
        reviewDecision
      );

      return {
        state: 'REVIEW_REQUIRED',
        decision,
        writer: writerResult,
        retry: retryDecision,
        review
      };
    }

    if (retryDecision.action === 'DEAD_LETTER') {
      const deadLetter = await this.retryController.deadLetter(
        envelope,
        retryDecision,
        {
          error: writerResult.error || '',
          evidence: envelope.evidence?.[0]?.ref || ''
        }
      );

      await this.observer.transition(envelope, 'FAILED', {
        stage: 'RETRY_POLICY',
        reasonCode: retryDecision.reason_code,
        reason: 'Retry limit exhausted; event moved to dead-letter review.'
      });

      return {
        state: 'DEAD_LETTER',
        decision,
        writer: writerResult,
        retry: retryDecision,
        dead_letter: deadLetter
      };
    }

    throw new Error('Unsupported retry action ' + retryDecision.action);
  }
}

module.exports = {
  GovernedEventRunner,
  writerReasonCode
};
