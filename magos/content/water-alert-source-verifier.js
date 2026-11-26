'use strict';
const crypto=require('node:crypto');
const rules=require('../rules/water-alert-publisher.v1.json');
const {normalizeNotice,verifyOfficialSource}=require('./water-alert-publisher');
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
const fail=reason_code=>({verified:false,reason_code});
const MAX_BYTES=1024*1024;
function approvedUrl(value,provider){
 try{
  const u=new URL(value);
  const hosts=(rules.providers[provider]?.official_domains||[]).flatMap(d=>[d,'www.'+d]);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!hosts.includes(u.hostname))return null;
  if(u.pathname==='/'&&!/^\?p=\d+$/.test(u.search))return null;
  if(u.search&&!/^\?p=\d+$/.test(u.search))return null;
  return u;
 }catch{return null;}
}
async function boundedText(response){
 if(Number(response.headers?.get('content-length'))>MAX_BYTES)throw Error('SOURCE_TOO_LARGE');
 if(!response.body?.getReader)throw Error('SOURCE_STREAM_REQUIRED');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let bytes=0,body='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>MAX_BYTES)throw Error('SOURCE_TOO_LARGE');
   body+=decoder.decode(value,{stream:true});
  }
  return body+decoder.decode();
 }finally{await reader.cancel().catch(()=>{});}
}
function plain(s){
 return clean(s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|nav|header|footer|aside|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' '));
}
function dates(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return [];
 const d=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==day)return [];
 return [day,new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d)];
}
async function verifyNoticeContent(input,{request=globalThis.fetch}={}){
 const n=normalizeNotice(input);
 if(!verifyOfficialSource(n).verified)return fail('SOURCE_IDENTITY_UNVERIFIED');
 // Only independently retrievable, single-article HTML is supported.
 // Social cards, scanned PDFs, listings and paraphrases remain review-only.
 if(n.source_channel!=='OFFICIAL_WEB')return fail('SOURCE_FORMAT_REVIEW_REQUIRED');
 const url=approvedUrl(n.source_url,n.provider);
 if(!url)return fail('SOURCE_URL_NOT_APPROVED');
 if(!n.summary||!n.title||!n.affected_areas.length||!dates(n.effective_date).length)return fail('SOURCE_CLAIMS_INCOMPLETE');
 // Free-form claims (including FAQs and tanker locations) cannot be certified by substring matching.
 // First autonomous lane is narrowly restricted to exact source extracts.
 if(n.tanker_points.length||n.restrictions.length||n.faq.length||n.valid_until)return fail('STRUCTURED_CLAIMS_REVIEW_REQUIRED');
 try{
  const res=await request(url.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
  if(res.status!==200||!/^text\/html\b/i.test(res.headers?.get('content-type')||''))return fail('SOURCE_UNAVAILABLE');
  if(res.url&&res.url!==url.href)return fail('SOURCE_REDIRECT_NOT_ALLOWED');
  const html=await boundedText(res);
  const articles=[...html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/gi)];
  if(articles.length!==1)return fail('SOURCE_ARTICLE_AMBIGUOUS');
  const article=articles[0][1];
  const heading=[...article.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)];
  if(heading.length!==1||norm(plain(heading[0][1]))!==norm(n.title))return fail('SOURCE_TITLE_MISMATCH');
  const paragraphs=[...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(m=>norm(plain(m[1])));
  if(!paragraphs.includes(norm(n.summary)))return fail('SOURCE_SUMMARY_NOT_EXACT_EXTRACT');
  const excerpt=norm(n.summary);
  if(!dates(n.effective_date).some(d=>excerpt.includes(norm(d))))return fail('SOURCE_EFFECTIVE_DATE_UNVERIFIED');
  if(!n.affected_areas.every(a=>excerpt.includes(norm(a))))return fail('SOURCE_AREAS_UNVERIFIED');
  // Classification is deliberately review-only until provider-specific semantics are validated.
  return {...fail('SOURCE_CLASSIFICATION_REVIEW_REQUIRED'),exact_extract_verified:true,source_sha256:crypto.createHash('sha256').update(html).digest('hex'),source_url:url.href};
 }catch{return fail('SOURCE_RETRIEVAL_FAILED');}
}
module.exports={verifyNoticeContent,approvedUrl};
