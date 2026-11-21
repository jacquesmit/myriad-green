'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const source=readFileSync(path.resolve(__dirname,'../wordpress/mgos-reviewed-client-signature.php'),'utf8');

test('new client receipt bridge is standalone and explicitly requires existing signed-token parser',()=>{
  assert.match(source,/Plugin Name:\s*MAGOS Reviewed Client Signature Receipt/);
  assert.match(source,/MGOS_Quote_Acceptance::parse_token\(\$token\)/);
  assert.match(source,/MGOS_Quote_Acceptance::auth\(\$request\)/);
});
test('client intake records pending review; never auto approves on client submission',()=>{
  const submission=source.slice(source.indexOf('static function submitted('),source.indexOf('static function review_page('));
  assert.match(submission,/'status'=>'PENDING_REVIEW'/);
  assert.doesNotMatch(submission,/'status'=>'INDEPENDENTLY_APPROVED'/);
  assert.match(submission,/signature_sha256.*hash\('sha256',\$raw\)/);
});
test('administrator approval requires nonce, capability, evidence and original PNG hash',()=>{
  const approve=source.slice(source.indexOf('static function approve('),source.indexOf('static function verify('));
  assert.match(approve,/current_user_can\('manage_options'\)/);
  assert.match(approve,/check_admin_referer/);
  assert.match(approve,/hash_equals/);
  assert.match(approve,/drive\.google\.com/);
});
test('verification is private, rereads stored evidence, and exposes only reviewed source metadata',()=>{
  assert.match(source,/quote-acceptance\/verify-v2/);
  assert.match(source,/permission_callback/);
  assert.match(source,/MGOS_Quote_Acceptance::auth\(\$request\)/);
  assert.match(source,/count\(\$rows\)!==1/);
  assert.match(source,/hash_equals/);
  assert.match(source,/'consent_verified'=>true/);
  const response=source.slice(source.indexOf('static function verify('));
  assert.doesNotMatch(response,/'signature_png'\s*=>/);
});
test('form reception cannot issue jobs, bookings or payment clearance',()=>{
  assert.doesNotMatch(source,/wp_remote_post\s*\(/);
  assert.doesNotMatch(source,/\$wpdb->update\(\s*['"]jobs/i);
  assert.match(source,/No status on this page can release materials or schedule work/);
});
