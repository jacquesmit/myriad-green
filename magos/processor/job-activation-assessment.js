'use strict';
const {inspectJobRelease}=require('./job-release-inspection');
const {inspectDepositEvidence}=require('./deposit-evidence-inspection');
const {verifySignedAcceptance}=require('./signed-acceptance-verification');
async function assessJobActivation({stores,quoteId,evidenceVerifier}={}){
 const quote=await inspectJobRelease({stores,quoteId});
 if(quote.state!=='READY_FOR_EVIDENCE_REVIEW')return {state:'BLOCKED',quote,deposit:null,checks:{canonical_quote:'BLOCKED',financial_evidence:'NOT_CHECKED',signed_acceptance:'NOT_VERIFIED'},writes:[],side_effects:false};
 const [deposit,acceptance]=await Promise.all([inspectDepositEvidence({stores,opportunityId:quote.opportunity_id}),verifySignedAcceptance({stores,quoteId,evidenceVerifier})]);
 return {state:acceptance.state==='SIGNED_ACCEPTANCE_VERIFIED' && deposit.state==='CLEARED_ALLOCATION_EVIDENCED'?'READY_FOR_GOVERNED_AUTHORIZATION':'REVIEW_REQUIRED',quote,deposit,acceptance,checks:{
  canonical_quote:'PASS',
  financial_evidence:deposit.state==='CLEARED_ALLOCATION_EVIDENCED'?'EVIDENCED':'REVIEW_REQUIRED',
  signed_acceptance:acceptance.state==='SIGNED_ACCEPTANCE_VERIFIED'?'VERIFIED':'NOT_VERIFIED'
 },next_action:deposit.state==='CLEARED_ALLOCATION_EVIDENCED'?'Verify signed acceptance against immutable source and authorize release':'Reconcile canonical deposit allocations and acceptance',writes:[],side_effects:false};
}
module.exports={assessJobActivation};
