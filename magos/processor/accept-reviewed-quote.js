'use strict';

const {patchIfMatch,composeTransactionPlan}=require('../writer/operations');
const value=x=>String(x??'').trim();
const upper=x=>value(x).toUpperCase();
const {sourceVersion}=require('./wordpress-acceptance-verifier');

/**
 * Finalize the canonical quote only after the WordPress signature receipt
 * has been independently reviewed, matched to the live version/PDF and
 * authenticated by a trusted verifier. Never creates a job or clears funds.
 */
async function acceptReviewedQuote({writer,quoteId,authorityVerifier,dryRun=false}={}){
  const review=(reason_code)=>({state:'REVIEW_REQUIRED',reason_code,quote_id:quoteId,
    writes:[],side_effects:false});
  if(!writer?.stores?.commercial?.findByKey||
     typeof writer.stores.commercial.readObjects!=='function'||
     typeof writer.execute!=='function')
    return review('P3_WRITER_AND_COMMERCIAL_READER_REQUIRED');
  const id=value(quoteId);
  if(!id)return review('QUOTE_ID_REQUIRED');
  let found;
  try {found=await writer.stores.commercial.findByKey('Quotes','quote_id',id);}
  catch {return review('QUOTE_SOURCE_UNAVAILABLE');}
  const quote=found?.object;
  if(!quote||value(quote.quote_id)!==id)return review('QUOTE_NOT_FOUND');
  if(upper(quote['Quote Status'])==='ACCEPTED')
    return review('QUOTE_ALREADY_ACCEPTED_RECONCILE_EXISTING_ACCEPTANCE');
  if(upper(quote['Quote Status'])!=='ACTIVE'||upper(quote['Workflow Stage'])!=='SENT')
    return review('QUOTE_NOT_ACTIVE_AND_SENT');
  if(!['PASS','LINE_CONTROL_OK'].includes(upper(quote['Line Control State'])))
    return review('QUOTE_LINE_CONTROL_NOT_VERIFIED');
  const opp=value(quote.opportunity_id),pdf=value(quote['Drive Link']);
  if(!opp||!/^https:\/\/drive\.google\.com\//.test(pdf))
    return review('CANONICAL_OPPORTUNITY_OR_ISSUED_PDF_UNVERIFIED');
  if(typeof authorityVerifier!=='function')
    return review('TRUSTED_SIGNATURE_VERIFIER_REQUIRED');
  let signed;
  try {signed=await authorityVerifier({quote_id:id,opportunity_id:opp});}
  catch {return review('TRUSTED_SIGNATURE_VERIFICATION_FAILED');}
  if(signed?.verified!==true||signed.quote_id!==id||signed.opportunity_id!==opp||
    !value(signed.evidence_ref)||!value(signed.source_event_id)||
    !value(signed.signer_identity)||!value(signed.signed_at)||
    !value(signed.quote_version)||!value(signed.receipt_id)||
    signed.authority!=='WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH')
    return review(signed?.reason_code||'TRUSTED_SIGNED_RECEIPT_INCOMPLETE');
  if(!/^https:\/\/drive\.google\.com\//.test(value(signed.evidence_ref)))
    return review('SIGNED_RECEIPT_EVIDENCE_NOT_IN_DRIVE');
  // Re-read the canonical CURRENT quote lines after the external signature
  // check. Bind each CURRENT row as a writer precondition to prevent a stale
  // or changed version being approved through an unchanged Quotes header.
  let lines;
  try{lines=await writer.stores.commercial.readObjects('Quote_Lines',{maxRows:null});}
  catch{return review('CURRENT_QUOTE_LINE_SOURCE_UNAVAILABLE');}
  const current=Array.isArray(lines)?lines.filter(row=>
    value(row.quote_id)===id&&upper(row.line_status)==='CURRENT'):[];
  if(!current.length||sourceVersion(lines,id)!==value(signed.quote_version)||
    current.some(row=>!value(row.quote_line_id))||
    new Set(current.map(row=>value(row.quote_line_id))).size!==current.length)
    return review('SIGNED_QUOTE_CURRENT_VERSION_CHANGED_OR_AMBIGUOUS');
  const linePreconditions=current.map(row=>({
    store:'commercial',sheet:'Quote_Lines',
    key:{header:'quote_line_id',value:value(row.quote_line_id)},
    expect:{quote_id:id,quote_version:value(signed.quote_version),line_status:'CURRENT'}
  }));

  const plan=composeTransactionPlan({
    idempotency_key:'MAGOS_REVIEWED_QUOTE_ACCEPT_V1|'+signed.source_event_id+'|'+id+'|'+signed.quote_version,
    event_type:'REVIEWED_QUOTE_ACCEPTANCE_CONFIRMED',
    source_event_id:signed.source_event_id,
    evidence_link:signed.evidence_ref,
    preconditions:[{
      store:'commercial',sheet:'Quotes',key:{header:'quote_id',value:id},
      expect:{'Quote Status':'ACTIVE','Workflow Stage':'SENT',
        'Line Control State':quote['Line Control State'],
        opportunity_id:opp,'Drive Link':pdf}
    },...linePreconditions],
    writes:[patchIfMatch({
      store:'commercial',workbook_role:'COMMERCIAL',sheet:'Quotes',
      key:{header:'quote_id',value:id},
      entity_type:'Quote',authority:'AUTHORITATIVE',
      intent:'ACCEPT_INDEPENDENTLY_REVIEWED_SIGNED_QUOTE',
      expect:{'Quote Status':'ACTIVE','Workflow Stage':'SENT',
        'Line Control State':quote['Line Control State'],
        opportunity_id:opp,'Drive Link':pdf},
      changes:{'Quote Status':'ACCEPTED'}
    })]
  });
  if(dryRun)return {state:'DRY_RUN',quote_id:id,quote_version:signed.quote_version,
    plan,customer_message_sent:false,job_created:false,payment_cleared:false};
  let result;
  try{result=await writer.execute(plan);}
  catch{return review('P3_QUOTE_TRANSACTION_FAILED');}
  if(result?.state!=='COMMITTED'&&result?.state!=='DUPLICATE_NO_OP')
    return {state:result?.state||'REVIEW_REQUIRED',reason_code:'P3_NOT_COMMITTED',quote_id:id,
      transaction:result};
  let readback,postLines;
  try{
    [readback,postLines]=await Promise.all([
      writer.stores.commercial.findByKey('Quotes','quote_id',id),
      writer.stores.commercial.readObjects('Quote_Lines',{maxRows:null})
    ]);
  }catch{return {state:'COMMIT_READBACK_UNVERIFIED',quote_id:id,transaction:result};}
  if(sourceVersion(postLines,id)!==value(signed.quote_version))
    return {state:'COMMIT_READBACK_UNVERIFIED',quote_id:id,
      reason_code:'CURRENT_VERSION_CHANGED_DURING_ACCEPTANCE',transaction:result};
  if(!readback||value(readback.object?.quote_id)!==id||
    upper(readback.object['Quote Status'])!=='ACCEPTED'||
    value(readback.object.opportunity_id)!==opp||
    value(readback.object['Drive Link'])!==pdf)
    return {state:'COMMIT_READBACK_UNVERIFIED',quote_id:id,transaction:result};
  return {state:result.state,quote_id:id,quote_version:signed.quote_version,
    acceptance_event_id:signed.source_event_id,receipt_id:signed.receipt_id,
    transaction:result,readback_verified:true,
    job_created:false,payment_cleared:false,customer_message_sent:false};
}
module.exports={acceptReviewedQuote};
