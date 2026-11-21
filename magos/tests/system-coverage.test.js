'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {SystemCoverageReader}=require('../processor/system-coverage');
const {createRuntimeApp}=require('../runtime/app');

const rows=[
 {'Capability ID':'CAP-001','Business Capability':'Lead capture & intake',
  'Current State':'PARTIAL','Implementation State':'IMPLEMENTED',
  'Completion Gate':'Provider replay','Primary Gap':'Live verification',
  'Priority':'P0','Next Action':'Test ingress',
  'Do Not Mark Complete Until':'Live write/readback'},
 {'Capability ID':'CAP-010','Business Capability':'Variation control',
  'Current State':'FAIL','Implementation State':'DISCUSSED',
  'Completion Gate':'Variation receipt','Primary Gap':'No canonical variation object',
  'Priority':'P0','Next Action':'Build approved variation object',
  'Do Not Mark Complete Until':'Approved variation end to end'}
];
const store={readObjects:async (name,{requiredHeaders,maxRows})=>{
  assert.equal(name,'Business_Capability_Map');
  assert.equal(maxRows,null);
  assert.ok(requiredHeaders.includes('Completion Gate'));
  return rows;
}};
test('whole-business capability reader preserves FAIL and PARTIAL without inventing PASS',async()=>{
 const result=await new SystemCoverageReader({store}).read();
 assert.equal(result.counts.total,2);
 assert.equal(result.counts.pass,0);
 assert.equal(result.counts.partial,1);
 assert.equal(result.counts.fail,1);
 assert.equal(result.production_complete,false);
 assert.equal(result.side_effects,false);
 assert.equal(result.capabilities[1].next_action,'Build approved variation object');
});
test('duplicate capability IDs fail closed',async()=>{
 const bad=new SystemCoverageReader({store:{readObjects:async()=>[rows[0],rows[0]]}});
 await assert.rejects(bad.read(),/CAPABILITY_REGISTER_ID_CONFLICT/);
});
test('unavailable capability source never reports whole MAGOS complete',async()=>{
 await assert.rejects(new SystemCoverageReader({store:{readObjects:async()=>{throw Error('drive down')}}}).read());
});
test('operator coverage requires a separate read credential',async()=>{
 const app=createRuntimeApp({
  token:'writer-secret',operatorReadToken:'viewer-secret',
  systemCoverageReaderFactory:()=>new SystemCoverageReader({store})
 });
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const none=await fetch(origin+'/v1/operator/coverage');
  assert.equal(none.status,401);
  const wrong=await fetch(origin+'/v1/operator/coverage',{
    headers:{'X-MAGOS-Operator-Token':'writer-secret'}
  });
  assert.equal(wrong.status,401);
  const right=await fetch(origin+'/v1/operator/coverage',{
    headers:{'X-MAGOS-Operator-Token':'viewer-secret'}
  });
  assert.equal(right.status,200);
  const body=await right.json();
  assert.equal(body.counts.total,2);
  assert.equal(body.production_complete,false);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
