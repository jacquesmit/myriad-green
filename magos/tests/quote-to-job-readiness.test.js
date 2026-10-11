'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessQuoteToJob } = require('../processor/quote-to-job-readiness');
const q = {quote_id:'QTE-1',opportunity_id:'OPP-1','Quote Status':'ACCEPTED','Line Control State':'PASS'};
const job = {opportunity_id:'OPP-1',job_id:''};
test('accepted evidenced quote with cleared funds and canonical lines is ready but does not mutate',()=>{
 const r=assessQuoteToJob({quote:q,job,acceptanceEvidence:'drive://signed/1',paymentClearance:'CLEARED'});
 assert.equal(r.decision,'READY_FOR_GOVERNED_JOB_CREATION');
 assert.deepEqual(r.writes,[]);
 assert.equal(r.side_effects,false);
});
test('uncleared deposit and missing acceptance evidence route review, not payment clearance',()=>{
 const r=assessQuoteToJob({quote:q,job,paymentClearance:'PROOF_RECEIVED'});
 assert.equal(r.decision,'REVIEW_REQUIRED');
 assert.ok(r.review_reasons.includes('PAYMENT_CLEARANCE_NOT_VERIFIED'));
 assert.ok(r.review_reasons.includes('ACCEPTANCE_EVIDENCE_NOT_VERIFIED'));
});
test('mismatched quote and job cannot be released',()=>{
 const r=assessQuoteToJob({quote:q,job:{...job,opportunity_id:'OPP-OTHER'},paymentClearance:'CLEARED',acceptanceEvidence:'signed'});
 assert.equal(r.decision,'BLOCKED');
 assert.ok(r.blocked_reasons.includes('QUOTE_OPPORTUNITY_MISMATCH'));
});
test('unaccepted quote blocks downstream while allowing independent business work',()=>{
 const r=assessQuoteToJob({quote:{...q,'Quote Status':'SENT'},job,paymentClearance:'CLEARED',acceptanceEvidence:'signed'});
 assert.equal(r.decision,'BLOCKED');
 assert.ok(r.blocked_reasons.includes('QUOTE_NOT_ACCEPTED'));
 assert.equal(r.side_effects,false);
});
test('existing job does not create duplicate and requires reconciliation',()=>{
 const r=assessQuoteToJob({quote:q,job:{...job,job_id:'JOB-1'},paymentClearance:'CLEARED',acceptanceEvidence:'signed'});
 assert.equal(r.decision,'REVIEW_REQUIRED');
 assert.ok(r.review_reasons.includes('EXISTING_JOB_REQUIRES_RECONCILIATION'));
});
