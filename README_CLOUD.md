# IRON Cloud – ohne eingeschalteten PC

Der neue Node-24-Server führt Iron unabhängig von deinem PC aus. Die vorhandene Website funktioniert weiterhin mit der privaten PC-Verbindung; unter **Verbindung** wählst du die Betriebsart. PC- und Cloud-Daten bleiben getrennt. Es gibt keinen automatischen Import oder Abgleich.

**Status:** Der Server und die mobile Bedienung sind vorbereitet. Es wurde kein Hosting eingerichtet, kein kostenpflichtiger Dienst gebucht und kein KI-Schlüssel im Repository hinterlegt. GitHub Pages allein kann den Server nicht ausführen.

## Was im Cloud-Modus funktioniert

- Aufgaben, Pläne, Einkaufslisten, Ideen, persönliche Angaben und Sporteinträge auf dem Server speichern. Manuelle Eingaben funktionieren auch ohne KI-Schlüssel.
- Eigene Iron-Termine speichern und als Kalenderdatei (`.ics`) in den Handy-Kalender übernehmen. Das ist kein automatischer Abgleich mit Google oder Outlook.
- Mit Gemini (`GEMINI_API_KEY`) oder Groq (`GROQ_API_KEY`): freie Gespräche mit Gesprächskontext sowie unterstützte Listen und Termine per Sprache oder Text bearbeiten. Iron erhält nur die ausdrücklich implementierten Werkzeuge.
- Mit Gemini: allgemeine Webrecherche über Google-Suche. Antworten werden nur bei vorhandenen Google-Quellenbelegen als belegte Recherche zurückgegeben. Fehlen Belege oder ist der Dienst nicht erreichbar, meldet Iron den Fehler. Der Provider kann Recherche separat berechnen; es gelten die Bedingungen deines Google-Projekts.
- Welt-Nachrichten direkt aus einer festen Auswahl von Redaktions- und Institutionsfeeds abrufen. Quelle und Veröffentlichungszeit sind sichtbar. Abdeckung und verfügbare Meldungen unterscheiden sich je Land; nicht jedes Land hat einen eigenen Feed. „Direkte Quelle“ bedeutet keine Garantie, dass jede Meldung amtlich oder vollständig ist. Die Vorleseansicht bietet einen gekennzeichneten Auszug der abgerufenen Schlagzeilen; eine Volltextanalyse von Artikeln findet dort nicht statt. Bei Ländern ohne eigenen Feed werden internationale Meldungen nach Ländererwähnungen gefiltert und entsprechend gekennzeichnet.
- TXT-, MD- und CSV-Dateien analysieren. Für Textanalysen wird der gewählte KI-Anbieter verwendet; die Dokumentanfrage hat keine Schreibwerkzeuge. PDF-, Office- und Bildanalyse bleiben über die bestehende PC-Verbindung verfügbar. Fotos in der Browserbibliothek bleiben gerätebezogen und werden nicht automatisch synchronisiert.
- Eine SMS im Nachrichtenprogramm des Handys vorbereiten. Der Versand erfolgt dort durch dich; Iron bestätigt keine Mobilfunkzustellung. Die bisherige PC-/SMSGate-Verbindung bleibt im PC-Modus erhalten.

Mailkonten und externe Kalenderkonten sind noch nicht angebunden. Cloud-Iron kann ohne entsprechende Integration keine E-Mails lesen oder versenden, Programme auf deinem PC steuern oder beliebige Handy-Apps bedienen. Bestehende PC-Funktionen werden durch den Cloud-Modus nicht automatisch übernommen.

## Hosting-Voraussetzungen

Du brauchst einen dauerhaft erreichbaren VPS oder Container-Host mit Node.js 24, HTTPS und **dauerhaftem privaten Datenspeicher**. Ein flüchtiges Dateisystem oder eine zustandslose Function reicht für diese Serverversion nicht aus. Ein Reverse-Proxy kann HTTPS übernehmen. Der Node-Port soll nur intern beziehungsweise auf `127.0.0.1` erreichbar sein.

Betreibe genau **eine Serverinstanz** pro Datenverzeichnis. Die JSON-Datei wird innerhalb eines Prozesses serialisiert und atomar ersetzt; mehrere Instanzen dürfen dasselbe Verzeichnis nicht gemeinsam beschreiben.

Dieser Server ist ein persönliches System mit einem gemeinsamen Verbindungsschlüssel und einem Datenbestand. Er ist nicht für mehrere unabhängige Benutzer mit getrennten Konten ausgelegt.

### Konfiguration

Kopiere `.env.example` auf dem Server nach `.env` und trage die Werte ein. `.env` ist ignoriert und darf nicht veröffentlicht werden.

| Variable | Bedeutung |
| --- | --- |
| `PORT` | Interner Port, standardmäßig `8787` |
| `HOST` | Bind-Adresse; direkt auf dem VPS bevorzugt `127.0.0.1`, im Container `0.0.0.0` |
| `IRON_ACCESS_TOKEN` | Zufälliger persönlicher Schlüssel, mindestens 32 Zeichen |
| `IRON_ALLOWED_ORIGINS` | Erlaubte Website-Ursprünge, exakt und durch Kommas getrennt |
| `IRON_DATA_DIR` | Dauerhaftes privates Datenverzeichnis, im Container `/data` |
| `IRON_AI_PROVIDER` | `gemini` oder `groq`; leer wählt bei vorhandenem Gemini-Schlüssel Gemini, sonst Groq |
| `GEMINI_API_KEY` | Serverseitiger Gemini-Schlüssel für Gespräche und belegte Google-Webrecherche |
| `GEMINI_MODEL` | Standard: `gemini-3.5-flash` |
| `GROQ_API_KEY` | Optionaler serverseitiger Groq-Schlüssel als Alternative ohne Google-Webrecherche |
| `GROQ_MODEL` | Standard: `openai/gpt-oss-120b` |

Einen neuen Verbindungsschlüssel kannst du auf dem Server erzeugen:

```sh
openssl rand -hex 32
```

Den Wert nur in der Server-Konfiguration und anschließend auf deinen eigenen Geräten unter **Verbindung** eintragen. Ein KI-Schlüssel gehört nie ins Browserformular. Für Gemini im Hosting `IRON_AI_PROVIDER=gemini`, `GEMINI_API_KEY` und bei Bedarf `GEMINI_MODEL` setzen. Der Verbindungsschlüssel für den Browser ist ein davon unabhängiger `IRON_ACCESS_TOKEN`.

Für Website und API auf derselben Domain zum Beispiel:

```dotenv
IRON_ALLOWED_ORIGINS=https://iron.deine-domain.de
```

Wenn auch die bestehende GitHub-Seite den Server nutzen soll:

```dotenv
IRON_ALLOWED_ORIGINS=https://iron.deine-domain.de,https://stephen6668.github.io
```

Ein Origin enthält keinen Pfad wie `/iron-web/`. Für die lokale Prüfung ist `http://localhost:8787` in der Vorlage eingetragen; ersetze oder ergänze ihn beim Hosting passend.

### Direkt mit Node starten

Im ausgecheckten Repository auf dem Server:

```sh
npm ci
npm test
npm run check
npm start
```

Für den dauerhaften Betrieb als Dienst starten und bei Abstürzen neu starten lassen. Setze `IRON_DATA_DIR` auf ein dauerhaftes Verzeichnis, auf das nur der Dienstnutzer Zugriff hat. Der Reverse-Proxy leitet HTTPS an den internen Port weiter. Die Serveranwendung liefert die Website selbst aus; GitHub Pages ist dann optional.

### Mit Docker Compose starten

Nach Konfiguration von `.env`:

```sh
docker compose up --build -d
```

Die Compose-Datei bindet den Dienst an `127.0.0.1:8787` und speichert Daten im benannten Volume `iron-data` unter `/data`. HTTPS muss davor über deinen Reverse-Proxy eingerichtet werden. Die Anwendung läuft als Benutzer `node`; ein neues benanntes Volume übernimmt die Schreibrechte aus dem Image. Bei einem eigenen Bind-Mount muss das Verzeichnis für UID/GID `1000:1000` beschreibbar sein.

`docker compose down` erhält das Volume. **`docker compose down -v` löscht es.** Nutze keinen flüchtigen oder bei jedem Deployment neu angelegten Datenträger.

### Auf dem Handy verbinden

1. Die HTTPS-Adresse der gehosteten Website öffnen; alternativ die aktualisierte GitHub-Pages-Seite.
2. **Verbindung → Cloud – ohne PC** wählen.
3. HTTPS-Server-Adresse ohne Pfad und den persönlichen `IRON_ACCESS_TOKEN` eingeben.
4. **Prüfen und verbinden**, anschließend zurück zu Iron.
5. Unter **Diagnose** Server und KI-Konfiguration prüfen. Ein konfigurierter Schlüssel allein bestätigt noch nicht den Zugriff auf das KI-Modell; dafür anschließend eine kurze Chatfrage senden.

Standardmäßig gilt die Cloud-Anmeldung nur für die Browser-Sitzung. **Auf diesem eigenen Gerät angemeldet bleiben** speichert den Verbindungsschlüssel im lokalen Browser. Wer Zugriff auf ein angemeldetes Gerät hat, kann deine Iron-Daten verwenden.

## Sprache auf dem Handy

**Sprechen** nimmt eine Nachricht auf. Der ausdrücklich gestartete Gesprächsmodus hört nach einer Antwort erneut zu, solange die Seite im Vordergrund ist. **Pause** beendet das Zuhören und die Sprachausgabe. Beim Wechsel in den Hintergrund wird pausiert; Iron ist kein ständig lauschender Hintergrunddienst.

Spracherkennung und Stimmen hängen vom Browser und Betriebssystem ab. Öffne die Seite über HTTPS, erlaube das Mikrofon und aktiviere bei Bedarf die Stimme. Text bleibt immer verwendbar. Die Browser-Spracherkennung kann einen Dienst des Browseranbieters nutzen.

## Daten, Sicherungen und Prüfung

Der Speicher ist auf 32 MB begrenzt; ältere Auftragszustände bleiben zur Vermeidung doppelter Ausführung erhalten. Bei Erreichen der Grenze sind Export und administrative Archivierung nötig. Persönliche Daten, Chatverlauf und Auftragszustände liegen in `IRON_DATA_DIR/iron-data.json`. Sichere dieses Verzeichnis regelmäßig außerhalb des laufenden Containers und prüfe die Wiederherstellung. Für eine konsistente Kopie den Dienst kurz stoppen. Die Datendatei und Sicherungen gehören niemals in GitHub.

Nach Netzwerkfehlern oder einem Zeitlimit zuerst **Aufträge** prüfen. Aktionen werden nicht automatisch erneut gesendet; ein unklarer Ausgang ist keine bestätigte Ausführung. Für die Inbetriebnahme je einen eindeutig benannten Testeintrag speichern, die Website auf einem zweiten Gerät öffnen und nach einem Serverneustart prüfen, ob der Eintrag erhalten ist.

Automatisierte Tests verwenden kontrollierte Anbieterantworten. Ein erfolgreicher Test ersetzt keine Prüfung deines Hostings, echten KI-Schlüssels, Handy-Mikrofons oder der Erreichbarkeit externer Nachrichtenquellen.
