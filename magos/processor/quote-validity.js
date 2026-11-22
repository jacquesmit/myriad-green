'use strict';
// Quote validity is a commercial review signal, not client delivery evidence.
// This module never marks a quote EXPIRED, never sends follow-up, and never
// substitutes a saved "Days Remaining" spreadsheet formula for the local date.
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
function calendarDate(value){
 const s=v(value);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
 const date=new Date(s+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s?s:'';
}
function quoteValidityReview(quote={},asOf){
 if(!calendarDate(asOf))throw Error('JOHANNESBURG_DATE_REQUIRED');
 const status=up(quote['Quote Status']);
 // A draft, TO_CONFIRM or other unissued quote cannot be chased as though
 // the client had actually received it.
 if(!['SENT','ISSUED','AWAITING_ACCEPTANCE'].includes(status))
  return {state:'NOT_RECORDED_ISSUED',action_required:false,
   next_action:'Verify quote issuance before planning customer follow-up'};
 const until=calendarDate(quote['Valid Until']);
 if(!until)return {state:'VALIDITY_UNKNOWN_REVIEW',action_required:true,
  next_action:'Check the actual issue and validity evidence before follow-up'};
 if(until<asOf)return {state:'VALIDITY_ELAPSED_REVIEW',action_required:true,
  valid_until:until,
  next_action:'Confirm original issuance and obtain revised valid pricing before client follow-up'};
 if(until===asOf)return {state:'VALIDITY_ENDS_TODAY',action_required:true,
  valid_until:until,
  next_action:'Review quotation validity and confirm follow-up before day end'};
 return {state:'WITHIN_RECORDED_VALIDITY',action_required:false,valid_until:until,
  next_action:v(quote['Next Action'])||'Follow up on issued quotation'};
}
module.exports={quoteValidityReview,calendarDate};
