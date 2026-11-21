'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createRuntimeApp}=require('../runtime/app');
const invoice={invoice_id:'INV-A',job_id:'JOB-A',opportunity_id:'OPP-A',
 'Amount (R)':'500','Invoice Document Status':'ISSUED','Line Control State':'LINE_CONTROL_OK'};
const invoiceLine={invoice_line_id:'IL-A',invoice_id:'INV-A',line_status:'CURRENT',
 total_inc_vat:'500',source_evidence:'test://invoice'};
const allocation={allocation_id:'AL-A',invoice_id:'INV-A',payment_event_id:'PAY-A',
 allocation_state:'CLEARED',amount:'500',evidence_link:'test://bank'};
const job={job_id:'JOB-A',client_crm_id:'CRM-A',property_id:'PROP-A',job_status:'JOB_COMPLETED'};
const execution={'Job ID':'JOB-A','Completion Status':'HANDOVER_COMPLETE','Review Status':'REVIEW_REQUEST_NEEDED'};
const asset={installed_part_id:'INST-A',job_id:'JOB-A',client_id:'CRM-A',property_id:'PROP-A',
 part_id:'PART-A',installation_date:'2026-01-01',photo_evidence:'test://installation',
 warranty_start:'2026-01-01',warranty_end:'2027-01-01'};
const stores={
 commercial:{readObjects:async tab=>({
  Invoices:[invoice],Invoice_Lines:[invoiceLine],Payment_Allocations:[allocation],
  'Job Execution':[execution]
 })[tab]},
 crm:{readObjects:async()=>[job]},
 supplier:{readObjects:async()=>[asset]}
};
test('operator financial and aftercare inspections are authenticated and cannot cause writes',async()=>{
 let writes=0;
 const app=createRuntimeApp({
  token:'runtime-key',operatorReadToken:'view-key',
  writerFactory:()=>({stores,execute:async()=>{writes++;throw Error('UNEXPECTED_WRITE')}})
 });
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  for(const path of ['/v1/operator/receivables/INV-A','/v1/operator/aftercare/JOB-A']){
    const unauthorized=await fetch(base+path);
    assert.equal(unauthorized.status,401);
    const authorized=await fetch(base+path,{headers:{'X-MAGOS-Operator-Token':'view-key'}});
    assert.equal(authorized.status,200);
    const data=await authorized.json();
    assert.deepEqual(data.writes,[]);
    assert.equal(data.side_effects,false);
  }
  assert.equal(writes,0);
 }finally{await new Promise(done=>server.close(done));}
});
test('missing source data returns review rather than successful finance status',async()=>{
 const app=createRuntimeApp({token:'rt',operatorReadToken:'read',writerFactory:()=>({
  stores:{commercial:{readObjects:async()=>[]},crm:{readObjects:async()=>[]},
   supplier:{readObjects:async()=>[]}}
 })});
 const server=http.createServer(app);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try {
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/receivables/NONEXIST';
  const res=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'read'}});
  assert.equal(res.status,202);
  const result=await res.json();
  assert.equal(result.state,'REVIEW_REQUIRED');
 }finally{await new Promise(done=>server.close(done));}
});
