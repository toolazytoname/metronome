/**
 * 极简 WAV 解析：只接受 PCM(1) / mono / 我们同步脚本产出的 44.1k s16le。
 * 同步脚本（harmony/sync-sounds.sh）保证格式，这里只做健壮的 chunk 遍历。
 */
export class Wav {
  static parseInto(bytes: Uint8Array): Int16Array | null {
    if (bytes.length < 44) {
      return null;
    }
    const tag = (off: number): string => String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
      return null;
    }
    let off = 12;
    let dataOff = -1;
    let dataLen = 0;
    let audioFormat = 1;
    let channels = 1;
    let rate = 44100;
    while (off + 8 <= bytes.length) {
      const id = tag(off);
      const size = bytes[off + 4] | (bytes[off + 5] << 8) | (bytes[off + 6] << 16) | (bytes[off + 7] << 24);
      const body = off + 8;
      if (id === 'fmt ' && size >= 16) {
        audioFormat = bytes[body] | (bytes[body + 1] << 8);
        channels = bytes[body + 2] | (bytes[body + 3] << 8);
        rate = bytes[body + 4] | (bytes[body + 5] << 8) | (bytes[body + 6] << 16) | (bytes[body + 7] << 24);
      } else if (id === 'data') {
        dataOff = body;
        dataLen = Math.min(size, bytes.length - body);
      }
      off = body + size + (size % 2);
    }
    if (dataOff < 0 || audioFormat !== 1 || channels !== 1 || rate !== 44100 || dataLen < 2) {
      return null;
    }
    const frames = Math.floor(dataLen / 2);
    const out = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      const lo = bytes[dataOff + i * 2];
      const hi = bytes[dataOff + i * 2 + 1];
      let v = (hi << 8) | (lo & 0xff);
      if (v >= 0x8000) {
        v -= 0x10000;
      }
      out[i] = v;
    }
    return out;
  }
}
