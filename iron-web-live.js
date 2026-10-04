(()=>{'use strict';document.addEventListener('DOMContentLoaded',()=>{
 const badge=document.createElement('a');badge.className='connection-badge';badge.href='datenverbindung.html';badge.textContent=window.IRONLocalDataActive?'PC-Verbindung prüfen':'PC verbinden';document.body.append(badge);
 const routes={newsBtn:'world.html',gmailBtn:'mails.html',uploadBtn:'dokumente.html'};
 for(const [id,url]of Object.entries(routes))document.getElementById(id)?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href=url;},true);
 let busy=false;
 async function tick(){if(busy||document.hidden||!window.IRONLocalDataActive)return;busy=true;try{
  const data=await window.IRONLocalData.state();badge.textContent='PC verbunden';const mode=data.runtime?.activity||'ready';document.body.dataset.ironActivity=mode;
  const label=document.getElementById('speechStatus');if(label&&mode!=='ready')label.textContent={speaking:'IRON SPRICHT',listening:'HÖRT ZU',thinking:'DENKT',paused:'MIKROFON PAUSIERT'}[mode]||mode;
  const list=document.getElementById('hudNews');if(list){list.replaceChildren();for(const m of (data.mails||[]).slice(0,3)){const p=document.createElement('p');p.textContent=m.betreff||m.subject||'Mail';list.append(p);}}
  if(!document.activeElement?.matches('input,textarea,select'))for(const name of ['renderTasksScreen','renderPlansScreen','renderShoppingScreen'])if(typeof window[name]==='function')window[name]().catch(()=>{});
 }catch{badge.textContent='PC nicht erreichbar';}finally{busy=false;}}
 tick();setInterval(tick,5000);
});})();
