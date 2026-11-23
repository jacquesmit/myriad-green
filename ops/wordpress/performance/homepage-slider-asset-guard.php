<?php
/**
 * Myriad Green — homepage-only Slider Revolution asset guard.
 *
 * Deployment: install in the LIVE rey-child/functions.php via a reviewed,
 * backed-up, host-supported deployment. This file is a PROPOSAL, not an
 * automatically loaded WordPress plugin.
 *
 * Verified 2026-11-23: homepage post ID 1486, no RevSlider shortcode
 * in published post_content, no RevSlider reference in homepage postmeta,
 * no <sr7-module> in rendered homepage. Do not deploy if that changes.
 *
 * Rollback: remove this block and clear the homepage LiteSpeed cache.
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'wp_enqueue_scripts', function () {
    if ( is_admin() || ! is_front_page() ) {
        return;
    }

    $page = get_post( get_queried_object_id() );
    if ( ! $page || has_shortcode( $page->post_content, 'rev_slider' )
        || has_shortcode( $page->post_content, 'sr7' ) ) {
        return;
    }

    // Exact handles verified in revslider/public/revslider-front.class.php v6.7.34.
    foreach ( array( 'tp-tools', 'sr7', 'sr7migration' ) as $handle ) {
        wp_dequeue_script( $handle );
    }
    wp_dequeue_style( 'sr7css' );

    // Slider Revolution adds a large inline page bootstrap via wp_head.
    // Suppress this on the homepage only; leave booking/shop scripts untouched.
    add_filter( 'revslider_js_add_header_scripts', '__return_empty_string', PHP_INT_MAX );
}, PHP_INT_MAX );
