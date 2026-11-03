import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const adapter = await readFile(new URL('../iron-local-data.js', import.meta.url), 'utf8');
function storage(initial={}) {
  const map = new Map(Object.entries(initial));
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}
function setup({local={},session={},fetchImpl=async()=>({ok:true,status:200,json:async()=>({ok:true})})}={}) {
  const calls=[];
  const window={};
  const context=vm.createContext({window,localStorage:storage(local),sessionStorage:storage(session),crypto:{randomUUID},AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}});
  vm.runInContext(adapter,context);
  return {window,calls};
}
const cloudKey='iron_cloud_connection_v1',pcKey='iron_local_data_connection_v1';
const conn=(url,token='a'.repeat(32))=>JSON.stringify({url,token});

test('new browser defaults to cloud, unpaired API fails without any network request',async()=>{
  const {window,calls}=setup();
  assert.equal(window.IRONConnectionMode,'cloud');
  assert.equal(window.IRONLocalDataActive,false);
  await assert.rejects(window.IRONLocalData.news('World'),/Datenverbindung/);
  assert.equal(calls.length,0);
});

test('session cloud credentials take precedence; chat uses independent endpoint once with request ID',async()=>{
  const {window,calls}=setup({local:{[cloudKey]:conn('https://old.example')},session:{[cloudKey]:conn('https://current.example','b'.repeat(32))},
    fetchImpl:async()=>({ok:true,json:async()=>({ok:true,reply:'Gespeichert.'})})});
  assert.equal(await window.IRONLocalData.execute('Merke meinen Namen'),'Gespeichert.');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://current.example/v1/chat');
  assert.equal(calls[0].options.headers.Authorization,'Bearer '+'b'.repeat(32));
  assert.equal(calls[0].options.method,'POST');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.message,'Merke meinen Namen');
  assert.match(body.request_id,/^[a-f\d]{32}$/);
});

test('legacy PC pairing selects original PC API and successful queued command settles',async()=>{
  const {window,calls}=setup({local:{[pcKey]:conn('https://private.example')},
    fetchImpl:async()=>({ok:true,json:async()=>({ok:true,status:'done',result:'PC-Ergebnis'})})});
  assert.equal(window.IRONConnectionMode,'pc');
  assert.equal(await window.IRONLocalData.execute('Öffne mein Programm'),'PC-Ergebnis');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://private.example/v1/rows/pccommands');
  assert.equal(JSON.parse(calls[0].options.body).data.command,'Öffne mein Programm');
});

test('explicit cloud mode does not fall back to PC when cloud is unpaired',async()=>{
  const {window,calls}=setup({local:{iron_connection_mode:'cloud',[pcKey]:conn('https://private.example')}});
  assert.equal(window.IRONLocalDataActive,false);
  await assert.rejects(window.IRONLocalData.execute('Hallo'),/Datenverbindung/);
  assert.equal(calls.length,0);
});

test('uncertain network failure is never replayed and exposes request ID for history',async()=>{
  const {window,calls}=setup({session:{[cloudKey]:conn('https://cloud.example')},fetchImpl:async()=>{throw Error('network disconnected');}});
  await assert.rejects(window.IRONLocalData.execute('Erstelle eine Aufgabe'),/network disconnected.*Auftragskennung: [a-f\d]{32}/);
  assert.equal(calls.length,1);
});

test('HTTP error bodies are preserved and are not treated as successful assistant replies',async()=>{
  const {window,calls}=setup({session:{[cloudKey]:conn('https://cloud.example')},fetchImpl:async()=>({ok:false,status:503,json:async()=>({ok:false,error:'KI noch nicht eingerichtet'})})});
  await assert.rejects(window.IRONLocalData.execute('Hallo'),/KI noch nicht eingerichtet/);
  assert.equal(calls.length,1);
});

test('existing UI query contract filters and orders returned cloud rows',async()=>{
  const {window}=setup({session:{[cloudKey]:conn('https://cloud.example')},fetchImpl:async()=>({ok:true,json:async()=>({ok:true,rows:[
    {$id:'1',status:'neu',title:'A'},{$id:'2',status:'fertig',title:'Z'},{$id:'3',status:'neu',title:'C'}]})})});
  const {Query}=window.IRONCloud;
  const rows=await window.IRONCloud.list('ideas',[Query.equal('status','neu'),Query.orderDesc('title'),Query.limit(1)]);
  assert.equal(rows.length,1);assert.equal(rows[0].$id,'3');
});
