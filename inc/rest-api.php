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

function hx29_rest_get_posts(WP_REST_Request $request): WP_REST_Response {
    $offset = (int) $request->get_param('offset');
    $limit  = (int) $request->get_param('limit');

    if ($limit < 1)  $limit = 5;
    if ($limit > 50) $limit = 50;

    $query = new WP_Query([
        'post_type'      => 'post',
        'posts_per_page' => $limit,
        'offset'         => $offset,
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ]);

    $total = (int) wp_count_posts('post')->publish;

    $output = array_map(function ($post) {
        return [
            'id'      => $post->ID,
            'title'   => $post->post_title,
            'date'    => get_the_date('Y-m-d', $post->ID),
            'excerpt' => wp_trim_words($post->post_content, 20, '...'),
            'url'     => get_permalink($post->ID),
            'author'  => get_the_author_meta('display_name', $post->post_author),
        ];
    }, $query->posts);

    wp_reset_postdata();

    return new WP_REST_Response(['posts' => $output, 'total' => $total], 200);
}

function hx29_rest_read_post(WP_REST_Request $request): WP_REST_Response {
    $number = (int) $request->get_param('number');

    if ($number < 1) {
        return new WP_REST_Response(['error' => __('Invalid post number.', 'hx29')], 400);
    }

    $query = new WP_Query([
        'post_type'      => 'post',
        'posts_per_page' => 1,
        'offset'         => $number - 1,
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ]);

    if (!$query->have_posts()) {
        return new WP_REST_Response(['error' => sprintf(__('Post #%d not found.', 'hx29'), $number)], 404);
    }

    $post     = $query->posts[0];
    $rendered = apply_filters('the_content', $post->post_content);
    $rendered = preg_replace('/<\/(p|div|h[1-6]|li|blockquote|pre)>/i', "</$1>\n", $rendered);
    $rendered = preg_replace('/<br\s*\/?>/i', "\n", $rendered);
    $content  = wp_strip_all_tags($rendered);
    $content  = preg_replace('/\n{3,}/', "\n\n", trim($content));

    $total = (int) wp_count_posts('post')->publish;
    wp_reset_postdata();

    return new WP_REST_Response([
        'total' => $total,
        'post'  => [
            'title'   => $post->post_title,
            'date'    => get_the_date('Y-m-d', $post->ID),
            'author'  => get_the_author_meta('display_name', $post->post_author),
            'content' => $content,
        ],
    ], 200);
}
