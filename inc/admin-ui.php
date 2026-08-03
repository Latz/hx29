<?php
/**
 * Site Editor "Design" screen: hides the Styles/Navigation/Pages/Templates/
 * Patterns navigation cards. Gutenberg exposes no public PHP hook for hiding
 * individual Design-screen entries — this targets each card's `<button id>`
 * directly via CSS (confirmed against a live site: these are `<button>`
 * elements, not `<a>` links, each with a stable id), since that's the
 * closest thing to a stable contract. It may need adjusting on a future
 * WP/Gutenberg update if those ids or the card markup structure change.
 */

/**
 * Enqueues CSS that hides the Styles/Navigation/Pages/Templates/Patterns
 * cards on the Site Editor's "Design" landing screen.
 * @param string $hook - Current admin page hook suffix.
 * @return void
 */
function hx29_hide_site_editor_design_cards($hook): void {
    if ('site-editor.php' !== $hook) {
        return;
    }

    wp_register_style('hx29-admin-ui', false, [], HX29_VERSION);
    wp_enqueue_style('hx29-admin-ui');

    $button_ids = [
        'global-styles-navigation-item',
        'navigation-navigation-item',
        'page-navigation-item',
        'template-navigation-item',
        'patterns-navigation-item',
    ];

    $selectors = array_map(static fn($id) => "div[role=\"listitem\"]:has(> #{$id})", $button_ids);
    $selectors[] = '.edit-site-sidebar-navigation-screen__description';

    wp_add_inline_style(
        'hx29-admin-ui',
        implode(',', $selectors) . '{display:none !important;}'
    );
}
add_action('admin_enqueue_scripts', 'hx29_hide_site_editor_design_cards');
