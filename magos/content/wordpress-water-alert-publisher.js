'use strict';

const crypto=require('node:crypto');
const rules=require('../rules/water-alert-publisher.v1.json');

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/<[^>]*>/g,' ')
  .replace(/&amp;/g,' and ')
  .replace(/&/g,' and ')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-+|-+$/g,'');

function approvedOrigin(siteUrl){
  let url;
  try{url=new URL(siteUrl);}catch{return null;}
  if(url.protocol!=='https:'||url.hostname!=='myriadgreen.co.za'||url.port||
    url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  return url.origin;
}

function sourceHash(sourceKey){
  return crypto.createHash('sha256').update(String(sourceKey)).digest('hex');
}

function providerDisplay(provider){
  return rules.providers?.[provider]?.display_name || provider;
}

function tagSlugsFor(notice){
  const tags=new Set();
  const providerTag=rules.providers?.[notice.provider]?.tag_slug;
  if(providerTag)tags.add(providerTag);
  for(const tag of rules.publishing?.tag_slugs_by_alert_type?.[notice.alert_type]||[])tags.add(tag);
  return [...tags];
}

class WordPressWaterAlertPublisher {
  constructor({
    secret=process.env.MAGOS_WATER_ALERT_PUBLISH_TOKEN,
    siteUrl=process.env.MAGOS_WP_SITE_URL||'https://myriadgreen.co.za',
    request=globalThis.fetch,
    sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    sitemapAttempts=3,
    sitemapDelayMs=750
  }={}){
    this.secret=clean(secret);
    this.origin=approvedOrigin(siteUrl);
    this.request=request;
    this.sleep=sleep;
    this.sitemapAttempts=Math.max(1,Math.min(5,Number(sitemapAttempts)||3));
    this.sitemapDelayMs=Math.max(0,Number(sitemapDelayMs)||0);
  }

  ready(){
    if(!this.origin)return {ready:false,reason_code:'WP_ALERT_ORIGIN_NOT_APPROVED'};
    if(this.secret.length<32)return {ready:false,reason_code:'WP_ALERT_CREDENTIAL_NOT_CONFIGURED'};
    if(typeof this.request!=='function')return {ready:false,reason_code:'WP_ALERT_HTTP_CLIENT_NOT_CONFIGURED'};
    return {ready:true};
  }

  headers(){
    return {
      Authorization:'Bearer '+this.secret,
      Accept:'application/json',
      'Content-Type':'application/json'
    };
  }

  async json(url,options={}){
    const response=await this.request(url,{
      redirect:'error',
      signal:AbortSignal.timeout(12000),
      ...options
    });
    let data=null;
    try{data=await response.json();}catch{}
    return {response,data};
  }

  async status(sourceKey){
    const readiness=this.ready();
    if(!readiness.ready)return {...readiness,state:'BLOCKED'};
    const url=new URL('/wp-json/mgos/v1/water-alert/status',this.origin);
    url.searchParams.set('source_key',sourceKey);
    try{
      const {response,data}=await this.json(url.toString(),{
        method:'GET',headers:{Authorization:'Bearer '+this.secret,Accept:'application/json'}
      });
      if(response.status===404)return {state:'NOT_FOUND'};
      if(response.status!==200)return {state:'BLOCKED',reason_code:'WP_ALERT_STATUS_UNAVAILABLE',http_status:response.status};
      return data;
    }catch{
      return {state:'BLOCKED',reason_code:'WP_ALERT_STATUS_UNAVAILABLE'};
    }
  }

  async discoverAreaPages(areas=[]){
    const readiness=this.ready();
    if(!readiness.ready)return [];
    const results=[];
    for(const area of [...new Set(areas.map(clean).filter(Boolean))].slice(0,40)){
      const areaSlug=norm(area);
      if(!areaSlug)continue;
      const url=new URL('/wp-json/wp/v2/pages',this.origin);
      url.searchParams.set('status','publish');
      url.searchParams.set('per_page','30');
      url.searchParams.set('search',area);
      url.searchParams.set('_fields','id,slug,link,status,title');
      try{
        const response=await this.request(url.toString(),{
          method:'GET',redirect:'error',
          headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)
        });
        if(response.status!==200)continue;
        const pages=await response.json();
        if(!Array.isArray(pages))continue;
        const candidates=pages.filter(p=>{
          if(!p||p.status!=='publish'||!p.link)return false;
          let link;
          try{link=new URL(p.link);}catch{return false;}
          if(link.protocol!=='https:'||link.hostname!=='myriadgreen.co.za')return false;
          const slug=norm(p.slug);
          const title=norm(p.title?.rendered||'');
          const slugMatch=slug===areaSlug||slug.endsWith('-'+areaSlug);
          const titleMatch=title===areaSlug||title.includes(areaSlug);
          return slugMatch&&titleMatch;
        });
        candidates.sort((a,b)=>String(a.slug).length-String(b.slug).length);
        if(candidates[0])results.push({
          area,status:'publish',url:candidates[0].link,
          post_id:candidates[0].id,slug:candidates[0].slug
        });
      }catch{}
    }
    return results;
  }

  buildPayload({plan,notice,featuredMediaId=0}={}){
    if(!plan||plan.state!=='READY_TO_PUBLISH')throw new Error('WATER_ALERT_PLAN_NOT_PUBLISHABLE');
    const normalizedNotice={
      ...notice,
      provider:clean(notice?.provider).toUpperCase(),
      provider_display:providerDisplay(clean(notice?.provider).toUpperCase())
    };
    return {
      schema_version:'MAGOS_WP_WATER_ALERT_REQUEST_V1',
      source_key:plan.source_key,
      content_fingerprint:plan.content_fingerprint,
      notice:normalizedNotice,
      post:{
        ...plan.post,
        category_slug:'local-water-alerts',
        tag_slugs:tagSlugsFor(normalizedNotice),
        featured_media_id:Number.isInteger(Number(featuredMediaId))?Number(featuredMediaId):0
      }
    };
  }

  async verifyPublic(result,payload){
    let publicUrl;
    try{publicUrl=new URL(result.url);}catch{return {verified:false,reason_code:'WP_ALERT_PUBLIC_URL_INVALID'};}
    if(publicUrl.protocol!=='https:'||publicUrl.hostname!=='myriadgreen.co.za'){
      return {verified:false,reason_code:'WP_ALERT_PUBLIC_ORIGIN_INVALID'};
    }
    try{
      const response=await this.request(publicUrl.toString(),{
        method:'GET',redirect:'error',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)
      });
      if(response.status!==200)return {verified:false,reason_code:'WP_ALERT_PUBLIC_READBACK_UNAVAILABLE'};
      const html=await response.text();
      const expectedSource=sourceHash(payload.source_key);
      if(!html.includes('data-mgos-source="'+expectedSource+'"')||
         !html.includes('data-mgos-fingerprint="'+payload.content_fingerprint+'"')){
        return {verified:false,reason_code:'WP_ALERT_PUBLIC_MARKER_MISMATCH'};
      }
      if(!html.includes('application/ld+json')||!html.includes('FAQPage')){
        return {verified:false,reason_code:'WP_ALERT_FAQ_SCHEMA_NOT_RENDERED'};
      }
    }catch{
      return {verified:false,reason_code:'WP_ALERT_PUBLIC_READBACK_UNAVAILABLE'};
    }
    return {verified:true};
  }

  async verifySitemap(publicUrl){
    const sitemap=new URL('/post-sitemap.xml',this.origin).toString();
    for(let i=0;i<this.sitemapAttempts;i++){
      try{
        const response=await this.request(sitemap,{
          method:'GET',redirect:'error',headers:{Accept:'application/xml,text/xml'},signal:AbortSignal.timeout(12000)
        });
        if(response.status===200){
          const body=await response.text();
          if(body.includes(publicUrl))return {verified:true};
        }
      }catch{}
      if(i+1<this.sitemapAttempts&&this.sitemapDelayMs)await this.sleep(this.sitemapDelayMs);
    }
    return {verified:false,reason_code:'WP_ALERT_SITEMAP_NOT_CONFIRMED'};
  }

  async publish({plan,notice,featuredMediaId=0}={}){
    const readiness=this.ready();
    if(!readiness.ready)return {...readiness,state:'BLOCKED'};
    let payload;
    try{payload=this.buildPayload({plan,notice,featuredMediaId});}
    catch(error){return {state:'BLOCKED',reason_code:error.message};}

    const before=await this.status(payload.source_key);
    if(before.state==='BLOCKED')return before;

    let result;
    try{
      const endpoint=new URL('/wp-json/mgos/v1/water-alert/publish',this.origin).toString();
      const {response,data}=await this.json(endpoint,{
        method:'POST',headers:this.headers(),body:JSON.stringify(payload)
      });
      if(response.status!==200||!data){
        return {state:'BLOCKED',reason_code:'WP_ALERT_PUBLISH_REJECTED',http_status:response.status};
      }
      result=data;
    }catch{
      return {state:'BLOCKED',reason_code:'WP_ALERT_PUBLISH_UNAVAILABLE'};
    }

    if(!['CREATE_NEW','UPDATE_EXISTING','DUPLICATE_NO_OP'].includes(result.state)||
       result.source_key!==payload.source_key||
       result.content_fingerprint!==payload.content_fingerprint||
       result.status!=='publish'||!Number.isInteger(Number(result.post_id))){
      return {state:'BLOCKED',reason_code:'WP_ALERT_PUBLISH_RESPONSE_INVALID'};
    }

    const readback=await this.status(payload.source_key);
    if(readback.state!=='READ_BACK'||readback.post_id!==result.post_id||
       readback.status!=='publish'||readback.content_fingerprint!==payload.content_fingerprint||
       readback.source_key!==payload.source_key){
      return {state:'REVIEW_REQUIRED',reason_code:'WP_ALERT_CANONICAL_READBACK_MISMATCH',
        publication_result:result};
    }

    const publicCheck=await this.verifyPublic(result,payload);
    if(!publicCheck.verified){
      return {state:'REVIEW_REQUIRED',reason_code:publicCheck.reason_code,
        publication_result:result,readback};
    }

    const sitemapCheck=await this.verifySitemap(result.url);
    if(!sitemapCheck.verified){
      return {state:'REVIEW_REQUIRED',reason_code:sitemapCheck.reason_code,
        publication_result:result,readback,public_readback:true};
    }

    return {
      schema_version:'MAGOS_WATER_ALERT_PUBLICATION_RESULT_V1',
      state:result.state,
      verified:true,
      post_id:result.post_id,
      url:result.url,
      source_key:payload.source_key,
      content_fingerprint:payload.content_fingerprint,
      previous_state:before.state,
      public_readback:true,
      sitemap_verified:true,
      faq_schema_verified:true
    };
  }
}

function makeWordPressWaterAlertPublisher(options){
  return new WordPressWaterAlertPublisher(options);
}

module.exports={
  WordPressWaterAlertPublisher,
  makeWordPressWaterAlertPublisher,
  approvedOrigin,
  sourceHash,
  tagSlugsFor
};
