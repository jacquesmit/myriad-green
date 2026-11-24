'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const source=readFileSync(path.resolve(__dirname,'../wordpress/mgos-water-alert-publisher.php'),'utf8');

test('water alert WordPress boundary requires dedicated bearer secret',()=>{
 assert.match(source,/MAGOS_WATER_ALERT_PUBLISH_TOKEN/);
 assert.match(source,/hash_equals\(\$secret, \$provided\)/);
 assert.match(source,/register_rest_route\(self::NS,'\/water-alert\/publish'/);
 assert.match(source,/permission_callback'=>\[__CLASS__,'auth'\]/);
});
test('publication is idempotent by immutable source key and fingerprint',()=>{
 assert.match(source,/SOURCE_META = '_mgos_water_alert_source_key'/);
 assert.match(source,/FINGERPRINT_META = '_mgos_water_alert_fingerprint'/);
 assert.match(source,/DUPLICATE_NO_OP/);
 assert.match(source,/post_by_source_key\(\$source_key\)/);
});
test('publisher refuses to invent category or tags',()=>{
 assert.match(source,/get_term_by\('slug'.*'category'/s);
 assert.match(source,/get_term_by\('slug'.*'post_tag'/s);
 assert.doesNotMatch(source,/wp_insert_term\(/);
 assert.doesNotMatch(source,/wp_create_category\(/);
});
test('internal links are restricted to published myriadgreen pages',()=>{
 assert.match(source,/\(\$parts\['host'\]\?\?'\'\)!=='myriadgreen\.co\.za'/);
 assert.match(source,/url_to_postid\(\$url\)/);
 assert.match(source,/get_post_status\(\$post_id\)!=='publish'/);
});
test('Rank Math metadata, FAQ schema and public provenance markers are emitted',()=>{
 assert.match(source,/rank_math_title/);
 assert.match(source,/rank_math_description/);
 assert.match(source,/rank_math_focus_keyword/);
 assert.match(source,/FAQPage/);
 assert.match(source,/data-mgos-source/);
 assert.match(source,/data-mgos-fingerprint/);
});
