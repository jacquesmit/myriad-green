'use strict';
/**
 * MAGOS whole-system release acceptance: read-only evidence evaluator.
 * This is a RELEASE REPORT, not a business authorization or source-of-truth writer.
 */
const fs = require('node:fs');

const GATES = Object.freeze([
  'host_commit_and_worker',
  'runtime_auth_and_canonical_sources',
  'lead_capture_to_canonical_crm',
  'quote_version_and_client_acceptance',
  'independent_bank_settlement',
  'accepted_quote_to_job',
  'procurement_supplier_grn_stock',
  'crew_schedule_and_dispatch',
  'field_proof_and_variations',
  'job_costs_and_margin',
  'invoice_and_receivables',
  'warranty_reviews_and_recurring',
  'staff_assets_and_management',
  'website_whatsapp_integration',
  'ecommerce_payment_delivery_tax',
  'security_backup_and_restore'
]);

const VALID = new Set(['PASS', 'PARTIAL', 'FAIL']);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function evaluate(evidence) {
  if (!evidence || Array.isArray(evidence) || typeof evidence !== 'object') {
    throw new Error('Evidence must be an object');
  }
  const items = evidence.gates;
  if (!items || Array.isArray(items) || typeof items !== 'object') {
    throw new Error('Evidence must contain a gates object');
  }
  const results = GATES.map(id => {
    const entry = has(items, id) ? items[id] : null;
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
      return { id, state: 'FAIL', reason: 'MISSING_EVIDENCE' };
    }
    if (!VALID.has(entry.state)) {
      return { id, state: 'FAIL', reason: 'INVALID_STATE' };
    }
    if (entry.state !== 'PASS') {
      return { id, state: entry.state, reason: 'NOT_ACCEPTED' };
    }
    // A claimed PASS must carry a specific immutable tested SHA,
    // a source-linked artifact and a dated independent verification.
    const sha = entry.tested_commit_sha;
    const artifact = entry.evidence_url;
    const verifiedAt = entry.verified_at;
    const timestamp = typeof verifiedAt === 'string' ? Date.parse(verifiedAt) : NaN;
    const shaValid = typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha);
    const urlValid = typeof artifact === 'string' && /^https:\/\/[^\s/]+\/\S+$/i.test(artifact);
    const dateValid = Number.isFinite(timestamp) && /^\d{4}-\d{2}-\d{2}T/.test(verifiedAt);
    const attesterValid = typeof entry.verified_by === 'string' && entry.verified_by.trim().length >= 3;
    if (!shaValid || !urlValid || !dateValid || !attesterValid) {
      return { id, state: 'FAIL', reason: 'PASS_UNSUPPORTED_BY_EVIDENCE' };
    }
    return { id, state: 'PASS', reason: 'DOCUMENTED_ATTESTATION' };
  });
  const count = Object.fromEntries(['PASS', 'PARTIAL', 'FAIL'].map(
    state => [state, results.filter(row => row.state === state).length]
  ));
  return {
    overall: count.PASS === GATES.length ? 'PASS' : 'BLOCKED',
    accepted: count.PASS === GATES.length,
    counts: count,
    results,
    warning: 'Evidence metadata is not independently verified by this script. Confirm the source artifact, host SHA and live business test before using a PASS for release authorization.'
  };
}

if (require.main === module) {
  try {
    const file = process.argv[2];
    if (!file || process.argv.length !== 3) {
      process.stderr.write('Usage: node magos/scripts/whole-system-acceptance.js <evidence.json>\n');
      process.exitCode = 2;
    } else {
      const report = evaluate(JSON.parse(fs.readFileSync(file, 'utf8')));
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      if (!report.accepted) process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write('MAGOS_ACCEPTANCE_ERROR: ' + error.message + '\n');
    process.exitCode = 2;
  }
}
module.exports = { evaluate, GATES };
