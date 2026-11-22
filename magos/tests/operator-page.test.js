'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const {createRuntimeApp}=require('../runtime/app');
const {operatorPage}=require('../runtime/operator-page');
test('operator HTML exposes dashboard structure without embedding secrets or external CDNs',()=>{
 const html=operatorPage();
 assert.match(html,/MAGOS \/ Myriad Green/);
 assert.match(html,/id="queue"/);
 assert.match(html,/src="\/operator\.js"/);
 assert.doesNotMatch(html,/localStorage|sessionStorage|https:\/\//);
 assert.match(html,/id="department"/);
});
test('public browser shell serves zero authoritative data and carries restrictive headers',async()=>{
 const app=createRuntimeApp({token:'test-runtime',writerFactory:()=>{throw Error('MUST_NOT_ACCESS_BUSINESS_DATA')}});
 const server=http.createServer(app);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/operator');
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(res.headers.get('content-security-policy'),/unsafe-inline/);
  const assets=await Promise.all(['/operator.js','/operator.css'].map(path=>fetch('http://127.0.0.1:'+server.address().port+path)));
  assert.deepEqual(assets.map(asset=>asset.status),[200,200]);
  const text=await res.text();
  assert.match(text,/Load live operations/);
  assert.doesNotMatch(text,/test-runtime/);
 }finally{await new Promise(done=>server.close(done));}
});

test('operator browser provides department and record navigation without third-party scripts',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Dispatch & bookings/);
 assert.match(source,/Finance & payments/);
 assert.match(source,/Object\.entries/);
 assert.match(source,/textContent/);
 assert.match(source,/\/v1\/operator\/dashboard/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('operator exposes read-only supplier cost inspection and shows source blockers',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Check supplier receipt and allocation/);
 assert.match(source,/\/v1\/operator\/supplier-cost-allocation\//);
 assert.match(source,/result\.blockers/);
 assert.match(source,/No financial cost released/);
 assert.doesNotMatch(source,/\/v1\/transactions[\s\S]*SUPPLIER_COST_AUTO_APPROVE/);
});

test('Command Centre offers one integrated lifecycle inspection for each linked job',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Inspect full job lifecycle/);
 assert.match(source,/\/v1\/operator\/job-lifecycle\//);
 assert.match(source,/result\.stages/);
 assert.match(source,/result\.next_action/);
 assert.match(source,/Bank settlement and actual completion require independent verification/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('operator presents separate scraper, inbound CRM and provenance review navigation',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Scraper \/ outbound prospects/);
 assert.match(source,/Inbound CRM/);
 assert.match(source,/Provenance review/);
 assert.match(source,/outbound_prospects/);
 assert.match(source,/provenance_review/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('operator frontend renders live capability-backed delivery targets without browser-side guesses',()=>{
 const html=operatorPage();
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(html,/id="delivery"/);
 assert.match(html,/id="delivery-rows"/);
 assert.match(html,/Proposed dates, not delivery promises/);
 assert.match(source,/MAGOS_DELIVERY_ROADMAP_V1/);
 assert.match(source,/roadmap\.milestones/);
 assert.match(source,/item\.target_date/);
 assert.match(source,/item\.blockers/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
