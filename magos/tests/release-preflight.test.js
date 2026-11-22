'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {releasePreflight}=require('../runtime/release-preflight');
const {createRuntimeApp}=require('../runtime/app');
const sha='0123456789abcdef0123456789abcdef01234567';
const values={
 '/healthz':{status:'ok'},
 '/readyz':{status:'ready'},
 '/v1/runtime/build':{schema_version:'MAGOS_RUNTIME_BUILD_V1',commit_sha:sha,checkout_sha_at_process_start:sha,tracked_worktree_clean_at_start:true,status:'GIT_CHECKOUT_AND_DEPLOY_DECLARATION_MATCH'},
 '/v1/probes/google-sheets':{google_sheets:'reachable',audit_store:'reachable'},
 '/v1/workflows':{schema_version:'MAGOS_WORKFLOW_CATALOG_V1',workflows:[]},
 '/v1/operator/coverage':{
  schema_version:'MAGOS_SYSTEM_COVERAGE_V1',side_effects:false,
  counts:{total:22,pass:1,partial:15,fail:6},production_complete:false
 },
 '/v1/operator/deployment':{
  schema_version:'MAGOS_OPERATOR_DEPLOYMENT_V1',status:'PROCESS_START_GIT_MATCH',
  commit_sha:sha,production_complete:false,side_effects:false
 },
 '/v1/operator/dashboard':{
  schema_version:'MAGOS_OPERATOR_DASHBOARD/V1',side_effects:false,
  departments:{
   clients:{state:'LIVE',records:[{id:'C-1',status:'NEW'}]},
   jobs:{state:'LIVE',records:[{id:'O-1',status:'IN_PROGRESS'}]},
   quotes:{state:'LIVE',records:[{id:'Q-1',status:'SENT'}]}
  }
 }
};
const assets={
 '/operator':'<html><form id="login"></form><nav id="filters"></nav><tbody id="queue"></tbody><section id="department"></section><p id="deployment"></p><script src="/operator.js"></script><link href="/operator.css"></html>',
 '/operator.js':'function renderView(){}; fetch("/v1/operator/dashboard")',
 '/operator.css':'.workspace { display: grid; }'
};
const fakeRequest=async(url,options={})=>{
 const name=new URL(url).pathname;
 if(Object.hasOwn(assets,name))return {status:200,text:async()=>assets[name]};
 if(name==='/v1/operator/dashboard'&&
    options.headers?.['X-MAGOS-Operator-Token']!=='operator-secret')
  return {status:401,json:async()=>({error:'UNAUTHORIZED'})};
 return {status:200,json:async()=>values[name]};
};
const args={
 expectedSha:sha,baseUrl:'https://runtime.example.test',
 runtimeToken:'runtime-secret',operatorToken:'operator-secret',
 gitReader:()=>({sha,dirty:false}),
 request:fakeRequest
};
test('release preflight validates exact process SHA and sources but does not claim full business completion',async()=>{
 const r=await releasePreflight(args);
 assert.equal(r.ready,true);
 assert.equal(r.site_complete,false);
 assert.equal(r.production_business_acceptance_verified,false);
 assert.ok(r.checks.every(c=>c.state==='PASS'));
 assert.equal(r.capability_counts.total,22);
 assert.ok(!JSON.stringify(r).includes('runtime-secret'));
});
test('dirty checkout and stale process are rejected even if health is green',async()=>{
 const r=await releasePreflight({...args,gitReader:()=>({sha,dirty:true}),
  request:async(url,options)=>{
   if(new URL(url).pathname==='/v1/runtime/build')
    return {status:200,json:async()=>({...values['/v1/runtime/build'],commit_sha:'ffffffffffffffffffffffffffffffffffffffff'})};
   return fakeRequest(url,options);
  }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(c=>c.name==='TRACKED_WORKTREE_CLEAN'&&c.state==='FAIL'));
 assert.ok(r.checks.some(c=>c.name==='RUNNING_WORKER_SHA'&&c.state==='FAIL'));
});
test('missing or shared credentials fail closed without issuing network requests',async()=>{
 let requests=0;
 const r=await releasePreflight({...args,operatorToken:'runtime-secret',
  request:async()=>{requests++;throw Error('should not call')}});
 assert.equal(r.ready,false);
 assert.equal(requests,0);
});
test('missing Google Sheets or canonical coverage prevents release readiness',async()=>{
 const r=await releasePreflight({...args,
  request:async(url,options)=>{
   if(new URL(url).pathname==='/v1/operator/coverage')
    return {status:503,json:async()=>values['/v1/operator/coverage']};
   return fakeRequest(url,options);
  }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(c=>c.name==='CANONICAL_COVERAGE'&&c.state==='FAIL'));
});
test('runtime process build fingerprint is authenticated and rejects unset SHA',async()=>{
 const app=createRuntimeApp({token:'test-runtime',deployedCommitSha:sha,startupGitStateReader:()=>({sha,dirty:false})});
 const server=http.createServer(app);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/runtime/build';
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{authorization:'Bearer test-runtime'}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).commit_sha,sha);
 } finally{await new Promise(done=>server.close(done));}
 const bad=createRuntimeApp({token:'test-runtime',deployedCommitSha:'unverified'});
 const server2=http.createServer(bad);
 await new Promise(done=>server2.listen(0,'127.0.0.1',done));
 try{
  const response=await fetch('http://127.0.0.1:'+server2.address().port+'/v1/runtime/build',{
   headers:{authorization:'Bearer test-runtime'}});
  assert.equal(response.status,503);
 }finally{await new Promise(done=>server2.close(done));}
});

test('forged process declaration, dirty checkout and missing Git state fail build attestation',async()=>{
 for(const startup of [
   ()=>({sha:'ffffffffffffffffffffffffffffffffffffffff',dirty:false}),
   ()=>({sha,dirty:true}),
   ()=>{throw Error('HOST_GIT_UNAVAILABLE');}
 ]){
  const app=createRuntimeApp({token:'test-runtime',deployedCommitSha:sha,
   startupGitStateReader:startup});
  const server=http.createServer(app);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try{
   const r=await fetch('http://127.0.0.1:'+server.address().port+'/v1/runtime/build',
     {headers:{authorization:'Bearer test-runtime'}});
   assert.equal(r.status,503);
   assert.equal((await r.json()).status,'UNVERIFIED');
  }finally{await new Promise(ok=>server.close(ok));}
 }
});
test('release preflight rejects build response that merely repeats environment SHA',async()=>{
 const r=await releasePreflight({...args,request:async(url,options)=>{
   const p=new URL(url).pathname;
   if(p==='/v1/runtime/build')return {status:200,json:async()=>({schema_version:'MAGOS_RUNTIME_BUILD_V1',commit_sha:sha})};
   return fakeRequest(url,options);
 }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(x=>x.name==='RUNNING_WORKER_SHA'&&x.state==='FAIL'));
});

test('release requires actual browser shell and assets, not only green runtime health',async()=>{
 for(const missing of ['/operator','/operator.js','/operator.css']){
  const r=await releasePreflight({...args,request:async(url,options)=>{
   if(new URL(url).pathname===missing)
    return {status:404,text:async()=>''};
   return fakeRequest(url,options);
  }});
  assert.equal(r.ready,false,missing);
  assert.ok(r.checks.some(c=>c.name===(missing==='/operator'?
   'OPERATOR_BROWSER_SHELL':'OPERATOR_BROWSER_ASSETS')&&c.state==='FAIL'));
 }
});
test('operator deployment identity must independently match the same exact running SHA',async()=>{
 const r=await releasePreflight({...args,request:async(url,options)=>{
  if(new URL(url).pathname==='/v1/operator/deployment')
   return {status:202,json:async()=>({...values['/v1/operator/deployment'],
    status:'NOT_VERIFIED',commit_sha:null})};
  return fakeRequest(url,options);
 }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(c=>c.name==='OPERATOR_DEPLOYMENT_IDENTITY'&&c.state==='FAIL'));
});
test('operator login rejects anonymous and writer credentials independently',async()=>{
 const r=await releasePreflight({...args,request:async(url,options)=>{
  if(new URL(url).pathname==='/v1/operator/dashboard'&&
    options.headers?.['X-MAGOS-Operator-Token']==='runtime-secret')
   return {status:200,json:async()=>values['/v1/operator/dashboard']};
  return fakeRequest(url,options);
 }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(c=>c.name==='OPERATOR_AUTH_ISOLATION'&&c.state==='FAIL'));
});
test('operator source failure and empty core dataset prevent frontend pilot PASS',async()=>{
 for(const bad of [
  {clients:{state:'UNAVAILABLE'},jobs:{state:'LIVE',records:[]},quotes:{state:'LIVE',records:[]}},
  {clients:{state:'LIVE',records:[]},jobs:{state:'LIVE',records:[]},quotes:{state:'LIVE',records:[]}}
 ]){
  const r=await releasePreflight({...args,request:async(url,options)=>{
   if(new URL(url).pathname==='/v1/operator/dashboard'&&
    options.headers?.['X-MAGOS-Operator-Token']==='operator-secret')
    return {status:200,json:async()=>({...values['/v1/operator/dashboard'],departments:bad})};
   return fakeRequest(url,options);
  }});
  assert.equal(r.ready,false);
  assert.ok(r.checks.some(c=>c.name==='OPERATOR_CANONICAL_RECORDS'&&c.state==='FAIL'));
 }
});
