'use strict';

/**
 * MAGOS executable workflow catalogue.
 *
 * These are operators' domain names, not personalities or AG numbers.
 * Every executable workflow reuses an existing governed event processor.
 * AG/JT identifiers are legacy reporting aliases only.
 */
const WORKFLOWS = Object.freeze({
  'lead-intake': Object.freeze({
    name:'Lead Intake', event_type:'LEAD_SUBMITTED',
    description:'Validate an inbound business lead, match CRM identity and follow governed intake controls.',
    legacy_job_type:'JT-001', legacy_agent_id:'AG-002'
  }),
  'supplier-inbox': Object.freeze({
    name:'Supplier Inbox', event_type:'SUPPLIER_EMAIL_RECEIVED',
    description:'Inspect supplier messages, resolve exact supplier identity and route evidence safely.',
    legacy_job_type:'JT-202', legacy_agent_id:'AG-012'
  }),
  'payment-evidence': Object.freeze({
    name:'Payment Evidence', event_type:'PAYMENT_OBSERVED',
    description:'Process payment evidence without equating proof of payment with cleared funds.',
    legacy_job_type:'JT-007', legacy_agent_id:'AG-010'
  }),
  'supplier-pricing': Object.freeze({
    name:'Supplier Pricing', event_type:'SUPPLIER_PRICE_OBSERVED',
    description:'Reconcile supplier price evidence with canonical product and supplier records.',
    legacy_job_type:'JT-009', legacy_agent_id:'AG-006'
  }),
  'document-intake': Object.freeze({
    name:'Document Intake', event_type:'DOCUMENT_RECEIVED',
    description:'Route new documents through the existing 00A resolver and review gates.',
    legacy_job_type:'JT-001', legacy_agent_id:'AG-002'
  }),
  'document-filing': Object.freeze({
    name:'Document Filing', event_type:'DOCUMENT_FILED',
    description:'Record governed document filing with canonical linkage and audit evidence.',
    legacy_job_type:'JT-001', legacy_agent_id:'AG-002'
  })
});
function listWorkflows() {
  return Object.entries(WORKFLOWS).map(([id,item])=>({id,...item}));
}
function workflowById(id) {
  return Object.prototype.hasOwnProperty.call(WORKFLOWS,id) ? WORKFLOWS[id] : null;
}
module.exports={WORKFLOWS,listWorkflows,workflowById};
