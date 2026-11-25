'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { google } = require('googleapis');

const ORIGIN = 'https://runtime.myriadgreen.co.za';
const CALLBACK = ORIGIN + '/operator/auth/callback';
const SESSION = '__Host-magos_operator';
const FLOW = '__Host-magos_oauth';
const FLOW_MS = 10 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;
const random = () => crypto.randomBytes(32).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const same = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x,y);
};
function cookie(req,name) {
  const matches = (req.get('cookie') || '').split(';').map(x=>x.trim())
    .filter(x=>x.startsWith(name+'='));
  return matches.length===1 ? matches[0].slice(name.length+1) : '';
}
const cookieOptions = {secure:true,httpOnly:true,sameSite:'lax',path:'/'};
function createOperatorLogin({
  env = process.env,
  now = Date.now,
  oauthFactory = (id, secret) => new google.auth.OAuth2(id,secret,CALLBACK),
  audit = event => console.info('[MAGOS operator auth]',event)
} = {}) {
  const clientId = env.MAGOS_OPERATOR_GOOGLE_CLIENT_ID || '';
  const clientSecret = env.MAGOS_OPERATOR_GOOGLE_CLIENT_SECRET || '';
  const ownerEmail = (env.MAGOS_OPERATOR_GOOGLE_OWNER_EMAIL || '').trim().toLowerCase();
  const ownerSub = (env.MAGOS_OPERATOR_GOOGLE_OWNER_SUB || '').trim();
  const signingKey = env.MAGOS_OPERATOR_SESSION_SIGNING_KEY || '';
  const dir = env.MAGOS_OPERATOR_SESSION_DIR || '';
  const configured = Boolean(clientId && clientSecret && ownerEmail &&
    signingKey.length>=43 && signingKey!==clientSecret && path.isAbsolute(dir));
  function privateDirectory() {
    if (!configured) return false;
    try {
      fs.mkdirSync(dir,{mode:0o700});
    } catch(e) { if(e.code!=='EEXIST') return false; }
    try {
      const stat=fs.lstatSync(dir);
      return stat.isDirectory() && !stat.isSymbolicLink() &&
        (stat.mode & 0o077)===0 && (typeof process.getuid!=='function'||stat.uid===process.getuid());
    } catch { return false; }
  }
  // Shared local worker security state. No raw cookie, provider token or password
  // is written to the audit trail. Security files live outside the web root.
  const epochFile = () => path.join(dir,'revocation-epoch');
  const disabledFile = () => path.join(dir,'owner-login-disabled');
  function epoch() {
    try {
      const value=fs.readFileSync(epochFile(),'utf8');
      return validId(value)?value:null;
    }catch(e){return e.code==='ENOENT'?'initial':null;}
  }
  function enabled() {
    if(!privateDirectory()||epoch()===null)return false;
    try {fs.lstatSync(disabledFile());return false;}
    catch(e){return e.code==='ENOENT';}
  }
  function event(type) {
    try {
      const date=new Date(now()).toISOString();
      const day=date.slice(0,10);
      const target=path.join(dir,'audit-'+day+'.jsonl');
      const fd=fs.openSync(target,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600);
      try {
        const st=fs.fstatSync(fd);
        if(!st.isFile()||(st.mode&0o077)!==0||st.size>=2*1024*1024)return false;
        fs.writeSync(fd,JSON.stringify({at:date,event:type})+'\n');
      }finally{fs.closeSync(fd);}
      try{audit(type);}catch{}
      return true;
    }catch{return false;}
  }
  function history() {
    const result=[];
    const files=fs.readdirSync(dir).filter(n=>/^audit-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort().reverse().slice(0,7);
    for(const name of files){
      const target=path.join(dir,name),st=fs.lstatSync(target);
      if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0||st.size>2*1024*1024+1024)continue;
      for(const line of fs.readFileSync(target,'utf8').trim().split('\n').reverse()){
        try{
          const row=JSON.parse(line);
          if(typeof row.at==='string'&&/^[A-Z_]{1,40}$/.test(row.event))result.push({at:row.at,event:row.event});
        }catch{}
        if(result.length>=100)return result;
      }
    }
    return result;
  }
  function rotateEpoch() {
    const tmp=path.join(dir,'epoch-'+random()+'.tmp');
    try {
      fs.writeFileSync(tmp,random(),{mode:0o600,flag:'wx'});
      fs.renameSync(tmp,epochFile());
      return true;
    }catch{try{fs.unlinkSync(tmp);}catch{}return false;}
  }
  const file = id => path.join(dir,digest(id)+'.json');
  function sign(data) {
    const encoded=Buffer.from(JSON.stringify(data)).toString('base64url');
    return encoded+'.'+crypto.createHmac('sha256',signingKey).update('operator-oauth-v1:'+encoded).digest('base64url');
  }
  function unsign(value) {
    try {
      if(value.length>4096)return null;
      const parts=value.split('.');
      if(parts.length!==2)return null;
      const [encoded,mac]=parts;
      const expected=crypto.createHmac('sha256',signingKey).update('operator-oauth-v1:'+encoded).digest('base64url');
      if(!same(mac,expected))return null;
      const flow=JSON.parse(Buffer.from(encoded,'base64url').toString());
      if(!validId(flow.state)||!validId(flow.nonce)||!validId(flow.verifier)||
        !Number.isFinite(flow.expires)||flow.expires<=now()||flow.expires>now()+FLOW_MS)return null;
      return flow;
    }catch{return null;}
  }
  function revoke(id) {
    if(!validId(id)||!privateDirectory())return false;
    try {fs.unlinkSync(file(id));return true;}
    catch(e){return e.code==='ENOENT';}
  }
  function session(req) {
    const id=cookie(req,SESSION);
    if(!validId(id)||!enabled())return null;
    try {
      const f=file(id),stat=fs.lstatSync(f);
      if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>4096)return null;
      const s=JSON.parse(fs.readFileSync(f,'utf8'));
      if(!Number.isFinite(s.expires)||s.expires<=now()||
        s.epoch!==epoch()||s.email!==ownerEmail||s.role!=='owner-read'||(ownerSub&&s.sub!==ownerSub))return null;
      return s;
    }catch{return null;}
  }
  function allowedIdentity(payload,flow) {
    if(!payload||payload.email_verified!==true||
      String(payload.email||'').toLowerCase()!==ownerEmail||
      typeof payload.sub!=='string'||!payload.sub||!same(payload.nonce,flow.nonce)||
      (ownerSub&&payload.sub!==ownerSub))return false;
    // Google is authoritative for Gmail and verified Workspace domain accounts.
    const domain=ownerEmail.split('@')[1];
    return domain==='gmail.com'||(Boolean(domain)&&payload.hd===domain);
  }
  function noStore(res) {
    res.set('Cache-Control','private, no-store');
    res.set('Referrer-Policy','no-referrer');
  }
  function mount(app) {
    app.get('/operator/auth/status',(req,res)=>{
      noStore(res);
      const active=session(req);
      res.json({configured,available:enabled(),authenticated:Boolean(active),
        expires_at:active?active.expires:null});
    });
    app.get('/operator/auth/start',(req,res)=>{
      noStore(res);
      if(!enabled())return res.status(503).send('Dashboard sign-in is not configured or has been disabled.');
      try {
        const flow={state:random(),nonce:random(),verifier:random(),epoch:epoch(),expires:now()+FLOW_MS};
        const challenge=crypto.createHash('sha256').update(flow.verifier).digest('base64url');
        const url=oauthFactory(clientId,clientSecret).generateAuthUrl({
          access_type:'online',scope:['openid','email'],state:flow.state,nonce:flow.nonce,
          code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'
        });
        res.cookie(FLOW,sign(flow),{...cookieOptions,maxAge:FLOW_MS});
        return res.redirect(303,url);
      }catch{return res.status(503).send('Dashboard sign-in is unavailable.');}
    });
    app.get('/operator/auth/callback',async(req,res)=>{
      noStore(res);
      res.clearCookie(FLOW,cookieOptions);
      const fail=(record=true)=>{if(record&&privateDirectory())event('LOGIN_DENIED');return res.redirect(303,'/operator?login=failed');};
      if(!enabled())return fail(false);
      const flow=unsign(cookie(req,FLOW));
      if(!flow||flow.epoch!==epoch()||!same(req.query.state,flow.state)||typeof req.query.code!=='string'||
        req.query.code.length>4096)return fail(false);
      try {
        const oauth=oauthFactory(clientId,clientSecret);
        const {tokens}=await oauth.getToken({code:req.query.code,codeVerifier:flow.verifier,redirect_uri:CALLBACK});
        if(!tokens?.id_token)return fail();
        const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:clientId});
        const payload=ticket.getPayload();
        if(!allowedIdentity(payload,flow)||!enabled()||flow.epoch!==epoch())return fail();
        // Prune expired sessions only after an independently authenticated login.
        for(const name of fs.readdirSync(dir)){
          if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
          const p=path.join(dir,name);
          try {
            const st=fs.lstatSync(p);
            if(st.isFile()&&!st.isSymbolicLink()&&st.mtimeMs<now()-SESSION_MS)fs.unlinkSync(p);
          }catch{}
        }
        const old=cookie(req,SESSION);
        if(validId(old)&&!revoke(old))return fail();
        const id=random(),expires=now()+SESSION_MS;
        fs.writeFileSync(file(id),JSON.stringify({sub:payload.sub,email:ownerEmail,role:'owner-read',epoch:flow.epoch,expires}),
          {mode:0o600,flag:'wx'});
        if(!event('LOGIN_SUCCESS')){revoke(id);return fail();}
        res.cookie(SESSION,id,{...cookieOptions,maxAge:SESSION_MS});
        return res.redirect(303,'/operator');
      }catch{return fail();}
    });
    app.get('/operator/auth/security',(req,res)=>{
      noStore(res);
      if(!session(req))return res.status(401).json({error:'UNAUTHORIZED'});
      try{return res.json({owner_only:true,public_registration:false,session_hours:8,events:history()});}
      catch{return res.status(503).json({error:'SECURITY_HISTORY_UNAVAILABLE'});}
    });
    app.post('/operator/auth/revoke-all',(req,res)=>{
      noStore(res);
      if(req.get('origin')!==ORIGIN)return res.status(403).json({error:'ORIGIN_REQUIRED'});
      if(!session(req))return res.status(401).json({error:'UNAUTHORIZED'});
      if(!rotateEpoch())return res.status(503).json({error:'SESSION_REVOCATION_FAILED'});
      res.clearCookie(SESSION,cookieOptions);
      res.clearCookie(FLOW,cookieOptions);
      return res.json({authenticated:false,all_human_sessions_revoked:true,audit_recorded:event('REVOKE_ALL')});
    });
    app.post('/operator/auth/logout',(req,res)=>{
      noStore(res);
      if(req.get('origin')!==ORIGIN)return res.status(403).json({error:'ORIGIN_REQUIRED'});
      const id=cookie(req,SESSION);
      if(validId(id)&&!revoke(id))return res.status(503).json({error:'SESSION_REVOCATION_FAILED'});
      res.clearCookie(SESSION,cookieOptions);
      res.clearCookie(FLOW,cookieOptions);
      event('LOGOUT');
      return res.json({authenticated:false});
    });
  }
  return {mount,session};
}

module.exports={createOperatorLogin};
