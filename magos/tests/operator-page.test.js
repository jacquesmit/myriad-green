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

test('operator deployment fingerprint is independent of privileged writer auth',async()=>{
 const sha='a'.repeat(40),other='b'.repeat(40);
 const make=(startup,declared)=>createRuntimeApp({
  token:'runtime-private',operatorReadToken:'operator-read',
  deployedCommitSha:declared,startupGitStateReader:()=>startup,
  writerFactory:()=>{throw Error('DEPLOYMENT_MUST_NOT_READ_BUSINESS_DATA')}
 });
 for(const [state,declared,status,expected] of [
  [{sha,dirty:false},sha,200,'PROCESS_START_GIT_MATCH'],
  [{sha:other,dirty:false},sha,202,'NOT_VERIFIED'],
  [{sha,dirty:true},sha,202,'NOT_VERIFIED'],
  [{sha,dirty:false},undefined,202,'NOT_VERIFIED']
 ]){
  const server=http.createServer(make(state,declared));
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try{
   const url='http://127.0.0.1:'+server.address().port+'/v1/operator/deployment';
   assert.equal((await fetch(url)).status,401);
   const denied=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'runtime-private'}});
   assert.equal(denied.status,401);
   const response=await fetch(url,{headers:{'X-MAGOS-Operator-Token':'operator-read'}});
   assert.equal(response.status,status);
   const result=await response.json();
   assert.equal(result.status,expected);
   assert.equal(result.commit_sha,status===200?sha:null);
   assert.equal(result.production_complete,false);
   assert.equal(result.production_business_acceptance,'NOT_VERIFIED');
   assert.deepEqual(result.writes,[]);
  }finally{await new Promise(done=>server.close(done));}
 }
});
test('operator frontend shows fingerprint after unlock and clears it on lock',()=>{
 const html=operatorPage();
 const script=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(html,/id="deployment"/);
 assert.match(script,/\/v1\/operator\/deployment/);
 assert.match(script,/void loadDeploymentIdentity\(\)/);
 assert.match(script,/\$\('deployment'\)\.textContent='Deployed code: not yet verified'/);
 assert.match(script,/live business acceptance still pending/);
 assert.doesNotMatch(script,/localStorage|sessionStorage/);
});

test('lead-to-job funnel is visible in existing Command Centre with source drilldown and no revenue assertion',()=>{
 const html=operatorPage();
 const script=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(html,/id="conversion-funnel"/);
 assert.match(html,/id="conversion-funnel-rows"/);
 assert.match(html,/Acquisition source to job/);
 assert.match(html,/Not collected revenue or proven profit/);
 assert.match(script,/function renderConversionFunnel\(/);
 assert.match(script,/workspace\.by_source/);
 assert.match(script,/group\.linked_jobs/);
 assert.match(script,/renderConversionFunnel\(\)/);
 assert.match(script,/Canonical sources unavailable/);
 assert.match(script,/\$\('search'\)\.value=sourceName/);
 assert.doesNotMatch(script,/localStorage|sessionStorage/);
});

test('frontend prioritizes real quote validity review without automatic client sending',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Quote validity review/);
 assert.match(source,/QUOTE_EXPIRED_REVIEW/);
 assert.match(source,/No automatic sending/);
 assert.doesNotMatch(source,/AUTOMATIC_QUOTE_SEND/);
});

test('frontend includes scope variation review and retains independent job closeout gates',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Scope variations/);
 assert.match(source,/Variations to resolve/);
 assert.match(source,/VARIATION_REVIEW/);
 assert.match(source,/Simpro\/Fergus benchmark/);
 assert.match(source,/Inspect complete job closure/);
});

test('job details link directly to the existing scoped variation workspace',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/View job scope variations/);
 assert.match(source,/show\('variations',item\.details\.job_id\)/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('operator navigation exposes Aspire/LMN labour cost review without false final profit',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Labour cost review/);
 assert.match(source,/Labour to reconcile/);
 assert.match(source,/Actual timesheets not independently verified/);
});

test('real frontend renders read-only related work shortcuts using server-derived exact record links',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 const css=fs.readFileSync(require.resolve('../runtime/operator.css'),'utf8');
 assert.match(source,/Related MAGOS work/);
 assert.match(source,/item\.related/);
 assert.match(source,/show\(targetRecord\.department,targetRecord\.id\)/);
 assert.match(source,/data\?\.departments\?\.\[targetRecord\.department\]/);
 assert.match(css,/\.related-actions/);
 assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('completed job history remains discoverable alongside separate active job KPI',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Jobs on record/);
 assert.match(source,/including completed and historical work/);
 assert.match(source,/Active jobs KPI excludes completed and cancelled jobs/);
 assert.match(source,/Inspect complete job closure/);
});

test('quote details offer real client signing readiness without issuing a client link',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/Check client signing readiness/);
 assert.match(source,/client-signing-readiness/);
 assert.match(source,/READY_FOR_CONTROLLED_SIGNING_TEST/);
 assert.match(source,/Live customer signing, approval and quote-version verification still require controlled testing/);
});


test('operator refresh invalidates cached coverage and reloads selected capability workspace',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/data = result;\s*coverageRequest\?\.abort\(\);\s*coverageRequest = undefined;\s*coverage = undefined;/);
 assert.match(source,/if\(coverageView\(department\)\)void loadCoverage\(\);/);
});
test('operator deployment identity ignores superseded responses and aborts on lock',()=>{
 const source=fs.readFileSync(require.resolve('../runtime/operator.js'),'utf8');
 assert.match(source,/deploymentRequest=active/);
 assert.match(source,/if\(deploymentRequest!==active\|\|!authorized\(\)\)return;/);
 assert.match(source,/deploymentRequest\?\.abort\(\);\s*deploymentRequest = undefined;/);
});
