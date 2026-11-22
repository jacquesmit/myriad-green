'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {inspectAttributedConversions}=require('../processor/attributed-conversions');
const {createRuntimeApp}=require('../runtime/app');
const crm=[
 {crm_id:'C-S',lead_direction:'OUTBOUND',record_origin:'SCRAPER',acquisition_source:'OUTBOUND_PROSPECTING'},
 {crm_id:'C-W',lead_direction:'INBOUND',record_origin:'WEBSITE_FORM',acquisition_source:'WEBSITE'},
 {crm_id:'C-X',lead_direction:'UNKNOWN',record_origin:'DRIVE_IMPORT',acquisition_source:'UNKNOWN'}
];
const opp=[
 {opportunity_id:'O-S',client_crm_id:'C-S',job_id:'JOB-S'},
 {opportunity_id:'O-W',client_crm_id:'C-W',job_id:''},
 {opportunity_id:'O-X',client_crm_id:'C-X',job_id:''}
];
const quotes=[
 {quote_id:'Q-S',opportunity_id:'O-S','Quote Status':'ACCEPTED'},
 {quote_id:'Q-W',opportunity_id:'O-W','Quote Status':'SENT'}
];
const executions=[
 {'Execution ID':'E-S','Job ID':'JOB-S',quote_id:'Q-S',opportunity_id:'O-S','CRM ID':'C-S'}
];
const input=()=>({clients:crm.map(x=>({...x})),opportunities:opp.map(x=>({...x})),
 quotes:quotes.map(x=>({...x})),executions:executions.map(x=>({...x}))});
test('canonical funnel separates outbound conversion, inbound quote and unknown origin',()=>{
 const result=inspectAttributedConversions(input());
 assert.equal(result.state,'READ_ONLY_ATTRIBUTION');
 assert.deepEqual(result.counts,{opportunities:3,quoted:2,accepted:1,linked_jobs:1,source_exceptions:0,inbound_linked_opportunities:0});
 assert.equal(result.records.find(r=>r.id==='O-S').source,'OUTBOUND_SCRAPER');
 assert.equal(result.records.find(r=>r.id==='O-S').linked_job,true);
 assert.equal(result.records.find(r=>r.id==='O-W').source,'WEBSITE');
 assert.equal(result.records.find(r=>r.id==='O-X').source,'UNKNOWN');
 assert.equal(result.by_source.find(r=>r.source==='OUTBOUND_SCRAPER').linked_jobs,1);
 assert.equal(result.payment_authorized,false);
 assert.equal(result.revenue_verified,false);
 assert.deepEqual(result.writes,[]);
});
test('scraped CRM contact with no opportunity never inflates lead-to-job conversion',()=>{
 const data=input();
 data.clients.push({crm_id:'C-UNCONTACTED',lead_direction:'OUTBOUND',record_origin:'SCRAPER'});
 const r=inspectAttributedConversions(data);
 assert.equal(r.counts.opportunities,3);
 assert.equal(r.counts.linked_jobs,1);
});
test('wrong CRM account or quote linkage prevents a counted job',()=>{
 for(const wrong of [
  {type:'crm',value:'OTHER'},
  {type:'quote',value:'Q-OTHER'},
  {type:'opportunity',value:'O-OTHER'}
 ]){
  const data=input();
  if(wrong.type==='crm')data.executions[0]['CRM ID']=wrong.value;
  if(wrong.type==='quote')data.executions[0].quote_id=wrong.value;
  if(wrong.type==='opportunity')data.executions[0].opportunity_id=wrong.value;
  const r=inspectAttributedConversions(data);
  assert.equal(r.counts.linked_jobs,0);
  assert.equal(r.state,'REVIEW_REQUIRED');
  assert.ok(r.exceptions.includes('JOB_LINK_UNVERIFIED:O-S'));
 }
});
test('duplicate canonical IDs and reused job ID do not double count',()=>{
 const data=input();
 data.opportunities.push({opportunity_id:'O-OTHER',client_crm_id:'C-W',job_id:'JOB-S'});
 const r=inspectAttributedConversions(data);
 assert.equal(r.counts.linked_jobs,0);
 assert.ok(r.exceptions.includes('JOB_ID_REUSED_ACROSS_OPPORTUNITIES:JOB-S'));
 const duplicates=input();
 duplicates.clients.push({...duplicates.clients[0]});
 const d=inspectAttributedConversions(duplicates);
 assert.equal(d.counts.linked_jobs,0);
 assert.ok(d.exceptions.some(x=>x.startsWith('DUPLICATE_crm_id:')));
});
test('source errors do not become fake zero-conversion report',()=>{
 const r=inspectAttributedConversions({clients:crm,opportunities:opp,quotes,executions:null});
 assert.equal(r.state,'UNAVAILABLE');assert.equal(r.counts,undefined);
});
test('operator dashboard has protected conversion output with zero writer calls',async()=>{
 const sheets={CRM_Master:crm,Jobs_Opportunities:opp,Quotes:quotes,'Job Execution':executions,
 Intake_Queue:[],Bookings:[],'Payment Control':[],Payment_Allocations:[],Procurement:[],
 Suppliers:[],Sync_Exceptions:[]};
 let writes=0;
 const stores=Object.fromEntries(['crm','commercial','supplier','audit'].map(k=>[k,{
  readObjects:async name=>sheets[name]||[]
 }]));
 const app=createRuntimeApp({token:'runtime',operatorReadToken:'viewer',
  writerFactory:()=>({stores,execute:async()=>{writes++;throw Error('WRITER_CALLED')}})});
 const server=http.createServer(app);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/operator/dashboard';
  assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'viewer'}});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.overview_counts.attributed_jobs,1);
  assert.equal(data.departments.conversions.records.length,3);
  assert.equal(data.departments.conversions.by_source.length,3);
  assert.equal(writes,0);
 }finally{await new Promise(ok=>server.close(ok));}
});

test('matched inbound intake events link separately from original scraped acquisition',()=>{
 const data=input();
 data.intakes=[
  {source_system:'WHATSAPP',source_type:'LEAD',source_event_id:'CONTACT-1',
   matched_crm_id:'C-S',matched_opportunity_id:'O-S',processing_status:'CLOSED'},
  {source_system:'WORDPRESS',source_type:'WEBSITE_FORM',source_event_id:'WEB-1',
   matched_crm_id:'C-W',matched_opportunity_id:'O-W',processing_status:'LINKED'}
 ];
 const r=inspectAttributedConversions(data);
 assert.equal(r.counts.inbound_linked_opportunities,2);
 assert.equal(r.records.find(row=>row.id==='O-S').source,'OUTBOUND_SCRAPER');
 assert.equal(r.records.find(row=>row.id==='O-S').inbound_link_state,'MATCHED');
 assert.equal(r.records.find(row=>row.id==='O-S').matched_inbound_events,1);
 assert.equal(r.records.find(row=>row.id==='O-W').matched_inbound_events,1);
 assert.equal(r.counts.linked_jobs,1);
});
test('duplicate inbound event or incorrect CRM does not create a verified customer conversion',()=>{
 const data=input();
 data.intakes=[
  {source_system:'WORDPRESS',source_type:'WEBSITE_FORM',source_event_id:'FORM-1',
   matched_crm_id:'C-W',matched_opportunity_id:'O-W'},
  {source_system:'WORDPRESS',source_type:'WEBSITE_FORM',source_event_id:'FORM-1',
   matched_crm_id:'C-X',matched_opportunity_id:'O-W'},
  {source_system:'GMAIL',source_type:'LEAD',source_event_id:'MAIL-1',
   matched_crm_id:'WRONG',matched_opportunity_id:'O-S'}
 ];
 const r=inspectAttributedConversions(data);
 assert.equal(r.counts.inbound_linked_opportunities,0);
 assert.equal(r.state,'REVIEW_REQUIRED');
 assert.ok(r.exceptions.some(reason=>reason.startsWith('DUPLICATE_INBOUND_SOURCE_EVENT')));
 assert.ok(r.exceptions.includes('INBOUND_CLIENT_LINK_CONFLICT:O-S'));
});
test('scraper events, generic unknown leads and supplier RFQs never produce inbound links',()=>{
 const data=input();
 data.intakes=[
  {source_system:'SCRAPER',source_type:'LEAD',source_event_id:'S1',
   matched_crm_id:'C-S',matched_opportunity_id:'O-S'},
  {source_system:'UNKNOWN',source_type:'LEAD',source_event_id:'U1',
   matched_crm_id:'C-W',matched_opportunity_id:'O-W'},
  {source_system:'GMAIL',source_type:'RFQ',source_event_id:'R1',
   matched_crm_id:'C-W',matched_opportunity_id:'O-W'}
 ];
 const r=inspectAttributedConversions(data);
 assert.equal(r.counts.inbound_linked_opportunities,0);
 assert.equal(r.counts.linked_jobs,1);
});

test('canonical linked customer RFQ joins to one real inbound opportunity without supplier leakage',()=>{
 const d=input();
 d.intakes=[{
  intake_id:'INT-CUSTOMER',source_system:'GMAIL',source_type:'RFQ',
  source_event_id:'MAIL-CUSTOMER',match_status:'NEW_RECORD',
  processing_status:'LINKED',matched_crm_id:'C-W',matched_opportunity_id:'O-W'
 },{
  intake_id:'INT-SUPPLIER',source_system:'GMAIL',source_type:'RFQ',
  source_event_id:'MAIL-SUPPLIER',match_status:'NEW_RECORD',
  processing_status:'LINKED',supplier_id:'SUP-1',
  matched_crm_id:'C-S',matched_opportunity_id:'O-S'
 }];
 const r=inspectAttributedConversions(d);
 assert.equal(r.counts.inbound_linked_opportunities,1);
 assert.equal(r.records.find(x=>x.id==='O-W').matched_inbound_events,1);
 assert.equal(r.records.find(x=>x.id==='O-S').matched_inbound_events,0);
 assert.equal(r.records.find(x=>x.id==='O-S').source,'OUTBOUND_SCRAPER');
 assert.deepEqual(r.writes,[]);
});
