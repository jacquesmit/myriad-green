'use strict';

// Provenance belongs to the source, not the sales stage. A scraped contact in
// CRM_Master is not a customer enquiry simply because it has a CRM ID.
const val=x=>String(x??'').trim();
const up=x=>val(x).toUpperCase();
const outbound=x=>/(^|[_\s-])(SCRAPER|SCRAPED|OUTBOUND|PROSPECTING|TODAY_OUTREACH|LEADGIBBON|GOOGLE_PLACES)(?=$|[_\s-])/.test(up(x));
const inboundOrigins=new Set(['WEBSITE','WORDPRESS','FLUENT_FORMS','WHATSAPP',
 'WHATSAPP_CLIENT_REQUEST','WHATSAPP_MANUAL','FACEBOOK','FACEBOOK_LEAD',
 'WEBSITE_FORM','WEB_FORM','CONTACT_FORM',
 'GMAIL','EMAIL','REFERRAL','GOOGLE_BUSINESS','GOOGLE_ADS','ORGANIC_SEARCH','AMELIA']);
const hasClientActivity=r=>!!(val(r.job_id)||val(r.invoice_id)||
  (val(r.quote_id)&&val(r.source_evidence))) &&
  !!(val(r.source_evidence)||val(r.source_message_id));
function classifyCrmProvenance(r={}){
 const direction=up(r.lead_direction),origin=up(r.record_origin);
 const acquisition=up(r.acquisition_source),channel=up(r.first_contact_channel);
 const explicitOutbound=direction==='OUTBOUND' ||
   [origin,acquisition,channel].some(outbound);
 const legacyScraper=!!val(r.source_query) &&
   !!(val(r.google_maps_link)||val(r.website_phone_status)||val(r.website_phone_source_url)) &&
   !['INBOUND','EXISTING_CLIENT'].includes(direction) &&
   !hasClientActivity(r);
 if(explicitOutbound||legacyScraper){
  if(hasClientActivity(r))return {kind:'CONVERTED_OUTBOUND',
    reason:'ORIGINAL_OUTBOUND_WITH_VERIFIABLE_CLIENT_ACTIVITY'};
  if(direction==='INBOUND')return {kind:'PROVENANCE_REVIEW',
    reason:'INBOUND_DIRECTION_CONFLICTS_WITH_OUTBOUND_ORIGIN'};
  return {kind:'OUTBOUND_PROSPECT',
    reason:legacyScraper&&!explicitOutbound?'LEGACY_SCRAPER_EVIDENCE':'OUTBOUND_ORIGIN'};
 }
 if(direction==='INBOUND' && inboundOrigins.has(origin))
  return {kind:'INBOUND_ENQUIRY',reason:'RECORDED_INBOUND_SOURCE'};
 if(direction==='INBOUND' && hasClientActivity(r))
  return {kind:'INBOUND_ENQUIRY',reason:'RECORDED_INBOUND_WITH_CLIENT_ACTIVITY'};
 return {kind:'PROVENANCE_REVIEW',reason:'UNVERIFIED_OR_CONFLICTING_SOURCE'};
}
// Runs before the P3 lead writer. Outbound source events are not inbound
// lead submissions, irrespective of how caller-controlled payload is labelled.
function assessInboundEvent(envelope={}){
 const lead=envelope?.payload?.lead||{};
 const origin=up(lead.record_origin),direction=up(lead.lead_direction);
 const markers=[envelope.source,lead.source_type,lead.acquisition_source,
  lead.first_contact_channel];
 if(direction==='OUTBOUND'||markers.some(outbound)||outbound(origin))
  return {allowed:false,reason_code:'OUTBOUND_PROSPECT_REQUIRES_OUTREACH_PIPELINE'};
 if(direction && !['INBOUND','UNKNOWN'].includes(direction))
  return {allowed:false,reason_code:'LEAD_DIRECTION_NOT_VERIFIED'};
 return {allowed:true,reason_code:'INBOUND_SOURCE_NOT_OUTBOUND'};
}
module.exports={classifyCrmProvenance,assessInboundEvent};
