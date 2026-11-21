'use strict';
const v=x=>String(x??'').trim();
/**
 * Canonical verification reports are read-only. Payment clearance must be
 * attested independently: evidence of transfer is not proof of bank clearance.
 */
async function inspectJobRelease({stores,quoteId}={}){
 if(!v(quoteId)||!stores?.commercial?.findByKey||!stores?.crm?.findByKey)
  return {state:'REVIEW_REQUIRED',reason_code:'CANONICAL_LOOKUP_REQUIRED'};
 const quote=(await stores.commercial.findByKey('Quotes','quote_id',quoteId))?.object;
 if(!quote)return {state:'REVIEW_REQUIRED',reason_code:'QUOTE_NOT_FOUND'};
 const opportunityId=v(quote.opportunity_id);
 const opportunity=opportunityId?(await stores.crm.findByKey('Jobs_Opportunities','opportunity_id',opportunityId))?.object:null;
 const failures=[];
 if(v(quote['Quote Status']).toUpperCase()!=='ACCEPTED') failures.push('QUOTE_NOT_ACCEPTED');
 if(v(quote['Line Control State']).toUpperCase()!=='PASS')failures.push('QUOTE_LINES_NOT_VERIFIED');
 if(!opportunity||v(opportunity.opportunity_id)!==opportunityId)failures.push('OPPORTUNITY_NOT_VERIFIED');
 if(v(opportunity?.job_id))failures.push('JOB_ALREADY_EXISTS');
 return {state:failures.length?'REVIEW_REQUIRED':'READY_FOR_EVIDENCE_REVIEW',
  quote_id:quoteId,opportunity_id:opportunityId,
  client_crm_id:v(opportunity?.client_crm_id),
  quote_status:v(quote['Quote Status']),line_control_state:v(quote['Line Control State']),
  evidence_requirements:['SIGNED_ACCEPTANCE','CLEARED_FUNDS_OR_APPROVED_CONTRACT_TERMS'],
  reasons:failures,writes:[],side_effects:false};
}
module.exports={inspectJobRelease};
