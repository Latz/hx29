<?php
/**
 * HX29 Terminal Theme Functions (React / wp-element)
 */

require get_template_directory() . '/inc/setup.php';
require get_template_directory() . '/inc/uid.php';
require get_template_directory() . '/inc/enqueue.php';
require get_template_directory() . '/inc/rest-api.php';

// Seed the visitor counter with a random 3-digit hex value on first run.
add_action('after_setup_theme', function () {
    if (false === get_option('hx29_user_counter')) {
        update_option('hx29_user_counter', rand(0x100, 0xfff), false);
    }
});
