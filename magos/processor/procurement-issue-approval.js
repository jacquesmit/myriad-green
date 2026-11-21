'use strict';
const { stateTransition, composeTransactionPlan } = require('../writer/operations');

const norm = v => String(v ?? '').trim();
const status = v => norm(v).toUpperCase();
function reject(code, details={}) { return {state:'REVIEW_REQUIRED',reason_code:code,...details,writes:[]}; }

/**
 * Evaluates exact, persisted business facts; never accepts "gate passed" flags
 * from a request as authoritative. Release means internal approval for issue,
 * not external supplier dispatch, payment, receipt, or clearance.
 */
async function planPurchaseOrderIssueApproval({
  lookupService, poId, sourceEventId, approvalEvidence, approverId
}={}) {
  if (!lookupService?.store || !lookupService.findEntityByCanonicalId) throw Error('AUTHORITATIVE_LOOKUP_REQUIRED');
  if (![poId,sourceEventId,approvalEvidence,approverId].every(norm)) return reject('APPROVAL_EVIDENCE_OR_ID_MISSING');
  const poStore=lookupService.store('supplier');
  const commercial=lookupService.store('commercial');
  const purchase=(await poStore.findByKey('Purchase_Orders','po_id',poId))?.object;
  if (!purchase) return reject('PO_NOT_FOUND');
  if (status(purchase.order_status)!=='DRAFT') return reject('PO_NOT_DRAFT');
  const supplier=await lookupService.findEntityByCanonicalId('Supplier',purchase.supplier_id);
  if (!supplier || status(supplier.supplier_approval_state)!=='APPROVED' || status(supplier.active_status)!=='ACTIVE') return reject('SUPPLIER_NOT_APPROVED_ACTIVE');
  const quote=(await poStore.findByKey('Supplier_Quotes','supplier_quote_id',purchase.supplier_quote_id))?.object;
  if (!quote || quote.supplier_id!==purchase.supplier_id) return reject('SUPPLIER_QUOTE_NOT_MATCHED');
  if (!norm(purchase.job_id)) return reject('CANONICAL_JOB_ID_REQUIRED');
  const lines=(await poStore.readObjects('Purchase_Order_Lines')).filter(l=>l.po_id===poId);
  if(!lines.length) return reject('PURCHASE_ORDER_LINES_MISSING');
  const procurement=await commercial.readObjects('Procurement');
  const ids=new Set();
  let total=0;
  for(const line of lines) {
    if(!norm(line.po_line_id)||ids.has(line.po_line_id)) return reject('PO_LINE_ID_NOT_UNIQUE');
    ids.add(line.po_line_id);
    const key=norm(line.procurement_line_id);
    const matches=procurement.filter(p=>norm(p['Procurement ID'])===key);
    if(!key||matches.length!==1) return reject('PROCUREMENT_LINE_NOT_EXACT');
    const row=matches[0];
    if(norm(row['Job ID'])!==purchase.job_id || norm(row.supplier_id)!==purchase.supplier_id) return reject('PROCUREMENT_JOB_OR_SUPPLIER_MISMATCH');
    if(status(row['Procurement Gate'])!=='AUTHORISED'||status(row.technical_gate)!=='PASSED') return reject('PROCUREMENT_GATE_NOT_CLEARED');
    if(status(row['Deposit Status'])!=='CLEARED') return reject('DEPOSIT_NOT_CLEARED');
    if(norm(row.boq_line_id)==='' || norm(row['Material / Part ID'])!==norm(line.part_id)) return reject('BOQ_PART_LINK_NOT_VERIFIED');
    const qty=Number(line.quantity_ordered);
    const unit=Number(line.unit_price_ex_vat);
    const net=Number(line.line_total_ex_vat);
    const gross=Number(line.line_total_inc_vat);
    if (![qty,unit,net,gross].every(Number.isFinite) || qty<=0 || unit<0 || net<0 || gross<net || Math.abs(qty*unit-net)>0.02) return reject('PO_LINE_TOTALS_NOT_VERIFIED');
    total+=gross;
  }
  // Preserve exact P3 state and approval CAS. No supplier submission happens.
  const plan=composeTransactionPlan({
    idempotency_key:'MAGOS_PO_APPROVAL_V1|'+sourceEventId+'|'+poId,
    event_type:'PURCHASE_ORDER_ISSUE_APPROVED',
    source_event_id:sourceEventId,
    evidence_link:approvalEvidence,
    preconditions:[],
    writes:[stateTransition({
      store:'supplier',workbook_role:'SUPPLIER',sheet:'Purchase_Orders',
      key:{header:'po_id',value:poId},authority:'AUTHORITATIVE',
      entity_type:'Purchase order',intent:'APPROVE_PO_FOR_MANUAL_ISSUE',
      state_field:'order_status',from_state:'DRAFT',to_state:'APPROVED_FOR_ISSUE',
      changes:{approved_by:approverId,approval_date:new Date().toISOString().slice(0,10)},
      required_headers:['po_id','supplier_id','supplier_quote_id','payment_status','approved_by','approval_date','order_status']
    })]
  });
  return {state:'READY_FOR_APPROVAL',po_id:poId,po_line_count:lines.length,computed_total_inc_vat:Math.round(total*100)/100,plan, external_order_sent:false,payment_authorized:false};
}
module.exports={planPurchaseOrderIssueApproval};
