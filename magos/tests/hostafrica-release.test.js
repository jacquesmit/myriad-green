'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../scripts/hostafrica-release.sh');
const run=(cmd,args,options={})=>{
 const r=spawnSync(cmd,args,{encoding:'utf8',timeout:30000,...options});
 assert.equal(r.status,0,cmd+' '+args.join(' ')+' '+r.stderr);
 return r.stdout.trim();
};
function git(dir,...args){return run('git',['-C',dir,...args]);}
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'magos-deploy-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const local=path.join(root,'checkout'),bare=path.join(root,'remote.git');
 fs.mkdirSync(local);
 run('git',['init','--bare',bare]);
 run('git',['init','-b','main',local]);
 git(local,'config','user.email','ci@magos.invalid');
 git(local,'config','user.name','MAGOS CI');
 fs.mkdirSync(path.join(local,'magos'));
 fs.writeFileSync(path.join(local,'magos','app.js'),'module.exports={};\n');
 git(local,'add','magos/app.js');
 git(local,'commit','-m','seed a safe MAGOS host checkout');
 git(local,'remote','add','origin',bare);
 git(local,'push','-u','origin','main');
 return {local,bare,sha:git(local,'rev-parse','HEAD')};
}
const invoke=(root,mode='inspect',extra={})=>spawnSync('bash',[script,mode],{
 encoding:'utf8',timeout:30000,
 env:{...process.env,MAGOS_REPO_ROOT:root,MAGOS_RELEASE_SHA:'',
   MAGOS_APPROVE_LIVE_DEPLOY:'',MAGOS_HOST_BACKUP_CONFIRMED:'',...extra}
});
test('host release script is bash syntax-valid and documents explicit safe modes',()=>{
 const p=spawnSync('bash',['-n',script],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 const h=spawnSync('bash',[script,'--help'],{encoding:'utf8'});
 assert.equal(h.status,0,h.stderr);
 assert.match(h.stdout,/inspect/);
 assert.match(h.stdout,/HOST_BACKUP_CONFIRMED/);
});
test('inspect checks actual remote HEAD but does not alter the host checkout',t=>{
 const f=fixture(t),before=git(f.local,'rev-parse','HEAD');
 const x=invoke(f.local);
 assert.equal(x.status,0,x.stderr);
 assert.match(x.stdout,new RegExp('CURRENT_HOST_SHA='+f.sha));
 assert.match(x.stdout,new RegExp('REMOTE_GITHUB_MAIN_SHA='+f.sha));
 assert.match(x.stdout,/STATE=INSPECTED_ONLY_NO_CHANGES/);
 assert.equal(git(f.local,'rev-parse','HEAD'),before);
});
test('expired/absent Git remote access blocks inspection without changing checkout',t=>{
 const f=fixture(t);
 git(f.local,'remote','set-url','origin',path.join(path.dirname(f.local),'not-a-real-remote'));
 const x=invoke(f.local);
 assert.notEqual(x.status,0);
 assert.match(x.stderr,/PRIVATE_GITHUB_ORIGIN_MAIN_UNREACHABLE_CHECK_EXPIRED_TOKEN/);
 assert.equal(git(f.local,'rev-parse','HEAD'),f.sha);
});
test('tracked local modifications fail before any release activity',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.local,'magos','app.js'),'changed\n');
 const x=invoke(f.local);
 assert.notEqual(x.status,0);
 assert.match(x.stderr,/TRACKED_WORKTREE_DIRTY_STOP/);
 assert.equal(git(f.local,'rev-parse','HEAD'),f.sha);
});
test('deploy without explicit SHA, approval and host backup stops before touching checkout',t=>{
 const f=fixture(t);
 const runs=[
  invoke(f.local,'deploy'),
  invoke(f.local,'deploy',{MAGOS_RELEASE_SHA:f.sha}),
  invoke(f.local,'deploy',{MAGOS_RELEASE_SHA:f.sha,MAGOS_APPROVE_LIVE_DEPLOY:'YES'})
 ];
 const errors=['FULL_RELEASE_SHA_REQUIRED','LIVE_DEPLOY_APPROVAL_REQUIRED',
  'HOST_BACKUP_CONFIRMATION_REQUIRED'];
 runs.forEach((r,i)=>{assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(errors[i]));});
 assert.equal(git(f.local,'rev-parse','HEAD'),f.sha);
});
