# HX29 React Terminal Theme — Implementation Plan

## Context

Es existiert eine React-Komponente `hx29.jsx` im Theme-Ordner, die ein Terminal
simuliert und WordPress-Inhalte über die REST-API lädt. Aktuell ist sie aber
**kein** lauffähiges Theme: Es ist eine nackte `.jsx`-Datei mit einer
**hartcodierten Fremd-Domain** (`https://your-wordpress-site.com/wp-json/wp/v2`)
und ohne Build/Enqueue.

Parallel existiert `../hx29.old1` — ein vollständiges, ausgereiftes **v3.0.0
Vanilla-JS Block-Theme** mit eigener `hx29/v1`-REST-API, UID/Besucher-System,
Nonce-Auth und server-seitiger Content-Bereinigung. Das ist die etablierte
HX29-Konvention und das sichere Backend-Muster.

**Ziel:** Ein lauffähiges WordPress-**Block-Theme** im Ordner `hx29/`, dessen
Frontend die **React-Terminal-UI aus der JSX** ist (schlanker Befehlssatz:
`help`, `ls posts`, `ls pages`, `cat <slug>`, `whoami`, `date`, `clear`), aber
auf das **sichere `hx29/v1`-Backend von old1 portiert** (eigene Site, relativ,
Nonce-Auth, kein hartcodierter Host). Gebaut mit **@wordpress/scripts** gegen
**WordPress-eigenes React (`@wordpress/element` / `wp-element`)**. Build mit
**npm**, wobei der `pnpm`-Alias umgangen wird.

Entscheidungen (mit dem User bestätigt):
- Feature-Umfang: **JSX-Features + hx29-Backend** (nicht volle old1-Parität)
- Zielordner: **hx29 neu aufbauen**; `hx29.old1` bleibt unangetastet als Referenz
- React-Quelle: **WP-eigenes React** über `wp-element` (kleineres Bundle)
- Build-Tool: **@wordpress/scripts** (offiziell, erzeugt `*.asset.php` mit Deps)
- Theme-Typ: **Klassisches Mount** — Block-Theme-Schale (wie old1), React mountet
  in ein Container-`<div>` im Template

## pnpm-Alias umgehen

`npm` ist ein **Shell-Alias** auf `pnpm` (`alias npm=pnpm`). Das echte npm liegt
unter `/usr/local/bin/npm` (v11.6.4, bestätigt lauffähig). Im Theme-Ordner also
immer den **absoluten Pfad** benutzen:

```bash
/usr/local/bin/npm install
/usr/local/bin/npm run build
```

(`\npm` würde den Alias ebenfalls umgehen, aber der absolute Pfad ist eindeutig
und scriptbar.)

## Architektur

```
hx29/
├── style.css            # Theme-Header + alle CSS-Variablen/Layout (aus old1 übernommen)
├── theme.json           # Block-Theme-Config v2 (aus old1)
├── functions.php        # Setup, UID-System, REST hx29/v1, React-Bundle enqueuen
├── index.php            # No-JS-Fallback (aus old1)
├── parts/
│   ├── header.html
│   └── footer.html
├── templates/
│   ├── index.html       # Mount-Container <div id="hx29-root">
│   ├── single.html
│   └── 404.html
├── src/
│   └── index.jsx        # Portierte JSX: Mount + WPTerminal-Komponente
├── build/               # Generiert: index.js, index.asset.php, index.css (nicht editieren)
├── package.json
└── .gitignore           # node_modules, (build/ optional)
```

Datenfluss: `functions.php` registriert `hx29/v1`-Endpoints und enqueued
`build/index.js` mit den von `index.asset.php` deklarierten Dependencies
(`wp-element`). Per `wp_localize_script` kommen `rest_url`, `nonce`, `uid` ins
Frontend (globales `window.hx29`). React mountet in `#hx29-root` und ruft die
eigene Site relativ auf — kein CORS, keine Fremd-Domain.

## Schritte

### 1. Theme-Schale aus old1 übernehmen
`style.css`, `theme.json`, `index.php`, `parts/header.html`, `parts/footer.html`,
`templates/single.html`, `templates/404.html` 1:1 aus
`../hx29.old1/` kopieren (sie sind generisch und passen). In `style.css` bleibt
der `Theme Name: HX29 Terminal`-Header.

`templates/index.html`: Statt der old1-Terminal-DOM nur einen Mount-Punkt:
```html
<!-- wp:group {"layout":{"type":"full"}} -->
<div class="wp-block-group" style="margin:0;padding:0;width:100%">
  <!-- wp:html -->
  <div id="hx29-root"></div>
  <!-- /wp:html -->
</div>
<!-- /wp:group -->
```
CSS-Regeln in `style.css`, die `#terminal-container` per ID stylen, brauchen
einen Mount-Aufsatz: Entweder `#hx29-root` als Flex-Container 100vh ergänzen,
oder die Inline-Styles der JSX (`styles.wrapper` etc.) tragen das Layout selbst.
Da die JSX ihr komplettes Styling als Inline-`style`-Objekte mitbringt, reicht es,
`#hx29-root { height:100vh; }` zu setzen und das `.wp-site-blocks`-Flex-Layout aus
old1 beizubehalten.

### 2. package.json + @wordpress/scripts
```json
{
  "name": "hx29",
  "version": "4.0.0",
  "private": true,
  "scripts": {
    "start": "wp-scripts start",
    "build": "wp-scripts build"
  },
  "devDependencies": {
    "@wordpress/scripts": "^30"
  }
}
```
`wp-scripts` erwartet standardmäßig `src/index.js` → wir nutzen `src/index.jsx`
(unterstützt) bzw. benennen die Entry-Datei `src/index.jsx` und referenzieren sie,
oder setzen den Entry explizit. Einfachster Weg: Entry `src/index.jsx`,
Build-Aufruf `wp-scripts build src/index.jsx`. Verifiziert wird die tatsächliche
Default-Resolution beim ersten Build; ggf. Entry-Pfad anpassen.

`.gitignore`: `node_modules/`. `build/` wird **eingecheckt** mitgeliefert (Theme
muss ohne Node lauffähig sein) — also NICHT ignorieren.

### 3. JSX portieren → src/index.jsx
Basis ist `hx29.jsx`. Änderungen:

- **Imports auf wp-element:** `import { useState, useEffect, useRef, useCallback }
  from "@wordpress/element";` (statt `"react"`). @wordpress/scripts mappt
  `@wordpress/element` automatisch auf das externe `wp-element`-Global und schreibt
  die Dependency in `index.asset.php`.
- **Mount-Code ergänzen** (am Dateiende):
  ```jsx
  import { createRoot } from "@wordpress/element";
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("hx29-root");
    if (el) createRoot(el).render(<WPTerminal />);
  });
  ```
- **REST-Quelle umstellen:** Die drei `fetch*`-Funktionen (`fetchPosts`,
  `fetchPostBySlug`, `fetchPages`) statt auf den hartcodierten `WP_API`-Konstanten
  auf die **eigene Site relativ** zeigen. Da die JSX `ls posts/pages` + `cat <slug>`
  nutzt (Slug-basiert, nicht ordinal wie old1), gibt es zwei Optionen:
  - **(a) Standard wp/v2 relativ:** `const WP_API = "/wp-json/wp/v2";` und
    `X-WP-Nonce`-Header aus `window.hx29.nonce` an alle Requests. Behält die
    JSX-Logik (Slug, `ls pages`) 1:1, kein neuer PHP-Endpoint nötig. **Empfohlen**,
    weil die JSX-Befehle (`cat <slug>`, `ls pages`) genau auf `wp/v2` passen.
  - (b) Neue `hx29/v1`-Slug-Endpoints in PHP nachbauen — mehr Aufwand, nur nötig
    wenn die Antworten vor-bereinigt werden sollen. Für jetzt **nicht** nötig:
    `stripHtml()` macht die JSX bereits client-seitig.
  → Gewählt: **(a)**. `WP_API` = `window.hx29?.rest_root + 'wp/v2'` (absolut, von
    PHP geliefert) als Fallback `'/wp-json/wp/v2'`; Nonce-Header überall ergänzen.
- `SITE_NAME`/`AUTHOR`: aus `window.hx29` befüllen (PHP liefert `site_name`,
  `author`), Fallback auf die JSX-Defaults.

### 4. functions.php
Basis ist `../hx29.old1/functions.php`. Übernehmen: `hx29_setup()` (Theme-Support
+ UID-Counter-Seed), `hx29_get_or_create_uid()`, REST-Init (die `hx29/v1`-Endpoints
dürfen bleiben — schaden nicht, falls später (b) gewählt wird).

Anpassen — **Enqueue auf das Build-Bundle**:
```php
function hx29_enqueue_scripts() {
    wp_enqueue_style('hx29-style', get_stylesheet_uri(), [], '4.0.0');

    $asset = require get_template_directory() . '/build/index.asset.php';
    wp_enqueue_script(
        'hx29-terminal',
        get_template_directory_uri() . '/build/index.js',
        $asset['dependencies'],   // enthält 'wp-element'
        $asset['version'],
        true
    );

    // Falls wp-scripts ein CSS-Bundle erzeugt:
    if (file_exists(get_template_directory() . '/build/index.css')) {
        wp_enqueue_style('hx29-terminal-css',
            get_template_directory_uri() . '/build/index.css',
            [], $asset['version']);
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
```

### 5. Build
```bash
cd /home/latz/docker/wp/wp/wp-content/themes/hx29
/usr/local/bin/npm install
/usr/local/bin/npm run build
```
Erzeugt `build/index.js`, `build/index.asset.php` (mit `wp-element`-Dependency)
und ggf. `build/index.css`.

## Kritische Dateien
- **Neu/portiert:** `src/index.jsx` (aus `hx29.jsx`), `functions.php` (aus old1
  + Bundle-Enqueue), `templates/index.html` (Mount-Div), `package.json`
- **Aus old1 kopiert:** `style.css`, `theme.json`, `index.php`,
  `parts/*.html`, `templates/single.html`, `templates/404.html`
- **Referenz (nicht ändern):** `../hx29.old1/`

## Verifikation
1. `/usr/local/bin/npm run build` läuft fehlerfrei; `build/index.asset.php`
   listet `wp-element` als Dependency.
2. WP-Admin → Design → Themes → „HX29 Terminal" aktivieren.
3. REST erreichbar (eigene Site):
   `curl -s "http://localhost/wp-json/wp/v2/posts?per_page=3&_fields=id,slug,title,date" | head`
4. Seite aufrufen: Terminal rendert (grün auf schwarz), Prompt
   `guest@<site>:~$`, Begrüßung sichtbar, Input fokussiert bei Klick.
5. Befehle testen:
   - `help` → Befehlsliste
   - `ls posts` → echte Posts der Site (Slug · Datum · Titel)
   - `ls pages` → Seiten
   - `cat <slug>` → Post-Inhalt (HTML gestript)
   - `whoami`, `date`, `clear` → korrekt
   - `↑/↓` → Befehls-History
   - Unbekannter Befehl → Fehlermeldung
6. Browser-Konsole frei von „WP_API"/CORS-Fehlern; Requests gehen an die eigene
   Origin mit `X-WP-Nonce`.
7. JS deaktiviert → `index.php`-Fallback listet Recent Posts.

## Offene Punkte / Risiken
- **Entry-Resolution von wp-scripts:** Default ist `src/index.js`. Ob `.jsx` ohne
  Extra-Config greift, wird beim ersten Build geprüft; sonst Entry explizit setzen
  (`wp-scripts build src/index.jsx`) oder Datei `src/index.js` nennen.
- **`hx29.jsx`-Quelle:** bleibt im Theme-Root liegen (Referenz) oder wird nach
  `src/` verschoben — wird beim Umsetzen entschieden, ändert das Theme nicht.
- **CSS:** JSX bringt Inline-Styles mit; `style.css` aus old1 liefert nur das
  Block-Wrapper-/Body-Layout (100vh-Flex). Doppelte Hintergrundfarben sind
  unkritisch.
