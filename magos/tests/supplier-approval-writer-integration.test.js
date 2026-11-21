'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TransactionWriter, STORE_NAMES } = require('../writer/transaction-writer');
const { createEventEnvelope } = require('../processor/event-envelope');
const { createSupplierApprovalProcessor } = require('../processor/supplier-approval-processor');

class Store {
  constructor(tables) { this.tables = structuredClone(tables); }
  async readObjects(t) { return structuredClone(this.tables[t] || []); }
  async getHeaders(t) {
    const headers = Object.keys((this.tables[t] || [])[0] || {});
    return { headers, map: Object.fromEntries(headers.map((v,i) => [v,i])) };
  }
  async findByKey(t,k,v) {
    const i = (this.tables[t] || []).findIndex(r => String(r[k]) === String(v));
    return i < 0 ? null : { rowNumber: i+2, object: structuredClone(this.tables[t][i]) };
  }
  async updateFieldsByKey(t,k,v,changes) {
    const row = (this.tables[t] || []).find(r => String(r[k]) === String(v));
    if (!row) return null;
    const before = Object.fromEntries(Object.keys(changes).map(h => [h,row[h] || '']));
    Object.assign(row,changes);
    return { rowNumber: 2, before, changed: true };
  }
}
class Audit extends Store {
  async beginRun({ idempotencyKey }) {
    const row = this.tables.Automation_Run_Log.find(r => r.idempotency_key === idempotencyKey);
    if (row?.run_state === 'COMMITTED') return { duplicate: true, existing: row };
    if (row) { row.run_state = 'RUNNING'; return { duplicate: false }; }
    this.tables.Automation_Run_Log.push({ idempotency_key: idempotencyKey, run_state: 'RUNNING' });
    return { duplicate: false };
  }
  async completeRun(key, fields) {
    await this.updateFieldsByKey('Automation_Run_Log','idempotency_key',key,{
      run_state: fields.state, writes_summary: fields.writesSummary
    });
  }
  async resolveSyncException() { return true; }
  async raiseSyncException() { return true; }
}
function fixture({ approval = 'VETTING', registered = true, ownership = 'PASS' } = {}) {
  const supplier = new Store({ Suppliers: [{
    supplier_id: 'SUP-AQUADAM-GAUTENG', supplier_approval_state: approval, active_status: 'ACTIVE'
  }]});
  const audit = new Audit({
    Automation_Run_Log: [{ idempotency_key: '', run_state: '' }],
    Data_Ownership_Matrix: [{
      entity_type: 'Supplier', ownership_status: ownership,
      source_of_truth_tab: 'Suppliers',
      source_of_truth_workbook: STORE_NAMES.supplier
    }],
    Writer_Schema_Registry: registered
      ? ['supplier_id','supplier_approval_state','active_status'].map((h,i) => ({
        workbook_role:'SUPPLIER',sheet_name:'Suppliers',expected_header:h,ordinal_1based:String(i+1)
      }))
      : []
  });
  return { supplier, audit, writer: new TransactionWriter({ stores: { supplier, audit }, auditStore:audit }) };
}
function event(sourceEventId='TEST-APPROVAL-001') {
  return createEventEnvelope({
    source: 'MGOS_GOVERNANCE', source_event_id: sourceEventId,
    event_type: 'SUPPLIER_APPROVAL_CHANGED', actor: {id:'operator-1'},
    entity_hints: {supplier_id:'SUP-AQUADAM-GAUTENG'},
    guards: {spam:'CLEAR',phishing:'CLEAR',explicit_content:'CLEAR',malware:'CLEAR',irrelevant:'CLEAR'},
    evidence: [{type:'DOCUMENT',ref:'test://approval/1'}],
    metadata: {approval_authorized:true},
    payload: {supplier_approval_change:{supplier_id:'SUP-AQUADAM-GAUTENG',from_state:'VETTING',to_state:'APPROVED'}}
  });
}
async function decide(supplier,e) {
  const processor=createSupplierApprovalProcessor({lookupService:{
    findEntityByCanonicalId: async(type,id)=> (await supplier.findByKey('Suppliers','supplier_id',id))?.object || null
  }});
  return processor.decide(e);
}
test('real P3 writer integration commits exactly one approval transition, preserves ACTIVE and deduplicates', async()=>{
  const {supplier,writer,audit}=fixture();
  const e=event();
  const d=await decide(supplier,e);
  assert.equal(d.decision,'AUTO_WRITE');
  const result=await writer.execute(d.transaction_plan);
  assert.equal(result.state,'COMMITTED',JSON.stringify(result));
  const row=(await supplier.findByKey('Suppliers','supplier_id','SUP-AQUADAM-GAUTENG')).object;
  assert.equal(row.supplier_approval_state,'APPROVED');
  assert.equal(row.active_status,'ACTIVE');
  const replay=await writer.execute(d.transaction_plan);
  assert.equal(replay.state,'DUPLICATE_NO_OP');
  assert.equal((await audit.findByKey('Automation_Run_Log','idempotency_key',e.idempotency_key)).object.run_state,'COMMITTED');
});
test('P3 schema registry and ownership prevent unauthorized approval writes',async()=>{
  for (const config of [{registered:false},{ownership:'BLOCK'}]) {
    const {supplier,writer}=fixture(config);
    const d=await decide(supplier,event('TEST-'+JSON.stringify(config)));
    const r=await writer.execute(d.transaction_plan);
    assert.notEqual(r.state,'COMMITTED');
    assert.equal((await supplier.findByKey('Suppliers','supplier_id','SUP-AQUADAM-GAUTENG')).object.supplier_approval_state,'VETTING');
  }
});
test('stale state before writer execution prevents mutation',async()=>{
  const {supplier,writer}=fixture();
  const d=await decide(supplier,event('STALE-APPROVAL'));
  await supplier.updateFieldsByKey('Suppliers','supplier_id','SUP-AQUADAM-GAUTENG',{supplier_approval_state:'SUSPENDED'});
  const r=await writer.execute(d.transaction_plan);
  assert.notEqual(r.state,'COMMITTED');
  assert.equal((await supplier.findByKey('Suppliers','supplier_id','SUP-AQUADAM-GAUTENG')).object.supplier_approval_state,'SUSPENDED');
});
