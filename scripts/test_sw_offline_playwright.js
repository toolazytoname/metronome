#!/usr/bin/env node
/**
 * Isolated Playwright: local server only, abort external, no audio start.
 * Offline /en/?bpm=80&mode=voice must stay English with query applied.
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const PLAYWRIGHT = '/opt/homebrew/lib/node_modules/playwright';

async function waitPort(port, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/en/' }, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
      });
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('server not up');
}

async function main() {
  let server;
  let browser;
  const port = 18765;
  try {
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
      cwd: ROOT,
      stdio: 'ignore'
    });
    await waitPort(port, 8000);
    const { chromium } = require(PLAYWRIGHT);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      serviceWorkers: 'allow',
      bypassCSP: false
    });
    const origin = `http://127.0.0.1:${port}`;
    await context.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(origin)) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    await page.goto(origin + '/en/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('no SW');
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await page.goto(origin + '/en/?bpm=80&mode=voice', { waitUntil: 'domcontentloaded' });
    const state = await page.evaluate(() => ({
      htmlLang: document.documentElement.lang,
      engineLang: window.engine && window.engine.lang,
      bpm: window.engine && window.engine.bpm,
      sm: window.engine && (window.engine.sm || window.engine.mode),
      href: location.href,
      playing: !!(window.engine && window.engine.playing)
    }));
    assert.strictEqual(state.htmlLang, 'en', JSON.stringify(state));
    assert.strictEqual(state.engineLang, 'en', JSON.stringify(state));
    assert.strictEqual(Number(state.bpm), 80, JSON.stringify(state));
    const mode = String(state.sm);
    assert.ok(mode === 'voice' || mode === 'SoundMode.VOICE' || /voice/i.test(mode), JSON.stringify(state));
    assert.ok(state.href.indexOf('bpm=80') !== -1 && state.href.indexOf('mode=voice') !== -1);
    assert.strictEqual(state.playing, false, 'must not start audio');
    console.log('test_sw_offline_playwright: ok', JSON.stringify(state));
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    if (server && server.pid) {
      try { process.kill(server.pid, 'SIGKILL'); } catch (e) { /* ignore */ }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
