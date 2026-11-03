import {createServer} from 'node:http';
import {timingSafeEqual, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createStore} from './store.mjs';
import {createAssistant} from './assistant.mjs';
import {resolveAI} from './ai-provider.mjs';
import {createWebResearch} from './research.mjs';
import {createDocumentAnalyzer,readUpload} from './documents.mjs';
import {fail, object, text, identifier, rowData} from './validation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = new Set(['index.html','auftraege.html','begleiter.html','datenverbindung.html','diagnostics.html','dokumente.html','einkaufsliste.html','gedaechtnis.html','hud.html','ideen.html','kalender.html','mails.html','photos.html','plans.html','sms.html','task.html','world.html','app.js','ideen.js','iron-appwrite.js','iron-local-data.js','iron-menu.js','iron-pc-panels.js','iron-photos-local.js','iron-web-live.js','sms-web.js','web-bridge.js','style.css','iron-web-polish.css','iron-conversation.js','iron-mobile.css','iron-jarvis.css','iron-home.css','connection-settings.js','manual-data.js','diagnostics.js','icon.svg','manifest.webmanifest']);
const MIME = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const SAFE_TABLES = ['tasks','plans','ideas','calendar','pccommands','pc_status'];
const stamp = () => new Date().toISOString();

async function readJSON(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>1024*1024) throw fail('Anfrage zu groß (maximal 1 MB).',413);
    chunks.push(chunk);
  }
  try {return object(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
  catch(error) {if(error.status) throw error; throw fail('Ungültige JSON-Anfrage.');}
}
const noMeta = row => Object.fromEntries(Object.entries(row).filter(([key])=>!key.startsWith('$')));
const tokenMatches = (provided, expected) => {
  const a=Buffer.from(provided),b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
};

export async function createIronServer(options={}) {
  const token=options.token ?? process.env.IRON_ACCESS_TOKEN ?? '';
  if(token.length<32 || token.length>512 || !/^[\x21-\x7e]+$/.test(token)) throw Error('IRON_ACCESS_TOKEN muss aus mindestens 32 zufälligen druckbaren Zeichen bestehen.');
  const allowedOrigins=new Set(options.allowedOrigins ?? (process.env.IRON_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
  for(const origin of allowedOrigins) {const url=new URL(origin);if(url.origin!==origin || !['http:','https:'].includes(url.protocol))throw Error('IRON_ALLOWED_ORIGINS: exakte HTTP(S)-Origins erforderlich.');}
  const store=options.store ?? await createStore(resolve(options.dataDir ?? process.env.IRON_DATA_DIR ?? join(ROOT,'data')));
  const ai=resolveAI(options),{apiKey,model, name:provider}=ai;
  const fetchImpl=options.fetchImpl ?? fetch;
  const news=options.news ?? (async country => (await import('./news.mjs')).getNews(country,{fetch:fetchImpl}));
  const research=provider==='gemini'&&apiKey?createWebResearch({apiKey,model,fetchImpl}):undefined;
  const chat=createAssistant({store,fetchImpl,news,research,apiKey,model,provider});
  const analyzeDocument=createDocumentAnalyzer({store,apiKey,fetchImpl,model,provider});
  // Limit expensive requests globally for this single-owner instance. Do not trust forwarded IP headers.
  const hits=[];
  function expensive() {const cutoff=Date.now()-60000;while(hits[0]<cutoff)hits.shift();if(hits.length>=12)throw fail('Zu viele Anfragen. Bitte in einer Minute erneut versuchen.',429);hits.push(Date.now());}
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin;
    const common={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(self)','Cache-Control':'no-store'};
    if(origin && allowedOrigins.has(origin)) Object.assign(common,{'Access-Control-Allow-Origin':origin,'Vary':'Origin'});
    const json=(status,payload)=>{res.writeHead(status,{...common,'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify(payload));};
    try {
      const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
      if(!path.startsWith('/v1/')) {
        if(!['GET','HEAD'].includes(req.method))throw fail('Methode nicht erlaubt.',405);
        const asset=path==='/'?'index.html':path.slice(1);
        if(!ASSETS.has(asset))throw fail('Nicht gefunden.',404);
        let data;try{data=await readFile(join(ROOT,asset));}catch{throw fail('Nicht gefunden.',404);}
        res.writeHead(200,{...common,'Content-Type':MIME[asset.split('.').pop()]||'application/octet-stream'});
        res.end(req.method==='HEAD'?undefined:data);return;
      }
      if(origin && !allowedOrigins.has(origin)) throw fail('Diese Website ist nicht freigegeben. IRON_ALLOWED_ORIGINS prüfen.',403);
      if(req.method==='OPTIONS') {
        res.writeHead(204,{...common,'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'});res.end();return;
      }
      const auth=req.headers.authorization||'';
      if(!auth.startsWith('Bearer ') || !tokenMatches(auth.slice(7),token))throw fail('Verbindungsschlüssel fehlt oder ist ungültig.',401);
      if(path==='/v1/health' && req.method==='GET')return json(200,{ok:true,service:'IRON Cloud',version:'25.0.0',ai_configured:!!apiKey,ai_provider:provider,ai_model:model,capabilities:{ai:!!apiKey,research:!!research,news:true,tasks:true,plans:true,ideas:true,calendar:true,memory:true,sport:true,documents:!!apiKey,mails:false,sms:false,pc:false},storage:'persistent-json',external_connections:{mails:false,sms:false}});
      if(path==='/v1/assistant' && req.method==='GET'){
        const s=store.read();return json(200,{ok:true,service:'IRON Cloud',version:'25.0.0',runtime:{activity:'ready'},capabilities:{ai:!!apiKey,research:!!research,documents:!!apiKey,mails:false,pc:false},tasks:Object.values(s.rows.tasks),plans:Object.values(s.rows.plans),ideas:Object.values(s.rows.ideas),cache_time:null,mails:[],calendar:Object.values(s.rows.calendar),sport:{entries:s.sport,streak:0},personal:{memories:s.memories,companion:{...s.companion,resume:[s.companion.next_step,s.companion.decision].filter(Boolean).join('\n'),routines:[],runs:[],steps:{}},executive:{document:s.document||{status:'Noch keine Textdatei analysiert.'}}},integrations:{mails:{connected:false},sms:{connected:false},calendar:{provider:'iron',connected:true}}});
      }
      if(path==='/v1/world-news' && req.method==='GET'){expensive();const result=await news(text(url.searchParams.get('country')||'World','Land',100));return json(result.ok?200:502,result);}
      if(path==='/v1/chat' && req.method==='POST'){expensive();return json(200,await chat(await readJSON(req)));}
      if(path==='/v1/documents'&&req.method==='POST'){expensive();const bytes=await readUpload(req);return json(200,await analyzeDocument(url.searchParams.get('name'),url.searchParams.get('question'),bytes));}
      if(path==='/v1/assistant/actions' && req.method==='POST'){
        const {module,data}=await readJSON(req);object(data);
        if(module==='news'){
          expensive();const country=text(data.country||'World','Land',100),result=await news(country);
          if(!result.ok)return json(502,result);
          const articles=result.articles.slice(0,10);
          // Extractive only: feed text cannot instruct the personal-data assistant to write records.
          return json(200,{...result,country,summary:`${articles.length} von ${result.articles.length} geladenen Schlagzeilen (keine Volltextanalyse):\n`+articles.map(a=>`${a.source}: ${a.title}${a.published?' ('+a.published+')':''}\n${a.url}`).join('\n\n')});
        }
        const result=await store.mutate(s=>{
          if(module==='personal'){
            if(data.action==='memory_save'){
              const value=text(data.value,'Erinnerung',2000),key=data.key?identifier(data.key):randomUUID();
              const existing=s.memories.find(m=>m.key===key),entry={key,value,source:'Nutzereingabe',quote:value,verification:'Vom Nutzer gespeichert',updated_at:stamp()};
              if(existing)Object.assign(existing,entry);else {if(s.memories.length>=500)throw fail('Maximal 500 Erinnerungen.',413);s.memories.push(entry);}return {ok:true,memory:entry};
            }
            if(data.action==='memory_delete'){const key=identifier(data.key);s.memories=s.memories.filter(m=>m.key!==key);s.history=[];return {ok:true};}
          }
          if(module==='companion' && data.action==='notes') {s.companion.next_step=text(data.next_step??'','Nächster Schritt',5000,false);s.companion.decision=text(data.decision??'','Entscheidung',5000,false);return {ok:true};}
          if(module==='sport'){
            if(data.action==='delete'){const id=identifier(data.id);s.sport=s.sport.filter(e=>e.id!==id);return {ok:true};}
            if(data.action==='add'){
              const requestId=identifier(data.request_id),fingerprint=JSON.stringify(data);
              if(Object.hasOwn(s.actionRequests,requestId)){const prior=s.actionRequests[requestId];if(prior.fingerprint!==fingerprint)throw fail('Auftragskennung wurde schon anders verwendet.',409);return prior.result;}
              const date=text(data.date,'Datum',10),type=text(data.type,'Sportart',100),notes=text(data.notes??'','Notiz',3000,false),minutes=data.minutes;
              if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!Number.isInteger(minutes)||minutes<0||minutes>1440)throw fail('Datum oder Sportdauer ist ungültig.');
              if(s.sport.length>=2000)throw fail('Maximal 2000 Sporteinträge.',413);
              const entry={id:randomUUID(),date,type,notes,minutes};s.sport.push(entry);const result={ok:true,entry};s.actionRequests[requestId]={fingerprint,result};return result;
            }
          }
          throw fail('Diese Aktion ist im Cloud-Betrieb nicht verfügbar.',501);
        });return json(200,result);
      }
      const match=path.match(/^\/v1\/rows\/([a-z_]+)(?:\/([^/]+))?$/);
      if(match){
        const [,table,rawId]=match,id=rawId?identifier(rawId):null;
        if(!SAFE_TABLES.includes(table))throw fail('Unbekannte Tabelle.',404);
        if(table==='pc_status'){
          if(req.method!=='GET')throw fail('PC-Status ist nur lesbar.',405);
          const row={$id:'main_pc',online:false,last_seen:null,mode:'cloud'};return json(200,id?row:{ok:true,rows:[row]});
        }
        if(req.method==='GET'){const rows=store.read().rows[table];if(id){if(!Object.hasOwn(rows,id))throw fail('Eintrag nicht gefunden.',404);return json(200,rows[id]);}return json(200,{ok:true,rows:Object.values(rows)});}
        if(table==='pccommands')throw fail('PC-Aufträge werden hier nur angezeigt. Cloud-Chat über /v1/chat starten.',405);
        if(req.method==='POST' && !id){
          const body=await readJSON(req),key=body.id?identifier(body.id):randomUUID(),data=rowData(table,body.data);
          return json(201,await store.mutate(s=>{if(Object.hasOwn(s.rows[table],key))throw fail('Kennung existiert bereits.',409);if(Object.keys(s.rows[table]).length>=1000)throw fail('Maximal 1000 Einträge pro Tabelle.',413);const row={...data,$id:key,$createdAt:stamp(),$updatedAt:stamp()};s.rows[table][key]=row;return row;}));
        }
        if(req.method==='PATCH' && id){const patch=await readJSON(req);return json(200,await store.mutate(s=>{if(!Object.hasOwn(s.rows[table],id))throw fail('Eintrag nicht gefunden.',404);const row=s.rows[table][id],data=rowData(table,{...noMeta(row),...patch});Object.assign(row,data,{$updatedAt:stamp()});return row;}));}
        if(req.method==='DELETE' && id)return json(200,await store.mutate(s=>{if(!Object.hasOwn(s.rows[table],id))throw fail('Eintrag nicht gefunden.',404);delete s.rows[table][id];return {ok:true};}));
      }
      throw fail('Route oder Methode nicht verfügbar.',404);
    }catch(error){const status=Number.isInteger(error.status)?error.status:500;json(status,{ok:false,error:status===500?'Interner Serverfehler. Serverprotokoll prüfen.':error.message});if(status===500)console.error('[IRON] Request failed:',error.message);}
  });
  server.requestTimeout=125000;
  server.headersTimeout=15000;
  return {server,store};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger PORT.');
  const {server}=await createIronServer();server.listen(port,host,()=>console.log(`IRON Cloud hört auf Port ${port}. HTTPS vor den Server schalten; persistentes Datenverzeichnis sichern.`));
}
