'use strict';

// Combined, authoritative closeout inspection. This is a decision aid, not an
// authorization to change a client job, issue an invoice or claim bank clearance.
const {inspectJobCloseout}=require('./job-closeout-readiness');
const {inspectInvoiceReceivable}=require('./receivables-reconciliation');
const {inspectJobAftercare}=require('./aftercare-readiness');
const val=v=>String(v??'').trim();

async function inspectOperationalClosure({stores,jobId,asOf}={}){
 const blockers=[],actions=[];
 if(!val(jobId)||!stores?.crm?.readObjects||!stores?.commercial?.readObjects||!stores?.supplier?.readObjects){
  return {state:'REVIEW_REQUIRED',blockers:['REQUIRED_CANONICAL_STORES_UNAVAILABLE'],
   writes:[],side_effects:false};
 }
 const [jobRows,executionRows]=await Promise.all([
  stores.crm.readObjects('Jobs_Opportunities',{maxRows:null}),
  stores.commercial.readObjects('Job Execution',{maxRows:null})
 ]);
 if(!Array.isArray(jobRows)||!Array.isArray(executionRows))throw Error('LIFECYCLE_SOURCE_UNAVAILABLE');
 const jobs=jobRows.filter(row=>val(row.job_id)===jobId);
 const executions=executionRows.filter(row=>val(row['Job ID'])===jobId);
 if(jobs.length!==1)blockers.push('JOB_HEADER_NOT_UNIQUE');
 if(executions.length!==1)blockers.push('JOB_EXECUTION_NOT_UNIQUE');
 if(blockers.length)return {schema_version:'MAGOS_OPERATIONAL_CLOSURE_V1',job_id:jobId,
  state:'REVIEW_REQUIRED',blockers,actions:['Reconcile exact job and execution identities'],
  writes:[],side_effects:false};
 const job=jobs[0],execution=executions[0];
 if(val(job.opportunity_id)!==val(execution.opportunity_id))
  blockers.push('OPPORTUNITY_ID_MISMATCH');
 if(val(job.client_crm_id)!==val(execution['CRM ID']))
  blockers.push('CLIENT_ID_MISMATCH');
 const invoiceId=val(execution.invoice_id);
 if(!invoiceId){blockers.push('FINAL_INVOICE_ID_MISSING');actions.push('Resolve final invoice ID');}
 const [field,finance,aftercare]=await Promise.all([
  inspectJobCloseout({stores,jobId}),
  invoiceId?inspectInvoiceReceivable({stores,invoiceId}):Promise.resolve({
   state:'REVIEW_REQUIRED',issues:['FINAL_INVOICE_MISSING'],writes:[],side_effects:false
  }),
  inspectJobAftercare({stores,jobId,asOf,maintenancePolicy:[]})
 ]);
 for(const reason of field.blockers||[])blockers.push('FIELD:'+reason);
 if(field.state!=='READY_FOR_INDEPENDENT_FINANCIAL_CLOSE_REVIEW')
  actions.push('Resolve field evidence, variation approvals and actual job cost reconciliation');
 if(finance.job_id && finance.job_id!==jobId)
  blockers.push('FINANCE:INVOICE_JOB_ID_MISMATCH');
 for(const reason of finance.issues||[])blockers.push('FINANCE:'+reason);
 if(finance.state!=='RECORDED_CLEARED_BALANCE_ZERO'){
  blockers.push('FINANCE:OUTSTANDING_OR_UNVERIFIED_BALANCE');
  actions.push('Reconcile issued invoice and independently cleared bank allocations');
 }
 for(const reason of aftercare.issues||[])blockers.push('AFTERCARE:'+reason);
 if(aftercare.state!=='AFTERCARE_CANDIDATES_PREPARED')
  actions.push('Reconcile installed-part, warranty and aftercare records');
 // Even a zero balance from recorded cleared allocations is not independent bank proof.
 // No automatic CLOSE transition. It requires a separate authorized owner release.
 return {
  schema_version:'MAGOS_OPERATIONAL_CLOSURE_V1',
  job_id:jobId,invoice_id:invoiceId,
  state:blockers.length?'REVIEW_REQUIRED':'READY_FOR_OWNER_CLOSURE_REVIEW',
  blockers:[...new Set(blockers)],
  next_actions:[...new Set(actions)],
  field:{state:field.state,variation_count:field.variation_count,
    cost_line_count:field.direct_cost_line_count,final_profit_verified:field.final_profit_verified},
  finance:{state:finance.state,recorded_balance_zar:finance.recorded_balance_zar,
    independent_bank_confirmation:finance.independent_bank_confirmation},
  aftercare:{state:aftercare.state,asset_count:aftercare.asset_count,
    service_due_count:(aftercare.service_due_candidates||[]).length},
  operational_close_authorized:false,
  payment_clearance_authorized:false,
  customer_outreach_authorized:false,
  writes:[],side_effects:false
 };
}
module.exports={inspectOperationalClosure};
