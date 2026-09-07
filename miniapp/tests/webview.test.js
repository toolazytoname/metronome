/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

global.wx = {
  setNavigationBarTitle() {},
  setClipboardData() {},
  showToast() {},
  showModal() {},
};
let def = null;
global.Page = (d) => { def = d; };

const { decodeQueryUrl, isHttpUrl } = require('../pages/webview/webview.js');

function makePage() {
  const p = Object.create(def);
  p.data = { url: '', failed: false, failReason: '' };
  p.setData = (obj) => Object.assign(p.data, obj);
  return p;
}

describe('webview helpers', () => {
  it('decodeQueryUrl returns empty on invalid encoding', () => {
    expect(decodeQueryUrl('%E0%A4%A')).toBe('');
    expect(decodeQueryUrl('')).toBe('');
    expect(decodeQueryUrl(null)).toBe('');
  });
  it('isHttpUrl only accepts http(s)', () => {
    expect(isHttpUrl('https://jpq.weichao.studio/about#donate')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('webview page', () => {
  it('invalid param shows fallback, not a web-view url', () => {
    const p = makePage();
    p.onLoad({ url: '%E0%A4%A' });
    expect(p.data.failed).toBe(true);
    expect(p.data.url).toBe('');
  });
  it('missing url shows fallback', () => {
    const p = makePage();
    p.onLoad({});
    expect(p.data.failed).toBe(true);
  });
  it('binderror is not treated as a successful load', () => {
    const p = makePage();
    p.onLoad({ url: encodeURIComponent('https://jpq.weichao.studio/about#donate') });
    expect(p.data.failed).toBe(false);
    expect(p.data.url).toContain('https://jpq.weichao.studio/about');
    p.onWebError();
    expect(p.data.failed).toBe(true);
    expect(p.data.url).toBe('');
  });
});
