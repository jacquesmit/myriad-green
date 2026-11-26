'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRestrictedWorkforceWriter,WORKFORCE_STORE_NAME,EMPLOYEE_HEADERS}=require('../adapters/workforce-store');
const {prepareWorkforceRecord}=require('../processor/workforce-record');
const id='synthetic-workforce-spreadsheet-id';
class Store {
 constructor(tables,spreadsheetId){this.tables=structuredClone(tables);this.spreadsheetId=spreadsheetId;}
 async readObjects(t){return structuredClone(this.tables[t]||[]);}
 async getHeaders(t){const headers=Object.keys(this.tables[t]?.[0]||{});return {headers,map:Object.fromEntries(headers.map((h,i)=>[h,i]))};}
 async findByKey(t,k,v){const rows=(this.tables[t]||[]).filter(r=>r[k]===v);if(rows.length>1)throw Error('DUPLICATE');return rows.length?{object:structuredClone(rows[0])}:null;}
 async appendObject(t,obj){this.tables[t].push(structuredClone(obj));}
 async deleteRowByKey(t,k,v){this.tables[t]=this.tables[t].filter(r=>r[k]!==v);}
}
class Audit extends Store{
 async beginRun({idempotencyKey}){const old=await this.findByKey('Automation_Run_Log','idempotency_key',idempotencyKey);if(old?.object.run_state==='COMMITTED')return {duplicate:true,existing:old.object};if(!old)await this.appendObject('Automation_Run_Log',{idempotency_key:idempotencyKey,run_state:'RUNNING'});return {duplicate:false};}
 async completeRun(key,{state}){this.tables.Automation_Run_Log.find(r=>r.idempotency_key===key).run_state=state;}
 async resolveSyncException(){}
 async raiseSyncException(){}
}
function fixture(){
 const ledger=new Store({Employees:[Object.fromEntries(EMPLOYEE_HEADERS.map(h=>[h,'']))]},id);
 const audit=new Audit({Automation_Run_Log:[],Data_Ownership_Matrix:[{entity_type:'Employee / employment relationship',ownership_status:'PASS',source_of_truth_workbook:WORKFORCE_STORE_NAME,source_of_truth_tab:'Employees'}],Writer_Schema_Registry:EMPLOYEE_HEADERS.map((h,i)=>({workbook_role:'workforce',sheet_name:'Employees',expected_header:h,ordinal_1based:i+1}))},'synthetic-shared-audit-id');
 const baseWriter={audit,stores:{audit}};
 return {ledger,audit,baseWriter,options:{baseWriter,spreadsheetId:id,verifyRestrictedStore:async()=>({spreadsheetId:id,name:WORKFORCE_STORE_NAME,restricted:true,runtimeAccessVerified:true}),makeLedger:async()=>ledger}};
}
test('restricted store composition preserves base writer and rejects unsafe configuration',async()=>{
 const f=fixture();
 await assert.rejects(createRestrictedWorkforceWriter({...f.options,verifyRestrictedStore:async()=>({restricted:true})}),/ACCESS_NOT_VERIFIED/);
 await assert.rejects(createRestrictedWorkforceWriter({...f.options,spreadsheetId:f.audit.spreadsheetId}),/COLLISION/);
 f.audit.tables.Data_Ownership_Matrix[0].ownership_status='PARTIAL';
 await assert.rejects(createRestrictedWorkforceWriter(f.options),/OWNERSHIP_NOT_VERIFIED/);
 f.audit.tables.Data_Ownership_Matrix[0].ownership_status='PASS';
 f.audit.tables.Writer_Schema_Registry.pop();
 await assert.rejects(createRestrictedWorkforceWriter(f.options),/SCHEMA_NOT_REGISTERED/);
 assert.equal(f.baseWriter.stores.workforce,undefined);
});
test('real existing P3 writer creates review record, verifies readback and replays without duplicate',async()=>{
 const f=fixture();const writer=await createRestrictedWorkforceWriter(f.options);
 const ref=c=>'opaque:'+c.repeat(64);
 const evidence={type:'existing',subjectRef:ref('a'),employerRef:ref('b'),sourceRef:ref('c'),verified:true,approved:true};
 const run=()=>prepareWorkforceRecord({writer,request:{},verifyAuthority:async()=>evidence});
 const first=await run();assert.equal(first.state,'COMMITTED');assert.equal(first.operational_clearance,false);
 assert.equal((await f.ledger.findByKey('Employees','employee_id',first.employee_id)).object.onboarding_state,'REVIEW_REQUIRED');
 assert.equal((await run()).state,'DUPLICATE_NO_OP');
 evidence.sourceRef=ref('d');assert.equal((await run()).state,'COMMITTED');
 assert.equal(f.ledger.tables.Employees.filter(r=>r.employee_id).length,1);
 assert.equal(f.baseWriter.stores.workforce,undefined);
 assert.doesNotMatch(JSON.stringify(f.audit.tables),/opaque:/);
});
