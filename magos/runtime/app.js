'use strict';

const crypto = require('crypto');
const express = require('express');
const { TransactionWriter } = require('../writer/transaction-writer');
const { EventProcessor } = require('../processor/event-processor');
const {
  GovernedProcessorRegistry,
  UnsupportedGovernedEventTypeError
} = require('../processor/processor-registry');
const {
  parseAllowedLeadSources,
  createLeadEventFromIngress
} = require('../adapters/lead-ingress');

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractBearerToken(req) {
  const value = req.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function isPlausiblePlan(plan) {
  return Boolean(
    plan &&
    typeof plan === 'object' &&
    plan.idempotency_key &&
    plan.event_type &&
    plan.source_event_id &&
    Array.isArray(plan.preconditions) &&
    Array.isArray(plan.writes) &&
    plan.writes.length
  );
}

function createRuntimeApp({
  token = process.env.MAGOS_RUNTIME_TOKEN,
  leadIngressToken = process.env.MAGOS_LEAD_INGRESS_TOKEN,
  supplierApprovalToken = process.env.MAGOS_SUPPLIER_APPROVAL_TOKEN,
  procurementApprovalToken = process.env.MAGOS_PROCUREMENT_APPROVAL_TOKEN,
  jobCreationToken = process.env.MAGOS_JOB_CREATION_TOKEN,
  jobAuthorityVerifier = async () => ({verified:false,reason_code:'JOB_AUTHORITY_NOT_VERIFIED'}),
  leadIngressSources =
    process.env.MAGOS_LEAD_INGRESS_SOURCES || '',
  writerFactory = () => new TransactionWriter(),
  procurementLookupFactory = () => new (require('../adapters/exact-lookup-service').ExactLookupService)(),
  procurementAuthorityVerifier = async () => ({ verified: false, reason_code: 'APPROVAL_AUTHORITY_NOT_VERIFIED' }),
  eventProcessorFactory = () => new EventProcessor(),
  eventDispatcherFactory = ({ writer }) =>
    new GovernedProcessorRegistry({ writer }),
  version = process.env.MAGOS_RUNTIME_VERSION || 'P2'
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  let writer;
  let eventProcessor;
  let eventDispatcher;
  const allowedLeadSources = parseAllowedLeadSources(leadIngressSources);

  const getWriter = () => {
    if (!writer) writer = writerFactory();
    return writer;
  };

  const getEventProcessor = () => {
    if (!eventProcessor) eventProcessor = eventProcessorFactory();
    return eventProcessor;
  };

  const getEventDispatcher = () => {
    if (!eventDispatcher) {
      eventDispatcher = eventDispatcherFactory({
        writer: getWriter()
      });
    }
    return eventDispatcher;
  };

  // Browser shell exposes no business data; API remains authenticated.
  app.get('/operator', (req, res) => {
    const { operatorPage } = require('./operator-page');
    res.set('Cache-Control','no-store');
    res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.type('html').status(200).send(operatorPage());
  });

  app.get('/healthz', (req, res) => {
    res.status(200).json({
      service: 'MAGOS Automation Runtime V1',
      status: 'ok',
      version
    });
  });

  app.get('/readyz', (req, res) => {
    const ready = Boolean(token);
    res.status(ready ? 200 : 503).json({
      service: 'MAGOS Automation Runtime V1',
      status: ready ? 'ready' : 'not_ready',
      auth_configured: ready
    });
  });

  function requireLeadIngressAuth(req, res, next) {
    if (!leadIngressToken || !allowedLeadSources.size) {
      return res.status(503).json({
        error: 'MAGOS_LEAD_INGRESS_NOT_CONFIGURED'
      });
    }

    const supplied = req.get('x-magos-ingress-token') || '';
    if (!constantTimeEqual(supplied, leadIngressToken)) {
      return res.status(401).json({
        error: 'UNAUTHORIZED'
      });
    }
    return next();
  }

  function requireRuntimeAuth(req, res, next) {
    if (!token) {
      return res.status(503).json({
        error: 'MAGOS_RUNTIME_NOT_CONFIGURED'
      });
    }

    const supplied = extractBearerToken(req);
    if (!constantTimeEqual(supplied, token)) {
      return res.status(401).json({
        error: 'UNAUTHORIZED'
      });
    }
    return next();
  }


  app.post('/v1/ingress/leads', requireLeadIngressAuth, async (req, res) => {
    try {
      const requestedSource = String(req.body?.source || '').trim().toUpperCase();
      if (!requestedSource || !allowedLeadSources.has(requestedSource)) {
        return res.status(403).json({
          error: 'LEAD_INGRESS_SOURCE_NOT_ALLOWED',
          source: requestedSource
        });
      }

      const envelope = createLeadEventFromIngress(req.body);
      const result = await getEventDispatcher().run(envelope);
      const status =
        result.state === 'COMMITTED' ||
        result.state === 'DUPLICATE' ||
        result.state === 'IGNORED'
          ? 200
          : result.state === 'REVIEW_REQUIRED'
            ? 202
            : result.state === 'REJECTED'
              ? 400
              : result.state === 'RETRY_REQUIRED'
                ? 409
                : 500;

      return res.status(status).json({
        ...result,
        ingress: {
          source: envelope.source,
          source_event_id: envelope.source_event_id,
          event_id: envelope.event_id,
          event_type: envelope.event_type
        }
      });
    } catch (error) {
      if (
        String(error?.code || '').startsWith('LEAD_INGRESS_') ||
        error?.code === 'INVALID_GUARD_VALUE'
      ) {
        return res.status(400).json({
          error: error.code,
          detail: error.message
        });
      }
      return res.status(500).json({
        error: 'LEAD_INGRESS_FAILURE',
        detail: error.message
      });
    }
  });

  // Unified operator view: reads only the existing MGOS authoritative sheets.
  app.get('/v1/operator/snapshot', requireRuntimeAuth, async (req,res)=>{
    try {
      const { loadOperatorSnapshot }=require('../processor/operator-snapshot');
      const w=getWriter();
      const result=await loadOperatorSnapshot({stores:w.stores});
      return res.status(200).json(result);
    } catch(error) {
      return res.status(503).json({error:'OPERATOR_SNAPSHOT_UNAVAILABLE',detail:error.message});
    }
  });

  app.post('/v1/probes/google-sheets', requireRuntimeAuth, async (req, res) => {
    try {
      const runtimeWriter = getWriter();
      await runtimeWriter.audit.getHeaders('Automation_Run_Log');
      return res.status(200).json({
        service: 'MAGOS Automation Runtime V1',
        status: 'ok',
        google_sheets: 'reachable',
        audit_store: 'reachable'
      });
    } catch (error) {
      return res.status(503).json({
        service: 'MAGOS Automation Runtime V1',
        status: 'not_ready',
        google_sheets: 'unreachable',
        error: error.message
      });
    }
  });

  app.post('/v1/events/decide', requireRuntimeAuth, async (req, res) => {
    try {
      const decision = await getEventProcessor().decide(req.body);
      const status =
        decision.decision === 'REJECTED'
          ? 400
          : decision.decision === 'REVIEW_REQUIRED'
            ? 202
            : 200;
      return res.status(status).json(decision);
    } catch (error) {
      return res.status(500).json({
        error: 'EVENT_PROCESSOR_FAILURE',
        detail: error.message
      });
    }
  });

  // Supplier-approval authority is never inferred from caller-controlled event metadata.
  app.post('/v1/governance/supplier-approval', async (req, res) => {
    if (!supplierApprovalToken || supplierApprovalToken === token || supplierApprovalToken === leadIngressToken) {
      return res.status(503).json({ error: 'SUPPLIER_APPROVAL_AUTH_NOT_CONFIGURED' });
    }
    if (!constantTimeEqual(req.get('x-magos-supplier-approval-token') || '', supplierApprovalToken)) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    try {
      const { createEventEnvelope } = require('../processor/event-envelope');
      const change = req.body || {};
      if (!['VETTING', 'APPROVED', 'EXCLUDED', 'SUSPENDED'].includes(change.from_state) ||
          !['VETTING', 'APPROVED', 'EXCLUDED', 'SUSPENDED'].includes(change.to_state) ||
          change.from_state === change.to_state ||
          typeof change.supplier_id !== 'string' || !change.supplier_id.trim() ||
          typeof change.source_event_id !== 'string' || !change.source_event_id.trim() ||
          typeof change.actor_id !== 'string' || !change.actor_id.trim() ||
          typeof change.evidence_ref !== 'string' || !change.evidence_ref.trim() ||
          !change.guards || !['spam','phishing','explicit_content','malware','irrelevant'].every(k => change.guards[k] === 'CLEAR' || change.guards[k] === 'BLOCK' || change.guards[k] === 'UNKNOWN')) {
        return res.status(400).json({ error: 'INVALID_SUPPLIER_APPROVAL_REQUEST' });
      }
      const envelope = createEventEnvelope({
        source: 'MGOS_GOVERNANCE',
        source_event_id: change.source_event_id,
        event_type: 'SUPPLIER_APPROVAL_CHANGED',
        actor: { id: change.actor_id },
        entity_hints: { supplier_id: change.supplier_id },
        guards: change.guards,
        evidence: [{ type: 'DOCUMENT', ref: change.evidence_ref }],
        metadata: { approval_authorized: true, authorization_origin: 'SUPPLIER_APPROVAL_ENDPOINT' },
        payload: { supplier_approval_change: {
          supplier_id: change.supplier_id, from_state: change.from_state, to_state: change.to_state
        }}
      });
      const result = await getEventDispatcher().run(envelope);
      return res.status(result.state === 'COMMITTED' || result.state === 'DUPLICATE' ? 200 : 202).json(result);
    } catch (error) {
      return res.status(500).json({ error: 'SUPPLIER_APPROVAL_EXECUTION_FAILED', detail: error.message });
    }
  });

    app.post('/v1/events/run', requireRuntimeAuth, async (req, res) => {
    if (req.body?.event_type === 'SUPPLIER_APPROVAL_CHANGED') {
      return res.status(403).json({ error: 'SUPPLIER_APPROVAL_REQUIRES_GOVERNANCE_ENDPOINT' });
    }
    try {
      const result = await getEventDispatcher().run(req.body);
      const status =
        result.state === 'COMMITTED' ||
        result.state === 'DUPLICATE' ||
        result.state === 'IGNORED'
          ? 200
          : result.state === 'REVIEW_REQUIRED'
            ? 202
            : result.state === 'REJECTED'
              ? 400
              : result.state === 'RETRY_REQUIRED'
                ? 409
                : 500;
      return res.status(status).json(result);
    } catch (error) {
      if (error instanceof UnsupportedGovernedEventTypeError ||
          error?.code === 'UNSUPPORTED_GOVERNED_EVENT_TYPE') {
        return res.status(422).json({
          error: 'UNSUPPORTED_GOVERNED_EVENT_TYPE',
          event_type: error.event_type || req.body?.event_type || ''
        });
      }
      return res.status(500).json({
        error: 'GOVERNED_EVENT_RUNNER_FAILURE',
        detail: error.message
      });
    }
  });


  // Governed job creation never accepts caller-controlled acceptance/payment flags.
  app.post('/v1/governance/create-job', async (req,res)=>{
    if(!jobCreationToken || [token,leadIngressToken,supplierApprovalToken,procurementApprovalToken].includes(jobCreationToken))return res.status(503).json({error:'JOB_CREATION_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-job-token')||'',jobCreationToken))return res.status(401).json({error:'UNAUTHORIZED'});
    const b=req.body||{};
    if(!['quoteId','jobId','sourceEventId'].every(k=>typeof b[k]==='string'&&b[k].trim()))return res.status(400).json({error:'JOB_IDENTIFIERS_REQUIRED'});
    try {
      const {executeAcceptedJob}=require('../processor/accepted-job-execution');
      const result=await executeAcceptedJob({writer:getWriter(),quoteId:b.quoteId,jobId:b.jobId,sourceEventId:b.sourceEventId,authorityVerifier:jobAuthorityVerifier,dryRun:b.dryRun===true});
      return res.status(['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:result.state==='REVIEW_REQUIRED'||result.state==='BLOCKED'?202:409).json(result);
    }catch(error){return res.status(500).json({error:'GOVERNED_JOB_CREATION_FAILED',detail:error.message});}
  });

  // Procurement approval is scoped to an internal PO state transition.
  // It never dispatches a supplier order or authorizes a payment.
  app.post('/v1/governance/procurement-approve', async (req, res) => {
    if (!procurementApprovalToken || [token, leadIngressToken, supplierApprovalToken].includes(procurementApprovalToken)) {
      return res.status(503).json({ error: 'PROCUREMENT_APPROVAL_AUTH_NOT_CONFIGURED' });
    }
    if (!constantTimeEqual(req.get('x-magos-procurement-token') || '', procurementApprovalToken)) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const b = req.body || {};
    if (!['poId', 'sourceEventId', 'approvalEvidence', 'approverId'].every(k =>
      typeof b[k] === 'string' && b[k].trim())) {
      return res.status(400).json({ error: 'PROCUREMENT_APPROVAL_INPUT_REQUIRED' });
    }
    try {
      const { planPurchaseOrderIssueApproval } = require('../processor/procurement-issue-approval');
      const lookupService = procurementLookupFactory();
      // A privileged HTTP token authorizes access, NOT the business decision.
      // Verification must come from a trusted server-side authority service,
      // never from caller-controlled request fields or submitted booleans.
      const attestation = await procurementAuthorityVerifier({
        poId: b.poId, sourceEventId: b.sourceEventId,
        evidenceRef: b.approvalEvidence, claimedApproverId: b.approverId
      });
      if (!attestation || attestation.verified !== true ||
          attestation.po_id !== b.poId ||
          attestation.source_event_id !== b.sourceEventId ||
          attestation.evidence_ref !== b.approvalEvidence ||
          !attestation.authorized_actor_id) {
        return res.status(202).json({
          state: 'REVIEW_REQUIRED',
          reason_code: attestation?.reason_code || 'APPROVAL_AUTHORITY_NOT_VERIFIED',
          writes: []
        });
      }
      const result = await planPurchaseOrderIssueApproval({
        lookupService, poId: b.poId, sourceEventId: b.sourceEventId,
        approvalEvidence: b.approvalEvidence, approverId: attestation.authorized_actor_id
      });
      if (result.state !== 'READY_FOR_APPROVAL') {
        return res.status(202).json(result);
      }
      const written = await getWriter().execute(result.plan);
      return res.status(written.state === 'COMMITTED' || written.state === 'DUPLICATE_NO_OP' ? 200 : 409)
        .json({ state: written.state, po_id: b.poId, transaction: written,
          external_order_sent: false, payment_authorized: false });
    } catch (error) {
      return res.status(500).json({ error: 'PROCUREMENT_APPROVAL_EXECUTION_FAILED', detail: error.message });
    }
  });

  app.post('/v1/transactions', requireRuntimeAuth, async (req, res) => {
    if (req.body?.event_type === 'SUPPLIER_APPROVAL_CHANGED' || req.body?.event_type === 'JOB_CREATE_FROM_ACCEPTED_SCOPE' || req.body?.writes?.some(w => (w.store === 'supplier' && (w.sheet === 'Suppliers' || w.sheet === 'Purchase_Orders')) || (w.store === 'crm' && w.sheet === 'Jobs_Opportunities' && (w.changes?.job_id || w.values?.job_id)))) {
      return res.status(403).json({ error: 'SUPPLIER_APPROVAL_REQUIRES_GOVERNANCE_ENDPOINT' });
    }
    if (!isPlausiblePlan(req.body)) {
      return res.status(400).json({
        error: 'INVALID_TRANSACTION_PLAN'
      });
    }

    try {
      const result = await getWriter().execute(req.body);
      const status =
        result.state === 'COMMITTED' || result.state === 'DUPLICATE_NO_OP'
          ? 200
          : result.state === 'RETRY_REQUIRED'
            ? 409
            : 500;
      return res.status(status).json(result);
    } catch (error) {
      return res.status(500).json({
        state: 'FAILED',
        error: error.message
      });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'INVALID_JSON' });
    }
    return res.status(500).json({ error: 'INTERNAL_RUNTIME_ERROR' });
  });

  return app;
}

module.exports = {
  createRuntimeApp,
  constantTimeEqual,
  extractBearerToken,
  isPlausiblePlan
};
