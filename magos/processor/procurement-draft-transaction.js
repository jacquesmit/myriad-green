'use strict';
const { assessLiveSupplierProcurement } = require('./live-supplier-procurement');
const { createIfAbsent, composeTransactionPlan } = require('../writer/operations');

function required(v,k) { if(typeof v!=='string'||!v.trim())throw new Error(k+'_REQUIRED'); return v.trim(); }
function prepareProcurementDraftPlan({ supplier, quote, poId, sourceEventId, evidenceRef, projectId, quoteId, jobId, totals }={}) {
  const supplierId=required(supplier?.supplier_id,'SUPPLIER_ID');
  const supplierQuoteId=required(quote?.supplier_quote_id,'SUPPLIER_QUOTE_ID');
  if (quote.supplier_id!==supplierId) throw new Error('SUPPLIER_QUOTE_ID_MISMATCH');
  // A draft is not an approved, ordered, paid, released or cleared transaction.
  const po=required(poId,'PO_ID');
  const source=required(sourceEventId,'SOURCE_EVENT_ID');
  const evidence=required(evidenceRef,'EVIDENCE_REF');
  if (!projectId&&!quoteId&&!jobId) throw new Error('PROJECT_LINK_REQUIRED');
  return composeTransactionPlan({
    idempotency_key:'MAGOS_PO_DRAFT_V1|'+source+'|'+po,
    event_type:'PROCUREMENT_DRAFT_PREPARED',
    source_event_id:source,
    evidence_link:evidence,
    preconditions:[],
    writes:[createIfAbsent({
      store:'supplier', workbook_role:'SUPPLIER', sheet:'Purchase_Orders',
      key:{header:'po_id',value:po},authority:'AUTHORITATIVE',entity_type:'Purchase order',
      intent:'PREPARE_UNRELEASED_PURCHASE_ORDER_DRAFT',
      values:{
        po_id:po,supplier_id:supplierId,supplier_name:String(supplier.supplier_name||''),
        project_id:String(projectId||''),quote_id:String(quoteId||''),job_id:String(jobId||''),
        supplier_quote_id:supplierQuoteId,
        order_status:'DRAFT',payment_status:'NOT_PAID',
        approved_by:'',approval_date:'',supplier_order_reference:'',
        notes:'MAGOS controlled draft only. No purchase order released; authority, terms, values, BOQ and payment must pass separate release controls. Evidence: '+evidence
      },
      required_headers:['po_id','supplier_id','supplier_quote_id','order_status','payment_status']
    })]
  });
}
async function prepareProcurementDraft({
 lookupService,writer,supplierId,supplierQuoteId,poId,sourceEventId,evidenceRef,projectId,quoteId,jobId,
 dryRun=false
}={}) {
 if (!writer || typeof writer.execute!=='function') throw new Error('P3_WRITER_REQUIRED');
 const readiness=await assessLiveSupplierProcurement({lookupService,supplierId,supplierQuoteId});
 if(!readiness.verified_supplier_id || !readiness.verified_supplier_quote_id) {
   return {state:'REVIEW_REQUIRED',reason_code:'AUTHORITATIVE_SUPPLIER_OR_QUOTE_MISSING',readiness};
 }
 if (readiness.release.action_state==='BLOCKED') {
   return {state:'BLOCKED',reason_code:'SUPPLIER_RELEASE_CONFLICT',readiness};
 }
 const supplier=await lookupService.findEntityByCanonicalId('Supplier',supplierId);
 const found=await lookupService.store('supplier').findByKey('Supplier_Quotes','supplier_quote_id',supplierQuoteId);
 const plan=prepareProcurementDraftPlan({supplier,quote:found.object,poId,sourceEventId,evidenceRef,projectId,quoteId,jobId});
 if (dryRun) return {state:'DRY_RUN',readiness,plan};
 const execution=await writer.execute(plan);
 return {state:execution.state,readiness,execution,po_id:poId};
}
module.exports={prepareProcurementDraftPlan,prepareProcurementDraft};
