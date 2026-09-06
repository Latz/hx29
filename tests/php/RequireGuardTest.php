<?php
/**
 * Robustness tests for functions.php's include guard (robustness.md High #6).
 */
class RequireGuardTest extends WP_UnitTestCase {

    /**
     * A missing/renamed include file must degrade gracefully instead of
     * being a hard fatal for the entire site.
     */
    public function test_missing_include_returns_false_without_fatal() {
        $missing_path = get_template_directory() . '/inc/does-not-exist-' . uniqid() . '.php';

        $result = hx29_safe_require_once($missing_path);

        $this->assertFalse($result);
    }

    public function test_existing_include_is_required_and_returns_true() {
        $tmp_path = get_temp_dir() . 'hx29-require-guard-' . uniqid() . '.php';
        $marker   = 'hx29_test_marker_' . uniqid();
        file_put_contents($tmp_path, "<?php function {$marker}() { return true; }\n");

        try {
            $result = hx29_safe_require_once($tmp_path);

            $this->assertTrue($result);
            $this->assertTrue(function_exists($marker));
        } finally {
            unlink($tmp_path);
        }
    }
}
