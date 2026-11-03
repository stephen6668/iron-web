(() => {
  document.getElementById('test').onclick=async()=>{
    const out=document.getElementById('result');out.textContent='Prüfung läuft …';
    try{
      const health=await window.IRONLocalData.test(),state=await window.IRONLocalData.state();
      out.textContent=window.IRONBackendName+' erreichbar · Schnittstelle '+health.version+'\nAufgaben: '+(state.tasks?.length||0)+' · Pläne: '+(state.plans?.length||0)+' · Ideen: '+(state.ideas?.length||0)+(window.IRONConnectionMode==='cloud'?'\nKI: '+(health.ai_configured?'Zugang konfiguriert ('+(health.ai_provider||'KI')+' · '+(health.ai_model||'Modell')+'); Anbieterzugriff hier nicht getestet.':'KI-Zugang auf dem Server noch nicht eingerichtet.')+'\nWebrecherche: '+(health.capabilities?.research?'Mit Google-Suche eingerichtet; echte Recherche hier nicht getestet.':'Für diesen Anbieter nicht eingerichtet.')+'\nMailkonto und externer Kalender: noch nicht verbunden.':'');
    }catch(e){out.textContent=e.message;}
  };
})();
