<?php
/**
 * Visitor UID system: generates and persists a short hex identifier per visitor.
 */

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
