<?php
/**
 * HX29 Terminal Theme Functions (React / wp-element)
 */

define('HX29_VERSION', '4.0.0');

/**
 * require_once's a theme include file if it exists, degrading gracefully
 * (logged, not fatal) instead of taking the whole site down when a
 * missing/renamed include would otherwise trigger a hard fatal error.
 * @param string $path Absolute path to the PHP file to include.
 * @return bool True if the file was found and included.
 */
function hx29_safe_require_once(string $path): bool {
    if (!file_exists($path)) {
        error_log("hx29: missing required include {$path}");
        return false;
    }
    require_once $path;
    return true;
}

hx29_safe_require_once(get_template_directory() . '/inc/setup.php');
hx29_safe_require_once(get_template_directory() . '/inc/uid.php');
hx29_safe_require_once(get_template_directory() . '/inc/enqueue.php');
hx29_safe_require_once(get_template_directory() . '/inc/settings.php');
hx29_safe_require_once(get_template_directory() . '/inc/admin-ui.php');

// Seed the visitor counter with a random 3-digit hex value on first run.
add_action('after_setup_theme', function () {
    if (false === get_option('hx29_user_counter')) {
        update_option('hx29_user_counter', random_int(0x100, 0xfff), false);
    }
});

// Remove theme-scoped state when switching away from this theme.
add_action('switch_theme', function () {
    delete_option('hx29_user_counter');
});
