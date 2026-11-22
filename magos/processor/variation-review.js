'use strict';
// Simpro/Fergus benchmark: scope changes require explicit commercial review.
// This projection reads existing Variations; never authorizes, signs or invoices.
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
const approved=new Set(['APPROVED','ACCEPTED','SIGNED','CLIENT_APPROVED']);
const done=new Set(['WORK_COMPLETED','COMPLETED','HANDOVER_COMPLETE','CLOSED']);
const amount=value=>{
 const s=v(value).replace(/^(ZAR|R)\s*/i,'').replace(/[\s\u00a0]/g,'');
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s))return null;
 return Number(s.replace(/,/g,''));
};
function inspectVariationRow(row){
 const id=v(row['Variation ID']),job=v(row['Job ID']);
 const blockers=[];
 if(!id)blockers.push('VARIATION_ID_MISSING');
 if(!job)blockers.push('JOB_ID_MISSING');
 if(!v(row['Original Scope Ref']))blockers.push('ORIGINAL_SCOPE_REFERENCE_MISSING');
 if(!v(row['New Finding'])||!v(row['Additional Work']))
  blockers.push('SCOPE_DELTA_NOT_DOCUMENTED');
 const price=amount(row['Selling Price Impact (R)']);
 const cost=amount(row['Cost Impact (R)']);
 if(price===null)blockers.push('SELL_PRICE_IMPACT_UNVERIFIED');
 if(cost===null)blockers.push('COST_IMPACT_UNVERIFIED');
 if(!approved.has(up(row['Approval Status']))||!v(row['Approval Evidence']))
  blockers.push('CLIENT_VARIATION_APPROVAL_UNVERIFIED');
 const execution=up(row['Execution Status']);
 const completed=done.has(execution)||execution.includes('WORK_COMPLETED');
 if(completed&&blockers.includes('CLIENT_VARIATION_APPROVAL_UNVERIFIED'))
  blockers.push('RETROSPECTIVE_CLIENT_APPROVAL_REQUIRED');
 if(price!==null&&price>0&&!v(row['Invoice Ref']))
  blockers.push('BILLABLE_VARIATION_INVOICE_LINK_MISSING');
 if(completed&&!v(row['Drive Evidence']))
  blockers.push('COMPLETION_EVIDENCE_MISSING');
 return {
  id,job_id:job,client:v(row.Client),original_scope_ref:v(row['Original Scope Ref']),
  price_impact_zar:price,cost_impact_zar:cost,
  approval_status:v(row['Approval Status'])||'UNKNOWN',
  execution_status:v(row['Execution Status'])||'UNKNOWN',
  invoice_ref:v(row['Invoice Ref']),
  approved_for_scope:approved.has(up(row['Approval Status']))&&!!v(row['Approval Evidence']),
  completed_work_recorded:completed,
  state:blockers.length?'REVIEW_REQUIRED':'EVIDENCED_VARIATION',
  blockers,next_action:blockers.length?
   (completed?'Reconcile retrospective client acceptance, price/cost and invoice evidence':
    'Confirm client variation scope, price and written approval before additional work'):
   'Review downstream invoice, settlement and job closeout before financial completion',
  payment_clearance:'NOT_VERIFIED',financial_close_authorized:false
 };
}
function inspectVariationRegister(rows){
 if(!Array.isArray(rows))throw Error('VARIATION_REGISTER_UNAVAILABLE');
 const seen=new Set(),duplicate=new Set();
 for(const row of rows){
  const id=v(row['Variation ID']);
  if(id&&seen.has(id))duplicate.add(id);
  seen.add(id);
 }
 const records=rows.map(row=>{
  const inspected=inspectVariationRow(row);
  if(duplicate.has(inspected.id)){
   inspected.state='REVIEW_REQUIRED';
   inspected.blockers.push('DUPLICATE_VARIATION_ID');
   inspected.next_action='Reconcile duplicate variation identity before financial action';
  }
  return inspected;
 });
 return {
  schema_version:'MAGOS_VARIATION_REGISTER_V1',
  state:records.some(r=>r.state==='REVIEW_REQUIRED')?'PARTIAL':'LIVE',
  counts:{
   total:records.length,
   review:records.filter(r=>r.state==='REVIEW_REQUIRED').length,
   retrospective:records.filter(r=>r.blockers.includes('RETROSPECTIVE_CLIENT_APPROVAL_REQUIRED')).length,
   price_evidence_gaps:records.filter(r=>r.blockers.some(b=>b.endsWith('IMPACT_UNVERIFIED'))).length
  },
  records,writes:[],side_effects:false
 };
}
module.exports={inspectVariationRow,inspectVariationRegister};
