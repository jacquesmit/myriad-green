<?php
/**
 * Plugin Name: Myriad Green Quote Acceptance Bridge
 * Description: Controlled Fluent Forms acceptance evidence for MAGOS.
 * Version: 0.2.0
 */
if (!defined('ABSPATH')) exit;
final class MG_Quote_Acceptance_Bridge {
 const CFG = 'mgos_quote_acceptance_config';
 const TABLE = 'mgos_quote_acceptance';
 static function config(){return get_option(self::CFG,[]);}
 static function table(){global $wpdb; return $wpdb->prefix.self::TABLE;}
 static function activate(){
  global $wpdb;require_once ABSPATH.'wp-admin/includes/upgrade.php';
  $table=self::table();$collate=$wpdb->get_charset_collate();
  dbDelta("CREATE TABLE $table (
   id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
   quote_id varchar(128) NOT NULL,
   opportunity_id varchar(128) NOT NULL,
   quote_version varchar(128) NOT NULL,
   form_id bigint(20) unsigned NOT NULL,
   entry_id bigint(20) unsigned NOT NULL,
   signer varchar(240) NOT NULL,
   signature_ref text NOT NULL,
   signature_png longblob NOT NULL,
   signed_at datetime NOT NULL,
   status varchar(24) NOT NULL,
   PRIMARY KEY  (id),
   UNIQUE KEY submission (form_id,entry_id),
   KEY quote_lookup (quote_id,opportunity_id)
  ) $collate;");
 }
 static function init(){
  add_action('admin_init',function(){if(current_user_can('manage_options') && get_option('mgos_acceptance_db_version')!=='0.2.0'){self::activate();update_option('mgos_acceptance_db_version','0.2.0',false);}});
  add_shortcode('mg_quote_acceptance',[__CLASS__,'page']);
  add_action('fluentform/submission_inserted',[__CLASS__,'submitted'],10,3);
  add_action('rest_api_init',function(){
   register_rest_route('mgos/v1','/quote-acceptance/verify',[
    'methods'=>'GET','callback'=>[__CLASS__,'verify'],'permission_callback'=>[__CLASS__,'auth']
   ]);
  });
  add_action('wp_enqueue_scripts',function(){
   if(is_singular() && has_shortcode(get_post()->post_content??'','mg_quote_acceptance'))
    {wp_enqueue_style('mgos-acceptance',plugins_url('assets/quote-acceptance-v1.css',__FILE__),[],'0.2.0');wp_enqueue_script('mgos-signature-pad',plugins_url('assets/signature-pad-v1.js',__FILE__),[],'0.2.0',true);}
  });
 }
 static function auth($request){
  $settings=self::config();
  $secret=(string)($settings['verification_token']??'');
  $header=(string)$request->get_header('authorization');
  if(strlen($secret)<32||!preg_match('/^Bearer\s+(.+)$/i',$header,$matches)||!hash_equals($secret,trim($matches[1])))
   return new WP_Error('unauthorized','Invalid verification credentials',['status'=>401]);
  return true;
 }
 static function payload($token){
  $parts=explode('.',(string)$token);
  if(count($parts)!==2)return false;
  $settings=self::config();
  $secret=(string)($settings['link_secret']??'');
  if(strlen($secret)<32)return false;
  $expected=hash_hmac('sha256',$parts[0],$secret);
  if(!hash_equals($expected,$parts[1]))return false;
  $decoded=base64_decode(strtr($parts[0],'-_','+/'),true);
  $p=json_decode($decoded?:'',true);
  if(!is_array($p)||empty($p['quote_id'])||empty($p['opportunity_id'])||empty($p['version'])||
   !isset($p['expiry'])||(int)$p['expiry']<time()||empty($p['issued_pdf_ref']))return false;
  return $p;
 }
 static function page($attrs){
  $config=self::config();
  $p=self::payload($_GET['accept_token']??'');
  if(!$p)return '<div class="mg-quote-accept"><h1>Quotation link unavailable</h1><p>Request an updated acceptance link from Myriad Green.</p></div>';
  if(empty($config['form_id'])||!shortcode_exists('fluentform'))
   return '<div class="mg-quote-accept"><h1>Acceptance temporarily unavailable</h1><p>Please contact Myriad Green.</p></div>';
  $quote=esc_html($p['quote_id']);$version=esc_html($p['version']);
  $url=esc_url($p['issued_pdf_ref']);
  $form=do_shortcode('[fluentform id="'.absint($config['form_id']).'"]');
  return '<section class="mg-quote-accept"><header><h1>Accept and sign your quotation</h1><p>Review the issued quotation before signing. Acceptance is separate from payment and booking.</p></header><div class="mg-summary"><h2>Quotation for review</h2><dl><dt>Reference</dt><dd>'.$quote.'</dd><dt>Version</dt><dd>'.$version.'</dd></dl><p><a target="_blank" rel="noopener noreferrer" href="'.$url.'">Review issued quotation (PDF)</a></p></div>'.$form.'<div class="mg-signature" data-mgos-signature><label for="mgos-signature-canvas">Electronic signature (required)</label><canvas id="mgos-signature-canvas" width="660" height="200" aria-label="Draw your signature here with your mouse, finger or stylus"></canvas><div><button type="button" data-mgos-clear>Clear signature</button></div><p class="mg-muted">Your signature is captured with this exact quotation reference. Acceptance remains pending independent verification.</p></div><p class="mg-muted">Submitting the form records an acceptance request. Our team verifies the signature, quotation version and commercial release conditions separately.</p><footer class="mg-footer">Myriad Green Group (Pty) Ltd · info@myriadgreen.co.za · +27 62 923 3952</footer></section>';
 }
 static function submitted($entryId,$data,$form){
  global $wpdb;
  $config=self::config();
  if((int)($form->id??0)!==(int)($config['form_id']??0))return;
  // The browser-provided payload is untrusted. Require the signed link and exact form entry.
  $token=(string)($_POST['mgos_quote_token']??'');
  $p=self::payload($token);
  if(!$p)return;
  $consent=$data['quote_accept_consent']??null;
  $consent_ok=is_array($consent)?count(array_filter($consent,fn($x)=>is_scalar($x)&&strlen(trim((string)$x))>0))>0:in_array((string)$consent,['1','yes','on'],true);
  $name=$data['quote_accept_signer']??'';
  if(!$name){foreach(['name','names'] as $key){if(!empty($data[$key]) && is_array($data[$key])){$name=trim((string)($data[$key]['first_name']??'').' '.(string)($data[$key]['last_name']??''));if($name)break;}}}
  $signer=sanitize_text_field((string)$name);
  $dataUri=(string)($_POST['mgos_signature_png']??'');
  if(!$consent_ok || !$signer || strlen($dataUri)>125000 ||
    !preg_match('/^data:image\\/png;base64,([A-Za-z0-9+\\/=]+)$/D',$dataUri,$match))return;
  $bytes=base64_decode($match[1],true);
  if(!$bytes || strlen($bytes)<400 || strlen($bytes)>90000 || bin2hex(substr($bytes,0,8))!=='89504e470d0a1a0a')return;
  $size=@getimagesizefromstring($bytes);
  if(!$size || ($size[2]??null)!==IMAGETYPE_PNG || $size[0]<200 || $size[1]<70 || $size[0]>1800 || $size[1]>700)return;
  $hash=hash('sha256',$bytes);
  $wpdb->insert(self::table(),[
   'quote_id'=>sanitize_text_field($p['quote_id']),
   'opportunity_id'=>sanitize_text_field($p['opportunity_id']),
   'quote_version'=>sanitize_text_field($p['version']),
   'form_id'=>(int)$form->id,'entry_id'=>(int)$entryId,'signer'=>$signer,
   'signature_ref'=>'sha256:'.$hash,'signature_png'=>$bytes,
   'signed_at'=>current_time('mysql',true),'status'=>'PENDING_REVIEW'
  ],['%s','%s','%s','%d','%d','%s','%s','%s','%s','%s']);
 }
 static function verify($request){
  global $wpdb;
  $quote=sanitize_text_field((string)$request->get_param('quote_id'));
  $opp=sanitize_text_field((string)$request->get_param('opportunity_id'));
  $blocked=['verified'=>false,'status'=>'PENDING_REVIEW'];
  if(!$quote||!$opp)return rest_ensure_response($blocked);
  $table=self::table();
  $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE quote_id=%s AND opportunity_id=%s AND status='VERIFIED' ORDER BY id DESC LIMIT 2",$quote,$opp),ARRAY_A);
  if(count($rows)!==1)return rest_ensure_response($blocked);
  $row=$rows[0];
  // A human-reviewed record alone is not enough: it must also be matched to a live
  // canonical quote/version by an independent authority adapter before activation.
  return rest_ensure_response(['verified'=>false,'status'=>'REQUIRES_CANONICAL_VERSION_CHECK',
   'reason_code'=>'CANONICAL_QUOTE_VERSION_VERIFIER_NOT_CONNECTED']);
 }
}
register_activation_hook(__FILE__,['MG_Quote_Acceptance_Bridge','activate']);
MG_Quote_Acceptance_Bridge::init();
