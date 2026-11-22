'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const groups = [
    ['Command centre', [['overview', 'Overview'], ['system', 'Whole MAGOS build'], ['exceptions', 'Exceptions']]],
    ['Clients and delivery', [['leads', 'Inbound enquiries'], ['clients', 'Inbound CRM'], ['prospects', 'Scraper / outbound prospects'], ['provenance', 'Provenance review'], ['quotes', 'Quotes & acceptance'], ['jobs', 'Active jobs'], ['dispatch', 'Dispatch & bookings'], ['evidence', 'Work proof']]],
    ['Commercial', [['finance', 'Finance & payments'], ['procurement', 'Procurement'], ['suppliers', 'Suppliers'], ['registers', 'Other registers']]],
  ];
  const labels = Object.fromEntries(groups.flatMap(([, entries]) => entries));
  const descriptions = {
    system: 'All MAGOS capabilities, live readiness and completion gates from the existing Control Hub.',
    leads: 'Verified operational inbound work and the next routing decision.',
    clients: 'Inbound CRM enquiries separated from scraped prospecting records.',
    prospects: 'Original scraper and outbound prospects, including converted prospects whose origin is preserved.',
    provenance: 'Imported and conflicting CRM records requiring proof before they count as inbound enquiries.',
    quotes: 'Pending quotes and accepted quotes waiting for a linked job.',
    jobs: 'Active jobs with their canonical opportunity and client links.',
    dispatch: 'Appointments, booking state, crew and supporting evidence.',
    evidence: 'Before and after evidence, variations and completion sign-off.',
    finance: 'Cleared allocations drive receipt totals and contract balances. Payment proof is shown separately.',
    procurement: 'Purchasing lines awaiting approval or technical review.',
    suppliers: 'Supplier approval, trading status and payment terms.',
    exceptions: 'Open issues and recorded follow-up actions.',
    registers: 'Open the existing supplier pricing, marketing, publishing and governance registers.',
  };
  const metrics = [
    ['open_leads', 'Inbound leads', 'leads'],
    ['outbound_prospects', 'Outbound prospects', 'prospects'],
    ['provenance_review', 'Source review', 'provenance'],
    ['pending_quotes', 'Pending quotes', 'quotes'],
    ['active_jobs', 'Active jobs', 'jobs'],
    ['contracts_with_balance', 'Contracts with balance', 'finance'],
    ['procurement_review', 'Purchasing review', 'procurement'],
    ['open_exceptions', 'Open exceptions', 'exceptions'],
  ];
  const actionRank = ['EXCEPTION', 'ACCEPTED_QUOTE_REVIEW', 'PROCUREMENT_REVIEW', 'QUOTE_FOLLOWUP', 'JOB_ACTION'];
  const dateFormat = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' });
  const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
  const pageSize = 25;
  let department = 'overview';
  let page = 0;
  let queuePage = 0;
  let credential = '';
  let data;
  let coverage;
  let coverageRequest;
  let request;
  let inspection;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, callback, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', callback);
    return node;
  }

  function link(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        ['docs.google.com', 'drive.google.com', 'mail.google.com'].includes(url.hostname) ? url.href : '';
    } catch { return ''; }
  }

  function notice(body, text) {
    const row = element('tr');
    const cell = element('td', text);
    cell.colSpan = 3;
    row.append(cell);
    body.replaceChildren(row);
  }

  function paginate(container, index, total, go) {
    container.replaceChildren();
    container.hidden = total <= pageSize;
    if (container.hidden) return;
    const previous = button('Previous', () => go(index - 1), 'secondary');
    const next = button('Next', () => go(index + 1), 'secondary');
    previous.disabled = index === 0;
    next.disabled = (index + 1) * pageSize >= total;
    container.append(previous, element('span', (index * pageSize + 1) + '–' + Math.min((index + 1) * pageSize, total) + ' of ' + total), next);
  }

  function show(key, recordId) {
    department = key;
    page = 0;
    $('search').value = recordId || '';
    hideDetail();
    renderView();
    if (key === 'system' && !coverage && credential) loadCoverage();
    if (recordId) {
      const record = data?.departments[key]?.records?.find(item => item.id === recordId);
      if (record) showDetail(record);
    }
  }

  function renderNavigation() {
    const nav = $('filters');
    if (!nav.children.length) nav.replaceChildren(...groups.map(([title, entries]) => {
      const group = element('div', undefined, 'nav-group');
      group.append(element('p', title));
      for (const [key, name] of entries) {
        const item = button(name, () => show(key));
        item.dataset.department = key;
        group.append(item);
      }
      return group;
    }));
    for (const item of nav.querySelectorAll('button')) {
      if (department === item.dataset.department) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  function renderOverview() {
    $('metrics').replaceChildren(...metrics.map(([key, label, target]) => {
      const item = button(undefined, () => show(target), 'metric');
      const count = data?.overview_counts[key];
      item.append(element('strong', count === undefined ? '—' : count + (data.departments[target].state === 'PARTIAL' ? '*' : '')), element('span', label));
      if (count !== undefined && data.departments[target].state === 'PARTIAL') {
        item.append(element('small', 'Excludes duplicate IDs', 'muted'));
      }
      return item;
    }));
    const queue = $('queue');
    $('queue-pages').hidden = true;
    if (!data) return notice(queue, 'Load live operations to view the action queue.');
    const items = data.attention.slice().sort((a, b) => actionRank.indexOf(a.type) - actionRank.indexOf(b.type));
    if (!items.length) return notice(queue, 'No actions returned from the available registers.');
    queue.replaceChildren(...items.slice(queuePage * pageSize, (queuePage + 1) * pageSize).map(item => {
      const row = element('tr');
      const id = element('td');
      id.append(button(item.id, () => show(item.department, item.id), 'row-link'));
      row.append(element('td', labels[item.department]), id, element('td', item.next_action || '—'));
      return row;
    }));
    paginate($('queue-pages'), queuePage, items.length, index => { queuePage = index; renderOverview(); });
  }

  function renderRecords() {
    const rows = $('rows');
    const state = department === 'system' ? coverage : data?.departments[department];
    const query = $('search').value.trim().toLowerCase();
    const matches = (state?.records || []).filter(item =>
      [item.id, item.title, item.status, item.next_action, ...Object.values(item.details)].some(value =>
        String(value ?? '').toLowerCase().includes(query))
    );
    const readable = state?.state === 'LIVE' || state?.state === 'PARTIAL';
    const conflicts = state?.conflict_count ? ' · ' + state.conflict_count + ' duplicate IDs need review' : '';
    $('record-count').textContent = readable ? matches.length + ' records' + conflicts : 'Records unavailable';
    $('search').disabled = !readable;
    $('record-pages').hidden = true;
    if (!readable) return notice(rows, data ? 'This register could not be read. Open the source or try refreshing.' : 'Load live operations to view these records.');
    if (!matches.length) return notice(rows, query ? 'No matching records.' : 'No records in this view.');
    rows.replaceChildren(...matches.slice(page * pageSize, (page + 1) * pageSize).map(item => {
      const row = element('tr');
      const id = element('td');
      id.append(button(item.title || item.id, () => showDetail(item), 'row-link'));
      if (item.title) id.append(element('small', item.id, 'muted'));
      row.append(id, element('td', item.status.replaceAll('_', ' ')), element('td', item.next_action || '—'));
      return row;
    }));
    paginate($('record-pages'), page, matches.length, index => { page = index; hideDetail(); renderRecords(); });
  }

  function renderView() {
    renderNavigation();
    $('overview').hidden = department !== 'overview';
    $('department').hidden = department === 'overview';
    if (department === 'overview') return renderOverview();
    $('department-title').textContent = labels[department];
    $('department-note').textContent = descriptions[department];
    $('directory').hidden = department !== 'registers';
    $('records').hidden = department === 'registers';
    const source = $('source');
    const url = link(department === 'system' ? coverage?.source?.url : data?.departments[department]?.source?.url);
    source.hidden = !url;
    if (url) source.href = url;
    else source.removeAttribute('href');
    if (department === 'registers') {
      const anchors = (data?.links || []).flatMap(entry => {
        const href = link(entry.url);
        if (!href) return [];
        const anchor = element('a', entry.label + ' ↗');
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        return [anchor];
      });
      $('directory').replaceChildren(...(anchors.length ? anchors : [element('p', 'Load live operations to open the register directory.')]));
      return;
    }
    renderRecords();
  }

  function hideDetail() {
    inspection?.abort();
    inspection = undefined;
    $('detail').hidden = true;
    $('detail').replaceChildren();
  }

  function showDetail(item) {
    hideDetail();
    const target = $('detail');
    target.hidden = false;
    target.append(element('h3', item.title ? item.title + ' · ' + item.id : item.id));
    const list = element('dl');
    for (const [key, value] of Object.entries({ Status: item.status, 'Next action': item.next_action, ...item.details })) {
      if (value === '') continue;
      const name = key.replaceAll('_', ' ');
      const valueCell = element('dd');
      const url = link(value);
      if (url) {
        const anchor = element('a', 'Open source evidence ↗');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        valueCell.append(anchor);
      } else valueCell.textContent = value === null ? 'Unknown' : typeof value === 'number' && key.endsWith('(ZAR)') ? zar.format(value) : value;
      list.append(element('dt', name), valueCell);
    }
    target.append(list);
    if (department === 'jobs' && item.details?.job_id) {
      const journeyOutput=element('p');
      journeyOutput.setAttribute('role','status');
      const journeyCheck=button('Inspect full job lifecycle',
        ()=>inspectWholeJob(item.details.job_id,journeyOutput,journeyCheck),'secondary');
      target.append(journeyCheck,journeyOutput);
      const output = element('p');
      output.setAttribute('role','status');
      const check = button('Inspect actual costs & closeout',
        () => inspectJobCloseout(item.details.job_id,output,check),'secondary');
      target.append(check,output);
      const scheduleOutput=element('p');
      scheduleOutput.setAttribute('role','status');
      const scheduleCheck=button('Inspect schedule readiness',
        ()=>inspectScheduling(item.details.job_id,scheduleOutput,scheduleCheck),'secondary');
      target.append(scheduleCheck,scheduleOutput);
      const careOutput=element('p');
      careOutput.setAttribute('role','status');
      const careCheck=button('Inspect warranties & aftercare',
        ()=>inspectAftercare(item.details.job_id,careOutput,careCheck),'secondary');
      target.append(careCheck,careOutput);
      const closureOutput=element('p');
      closureOutput.setAttribute('role','status');
      const closureCheck=button('Inspect complete job closure',
        ()=>inspectOperationalClosure(item.details.job_id,closureOutput,closureCheck),'secondary');
      target.append(closureCheck,closureOutput);
      const costArea=element('section');
      costArea.append(element('h3','Record provisional job expense'));
      const costInputs={};
      function costField(name,labelText,type='text'){
        const label=element('label',labelText);
        const input=element('input');
        input.type=type;input.autocomplete='off';input.setAttribute('aria-label',labelText);
        label.append(input);costArea.append(label);costInputs[name]=input;
      }
      costField('sourceEventId','Unique receipt or expense reference');
      costField('description','Expense description');
      costField('amountZar','Amount in rand, e.g. 249.50');
      const categoryLabel=element('label','Direct cost category');
      const categorySelect=element('select');
      for(const option of ['MATERIALS','LABOUR','TRAVEL','TOOL_HIRE','SUBCONTRACTOR','DISPOSAL','OTHER_DIRECT']){
        const o=element('option',option.replaceAll('_',' '));
        o.value=option;categorySelect.append(o);
      }
      categoryLabel.append(categorySelect);costArea.append(categoryLabel);
      costInputs.category=categorySelect;
      costField('approvalToken','Provisional expense authorization token','password');
      const costOutput=element('p');
      costOutput.setAttribute('role','status');
      const costPreview=button('Preview provisional expense',
        ()=>submitProvisionalCost(item.details.job_id,costInputs,costOutput,costPreview,true),'secondary');
      const costCommit=button('Record pending expense',
        ()=>submitProvisionalCost(item.details.job_id,costInputs,costOutput,costCommit,false),'secondary');
      costArea.append(costPreview,costCommit,costOutput);
      const verification=element('section');
      verification.append(element('h3','Verify an existing pending expense'));
      const verificationInputs={};
      for(const [key,title,type] of [
        ['provisionalCostId','Pending expense ID (DP-...)','text'],
        ['sourceEventId','Verified supplier/bank receipt event reference','text'],
        ['verificationToken','Independent direct-cost verification token','password']
      ]){
        const label=element('label',title);
        const field=element('input');
        field.type=type;field.autocomplete='off';field.setAttribute('aria-label',title);
        label.append(field);verification.append(label);verificationInputs[key]=field;
      }
      const verificationOutput=element('p');
      verificationOutput.setAttribute('role','status');
      const previewVerification=button('Preview receipt verification',
        ()=>verifyPendingCost(item.details.job_id,verificationInputs,
          verificationOutput,previewVerification,true),'secondary');
      const commitVerification=button('Verify expense against receipt',
        ()=>verifyPendingCost(item.details.job_id,verificationInputs,
          verificationOutput,commitVerification,false),'secondary');
      verification.append(previewVerification,commitVerification,verificationOutput);
      costArea.append(verification);
      const supplierAudit=element('section');
      supplierAudit.append(element('h3','Inspect supplier allocation evidence'));
      const allocationLabel=element('label','Supplier Cost_Allocations ID');
      const allocationInput=element('input');
      allocationInput.type='text';allocationInput.autocomplete='off';
      allocationInput.setAttribute('aria-label','Supplier Cost_Allocations ID');
      allocationLabel.append(allocationInput);supplierAudit.append(allocationLabel);
      const supplierResult=element('p');
      supplierResult.setAttribute('role','status');
      const supplierCheck=button('Check supplier receipt and allocation',
        ()=>inspectSupplierCostAllocation({
          jobId:item.details.job_id,
          opportunityId:item.details.opportunity_id,
          allocationId:allocationInput.value.trim(),
          output:supplierResult,button:supplierCheck
        }),'secondary');
      supplierAudit.append(supplierCheck,supplierResult);
      costArea.append(supplierAudit);
      const queueOutput=element('p');
      queueOutput.setAttribute('role','status');
      const queueCheck=button('Review all supplier allocations for this job',
        ()=>inspectSupplierCostQueue(item.details.job_id,queueOutput,queueCheck),'secondary');
      costArea.append(queueCheck,queueOutput);
      target.append(costArea);
    }
    if(department==='finance' && item.details?.['Invoice ID']) {
      const receivableOutput=element('p');
      receivableOutput.setAttribute('role','status');
      const receivableCheck=button('Reconcile invoice & payments',
        ()=>inspectReceivable(item.details['Invoice ID'],receivableOutput,receivableCheck),'secondary');
      target.append(receivableCheck,receivableOutput);
    }
    if (department === 'quotes') {
      const output = element('p');
      output.setAttribute('role', 'status');
      const check = button('Inspect job readiness', () => inspectQuote(item.id, output, check), 'secondary');
      target.append(check, output);
      // This credential is separate from read access and is erased after use.
      // User action cannot bypass server-owned signature verification.
      const authLabel=element('label','Quote acceptance authorization token');
      const authInput=element('input');
      authInput.type='password';
      authInput.autocomplete='off';
      authInput.setAttribute('aria-label','Quote acceptance authorization token');
      authLabel.append(authInput);
      const acceptOutput=element('p');
      acceptOutput.setAttribute('role','status');
      const preview=button('Preview reviewed signature acceptance',
        ()=>reviewQuoteAcceptance(item.id,authInput,acceptOutput,preview,true),'secondary');
      const commit=button('Accept independently reviewed quote',
        ()=>reviewQuoteAcceptance(item.id,authInput,acceptOutput,commit,false),'secondary');
      target.append(authLabel,preview,commit,acceptOutput);
    }
    target.scrollIntoView({ block: 'nearest' });
  }

  async function loadCoverage() {
    coverageRequest?.abort();
    const active = new AbortController();
    coverageRequest = active;
    try {
      const response = await read('/v1/operator/coverage',active.signal);
      if(!response.ok) throw new Error('COVERAGE_SOURCE_UNAVAILABLE');
      const result = await response.json();
      if(coverageRequest !== active || !credential) return;
      if(result.schema_version !== 'MAGOS_SYSTEM_COVERAGE_V1' ||
         !Array.isArray(result.capabilities) || result.side_effects !== false) {
        throw new Error('INVALID_COVERAGE_RESPONSE');
      }
      coverage={
        state:'LIVE',
        records:result.capabilities.map(cap=>({
          id:cap.id,title:cap.name,status:cap.state,
          next_action:cap.next_action,
          details:{
            implementation:cap.implementation,
            priority:cap.priority,
            completion_gate:cap.completion_gate,
            missing_validation:cap.missing_validation,
            primary_gap:cap.primary_gap
          }
        })),
        source:{url:'https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit'}
      };
    }catch {
      if(coverageRequest!==active || !credential)return;
      coverage={state:'UNAVAILABLE',records:[]};
    } finally {
      if(coverageRequest===active && department==='system')renderView();
    }
  }

  function read(path, signal) {
    return fetch(path, {
      headers: { 'X-MAGOS-Operator-Token': credential },
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
  }

  async function inspectSupplierCostQueue(jobId,output,button){
    if(!jobId){output.textContent='Canonical job ID missing.';return;}
    button.disabled=true;
    output.textContent='Checking every linked supplier allocation and its evidence…';
    const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),20000);
    try{
      const response=await read('/v1/operator/job-supplier-cost-queue/'+encodeURIComponent(jobId),abort.signal);
      const result=await response.json();
      if(result.schema_version!=='MAGOS_JOB_SUPPLIER_COST_QUEUE_V1')
        throw Error('QUEUE_UNAVAILABLE');
      output.textContent=[
        (result.counts?.total||0)+' supplier allocations',
        (result.counts?.review||0)+' require evidence review',
        ...((result.items||[]).slice(0,20).map(item=>
          item.allocation_id+': '+(item.blockers||[]).join(', '))),
        (result.items||[]).length>20?'Additional exceptions not shown; inspect source register':'',
        'No supplier invoices or job costs changed'
      ].filter(Boolean).join(' · ');
    }catch{
      output.textContent='Allocation queue unavailable; review canonical supplier source.';
    }finally{clearTimeout(deadline);button.disabled=false;}
  }

  async function inspectSupplierCostAllocation({jobId,opportunityId,allocationId,output,button}){
    if(!allocationId||!opportunityId||!jobId){
      output.textContent='An exact job, opportunity and supplier allocation ID are required.';
      return;
    }
    button.disabled=true;
    output.textContent='Reading supplier allocation, invoice and reconciliation evidence…';
    const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),15000);
    try{
      const query=new URLSearchParams({jobId,opportunityId});
      const response=await read('/v1/operator/supplier-cost-allocation/'+
        encodeURIComponent(allocationId)+'?'+query.toString(),abort.signal);
      const result=await response.json();
      if(!Array.isArray(result.blockers)&&result.verified!==true)
        throw Error('SUPPLIER_INSPECTION_UNAVAILABLE');
      output.textContent=[
        result.verified===true?'Source evidence verified':'Source evidence requires review',
        ...(result.blockers||[]),
        result.verified===true?'Invoice and stock review passed':'No financial cost released'
      ].join(' · ');
    }catch{
      output.textContent='Supplier inspection unavailable; check canonical Cost_Allocations.';
    }finally{clearTimeout(deadline);button.disabled=false;}
  }

  async function verifyPendingCost(jobId,inputs,output,button,dryRun){
    const privateToken=inputs.verificationToken.value.trim();
    const body={jobId,sourceEventId:inputs.sourceEventId.value.trim(),
      provisionalCostId:inputs.provisionalCostId.value.trim(),dryRun};
    if(!privateToken||!body.sourceEventId||!body.provisionalCostId){
      output.textContent='Provide pending cost ID, receipt event reference and verification token.';
      return;
    }
    if(!dryRun&&!window.confirm(
      'Verify this existing expense against an independently reviewed receipt? This updates the existing cost row, not a new expense.'
    )){
      inputs.verificationToken.value='';
      return;
    }
    button.disabled=true;
    output.textContent=dryRun?'Checking independent receipt and allocation…':
      'Updating verified expense in place…';
    const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),20000);
    try{
      const response=await fetch('/v1/governance/verify-provisional-cost',{
        method:'POST',cache:'no-store',redirect:'error',signal:abort.signal,
        headers:{'content-type':'application/json',
          'x-magos-direct-cost-token':privateToken},
        body:JSON.stringify(body)
      });
      const result=await response.json();
      output.textContent=[
        result.state?.replaceAll('_',' ')||result.error||'UNAVAILABLE',
        result.reason_code?.replaceAll('_',' '),
        result.provisional_cost_id,
        result.readback_verified&&'Existing expense updated and read back',
        result.additional_cost_rows===0&&'No duplicate expense created',
        'Job profit still requires final reconciliation'
      ].filter(Boolean).join(' · ');
    }catch{
      output.textContent='Verification unavailable; inspect Commercial cost ID before retrying.';
    }finally{
      clearTimeout(deadline);
      inputs.verificationToken.value='';
      button.disabled=false;
    }
  }

  async function submitProvisionalCost(jobId,inputs,output,button,dryRun){
    const data={
      jobId,sourceEventId:inputs.sourceEventId.value.trim(),
      description:inputs.description.value.trim(),
      amountZar:inputs.amountZar.value.trim(),
      category:inputs.category.value,dryRun
    };
    const privateToken=inputs.approvalToken.value.trim();
    if(!privateToken || !data.sourceEventId || !data.description || !data.amountZar){
      output.textContent='Enter the expense reference, description, amount and separate authorization token.';
      return;
    }
    if(!dryRun&&!window.confirm(
      'Record a provisional expense for this job? The value will remain unverified until receipt and allocation reconciliation.'
    )){
      inputs.approvalToken.value='';return;
    }
    button.disabled=true;
    output.textContent=dryRun?'Preparing expense preview…':'Recording the provisional expense…';
    const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),20000);
    try{
      const response=await fetch('/v1/governance/provisional-job-cost',{
        method:'POST',cache:'no-store',redirect:'error',signal:abort.signal,
        headers:{'content-type':'application/json','x-magos-provisional-cost-token':privateToken},
        body:JSON.stringify(data)
      });
      const result=await response.json();
      output.textContent=[
        result.state?.replaceAll('_',' ')||result.error||'UNAVAILABLE',
        result.reason_code?.replaceAll('_',' '),
        result.direct_cost_id,
        result.amount_zar!==undefined?'R '+result.amount_zar.toFixed(2):'',
        result.readback_verified&&'Written and independently read back',
        'Not verified profit'
      ].filter(Boolean).join(' · ');
      if(response.ok&&!dryRun&&['COMMITTED','DUPLICATE_NO_OP'].includes(result.state)){
        inputs.amountZar.value='';inputs.description.value='';
      }
    }catch{
      output.textContent='Expense write/readback failed. Verify expense reference in Commercial before retry.';
    }finally{
      clearTimeout(deadline);
      inputs.approvalToken.value='';
      button.disabled=false;
    }
  }

  async function inspectOperationalClosure(jobId,output,button){
    const active=new AbortController();
    inspection?.abort();inspection=active;button.disabled=true;
    output.textContent='Reconciling complete job, cost, payment and warranty evidence…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try {
      const response=await read('/v1/operator/operational-closure/'+encodeURIComponent(jobId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(!result.schema_version)throw Error('CLOSURE_SOURCE_UNAVAILABLE');
      output.textContent=[
        result.state.replaceAll('_',' '),
        ...(result.blockers||[]),
        ...(result.next_actions||[]),
        'Owner close authorization still required'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent='Closeout reconciliation unavailable; review canonical source records.';
    }finally{clearTimeout(deadline);if(inspection===active)button.disabled=false;}
  }

  async function inspectReceivable(invoiceId,output,button){
    const active=new AbortController();
    inspection?.abort();inspection=active;button.disabled=true;
    output.textContent='Reconciling invoice lines and cleared allocations…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/receivables/'+encodeURIComponent(invoiceId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(!result.schema_version)throw Error('RECEIVABLE_UNAVAILABLE');
      output.textContent=[
        result.state.replaceAll('_',' '),
        result.recorded_balance_zar===null?'Balance unverified':
          'Recorded balance '+zar.format(result.recorded_balance_zar),
        ...(result.issues||[]),...(result.notes||[]),
        'Bank verification not established by this read'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent='Invoice reconciliation unavailable; check Commercial register.';
    }finally{clearTimeout(deadline);if(inspection===active)button.disabled=false;}
  }

  async function inspectAftercare(jobId,output,button){
    const active=new AbortController();
    inspection?.abort();inspection=active;button.disabled=true;
    output.textContent='Checking installed assets, warranties and service policy…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/aftercare/'+encodeURIComponent(jobId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(!result.schema_version)throw Error('AFTERCARE_UNAVAILABLE');
      output.textContent=[
        result.state.replaceAll('_',' '),
        (result.asset_count||0)+' verified installed-part records',
        (result.service_due_candidates||[]).length+' policy-backed service candidates',
        ...(result.issues||[]),
        'No client outreach authorized'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent='Aftercare evidence unavailable; check Installed Parts.';
    }finally{clearTimeout(deadline);if(inspection===active)button.disabled=false;}
  }

  async function inspectScheduling(jobId,output,button) {
    const active=new AbortController();
    inspection?.abort();
    inspection=active;
    button.disabled=true;
    output.textContent='Checking funds, procurement, material, crew and provider booking…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/scheduling-readiness/'+encodeURIComponent(jobId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(!result.schema_version)throw Error('SCHEDULING_UNAVAILABLE');
      output.textContent=[
        result.state.replaceAll('_',' '),
        ...(result.blockers||[]),
        ...(result.review_reasons||[]),
        'Calendar availability still requires provider verification'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent='Scheduling evidence unavailable. Review source bookings.';
    }finally{
      clearTimeout(deadline);
      if(inspection===active)button.disabled=false;
    }
  }

  async function inspectWholeJob(jobId,output,button) {
    const active=new AbortController();
    inspection?.abort();inspection=active;button.disabled=true;
    output.textContent='Checking the accepted quote, payment evidence, job, schedule and closure…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/job-lifecycle/'+encodeURIComponent(jobId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(result.schema_version!=='MAGOS_JOB_LIFECYCLE_V1')
        throw Error('JOB_LIFECYCLE_UNAVAILABLE');
      const names=(result.stages||[]).map(stage=>
        stage.name.replaceAll('_',' ')+': '+stage.state.replaceAll('_',' '));
      output.textContent=[
        'Business phase: '+(result.phase||'REVIEW_REQUIRED').replaceAll('_',' '),
        ...names,
        'Next: '+(result.next_action||'Review canonical source evidence'),
        'Bank settlement and actual completion require independent verification'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent=
        'Unified job evidence unavailable. Inspect canonical job and finance registers.';
    }finally{
      clearTimeout(deadline);
      if(inspection===active)button.disabled=false;
    }
  }

  async function inspectJobCloseout(jobId,output,button) {
    const active=new AbortController();
    inspection?.abort();
    inspection=active;
    button.disabled=true;
    output.textContent='Checking variations, work proof and actual costs…';
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/job-closeout/'+encodeURIComponent(jobId),active.signal);
      const result=await response.json();
      if(inspection!==active)return;
      if(!result.schema_version)throw Error('CLOSEOUT_UNAVAILABLE');
      output.textContent=[
        result.state.replaceAll('_',' '),
        result.blockers?.length?result.blockers.length+' unresolved controls':'No immediate closeout blockers',
        result.contract_value_zar===null?'Revenue unverified':'Contract '+zar.format(result.contract_value_zar),
        'Known direct costs '+zar.format(result.evidenced_cost_sum_zar||0),
        'Final profit not independently verified'
      ].join(' · ');
    }catch{
      if(inspection===active)output.textContent='Closeout evidence unavailable; inspect the canonical registers.';
    }finally{
      clearTimeout(deadline);
      if(inspection===active)button.disabled=false;
    }
  }

  async function reviewQuoteAcceptance(id,input,output,button,dryRun){
    const credentialForAction=input.value.trim();
    if(!credentialForAction){
      output.textContent='Separate quote-acceptance credential required.';
      return;
    }
    if(!dryRun && !window.confirm(
      'Accept this exact reviewed quotation? This changes the Commercial quote status. It will NOT create a job, clear payment or order materials.'
    )){
      input.value='';
      return;
    }
    button.disabled=true;
    output.textContent=dryRun?'Reviewing signed acceptance and canonical quote…':
      'Verifying signed receipt and committing canonical quote acceptance…';
    const active=new AbortController(),deadline=setTimeout(()=>active.abort(),20000);
    try{
      const response=await fetch('/v1/governance/accept-reviewed-quote',{
        method:'POST',cache:'no-store',redirect:'error',signal:active.signal,
        headers:{'content-type':'application/json','x-magos-acceptance-token':credentialForAction},
        body:JSON.stringify({quoteId:id,dryRun})
      });
      const result=await response.json();
      output.textContent=[
        result.state?.replaceAll('_',' ')||result.error||'REQUEST_FAILED',
        result.reason_code?.replaceAll('_',' '),
        result.quote_version&&'Quote version '+result.quote_version,
        result.readback_verified===true&&'Canonical quote read-back verified',
        result.state==='COMMITTED'&&'No job or payment changes performed'
      ].filter(Boolean).join(' · ');
    }catch{
      output.textContent='Acceptance operation unavailable. Check canonical audit and do not retry blindly.';
    }finally{
      clearTimeout(deadline);
      input.value='';
      button.disabled=false;
    }
  }

  async function inspectQuote(id, output, button) {
    const active = new AbortController();
    inspection?.abort();
    inspection = active;
    button.disabled = true;
    output.textContent = 'Reading recorded job and payment evidence…';
    const deadline = setTimeout(() => active.abort(), 15000);
    try {
      const response = await read('/v1/operator/job-activation/' + encodeURIComponent(id), active.signal);
      const result = await response.json();
      if (inspection !== active) return;
      if (!response.ok && !result.state) throw new Error('Inspection unavailable');
      const checks = result.checks || {};
      output.textContent = [
        result.state?.replaceAll('_', ' '),
        checks.signed_acceptance && 'Signed acceptance ' + checks.signed_acceptance.replaceAll('_', ' '),
        checks.financial_evidence && 'Financial evidence ' + checks.financial_evidence.replaceAll('_', ' '),
        result.next_action,
      ].filter(Boolean).join(' · ');
    } catch {
      if (inspection === active) output.textContent = 'Readiness evidence is unavailable. Refresh and try again.';
    } finally {
      clearTimeout(deadline);
      if (inspection === active) button.disabled = false;
    }
  }

  function state(message, label, style = '') {
    $('message').textContent = message;
    $('connection').textContent = label;
    $('connection').dataset.state = style;
  }

  function lock(message = 'Dashboard locked. Enter your access token to load operations.') {
    request?.abort();
    request = undefined;
    coverageRequest?.abort();
    coverageRequest = undefined;
    coverage = undefined;
    credential = '';
    data = undefined;
    $('credential').value = '';
    $('credential').disabled = false;
    $('load').disabled = false;
    $('load').textContent = 'Load live operations';
    $('clear').hidden = true;
    $('asof').textContent = '';
    $('rows').replaceChildren();
    $('directory').replaceChildren();
    $('record-pages').replaceChildren();
    $('queue-pages').replaceChildren();
    $('record-count').textContent = '';
    $('source').removeAttribute('href');
    state(message, 'Locked');
    show('overview');
  }

  $('clear').addEventListener('click', () => lock());
  $('search').addEventListener('input', () => { page = 0; hideDetail(); renderRecords(); });
  $('login').addEventListener('submit', async event => {
    event.preventDefault();
    const entered = $('credential').value.trim();
    if (!entered && !credential) {
      state('Enter the dashboard access token.', 'Locked');
      $('credential').focus();
      return;
    }
    credential = entered || credential;
    $('credential').value = '';
    $('credential').disabled = true;
    $('load').disabled = true;
    $('clear').hidden = false;
    const active = new AbortController();
    request?.abort();
    request = active;
    state('Reading the authoritative MAGOS registers…', 'Checking');
    const deadline = setTimeout(() => active.abort(), 30000);
    try {
      const response = await read('/v1/operator/dashboard', active.signal);
      const result = await response.json();
      if (request !== active) return;
      if (response.status === 401) return lock('The dashboard access token was rejected.');
      if (result.error === 'OPERATOR_ACCESS_NOT_CONFIGURED') return lock('Dashboard access has not been configured on the server.');
      if (!response.ok || result.schema_version !== 'MAGOS_OPERATOR_DASHBOARD/V1' || result.side_effects !== false ||
        !result.departments || !result.overview_counts || !Array.isArray(result.attention) || !Array.isArray(result.links)) {
        throw new Error('Dashboard unavailable');
      }
      data = result;
      page = 0;
      queuePage = 0;
      hideDetail();
      $('asof').textContent = 'Checked ' + dateFormat.format(new Date(data.checked_at)) + ' SAST';
      $('load').textContent = 'Refresh operations';
      const departments = Object.values(data.departments);
      const unavailable = departments.filter(item => item.state === 'UNAVAILABLE').length;
      const conflicts = departments.reduce((total, item) => total + (item.conflict_count || 0), 0);
      const issues = [
        unavailable && unavailable + ' register views are unavailable.',
        conflicts && conflicts + ' duplicate IDs require review and are excluded from counts.',
      ].filter(Boolean);
      state(issues.join(' ') || 'Showing the latest read from the MAGOS registers.',
        issues.length ? 'Partial data' : 'Live data', issues.length ? 'partial' : 'live');
      renderView();
    } catch {
      if (request === active) state(data ? 'Refresh failed. The last successful read is still displayed.' : 'MAGOS could not be reached. Try again.', data ? 'Stale data' : 'Unavailable', 'partial');
    } finally {
      clearTimeout(deadline);
      if (request === active) $('load').disabled = false;
    }
  });
  renderView();
})();
