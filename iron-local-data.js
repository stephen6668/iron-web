(() => {
  'use strict';
  const KEY='iron_local_data_connection_v1';
  let settings;try { settings=JSON.parse(localStorage.getItem(KEY)||'null'); } catch {}
  const active=!!(settings?.url&&settings?.token);
  window.IRONLocalDataActive=active;
  async function call(path,method='GET',body){
    const control=new AbortController();const timer=setTimeout(()=>control.abort(),12000);
    try {
      const response=await fetch(settings.url.replace(/\/$/,'')+path,{
        method,cache:'no-store',signal:control.signal,
        headers:{Authorization:'Bearer '+settings.token,...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
      const value=await response.json();
      if(!response.ok) throw new Error(value.error||'PC-Daten HTTP '+response.status);
      return value;
    } catch(e){throw new Error(e.name==='AbortError'?'PC antwortet nicht. IRON und Tailscale prüfen.':e.message||'PC nicht erreichbar');}
    finally{clearTimeout(timer);}
  }
  window.IRONLocalData={test:()=>call('/v1/health')};
  if(active){
    const original=window.IRONCloud;
    const localTables=new Set(['tasks','plans','ideas']);
    const fakeUser={$id:'iron-local-owner',name:'Stephen',email:''};
    const base=original||{
      cfg:{tables:{tasks:'tasks',plans:'plans',ideas:'ideas',pcStatus:'pc_status',pcCommands:'pccommands'},pcStatusRowId:'main_pc'},
      ID:{unique:()=>crypto.randomUUID().replace(/-/g,'')},
      Query:{limit:n=>JSON.stringify({method:'limit',values:[n]}),orderDesc:k=>JSON.stringify({method:'orderDesc',attribute:k}),equal:(k,v)=>JSON.stringify({method:'equal',attribute:k,values:Array.isArray(v)?v:[v]})},
      userRowPermissions:()=>undefined,
      currentUser:async()=>null,
      login:async()=>{throw new Error('Appwrite-Anmeldung für Cloud-Funktionen derzeit nicht verfügbar');},
      logout:async()=>{},askAI:async()=>{throw new Error('Cloud-KI benötigt weiterhin ihre bisherige Verbindung');}
    };
    const fallback=(name,...args)=>{if(typeof base[name]!=='function')throw new Error('Cloud-Funktion nicht verfügbar');return base[name](...args);};
    window.IRONCloud=Object.freeze({...base,
      async currentUser(){
        if(/\/(task|plans|einkaufsliste|ideen)\.html$/.test(location.pathname))return fakeUser;
        try{return await base.currentUser()||fakeUser;}catch{return fakeUser;}
      },
      async list(table,queries=[]){
        if(!localTables.has(table))return fallback('list',table,queries);
        let rows=(await call('/v1/rows/'+table)).rows;
        for(const raw of queries){
          let q;try{q=typeof raw==='string'?JSON.parse(raw):raw;}catch{continue;}
          if(q?.method==='equal')rows=rows.filter(r=>(q.values||[]).includes(r[q.attribute]));
          if(q?.method==='notEqual')rows=rows.filter(r=>!(q.values||[]).includes(r[q.attribute]));
          if(q?.method==='orderDesc')rows.sort((a,b)=>String(b[q.attribute]||'').localeCompare(String(a[q.attribute]||'')));
          if(q?.method==='orderAsc')rows.sort((a,b)=>String(a[q.attribute]||'').localeCompare(String(b[q.attribute]||'')));
        }
        const limit=queries.map(raw=>{try{return typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}}).find(q=>q?.method==='limit');
        return limit?rows.slice(0,limit.values[0]):rows;
      },
      create:(table,data,id,permissions)=>localTables.has(table)?call('/v1/rows/'+table,'POST',{id:id||base.ID.unique(),data}):fallback('create',table,data,id,permissions),
      update:(table,id,data)=>localTables.has(table)?call('/v1/rows/'+table+'/'+encodeURIComponent(id),'PATCH',data):fallback('update',table,id,data),
      remove:(table,id)=>localTables.has(table)?call('/v1/rows/'+table+'/'+encodeURIComponent(id),'DELETE'):fallback('remove',table,id),
      get:(table,id)=>localTables.has(table)?call('/v1/rows/'+table+'/'+encodeURIComponent(id)):fallback('get',table,id)
    });
    window.IRON_APPWRITE_READY=true;
    // Refresh visible lists; edits remain in their existing forms.
    setInterval(()=>{
      if(document.hidden)return;
      for(const name of ['renderTasksScreen','renderPlansScreen','renderShoppingScreen'])
        if(typeof window[name]==='function') window[name]().catch(()=>{});
    },5000);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const link=document.createElement('a');link.href='datenverbindung.html';link.textContent=active?'PC-Daten verbunden':'Datenverbindung';
    link.style.cssText='position:fixed;bottom:12px;right:12px;z-index:10001;background:#081a26;color:#7eeaff;padding:9px 12px;border:1px solid #286575;border-radius:10px;font:12px sans-serif;text-decoration:none';
    document.body.appendChild(link);
  });
})();
