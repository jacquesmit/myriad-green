'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeWordPressWaterAlertPublisher,tagSlugsFor}=require('../content/wordpress-water-alert-publisher');
const {buildPublicationPlan}=require('../content/water-alert-publisher');

const secret='water-alert-test-secret-that-is-definitely-long-enough';
const notice={
 provider:'CITY_OF_TSHWANE',source_channel:'OFFICIAL_SOCIAL',source_account:'CityTshwane',
 source_url:'https://x.com/CityTshwane/status/123',source_event_id:'x:CityTshwane:123',
 effective_date:'2026-11-24',alert_type:'TANKER_DISTRIBUTION',
 title:'Tshwane Region 7 Water Tanker Distribution — 24 November 2026',
 summary:'Verified Region 7 tanker distribution.',
 affected_areas:['Bronkhorstspruit'],tanker_points:[{area:'Bronkhorstspruit',points:['Clinic']}],
 faq:[{q:'Where are tankers?',a:'Bronkhorstspruit.'}],
 evidence:[{type:'OFFICIAL_NOTICE',ref:'https://x.com/CityTshwane/status/123'}]
};
const plan=buildPublicationPlan(notice,{now:new Date('2026-11-24T12:00:00Z'),
 site_index:{area_pages:[{area:'Bronkhorstspruit',url:'https://myriadgreen.co.za/irrigation-system-installation-bronkhorstspruit/',status:'publish'}]}});

function response(status,body,{text}={}){
 return {status,json:async()=>body,text:async()=>text??JSON.stringify(body)};
}
test('taxonomy uses verified live Tshwane and tanker slugs',()=>{
 assert.deepEqual(tagSlugsFor(notice).sort(),['backup-water','jojo-tanks','tshwane-water','water-tankers'].sort());
});
test('publisher fails closed without dedicated credential or approved origin',async()=>{
 assert.equal((await makeWordPressWaterAlertPublisher({secret:''}).publish({plan,notice})).reason_code,'WP_ALERT_CREDENTIAL_NOT_CONFIGURED');
 assert.equal((await makeWordPressWaterAlertPublisher({secret,siteUrl:'https://evil.example'}).publish({plan,notice})).reason_code,'WP_ALERT_ORIGIN_NOT_APPROVED');
});
test('create publication requires canonical readback public markers FAQ schema and sitemap',async()=>{
 let statusCalls=0;
 const sourceHash=require('../content/wordpress-water-alert-publisher').sourceHash(plan.source_key);
 const request=async(url,opts)=>{
   const u=new URL(url);
   if(u.pathname==='/wp-json/mgos/v1/water-alert/status'){
     statusCalls++;
     if(statusCalls===1)return response(404,{state:'NOT_FOUND'});
     return response(200,{state:'READ_BACK',post_id:10620,status:'publish',url:'https://myriadgreen.co.za/journal/test-water-alert/',source_key:plan.source_key,content_fingerprint:plan.content_fingerprint});
   }
   if(u.pathname==='/wp-json/mgos/v1/water-alert/publish'){
     assert.equal(opts.headers.Authorization,'Bearer '+secret);
     const body=JSON.parse(opts.body);
     assert.equal(body.source_key,plan.source_key);
     return response(200,{state:'CREATE_NEW',post_id:10620,status:'publish',url:'https://myriadgreen.co.za/journal/test-water-alert/',source_key:plan.source_key,content_fingerprint:plan.content_fingerprint});
   }
   if(u.pathname==='/journal/test-water-alert/'){
     return response(200,null,{text:'<div data-mgos-source="'+sourceHash+'" data-mgos-fingerprint="'+plan.content_fingerprint+'"></div><script type="application/ld+json">{"@type":"FAQPage"}</script>'});
   }
   if(u.pathname==='/post-sitemap.xml')return response(200,null,{text:'<loc>https://myriadgreen.co.za/journal/test-water-alert/</loc>'});
   throw Error('unexpected '+url);
 };
 const p=makeWordPressWaterAlertPublisher({secret,request,sitemapDelayMs:0});
 const out=await p.publish({plan,notice});
 assert.equal(out.state,'CREATE_NEW');
 assert.equal(out.verified,true);
 assert.equal(out.sitemap_verified,true);
});
test('public readback mismatch prevents success claim',async()=>{
 let statusCalls=0;
 const request=async(url)=>{
   const u=new URL(url);
   if(u.pathname.includes('/status')){
     statusCalls++; return statusCalls===1?response(404,{}):response(200,{state:'READ_BACK',post_id:1,status:'publish',url:'https://myriadgreen.co.za/journal/a/',source_key:plan.source_key,content_fingerprint:plan.content_fingerprint});
   }
   if(u.pathname.includes('/publish'))return response(200,{state:'CREATE_NEW',post_id:1,status:'publish',url:'https://myriadgreen.co.za/journal/a/',source_key:plan.source_key,content_fingerprint:plan.content_fingerprint});
   if(u.pathname==='/journal/a/')return response(200,null,{text:'wrong page'});
   throw Error('unexpected');
 };
 const out=await makeWordPressWaterAlertPublisher({secret,request}).publish({plan,notice});
 assert.equal(out.state,'REVIEW_REQUIRED');
 assert.equal(out.reason_code,'WP_ALERT_PUBLIC_MARKER_MISMATCH');
});
test('area discovery accepts only exact published Myriad Green title/slug matches',async()=>{
 const request=async()=>response(200,[
   {id:1,status:'publish',slug:'irrigation-system-installation-bronkhorstspruit',link:'https://myriadgreen.co.za/irrigation-system-installation-bronkhorstspruit/',title:{rendered:'Irrigation System Installation Bronkhorstspruit'}},
   {id:2,status:'publish',slug:'other-page',link:'https://myriadgreen.co.za/other-page/',title:{rendered:'Mentions Bronkhorstspruit'}}
 ]);
 const p=makeWordPressWaterAlertPublisher({secret,request});
 const found=await p.discoverAreaPages(['Bronkhorstspruit']);
 assert.equal(found.length,1);
 assert.equal(found[0].post_id,1);
});

test('sitemap verification discovers numbered post sitemap and rejects substring and external loc',async()=>{
 const target='https://myriadgreen.co.za/journal/verified-alert/';
 const calls=[];
 const p=makeWordPressWaterAlertPublisher({secret,sitemapAttempts:1,request:async(url)=>{
  calls.push(url);
  const u=new URL(url);
  if(u.pathname==='/post-sitemap.xml')return response(200,null,{text:'<loc>'+target+'other</loc>'});
  if(u.pathname==='/sitemap_index.xml')return response(200,null,{text:'<loc>https://evil.example/post-sitemap2.xml</loc><loc>https://myriadgreen.co.za/page-sitemap.xml</loc><loc>https://myriadgreen.co.za/post-sitemap2.xml</loc>'});
  if(u.pathname==='/post-sitemap2.xml')return response(200,null,{text:'<loc>'+target+'</loc>'});
  throw Error('unexpected');
 }});
 assert.equal((await p.verifySitemap(target)).verified,true);
 assert.equal(calls.length,3);
 assert.ok(calls.every(url=>new URL(url).origin==='https://myriadgreen.co.za'));
});
test('sitemap substring is not proof and bounded retries fail closed',async()=>{
 let reads=0,sleeps=0;
 const p=makeWordPressWaterAlertPublisher({secret,sitemapAttempts:2,sitemapDelayMs:1,sleep:async()=>{sleeps++;},request:async()=>{
  reads++;
  return response(200,null,{text:'<loc>https://myriadgreen.co.za/journal/alert/extra</loc>'});
 }});
 assert.equal((await p.verifySitemap('https://myriadgreen.co.za/journal/alert/')).verified,false);
 assert.equal(reads,4);
 assert.equal(sleeps,1);
});
