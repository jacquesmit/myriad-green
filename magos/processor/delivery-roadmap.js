'use strict';
// Planning targets are explicitly NOT contractual delivery commitments.
// Actual completion comes from the existing Control Hub and independent
// production acceptance. Never infer deployment from passing source CI.
const TARGETS=Object.freeze([
 {id:'UI-01',label:'Operator frontend usable pilot',
  target_date:'2026-11-25',capability_ids:['CAP-020','CAP-021'],
  acceptance:'Authenticated live dashboard, current deployed SHA, actual CRM and job reads; operator can navigate and act safely'},
 {id:'FLOW-02',label:'Lead-to-accepted-job controlled pilot',
  target_date:'2026-12-04',capability_ids:['CAP-001','CAP-002','CAP-004','CAP-005','CAP-006','CAP-020','CAP-021'],
  acceptance:'Controlled real provider enquiry and signed quote, independently confirmed deposit, P3 job readback and replay'},
 {id:'FIELD-03',label:'Procurement, field delivery and finance pilot',
  target_date:'2026-12-18',capability_ids:['CAP-007','CAP-008','CAP-009','CAP-010','CAP-011','CAP-012'],
  acceptance:'Job demand, supplier GRN, actual field evidence and costs, reconciled invoice and signed closeout'},
 {id:'FULL-04',label:'Whole-business production acceptance candidate',
  target_date:'2027-01-15',capability_ids:Array.from({length:22},(_,i)=>'CAP-'+String(i+1).padStart(3,'0')),
  acceptance:'All 22 capability gates and all 16 whole-system production release gates independently verified'}
]);
const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function buildDeliveryRoadmap({capabilities=[],asOf,targets=TARGETS}={}){
 if(!Array.isArray(capabilities)||!validDay(asOf))
  throw Error('DELIVERY_ROADMAP_SOURCE_UNAVAILABLE');
 const byId=new Map();
 for(const c of capabilities){
  if(!c.id||byId.has(c.id))throw Error('CAPABILITY_ID_MISSING_OR_DUPLICATED');
  byId.set(c.id,c);
 }
 const milestones=targets.map(target=>{
  if(!validDay(target.target_date)||!Array.isArray(target.capability_ids))
   throw Error('INVALID_MILESTONE_TARGET');
  const caps=target.capability_ids.map(id=>byId.get(id));
  const missing=target.capability_ids.filter((id,i)=>!caps[i]);
  const outstanding=target.capability_ids.filter((id,i)=>
   !caps[i]||String(caps[i].state).toUpperCase()!=='PASS');
  const overdue=asOf>target.target_date;
  return {
   id:target.id,label:target.label,target_date:target.target_date,
   target_type:'PROPOSED_PLANNING_TARGET_NOT_COMMITTED',
   state:overdue?'TARGET_MISSED':outstanding.length?'TARGET_OPEN':'SOURCE_GATES_PASSED_LIVE_TEST_REQUIRED',
   capability_count:target.capability_ids.length,
   recorded_pass:target.capability_ids.length-outstanding.length,
   blockers:outstanding,
   missing_sources:missing,
   acceptance:target.acceptance,
   independently_validated:false,
   shipped:false,
   next_action:outstanding.length?
    'Complete and independently verify '+outstanding.slice(0,4).join(', '):
    'Verify actual deployment, provider transactions and production acceptance evidence'
  };
 });
 return {
  schema_version:'MAGOS_DELIVERY_ROADMAP_V1',as_of:asOf,
  targets_approved:false,
  production_rollout_committed:false,
  milestone_completion_source:'CONTROL_HUB_BUSINESS_CAPABILITY_MAP',
  deployment_evidence:'NOT_VERIFIED',
  target_policy:'Dates are proposed planning targets, not promises. Completion requires live release acceptance.',
  counts:{total:milestones.length,missed:milestones.filter(m=>m.state==='TARGET_MISSED').length,
   open:milestones.filter(m=>m.state==='TARGET_OPEN').length,
   validated:0},
  milestones,writes:[],side_effects:false
 };
}
module.exports={TARGETS,buildDeliveryRoadmap};
