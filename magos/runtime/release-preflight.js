'use strict';
const {execFileSync}=require('node:child_process');
const path=require('node:path');

function localCheckout(root=path.resolve(__dirname,'../..')){
 const git=(...args)=>execFileSync('git',['-C',root,...args],{
  encoding:'utf8',timeout:8000,stdio:['ignore','pipe','ignore']
 }).trim();
 return {sha:git('rev-parse','HEAD'),dirty:!!git('status','--porcelain','--untracked-files=no')};
}
async function releasePreflight({expectedSha,baseUrl,runtimeToken,operatorToken,
 gitReader=localCheckout,request=globalThis.fetch}={}){
 const checks=[],add=(name,pass,reason='')=>checks.push({name,state:pass?'PASS':'FAIL',reason});
 if(!/^[a-f0-9]{40}$/i.test(String(expectedSha||''))) {
  return {schema_version:'MAGOS_RELEASE_PREFLIGHT_V1',ready:false,
   checks:[{name:'EXPECTED_SHA',state:'FAIL',reason:'EXPECTED_FULL_COMMIT_SHA_REQUIRED'}],
   site_complete:false};
 }
 if(!/^https:\/\/[^\s/]+(?:\/[^?#]*)?$/i.test(String(baseUrl||''))) {
  return {schema_version:'MAGOS_RELEASE_PREFLIGHT_V1',ready:false,
   checks:[{name:'RUNTIME_URL',state:'FAIL',reason:'HTTPS_RUNTIME_URL_REQUIRED'}],
   site_complete:false};
 }
 if(!runtimeToken||!operatorToken||runtimeToken===operatorToken){
  return {schema_version:'MAGOS_RELEASE_PREFLIGHT_V1',ready:false,
   checks:[{name:'CREDENTIAL_ISOLATION',state:'FAIL',reason:'DISTINCT_RUNTIME_AND_OPERATOR_TOKENS_REQUIRED'}],
   site_complete:false};
 }
 let checkout;
 try {
  checkout=gitReader();
  add('HOST_CHECKOUT_SHA',String(checkout.sha).toLowerCase()===expectedSha.toLowerCase(),
      'HOST_CHECKOUT_MUST_MATCH_EXPECTED_SHA');
  add('TRACKED_WORKTREE_CLEAN',checkout.dirty===false,'UNCOMMITTED_HOST_CHANGES');
 }catch{
  add('HOST_CHECKOUT_SHA',false,'HOST_GIT_CHECK_FAILED');
 }
 const base=String(baseUrl).replace(/\/$/,'');
 async function read(name,endpoint,{method='GET',token=runtimeToken,header='authorization'}={}){
  try{
   const headers=header==='authorization'?{authorization:'Bearer '+token}:
    {'X-MAGOS-Operator-Token':token};
   const response=await request(base+endpoint,{
    method,headers,redirect:'error',signal:AbortSignal.timeout(12000),
    ...(method==='POST'?{body:'{}'}:{})
   });
   const data=await response.json();
   return {response,data};
  }catch{return {response:null,data:null};}
 }
 const health=await read('HEALTH','/healthz');
 add('HEALTH',health.response?.status===200&&health.data?.status==='ok','HEALTH_NOT_OK');
 const ready=await read('READY','/readyz');
 add('READY',ready.response?.status===200&&ready.data?.status==='ready','RUNTIME_NOT_READY');
 const build=await read('PROCESS_BUILD','/v1/runtime/build');
 add('RUNNING_WORKER_SHA',build.response?.status===200 &&
  build.data?.schema_version==='MAGOS_RUNTIME_BUILD_V1' &&
  build.data?.commit_sha===expectedSha.toLowerCase() &&
  build.data?.checkout_sha_at_process_start===expectedSha.toLowerCase() &&
  build.data?.tracked_worktree_clean_at_start===true &&
  build.data?.status==='GIT_CHECKOUT_AND_DEPLOY_DECLARATION_MATCH',
  'RUNNING_WORKER_SHA_NOT_VERIFIED');
 const source=await read('AUDIT_SOURCE','/v1/probes/google-sheets',{method:'POST'});
 add('AUDIT_SOURCE',source.response?.status===200&&
  source.data?.google_sheets==='reachable'&&source.data?.audit_store==='reachable',
  'AUDIT_SOURCE_UNAVAILABLE');
 const workflows=await read('WORKFLOW_CATALOG','/v1/workflows');
 add('WORKFLOW_CATALOG',workflows.response?.status===200 &&
  workflows.data?.schema_version==='MAGOS_WORKFLOW_CATALOG_V1' &&
  Array.isArray(workflows.data.workflows),'WORKFLOW_CATALOG_UNAVAILABLE');
 const coverage=await read('WHOLE_MAGOS_COVERAGE','/v1/operator/coverage',{
  token:operatorToken,header:'X-MAGOS-Operator-Token'
 });
 add('CANONICAL_COVERAGE',coverage.response?.status===200 &&
  coverage.data?.schema_version==='MAGOS_SYSTEM_COVERAGE_V1' &&
  coverage.data?.side_effects===false &&
  coverage.data?.counts?.total>=1,'CANONICAL_COVERAGE_UNAVAILABLE');
 // A green health endpoint and a served browser shell are not evidence that
 // the owner can use the deployed Command Centre. Verify the browser contract,
 // exact operator process fingerprint, protected data, and real source records.
 async function readPublicText(endpoint){
  try{
   const response=await request(base+endpoint,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(12000)
   });
   return {status:response.status,body:await response.text()};
  }catch{return {status:null,body:''};}
 }
 const [shell,script,style]=await Promise.all([
  readPublicText('/operator'),readPublicText('/operator.js'),
  readPublicText('/operator.css')
 ]);
 add('OPERATOR_BROWSER_SHELL',shell.status===200 &&
  shell.body.includes('id="login"') &&
  shell.body.includes('id="filters"') &&
  shell.body.includes('id="queue"') &&
  shell.body.includes('id="department"') &&
  shell.body.includes('id="deployment"') &&
  shell.body.includes('src="/operator.js"') &&
  shell.body.includes('href="/operator.css"'),
  'OPERATOR_HTML_INCOMPLETE_OR_UNAVAILABLE');
 add('OPERATOR_BROWSER_ASSETS',script.status===200&&
  script.body.includes('/v1/operator/dashboard')&&
  script.body.includes('renderView')&&
  style.status===200&&style.body.includes('.workspace'),
  'OPERATOR_JS_OR_CSS_UNAVAILABLE');
 const operatorBuild=await read('OPERATOR_DEPLOYMENT','/v1/operator/deployment',{
  token:operatorToken,header:'X-MAGOS-Operator-Token'
 });
 add('OPERATOR_DEPLOYMENT_IDENTITY',operatorBuild.response?.status===200&&
  operatorBuild.data?.schema_version==='MAGOS_OPERATOR_DEPLOYMENT_V1'&&
  operatorBuild.data?.status==='PROCESS_START_GIT_MATCH'&&
  operatorBuild.data?.commit_sha===expectedSha.toLowerCase()&&
  operatorBuild.data?.production_complete===false&&
  operatorBuild.data?.side_effects===false,
  'OPERATOR_VISIBLE_DEPLOYMENT_SHA_NOT_VERIFIED');
 let anonymousStatus=null,writerCredentialStatus=null;
 try {
  const response=await request(base+'/v1/operator/dashboard',{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(12000)
  });
  anonymousStatus=response.status;
 }catch{}
 try {
  const response=await request(base+'/v1/operator/dashboard',{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
   headers:{'X-MAGOS-Operator-Token':runtimeToken}
  });
  writerCredentialStatus=response.status;
 }catch{}
 add('OPERATOR_AUTH_ISOLATION',anonymousStatus===401&&writerCredentialStatus===401,
  'OPERATOR_DASHBOARD_AUTH_NOT_ISOLATED');
 const dashboard=await read('OPERATOR_DATA','/v1/operator/dashboard',{
  token:operatorToken,header:'X-MAGOS-Operator-Token'
 });
 const departments=dashboard.data?.departments;
 const core=['clients','jobs','quotes'];
 const healthy=departments&&core.every(name=>
  ['LIVE','PARTIAL'].includes(departments[name]?.state)&&
  Array.isArray(departments[name]?.records));
 const sourceRows=healthy?core.reduce((sum,name)=>
  sum+departments[name].records.filter(row=>
   typeof row.id==='string'&&row.id.length>0&&
   typeof row.status==='string'&&row.status.length>0).length,0):0;
 add('OPERATOR_CANONICAL_RECORDS',dashboard.response?.status===200&&
  dashboard.data?.schema_version==='MAGOS_OPERATOR_DASHBOARD/V1'&&
  dashboard.data?.side_effects===false&&healthy&&sourceRows>0,
  'OPERATOR_CORE_REGISTERS_OR_RECORDS_UNAVAILABLE');

 return {
  schema_version:'MAGOS_RELEASE_PREFLIGHT_V1',
  expected_commit_sha:expectedSha.toLowerCase(),
  ready:checks.every(check=>check.state==='PASS'),
  checks,
  capability_counts:coverage.data?.counts||null,
  operator_core_record_count:sourceRows,
  site_complete:coverage.data?.production_complete===true,
  production_business_acceptance_verified:false,
  write_side_effects:false
 };
}
if(require.main===module){
 const result=releasePreflight({
  expectedSha:process.env.MAGOS_EXPECTED_GIT_SHA,
  baseUrl:process.env.MAGOS_RUNTIME_URL,
  runtimeToken:process.env.MAGOS_RUNTIME_TOKEN,
  operatorToken:process.env.MAGOS_OPERATOR_READ_TOKEN
 }).then(r=>{
  process.stdout.write(JSON.stringify(r,null,2)+'\n');
  if(!r.ready)process.exitCode=1;
 }).catch(()=>{console.error('MAGOS_RELEASE_PREFLIGHT_FAILED');process.exitCode=1;});
}
module.exports={releasePreflight,localCheckout};
