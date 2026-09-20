'use strict';

const { EventProcessor } = require('./event-processor');
const { EventObserver } = require('./event-observer');

class ObservedEventProcessor {
  constructor({ processor, observer } = {}) {
    this.processor = processor || new EventProcessor();
    this.observer = observer || new EventObserver();
  }

  async decide(envelope) {
    await this.observer.ensure(envelope);
    const decision = await this.processor.decide(envelope);

    if (decision.decision === 'REJECTED') {
      await this.observer.transition(envelope, 'REJECTED', {
        stage: 'VALIDATION_OR_POLICY',
        reasonCode: decision.reason_code,
        reason: decision.reason || ''
      });
      return decision;
    }

    await this.observer.transition(envelope, 'VALIDATED', {
      stage: 'VALIDATION',
      reasonCode: 'EVENT_VALIDATED'
    });

    if (decision.decision === 'REVIEW_REQUIRED') {
      await this.observer.transition(envelope, 'REVIEW_REQUIRED', {
        stage: 'DECISION',
        reasonCode: decision.reason_code,
        reason: decision.reason || '',
        related: {
          review_reason: decision.reason_code
        }
      });
      return decision;
    }

    if (decision.decision === 'IGNORE') {
      const state = decision.reason_code === 'DUPLICATE_EVENT'
        ? 'DUPLICATE'
        : 'IGNORED';
      await this.observer.transition(envelope, state, {
        stage: 'DECISION',
        reasonCode: decision.reason_code,
        reason: decision.reason || ''
      });
      return decision;
    }

    await this.observer.transition(envelope, 'DECIDED', {
      stage: 'DECISION',
      reasonCode: decision.reason_code,
      reason: decision.reason || '',
      related: decision.match?.canonical_ids || {}
    });
    await this.observer.transition(envelope, 'PLANNED', {
      stage: 'PLANNING',
      reasonCode: 'TRANSACTION_PLAN_READY',
      related: {
        transaction_event_type: decision.transaction_plan?.event_type || ''
      }
    });
    return decision;
  }
}

class ObservedTransactionExecutor {
  constructor({ writer, observer } = {}) {
    if (!writer) throw new Error('writer is required');
    this.writer = writer;
    this.observer = observer || new EventObserver();
  }

  async execute(envelope, decision) {
    if (decision?.decision !== 'AUTO_WRITE' || !decision.transaction_plan) {
      throw new Error('AUTO_WRITE decision with transaction_plan is required');
    }

    await this.observer.transition(envelope, 'EXECUTING', {
      stage: 'WRITER',
      reasonCode: 'WRITER_EXECUTION_STARTED'
    });

    let result;
    try {
      result = await this.writer.execute(decision.transaction_plan);
    } catch (error) {
      await this.observer.transition(envelope, 'FAILED', {
        stage: 'WRITER',
        reasonCode: 'WRITER_THROWN_ERROR',
        reason: error.message
      });
      throw error;
    }

    const stateMap = {
      COMMITTED: 'COMMITTED',
      DUPLICATE_NO_OP: 'DUPLICATE',
      RETRY_REQUIRED: 'RETRY_REQUIRED',
      FAILED: 'FAILED'
    };
    const eventState = stateMap[result.state] || 'FAILED';

    await this.observer.transition(envelope, eventState, {
      stage: 'WRITER',
      reasonCode: result.state || 'UNKNOWN_WRITER_STATE',
      reason: result.error || '',
      related: {
        transaction_id: result.transaction_id || '',
        affected_record_ids: result.affected_record_ids || []
      }
    });

    return result;
  }
}

module.exports = {
  ObservedEventProcessor,
  ObservedTransactionExecutor
};
