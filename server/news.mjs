import { XMLParser, XMLValidator } from 'fast-xml-parser';

const HOUR = 3600000;
const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_MS = 5 * 60000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true, trimValues: true });
const cache = new Map();

// Only publisher-owned feed endpoints are fetched; country input is never a URL.
export const NEWS_SOURCES = Object.freeze([
  { id: 'bbc-world', name: 'BBC News · World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['World'], kind: 'newsroom' },
  { id: 'un', name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', domains: ['news.un.org'], regions: ['World'], kind: 'institution' },
  { id: 'dw', name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all', domains: ['dw.com'], regions: ['World'], kind: 'newsroom' },
  { id: 'tagesschau', name: 'tagesschau', url: 'https://www.tagesschau.de/xml/rss2/', domains: ['tagesschau.de'], regions: ['Germany'], kind: 'newsroom' },
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/rss', domains: ['france24.com'], regions: ['World'], kind: 'newsroom' },
  { id: 'nhk', name: 'NHK', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', domains: ['nhk.or.jp'], regions: ['Japan'], kind: 'newsroom' },
  { id: 'abc', name: 'ABC News Australia', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', domains: ['abc.net.au'], regions: ['Australia'], kind: 'newsroom' },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', domains: ['aljazeera.com'], regions: ['World'], kind: 'newsroom' },
  { id: 'rtl', name: 'RTL Lëtzebuerg', url: 'https://www.rtl.lu/rss.xml', domains: ['rtl.lu'], regions: ['Luxembourg'], kind: 'newsroom' },
  { id: 'srf', name: 'SRF News', url: 'https://www.srf.ch/news/bnf/rss/1890', domains: ['srf.ch'], regions: ['Switzerland'], kind: 'newsroom' },
  { id: 'orf', name: 'ORF', url: 'https://rss.orf.at/news.xml', domains: ['orf.at'], regions: ['Austria'], kind: 'newsroom' },
  { id: 'rte', name: 'RTÉ News', url: 'https://www.rte.ie/feeds/rss/?index=/news/', domains: ['rte.ie'], regions: ['Ireland'], kind: 'newsroom' },
  { id: 'rnz', name: 'Radio New Zealand', url: 'https://www.rnz.co.nz/rss/national.xml', domains: ['rnz.co.nz'], regions: ['New Zealand'], kind: 'newsroom' },
  { id: 'cbc', name: 'CBC News', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories', domains: ['cbc.ca'], regions: ['Canada'], kind: 'newsroom' },
  { id: 'bbc-uk', name: 'BBC News · UK', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['United Kingdom'], kind: 'newsroom' },
  { id: 'bbc-us', name: 'BBC News · US & Canada', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['United States of America'], kind: 'newsroom' },
  { id: 'bbc-africa', name: 'BBC News · Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['Africa'], kind: 'newsroom' },
  { id: 'bbc-asia', name: 'BBC News · Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['Asia'], kind: 'newsroom' },
  { id: 'bbc-latin', name: 'BBC News · Latin America', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['Latin America'], kind: 'newsroom' },
  { id: 'bbc-middle-east', name: 'BBC News · Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['Middle East'], kind: 'newsroom' },
  { id: 'bbc-europe', name: 'BBC News · Europe', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', domains: ['bbc.co.uk', 'bbc.com'], regions: ['Europe'], kind: 'newsroom' },
].map(source => Object.freeze(source)));

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const displayNames = ['en', 'de', 'fr', 'es'].map(locale => new Intl.DisplayNames([locale], { type: 'region' }));
const countries = countryCodes.map(code => {
  const names = displayNames.map(display => display.of(code));
  return { code, name: names[0], names };
});
const countryAliases = {
  'United States of America': 'US', Russia: 'RU', 'Russian Federation': 'RU', 'South Korea': 'KR', 'North Korea': 'KP',
  'Dem. Rep. Congo': 'CD', 'Democratic Republic of the Congo': 'CD', Congo: 'CG', 'Republic of the Congo': 'CG',
  'Ivory Coast': 'CI', 'Czech Republic': 'CZ', 'East Timor': 'TL', Swaziland: 'SZ', 'W. Sahara': 'EH',
  Palestine: 'PS', 'S. Sudan': 'SS', 'Central African Rep.': 'CF', 'Dominican Rep.': 'DO',
};
const aliasCountries = new Map(Object.entries(countryAliases).map(([name, code]) => [normalized(name), code]));
const continentCodes = {
  Africa: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
  Asia: 'AF BD BN BT CN HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
  Europe: 'AD AL AM AT AX AZ BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GE GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA',
  'Middle East': 'AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE',
  'Latin America': 'AG AI AR AW BB BL BM BO BQ BR BS BZ CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT UY VC VE VG VI',
};
const regionalSourceIds = { Africa: 'bbc-africa', Asia: 'bbc-asia', Europe: 'bbc-europe', 'Middle East': 'bbc-middle-east', 'Latin America': 'bbc-latin' };
function countryMetadata(value) {
  const key = normalized(value);
  const aliasCode = aliasCountries.get(key);
  return countries.find(country => country.code === aliasCode || country.code.toLowerCase() === key || country.names.some(name => normalized(name) === key));
}
function searchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'");
}
function tokenPattern(value) {
  return new RegExp('(?<![\\p{L}\\p{N}])' + searchText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'u');
}
export function mentionsCountry(article, country) {
  const content = searchText(article.title + ' ' + article.excerpt);
  // Ambiguous short names need country-specific evidence, not a loose place/name match.
  const special = {
    GE: /\b(?:tbilisi|tiflis|georgien|georgie|caucasus|kaukasus|georgian (?:government|parliament|president)|country of georgia)\b/u,
    TD: /\b(?:tschad|tchad|chadian|n'djamena|ndjamena|republic of chad)\b/u,
    JO: /\b(?:jordanien|jordanie|jordania|jordanian|amman|hashemite)\b/u,
    TR: /\b(?:turkiye|turkei|turquie|turquia|turkish|ankara|erdogan)\b/u,
    CG: /\b(?:congo-brazzaville|congo brazzaville|republic of (?:the )?congo|republique du congo|republik kongo)\b/u,
    CD: /\b(?:congo-kinshasa|congo kinshasa|democratic republic of (?:the )?congo|dr congo|drc|republique democratique du congo|demokratische republik kongo)\b/u,
    GN: /\b(?:guinea-conakry|guinea conakry|guinean|guineens?|republic of guinea|republique de guinee)\b/u,
  };
  if (special[country.code]) return special[country.code].test(content);
  const names = [...country.names, ...Object.entries(countryAliases).filter(([, code]) => code === country.code).map(([name]) => name)];
  if (country.code === 'US') names.push('USA', 'U.S.', 'American');
  if (country.code === 'CN') names.push('Chinese');
  if (country.code === 'IN') names.push('Indian');
  if (country.code === 'BR') names.push('Brazilian');
  if (country.code === 'ZA') names.push('South African');
  if (country.code === 'RU') names.push('Russian');
  if (country.code === 'UA') names.push('Ukrainian');
  if (country.code === 'MX') {
    // The US state New Mexico is not evidence of a story about Mexico.
    return names.some(name => tokenPattern(name).test(content.replace(/\bnew mexico\b/g, '')));
  }
  return names.some(name => tokenPattern(name).test(content));
}
const aliases = {
  welt: 'World', worldwide: 'World', global: 'World', deutschland: 'Germany', frankreich: 'France', japan: 'Japan',
  australien: 'Australia', luxemburg: 'Luxembourg', schweiz: 'Switzerland', osterreich: 'Austria', oesterreich: 'Austria',
  irland: 'Ireland', neuseeland: 'New Zealand', kanada: 'Canada', vereinigteskonigreich: 'United Kingdom',
  unitedkingdom: 'United Kingdom', grossbritannien: 'United Kingdom', england: 'United Kingdom', usa: 'United States of America',
  unitedstates: 'United States of America', vereinigtestaaten: 'United States of America', afrika: 'Africa', asien: 'Asia',
  lateinamerika: 'Latin America', naherosten: 'Middle East', europa: 'Europe',
};
function canonicalCountry(value) {
  const key = normalized(value || 'World');
  return aliases[key] || NEWS_SOURCES.flatMap(s => s.regions).find(region => normalized(region) === key) || countryMetadata(value)?.name || String(value).trim().slice(0, 100);
}
function text(value) {
  if (value && typeof value === 'object') value = value['#text'] ?? '';
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (name[0] !== '#') return named[name.toLowerCase()] || entity;
    const point = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '';
  }).replace(/\s+/g, ' ').trim();
}
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function articleURL(value, source) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (!source.domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function parseFeed(xml, source, now = Date.now()) {
  if (typeof xml !== 'string' || !xml.trim() || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Ungültiger Nachrichtenfeed');
  if (XMLValidator.validate(xml) !== true) throw new Error('Ungültiges RSS/Atom-XML');
  const document = parser.parse(xml);
  if (!document.rss && !document.feed && !document['rdf:RDF']) throw new Error('Kein RSS/Atom-Feed');
  const items = array(document.rss?.channel?.item ?? document.feed?.entry ?? document['rdf:RDF']?.item);
  return items.flatMap(item => {
    const links = array(item.link);
    const link = links.find(v => typeof v === 'string') || links.find(v => !v['@_rel'] || v['@_rel'] === 'alternate');
    const url = articleURL(typeof link === 'string' ? link : link?.['@_href'] || link?.['#text'], source);
    const title = text(item.title).slice(0, 500);
    const timestamp = Date.parse(text(item.pubDate || item.published || item.updated || item['dc:date']));
    // Unknown dates and future-dated entries are not represented as current news.
    if (!url || !title || !Number.isFinite(timestamp) || timestamp < now - 72 * HOUR || timestamp > now + 5 * 60000) return [];
    return [{ title, url, source: source.name, source_kind: source.kind, published: new Date(timestamp).toISOString(), excerpt: text(item.description || item.summary || item.content || item['content:encoded']).slice(0, 1200) }];
  });
}

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Feed zu groß');
  if (!response.body?.getReader) {
    const value = await response.text();
    if (Buffer.byteLength(value) > MAX_BYTES) throw new Error('Feed zu groß');
    return value;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > MAX_BYTES) throw new Error('Feed zu groß');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  return Buffer.concat(chunks).toString('utf8');
}
async function fetchSource(source, fetchImpl, now) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // Redirects are deliberately not followed: no unlisted endpoint is fetched.
    const response = await fetchImpl(source.url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'IRON-News/1.0 (+RSS reader)' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const articles = parseFeed(await readBounded(response), source, now);
    return { articles, source: { name: source.name, url: source.url, kind: source.kind, status: articles.length ? 'ok' : 'no_recent_articles', count: articles.length } };
  } catch (error) {
    return { articles: [], source: { name: source.name, url: source.url, kind: source.kind, status: 'error', error: error.name === 'AbortError' ? 'Zeitlimit beim Feedabruf' : 'Feed derzeit nicht abrufbar' } };
  } finally { clearTimeout(timer); }
}

export async function getNews(country = 'World', options = {}) {
  const now = typeof options.now === 'function' ? Number(options.now()) : Number(options.now ?? Date.now());
  const selectedCountry = canonicalCountry(country);
  let selected = NEWS_SOURCES.filter(s => s.regions.includes(selectedCountry));
  const countryInfo = countryMetadata(selectedCountry);
  const filteredCountry = !selected.length && countryInfo;
  if (filteredCountry) {
    const region = Object.entries(continentCodes).find(([, codes]) => codes.split(' ').includes(countryInfo.code))?.[0];
    selected = NEWS_SOURCES.filter(source => source.regions.includes('World') || source.id === regionalSourceIds[region]);
  }
  const customFetch = options.fetch && options.fetch !== globalThis.fetch;
  const base = { country: selectedCountry, fetched_at: new Date(now).toISOString(), stale: false, max_age_hours: 72,
    coverage: { requested: selectedCountry, supported: Boolean(selected.length), scope: filteredCountry ? 'country_mentions' : selectedCountry === 'World' ? 'world' : 'country_or_region', note: filteredCountry ? 'Nur Meldungen, die dieses Land erwähnen, aus internationalen Quellen; keine vollständige Landesabdeckung.' : 'Direkte Feeds ausgewählter Redaktionen und Institutionen; keine vollständige Abdeckung aller Länder. Ein Länderfeed kann auch internationale Meldungen enthalten.' } };
  if (!selected.length) return { ...base, ok: true, articles: [], sources: [], coverage: { ...base.coverage, note: 'Für dieses Land ist noch kein direkter Feed hinterlegt. Wähle Welt, Europa, Afrika, Asien, Lateinamerika oder Naher Osten für regionale Meldungen.' } };
  const cached = cache.get(selectedCountry);
  if (!customFetch && !options.forceRefresh && cached && now - cached.createdAt < CACHE_MS && now >= cached.createdAt) return structuredClone(cached.value);
  const result = await Promise.all(selected.map(source => fetchSource(source, options.fetch || globalThis.fetch, now)));
  const seen = new Set();
  const articles = result.flatMap(v => v.articles).filter(article => !filteredCountry || mentionsCountry(article, countryInfo)).sort((a, b) => b.published.localeCompare(a.published)).filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; }).slice(0, 60);
  const sources = result.map(v => v.source);
  const available = sources.some(s => s.status !== 'error');
  const value = { ...base, ok: available, articles, sources, partial: sources.some(s => s.status === 'error'), ...(available ? {} : { error: 'Alle ausgewählten Nachrichtenquellen sind derzeit nicht erreichbar. Später erneut versuchen.' }) };
  if (available && !customFetch) cache.set(selectedCountry, { createdAt: now, value: structuredClone(value) });
  return value;
}
