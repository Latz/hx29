<?php
/**
 * Theme setup: declares theme support and editor styles.
 */

function hx29_setup() {
    load_theme_textdomain('hx29', get_template_directory() . '/languages');
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('align-wide');
    add_theme_support('wp-block-styles');
    add_theme_support('block-templates');
    add_theme_support('block-template-parts');
    add_theme_support('responsive-embeds');
    add_theme_support('html5', array('comment-list', 'comment-form', 'search-form', 'gallery', 'caption', 'style', 'script'));
    add_editor_style('style-editor.css');
}
add_action('after_setup_theme', 'hx29_setup');

// Preconnect to REST API origin and preload the terminal font.
add_action('wp_head', function () {
    $rest_origin = esc_url(home_url());
    $font_url    = esc_url(get_theme_file_uri('assets/fonts/glasstty.woff2'));
    echo "<link rel=\"preconnect\" href=\"{$rest_origin}\">\n";
    echo "<link rel=\"preload\" href=\"{$font_url}\" as=\"font\" type=\"font/woff2\" crossorigin>\n";
}, 1);
