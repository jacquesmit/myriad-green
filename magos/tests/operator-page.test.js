'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createRuntimeApp}=require('../runtime/app');
const {operatorPage}=require('../runtime/operator-page');
test('operator HTML exposes dashboard structure without embedding secrets or external CDNs',()=>{
 const html=operatorPage();
 assert.match(html,/MAGOS \/ Myriad Green/);
 assert.match(html,/id="queue"/);
 assert.match(html,/\/v1\/operator\/snapshot/);
 assert.doesNotMatch(html,/localStorage|sessionStorage|https:\/\//);
 assert.match(html,/textContent/);
});
test('public browser shell serves zero authoritative data and carries restrictive headers',async()=>{
 const app=createRuntimeApp({token:'test-runtime',writerFactory:()=>{throw Error('MUST_NOT_ACCESS_BUSINESS_DATA')}});
 const server=http.createServer(app);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/operator');
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.equal(res.headers.get('cache-control'),'no-store');
  const text=await res.text();
  assert.match(text,/Load live operations/);
  assert.doesNotMatch(text,/test-runtime/);
 }finally{await new Promise(done=>server.close(done));}
});
