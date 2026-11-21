'use strict';

const crypto = require('crypto');
const path = require('node:path');
const express = require('express');
const { TransactionWriter } = require('../writer/transaction-writer');
const { planAgentTask } = require('../agents/agent-router');
const { LiveAgentAuthority } = require('../agents/live-agent-authority');
const { WorkflowRunner, WorkflowInputError } = require('../workflows/runner');
const { listWorkflows } = require('../workflows/catalog');
const { EventProcessor } = require('../processor/event-processor');
const {
  GovernedProcessorRegistry,
  UnsupportedGovernedEventTypeError
} = require('../processor/processor-registry');
const {
  parseAllowedLeadSources,
  createLeadEventFromIngress
} = require('../adapters/lead-ingress');
const {
  supplierEmailSource,
  parseAllowedSupplierEmailSources,
  createSupplierEmailEventFromIngress
} = require('../adapters/supplier-email-ingress');

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
  operatorReadToken = process.env.MAGOS_OPERATOR_READ_TOKEN,
  signedAcceptanceVerifier = async () => ({verified:false,reason_code:'SIGNED_ACCEPTANCE_NOT_VERIFIED'}),
  leadIngressToken = process.env.MAGOS_LEAD_INGRESS_TOKEN,
  leadIngressSources =
    process.env.MAGOS_LEAD_INGRESS_SOURCES || '',
  supplierEmailIngressToken = process.env.MAGOS_SUPPLIER_EMAIL_INGRESS_TOKEN,
  supplierEmailIngressSources = process.env.MAGOS_SUPPLIER_EMAIL_INGRESS_SOURCES || '',
  writerFactory = () => new TransactionWriter(),
  eventProcessorFactory = () => new EventProcessor(),
  liveAgentAuthorityFactory = () => new LiveAgentAuthority(),
  systemCoverageReaderFactory = () => new (require('../processor/system-coverage').SystemCoverageReader)(),
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
  let liveAgentAuthority;
  let systemCoverageReader;
  let workflowRunner;
  const allowedLeadSources = parseAllowedLeadSources(leadIngressSources);
  const allowedSupplierEmailSources = parseAllowedSupplierEmailSources(supplierEmailIngressSources);

  const getWriter = () => {
    if (!writer) writer = writerFactory();
    return writer;
  };

  const getLiveAgentAuthority = () => {
    if (!liveAgentAuthority) liveAgentAuthority = liveAgentAuthorityFactory();
    return liveAgentAuthority;
  };

  const getWorkflowRunner = () => {
    if (!workflowRunner) workflowRunner = new WorkflowRunner({
      dispatcher:getEventDispatcher()
    });
    return workflowRunner;
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

  // Read-only Command Centre from the existing MAGOS recovery lineage.
  app.get('/operator', (req,res)=>{
    const {operatorPage}=require('./operator-page');
    res.set('Cache-Control','no-store');
    res.set('Content-Security-Policy',"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    return res.type('html').status(200).send(operatorPage());
  });
  app.get('/operator.css',(req,res)=>res.sendFile(path.join(__dirname,'operator.css')));
  app.get('/operator.js',(req,res)=>res.sendFile(path.join(__dirname,'operator.js')));

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

  app.post('/v1/ingress/supplier-email', async (req, res) => {
    if (!supplierEmailIngressToken || !allowedSupplierEmailSources.size ||
        constantTimeEqual(supplierEmailIngressToken, token) ||
        constantTimeEqual(supplierEmailIngressToken, leadIngressToken)) {
      return res.status(503).json({ error: 'MAGOS_SUPPLIER_EMAIL_INGRESS_NOT_CONFIGURED' });
    }
    if (!constantTimeEqual(req.get('x-magos-ingress-token'), supplierEmailIngressToken)) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const source = supplierEmailSource(req.body?.source);
    if (!allowedSupplierEmailSources.has(source)) {
      return res.status(403).json({ error: 'SUPPLIER_EMAIL_INGRESS_SOURCE_NOT_ALLOWED' });
    }

    let envelope;
    try {
      envelope = createSupplierEmailEventFromIngress(req.body, { source });
    } catch (error) {
      return res.status(400).json({
        error: error.code || 'SUPPLIER_EMAIL_INGRESS_INVALID_PAYLOAD'
      });
    }

    try {
      const { state } = await getEventDispatcher().run(envelope);
      const status = {
        COMMITTED: 200,
        DUPLICATE: 200,
        IGNORED: 200,
        REVIEW_REQUIRED: 202,
        REJECTED: 400,
        EXECUTING: 409,
        RETRY_REQUIRED: 409
      }[state] || 500;
      return res.status(status).json({ state, event_id: envelope.event_id });
    } catch {
      return res.status(500).json({
        error: 'SUPPLIER_EMAIL_INGRESS_FAILURE',
        event_id: envelope.event_id
      });
    }
  });

  // Separate view-only credential: must never equal any writer/ingress token.
  const hasOperatorToken=Boolean(operatorReadToken) &&
    ![token,leadIngressToken,supplierEmailIngressToken].some(
      credential=>constantTimeEqual(credential,operatorReadToken)
    );
  function requireOperatorRead(req,res,next) {
    res.set('Cache-Control','private, no-store');
    if(!hasOperatorToken) return res.status(503).json({error:'OPERATOR_ACCESS_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('X-MAGOS-Operator-Token'),operatorReadToken)) {
      return res.status(401).json({error:'UNAUTHORIZED'});
    }
    return next();
  }
  app.get('/v1/operator/coverage',requireOperatorRead,async(req,res)=>{
    try {
      if(!systemCoverageReader)systemCoverageReader=systemCoverageReaderFactory();
      return res.status(200).json(await systemCoverageReader.read());
    } catch {
      return res.status(503).json({error:'MAGOS_SYSTEM_COVERAGE_UNAVAILABLE'});
    }
  });

  function requireOperatorInspection(req,res,next) {
    return req.get('X-MAGOS-Operator-Token')===undefined ?
      requireRuntimeAuth(req,res,next) : requireOperatorRead(req,res,next);
  }
  // Reuse the canonical commercial/CRM sources. These inspections NEVER write.
  app.get('/v1/operator/job-readiness/:quoteId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectJobRelease}=require('../processor/job-release-inspection');
      const result=await inspectJobRelease({stores:getWriter().stores,quoteId:req.params.quoteId});
      return res.status(result.state==='READY_FOR_EVIDENCE_REVIEW'?200:202).json(result);
    }catch {
      return res.status(503).json({error:'JOB_READINESS_UNAVAILABLE'});
    }
  });
  app.get('/v1/operator/deposit-evidence/:opportunityId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectDepositEvidence}=require('../processor/deposit-evidence-inspection');
      const result=await inspectDepositEvidence({stores:getWriter().stores,opportunityId:req.params.opportunityId});
      return res.status(result.state==='CLEARED_ALLOCATION_EVIDENCED'?200:202).json(result);
    }catch {
      return res.status(503).json({error:'DEPOSIT_EVIDENCE_UNAVAILABLE'});
    }
  });
  app.get('/v1/operator/job-activation/:quoteId',requireOperatorInspection,async(req,res)=>{
    try {
      const {assessJobActivation}=require('../processor/job-activation-assessment');
      const result=await assessJobActivation({
        stores:getWriter().stores,quoteId:req.params.quoteId,
        evidenceVerifier:signedAcceptanceVerifier
      });
      return res.status(result.state==='READY_FOR_GOVERNED_AUTHORIZATION'?200:202).json(result);
    }catch {
      return res.status(503).json({error:'JOB_ACTIVATION_ASSESSMENT_UNAVAILABLE'});
    }
  });

  app.get('/v1/operator/dashboard',requireOperatorRead,async(req,res)=>{
    try {
      const {loadOperatorDashboard}=require('../processor/operator-dashboard');
      const stores=getWriter().stores;
      if(!stores?.crm || !stores?.commercial || !stores?.supplier || !stores?.audit) {
        return res.status(503).json({error:'OPERATOR_SOURCES_UNAVAILABLE'});
      }
      return res.status(200).json(await loadOperatorDashboard(stores));
    }catch{
      return res.status(503).json({error:'OPERATOR_DASHBOARD_UNAVAILABLE'});
    }
  });

  // Backwards-compatible read-only snapshot from prior MAGOS runtime.
  app.get('/v1/operator/snapshot', requireRuntimeAuth, async(req,res)=>{
    try {
      const {loadOperatorSnapshot}=require('../processor/operator-snapshot');
      return res.status(200).json(await loadOperatorSnapshot({stores:getWriter().stores}));
    } catch {
      return res.status(503).json({error:'OPERATOR_SNAPSHOT_UNAVAILABLE'});
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

  // Read-only canonical Drive authority check. Never authorizes writes.
  app.post('/v1/agents/authority', requireRuntimeAuth, async (req, res) => {
    const job_type_id = String(req.body?.job_type_id || '').trim();
    if (!/^JT-\d{3}$/.test(job_type_id)) {
      return res.status(400).json({ error:'INVALID_JOB_TYPE' });
    }
    const result = await getLiveAgentAuthority().inspect(job_type_id);
    return res.status(result.verified ? 200 : 503).json(result);
  });

  // Read-only AG-001 proposal endpoint: no worker, store, or external effects.
  // The Drive job allocation snapshot is non-authoritative and never grants writes.
  app.post('/v1/agents/plan', requireRuntimeAuth, (req, res) => {
    try {
      const result = planAgentTask(req.body);
      return res.status(result.state === 'BLOCKED' ? 422 : 200).json(result);
    } catch (error) {
      return res.status(400).json({
        error: 'INVALID_AGENT_TASK',
        detail: error.message
      });
    }
  });

  // The executable workflow API uses the existing governed event runner.
  // No AG registry, parallel writer, or independent authority database.
  app.get('/v1/workflows', requireRuntimeAuth, (req,res) => {
    return res.status(200).json({
      schema_version:'MAGOS_WORKFLOW_CATALOG_V1',
      workflows:listWorkflows(),
      runtime:'GOVERNED_EVENT_RUNNER'
    });
  });

  app.post('/v1/workflows/run', requireRuntimeAuth, async (req,res) => {
    try {
      const outcome=await getWorkflowRunner().run(req.body);
      const status={
        COMMITTED:200,DUPLICATE:200,DUPLICATE_NO_OP:200,IGNORED:200,
        REVIEW_REQUIRED:202,REJECTED:400,EXECUTING:409,
        RETRY_REQUIRED:409,FAILED:500
      }[outcome.state] || 500;
      return res.status(status).json(outcome);
    } catch(error) {
      if(error instanceof WorkflowInputError) {
        return res.status(422).json({error:error.code});
      }
      return res.status(503).json({error:'GOVERNED_WORKFLOW_UNAVAILABLE'});
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

  app.post('/v1/events/run', requireRuntimeAuth, async (req, res) => {
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

  app.post('/v1/transactions', requireRuntimeAuth, async (req, res) => {
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
