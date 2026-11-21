'use strict';

// Read-only corroboration across supplier invoice receipt and physical job stock.
// Neither a GRN nor a stock movement independently proves paid funds or consent.
const {validDriveUrl,positive}=require('./supplier-cost-evidence');
const v=x=>String(x??'').trim();
const qty=x=>{const t=v(x);return /^(?:\d+)(?:\.\d{1,3})?$/.test(t)?Number(t):null;};
const fileId=url=>{const m=v(url).match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);return m?.[1]||'';};
async function inspectSupplierReceiptStock({stores,allocation,sourceLine}={}){
 const blockers=[];
 const reject=code=>blockers.push(code);
 const a=allocation||{},part=v(a.part_id),job=v(a.job_id);
 const n=qty(a.allocated_qty),allocatedCents=positive(a.allocated_value_incl_vat);
 if(!stores?.supplier?.readObjects)return {
  verified:false,blockers:['SUPPLIER_STOCK_READERS_MISSING'],writes:[],side_effects:false
 };
 if(!job||!part||!v(a.supplier_document_id)||!v(a.source_line_id)||
    n===null||n<=0||allocatedCents===null)
  reject('SOURCE_ALLOCATION_IDENTITY_OR_QUANTITY_INVALID');
 const invoiceNumber=v(sourceLine?.supplier_quote_number)||v(a.supplier_document_id);
 if(!invoiceNumber||/^SQT-/.test(invoiceNumber))
  reject('ACTUAL_SUPPLIER_INVOICE_NUMBER_NOT_VERIFIED');
 const evidenceFile=fileId(a.evidence_link);
 if(!evidenceFile||evidenceFile!==v(a.evidence_drive_file_id)||
    !validDriveUrl(a.evidence_link))
  reject('SUPPLIER_INVOICE_FILE_ID_NOT_VERIFIED');
 let grns,movements;
 try {
  [grns,movements]=await Promise.all([
    stores.supplier.readObjects('Goods_Received',{maxRows:null}),
    stores.supplier.readObjects('Stock_Ledger',{maxRows:null})
  ]);
 }catch{reject('GRN_OR_STOCK_SOURCE_UNAVAILABLE');}
 if(!Array.isArray(grns)||!Array.isArray(movements)){
  reject('GRN_OR_STOCK_SOURCE_UNAVAILABLE');
  return {verified:false,blockers:[...new Set(blockers)],writes:[],side_effects:false};
 }
 const matches=grns.filter(r=>v(r.supplier_invoice_number)===invoiceNumber &&
    v(r.received_part_id)===part&&v(r.condition_status)==='GOOD'&&
    v(r.discrepancy_status)==='NONE'&&v(r.grn_line_id)&&
    validDriveUrl(r.source_document)&&fileId(r.source_document)===evidenceFile);
 if(matches.length!==1)reject('UNIQUE_MATCHING_SUPPLIER_INVOICE_GRN_REQUIRED');
 const grn=matches.length===1?matches[0]:null;
 if(grn){
  const received=qty(grn.quantity_received),damaged=qty(grn.quantity_damaged),
    missing=qty(grn.quantity_missing);
  if(received===null||damaged===null||missing===null||
     received-damaged<n||missing>0)
    reject('INSUFFICIENT_UNDAMAGED_RECEIVED_QUANTITY');
  const unitCents=positive(grn.actual_unit_cost_inc_vat);
  if(unitCents===null||!Number.isInteger(n*unitCents)||
     Math.abs(n*unitCents-allocatedCents)>1)
    reject('GRN_RECEIPT_PRICE_AND_ALLOCATION_MISMATCH');
 }
 const relevant=movements.filter(r=>v(r.destination_job_id)===job&&
    v(r.part_id)===part&&v(r.source_grn_line_id)===v(grn?.grn_line_id)&&
    validDriveUrl(r.evidence_link)&&
    ['ISSUE_TO_JOB','JOB_CONSUMPTION','JOB_ISSUE'].includes(v(r.movement_type))&&
    /^-\d+(?:\.\d{1,3})?$/.test(v(r.quantity_change)));
 const issueIds=new Set(relevant.map(x=>v(x.movement_id)));
 const total=relevant.reduce((s,r)=>s+Math.abs(Number(r.quantity_change)),0);
 if(!grn||!relevant.length||issueIds.size!==relevant.length||
    relevant.some(r=>!v(r.movement_id))||Math.abs(total-n)>1e-6)
   reject('EXACT_JOB_STOCK_ISSUE_NOT_RECONCILED');
 return {verified:!blockers.length,blockers:[...new Set(blockers)],
  grn_line_id:v(grn?.grn_line_id),job_id:job,part_id:part,
  allocated_quantity:n,issue_quantity:total,
  invoice_document_id:invoiceNumber,writes:[],side_effects:false};
}
module.exports={inspectSupplierReceiptStock,fileId};
