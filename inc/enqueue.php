<?php
/**
 * Asset enqueuing: registers the main stylesheet and the React terminal bundle.
 */

/**
 * Resolves a cache-busting asset version from a file's mtime, falling back
 * to a constant when the file is missing/unreadable (avoids a filemtime()
 * warning turning into a `false` version string).
 * @param string $path Absolute path to the versioned file.
 * @param string $fallback Version string to use when $path doesn't exist.
 * @return string|int
 */
function hx29_get_asset_version(string $path, string $fallback) {
    return file_exists($path) ? filemtime($path) : $fallback;
}

/**
 * Loads and validates a wp-scripts build/index.asset.php manifest, filling
 * in safe defaults so a missing/partial build can't produce "undefined
 * array key" warnings downstream.
 * @param string $asset_path Absolute path to the asset manifest file.
 * @return array{dependencies: array, version: string|int}
 */
function hx29_get_build_asset(string $asset_path): array {
    $asset = file_exists($asset_path) ? (array) require $asset_path : [];

    return [
        'dependencies' => is_array($asset['dependencies'] ?? null) ? $asset['dependencies'] : [],
        'version'      => is_scalar($asset['version'] ?? null) ? $asset['version'] : HX29_VERSION,
    ];
}

function hx29_enqueue_scripts() {
    wp_enqueue_style(
        'hx29-style',
        get_stylesheet_uri(),
        [],
        hx29_get_asset_version(get_stylesheet_directory() . '/style.css', HX29_VERSION)
    );

    $asset_path = get_theme_file_path('build/index.asset.php');
    if (!file_exists($asset_path)) {
        // Build not run yet — nothing to enqueue.
        return;
    }
    $asset = hx29_get_build_asset($asset_path);

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
        'nonce'     => wp_create_nonce('wp_rest'),
        'locale'    => substr(get_locale(), 0, 2),
        'uid'       => hx29_get_or_create_uid(),
        'uid_new'   => $is_new ? '1' : '0',
        'site_name' => esc_html(get_bloginfo('name')),
        'author'    => esc_html(get_bloginfo('name')),

        'prompt_prefix' => esc_html(get_option('hx29_terminal_prompt_prefix', 'user@system')),
        'typing_speed'  => (int) get_option('hx29_terminal_typing_speed', 1),
    ]);
}
add_action('wp_enqueue_scripts', 'hx29_enqueue_scripts');
