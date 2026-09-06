<?php
/**
 * Robustness tests for inc/uid.php (robustness.md Critical #1, #2).
 */
class UidTest extends WP_UnitTestCase {

    public function tear_down() {
        unset($_COOKIE['hx29_uid']);
        parent::tear_down();
    }

    /**
     * #1: an array-shaped cookie (Cookie: hx29_uid[]=a) must not crash the
     * request with a TypeError from preg_replace() returning an array.
     */
    public function test_array_shaped_cookie_does_not_throw() {
        $_COOKIE['hx29_uid'] = ['a'];

        $uid = hx29_get_or_create_uid();

        $this->assertIsString($uid);
        $this->assertMatchesRegularExpression('/^[a-f0-9]+$/', $uid);
    }

    public function test_valid_hex_cookie_is_returned_unchanged_with_no_option_write() {
        update_option('hx29_user_counter', 5, false);
        $_COOKIE['hx29_uid'] = 'abc123';

        $uid = hx29_get_or_create_uid();

        $this->assertSame('abc123', $uid);
        $this->assertSame(5, (int) get_option('hx29_user_counter'));
    }

    /**
     * #2: nothing in the codebase ever calls setcookie() to persist the
     * minted UID back to the browser, so the "returning visitor" branch
     * above never succeeds for a real client — every request without an
     * incoming cookie mints a new UID and writes wp_options. This test
     * documents that existing behavior so a future fix (e.g. actually
     * setting the cookie) is a deliberate, visible change.
     */
    public function test_missing_cookie_increments_counter_on_every_call() {
        delete_option('hx29_user_counter');
        unset($_COOKIE['hx29_uid']);

        hx29_get_or_create_uid();
        $after_first = (int) get_option('hx29_user_counter');

        hx29_get_or_create_uid();
        $after_second = (int) get_option('hx29_user_counter');

        $this->assertSame($after_first + 1, $after_second);
    }
}
