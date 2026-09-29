/* Browser adapter for the Android UI. No native device permissions are assumed. */
(() => {
  'use strict';
  const CLOUD = window.IRON_APPWRITE?.functionDomain || 'https://starter-function-4j4o.fra.appwrite.run';
  const VOICE_KEY = 'iron_web_voice_enabled';
  const synth = window.speechSynthesis;
  let voiceEnabled = true;
  let speechSequence = 0;
  let voiceButton = null;
  try { voiceEnabled = localStorage.getItem(VOICE_KEY) !== 'false'; } catch (_) { /* private mode */ }

  function voiceStatus(text) {
    const status = document.getElementById('speechStatus') || document.getElementById('voiceState');
    if (status) status.textContent = text;
    if (voiceButton) {
      voiceButton.textContent = voiceEnabled ? '🔊 STIMME AN' : '🔇 STIMME AUS';
      voiceButton.setAttribute('aria-pressed', String(voiceEnabled));
    }
  }

  function stopSpeech() {
    speechSequence += 1;
    if (synth) synth.cancel();
    voiceStatus(voiceEnabled ? 'READY' : 'MUTED');
  }

  function preferredVoice() {
    const voices = synth?.getVoices() || [];
    const german = voices.filter(v => /^de(?:-|$)/i.test(v.lang || ''));
    const pool = german.length ? german : voices;
    return pool.sort((a, b) => {
      const score = v => /conrad|stefan|hans|markus|michael|male/i.test(v.name || '') ? 2 :
        (v.localService ? 1 : 0);
      return score(b) - score(a);
    })[0] || null;
  }

  function speechChunks(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let chunk = '';
    for (const word of words) {
      if (chunk && (chunk.length + word.length + 1 > 185)) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += (chunk ? ' ' : '') + word;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  }

  function playChunk(part, sequence) {
    return new Promise((resolve, reject) => {
      if (sequence !== speechSequence || !voiceEnabled) return resolve(false);
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = 'de-DE';
      utterance.rate = 0.94;
      utterance.pitch = 0.85;
      const voice = preferredVoice();
      if (voice) utterance.voice = voice;
      let done = false;
      let timer;
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (error && sequence === speechSequence) reject(error);
        else resolve(sequence === speechSequence);
      };
      utterance.onend = () => finish();
      utterance.onerror = event => finish(new Error('Browser-Stimme: ' + (event?.error || 'Wiedergabe fehlgeschlagen')));
      timer = setTimeout(() => finish(new Error('Browser hat die Sprachausgabe blockiert. Stimme-Schalter anklicken.')), 35000);
      try { synth.speak(utterance); } catch (error) { finish(error); }
    });
  }

  async function speak(value) {
    const text = String(value ?? '')
      .replace(/https?:\/\/\S+/gi, ' Link ')
      .replace(/[*_#>`~|•▪◦●○■□✓✔☐☑→←↑↓]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!text || !voiceEnabled) return;
    if (!synth || !window.SpeechSynthesisUtterance) {
      voiceStatus('TEXT ONLY');
      return;
    }
    stopSpeech();
    const sequence = speechSequence;
    voiceStatus('SPEAKING');
    let failed = false;
    try {
      for (const part of speechChunks(text)) {
        if (sequence !== speechSequence || !voiceEnabled) break;
        if (!await playChunk(part, sequence)) break;
      }
    } catch (error) {
      failed = true;
      window.dispatchEvent(new CustomEvent('iron-web-voice-error', {
        detail: { message: String(error?.message || error) }
      }));
      console.warn('[IRON Web Voice]', error);
    } finally {
      if (sequence === speechSequence) voiceStatus(failed ? 'TEXT ONLY' : 'READY');
    }
  }

  function mountVoiceButton() {
    if (voiceButton || !document.body) return;
    voiceButton = document.createElement('button');
    voiceButton.type = 'button';
    voiceButton.id = 'ironWebVoiceToggle';
    voiceButton.title = 'IRON Sprachausgabe ein- oder ausschalten';
    voiceButton.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:10000;' +
      'padding:10px 13px;background:#061b29;border:1px solid #35b8ff;color:#b9f3ff;' +
      'font:600 11px Arial,sans-serif;letter-spacing:1px;border-radius:8px;' +
      'box-shadow:0 0 16px #35b8ff66;cursor:pointer';
    voiceButton.onclick = () => {
      voiceEnabled = !voiceEnabled;
      try { localStorage.setItem(VOICE_KEY, String(voiceEnabled)); } catch (_) { /* private mode */ }
      stopSpeech();
      if (voiceEnabled) speak('IRON-Stimme aktiviert.'); // click unlocks browser playback
    };
    document.body.appendChild(voiceButton);
    voiceStatus(voiceEnabled ? 'READY' : 'MUTED');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountVoiceButton);
  else mountVoiceButton();
  if (synth?.addEventListener) synth.addEventListener('voiceschanged', preferredVoice);

  function icsValue(value) {
    return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;').replace(/,/g, '\\,');
  }
  function icsTime(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function downloadCalendarEvent(event) {
    const start = new Date(event?.start);
    if (Number.isNaN(start.getTime())) throw new Error('Kein gültiger Termin vorhanden.');
    let end = new Date(event?.end);
    if (Number.isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
    const data = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IRON//WEB//DE', 'BEGIN:VEVENT',
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@iron-web`,
      `DTSTAMP:${icsTime(new Date())}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`,
      `SUMMARY:${icsValue(event.title || 'IRON Termin')}`,
      `DESCRIPTION:${icsValue(event.description || '')}`,
      `LOCATION:${icsValue(event.location || '')}`,
      'END:VEVENT', 'END:VCALENDAR', ''
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'IRON-Termin.ics';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function ironRouteSelfCheck() {
    const paths = ['/api/status', '/api/world-news?country=Luxembourg'];
    const result = [];
    for (const path of paths) {
      try {
        const res = await fetch(CLOUD + path, { cache: 'no-store' });
        const data = await res.json();
        result.push({ route: path, http: res.status, ok: res.ok && data?.ok !== false,
          source: data?.source || null });
      } catch (error) {
        result.push({ route: path, ok: false, error: String(error?.message || error) });
      }
    }
    return { website: location.origin, tests: result };
  }

  window.IRONMobile = Object.freeze({ isNative: false, speak, stopSpeech });
  window.IRONWeb = Object.freeze({ downloadCalendarEvent });
  window.ironRouteSelfCheck = ironRouteSelfCheck;

  // The world view owns its own voice command function. Give it the same
  // explicit SMS navigation as the other IRON Web screens.
  if (window.IRON_STATIC_WEB && typeof window.command === 'function') {
    const previous = window.command;
    window.command = function (spoken) {
      const sms = String(spoken||'').match(/^(?:iron[,\s]*)?(?:sende|schicke)\s+(?:eine?\s+)?sms\s+an\s+(\+?[0-9\s()-]{5,24})\s+(?:mit\s+(?:dem\s+)?text|text)\s+(.+)$/i);
      if (sms) { sessionStorage.setItem('ironSmsDraft',JSON.stringify({number:sms[1].replace(/[\s()-]/g,''),message:sms[2].trim()}));location.href='sms.html'; return; }
      return previous(spoken);
    };
  }

  // The Android globe uses the native speech bridge for its own voice button.
  // Connect that same button to browser speech recognition on GitHub Pages.
  if (window.IRON_STATIC_WEB) {
    const button = document.getElementById('voiceBtn');
    const state = document.getElementById('status');
    const BrowserSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (button && BrowserSpeech) {
      let listening = false;
      const recognition = new BrowserSpeech();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = false;
      let transcript = '';
      recognition.onstart = () => { listening = true; transcript = ''; button.textContent = '🎙 Ich höre zu…'; };
      recognition.onresult = event => {
        transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
        if (state && transcript) state.textContent = `Gehört: ${transcript}`;
      };
      recognition.onend = () => {
        listening = false; button.textContent = '🎙 Land sprechen';
        if (transcript && typeof window.command === 'function') window.command(transcript);
      };
      recognition.onerror = event => {
        transcript = '';
        if (state) state.textContent = `Spracherkennung: ${event.error || 'nicht verfügbar'}. Du kannst ein Land auch eintippen.`;
      };
      button.onclick = () => { try { listening ? recognition.stop() : recognition.start(); }
        catch (error) { if (state) state.textContent = 'Mikrofon konnte nicht gestartet werden.'; } };
    } else if (button) {
      button.onclick = () => { if (state) state.textContent = 'Browser-Spracherkennung ist nicht verfügbar. Bitte ein Land eintippen.'; };
    }
  }
})();
