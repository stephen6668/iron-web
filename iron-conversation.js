/* Mobile turn-taking. Speech recognition stays in the foreground and starts
   only after a tap; server commands are never retried automatically. */
(() => {
  'use strict';

  function install() {
    const voiceButton = document.getElementById('voiceBtn');
    const modeButton = document.getElementById('conversationToggle');
    const stopButton = document.getElementById('stopSpeechBtn');
    const status = document.getElementById('conversationStatus');
    const log = document.getElementById('conversationLog');
    const input = document.getElementById('commandInput');
    if (!voiceButton || !modeButton || !status) return;

    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    let conversation = false;
    let recognition = null;
    let starting = false;
    let listening = false;
    let busy = false;
    let cycle = 0;
    let restartTimer = null;
    let commandFailed = false;
    let speechEpoch = 0;

    function message(text, state = 'ready') {
      status.textContent = text;
      status.dataset.state = state;
    }

    function render() {
      modeButton.setAttribute('aria-pressed', String(conversation));
      modeButton.textContent = conversation ? 'Gespräch pausieren' : 'Gespräch starten';
      voiceButton.classList.toggle('listening', listening || starting);
      voiceButton.setAttribute('aria-pressed', String(listening || starting));
      voiceButton.setAttribute('aria-busy', String(busy));
      voiceButton.setAttribute('aria-label', listening || starting ? 'Aufnahme beenden' : 'Mit Iron sprechen');
      voiceButton.disabled = busy;
      const label = voiceButton.querySelector('small');
      if (label) label.textContent = busy ? 'IRON ANTWORTET' : listening || starting ? 'AUFNAHME BEENDEN' : 'SPRECHEN';
    }

    function setConversation(value) {
      conversation = value;
      render();
    }

    function cancelRecognition() {
      const previous = recognition;
      recognition = null;
      listening = starting = false;
      if (previous) {
        try { previous.abort(); } catch (_) { /* already ended */ }
      }
    }

    function stop(text = 'Gespräch pausiert. Tippe auf Sprechen, wenn du weitermachen möchtest.') {
      cycle += 1;
      speechEpoch += 1;
      clearTimeout(restartTimer);
      restartTimer = null;
      setConversation(false);
      cancelRecognition();
      window.IRONMobile?.stopSpeech?.();
      render();
      message(text, 'paused');
    }

    function recognitionError(error) {
      const messages = {
        'not-allowed': 'Mikrofonzugriff wurde nicht erlaubt. Erlaube das Mikrofon in den Website-Einstellungen und tippe erneut auf Sprechen.',
        'service-not-allowed': 'Dieser Browser erlaubt die Spracherkennung nicht. Versuche Safari auf dem iPhone oder Chrome auf Android. Du kannst weiterhin tippen.',
        'audio-capture': 'Kein Mikrofon verfügbar. Prüfe, ob eine andere App das Mikrofon verwendet.',
        'no-speech': 'Keine Sprache erkannt. Tippe auf Sprechen, um es erneut zu versuchen.',
        'network': 'Der Sprachdienst ist nicht erreichbar. Prüfe deine Internetverbindung oder tippe deine Nachricht.',
        'aborted': 'Die Aufnahme wurde beendet. Du kannst erneut auf Sprechen tippen.'
      };
      return messages[error] || 'Spracherkennung nicht verfügbar. Bitte erneut auf Sprechen tippen oder deine Nachricht eintippen.';
    }

    async function submit(text, currentCycle) {
      busy = true;
      commandFailed = false;
      render();
      message('Iron verarbeitet deine Nachricht …', 'thinking');
      try {
        if (typeof window.command !== 'function') throw new Error('Iron konnte nicht geladen werden. Lade die Seite erneut.');
        // command() resolves after the answer has finished speaking.
        await window.command(text);
      } catch (error) {
        commandFailed = true;
        setConversation(false);
        message(String(error?.message || 'Die Nachricht konnte nicht verarbeitet werden.'), 'error');
      } finally {
        busy = false;
        render();
      }
      if (currentCycle !== cycle || commandFailed) return;
      if (conversation && !document.hidden) {
        message('Antwort beendet. Ich höre gleich wieder zu …');
        restartTimer = setTimeout(() => {
          restartTimer = null;
          if (conversation && currentCycle === cycle && !document.hidden) listen();
        }, 350);
      } else {
        message('Bereit. Tippe auf Sprechen für deine nächste Nachricht.');
      }
    }

    function listen() {
      if (busy || recognition || document.hidden) return;
      if (!Speech) {
        setConversation(false);
        message('Dieser Browser bietet keine Spracherkennung. Nutze das Eingabefeld oder das Diktat deiner Handy-Tastatur.', 'error');
        return;
      }
      if (window.isSecureContext === false) {
        setConversation(false);
        message('Öffne Iron über HTTPS, damit das Mikrofon verfügbar ist. Du kannst deine Nachricht weiterhin eintippen.', 'error');
        return;
      }

      clearTimeout(restartTimer);
      const currentCycle = ++cycle;
      window.IRONMobile?.stopSpeech?.();
      let current;
      try { current = new Speech(); }
      catch (_) {
        setConversation(false);
        message('Der Sprachdienst konnte nicht gestartet werden. Bitte tippe deine Nachricht.', 'error');
        return;
      }
      recognition = current;
      starting = true;
      let finalText = '';
      let failed = false;
      current.lang = 'de-DE';
      current.continuous = false;
      current.interimResults = true;
      current.maxAlternatives = 1;

      current.onstart = () => {
        if (recognition !== current || currentCycle !== cycle) return;
        starting = false;
        listening = true;
        render();
        message('Ich höre zu. Tippe auf den Kreis, um die Aufnahme zu beenden.', 'listening');
      };
      current.onresult = event => {
        if (recognition !== current || currentCycle !== cycle || failed) return;
        const finals = [];
        const all = [];
        for (const result of Array.from(event.results || [])) {
          const text = String(result[0]?.transcript || '').trim();
          if (!text) continue;
          all.push(text);
          if (result.isFinal) finals.push(text);
        }
        // Results are cumulative: replacing avoids submitting a final twice.
        finalText = finals.join(' ');
        if (input) input.value = all.join(' ');
        if (all.length) message('Gehört: ' + all.join(' '), 'listening');
      };
      current.onerror = event => {
        if (recognition !== current || currentCycle !== cycle) return;
        failed = true;
        finalText = '';
        setConversation(false);
        message(recognitionError(event.error), 'error');
      };
      current.onend = () => {
        if (recognition !== current || currentCycle !== cycle) return;
        recognition = null;
        listening = starting = false;
        render();
        if (failed) return;
        const text = finalText.trim();
        finalText = '';
        if (!text) {
          setConversation(false);
          message('Keine abgeschlossene Spracheingabe erkannt. Tippe erneut auf Sprechen oder sende den Text im Eingabefeld.', 'paused');
          return;
        }
        submit(text, currentCycle);
      };

      render();
      message('Mikrofon wird gestartet …', 'listening');
      try { current.start(); }
      catch (_) {
        cancelRecognition();
        setConversation(false);
        message('Mikrofon konnte nicht gestartet werden. Prüfe die Website-Berechtigung und tippe erneut auf Sprechen.', 'error');
      }
    }

    voiceButton.onclick = () => {
      if (busy) return;
      if (recognition) {
        try { recognition.stop(); }
        catch (_) { stop('Aufnahme beendet. Bitte erneut auf Sprechen tippen.'); }
      } else listen();
    };
    modeButton.onclick = () => {
      if (conversation) { stop(); return; }
      if (busy) {
        message('Warte bitte auf die laufende Antwort, bevor du das Gespräch startest.', 'thinking');
        return;
      }
      setConversation(true);
      listen();
    };
    if (stopButton) stopButton.onclick = () => stop(busy
      ? 'Gespräch pausiert. Der laufende Auftrag wird weiter verarbeitet; sein Ergebnis erscheint als Text.'
      : 'Gespräch und Sprachausgabe pausiert.');

    function append(role, text) {
      if (!log || !text) return;
      const item = document.createElement('li');
      item.className = 'conversation-entry conversation-' + role;
      const label = document.createElement('b');
      label.textContent = role === 'user' ? 'Du' : role === 'assistant' ? 'Iron' : 'Hinweis';
      const content = document.createElement('p');
      content.textContent = text;
      item.append(label, content);
      log.append(item);
      while (log.children.length > 40) log.firstElementChild.remove();
      const empty = document.getElementById('conversationEmpty');
      if (empty) empty.hidden = true;
      log.scrollTop = log.scrollHeight;
    }

    window.addEventListener('iron-command', event => {
      const role = event.detail?.role;
      if (!['user', 'assistant', 'error'].includes(role)) return;
      const text = String(event.detail?.text || '');
      append(role, text);
      if (role === 'user' && !busy && (recognition || conversation)) {
        stop('Textnachricht wird verarbeitet. Das Sprachgespräch ist pausiert.');
      }
      if (role === 'error') {
        commandFailed = true;
        setConversation(false);
        message(text || 'Der Auftrag konnte nicht verarbeitet werden.', 'error');
      }
    });
    window.addEventListener('iron-web-voice-error', event => {
      commandFailed = true;
      setConversation(false);
      message(String(event.detail?.message || 'Sprachausgabe nicht verfügbar. Die Antwort steht als Text bereit.'), 'error');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop('Gespräch pausiert, weil die Seite im Hintergrund ist. Zum Fortsetzen erneut auf Sprechen tippen.');
    });
    window.addEventListener('pagehide', () => stop());

    if (!Speech) {
      modeButton.disabled = true;
      message('Spracherkennung ist in diesem Browser nicht verfügbar. Nutze Texteingabe oder Tastatur-Diktat.');
    }
    render();
    window.IRONConversation = Object.freeze({ stop, get speechEpoch() { return speechEpoch; } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
