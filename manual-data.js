/* Manual entry remains available even before an AI provider is configured. */
(() => {
  'use strict';
  const form=document.getElementById('manualDataForm');if(!form)return;
  form.onsubmit=async event=>{
    event.preventDefault();const button=event.submitter,notice=document.getElementById('manualNotice');button.disabled=true;notice.textContent='Wird gespeichert …';
    try{
      const title=document.getElementById('manualTitle').value.trim();
      if(!title)throw Error('Bitte einen Titel eingeben.');
      if(form.dataset.table==='tasks')await window.IRONCloud.create('tasks',{text:title,datum:document.getElementById('manualDate').value||'Offen',erledigt:false,erstellt:new Date().toISOString()});
      else{
        const content=document.getElementById('manualContent').value.trim();if(!content)throw Error('Bitte einen Inhalt eingeben.');
        await window.IRONCloud.create('plans',{name:(form.dataset.kind==='shopping'?'EINKAUF // ':'')+title,inhalt:content,typ:form.dataset.kind==='shopping'?'einkauf':'plan',erstellt:new Date().toISOString()});
      }
      form.reset();notice.textContent='Gespeichert.';
      await Promise.allSettled(['renderTasksScreen','renderPlansScreen','renderShoppingScreen'].map(name=>window[name]?.()));
    }catch(e){notice.textContent='Nicht gespeichert: '+e.message;}finally{button.disabled=false;}
  };
})();
