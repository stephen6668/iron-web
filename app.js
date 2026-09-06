const API_URL = "https://findlaw-ladies-evident-appraisal.trycloudflare.com";
const $ = s => document.querySelector(s);
const response = $("#response");
const input = $("#commandInput");

function show(text) { response.textContent = "IRON // " + text; }

function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 1.0;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

async function command(t) {
  t = (t || "").trim();
  if (!t) return;
  input.value = "";
  show("Befehl wird verarbeitet...");
  if (!API_URL) {
    const demo = `Verstanden, Sir. Dein Befehl war: ${t}`;
    show(demo);
    speak(demo);
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t })
    });
    const data = await res.json();
    const answer = data.antwort || "Keine Antwort erhalten, Sir.";
    show(answer);
    speak(answer);
  } catch (e) {
    show("PC-IRON ist nicht erreichbar.");
  }
}

$("#sendBtn").onclick = () => command(input.value);
input.onkeydown = e => { if (e.key === "Enter") command(input.value); };
document.querySelectorAll("[data-command]").forEach(x => x.onclick = () => command(x.dataset.command));

$("#uploadBtn").onclick = () => $("#imageInput").click();
$("#imageInput").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  show("Bild wird zu IRON hochgeladen...");
  if (!API_URL) { show("Demo: Bild ausgewählt: " + file.name); return; }
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: form });
    const data = await res.json();
    const answer = data.antwort || "Bild verarbeitet, Sir.";
    show(answer);
    speak(answer);
  } catch (err) {
    show("Bild-Upload fehlgeschlagen.");
  } finally {
    e.target.value = "";
  }
};

async function loadPlans() {
  if (!API_URL) return;
  try {
    const r = await fetch(`${API_URL}/api/plans`, { cache: "no-store" });
    const data = await r.json();
    if (data.plans && data.plans.length) {
      show(`Es sind ${data.plans.length} Pläne verfügbar, Sir.`);
    }
  } catch {}
}

async function checkPC() {
  const pc = document.querySelector(".offline");
  if (!API_URL) { pc.textContent = "CONFIGURE API"; return; }
  try {
    const r = await fetch(`${API_URL}/api/status`, { cache: "no-store" });
    if (!r.ok) throw new Error();
    pc.textContent = "CONNECTED";
    pc.classList.remove("offline");
  } catch {
    pc.textContent = "NOT CONNECTED";
  }
}
checkPC();
loadPlans();

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const r = new SR();
  r.lang = "de-DE";
  r.continuous = false;
  r.interimResults = false;
  r.onstart = () => {
    $("#voiceBtn").classList.add("listening");
    $("#voiceStatus").textContent = "LISTENING";
    show("Ich höre zu...");
  };
  r.onend = () => {
    $("#voiceBtn").classList.remove("listening");
    $("#voiceStatus").textContent = "STANDBY";
  };
  r.onerror = e => {
    $("#voiceBtn").classList.remove("listening");
    $("#voiceStatus").textContent = "ERROR";
    show("Sprache konnte nicht erkannt werden.");
  };
  r.onresult = e => command(e.results[0][0].transcript);
  $("#voiceBtn").onclick = () => {
    try { r.start(); } catch {}
  };
} else {
  $("#voiceBtn").onclick = () => show("Sprachsteuerung wird in diesem Browser nicht unterstützt.");
}
