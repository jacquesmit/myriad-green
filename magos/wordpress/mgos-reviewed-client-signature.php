<?php
/**
 * Plugin Name: MAGOS Reviewed Client Signature Receipt
 * Description: Adds reviewed, immutable customer quote signature receipts alongside the existing MAGOS 0.3.2 owner-test bridge. Never creates jobs, invoices or bookings.
 * Version: 0.1.0
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) exit;

final class MAGOS_Reviewed_Client_Receipt {
    const VERSION = '0.1.0';
    const TABLE = 'mgos_client_signature_receipts';
    static function table() { global $wpdb; return $wpdb->prefix . self::TABLE; }
    static function ready() { return class_exists('MGOS_Quote_Acceptance'); }
    static function config() {
        if (!self::ready()) return [];
        return MGOS_Quote_Acceptance::config();
    }
    static function install() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table();
        $collation = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            quote_id varchar(128) NOT NULL,
            opportunity_id varchar(128) NOT NULL,
            quote_version varchar(128) NOT NULL,
            issued_pdf_ref text NOT NULL,
            form_id bigint(20) unsigned NOT NULL,
            entry_id bigint(20) unsigned NOT NULL,
            signer varchar(240) NOT NULL,
            signature_png longblob NOT NULL,
            signature_sha256 char(64) NOT NULL,
            consent_verified tinyint(1) NOT NULL DEFAULT 0,
            signed_at datetime NOT NULL,
            status varchar(40) NOT NULL,
            evidence_ref text NOT NULL,
            reviewer_id bigint(20) unsigned NOT NULL DEFAULT 0,
            reviewed_at datetime DEFAULT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY submission (form_id,entry_id),
            KEY quote_lookup (quote_id,opportunity_id)
        ) $collation;");
        update_option('magos_client_receipts_db_version',self::VERSION,false);
    }
    static function submitted($entry_id,$data,$form) {
        global $wpdb;
        if (!self::ready()) return;
        $config = self::config();
        if (intval($form->id??0)!==intval($config['form_id']??0)) return;
        $token = $data['mgos_quote_token']??null;
        if (!is_string($token)) return;
        $decoded = MGOS_Quote_Acceptance::parse_token($token);
        if (!$decoded || ($decoded['purpose']??'')==='OWNER_TEST') return;
        foreach (['quote_id','opportunity_id','version','issued_pdf_ref'] as $field) {
            if (!isset($decoded[$field]) || !is_string($decoded[$field]) || trim($decoded[$field])==='') return;
        }
        if (!wp_http_validate_url($decoded['issued_pdf_ref']) ||
            wp_parse_url($decoded['issued_pdf_ref'],PHP_URL_SCHEME)!=='https') return;

        $consent = $data['quote_accept_consent']??'';
        $expected = 'I have reviewed and accept the quotation, including its scope of work, exclusions, price and payment terms.';
        $responses = is_array($consent)?array_map('strval',$consent):[(string)$consent];
        if (!array_intersect($responses,['1','yes','on',$expected])) return;
        $name = $data['quote_accept_signer']??'';
        if (!is_string($name) || trim($name)==='') return;
        $signer = sanitize_text_field($name);
        $sig = $data['mgos_signature_png']??'';
        if (!is_string($sig) || strlen($sig)>125000 ||
            !preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D',$sig,$match)) return;
        $raw = base64_decode($match[1],true);
        if (!$raw || strlen($raw)<400 || strlen($raw)>90000 ||
            bin2hex(substr($raw,0,8))!=='89504e470d0a1a0a') return;
        $size = @getimagesizefromstring($raw);
        if (!$size || $size[2]!==IMAGETYPE_PNG ||
            $size[0]<200 || $size[1]<70 || $size[0]>1800 || $size[1]>700) return;
        $inserted = $wpdb->insert(self::table(),[
            'quote_id'=>sanitize_text_field($decoded['quote_id']),
            'opportunity_id'=>sanitize_text_field($decoded['opportunity_id']),
            'quote_version'=>sanitize_text_field($decoded['version']),
            'issued_pdf_ref'=>esc_url_raw($decoded['issued_pdf_ref']),
            'form_id'=>intval($form->id),'entry_id'=>intval($entry_id),
            'signer'=>$signer,'signature_png'=>$raw,
            'signature_sha256'=>hash('sha256',$raw),
            'consent_verified'=>1,'signed_at'=>gmdate('Y-m-d H:i:s'),
            'status'=>'PENDING_REVIEW','evidence_ref'=>'',
            'reviewer_id'=>0
        ],['%s','%s','%s','%s','%d','%d','%s','%s','%s','%d','%s','%s','%s','%d']);
        // Duplicate form submissions cannot create a second acceptance receipt.
        if ($inserted===false && defined('WP_DEBUG') && WP_DEBUG) {
            error_log('MAGOS signature receipt: duplicate or insert failure (no approval)');
        }
    }
    static function review_page() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        global $wpdb;
        $table = self::table();
        $rows = $wpdb->get_results("SELECT id,quote_id,opportunity_id,quote_version,issued_pdf_ref,signer,
            signature_sha256,signed_at,status,evidence_ref FROM $table ORDER BY id DESC LIMIT 75",ARRAY_A);
        echo '<div class="wrap"><h1>MAGOS Client Signature Review</h1>';
        echo '<p>Review the exact issued PDF, signer, submitted signature and canonical MAGOS quote version before approving. This WordPress review does not mark a quote accepted, create a job or verify payment.</p>';
        echo '<table class="widefat striped"><thead><tr><th>Receipt</th><th>Quote</th><th>Version</th><th>Signer</th><th>Signed</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        foreach ((array)$rows as $r) {
            echo '<tr><td>'.esc_html($r['id']).'</td><td>'.esc_html($r['quote_id']).'</td><td>'.esc_html($r['quote_version']).'</td><td>'.esc_html($r['signer']).'</td><td>'.esc_html($r['signed_at']).'</td><td>'.esc_html($r['status']).'</td><td>';
            echo '<a target="_blank" rel="noopener" href="'.esc_url($r['issued_pdf_ref']).'">Issued PDF</a>';
            $preview=wp_nonce_url(admin_url('admin-post.php?action=magos_show_client_signature&receipt_id='.intval($r['id'])),'magos_show_signature_'.intval($r['id']));
            echo ' | <a target="_blank" rel="noopener" href="'.esc_url($preview).'">View signed PNG</a>';
            if ($r['status']==='PENDING_REVIEW') {
                $url=admin_url('admin-post.php');
                echo '<form action="'.esc_url($url).'" method="post">';
                wp_nonce_field('magos_approve_signature_'.intval($r['id']));
                echo '<input type="hidden" name="action" value="magos_approve_client_receipt"><input type="hidden" name="receipt_id" value="'.intval($r['id']).'">';
                echo '<label>Immutable signed receipt stored in Drive <input type="url" name="evidence_ref" required placeholder="https://drive.google.com/..." style="width:250px"></label>';
                echo '<label><input type="checkbox" name="review_confirmed" value="1" required>I independently checked the signer, signature, issued document and current version</label>';
                echo '<button class="button button-primary" type="submit">Approve reviewed receipt</button></form>';
            }
            echo '</td></tr>';
        }
        echo '</tbody></table><p>Approvals require MAGOS to independently verify the current Commercial quote. No status on this page can release materials or schedule work.</p></div>';
    }
    static function show_signature() {
        if(!current_user_can('manage_options')) wp_die('Access denied');
        $id=absint($_GET['receipt_id']??0);
        check_admin_referer('magos_show_signature_'.$id);
        global $wpdb;
        $row=$wpdb->get_row($wpdb->prepare('SELECT signature_png,signature_sha256 FROM '.self::table().' WHERE id=%d',$id),ARRAY_A);
        if(!$row || !is_string($row['signature_png']) ||
           !hash_equals((string)$row['signature_sha256'],hash('sha256',$row['signature_png']))) {
            status_header(404);exit;
        }
        nocache_headers();
        header('Content-Type: image/png');
        header('Content-Disposition: inline; filename="magos-signature-review.png"');
        header('X-Content-Type-Options: nosniff');
        echo $row['signature_png'];
        exit;
    }

    static function approve() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        $id=absint($_POST['receipt_id']??0);
        check_admin_referer('magos_approve_signature_'.$id);
        if (!$id || ($_POST['review_confirmed']??'')!=='1') wp_die('Review confirmation missing');
        $evidence=esc_url_raw(wp_unslash($_POST['evidence_ref']??''));
        $url=wp_parse_url($evidence);
        if (!$url || ($url['scheme']??'')!=='https' ||
            ($url['host']??'')!=='drive.google.com') wp_die('Signed receipt must be evidenced in Google Drive');
        global $wpdb;
        $table=self::table();
        $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id=%d",$id),ARRAY_A);
        if (!$row || $row['status']!=='PENDING_REVIEW' ||
            intval($row['consent_verified'])!==1 ||
            !hash_equals((string)$row['signature_sha256'],hash('sha256',$row['signature_png'])))
            wp_die('Signed receipt integrity or state verification failed');
        // Admin reviews must be performed by a logged-in authorized WordPress user.
        $updated=$wpdb->update($table,[
            'status'=>'INDEPENDENTLY_APPROVED',
            'reviewer_id'=>get_current_user_id(),
            'reviewed_at'=>gmdate('Y-m-d H:i:s'),
            'evidence_ref'=>$evidence
        ],['id'=>$id,'status'=>'PENDING_REVIEW'],['%s','%d','%s','%s'],['%d','%s']);
        if ($updated!==1) wp_die('Approval was not committed exactly once');
        wp_safe_redirect(admin_url('tools.php?page=magos-reviewed-signatures'));
        exit;
    }
    static function verify($request) {
        if (!self::ready()) return new WP_Error('magos_legacy_bridge_required','Quote link verifier not installed',['status'=>503]);
        $auth=MGOS_Quote_Acceptance::auth($request);
        if (is_wp_error($auth) || $auth!==true) return $auth;
        $quote=sanitize_text_field((string)$request->get_param('quote_id'));
        $opportunity=sanitize_text_field((string)$request->get_param('opportunity_id'));
        if (!$quote || !$opportunity) return new WP_REST_Response(['verified'=>false,'reason_code'=>'QUOTE_IDENTITY_REQUIRED'],200);
        global $wpdb;
        $table=self::table();
        $rows=$wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE quote_id=%s AND opportunity_id=%s AND status=%s LIMIT 2",
            $quote,$opportunity,'INDEPENDENTLY_APPROVED'
        ),ARRAY_A);
        if (count($rows)!==1) return new WP_REST_Response(['verified'=>false,'reason_code'=>'APPROVED_RECEIPT_NOT_UNIQUE_OR_MISSING'],200);
        $r=$rows[0];
        if (!intval($r['reviewer_id']) || !intval($r['consent_verified']) ||
            !hash_equals((string)$r['signature_sha256'],hash('sha256',$r['signature_png'])) ||
            !wp_http_validate_url($r['evidence_ref']) ||
            wp_parse_url($r['evidence_ref'],PHP_URL_HOST)!=='drive.google.com') {
            return new WP_REST_Response(['verified'=>false,'reason_code'=>'RECEIPT_INTEGRITY_OR_REVIEW_FAILED'],200);
        }
        $body=[
            'verified'=>true,'purpose'=>'CLIENT_ACCEPTANCE','approval_status'=>'INDEPENDENTLY_APPROVED',
            'consent_verified'=>true,'quote_id'=>$r['quote_id'],
            'opportunity_id'=>$r['opportunity_id'],'quote_version'=>$r['quote_version'],
            'issued_pdf_ref'=>$r['issued_pdf_ref'],'receipt_id'=>'WPSIG-'.intval($r['id']),
            'signature_sha256'=>$r['signature_sha256'],'signer_identity'=>$r['signer'],
            'signed_at'=>gmdate('c',strtotime($r['signed_at'].' UTC')),
            'independent_reviewer_id'=>'WP-USER-'.intval($r['reviewer_id']),
            'source_event_id'=>'WP-FLUENT-'.intval($r['form_id']).'-'.intval($r['entry_id']),
            'evidence_ref'=>$r['evidence_ref']
        ];
        return new WP_REST_Response($body,200,['Cache-Control'=>'no-store']);
    }
    static function init() {
        add_action('admin_init',function(){
            if(current_user_can('manage_options') &&
               get_option('magos_client_receipts_db_version')!==self::VERSION) self::install();
        });
        add_action('fluentform/submission_inserted',[__CLASS__,'submitted'],11,3);
        add_action('admin_menu',function(){
            add_management_page('MAGOS Client Signatures','MAGOS Client Signatures',
                'manage_options','magos-reviewed-signatures',[__CLASS__,'review_page']);
        });
        add_action('admin_post_magos_approve_client_receipt',[__CLASS__,'approve']);
        add_action('admin_post_magos_show_client_signature',[__CLASS__,'show_signature']);
        add_action('rest_api_init',function(){
            register_rest_route('mgos/v1','/quote-acceptance/verify-v2',[
                'methods'=>'GET','callback'=>[__CLASS__,'verify'],
                'permission_callback'=>function($request){
                    if(!self::ready()) return new WP_Error('magos_not_ready','Bridge missing',['status'=>503]);
                    return MGOS_Quote_Acceptance::auth($request);
                }
            ]);
        });
    }
}
register_activation_hook(__FILE__,['MAGOS_Reviewed_Client_Receipt','install']);
MAGOS_Reviewed_Client_Receipt::init();
