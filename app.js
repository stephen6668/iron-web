const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cloud = window.IRONCloud;
if (!cloud) {
  const why = window.IRON_APPWRITE_LOAD_ERROR || "IRON Appwrite Bridge wurde nicht geladen.";
  console.error("IRON Cloud startup:", why);
  window.addEventListener("DOMContentLoaded", () => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:20px;z-index:99999;background:#12080a;color:#ff8290;border:1px solid #ff5265;padding:18px;font:14px monospace;overflow:auto";
    box.innerHTML = "<b>IRON APPWRITE STARTFEHLER</b><br><br>" + String(why) +
      "<br><br>Prüfe, ob <b>iron-appwrite.js</b> auf GitHub hochgeladen wurde.";
    document.body.appendChild(box);
  });
  throw new Error(why);
}
const response = $("#response");
const input = $("#commandInput");
let currentUser = null;
let pcOnline = false;
let pcLastSeen = null;

function show(text) {
  if (response) response.textContent = "IRON // " + text;
}
function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/^IRON\s*\/\/\s*/i, ""));
  u.lang = "de-DE"; u.rate = 1; u.pitch = 1;
  speechSynthesis.speak(u);
}
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}
function nowISO(){ return new Date().toISOString(); }

// ---------- AUTH ----------
function ensureAuthUI() {
  if ($("#ironAuth")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <section class="auth-overlay" id="ironAuth">
      <div class="auth-card">
        <div class="eyebrow">IRON CLOUD // SECURE ACCESS</div>
        <h2>ACCESS REQUIRED</h2>
        <p>Mit deinem Appwrite-IRON-Konto anmelden.</p>
        <input id="authEmail" type="email" placeholder="E-Mail" autocomplete="username">
        <input id="authPassword" type="password" placeholder="Passwort" autocomplete="current-password">
        <button id="authLogin">LOGIN</button>
        <div id="authError"></div>
      </div>
    </section>`);
  $("#authLogin").onclick = async () => {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const err = $("#authError");
    err.textContent = "";
    try {
      currentUser = await cloud.login(email,password);
      $("#ironAuth").classList.remove("open");
      await afterLogin();
    } catch(e) {
      err.textContent = e?.message || "Login fehlgeschlagen.";
    }
  };
  $("#authPassword").addEventListener("keydown", e=>{ if(e.key==="Enter") $("#authLogin").click(); });
}
async function initAuth(){
  ensureAuthUI();
  try {
    currentUser = await cloud.currentUser();
  } catch(e) {
    setCloudStatus(false);
    $("#ironAuth").classList.add("open");
    const err = $("#authError");
    if (err) err.textContent = `Appwrite-Verbindung fehlgeschlagen [${e?.code || "NET"}]: ${e?.message || e}`;
    return false;
  }
  if (!currentUser) { $("#ironAuth").classList.add("open"); return false; }
  await afterLogin(); return true;
}
async function afterLogin(){
  setCloudStatus(true);
  await Promise.allSettled([checkPC(), renderTasksScreen(), renderPlansScreen()]);
}
window.ironLogout = async()=>{ await cloud.logout(); location.reload(); };

// ---------- STATUS ----------
function setCloudStatus(ok){
  const el = $("#cloudStatus"); if(!el) return;
  el.textContent = ok ? "ONLINE" : "OFFLINE";
  el.classList.toggle("offline", !ok);
}
function setPCStatus(ok, lastSeen){
  pcOnline = ok; pcLastSeen = lastSeen || null;
  const el = $("#pcStatus") || $(".offline");
  if (!el) return;
  el.textContent = ok ? "ONLINE" : "OFFLINE";
  el.classList.toggle("offline", !ok);
}
async function checkPC(){
  if(!currentUser) return;
  try {
    const row = await cloud.get(cloud.cfg.tables.pcStatus, cloud.cfg.pcStatusRowId);
    const seen = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    const fresh = !!row.online && Date.now()-seen < 45000;
    setPCStatus(fresh,row.last_seen);
  } catch { setPCStatus(false,null); }
}

// ---------- CLOUD DATA ----------
async function createTask(text, datum="Offen"){
  return cloud.create(cloud.cfg.tables.tasks, {
    text, datum, erledigt:false, erstellt:nowISO()
  });
}
async function createPlan(name, inhalt){
  return cloud.create(cloud.cfg.tables.plans, {
    name, inhalt, erstellt:nowISO()
  });
}
async function loadTasks(){ return renderTasksScreen(); }
async function renderTasksScreen(){
  const el=$("#tasksList"); if(!el || !currentUser) return;
  el.innerHTML="<p class='muted'>Lade Cloud-Tasks...</p>";
  try{
    const tasks=await cloud.list(cloud.cfg.tables.tasks,[cloud.Query.orderDesc("$createdAt"), cloud.Query.limit(100)]);
    el.innerHTML=tasks.length?tasks.map(t=>`<article class="data-card task-card screen-task ${t.erledigt?"done":""}">
      <label><input type="checkbox" ${t.erledigt?"checked":""} onchange="toggleTaskAndRefresh('${t.$id}',this.checked)"><span>${escapeHtml(t.text)}</span></label>
      <small>${escapeHtml(t.datum||"Offen")}</small></article>`).join(""):
      `<div class="empty-screen"><div>✓</div><strong>NO TASKS</strong><p>Zum Beispiel: „Erstelle eine Task Zimmer aufräumen.“</p></div>`;
  }catch(e){ el.innerHTML=`<p class='muted'>Cloud-Tasks konnten nicht geladen werden: ${escapeHtml(e.message)}</p>`; }
}
async function toggleTaskAndRefresh(id,done){ await cloud.update(cloud.cfg.tables.tasks,id,{erledigt:done}); renderTasksScreen(); }
async function deleteTask(id){ await cloud.remove(cloud.cfg.tables.tasks,id); renderTasksScreen(); }

async function renderPlans(){ return renderPlansScreen(); }
async function renderPlansScreen(){
  const el=$("#plansList"); if(!el || !currentUser) return;
  el.innerHTML="<p class='muted'>Lade Cloud-Pläne...</p>";
  try{
    const plans=await cloud.list(cloud.cfg.tables.plans,[cloud.Query.orderDesc("$createdAt"), cloud.Query.limit(100)]);
    el.innerHTML=plans.length?plans.map(p=>`<article class="data-card plan-screen-card">
      <div class="data-head"><div><strong>${escapeHtml(p.name||"Plan")}</strong><small>${escapeHtml(p.erstellt||p.$createdAt||"")}</small></div>
      <button onclick="deletePlanAndRefresh('${p.$id}')">×</button></div>
      <div class="plan-cloud-text">${escapeHtml(p.inhalt||"").replace(/\n/g,"<br>")}</div></article>`).join(""):
      `<div class="empty-screen"><div>◫</div><strong>NO PLANS</strong><p>Zum Beispiel: „Erstelle einen Plan für morgen.“</p></div>`;
  }catch(e){el.innerHTML=`<p class='muted'>Cloud-Pläne konnten nicht geladen werden: ${escapeHtml(e.message)}</p>`;}
}
async function deletePlanAndRefresh(id){ await cloud.remove(cloud.cfg.tables.plans,id); renderPlansScreen(); }

// ---------- COMMAND ROUTER ----------
function cleanTaskText(t){
  return t.replace(/^iron[, ]*/i,"")
    .replace(/^(erstelle|erstell|mach)\s+(mir\s+)?(eine[n]?\s+)?(task|aufgabe)\s*(für\s*)?/i,"")
    .trim() || t;
}
function planRequested(t){ return /(erstelle|erstell|mach).{0,15}(plan|tagesplan|wochenplan)/i.test(t); }
function taskRequested(t){ return /(erstelle|erstell|mach).{0,15}(task|aufgabe)/i.test(t); }
function localPCCommand(t){
  return /(öffne|oeffne|starte|schließe|schliesse|bildschirm|desktop|hud|spotify|programm|datei|ordner|zoom|beschreib.*bild|bild.*beschreib)/i.test(t);
}
async function queuePCCommand(t){
  const row=await cloud.create(cloud.cfg.tables.pcCommands,{
    command:t,status:"pending",created_at:nowISO(),result:""
  });
  return row;
}
async function command(t){
  t=(t||"").trim(); if(!t || !currentUser) return;
  if(input) input.value="";
  show("Befehl wird verarbeitet...");
  try{
    if(taskRequested(t)){
      const txt=cleanTaskText(t);
      await createTask(txt,"Offen");
      const a=`Task gespeichert: ${txt}`; show(a); speak(a); renderTasksScreen(); return;
    }
    if(planRequested(t)){
      const name=t.replace(/^iron[, ]*/i,"").slice(0,180);
      await createPlan(name,"Plan wurde über IRON Cloud angelegt. Inhalt kann später von IRON Cloud AI erweitert werden.");
      const a="Plan wurde in Appwrite gespeichert."; show(a); speak(a); renderPlansScreen(); return;
    }
    if(localPCCommand(t)){
      await checkPC();
      if(!pcOnline){
        const a="IRON Cloud ist online, aber dein PC-Agent ist offline. Der PC-Befehl wurde nicht ausgeführt.";
        show(a); speak(a); return;
      }
      await queuePCCommand(t);
      const a="Befehl wurde an deinen PC-Agenten gesendet."; show(a); speak(a); return;
    }
    // Cloud AI fallback: works even when the PC is off.
    show("IRON Cloud denkt...");
    const answer = await cloud.askAI(t);
    show(answer);
    speak(answer);
  }catch(e){ show("Cloud-Fehler: "+(e?.message||e)); }
}

// ---------- UI ----------
const sendBtn=$("#sendBtn"); if(sendBtn&&input) sendBtn.onclick=()=>command(input.value);
if(input) input.onkeydown=e=>{if(e.key==="Enter")command(input.value)};
$$('[data-command]').forEach(x=>x.onclick=()=>command(x.dataset.command));
$$('nav button').forEach(btn=>{
  const label=btn.querySelector('small')?.textContent;
  if(label==='PLANS') btn.onclick=()=>location.href='plans.html';
  if(label==='TASKS') btn.onclick=()=>location.href='task.html';
  if(label==='SETUP') btn.onclick=()=>show(`CLOUD ${cloud.cfg.projectId} // USER ${currentUser?.email||""}`);
});

// Upload is intentionally local-only until Appwrite Storage is configured.
const uploadBtn=$("#uploadBtn"), imageInput=$("#imageInput");
if(uploadBtn&&imageInput) uploadBtn.onclick=()=>imageInput.click();
if(imageInput) imageInput.onchange=e=>{
  const file=e.target.files?.[0]; if(!file)return;
  show(`Bild ${file.name} ausgewählt. Appwrite Storage wird in der nächsten Stufe verbunden.`);
  e.target.value="";
};

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const voiceBtn=$("#voiceBtn"), voiceStatus=$("#voiceStatus");
if(SR&&voiceBtn){
  const r=new SR();r.lang='de-DE';r.continuous=false;r.interimResults=false;
  r.onstart=()=>{voiceBtn.classList.add('listening');if(voiceStatus)voiceStatus.textContent='LISTENING';show('Ich höre zu...')};
  r.onend=()=>{voiceBtn.classList.remove('listening');if(voiceStatus)voiceStatus.textContent='STANDBY'};
  r.onerror=()=>{voiceBtn.classList.remove('listening');if(voiceStatus)voiceStatus.textContent='ERROR';show('Sprache konnte nicht erkannt werden.')};
  r.onresult=e=>command(e.results[0][0].transcript);
  voiceBtn.onclick=()=>{try{r.start()}catch{}};
}else if(voiceBtn){voiceBtn.onclick=()=>show('Sprachsteuerung wird in diesem Browser nicht unterstützt.')}

window.command=command;
window.renderPlansScreen=renderPlansScreen; window.renderTasksScreen=renderTasksScreen;
window.deletePlanAndRefresh=deletePlanAndRefresh; window.toggleTaskAndRefresh=toggleTaskAndRefresh;

initAuth().catch(e=>{
  console.error("IRON startup error", e);
  setCloudStatus(false);
  show("Startfehler: " + (e?.message || e));
});
setInterval(()=>{if(currentUser&&!document.hidden)checkPC()},15000);
