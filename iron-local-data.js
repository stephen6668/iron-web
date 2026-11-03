/* Shared adapter: independent cloud server or the existing private PC. */
(() => {
  'use strict';
  const PC_KEY = 'iron_local_data_connection_v1', CLOUD_KEY = 'iron_cloud_connection_v1';
  const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  let mode = 'cloud';
  try { mode = localStorage.getItem('iron_connection_mode') || (read(localStorage, PC_KEY) ? 'pc' : 'cloud'); } catch { /* storage unavailable */ }
  const settings = mode === 'pc' ? read(localStorage, PC_KEY) : read(sessionStorage, CLOUD_KEY) || read(localStorage, CLOUD_KEY);
  const active = !!(settings?.url && settings?.token), name = mode === 'pc' ? 'PC' : 'Cloud';
  window.IRONConnectionMode = mode;
  window.IRONLocalDataActive = active; // historical name shared by the existing screens
  window.IRONBackendName = name;
  async function call(path, method = 'GET', body, timeout = 15000, binary = false) {
    if (!active) throw Error('Bitte unter Datenverbindung deinen Cloud-Server oder PC verbinden.');
    const control = new AbortController(), timer = setTimeout(() => control.abort(), timeout);
    try {
      const r = await fetch(settings.url.replace(/\/$/, '') + path, {
        method, cache: 'no-store', signal: control.signal,
        headers: { Authorization: 'Bearer ' + settings.token, ...(body != null ? { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' } : {}) },
        ...(body != null ? { body: binary ? body : JSON.stringify(body) } : {})
      });
      let value;
      try { value = await r.json(); } catch { throw Error(name + ' hat keine gültige Antwort geliefert. Server-Adresse prüfen.'); }
      if (!r.ok || value.ok === false) throw Error(value.error || name + ' HTTP ' + r.status);
      return value;
    } catch (e) {
      throw Error(e.name === 'AbortError' ? 'Zeitlimit erreicht. Auftragsverlauf prüfen; nicht automatisch erneut senden.' : e.message || name + ' nicht erreichbar');
    } finally { clearTimeout(timer); }
  }
  const id = () => crypto.randomUUID().replace(/-/g, '');
  async function execute(text, onProgress) {
    const requestId = id();
    if (mode === 'cloud') {
      try { return (await call('/v1/chat', 'POST', { message: text, request_id: requestId }, 120000)).reply; }
      catch (e) { e.message += ' Auftragskennung: ' + requestId + '. Bei unklarem Ausgang den Auftragsverlauf prüfen.'; throw e; }
    }
    let row;
    try { row = await call('/v1/rows/pccommands', 'POST', { id: requestId, data: { command: text, status: 'pending' } }); }
    catch (e) { e.message += ' Auftragskennung: ' + requestId + '. Bei unklarer Übertragung zuerst im Auftragsverlauf prüfen.'; throw e; }
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      onProgress?.(row);
      if (row.status === 'done') return row.result || 'Auftrag verarbeitet.';
      if (row.status === 'error') throw Error(row.result || 'Auftrag fehlgeschlagen');
      await new Promise(r => setTimeout(r, 1200));
      row = await call('/v1/rows/pccommands/' + requestId);
    }
    return 'Auftrag ' + requestId + ' läuft noch oder ist unbestätigt. Im Auftragsverlauf prüfen; keine automatische Wiederholung.';
  }
  window.IRONLocalData = Object.freeze({
    call, execute, mode, name, test: () => call('/v1/health'), state: () => call('/v1/assistant'),
    action: (module, data) => call('/v1/assistant/actions', 'POST', { module, data }, 120000),
    upload: (file, question) => call('/v1/documents?name=' + encodeURIComponent(file.name) + '&question=' + encodeURIComponent(question), 'POST', file, 120000, true),
    news: country => call('/v1/world-news?country=' + encodeURIComponent(country), 'GET', null, 60000)
  });
  const cfg = { databaseId: 'iron', functionDomain: settings?.url || '', tables: { tasks: 'tasks', plans: 'plans', ideas: 'ideas', pcStatus: 'pc_status', pcCommands: 'pccommands' }, pcStatusRowId: 'main_pc' };
  const Query = {
    limit: n => JSON.stringify({ method: 'limit', values: [n] }),
    equal: (attribute, v) => JSON.stringify({ method: 'equal', attribute, values: Array.isArray(v) ? v : [v] }),
    notEqual: (attribute, v) => JSON.stringify({ method: 'notEqual', attribute, values: Array.isArray(v) ? v : [v] }),
    orderDesc: attribute => JSON.stringify({ method: 'orderDesc', attribute }),
    orderAsc: attribute => JSON.stringify({ method: 'orderAsc', attribute })
  };
  window.IRONCloud = Object.freeze({
    cfg, Query, ID: { unique: id }, userRowPermissions: () => [],
    currentUser: async () => active ? { $id: 'iron-owner', name: 'Stephen' } : null,
    login: async () => { throw Error('Bitte unter Datenverbindung den Server verbinden.'); },
    logout: async () => { sessionStorage.removeItem(CLOUD_KEY); localStorage.removeItem(mode === 'pc' ? PC_KEY : CLOUD_KEY); },
    pingCloud: async () => {const health=await call('/v1/health');window.IRONHealth=health;return !!health.ok;},
    askAI: execute,
    async list(table, queries = []) {
      let rows = (await call('/v1/rows/' + table)).rows || []; let limit;
      for (const raw of queries) {
        let q; try { q = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
        if (q.method === 'equal') rows = rows.filter(x => q.values.includes(x[q.attribute]));
        if (q.method === 'notEqual') rows = rows.filter(x => !q.values.includes(x[q.attribute]));
        if (q.method === 'orderDesc' || q.method === 'orderAsc') rows.sort((a, b) => (q.method === 'orderDesc' ? -1 : 1) * String(a[q.attribute] || '').localeCompare(String(b[q.attribute] || '')));
        if (q.method === 'limit') limit = q.values[0];
      }
      return limit ? rows.slice(0, limit) : rows;
    },
    create: (table, data, key) => call('/v1/rows/' + table, 'POST', { id: key || id(), data }),
    update: (table, key, data) => call('/v1/rows/' + table + '/' + encodeURIComponent(key), 'PATCH', data),
    remove: (table, key) => call('/v1/rows/' + table + '/' + encodeURIComponent(key), 'DELETE'),
    get: (table, key) => call('/v1/rows/' + table + '/' + encodeURIComponent(key))
  });
  window.IRON_APPWRITE_READY = true;
})();
