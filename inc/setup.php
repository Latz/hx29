<?php
/**
 * Theme setup: declares theme support and editor styles.
 */

function hx29_setup() {
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
