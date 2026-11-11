/**
 * A small PNG encoder (RGBA, 8 bits per channel) with no dependencies, so the
 * app can turn a drawn tide chart into an image file for the Android widget,
 * which has no canvas of its own. Rows use the "Sub" filter and the data is
 * compressed with fixed-Huffman deflate and a simple LZ77 match finder, which
 * is plenty for flat-colored charts with transparent backgrounds.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; ) {
    const end = Math.min(i + 5552, bytes.length);
    for (; i < end; i++) {
      a += bytes[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

class BitWriter {
  private buf: Uint8Array;
  private pos = 0;
  private bit = 0;
  private cur = 0;
  constructor(size: number) {
    this.buf = new Uint8Array(Math.max(64, size));
  }
  private push(byte: number) {
    if (this.pos >= this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.pos++] = byte;
  }
  /** Write `n` bits of `v`, least significant bit first. */
  bits(v: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.cur |= ((v >>> i) & 1) << this.bit;
      if (++this.bit === 8) {
        this.push(this.cur);
        this.cur = 0;
        this.bit = 0;
      }
    }
  }
  /** Write a Huffman code, most significant bit first. */
  code(v: number, n: number) {
    for (let i = n - 1; i >= 0; i--) this.bits((v >>> i) & 1, 1);
  }
  done(): Uint8Array {
    if (this.bit > 0) this.push(this.cur);
    return this.buf.subarray(0, this.pos);
  }
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

function litLen(w: BitWriter, sym: number) {
  if (sym < 144) w.code(0x30 + sym, 8);
  else if (sym < 256) w.code(0x190 + sym - 144, 9);
  else if (sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

function findIndex(base: number[], v: number): number {
  let i = base.length - 1;
  while (base[i] > v) i--;
  return i;
}

/** Raw deflate (RFC 1951) with one fixed-Huffman block. */
export function deflateFixed(data: Uint8Array): Uint8Array {
  const w = new BitWriter(data.length / 4);
  w.bits(1, 1); // final block
  w.bits(1, 2); // fixed Huffman
  const HASH = 1 << 15;
  const head = new Int32Array(HASH).fill(-1);
  const WINDOW = 32768;
  const hash = (i: number) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & (HASH - 1);
  let i = 0;
  while (i < data.length) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + 2 < data.length) {
      const h = hash(i);
      const cand = head[h];
      head[h] = i;
      // Try the hashed candidate and the previous pixel (distance 4), which catches flat runs.
      for (const c of [cand, i - 4]) {
        if (c < 0 || i - c > WINDOW || c >= i) continue;
        let n = 0;
        const max = Math.min(258, data.length - i);
        while (n < max && data[c + n] === data[i + n]) n++;
        if (n > bestLen) {
          bestLen = n;
          bestDist = i - c;
        }
      }
    }
    if (bestLen >= 3) {
      const li = findIndex(LEN_BASE, bestLen);
      litLen(w, 257 + li);
      w.bits(bestLen - LEN_BASE[li], LEN_EXTRA[li]);
      const di = findIndex(DIST_BASE, bestDist);
      w.code(di, 5);
      w.bits(bestDist - DIST_BASE[di], DIST_EXTRA[di]);
      // Index a few positions inside the match so later data can refer to it.
      const end = i + bestLen;
      for (let k = i + 1; k < end && k + 2 < data.length; k += 1 + (bestLen >> 4)) head[hash(k)] = k;
      i = end;
    } else {
      litLen(w, data[i]);
      i++;
    }
  }
  litLen(w, 256); // end of block
  return w.done();
}

/** zlib stream (RFC 1950) around a fixed-Huffman deflate block. */
export function zlibCompress(data: Uint8Array): Uint8Array {
  const body = deflateFixed(data);
  const out = new Uint8Array(body.length + 6);
  out[0] = 0x78;
  out[1] = 0x01;
  out.set(body, 2);
  const a = adler32(data);
  out[out.length - 4] = a >>> 24;
  out[out.length - 3] = (a >>> 16) & 0xff;
  out[out.length - 2] = (a >>> 8) & 0xff;
  out[out.length - 1] = a & 0xff;
  return out;
}

/** Encode straight-alpha RGBA pixels (row-major, 4 bytes each) as a PNG file. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error("encodePng: pixel buffer has the wrong size");
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    const r = y * stride;
    raw[o] = 1; // Sub filter
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (rgba[r + x] - (x >= 4 ? rgba[r + x - 4] : 0)) & 0xff;
  }
  const idat = zlibCompress(raw);

  const chunks: [string, Uint8Array][] = [
    ["IHDR", ihdr(width, height)],
    ["IDAT", idat],
    ["IEND", new Uint8Array(0)],
  ];
  const size = 8 + chunks.reduce((n, [, d]) => n + 12 + d.length, 0);
  const out = new Uint8Array(size);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let p = 8;
  for (const [type, d] of chunks) {
    writeU32(out, p, d.length);
    for (let k = 0; k < 4; k++) out[p + 4 + k] = type.charCodeAt(k);
    out.set(d, p + 8);
    writeU32(out, p + 8 + d.length, crc32(out, p + 4, p + 8 + d.length));
    p += 12 + d.length;
  }
  return out;
}

function ihdr(width: number, height: number): Uint8Array {
  const d = new Uint8Array(13);
  writeU32(d, 0, width);
  writeU32(d, 4, height);
  d[8] = 8; // bit depth
  d[9] = 6; // RGBA
  return d;
}

function writeU32(b: Uint8Array, at: number, v: number) {
  b[at] = v >>> 24;
  b[at + 1] = (v >>> 16) & 0xff;
  b[at + 2] = (v >>> 8) & 0xff;
  b[at + 3] = v & 0xff;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 of some bytes, for data: URIs (works without Buffer or btoa). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    s += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    s += i + 2 < bytes.length ? B64[c & 63] : "=";
  }
  return s;
}
