'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildWorkforceRecordPlan,prepareWorkforceRecord}=require('../processor/workforce-record');
const ref=c=>'opaque:'+c.repeat(64);
const sample={type:'existing',subjectRef:ref('a'),employerRef:ref('b'),sourceRef:ref('c')};
test('canonical employee key is stable across duplicate upload source references',()=>{
 const a=buildWorkforceRecordPlan(sample),b=buildWorkforceRecordPlan({...sample,sourceRef:ref('d')});
 assert.equal(a.writes[0].key.value,b.writes[0].key.value);
 assert.notEqual(a.idempotency_key,b.idempotency_key);
 assert.deepEqual(a,buildWorkforceRecordPlan(sample));
 assert.equal(a.writes[0].operation,'APPEND_IF_ABSENT');
 assert.equal(a.writes[0].authority,'AUTHORITATIVE');
 assert.equal(a.writes[0].values.onboarding_state,'REVIEW_REQUIRED');
 assert.ok(!JSON.stringify(a).includes(sample.subjectRef));
 assert.notEqual(a.writes[0].key.value,buildWorkforceRecordPlan({...sample,employerRef:ref('e')}).writes[0].key.value);
});
test('invalid identity and caller-provided approval fail closed',async()=>{
 assert.throws(()=>buildWorkforceRecordPlan({...sample,subjectRef:'personal-id'}),/INVALID_OPAQUE_REFERENCE/);
 assert.equal((await prepareWorkforceRecord({request:{approved:true}})).state,'BLOCKED');
 const writer={stores:{workforce:{}},execute(){throw Error('MUST_NOT_WRITE')}};
 assert.equal((await prepareWorkforceRecord({request:{approved:true},writer,verifyAuthority:async()=>({verified:false,approved:true})})).state,'REVIEW_REQUIRED');
});
test('approved trusted evidence delegates to existing writer and strips audit data',async()=>{
 const calls=[];
 const writer={stores:{workforce:{}},execute:async plan=>{calls.push(plan);return {state:'COMMITTED',audit:{private:'secret'}}}};
 const r=await prepareWorkforceRecord({request:{},writer,verifyAuthority:async()=>({...sample,approved:true,verified:true})});
 assert.equal(calls.length,1);assert.equal(r.state,'COMMITTED');assert.equal(r.operational_clearance,false);
 assert.doesNotMatch(JSON.stringify(r),/secret/);
});
