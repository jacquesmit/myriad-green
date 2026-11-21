'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TransactionWriter,STORE_NAMES}=require('../writer/transaction-writer');
const {prepareProcurementDraftPlan}=require('../processor/procurement-draft-transaction');
class Store {
 constructor(tables){this.tables=structuredClone(tables);}
 async readObjects(t){return structuredClone(this.tables[t]||[]);}
 async getHeaders(t){const headers=Object.keys((this.tables[t]||[])[0]||{});return {headers,map:Object.fromEntries(headers.map((h,i)=>[h,i]))};}
 async findByKey(t,k,v){const index=(this.tables[t]||[]).findIndex(r=>String(r[k])===String(v));return index<0?null:{rowNumber:index+2,object:structuredClone(this.tables[t][index])};}
 async appendObject(t,obj){this.tables[t]||=[];this.tables[t].push(structuredClone(obj));return {rowNumber:this.tables[t].length+1};}
 async deleteRowByKey(t,k,v){const i=(this.tables[t]||[]).findIndex(r=>String(r[k])===String(v));if(i>=0)this.tables[t].splice(i,1);}
 async updateFieldsByKey(t,k,v,changes){const row=(this.tables[t]||[]).find(r=>String(r[k])===String(v));if(!row)return null;const before=Object.fromEntries(Object.keys(changes).map(h=>[h,row[h]??'']));Object.assign(row,changes);return {rowNumber:2,before,changed:true};}
}
class Audit extends Store {
 async beginRun({idempotencyKey}){const x=await this.findByKey('Automation_Run_Log','idempotency_key',idempotencyKey);if(x?.object.run_state==='COMMITTED')return {duplicate:true,existing:x.object};if(x){await this.updateFieldsByKey('Automation_Run_Log','idempotency_key',idempotencyKey,{run_state:'RUNNING'});return {duplicate:false};}await this.appendObject('Automation_Run_Log',{idempotency_key:idempotencyKey,run_state:'RUNNING'});return {duplicate:false};}
 async completeRun(key,{state}){await this.updateFieldsByKey('Automation_Run_Log','idempotency_key',key,{run_state:state});}
 async resolveSyncException(){return true;}
 async raiseSyncException(){return true;}
}
function fixture() {
 const headers=['po_id','supplier_id','supplier_name','project_id','quote_id','job_id','supplier_quote_id','order_date','required_date','fulfilment_method','delivery_address','subtotal_ex_vat','vat_amount','total_inc_vat','payment_status','order_status','approved_by','approval_date','supplier_order_reference','notes','purchase_event_type','supplier_invoice_number','invoice_evidence_link','invoice_evidence_status'];
 const supplier=new Store({Purchase_Orders:[Object.fromEntries(headers.map(h=>[h,'']))]});
 const audit=new Audit({
  Automation_Run_Log:[{idempotency_key:'',run_state:''}],
  Data_Ownership_Matrix:[{entity_type:'Purchase order',ownership_status:'PASS',source_of_truth_tab:'Purchase_Orders',source_of_truth_workbook:STORE_NAMES.supplier}],
  Writer_Schema_Registry:headers.map((h,i)=>({workbook_role:'SUPPLIER',sheet_name:'Purchase_Orders',ordinal_1based:String(i+1),expected_header:h}))
 });
 return {supplier,audit,writer:new TransactionWriter({stores:{supplier,audit},auditStore:audit})};
}
test('real P3 writer commits exactly one unreleased PO draft and audit, replay NO_OP',async()=>{
 const f=fixture();
 const plan=prepareProcurementDraftPlan({
  supplier:{supplier_id:'SUP-AQUADAM-GAUTENG',supplier_name:'Aquadam'},
  quote:{supplier_quote_id:'SQ-001',supplier_id:'SUP-AQUADAM-GAUTENG'},
  poId:'PO-INTEG-01',sourceEventId:'E-INTEG-01',evidenceRef:'test://supplier/quote',
  projectId:'PROJECT-001'
 });
 const first=await f.writer.execute(plan);
 assert.equal(first.state,'COMMITTED',JSON.stringify(first));
 const row=(await f.supplier.findByKey('Purchase_Orders','po_id','PO-INTEG-01')).object;
 assert.equal(row.order_status,'DRAFT');
 assert.equal(row.payment_status,'NOT_PAID');
 assert.equal(row.approved_by,'');
 const replay=await f.writer.execute(plan);
 assert.equal(replay.state,'DUPLICATE_NO_OP');
 assert.equal((await f.audit.findByKey('Automation_Run_Log','idempotency_key',plan.idempotency_key)).object.run_state,'COMMITTED');
});
test('P3 rejects purchase draft when authoritative ownership fails',async()=>{
 const f=fixture();
 f.audit.tables.Data_Ownership_Matrix[0].ownership_status='BLOCK';
 const plan=prepareProcurementDraftPlan({
  supplier:{supplier_id:'SUP-AQUADAM-GAUTENG'},
  quote:{supplier_quote_id:'SQ-001',supplier_id:'SUP-AQUADAM-GAUTENG'},
  poId:'PO-INTEG-02',sourceEventId:'E-INTEG-02',evidenceRef:'test://supplier/quote',projectId:'PROJECT-001'
 });
 const result=await f.writer.execute(plan);
 assert.notEqual(result.state,'COMMITTED');
 assert.equal(await f.supplier.findByKey('Purchase_Orders','po_id','PO-INTEG-02'),null);
});
