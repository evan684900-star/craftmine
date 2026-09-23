'use strict';
// Lecture / écriture de fichiers ZIP (sans dépendance) pour exporter et importer les sauvegardes.
// Écriture : compression « deflate » si le navigateur la propose, sinon fichiers stockés tels quels.
// Lecture : fichiers stockés ou compressés en « deflate » (ce que produisent Windows, macOS, Linux…).
(function () {
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function transform(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const canDeflate = () => typeof CompressionStream !== 'undefined';
  const canInflate = () => typeof DecompressionStream !== 'undefined';

  function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  // files : [{ name, data (texte ou Uint8Array) }] -> Blob ZIP
  async function create(files) {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(new Date());
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(raw);
      let method = 0;
      let body = raw;
      if (canDeflate()) {
        try {
          const packed = await transform(raw, new CompressionStream('deflate-raw'));
          if (packed.length < raw.length) {
            method = 8;
            body = packed;
          }
        } catch (e) {
          // pas de compression disponible : on stocke le fichier tel quel
        }
      }
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // noms en UTF-8
      local.setUint16(8, method, true);
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, raw.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, body);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, method, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, body.length, true);
      cd.setUint32(24, raw.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  // ArrayBuffer -> [{ name, data: Uint8Array }]
  async function read(buffer) {
    const bytes = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("ce fichier n'est pas un ZIP valide");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = [];
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP endommagé');
      const method = dv.getUint16(p + 10, true);
      const crc = dv.getUint32(p + 16, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue; // dossier
      if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error('ZIP endommagé');
      const start = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
      const body = bytes.subarray(start, start + csize);
      let data;
      if (method === 0) data = body.slice();
      else if (method === 8) {
        if (!canInflate()) throw new Error('ce navigateur ne sait pas décompresser ce ZIP');
        data = await transform(body, new DecompressionStream('deflate-raw'));
      } else throw new Error('méthode de compression non prise en charge (' + method + ')');
      if (crc32(data) !== crc) throw new Error('fichier corrompu (' + name + ')');
      out.push({ name, data });
    }
    return out;
  }

  CM.Zip = { create, read, crc32 };
})();
