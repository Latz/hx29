# HX29 Terminal

A WordPress block theme that replaces the traditional blog interface with a fully interactive VT100-style terminal emulator. Navigate posts, search content, and read articles — all from a command line.

---

## Overview

HX29 renders no PHP templates. Every post, page, and comment is fetched live from the WordPress REST API and displayed as terminal output. The UI is built with React (via `@wordpress/element`) and [react-terminal-ui](https://github.com/jonmbake/react-terminal-ui), styled with the Glass TTY VT220 bitmap font.

Output is printed character-by-character. Links in articles become numbered footnotes. Long content paginates with `[m]ore`.

---

## Requirements

- WordPress 6.0+
- Node.js + npm (only needed to build from source)

---

## Installation

```bash
cd wp-content/themes/
git clone https://github.com/Latz/hx29
cd hx29
npm install
npm run build
```

Then activate **HX29 Terminal** in WP Admin → Appearance → Themes.

---

## Commands

### Navigation

| Command | Description |
|---|---|
| `ls posts [asc\|desc]` | List blog posts (newest first by default) |
| `ls pages` | List all static pages |
| `read <n>` / `r <n>` | Open article by number from the last list |
| `m` | Next page — more list results or next article page |
| `link <n>` / `l <n>` | Open link number n in a new tab |

### Search

| Command | Description |
|---|---|
| `search <term>` | Search post titles via the WP REST API |
| `grep <term>` | Full-text search across all posts with highlighted excerpts |

**Difference:** `search` queries titles server-side (fast, paginated). `grep` fetches all post bodies client-side and shows the matching sentences with the term highlighted in inverse video.

### Comments

| Command | Description |
|---|---|
| `comments <n>` | Show all comments for post n |
| `comment <n> Name: Text` / `c <n> Name: Text` | Post a comment on post n |

Example: `c 1 Ada: Great article!`

### Utilities

| Command | Description |
|---|---|
| `history` | Show recent command history |
| `config [--option value]` | View or change settings |
| `man <command>` | Detailed help page for a command |
| `clear` | Clear the terminal |
| `help` | Brief command overview |

---

## Configuration

Settings are stored in a browser cookie (`hx29_config`) with a 1-year TTL.

```
config --theme a
config --font 18
config --posts 5
config --order asc
```

| Option | Default | Values | Description |
|---|---|---|---|
| `--theme` | `a` | `a` `b` `c` `d` | Color scheme |
| `--font` | `22` | any px value | Font size in pixels |
| `--posts` | `10` | any number | Posts per page in listings |
| `--order` | `desc` | `asc` `desc` | Default sort order for `ls posts` |

---

## Color Themes

| Key | Name | Background | Foreground | Style |
|---|---|---|---|---|
| `a` | VT100 Green | `#000000` | `#00ff00` | Classic phosphor green monochrome |
| `b` | GitHub Dark | `#0d1117` | `#e6edf3` | Modern dark, blue accent |
| `c` | Purple | `#1a0a2e` | `#e0d0ff` | Deep purple with magenta |
| `d` | Solarized Light | `#fdf6e3` | `#657b83` | Light solarized |

Switch with `config --theme b`.

---

## Font

**Glass TTY VT220** — a pixel-perfect digital recreation of the original DEC VT220 character set. Self-hosted as `assets/fonts/glasstty.ttf`. Public Domain.

Fallback: Courier New → Courier → monospace.

---

## Technical Architecture

| Layer | Technology |
|---|---|
| UI framework | React via `@wordpress/element` |
| Terminal component | `react-terminal-ui` |
| Data source | WP REST API `/wp-json/wp/v2` |
| Build tool | `wp-scripts` (webpack) |
| Runtime config | `window.hx29` injected by `wp_localize_script` |

**No PHP templates.** The single theme template mounts a `<div id="hx29-root">` and loads the compiled JS bundle. All rendering happens in React.

**`window.hx29`** provides runtime values without an extra API call:
- `rest_root` — REST API base URL
- `nonce` — WP nonce for authenticated requests
- `site_name` — used in the shell prompt (`guest@site:~$`)
- `uid` — current user ID (for posting comments)

**Pager system** — four types:
- `article` — paginated by terminal height (character-count based)
- `posts` / `pages` — paginated by configured posts-per-page
- `search` — like posts, but filtered by search term across pages
- `grep` — paginated by whole match-blocks

**Link handling** — `<a>` tags in post HTML are extracted during parsing and appended as numbered footnotes below the article. `l <n>` opens footnote n; outside an article it opens the nth post URL from the last listing.

**Arrow key history** — captured in the `capture` phase on the hidden input to intercept before `react-terminal-ui`, with native setter dispatch to keep React state in sync.

---

## License

GNU General Public License v2 or later — see [https://www.gnu.org/licenses/gpl-2.0.html](https://www.gnu.org/licenses/gpl-2.0.html)
