'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {quoteValidityReview,calendarDate}=require('../processor/quote-validity');
test('recorded sent quote past actual local validity is review, not automated expiration',()=>{
 const r=quoteValidityReview({'Quote Status':'SENT','Valid Until':'2026-11-15',
   'Days Remaining':'3','Next Action':'Send follow-up'},'2026-11-22');
 assert.equal(r.state,'VALIDITY_ELAPSED_REVIEW');
 assert.equal(r.action_required,true);
 assert.match(r.next_action,/revised valid pricing/);
 assert.equal(r.valid_until,'2026-11-15');
});
test('issued quote ending today is prioritized without assuming delivery',()=>{
 const r=quoteValidityReview({'Quote Status':'ISSUED','Valid Until':'2026-11-22'},'2026-11-22');
 assert.equal(r.state,'VALIDITY_ENDS_TODAY');
 assert.equal(r.action_required,true);
});
test('drafts and unconfirmed records are not treated as sent client quotations',()=>{
 for(const status of ['DRAFT','TO_CONFIRM','ACCEPTED','DECLINED','CANCELLED','EXPIRED']){
  const r=quoteValidityReview({'Quote Status':status,'Valid Until':'2026-10-01'},'2026-11-22');
  assert.equal(r.state,'NOT_RECORDED_ISSUED');
  assert.equal(r.action_required,false);
 }
});
test('future validity is retained and source next action preserved',()=>{
 const r=quoteValidityReview({'Quote Status':'SENT','Valid Until':'2026-12-01',
  'Next Action':'Confirm system size'},'2026-11-22');
 assert.equal(r.state,'WITHIN_RECORDED_VALIDITY');
 assert.equal(r.next_action,'Confirm system size');
 assert.equal(r.action_required,false);
});
test('missing or impossible dates fail to review rather than invent zero age',()=>{
 for(const until of ['',undefined,'2026-02-30','22/11/2026']){
  assert.equal(quoteValidityReview({'Quote Status':'SENT','Valid Until':until},'2026-11-22').state,
    'VALIDITY_UNKNOWN_REVIEW');
 }
 assert.equal(calendarDate('2026-02-29'),'');
 assert.equal(calendarDate('2028-02-29'),'2028-02-29');
 assert.throws(()=>quoteValidityReview({'Quote Status':'SENT'},'invalid'),/JOHANNESBURG_DATE_REQUIRED/);
});
