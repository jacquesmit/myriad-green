'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { loadOperatorDashboard } = require('../processor/operator-dashboard');
const { createRuntimeApp } = require('../runtime/app');
const { AuditLedger } = require('../adapters/audit-ledger');

const tables = {
  Intake_Queue: [
    { intake_id: 'IN-1', source_event_id: 'same', source_system: 'GMAIL', source_type: 'WEBSITE_FORM', processing_status: 'NEW' },
    { intake_id: 'IN-2', source_event_id: 'same', source_system: 'WEBSITE', source_type: 'WEBSITE_FORM', processing_status: 'NEW' },
  ],
  CRM_Master: [{ crm_id: 'CRM-1', company: 'Example client' }],
  Jobs_Opportunities: [{ opportunity_id: 'DUP', job_id: 'J-1' }, { opportunity_id: 'DUP', job_id: 'J-2' }, { opportunity_id: 'O-1', job_id: 'J-3' }],
  Quotes: [{ quote_id: 'Q-1', 'Quote Status': 'SENT', 'Project / Scope': 'Irrigation' }],
  Bookings: [{ booking_id: 'B-1', appointment_start: '2026-11-12 09:00', mgos_booking_status: 'CONFIRMED', staff_technician: 'Crew A' }],
  'Payment Control': [
    { 'Control ID': 'P-1', 'Contract Value (R)': 2000, 'Deposit Required (R)': 1000, 'Financial Status': 'OPEN', payment_proof_drive_link: 'proof' },
    { 'Control ID': 'P-2', 'Contract Value (R)': 4000, 'Deposit Required (R)': 1000 },
  ],
  Payment_Allocations: [
    { control_id: 'P-1', allocation_id: 'A-1', allocation_state: 'CLEARED', allocation_type: 'DEPOSIT', amount: 500, evidence_link: 'bank' },
    { control_id: 'P-1', allocation_id: 'A-2', allocation_state: 'PROOF_ONLY', allocation_type: 'DEPOSIT', amount: 1000, evidence_link: 'proof' },
    { control_id: 'P-2', allocation_id: 'A-3', allocation_state: 'CLEARED', allocation_type: 'DEPOSIT', amount: 1000 },
  ],
  'Job Execution': [{ 'Execution ID': 'E-1', 'Job ID': 'J-3', 'Completion Sign-off': 'evidence' }],
  Procurement: [],
  Suppliers: [{ supplier_id: 'S-1', supplier_name: 'Example supplier', supplier_approval_state: 'VETTING' }],
  Sync_Exceptions: [],
};
const makeStores = (fail = '') => {
  const readObjects = async (name, options) => {
    assert.equal(options.maxRows, null);
    assert.ok(options.requiredHeaders.length > 0);
    if (name === fail) throw new Error('Register unavailable');
    return tables[name];
  };
  return Object.fromEntries(['crm', 'commercial', 'audit', 'supplier'].map(key => [key, { readObjects }]));
};

test('department dashboard reads canonical registers and quarantines conflicting keys', async () => {
  const result = await loadOperatorDashboard(makeStores());
  assert.equal(result.side_effects, false);
  assert.equal(result.overview_counts.open_leads, 2);
  assert.equal(result.overview_counts.active_jobs, 1);
  assert.equal(result.departments.jobs.state, 'PARTIAL');
  assert.equal(result.departments.jobs.records[0].status, 'REVIEW_REQUIRED');
  assert.equal(result.departments.jobs.records[0].details.job_id, undefined);
  assert.equal(result.departments.dispatch.records[0].details.Crew, 'Crew A');
  assert.equal(result.departments.evidence.records[0].details['Completion sign-off'], 'evidence');
  assert.equal(result.departments.suppliers.records[0].status, 'VETTING');
  assert.ok(result.attention.some(item => item.id === 'DUP'));
});

test('finance shows only cleared allocations and leaves unverified figures unknown', async () => {
  const result = await loadOperatorDashboard(makeStores());
  const [valid, invalid] = result.departments.finance.records;
  assert.equal(valid.details['Cleared deposit (ZAR)'], 500);
  assert.equal(valid.details['Contract balance (ZAR)'], 1500);
  assert.equal(valid.details['Payment proof'], 'proof');
  assert.equal(invalid.status, 'REVIEW_REQUIRED');
  assert.equal(invalid.details['Total cleared receipts (ZAR)'], null);
});

test('register failure is explicit and does not erase healthy departments', async () => {
  const result = await loadOperatorDashboard(makeStores('Payment_Allocations'));
  assert.equal(result.departments.finance.state, 'UNAVAILABLE');
  assert.equal(result.departments.finance.records, undefined);
  assert.equal(result.departments.quotes.state, 'LIVE');
});

test('dashboard uses a dedicated read credential with no access to writer routes', async () => {
  const app = createRuntimeApp({ token: 'writer-secret', operatorReadToken: 'operator-secret',
    writerFactory: () => ({ stores: makeStores() }) });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { 'X-MAGOS-Operator-Token': 'operator-secret' };
    assert.equal((await fetch(base + '/v1/operator/dashboard')).status, 401);
    assert.equal((await fetch(base + '/v1/operator/dashboard', { headers: { 'X-MAGOS-Operator-Token': 'writer-secret' } })).status, 401);
    const dashboard = await fetch(base + '/v1/operator/dashboard', { headers });
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get('cache-control'), 'private, no-store');
    assert.equal((await dashboard.json()).schema_version, 'MAGOS_OPERATOR_DASHBOARD/V1');
    for (const path of ['/v1/transactions', '/v1/events/run', '/v1/probes/google-sheets']) {
      assert.equal((await fetch(base + path, { method: 'POST', headers: {
        ...headers, Authorization: 'Bearer operator-secret',
      } })).status, 401);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('dashboard Sheets reads reject duplicate headers and can include rows past the old limit', async () => {
  const ledger = Object.create(AuditLedger.prototype);
  ledger.spreadsheetId = 'fixture';
  ledger.withSheetsRetry = async (_, read) => read();
  ledger.getHeaders = async () => ({ headers: ['record_id', 'state'] });
  ledger.sheets = { spreadsheets: { values: { get: async request => {
    assert.equal(request.range, "'Queue'!A2:B");
    return { data: { values: Array.from({ length: 1002 }, (_, i) => ['ID-' + i, 'OPEN']) } };
  } } } };
  const rows = await ledger.readObjects('Queue', { maxRows: null, requiredHeaders: ['record_id'] });
  assert.equal(rows.at(-1).record_id, 'ID-1001');
  ledger.getHeaders = async () => ({ headers: ['record_id', 'record_id'] });
  await assert.rejects(ledger.readObjects('Queue', { maxRows: null, requiredHeaders: ['record_id'] }), /Unexpected register schema/);
});

test('CRM separates scraper prospects, inbound enquiries, converted origin and unknown records',async()=>{
 const original=makeStores();
 const examples=[
  {crm_id:'CRM-SCRAPED',company:'Scraped firm',lead_direction:'OUTBOUND',
   record_origin:'SCRAPER',acquisition_source:'OUTBOUND_PROSPECTING'},
  {crm_id:'CRM-INBOUND',company:'Customer enquiry',lead_direction:'INBOUND',
   record_origin:'WHATSAPP_CLIENT_REQUEST',acquisition_source:'INBOUND_WHATSAPP'},
  {crm_id:'CRM-UNKNOWN',company:'Imported quote',lead_direction:'UNKNOWN',
   record_origin:'DRIVE_IMPORT',acquisition_source:'UNKNOWN'},
  {crm_id:'CRM-CONVERTED',company:'Converted prospect',lead_direction:'OUTBOUND',
   record_origin:'SCRAPER',acquisition_source:'OUTBOUND_PROSPECTING',
   job_id:'JOB-VERIFIED',source_evidence:'https://drive.google.com/file/d/PROOF/view'},
  {crm_id:'CRM-LEGACY',company:'Legacy scraper prospect',source_query:'property managers Pretoria',
   google_maps_link:'https://maps.google.com/?cid=123'},
  {crm_id:'CRM-CONFLICT',company:'Contradictory source',lead_direction:'INBOUND',
   record_origin:'SCRAPER',acquisition_source:'OUTBOUND_PROSPECTING'}
 ];
 const stores={...original,crm:{readObjects:async(name,options)=>
   name==='CRM_Master'?examples:original.crm.readObjects(name,options)}};
 const result=await loadOperatorDashboard(stores);
 assert.deepEqual(result.departments.clients.records.map(r=>r.id),['CRM-INBOUND']);
 assert.deepEqual(result.departments.prospects.records.map(r=>r.id),
  ['CRM-SCRAPED','CRM-CONVERTED','CRM-LEGACY']);
 assert.deepEqual(result.departments.provenance.records.map(r=>r.id),
  ['CRM-UNKNOWN','CRM-CONFLICT']);
 assert.equal(result.overview_counts.outbound_prospects,3);
 assert.equal(result.overview_counts.provenance_review,2);
 assert.equal(result.departments.prospects.records[1].details.Provenance,'CONVERTED_OUTBOUND');
 assert.equal(result.departments.provenance.records[1].details.Provenance,'PROVENANCE_REVIEW');
 assert.equal(result.side_effects,false);
});
test('unavailable CRM source does not falsely produce zero outbound prospects',async()=>{
 const result=await loadOperatorDashboard(makeStores('CRM_Master'));
 assert.equal(result.departments.prospects.state,'UNAVAILABLE');
 assert.equal(result.departments.provenance.state,'UNAVAILABLE');
 assert.equal(result.overview_counts.outbound_prospects,undefined);
});

test('explicit website-form origin is inbound but unsupported provenance remains review',async()=>{
 const original=makeStores();
 const rows=[
  {crm_id:'WEB-1',lead_direction:'INBOUND',record_origin:'WEBSITE_FORM',
   acquisition_source:'WEBSITE'},
  {crm_id:'IMPORT-1',lead_direction:'INBOUND',record_origin:'DRIVE_IMPORT',
   acquisition_source:'UNKNOWN'}
 ];
 const stores={...original,crm:{readObjects:async(name,options)=>
  name==='CRM_Master'?rows:original.crm.readObjects(name,options)}};
 const result=await loadOperatorDashboard(stores);
 assert.deepEqual(result.departments.clients.records.map(r=>r.id),['WEB-1']);
 assert.deepEqual(result.departments.provenance.records.map(r=>r.id),['IMPORT-1']);
});

test('conversion source groups are available in existing operator response with actionable exception records',async()=>{
 const baseline=makeStores();
 const clientRows=[
  {crm_id:'C-OUT',company:'Outbound company',lead_direction:'OUTBOUND',
   record_origin:'SCRAPER',acquisition_source:'OUTBOUND_PROSPECTING'},
  {crm_id:'C-IN',company:'Inbound customer',lead_direction:'INBOUND',
   record_origin:'WEBSITE_FORM',acquisition_source:'WEBSITE'}
 ];
 const opportunityRows=[
  {opportunity_id:'OP-OUT',client_crm_id:'C-OUT',job_id:'J-OUT',job_status:'IN_PROGRESS'},
  {opportunity_id:'OP-IN',client_crm_id:'C-IN',job_id:''}
 ];
 const quoteRows=[
  {quote_id:'Q-OUT',opportunity_id:'OP-OUT','Quote Status':'ACCEPTED'},
  {quote_id:'Q-IN',opportunity_id:'OP-IN','Quote Status':'SENT'}
 ];
 const executionRows=[{'Execution ID':'EX-OUT','Job ID':'J-OUT',opportunity_id:'OP-OUT',
  quote_id:'Q-OUT','CRM ID':'C-OUT'}];
 const override={CRM_Master:clientRows,Jobs_Opportunities:opportunityRows,
  Quotes:quoteRows,'Job Execution':executionRows};
 const stores={...baseline,crm:{readObjects:async(name,options)=>
  name in override?override[name]:baseline.crm.readObjects(name,options)},
  commercial:{readObjects:async(name,options)=>
   name in override?override[name]:baseline.commercial.readObjects(name,options)}};
 const report=await loadOperatorDashboard(stores);
 assert.equal(report.departments.conversions.state,'LIVE');
 assert.deepEqual(report.departments.conversions.by_source.map(r=>r.source),
  ['OUTBOUND_SCRAPER','WEBSITE']);
 assert.equal(report.departments.conversions.by_source[0].linked_jobs,1);
 assert.equal(report.overview_counts.attributed_jobs,1);
 assert.equal(report.departments.conversions.records.filter(r=>r.status==='LINKED_JOB').length,1);
 assert.equal(report.side_effects,false);
});
test('every attributed-conversion exception is a selectable Command Centre detail record',async()=>{
 const report=await loadOperatorDashboard(makeStores());
 const items=report.attention.filter(x=>x.department==='conversions');
 assert.ok(items.length>0);
 for(const item of items){
  assert.ok(report.departments.conversions.records.some(row=>row.id===item.id&&
   row.status==='REVIEW_REQUIRED'));
 }
});

test('dashboard flags recorded issued quotes past validity without chasing drafts or changing source rows',async()=>{
 const existing=makeStores();
 const quoteRows=[
  {quote_id:'Q-ELAPSED','Quote Status':'SENT','Valid Until':'2026-11-15',
   'Days Remaining':'999','Next Action':'Call customer'},
  {quote_id:'Q-FUTURE','Quote Status':'SENT','Valid Until':'2026-12-04',
   'Next Action':'Confirm site details'},
  {quote_id:'Q-DRAFT','Quote Status':'TO_CONFIRM','Valid Until':'2026-10-01',
   'Next Action':'Validate canonical pricing'},
  {quote_id:'Q-UNKNOWN','Quote Status':'ISSUED','Valid Until':'bad'}
 ];
 const stores={...existing,commercial:{readObjects:async(name,options)=>
  name==='Quotes'?quoteRows:existing.commercial.readObjects(name,options)}};
 const output=await loadOperatorDashboard(stores,()=>new Date('2026-11-22T07:00:00Z'));
 assert.equal(output.overview_counts.quotes_validity_review,2);
 const records=output.departments.quotes.records;
 assert.equal(records.find(r=>r.id==='Q-ELAPSED').details['Validity review'],'VALIDITY_ELAPSED_REVIEW');
 assert.match(records.find(r=>r.id==='Q-ELAPSED').next_action,/revised valid pricing/);
 assert.equal(records.find(r=>r.id==='Q-DRAFT').details['Validity review'],'NOT_RECORDED_ISSUED');
 assert.equal(records.find(r=>r.id==='Q-FUTURE').details['Validity review'],'WITHIN_RECORDED_VALIDITY');
 const alerted=output.attention.filter(item=>item.type==='QUOTE_EXPIRED_REVIEW');
 assert.deepEqual(alerted.map(item=>item.id),['Q-ELAPSED','Q-UNKNOWN']);
 assert.equal(output.side_effects,false);
 assert.equal(quoteRows[0]['Quote Status'],'SENT');
});

test('Simpro/Fergus variation register enters Command Centre and flags retrospective consent',async()=>{
 const baseline=makeStores();
 const variationRows=[
  {'Variation ID':'VAR-1','Job ID':'JOB-1',Client:'Tank client',
   'Original Scope Ref':'Q-1','New Finding':'Tank dimensions changed',
   'Additional Work':'Alternative tank installed','Cost Impact (R)':'0',
   'Selling Price Impact (R)':'0','Approval Status':'DRAFT',
   'Approval Evidence':'','Execution Status':'WORK_COMPLETED',
   'Drive Evidence':'https://drive.google.com/file/d/evidence/view'},
  {'Variation ID':'VAR-2','Job ID':'JOB-2',Client:'Irrigation client',
   'Original Scope Ref':'Q-2','New Finding':'Extra fittings',
   'Additional Work':'Replace fittings','Cost Impact (R)':'100',
   'Selling Price Impact (R)':'350','Approval Status':'APPROVED',
   'Approval Evidence':'https://drive.google.com/file/d/approval/view',
   'Execution Status':'WORK_COMPLETED','Drive Evidence':'https://drive.google.com/file/d/after/view',
   'Invoice Ref':'INV-2'}
 ];
 const stores={...baseline,commercial:{readObjects:async(name,options)=>
  name==='Variations'?variationRows:baseline.commercial.readObjects(name,options)}};
 const r=await loadOperatorDashboard(stores);
 assert.equal(r.departments.variations.state,'LIVE');
 assert.equal(r.overview_counts.variations_review,1);
 assert.equal(r.overview_counts.retrospective_variations,1);
 assert.ok(r.departments.variations.records.find(x=>x.id==='VAR-1')
  .details.Blockers.includes('RETROSPECTIVE_CLIENT_APPROVAL_REQUIRED'));
 assert.ok(r.attention.some(x=>x.department==='variations'&&x.id==='VAR-1'));
 assert.equal(r.side_effects,false);
});

test('labour economics are visible by job without treating provisional crew days as actuals',async()=>{
 const existing=makeStores();
 const rateRows=[
  {labour_rate_id:'R-1',person_role:'HELPER',rate_basis:'PER_DAY',
   rate:'350',currency:'ZAR',effective_from:'2026-08-02'}
 ];
 const margins=[
  {margin_record_id:'M-1',job_id:'J-1',crew_daily_rate_total:'700',
   crew_days:'2',provisional_labour_cost:'1400'},
  {margin_record_id:'M-2',job_id:'J-2',crew_daily_rate_total:'700',
   crew_days:'2',provisional_labour_cost:'1000'}
 ];
 const stores={...existing,commercial:{readObjects:async(name,options)=>{
  if(name==='Labour Rates')return rateRows;
  if(name==='Project Cost & Margin')return margins;
  return existing.commercial.readObjects(name,options);
 }}};
 const report=await loadOperatorDashboard(stores);
 assert.equal(report.departments.labour.state,'LIVE');
 assert.equal(report.overview_counts.labour_cost_review,2);
 assert.ok(report.departments.labour.records.some(r=>r.id==='J-1'&&
  r.details['Actual labour verified']==='NO'));
 assert.ok(report.attention.some(a=>a.department==='labour'&&a.id==='J-2'));
 assert.equal(report.side_effects,false);
});

test('real Intake_Queue customer RFQ appears in operator inbound and source-linked conversion views',async()=>{
 const baseline=makeStores();
 const client={crm_id:'CRM-R',company:'Filtration client',lead_direction:'INBOUND',
  record_origin:'GMAIL',acquisition_source:'EMAIL'};
 const opportunity={opportunity_id:'OPP-R',client_crm_id:'CRM-R',job_id:''};
 const intake={intake_id:'INT-R',source_system:'GMAIL',source_type:'RFQ',
  source_event_id:'EV-R',match_status:'NEW_RECORD',processing_status:'LINKED',
  matched_crm_id:'CRM-R',matched_opportunity_id:'OPP-R'};
 const override={CRM_Master:[client],Jobs_Opportunities:[opportunity],Intake_Queue:[intake],
  Quotes:[],'Job Execution':[]};
 const stores={...baseline,
  crm:{readObjects:async(name,options)=>name in override?override[name]:baseline.crm.readObjects(name,options)},
  commercial:{readObjects:async(name,options)=>name in override?override[name]:baseline.commercial.readObjects(name,options)}};
 const result=await loadOperatorDashboard(stores);
 assert.equal(result.overview_counts.open_leads,1);
 assert.equal(result.departments.leads.records[0].id,'INT-R');
 assert.equal(result.overview_counts.inbound_linked_opportunities,1);
 assert.equal(result.side_effects,false);
});
