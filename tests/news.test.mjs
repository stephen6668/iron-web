import test from 'node:test';
import assert from 'node:assert/strict';
import { getNews, parseFeed, NEWS_SOURCES } from '../server/news.mjs';

const now = Date.parse('2026-11-03T12:00:00Z');
const source = NEWS_SOURCES.find(v => v.id === 'bbc-world');
const feed = items => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
const item = (title = 'Aktuelle Meldung', url = 'https://www.bbc.com/news/world-123', published = 'Tue, 03 Nov 2026 11:00:00 GMT') => `<item><title>${title}</title><link>${url}</link><pubDate>${published}</pubDate><description><![CDATA[<p>Nachricht &amp; Hintergrund</p>]]></description></item>`;

test('RSS strips HTML and requires recent, safe publisher URLs', () => {
  const xml = feed(item() + item('Old', 'https://www.bbc.com/old', 'Tue, 20 Oct 2026 11:00:00 GMT') + item('Bad', 'https://bbc.com.evil.test/x') + item('HTTP', 'http://www.bbc.com/x') + item('Undated', 'https://www.bbc.com/undated', '') + item('Future', 'https://www.bbc.com/future', 'Wed, 04 Nov 2026 11:00:00 GMT'));
  const articles = parseFeed(xml, source, now);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].source, 'BBC News · World');
  assert.equal(articles[0].source_kind, 'newsroom');
  assert.equal(articles[0].excerpt, 'Nachricht & Hintergrund');
});

test('Atom alternate links and entity encoded titles are parsed', () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A &amp; B</title><link rel="self" href="https://www.bbc.com/id"/><link rel="alternate" href="https://www.bbc.com/news/test"/><updated>2026-11-03T11:00:00Z</updated><summary>Text</summary></entry></feed>';
  const articles = parseFeed(xml, source, now);
  assert.equal(articles[0].title, 'A & B');
  assert.equal(articles[0].url, 'https://www.bbc.com/news/test');
});

test('invalid XML, external entities, and non-feed pages are rejected', () => {
  assert.throws(() => parseFeed('<rss><channel>', source, now));
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>', source, now));
  assert.throws(() => parseFeed('<html><body>blocked</body></html>', source, now));
});

test('unsupported countries do not silently show world stories', async () => {
  let calls = 0;
  const result = await getNews('Unlisted Country', { now, fetch: async () => { calls++; throw Error(); } });
  assert.equal(calls, 0);
  assert.equal(result.coverage.supported, false);
  assert.deepEqual(result.articles, []);
});

test('German country alias chooses only its curated feed and fetch forbids redirects', async () => {
  const urls = [];
  const result = await getNews('Luxemburg', { now, fetch: async (url, init) => {
    urls.push(url); assert.equal(init.redirect, 'error');
    return new Response(feed(item('RTL Meldung', 'https://www.rtl.lu/news/a/123')));
  } });
  assert.equal(result.country, 'Luxembourg');
  assert.deepEqual(urls, ['https://www.rtl.lu/rss.xml']);
  assert.equal(result.articles.length, 1);
});

test('partial outages remain visible and articles deduplicate', async () => {
  const result = await getNews('World', { now, fetch: async url => {
    if (url.includes('news.un.org')) return new Response('failure', { status: 503 });
    const domain = url.includes('france24') ? 'france24.com' : url.includes('dw.com') ? 'dw.com' : url.includes('aljazeera') ? 'aljazeera.com' : 'bbc.com';
    return new Response(feed(item('One', `https://www.${domain}/news/1`) + item('Duplicate', `https://www.${domain}/news/1`)));
  } });
  assert.equal(result.ok, true);
  assert.equal(result.partial, true);
  assert.equal(result.sources.find(s => s.name === 'UN News').status, 'error');
  assert.equal(result.articles.length, 4);
});

test('all outages return explicit failure, oversized feeds rejected', async () => {
  const result = await getNews('World', { now, fetch: async () => new Response('x', { headers: { 'content-length': '3000000' } }) });
  assert.equal(result.ok, false);
  assert.deepEqual(result.articles, []);
  assert.ok(result.sources.every(s => s.status === 'error'));
});

test('old-only valid feeds return no recent news rather than inventing freshness', async () => {
  const result = await getNews('Japan', { now, fetch: async () => new Response(feed(item('Old', 'https://www3.nhk.or.jp/news/old', 'Tue, 20 Oct 2026 11:00:00 GMT'))) });
  assert.equal(result.ok, true);
  assert.equal(result.sources[0].status, 'no_recent_articles');
  assert.equal(result.articles.length, 0);
});

test('countries without a national feed use country mentions, never unfiltered world stories', async () => {
  for (const [country, headline] of [
    ['India', 'India publishes a new transport plan'],
    ['China', 'Chinese officials publish trade figures'],
    ['Brazil', 'Brazil reports election results'],
    ['South Africa', 'South African parliament opens'],
    ['Russia', 'Russian authorities release a statement'],
    ['Ukraine', 'Ukraine announces reconstruction plans'],
    ['France', 'French vote in France begins'],
  ]) {
    const result = await getNews(country, { now, fetch: async () => new Response(feed(
      item(headline, 'https://www.bbc.com/news/country-story') + item('Unrelated world news', 'https://www.bbc.com/news/unrelated')
    )) });
    assert.equal(result.coverage.supported, true, country);
    assert.equal(result.coverage.scope, 'country_mentions', country);
    assert.match(result.coverage.note, /Nur Meldungen, die dieses Land erwähnen/);
    assert.deepEqual(result.articles.map(v => v.title), [headline], country);
  }
});

test('Georgia state and other ambiguous names are not loose country matches', async () => {
  for (const [country, ambiguous, actual] of [
    ['Georgia', 'Georgia state election results', 'Tbilisi publishes Georgia election results'],
    ['Jordan', 'Michael Jordan announces plans', 'Jordanian government announces plans in Amman'],
    ['Chad', 'Chad Smith joins a new band', "Chadian ministers meet in N'Djamena"],
    ['Mexico', 'New Mexico state election', 'Mexico announces election results'],
    ['Niger', 'Nigeria announces election results', 'Niger announces election results'],
  ]) {
    const result = await getNews(country, { now, fetch: async () => new Response(feed(
      item(ambiguous, 'https://www.bbc.com/news/ambiguous') + item(actual, 'https://www.bbc.com/news/actual')
    )) });
    assert.deepEqual(result.articles.map(v => v.title), [actual], country);
  }
});

test('country mentions may occur in the excerpt and known regions retain their own feeds', async () => {
  const india = await getNews('Indien', { now, fetch: async () => new Response(feed('<item><title>Transport plan published</title><link>https://www.bbc.com/news/excerpt</link><pubDate>Tue, 03 Nov 2026 11:00:00 GMT</pubDate><description>The government of India has published the plan.</description></item>')) });
  assert.equal(india.country, 'India');
  assert.equal(india.articles.length, 1);
  const urls = [];
  const africa = await getNews('Afrika', { now, fetch: async url => { urls.push(url); return new Response(feed(item())); } });
  assert.equal(africa.coverage.scope, 'country_or_region');
  assert.deepEqual(urls, ['https://feeds.bbci.co.uk/news/world/africa/rss.xml']);
});

test('explicit native fetch option still uses the five-minute cache', async t => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(feed(item('Ireland news', 'https://www.rte.ie/news/test'))); };
  t.after(() => { globalThis.fetch = previousFetch; });
  const first = await getNews('Ireland', { now, fetch: globalThis.fetch, forceRefresh: true });
  const second = await getNews('Ireland', { now: now + 60000, fetch: globalThis.fetch });
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});
