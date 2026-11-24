'use strict';

const crypto=require('node:crypto');
const rules=require('../rules/water-alert-publisher.v1.json');

const ALLOWED_TYPES=new Set(rules.allowed_alert_types);

function clean(value){return String(value||'').trim();}
function norm(value){
  return clean(value).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
function isoDate(value){
  const v=clean(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';
  const d=new Date(v+'T00:00:00Z');
  return Number.isNaN(d.getTime())?'':v;
}
function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function unique(values){return [...new Set((values||[]).map(clean).filter(Boolean))];}

function normalizeNotice(input={}){
  const areas=unique(input.affected_areas);
  const type=clean(input.alert_type).toUpperCase();
  return {
    provider:clean(input.provider).toUpperCase(),
    source_channel:clean(input.source_channel).toUpperCase(),
    source_account:clean(input.source_account),
    source_url:clean(input.source_url),
    source_event_id:clean(input.source_event_id),
    published_at:clean(input.published_at),
    effective_date:isoDate(input.effective_date),
    valid_until:isoDate(input.valid_until),
    alert_type:type,
    title:clean(input.title),
    summary:clean(input.summary),
    affected_areas:areas,
    tanker_points:Array.isArray(input.tanker_points)?input.tanker_points:[],
    restrictions:Array.isArray(input.restrictions)?input.restrictions:[],
    faq:Array.isArray(input.faq)?input.faq:[],
    evidence:Array.isArray(input.evidence)?input.evidence:[]
  };
}

function hostname(url){
  try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'');}
  catch{return '';}
}
function domainMatches(host,allowed){
  return (allowed||[]).some(d=>host===d || host.endsWith('.'+d));
}

function verifyOfficialSource(notice){
  const config=rules.providers[notice.provider];
  if(!config)return {verified:false,reason_code:'UNAPPROVED_PROVIDER'};
  if(!notice.source_event_id)return {verified:false,reason_code:'MISSING_SOURCE_EVENT_ID'};
  if(!notice.source_url)return {verified:false,reason_code:'MISSING_SOURCE_URL'};

  if(notice.source_channel==='OFFICIAL_WEB'){
    const host=hostname(notice.source_url);
    return domainMatches(host,config.official_domains)
      ? {verified:true,basis:'OFFICIAL_DOMAIN',provider:notice.provider}
      : {verified:false,reason_code:'UNVERIFIED_OFFICIAL_DOMAIN'};
  }

  if(notice.source_channel==='OFFICIAL_SOCIAL'){
    const account=norm(notice.source_account);
    const allowed=(config.official_social_accounts||[]).map(norm);
    const host=hostname(notice.source_url);
    if(!domainMatches(host,config.official_social_domains||[])){
      return {verified:false,reason_code:'UNVERIFIED_SOCIAL_DOMAIN'};
    }
    let pathAccount='';
    try{pathAccount=norm(new URL(notice.source_url).pathname.split('/').filter(Boolean)[0]);}
    catch{pathAccount='';}
    if(!allowed.includes(account)) {
      return {verified:false,reason_code:'UNVERIFIED_SOCIAL_ACCOUNT'};
    }
    if(pathAccount && pathAccount!==account) {
      return {verified:false,reason_code:'SOURCE_ACCOUNT_URL_MISMATCH'};
    }
    return {verified:true,basis:'OFFICIAL_SOCIAL_ACCOUNT',provider:notice.provider};
  }

  return {verified:false,reason_code:'UNSUPPORTED_SOURCE_CHANNEL'};
}

function dayDiff(left,right){
  const a=new Date(left+'T00:00:00Z').getTime();
  const b=new Date(right+'T00:00:00Z').getTime();
  return Math.floor((a-b)/86400000);
}
function lifecycleFor(notice,now=new Date()){
  if(!notice.effective_date)return 'UNKNOWN';
  const today=now.toISOString().slice(0,10);
  if(notice.valid_until && notice.valid_until>=today && notice.effective_date<=today)return 'ACTIVE';
  const age=dayDiff(today,notice.effective_date);
  if(age<=0)return 'ACTIVE';
  if(age<=Number(rules.lifecycle.recent_days||7))return 'RECENT';
  return 'HISTORICAL';
}

function sourceKey(notice){
  return 'WATER_ALERT|'+notice.provider+'|'+notice.source_event_id;
}
function fingerprint(notice){
  return sha(JSON.stringify({
    provider:notice.provider,
    source_event_id:notice.source_event_id,
    effective_date:notice.effective_date,
    valid_until:notice.valid_until,
    alert_type:notice.alert_type,
    title:notice.title,
    summary:notice.summary,
    affected_areas:notice.affected_areas,
    tanker_points:notice.tanker_points,
    restrictions:notice.restrictions
  }));
}
function slugFor(notice){
  const base=notice.title || [notice.provider,notice.alert_type,notice.effective_date].join(' ');
  return norm(base).slice(0,180);
}

function exactAreaLinks(areas,siteIndex={}){
  const pages=Array.isArray(siteIndex.area_pages)?siteIndex.area_pages:[];
  const wanted=new Set(areas.map(norm));
  return pages.filter(p=>
    p && p.status==='publish' && p.url && wanted.has(norm(p.area||p.name||p.title))
  ).map(p=>({
    role:'AREA_PAGE',
    area:clean(p.area||p.name||p.title),
    url:clean(p.url)
  }));
}
function internalLinks(notice,siteIndex={}){
  return {
    area_pages:exactAreaLinks(notice.affected_areas,siteIndex),
    primary:rules.internal_links.primary,
    secondary:rules.internal_links.secondary,
    shop:rules.internal_links.shop
  };
}
function tagSlugs(notice){
  const tags=new Set();
  const providerTag=rules.providers?.[notice.provider]?.tag_slug;
  if(providerTag)tags.add(providerTag);
  for(const tag of rules.publishing?.tag_slugs_by_alert_type?.[notice.alert_type]||[])tags.add(tag);
  return [...tags];
}
function seoPlan(notice){
  const provider=rules.providers[notice.provider]?.display_name || notice.provider;
  const place=notice.affected_areas.slice(0,3).join(', ');
  const focus=notice.alert_type==='TANKER_DISTRIBUTION'
    ? provider+' water tanker distribution'
    : provider+' water supply update';
  return {
    focus_keyword:focus,
    title:(notice.title || focus).slice(0,60),
    description:(notice.summary || (focus+(place?' — '+place:''))).slice(0,155),
    schema:['BlogPosting','FAQPage'],
    geo_entities:notice.affected_areas
  };
}

function buildPublicationPlan(input,{now=new Date(),existing_posts=[],site_index={}}={}){
  const notice=normalizeNotice(input);
  const verification=verifyOfficialSource(notice);
  const lifecycle=lifecycleFor(notice,now);
  const key=notice.source_event_id?sourceKey(notice):'';
  const hash=fingerprint(notice);
  const existing=(existing_posts||[]).find(p=>
    p && (p.source_key===key ||
      (p.provider===notice.provider && p.source_event_id===notice.source_event_id))
  );

  const failures=[];
  if(!verification.verified)failures.push(verification.reason_code);
  if(!ALLOWED_TYPES.has(notice.alert_type))failures.push('UNSUPPORTED_ALERT_TYPE');
  if(!notice.effective_date)failures.push('MISSING_EFFECTIVE_DATE');
  if(!notice.affected_areas.length)failures.push('MISSING_AFFECTED_AREA');
  if(!notice.title)failures.push('MISSING_TITLE');
  if(!notice.evidence.length)failures.push('MISSING_EVIDENCE');

  if(failures.length){
    return {
      schema_version:'MAGOS_WATER_ALERT_PLAN_V1',
      state:'REVIEW_REQUIRED',reason_codes:failures,
      side_effects:false,notice,verification,lifecycle
    };
  }

  if(existing && existing.content_fingerprint===hash){
    return {
      schema_version:'MAGOS_WATER_ALERT_PLAN_V1',
      state:'DUPLICATE_NO_OP',side_effects:false,
      source_key:key,content_fingerprint:hash,lifecycle,
      existing_post_id:existing.post_id||null,verification
    };
  }

  const mode=existing?'UPDATE_EXISTING':'CREATE_NEW';
  const autoPublishAllowed=verification.verified &&
    (!rules.publishing.auto_publish_active_only || lifecycle==='ACTIVE');

  return {
    schema_version:'MAGOS_WATER_ALERT_PLAN_V1',
    state:autoPublishAllowed?'READY_TO_PUBLISH':'REVIEW_REQUIRED',
    publication_mode:mode,
    side_effects:false,
    auto_publish_allowed:autoPublishAllowed,
    source_key:key,
    content_fingerprint:hash,
    lifecycle,
    verification,
    notice,
    existing_post_id:existing?.post_id||null,
    wordpress_adapter_required:true,
    post:{
      title:notice.title,
      slug:slugFor(notice),
      category_slug:rules.publishing.wordpress_category_slug,
      excerpt:notice.summary,
      source_url:notice.source_url,
      source_event_id:notice.source_event_id,
      alert_type:notice.alert_type,
      affected_areas:notice.affected_areas,
      tanker_points:notice.tanker_points,
      restrictions:notice.restrictions,
      faq:notice.faq,
      tag_slugs:tagSlugs(notice),
      internal_links:internalLinks(notice,site_index),
      seo:seoPlan(notice)
    }
  };
}

module.exports={
  normalizeNotice,
  verifyOfficialSource,
  lifecycleFor,
  sourceKey,
  fingerprint,
  exactAreaLinks,
  internalLinks,
  tagSlugs,
  seoPlan,
  buildPublicationPlan
};
