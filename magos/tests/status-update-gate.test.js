'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CURRENT,HISTORY,requiresStatusUpdate,assessChanges,changedFiles}=
 require('../scripts/require-status-update');
test('MAGOS code changes require BOTH current and append-only status documents',()=>{
 const result=assessChanges(['magos/processor/new-job-gate.js']);
 assert.equal(result.pass,false);
 assert.deepEqual(result.missing,[CURRENT,HISTORY]);
 assert.equal(result.requires_update,true);
});
test('only one Markdown update is not enough to claim reconciled engineering state',()=>{
 const result=assessChanges(['magos/runtime/app.js',HISTORY]);
 assert.deepEqual(result.missing,[CURRENT]);
});
test('after both Markdown files change with code, the update process passes',()=>{
 const result=assessChanges(['magos/writer/transaction-writer.js',
  'magos/tests/transaction-writer.test.js',CURRENT,HISTORY]);
 assert.equal(result.pass,true);
 assert.deepEqual(result.missing,[]);
});
test('CI, WordPress plugins, agents, worker changes require status update',()=>{
 for(const p of [
  '.github/workflows/magos-runtime.yml',
  'magos/wordpress/mgos-reviewed-client-signature.php',
  'magos/agents/agent-router.js',
  'magos/workers/drive-intake.worker.js',
  'magos/package.json','magos/Dockerfile',
  'magos/scripts/deploy.js'
 ]) assert.equal(requiresStatusUpdate(p),true,p);
});
test('docs-only and non-MAGOS site changes are not falsely blocked',()=>{
 for(const paths of [
  [CURRENT,HISTORY],
  ['README.md','site/index.html'],
  ['magos/docs/MAGOS-WP-QUOTE-BRIDGE.md']
 ])assert.equal(assessChanges(paths).pass,true);
});
test('invalid refs fail closed, never skip source control verification',()=>{
 assert.throws(()=>changedFiles('main','HEAD'),/FULL_BASE_AND_HEAD_COMMIT_SHA_REQUIRED/);
});
