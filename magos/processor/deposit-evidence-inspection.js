'use strict';
const val=x=>String(x??'').trim();
const norm=x=>val(x).toUpperCase();
/**
 * Read-only financial evidence. Bank-confirmed allocations alone may constitute
 * clearance; client proof, control snapshots and deposit notices never do.
 */
async function inspectDepositEvidence({stores,opportunityId}={}){
 if(!val(opportunityId)||typeof stores?.commercial?.readObjects!=='function')
  return {state:'REVIEW_REQUIRED',reason_code:'PAYMENT_READER_UNAVAILABLE',writes:[]};
 const [controls,allocations]=await Promise.all([
  stores.commercial.readObjects('Payment Control'),
  stores.commercial.readObjects('Payment_Allocations')
 ]);
 if(!Array.isArray(controls)||!Array.isArray(allocations))
  return {state:'REVIEW_REQUIRED',reason_code:'FINANCIAL_INDEX_UNAVAILABLE',writes:[]};
 const matches=controls.filter(r=>val(r['Opportunity ID'])===opportunityId);
 if(matches.length!==1)return {state:'REVIEW_REQUIRED',reason_code:matches.length?'AMBIGUOUS_PAYMENT_CONTROL':'PAYMENT_CONTROL_NOT_FOUND',writes:[]};
 const control=matches[0],controlId=val(control['Control ID']);
 const cleared=allocations.filter(r=>val(r.control_id)===controlId && norm(r.allocation_state)==='CLEARED' && norm(r.allocation_type)==='DEPOSIT' && val(r.evidence_link));
 const required=Number(val(control['Deposit Required (R)']).replace(/[^0-9.-]/g,''));
 if(!Number.isFinite(required)||required<0)return {state:'REVIEW_REQUIRED',reason_code:'DEPOSIT_REQUIREMENT_UNVERIFIED',writes:[]};
 const total=cleared.reduce((sum,r)=>sum+Number(val(r.amount).replace(/[^0-9.-]/g,'')),0);
 if(cleared.some(r=>!Number.isFinite(Number(val(r.amount).replace(/[^0-9.-]/g,'')))||Number(val(r.amount).replace(/[^0-9.-]/g,''))<=0))
  return {state:'REVIEW_REQUIRED',reason_code:'INVALID_CLEARED_ALLOCATION',writes:[]};
 return {state:total>=required && (required===0||cleared.length>0)?'CLEARED_ALLOCATION_EVIDENCED':'REVIEW_REQUIRED',
  reason_code:total>=required?'':'INSUFFICIENT_CLEARED_ALLOCATIONS',
  opportunity_id:opportunityId,control_id:controlId,deposit_required:required,cleared_deposit_total:total,
  allocation_ids:cleared.map(r=>val(r.allocation_id)),evidence_links:cleared.map(r=>val(r.evidence_link)),
  evidence_source:'Payment_Allocations',authority:'READ_ONLY_CANONICAL',writes:[],side_effects:false};
}
module.exports={inspectDepositEvidence};
