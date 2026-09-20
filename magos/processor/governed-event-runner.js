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
    retryController
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
    const decision = await this.processor.decide(envelope);
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
