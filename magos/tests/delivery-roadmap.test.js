'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildDeliveryRoadmap,TARGETS}=require('../processor/delivery-roadmap');
const rows=Array.from({length:22},(_,i)=>({
 id:'CAP-'+String(i+1).padStart(3,'0'),
 state:i===0?'PASS':i===9||i===11||i===14||i===18?'FAIL':'PARTIAL'
}));
test('rollout milestones use canonical capability states and proposed targets only',()=>{
 const r=buildDeliveryRoadmap({capabilities:rows,asOf:'2026-11-22'});
 assert.equal(r.milestones.length,4);
 assert.equal(r.counts.validated,0);
 assert.equal(r.counts.missed,0);
 assert.equal(r.milestones[0].target_date,'2026-11-25');
 assert.equal(r.milestones[0].recorded_pass,0);
 assert.ok(r.milestones[0].blockers.includes('CAP-020'));
 assert.equal(r.targets_approved,false);
 assert.equal(r.production_rollout_committed,false);
 assert.equal(r.deployment_evidence,'NOT_VERIFIED');
 assert.deepEqual(r.writes,[]);
});
test('due targets become overdue but never silently completed or rescheduled',()=>{
 const r=buildDeliveryRoadmap({capabilities:rows,asOf:'2026-12-05'});
 assert.equal(r.milestones[0].state,'TARGET_MISSED');
 assert.equal(r.milestones[1].state,'TARGET_MISSED');
 assert.equal(r.milestones[2].state,'TARGET_OPEN');
 assert.equal(r.milestones[0].target_date,'2026-11-25');
});
test('all source capability PASS still needs independently accepted live release',()=>{
 const all=rows.map(x=>({...x,state:'PASS'}));
 const r=buildDeliveryRoadmap({capabilities:all,asOf:'2026-11-24'});
 assert.ok(r.milestones.every(x=>x.state==='SOURCE_GATES_PASSED_LIVE_TEST_REQUIRED'));
 assert.ok(r.milestones.every(x=>x.independently_validated===false&&x.shipped===false));
 assert.equal(r.counts.validated,0);
});
test('missing capability, conflicting IDs and invalid date never yield claimed pass',()=>{
 const r=buildDeliveryRoadmap({capabilities:rows.slice(0,2),asOf:'2026-11-22'});
 assert.ok(r.milestones[0].missing_sources.includes('CAP-020'));
 assert.equal(r.milestones[0].state,'TARGET_OPEN');
 assert.throws(()=>buildDeliveryRoadmap({capabilities:[rows[0],rows[0]],asOf:'2026-11-22'}),/DUPLICATED/);
 assert.throws(()=>buildDeliveryRoadmap({capabilities:rows,asOf:'not a date'}),/UNAVAILABLE/);
});
test('milestone contract explicitly covers frontend, lead-to-cash, field and whole business',()=>{
 assert.deepEqual(TARGETS.map(m=>m.id),['UI-01','FLOW-02','FIELD-03','FULL-04']);
 assert.equal(TARGETS[3].capability_ids.length,22);
});
