#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pDir = path.join(root, 'p');
const enDir = path.join(root, 'en/p');

function htmlFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
}

function check(name, fn) {
  fn();
  console.log('  ok  ' + name);
}

console.log('Long-tail pages');

const zhPages = htmlFiles(pDir);
const enPages = htmlFiles(enDir);
assert.equal(zhPages.length, 10, '10 Chinese long-tail pages');
assert.equal(enPages.length, 10, '10 English long-tail pages');

check('English pages load /p/longtail.css, not /en/p/longtail.css', () => {
  enPages.forEach((f) => {
    const html = fs.readFileSync(path.join(enDir, f), 'utf8');
    assert.ok(
      html.includes('href="/p/longtail.css"'),
      f + ' must use absolute /p/longtail.css'
    );
    assert.ok(!html.includes('href="../p/longtail.css"'), f + ' old relative CSS path');
  });
});

check('Chinese and English pages have paired hreflang', () => {
  zhPages.forEach((f) => {
    const slug = f.replace(/\.html$/, '');
    const zh = fs.readFileSync(path.join(pDir, f), 'utf8');
    const en = fs.readFileSync(path.join(enDir, f), 'utf8');
    const zhUrl = 'https://jpq.weichao.studio/p/' + slug + '.html';
    const enUrl = 'https://jpq.weichao.studio/en/p/' + slug + '.html';
    [zh, en].forEach((html, i) => {
      const label = i === 0 ? 'zh' : 'en';
      assert.ok(html.includes('hreflang="zh-CN"'), label + ' ' + f + ' zh-CN hreflang');
      assert.ok(html.includes('hreflang="en"'), label + ' ' + f + ' en hreflang');
      assert.ok(html.includes(zhUrl), label + ' ' + f + ' zh url');
      assert.ok(html.includes(enUrl), label + ' ' + f + ' en url');
    });
  });
});

check('6/8 copy does not promise a second traditional accent', () => {
  const zh = fs.readFileSync(path.join(pDir, 'six-eight-time.html'), 'utf8');
  const en = fs.readFileSync(path.join(enDir, 'six-eight-time.html'), 'utf8');
  assert.ok(!/强\s*[-－]\s*弱\s*[-－]\s*弱\s*[·.]\s*强/.test(zh), 'zh must not present a two-group accent pattern as the product');
  assert.ok(!/BUM-bum-bum\s*·\s*BUM-bum-bum/.test(en), 'en must not present two group accents as engine output');
  assert.ok(zh.includes('第一拍') || zh.includes('beat 0'), 'zh should describe first-beat accent');
  assert.ok(/beat 1 of the bar|beat index 0|only beat 1/i.test(en), 'en should describe first-beat accent');
  assert.ok(zh.includes('只在小节第一拍') || zh.includes('没有第二组'), 'zh should deny a second automatic accent');
});

check('running / piano pages do not claim universal professional advice', () => {
  const runZh = fs.readFileSync(path.join(pDir, 'running-cadence-180.html'), 'utf8');
  const pianoZh = fs.readFileSync(path.join(pDir, 'piano-practice.html'), 'utf8');
  assert.ok(!runZh.includes('最佳步频'), 'running page must not call 180 the best cadence');
  assert.ok(!pianoZh.includes('公认的入门起步速度'), 'piano page must not call 80 the agreed starting tempo');
});

check('all generated JSON-LD parses and matches the source description', () => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'tools/longtail.json'), 'utf8'));
  for (const item of items) {
    for (const [lang, dir] of [['zh', pDir], ['en', enDir]]) {
      const html = fs.readFileSync(path.join(dir, item.slug + '.html'), 'utf8');
      const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert.ok(match, lang + '/' + item.slug);
      const data = JSON.parse(match[1]);
      assert.equal(data.name, item['title_' + lang]);
      assert.equal(data.description, item['desc_' + lang]);
      const escaped = item['desc_' + lang].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
      assert.ok(html.includes('name="description" content="' + escaped + '"'), 'HTML attribute escaping: ' + lang + '/' + item.slug);
    }
  }
});

console.log('All long-tail checks passed');
