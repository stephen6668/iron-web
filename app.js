const $=s=>document.querySelector(s),response=$("#response"),input=$("#commandInput");
function command(t){t=(t||"").trim();if(!t)return;response.textContent="IRON // Befehl empfangen: "+t;input.value=""}
$("#sendBtn").onclick=()=>command(input.value);
input.onkeydown=e=>{if(e.key==="Enter")command(input.value)};
document.querySelectorAll("[data-command]").forEach(x=>x.onclick=()=>command(x.dataset.command));
$("#uploadBtn").onclick=()=>$("#imageInput").click();
$("#imageInput").onchange=e=>{if(e.target.files[0])response.textContent="IRON // Bild ausgewählt: "+e.target.files[0].name};

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
 const r=new SR();r.lang="de-DE";r.continuous=false;r.interimResults=false;
 r.onstart=()=>{$("#voiceBtn").classList.add("listening");$("#voiceStatus").textContent="LISTENING";response.textContent="IRON // Ich höre zu..."};
 r.onend=()=>{$("#voiceBtn").classList.remove("listening");$("#voiceStatus").textContent="STANDBY"};
 r.onerror=()=>{response.textContent="IRON // Sprache konnte nicht erkannt werden"};
 r.onresult=e=>command(e.results[0][0].transcript);
 $("#voiceBtn").onclick=()=>r.start();
}else $("#voiceBtn").onclick=()=>response.textContent="IRON // Sprachsteuerung wird in diesem Browser nicht unterstützt.";
