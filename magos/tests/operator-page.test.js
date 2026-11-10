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
