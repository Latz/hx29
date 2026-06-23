<?php
/**
 * HX29 Terminal Theme Functions (React / wp-element)
 */

// ── Theme setup ───────────────────────────────────────────────────

function hx29_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('align-wide');
    add_theme_support('wp-block-styles');
    add_theme_support('block-templates');
    add_theme_support('block-template-parts');
    add_theme_support('editor-styles');

    // Seed the visitor counter with a random 3-digit hex value on first run
    if (get_option('hx29_user_counter') === false) {
        update_option('hx29_user_counter', rand(0x100, 0xfff), false);
    }
}
add_action('after_setup_theme', 'hx29_setup');

// ── UID system ────────────────────────────────────────────────────

function hx29_get_or_create_uid(): string {
    if (!empty($_COOKIE['hx29_uid'])) {
        $uid = preg_replace('/[^a-f0-9]/', '', $_COOKIE['hx29_uid']);
        if ($uid) return $uid;
    }

    $counter = (int) get_option('hx29_user_counter', 0);
    $counter++;
    update_option('hx29_user_counter', $counter, false);

    return dechex($counter);
}

// ── Enqueue React bundle ──────────────────────────────────────────

function hx29_enqueue_scripts() {
    wp_enqueue_style('hx29-style', get_stylesheet_uri(), [], '4.0.2');

    $asset_path = get_template_directory() . '/build/index.asset.php';
    if (!file_exists($asset_path)) {
        // Build not run yet — nothing to enqueue.
        return;
    }
    $asset = require $asset_path;

    wp_enqueue_script(
        'hx29-terminal',
        get_template_directory_uri() . '/build/index.js',
        $asset['dependencies'],   // includes 'wp-element'
        $asset['version'],
        true
    );

    // wp-scripts emits a CSS file only if the bundle imports styles.
    $css_path = get_template_directory() . '/build/index.css';
    if (file_exists($css_path)) {
        wp_enqueue_style(
            'hx29-terminal-css',
            get_template_directory_uri() . '/build/index.css',
            [],
            $asset['version']
        );
    }

    $is_new = empty($_COOKIE['hx29_uid']);

    wp_localize_script('hx29-terminal', 'hx29', [
        'rest_root' => esc_url_raw(rest_url()),          // …/wp-json/
        'rest_url'  => esc_url_raw(rest_url('hx29/v1/')),
        'nonce'     => wp_create_nonce('wp_rest'),
        'uid'       => hx29_get_or_create_uid(),
        'uid_new'   => $is_new ? '1' : '0',
        'site_name' => get_bloginfo('name'),
        'author'    => get_bloginfo('name'),
    ]);
}
add_action('wp_enqueue_scripts', 'hx29_enqueue_scripts');

// ── REST API (hx29/v1) ────────────────────────────────────────────
// Kept from the v3 vanilla theme as an alternative, pre-sanitised backend.
// The React frontend currently uses the standard wp/v2 endpoints, but these
// remain available for slug-free, ordinal post access.

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

    if ($limit < 1)  $limit  = 5;
    if ($limit > 50) $limit  = 50;

    $posts = get_posts([
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
    }, $posts);

    return new WP_REST_Response(['posts' => $output, 'total' => $total], 200);
}

function hx29_rest_read_post(WP_REST_Request $request): WP_REST_Response {
    $number = (int) $request->get_param('number');

    if ($number < 1) {
        return new WP_REST_Response(['error' => 'Invalid post number.'], 400);
    }

    $posts = get_posts([
        'post_type'      => 'post',
        'posts_per_page' => 1,
        'offset'         => $number - 1,
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
    ]);

    if (empty($posts)) {
        return new WP_REST_Response(['error' => "Post #{$number} not found."], 404);
    }

    $post     = $posts[0];
    $rendered = apply_filters('the_content', $post->post_content);
    $rendered = preg_replace('/<\/(p|div|h[1-6]|li|blockquote|pre)>/i', "</$1>\n", $rendered);
    $rendered = preg_replace('/<br\s*\/?>/i', "\n", $rendered);
    $content  = wp_strip_all_tags($rendered);
    $content  = preg_replace('/\n{3,}/', "\n\n", trim($content));

    $total = (int) wp_count_posts('post')->publish;

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
