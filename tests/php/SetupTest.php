<?php
/**
 * Robustness tests for inc/setup.php (robustness.md High #5).
 */
class SetupTest extends WP_UnitTestCase {

    /**
     * #5: a missing font file must not produce a preload tag pointing at a
     * 404 — the tag is simply omitted.
     */
    public function test_font_preload_tag_empty_when_file_missing() {
        $missing_path = get_theme_file_path('assets/fonts/does-not-exist-' . uniqid() . '.woff2');

        $tag = hx29_font_preload_tag($missing_path, 'https://example.test/font.woff2');

        $this->assertSame('', $tag);
    }

    public function test_font_preload_tag_present_when_file_exists() {
        $real_path = get_theme_file_path('assets/fonts/glasstty.woff2');

        $tag = hx29_font_preload_tag($real_path, 'https://example.test/font.woff2');

        $this->assertStringContainsString('rel="preload"', $tag);
        $this->assertStringContainsString('https://example.test/font.woff2', $tag);
    }
}
