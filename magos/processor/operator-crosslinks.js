'use strict';
// Read-only cross-workstream navigation. Only explicit canonical IDs from
// existing MAGOS records are eligible; never join on contact names or text.
const val=x=>String(x??'').trim();
const fields=Object.freeze({
 clients:r=>({crm:r.id,opportunity:r.details?.['Opportunity ID'],job:r.details?.['Job ID']}),
 prospects:r=>({crm:r.id,opportunity:r.details?.['Opportunity ID'],job:r.details?.['Job ID']}),
 provenance:r=>({crm:r.id,opportunity:r.details?.['Opportunity ID'],job:r.details?.['Job ID']}),
 conversions:r=>r.title==='Attribution reconciliation'?{}:({
  opportunity:r.id,crm:r.details?.['Client CRM ID'],job:r.details?.['Job ID']
 }),
 jobs:r=>({opportunity:r.id,crm:r.details?.client_id,job:r.details?.job_id}),
 quotes:r=>({quote:r.id,opportunity:r.details?.opportunity_id,job:r.details?.job_id}),
 finance:r=>({control:r.id,opportunity:r.details?.['Opportunity ID'],
  job:r.details?.['Job ID'],quote:r.details?.Quote}),
 dispatch:r=>({job:r.details?.['Job ID']}),
 evidence:r=>({job:r.details?.['Job ID']}),
 variations:r=>({job:r.details?.['Job ID']}),
 labour:r=>({job:r.id}),
 procurement:r=>({job:r.details?.job_id||r.details?.['Job ID']}),
 leads:r=>({crm:r.details?.client_id,opportunity:r.details?.opportunity_id})
});
function canonicalRelations(departments={}){
 const items=[],seenIds=new Map(),conflicted=new Set();
 for(const [dept,extract] of Object.entries(fields)){
  const workspace=departments[dept];
  if(!['LIVE','PARTIAL'].includes(workspace?.state)||!Array.isArray(workspace.records))
   continue;
  for(const row of workspace.records){
   const id=val(row.id);
   if(!id)continue;
   const key=dept+'\u0000'+id;
   if(seenIds.has(key))conflicted.add(key);
   else seenIds.set(key,true);
   const candidate=extract(row);
   const identity=Object.fromEntries(Object.entries(candidate)
    .map(([type,value])=>[type,val(value)]).filter(([,value])=>value));
   // A record under duplicate-ID review isn't safe to navigate to.
   if(row.title==='Duplicate record ID')conflicted.add(key);
   if(Object.keys(identity).length)items.push({dept,id,key,identity});
  }
 }
 const byIdentity=new Map();
 for(const item of items){
  if(conflicted.has(item.key))continue;
  for(const [type,id] of Object.entries(item.identity)){
   const key=type+'\u0000'+id;
   if(!byIdentity.has(key))byIdentity.set(key,[]);
   byIdentity.get(key).push(item);
  }
 }
 const counts={linked_records:0,links:0,conflicts:conflicted.size};
 for(const item of items){
  if(conflicted.has(item.key))continue;
  const candidates=new Map();
  for(const [type,id] of Object.entries(item.identity)){
   for(const target of byIdentity.get(type+'\u0000'+id)||[]){
    if(target.key===item.key||target.dept===item.dept)continue;
    // A conflicting canonical ID means a relationship is ambiguous.
    const mismatch=Object.keys(item.identity).some(k=>
     target.identity[k]&&target.identity[k]!==item.identity[k]);
    if(mismatch)continue;
    candidates.set(target.key,target);
   }
  }
  const relations=[...candidates.values()].sort((a,b)=>
   a.dept.localeCompare(b.dept)||a.id.localeCompare(b.id));
  const row=departments[item.dept].records.find(r=>val(r.id)===item.id);
  if(!row)continue;
  row.related=relations.slice(0,30).map(r=>({department:r.dept,id:r.id}));
  row.related_overflow=Math.max(0,relations.length-30);
  if(row.related.length)counts.linked_records++;
  counts.links+=row.related.length;
 }
 return {schema_version:'MAGOS_CANONICAL_NAVIGATION_V1',...counts,
  writes:[],side_effects:false};
}
module.exports={canonicalRelations};
