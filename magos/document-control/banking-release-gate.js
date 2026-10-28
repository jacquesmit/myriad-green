'use strict';
// MAGOS document release gate. Must be invoked by the document issuance service.
// The authoritative bank configuration must be supplied from a controlled source;
// never use old invoices as the authority.
const PAYABLE = new Set(['QUOTE','QUOTATION','INVOICE','PRO_FORMA','PROFORMA','DEPOSIT_REQUEST','PAYMENT_REQUEST']);
const FIELDS = ['account_holder','bank','account_type','account_number','branch_code'];
const clean = v => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g,'');
function validateBankingRelease(document, canonicalBank, extractedPdfText) {
  if (!PAYABLE.has(String(document?.type || '').toUpperCase())) return {status:'NOT_APPLICABLE',errors:[]};
  const errors=[];
  for(const f of FIELDS) {
    const actual=document?.banking?.[f], approved=canonicalBank?.[f];
    if(!actual || !approved || clean(actual)!==clean(approved)) errors.push('BANK_'+f.toUpperCase()+'_INVALID');
  }
  if(!document?.payment_reference || clean(document.payment_reference).length<3) errors.push('PAYMENT_REFERENCE_MISSING');
  if(typeof document?.amount_due !== 'number' || !Number.isFinite(document.amount_due) || document.amount_due<0) errors.push('AMOUNT_DUE_INVALID');
  if(!document?.payment_terms) errors.push('PAYMENT_TERMS_MISSING');
  if(!extractedPdfText) errors.push('RENDERED_PDF_TEXT_MISSING');
  else {
    const text=clean(extractedPdfText);
    for(const f of FIELDS) {
      if(!canonicalBank?.[f] || !text.includes(clean(canonicalBank[f]))) errors.push('PDF_'+f.toUpperCase()+'_MISSING');
    }
    if(!document?.payment_reference || !text.includes(clean(document.payment_reference))) errors.push('PDF_REFERENCE_MISSING');
    if(!document?.payment_terms || !text.includes(clean(document.payment_terms))) errors.push('PDF_TERMS_MISSING');
  }
  return {status:errors.length?'BLOCKED':'PASS',errors};
}
function requireBankingRelease(document, canonicalBank, extractedPdfText) {
  const result=validateBankingRelease(document,canonicalBank,extractedPdfText);
  if(result.status!=='PASS') throw Object.assign(new Error('MAGOS_BANKING_RELEASE_BLOCKED'),{details:result});
  return result;
}
module.exports={validateBankingRelease,requireBankingRelease};
