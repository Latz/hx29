# Verbesserungsvorschläge — HX29 Terminal Theme (Runde 3)

Geordnet nach Aufwand/Nutzen-Verhältnis.

---

## PRIO HOCH

### 1. `cat` in Help und Man-Pages aufnehmen
**Dateien:** `src/commands/cmdHelp.js`, `src/i18n/en.js`, `src/i18n/de.js`  
`cat` ist implementiert aber fehlt in `help`-Output und hat keine Man-Page. Außerdem borgt `cmdCat.js:15` die `read_usage`-Meldung statt einer eigenen. Fix: `help_cat` + `man_pages.cat` + `cat_usage` in beiden Sprachen hinzufügen.

### 2. Sitzungs-Signatur mit `crypto.getRandomValues()` absichern
**Datei:** `src/storage.js`  
Aktuell: `'SIG-' + Math.floor(1000 + Math.random() * 9000)` — nur 4000 mögliche Werte. Fix: `crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0, 8)` für kryptografisch sichere IDs.

### 3. Fetch-Timeout in `apiFetch.js`
**Datei:** `src/api/apiFetch.js`  
Kein Timeout — auf langsamen Verbindungen hängt die App endlos. Fix: `Promise.race([fetch(...), new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 8000))])`.

### 4. `grep` Post-Limit konfigurierbar machen
**Datei:** `src/commands/cmdGrep.js:18`  
Hardcoded `per_page=100`. Fix: Wert aus `configRef.current` lesen (neues Config-Feld `grep_limit`, Default 100); bei `--all`-Flag alle Seiten parallel laden wie in `fetchAllPages`.

---

## PRIO MITTEL

### 5. `cd -` zum Zurückspringen in vorherigen Kontext
**Datei:** `src/commands/cmdCd.js`  
Kein Weg zurück zur letzten Kategorie/Tag nach `cd ..`. Fix: vorherigen Context in Ref speichern, `cd -` stellt ihn wieder her.

### 6. Suchresultate mit Excerpt-Vorschau
**Datei:** `src/commands/cmdSearch.js:17`  
Suchergebnisse zeigen nur Titel. Fix: `_fields` um `excerpt.rendered` erweitern, gestrippten Kurztext unter dem Titel anzeigen (1 Zeile).

### 7. `read` zeigt geschätzte Lesezeit
**Datei:** `src/commands/cmdRead.js`  
Einfache UX-Verbesserung: Wörteranzahl / 200 = Minuten, im Header neben Datum anzeigen. Keine API-Änderung nötig.

### 8. Konsistentes Error-Handling in API-Antworten
**Datei:** `src/api/apiFetch.js`  
HTTP 429 (Rate Limit) und 503 (Server down) liefern aktuell generische Fehlermeldungen. Fix: Statuscodes unterscheiden und spezifische i18n-Meldungen zurückgeben.

### 9. `history` mit Nummerierung und Wiederverwendung
**Datei:** `src/commands/cmdHistory.js`  
`!N` oder `!!` zum Wiederholen des N-ten History-Eintrags ist in Terminal-UX Standard. Fix: Im Input-Handler prüfen ob Input `!<N>` entspricht, dann History-Eintrag N ausführen.

---

## PRIO NIEDRIG

### 10. `whoami` Befehl
**Dateien:** `src/commands/registry.js`, neues `cmdWhoami.js`  
Zeigt: Visitor-Stage, Signatur-ID, Visit-Count, Theme, Config — alles aus `localStorage`. Rein clientseitig, ~20 Zeilen.

### 11. `--help` Flag für alle Befehle
**Dateien:** `src/commands/cmd*.js`  
Nur `ls` unterstützt `--help`. Fix: Alle Befehle prüfen auf `args.includes('--help')` und geben `t.man_pages.<cmd>` zurück. Konsistenz mit `ls`.

### 12. Server-seitiger Volltext-Suchendpoint in REST API
**Datei:** `inc/rest-api.php`  
`grep` lädt 100 Posts client-seitig für Volltextsuche. Fix: Neuer Endpoint `GET /hx29/v1/search-content?q=term&limit=10&offset=0` mit WP `WP_Query` `s`-Parameter + Content-Matching, liefert Treffer mit Kontext-Snippet. `grep` nutzt diesen statt client-seitig zu filtern.

---

## Nicht umzusetzen (Begründung)

| Vorschlag | Grund |
|---|---|
| Comment Edit/Delete | WordPress REST API erlaubt das nur für eingeloggte User; keine sinnvolle CLI-UX |
| Boolean Search Operators | Kaum genutzt, hoher Aufwand, WP REST API unterstützt kein MATCH AGAINST out-of-box |
| Offline-Modus / localStorage-Cache | Theme ist per Definition online (WordPress-Blog); kein realer Use Case |
| Export (CSV/JSON) | Passt nicht zur Terminal-Ästhetik |
| Dependency: fuse.js/date-fns | Zu schwer für minimalen Nutzen; native Implementierungen reichen |
