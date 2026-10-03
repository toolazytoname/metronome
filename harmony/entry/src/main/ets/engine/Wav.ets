/** Accept only complete RIFF PCM / mono / 44.1 kHz / signed 16-bit samples. */
export class Wav {
  static parseInto(bytes: Uint8Array): Int16Array | null {
    if (bytes.length < 44) {
      return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (off: number): string => String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
      return null;
    }
    const end = view.getUint32(4, true) + 8;
    if (end > bytes.length || end < 44) {
      return null;
    }
    let off = 12;
    let hasFormat = false;
    let dataOff = -1;
    let dataLen = 0;
    while (off + 8 <= end) {
      const id = tag(off);
      // RIFF sizes are unsigned; signed bitwise parsing can move off backwards
      // and hang the worker on a malformed chunk.
      const size = view.getUint32(off + 4, true);
      const body = off + 8;
      if (size > end - body || body + size + (size % 2) > end) {
        return null;
      }
      if (id === 'fmt ') {
        if (size < 16 || view.getUint16(body, true) !== 1 ||
          view.getUint16(body + 2, true) !== 1 || view.getUint32(body + 4, true) !== 44100 ||
          view.getUint32(body + 8, true) !== 88200 || view.getUint16(body + 12, true) !== 2 ||
          view.getUint16(body + 14, true) !== 16) {
          return null;
        }
        hasFormat = true;
      } else if (id === 'data') {
        dataOff = body;
        dataLen = size;
      }
      off = body + size + (size % 2);
    }
    if (off !== end || !hasFormat || dataOff < 0 || dataLen < 2 || dataLen % 2 !== 0) {
      return null;
    }
    const out = new Int16Array(dataLen / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = view.getInt16(dataOff + i * 2, true);
    }
    return out;
  }
}
