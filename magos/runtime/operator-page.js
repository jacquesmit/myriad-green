'use strict';
function operatorPage() {
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MAGOS | Operations</title>
<style>
:root{color-scheme:dark;font:15px system-ui,Arial,sans-serif;background:#081811;color:#e9f4ed}*{box-sizing:border-box}body{margin:0}header{padding:20px 30px;background:#063b21;display:flex;align-items:center;justify-content:space-between;gap:14px}h1{font-size:22px;margin:0}header p{margin:4px 0;color:#bdd5c6}main{max-width:1250px;margin:auto;padding:26px}button{background:#7ac943;color:#062716;border:0;border-radius:8px;padding:11px 18px;font-weight:750;cursor:pointer}button:disabled{opacity:.5}input{border:1px solid #4d6759;background:#10271b;color:white;border-radius:8px;padding:11px;width:min(100%,440px)}.login{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 20px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:13px;margin:18px 0 30px}.metric,.panel{background:#123021;border:1px solid #294937;border-radius:12px;padding:18px}.metric strong{display:block;font-size:34px}.metric span,.subtle{color:#bad2c3}.panel{overflow-x:auto}h2{margin:0 0 14px;font-size:19px}table{width:100%;border-collapse:collapse;min-width:650px}td,th{text-align:left;padding:12px;border-bottom:1px solid #335040;vertical-align:top}th{color:#bad2c3;font-size:12px;text-transform:uppercase}.state{font-size:12px;padding:6px 10px;border-radius:100px;background:#284b35}#message{min-height:24px}small{color:#bad2c3}
</style></head><body><header><div><h1>MAGOS / Myriad Green</h1><p>Operations command centre · authoritative read-only view</p></div><span class="state">V1 Preview</span></header><main>
<section class="login"><input id="credential" type="password" autocomplete="off" placeholder="Runtime access token (held only in this tab)" aria-label="Runtime access token"><button id="load">Load live operations</button><button id="clear" type="button">Clear</button></section><p id="message" role="status">Enter your runtime credential to view current operations. No credentials are saved.</p>
<section class="metrics" aria-label="Business overview"><div class="metric"><strong id="open_leads">—</strong><span>Open leads</span></div><div class="metric"><strong id="pending_quotes">—</strong><span>Pending quotes</span></div><div class="metric"><strong id="active_jobs">—</strong><span>Active jobs</span></div><div class="metric"><strong id="procurement_review">—</strong><span>Procurement reviews</span></div><div class="metric"><strong id="open_exceptions">—</strong><span>Exceptions</span></div></section>
<section class="panel"><h2>Workstreams</h2><nav id="filters" aria-label="Workstream selection"></nav><p id="selection" class="subtle">Select a record to inspect its canonical links.</p></section><section class="panel"><h2>Action queue</h2><table><thead><tr><th>Workstream</th><th>Canonical record</th><th>Required action</th></tr></thead><tbody id="queue"><tr><td colspan="3">Load operations to show your live action queue.</td></tr></tbody></table></section><p><small>Source: CRM, Commercial Register, Supplier procurement and Audit records. The dashboard does not change business records or authorize payments or orders.</small></p></main>
<script>
(()=>{
const $=id=>document.getElementById(id);
const keys=['open_leads','pending_quotes','active_jobs','procurement_review','open_exceptions'];
const sections=['leads','quotes','jobs','procurement','exceptions'];
let snapshot=null;
let credential='';
function blank(){snapshot=null;$('filters').replaceChildren();$('selection').textContent='Select a record to inspect its canonical links.';keys.forEach(k=>$(k).textContent='—');$('queue').replaceChildren();$('message').textContent='Credentials cleared. No session stored.';}
function renderSections(){
 const nav=$('filters');nav.replaceChildren();
 for(const section of sections){
  const btn=document.createElement('button');btn.type='button';btn.textContent=section+' ('+(snapshot.records?.[section]?.length||0)+')';
  btn.style.margin='0 8px 8px 0';btn.addEventListener('click',()=>showSection(section));
  nav.appendChild(btn);
 }
}
function showSection(section){
 const rows=snapshot?.records?.[section]||[];
 const view=$('selection');view.replaceChildren();
 const heading=document.createElement('h3');heading.textContent=section.toUpperCase()+' — '+rows.length+' records';view.appendChild(heading);
 if(!rows.length){const p=document.createElement('p');p.textContent='No open records';view.appendChild(p);return;}
 for(const record of rows){
  const b=document.createElement('button');b.type='button';b.textContent=record.id+' · '+record.status;
  b.style.margin='4px';b.addEventListener('click',()=>{
   view.querySelectorAll('dl').forEach(el=>el.remove());
   const dl=document.createElement('dl');
   for(const [k,v] of Object.entries(record)){
    if(!v)continue;
    const dt=document.createElement('dt');dt.textContent=k.replaceAll('_',' ');
    const dd=document.createElement('dd');dd.textContent=String(v);dl.append(dt,dd);
   }
   view.appendChild(dl);
   if(section==='quotes'){
    const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Inspect job readiness';
    inspect.addEventListener('click',async()=>{
      inspect.disabled=true;
      try{
        const response=await fetch('/v1/operator/job-readiness/'+encodeURIComponent(record.id),{headers:{Authorization:'Bearer '+credential},cache:'no-store'});
        const result=await response.json();
        const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(result,null,2);
        dl.appendChild(pre);
        if(result.opportunity_id){
          const evidenceResponse=await fetch('/v1/operator/deposit-evidence/'+encodeURIComponent(result.opportunity_id),{headers:{Authorization:'Bearer '+credential},cache:'no-store'});
          const evidence=await evidenceResponse.json();
          const financial=document.createElement('pre');financial.style.whiteSpace='pre-wrap';
          financial.textContent='Canonical deposit evidence (read-only): '+JSON.stringify(evidence,null,2);
          dl.appendChild(financial);
        }
      }catch(error){const p=document.createElement('p');p.textContent='Inspection failed: '+error.message;dl.appendChild(p);}
      finally{inspect.disabled=false;}
    });
    dl.appendChild(inspect);
   }
  });view.appendChild(b);
 }
}
$('clear').addEventListener('click',()=>{credential='';$('credential').value='';blank();});
$('load').addEventListener('click',async()=>{
 credential=$('credential').value;$('credential').value='';
 if(!credential){$('message').textContent='Access token required.';return;}
 $('load').disabled=true;$('message').textContent='Reading authoritative MGOS records…';
 try {
 const response=await fetch('/v1/operator/snapshot',{headers:{Authorization:'Bearer '+credential},cache:'no-store'});
 if(!response.ok){if(response.status===401)credential='';throw new Error(response.status===401?'Invalid credential':'Snapshot unavailable ('+response.status+')');}
 const data=await response.json();snapshot=data;renderSections();keys.forEach(k=>$(k).textContent=Number(data.counts?.[k]||0).toLocaleString());
 const tbody=$('queue');tbody.replaceChildren();
 for(const item of data.attention||[]){const tr=document.createElement('tr');for(const key of ['type','id','next_action']){const cell=document.createElement('td');cell.textContent=String(item[key]||'—');tr.appendChild(cell);}tbody.appendChild(tr);}
 if(!tbody.children.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=3;td.textContent='No outstanding actions returned.';tr.appendChild(td);tbody.appendChild(tr);}
 $('message').textContent='Live snapshot loaded. Read-only; refresh to update.';
 }catch(error){$('message').textContent=error.message;}finally{$('load').disabled=false;}
});
})();
</script></body></html>`;
}
module.exports={operatorPage};
