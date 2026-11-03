import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../iron-conversation.js', import.meta.url), 'utf8');

class Element {
  constructor() {
    this.textContent = '';
    this.dataset = {};
    this.children = [];
    this.attributes = {};
    this.classList = { toggle() {} };
    this.label = { textContent: '' };
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelector(selector) { return selector === 'small' ? this.label : null; }
  append(...children) { this.children.push(...children); }
  get firstElementChild() { return this.children[0]; }
}

function harness({ hasSpeech = true, command } = {}) {
  const events = new Map();
  const docEvents = new Map();
  const elements = Object.fromEntries([
    'voiceBtn', 'conversationToggle', 'stopSpeechBtn', 'conversationStatus',
    'conversationLog', 'commandInput', 'conversationEmpty'
  ].map(id => [id, new Element()]));
  const instances = [];
  const timers = new Map();
  let timerId = 0;
  const sent = [];
  const document = {
    hidden: false,
    readyState: 'complete',
    getElementById: id => elements[id],
    createElement: () => new Element(),
    addEventListener: (name, callback) => docEvents.set(name, callback)
  };
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
  }
  const window = {
    ...(hasSpeech ? { SpeechRecognition: Recognition } : {}),
    IRONMobile: { stopSpeech() {} },
    addEventListener: (name, callback) => events.set(name, callback),
    command: command || (async text => { sent.push(text); })
  };
  vm.runInNewContext(source, {
    window, document,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  return {
    window, document, elements, sent, instances, timers,
    emit(name, detail) { events.get(name)?.({ detail }); },
    hide() { document.hidden = true; docEvents.get('visibilitychange')?.(); },
    flushTimers() { const queued = [...timers.values()]; timers.clear(); queued.forEach(callback => callback()); }
  };
}

function result(recognition, text, final = true) {
  const row = [{ transcript: text }];
  row.isFinal = final;
  recognition.onresult({ results: [row] });
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('a final transcript is sent once even when cumulative results repeat', async () => {
  const app = harness();
  app.elements.voiceBtn.onclick();
  const mic = app.instances[0];
  result(mic, 'Erstelle eine Aufgabe');
  result(mic, 'Erstelle eine Aufgabe');
  mic.onend();
  mic.onend();
  await tick();
  assert.deepEqual(app.sent, ['Erstelle eine Aufgabe']);
  assert.equal(app.instances.length, 1);
  assert.equal(app.elements.voiceBtn.attributes['aria-pressed'], 'false');
});

test('conversation waits until command including speech completes before listening again', async () => {
  let finish;
  const completion = new Promise(resolve => { finish = resolve; });
  const app = harness({ command: () => completion });
  app.elements.conversationToggle.onclick();
  result(app.instances[0], 'Hallo Iron');
  app.instances[0].onend();
  await tick();
  assert.equal(app.instances.length, 1);
  assert.equal(app.timers.size, 0);
  assert.equal(app.elements.voiceBtn.disabled, true);
  finish();
  await tick();
  assert.equal(app.instances.length, 1);
  assert.equal(app.timers.size, 1);
  app.flushTimers();
  assert.equal(app.instances.length, 2);
  assert.equal(app.elements.voiceBtn.attributes['aria-pressed'], 'true');
});

test('hiding the page aborts the microphone, drops late results and requires a new tap', async () => {
  const app = harness();
  app.elements.conversationToggle.onclick();
  const mic = app.instances[0];
  app.hide();
  result(mic, 'Nicht absenden');
  mic.onend();
  await tick();
  app.flushTimers();
  assert.equal(mic.aborted, true);
  assert.deepEqual(app.sent, []);
  assert.equal(app.instances.length, 1);
  assert.equal(app.elements.conversationToggle.attributes['aria-pressed'], 'false');
});

test('recognition errors pause conversation and cannot start a retry loop', async () => {
  const app = harness();
  app.elements.conversationToggle.onclick();
  const mic = app.instances[0];
  result(mic, 'Entwurf');
  mic.onerror({ error: 'network' });
  mic.onend();
  await tick();
  app.flushTimers();
  assert.deepEqual(app.sent, []);
  assert.equal(app.instances.length, 1);
  assert.equal(app.elements.conversationStatus.dataset.state, 'error');
  assert.equal(app.elements.conversationToggle.attributes['aria-pressed'], 'false');
});

test('stopping a pending turn invalidates later speech and prevents next microphone start', async () => {
  let finish;
  const app = harness({ command: () => new Promise(resolve => { finish = resolve; }) });
  app.elements.conversationToggle.onclick();
  result(app.instances[0], 'Plane meinen Tag');
  app.instances[0].onend();
  const before = app.window.IRONConversation.speechEpoch;
  app.elements.stopSpeechBtn.onclick();
  assert.equal(app.window.IRONConversation.speechEpoch, before + 1);
  finish();
  await tick();
  app.flushTimers();
  assert.equal(app.instances.length, 1);
  assert.equal(app.elements.conversationToggle.attributes['aria-pressed'], 'false');
});

test('command errors reported by the app halt conversation even if command resolves', async () => {
  let finish;
  const app = harness({ command: () => new Promise(resolve => { finish = resolve; }) });
  app.elements.conversationToggle.onclick();
  result(app.instances[0], 'Hallo');
  app.instances[0].onend();
  app.emit('iron-command', { role: 'error', text: 'Server nicht erreichbar' });
  finish();
  await tick();
  app.flushTimers();
  assert.equal(app.instances.length, 1);
  assert.equal(app.elements.conversationStatus.textContent, 'Server nicht erreichbar');
});

test('only final recognition results submit; interim text stays editable', async () => {
  const app = harness();
  app.elements.voiceBtn.onclick();
  result(app.instances[0], 'Unvollständiger Entwurf', false);
  app.instances[0].onend();
  await tick();
  assert.deepEqual(app.sent, []);
  assert.equal(app.elements.commandInput.value, 'Unvollständiger Entwurf');
});

test('unsupported browser keeps text entry available and disables conversation mode', () => {
  const app = harness({ hasSpeech: false });
  assert.equal(app.elements.conversationToggle.disabled, true);
  app.elements.voiceBtn.onclick();
  assert.match(app.elements.conversationStatus.textContent, /Eingabefeld/);
  assert.equal(app.instances.length, 0);
});
