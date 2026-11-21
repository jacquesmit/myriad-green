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
 }
};
const args={
 expectedSha:sha,baseUrl:'https://runtime.example.test',
 runtimeToken:'runtime-secret',operatorToken:'operator-secret',
 gitReader:()=>({sha,dirty:false}),
 request:async url=>({status:200,json:async()=>values[new URL(url).pathname]})
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
  request:async url=>({status:200,json:async()=>new URL(url).pathname==='/v1/runtime/build'?
   {...values['/v1/runtime/build'],commit_sha:'ffffffffffffffffffffffffffffffffffffffff'}:
   values[new URL(url).pathname]})});
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
  request:async url=>({status:new URL(url).pathname==='/v1/operator/coverage'?503:200,
   json:async()=>values[new URL(url).pathname]})});
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
 const r=await releasePreflight({...args,request:async url=>{
   const p=new URL(url).pathname;
   return {status:200,json:async()=>p==='/v1/runtime/build'?
     {schema_version:'MAGOS_RUNTIME_BUILD_V1',commit_sha:sha}:values[p]};
 }});
 assert.equal(r.ready,false);
 assert.ok(r.checks.some(x=>x.name==='RUNNING_WORKER_SHA'&&x.state==='FAIL'));
});
