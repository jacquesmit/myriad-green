'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanonicalJobAuthorityVerifier}=require('../processor/canonical-job-authority');
const stores={commercial:{
 findByKey:async()=>({object:{quote_id:'Q1',opportunity_id:'O1','Quote Status':'ACCEPTED'}}),
 readObjects:async sheet=>({
 'Payment Control':[{'Control ID':'P1','Opportunity ID':'O1','Deposit Required (R)':'400'}],
 'Payment_Allocations':[{control_id:'P1',allocation_id:'A1',payment_event_id:'E1',allocation_type:'DEPOSIT',allocation_state:'CLEARED',amount:'400',evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view'}],
 'Payment_Events':[{payment_event_id:'E1',control_id:'P1',opportunity_id:'O1',event_type:'PAYMENT_CLEARED',clearance_state:'CLEARED',amount:'400',evidence_link:'https://drive.google.com/file/d/BANKTESTEVIDENCE001/view',idempotency_key:'BANK-E1',source_system:'BANK_CREDIT_REVIEWED'}]
 })[sheet]||[]
}};
const signature=async({quote_id,opportunity_id})=>({verified:true,quote_id,opportunity_id,evidence_ref:'drive://signed',signer_identity:'Verified signer',signed_at:'2026-10-11',source_event_id:'E1'});
const bank=async args=>({
 verified:true,control_id:args.control_id,opportunity_id:args.opportunity_id,
 job_id:args.job_id,payment_event_ids:[...args.payment_event_ids],
 settlement_status:'CLEARED',source_authority:'BANK',confirmation_id:'BANK-CONFIRMED-1',
 confirmed_amount_cents:args.expected_amount_cents
});
test('release authority requires matching signed event plus canonical cleared allocation',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature,bankClearanceVerifier:bank});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.verified,true);assert.equal(result.payment_control_id,'P1');
 assert.equal(result.bank_confirmed_amount_cents,40000);
 assert.equal(result.bank_deposit_required_cents,40000);
});
test('different source event never authorizes release',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'OTHER'});
 assert.equal(result.verified,false);assert.equal(result.reason_code,'SIGNED_EVENT_ID_MISMATCH');
});
test('no independent signer cannot authorize release',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.verified,false);
});

test('internal cleared payment event alone cannot authorize job creation',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature});
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.verified,false);
 assert.equal(result.reason_code,'INDEPENDENT_BANK_CLEARANCE_AUTHORITY_NOT_CONFIGURED');
});
test('bank attestation is bound to exact job, control, cents and events',async()=>{
 for(const patch of [
  {verified:false},
  {control_id:'OTHER'},
  {opportunity_id:'OTHER'},
  {job_id:'OTHER'},
  {confirmed_amount_cents:39999},
  {payment_event_ids:['WRONG']},
  {payment_event_ids:['E1','E1']},
  {settlement_status:'PENDING'},
  {source_authority:'OWNER_ASSERTION'},
  {confirmation_id:''}
 ]){
  const verify=createCanonicalJobAuthorityVerifier({
   stores,acceptanceVerifier:signature,
   bankClearanceVerifier:async args=>({...await bank(args),...patch})
  });
  const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
  assert.equal(result.verified,false,JSON.stringify(patch));
  assert.equal(result.reason_code,'INDEPENDENT_BANK_SETTLEMENT_AND_ALLOCATIONS_NOT_VERIFIED');
 }
});
test('bank authority exception fails closed without calling job writer',async()=>{
 const verify=createCanonicalJobAuthorityVerifier({
  stores,acceptanceVerifier:signature,
  bankClearanceVerifier:async()=>{throw Error('PROVIDER_UNAVAILABLE')}
 });
 const result=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(result.reason_code,'INDEPENDENT_BANK_CLEARANCE_AUTHORITY_UNAVAILABLE');
});
test('bank authority receives only exact canonical IDs and recorded amount',async()=>{
 let captured;
 const verify=createCanonicalJobAuthorityVerifier({stores,acceptanceVerifier:signature,
  bankClearanceVerifier:async args=>{captured=args;return bank(args)}
 });
 const r=await verify({quoteId:'Q1',jobId:'JOB-1',sourceEventId:'E1'});
 assert.equal(r.verified,true);
 assert.deepEqual(captured.payment_event_ids,['E1']);
 assert.deepEqual(captured.allocation_ids,['A1']);
 assert.equal(captured.expected_amount_cents,40000);
 assert.equal(captured.deposit_required_cents,40000);
 assert.equal(r.bank_clearance_confirmation_id,'BANK-CONFIRMED-1');
});
