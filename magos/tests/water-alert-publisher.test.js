'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  normalizeNotice,verifyOfficialSource,lifecycleFor,
  buildPublicationPlan,sourceKey,fingerprint
}=require('../content/water-alert-publisher');

function notice(overrides={}){
  return {
    provider:'CITY_OF_TSHWANE',
    source_channel:'OFFICIAL_SOCIAL',
    source_account:'CityTshwane',
    source_url:'https://x.com/CityTshwane/status/123',
    source_event_id:'x:CityTshwane:123',
    published_at:'2026-11-24T10:55:00+02:00',
    effective_date:'2026-11-24',
    alert_type:'TANKER_DISTRIBUTION',
    title:'Tshwane Region 7 Water Tanker Distribution — 24 November 2026',
    summary:'Region 7 tanker distribution for Rethabiseng, Sokhulumi and Bronkhorstspruit.',
    affected_areas:['Rethabiseng','Sokhulumi','Bronkhorstspruit'],
    tanker_points:[{area:'Rethabiseng',points:['Ext 1','Proper']}],
    faq:[{q:'Where are tankers?',a:'Region 7.'}],
    evidence:[{type:'OFFICIAL_NOTICE',ref:'https://x.com/CityTshwane/status/123'}],
    ...overrides
  };
}

test('official Tshwane social notice is verified by exact account',()=>{
  const n=normalizeNotice(notice());
  assert.equal(verifyOfficialSource(n).verified,true);
});
test('social repost without exact official account is blocked for review',()=>{
  const plan=buildPublicationPlan(notice({source_account:'LocalNewsPage'}),{
    now:new Date('2026-11-24T12:00:00Z')
  });
  assert.equal(plan.state,'REVIEW_REQUIRED');
  assert.ok(plan.reason_codes.includes('UNVERIFIED_SOCIAL_ACCOUNT'));
});
test('same-day verified tanker notice produces side-effect-free publish plan',()=>{
  const plan=buildPublicationPlan(notice(),{
    now:new Date('2026-11-24T12:00:00Z'),
    site_index:{area_pages:[
      {area:'Rethabiseng',url:'https://example.test/rethabiseng/',status:'draft'},
      {area:'Bronkhorstspruit',url:'https://example.test/bronkhorstspruit/',status:'publish'}
    ]}
  });
  assert.equal(plan.state,'READY_TO_PUBLISH');
  assert.equal(plan.publication_mode,'CREATE_NEW');
  assert.equal(plan.auto_publish_allowed,true);
  assert.equal(plan.side_effects,false);
  assert.equal(plan.wordpress_adapter_required,true);
  assert.equal(plan.post.internal_links.area_pages.length,1);
  assert.equal(plan.post.internal_links.area_pages[0].area,'Bronkhorstspruit');
  assert.deepEqual(plan.post.seo.schema,['BlogPosting','FAQPage']);
});
test('exact source replay with identical content is duplicate no-op',()=>{
  const n=normalizeNotice(notice());
  const plan=buildPublicationPlan(notice(),{
    now:new Date('2026-11-24T12:00:00Z'),
    existing_posts:[{
      post_id:10620,
      source_key:sourceKey(n),
      content_fingerprint:fingerprint(n)
    }]
  });
  assert.equal(plan.state,'DUPLICATE_NO_OP');
  assert.equal(plan.existing_post_id,10620);
});
test('changed notice with same immutable source event becomes update plan',()=>{
  const n=normalizeNotice(notice());
  const plan=buildPublicationPlan(notice({summary:'Updated tanker points.'}),{
    now:new Date('2026-11-24T12:00:00Z'),
    existing_posts:[{
      post_id:10620,
      source_key:sourceKey(n),
      content_fingerprint:fingerprint(n)
    }]
  });
  assert.equal(plan.state,'READY_TO_PUBLISH');
  assert.equal(plan.publication_mode,'UPDATE_EXISTING');
  assert.equal(plan.existing_post_id,10620);
});
test('old notice is retained as historical and not auto-publishable',()=>{
  const n=normalizeNotice(notice({effective_date:'2026-11-01'}));
  assert.equal(lifecycleFor(n,new Date('2026-11-24T12:00:00Z')),'HISTORICAL');
  const plan=buildPublicationPlan(notice({effective_date:'2026-11-01'}),{
    now:new Date('2026-11-24T12:00:00Z')
  });
  assert.equal(plan.state,'REVIEW_REQUIRED');
  assert.equal(plan.auto_publish_allowed,false);
});
test('official website source requires approved provider domain',()=>{
  assert.equal(verifyOfficialSource(normalizeNotice(notice({
    source_channel:'OFFICIAL_WEB',
    source_url:'https://www.tshwane.gov.za/?p=123',
    source_account:''
  }))).verified,true);
  assert.equal(verifyOfficialSource(normalizeNotice(notice({
    source_channel:'OFFICIAL_WEB',
    source_url:'https://example.com/tshwane-copy',
    source_account:''
  }))).verified,false);
});
