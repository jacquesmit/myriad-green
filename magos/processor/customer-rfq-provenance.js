'use strict';
// Existing Intake_Queue supplies the only authority for a customer RFQ link.
// Generic email subjects or RFQ labels are insufficient: supplier RFQs stay
// outside the inbound customer pipeline and all links require exact IDs.
const v=x=>String(x??'').trim();
const up=x=>v(x).toUpperCase();
const denied=/SCRAPER|OUTBOUND|PROSPECTING|TODAY_OUTREACH|GOOGLE_PLACES/;
const supplierDoc=/SUPPLIER|PURCHASE|INVOICE|STOCK|PRICING|PROCUREMENT|VENDOR/;
function isCanonicalCustomerRfq(row){
 if(up(row?.source_type)!=='RFQ')return false;
 const source=up(row.source_system);
 if(!['GMAIL','DIRECT_EMAIL','WEBSITE','WORDPRESS','FLUENT_FORMS'].includes(source))return false;
 if(denied.test([source,up(row.record_origin),up(row.lead_direction),
   up(row.acquisition_source),up(row.source_category)].join('|')))return false;
 if(v(row.supplier_id)||supplierDoc.test([up(row.business_document_type),
   up(row.source_category)].join('|')))return false;
 if(['SELF_TEST','TEST','SPAM','PHISHING','SUPPLIER'].includes(up(row.match_status)))return false;
 if(!['LINKED','MATCHED'].includes(up(row.processing_status)))return false;
 if(!['EXACT_MATCH','NEW_RECORD','MATCHED','LINKED'].includes(up(row.match_status)))return false;
 if(!v(row.intake_id)||!v(row.source_event_id)||!v(row.matched_crm_id)||
    !v(row.matched_opportunity_id))return false;
 return true;
}
module.exports={isCanonicalCustomerRfq};
