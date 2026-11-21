'use strict';
const val=x=>String(x??'').trim();
const norm=x=>val(x).toUpperCase();
const {moneyCents}=require('./receivables-reconciliation');
const driveUrl=x=>{
 try{
  const u=new URL(val(x));
  return u.protocol==='https:'&&u.hostname==='drive.google.com'&&
    /^\/file\/d\/[A-Za-z0-9_-]+\//.test(u.pathname)&&
    !u.username&&!u.password&&!u.port;
 }catch{return false;}
};
const review=(reason_code,details={})=>({
 state:'REVIEW_REQUIRED',reason_code,...details,writes:[],side_effects:false
});
/**
 * Bank-cleared events must corroborate every deposit allocation. A copied
 * Payment Control snapshot, payment proof, missing event or duplicate key
 * cannot authorize job release or procurement.
 */
async function inspectDepositEvidence({stores,opportunityId}={}){
 const opportunity=val(opportunityId);
 if(!opportunity||typeof stores?.commercial?.readObjects!=='function')
  return review('PAYMENT_READER_UNAVAILABLE');
 let controls,allocations,events;
 try{
  [controls,allocations,events]=await Promise.all([
    stores.commercial.readObjects('Payment Control',{maxRows:null}),
    stores.commercial.readObjects('Payment_Allocations',{maxRows:null}),
    stores.commercial.readObjects('Payment_Events',{maxRows:null})
  ]);
 }catch{return review('CANONICAL_PAYMENT_SOURCE_UNAVAILABLE');}
 if(![controls,allocations,events].every(Array.isArray))
  return review('FINANCIAL_INDEX_UNAVAILABLE');
 const controlsForOpportunity=controls.filter(r=>val(r['Opportunity ID'])===opportunity);
 if(controlsForOpportunity.length!==1)return review(
  controlsForOpportunity.length?'AMBIGUOUS_PAYMENT_CONTROL':'PAYMENT_CONTROL_NOT_FOUND');
 const control=controlsForOpportunity[0],controlId=val(control['Control ID']);
 if(!controlId)return review('PAYMENT_CONTROL_ID_MISSING');
 const required=moneyCents(control['Deposit Required (R)']);
 if(required===null)return review('DEPOSIT_REQUIREMENT_UNVERIFIED');
 if(required===0)return {
  ...review('NO_DEPOSIT_REQUIRED_NOT_BANK_CLEARED'),opportunity_id:opportunity,
  control_id:controlId,deposit_required:0,cleared_deposit_total:0,
  evidence_source:'Payment_Allocations_AND_Payment_Events'
 };
 const matching=allocations.filter(r=>val(r.control_id)===controlId&&
  norm(r.allocation_type)==='DEPOSIT'&&norm(r.allocation_state)==='CLEARED');
 const seenAllocations=new Set(),seenEvents=new Set();
 let totalCents=0;
 const ids=[],eventIds=[],evidenceLinks=[];
 for(const a of matching){
  const allocationId=val(a.allocation_id),eventId=val(a.payment_event_id);
  if(!allocationId||seenAllocations.has(allocationId))
   return review('DUPLICATE_OR_MISSING_CLEARED_ALLOCATION_ID');
  seenAllocations.add(allocationId);
  if(!eventId||seenEvents.has(eventId))
   return review('MISSING_OR_REUSED_BANK_CLEARANCE_EVENT');
  seenEvents.add(eventId);
  if(!driveUrl(a.evidence_link))return review('CLEARED_ALLOCATION_EVIDENCE_INVALID');
  if(val(control.deposit_id)&&val(a.deposit_id)!==val(control.deposit_id))
   return review('DEPOSIT_ALLOCATION_IDENTITY_MISMATCH');
  const cents=moneyCents(a.amount);
  if(cents===null||cents<=0)return review('INVALID_CLEARED_ALLOCATION');
  const found=events.filter(e=>val(e.payment_event_id)===eventId);
  if(found.length!==1)return review('BANK_CLEARANCE_EVENT_MISSING_OR_DUPLICATED');
  const e=found[0];
  if(val(e.control_id)!==controlId||val(e.opportunity_id)!==opportunity||
     norm(e.clearance_state)!=='CLEARED'||norm(e.event_type)!=='PAYMENT_CLEARED'||
     !val(e.idempotency_key)||!val(e.source_system)||
     !driveUrl(e.evidence_link)||val(e.evidence_link)!==val(a.evidence_link)||
     moneyCents(e.amount)!==cents)
   return review('BANK_EVENT_AND_ALLOCATION_NOT_RECONCILED');
  if(val(e.invoice_id)&&val(a.invoice_id)&&val(e.invoice_id)!==val(a.invoice_id))
   return review('PAYMENT_INVOICE_IDENTITY_MISMATCH');
  totalCents+=cents;
  if(!Number.isSafeInteger(totalCents))return review('DEPOSIT_SUM_OVERFLOW');
  ids.push(allocationId);eventIds.push(eventId);evidenceLinks.push(val(a.evidence_link));
 }
 if(totalCents<required)return review('INSUFFICIENT_CLEARED_ALLOCATIONS',{
  opportunity_id:opportunity,control_id:controlId,deposit_required:required/100,
  cleared_deposit_total:totalCents/100
 });
 return {
  state:'CLEARED_ALLOCATION_EVIDENCED',reason_code:'',
  opportunity_id:opportunity,control_id:controlId,
  deposit_required:required/100,cleared_deposit_total:totalCents/100,
  allocation_ids:ids,payment_event_ids:eventIds,evidence_links:evidenceLinks,
  evidence_source:'Payment_Allocations_AND_Payment_Events',
  authority:'READ_ONLY_CANONICAL_EVENT_RECONCILIATION',
  independent_bank_confirmation:false,
  writes:[],side_effects:false
 };
}
module.exports={inspectDepositEvidence};
