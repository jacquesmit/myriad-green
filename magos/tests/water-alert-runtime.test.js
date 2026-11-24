'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createRuntimeApp}=require('../runtime/app');

async function withServer(app,fn){
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{
    server.once('listening',resolve);server.once('error',reject);
  });
  const {port}=server.address();
  try{return await fn('http://127.0.0.1:'+port);}
  finally{await new Promise(resolve=>server.close(resolve));}
}

function payload(){
  return {
    notice:{
      provider:'CITY_OF_TSHWANE',
      source_channel:'OFFICIAL_SOCIAL',
      source_account:'CityTshwane',
      source_url:'https://x.com/CityTshwane/status/123',
      source_event_id:'x:CityTshwane:123',
      effective_date:'2026-11-24',
      alert_type:'TANKER_DISTRIBUTION',
      title:'Tshwane Region 7 Water Tanker Distribution — 24 November 2026',
      summary:'Region 7 tanker distribution.',
      affected_areas:['Bronkhorstspruit'],
      evidence:[{type:'OFFICIAL_NOTICE',ref:'https://x.com/CityTshwane/status/123'}]
    },
    existing_posts:[],
    site_index:{area_pages:[]}
  };
}

test('water alert planner endpoint is authenticated and performs no publication',async()=>{
  const app=createRuntimeApp({
    token:'runtime-secret',
    startupGitStateReader:()=>({commit_sha:'a'.repeat(40),tracked_worktree_clean:true}),
    waterAlertNow:()=>new Date('2026-11-24T12:00:00Z')
  });
  await withServer(app,async base=>{
    const denied=await fetch(base+'/v1/content/water-alert/plan',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())
    });
    assert.equal(denied.status,401);

    const allowed=await fetch(base+'/v1/content/water-alert/plan',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer runtime-secret'},
      body:JSON.stringify(payload())
    });
    assert.equal(allowed.status,200);
    const body=await allowed.json();
    assert.equal(body.state,'READY_TO_PUBLISH');
    assert.equal(body.endpoint_mode,'READ_ONLY_PLAN');
    assert.equal(body.publishing_performed,false);
    assert.equal(body.wordpress_adapter_required,true);
  });
});

test('unverified source returns review-required planning response',async()=>{
  const app=createRuntimeApp({
    token:'runtime-secret',
    startupGitStateReader:()=>({commit_sha:'a'.repeat(40),tracked_worktree_clean:true}),
    waterAlertNow:()=>new Date('2026-11-24T12:00:00Z')
  });
  const p=payload();p.notice.source_account='RepostAccount';
  await withServer(app,async base=>{
    const response=await fetch(base+'/v1/content/water-alert/plan',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer runtime-secret'},
      body:JSON.stringify(p)
    });
    assert.equal(response.status,202);
    const body=await response.json();
    assert.equal(body.state,'REVIEW_REQUIRED');
    assert.equal(body.publishing_performed,false);
  });
});
