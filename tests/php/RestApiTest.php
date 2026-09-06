<?php
/**
 * Robustness tests for inc/rest-api.php (robustness.md Medium #10).
 */
class RestApiTest extends WP_UnitTestCase {

    /**
     * An unbounded `offset` must not generate an unbounded number of cached
     * transients — each distinct offset/limit pair gets its own
     * `_transient_hx29_posts_*` row, so a client requesting offset=1..1000000
     * could otherwise write a million rows into wp_options.
     */
    public function test_offset_beyond_total_posts_is_clamped_not_unbounded() {
        self::factory()->post->create_many(3, ['post_status' => 'publish']);
        $total = hx29_get_total_posts();

        $request = new WP_REST_Request('GET', '/hx29/v1/posts');
        $request->set_param('offset', 100000);
        $request->set_param('limit', 5);

        $response = hx29_rest_get_posts($request);
        $data     = $response->get_data();

        $this->assertSame([], $data['posts']);
        $this->assertSame($total, $data['total']);

        // The huge raw offset must never become its own transient key...
        $this->assertFalse(get_transient('hx29_posts_100000_5'));
        // ...it should have been clamped to $total instead.
        $this->assertNotFalse(get_transient("hx29_posts_{$total}_5"));
    }

    /**
     * Two different huge offsets must collapse onto the same clamped cache
     * key rather than each minting a new transient.
     */
    public function test_different_huge_offsets_share_one_clamped_cache_key() {
        self::factory()->post->create_many(2, ['post_status' => 'publish']);
        $total = hx29_get_total_posts();

        $request_a = new WP_REST_Request('GET', '/hx29/v1/posts');
        $request_a->set_param('offset', 500);
        $request_a->set_param('limit', 5);
        hx29_rest_get_posts($request_a);

        $request_b = new WP_REST_Request('GET', '/hx29/v1/posts');
        $request_b->set_param('offset', 999999);
        $request_b->set_param('limit', 5);
        hx29_rest_get_posts($request_b);

        $this->assertFalse(get_transient('hx29_posts_500_5'));
        $this->assertFalse(get_transient('hx29_posts_999999_5'));
        $this->assertNotFalse(get_transient("hx29_posts_{$total}_5"));
    }
}
