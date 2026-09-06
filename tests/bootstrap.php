<?php
/**
 * PHPUnit bootstrap for the hx29 theme test suite.
 * Loads the WordPress core test library and activates this theme.
 */

$_tests_dir = getenv('WP_TESTS_DIR');
if (!$_tests_dir) {
	$_tests_dir = rtrim(sys_get_temp_dir(), '/') . '/wordpress-tests-lib';
}

if (!file_exists("{$_tests_dir}/includes/functions.php")) {
	fwrite(STDERR, "Could not find {$_tests_dir}/includes/functions.php, have you run bin/install-wp-tests.sh ?\n");
	exit(1);
}

require_once "{$_tests_dir}/includes/functions.php";

/**
 * Loads the hx29 theme as the active theme for the test run.
 * The theme lives outside the test WP core's own wp-content/themes dir,
 * so its parent directory must be registered before switch_theme() can find it.
 */
function _hx29_manually_load_theme() {
	register_theme_directory(dirname(__DIR__, 2));
	switch_theme('hx29');
}
tests_add_filter('muplugins_loaded', '_hx29_manually_load_theme');

require "{$_tests_dir}/includes/bootstrap.php";
