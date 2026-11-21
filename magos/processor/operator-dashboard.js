'use strict';

const { projectOperations } = require('./operator-snapshot');
const { calculateExpected } = require('./payment-control-audit');
const { DEFAULT_IDS } = require('../writer/transaction-writer');

const tabs = {
  leads: ['crm', 'Intake_Queue', 1816318913, ['intake_id', 'source_event_id', 'source_system', 'source_type', 'processing_status']],
  clients: ['crm', 'CRM_Master', 1621110075, ['crm_id', 'company', 'lead_direction', 'crm_status', 'next_action']],
  quotes: ['commercial', 'Quotes', 1001, ['quote_id', 'Quote Status', 'opportunity_id', 'job_id', 'Next Action']],
  jobs: ['crm', 'Jobs_Opportunities', 1816318915, ['opportunity_id', 'job_id', 'job_status', 'next_action']],
  dispatch: ['crm', 'Bookings', 1816318918, ['booking_id', 'appointment_start', 'mgos_booking_status', 'staff_technician']],
  finance: ['commercial', 'Payment Control', 914551623, ['Control ID', 'Financial Status', 'Contract Value (R)', 'Deposit Required (R)', 'Next Action']],
  allocations: ['commercial', 'Payment_Allocations', 2051001004, ['allocation_id', 'control_id', 'allocation_state', 'allocation_type', 'amount', 'evidence_link']],
  procurement: ['commercial', 'Procurement', 1602387347, ['Procurement ID', 'Procurement Gate', 'technical_gate', 'Next Action']],
  suppliers: ['supplier', 'Suppliers', 826555595, ['supplier_id', 'supplier_name', 'supplier_approval_state', 'active_status']],
  evidence: ['commercial', 'Job Execution', 1264514302, ['Execution ID', 'Job ID', 'Before Evidence', 'After Evidence', 'Completion Sign-off']],
  exceptions: ['audit', 'Sync_Exceptions', 2012, ['exception_id', 'status', 'action_required']],
};

const txt = value => String(value ?? '').trim();
const upper = value => txt(value).toUpperCase();
const amount = value => {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const cleaned = txt(value).replace(/^ZAR\s*|^R\s*/i, '').replace(/[\s\u00a0\u202f]/g, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned.replace(/,/g, ''));
};

const idFields = {
  leads: 'intake_id', clients: 'crm_id', quotes: 'quote_id', jobs: 'opportunity_id',
  dispatch: 'booking_id', finance: 'Control ID', procurement: 'Procurement ID',
  suppliers: 'supplier_id', evidence: 'Execution ID', exceptions: 'exception_id',
};

function indexRows(rows, key) {
  const index = new Map();
  const conflicts = new Set();
  for (const row of rows) {
    const id = txt(row[key]);
    if (!id || conflicts.has(id)) continue;
    if (index.has(id)) {
      index.delete(id);
      conflicts.add(id);
    } else {
      index.set(id, row);
    }
  }
  return { index, conflicts };
}

function record(id, title, status, nextAction, details = {}) {
  return { id: txt(id), title: txt(title), status: txt(status) || 'UNKNOWN', next_action: txt(nextAction), details };
}

function projectFinance(controls, allocations) {
  const byControl = new Map();
  const allocationIds = new Map();
  for (const row of allocations) {
    const control = txt(row.control_id);
    if (!control || upper(row.allocation_state) !== 'CLEARED') continue;
    const group = byControl.get(control) || [];
    group.push(row);
    byControl.set(control, group);
    const id = txt(row.allocation_id);
    allocationIds.set(id, (allocationIds.get(id) || 0) + 1);
  }

  return controls.map(control => {
    const id = txt(control['Control ID']);
    const contract = amount(control['Contract Value (R)']);
    const required = amount(control['Deposit Required (R)']);
    const rows = byControl.get(id) || [];
    const invalid = rows.some(row => {
      const key = txt(row.allocation_id);
      const value = amount(row.amount);
      return !key || allocationIds.get(key) !== 1 || !txt(row.evidence_link) || value === null || value === 0;
    });
    const expected = contract === null || invalid ? null : calculateExpected(
      { ...control, 'Control ID': id, 'Contract Value (R)': contract },
      rows.map(row => ({ ...row, control_id: id, allocation_state: 'CLEARED', allocation_type: upper(row.allocation_type), amount: amount(row.amount) }))
    );
    return record(id, control.Client, expected ? control['Financial Status'] : 'REVIEW_REQUIRED',
      expected ? control['Next Action'] : 'Reconcile the contract and cleared allocations', {
        'Opportunity ID': txt(control['Opportunity ID']),
        'Job ID': txt(control.job_id),
        'Quote': txt(control['Quote No.']),
        'Deposit required (ZAR)': required,
        'Cleared deposit (ZAR)': expected?.deposit_received ?? null,
        'Total cleared receipts (ZAR)': expected?.total_received ?? null,
        'Contract balance (ZAR)': expected?.overall_balance ?? null,
        'Payment proof': txt(control.payment_proof_drive_link),
        'Allocation IDs': expected?.cleared_allocation_ids.join(', ') || '',
      });
  });
}

const dedicated = {
  clients: rows => rows.map(r => record(r.crm_id, r.company, r.crm_status, r.next_action, {
    'Lead direction': txt(r.lead_direction), 'Acquisition source': txt(r.acquisition_source),
    'Opportunity ID': txt(r.opportunity_id), 'Job ID': txt(r.job_id), 'Follow-up': txt(r.next_follow_up_date),
  })),
  dispatch: rows => rows.map(r => record(r.booking_id, r.service_name,
    r.mgos_booking_status, r.control_note, {
      'Appointment start': txt(r.appointment_start), 'Appointment end': txt(r.appointment_end),
      'Crew': txt(r.staff_technician), 'Job ID': txt(r.job_id), 'Evidence': txt(r.evidence_link),
    })),
  suppliers: rows => rows.map(r => record(r.supplier_id,
    r.supplier_name, r.supplier_approval_state, '', {
      'Active status': txt(r.active_status), 'Branch': txt(r.branch), 'Categories': txt(r.categories), 'Payment terms': txt(r.payment_terms),
    })),
  evidence: rows => rows.map(r => record(r['Execution ID'], r.Service,
    r['Completion Status'] || r['Job Status'], r['Next Action'], {
      'Job ID': txt(r['Job ID']), 'Before evidence': txt(r['Before Evidence']), 'After evidence': txt(r['After Evidence']),
      'Completion sign-off': txt(r['Completion Sign-off']), 'Variation approval': txt(r['Client Approval Evidence']),
    })),
};

const sourceLink = (id, gid) => 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/edit#gid=' + gid;

async function loadOperatorDashboard(stores, now = () => new Date()) {
  const keys = Object.keys(tabs);
  const reads = await Promise.allSettled(keys.map(async key => {
    const [store, sheet, , requiredHeaders] = tabs[key];
    return stores[store].readObjects(sheet, {
      maxRows: null,
      requiredHeaders,
      ...(['finance', 'allocations'].includes(key) ? { valueRenderOption: 'UNFORMATTED_VALUE' } : {}),
    });
  }));
  const result = Object.fromEntries(keys.map((key, i) => [key, reads[i]]));
  const rows = key => {
    if (result[key].status !== 'fulfilled' || !Array.isArray(result[key].value)) throw new Error('Register unavailable');
    return result[key].value;
  };
  const departments = {};
  const overviewCounts = {};
  const attention = [];
  for (const key of keys.filter(key => key !== 'allocations')) {
    const [store, sheet, gid] = tabs[key];
    const source = { name: sheet, url: sourceLink(stores[store]?.spreadsheetId || DEFAULT_IDS[store], gid) };
    try {
      const { index, conflicts } = indexRows(rows(key), idFields[key]);
      const input = [...index.values()];
      let records;
      if (key === 'finance') {
        records = projectFinance(input, rows('allocations'));
        overviewCounts.contracts_with_balance = records.filter(item => item.details['Contract balance (ZAR)'] > 0).length;
      } else if (dedicated[key]) {
        records = dedicated[key](input);
      } else {
        const projection = projectOperations({
          [key]: key === 'leads' ? input.map(row => ({ ...row, source_event_id: row.intake_id })) : input,
        });
        const metric = { leads: 'open_leads', quotes: 'pending_quotes', jobs: 'active_jobs',
          procurement: 'procurement_review', exceptions: 'open_exceptions' }[key];
        const titles = { leads: 'subject_or_file_name', quotes: 'Project / Scope', jobs: 'primary_service', procurement: 'Description', exceptions: 'exception_type' };
        records = projection.records[key].map(({ id, status, next_action, ...details }) => {
          const original = index.get(id);
          if (key === 'leads') details.source_event_id = txt(original?.source_event_id);
          return record(id, original?.[titles[key]], status, next_action, details);
        });
        overviewCounts[metric] = projection.counts[metric];
        attention.push(...projection.attention.map(item => ({ ...item, department: key })));
      }
      const conflictRows = [...conflicts].map(id => record(id, 'Duplicate record ID', 'REVIEW_REQUIRED',
        'Compare the matching rows in the source register before acting'));
      attention.push(...conflictRows.map(item => ({ type: 'EXCEPTION', id: item.id,
        next_action: item.next_action, department: key })));
      departments[key] = { state: conflicts.size ? 'PARTIAL' : 'LIVE', conflict_count: conflicts.size,
        records: [...conflictRows, ...records], source };
    } catch {
      departments[key] = { state: 'UNAVAILABLE', source };
    }
  }
  return {
    schema_version: 'MAGOS_OPERATOR_DASHBOARD/V1',
    checked_at: now().toISOString(),
    departments,
    overview_counts: overviewCounts,
    attention,
    links: [
      { label: 'Supplier pricing', url: sourceLink(stores.supplier?.spreadsheetId || DEFAULT_IDS.supplier, 680587399) },
      { label: 'SEO and marketing', url: 'https://docs.google.com/spreadsheets/d/1fsX82j4eZDoRcP_jHdbXSN0GDMfPHEdlHlO_Iq0fF-A/edit' },
      { label: 'Reviews and Google Business Profile', url: 'https://docs.google.com/spreadsheets/d/1cL0euMfcHrgTLb0v_UaLZ_HpTdxXK8nbQ6SY_yHYoEw/edit' },
      { label: 'Governance and systems', url: 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(stores.audit?.spreadsheetId || DEFAULT_IDS.audit) + '/edit' },
    ],
    side_effects: false,
  };
}

module.exports = { loadOperatorDashboard };
