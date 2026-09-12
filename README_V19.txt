IRON v19 – PC Einkaufsliste + Web Login Fix

1. PC:
   Ersetze in D:\iron-assistant:
   - iron_assistant.py
   - appwrite_pc_agent.py
   - iron_secrets.json nur falls du noch keine hast.
   Deine echte iron_secrets.json NICHT auf GitHub hochladen.

   Sprachbeispiel:
   Iron, erstelle eine Einkaufsliste mit Milch, Brot und Eiern.

   IRON speichert lokal:
   EINKAUF // Einkaufsliste

   Der PC-Agent synchronisiert sie automatisch in die vorhandene Appwrite-Tabelle "plans".
   einkaufsliste.html erkennt den Prefix EINKAUF // und zeigt sie dort an.

2. Web Login Fix:
   Die Function prüft den x-appwrite-user-jwt jetzt selbst gegen:
   GET https://fra.cloud.appwrite.io/v1/account
   mit X-Appwrite-Project + X-Appwrite-JWT.

3. Appwrite:
   Lade IRON_v19_APPWRITE_FUNCTION_AUTH_FIX.tar.gz als neues Deployment hoch.
   Entrypoint: index.js
   Execute access: Any
   ANTHROPIC_API_KEY muss als Secret vorhanden sein.
   Danach Deployment aktivieren.

4. GitHub:
   Ersetze mindestens:
   - iron-appwrite.js
   Optional alle Web-Dateien aus dem ZIP hochladen.
   Danach hart neu laden.
