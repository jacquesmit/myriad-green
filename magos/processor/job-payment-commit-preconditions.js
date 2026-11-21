'use strict';
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
const {moneyCents}=require('./receivables-reconciliation');
const val=x=>String(x??'').trim();
const unique=xs=>Array.isArray(xs)&&xs.length>0&&xs.every(x=>val(x))&&new Set(xs).size===xs.length;
const equalIds=(a,b)=>unique(a)&&unique(b)&&a.length===b.length&&a.every(x=>b.includes(x));
const fail=reason_code=>({state:'REVIEW_REQUIRED',reason_code,preconditions:[],writes:[],side_effects:false});

/**
 * Pre-commit CAS on the same finance source rows used for signed job authority.
 * The bank callback is independent; this is an additional last-mile guard,
 * not proof of external settlement or an atomic sheet-wide snapshot.
 */
async function buildJobPaymentPreconditions({stores,opportunityId,authority}={}){
 if(!stores?.commercial?.readObjects||!val(opportunityId))
  return fail('CANONICAL_FINANCIAL_SOURCE_UNAVAILABLE');
 if(!authority||authority.payment_clearance!=='CLEARED'||
  !val(authority.bank_clearance_confirmation_id)||
  !['BANK','PAYMENT_PROVIDER'].includes(authority.bank_confirmation_source)||
  !val(authority.payment_control_id)||
  !Number.isSafeInteger(authority.bank_confirmed_amount_cents)||
  authority.bank_confirmed_amount_cents<=0||
  !Number.isSafeInteger(authority.bank_deposit_required_cents)||
  authority.bank_deposit_required_cents<=0||
  !unique(authority.allocation_ids)||
  !unique(authority.payment_event_ids))
  return fail('INDEPENDENT_BANK_AUTHORITY_BINDING_INCOMPLETE');
 const recorded=await inspectDepositEvidence({stores,opportunityId});
 if(recorded.state!=='CLEARED_ALLOCATION_EVIDENCED')
  return fail(recorded.reason_code||'PAYMENT_SOURCE_NOT_CLEARED');
 if(recorded.control_id!==authority.payment_control_id||
   !equalIds(recorded.allocation_ids,authority.allocation_ids)||
   !equalIds(recorded.payment_event_ids,authority.payment_event_ids))
  return fail('ATTESTED_BANK_EVENT_SET_CHANGED');
 if(Math.round(recorded.cleared_deposit_total*100)!==authority.bank_confirmed_amount_cents||
    Math.round(recorded.deposit_required*100)!==authority.bank_deposit_required_cents)
  return fail('BANK_CONFIRMED_AMOUNT_OR_DEPOSIT_REQUIREMENT_CHANGED');
 let controls,allocations,events;
 try{
  [controls,allocations,events]=await Promise.all([
   stores.commercial.readObjects('Payment Control',{maxRows:null}),
   stores.commercial.readObjects('Payment_Allocations',{maxRows:null}),
   stores.commercial.readObjects('Payment_Events',{maxRows:null})
  ]);
 }catch{return fail('FINANCIAL_CAS_SOURCE_UNAVAILABLE');}
 if(![controls,allocations,events].every(Array.isArray))
  return fail('FINANCIAL_CAS_SOURCE_UNAVAILABLE');
 const controlRows=controls.filter(x=>val(x['Control ID'])===recorded.control_id);
 if(controlRows.length!==1||val(controlRows[0]['Opportunity ID'])!==opportunityId)
  return fail('FINANCIAL_CONTROL_CHANGED');
 const control=controlRows[0];
 const required=moneyCents(control['Deposit Required (R)']);
 if(required===null||required!==Math.round(recorded.deposit_required*100))
  return fail('DEPOSIT_REQUIRED_CHANGED');
 const conditions=[{store:'commercial',sheet:'Payment Control',
   key:{header:'Control ID',value:recorded.control_id},
   expect:{'Opportunity ID':opportunityId,'Deposit Required (R)':control['Deposit Required (R)'],
     ...(val(control.deposit_id)?{deposit_id:control.deposit_id}:{})}}];
 let sum=0;
 for(let i=0;i<recorded.allocation_ids.length;i++){
  const allocationId=recorded.allocation_ids[i];
  const eventId=recorded.payment_event_ids[i];
  const aRows=allocations.filter(r=>val(r.allocation_id)===allocationId);
  const eRows=events.filter(r=>val(r.payment_event_id)===eventId);
  if(aRows.length!==1||eRows.length!==1)return fail('FINANCIAL_EVENT_ID_NOT_UNIQUE_AT_COMMIT');
  const a=aRows[0],e=eRows[0];
  const cents=moneyCents(a.amount);
  if(cents===null||cents<=0||moneyCents(e.amount)!==cents||
     val(a.control_id)!==recorded.control_id||
     val(e.control_id)!==recorded.control_id||
     val(e.opportunity_id)!==opportunityId||
     val(a.payment_event_id)!==eventId||
     val(a.allocation_type)!=='DEPOSIT'||val(a.allocation_state)!=='CLEARED'||
     val(e.event_type)!=='PAYMENT_CLEARED'||val(e.clearance_state)!=='CLEARED'||
     !val(a.evidence_link)||val(a.evidence_link)!==val(e.evidence_link))
   return fail('PAYMENT_RECORD_CHANGED_BEFORE_COMMIT');
  sum+=cents;
  if(!Number.isSafeInteger(sum))return fail('PAYMENT_SUM_OVERFLOW');
  conditions.push({store:'commercial',sheet:'Payment_Allocations',
    key:{header:'allocation_id',value:allocationId},
    expect:{control_id:recorded.control_id,payment_event_id:eventId,
     allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:a.amount,
     evidence_link:a.evidence_link,...(val(a.deposit_id)?{deposit_id:a.deposit_id}:{})}});
  conditions.push({store:'commercial',sheet:'Payment_Events',
    key:{header:'payment_event_id',value:eventId},
    expect:{control_id:recorded.control_id,opportunity_id:opportunityId,
     event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount:e.amount,
     evidence_link:e.evidence_link,idempotency_key:e.idempotency_key,
     source_system:e.source_system}});
 }
 if(sum<required||sum!==authority.bank_confirmed_amount_cents||
    required!==authority.bank_deposit_required_cents||
    sum!==Math.round(recorded.cleared_deposit_total*100))
  return fail('PAYMENT_TOTAL_CHANGED_BEFORE_COMMIT');
 return {state:'FINANCIAL_PRECONDITIONS_READY',preconditions:conditions,
  payment_control_id:recorded.control_id,allocation_count:recorded.allocation_ids.length,
  payment_event_count:recorded.payment_event_ids.length,
  independent_bank_confirmation:false,writes:[],side_effects:false};
}
module.exports={buildJobPaymentPreconditions};
