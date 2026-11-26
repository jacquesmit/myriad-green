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

test('coverage endpoint exposes milestone dates but never certifies launch from source metadata',async()=>{
 const r=await new SystemCoverageReader({store}).read();
 assert.equal(r.delivery.schema_version,'MAGOS_DELIVERY_ROADMAP_V1');
 assert.equal(r.delivery.milestones.length,4);
 assert.equal(r.delivery.production_rollout_committed,false);
 assert.equal(r.delivery.milestones[0].independently_validated,false);
 assert.equal(r.production_complete,false);
});

test('even 22 source PASS capability rows do not certify live production',async()=>{
 const all=Array.from({length:22},(_,i)=>({
  ...rows[0], 'Capability ID':'CAP-'+String(i+1).padStart(3,'0'),
  'Current State':'PASS'
 }));
 const report=await new SystemCoverageReader({store:{readObjects:async()=>all}}).read();
 assert.equal(report.counts.pass,22);
 assert.equal(report.capability_gates_passed,true);
 assert.equal(report.production_complete,false);
 assert.equal(report.production_acceptance,'NOT_VERIFIED');
 assert.equal(report.delivery.counts.validated,0);
});

test('coverage inventories use actual header rows and preserve source-only status',async()=>{
 const input={
 Business_Capability_Map:rows,
 System_Directory:[{'System ID':'SYS-001','System / Module':'CRM','Lifecycle status':'ACTIVE'}],
 Lifecycle_Gates:[{'Gate ID':'GATE-001',Transition:'Intake accepted','To State':'INTAKE_RECORDED','Required Evidence / Conditions':'Readback'}],
 Core_Build_Queue:[{'Queue ID':'CORE-002','Work Package':'Runtime','State':'VALIDATED','Next Executable Action':'Proceed'}],
 Automation_Directory:[{'Automation ID':'AUTO-1','Business purpose':'Monitor intake',Status:'DISABLED / VALIDATED'},{}]
 };
 const result=await new SystemCoverageReader({store:{readObjects:async(tab,opts)=>{
  if(tab!=='Business_Capability_Map')assert.equal(opts.headerRow,['System_Directory','Automation_Directory'].includes(tab)?4:1);
  return input[tab];
 }}}).read();
 assert.equal(result.inventory.systems.count,1);
 assert.equal(result.inventory.systems.state,'PARTIAL');
 assert.equal(result.inventory.gates.records[0].next_action,'Readback');
 assert.equal(result.inventory.packages.records[0].status,'VALIDATED');
 assert.equal(result.inventory.automations.count,1);
 assert.equal(result.inventory.automations.records[0].details.production_acceptance,'NOT_VERIFIED');
 assert.equal(result.production_complete,false);
});
test('inventory duplicate IDs and unavailable sources never masquerade as zero records',async()=>{
 const result=await new SystemCoverageReader({store:{readObjects:async(tab)=>{
  if(tab==='Business_Capability_Map')return rows;
  if(tab==='System_Directory')return Array(2).fill({'System ID':'SYS-001','System / Module':'CRM','Lifecycle status':'ACTIVE'});
  if(tab==='Automation_Directory')return [{'Automation ID':'AUTO-1','Business purpose':'Monitor',Status:'#REF!'}];
  throw Error('unavailable');
 }}}).read();
 for(const inv of Object.values(result.inventory)){
  assert.equal(inv.state,'UNAVAILABLE');
  assert.equal(inv.count,null);
 }
 assert.equal(result.counts.total,2);
});
