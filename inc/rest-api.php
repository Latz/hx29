<?php
/**
 * Custom REST API endpoints (hx29/v1) for ordinal post access.
 * The React frontend uses standard wp/v2 endpoints; these remain available
 * as a pre-sanitised alternative for slug-free access.
 */

add_action('rest_api_init', function () {

    // GET /wp-json/hx29/v1/posts?offset=0&limit=5
    register_rest_route('hx29/v1', '/posts', [
        'methods'             => 'GET',
        'callback'            => 'hx29_rest_get_posts',
        'permission_callback' => '__return_true',
        'args'                => [
            'offset' => [
                'default'           => 0,
                'sanitize_callback' => 'absint',
            ],
            'limit'  => [
                'default'           => 5,
                'sanitize_callback' => 'absint',
            ],
        ],
    ]);

    // GET /wp-json/hx29/v1/posts/<number>
    register_rest_route('hx29/v1', '/posts/(?P<number>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'hx29_rest_read_post',
        'permission_callback' => '__return_true',
        'args'                => [
            'number' => [
                'required'          => true,
                'sanitize_callback' => 'absint',
            ],
        ],
    ]);
});

// Invalidate REST transients when a post is saved or deleted.
add_action('save_post', 'hx29_invalidate_rest_cache');
add_action('delete_post', 'hx29_invalidate_rest_cache');
function hx29_invalidate_rest_cache(): void {
    // Clear list cache (all offsets/limits are keyed separately; wipe by group prefix).
    global $wpdb;
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", '_transient_hx29_posts_%'));
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", '_transient_hx29_post_%'));
}

function hx29_get_total_posts(): int {
    $total = wp_cache_get('hx29_post_count');
    if (false === $total) {
        $total = (int) wp_count_posts('post')->publish;
        wp_cache_set('hx29_post_count', $total, '', 3600);
    }
    return $total;
}

function hx29_rest_get_posts(WP_REST_Request $request): WP_REST_Response {
    $offset = (int) $request->get_param('offset');
    $limit  = (int) $request->get_param('limit');

    if ($limit < 1) {
        $limit = 5;
    }
    if ($limit > 50) {
        $limit = 50;
    }

    $total = hx29_get_total_posts();
    // Clamp offset to the actual post count: every distinct offset/limit pair
    // gets its own cached transient, so an unbounded offset (e.g. requesting
    // offset=1..1000000) would otherwise write unbounded rows into wp_options.
    if ($offset > $total) {
        $offset = $total;
    }

    $cache_key = "hx29_posts_{$offset}_{$limit}";
    $cached    = get_transient($cache_key);
    if (false !== $cached) {
        return new WP_REST_Response($cached, 200);
    }

    $query = new WP_Query([
        'post_type'              => 'post',
        'posts_per_page'         => $limit,
        'offset'                 => $offset,
        'post_status'            => 'publish',
        'orderby'                => 'date',
        'order'                  => 'DESC',
        'no_found_rows'          => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ]);

    // Batch-load all author display names to avoid N+1 user queries.
    $author_ids = array_unique(array_column($query->posts, 'post_author'));
    $author_names = [];
    foreach ($author_ids as $id) {
        $author_names[$id] = get_the_author_meta('display_name', $id);
    }

    $output = array_map(function ($post) use ($author_names) {
        return [
            'id'      => $post->ID,
            'title'   => $post->post_title,
            'date'    => get_the_date('Y-m-d', $post->ID),
            'excerpt' => wp_trim_words($post->post_content, 20, '...'),
            'url'     => get_permalink($post->ID),
            'author'  => $author_names[$post->post_author] ?? '',
        ];
    }, $query->posts);

    wp_reset_postdata();

    $data = ['posts' => $output, 'total' => $total];

    set_transient($cache_key, $data, HOUR_IN_SECONDS);

    return new WP_REST_Response($data, 200);
}

/**
 * Builds the response payload for a single post by 1-based ordinal number.
 * Caches the rendered/stripped content separately to avoid repeated
 * shortcode/oEmbed processing on cache misses for the outer transient.
 * @param int $number 1-based ordinal position among published posts, newest first.
 * @return array{total:int,post:array{title:string,date:string,author:string,content:string}}|null
 *         The payload, or null if there is no post at that position.
 */
function hx29_build_post_data(int $number): ?array {
    $query = new WP_Query([
        'post_type'              => 'post',
        'posts_per_page'         => 1,
        'offset'                 => $number - 1,
        'post_status'            => 'publish',
        'orderby'                => 'date',
        'order'                  => 'DESC',
        'no_found_rows'          => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ]);

    if (!$query->have_posts()) {
        return null;
    }

    $post = $query->posts[0];

    $content_key = "hx29_post_{$post->ID}_content";
    $content     = wp_cache_get($content_key);
    if (false === $content) {
        $rendered = apply_filters('the_content', $post->post_content);
        $rendered = preg_replace('/<\/(p|div|h[1-6]|li|blockquote|pre)>/i', "</$1>\n", $rendered);
        $rendered = preg_replace('/<br\s*\/?>/i', "\n", $rendered);
        $content  = wp_strip_all_tags($rendered);
        $content  = preg_replace('/\n{3,}/', "\n\n", trim($content));
        wp_cache_set($content_key, $content, '', HOUR_IN_SECONDS);
    }

    $total = hx29_get_total_posts();
    wp_reset_postdata();

    return [
        'total' => $total,
        'post'  => [
            'title'   => $post->post_title,
            'date'    => get_the_date('Y-m-d', $post->ID),
            'author'  => get_the_author_meta('display_name', $post->post_author),
            'content' => $content,
        ],
    ];
}

function hx29_rest_read_post(WP_REST_Request $request): WP_REST_Response {
    $number = (int) $request->get_param('number');

    if ($number < 1) {
        return new WP_REST_Response(['error' => __('Invalid post number.', 'hx29')], 400);
    }

    $cache_key = "hx29_post_{$number}";
    $data      = get_transient($cache_key);

    if (false === $data) {
        $data = hx29_build_post_data($number);
        if (null === $data) {
            /* translators: %d: 1-based ordinal position of the requested post. */
            return new WP_REST_Response(['error' => sprintf(__('Post #%d not found.', 'hx29'), $number)], 404);
        }
        set_transient($cache_key, $data, HOUR_IN_SECONDS);
    }

    return new WP_REST_Response($data, 200);
}
