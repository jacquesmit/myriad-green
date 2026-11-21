'use strict';

/**
 * Server-owned, fail-closed WordPress signed-acceptance verifier.
 * The currently deployed WP 0.3.2 bridge always returns verified:false.
 * This adapter cannot change that fact and never treats a WordPress status
 * or a client-supplied token as a job-release authorization.
 */
const val=v=>String(v??'').trim();
function sourceVersion(lines,quoteId){
  if(!Array.isArray(lines))return null;
  const current=lines.filter(r=>val(r.quote_id)===quoteId &&
    val(r.line_status).toUpperCase()==='CURRENT');
  if(!current.length)return null;
  const versions=new Set(current.map(r=>val(r.quote_version)));
  return versions.size===1 && [...versions][0] ? [...versions][0] : null;
}
function makeWordPressAcceptanceVerifier({
  stores,
  secret=process.env.MAGOS_WP_ACCEPTANCE_VERIFY_TOKEN,
  siteUrl=process.env.MAGOS_WP_SITE_URL||'https://myriadgreen.co.za',
  request=globalThis.fetch,
  now=()=>new Date()
}={}){
  return async({quote_id,opportunity_id}={})=>{
    const denied=reason_code=>({verified:false,reason_code});
    if(!stores?.commercial?.findByKey||!stores.commercial.readObjects)
      return denied('CANONICAL_QUOTE_SOURCE_NOT_CONFIGURED');
    if(!secret || typeof secret!=='string' || secret.length<32)
      return denied('WP_VERIFY_CREDENTIAL_NOT_CONFIGURED');
    let url;
    try{url=new URL(siteUrl);}catch{return denied('WP_VERIFY_SITE_INVALID');}
    // This deployment is pinned to the Myriad Green WP origin.
    if(url.protocol!=='https:'||url.hostname!=='myriadgreen.co.za'||
      url.port||url.username||url.password||url.pathname!=='/'||
      url.search||url.hash) return denied('WP_VERIFY_ORIGIN_NOT_APPROVED');
    const quoteId=val(quote_id),opportunityId=val(opportunity_id);
    if(!quoteId||!opportunityId)return denied('QUOTE_IDENTITY_MISSING');
    let quote,lines;
    try{
      [quote,lines]=await Promise.all([
        stores.commercial.findByKey('Quotes','quote_id',quoteId),
        stores.commercial.readObjects('Quote_Lines',{maxRows:null})
      ]);
    }catch{return denied('CANONICAL_QUOTE_READ_UNAVAILABLE');}
    const row=quote?.object;
    if(!row || val(row.opportunity_id)!==opportunityId ||
      val(row['Quote Status']).toUpperCase()!=='ACCEPTED')
      return denied('CURRENT_CANONICAL_QUOTE_NOT_ACCEPTED');
    const version=sourceVersion(lines,quoteId);
    if(!version)return denied('CURRENT_QUOTE_VERSION_AMBIGUOUS');
    const pdf=val(row['Drive Link']);
    if(!/^https:\/\//.test(pdf))return denied('ISSUED_QUOTE_DOCUMENT_UNVERIFIED');
    const endpoint=new URL('/wp-json/mgos/v1/quote-acceptance/verify-v2',url.origin);
    endpoint.searchParams.set('quote_id',quoteId);
    endpoint.searchParams.set('opportunity_id',opportunityId);
    let data;
    try{
      const response=await request(endpoint.toString(),{
        method:'GET',redirect:'error',
        headers:{Authorization:'Bearer '+secret,Accept:'application/json'},
        signal:AbortSignal.timeout(10000)
      });
      if(response?.status!==200)return denied('WORDPRESS_VERIFY_UNAVAILABLE');
      data=await response.json();
    }catch{return denied('WORDPRESS_VERIFY_UNAVAILABLE');}
    if(data?.verified!==true)return denied(data?.reason_code||'WORDPRESS_ACCEPTANCE_NOT_VERIFIED');
    if(data.purpose!=='CLIENT_ACCEPTANCE'||
      data.approval_status!=='INDEPENDENTLY_APPROVED'||
      data.consent_verified!==true)
      return denied('INDEPENDENT_CLIENT_APPROVAL_MISSING');
    if(data.quote_id!==quoteId||data.opportunity_id!==opportunityId||
      data.quote_version!==version||data.issued_pdf_ref!==pdf)
      return denied('SIGNED_QUOTE_VERSION_OR_DOCUMENT_MISMATCH');
    const fields=['source_event_id','evidence_ref','signer_identity','signed_at',
      'receipt_id','signature_sha256','independent_reviewer_id'];
    if(fields.some(f=>!val(data[f]))||!/^[a-f0-9]{64}$/i.test(val(data.signature_sha256)))
      return denied('SIGNATURE_RECEIPT_INCOMPLETE');
    const date=new Date(data.signed_at);
    if(!Number.isFinite(date.getTime())||date.getTime()>now().getTime()||
      now().getTime()-date.getTime()>366*24*3600*1000)
      return denied('SIGNATURE_TIME_UNVERIFIED');
    if(val(data.independent_reviewer_id)===val(data.signer_identity))
      return denied('SELF_APPROVAL_NOT_ACCEPTED');
    return {
      verified:true,quote_id:quoteId,opportunity_id:opportunityId,
      evidence_ref:val(data.evidence_ref),source_event_id:val(data.source_event_id),
      signer_identity:val(data.signer_identity),signed_at:date.toISOString(),
      quote_version:version,receipt_id:val(data.receipt_id),
      authority:'WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH'
    };
  };
}
module.exports={makeWordPressAcceptanceVerifier,sourceVersion};
