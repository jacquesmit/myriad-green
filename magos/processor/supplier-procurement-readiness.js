'use strict';
const { ACTIONS, scopeGate } = require('./scoped-action-gate');
const norm = x => String(x ?? '').trim().toUpperCase();
/**
 * Supplier vetting and a particular supplier quote are independent authorities.
 * A supplier may be APPROVED while procurement against an unreviewable quote
 * remains restricted. No mutation, booking, PO or payment occurs here.
 */
function assessSupplierProcurement({ supplier, quote, quoteReviewed = false, procurementAuthorized = false } = {}) {
  const blocked = [];
  const review = [];
  if (!supplier?.supplier_id) blocked.push('SUPPLIER_ID_REQUIRED');
  if (norm(supplier?.supplier_approval_state) !== 'APPROVED') blocked.push('SUPPLIER_NOT_APPROVED');
  if (norm(supplier?.active_status) !== 'ACTIVE') blocked.push('SUPPLIER_NOT_ACTIVE');
  if (!quote?.supplier_quote_id) review.push('SUPPLIER_QUOTE_NOT_RESOLVED');
  if (quote?.supplier_id && supplier?.supplier_id && quote.supplier_id !== supplier.supplier_id) blocked.push('SUPPLIER_QUOTE_ID_MISMATCH');
  if (!quoteReviewed) review.push('SUPPLIER_QUOTE_REVIEW_NOT_CONFIRMED');
  if (!procurementAuthorized) review.push('PROCUREMENT_AUTHORIZATION_REQUIRED');
  const args = {blockedReasons:blocked,reviewReasons:review,context:{supplier_id:supplier?.supplier_id || '',supplier_quote_id:quote?.supplier_quote_id || ''}};
  return {
    capability:'SUPPLIER_PROCUREMENT_READINESS',
    supplier_approval_state:norm(supplier?.supplier_approval_state) || 'UNKNOWN',
    release:scopeGate({targetAction:ACTIONS.RELEASE_PROCUREMENT,...args}),
    prepare_draft:scopeGate({targetAction:ACTIONS.PREPARE_DRAFT,...args}),
    request_clarification:scopeGate({targetAction:ACTIONS.REQUEST_CLARIFICATION,...args}),
    writes:[],side_effects:false
  };
}
module.exports={assessSupplierProcurement};
