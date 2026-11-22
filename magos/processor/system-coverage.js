'use strict';

// Entire MAGOS capability inventory comes from the existing Control Hub.
// No shadow project database; evidence remains in Business_Capability_Map.
const {AuditLedger}=require('../adapters/audit-ledger');
const {createGoogleAuth}=require('../adapters/google-auth');

const CONTROL_HUB_ID='1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo';
const READ_ONLY_SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const REQUIRED_HEADERS=['Capability ID','Business Capability','Current State','Implementation State',
  'Completion Gate','Primary Gap','Priority','Next Action','Do Not Mark Complete Until'];
const truth=v=>String(v??'').trim();
const {buildDeliveryRoadmap}=require('./delivery-roadmap');

class SystemCoverageReader {
  constructor({store}={}) {
    this.store=store||new AuditLedger({
      spreadsheetId:process.env.MAGOS_CONTROL_HUB_SPREADSHEET_ID||CONTROL_HUB_ID,
      auth:createGoogleAuth([READ_ONLY_SCOPE])
    });
  }
  async read() {
    const rows=await this.store.readObjects('Business_Capability_Map',{
      maxRows:null,requiredHeaders:REQUIRED_HEADERS
    });
    if(!Array.isArray(rows)||!rows.length)throw Error('CAPABILITY_REGISTER_EMPTY');
    const ids=new Set(),capabilities=[];
    for(const row of rows){
      const id=truth(row['Capability ID']);
      if(!/^CAP-\d{3}$/.test(id)||ids.has(id))throw Error('CAPABILITY_REGISTER_ID_CONFLICT');
      ids.add(id);
      capabilities.push({
        id,
        name:truth(row['Business Capability']),
        state:truth(row['Current State'])||'UNKNOWN',
        implementation:truth(row['Implementation State'])||'UNKNOWN',
        priority:truth(row.Priority)||'UNKNOWN',
        next_action:truth(row['Next Action']),
        completion_gate:truth(row['Completion Gate']),
        missing_validation:truth(row['Do Not Mark Complete Until']),
        primary_gap:truth(row['Primary Gap'])
      });
    }
    const counts={total:capabilities.length,pass:0,partial:0,fail:0,other:0};
    for(const cap of capabilities){
      const key=cap.state.toUpperCase();
      if(key==='PASS')counts.pass++;
      else if(key==='PARTIAL')counts.partial++;
      else if(key==='FAIL')counts.fail++;
      else counts.other++;
    }
    const parts=new Intl.DateTimeFormat('en-GB',{
      timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date());
    const part=type=>parts.find(p=>p.type===type)?.value;
    const asOf=part('year')+'-'+part('month')+'-'+part('day');
    const delivery=buildDeliveryRoadmap({capabilities,asOf});
    return {
      schema_version:'MAGOS_SYSTEM_COVERAGE_V1',
      source:'CONTROL_HUB_BUSINESS_CAPABILITY_MAP',
      authority:'READ_ONLY_PROJECTION',
      checked_at:new Date().toISOString(),
      counts,capabilities,delivery,
      entire_business_scope:true,
      production_complete:capabilities.length>0 && counts.pass===counts.total,
      side_effects:false
    };
  }
}
module.exports={SystemCoverageReader,REQUIRED_HEADERS};
