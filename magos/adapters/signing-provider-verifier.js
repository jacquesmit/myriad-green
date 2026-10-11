'use strict';
const {URL}=require('node:url');
const v=x=>String(x??'').trim();
/**
 * Trusted signing system lookup. Never accepts evidence from caller-supplied
 * request fields. Provider credentials and exact HTTPS origin are server config.
 * This adapter makes no modifications to source records.
 */
function createSigningProviderVerifier({endpoint=process.env.MAGOS_SIGNING_VERIFY_URL,
 token=process.env.MAGOS_SIGNING_VERIFY_TOKEN,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
 return async({quote_id,opportunity_id}={})=>{
  if(!v(quote_id)||!v(opportunity_id))return {verified:false,reason_code:'SIGNING_IDENTIFIERS_REQUIRED'};
  if(!v(endpoint)||!v(token))return {verified:false,reason_code:'SIGNING_PROVIDER_NOT_CONFIGURED'};
  let target;
  try{
   target=new URL(endpoint);
   if(target.protocol!=='https:'||target.username||target.password||target.hash||!target.hostname)
    return {verified:false,reason_code:'SIGNING_PROVIDER_URL_INVALID'};
  }catch{return {verified:false,reason_code:'SIGNING_PROVIDER_URL_INVALID'};}
  target.searchParams.set('quote_id',quote_id);
  target.searchParams.set('opportunity_id',opportunity_id);
  try{
   const response=await fetchImpl(target.toString(),{
    method:'GET',redirect:'error',
    headers:{authorization:'Bearer '+token,accept:'application/json'},
    signal:AbortSignal.timeout(timeoutMs)
   });
   if(!response.ok)return {verified:false,reason_code:'SIGNING_PROVIDER_HTTP_'+response.status};
   const att=await response.json();
   if(att?.verified!==true||att.quote_id!==quote_id||att.opportunity_id!==opportunity_id||
      !v(att.evidence_ref)||!v(att.source_event_id)||!v(att.signer_identity)||
      !v(att.signed_at)||!Number.isFinite(Date.parse(att.signed_at))||
      !['SIGNED','COMPLETED'].includes(v(att.status).toUpperCase()))
    return {verified:false,reason_code:'SIGNING_PROVIDER_ATTESTATION_INVALID'};
   return {verified:true,quote_id,opportunity_id,evidence_ref:v(att.evidence_ref),
    signer_identity:v(att.signer_identity),signed_at:v(att.signed_at),
    source_event_id:v(att.source_event_id),status:v(att.status)};
  }catch{return {verified:false,reason_code:'SIGNING_PROVIDER_UNAVAILABLE'};}
 };
}
module.exports={createSigningProviderVerifier};
