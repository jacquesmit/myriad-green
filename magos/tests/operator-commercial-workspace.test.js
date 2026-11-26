'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
test('commercial workspace frontend parses and uses existing authenticated read paths',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 const start=source.indexOf('  async function inspectCommercialWorkspace(');
 const end=source.indexOf('  async function inspectQuote(',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 assert.match(block,/read\(path,active.signal\)/);
 assert.match(block,/job-activation\//);
 assert.match(block,/deposit-evidence\//);
 assert.match(block,/result.side_effects!==false/);
 assert.match(block,/Independent bank clearance is not established/);
 assert.match(block,/No job, booking or payment changes performed/);
 assert.doesNotMatch(block,/method:\s*['"]POST|innerHTML|localStorage/);
});

test('job release control uses separate authority, exact identifiers and mandatory preview',()=>{
 const start=source.indexOf('  function buildJobReleaseControls(');
 const end=source.indexOf('  async function inspectCommercialWorkspace(',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 assert.match(block,/previewed!==key/);
 assert.match(block,/x-magos-job-token/);
 assert.match(block,/JSON.stringify\(\{quoteId,jobId,sourceEventId,dryRun\}\)/);
 assert.match(block,/fields.token.value=''/);
 assert.match(block,/result.readback\?\.verified===true/);
 assert.match(block,/window.confirm/);
 assert.doesNotMatch(block,/localStorage|innerHTML/);
});

test('delivery workspace reads four existing endpoints, retains partial evidence and separates execution authority',()=>{
 const start=source.indexOf('  async function inspectDeliveryWorkspace('),end=source.indexOf('  function buildProcurementDraftControls(',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 for(const path of ['job-lifecycle','scheduling-readiness','job-closeout','operational-closure'])assert.ok(block.includes(path));
 assert.match(block,/report.job_id!==jobId/);
 assert.match(block,/report.side_effects!==false/);
 assert.match(block,/UNAVAILABLE \/ NOT VERIFIED/);
 assert.doesNotMatch(block,/method:\s*['"]POST/);
});
test('procurement draft requires unchanged preview and scoped authority',()=>{
 const start=source.indexOf('  function buildProcurementDraftControls('),end=source.indexOf('  function buildJobReleaseControls(',start);
 assert.ok(start>=0&&end>start);
 const block=source.slice(start,end);
 assert.match(block,/approvedPreview!==key/);
 assert.match(block,/x-magos-procurement-token/);
 assert.match(block,/result.external_order_sent===false/);
 assert.match(block,/result.payment_authorized===false/);
 assert.match(block,/fields.token.value=''/);
 assert.match(block,/window.confirm/);
 assert.doesNotMatch(block,/localStorage|innerHTML/);
});
