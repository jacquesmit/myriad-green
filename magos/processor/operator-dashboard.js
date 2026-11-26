'use strict';

const { projectOperations } = require('./operator-snapshot');
const { classifyCrmProvenance } = require('./lead-provenance');
const { inspectAttributedConversions } = require('./attributed-conversions');
const {quoteValidityReview}=require('./quote-validity');
const {inspectVariationRegister}=require('./variation-review');
const {inspectLabourCostRegister}=require('./labour-reconciliation');
const {canonicalRelations}=require('./operator-crosslinks');
const {inspectJobStatusRegister,classifyJobStatus}=require('./job-status-classification');
const { calculateExpected } = require('./payment-control-audit');
const { DEFAULT_IDS } = require('../writer/transaction-writer');

const tabs = {
  leads: ['crm', 'Intake_Queue', 1816318913, ['intake_id', 'source_event_id', 'source_system', 'source_type', 'processing_status']],
  clients: ['crm', 'CRM_Master', 1621110075, ['crm_id', 'company', 'lead_direction', 'crm_status', 'next_action']],
  quotes: ['commercial', 'Quotes', 1001, ['quote_id', 'Quote Status', 'opportunity_id', 'job_id', 'Next Action', 'Valid Until']],
  jobs: ['crm', 'Jobs_Opportunities', 1816318915, ['opportunity_id', 'job_id', 'job_status', 'next_action']],
  dispatch: ['crm', 'Bookings', 1816318918, ['booking_id', 'appointment_start', 'mgos_booking_status', 'staff_technician']],
  finance: ['commercial', 'Payment Control', 914551623, ['Control ID', 'Financial Status', 'Contract Value (R)', 'Deposit Required (R)', 'Next Action']],
  allocations: ['commercial', 'Payment_Allocations', 2051001004, ['allocation_id', 'control_id', 'allocation_state', 'allocation_type', 'amount', 'evidence_link']],
  procurement: ['commercial', 'Procurement', 1602387347, ['Procurement ID', 'Procurement Gate', 'technical_gate', 'Next Action']],
  suppliers: ['supplier', 'Suppliers', 826555595, ['supplier_id', 'supplier_name', 'supplier_approval_state', 'active_status']],
  evidence: ['commercial', 'Job Execution', 1264514302, ['Execution ID', 'Job ID', 'Before Evidence', 'After Evidence', 'Completion Sign-off']],
  variations: ['commercial', 'Variations', 1009, ['Variation ID', 'Job ID', 'Original Scope Ref', 'Approval Status', 'Approval Evidence', 'Selling Price Impact (R)', 'Execution Status']],
  labour_rates: ['commercial', 'Labour Rates', 1010, ['labour_rate_id', 'person_role', 'rate_basis', 'rate', 'currency', 'effective_from']],
  labour_margins: ['commercial', 'Project Cost & Margin', 1011, ['margin_record_id', 'job_id', 'crew_daily_rate_total', 'crew_days', 'provisional_labour_cost']],
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
  suppliers: 'supplier_id', evidence: 'Execution ID', variations: 'Variation ID', exceptions: 'exception_id',
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
        'Invoice ID': txt(control.invoice_id),
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
    'Lead direction': txt(r.lead_direction), 'Record origin': txt(r.record_origin),
    'Acquisition source': txt(r.acquisition_source), 'First contact': txt(r.first_contact_channel),
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
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now());
  const getPart=name=>parts.find(p=>p.type===name)?.value;
  const localDay=getPart('year')+'-'+getPart('month')+'-'+getPart('day');
  const departments = {};
  const overviewCounts = {};
  const attention = [];
  for (const key of keys.filter(key => !['allocations','labour_rates','labour_margins'].includes(key))) {
    const [store, sheet, gid] = tabs[key];
    const source = { name: sheet, url: sourceLink(stores[store]?.spreadsheetId || DEFAULT_IDS[store], gid) };
    try {
      const { index, conflicts } = indexRows(rows(key), idFields[key]);
      const input = [...index.values()];
      let records;
      if (key === 'clients') {
        // Split one canonical CRM_Master into exclusive operator views.
        // Scraped businesses do not become customer enquiries just because
        // both kinds of records occupy the CRM workbook.
        const groups={inbound:[],outbound:[],unknown:[]};
        for(const item of input){
          const provenance=classifyCrmProvenance(item);
          const enriched={...item,__provenance:provenance};
          if(provenance.kind==='INBOUND_ENQUIRY')groups.inbound.push(enriched);
          else if(['OUTBOUND_PROSPECT','CONVERTED_OUTBOUND'].includes(provenance.kind))
            groups.outbound.push(enriched);
          else groups.unknown.push(enriched);
        }
        const project=(items)=>dedicated.clients(items).map((record,i)=>({
          ...record,
          details:{...record.details,
            'Provenance':items[i].__provenance.kind,
            'Provenance reason':items[i].__provenance.reason}
        }));
        records=project(groups.inbound);
        departments.prospects={state:conflicts.size?'PARTIAL':'LIVE',
          conflict_count:conflicts.size,records:project(groups.outbound),source};
        departments.provenance={state:conflicts.size?'PARTIAL':'LIVE',
          conflict_count:conflicts.size,records:project(groups.unknown),source};
        overviewCounts.outbound_prospects=groups.outbound.length;
        overviewCounts.provenance_review=groups.unknown.length+conflicts.size;
      } else if (key === 'variations') {
        // Run inspection on all rows, before ID filtering, to retain duplicates.
        const inspection=inspectVariationRegister(rows(key));
        records=inspection.records.map(item=>record(item.id,
          item.client||item.job_id,item.state,item.next_action,{
            'Job ID':item.job_id,'Original scope':item.original_scope_ref,
            'Approval status':item.approval_status,
            'Execution status':item.execution_status,
            'Price change (ZAR)':item.price_impact_zar,
            'Cost change (ZAR)':item.cost_impact_zar,
            'Invoice reference':item.invoice_ref,
            'Blockers':item.blockers.join(', '),
            'Payment clearance':item.payment_clearance
          }));
        overviewCounts.variations_review=inspection.counts.review;
        overviewCounts.retrospective_variations=inspection.counts.retrospective;
        attention.push(...inspection.records.filter(item=>item.state==='REVIEW_REQUIRED')
          .slice(0,100).map(item=>({
            department:'variations',type:'VARIATION_REVIEW',id:item.id,
            next_action:item.next_action
          })));
      } else if (key === 'finance') {
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
        let workItems=projection.attention;
        if(key==='jobs'){
          // The active-jobs KPI intentionally excludes completed/cancelled
          // work. The Jobs workspace must not hide their real closeout,
          // warranty, cost or receivable inspections.
          const visible=new Set(records.map(item=>item.id));
          for(const sourceJob of input){
            const opportunityId=txt(sourceJob.opportunity_id);
            const jobId=txt(sourceJob.job_id);
            if(!opportunityId||!jobId||visible.has(opportunityId)||
               !index.has(opportunityId))continue;
            visible.add(opportunityId);
            records.push(record(opportunityId,sourceJob.primary_service,
              sourceJob.job_status||'UNKNOWN',
              sourceJob.next_action||'Review completed or historical job evidence',{
                job_id:jobId,
                client_id:txt(sourceJob.client_crm_id),
                'Recorded payment status':txt(sourceJob.payment_status),
                'Recorded invoice':txt(sourceJob.invoice_number),
                'Completion evidence status':'NOT_INDEPENDENTLY_VERIFIED'
              }));
          }
          const statusAudit=inspectJobStatusRegister(input);
          overviewCounts.job_status_review=statusAudit.counts.review;
          for(const issue of statusAudit.review){
            const row=records.find(x=>x.id===issue.opportunity_id);
            if(!row)continue;
            row.status='REVIEW_REQUIRED';
            row.next_action='Reconcile recorded job status against canonical job execution evidence';
            row.details['Original job status']=issue.recorded_status;
            row.details['Status inconsistency']=issue.reason;
            attention.push({department:'jobs',type:'JOB_STATUS_REVIEW',
              id:issue.opportunity_id,next_action:row.next_action});
          }
          overviewCounts.jobs_with_recorded_id=records.filter(item=>
            !!txt(item.details?.job_id)).length;
        }
        if(key==='quotes'){
          // Pending-quotes KPI still measures outstanding action, but the
          // Quotes workspace must retain accepted/linked, declined and
          // historical records so jobs can trace their actual source quote.
          const visible=new Set(records.map(row=>row.id));
          for(const sourceQuote of input){
            const quoteId=txt(sourceQuote.quote_id);
            if(!quoteId||visible.has(quoteId)||!index.has(quoteId))continue;
            visible.add(quoteId);
            records.push(record(quoteId,sourceQuote['Project / Scope'],
              sourceQuote['Quote Status'],
              sourceQuote['Next Action']||'Review recorded quotation and job linkage',{
                opportunity_id:txt(sourceQuote.opportunity_id),
                job_id:txt(sourceQuote.job_id),
                drive_link:txt(sourceQuote['Drive Link'])
              }));
          }
          const reviews=new Map();
          for(const quote of input){
            const validity=quoteValidityReview(quote,localDay);
            reviews.set(txt(quote.quote_id),validity);
          }
          records=records.map(item=>{
            const validity=reviews.get(item.id);
            if(!validity)return item;
            return {...item,
              next_action:validity.action_required?validity.next_action:item.next_action,
              details:{...item.details,
                'Valid until':validity.valid_until||'UNKNOWN',
                'Validity review':validity.state,
                'Customer delivery':'NOT_INDEPENDENTLY_VERIFIED'}};
          });
          overviewCounts.quotes_validity_review=[...reviews.values()].filter(
            review=>review.action_required).length;
          workItems=workItems.map(item=>{
            const validity=reviews.get(txt(item.id));
            if(!validity?.action_required)return item;
            return {...item,type:'QUOTE_EXPIRED_REVIEW',next_action:validity.next_action};
          });
        }
        attention.push(...workItems.map(item => ({ ...item, department: key })));
      }
      const conflictRows = [...conflicts].map(id => record(id, 'Duplicate record ID', 'REVIEW_REQUIRED',
        Object.hasOwn(duplicateFields,key) ? 'Inspect matching records before acting' : 'Compare the matching rows in the source register before acting'));
      attention.push(...conflictRows.map(item => ({ type: 'EXCEPTION', id: item.id,
        next_action: item.next_action, department: key })));
      departments[key] = { state: conflicts.size ? 'PARTIAL' : 'LIVE', conflict_count: conflicts.size,
        records: [...conflictRows, ...records], source };
    } catch {
      departments[key] = { state: 'UNAVAILABLE', source };
      if(key==='clients'){
        departments.prospects={state:'UNAVAILABLE',source};
        departments.provenance={state:'UNAVAILABLE',source};
      }
    }
  }
  // The funnel is one read-only join of already fetched authoritative tables.
  // If any required register failed, no partial/zero conversion claim is shown.
  const conversionSource={name:'CRM_Master / Jobs_Opportunities / Quotes / Job Execution',
    url:sourceLink(stores.crm?.spreadsheetId || DEFAULT_IDS.crm,1621110075)};
  try{
    const conversion=inspectAttributedConversions({
      clients:rows('clients'),opportunities:rows('jobs'),
      quotes:rows('quotes'),executions:rows('evidence'),intakes:rows('leads')
    });
    departments.conversions={
      state:conversion.state==='UNAVAILABLE'?'UNAVAILABLE':
        conversion.state==='REVIEW_REQUIRED'?'PARTIAL':'LIVE',
      records:[
        ...conversion.exceptions.map(reason=>record(reason,
          'Attribution reconciliation', 'REVIEW_REQUIRED',
          'Reconcile canonical CRM, opportunity, quotation and execution IDs',
          {'Source exception':reason,'Source authority':'Canonical registers'})),
        ...conversion.records.map(record=>({
        id:record.id,title:record.source,status:record.status,
        next_action:record.next_action,
        details:{
          'Client CRM ID':record.client_crm_id,
          'Origin':record.original_origin,
          'Provenance':record.provenance,
          'Inbound enquiries linked':record.matched_inbound_events,
          'Inbound link status':record.inbound_link_state,
          'Quoted':record.quoted?'YES':'NO',
          'Accepted':record.accepted?'YES':'NO',
          'Verified job link':record.linked_job?'YES':'NO',
          'Job ID':record.job_id,
          'Payment':record.payment_status,
          'Profit':record.profit_status
        }
      }))],
      source:conversionSource,exception_count:conversion.exceptions.length,
      by_source:conversion.by_source
    };
    overviewCounts.attributed_jobs=conversion.counts.linked_jobs;
    overviewCounts.inbound_linked_opportunities=conversion.counts.inbound_linked_opportunities;
    overviewCounts.attribution_exceptions=conversion.counts.source_exceptions;
    attention.push(...conversion.exceptions.slice(0,100).map(reason=>({
      type:'EXCEPTION',department:'conversions',id:reason,
      next_action:'Reconcile canonical CRM, opportunity, quotation and execution IDs'
    })));
  }catch{
    departments.conversions={state:'UNAVAILABLE',source:conversionSource};
  }
  // Aspire/LMN labour economics: reuse existing commercial source records,
  // without inventing worker assignments, time logs or verified payroll.
  const labourSource={name:'Labour Rates / Project Cost & Margin',
    url:sourceLink(stores.commercial?.spreadsheetId || DEFAULT_IDS.commercial,1010)};
  try{
    const report=inspectLabourCostRegister({
      rateRows:rows('labour_rates'),marginRows:rows('labour_margins')
    });
    if(report.state==='UNAVAILABLE')throw Error('LABOUR_SOURCES_UNAVAILABLE');
    departments.labour={
      state:report.state==='PARTIAL'?'PARTIAL':'LIVE',source:labourSource,
      records:report.records.map(item=>record(item.id,'Job labour '+item.id,
        item.status,item.next_action,{
          'Margin record':item.margin_record_id,
          'Daily crew rate (ZAR)':item.crew_daily_rate_zar,
          'Crew days':item.crew_days,
          'Provisional labour cost (ZAR)':item.provisional_labour_cost_zar,
          'Calculated crew cost (ZAR)':item.calculated_crew_cost_zar,
          'Actual labour verified':'NO',
          'Blockers':item.blockers.join(', ')
        })),
      rate_issues:report.rate_issues
    };
    overviewCounts.labour_cost_review=report.counts.requires_review;
    attention.push(...report.records.filter(item=>
      item.blockers.includes('CREW_RATE_DAYS_COST_MISMATCH')).slice(0,100).map(item=>({
        type:'LABOUR_COST_REVIEW',department:'labour',id:item.id,
        next_action:item.next_action
      })));
  }catch{
    departments.labour={state:'UNAVAILABLE',source:labourSource};
  }
  const navigation=canonicalRelations(departments);
  return {
    schema_version: 'MAGOS_OPERATOR_DASHBOARD/V1',
    canonical_navigation:{linked_records:navigation.linked_records,links:navigation.links,conflicts:navigation.conflicts},
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


 // Fixed server-side action catalogue: no caller-specified workbook or field access.
 const duplicateFields={
  quotes:['Quote Status','opportunity_id','job_id','Next Action','Valid Until','Project / Scope','Workflow Stage','Line Control State','Drive Link'],
  leads:['source_event_id','source_system','source_type','processing_status','crm_id','opportunity_id','received_at'],
  clients:['company','lead_direction','record_origin','acquisition_source','crm_status','opportunity_id','job_id'],
  jobs:['job_id','client_crm_id','job_status','next_action'],
 };
 async function inspectOperatorAction({stores,action,department,id,now=()=>new Date()}={}){
  if(action!=='inspect-duplicate'||!Object.hasOwn(duplicateFields,department)||
     typeof id!=='string'||!id.trim()||id.length>200)
   return {state:'INVALID_ACTION_INPUT',side_effects:false};
  const [store,sheet,gid,requiredHeaders]=tabs[department], key=idFields[department];
  const scanLimit=10000;
  const fields=duplicateFields[department];
  const rows=await stores[store].readObjects(sheet,{maxRows:scanLimit+1,requiredHeaders:[...new Set([...requiredHeaders,key,...fields])]});
  if(!Array.isArray(rows))throw Error('SOURCE_UNAVAILABLE');
  if(rows.length>scanLimit)return {schema_version:'MAGOS_OPERATOR_ACTION_V1',action,department,id:id.trim(),state:'SOURCE_LIMIT_EXCEEDED',checked_at:now().toISOString(),match_count:null,matches:[],truncated:true,conflicting_fields:[],source:{name:sheet,url:sourceLink(stores[store].spreadsheetId||DEFAULT_IDS[store],gid)},resolution_authorized:false,side_effects:false};
  const matches=rows.filter(row=>txt(row[key])===id.trim());
  const conflicts=fields.filter(field=>new Set(matches.map(row=>txt(row[field]))).size>1);
  const report={schema_version:'MAGOS_OPERATOR_ACTION_V1',action,department,id:id.trim(),
   state:matches.length>1?'REVIEW_REQUIRED':matches.length===1?'UNIQUE':'NOT_FOUND',
   checked_at:now().toISOString(),match_count:matches.length,
   matches:matches.slice(0,50).map((row,index)=>({match:index+1,fields:Object.fromEntries(fields.map(field=>[field,txt(row[field]).slice(0,256)]))})),
   values_truncated:matches.slice(0,50).some(row=>fields.some(field=>txt(row[field]).length>256)),
   truncated:matches.length>50,conflicting_fields:conflicts,
   source:{name:sheet,url:sourceLink(stores[store].spreadsheetId||DEFAULT_IDS[store],gid)},
   resolution_authorized:false,side_effects:false};
  // Limit serialized UTF-8 output, including JSON escaping, not only field lengths.
  const byteLimit=64*1024;
  while(report.matches.length&&Buffer.byteLength(JSON.stringify(report),'utf8')>byteLimit){report.matches.pop();report.truncated=true;}
  if(Buffer.byteLength(JSON.stringify(report),'utf8')>byteLimit)throw Error('OPERATOR_RESPONSE_LIMIT');
  return report;
 }

module.exports = { loadOperatorDashboard, inspectOperatorAction };
