'use strict';

function operatorPage() {
  return `<!doctype html>
<html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MAGOS | Operations</title><link rel="stylesheet" href="/operator.css"><script defer src="/operator.js"></script></head>
<body>
<a class="skip" href="#content">Skip to work area</a>
<div class="workspace">
  <aside class="rail">
    <div class="brand"><span class="monogram" aria-hidden="true">MG</span><div><strong>Myriad Green</strong><small>MAGOS BUSINESS SYSTEM</small></div></div>
    <nav id="filters" aria-label="Workstreams"></nav>
    <div class="rail-note">Myriad Green Group<br><span>Internal operations</span></div>
  </aside>
  <main id="content">
    <header class="topbar">
      <div><p class="eyebrow">MYRIAD GREEN / OPERATIONS</p><h1>MAGOS / Myriad Green</h1><p>Operations command centre</p></div>
      <span class="badge" id="connection">Locked</span>
    </header>
    <section class="access" aria-label="Dashboard access">
      <form id="login" autocomplete="off">
        <label for="credential">Dashboard access token</label>
        <div class="access-actions">
          <input id="credential" type="password" autocomplete="off" spellcheck="false">
          <button id="load" type="submit">Load live operations</button>
          <button id="clear" class="secondary" type="button" hidden>Lock</button>
        </div>
      </form>
      <p id="message" role="status">Enter your dashboard access token to load the MAGOS registers.</p>
    </section>
    <section id="overview" aria-labelledby="overview-title">
      <div class="section-heading"><div><p class="eyebrow">OPERATING PICTURE</p><h2 id="overview-title">Command Centre</h2></div><span id="asof"></span></div>
      <div id="metrics" class="metrics"></div>
      <div class="panel">
        <div class="panel-head"><div><h3>Action queue</h3><p>Next actions from quotes, jobs, procurement and exceptions.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th scope="col">Workstream</th><th scope="col">Canonical record</th><th scope="col">Required action</th></tr></thead><tbody id="queue"></tbody></table></div>
        <div id="queue-pages" class="pagination" hidden></div>
      </div>
    </section>
    <section id="department" aria-labelledby="department-title" hidden>
      <div class="section-heading">
        <div><p class="eyebrow">DEPARTMENT WORKSPACE</p><h2 id="department-title"></h2><p id="department-note"></p></div>
        <a id="source" class="button secondary" target="_blank" rel="noopener noreferrer" hidden>Open register ↗</a>
      </div>
      <div id="directory" class="directory" hidden></div>
      <div id="records" class="panel" hidden>
        <div class="panel-head">
          <p id="record-count"></p>
          <label class="search"><span>Search records</span><input id="search" type="search" placeholder="ID, name, status or action"></label>
        </div>
        <div class="table-wrap"><table><thead><tr><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Next action</th></tr></thead><tbody id="rows"></tbody></table></div>
        <div id="record-pages" class="pagination" hidden></div>
      </div>
      <section id="detail" class="panel detail" aria-label="Record details" hidden></section>
    </section>
    <footer>Read-only operational views from the existing MAGOS registers.</footer>
  </main>
</div></body></html>`;
}

module.exports = { operatorPage };
