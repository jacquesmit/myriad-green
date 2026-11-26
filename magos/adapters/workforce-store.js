'use strict';
const {TransactionWriter,STORE_NAMES}=require('../writer/transaction-writer');
const WORKFORCE_STORE_NAME='MAGOS Workforce Register - Restricted';
const EMPLOYEE_HEADERS=Object.freeze(['employee_id','employment_path','onboarding_state']);
const ROLE='workforce';

// Opt-in composition of the existing writer and Sheets adapter. No shared
// runtime defaults are changed and no spreadsheet is created or shared here.
async function createRestrictedWorkforceWriter({baseWriter,spreadsheetId,verifyRestrictedStore,makeLedger}={}){
 if(typeof spreadsheetId!=='string'||!/^[A-Za-z0-9_-]{20,150}$/.test(spreadsheetId)||
    !baseWriter?.audit||!baseWriter?.stores||typeof verifyRestrictedStore!=='function')
  throw Error('WORKFORCE_STORE_NOT_CONFIGURED');
 const existing=Object.values(baseWriter.stores).map(store=>store?.spreadsheetId);
 if(existing.includes(spreadsheetId)||baseWriter.stores.workforce)
  throw Error('WORKFORCE_STORE_COLLISION');
 const verified=await verifyRestrictedStore({spreadsheetId});
 if(verified?.spreadsheetId!==spreadsheetId||verified?.name!==WORKFORCE_STORE_NAME||
    verified?.restricted!==true||verified?.runtimeAccessVerified!==true)
  throw Error('WORKFORCE_STORE_ACCESS_NOT_VERIFIED');
 const factory=makeLedger||((id)=>new (require('./audit-ledger').AuditLedger)({spreadsheetId:id}));
 const ledger=await factory(spreadsheetId);
 if(ledger?.spreadsheetId!==spreadsheetId)throw Error('WORKFORCE_STORE_ID_MISMATCH');
 const schema=await ledger.getHeaders('Employees');
 if(JSON.stringify(schema?.headers)!==JSON.stringify(EMPLOYEE_HEADERS))
  throw Error('WORKFORCE_STORE_SCHEMA_MISMATCH');
 const owner=await baseWriter.audit.findByKey('Data_Ownership_Matrix','entity_type','Employee / employment relationship');
 if(owner?.object?.ownership_status!=='PASS'||owner.object.source_of_truth_workbook!==WORKFORCE_STORE_NAME||owner.object.source_of_truth_tab!=='Employees')
  throw Error('WORKFORCE_OWNERSHIP_NOT_VERIFIED');
 const registry=await baseWriter.audit.readObjects('Writer_Schema_Registry');
 const rows=registry.filter(row=>row.workbook_role===ROLE&&row.sheet_name==='Employees');
 if(rows.length!==EMPLOYEE_HEADERS.length||EMPLOYEE_HEADERS.some((header,i)=>rows.filter(r=>r.expected_header===header&&Number(r.ordinal_1based)===i+1).length!==1))
  throw Error('WORKFORCE_SCHEMA_NOT_REGISTERED');
 return new TransactionWriter({stores:{...baseWriter.stores,workforce:ledger},
  auditStore:baseWriter.audit,storeNames:{...STORE_NAMES,...baseWriter.storeNames,workforce:WORKFORCE_STORE_NAME}});
}
module.exports={createRestrictedWorkforceWriter,WORKFORCE_STORE_NAME,EMPLOYEE_HEADERS};
