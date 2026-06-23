# HX29 Verbesserungsvorschläge

## Neue Befehle

**`whoami`** — Gibt die aktuelle Terminal-Identität aus (Stage-abhängig: `guest`, `intruder`, `anon`, `operator`) plus SIG-ID und Visit-Count. Rein aus `localStorage` — eine Handvoll Zeilen.

**`date`** — Gibt das aktuelle Datum/Uhrzeit in typischer Unix-Manier aus, ggf. mit Zeitzone. Einzeiler.

**`uptime`** — Simuliert: `up 847 days, 3:14, 1 user, load: 0.42 0.37 0.29` — alle Werte halbzufällig generiert, aber plausibel. Rein atmosphärisch, kein echter Fetch.

**`ping <hostname>`** — Simuliertes Ping-Output mit zufälligen RTT-Werten, endet nach 4 Paketen mit Statistik. Keine echte Netzanfrage. Wenn als Argument ein Post-Slug übergeben wird, macht es semantisch Sinn: `ping zero-day`.

**`cat <n>`** — Alias für `read`, aber roher (ohne Paginierung, Dump des kompletten Artikeltexts auf einmal). Gut für Screenshotting/Copy-Paste.

**`alias`** — Gibt eine Liste "installierter Aliase" aus (atmosphärisch hardgecoded, z.B. `r=read`, `l=link`). Zeigt was schon als Alias existiert.

---

## UX & Bedienbarkeit

**Tab-Completion** — Tab vervollständigt Befehle, `ls`-Subkommandos, und idealerweise Post-Slugs aus dem letzten Listing. Die Infrastruktur für Keydown-Hooks ist in `useHistoryNav.js` bereits vorhanden — Tab könnte dort mit `e.key === "Tab"` ergänzt werden. Ein `COMPLETIONS`-Objekt in `registry.js` würde die Kandidaten liefern.

**Typo-Korrektur** — Bei unbekanntem Befehl: `Did you mean: search?` wenn die Levenshtein-Distanz ≤ 2 ist. Nur ~20 Zeilen in `registry.js`, passt perfekt zur Terminal-Ästhetik.

**Bessere `--help`-Ausgabe** — `man` gibt detaillierte Seiten aus, aber `--help` bei Befehlen außer `ls` fehlt. `search --help`, `grep --help`, `cd --help` usw. könnten jeweils eine kurze Usage-Box ausgeben.

**`Ctrl+L` als Clear-Shortcut** — Standard in echten Terminals. In `useHistoryNav.js` einfach als `e.key === "l" && e.ctrlKey` ergänzbar.

---

## Neue CRT-Effekte & Idle-Sequenzen

**Scanlines** — Halbtransparente horizontale Linien über den gesamten Bildschirm als `::after`-Pseudo-Element mit `repeating-linear-gradient`. Rein CSS, Toggle via `data-scanlines`-Attribut.

**Phosphor-Nachleuchten (Ghosting)** — Text-`text-shadow` mit einem leichten Glow in Foreground-Farbe, z.B. `0 0 8px var(--fg)` mit niedriger Opacity. Stärke über CSS-Variable konfigurierbar — `config --glow 0.3`.

**Neue Idle-Sequenz: Defrag** — Klassisches DOS-Defrag-Raster (`░░▒▓█`), das sich von links nach rechts füllt, Cluster-Nummern hochzählt, dann `[ OK ] Drive C: optimized.` ausgibt.

**Neue Idle-Sequenz: Matrix-Regen** — Fallende Spalten aus zufälligen ASCII/Katakana-ähnlichen Zeichen. Endet mit `WAKE UP, OPERATOR.`

**`config --scanlines on|off` und `config --glow 0–1`** — Damit die neuen Effekte usergesteuert sind, konsistent mit dem bestehenden `config`-System.
