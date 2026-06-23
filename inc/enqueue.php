<?php
/**
 * Asset enqueuing: registers the main stylesheet and the React terminal bundle.
 */

function hx29_enqueue_scripts() {
    wp_enqueue_style('hx29-style', get_stylesheet_uri(), [], HX29_VERSION);

    $asset_path = get_theme_file_path('build/index.asset.php');
    if (!file_exists($asset_path)) {
        // Build not run yet — nothing to enqueue.
        return;
    }
    $asset = require $asset_path;

    wp_enqueue_script(
        'hx29-terminal',
        get_theme_file_uri('build/index.js'),
        $asset['dependencies'],   // includes 'wp-element'
        $asset['version'],
        true
    );

    // wp-scripts emits a CSS file only if the bundle imports styles.
    $css_path = get_theme_file_path('build/index.css');
    if (file_exists($css_path)) {
        wp_enqueue_style(
            'hx29-terminal-css',
            get_theme_file_uri('build/index.css'),
            [],
            $asset['version']
        );
    }

    $is_new = empty($_COOKIE['hx29_uid']);

    wp_localize_script('hx29-terminal', 'hx29', [
        'rest_root' => esc_url_raw(rest_url()),
        'rest_url'  => esc_url_raw(rest_url('hx29/v1/')),
        'nonce'     => wp_create_nonce('wp_rest'),
        'uid'       => hx29_get_or_create_uid(),
        'uid_new'   => $is_new ? '1' : '0',
        'site_name' => esc_html(get_bloginfo('name')),
        'author'    => esc_html(get_bloginfo('name')),
    ]);
}
add_action('wp_enqueue_scripts', 'hx29_enqueue_scripts');
