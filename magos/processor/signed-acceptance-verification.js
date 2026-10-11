'use strict';
const v=x=>String(x??'').trim();
const truth=x=>v(x).toUpperCase();
/** Evidence must be independently confirmed by an injected trusted Drive/provider verifier.
 * Mere presence of a quote PDF or owner-entered assertion is not signed acceptance.
 */
async function verifySignedAcceptance({stores,quoteId,evidenceVerifier}={}){
 if(!v(quoteId)||!stores?.commercial?.findByKey)return {state:'REVIEW_REQUIRED',reason_code:'QUOTE_LOOKUP_UNAVAILABLE'};
 const quote=(await stores.commercial.findByKey('Quotes','quote_id',quoteId))?.object;
 if(!quote||truth(quote['Quote Status'])!=='ACCEPTED')return {state:'BLOCKED',reason_code:'CANONICAL_QUOTE_NOT_ACCEPTED'};
 if(typeof evidenceVerifier!=='function')return {state:'REVIEW_REQUIRED',reason_code:'SIGNED_ACCEPTANCE_VERIFIER_NOT_CONFIGURED'};
 const att=await evidenceVerifier({quote_id:quoteId,opportunity_id:v(quote.opportunity_id)});
 if(att?.verified!==true||att.quote_id!==quoteId||att.opportunity_id!==v(quote.opportunity_id)||
 !v(att.evidence_ref)||!v(att.signer_identity)||!v(att.signed_at)||!v(att.source_event_id))
  return {state:'REVIEW_REQUIRED',reason_code:'SIGNED_ACCEPTANCE_NOT_VERIFIED'};
 return {state:'SIGNED_ACCEPTANCE_VERIFIED',quote_id:quoteId,opportunity_id:v(quote.opportunity_id),
   evidence_ref:v(att.evidence_ref),source_event_id:v(att.source_event_id),
   signer_identity:v(att.signer_identity),signed_at:v(att.signed_at),
   authority:'TRUSTED_PROVIDER_ATTESTATION',writes:[],side_effects:false};
}
module.exports={verifySignedAcceptance};
