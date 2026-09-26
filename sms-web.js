(() => {
 const $=s=>document.querySelector(s),cloud=window.IRONCloud;
 const status=(message)=>{$('#smsStatus').textContent=String(message);};
 let pendingId=sessionStorage.getItem('ironSmsPendingId')||'',pollTimer=null;
 async function api(path,payload={}){
  const user=await cloud?.currentUser();
  if(!user)throw new Error('Bitte bei IRON anmelden.');
  const jwt=await cloud.account.createJWT();
  const r=await fetch(cloud.cfg.functionDomain+'/api/sms/'+path,{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload,userJwt:jwt.jwt})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||'IRON Cloud SMS HTTP '+r.status);
  return d;
 }
 const values=()=>{
  const number=$('#smsNumber').value.trim().replace(/[\s()-]/g,''),message=$('#smsMessage').value.trim(),slot=Number($('#smsSlot').value);
  if(!/^\+?\d{5,18}$/.test(number)||!message||message.length>500)throw new Error('Bitte Nummer und SMS-Text (maximal 500 Zeichen) prüfen.');
  return {number,message,slot};
 };
 try{
  const draft=JSON.parse(sessionStorage.getItem('ironSmsDraft')||'null');
  if(draft?.number)$('#smsNumber').value=String(draft.number).slice(0,24);
  if(draft?.message)$('#smsMessage').value=String(draft.message).slice(0,500);
 }catch{}finally{sessionStorage.removeItem('ironSmsDraft')}
 async function refresh(){
  try{
   if(pendingId){
    const d=await api('status',{id:pendingId});
    if(d.status==='sms_sent'){status('Android hat den SMS-Versand bestätigt. Ob sie beim Empfänger angekommen ist, steht noch aus.');clearInterval(pollTimer);pollTimer=null;pendingId='';sessionStorage.removeItem('ironSmsPendingId');}
    else if(d.status==='sms_failed'){status('SMS wurde nicht versendet: '+(d.error||'Android meldete einen Fehler.'));clearInterval(pollTimer);pollTimer=null;pendingId='';sessionStorage.removeItem('ironSmsPendingId');}
    else if(d.status==='sms_sending')status('Android bearbeitet die SMS. Warte auf die Versandbestätigung.');
    else status('SMS wartet auf Android. Öffne die IRON-App mit dem gleichen Konto.');
   }
   try{
    const pc=await cloud.get(cloud.cfg.tables.pcStatus,cloud.cfg.pcStatusRowId);
    $('#smsPcStatus').textContent='PC-Agent: '+(pc?.online?'ONLINE':'OFFLINE')+' · Web-SMS funktioniert auch ohne eingeschalteten PC.';
   }catch{$('#smsPcStatus').textContent='PC-Agent: Status derzeit nicht verfügbar. Web-SMS braucht nur die Android-App.';}
  }catch(e){if(pendingId)status('Status gerade nicht verfügbar: '+String(e.message||e));}
 }
 $('#smsQueue').onclick=async()=>{
  try{
   const data=values();
   if(!confirm(`SMS an ${data.number} über SIM ${data.slot} auf deinem Android-Telefon senden?`))return;
   $('#smsQueue').disabled=true;status('IRON übermittelt die Nachricht an dein Android-Telefon…');
   const reply=await api('web-queue',data);
   pendingId=reply.row_id;sessionStorage.setItem('ironSmsPendingId',pendingId);
   status('SMS wartet auf Android. Öffne die IRON-App mit demselben Konto.');
   if(pollTimer)clearInterval(pollTimer);
   pollTimer=setInterval(refresh,4500);
  }catch(e){status('SMS nicht übermittelt: '+String(e.message||e));}
  finally{$('#smsQueue').disabled=false;}
 };
 $('#smsRefresh').onclick=refresh;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 $('#smsVoice').onclick=()=>{
  if(!Speech){status('Browser-Spracherkennung nicht verfügbar. Bitte Text eintippen.');return;}
  const recognition=new Speech();recognition.lang='de-DE';recognition.interimResults=false;
  recognition.onresult=e=>{$('#smsMessage').value=(e.results?.[0]?.[0]?.transcript||'').slice(0,500);status('Text erkannt. Nummer und Text prüfen und dann „SMS über Android senden“ drücken.');};
  recognition.onerror=e=>status('Diktat fehlgeschlagen: '+e.error);
  try{recognition.start();status('Ich höre zu…');}catch(e){status('Mikrofon: '+e.message);}
 };
 if(pendingId)pollTimer=setInterval(refresh,4500);
 refresh();
})();
