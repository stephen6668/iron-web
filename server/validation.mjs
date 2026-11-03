export const fail = (message, status=400) => Object.assign(new Error(message), {status});
export function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw fail('Ein JSON-Objekt wird erwartet.');
  if (Object.hasOwn(value, '__proto__') || Object.hasOwn(value, 'constructor') || Object.hasOwn(value, 'prototype')) throw fail('Ungültiges Datenfeld.');
  return value;
}
export function text(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(`${name}: Text ${required ? 'erforderlich, ' : ''}maximal ${max} Zeichen.`);
  return value.trim();
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value) || ['__proto__','constructor','prototype'].includes(value)) throw fail('Ungültige Kennung.');
  return value;
}
export function rowData(table, value) {
  const d = object(value), out = {};
  const fields = {
    tasks: ['text','datum','erledigt','erstellt'],
    plans: ['name','inhalt','typ','erstellt'],
    ideas: ['title','description','category','status'],
    calendar: ['summary','start','end','location','description']
  }[table];
  if (!fields) throw fail('Diese Tabelle ist nur lesbar.', 405);
  for (const key of Object.keys(d)) if (!fields.includes(key)) throw fail('Unbekanntes Datenfeld: ' + key);
  if (table === 'tasks') {
    out.text = text(d.text, 'Aufgabe', 2000);
    out.datum = text(d.datum ?? 'Offen', 'Datum', 100, false);
    if (d.erledigt !== undefined && typeof d.erledigt !== 'boolean') throw fail('erledigt muss true oder false sein.');
    out.erledigt = d.erledigt ?? false;
  }
  if (table === 'plans') {
    out.name = text(d.name, 'Name', 200);
    out.inhalt = text(d.inhalt, 'Inhalt', 30000);
    if (d.typ !== undefined && !['plan','einkauf'].includes(d.typ)) throw fail('Unbekannter Plan-Typ.');
    out.typ = d.typ ?? 'plan';
  }
  if (['tasks','plans'].includes(table)) {
    if (d.erstellt !== undefined && !Number.isFinite(Date.parse(d.erstellt))) throw fail('Ungültiges Erstelldatum.');
    out.erstellt = d.erstellt || new Date().toISOString();
  }
  if (table === 'ideas') {
    out.title = text(d.title, 'Titel', 100);
    out.description = text(d.description ?? '', 'Beschreibung', 1500, false);
    out.category = text(d.category ?? '', 'Kategorie', 40, false);
    if (d.status !== undefined && !['neu','arbeit','fertig'].includes(d.status)) throw fail('Unbekannter Ideenstatus.');
    out.status = d.status ?? 'neu';
  }
  if (table === 'calendar') {
    out.summary = text(d.summary, 'Termin', 300);
    out.location = text(d.location ?? '', 'Ort', 500, false);
    out.description = text(d.description ?? '', 'Beschreibung', 3000, false);
    for (const key of ['start','end']) {
      const val = object(d[key]);
      const dateTime = text(val.dateTime, key, 50);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(dateTime) || !Number.isFinite(Date.parse(dateTime))) throw fail(`${key}: ISO-Zeit mit Zeitzone erforderlich.`);
      out[key] = {dateTime};
    }
    if (Date.parse(out.end.dateTime) <= Date.parse(out.start.dateTime)) throw fail('Terminende muss nach dem Beginn liegen.');
  }
  return out;
}
