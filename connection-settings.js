(() => {
  'use strict';
  const mode=document.getElementById('mode'),url=document.getElementById('url'),token=document.getElementById('token'),status=document.getElementById('status'),remember=document.getElementById('remember');
  const keys={cloud:'iron_cloud_connection_v1',pc:'iron_local_data_connection_v1'};
  const read=(store,key)=>{try{return JSON.parse(store.getItem(key)||'null');}catch{return null;}};
  mode.value=window.IRONConnectionMode==='pc'?'pc':'cloud';
  function load(){
    const persisted=read(localStorage,keys[mode.value]),old=read(sessionStorage,keys[mode.value])||persisted;
    url.value=old?.url||(!location.hostname.endsWith('github.io')?location.origin:'');token.value=old?.token||'';remember.checked=!!persisted;
    document.getElementById('modeHelp').textContent=mode.value==='cloud'?'Cloud-Server mit dauerhaftem Speicher erforderlich. Kein eingeschalteter PC und kein Tailscale nötig.':'IRON und Tailscale müssen auf dem PC laufen. Die bisherigen PC-Daten bleiben dort.';
  }
  mode.onchange=load;load();
  document.getElementById('connectionForm').onsubmit=async event=>{
    event.preventDefault();status.textContent='Verbindung wird geprüft …';const save=document.getElementById('save');save.disabled=true;
    try{
      const target=new URL(url.value.trim());
      if(target.protocol!=='https:'&&!(target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname)))throw Error('Bitte eine HTTPS-Adresse verwenden.');
      if(target.username||target.password||target.search||target.hash||target.pathname!=='/')throw Error('Nur die Server-Adresse ohne Pfad eingeben.');
      if(token.value.trim().length<32)throw Error('Der vollständige Verbindungsschlüssel fehlt.');
      const chosen=mode.value,settings={url:target.origin,token:token.value.trim()};
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let response;
      try{response=await fetch(target.origin+'/v1/health',{cache:'no-store',headers:{Authorization:'Bearer '+settings.token},signal:controller.signal});}finally{clearTimeout(timer);}
      const data=await response.json();
      if(!response.ok||!data.ok||data.service!==(chosen==='cloud'?'IRON Cloud':'IRON Local Data'))throw Error(data.error||'Der Server passt nicht zur gewählten Betriebsart.');
      localStorage.setItem('iron_connection_mode',chosen);
      // Existing PC clients expect persistent pairing; cloud defaults to a session.
      if(chosen==='pc'||remember.checked){localStorage.setItem(keys[chosen],JSON.stringify(settings));sessionStorage.removeItem(keys[chosen]);}
      else{sessionStorage.setItem(keys[chosen],JSON.stringify(settings));localStorage.removeItem(keys[chosen]);}
      status.textContent=(chosen==='cloud'?'Cloud verbunden. Dein PC kann ausgeschaltet bleiben.':'PC verbunden.')+(chosen==='cloud'&&!data.ai_configured?' KI noch nicht eingerichtet: Der KI-Zugang muss auf deinem Server aktiviert werden. Listen und Nachrichten sind unabhängig davon nutzbar.':'')+' Öffne anschließend den gewünschten Bildschirm neu.';
    }catch(e){status.textContent='Nicht verbunden: '+(e.name==='AbortError'?'Server nicht erreichbar. Adresse und Hosting prüfen.':e.message);}finally{save.disabled=false;}
  };
  document.getElementById('disable').onclick=()=>{localStorage.removeItem(keys[mode.value]);sessionStorage.removeItem(keys[mode.value]);token.value='';status.textContent='Verbindung getrennt. Deine gespeicherten Daten auf dem Server oder PC bleiben erhalten.';};
})();
