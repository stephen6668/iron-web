# IRON Website – Oberfläche der Android-Version V6.7

Diese statische Website enthält dieselben neun Ansichten und dieselbe
Gestaltung wie die Android-App: HOME, HUD, WELT / NEWS, FOTOS, PLÄNE,
EINKAUF, TASKS, SMS und DIAGNOSE. Das Hamburger-Menü zeigt alle neun zugleich.
Die Seite arbeitet mit demselben Appwrite-Projekt und derselben IRON-
Cloud-Funktion wie die App.

**Vor einer öffentlichen Veröffentlichung:** Die Cloud-Funktion
V3.6.0 prüft bei einigen älteren privaten Bild- und Gesprächsrouten selbst noch
keinen Benutzer. Die Anmeldung in der Website allein schützt diese Routen
nicht. Richte zuerst eine serverseitige Zugriffskontrolle für diese
Cloud-Routen ein und prüfe die Appwrite-Berechtigungen. Die neuen SMS-Routen
prüfen serverseitig das Appwrite-Konto. Diese ZIP enthält das Cloud-Update.

## Auf GitHub Pages veröffentlichen

1. **Nur den Inhalt dieses Ordners** in das Stammverzeichnis eines GitHub-
   Repositorys auf dem Branch `main` hochladen. `index.html` muss direkt
   im Stammverzeichnis stehen, nicht in einem zusätzlichen ZIP-Ordner.
2. Im Repository `Settings → Pages → Build and deployment → Source`
   **GitHub Actions** auswählen. Der enthaltene Workflow
   `.github/workflows/pages.yml` veröffentlicht die Seite bei jedem Push.
3. Die Webadresse wird `https://DEIN-NAME.github.io/REPOSITORY/`.
4. Im bereits verwendeten Appwrite-Projekt unter **Platforms** eine
   **Web-App** mit Hostname `DEIN-NAME.github.io` hinzufügen; für lokale
   Entwicklung zusätzlich `localhost`. Ohne diese Freigabe kann das
   Appwrite-Login im Browser durch CORS scheitern.
5. Für die Google-Mail-Verbindung die Web-Origin
   `https://DEIN-NAME.github.io` im bestehenden Google OAuth Client
   autorisieren. Falls du Gmail dort nicht verwendest, ist dieser Schritt
   unnötig. Die Cloud-Funktion V3.6.0 muss für Ländernews und Web-SMS
   aktualisiert werden.

Keine API-Schlüssel, Passwortdateien oder PC-Gedächtnisdaten hochladen.
Ein GitHub-Pages-Auftritt ist öffentlich abrufbar; erst mit Zugriffskontrolle
in der Cloud-Funktion können die privaten Cloud-Routen geschützt werden.

## Browserfunktionen

- Gleiche Navigation und Ansichten wie Android, inklusive interaktivem Globus,
  Länderauswahl, Nachrichten und Zusammenfassung.
- Eingaben, Aufgaben, Pläne, Einkaufslisten und Fotos nutzen Appwrite und
  die vorhandene Cloud-Funktion.
- Sprachbefehle benötigen Browserunterstützung und Mikrofonfreigabe. Die
  Sprachausgabe nutzt die vorhandene IRON-Cloud-Stimme.
- Kalenderbefehle laden eine `.ics`-Datei herunter, die du im Kalender
  übernehmen kannst. Web-SMS laufen über die angemeldete IRON-Cloud zur
  Android-App; nur das Telefon kann sie tatsächlich versenden. Solange die
  App geschlossen ist, bleibt der Auftrag wartend. Die Website zeigt den
  Status nach Rückmeldung des Telefons. Ein statischer Browser-Tab kann
  keine Android-Hintergrundbenachrichtigungen ausführen.
- Der PC-Agent kann nur Aufgaben übernehmen, wenn er zu Hause läuft und
  mit demselben Appwrite-Projekt verbunden ist.

Zum lokalen Testen `python -m http.server 8000` in diesem Ordner starten und
`http://localhost:8000/` öffnen. Ein Doppelklick auf `index.html` reicht
für Login und Browser-APIs nicht zuverlässig aus.
