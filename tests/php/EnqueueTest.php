<?php
/**
 * Robustness tests for inc/enqueue.php (robustness.md High #3, #4).
 */
class EnqueueTest extends WP_UnitTestCase {

    /**
     * #3: filemtime() on a missing file must not produce a warning/`false`
     * version — a fallback version string is used instead.
     */
    public function test_asset_version_falls_back_when_file_missing() {
        $missing_path = get_stylesheet_directory() . '/does-not-exist-' . uniqid() . '.css';

        $version = hx29_get_asset_version($missing_path, HX29_VERSION);

        $this->assertSame(HX29_VERSION, $version);
    }

    public function test_asset_version_uses_filemtime_when_file_exists() {
        $version = hx29_get_asset_version(get_stylesheet_directory() . '/style.css', 'fallback');

        $this->assertIsInt($version);
        $this->assertGreaterThan(0, $version);
    }

    /**
     * #4: a missing build/index.asset.php must not crash the enqueue path —
     * safe defaults are used instead of "undefined array key" warnings.
     */
    public function test_build_asset_defaults_when_manifest_missing() {
        $missing_path = get_theme_file_path('build/does-not-exist-' . uniqid() . '.asset.php');

        $asset = hx29_get_build_asset($missing_path);

        $this->assertSame([], $asset['dependencies']);
        $this->assertSame(HX29_VERSION, $asset['version']);
    }

    /**
     * #4: a malformed manifest (missing the "dependencies" key entirely, or
     * holding a non-array value) must still yield a safe, well-typed result.
     */
    public function test_build_asset_defaults_when_manifest_malformed() {
        $malformed_path = get_temp_dir() . 'hx29-malformed-asset-' . uniqid() . '.php';
        file_put_contents($malformed_path, "<?php return ['version' => '1.2.3'];\n");

        try {
            $asset = hx29_get_build_asset($malformed_path);

            $this->assertSame([], $asset['dependencies']);
            $this->assertSame('1.2.3', $asset['version']);
        } finally {
            unlink($malformed_path);
        }
    }
}
