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
// Retrieval is separate from semantic approval. Only exact official hosts are used.
async function retrieveArticle(url,n,request){
 const id=/^\d+$/.test(n.source_event_id)?n.source_event_id:null;
 if(url.search && (!id || url.searchParams.get('p')!==id))throw Error('SOURCE_EVENT_ID_MISMATCH');
 const candidates=[{url:url.href,json:false}];
 if(n.provider==='CITY_OF_TSHWANE' && id && url.searchParams.get('p')===id){
  const alternate=new URL(url.href);alternate.hostname=url.hostname==='www.tshwane.gov.za'?'tshwane.gov.za':'www.tshwane.gov.za';
  // Alternate host is attempted after the REST routes.
  var alternateCandidate={url:alternate.href,json:false};
 }
 if(n.provider==='CITY_OF_TSHWANE' && id && url.searchParams.get('p')===id){
  candidates.push({url:new URL('/wp-json/wp/v2/posts/'+id,url.origin).href,json:true});
  candidates.push({url:new URL('/?rest_route=/wp/v2/posts/'+id,url.origin).href,json:true});
 }
 if(alternateCandidate)candidates.push(alternateCandidate);
 const attempts=[];
 for(const candidate of candidates){
  try{
   const res=await request(candidate.url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:candidate.json?'application/json':'text/html'}});
   if(res.status!==200)throw Error('HTTP_'+res.status);
   if(res.url && res.url!==candidate.url)throw Error('SOURCE_REDIRECT_NOT_ALLOWED');
   const type=res.headers?.get('content-type')||'';
   if(!(candidate.json?/^application\/json\b/i:/^text\/html\b/i).test(type))throw Error('SOURCE_CONTENT_TYPE');
   const raw=await boundedText(res);
   if(candidate.json){
    const post=JSON.parse(raw);
    if(String(post.id)!==id || post.status!=='publish' || post.type!=='post' || !approvedUrl(post.link,n.provider) || typeof post.title?.rendered!=='string' || typeof post.content?.rendered!=='string')throw Error('SOURCE_EVENT_ID_MISMATCH');
    return {html:'<article><h1>'+post.title.rendered+'</h1>'+post.content.rendered+'</article>',raw,source_url:candidate.url,attempts};
   }
   return {html:raw,raw,source_url:candidate.url,attempts};
  }catch(e){attempts.push({url:candidate.url,reason:String(e.name==='TimeoutError'?'TIMEOUT':e.message).slice(0,120),cause_code:String(e.cause?.code||e.code||'').slice(0,80),cause_message:String(e.cause?.message||'').slice(0,160)});}
 }
 return {attempts};
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
  const retrieved=await retrieveArticle(url,n,request);
  if(!retrieved.html)return {...fail('SOURCE_RETRIEVAL_FAILED'),attempts:retrieved.attempts};
  const html=retrieved.html;
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
  return {...fail('SOURCE_CLASSIFICATION_REVIEW_REQUIRED'),exact_extract_verified:true,source_sha256:crypto.createHash('sha256').update(retrieved.raw).digest('hex'),source_url:retrieved.source_url,attempts:retrieved.attempts};
 }catch{return fail('SOURCE_RETRIEVAL_FAILED');}
}
module.exports={verifyNoticeContent,approvedUrl,retrieveArticle};
