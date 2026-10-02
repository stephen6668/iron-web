IRON TASKS / PLÄNE / IDEEN OHNE APPWRITE – V1

PC, WEB und ANDROID enthalten den vollständigen bisherigen Code mit der neuen Datenverbindung. SMS, Mail, Groq und die Cloud-Funktionen behalten ihre bisherigen Verbindungen. Nur Tasks, Pläne, Einkaufslisten und Ideen werden lokal gespeichert. Die Android-Dateien sind Quellcode zum Bauen einer APK, keine fertige APK.

EINRICHTUNG
1. IRON und alle bisherigen PC-Agent-Fenster beenden.
2. Inhalt von PC direkt in D:\iron-assistant kopieren und Programmdateien ersetzen. Deine bisherigen Konfigurationen bleiben bestehen.
3. Im bisherigen venv-Terminal: python CONFIGURE_IRON_LOCAL_DATA.py
   Den privaten Verbindungsschlüssel sicher aufbewahren. Er wird nur lokal erzeugt und ist nicht in diesem Paket enthalten.
4. IRON neu starten. Ausgabe: [IRON DATEN] SQLite aktiv.
5. Tailscale auf Windows und Android installieren: https://tailscale.com/download
   Mit demselben persönlichen Konto anmelden. Personal-Tarif wählen. Tailscale muss auf jedem Gerät laufen, das die PC-Daten abrufen soll.
6. Auf dem PC in PowerShell: tailscale serve --bg http://127.0.0.1:8787
   Falls HTTPS erst aktiviert werden muss, den angezeigten Tailscale-Einrichtungsschritten folgen.
   Anschließend: tailscale serve status
7. Den WEB-Inhalt in deinem iron-web-Repository aktualisieren und GitHub Pages veröffentlichen. Den ANDROID-Quellcode über deinen bisherigen GitHub-Actions-Workflow als APK bauen. Bei einem Update dieselbe App-Signatur verwenden; nicht vorher deinstallieren.
8. In der aktualisierten Webseite und APK unten rechts auf Datenverbindung klicken.
   Die von Tailscale angezeigte HTTPS-Adresse ohne weiteren Pfad und den Verbindungsschlüssel eintragen. Prüfen und verbinden drücken.
   Browser-/WebView-Berechtigungen für den Zugriff auf dein privates Netzwerk erlauben, falls gefragt.
9. Task-, Plan- oder Ideenbildschirm neu öffnen. Einen eindeutig benannten Testeintrag speichern und im PC-HUD kontrollieren. Auf dem anderen Gerät neu laden; Änderungen an Listen werden spätestens nach dem nächsten Abruf sichtbar (Tasks/Pläne ca. 5 Sekunden, Ideen ca. 8 Sekunden).

BETRIEB
PC muss eingeschaltet sein und IRON laufen. Bei ausgeschaltetem PC kann nichts auf ihm gespeichert werden; das System meldet einen Verbindungsfehler und behauptet keinen erfolgreichen Server-Speichervorgang. Es gibt keine automatische Offline-Warteschlange.
Die Webseite bleibt auf GitHub Pages; nur die Daten liegen auf deinem PC. HTTPS wird privat über Tailscale Serve vermittelt. Kein öffentliches Port-Forwarding und kein Funnel erforderlich. Der Verbindungsschlüssel gehört weder ins Repository noch in Screenshots.

DATENÜBERNAHME
Vorhandene iron_tasks.json, iron_plans.json und iron_ideas.json werden beim ersten Zugriff übernommen. Ihre Originale werden als *.before-local-data.bak gesichert. SQLite liegt in iron_local_data.sqlite3. JSON-Spiegel bleiben für das vorhandene HUD bestehen. Externe lokale JSON-Änderungen werden beim nächsten Zugriff übernommen.
Daten, die ausschließlich in Appwrite liegen und noch nicht lokal vorhanden sind, können bei überschrittenem Appwrite-Limit nicht automatisch ausgelesen werden. Sie bleiben dort unverändert. Erst nach Export/Aufhebung des Limits können wir sie ergänzen. Browser-Ideen aus der bisherigen lokalen Ideenliste werden einmalig in den PC übertragen; Cloud-Tasks/Pläne werden nicht automatisch exportiert.
Cloud-Sync für diese drei Datentypen wird deaktiviert, sobald iron_local_data_config.json enabled=true enthält. Appwrite bleibt für die bisherigen anderen Dienste bestehen. Ein bestehender HTTP 500 beim SMS-Relay wird durch diese Änderung nicht behoben.

ZURÜCKWECHSELN
IRON und Agent beenden. In iron_local_data_config.json enabled auf false ändern. In APK/Web unter Datenverbindung zur bisherigen Cloud wechseln. Dann IRON/Agent neu starten. Es findet kein automatischer Merge zwischen PC-Daten und Cloud statt; beide Bestände bleiben erhalten.

PRÜFUNGEN
Python-/JavaScript-Syntax; API-Authentifizierung; erlaubte/unerlaubte Origins; Aufgaben/Pläne/Ideen erstellen/ändern/löschen; Persistenz; JSON-Import und HUD-Spiegel; Appwrite-Sync-Abschaltung; SMS-Nativcode unverändert. Windows, Tailscale, veröffentlichte GitHub-Seite und fertige Android-APK konnten hier nicht auf deinen Geräten getestet werden.

Offizielle Infos:
https://tailscale.com/pricing
https://tailscale.com/docs/reference/tailscale-cli/serve
