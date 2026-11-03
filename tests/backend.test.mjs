import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createIronServer} from '../server/index.mjs';
import {createStore} from '../server/store.mjs';
const token='t'.repeat(64),origin='https://iron.example';
async function setup(t,extra={}) {
  const dir=await mkdtemp(join(tmpdir(),'iron-api-'));
  const instance=await createIronServer({token,allowedOrigins:[origin],dataDir:dir,...extra});
  instance.server.listen(0,'127.0.0.1');await once(instance.server,'listening');
  const base='http://127.0.0.1:'+instance.server.address().port;
  const request=async(path,method='GET',data,headers={})=>{const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});let body;try{body=await res.json();}catch{body=null;}return {res,body};};
  t.after(async()=>{instance.server.closeAllConnections();await new Promise(r=>instance.server.close(r));await rm(dir,{recursive:true,force:true});});
  return {...instance,base,dir,request};
}

test('private API requires token, rejects foreign origins, and permits approved preflight',async t=>{
  const {request,base}=await setup(t);
  assert.equal((await request('/v1/health','GET',null,{Authorization:''})).res.status,401);
  assert.equal((await request('/v1/health','GET',null,{Origin:'https://evil.example'})).res.status,403);
  const pre=await fetch(base+'/v1/chat',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization'}});
  assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);
  const health=await request('/v1/health');assert.equal(health.body.service,'IRON Cloud');assert.equal(health.body.ai_configured,false);assert.equal(health.body.capabilities.ai,false);
  assert.equal((await request('/v1/rows/pc_status/main_pc')).body.online,false);
});

test('static allowlist exposes UI while refusing configuration, server and traversal paths',async t=>{
  const {base}=await setup(t);
  assert.equal((await fetch(base+'/index.html')).status,200);
  for(const path of ['/.env','/server/index.mjs','/.git/config','/package.json','/tests/backend.test.mjs','/data/iron-data.json','/%2e%2e%2f.env'])assert.equal((await fetch(base+path)).status,404,path);
});

test('CRUD persists, merges partial PATCH, rejects unsafe IDs/fields and supports concurrent writes',async t=>{
  const {request,dir}=await setup(t);
  const saved=await request('/v1/rows/tasks','POST',{id:'task1',data:{text:'Einkaufen'}});
  assert.equal(saved.res.status,201);
  const patched=await request('/v1/rows/tasks/task1','PATCH',{erledigt:true});assert.equal(patched.body.text,'Einkaufen');assert.equal(patched.body.erledigt,true);
  assert.equal((await request('/v1/rows/tasks','POST',{id:'task1',data:{text:'Doppelt'}})).res.status,409);
  assert.equal((await request('/v1/rows/tasks','POST',{id:'constructor',data:{text:'Nein'}})).res.status,400);
  assert.equal((await request('/v1/rows/tasks/task1','PATCH',{$id:'override'})).res.status,400);
  assert.equal((await request('/v1/rows/pccommands','POST',{data:{command:'danger'}})).res.status,405);
  await Promise.all(Array.from({length:10},(_,i)=>request('/v1/rows/tasks','POST',{id:'parallel'+i,data:{text:'Aufgabe '+i}})));
  const persisted=await createStore(dir);assert.equal(Object.keys(persisted.read().rows.tasks).length,11);assert.equal(persisted.read().rows.tasks.task1.erledigt,true);
  await request('/v1/rows/tasks/task1','DELETE');assert.equal((await request('/v1/rows/tasks/task1')).res.status,404);
});

test('calendar, memories, notes and sport work without provider credentials; sport replay is idempotent',async t=>{
  const {request}=await setup(t);
  const calendar={summary:'Besprechung',start:{dateTime:'2026-11-04T10:00:00+01:00'},end:{dateTime:'2026-11-04T11:00:00+01:00'}};
  assert.equal((await request('/v1/rows/calendar','POST',{data:calendar})).res.status,201);
  assert.equal((await request('/v1/rows/calendar','POST',{data:{...calendar,end:calendar.start}})).res.status,400);
  await request('/v1/assistant/actions','POST',{module:'personal',data:{action:'memory_save',key:'memory1',value:'Ich wohne in Luxemburg.'}});
  await request('/v1/assistant/actions','POST',{module:'companion',data:{action:'notes',next_step:'Anrufen',decision:'Morgen'}});
  const action={module:'sport',data:{action:'add',request_id:'sport1',date:'2026-11-03',type:'Laufen',minutes:30,notes:''}};
  assert.equal((await request('/v1/assistant/actions','POST',action)).res.status,200);
  await request('/v1/assistant/actions','POST',action);
  const state=(await request('/v1/assistant')).body;
  assert.equal(state.capabilities.ai,false);assert.deepEqual(state.tasks,[]);assert.deepEqual(state.plans,[]);assert.deepEqual(state.ideas,[]);assert.equal(state.sport.entries.length,1);assert.equal(state.personal.memories[0].key,'memory1');assert.equal(state.calendar.length,1);assert.equal(state.personal.companion.next_step,'Anrufen');
  const modified={...action,data:{...action.data,minutes:40}};assert.equal((await request('/v1/assistant/actions','POST',modified)).res.status,409);
  assert.equal((await request('/v1/documents?name=notiz.txt','POST',{})).res.status,503);
  assert.equal((await request('/v1/chat','POST',{message:'Hallo',request_id:'chat_0001'})).res.status,503);
});

test('news endpoints use curated news provider and extract headlines without calling write tools',async t=>{
  const articles=[{title:'Eine Meldung',source:'Quelle',url:'https://source.example/article',published:'2026-11-03T10:00:00Z'}];let calls=0;
  const {request,store}=await setup(t,{news:async country=>{calls++;return {ok:true,country,articles,fetched_at:'2026-11-03T12:00:00Z'};}});
  assert.equal((await request('/v1/world-news?country=Germany')).body.country,'Germany');
  const summary=(await request('/v1/assistant/actions','POST',{module:'news',data:{country:'World'}})).body;
  assert.match(summary.summary,/Eine Meldung/);assert.match(summary.summary,/keine Volltextanalyse/);assert.equal(calls,2);
  assert.deepEqual(store.read().history,[]);assert.deepEqual(store.read().rows.tasks,{});
});

test('HTTP chat exposes durable idempotent job result and prevents duplicate provider calls',async t=>{
  let calls=0;
  const {request,store}=await setup(t,{apiKey:'server-only-key',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'Hallo Stephen.'}}]}),{status:200,headers:{'content-type':'application/json'}});}});
  const data={message:'Hallo',request_id:'conversation1'};
  assert.equal((await request('/v1/chat','POST',data)).body.reply,'Hallo Stephen.');
  assert.equal((await request('/v1/chat','POST',data)).body.reply,'Hallo Stephen.');assert.equal(calls,1);
  const job=(await request('/v1/rows/pccommands/conversation1')).body;assert.equal(job.status,'done');assert.equal(job.result,'Hallo Stephen.');
  assert.equal(Object.keys(store.read().chatRequests).length,1);
});

test('store refuses corrupt persisted files instead of overwriting user data',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'iron-corrupt-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'iron-data.json');await writeFile(path,'broken');await assert.rejects(createStore(dir),/nicht geladen/);assert.equal(await readFile(path,'utf8'),'broken');
});

test('Gemini configuration is advertised without revealing its server key',async t=>{
  const key='gemini-server-only-test-key';
  const {request}=await setup(t,{provider:'gemini',apiKey:key});
  const health=(await request('/v1/health')).body;
  assert.equal(health.ai_provider,'gemini');assert.equal(health.ai_model,'gemini-3.5-flash');assert.equal(health.ai_configured,true);assert.equal(health.capabilities.research,true);
  assert.equal(JSON.stringify(health).includes(key),false);
  const state=(await request('/v1/assistant')).body;assert.equal(state.capabilities.research,true);assert.equal(JSON.stringify(state).includes(key),false);
});
