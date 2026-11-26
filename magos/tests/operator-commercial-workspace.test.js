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
