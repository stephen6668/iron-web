import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistant } from '../server/assistant.mjs';

function memoryStore() {
  let data = { rows: { tasks: {}, plans: {}, ideas: {}, calendar: {}, pccommands: {} }, memories: [], history: [], chatRequests: {} };
  let pending = Promise.resolve();
  return {
    read: () => structuredClone(data),
    mutate(fn) {
      const commit = pending.then(() => {
        const next = structuredClone(data);
        const result = fn(next);
        data = next;
        return structuredClone(result);
      });
      pending = commit.catch(() => {});
      return commit;
    }
  };
}
const toolCall = (name, args, id = 'tool_1') => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
function provider(responses, requests = []) {
  return async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    requests.push(JSON.parse(init.body));
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected extra model invocation');
    return Response.json({ choices: [{ message: response }] });
  };
}

test('successful tool write is persisted once, history survives next turn, duplicate request is reused', async () => {
  const store = memoryStore(), requests = [];
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { role: 'assistant', tool_calls: [toolCall('create_task', { text: 'Milch kaufen' })] },
    { role: 'assistant', content: 'Die Aufgabe Milch kaufen ist gespeichert.' },
    { role: 'assistant', content: 'Du hast mich gebeten, Milch kaufen zu speichern.' }
  ], requests) });
  const first = await chat({ message: 'Merke die Aufgabe Milch kaufen.', request_id: 'request_0001' });
  assert.equal(Object.values(store.read().rows.tasks).length, 1);
  const toolResult = JSON.parse(requests[1].messages.find(message => message.role === 'tool').content);
  assert.equal(toolResult.ok, true);
  assert.equal(toolResult.row.text, 'Milch kaufen');
  assert.deepEqual(await chat({ message: 'Merke die Aufgabe Milch kaufen.', request_id: 'request_0001' }), first);
  assert.equal(requests.length, 2);
  await chat({ message: 'Was habe ich gesagt?', request_id: 'request_0002' });
  assert.ok(requests[2].messages.some(message => message.role === 'user' && message.content === 'Merke die Aufgabe Milch kaufen.'));
  assert.equal(store.read().rows.pccommands.request_0001.status, 'done');
  await assert.rejects(chat({ message: 'Etwas anderes', request_id: 'request_0001' }), error => error.status === 409);
});

test('duplicate tool call in one request cannot create duplicate task', async () => {
  const store = memoryStore();
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { tool_calls: [toolCall('create_task', { text: 'Aufräumen' }), toolCall('create_task', { text: 'Aufräumen' }, 'tool_2')] },
    { content: 'Gespeichert.' }
  ]) });
  await chat({ message: 'Erstelle eine Aufgabe Aufräumen', request_id: 'request_1000' });
  assert.equal(Object.values(store.read().rows.tasks).length, 1);
});

test('unknown tools, invalid calendar and unknown fields cannot write', async () => {
  const store = memoryStore(), requests = [];
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { tool_calls: [toolCall('send_email', { to: 'x@example.com' }),
      toolCall('create_calendar_event', { summary: 'Training', start: 'morgen', end: 'später' }, 'tool_2'),
      toolCall('create_task', { text: 'Test', injected: true }, 'tool_3')] },
    { content: 'Diese Aktionen sind nicht verfügbar.' }
  ], requests) });
  await chat({ message: 'Prüfe die Aktionen', request_id: 'request_2000' });
  const results = requests[1].messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.ok === false));
  assert.equal(Object.values(store.read().rows.tasks).length, 0);
  assert.equal(Object.values(store.read().rows.calendar).length, 0);
});

test('uncertain provider outcome preserves completed writes and refuses automatic replay', async () => {
  const store = memoryStore(), requests = [];
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { tool_calls: [toolCall('create_idea', { title: 'Ein Garten' })] }, new Error('network failed')
  ], requests) });
  await assert.rejects(chat({ message: 'Speichere die Idee Ein Garten', request_id: 'request_3000' }), error => error.status === 502);
  assert.equal(Object.values(store.read().rows.ideas).length, 1);
  assert.equal(store.read().rows.pccommands.request_3000.status, 'error');
  assert.equal(store.read().rows.pccommands.request_3000.actions.length, 1);
  await assert.rejects(chat({ message: 'Speichere die Idee Ein Garten', request_id: 'request_3000' }), error => error.status === 409);
  assert.equal(requests.length, 2);
});

test('missing key rejects chat without creating fake jobs, unsafe request IDs rejected', async () => {
  const store = memoryStore();
  const chat = createAssistant({ store });
  await assert.rejects(chat({ message: 'Hallo', request_id: 'request_4000' }), error => error.status === 503 && /GROQ_API_KEY/.test(error.message));
  assert.deepEqual(store.read().chatRequests, {});
  await assert.rejects(chat({ message: 'Hallo', request_id: '__proto__' }), error => error.status === 400);
});

test('tool news fetch failure is visible to model, read tool returns real persisted data', async () => {
  const store = memoryStore(), requests = [];
  await store.mutate(state => { state.rows.tasks.one = { $id: 'one', text: 'Schon gespeichert' }; });
  let country;
  const chat = createAssistant({ store, apiKey: 'test-key', news: async name => { country = name; return { ok: false, error: 'Quellen nicht erreichbar' }; }, fetchImpl: provider([
    { tool_calls: [toolCall('get_news', { country: 'World' }), toolCall('read_personal_data', {}, 'tool_2')] },
    { content: 'Nachrichten sind nicht erreichbar. Eine Aufgabe ist gespeichert.' }
  ], requests) });
  await chat({ message: 'Nachrichten und Aufgaben bitte', request_id: 'request_5000' });
  assert.equal(country, 'World');
  const results = requests[1].messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
  assert.equal(results[0].ok, false);
  assert.equal(results[1].tasks[0].text, 'Schon gespeichert');
});

test('explicit task update and saved-entry delete use read IDs and replay without further writes', async () => {
  const store = memoryStore(), requests = [];
  await store.mutate(state => {
    state.rows.tasks.task_one = { $id: 'task_one', text: 'Alte Aufgabe', erledigt: false };
    state.rows.plans.plan_one = { $id: 'plan_one', name: 'Alter Plan', inhalt: 'Schritte', typ: 'plan' };
  });
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { tool_calls: [toolCall('read_personal_data', {})] },
    { tool_calls: [toolCall('update_task', { id: 'task_one', erledigt: true, text: 'Neue Aufgabe' }, 'update_1'),
      toolCall('delete_saved_entry', { table: 'plans', id: 'plan_one' }, 'delete_1')] },
    { content: 'Aufgabe geändert und erledigt. Alter Plan gelöscht.' }
  ], requests) });
  const command = { message: 'Ändere die alte Aufgabe zu Neue Aufgabe, hake sie ab und lösche den alten Plan.', request_id: 'request_6000' };
  const result = await chat(command);
  assert.equal(store.read().rows.tasks.task_one.text, 'Neue Aufgabe');
  assert.equal(store.read().rows.tasks.task_one.erledigt, true);
  assert.ok(store.read().rows.tasks.task_one.$updatedAt);
  assert.equal(Object.hasOwn(store.read().rows.plans, 'plan_one'), false);
  const toolResults = requests[2].messages.filter(message => message.role === 'tool').slice(-2).map(message => JSON.parse(message.content));
  assert.equal(toolResults[0].row.$id, 'task_one');
  assert.equal(toolResults[1].deleted.$id, 'plan_one');
  assert.equal(store.read().rows.pccommands.request_6000.actions.length, 2);
  assert.deepEqual(await chat(command), result);
  assert.equal(requests.length, 3);
});

test('task updates and deletions reject unseen IDs, protected tables, bad types and prototype keys', async () => {
  const store = memoryStore(), requests = [];
  await store.mutate(state => { state.rows.tasks.task_one = { $id: 'task_one', text: 'Behalten', erledigt: false }; });
  const chat = createAssistant({ store, apiKey: 'test-key', fetchImpl: provider([
    { tool_calls: [toolCall('delete_saved_entry', { table: 'tasks', id: 'task_one' }, 'unseen')] },
    { tool_calls: [toolCall('read_personal_data', {}, 'read')] },
    { tool_calls: [toolCall('update_task', { id: 'task_one', erledigt: 'true' }, 'bad_type'),
      toolCall('delete_saved_entry', { table: 'pccommands', id: 'request_7000' }, 'protected'),
      toolCall('delete_saved_entry', { table: 'tasks', id: '__proto__' }, 'prototype')] },
    { content: 'Die ungültigen Änderungen wurden abgewiesen.' }
  ], requests) });
  await chat({ message: 'Prüfe die Schutzregeln', request_id: 'request_7000' });
  const toolResults = requests[3].messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
  assert.equal(toolResults.filter(result => result.ok === false).length, 4);
  assert.deepEqual(store.read().rows.tasks.task_one, { $id: 'task_one', text: 'Behalten', erledigt: false });
  assert.equal(store.read().rows.pccommands.request_7000.actions.length, 0);
});

test('Gemini chat uses its fixed compatible endpoint and grounded research remains read-only',async()=>{
  const store=memoryStore(),requests=[];let queries=0;
  const chat=createAssistant({store,provider:'gemini',apiKey:'test-gemini',research:async query=>{queries++;assert.equal(query,'Aktuelles zur Raumfahrt');return {ok:true,grounded:true,summary:'Ein aktueller Bericht.',sources:[{title:'Quelle',url:'https://example.com/report'}]};},fetchImpl:async(url,init)=>{
    assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(init.headers.Authorization,'Bearer test-gemini');
    const body=JSON.parse(init.body);requests.push(body);assert.equal(body.model,'gemini-3.5-flash');assert.equal(body.max_tokens,4000);assert.equal(body.max_completion_tokens,undefined);
    return Response.json({choices:[{message:requests.length===1?{tool_calls:[toolCall('research_web',{query:'Aktuelles zur Raumfahrt'})]}:{content:'Ein aktueller Bericht mit Quelle https://example.com/report.'}}]});
  }});
  const result=await chat({message:'Recherchiere aktuelle Raumfahrtmeldungen.',request_id:'gemini_0001'});
  assert.equal(result.provider,'gemini');assert.equal(queries,1);
  assert.equal(JSON.parse(requests[1].messages.find(m=>m.role==='tool').content).grounded,true);
  assert.deepEqual(store.read().rows.tasks,{});assert.equal(store.read().rows.pccommands.gemini_0001.actions.length,0);
});

test('research unavailable in Groq mode is returned as tool failure without claiming a write',async()=>{
  const store=memoryStore(),requests=[];
  const chat=createAssistant({store,apiKey:'test-key',fetchImpl:provider([
    {tool_calls:[toolCall('research_web',{query:'Eine aktuelle Frage'})]},
    {content:'Die allgemeine Webrecherche ist nicht eingerichtet.'}
  ],requests)});
  await chat({message:'Recherchiere bitte',request_id:'research_0001'});
  const failure=JSON.parse(requests[1].messages.find(m=>m.role==='tool').content);
  assert.equal(failure.ok,false);assert.match(failure.error,/nicht eingerichtet/);
  assert.equal(store.read().rows.pccommands.research_0001.actions.length,0);
});
