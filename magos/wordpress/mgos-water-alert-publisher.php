<?php
/**
 * Plugin Name: MAGOS Water Alert Publisher
 * Description: Authenticated, idempotent WordPress publication boundary for verified MAGOS municipal water alerts.
 * Version: 0.1.0
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) exit;

final class MAGOS_Water_Alert_Publisher {
    const VERSION = '0.1.0';
    const NS = 'mgos/v1';
    const SOURCE_META = '_mgos_water_alert_source_key';
    const FINGERPRINT_META = '_mgos_water_alert_fingerprint';
    const SOURCE_URL_META = '_mgos_water_alert_source_url';
    const ALERT_TYPE_META = '_mgos_water_alert_type';
    const AREAS_META = '_mgos_water_alert_areas';
    const FAQ_META = '_mgos_water_alert_faq';

    static function secret() {
        $value = defined('MAGOS_WATER_ALERT_PUBLISH_TOKEN')
            ? constant('MAGOS_WATER_ALERT_PUBLISH_TOKEN')
            : getenv('MAGOS_WATER_ALERT_PUBLISH_TOKEN');
        return is_string($value) ? trim($value) : '';
    }

    static function auth($request) {
        $secret = self::secret();
        if (strlen($secret) < 32) {
            return new WP_Error('magos_water_alert_auth_unconfigured',
                'Water alert publisher credential is not configured.',
                ['status'=>503]);
        }
        $header = trim((string)$request->get_header('authorization'));
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return new WP_Error('magos_water_alert_auth_required','Authorization required.',['status'=>401]);
        }
        $provided = trim((string)$m[1]);
        if (!$provided || !hash_equals($secret, $provided)) {
            return new WP_Error('magos_water_alert_auth_invalid','Authorization failed.',['status'=>401]);
        }
        return true;
    }

    static function clean_string($value, $max=1000) {
        $value = sanitize_text_field((string)$value);
        if (function_exists('mb_substr')) return mb_substr($value,0,$max);
        return substr($value,0,$max);
    }

    static function valid_source_key($value) {
        $value = trim((string)$value);
        return strlen($value) >= 12 && strlen($value) <= 512 &&
            preg_match('/^WATER_ALERT\|[A-Z0-9_]+\|[^\s]+$/D',$value);
    }

    static function valid_fingerprint($value) {
        return is_string($value) && preg_match('/^[a-f0-9]{64}$/D',$value);
    }

    static function allowed_myriad_url($url) {
        $url = esc_url_raw((string)$url);
        if (!$url) return '';
        $parts = wp_parse_url($url);
        if (!$parts || ($parts['scheme']??'')!=='https' ||
            ($parts['host']??'')!=='myriadgreen.co.za' ||
            !empty($parts['user']) || !empty($parts['pass']) || !empty($parts['port'])) return '';
        return $url;
    }

    static function published_internal_url($url) {
        $url = self::allowed_myriad_url($url);
        if (!$url) return '';
        $post_id = url_to_postid($url);
        if (!$post_id || get_post_status($post_id)!=='publish') return '';
        return $url;
    }

    static function source_url($url) {
        $url = esc_url_raw((string)$url);
        if (!$url) return '';
        $parts = wp_parse_url($url);
        if (!$parts || ($parts['scheme']??'')!=='https' || empty($parts['host'])) return '';
        return $url;
    }

    static function post_by_source_key($source_key) {
        $posts = get_posts([
            'post_type'=>'post',
            'post_status'=>['publish','draft','pending','future','private'],
            'posts_per_page'=>2,
            'meta_key'=>self::SOURCE_META,
            'meta_value'=>$source_key,
            'orderby'=>'ID',
            'order'=>'ASC',
            'fields'=>'ids'
        ]);
        if (count($posts)>1) {
            return new WP_Error('magos_water_alert_source_not_unique',
                'More than one post has the same immutable water-alert source key.',
                ['status'=>409]);
        }
        return count($posts)===1 ? intval($posts[0]) : 0;
    }

    static function resolve_category($slug) {
        $term = get_term_by('slug',sanitize_title((string)$slug),'category');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('magos_water_alert_category_missing',
                'Required Local Water Alerts category does not exist.',['status'=>409]);
        }
        return intval($term->term_id);
    }

    static function resolve_tags($slugs) {
        if (!is_array($slugs)) return [];
        $ids=[];
        foreach (array_values(array_unique(array_map('sanitize_title',$slugs))) as $slug) {
            if (!$slug) continue;
            $term=get_term_by('slug',$slug,'post_tag');
            if (!$term || is_wp_error($term)) {
                return new WP_Error('magos_water_alert_tag_missing',
                    'Configured water-alert tag does not exist: '.$slug,['status'=>409]);
            }
            $ids[]=intval($term->term_id);
        }
        return $ids;
    }

    static function render_link_group($title,$links) {
        if (!is_array($links) || !$links) return '';
        $items=[];
        foreach ($links as $link) {
            if (!is_array($link)) continue;
            $url=self::published_internal_url($link['url']??'');
            if (!$url) continue;
            $label=self::clean_string($link['area']??($link['label']??($link['role']??'Myriad Green page')),120);
            $items[]='<a href="'.esc_url($url).'">'.esc_html($label).'</a>';
        }
        if (!$items) return '';
        return '<div class="mgwa-links"><strong>'.esc_html($title).'</strong><div>'.implode(' <span aria-hidden="true">·</span> ',$items).'</div></div>';
    }

    static function render_content($payload) {
        $notice=is_array($payload['notice']??null)?$payload['notice']:[];
        $post=is_array($payload['post']??null)?$payload['post']:[];
        $source_key=(string)($payload['source_key']??'');
        $fingerprint=(string)($payload['content_fingerprint']??'');
        $source_hash=hash('sha256',$source_key);
        $title=self::clean_string($post['title']??($notice['title']??''),220);
        $summary=self::clean_string($post['excerpt']??($notice['summary']??''),1200);
        $provider=self::clean_string($notice['provider_display']??($notice['provider']??'Official municipal source'),120);
        $effective=self::clean_string($notice['effective_date']??'',30);
        $type=self::clean_string($notice['alert_type']??'',80);
        $areas=is_array($post['affected_areas']??null)?$post['affected_areas']:[];
        $points=is_array($post['tanker_points']??null)?$post['tanker_points']:[];
        $restrictions=is_array($post['restrictions']??null)?$post['restrictions']:[];
        $faq=is_array($post['faq']??null)?$post['faq']:[];
        $links=is_array($post['internal_links']??null)?$post['internal_links']:[];
        $source_url=self::source_url($post['source_url']??($notice['source_url']??''));

        $html='<!-- MGOS_WATER_ALERT source='.esc_html($source_hash).' fingerprint='.esc_html($fingerprint).' -->';
        $html.='<div class="mgwa" data-mgos-source="'.esc_attr($source_hash).'" data-mgos-fingerprint="'.esc_attr($fingerprint).'">';
        $html.='<section class="mgwa-hero"><div class="mgwa-kicker">'.esc_html(str_replace('_',' ',$type)).'</div>';
        $html.='<p class="mgwa-lead"><strong>'.esc_html($title).'</strong></p>';
        if ($summary) $html.='<p>'.esc_html($summary).'</p>';
        $meta=array_filter([$provider,$effective]);
        if($meta) $html.='<p class="mgwa-meta">'.esc_html(implode(' · ',$meta)).'</p>';
        $html.='</section>';

        if($areas){
            $html.='<section class="mgwa-section"><h2>Affected areas</h2><div class="mgwa-chips">';
            foreach($areas as $area){
                $a=self::clean_string($area,120);
                if($a) $html.='<span>'.esc_html($a).'</span>';
            }
            $html.='</div></section>';
        }

        if($points){
            $html.='<section class="mgwa-section"><h2>Water tanker distribution points</h2><div class="mgwa-grid">';
            foreach($points as $row){
                if(!is_array($row))continue;
                $area=self::clean_string($row['area']??'',120);
                $plist=is_array($row['points']??null)?$row['points']:[];
                if(!$area&&!$plist)continue;
                $html.='<article class="mgwa-card">';
                if($area)$html.='<h3>'.esc_html($area).'</h3>';
                if($plist){
                    $html.='<ul>';
                    foreach($plist as $point){$p=self::clean_string($point,180);if($p)$html.='<li>'.esc_html($p).'</li>';}
                    $html.='</ul>';
                }
                $html.='</article>';
            }
            $html.='</div></section>';
        }

        if($restrictions){
            $html.='<section class="mgwa-section"><h2>Official restrictions or instructions</h2><ul class="mgwa-list">';
            foreach($restrictions as $item){$v=self::clean_string($item,500);if($v)$html.='<li>'.esc_html($v).'</li>';}
            $html.='</ul></section>';
        }

        $html.='<section class="mgwa-section"><h2>Myriad Green practical guidance</h2><div class="mgwa-grid">';
        $guidance=[
            'Use municipal water sparingly while the affected system recovers.',
            'Protect booster pumps against dry running when incoming municipal supply is unavailable or unstable.',
            'Pause automated irrigation if pressure is too low for reliable operation, then test it after supply stabilises.',
            'For tanker collection, use clean food-safe containers and follow the municipality\'s current water-quality instructions.'
        ];
        foreach($guidance as $i=>$g){
            $html.='<div class="mgwa-guide"><b>'.esc_html(sprintf('%02d',$i+1)).'</b><span>'.esc_html($g).'</span></div>';
        }
        $html.='</div></section>';

        $html.='<section class="mgwa-section"><h2>Relevant Myriad Green pages</h2>';
        $html.=self::render_link_group('Affected-area pages',$links['area_pages']??[]);
        $html.=self::render_link_group('Backup water and outage support',$links['primary']??[]);
        $html.=self::render_link_group('Related services',$links['secondary']??[]);
        $html.=self::render_link_group('Shop',$links['shop']??[]);
        $html.='</section>';

        if($faq){
            $html.='<section class="mgwa-section"><h2>Quick answers</h2><div class="mgwa-faq">';
            foreach($faq as $item){
                if(!is_array($item))continue;
                $q=self::clean_string($item['q']??($item['question']??''),220);
                $a=self::clean_string($item['a']??($item['answer']??''),1200);
                if($q&&$a)$html.='<details><summary>'.esc_html($q).'</summary><p>'.esc_html($a).'</p></details>';
            }
            $html.='</div></section>';
        }

        if($source_url){
            $html.='<div class="mgwa-source"><strong>Source:</strong> <a href="'.esc_url($source_url).'" target="_blank" rel="noopener noreferrer nofollow">'.esc_html($provider).'</a>. Conditions can change after publication; confirm later operational updates through the official source.</div>';
        }

        $html.='<section class="mgwa-cta"><div><h2>Need a permanent backup-water solution?</h2><p>Myriad Green can help with storage, pumps, municipal backup integration and pressure systems.</p></div><a href="https://wa.me/27629233952?text=Hi%20Myriad%20Green%2C%20I%20came%20from%20a%20water%20alert%20post." target="_blank" rel="noopener">WhatsApp Myriad Green</a></section>';
        $html.='</div>';
        return $html;
    }

    static function write_seo_meta($post_id,$seo) {
        if(!is_array($seo))return;
        $map=[
            'title'=>'rank_math_title',
            'description'=>'rank_math_description',
            'focus_keyword'=>'rank_math_focus_keyword'
        ];
        foreach($map as $key=>$meta){
            if(!isset($seo[$key]))continue;
            $value=self::clean_string($seo[$key],$key==='description'?180:220);
            if($value!=='') update_post_meta($post_id,$meta,$value);
        }
    }

    static function publish($request) {
        $payload=$request->get_json_params();
        if(!is_array($payload))return new WP_Error('magos_water_alert_payload_required','JSON payload required.',['status'=>400]);
        $source_key=(string)($payload['source_key']??'');
        $fingerprint=(string)($payload['content_fingerprint']??'');
        $notice=is_array($payload['notice']??null)?$payload['notice']:[];
        $post=is_array($payload['post']??null)?$payload['post']:[];
        if(!self::valid_source_key($source_key) || !self::valid_fingerprint($fingerprint)) {
            return new WP_Error('magos_water_alert_identity_invalid','Immutable source key/fingerprint invalid.',['status'=>422]);
        }
        $title=self::clean_string($post['title']??'',220);
        $slug=sanitize_title((string)($post['slug']??''));
        $excerpt=self::clean_string($post['excerpt']??'',1600);
        if(!$title||!$slug||empty($post['source_url'])||empty($post['alert_type'])) {
            return new WP_Error('magos_water_alert_post_fields_required','Required post fields missing.',['status'=>422]);
        }
        $category=self::resolve_category($post['category_slug']??'');
        if(is_wp_error($category))return $category;
        $tags=self::resolve_tags($post['tag_slugs']??[]);
        if(is_wp_error($tags))return $tags;
        $existing=self::post_by_source_key($source_key);
        if(is_wp_error($existing))return $existing;

        if($existing){
            $stored=(string)get_post_meta($existing,self::FINGERPRINT_META,true);
            if($stored && hash_equals($stored,$fingerprint)){
                return self::response($existing,'DUPLICATE_NO_OP',$source_key,$fingerprint);
            }
        }

        $content=self::render_content($payload);
        $data=[
            'post_type'=>'post','post_status'=>'publish','post_title'=>$title,
            'post_name'=>$slug,'post_excerpt'=>$excerpt,'post_content'=>$content,
            'post_category'=>[$category],'tags_input'=>$tags
        ];
        if($existing)$data['ID']=$existing;
        $post_id=wp_insert_post(wp_slash($data),true);
        if(is_wp_error($post_id))return $post_id;

        update_post_meta($post_id,self::SOURCE_META,$source_key);
        update_post_meta($post_id,self::FINGERPRINT_META,$fingerprint);
        update_post_meta($post_id,self::SOURCE_URL_META,self::source_url($post['source_url']));
        update_post_meta($post_id,self::ALERT_TYPE_META,self::clean_string($post['alert_type'],80));
        update_post_meta($post_id,self::AREAS_META,array_values(array_filter(array_map(function($v){return self::clean_string($v,120);},is_array($post['affected_areas']??null)?$post['affected_areas']:[]))));
        update_post_meta($post_id,self::FAQ_META,is_array($post['faq']??null)?$post['faq']:[]);
        self::write_seo_meta($post_id,$post['seo']??[]);

        $featured=absint($post['featured_media_id']??0);
        if($featured){
            if(get_post_type($featured)!=='attachment' || !wp_attachment_is_image($featured)) {
                return new WP_Error('magos_water_alert_featured_media_invalid','Featured media is not a valid image attachment.',['status'=>409]);
            }
            set_post_thumbnail($post_id,$featured);
        }
        clean_post_cache($post_id);
        return self::response($post_id,$existing?'UPDATE_EXISTING':'CREATE_NEW',$source_key,$fingerprint);
    }

    static function response($post_id,$state,$source_key,$fingerprint) {
        return new WP_REST_Response([
            'schema_version'=>'MAGOS_WP_WATER_ALERT_RESULT_V1',
            'state'=>$state,'post_id'=>intval($post_id),
            'status'=>get_post_status($post_id),
            'url'=>get_permalink($post_id),
            'source_key'=>$source_key,
            'source_key_sha256'=>hash('sha256',$source_key),
            'content_fingerprint'=>$fingerprint,
            'updated_gmt'=>get_post_field('post_modified_gmt',$post_id)
        ],200,['Cache-Control'=>'no-store']);
    }

    static function status($request) {
        $source_key=(string)$request->get_param('source_key');
        if(!self::valid_source_key($source_key)) {
            return new WP_Error('magos_water_alert_source_key_invalid','Source key invalid.',['status'=>422]);
        }
        $post_id=self::post_by_source_key($source_key);
        if(is_wp_error($post_id))return $post_id;
        if(!$post_id)return new WP_REST_Response([
            'schema_version'=>'MAGOS_WP_WATER_ALERT_STATUS_V1','state'=>'NOT_FOUND'
        ],404,['Cache-Control'=>'no-store']);
        return self::response($post_id,'READ_BACK',$source_key,(string)get_post_meta($post_id,self::FINGERPRINT_META,true));
    }

    static function output_faq_schema() {
        if(!is_singular('post'))return;
        $post_id=get_queried_object_id();
        $source=(string)get_post_meta($post_id,self::SOURCE_META,true);
        if(!$source)return;
        $faq=get_post_meta($post_id,self::FAQ_META,true);
        if(!is_array($faq)||!$faq)return;
        $entities=[];
        foreach($faq as $item){
            if(!is_array($item))continue;
            $q=self::clean_string($item['q']??($item['question']??''),220);
            $a=self::clean_string($item['a']??($item['answer']??''),1200);
            if(!$q||!$a)continue;
            $entities[]=['@type'=>'Question','name'=>$q,'acceptedAnswer'=>['@type'=>'Answer','text'=>$a]];
        }
        if(!$entities)return;
        echo "\n<script type=\"application/ld+json\" class=\"mgos-water-alert-faq-schema\">".
            wp_json_encode(['@context'=>'https://schema.org','@type'=>'FAQPage','mainEntity'=>$entities],
                JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE).
            "</script>\n";
    }

    static function assets() {
        if(!is_singular('post'))return;
        $post_id=get_queried_object_id();
        if(!get_post_meta($post_id,self::SOURCE_META,true))return;
        wp_enqueue_style('mgos-water-alert',plugins_url('assets/water-alert.css',__FILE__),[],self::VERSION);
    }

    static function init() {
        add_action('wp_enqueue_scripts',[__CLASS__,'assets']);
        add_action('wp_head',[__CLASS__,'output_faq_schema'],30);
        add_action('rest_api_init',function(){
            register_rest_route(self::NS,'/water-alert/publish',[
                'methods'=>'POST','callback'=>[__CLASS__,'publish'],
                'permission_callback'=>[__CLASS__,'auth']
            ]);
            register_rest_route(self::NS,'/water-alert/status',[
                'methods'=>'GET','callback'=>[__CLASS__,'status'],
                'permission_callback'=>[__CLASS__,'auth']
            ]);
        });
    }
}
MAGOS_Water_Alert_Publisher::init();
