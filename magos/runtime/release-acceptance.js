'use strict';
// Single release acceptance gate: no production writes and no secret output.
require('dotenv').config();
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const base=String(process.env.MAGOS_RUNTIME_URL||'https://runtime.myriadgreen.co.za').replace(/\/$/,'');
const token=process.env.MAGOS_RUNTIME_TOKEN||'';
const checks=[];
function record(name,state,detail){checks.push({name,state,detail});}
async function request(path,authorization=false){
 const response=await fetch(base+path,{headers:authorization?{authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000),cache:'no-store'});
 return response;
}
async function main(){
 const testFiles=fs.readdirSync('tests').filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/'+name);
 const tests=spawnSync(process.execPath,['--test',...testFiles],{cwd:process.cwd(),encoding:'utf8',timeout:180000,maxBuffer:5*1024*1024});
 const output=(tests.stdout||'')+'\n'+(tests.stderr||'');
 const result=output.match(/(?:^|\n)ℹ pass (\d+)/),fails=output.match(/(?:^|\n)ℹ fail (\d+)/);
 record('FULL_CODE_SUITE',tests.status===0&&Number(fails?.[1])===0&&Number(result?.[1])>0?'PASS':'FAIL',{passed:Number(result?.[1]||0),failed:Number(fails?.[1]||0),exit:tests.status});
 for(const path of ['/healthz','/readyz','/operator']){
  try{const response=await request(path);record('LIVE_'+path,response.status===200?'PASS':'FAIL',{http:response.status});}
  catch(error){record('LIVE_'+path,'BLOCKED',{reason:error.name||'NETWORK_ERROR'});}
 }
 if(!token){record('CANONICAL_SNAPSHOT','BLOCKED',{reason:'MAGOS_RUNTIME_TOKEN_NOT_IN_PROCESS_ENV'});}
 else{
  try{
   const response=await request('/v1/operator/snapshot',true);
   if(response.status!==200)record('CANONICAL_SNAPSHOT','FAIL',{http:response.status});
   else{
    const data=await response.json();
    const expected=['open_leads','pending_quotes','active_jobs','procurement_review','open_exceptions'];
    const ok=data.authority==='READ_ONLY_DERIVED'&&expected.every(k=>Number.isInteger(data.counts?.[k])&&data.counts[k]>=0);
    record('CANONICAL_SNAPSHOT',ok?'PASS':'FAIL',{schema_version:data.schema_version,authority:data.authority,counts:ok?data.counts:'INVALID'});
   }
  }catch(error){record('CANONICAL_SNAPSHOT','BLOCKED',{reason:error.name||'READ_ERROR'});}
 }
 const verdict=checks.some(x=>x.state==='FAIL')?'FAIL':checks.some(x=>x.state==='BLOCKED')?'BLOCKED':'PASS';
 const report={release:'MAGOS_INTEGRATED_ACCEPTANCE_V1',commit:spawnSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).stdout?.trim()||'UNKNOWN',verdict,checks,scope:'READ_ONLY_ACCEPTANCE_NO_PRODUCTION_TRANSACTIONS',generated_at:new Date().toISOString()};
 fs.mkdirSync('tmp',{recursive:true});
 fs.writeFileSync('tmp/magos-release-acceptance.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report,null,2));
 process.exitCode=verdict==='PASS'?0:1;
}
main().catch(error=>{console.error(JSON.stringify({verdict:'FAIL',reason:error.message}));process.exitCode=1;});
