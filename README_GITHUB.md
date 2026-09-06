# IRON Web v1

Für GitHub Pages:
1. Dateien in dein Repository hochladen.
2. Settings → Pages.
3. Source: Deploy from a branch.
4. Branch: `main`, Ordner: `/ (root)`.
5. Save.

Die Oberfläche ist responsive für iPhone, Samsung/Android und Desktop.

Aktuell ist es das Frontend. Als nächstes verbinden wir es mit `iron_assistant.py`:
- Befehle an IRON senden
- Pläne synchronisieren
- Bilder an IRON übertragen
- PC-Status anzeigen
- sichere Authentifizierung

Port 5050 nicht direkt öffentlich ins Internet stellen.

## PC-Verbindung
Die API-Erweiterung ist in `iron_assistant.py` enthalten. Installiere `flask-cors`. Die echte Internet-Verbindung von GitHub Pages zum PC bauen wir im nächsten Schritt sicher über HTTPS/Tunnel auf.
