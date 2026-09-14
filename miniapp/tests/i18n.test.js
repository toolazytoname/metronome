describe('default language detection', () => {
  const originalWx = global.wx;

  afterEach(() => {
    global.wx = originalWx;
    delete require.cache[require.resolve('../utils/i18n')];
  });

  function detect(language) {
    global.wx = { getSystemInfoSync: () => ({ language }) };
    delete require.cache[require.resolve('../utils/i18n')];
    return require('../utils/i18n').detectDefaultLang();
  }

  it('uses Chinese for Chinese system locales', () => {
    expect(detect('zh_CN')).toBe('zh');
    expect(detect('zh-Hant')).toBe('zh');
  });

  it('uses English for every non-Chinese system locale', () => {
    expect(detect('en-US')).toBe('en');
    expect(detect('ja-JP')).toBe('en');
    expect(detect('')).toBe('en');
  });
});
