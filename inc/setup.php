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

/**
 * Builds the <link rel="preload"> tag for the terminal font, or an empty
 * string if the font file isn't present (avoids a silent 404 preload).
 * @param string $font_path Absolute path to the font file.
 * @param string $font_url Public URL to use in the tag when the file exists.
 * @return string
 */
function hx29_font_preload_tag(string $font_path, string $font_url): string {
    if (!file_exists($font_path)) {
        return '';
    }
    return "<link rel=\"preload\" href=\"" . esc_url($font_url) . "\" as=\"font\" type=\"font/woff2\" crossorigin>\n";
}

// Preconnect to REST API origin and preload the terminal font.
add_action('wp_head', function () {
    $rest_origin = esc_url(home_url());
    echo "<link rel=\"preconnect\" href=\"{$rest_origin}\">\n";
    echo hx29_font_preload_tag(
        get_theme_file_path('assets/fonts/glasstty.woff2'),
        get_theme_file_uri('assets/fonts/glasstty.woff2')
    );
}, 1);
