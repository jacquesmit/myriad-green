'use strict';

const {workflowById,listWorkflows}=require('./catalog');
const {validateEventEnvelope,deriveIdempotencyKey,deriveEventId}=require('../processor/event-envelope');
const VALID_END_STATES=new Set(['COMMITTED','DUPLICATE','DUPLICATE_NO_OP','IGNORED',
  'REVIEW_REQUIRED','REJECTED','EXECUTING','RETRY_REQUIRED','FAILED']);

class WorkflowInputError extends Error {
  constructor(code,message) { super(message || code); this.name='WorkflowInputError'; this.code=code; }
}

function validateWorkflowInput(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) {
    throw new WorkflowInputError('INVALID_WORKFLOW_REQUEST');
  }
  const workflow=workflowById(input.workflow_id);
  if (!workflow) throw new WorkflowInputError('UNKNOWN_WORKFLOW','Unknown workflow_id');
  const envelope=input.envelope;
  try { validateEventEnvelope(envelope); }
  catch { throw new WorkflowInputError('INVALID_EVENT_ENVELOPE','EventEnvelope validation failed'); }
  if (envelope.event_type!==workflow.event_type) {
    throw new WorkflowInputError('WORKFLOW_EVENT_TYPE_MISMATCH');
  }
  const expectedKey=deriveIdempotencyKey(envelope);
  const expectedId=deriveEventId(envelope);
  if(envelope.idempotency_key!==expectedKey || envelope.event_id!==expectedId) {
    throw new WorkflowInputError('EVENT_IDENTITY_MISMATCH','Source-derived event identity required');
  }
  if(!envelope.evidence?.length) {
    throw new WorkflowInputError('MISSING_SOURCE_EVIDENCE');
  }
  if(!envelope.source || !envelope.source_event_id) {
    throw new WorkflowInputError('MISSING_EVENT_ORIGIN');
  }
  return workflow;
}

class WorkflowRunner {
  constructor({dispatcher}={}) {
    if(!dispatcher || typeof dispatcher.run!=='function') throw new Error('Existing governed dispatcher is required');
    this.dispatcher=dispatcher;
  }
  list() { return listWorkflows(); }
  async run(input) {
    const workflow=validateWorkflowInput(input);
    // There is intentionally no tool executor here. All effects remain in
    // the existing EventEnvelope -> processor -> P3 writer + audit path.
    const outcome=await this.dispatcher.run(input.envelope);
    if(!outcome || !VALID_END_STATES.has(outcome.state)) {
      throw new Error('GOVERNED_DISPATCH_INVALID_RESULT');
    }
    return {
      schema_version:'MAGOS_WORKFLOW_RESULT_V1',
      workflow_id:input.workflow_id,
      workflow_name:workflow.name,
      event_id:input.envelope.event_id,
      idempotency_key:input.envelope.idempotency_key,
      ...outcome
    };
  }
}
module.exports={WorkflowRunner,WorkflowInputError,validateWorkflowInput};
