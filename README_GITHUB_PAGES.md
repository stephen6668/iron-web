# IRON Web V24.26 – mit deinem aktuellen PC verbunden

Die gesamte bestehende GitHub-Webseite bleibt enthalten. Neue Bildschirme:
Dokumente, Kalender/Sport, Mails, Begleitmodus, Gedächtnis und Auftragsverlauf.
Alle Bildschirme sind über das Menü erreichbar. Gestaltung bleibt dunkel/cyan,
mit übersichtlicheren Abständen, Formularen und einer zweispaltigen Menüansicht.

## Installieren
1. IRON am PC beenden. Alle Dateien aus `PC` direkt nach `D:\iron-assistant`
   kopieren und Programmdateien ersetzen. Persönliche Daten/Konfigurationen bleiben.
2. Falls noch nicht eingerichtet, im bestehenden venv:
   `python CONFIGURE_IRON_LOCAL_DATA.py`
   Der bestehende Verbindungsschlüssel wird erhalten und angezeigt. IRON starten.
3. Die bisherige private HTTPS-Verbindung zu Port 8787 weiterverwenden.
   Bei bereits eingerichtetem Tailscale lautet der Serve-Aufruf am PC:
   `tailscale serve --bg http://127.0.0.1:8787`
   PC und Browsergerät müssen dein privates Tailscale-Netz erreichen können.
4. Den Inhalt des Ordners `WEB` in dein Repository **iron-web** übernehmen und
   über die bisherige GitHub-Pages-Einstellung veröffentlichen. Nicht in das
   separate Chevalier-Roth-Shop-Repository kopieren.
5. In IRON Web → DATENVERBINDUNG: private HTTPS-Adresse und Verbindungsschlüssel
   eingeben → PRÜFEN UND VERBINDEN. Anschließend HOME neu laden.
6. Diagnose öffnen und PC-Verbindung prüfen. Bei alten gecachten Dateien Strg+F5.

## Was zusammenarbeitet
- Aufgaben, Pläne, Einkauf und Ideen: dieselben lokalen PC-Daten, ohne Appwrite-DB.
- Sprach-/Texteingaben: bestehende IRON-PC-Steuerung und dessen konfigurierte KI.
  Die Webseite benötigt keinen eigenen Groq-/Claude-Key und keine Appwrite-Anmeldung.
- Der Browser kann Antworten mit seiner vorhandenen Sprachausgabe vorlesen.
- Nachrichten-Welt: nur gewähltes Land, geprüfte RSS-Quellen aus dem PC-Modul.
  Zusammenfassung nur auf Anfrage anhand vorhandener Nachrichtenauszüge.
- SMS: Übergabe über PC an SMSGate auf deinem Android-Handy. Die Web-Rückmeldung
  ist keine bestätigte Mobilfunkzustellung. Versandbestätigung weiter über IRON am PC.
  Die PC-Konfiguration bestimmt die verwendete SMSGate-SIM.
- Dokumente: direkt binär zum PC, maximal 50 MB; Bilder 6 MB. Bestehende Analyse:
  höchstens 20 PDF-Seiten bzw. 30.000 Zeichen. Kürzung wird gekennzeichnet.
- Mails/Kalender: letzter vorhandener Abruf mit Zeitangabe; keine Behauptung,
  dass ein alter Stand live neu geladen wurde. Weitere Aufträge gehen an den PC.
- Sport: lokale Einheiten eintragen und löschen, im PC-Sportkalender vorhanden.
- Gedächtnis: Nutzeraussagen mit Quelle, korrigieren/löschen/neue Angabe speichern.
- Begleiter: nächsten Schritt/Entscheidung festhalten, gespeicherten Stand anzeigen,
  vorhandene Routinen bewusst starten. Arbeitsroutine kann andere Fenster schließen.
- Fotos: lokale Browser-Bibliothek via IndexedDB, herunterladen/löschen sowie
  bewusst zur PC-Analyse senden. Fotos werden nicht automatisch auf andere Geräte
  synchronisiert. Frühere Appwrite-Fotos werden nicht gelöscht oder automatisch importiert.
- Aufträge: echte PC-Warteschlange mit Status/Ergebnis. Bei Zeitlimit oder
  Netzwerkunterbrechung zuerst hier nachsehen, nicht blind erneut senden.

IRON am PC und für SMS das Android-Handy müssen laufen. Unterwegs braucht dein
Browsergerät ebenfalls die bestehende private Verbindung. Kopplungsschlüssel nur
im eigenen Browser speichern, niemals in das öffentliche GitHub-Repository.

## Prüfung
82 lokale Python-Tests bestanden, einschließlich Authentifizierung/Origin-Prüfung,
Web-Aktionen, binärem Dokumentupload und Länderwahl. Web-Client-Test: ein Queue-Auftrag,
authentifizierte Abfragen, Listenfilter und binärer Upload. 17 JS-Skripte einschließlich
HTML-Skripten syntaktisch geprüft; weitere Änderungen ebenfalls einzeln geprüft.
Keine echte Windows-, Tailscale-, SMS- oder gerenderte Browserprüfung hier erfolgt.
Die tatsächliche Verbindung muss nach dem Installieren auf deinen Geräten geprüft werden.

Frühere README-Dateien beschreiben historische Cloud-Versionen. Diese Anleitung
ist für die aktuelle Verbindung maßgeblich. Kein Deployment wurde automatisch ausgeführt.
