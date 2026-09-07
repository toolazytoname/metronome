#!/usr/bin/env node
/**
 * Executes the real sw.js fetch handler in a fake worker (not grep).
 * Offline HTML fallback: exact → same path ignore query → language home.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

class FakeResponse {
  constructor(url, body, status) {
    this.url = url;
    this.body = body;
    this.status = status || 200;
    this.ok = this.status === 200;
    this.type = 'basic';
  }
  clone() { return new FakeResponse(this.url, this.body, this.status); }
  text() { return Promise.resolve(this.body); }
}

function makeCaches(store) {
  return {
    match(req, opts) {
      const url = typeof req === 'string' ? req : req.url;
      const u = new URL(url, 'https://jpq.weichao.studio');
      const ignore = opts && opts.ignoreSearch;
      for (const [k, v] of store.entries()) {
        const ku = new URL(k, 'https://jpq.weichao.studio');
        if (ignore) {
          if (ku.origin === u.origin && ku.pathname === u.pathname) return Promise.resolve(v);
        } else if (k === u.href || k === u.pathname || (ku.pathname === u.pathname && ku.search === u.search)) {
          return Promise.resolve(v);
        }
      }
      return Promise.resolve(undefined);
    },
    open() {
      return Promise.resolve({
        put(req, res) {
          const url = typeof req === 'string' ? req : req.url;
          store.set(new URL(url, 'https://jpq.weichao.studio').href, res);
          return Promise.resolve();
        }
      });
    },
    keys() { return Promise.resolve([]); }
  };
}

function loadWorker(store) {
  const listeners = { fetch: [], install: [], activate: [] };
  const ctx = {
    CACHE: null,
    PRECACHE: null,
    self: {
      location: { origin: 'https://jpq.weichao.studio' },
      addEventListener(type, fn) { listeners[type].push(fn); },
      skipWaiting() { return Promise.resolve(); },
      clients: { claim() { return Promise.resolve(); } }
    },
    caches: makeCaches(store),
    fetch() { return Promise.reject(new Error('offline')); },
    URL,
    console
  };
  ctx.self.location.origin = 'https://jpq.weichao.studio';
  vm.createContext(ctx);
  vm.runInContext(SW, ctx);
  return { ctx, listeners };
}

function dispatchFetch(listeners, url) {
  let responded;
  const event = {
    request: { method: 'GET', url },
    respondWith(p) { responded = p; }
  };
  listeners.fetch.forEach((fn) => fn(event));
  return responded;
}

async function main() {
  const zh = new FakeResponse('https://jpq.weichao.studio/index.html', '<html lang="zh-CN">ZH_HOME</html>');
  const en = new FakeResponse('https://jpq.weichao.studio/en/index.html', '<html lang="en">EN_HOME</html>');
  const enSlash = new FakeResponse('https://jpq.weichao.studio/en/', '<html lang="en">EN_SLASH</html>');
  const enTail = new FakeResponse('https://jpq.weichao.studio/en/p/piano-practice.html', '<html lang="en">EN_TAIL</html>');
  const zhTail = new FakeResponse('https://jpq.weichao.studio/p/piano-practice.html', '<html lang="zh-CN">ZH_TAIL</html>');

  const store = new Map([
    ['https://jpq.weichao.studio/index.html', zh],
    ['https://jpq.weichao.studio/', zh],
    ['https://jpq.weichao.studio/en/index.html', en],
    ['https://jpq.weichao.studio/en/', enSlash],
    ['https://jpq.weichao.studio/en/p/piano-practice.html', enTail],
    ['https://jpq.weichao.studio/p/piano-practice.html', zhTail]
  ]);
  const { ctx, listeners } = loadWorker(store);
  assert.strictEqual(vm.runInContext('CACHE', ctx), 'xiaotutou-v6');
  assert.strictEqual(vm.runInContext("languageHome('/en/?x=1'.split('?')[0])", ctx) || vm.runInContext("languageHome('/en/')", ctx), '/en/index.html');
  assert.strictEqual(vm.runInContext("languageHome('/en/')", ctx), '/en/index.html');
  assert.strictEqual(vm.runInContext("languageHome('/en')", ctx), '/en/index.html');
  assert.strictEqual(vm.runInContext("languageHome('/en/p/x.html')", ctx), '/en/index.html');
  assert.strictEqual(vm.runInContext("languageHome('/')", ctx), '/index.html');
  assert.strictEqual(vm.runInContext("languageHome('/p/x.html')", ctx), '/index.html');

  const enQuery = await dispatchFetch(listeners, 'https://jpq.weichao.studio/en/?bpm=80&mode=voice');
  assert.ok(enQuery, 'fetch handler must respondWith');
  const enRes = await enQuery;
  const enBody = await enRes.text();
  assert.ok(enBody.indexOf('lang="en"') !== -1, 'en query must stay English, got ' + enBody);
  assert.ok(enBody.indexOf('ZH_HOME') === -1, 'must not fall back to Chinese home');
  assert.ok(enBody.indexOf('EN_SLASH') !== -1 || enBody.indexOf('EN_HOME') !== -1, 'same-path ignoreSearch or en home');

  const enBare = await dispatchFetch(listeners, 'https://jpq.weichao.studio/en');
  const enBareBody = await (await enBare).text();
  assert.ok(enBareBody.indexOf('lang="en"') !== -1);

  const enIndex = await dispatchFetch(listeners, 'https://jpq.weichao.studio/en/index.html');
  assert.ok((await (await enIndex).text()).indexOf('EN_HOME') !== -1);

  const enTailHit = await dispatchFetch(listeners, 'https://jpq.weichao.studio/en/p/piano-practice.html?bpm=40');
  const tailBody = await (await enTailHit).text();
  assert.ok(tailBody.indexOf('EN_TAIL') !== -1, 'cached English long-tail must win over language home');
  assert.ok(tailBody.indexOf('EN_HOME') === -1);

  const missingEn = await dispatchFetch(listeners, 'https://jpq.weichao.studio/en/p/missing.html');
  const missingBody = await (await missingEn).text();
  assert.ok(missingBody.indexOf('EN_HOME') !== -1, 'uncached English long-tail → English home, not Chinese');
  assert.ok(missingBody.indexOf('ZH_HOME') === -1);

  const zhQ = await dispatchFetch(listeners, 'https://jpq.weichao.studio/?bpm=80&mode=voice');
  const zhBody = await (await zhQ).text();
  assert.ok(zhBody.indexOf('ZH_HOME') !== -1 || zhBody.indexOf('lang="zh-CN"') !== -1);

  const zhTailQ = await dispatchFetch(listeners, 'https://jpq.weichao.studio/p/piano-practice.html?x=1');
  assert.ok((await (await zhTailQ).text()).indexOf('ZH_TAIL') !== -1);

  console.log('test_sw_fetch: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
