'use strict';

// Read-only receivables reconciliation against the existing Commercial authority.
// Cleared allocations are recorded facts, not independent bank verification.
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).toUpperCase();
const moneyCents=v=>{
 const s=txt(v).replace(/^(ZAR|R)\s*/i,'').replace(/[\s\u00a0]/g,'');
 if(!/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(s))return null;
 const n=Number(s.replace(/,/g,''));
 return Number.isSafeInteger(Math.round(n*100))&&n>=0?Math.round(n*100):null;
};
const currency=c=>c===null?null:Number((c/100).toFixed(2));
const activeLine=new Set(['CURRENT','ACTIVE','ISSUED']);
function reconcileInvoice({invoice,lines=[],allocations=[]}={}){
 if(!invoice || !txt(invoice.invoice_id)) return {state:'REVIEW_REQUIRED',issues:['INVOICE_ID_MISSING'],writes:[],side_effects:false};
 const invoiceId=txt(invoice.invoice_id);
 const issues=[],notes=[];
 const invoiceAmount=moneyCents(invoice['Amount (R)']);
 if(invoiceAmount===null)issues.push('INVOICE_AMOUNT_UNVERIFIED');
 if(!['ISSUED','SENT','PAID','FINAL','APPROVED'].includes(norm(invoice['Invoice Document Status'])))
   issues.push('INVOICE_NOT_ISSUED');
 if(!['LINE_CONTROL_OK','PASS'].includes(norm(invoice['Line Control State'])))
   issues.push('INVOICE_LINE_CONTROL_UNVERIFIED');
 const currentLines=lines.filter(r=>txt(r.invoice_id)===invoiceId && activeLine.has(norm(r.line_status)));
 const seenLines=new Set();
 let linesTotal=0;
 if(!currentLines.length)issues.push('ACTIVE_INVOICE_LINES_MISSING');
 for(const r of currentLines){
   const id=txt(r.invoice_line_id);
   if(!id||seenLines.has(id))issues.push('DUPLICATE_OR_MISSING_LINE_ID');
   seenLines.add(id);
   const amount=moneyCents(r.total_inc_vat);
   if(amount===null)issues.push('INVALID_INVOICE_LINE_AMOUNT:'+id);
   else linesTotal+=amount;
   if(!txt(r.source_evidence))issues.push('INVOICE_LINE_EVIDENCE_MISSING:'+id);
 }
 if(invoiceAmount!==null&&currentLines.length&&linesTotal!==invoiceAmount)
   issues.push('INVOICE_LINE_TOTAL_MISMATCH');
 const invoiceAllocations=allocations.filter(r=>txt(r.invoice_id)===invoiceId);
 const seenAllocations=new Set();
 let clearedCents=0,unverifiedCents=0;
 for(const row of invoiceAllocations){
   const id=txt(row.allocation_id);
   if(!id||seenAllocations.has(id)){issues.push('DUPLICATE_OR_MISSING_ALLOCATION_ID');continue;}
   seenAllocations.add(id);
   const amount=moneyCents(row.amount);
   if(amount===null){issues.push('ALLOCATION_AMOUNT_INVALID:'+id);continue;}
   if(norm(row.allocation_state)==='CLEARED'){
     if(!txt(row.payment_event_id)||!txt(row.evidence_link)){
       issues.push('CLEARED_ALLOCATION_EVIDENCE_MISSING:'+id);continue;
     }
     clearedCents+=amount;
   } else if(!['REVERSED','VOID','CANCELLED'].includes(norm(row.allocation_state))){
     unverifiedCents+=amount;
   }
 }
 const balance=invoiceAmount===null?null:invoiceAmount-clearedCents;
 if(balance!==null && balance<0)issues.push('ALLOCATION_EXCEEDS_INVOICE_AMOUNT');
 if(invoiceAmount!==null&&moneyCents(invoice['Amount Paid (R)'])!==null &&
    moneyCents(invoice['Amount Paid (R)'])!==clearedCents)
   notes.push('INVOICE_PAYMENT_SNAPSHOT_DIFFERS_FROM_ALLOCATION');
 if(invoiceAmount!==null&&moneyCents(invoice['Balance (R)'])!==null &&
    moneyCents(invoice['Balance (R)'])!==balance)
   notes.push('INVOICE_BALANCE_SNAPSHOT_DIFFERS_FROM_ALLOCATION');
 return {
   schema_version:'MAGOS_RECEIVABLE_RECONCILIATION_V1',
   invoice_id:invoiceId,job_id:txt(invoice.job_id),opportunity_id:txt(invoice.opportunity_id),
   state:issues.length?'REVIEW_REQUIRED':balance===0?'RECORDED_CLEARED_BALANCE_ZERO':'RECEIVABLE_OUTSTANDING',
   issues:[...new Set(issues)],notes:[...new Set(notes)],
   invoice_amount_zar:currency(invoiceAmount),
   current_line_total_zar:currency(currentLines.length?linesTotal:null),
   recorded_cleared_allocations_zar:currency(clearedCents),
   unverified_allocations_zar:currency(unverifiedCents),
   recorded_balance_zar:currency(balance),
   independent_bank_confirmation:false,
   financial_close_authorized:false,
   writes:[],side_effects:false
 };
}
async function inspectInvoiceReceivable({stores,invoiceId}={}){
 if(!txt(invoiceId)||typeof stores?.commercial?.readObjects!=='function')
   return {state:'REVIEW_REQUIRED',issues:['INVOICE_OR_READER_MISSING'],writes:[],side_effects:false};
 const [invoices,lines,allocations]=await Promise.all([
   stores.commercial.readObjects('Invoices'),
   stores.commercial.readObjects('Invoice_Lines'),
   stores.commercial.readObjects('Payment_Allocations')
 ]);
 if(![invoices,lines,allocations].every(Array.isArray))throw Error('CANONICAL_FINANCE_READ_FAILURE');
 const matching=invoices.filter(row=>txt(row.invoice_id)===invoiceId);
 if(matching.length!==1)return {state:'REVIEW_REQUIRED',
   invoice_id:invoiceId,issues:[matching.length?'INVOICE_ID_NOT_UNIQUE':'INVOICE_NOT_FOUND'],
   writes:[],side_effects:false};
 return reconcileInvoice({invoice:matching[0],lines,allocations});
}
module.exports={reconcileInvoice,inspectInvoiceReceivable,moneyCents};
