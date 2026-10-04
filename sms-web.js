(() => {
 const $=s=>document.querySelector(s),cloud=window.IRONCloud;
 const status=(message)=>{$('#smsStatus').textContent=String(message);};
 let pendingId=sessionStorage.getItem('ironSmsPendingId')||'',pollTimer=null;
 async function api(path,payload={}){
  if(!window.IRONLocalDataActive)throw new Error('Unter Datenverbindung deinen PC verbinden. Appwrite-SMS ist entfernt.');
  if(path==='web-queue'){
    const raw=new TextEncoder().encode(payload.message);
    let binary='';for(const byte of raw)binary+=String.fromCharCode(byte);
    const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const key=crypto.randomUUID().replace(/-/g,'');pendingId=key;sessionStorage.setItem('ironSmsPendingId',key);const row=await cloud.create('pccommands',{command:`SMS::1::${payload.number}::${encoded}`,status:'pending'},key);
    return {ok:true,row_id:row.$id};
  }
  if(path==='status'){
    const row=await cloud.get('pccommands',payload.id);
    return {ok:true,status:row.status==='done'?'sms_submitted':row.status==='error'?'sms_failed':'sms_sending',error:row.result};
  }
  throw new Error('SMS-Aktion nicht verfügbar.');
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
    if(d.status==='sms_submitted'){status('An SMSGate übergeben. Versand und Zustellung hier noch unbestätigt; den PC-Versandstatus prüfen.');clearInterval(pollTimer);pollTimer=null;pendingId='';sessionStorage.removeItem('ironSmsPendingId');}
    else if(d.status==='sms_sent'){status('Android hat den SMS-Versand bestätigt. Ob sie beim Empfänger angekommen ist, steht noch aus.');clearInterval(pollTimer);pollTimer=null;pendingId='';sessionStorage.removeItem('ironSmsPendingId');}
    else if(d.status==='sms_failed'){status('SMS wurde nicht versendet: '+(d.error||'Android meldete einen Fehler.'));clearInterval(pollTimer);pollTimer=null;pendingId='';sessionStorage.removeItem('ironSmsPendingId');}
    else if(d.status==='sms_sending')status('PC bearbeitet die SMS. Eine Mobilfunk-Versandbestätigung ist hier nicht verfügbar.');
    else status('SMS wartet auf Verarbeitung am PC.');
   }
   try{
    const pc=await cloud.get(cloud.cfg.tables.pcStatus,cloud.cfg.pcStatusRowId);
    $('#smsPcStatus').textContent='PC: '+(pc?.online?'ONLINE':'OFFLINE')+' · PC muss eingeschaltet und SMSGate eingerichtet sein.';
   }catch{$('#smsPcStatus').textContent='PC: Status derzeit nicht verfügbar. Web-SMS benötigt den verbundenen PC.';}
  }catch(e){if(pendingId)status('Status gerade nicht verfügbar: '+String(e.message||e));}
 }
 $('#smsQueue').onclick=async()=>{
  try{
   const data=values();
   if(!confirm(`SMS an ${data.number} über SMSGate senden? Es gilt die am PC eingerichtete SMSGate-SIM.`))return;
   $('#smsQueue').disabled=true;status('IRON übermittelt die Nachricht an deinen PC…');
   const reply=await api('web-queue',data);
   pendingId=reply.row_id;sessionStorage.setItem('ironSmsPendingId',pendingId);
   status('SMS wartet auf Android. SMSGate muss auf deinem Android-Handy laufen.');
   if(pollTimer)clearInterval(pollTimer);
   pollTimer=setInterval(refresh,4500);
  }catch(e){status('SMS nicht übermittelt: '+String(e.message||e));}
  finally{$('#smsQueue').disabled=!!pendingId;}
 };
 $('#smsRefresh').onclick=async()=>{await refresh();$('#smsQueue').disabled=!!pendingId;};
 if(pendingId)$('#smsQueue').disabled=true;
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
