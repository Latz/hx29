<?php
// Silence — block themes use templates/index.html
// This file is required by WordPress as a fallback.
get_header();
?>
<div id="terminal-container" class="hx29-fallback-container">
  <div id="terminal-output">
    <div>HX29 Terminal — JavaScript required for full functionality.</div>
    <div>&nbsp;</div>
    <div>Recent posts:</div>
    <?php
    $posts = get_posts(['posts_per_page' => 5, 'post_status' => 'publish']);
    foreach ($posts as $i => $post) {
        echo '<div>' . ($i + 1) . '. ' . esc_html($post->post_title) . '</div>';
    }
    ?>
  </div>
</div>
<?php get_footer(); ?>
