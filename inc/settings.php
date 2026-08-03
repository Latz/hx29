<?php
/**
 * Admin-configurable terminal options: prompt prefix and typing speed.
 */

/**
 * Clamps the typing-speed setting to a sane ms-per-character range.
 * @param mixed $value - Raw posted value.
 * @return int Sanitized value, clamped to 0-50.
 */
function hx29_sanitize_typing_speed($value): int {
    return min(50, max(0, absint($value)));
}

/**
 * Registers the terminal option group with WordPress Settings API.
 * @return void
 */
function hx29_register_settings(): void {
    register_setting('hx29_settings', 'hx29_terminal_prompt_prefix', [
        'type'              => 'string',
        'sanitize_callback' => 'sanitize_text_field',
    ]);

    register_setting('hx29_settings', 'hx29_terminal_typing_speed', [
        'type'              => 'integer',
        'sanitize_callback' => 'hx29_sanitize_typing_speed',
    ]);

    add_settings_section(
        'hx29_settings_section',
        __('Terminal', 'hx29'),
        '__return_false',
        'hx29-terminal'
    );

    add_settings_field(
        'hx29_terminal_prompt_prefix',
        __('Prompt prefix', 'hx29'),
        'hx29_render_prompt_prefix_field',
        'hx29-terminal',
        'hx29_settings_section'
    );

    add_settings_field(
        'hx29_terminal_typing_speed',
        __('Typing speed (ms/char)', 'hx29'),
        'hx29_render_typing_speed_field',
        'hx29-terminal',
        'hx29_settings_section'
    );
}
add_action('admin_init', 'hx29_register_settings');

/**
 * Renders the prompt-prefix text field.
 * @return void
 */
function hx29_render_prompt_prefix_field(): void {
    $value = get_option('hx29_terminal_prompt_prefix', 'user@system');
    ?>
    <input
        type="text"
        name="hx29_terminal_prompt_prefix"
        value="<?php echo esc_attr($value); ?>"
        class="regular-text"
    />
    <p class="description">
        <?php esc_html_e('Account@host segment shown as the first-visit terminal prompt, e.g. "user@system" (the path/suffix is appended automatically).', 'hx29'); ?>
    </p>
    <?php
}

/**
 * Renders the typing-speed number field.
 * @return void
 */
function hx29_render_typing_speed_field(): void {
    $value = get_option('hx29_terminal_typing_speed', 1);
    ?>
    <input
        type="number"
        name="hx29_terminal_typing_speed"
        value="<?php echo esc_attr($value); ?>"
        min="0"
        max="50"
        class="small-text"
    />
    <p class="description">
        <?php esc_html_e('Baseline delay per typed character, in milliseconds. Higher is slower.', 'hx29'); ?>
    </p>
    <?php
}

/**
 * Adds the "HX29 Terminal" settings page under Settings.
 * @return void
 */
function hx29_add_settings_page(): void {
    add_options_page(
        __('HX29 Terminal', 'hx29'),
        __('HX29 Terminal', 'hx29'),
        'manage_options',
        'hx29-terminal',
        'hx29_render_settings_page'
    );
}
add_action('admin_menu', 'hx29_add_settings_page');

/**
 * Renders the "HX29 Terminal" settings page.
 * @return void
 */
function hx29_render_settings_page(): void {
    if (!current_user_can('manage_options')) return;
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('HX29 Terminal Settings', 'hx29'); ?></h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('hx29_settings');
            do_settings_sections('hx29-terminal');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}
