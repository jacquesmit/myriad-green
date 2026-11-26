'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const groups = [
    ['Command centre', [['overview', 'Overview'], ['system', 'Whole MAGOS build'], ['systems', 'System directory'], ['gates', 'Lifecycle gates'], ['packages', 'Core build queue'], ['automations', 'Automation directory'], ['exceptions', 'Exceptions']]],
    ['Clients and delivery', [['leads', 'Inbound enquiries'], ['clients', 'Inbound CRM'], ['prospects', 'Scraper / outbound prospects'], ['provenance', 'Provenance review'], ['conversions', 'Lead-to-job conversion'], ['quotes', 'Quotes & acceptance'], ['jobs', 'Active jobs'], ['dispatch', 'Dispatch & bookings'], ['evidence', 'Work proof'], ['variations', 'Scope variations']]],
    ['Commercial', [['finance', 'Finance & payments'], ['labour', 'Labour cost review'], ['procurement', 'Procurement'], ['suppliers', 'Suppliers'], ['registers', 'Other registers']]],
  ];
  const labels = Object.fromEntries(groups.flatMap(([, entries]) => entries));
  const descriptions = {
    system: 'Business capability acceptance and proposed rollout targets from the existing Control Hub.',
    systems: 'Registered active, planned and legacy systems; source labels are not production acceptance.',
    gates: 'Required lifecycle transitions and evidence; transition names are not proof of passing.',
    packages: 'Original core development packages, recorded states and next executable actions.',
    automations: 'Registered automation purpose and source status; not independently verified provider activity.',
    leads: 'Verified operational inbound work and the next routing decision.',
    clients: 'Inbound CRM enquiries separated from scraped prospecting records.',
    prospects: 'Original scraper and outbound prospects, including converted prospects whose origin is preserved.',
    provenance: 'Imported and conflicting CRM records requiring proof before they count as inbound enquiries.',
    conversions: 'Original acquisition plus verified inbound contact event links through opportunity, quotation and job. Payments and margin require independent evidence.',
    quotes: 'Recorded issued quotes, local validity deadlines, and accepted quotes awaiting governed job release. No automatic sending.',
    jobs: 'All recorded jobs, including completed and historical work, so financial closeout, evidence and aftercare remain accessible. Active jobs KPI excludes completed and cancelled jobs.',
    dispatch: 'Appointments, booking state, crew and supporting evidence.',
    evidence: 'Before and after evidence, variations and completion sign-off.',
    variations: 'Simpro/Fergus benchmark: changed scope, client consent, pricing, invoicing and retrospective exceptions.',
    finance: 'Cleared allocations drive receipt totals and contract balances. Payment proof is shown separately.',
    labour: 'Aspire/LMN benchmark: approved rate inputs versus provisional crew-day calculations. Actual timesheets not independently verified.',
    procurement: 'Purchasing lines awaiting approval or technical review.',
    suppliers: 'Supplier approval, trading status and payment terms.',
    exceptions: 'Open issues and recorded follow-up actions.',
    registers: 'Open the existing supplier pricing, marketing, publishing and governance registers.',
  };
  const metrics = [
    ['open_leads', 'Inbound leads', 'leads'],
    ['outbound_prospects', 'Outbound prospects', 'prospects'],
    ['provenance_review', 'Source review', 'provenance'],
    ['attributed_jobs', 'Source-linked jobs', 'conversions'],
    ['inbound_linked_opportunities', 'Inbound linked', 'conversions'],
    ['attribution_exceptions', 'Attribution gaps', 'conversions'],
    ['pending_quotes', 'Pending quotes', 'quotes'],
    ['quotes_validity_review', 'Quote validity review', 'quotes'],
    ['variations_review', 'Variations to resolve', 'variations'],
    ['active_jobs', 'Active jobs', 'jobs'],
    ['job_status_review', 'Job status conflicts', 'jobs'],
    ['jobs_with_recorded_id', 'Jobs on record', 'jobs'],
    ['contracts_with_balance', 'Contracts with balance', 'finance'],
    ['labour_cost_review', 'Labour to reconcile', 'labour'],
    ['procurement_review', 'Purchasing review', 'procurement'],
    ['open_exceptions', 'Open exceptions', 'exceptions'],
  ];
  const actionRank = ['EXCEPTION', 'VARIATION_REVIEW', 'JOB_STATUS_REVIEW', 'LABOUR_COST_REVIEW', 'QUOTE_EXPIRED_REVIEW', 'ACCEPTED_QUOTE_REVIEW', 'PROCUREMENT_REVIEW', 'QUOTE_FOLLOWUP', 'JOB_ACTION'];
  const dateFormat = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' });
  const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
  const pageSize = 25;
  let department = 'overview';
  let page = 0;
  let queuePage = 0;
  let credential = '';
  let sessionActive = false;
  let humanLoginConfigured = false;
  let sessionExpiryTimer;
  const authorized = () => sessionActive || Boolean(credential);
  let data;
  let coverage;
  let coverageRequest;
  let deploymentRequest;
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

  const inventoryKeys = new Set(['systems','gates','packages','automations']);
  const coverageView = key => key === 'system' || inventoryKeys.has(key);
  const viewState = key => key === 'system' ? coverage : inventoryKeys.has(key) ? coverage?.inventory?.[key] : data?.departments[key];

  function show(key, recordId) {
    department = key;
    page = 0;
    $('search').value = recordId || '';
    hideDetail();
    renderView();
    if (coverageView(key) && !coverage && authorized()) loadCoverage();
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
    const state = viewState(department);
    const query = $('search').value.trim().toLowerCase();
    const matches = (state?.records || []).filter(item =>
      [item.id, item.title, item.status, item.next_action, ...Object.values(item.details)].some(value =>
        String(value ?? '').toLowerCase().includes(query))
    );
    const readable = state?.state === 'LIVE' || state?.state === 'PARTIAL';
    const baseline = state?.baseline ? ' · baseline '+state.baseline+' · source labels only' : '';
    const conflicts = state?.conflict_count ? ' · ' + state.conflict_count + ' duplicate IDs need review' : '';
    $('record-count').textContent = readable ? matches.length + ' records' + conflicts + baseline : 'Records unavailable';
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

  function renderConversionFunnel(){
    const panel=$('conversion-funnel');
    panel.hidden=department!=='conversions';
    if(panel.hidden)return;
    const workspace=data?.departments?.conversions;
    const rows=$('conversion-funnel-rows');
    if(!workspace||workspace.state==='UNAVAILABLE'||!Array.isArray(workspace.by_source)){
      $('conversion-funnel-status').textContent=
        'Canonical sources unavailable — conversion totals are UNKNOWN, not zero.';
      rows.replaceChildren();
      return;
    }
    $('conversion-funnel-status').textContent=[
      workspace.state==='PARTIAL'?'Attribution requires review':'Read-only source attribution',
      (workspace.exception_count||0)+' source exceptions',
      'Quoted and accepted are record states, not payment confirmation'
    ].join(' · ');
    const groups=workspace.by_source.slice().sort((a,b)=>
      (b.linked_jobs||0)-(a.linked_jobs||0)||
      (b.opportunities||0)-(a.opportunities||0)||
      String(a.source).localeCompare(String(b.source)));
    if(!groups.length){
      rows.replaceChildren();
      const row=element('tr'),cell=element('td',
        'No verifiable source-linked opportunities in the accessible records.');
      cell.colSpan=5;row.append(cell);rows.append(row);
      return;
    }
    rows.replaceChildren(...groups.map(group=>{
      const row=element('tr'),source=element('td');
      const sourceName=String(group.source||'UNKNOWN');
      source.append(button(sourceName,()=>{
        $('search').value=sourceName;
        page=0;hideDetail();renderRecords();
      },'row-link'));
      row.append(source,
        element('td',String(group.opportunities??'Unknown')),
        element('td',String(group.quoted??'Unknown')),
        element('td',String(group.accepted??'Unknown')),
        element('td',String(group.linked_jobs??'Unknown')));
      return row;
    }));
  }

  function renderDeliveryRoadmap() {
    const panel=$('delivery');
    const roadmap=coverage?.delivery;
    panel.hidden=department!=='system'||!roadmap;
    if(panel.hidden)return;
    if(roadmap.schema_version!=='MAGOS_DELIVERY_ROADMAP_V1'||
       !Array.isArray(roadmap.milestones)||roadmap.side_effects!==false) {
      panel.hidden=true;
      return;
    }
    $('delivery-summary').textContent=[
      roadmap.as_of+' (Johannesburg)',
      'Planning targets, not approved deadlines',
      (roadmap.counts?.missed||0)+' overdue targets',
      'No production completion certified'
    ].join(' · ');
    $('delivery-rows').replaceChildren(...roadmap.milestones.map(item=>{
      const tr=element('tr');
      const milestone=element('td');
      milestone.append(element('strong',item.label),
        element('small','Proposed '+item.target_date+' '+item.target_time_local+' SAST · '+item.id));
      const gates=element('td');
      gates.append(element('strong',item.recorded_pass+'/'+item.capability_count+' PASS'));
      gates.append(element('small',item.blockers.length?
        'Open: '+item.blockers.join(', '):'Source gates passed, live validation still required'));
      const next=element('td');
      next.append(element('strong',item.state.replaceAll('_',' ')));
      next.append(element('small',item.next_action));
      tr.append(milestone,gates,next);
      return tr;
    }));
  }

  function renderView() {
    renderNavigation();
    $('overview').hidden = department !== 'overview';
    $('department').hidden = department === 'overview';
    if (department === 'overview') return renderOverview();
    $('department-title').textContent = labels[department];
    $('department-note').textContent = descriptions[department];
    renderDeliveryRoadmap();
    renderConversionFunnel();
    $('directory').hidden = department !== 'registers';
    $('records').hidden = department === 'registers';
    const source = $('source');
    const url = link(viewState(department)?.source?.url);
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
    if(['leads','clients','jobs'].includes(department)&&item.title==='Duplicate record ID'){
      const output=element('section');output.setAttribute('aria-live','polite');
      const check=button('Inspect duplicate records',()=>inspectDuplicate(department,item.id,output,check),'secondary');
      target.append(check,output);
    }
    if(department==='quotes'){
      const signingOutput=element('p');
      signingOutput.setAttribute('role','status');
      const signingCheck=button('Check client signing readiness',
        ()=>inspectClientSigningReadiness(signingOutput,signingCheck),'secondary');
      target.append(signingCheck,signingOutput);
    }
    // Relationships are supplied by the read-only server projection from
    // exact canonical IDs. Never create links using fuzzy client name matches.
    if(Array.isArray(item.related)&&item.related.length){
      const related=element('section',undefined,'related-work');
      related.append(element('h4','Related MAGOS work'));
      const actions=element('div',undefined,'related-actions');
      for(const targetRecord of item.related){
        if(!labels[targetRecord.department]||
           !data?.departments?.[targetRecord.department]?.records?.some(
            row=>row.id===targetRecord.id))continue;
        const label=labels[targetRecord.department]+' · '+targetRecord.id;
        actions.append(button(label,
          ()=>show(targetRecord.department,targetRecord.id),'secondary'));
      }
      if(actions.children.length){
        related.append(actions);
        if(item.related_overflow>0)
          related.append(element('small',item.related_overflow+
            ' further linked records. Open a related department to search.'));
        target.append(related);
      }
    }
    if (department === 'jobs' && item.details?.job_id) {
      const variationButton=button('View job scope variations',
        ()=>show('variations',item.details.job_id),'secondary');
      target.append(variationButton);
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
      if(coverageRequest !== active || !authorized()) return;
      if(result.schema_version !== 'MAGOS_SYSTEM_COVERAGE_V1' ||
         !Array.isArray(result.capabilities) || result.side_effects !== false) {
        throw new Error('INVALID_COVERAGE_RESPONSE');
      }
      coverage={
        delivery:result.delivery,
        inventory:result.inventory || {},
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
      if(coverageRequest!==active || !authorized())return;
      coverage={state:'UNAVAILABLE',records:[]};
    } finally {
      if(coverageRequest===active && coverageView(department))renderView();
    }
  }

  async function loadDeploymentIdentity(){
    const output=$('deployment');
    output.textContent='Checking deployed process identity…';
    deploymentRequest?.abort();
    const active=new AbortController();
    deploymentRequest=active;
    const deadline=setTimeout(()=>active.abort(),8000);
    try{
      const response=await read('/v1/operator/deployment',active.signal);
      const result=await response.json();
      if(deploymentRequest!==active||!authorized())return;
      if(result.schema_version!=='MAGOS_OPERATOR_DEPLOYMENT_V1'||
         result.side_effects!==false)throw Error('DEPLOYMENT_UNAVAILABLE');
      if(response.status===200&&result.status==='PROCESS_START_GIT_MATCH'&&
         /^[0-9a-f]{40}$/.test(result.commit_sha)){
        output.textContent='Running code identity: '+result.commit_sha.slice(0,12)+
          ' (process-start Git checked; live business acceptance still pending)';
      }else{
        output.textContent='Running code identity NOT VERIFIED — do not assume latest GitHub code is deployed';
      }
    }catch{
      if(deploymentRequest===active&&authorized())output.textContent='Deployment identity unavailable — do not assume live release';
    }finally{clearTimeout(deadline);}
  }

  function read(path, signal) {
    return fetch(path, {
      headers: credential ? { 'X-MAGOS-Operator-Token': credential } : {},
      credentials: 'same-origin',
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

  async function inspectDuplicate(scope,id,output,control){
    inspection?.abort();const active=new AbortController();inspection=active;
    control.disabled=true;output.textContent='Checking canonical records…';
    active.signal.addEventListener('abort',()=>{control.disabled=false;if(inspection===active)output.textContent='Inspection cancelled or timed out. No records changed.';},{once:true});
    const deadline=setTimeout(()=>active.abort(),15000);
    try{
      const response=await read('/v1/operator/actions/inspect-duplicate/'+encodeURIComponent(scope)+'/'+encodeURIComponent(id),active.signal);
      const report=await response.json();
      if(inspection!==active)return;
      if(!response.ok||report.schema_version!=='MAGOS_OPERATOR_ACTION_V1'||report.side_effects!==false)throw Error('INSPECTION_UNAVAILABLE');
      if(active.signal.aborted)return;
      if(report.state==='SOURCE_LIMIT_EXCEEDED'){output.textContent='Source exceeds inspection limit; no complete match count available. Review canonical register.';return;}
      output.replaceChildren(element('h4',report.match_count+' matching records · '+report.state));
      output.append(element('p','Checked '+report.checked_at+' · '+report.source.name+' · Read-only; no correction authorized.'));
      if(report.conflicting_fields.length)output.append(element('p','Conflicting fields: '+report.conflicting_fields.join(', ')));
      for(const match of report.matches){
        const section=element('section'),list=element('dl');
        section.append(element('h5','Match '+match.match));
        for(const [field,value] of Object.entries(match.fields)){
          list.append(element('dt',field),element('dd',value||'—'));
        }
        section.append(list);output.append(section);
      }
      if(report.values_truncated)output.append(element('p','Long field values shortened; review canonical source before acting.'));
      if(report.truncated)output.append(element('p','Only the first 50 matches are shown.'));
    }catch{if(inspection===active)output.textContent='Inspection unavailable. No records changed.';}
    finally{clearTimeout(deadline);control.disabled=false;}
  }

  async function inspectClientSigningReadiness(output,button){
    const active=new AbortController();
    inspection?.abort();inspection=active;button.disabled=true;
    output.textContent='Checking the live client signing page and reviewed receipt bridge…';
    const deadline=setTimeout(()=>active.abort(),25000);
    try{
      const response=await read('/v1/operator/client-signing-readiness',active.signal);
      const report=await response.json();
      if(inspection!==active)return;
      if(report.schema_version!=='MAGOS_CLIENT_SIGNING_READINESS_V1'||
         report.side_effects!==false)throw Error('SIGNING_READINESS_UNAVAILABLE');
      const blockers=(report.checks||[]).filter(c=>c.state!=='PASS')
        .map(c=>c.reason_code?.replaceAll('_',' ')||'Unverified prerequisite');
      output.textContent=report.state==='READY_FOR_CONTROLLED_SIGNING_TEST'?
        'Page and reviewed bridge available. Live customer signing, approval and quote-version verification still require controlled testing.':
        'Client signing blocked: '+(blockers.join(' · ')||'Provider checks unavailable');
    }catch{
      if(inspection===active)
        output.textContent='Client signing status unavailable; no acceptance or job release authorized.';
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
    deploymentRequest?.abort();
    deploymentRequest = undefined;
    coverage = undefined;
    credential = '';
    sessionActive = false;
    $('security-panel').hidden = true;
    $('security-open').hidden = true;
    $('security-events').replaceChildren();
    $('security-message').textContent = '';
    clearTimeout(sessionExpiryTimer);
    data = undefined;
    $('deployment').textContent='Deployed code: not yet verified';
    $('credential').value = '';
    $('credential').disabled = false;
    $('credential').hidden = humanLoginConfigured;
    $('credential-label').hidden = humanLoginConfigured;
    $('google-login').hidden = !humanLoginConfigured;
    $('load').disabled = false;
    $('load').textContent = 'Load live operations';
    $('load').hidden = humanLoginConfigured;
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

  $('security-close').addEventListener('click',()=>{$('security-panel').hidden=true;});
  $('security-open').addEventListener('click',async()=>{
    if(!sessionActive)return;
    $('security-panel').hidden=false;
    $('security-events').replaceChildren();
    $('security-message').textContent='Reading security history…';
    try{
      const response=await fetch('/operator/auth/security',{credentials:'same-origin',cache:'no-store'});
      if(!sessionActive)return;
      if(response.status===401){lock('Session expired. Sign in again.');return;}
      if(!response.ok)throw Error('history');
      const result=await response.json();
      if(!sessionActive||$('security-panel').hidden)return;
      for(const row of result.events||[]){
        const tr=element('tr');
        tr.append(element('td',dateFormat.format(new Date(row.at))),element('td',row.event.replaceAll('_',' ')));
        $('security-events').append(tr);
      }
      $('security-message').textContent='Recent security events (up to 100).';
    }catch{if(sessionActive)$('security-message').textContent='Security history unavailable.';}
  });
  $('revoke-all').addEventListener('click',async()=>{
    if(!sessionActive||!window.confirm('Sign out all human dashboard sessions, including this device?'))return;
    $('revoke-all').disabled=true;
    try{
      const response=await fetch('/operator/auth/revoke-all',{method:'POST',credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('revocation');
      const result=await response.json();
      if(!result.all_human_sessions_revoked)throw Error('revocation');
      lock(result.audit_recorded?'All human sessions revoked. Sign in again.':'All human sessions revoked; audit recording unavailable.');
    }catch{if(sessionActive)$('security-message').textContent='Revocation not confirmed. Try again.';}
    finally{$('revoke-all').disabled=false;}
  });
  $('clear').addEventListener('click', async () => {
    const wasSession = sessionActive;
    lock(wasSession ? 'Signing out…' : undefined);
    if (wasSession) {
      try {
        const response = await fetch('/operator/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});
        if(!response.ok)throw Error('logout');
        state('Signed out. Sign in with Google to continue.','Locked');
      } catch { state('Local view cleared, but server logout failed. Retry sign-out or close this browser.','Review required','partial'); $('clear').hidden=false; sessionActive=true; }
    }
  });
  $('search').addEventListener('input', () => { page = 0; hideDetail(); renderRecords(); });
  $('login').addEventListener('submit', async event => {
    event.preventDefault();
    const entered = $('credential').value.trim();
    if (!entered && !authorized()) {
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
      if (response.status === 401) return lock('Access expired or rejected. Sign in again.');
      if (result.error === 'OPERATOR_ACCESS_NOT_CONFIGURED') return lock('Dashboard access has not been configured on the server.');
      if (!response.ok || result.schema_version !== 'MAGOS_OPERATOR_DASHBOARD/V1' || result.side_effects !== false ||
        !result.departments || !result.overview_counts || !Array.isArray(result.attention) || !Array.isArray(result.links)) {
        throw new Error('Dashboard unavailable');
      }
      data = result;
      coverageRequest?.abort();
      coverageRequest = undefined;
      coverage = undefined;
      void loadDeploymentIdentity();
      if(coverageView(department))void loadCoverage();
      page = 0;
      queuePage = 0;
      hideDetail();
      $('asof').textContent = 'Checked ' + dateFormat.format(new Date(data.checked_at)) + ' SAST';
      $('load').textContent = 'Refresh operations';
      $('load').hidden = false;
      $('google-login').hidden = true;
      $('security-open').hidden = !sessionActive;
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
  async function initializeLogin(){
    try {
      const response=await fetch('/operator/auth/status',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)return;
      const status=await response.json();
      humanLoginConfigured=status.configured===true;
      if(!humanLoginConfigured)return;
      $('credential').hidden=true;
      $('credential-label').hidden=true;
      $('google-login').hidden=status.authenticated===true||status.available===false;
      $('load').hidden=status.authenticated!==true;
      sessionActive=status.authenticated===true;
      if(sessionActive){
        sessionExpiryTimer=setTimeout(()=>lock('Session expired. Sign in again.'),Math.max(0,status.expires_at-Date.now()));
        $('login').requestSubmit();
      }else state(status.available===false?'Owner sign-in is currently unavailable or locked. Contact the owner.':'Sign in with your approved Google account.','Locked');
    }catch{/* Existing token access remains available if status is unavailable. */}
  }
  window.addEventListener('pageshow',event=>{if(event.persisted){lock();void initializeLogin();}});
  void initializeLogin();
})();
