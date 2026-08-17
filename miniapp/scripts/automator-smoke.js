/**
 * Drive the real WeChat DevTools simulator via miniprogram-automator.
 * Requires: DevTools open, `cli auto --auto-port 9420` already run.
 */
const fs = require('fs');
const path = require('path');
const automator = require('/opt/homebrew/lib/node_modules/miniprogram-automator');

const OUT = path.join(__dirname, '..', '.automator-out');
const WS = process.env.MP_WS || 'ws://127.0.0.1:9420';

function fail(name, detail) {
  console.error('FAIL', name, detail || '');
  throw new Error(name);
}
function ok(name, extra) {
  console.log('OK  ', name, extra == null ? '' : extra);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: WS });
  ok('connected', WS);

  await mp.reLaunch('/pages/index/index');
  const page = await mp.currentPage();
  if (!page) fail('currentPage');
  ok('page', page.path);

  const d0 = await page.data();
  ok('initial data', JSON.stringify({
    bpm: d0.bpm, soundMode: d0.soundMode, vol: d0.vol, running: d0.running, lang: d0.lang,
  }));
  if (typeof d0.bpm !== 'number' || d0.bpm < 40 || d0.bpm > 208) fail('bpm range', d0.bpm);
  if (typeof d0.vol !== 'number' || d0.vol < 10 || d0.vol > 100) fail('vol range', d0.vol);

  const play = await page.$('.play-btn');
  if (!play) fail('play button missing');
  await play.tap();
  await page.waitFor(400);
  let d = await page.data();
  if (!d.running) fail('tap play should set running');
  ok('play tap → running', d.running);

  const toggle = await page.$('.toggle');
  if (!toggle) fail('settings toggle missing');
  await toggle.tap();
  await page.waitFor(300);
  const voiceBtn = await page.$('.mode-btn[data-mode="voice"]');
  if (!voiceBtn) fail('voice mode button missing');
  await voiceBtn.tap();
  await page.waitFor(300);
  d = await page.data();
  if (d.soundMode !== 'voice') fail('voice mode', d.soundMode);
  if (!d.running) fail('should stay running after mode change');
  ok('voice mode while playing', d.soundMode);

  await page.callMethod('onVolChange', { detail: { value: 42 } });
  await page.waitFor(100);
  d = await page.data();
  if (d.vol !== 42) fail('volume', d.vol);
  ok('volume set', d.vol);

  await page.callMethod('onBpmChange', { detail: { value: 96 } });
  await page.waitFor(150);
  d = await page.data();
  if (d.bpm !== 96) fail('bpm', d.bpm);
  ok('bpm while running', { bpm: d.bpm, running: d.running });

  const saved = await mp.callWxMethod('getStorageSync', 'metronome');
  ok('storage', JSON.stringify(saved));
  if (!saved || saved.sm !== 'voice' || saved.vol !== 42 || saved.bpm !== 96) {
    fail('storage persist', saved);
  }

  await play.tap();
  await page.waitFor(200);
  d = await page.data();
  if (d.running) fail('tap play again should stop');
  ok('stop tap');

  await mp.reLaunch('/pages/index/index');
  const page2 = await mp.currentPage();
  const d2 = await page2.data();
  ok('after relaunch', JSON.stringify({
    bpm: d2.bpm, soundMode: d2.soundMode, vol: d2.vol, running: d2.running,
  }));
  if (d2.soundMode !== 'voice') fail('relaunch keeps voice', d2.soundMode);
  if (d2.vol !== 42) fail('relaunch keeps vol', d2.vol);
  if (d2.bpm !== 96) fail('relaunch keeps bpm', d2.bpm);
  if (d2.running) fail('relaunch should be stopped');

  try {
    await mp.screenshot({ path: path.join(OUT, '03-restored.png') });
    ok('screenshot');
  } catch (e) {
    console.log('WARN screenshot skipped', e.message);
  }

  // reset so the next manual session is not stuck at 96/voice/42
  await page2.callMethod('onVolChange', { detail: { value: 85 } });
  await page2.callMethod('onModeChange', { currentTarget: { dataset: { mode: 'uniform' } } });
  await page2.callMethod('onBpmChange', { detail: { value: 120 } });

  mp.disconnect();
  console.log('ALL MINIAPP AUTOMATOR CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
