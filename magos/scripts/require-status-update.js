'use strict';
/**
 * MAGOS status governance gate.
 *
 * Every MAGOS implementation change must update BOTH the concise current
 * source-of-truth record and the append-only engineering history in the PR.
 * Avoids disconnected, stale .md files after repeated production builds.
 */
const {execFileSync}=require('node:child_process');
const CURRENT='magos/docs/MAGOS-CURRENT.md';
const HISTORY='magos/docs/MAGOS-STATUS.md';
function requiresStatusUpdate(file){
 return /^magos\/(?:runtime|writer|adapters|processor|agents|workflows|wordpress|workers|tests|scripts)\//.test(file) ||
  /^magos\/(?:app\.js|package\.json|Dockerfile)$/.test(file) ||
  /^\.github\/workflows\/magos-[\w.-]+\.ya?ml$/.test(file);
}
function assessChanges(changed){
 const paths=[...new Set(changed)].filter(Boolean);
 const implementation=paths.filter(requiresStatusUpdate);
 if(!implementation.length)return {pass:true,requires_update:false,missing:[],implementation};
 const missing=[CURRENT,HISTORY].filter(x=>!paths.includes(x));
 return {pass:missing.length===0,requires_update:true,missing,implementation};
}
function changedFiles(base,head){
 if(!/^[a-f0-9]{40}$/i.test(base)||!/^[a-f0-9]{40}$/i.test(head))
  throw Error('FULL_BASE_AND_HEAD_COMMIT_SHA_REQUIRED');
 const result=execFileSync('git',['diff','--name-only','--no-renames',base,head],{
  encoding:'utf8',timeout:15000,maxBuffer:1024*1024
 });
 return result.split(/\r?\n/).filter(Boolean);
}
if(require.main===module){
 try{
  const assessment=assessChanges(changedFiles(
   process.env.MAGOS_PR_BASE_SHA,process.env.MAGOS_PR_HEAD_SHA));
  process.stdout.write(JSON.stringify(assessment,null,2)+'\n');
  if(!assessment.pass)process.exitCode=1;
 }catch(err){
  process.stderr.write('MAGOS_STATUS_GATE_FAILED: '+err.message+'\n');
  process.exitCode=1;
 }
}
module.exports={CURRENT,HISTORY,requiresStatusUpdate,assessChanges,changedFiles};
