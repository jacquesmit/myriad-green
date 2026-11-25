'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {createOperatorLogin}=require('../runtime/operator-login');
const {createRuntimeApp}=require('../runtime/app');

test('Google owner session is allowlisted, expiring, revocable across workers and cannot authorize writes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'magos-auth-'));
  fs.chmodSync(dir,0o700);
  let time=Date.now(),flow,identity,exchanges=0;
  const env={MAGOS_OPERATOR_GOOGLE_CLIENT_ID:'fixture-client',
    MAGOS_OPERATOR_GOOGLE_CLIENT_SECRET:'fixture-secret',
    MAGOS_OPERATOR_GOOGLE_OWNER_EMAIL:'owner@gmail.com',
    MAGOS_OPERATOR_GOOGLE_OWNER_SUB:'owner-sub',
    MAGOS_OPERATOR_SESSION_SIGNING_KEY:'fixture-key-'.repeat(5),
    MAGOS_OPERATOR_SESSION_DIR:dir};
  const oauthFactory=()=>({
    generateAuthUrl(options){flow=options;return 'https://accounts.google.com/o/oauth2/v2/auth?state='+options.state;},
    async getToken(options){exchanges++;assert.equal(options.code,'fixture-code');assert.match(options.codeVerifier,/^[A-Za-z0-9_-]{43}$/);return {tokens:{id_token:'fixture-id-token'}};},
    async verifyIdToken(options){assert.equal(options.audience,'fixture-client');return {getPayload:()=>identity};}
  });
  const make=()=>createRuntimeApp({token:'writer-secret',operatorReadToken:'operator-secret',waterAlertPublishToken:'publisher-secret',
    operatorLogin:createOperatorLogin({env,now:()=>time,oauthFactory,audit:()=>{}}),
    startupGitStateReader:()=>({sha:'a'.repeat(40),dirty:false}),deployedCommitSha:'a'.repeat(40)});
  const servers=[http.createServer(make()),http.createServer(make())];
  await Promise.all(servers.map(s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve))));
  const [base,other]=servers.map(s=>'http://127.0.0.1:'+s.address().port);
  const request=(url,options={})=>fetch(url,{redirect:'manual',...options});
  async function begin(){
    const r=await request(base+'/operator/auth/start');
    assert.equal(r.status,303);
    assert.match(r.headers.get('set-cookie'),/HttpOnly/);
    assert.match(r.headers.get('set-cookie'),/Secure/);
    assert.match(r.headers.get('set-cookie'),/SameSite=Lax/);
    assert.equal(flow.code_challenge_method,'S256');
    return r.headers.get('set-cookie').split(';')[0];
  }
  const callback=(cookie,state=flow.state)=>request(other+'/operator/auth/callback?code=fixture-code&state='+state,{headers:{cookie}});
  const owner=()=>({email:'owner@gmail.com',email_verified:true,sub:'owner-sub',nonce:flow.nonce});
  const read=(url,cookie)=>request(url+'/v1/operator/deployment',{headers:{cookie}});
  try{
    assert.equal((await read(base,'')).status,401);
    assert.equal((await request(base+'/v1/operator/deployment',{headers:{'X-MAGOS-Operator-Token':'operator-secret'}})).status,200);
    let flowCookie=await begin();
    identity=owner();
    assert.equal((await callback(flowCookie,'wrong')).headers.get('location'),'/operator?login=failed');
    assert.equal(exchanges,0);
    assert.equal((await callback(flowCookie+'x')).headers.get('location'),'/operator?login=failed');
    assert.equal(exchanges,0);
    flowCookie=await begin();
    identity={...owner(),email:'other@gmail.com'};
    assert.equal((await callback(flowCookie)).headers.get('location'),'/operator?login=failed');
    flowCookie=await begin();
    identity={...owner(),nonce:'wrong'};
    assert.equal((await callback(flowCookie)).headers.get('location'),'/operator?login=failed');
    flowCookie=await begin();
    identity={...owner(),email_verified:false};
    assert.equal((await callback(flowCookie)).headers.get('location'),'/operator?login=failed');
    flowCookie=await begin();
    identity=owner();
    const login=await callback(flowCookie);
    assert.equal(login.headers.get('location'),'/operator');
    const cookies=login.headers.get('set-cookie');
    const session=cookies.match(/__Host-magos_operator=[A-Za-z0-9_-]{43}/)[0];
    assert.equal((await read(base,session)).status,200);
    assert.equal((await read(other,session)).status,200);
    assert.equal((await read(base,session+'x')).status,401);
    assert.equal((await request(base+'/v1/transactions',{method:'POST',headers:{cookie:session}})).status,401);
    assert.equal((await request(base+'/v1/content/water-alert/publish',{method:'POST',headers:{cookie:session}})).status,401);
    assert.equal((await request(base+'/operator/auth/logout',{method:'POST',headers:{cookie:session,origin:'https://evil.example'}})).status,403);
    assert.equal((await read(other,session)).status,200);
    assert.equal((await request(base+'/operator/auth/logout',{method:'POST',headers:{cookie:session,origin:'https://runtime.myriadgreen.co.za'}})).status,200);
    assert.equal((await read(other,session)).status,401);
    flowCookie=await begin();identity=owner();
    const second=await callback(flowCookie);
    const secondSession=second.headers.get('set-cookie').match(/__Host-magos_operator=[A-Za-z0-9_-]{43}/)[0];
    time+=8*60*60*1000+1;
    assert.equal((await read(base,secondSession)).status,401);
  }finally{
    await Promise.all(servers.map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections?.();})));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
