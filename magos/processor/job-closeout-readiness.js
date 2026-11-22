'use strict';

// Canonical commercial job closeout assessment: read-only, never marks PAID,
// CLOSED, COSTED or authorizes invoices without independent source evidence.
const val=v=>String(v??'').trim();
const upper=v=>val(v).toUpperCase();
const money=v=>{
 const s=val(v).replace(/^(ZAR|R)\s*/i,'').replace(/[\s\u00a0]/g,'');
 if(!/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(s))return null;
 const n=Number(s.replace(/,/g,''));return Number.isFinite(n)&&n>=0?n:null;
};
const {inspectVariationRegister}=require('./variation-review');
const evidenced=new Set(['EVIDENCED','SUPPLIER_INVOICE_EVIDENCED','BANK_EVIDENCED','VERIFIED']);
function uniqueRecord(rows,field,id) {
 const found=rows.filter(x=>val(x[field])===id);
 return found.length===1?{row:found[0]}:{error:found.length?'DUPLICATE_'+field.toUpperCase().replace(/[^A-Z]/g,'_'):'RECORD_NOT_FOUND'};
}
async function inspectJobCloseout({stores,jobId}={}){
 if(!val(jobId)||!stores?.commercial?.readObjects) return {
  state:'REVIEW_REQUIRED',blockers:['JOB_ID_OR_READER_MISSING'],
  writes:[],side_effects:false
 };
 const commercial=stores.commercial;
 const [executionRows,variationRows,costRows,marginRows]=await Promise.all([
  commercial.readObjects('Job Execution'),
  commercial.readObjects('Variations'),
  commercial.readObjects('Project Direct Costs'),
  commercial.readObjects('Project Cost & Margin')
 ]);
 if(![executionRows,variationRows,costRows,marginRows].every(Array.isArray))
  throw Error('CANONICAL_REGISTERS_UNAVAILABLE');
 const execMatches=executionRows.filter(r=>val(r['Job ID'])===jobId);
 const blockers=[],warnings=[];
 if(execMatches.length!==1)blockers.push(execMatches.length?'DUPLICATE_JOB_EXECUTION':'JOB_EXECUTION_NOT_FOUND');
 const exec=execMatches.length===1?execMatches[0]:null;
 const variations=variationRows.filter(r=>val(r['Job ID'])===jobId);
 if(upper(exec?.['Variation Required'])==='YES'&&!variations.length)
  blockers.push('REQUIRED_VARIATION_NOT_RECORDED');
 // Apply the SAME canonical variation validation used by the operator
 // workspace; closeout cannot ignore undocumented price/cost/scope/invoice.
 const inspectedVariations=inspectVariationRegister(variations);
 const seenVariations=new Set();
 for(const item of inspectedVariations.records){
  const id=item.id;
  if(!id || seenVariations.has(id)){
   blockers.push('DUPLICATE_OR_MISSING_VARIATION_ID');
  }
  seenVariations.add(id);
  for(const reason of item.blockers){
   if(reason==='CLIENT_VARIATION_APPROVAL_UNVERIFIED')
    blockers.push('VARIATION_APPROVAL_UNVERIFIED:'+id);
   else if(reason==='DUPLICATE_VARIATION_ID')
    blockers.push('DUPLICATE_OR_MISSING_VARIATION_ID');
   else blockers.push('VARIATION_'+reason+':'+(id||'UNKNOWN'));
  }
  const raw=variations.find(row=>val(row['Variation ID'])===id);
  if(['DRAFT','TO_CONFIRM','PENDING'].includes(upper(raw?.['Execution Status'])))
   blockers.push('VARIATION_EXECUTION_UNRESOLVED:'+id);
 }
 if(!exec || !['COMPLETED','WORK_COMPLETE','HANDOVER_COMPLETE','CLOSED'].includes(
   upper(exec['Completion Status'])||upper(exec['Job Status'])
 )) blockers.push('FIELD_COMPLETION_NOT_VERIFIED');
 if(!val(exec?.['After Evidence']))blockers.push('AFTER_EVIDENCE_MISSING');
 if(!val(exec?.['Completion Sign-off']))blockers.push('COMPLETION_SIGNOFF_MISSING');
 const costMatches=marginRows.filter(r=>val(r.job_id)===jobId);
 if(costMatches.length!==1) blockers.push(costMatches.length?'DUPLICATE_MARGIN_RECORD':'JOB_MARGIN_RECORD_MISSING');
 const margin=costMatches.length===1?costMatches[0]:null;
 const contract=money(margin?.contract_value_inc_vat);
 if(contract===null)blockers.push('CONTRACT_REVENUE_NOT_VERIFIED');
 const costs=costRows.filter(r=>val(r.job_id)===jobId && upper(r.financial_treatment)!=='NON_JOB_COST');
 const ids=new Set();let evidencedCosts=0,pendingCosts=0;
 if(!costs.length)blockers.push('ACTUAL_COST_LINES_MISSING');
 for(const row of costs){
  const id=val(row.direct_cost_id),amount=money(row.amount);
  if(!id||ids.has(id)){blockers.push('DUPLICATE_OR_MISSING_DIRECT_COST_ID');continue;}
  ids.add(id);
  if(amount===null){blockers.push('DIRECT_COST_INVALID:'+id);continue;}
  const evidenceVerified=Boolean(val(row.evidence_link))&&
   evidenced.has(upper(row.evidence_status));
  const allocated=upper(row.allocation_status)==='ALLOCATED_TO_JOB';
  const finalTreatment=upper(row.financial_treatment)!=='PROVISIONAL_DIRECT_COST';
  if(!evidenceVerified)blockers.push('DIRECT_COST_EVIDENCE_UNVERIFIED:'+id);
  if(!allocated)blockers.push('DIRECT_COST_ALLOCATION_UNVERIFIED:'+id);
  if(!finalTreatment)blockers.push('PROVISIONAL_DIRECT_COST_NOT_FINAL:'+id);
  if(evidenceVerified&&allocated&&finalTreatment)evidencedCosts+=amount;
  else pendingCosts+=amount;
 }
 if(!['FINAL','RECONCILED','FINAL_RECONCILED'].includes(upper(margin?.final_cost_status)))
  blockers.push('FINAL_JOB_COST_RECONCILIATION_MISSING');
 if(!val(margin?.labour_cost_status)||upper(margin?.labour_cost_status)==='TO_CONFIRM')
  blockers.push('LABOUR_ACTUALS_UNVERIFIED');
 if(!val(margin?.overhead_allocation_status)||upper(margin?.overhead_allocation_status)==='TO_CONFIRM')
  warnings.push('OVERHEAD_ALLOCATION_PENDING');
 const contribution=contract===null?null:Number((contract-evidencedCosts).toFixed(2));
 return {
  schema_version:'MAGOS_JOB_CLOSEOUT_READINESS_V1',
  job_id:jobId,
  state:blockers.length?'REVIEW_REQUIRED':'READY_FOR_INDEPENDENT_FINANCIAL_CLOSE_REVIEW',
  blockers:[...new Set(blockers)],
  warnings:[...new Set(warnings)],
  variation_count:variations.length,
  variation_review_count:inspectedVariations.counts.review,
  variation_retrospective_count:inspectedVariations.counts.retrospective,
  direct_cost_line_count:costs.length,
  evidenced_cost_sum_zar:Number(evidencedCosts.toFixed(2)),
  provisional_unverified_cost_sum_zar:Number(pendingCosts.toFixed(2)),
  contract_value_zar:contract,
  provisional_contribution_before_unverified_costs_zar:contribution,
  final_profit_verified:false,
  financial_close_authorized:false,
  operational_close_authorized:false,
  writes:[],side_effects:false
 };
}
module.exports={inspectJobCloseout,money};
