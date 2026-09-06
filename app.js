const $ = s => document.querySelector(s);
const response = $("#response");
const input = $("#commandInput");
const voiceStatus = $("#voiceStatus");
const pcLinkStatus = $("#pcLinkStatus");

// --- PC-Adresse verwalten (einmal eingeben, wird gespeichert) ---
function holePcAdresse() {
  let adresse = localStorage.getItem("iron_pc_adresse");
  if (!adresse) {
    adresse = prompt(
      "IP-Adresse deines PCs eingeben (z.B. localhost:5050 wenn du diese " +
      "Seite auf demselben PC öffnest, oder 192.168.1.42:5050 fürs WLAN):",
      "localhost:5050"
    );
    if (adresse) localStorage.setItem("iron_pc_adresse", adresse);
  }
  return adresse || "localhost:5050";
}

let PC_ADRESSE = holePcAdresse();

function aendrePcAdresse() {
  const neue = prompt("Neue PC-Adresse eingeben:", PC_ADRESSE);
  if (neue) {
    PC_ADRESSE = neue;
    localStorage.setItem("iron_pc_adresse", neue);
    pruefeVerbindung();
  }
}

// --- Antwort auch laut vorlesen (Browser-eigene Sprachausgabe) ---
function sprich(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  window.speechSynthesis.speak(utterance);
}

// --- Verbindung zum PC prüfen ---
async function pruefeVerbindung() {
  try {
    const res = await fetch(`http://${PC_ADRESSE}/status`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      pcLinkStatus.textContent = "CONNECTED";
      pcLinkStatus.classList.remove("offline");
      return true;
    }
  } catch (e) {
    // Server nicht erreichbar
  }
  pcLinkStatus.textContent = "NOT CONNECTED";
  pcLinkStatus.classList.add("offline");
  return false;
}

// --- Befehl an Iron senden ---
async function command(t) {
  t = (t || "").trim();
  if (!t) return;

  response.textContent = "IRON // Verarbeite: " + t;
  input.value = "";

  try {
    const res = await fetch(`http://${PC_ADRESSE}/befehl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
      signal: AbortSignal.timeout(30000),
    });
    const daten = await res.json();
    response.textContent = "IRON // " + daten.antwort;
    sprich(daten.antwort);
    pcLinkStatus.textContent = "CONNECTED";
    pcLinkStatus.classList.remove("offline");
  } catch (e) {
    response.textContent = "IRON // Konnte den PC nicht erreichen. Läuft iron_assistant.py? " +
      "(Adresse: " + PC_ADRESSE + " - Symbol unten rechts zum Ändern antippen)";
    pcLinkStatus.textContent = "NOT CONNECTED";
    pcLinkStatus.classList.add("offline");
  }
}

$("#sendBtn").onclick = () => command(input.value);
input.onkeydown = e => { if (e.key === "Enter") command(input.value); };
document.querySelectorAll("[data-command]").forEach(x => x.onclick = () => command(x.dataset.command));

// PC-Link-Anzeige antippbar machen, um die Adresse zu ändern
if (pcLinkStatus) pcLinkStatus.parentElement.onclick = aendrePcAdresse;

// --- Bild-Upload für Hologramme ---
$("#uploadBtn").onclick = () => $("#imageInput").click();
$("#imageInput").onchange = async e => {
  const datei = e.target.files[0];
  if (!datei) return;
  response.textContent = "IRON // Lade " + datei.name + " hoch und erstelle Hologramm...";

  const formData = new FormData();
  formData.append("datei", datei);

  try {
    const res = await fetch(`http://${PC_ADRESSE}/hologramm_upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000),
    });
    const daten = await res.json();
    response.textContent = "IRON // " + daten.antwort;
    sprich(daten.antwort);
  } catch (e) {
    response.textContent = "IRON // Hochladen fehlgeschlagen. Ist der PC erreichbar?";
  }
};

// --- Spracheingabe (läuft im Browser, braucht kein PC für die Erkennung selbst) ---
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const r = new SR();
  r.lang = "de-DE";
  r.continuous = false;
  r.interimResults = false;
  r.onstart = () => {
    $("#voiceBtn").classList.add("listening");
    voiceStatus.textContent = "LISTENING";
    response.textContent = "IRON // Ich höre zu...";
  };
  r.onend = () => {
    $("#voiceBtn").classList.remove("listening");
    voiceStatus.textContent = "STANDBY";
  };
  r.onerror = () => { response.textContent = "IRON // Sprache konnte nicht erkannt werden"; };
  r.onresult = e => command(e.results[0][0].transcript);
  $("#voiceBtn").onclick = () => r.start();
} else {
  $("#voiceBtn").onclick = () => response.textContent = "IRON // Sprachsteuerung wird in diesem Browser nicht unterstützt.";
}

// Beim Laden direkt prüfen, ob der PC erreichbar ist
pruefeVerbindung();
setInterval(pruefeVerbindung, 15000);
