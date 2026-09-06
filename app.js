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
    if (/plan|fitness|sport|training/i.test(t)) renderPlans();
    if (/muss|aufgabe|task|erinnere/i.test(t)) loadTasks();
    speak(answer);
  } catch (e) {
    show("PC-IRON ist nicht erreichbar.");
  }
}

$("#sendBtn").onclick = () => command(input.value);
input.onkeydown = e => { if (e.key === "Enter") command(input.value); };
document.querySelectorAll("[data-command]").forEach(x => x.onclick = () => command(x.dataset.command));
document.querySelectorAll("nav button").forEach(btn => {
  const label = btn.querySelector("small")?.textContent;
  if (label === "PLANS") btn.onclick = () => { window.location.href = "plans.html"; };
  if (label === "TASKS") btn.onclick = () => { window.location.href = "task.html"; };
});
document.getElementById("closePlans")?.addEventListener("click", () => document.getElementById("plansWindow").classList.remove("open"));
document.getElementById("closeTasks")?.addEventListener("click", () => document.getElementById("tasksWindow").classList.remove("open"));

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
    const count = data.plans?.length || 0;
    if (count) show(`Es sind ${count} Pläne gespeichert, Sir.`);
  } catch {}
}

async function loadTasks() {
  if (!API_URL) return;
  try {
    const r = await fetch(`${API_URL}/api/tasks`, { cache: "no-store" });
    const data = await r.json();
    renderTasks(data.tasks || []);
  } catch { show("Tasks konnten nicht geladen werden."); }
}

function openWindow(type) {
  document.querySelectorAll(".iron-window").forEach(x => x.classList.remove("open"));
  const el = document.getElementById(type === "plans" ? "plansWindow" : "tasksWindow");
  if (el) { el.classList.add("open"); if (type === "plans") renderPlans(); else loadTasks(); }
}

async function renderPlans() {
  const el = document.getElementById("plansList");
  if (!el || !API_URL) return;
  el.innerHTML = "<p class='muted'>Lade Pläne...</p>";
  try {
    const r = await fetch(`${API_URL}/api/plans`, {cache:"no-store"});
    const data = await r.json();
    const plans = data.plans || [];
    el.innerHTML = plans.length ? plans.map(p => `
      <article class="data-card"><div class="data-head"><strong>${escapeHtml(p.titel)}</strong><button onclick="deletePlan('${p.id}')">×</button></div>
      <small>${escapeHtml(p.erstellt || "")}</small>
      <div class="entries">${(p.eintraege||[]).map(x=>`<div><b>${escapeHtml(x.tag)}</b><span>${escapeHtml(x.inhalt)}</span></div>`).join("")}</div>
      ${p.hinweis?`<p class="muted">${escapeHtml(p.hinweis)}</p>`:""}
    </article>`).join("") : "<p class='muted'>Noch keine Pläne. Sag zum Beispiel: „IRON, erstelle einen Fitnessplan.“</p>";
  } catch { el.innerHTML = "<p class='muted'>Pläne konnten nicht geladen werden.</p>"; }
}

function renderTasks(tasks) {
  const el = document.getElementById("tasksList");
  if (!el) return;
  el.innerHTML = tasks.length ? tasks.map(t => `
    <article class="data-card task-card ${t.erledigt ? "done" : ""}">
      <label><input type="checkbox" ${t.erledigt?"checked":""} onchange="toggleTask('${t.id}', this.checked)"><span>${escapeHtml(t.text)}</span></label>
      <small>${escapeHtml(t.datum || "Offen")}</small>
    </article>`).join("") : "<p class='muted'>Noch keine Aufgaben. Sag zum Beispiel: „IRON, ich muss heute noch putzen.“</p>";
}

async function toggleTask(id, done) {
  try { await fetch(`${API_URL}/api/tasks/${id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({erledigt:done})}); loadTasks(); } catch {}
}
async function deletePlan(id) {
  try { await fetch(`${API_URL}/api/plans/${id}`, {method:"DELETE"}); renderPlans(); } catch {}
}
function escapeHtml(v) { return String(v ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
window.openWindow = openWindow; window.toggleTask = toggleTask; window.deletePlan = deletePlan;

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


// Dedicated Plans / Tasks screens
async function renderPlansScreen() {
  const el = document.getElementById("plansList");
  if (!el) return;
  if (!API_URL) { el.innerHTML = "<p class='muted'>API ist nicht konfiguriert.</p>"; return; }
  try {
    const r = await fetch(`${API_URL}/api/plans`, {cache:"no-store"});
    const data = await r.json();
    const plans = data.plans || [];
    el.innerHTML = plans.length ? plans.map(p => `
      <article class="data-card plan-screen-card">
        <div class="data-head"><div><strong>${escapeHtml(p.titel || "Plan")}</strong><small>${escapeHtml(p.erstellt || "")}</small></div><button onclick="deletePlanAndRefresh('${p.id}')">×</button></div>
        <div class="entries">${(p.eintraege||[]).map(x => `<div><b>${escapeHtml(x.tag || "")}</b><span>${escapeHtml(x.inhalt || "")}</span></div>`).join("")}</div>
        ${p.hinweis ? `<p class="muted">${escapeHtml(p.hinweis)}</p>` : ""}
      </article>`).join("") : `<div class="empty-screen"><div>◫</div><strong>NO PLANS</strong><p>Sag zu IRON zum Beispiel: „Erstelle einen Fitnessplan.“</p></div>`;
  } catch { el.innerHTML = "<p class='muted'>Pläne konnten nicht geladen werden.</p>"; }
}

async function renderTasksScreen() {
  const el = document.getElementById("tasksList");
  if (!el) return;
  if (!API_URL) { el.innerHTML = "<p class='muted'>API ist nicht konfiguriert.</p>"; return; }
  try {
    const r = await fetch(`${API_URL}/api/tasks`, {cache:"no-store"});
    const data = await r.json();
    const tasks = data.tasks || [];
    el.innerHTML = tasks.length ? tasks.map(t => `
      <article class="data-card task-card screen-task ${t.erledigt ? "done" : ""}">
        <label><input type="checkbox" ${t.erledigt?"checked":""} onchange="toggleTaskAndRefresh('${t.id}', this.checked)"><span>${escapeHtml(t.text || "Aufgabe")}</span></label>
        <small>${escapeHtml(t.datum || "Offen")}</small>
      </article>`).join("") : `<div class="empty-screen"><div>✓</div><strong>NO TASKS</strong><p>Sag zu IRON zum Beispiel: „Ich muss heute noch putzen.“</p></div>`;
  } catch { el.innerHTML = "<p class='muted'>Aufgaben konnten nicht geladen werden.</p>"; }
}

async function deletePlanAndRefresh(id) {
  await deletePlan(id);
  renderPlansScreen();
}
async function toggleTaskAndRefresh(id, done) {
  try {
    await fetch(`${API_URL}/api/tasks/${id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({erledigt:done})});
    renderTasksScreen();
  } catch {}
}
window.renderPlansScreen = renderPlansScreen;
window.renderTasksScreen = renderTasksScreen;
window.deletePlanAndRefresh = deletePlanAndRefresh;
window.toggleTaskAndRefresh = toggleTaskAndRefresh;
