'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRuntimeApp}=require('../runtime/app');

async function withServer(app,fn){
 const server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const {port}=server.address();
 try{return await fn('http://127.0.0.1:'+port);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
const notice={
 provider:'CITY_OF_TSHWANE',source_channel:'OFFICIAL_SOCIAL',source_account:'CityTshwane',
 source_url:'https://x.com/CityTshwane/status/123',source_event_id:'x:CityTshwane:123',
 effective_date:'2026-11-24',alert_type:'WATER_INTERRUPTION',
 title:'Tshwane water interruption — 24 November 2026',summary:'Verified interruption.',
 affected_areas:['Wierdapark'],faq:[{q:'Is Wierdapark affected?',a:'Yes.'}],
 evidence:[{type:'OFFICIAL_NOTICE',ref:'https://x.com/CityTshwane/status/123'}]
};
const pubToken='publisher-token-that-is-more-than-thirty-two-characters';
function app(overrides={}){
 return createRuntimeApp({
   token:'runtime-secret',
   waterAlertPublishToken:pubToken,
   waterAlertNow:()=>new Date('2026-11-24T12:00:00Z'),
   startupGitStateReader:()=>({sha:'a'.repeat(40),dirty:false}),
   waterAlertPublisherFactory:()=>({
     discoverAreaPages:async()=>[{area:'Wierdapark',status:'publish',url:'https://myriadgreen.co.za/irrigation-system-installation-wierda-park/'}],
     publish:async({plan})=>({state:'CREATE_NEW',verified:true,post_id:123,url:'https://myriadgreen.co.za/journal/test/',source_key:plan.source_key,content_fingerprint:plan.content_fingerprint,sitemap_verified:true})
   }),
   ...overrides
 });
}
test('water alert publish endpoint uses separate credential and publishes only verified active plan',async()=>{
 await withServer(app(),async base=>{
   const denied=await fetch(base+'/v1/content/water-alert/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({notice})});
   assert.equal(denied.status,401);
   const ok=await fetch(base+'/v1/content/water-alert/publish',{method:'POST',headers:{'content-type':'application/json','x-magos-water-alert-token':pubToken},body:JSON.stringify({notice})});
   assert.equal(ok.status,200);
   const body=await ok.json();
   assert.equal(body.state,'CREATE_NEW');
   assert.equal(body.endpoint_mode,'WORDPRESS_PUBLISH_AND_READBACK');
 });
});
test('unverified news/community signal cannot reach publisher',async()=>{
 let calls=0;
 await withServer(app({waterAlertPublisherFactory:()=>({
   discoverAreaPages:async()=>[],
   publish:async()=>{calls++;return {state:'CREATE_NEW',verified:true};}
 })}),async base=>{
   const bad={...notice,source_account:'CommunityPage',source_url:'https://x.com/CommunityPage/status/9'};
   const r=await fetch(base+'/v1/content/water-alert/publish',{method:'POST',headers:{'content-type':'application/json','x-magos-water-alert-token':pubToken},body:JSON.stringify({notice:bad})});
   assert.equal(r.status,202);
   const body=await r.json();
   assert.equal(body.state,'REVIEW_REQUIRED');
   assert.equal(body.publishing_performed,false);
   assert.equal(calls,0);
 });
});
test('publisher credential cannot reuse runtime credential',async()=>{
 const reused='same-secret-that-is-more-than-thirty-two-characters';
 await withServer(app({token:reused,waterAlertPublishToken:reused}),async base=>{
   const r=await fetch(base+'/v1/content/water-alert/publish',{method:'POST',headers:{'content-type':'application/json','x-magos-water-alert-token':reused},body:JSON.stringify({notice})});
   assert.equal(r.status,503);
   assert.equal((await r.json()).error,'WATER_ALERT_PUBLISHER_NOT_CONFIGURED');
 });
});
