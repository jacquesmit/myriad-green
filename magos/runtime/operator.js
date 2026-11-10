'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const groups = [
    ['Command centre', [['overview', 'Overview'], ['exceptions', 'Exceptions']]],
    ['Clients and delivery', [['leads', 'Lead intake'], ['clients', 'Clients / CRM'], ['quotes', 'Quotes & acceptance'], ['jobs', 'Active jobs'], ['dispatch', 'Dispatch & bookings'], ['evidence', 'Work proof']]],
    ['Commercial', [['finance', 'Finance & payments'], ['procurement', 'Procurement'], ['suppliers', 'Suppliers'], ['registers', 'Other registers']]],
  ];
  const labels = Object.fromEntries(groups.flatMap(([, entries]) => entries));
  const descriptions = {
    leads: 'Inbound work and the next routing decision.',
    clients: 'Client and prospect records, with acquisition source and follow-up.',
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
    ['open_leads', 'Open leads', 'leads'],
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
    const state = data?.departments[department];
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
    const url = link(data?.departments[department]?.source?.url);
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
    if (department === 'quotes') {
      const output = element('p');
      output.setAttribute('role', 'status');
      const check = button('Inspect job readiness', () => inspectQuote(item.id, output, check), 'secondary');
      target.append(check, output);
    }
    target.scrollIntoView({ block: 'nearest' });
  }

  function read(path, signal) {
    return fetch(path, {
      headers: { 'X-MAGOS-Operator-Token': credential },
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
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
