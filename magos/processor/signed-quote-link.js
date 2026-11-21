'use strict';
const crypto=require('node:crypto');
const txt=x=>String(x??'').trim();
const host='https://myriadgreen.co.za';
const tokenValidityDays=7;
function deriveQuoteVersion(lines,quoteId) {
  const current=(lines||[]).filter(r=>txt(r.quote_id)===quoteId &&
   txt(r.line_status).toUpperCase()==='CURRENT');
  const versions=new Set(current.map(x=>txt(x.quote_version)));
  return current.length>0 && versions.size===1 ? [...versions][0] : null;
}
async function inspectSigningPage({request=globalThis.fetch}={}){
  try{
    const p=await request(host+'/wp-json/wp/v2/pages?slug=accept-and-sign-quotation',{
      redirect:'error',signal:AbortSignal.timeout(10000)
    });
    if(p.status!==200)return false;
    const pages=await p.json();
    if(!Array.isArray(pages)||!pages.some(row=>row.id===9481 && row.status==='publish'))
      return false;
    const routes=await request(host+'/wp-json/mgos/v1',{
      redirect:'error',signal:AbortSignal.timeout(10000)
    });
    if(routes.status!==200)return false;
    const index=await routes.json();
    return Boolean(index?.routes?.['/mgos/v1/quote-acceptance/verify-v2']);
  }catch{return false;}
}
async function issueSignedQuoteLink({
 stores,quoteId,secret=process.env.MAGOS_WP_ACCEPTANCE_LINK_SECRET,
 now=()=>new Date(),random=()=>crypto.randomBytes(16).toString('hex'),
 readiness=inspectSigningPage
}={}){
  const blocked=(reason_code)=>({state:'BLOCKED',reason_code,
   link_created:false,writes:[],side_effects:false});
  if(!stores?.commercial?.findByKey||!stores.commercial.readObjects)
    return blocked('CANONICAL_QUOTE_READER_MISSING');
  if(!secret||typeof secret!=='string'||secret.length<32)
    return blocked('SIGNING_SECRET_NOT_CONFIGURED');
  const id=txt(quoteId);
  if(!id)return blocked('QUOTE_ID_REQUIRED');
  let quote,lines;
  try {
    [quote,lines]=await Promise.all([
      stores.commercial.findByKey('Quotes','quote_id',id),
      stores.commercial.readObjects('Quote_Lines',{maxRows:null})
    ]);
  }catch{return blocked('CANONICAL_QUOTE_READ_UNAVAILABLE');}
  const row=quote?.object;
  if(!row || txt(row.quote_id)!==id)return blocked('QUOTE_NOT_FOUND');
  if(txt(row['Quote Status']).toUpperCase()!=='ACTIVE' ||
     txt(row['Workflow Stage']).toUpperCase()!=='SENT')
    return blocked('QUOTE_NOT_ACTIVE_AND_ISSUED');
  if(!['PASS','LINE_CONTROL_OK'].includes(txt(row['Line Control State']).toUpperCase()))
    return blocked('QUOTE_LINES_NOT_APPROVED');
  const version=deriveQuoteVersion(lines,id);
  if(!version)return blocked('CURRENT_QUOTE_LINE_VERSION_UNVERIFIED');
  const pdf=txt(row['Drive Link']);
  if(!/^https:\/\/drive\.google\.com\//.test(pdf))
    return blocked('ISSUED_PDF_NOT_IN_CANONICAL_DRIVE');
  const opportunityId=txt(row.opportunity_id);
  if(!opportunityId)return blocked('OPPORTUNITY_ID_MISSING');
  const validUntil=txt(row['Valid Until']);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)||
      new Date(validUntil+'T23:59:59+02:00').toString()==='Invalid Date')
    return blocked('QUOTE_VALID_UNTIL_NOT_VERIFIED');
  const current=now();
  const expiry=Math.min(current.getTime()+tokenValidityDays*86400000,
   new Date(validUntil+'T23:59:59+02:00').getTime());
  if(expiry<=current.getTime())return blocked('QUOTE_EXPIRED');
  if(await readiness()!==true)return blocked('WORDPRESS_SIGNING_PAGE_OR_BRIDGE_NOT_LIVE');
  const payload={
    quote_id:id,opportunity_id:opportunityId,version,
    issued_pdf_ref:pdf,purpose:'CLIENT_ACCEPTANCE',
    expiry:Math.floor(expiry/1000),nonce:random()
  };
  if(!/^[a-f0-9]{32}$/i.test(payload.nonce))return blocked('NONCE_GENERATION_FAILED');
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=crypto.createHmac('sha256',secret).update(encoded).digest('hex');
  const token=encoded+'.'+signature;
  const link=new URL('/accept-and-sign-quotation/',host);
  link.searchParams.set('accept_token',token);
  return {
    schema_version:'MAGOS_SIGNED_QUOTE_LINK_V1',
    state:'READY_TO_SEND',
    quote_id:id,opportunity_id:opportunityId,
    quote_version:version,expires_at:new Date(expiry).toISOString(),
    url:link.toString(),
    link_created:true,
    customer_message_sent:false,
    job_created:false,
    payment_clearance_verified:false,
    writes:[],side_effects:false
  };
}
module.exports={issueSignedQuoteLink,inspectSigningPage,deriveQuoteVersion};
