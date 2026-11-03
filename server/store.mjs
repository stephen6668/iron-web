import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const initial = () => ({
  version: 1,
  rows: {tasks: {}, plans: {}, ideas: {}, calendar: {}, pccommands: {}},
  memories: [], companion: {next_step: '', decision: ''}, sport: [],
  history: [], chatRequests: {}, actionRequests: {}
});

// One process owns the volume. The serialized queue avoids lost concurrent updates;
// write-to-new-file + rename leaves the previous complete document intact on crash.
export async function createStore(directory) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  const filename = join(directory, 'iron-data.json');
  let state;
  try {
    state = JSON.parse(await readFile(filename, 'utf8'));
    if (state.version !== 1 || !state.rows || !Array.isArray(state.memories) || !Array.isArray(state.history)) throw Error('Invalid format');
    for (const name of Object.keys(initial().rows)) {
      if (!state.rows[name] || Array.isArray(state.rows[name]) || typeof state.rows[name] !== 'object') throw Error('Invalid table');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw Error('IRON-Datendatei konnte nicht geladen werden. Sicherung prüfen; sie wurde nicht überschrieben.', {cause: error});
    state = initial();
  }
  let queue = Promise.resolve();
  return {
    read: () => structuredClone(state),
    mutate(fn) {
      const operation = queue.then(async () => {
        const draft = structuredClone(state);
        const result = fn(draft);
        if (result && typeof result.then === 'function') throw Error('Store mutations must be synchronous');
        const serialized = JSON.stringify(draft);
        if (Buffer.byteLength(serialized) > 32 * 1024 * 1024) throw Object.assign(Error('Speichergrenze erreicht. Daten exportieren und alte Einträge entfernen.'), {status: 413});
        const temporary = join(directory, '.iron-' + randomUUID() + '.tmp');
        await writeFile(temporary, serialized, {flag: 'wx', mode: 0o600});
        await rename(temporary, filename);
        state = draft;
        return structuredClone(result);
      });
      queue = operation.catch(() => {});
      return operation;
    }
  };
}
