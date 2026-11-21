'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectOperationalClosure}=require('../processor/operational-closure');
const job={job_id:'JOB-T',opportunity_id:'OPP-T',client_crm_id:'CRM-T',
 property_id:'PROP-T',job_status:'JOB_COMPLETED'};
const execution={'Execution ID':'EX-T','Job ID':'JOB-T','CRM ID':'CRM-T',
 opportunity_id:'OPP-T',invoice_id:'INV-T','Job Status':'COMPLETED',
 'Completion Status':'HANDOVER_COMPLETE','Variation Required':'NO',
 'After Evidence':'test://after','Completion Sign-off':'test://client'};
const cost={direct_cost_id:'COST-T',job_id:'JOB-T',amount:'100',
 financial_treatment:'DIRECT_JOB_COST',allocation_status:'ALLOCATED_TO_JOB',
 evidence_status:'SUPPLIER_INVOICE_EVIDENCED',evidence_link:'test://supplier'};
const margin={margin_record_id:'M-T',job_id:'JOB-T',contract_value_inc_vat:'1000',
 final_cost_status:'FINAL',labour_cost_status:'CONFIRMED',overhead_allocation_status:'PASS'};
const invoice={invoice_id:'INV-T',job_id:'JOB-T',opportunity_id:'OPP-T',
 'Amount (R)':'1000','Invoice Document Status':'ISSUED','Line Control State':'LINE_CONTROL_OK'};
const line={invoice_line_id:'LINE-T',invoice_id:'INV-T',line_status:'CURRENT',
 total_inc_vat:'1000',source_evidence:'test://invoice'};
const allocation={allocation_id:'ALLOC-T',invoice_id:'INV-T',payment_event_id:'PAY-T',
 amount:'1000',allocation_state:'CLEARED',evidence_link:'test://bank'};
const asset={installed_part_id:'INST-T',job_id:'JOB-T',client_id:'CRM-T',
 property_id:'PROP-T',part_id:'PART-T',photo_evidence:'test://install',
 installation_date:'2026-08-01',warranty_start:'2026-08-01',
 warranty_end:'2027-08-01'};
function stores(changes={}){
 const d={
  'Jobs_Opportunities':[job],'Job Execution':[execution],Variations:[],
  'Project Direct Costs':[cost],'Project Cost & Margin':[margin],
  Invoices:[invoice],Invoice_Lines:[line],Payment_Allocations:[allocation],
  Installed_Parts:[asset],...changes
 };
 return {
  crm:{readObjects:async name=>d[name]},
  commercial:{readObjects:async name=>d[name]},
  supplier:{readObjects:async name=>d[name]}
 };
}
const inspect=(changes={})=>inspectOperationalClosure({stores:stores(changes),
 jobId:'JOB-T',asOf:'2026-11-21'});
test('combined lifecycle is only ready for owner review and never closes itself',async()=>{
 const x=await inspect();
 assert.equal(x.state,'READY_FOR_OWNER_CLOSURE_REVIEW');
 assert.equal(x.blockers.length,0);
 assert.equal(x.finance.recorded_balance_zar,0);
 assert.equal(x.aftercare.asset_count,1);
 assert.equal(x.operational_close_authorized,false);
 assert.equal(x.customer_outreach_authorized,false);
 assert.deepEqual(x.writes,[]);
});
test('uncleared payment leaves job closure under review',async()=>{
 const x=await inspect({Payment_Allocations:[{...allocation,allocation_state:'PROOF_RECEIVED'}]});
 assert.equal(x.state,'REVIEW_REQUIRED');
 assert.ok(x.blockers.includes('FINANCE:OUTSTANDING_OR_UNVERIFIED_BALANCE'));
});
test('missing invoice and records cannot be considered closed',async()=>{
 const x=await inspect({'Job Execution':[{...execution,invoice_id:''}]});
 assert.ok(x.blockers.includes('FINAL_INVOICE_ID_MISSING'));
});
test('unresolved variation prevents operational close',async()=>{
 const x=await inspect({
  'Job Execution':[{...execution,'Variation Required':'YES'}],
  Variations:[{'Variation ID':'VAR-T','Job ID':'JOB-T','Approval Status':'DRAFT'}]
 });
 assert.equal(x.state,'REVIEW_REQUIRED');
 assert.ok(x.blockers.some(x=>x.startsWith('FIELD:VARIATION_APPROVAL_UNVERIFIED')));
});
test('installed asset missing blocks aftercare rather than inventing a warranty',async()=>{
 const x=await inspect({Installed_Parts:[]});
 assert.ok(x.blockers.includes('AFTERCARE:NO_INSTALLED_PARTS_IN_CANONICAL_REGISTER'));
});
test('job and invoice identity conflicts fail closed',async()=>{
 const j=await inspect({'Jobs_Opportunities':[job,job]});
 assert.ok(j.blockers.includes('JOB_HEADER_NOT_UNIQUE'));
 const invoiceWrong=await inspect({Invoices:[{...invoice,job_id:'JOB-OTHER'}]});
 assert.ok(invoiceWrong.blockers.includes('FINANCE:INVOICE_JOB_ID_MISMATCH'));
});
