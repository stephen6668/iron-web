# IRON Web V23.10 – Ideen mit Appwrite

Die Ideen-Seite benutzt jetzt Appwrite. Sie liest und speichert Ideen nur mit einer angemeldeten IRON-Sitzung. Eine frühere Browser-Sammlung wird beim ersten erfolgreichen Öffnen einmalig nach Appwrite übertragen und bleibt zusätzlich im Browserspeicher. Löschen in Appwrite löscht einen Eintrag nicht wieder rückgängig, weil die Migration pro Browser nur einmal läuft.

Vor dem Veröffentlichen einmal im PC-Paket `python SETUP_IRON_IDEAS_APPWRITE.py` ausführen. Das richtet die Tabelle `ideas` in der vorhandenen Appwrite-Datenbank `iron` ein. Der Appwrite-Server-Key gehört nur auf den PC; `iron-appwrite.js` enthält ausschließlich öffentliche Projektkennung und Endpoint.

Dann dieses Webpaket auf GitHub Pages veröffentlichen. Über das Menü IDEEN öffnen; Änderungen anderer Browser werden alle acht Sekunden angezeigt. Der PC-Agent aus V23.0.33 holt dieselbe Tabelle etwa alle fünf Sekunden für das HUD.

Bestehende andere Webseiten- und SMS-Wege bleiben wie zuvor. Web-SMS nutzt weiterhin seinen vorhandenen Relay; für automatische PC-SMS ohne geöffnete Android-App wird der direkte Anbieter im PC-Paket eingerichtet.
