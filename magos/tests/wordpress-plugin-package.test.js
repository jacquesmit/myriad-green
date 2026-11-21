'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const slug='magos-reviewed-client-signature';
const zip=path.join(root,'dist',slug+'.zip');
const sha=zip+'.sha256';
const php=path.join(root,'wordpress',slug+'.php');

test('release is an installable single-plugin ZIP containing the exact source file',()=>{
 assert.ok(fs.statSync(zip).size>1000);
 const manifest=fs.readFileSync(sha,'utf8').trim();
 assert.match(manifest,new RegExp('^[a-f0-9]{64}\\s{2}'+slug+'\\.zip$'));
 const digest=crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
 assert.equal(manifest.split(/\s+/)[0],digest);
 const entries=execFileSync('unzip',['-Z','-1',zip],{encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(entries,[slug+'/'+slug+'.php']);
 const contents=execFileSync('unzip',['-p',zip,entries[0]]);
 assert.deepEqual(contents,fs.readFileSync(php));
 assert.match(contents.toString('utf8'),/Plugin Name: MAGOS Reviewed Client Signature Receipt/);
});
test('repeated packaging produces identical checksums and never includes credentials',()=>{
 const before=fs.readFileSync(sha,'utf8');
 execFileSync('bash',[path.join(root,'scripts','package-reviewed-signature-plugin.sh')],{stdio:'ignore'});
 assert.equal(fs.readFileSync(sha,'utf8'),before);
 const entries=execFileSync('unzip',['-Z','-1',zip],{encoding:'utf8'});
 assert.doesNotMatch(entries,/\.env|credential|private|\.sql|signature_png/i);
});
