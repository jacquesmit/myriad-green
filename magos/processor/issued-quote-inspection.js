'use strict';
const v=x=>String(x??'').trim();
const validRef=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
async function inspectIssuedQuote({stores,quoteId,opportunityId}={}){
 if(!v(quoteId)||!stores?.commercial?.findByKey)return {verified:false,reason_code:'QUOTE_LOOKUP_REQUIRED'};
 const quote=(await stores.commercial.findByKey('Quotes','quote_id',quoteId))?.object;
 if(!quote)return {verified:false,reason_code:'QUOTE_NOT_FOUND'};
 if(v(quote.opportunity_id)!==v(opportunityId)||!v(opportunityId))return {verified:false,reason_code:'QUOTE_OPPORTUNITY_MISMATCH'};
 if(!['SENT','ISSUED','ACCEPTED'].includes(v(quote['Quote Status']).toUpperCase()))return {verified:false,reason_code:'QUOTE_NOT_ISSUED'};
 if(v(quote['Line Control State']).toUpperCase()!=='PASS')return {verified:false,reason_code:'QUOTE_LINES_UNVERIFIED'};
 const version=v(quote['Issued Version']||quote['Quote Version']);
 if(!version)return {verified:false,reason_code:'IMMUTABLE_QUOTE_VERSION_NOT_REGISTERED'};
 const pdf=v(quote['Drive Link']);
 if(!validRef(pdf))return {verified:false,reason_code:'IMMUTABLE_ISSUED_PDF_NOT_REGISTERED'};
 // Drive Link existence alone does not prove an immutable PDF. No affirmative attestation
 // is issued until the signed file digest is supplied by the owning document registry.
 const digest=v(quote['Issued PDF SHA256']);
 if(!/^[a-f0-9]{64}$/i.test(digest))return {verified:false,reason_code:'ISSUED_PDF_DIGEST_NOT_REGISTERED'};
 return {verified:true,quote_id:v(quoteId),opportunity_id:v(opportunityId),version,issued_pdf_ref:pdf,issued_pdf_sha256:digest.toLowerCase()};
}
module.exports={inspectIssuedQuote};
