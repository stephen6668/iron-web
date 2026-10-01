# IRON Web V23.12 — Groq Cloud

Alle Dateien dieser ZIP im bestehenden GitHub-Pages-Repository ersetzen/ergänzen. Bestehende zusätzliche Dateien nicht löschen. Nach Veröffentlichung mit Strg+F5 neu laden.

Voraussetzung: IRON Cloud 3.10.0 deployen und GROQ_API_KEY sowie GROQ_MODEL=openai/gpt-oss-120b in Appwrite setzen. Der Schlüssel gehört ausschließlich in die Function-Variablen. Die Webseite verwendet die bestehende Cloud-URL und /api/chat.

Neu: 65-Sekunden-Abbruch für Chat-Netzwerkanfragen, korrekte Web-Fehlermeldung, Prüfung leerer Antworten, Modellanzeige im Diagnosebericht und Health-Test einschließlich Cloud-Version. Keine automatische Wiederholung, die Antworten oder Aktionen doppelt auslösen könnte. Browser-Sprachausgabe, SMS, Ideen, Tasks, Pläne und Weltansicht bleiben erhalten.

Nach Deployment anmelden, Chat testen und diagnostics.html öffnen. Dort muss Health 3.10.0 und beim Chat das Groq-Modell erscheinen. Health allein prüft nicht die Groq-Berechtigung.

Groq-Cloud: GPT-OSS verarbeitet Text. Allgemeine Webrecherche/Bildanalyse brauchen die separate, in der Cloud-Anleitung beschriebene Anbindung. Kein Groq-Schlüssel im Webpaket.

JavaScript-Syntax und Änderungen am Chatpfad geprüft. Kein Test in deinem angemeldeten Browser oder tatsächlichen GitHub-Deployment.
