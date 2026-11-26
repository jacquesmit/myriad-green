'use strict';

const crypto = require('crypto');
const path = require('node:path');
const express = require('express');
const { TransactionWriter } = require('../writer/transaction-writer');
const { planAgentTask } = require('../agents/agent-router');
const { LiveAgentAuthority } = require('../agents/live-agent-authority');
const { WorkflowRunner, WorkflowInputError } = require('../workflows/runner');
const { listWorkflows } = require('../workflows/catalog');
const { buildPublicationPlan } = require('../content/water-alert-publisher');
const { makeWordPressWaterAlertPublisher } = require('../content/wordpress-water-alert-publisher');
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
  deployedCommitSha = process.env.MAGOS_DEPLOY_COMMIT_SHA,
  startupGitStateReader = () => require('./release-preflight').localCheckout(),
  operatorReadToken = process.env.MAGOS_OPERATOR_READ_TOKEN,
  operatorLogin = require('./operator-login').createOperatorLogin(),
  signedAcceptanceVerifier = null,
  supplierApprovalToken = process.env.MAGOS_SUPPLIER_APPROVAL_TOKEN,
  supplierApprovalAuthorityVerifier = async () => ({verified:false,reason_code:'SUPPLIER_APPROVAL_AUTHORITY_NOT_VERIFIED'}),
  jobCreationToken = process.env.MAGOS_JOB_CREATION_TOKEN,
  quoteSigningToken = process.env.MAGOS_QUOTE_SIGNING_TOKEN,
  quoteAcceptanceToken = process.env.MAGOS_QUOTE_ACCEPTANCE_TOKEN,
  directCostToken = process.env.MAGOS_DIRECT_COST_TOKEN,
  provisionalCostToken = process.env.MAGOS_PROVISIONAL_COST_TOKEN,
  directCostEvidenceVerifier = null,
  // These trusted callbacks must independently attest supplier invoice review
  // and actual stock/job split. The built-in source inspection is read-only.
  supplierCostReviewAuthority = null,
  supplierStockSplitAuthority = null,
  quoteSigningSecret = process.env.MAGOS_WP_ACCEPTANCE_LINK_SECRET,
  signingPageReadiness = () => require('../processor/signed-quote-link').inspectSigningPage(),
  signingReadinessInspector = null,
  jobAuthorityVerifier = null,
  // Trusted server-side bank/provider settlement confirmation, never HTTP input.
  bankClearanceVerifier = null,
  procurementApprovalToken = process.env.MAGOS_PROCUREMENT_APPROVAL_TOKEN,
  procurementLookupFactory = () => new (require('../adapters/exact-lookup-service').ExactLookupService)(),
  procurementAuthorityVerifier = async () => ({verified:false,reason_code:'APPROVAL_AUTHORITY_NOT_VERIFIED'}),
  leadIngressToken = process.env.MAGOS_LEAD_INGRESS_TOKEN,
  leadIngressSources =
    process.env.MAGOS_LEAD_INGRESS_SOURCES || '',
  supplierEmailIngressToken = process.env.MAGOS_SUPPLIER_EMAIL_INGRESS_TOKEN,
  supplierEmailIngressSources = process.env.MAGOS_SUPPLIER_EMAIL_INGRESS_SOURCES || '',
  writerFactory = () => new TransactionWriter(),
  eventProcessorFactory = () => new EventProcessor(),
  liveAgentAuthorityFactory = () => new LiveAgentAuthority(),
  systemCoverageReaderFactory = () => new (require('../processor/system-coverage').SystemCoverageReader)(),
  waterAlertPlanner = buildPublicationPlan,
  waterAlertNow = () => new Date(),
  waterAlertPublishToken = process.env.MAGOS_WATER_ALERT_PUBLISH_TOKEN,
  waterAlertFeaturedMediaId = Number(process.env.MAGOS_WP_WATER_ALERT_FEATURED_MEDIA_ID || 0),
  waterAlertPublisherFactory = () => makeWordPressWaterAlertPublisher({ secret:waterAlertPublishToken }),
  eventDispatcherFactory = ({ writer }) =>
    new GovernedProcessorRegistry({ writer }),
  version = process.env.MAGOS_RUNTIME_VERSION || 'P2'
} = {}) {
  // Capture immutable source identity while the worker starts, not after a
  // mutable Git checkout or deployment environment variable changes.
  let startupGitState=null;
  try{startupGitState=startupGitStateReader();}
  catch{startupGitState=null;}
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  operatorLogin.mount(app);

  let writer;
  let eventProcessor;
  let eventDispatcher;
  let liveAgentAuthority;
  let systemCoverageReader;
  let workflowRunner;
  let waterAlertPublisher;
  const allowedLeadSources = parseAllowedLeadSources(leadIngressSources);
  const allowedSupplierEmailSources = parseAllowedSupplierEmailSources(supplierEmailIngressSources);

  const getWriter = () => {
    if (!writer) writer = writerFactory();
    return writer;
  };

  const getDirectCostEvidenceVerifier = () => directCostEvidenceVerifier ||
    require('../processor/supplier-cost-evidence')
      .makeSupplierCostEvidenceVerifier({
        stores:getWriter().stores,
        reviewAuthority:supplierCostReviewAuthority,
        stockAuthority:supplierStockSplitAuthority
      });

  const getSignedAcceptanceVerifier = () => signedAcceptanceVerifier ||
    require('../processor/wordpress-acceptance-verifier')
      .makeWordPressAcceptanceVerifier({stores:getWriter().stores});

  const getLiveAgentAuthority = () => {
    if (!liveAgentAuthority) liveAgentAuthority = liveAgentAuthorityFactory();
    return liveAgentAuthority;
  };

  const getWaterAlertPublisher = () => {
    if(!waterAlertPublisher)waterAlertPublisher=waterAlertPublisherFactory();
    return waterAlertPublisher;
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

  // Process-start deployment identity, not just the mutable host git checkout.
  // Set only by the verified deployment service before starting the worker.
  app.get('/v1/runtime/build', requireRuntimeAuth, (req,res)=>{
    const sha=String(deployedCommitSha||'').trim().toLowerCase();
    const checked=String(startupGitState?.sha||'').trim().toLowerCase();
    if(!/^[a-f0-9]{40}$/.test(sha)||!/^[a-f0-9]{40}$/.test(checked)||
       startupGitState?.dirty!==false||sha!==checked) {
      return res.status(503).json({
        schema_version:'MAGOS_RUNTIME_BUILD_V1',
        status:'UNVERIFIED',
        error:'RUNNING_GIT_CHECKOUT_OR_DEPLOY_DECLARATION_NOT_ATTESTED'
      });
    }
    return res.status(200).json({
      schema_version:'MAGOS_RUNTIME_BUILD_V1',
      commit_sha:sha,
      checkout_sha_at_process_start:checked,
      tracked_worktree_clean_at_start:true,
      status:'GIT_CHECKOUT_AND_DEPLOY_DECLARATION_MATCH',
      source:'STARTUP_GIT_CHECKOUT_PLUS_MAGOS_DEPLOY_COMMIT_SHA'
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
    ![token,leadIngressToken,supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,procurementApprovalToken].some(
      credential=>constantTimeEqual(credential,operatorReadToken)
    );
  function requireOperatorRead(req,res,next) {
    res.set('Cache-Control','private, no-store');
    if(operatorLogin.session(req)) return next();
    if(!hasOperatorToken) return res.status(503).json({error:'OPERATOR_ACCESS_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('X-MAGOS-Operator-Token'),operatorReadToken)) {
      return res.status(401).json({error:'UNAUTHORIZED'});
    }
    return next();
  }
  // Independent operator credential can inspect process-start Git provenance,
  // without exposing the privileged writer token or allowing deployment.
  // No real employee data or writes: draft readiness only.
  app.get('/v1/operator/workforce/onboarding',requireOperatorRead,(req,res)=>{
    try {
      const {planWorkforceOnboarding}=require('../processor/workforce-onboarding');
      return res.status(200).json(planWorkforceOnboarding({type:req.query.type}));
    } catch {
      return res.status(400).json({error:'INVALID_EMPLOYMENT_PATH'});
    }
  });
  app.get('/v1/operator/deployment',requireOperatorRead,(req,res)=>{
    const declared=String(deployedCommitSha||'').trim().toLowerCase();
    const startup=String(startupGitState?.sha||'').trim().toLowerCase();
    const valid=/^[a-f0-9]{40}$/;
    const verified=valid.test(declared)&&valid.test(startup)&&
      startupGitState?.dirty===false&&declared===startup;
    res.status(verified?200:202).json({
      schema_version:'MAGOS_OPERATOR_DEPLOYMENT_V1',
      status:verified?'PROCESS_START_GIT_MATCH':'NOT_VERIFIED',
      commit_sha:verified?declared:null,
      checkout_sha_at_process_start:verified?startup:null,
      tracked_worktree_clean_at_start:verified?true:null,
      source:'PROCESS_START_GIT_AND_DEPLOY_DECLARATION',
      production_business_acceptance:'NOT_VERIFIED',
      production_complete:false,
      writes:[],side_effects:false
    });
  });
  // Live WordPress client-signing dependencies, without disclosing bearer
  // tokens or treating installed software as an actual client receipt.
  app.get('/v1/operator/client-signing-readiness',requireOperatorRead,async(req,res)=>{
    try{
      const {inspectSigningReadiness}=require('../processor/signed-quote-link');
      const report=await (signingReadinessInspector||inspectSigningReadiness)();
      res.set('Cache-Control','private, no-store');
      return res.status(report.state==='READY_FOR_CONTROLLED_SIGNING_TEST'?200:202).json(report);
    }catch{
      return res.status(503).json({error:'CLIENT_SIGNING_READINESS_UNAVAILABLE'});
    }
  });
  app.get('/v1/operator/coverage',requireOperatorRead,async(req,res)=>{
    try {
      if(!systemCoverageReader)systemCoverageReader=systemCoverageReaderFactory();
      return res.status(200).json(await systemCoverageReader.read());
    } catch {
      return res.status(503).json({error:'MAGOS_SYSTEM_COVERAGE_UNAVAILABLE'});
    }
  });

  function requireOperatorInspection(req,res,next) {
    return req.get('X-MAGOS-Operator-Token')===undefined && !operatorLogin.session(req) ?
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
  // Integrated, read-only lead-to-job-to-closeout transaction view.
  // Ledger evidence is never mislabeled as independent provider settlement.
  app.get('/v1/operator/job-lifecycle/:jobId',requireOperatorInspection,async(req,res)=>{
    try{
      const {inspectJobLifecycle}=require('../processor/job-lifecycle');
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date());
      const part=type=>parts.find(x=>x.type===type)?.value;
      const asOf=part('year')+'-'+part('month')+'-'+part('day');
      const result=await inspectJobLifecycle({
        stores:getWriter().stores,jobId:req.params.jobId,asOf,
        evidenceVerifier:getSignedAcceptanceVerifier()
      });
      return res.status(result.state==='REVIEW_REQUIRED'?202:200).json(result);
    }catch{
      return res.status(503).json({error:'JOB_LIFECYCLE_SOURCE_UNAVAILABLE'});
    }
  });
  app.get('/v1/operator/scheduling-readiness/:jobId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectSchedulingReadiness}=require('../processor/scheduling-readiness');
      const result=await inspectSchedulingReadiness({stores:getWriter().stores,jobId:req.params.jobId});
      return res.status(result.state==='READY_FOR_PROVIDER_AVAILABILITY_CHECK'?200:202).json(result);
    }catch {
      return res.status(503).json({error:'SCHEDULING_READINESS_UNAVAILABLE'});
    }
  });

  // Finance is a source-derived reconciliation; it is not bank attestation.
  app.get('/v1/operator/receivables/:invoiceId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectInvoiceReceivable}=require('../processor/receivables-reconciliation');
      const result=await inspectInvoiceReceivable({
        stores:getWriter().stores,invoiceId:req.params.invoiceId
      });
      return res.status(result.state==='REVIEW_REQUIRED'?202:200).json(result);
    }catch {
      return res.status(503).json({error:'RECEIVABLES_SOURCE_UNAVAILABLE'});
    }
  });
  // Never send reviews or renewals based on a calculated draft candidate.
  app.get('/v1/operator/operational-closure/:jobId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectOperationalClosure}=require('../processor/operational-closure');
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date());
      const get=type=>parts.find(part=>part.type===type)?.value;
      const asOf=get('year')+'-'+get('month')+'-'+get('day');
      const result=await inspectOperationalClosure({stores:getWriter().stores,
        jobId:req.params.jobId,asOf});
      return res.status(result.state==='READY_FOR_OWNER_CLOSURE_REVIEW'?200:202).json(result);
    }catch{
      return res.status(503).json({error:'OPERATIONAL_CLOSURE_SOURCE_UNAVAILABLE'});
    }
  });

  app.get('/v1/operator/job-supplier-cost-queue/:jobId',requireOperatorInspection,async(req,res)=>{
    try{
      const {inspectJobSupplierCostQueue}=require('../processor/job-supplier-cost-queue');
      const result=await inspectJobSupplierCostQueue({
        stores:getWriter().stores,jobId:req.params.jobId,
        reviewAuthority:supplierCostReviewAuthority,
        stockAuthority:supplierStockSplitAuthority
      });
      return res.status(result.state==='REVIEW_REQUIRED'?202:200).json(result);
    }catch{return res.status(503).json({error:'SUPPLIER_COST_QUEUE_UNAVAILABLE'});}
  });

  // Existing supplier Cost_Allocations evidence, no writes or approval bypass.
  app.get('/v1/operator/supplier-cost-allocation/:allocationId',requireOperatorInspection,async(req,res)=>{
    const jobId=String(req.query.jobId||''),opportunityId=String(req.query.opportunityId||'');
    if(!jobId||!opportunityId)return res.status(400).json({error:'JOB_AND_OPPORTUNITY_REQUIRED'});
    try{
      const {inspectSupplierAllocation}=require('../processor/supplier-cost-evidence');
      const result=await inspectSupplierAllocation({
        stores:getWriter().stores,jobId,opportunityId,
        sourceEventId:req.params.allocationId,
        reviewAuthority:supplierCostReviewAuthority,
        stockAuthority:supplierStockSplitAuthority
      });
      return res.status(result.verified?200:202).json(result);
    }catch{return res.status(503).json({error:'SUPPLIER_COST_SOURCE_UNAVAILABLE'});}
  });

  app.get('/v1/operator/aftercare/:jobId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectJobAftercare}=require('../processor/aftercare-readiness');
      const asOf=new Intl.DateTimeFormat('en-CA',{
        timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'
      }).format(new Date());
      const result=await inspectJobAftercare({
        stores:getWriter().stores,jobId:req.params.jobId,asOf,
        maintenancePolicy:[]
      });
      return res.status(result.state==='REVIEW_REQUIRED'?202:200).json(result);
    }catch {
      return res.status(503).json({error:'AFTERCARE_SOURCE_UNAVAILABLE'});
    }
  });

  app.get('/v1/operator/job-closeout/:jobId',requireOperatorInspection,async(req,res)=>{
    try {
      const {inspectJobCloseout}=require('../processor/job-closeout-readiness');
      const result=await inspectJobCloseout({stores:getWriter().stores,jobId:req.params.jobId});
      return res.status(result.state==='READY_FOR_INDEPENDENT_FINANCIAL_CLOSE_REVIEW'?200:202).json(result);
    }catch {
      return res.status(503).json({error:'JOB_CLOSEOUT_EVIDENCE_UNAVAILABLE'});
    }
  });

  app.get('/v1/operator/job-activation/:quoteId',requireOperatorInspection,async(req,res)=>{
    try {
      const {assessJobActivation}=require('../processor/job-activation-assessment');
      const result=await assessJobActivation({
        stores:getWriter().stores,quoteId:req.params.quoteId,
        evidenceVerifier:getSignedAcceptanceVerifier()
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

  // Separate CMS publication credential. It must not equal runtime, operator,
  // ingress, finance, supplier or job-governance credentials.
  const hasWaterAlertPublishToken=Boolean(waterAlertPublishToken) &&
    String(waterAlertPublishToken).length>=32 &&
    ![token,operatorReadToken,leadIngressToken,supplierEmailIngressToken,
      supplierApprovalToken,jobCreationToken,procurementApprovalToken,
      quoteSigningToken,quoteAcceptanceToken,directCostToken,provisionalCostToken]
      .some(value=>constantTimeEqual(value,waterAlertPublishToken));
  function requireWaterAlertPublish(req,res,next){
    if(!hasWaterAlertPublishToken){
      return res.status(503).json({error:'WATER_ALERT_PUBLISHER_NOT_CONFIGURED'});
    }
    if(!constantTimeEqual(req.get('X-MAGOS-Water-Alert-Token'),waterAlertPublishToken)){
      return res.status(401).json({error:'UNAUTHORIZED'});
    }
    return next();
  }

  // Governed content publication boundary. The source is re-verified here;
  // caller-supplied READY/verified flags or site-index data are ignored.
  app.post('/v1/content/water-alert/publish',requireWaterAlertPublish,async(req,res)=>{
    const notice=req.body?.notice;
    if(!notice||typeof notice!=='object'||Array.isArray(notice)){
      return res.status(400).json({error:'WATER_ALERT_NOTICE_REQUIRED'});
    }
    try{
      const publisher=getWaterAlertPublisher();
      const areaPages=await publisher.discoverAreaPages(
        Array.isArray(notice.affected_areas)?notice.affected_areas:[]
      );
      const plan=waterAlertPlanner(notice,{
        now:waterAlertNow(),existing_posts:[],site_index:{area_pages:areaPages}
      });
      if(plan.state!=='READY_TO_PUBLISH'){
        return res.status(202).json({
          ...plan,publishing_performed:false,
          endpoint_mode:'VERIFIED_SOURCE_GATE'
        });
      }
      const result=await publisher.publish({
        plan,notice:plan.notice||notice,
        featuredMediaId:Number.isInteger(waterAlertFeaturedMediaId)?waterAlertFeaturedMediaId:0
      });
      const status=['CREATE_NEW','UPDATE_EXISTING','DUPLICATE_NO_OP'].includes(result.state)
        && result.verified===true ? 200 :
        result.state==='REVIEW_REQUIRED' ? 202 : 503;
      return res.status(status).json({
        ...result,endpoint_mode:'WORDPRESS_PUBLISH_AND_READBACK'
      });
    }catch(error){
      return res.status(503).json({error:'WATER_ALERT_PUBLISHER_UNAVAILABLE',detail:error.message});
    }
  });

  // Read-only water intelligence planner. It verifies source provenance,
  // deduplicates by immutable source event, maps lifecycle/internal links and
  // prepares SEO/AEO/GEO metadata. It never publishes to WordPress.
  app.post('/v1/content/water-alert/plan', requireRuntimeAuth, (req,res) => {
    const body=req.body||{};
    if(!body.notice || typeof body.notice!=='object' || Array.isArray(body.notice)) {
      return res.status(400).json({error:'WATER_ALERT_NOTICE_REQUIRED'});
    }
    try {
      const result=waterAlertPlanner(body.notice,{
        now:waterAlertNow(),
        existing_posts:Array.isArray(body.existing_posts)?body.existing_posts:[],
        site_index:body.site_index && typeof body.site_index==='object' ? body.site_index : {}
      });
      const status=result.state==='REVIEW_REQUIRED'?202:200;
      return res.status(status).json({
        ...result,
        endpoint_mode:'READ_ONLY_PLAN',
        publishing_performed:false
      });
    } catch(error) {
      return res.status(400).json({error:'WATER_ALERT_PLAN_FAILED',detail:error.message});
    }
  });

  app.post('/v1/workflows/run', requireRuntimeAuth, async (req,res) => {
    if (req.body?.envelope?.event_type === 'SUPPLIER_APPROVAL_CHANGED') return res.status(403).json({error:'SUPPLIER_APPROVAL_REQUIRES_GOVERNANCE_ENDPOINT'});
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

  // Supplier-approval authority is never inferred from caller-controlled event metadata.
  app.post('/v1/governance/supplier-approval', async (req, res) => {
    if (!supplierApprovalToken || [token,leadIngressToken,supplierEmailIngressToken,jobCreationToken,procurementApprovalToken,operatorReadToken].some(value=>constantTimeEqual(value,supplierApprovalToken))) {
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
      const attestation = await supplierApprovalAuthorityVerifier({
        supplier_id:change.supplier_id,
        from_state:change.from_state,
        to_state:change.to_state,
        source_event_id:change.source_event_id,
        evidence_ref:change.evidence_ref,
        claimed_actor_id:change.actor_id
      });
      if(attestation?.verified!==true ||
         attestation.supplier_id!==change.supplier_id ||
         attestation.from_state!==change.from_state ||
         attestation.to_state!==change.to_state ||
         attestation.source_event_id!==change.source_event_id ||
         attestation.evidence_ref!==change.evidence_ref ||
         !attestation.authorized_actor_id) {
        return res.status(202).json({
          state:'REVIEW_REQUIRED',
          reason_code:attestation?.reason_code||'SUPPLIER_APPROVAL_AUTHORITY_NOT_VERIFIED',
          writes:[]
        });
      }
      const envelope = createEventEnvelope({
        source: 'MGOS_GOVERNANCE',
        source_event_id: change.source_event_id,
        event_type: 'SUPPLIER_APPROVAL_CHANGED',
        actor: { id: attestation.authorized_actor_id },
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


  // Issue a signed *link only*, never accept a quote or create a job.
  app.post('/v1/governance/quote-signing-link',async(req,res)=>{
    const credentials=[token,operatorReadToken,leadIngressToken,
      supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,procurementApprovalToken];
    if(!quoteSigningToken || credentials.some(t=>constantTimeEqual(t,quoteSigningToken))) {
      return res.status(503).json({error:'QUOTE_SIGNING_AUTH_NOT_CONFIGURED'});
    }
    if(!constantTimeEqual(req.get('x-magos-signing-token'),quoteSigningToken)) {
      return res.status(401).json({error:'UNAUTHORIZED'});
    }
    const quoteId=req.body?.quoteId;
    if(typeof quoteId!=='string'||!quoteId.trim())
      return res.status(400).json({error:'QUOTE_ID_REQUIRED'});
    try {
      const {issueSignedQuoteLink}=require('../processor/signed-quote-link');
      const result=await issueSignedQuoteLink({
        stores:getWriter().stores,quoteId,secret:quoteSigningSecret,
        readiness:signingPageReadiness
      });
      return res.status(result.state==='READY_TO_SEND'?200:202).json(result);
    }catch{
      return res.status(503).json({error:'SIGNING_LINK_SOURCE_UNAVAILABLE'});
    }
  });

  // Independent signed-receipt review may transition an ACTIVE issued quote to
  // ACCEPTED. It does not create a job, clear money, order parts or book a crew.
  app.post('/v1/governance/accept-reviewed-quote',async(req,res)=>{
    const credentials=[token,operatorReadToken,leadIngressToken,
      supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,
      procurementApprovalToken,quoteSigningToken];
    if(!quoteAcceptanceToken ||
       credentials.some(t=>constantTimeEqual(t,quoteAcceptanceToken))) {
      return res.status(503).json({error:'QUOTE_ACCEPTANCE_AUTH_NOT_CONFIGURED'});
    }
    if(!constantTimeEqual(req.get('x-magos-acceptance-token'),quoteAcceptanceToken))
      return res.status(401).json({error:'UNAUTHORIZED'});
    const quoteId=req.body?.quoteId;
    if(typeof quoteId!=='string'||!quoteId.trim())
      return res.status(400).json({error:'QUOTE_ID_REQUIRED'});
    try{
      const {acceptReviewedQuote}=require('../processor/accept-reviewed-quote');
      const result=await acceptReviewedQuote({
        writer:getWriter(),quoteId,
        authorityVerifier:getSignedAcceptanceVerifier(),
        dryRun:req.body?.dryRun===true
      });
      return res.status(
        ['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:
        result.state==='REVIEW_REQUIRED'?202:409
      ).json(result);
    }catch{
      return res.status(503).json({error:'REVIEWED_QUOTE_ACCEPTANCE_UNAVAILABLE'});
    }
  });

  // Provisional owner cost entry is deliberately separate from verified costs.
  app.post('/v1/governance/provisional-job-cost',async(req,res)=>{
    const reserved=[token,operatorReadToken,leadIngressToken,
      supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,
      procurementApprovalToken,quoteSigningToken,quoteAcceptanceToken,directCostToken];
    if(!provisionalCostToken||reserved.some(t=>constantTimeEqual(t,provisionalCostToken)))
      return res.status(503).json({error:'PROVISIONAL_COST_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-provisional-cost-token'),provisionalCostToken))
      return res.status(401).json({error:'UNAUTHORIZED'});
    const b=req.body||{};
    if(!['jobId','sourceEventId','category','description','amountZar'].every(
      k=>typeof b[k]==='string'&&b[k].trim()))
      return res.status(400).json({error:'PROVISIONAL_COST_FIELDS_REQUIRED'});
    try{
      const {captureProvisionalJobCost}=require('../processor/provisional-job-cost');
      const result=await captureProvisionalJobCost({
        writer:getWriter(),jobId:b.jobId,sourceEventId:b.sourceEventId,
        category:b.category,description:b.description,amountZar:b.amountZar,
        ownerAttestation:async({job_id,source_event_id})=>({
          verified:true,job_id,source_event_id,authorized_owner_id:'MAGOS_OWNER_OPERATIONS'
        }),dryRun:b.dryRun===true
      });
      return res.status(['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:
        result.state==='REVIEW_REQUIRED'?202:409).json(result);
    }catch{return res.status(503).json({error:'PROVISIONAL_COST_CAPTURE_UNAVAILABLE'});}
  });

  // Verify an existing provisional row IN PLACE. Never duplicate an expense.
  app.post('/v1/governance/verify-provisional-cost',async(req,res)=>{
    const credentials=[token,operatorReadToken,leadIngressToken,
      supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,
      procurementApprovalToken,quoteSigningToken,quoteAcceptanceToken,
      provisionalCostToken];
    if(!directCostToken||credentials.some(t=>constantTimeEqual(t,directCostToken)))
      return res.status(503).json({error:'DIRECT_COST_VERIFICATION_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-direct-cost-token'),directCostToken))
      return res.status(401).json({error:'UNAUTHORIZED'});
    const b=req.body||{};
    if(!['jobId','sourceEventId','provisionalCostId'].every(
      key=>typeof b[key]==='string'&&b[key].trim()))
      return res.status(400).json({error:'PROVISIONAL_VERIFICATION_FIELDS_REQUIRED'});
    try{
      const {verifyProvisionalCost}=require('../processor/verify-provisional-cost');
      const result=await verifyProvisionalCost({
        writer:getWriter(),jobId:b.jobId,
        provisionalCostId:b.provisionalCostId,sourceEventId:b.sourceEventId,
        evidenceVerifier:getDirectCostEvidenceVerifier(),dryRun:b.dryRun===true
      });
      return res.status(
        ['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:
        result.state==='REVIEW_REQUIRED'?202:409
      ).json(result);
    }catch{
      return res.status(503).json({error:'PROVISIONAL_VERIFICATION_UNAVAILABLE'});
    }
  });

  // Receipt-backed actual job cost capture. Writer still enforces independent
  // Data_Ownership_Matrix and Writer_Schema_Registry authority before any write.
  app.post('/v1/governance/direct-job-cost',async(req,res)=>{
    const credentials=[token,operatorReadToken,leadIngressToken,
      supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,
      procurementApprovalToken,quoteSigningToken,quoteAcceptanceToken];
    if(!directCostToken || credentials.some(t=>constantTimeEqual(t,directCostToken)))
      return res.status(503).json({error:'DIRECT_COST_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-direct-cost-token'),directCostToken))
      return res.status(401).json({error:'UNAUTHORIZED'});
    const b=req.body||{};
    if(!['jobId','sourceEventId'].every(k=>typeof b[k]==='string'&&b[k].trim()))
      return res.status(400).json({error:'DIRECT_COST_JOB_AND_EVENT_REQUIRED'});
    try{
      const {recordVerifiedDirectCost}=require('../processor/record-direct-job-cost');
      const result=await recordVerifiedDirectCost({
        writer:getWriter(),jobId:b.jobId,sourceEventId:b.sourceEventId,
        evidenceVerifier:getDirectCostEvidenceVerifier(),dryRun:b.dryRun===true
      });
      return res.status(['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:
        result.state==='REVIEW_REQUIRED'?202:409).json(result);
    }catch{
      return res.status(503).json({error:'DIRECT_COST_CAPTURE_UNAVAILABLE'});
    }
  });

  // Governed job creation never accepts caller-controlled acceptance/payment flags.
  app.post('/v1/governance/create-job', async (req,res)=>{
    if(!jobCreationToken || [token,leadIngressToken,supplierEmailIngressToken,supplierApprovalToken,procurementApprovalToken,operatorReadToken].some(value=>constantTimeEqual(value,jobCreationToken)))return res.status(503).json({error:'JOB_CREATION_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-job-token')||'',jobCreationToken))return res.status(401).json({error:'UNAUTHORIZED'});
    const b=req.body||{};
    if(!['quoteId','jobId','sourceEventId'].every(k=>typeof b[k]==='string'&&b[k].trim()))return res.status(400).json({error:'JOB_IDENTIFIERS_REQUIRED'});
    try {
      const {executeAcceptedJob}=require('../processor/accepted-job-execution');
      const result=await executeAcceptedJob({writer:getWriter(),quoteId:b.quoteId,jobId:b.jobId,sourceEventId:b.sourceEventId,authorityVerifier:jobAuthorityVerifier || require('../processor/canonical-job-authority').createCanonicalJobAuthorityVerifier({stores:getWriter().stores,acceptanceVerifier:getSignedAcceptanceVerifier(),bankClearanceVerifier}),dryRun:b.dryRun===true});
      return res.status(['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:result.state==='REVIEW_REQUIRED'||result.state==='BLOCKED'?202:409).json(result);
    }catch(error){return res.status(500).json({error:'GOVERNED_JOB_CREATION_FAILED',detail:error.message});}
  });

  // Create a DRAFT purchase order from exact live supplier quote evidence.
  // No supplier dispatch, procurement release or payment authority occurs.
  app.post('/v1/governance/procurement-draft', async(req,res)=>{
    if(!procurementApprovalToken || [token,leadIngressToken,supplierApprovalToken,jobCreationToken].some(
      value=>constantTimeEqual(value,procurementApprovalToken)
    )) return res.status(503).json({error:'PROCUREMENT_DRAFT_AUTH_NOT_CONFIGURED'});
    if(!constantTimeEqual(req.get('x-magos-procurement-token'),procurementApprovalToken)) {
      return res.status(401).json({error:'UNAUTHORIZED'});
    }
    const b=req.body||{};
    if(!['supplierId','supplierQuoteId','poId','sourceEventId','evidenceRef'].every(
      key=>typeof b[key]==='string' && b[key].trim()
    ) || ![b.projectId,b.quoteId,b.jobId].some(value=>typeof value==='string'&&value.trim())) {
      return res.status(400).json({error:'PROCUREMENT_DRAFT_INPUT_REQUIRED'});
    }
    try {
      const {prepareProcurementDraft}=require('../processor/procurement-draft-transaction');
      const result=await prepareProcurementDraft({
        lookupService:procurementLookupFactory(),writer:getWriter(),
        supplierId:b.supplierId,supplierQuoteId:b.supplierQuoteId,
        poId:b.poId,sourceEventId:b.sourceEventId,evidenceRef:b.evidenceRef,
        projectId:b.projectId,quoteId:b.quoteId,jobId:b.jobId,
        dryRun:b.dryRun===true
      });
      return res.status(['COMMITTED','DUPLICATE_NO_OP','DRY_RUN'].includes(result.state)?200:
        ['REVIEW_REQUIRED','BLOCKED'].includes(result.state)?202:409)
        .json({...result,external_order_sent:false,payment_authorized:false});
    }catch {
      return res.status(503).json({error:'PROCUREMENT_DRAFT_UNAVAILABLE'});
    }
  });

  // Procurement approval is scoped to an internal PO state transition.
  // It never dispatches a supplier order or authorizes a payment.
  app.post('/v1/governance/procurement-approve', async (req, res) => {
    if (!procurementApprovalToken || [token,leadIngressToken,supplierEmailIngressToken,supplierApprovalToken,jobCreationToken,operatorReadToken].some(value=>constantTimeEqual(value,procurementApprovalToken))) {
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
    if (req.body?.event_type === 'SUPPLIER_APPROVAL_CHANGED') return res.status(403).json({error:'SUPPLIER_APPROVAL_REQUIRES_GOVERNANCE_ENDPOINT'});
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
    if (['SUPPLIER_APPROVAL_CHANGED','JOB_CREATE_FROM_ACCEPTED_SCOPE','PROCUREMENT_ISSUE_APPROVED','REVIEWED_QUOTE_ACCEPTANCE_CONFIRMED','VERIFIED_DIRECT_JOB_COST_CAPTURED','OWNER_PROVISIONAL_DIRECT_COST_DECLARED','PROVISIONAL_COST_VERIFIED_IN_PLACE'].includes(req.body?.event_type) ||
        req.body?.writes?.some(w => (w.store === 'commercial' && w.sheet === 'Project Direct Costs') ||
          (w.store === 'commercial' && w.sheet === 'Quotes' && ('Quote Status' in (w.changes||{}) || w.state_field === 'Quote Status')) ||
          (w.store === 'supplier' && ['Suppliers','Purchase_Orders'].includes(w.sheet)) ||
          (w.store === 'crm' && w.sheet === 'Jobs_Opportunities' && (w.changes?.job_id || w.values?.job_id)))) {
      return res.status(403).json({error:'BUSINESS_TRANSITION_REQUIRES_GOVERNANCE_ENDPOINT'});
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
