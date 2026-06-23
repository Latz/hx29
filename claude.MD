# WordPress Theme Development Instructions

You are an expert WordPress developer. When writing code, generating templates, or refactoring this theme, you must strictly adhere to the following WordPress Coding Standards (WPCS), security protocols, and modern development best practices.

---

## 1. Core Architecture & File Structure
* **Template Hierarchy:** Always follow the official WordPress Template Hierarchy (e.g., `index.php`, `single.php`, `page.php`, `archive.php`, `404.php`).
* **Modularity:** Use `get_template_part( 'template-parts/content', $slug )` to break UI components into reusable pieces.
* **Functions.php:** Keep `functions.php` clean. It should only orchestrate the theme setup. Theme features, hooks, and asset enqueuing should be organized or included from a `/inc/` directory if they grow complex.
* **Theme Support:** Always declare theme support inside a function hooked to `after_setup_theme`:
    * `add_theme_support( 'wp-block-styles' );`
    * `add_theme_support( 'responsive-embeds' );`
    * `add_theme_support( 'title-tag' );`
    * `add_theme_support( 'post-thumbnails' );`
    * `add_theme_support( 'html5', array( 'comment-list', 'comment-form', 'search-form', 'gallery', 'caption', 'style', 'script' ) );`

---

## 2. Security (Crucial)
Never trust user input; always sanitize. Never output raw data; always escape.

### Data Sanitization (Input)
* Use specific functions based on data type: `sanitize_text_field()`, `sanitize_email()`, `sanitize_key()`, `absint()`.

### Data Escaping (Output)
* **Late Escaping:** Always escape at the absolute moment of output, not early in variables.
* **Functions:**
    * `esc_html()` – For standard text nodes.
    * `esc_attr()` – For HTML attributes.
    * `esc_url()` – For URLs (including `href` and `src`).
    * `wp_kses_post()` – For content allowed to contain standard HTML tags.
    * `esc_html_e()` / `esc_attr_e()` – For internationalization + escaping combined.

### Nonces
* Always verify nonces via `check_ajax_referer()` or `wp_verify_nonce()` for any custom POST, GET, or AJAX requests.

---

## 3. Performance & Asset Management
* **No Hardcoded Assets:** Never hardcode `<link rel="stylesheet">` or `<script>` tags into `header.php` or `footer.php`.
* **Hooks:** Always use `wp_enqueue_style()` and `wp_enqueue_script()` inside the `wp_enqueue_scripts` hook.
* **Cache Busting:** Use `wp_get_theme()->get( 'Version' )` as the version parameter for enqueued assets to handle cache busting dynamically during updates.
* **Resource Handling:** Prefer `get_theme_file_uri()` for URLs and `get_theme_file_path()` for server paths over the older `get_template_directory_uri()`.

---

## 4. Internationalization (i18n)
* Make the theme 100% translation-ready.
* **Text Domain:** Use a consistent text domain matching your theme's slug (e.g., `'my-custom-theme'`).
* **Functions:** Use `__()` for returns, `_e()` for echos, `_x()` for context, and `_n()` for plurals.
* **Variables:** Never pass variables directly into translation functions (e.g., *Wrong:* `__( "Hello $name", 'domain' )`). Use `sprintf()` combined with translations instead:
    ```php
    printf( esc_html__( 'Hello %s', 'my-custom-theme' ), esc_html( $name ) );
    ```

---

## 5. Modern WordPress & Block Editor (Gutenberg)
* **Block-First Mindset:** Design components assuming they will function alongside or within the Block Editor.
* **Editor Styles:** Enqueue editor styles using `add_editor_style( 'style-editor.css' )` so the backend layout matches the frontend.
* **Theme.json:** If configuring a block-based theme or a hybrid theme, utilize `theme.json` for managing color palettes, typography, layout widths, and block settings globally.

---

## 6. PHP Coding Standards & Formatting
* **Naming Conventions:** * Use `lowercase_with_underscores` for functions, variables, and hook names.
    * Prefix ALL global functions, classes, and variables with the theme's unique prefix (e.g., `my_theme_`).
* **Yoda Conditions:** Use Yoda conditions for logical comparisons (`if ( true === $variable )` instead of `if ( $variable === true )`).
* **Database Queries:** Always use `WP_Query` instead of raw SQL queries. If a custom query is run, always call `wp_reset_postdata()` immediately after the loop.

---

## 7. Output Expectations
* When generating template files, always start with a standardized WordPress file header comment including the file description.
* Always structure the loop cleanly using standard WordPress semantics:
    ```php
    if ( have_posts() ) :
        while ( have_posts() ) : the_post();
            // Template content
        endwhile;
    endif;
    ```