'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {retrieveArticle}=require('./water-alert-source-verifier');
for(const id of ['108870','108857']){
 test('official REST fallback '+id,async()=>{
  const url=new URL('https://www.tshwane.gov.za/?p='+id);
  const n={provider:'CITY_OF_TSHWANE',source_event_id:id};
  const calls=[];
  const result=await retrieveArticle(url,n,async u=>{
   calls.push(u);
   if(calls.length===1)throw new Error('simulated timeout');
   return new Response(JSON.stringify({id:Number(id),status:'publish',type:'post',link:url.href,title:{rendered:'Fixture title'},content:{rendered:'<p>Fixture only</p>'}}),{headers:{'content-type':'application/json'}});
  });
  assert.equal(calls.length,2);
  assert.match(result.html,/Fixture only/);
  assert.equal(result.attempts.length,1);
 });
}
test('wrong REST event cannot pass',async()=>{
 const url=new URL('https://www.tshwane.gov.za/?p=108870');
 const result=await retrieveArticle(url,{provider:'CITY_OF_TSHWANE',source_event_id:'108870'},async u=>{
  if(u===url.href)throw Error('timeout');
  return new Response(JSON.stringify({id:108857,status:'publish',type:'post',link:url.href,title:{rendered:'Wrong'},content:{rendered:'Wrong'}}),{headers:{'content-type':'application/json'}});
 });
 assert.equal(result.html,undefined);
 assert.equal(result.attempts.length,4);
});
