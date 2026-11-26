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


// Register labels are observations, not proof of live execution.
const INVENTORY = [
  ['systems','System_Directory','System ID','System / Module','Lifecycle status',44,4002],
  ['gates','Lifecycle_Gates','Gate ID','Transition','To State',18,1701952547],
  ['packages','Core_Build_Queue','Queue ID','Work Package','State',12,2063886831],
  ['automations','Automation_Directory','Automation ID','Business purpose','Status',35,4003]
];
async function readInventory(store) {
  const result=await Promise.all(INVENTORY.map(async ([key,tab,idField,nameField,stateField,baseline,gid])=>{
    const source={url:'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(store.spreadsheetId||CONTROL_HUB_ID)+'/edit#gid='+gid};
    try {
      const rows=await store.readObjects(tab,{maxRows:null,requiredHeaders:[idField,nameField,stateField],headerRow:['systems','automations'].includes(key)?4:1});
      if(!Array.isArray(rows)||!rows.length)throw Error('REGISTER_EMPTY');
      const seen=new Set(),records=[];
      for(const row of rows){
        const id=truth(row[idField]),status=truth(row[stateField]);
        if(!id||seen.has(id)||!truth(row[nameField])||/^#(REF!|N\/A|VALUE!|ERROR!|DIV\/0!|NAME\?|NUM!|NULL!)/i.test(status))throw Error('REGISTER_INVALID');
        seen.add(id);
        records.push({id,title:truth(row[nameField]),status:status||'UNKNOWN',
          next_action:truth(row['Next Executable Action']||row['Next action']||row['Required Evidence / Conditions']),
          details:{register:tab,source_label_only:'YES',production_acceptance:'NOT_VERIFIED'}});
      }
      return [key,{state:records.length<baseline?'PARTIAL':'LIVE',baseline,count:records.length,records,source}];
    } catch {return [key,{state:'UNAVAILABLE',baseline,count:null,records:[],source}];}
  }));
  return Object.fromEntries(result);
}

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
      inventory:await readInventory(this.store),
      entire_business_scope:true,
      // Source capability labels are necessary, never sufficient for launch.
      // Production requires independently verified host/real-provider gates.
      capability_gates_passed:capabilities.length>0 && counts.pass===counts.total,
      production_complete:false,
      production_acceptance:'NOT_VERIFIED',
      side_effects:false
    };
  }
}
module.exports={SystemCoverageReader,REQUIRED_HEADERS};
