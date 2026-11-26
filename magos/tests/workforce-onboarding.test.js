'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const {planWorkforceOnboarding}=require('../processor/workforce-onboarding');
const {createRuntimeApp}=require('../runtime/app');
test('onboarding paths preserve existing employment history and require executive authority',()=>{
 for(const type of ['new','existing','executive']){
  const draft=planWorkforceOnboarding({type});
  assert.equal(draft.state,'REVIEW_REQUIRED');
  assert.equal(draft.employee_created,false);
  assert.equal(draft.side_effects,false);
  assert.equal(draft.production_complete,false);
  assert.equal(draft.optional_benefits,'DISABLED');
  assert.ok(draft.steps.every(s=>s.state==='TO_CONFIRM'));
  assert.equal(draft.steps.some(s=>s.id==='history'),type==='existing');
  assert.equal(draft.steps.some(s=>s.id==='authority'),type==='executive');
  assert.deepEqual(draft,planWorkforceOnboarding({type}));
 }
});
test('invalid pathways fail closed and caller evidence cannot approve gates',()=>{
 for(const type of [undefined,null,'contractor',['new'],{}])assert.throws(()=>planWorkforceOnboarding({type}),/INVALID_EMPLOYMENT_PATH/);
 const draft=planWorkforceOnboarding({type:'existing',approved:true,identity:'secret'});
 assert.ok(draft.steps.every(s=>s.state==='TO_CONFIRM'));
 assert.doesNotMatch(JSON.stringify(draft),/secret/);
});
test('workforce draft endpoint requires operator access and never opens business writer',async()=>{
 const app=createRuntimeApp({token:'runtime-private',operatorReadToken:'operator-read',writerFactory:()=>{throw Error('NO_WRITER_ALLOWED')}});
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/workforce/onboarding';
  assert.equal((await fetch(url+'?type=existing')).status,401);
  assert.equal((await fetch(url+'?type=existing',{headers:{'X-MAGOS-Operator-Token':'runtime-private'}})).status,401);
  const headers={'X-MAGOS-Operator-Token':'operator-read'};
  const r=await fetch(url+'?type=existing',{headers});
  assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/no-store/);
  assert.deepEqual(await r.json(),planWorkforceOnboarding({type:'existing'}));
  assert.equal((await fetch(url+'?type=invalid',{headers})).status,400);
 }finally{await new Promise(done=>server.close(done));}
});
test('existing Command Centre connects workforce navigation to authenticated draft endpoint',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Employee onboarding/);
 assert.match(source,/\/v1\/operator\/workforce\/onboarding/);
 assert.match(source,/Draft only\. No employee or registration created/);
 assert.match(source,/workforceRequest\?\.abort/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
