'use strict';
// Rendu WebGL2 : sections du monde, ciel, entités, main du joueur, contours.
(function () {
  const { SY } = CM.WORLD;
  const mat4 = CM.mat4;

  const LIGHT_FN = `
    float curve(float l) { return pow(0.8, (1.0 - l) * 15.0); }
    vec3 shadeLight(vec2 lv, vec3 pos) {
      float sky = curve(lv.x) * uDay;
      float blk = curve(lv.y);
      float d = distance(pos, uHeld.xyz);
      float held = uHeld.w * curve(clamp((14.5 - d) / 15.0, 0.0, 1.0));
      blk = max(blk, held);
      vec3 l = max(uSkyTint * sky, vec3(1.0, 0.82, 0.58) * blk);
      // luminosité (option) : courbe gamma + lumière ambiante minimale
      l = pow(l, vec3(1.15 - uBright * 0.5));
      return clamp(l + vec3(0.03, 0.03, 0.045) * (0.6 + uBright * 1.4), 0.0, 1.1);
    }
    vec3 applyFog(vec3 col, vec3 pos) {
      float dist = length(pos - uCam);
      float f = smoothstep(uFog.x, uFog.y, dist);
      return mix(col, uFogColor, f);
    }
  `;
  const COMMON_UNIFORMS = `
    uniform float uBright;
    uniform float uDay;
    uniform vec3 uSkyTint;
    uniform vec4 uHeld;
    uniform vec3 uFogColor;
    uniform vec2 uFog;
    uniform vec3 uCam;
  `;

  const CHUNK_VS = `#version 300 es
    precision highp float;
    layout(location=0) in ivec4 aPos;
    layout(location=1) in float aLayer;
    layout(location=2) in vec4 aData;
    uniform mat4 uViewProj;
    uniform vec3 uOffset;
    uniform float uTime;
    uniform vec2 uWaveOrigin;
    uniform float uWaving;
    out vec3 vUV;
    out vec2 vLight;
    out float vShade;
    out vec3 vPos;
    out float vIsWater;
    void main() {
      vec3 p = vec3(aPos.xyz) / 16.0 + uOffset;
      float uvp = float(aPos.w);
      float u = floor(uvp / 32.0);
      float v = uvp - u * 32.0;
      int fl = int(aData.w + 0.5);
      vIsWater = (fl & 2) != 0 ? 1.0 : 0.0;
      vec2 wp = p.xz + uWaveOrigin;
      if (vIsWater > 0.5) {
        // vagues calées sur le monde (et non sur la caméra)
        p.y += (sin(wp.x * 1.3 + uTime * 1.7) + cos(wp.y * 1.1 + uTime * 1.3)) * 0.025 - 0.05;
      } else if ((fl & 1) != 0 && uWaving > 0.5) {
        // feuillage et plantes : léger balancement calculé d'après la position
        // (deux sommets au même endroit bougent pareil : pas de fente entre les blocs).
        // Les plantes (drapeau 4) gardent le pied fixe.
        float amp = (fl & 4) != 0 ? ((v < 8.0) ? 0.06 : 0.0) : 0.022;
        float sw = sin(uTime * 1.6 + wp.x * 0.7 + wp.y * 0.45 + p.y * 0.3) * amp;
        p.x += sw;
        p.z += sw * 0.6;
      }
      vUV = vec3(u / 16.0, v / 16.0, aLayer);
      vLight = aData.xy / 255.0;
      vShade = aData.z / 255.0;
      vPos = p;
      gl_Position = uViewProj * vec4(p, 1.0);
    }`;
  const CHUNK_FS = `#version 300 es
    precision highp float;
    precision highp sampler2DArray;
    uniform sampler2DArray uTex;
    uniform float uWater;
    uniform float uTime;
    ${COMMON_UNIFORMS}
    in vec3 vUV;
    in vec2 vLight;
    in float vShade;
    in vec3 vPos;
    in float vIsWater;
    out vec4 outColor;
    ${LIGHT_FN}
    void main() {
      vec2 uv = vUV.xy;
      if (vIsWater > 0.5) uv += vec2(uTime * 0.015, uTime * 0.03);
      vec4 tex = texture(uTex, vec3(uv, vUV.z));
      if (uWater < 0.5 && tex.a < 0.5) discard;
      vec3 col = tex.rgb * shadeLight(vLight, vPos) * vShade;
      col = applyFog(col, vPos);
      outColor = vec4(col, uWater > 0.5 ? (vIsWater > 0.5 ? 0.78 : tex.a) : 1.0);
    }`;

  const ENT_VS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec3 aUV;
    layout(location=2) in vec4 aL;
    uniform mat4 uViewProj;
    out vec3 vUV;
    out vec4 vL;
    out vec3 vPos;
    void main() {
      vUV = aUV;
      vL = aL;
      vPos = aPos;
      gl_Position = uViewProj * vec4(aPos, 1.0);
    }`;
  const ENT_FS = `#version 300 es
    precision highp float;
    precision highp sampler2DArray;
    uniform sampler2DArray uTex;
    uniform vec2 uScroll;
    uniform float uAlphaMul;
    uniform float uNoFog;
    ${COMMON_UNIFORMS}
    in vec3 vUV;
    in vec4 vL;
    in vec3 vPos;
    out vec4 outColor;
    ${LIGHT_FN}
    void main() {
      vec4 tex = texture(uTex, vec3(vUV.xy + uScroll, vUV.z));
      if (tex.a < 0.1) discard;
      float flags = vL.w;
      vec3 col;
      if (flags > 0.5 && flags < 1.5) col = tex.rgb;             // émissif
      else col = tex.rgb * shadeLight(vL.xy, vPos) * vL.z;
      if (flags > 1.5 && flags < 2.5) col = mix(col, vec3(1.0, 0.15, 0.1), 0.55); // blessé
      if (uNoFog < 0.5) col = applyFog(col, vPos);
      outColor = vec4(col, tex.a * uAlphaMul);
    }`;

  const SKY_VS = `#version 300 es
    precision highp float;
    out vec2 vNdc;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
      vNdc = p;
      gl_Position = vec4(p, 0.9999, 1.0);
    }`;
  const SKY_FS = `#version 300 es
    precision highp float;
    uniform mat4 uInvVP;
    uniform vec3 uSunDir;
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform float uNight;
    uniform float uSunset;
    uniform float uTime;
    uniform vec3 uCamPos;
    uniform float uUnderwater;
    uniform float uClouds;
    in vec2 vNdc;
    out vec4 outColor;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 p = uInvVP * vec4(vNdc, 1.0, 1.0);
      vec3 dir = normalize(p.xyz / p.w);
      float h = dir.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
      if (h < 0.0) col = mix(uHorizon, uHorizon * 0.75, clamp(-h * 4.0, 0.0, 1.0));
      float sd = dot(dir, uSunDir);
      col += vec3(1.0, 0.42, 0.12) * pow(max(sd, 0.0), 6.0) * uSunset * (1.0 - clamp(abs(h) * 2.0, 0.0, 1.0));
      // étoiles
      if (uNight > 0.01 && h > 0.0) {
        vec3 sp = floor(dir * 160.0);
        float s = hash(sp.xy + sp.z * 17.0);
        float st = step(0.994, s) * (0.45 + 0.55 * fract(s * 7919.0));
        col += vec3(0.92, 0.94, 1.0) * st * uNight * clamp(h * 4.0, 0.0, 1.0);
      }
      // soleil et lune carrés
      vec3 su = normalize(cross(uSunDir, vec3(0.0, 0.0, 1.0)));
      vec3 sv = cross(su, uSunDir);
      float dp = dot(dir, uSunDir);
      if (dp > 0.0) {
        vec2 l = vec2(dot(dir, su), dot(dir, sv)) / dp;
        float m = max(abs(l.x), abs(l.y));
        if (m < 0.075) col = mix(col, vec3(1.0, 0.97, 0.82), 1.0);
        else col += vec3(1.0, 0.9, 0.6) * 0.25 * exp(-m * 9.0);
      } else {
        vec2 l = vec2(dot(dir, su), dot(dir, sv)) / -dp;
        float m = max(abs(l.x), abs(l.y));
        if (m < 0.055) {
          float crater = hash(floor(l * 60.0));
          col = mix(col, vec3(0.86, 0.88, 0.95) - crater * 0.12, 1.0);
        }
      }
      // nuages cubiques
      if (h > 0.015 && uClouds > 0.5) {
        float t = (118.0 - uCamPos.y) / h;
        if (t > 0.0) {
          vec2 cp = uCamPos.xz + dir.xz * t;
          vec2 cell = floor(cp / 14.0 + vec2(uTime * 0.035, 0.0));
          float n = hash(cell) * 0.55 + hash(floor(cell / 4.0) + 9.0) * 0.6;
          if (n > 0.78) {
            float fade = 1.0 - smoothstep(350.0, 900.0, t);
            vec3 cc = mix(vec3(0.07, 0.08, 0.13), vec3(1.0), 1.0 - uNight * 0.93);
            col = mix(col, cc, 0.85 * fade);
          }
        }
      }
      if (uUnderwater > 0.5) col = vec3(0.1, 0.22, 0.45);
      outColor = vec4(col, 1.0);
    }`;

  const LINE_VS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    uniform mat4 uViewProj;
    void main() { gl_Position = uViewProj * vec4(aPos, 1.0); }`;
  const LINE_FS = `#version 300 es
    precision highp float;
    uniform vec4 uColor;
    out vec4 outColor;
    void main() { outColor = uColor; }`;

  function compile(gl, vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  // Géométrie dynamique (entités, particules, main, corde...) : 10 flottants par sommet.
  class Batch {
    constructor() {
      this.data = new Float32Array(10 * 4 * 2048);
      this.n = 0; // quads
      this.ox = 0; this.oy = 0; this.oz = 0; // origine soustraite (position de la caméra)
    }
    reset(origin) {
      this.n = 0;
      if (origin) {
        this.ox = origin[0]; this.oy = origin[1]; this.oz = origin[2];
      }
    }
    ensure() {
      if ((this.n + 1) * 40 > this.data.length) {
        const d = new Float32Array(this.data.length * 2);
        d.set(this.data);
        this.data = d;
      }
    }
    // p: 4 positions [x,y,z], uv: 4 [u,v]
    quad(p, uv, layer, sky, blk, shade, flags) {
      this.ensure();
      const d = this.data;
      let o = this.n * 40;
      for (let k = 0; k < 4; k++) {
        d[o++] = p[k][0] - this.ox; d[o++] = p[k][1] - this.oy; d[o++] = p[k][2] - this.oz;
        d[o++] = uv[k][0]; d[o++] = uv[k][1]; d[o++] = layer;
        d[o++] = sky; d[o++] = blk; d[o++] = shade; d[o++] = flags;
      }
      this.n++;
    }
    // Boîte transformée par la matrice m (colonne-majeure). layers: nombre ou tableau de 6.
    box(m, x0, y0, z0, x1, y1, z1, layers, sky, blk, flags, uvr, faceFlags) {
      const tf = (x, y, z) => [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
      const shades = [0.7, 0.7, 1.0, 0.55, 0.85, 0.85];
      const u0 = uvr ? uvr[0] : 0, v0 = uvr ? uvr[1] : 0, u1 = uvr ? uvr[2] : 1, v1 = uvr ? uvr[3] : 1;
      for (let fi = 0; fi < 6; fi++) {
        const f = CM.FACES[fi];
        const layer = typeof layers === 'number' ? layers : layers[fi];
        if (layer < 0) continue;
        const ps = [], uvs = [];
        for (let k = 0; k < 4; k++) {
          const v = f.v[k];
          ps.push(tf(v[0] ? x1 : x0, v[1] ? y1 : y0, v[2] ? z1 : z0));
          uvs.push([v[3] ? u1 : u0, v[4] ? v1 : v0]);
        }
        this.quad(ps, uvs, layer, sky, blk, shades[fi], faceFlags ? faceFlags[fi] : flags);
      }
    }
  }
  CM.Batch = Batch;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL2 indisponible');
      this.gl = gl;
      this.chunk = compile(gl, CHUNK_VS, CHUNK_FS);
      this.ent = compile(gl, ENT_VS, ENT_FS);
      this.sky = compile(gl, SKY_VS, SKY_FS);
      this.line = compile(gl, LINE_VS, LINE_FS);
      this.proj = mat4.create();
      this.view = mat4.create();
      this.viewProj = mat4.create();
      this.invVP = mat4.create();
      this.tmp = mat4.create();
      this.planes = [];
      this.sections = new Map();
      this.renderDist = 6;
      this.fov = 75;
      this.resolution = 1;
      this.brightness = 0.3;
      this.clouds = true;
      this.batch = new Batch();
      this.overlay = new Batch();
      this.hand = new Batch();
      this.stats = { sections: 0, drawn: 0, quads: 0 };
      this.initTexture();
      this.initBuffers();
      this.skyVao = gl.createVertexArray();
      this.env = null;
    }

    initTexture() {
      const gl = this.gl;
      const T = CM.Textures;
      const n = T.count();
      const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
      if (n > maxLayers) throw new Error('trop de textures pour cette carte graphique (' + n + ' > ' + maxLayers + ')');
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.pixels());
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 3);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      this.texture = tex;
    }

    initBuffers() {
      const gl = this.gl;
      this.ibo = gl.createBuffer();
      this.iboQuads = 0;
      this.ensureIndices(1 << 15);
      // entités / géométrie dynamique
      this.entVbo = gl.createBuffer();
      this.entVao = gl.createVertexArray();
      gl.bindVertexArray(this.entVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entVbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindVertexArray(null);
      // lignes
      this.lineVbo = gl.createBuffer();
      this.lineVao = gl.createVertexArray();
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.bindVertexArray(null);
    }

    ensureIndices(quads) {
      if (quads <= this.iboQuads) return;
      let q = Math.max(this.iboQuads, 1024);
      while (q < quads) q *= 2;
      const idx = new Uint32Array(q * 6);
      for (let i = 0; i < q; i++) {
        idx[i * 6] = i * 4;
        idx[i * 6 + 1] = i * 4 + 1;
        idx[i * 6 + 2] = i * 4 + 2;
        idx[i * 6 + 3] = i * 4;
        idx[i * 6 + 4] = i * 4 + 2;
        idx[i * 6 + 5] = i * 4 + 3;
      }
      const gl = this.gl;
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      this.iboQuads = q;
    }

    // ------------------------------------------------------- sections ----
    makeMesh(mesh) {
      const gl = this.gl;
      this.ensureIndices(mesh.quads);
      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      const S = CM.VERTEX_STRIDE;
      gl.vertexAttribIPointer(0, 4, gl.SHORT, S, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.UNSIGNED_SHORT, false, S, 8);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, S, 10);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindVertexArray(null);
      return { vao, vbo, quads: mesh.quads };
    }
    freeMesh(m) {
      if (!m) return;
      this.gl.deleteVertexArray(m.vao);
      this.gl.deleteBuffer(m.vbo);
    }
    freeSection(k) {
      const sec = this.sections.get(k);
      if (!sec) return;
      this.freeMesh(sec.opaque);
      this.freeMesh(sec.water);
      this.sections.delete(k);
    }
    freeAll() {
      for (const k of [...this.sections.keys()]) this.freeSection(k);
    }
    buildSection(world, cx, sy, cz, k) {
      const m = CM.Mesher.build(world, cx, sy, cz);
      this.freeSection(k);
      this.sections.set(k, {
        opaque: m.opaque ? this.makeMesh(m.opaque) : null,
        water: m.water ? this.makeMesh(m.water) : null,
        cx, sy, cz,
      });
      world.dirty.delete(k);
    }

    // Construit les sections manquantes/modifiées autour du joueur, les plus proches d'abord.
    // Renvoie le nombre de sections encore à construire.
    updateMeshes(world, px, pz, budgetMs) {
      const t0 = performance.now();
      const rd = this.renderDist;
      const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
      const keep2 = (rd + 2) * (rd + 2);
      for (const [k, sec] of this.sections) {
        const dx = sec.cx - pcx, dz = sec.cz - pcz;
        if (dx * dx + dz * dz > keep2 || !world.chunks.has(CM.ckey(sec.cx, sec.cz))) this.freeSection(k);
      }
      const cand = [];
      const r2 = (rd + 0.5) * (rd + 0.5);
      for (let dz = -rd; dz <= rd; dz++)
        for (let dx = -rd; dx <= rd; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          const cx = pcx + dx, cz = pcz + dz;
          if (!world.meshable(cx, cz)) continue;
          for (let sy = 0; sy < SY; sy++) {
            const k = CM.skey(cx, sy, cz);
            const lvl = world.dirty.get(k) || 0;
            if (lvl === 2) {
              this.buildSection(world, cx, sy, cz, k);
              continue;
            }
            if (lvl || !this.sections.has(k)) cand.push([d2, cx, sy, cz, k]);
          }
        }
      cand.sort((a, b) => a[0] - b[0]);
      let built = 0;
      for (const [, cx, sy, cz, k] of cand) {
        if (built > 0 && performance.now() - t0 > budgetMs) break;
        this.buildSection(world, cx, sy, cz, k);
        built++;
      }
      return cand.length - built;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.resolution || 1);
      const w = Math.floor(this.canvas.clientWidth * dpr);
      const h = Math.floor(this.canvas.clientHeight * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    // --------------------------------------------------------- rendu -----
    setCommon(prog, env) {
      const gl = this.gl;
      const u = prog.u;
      gl.uniform1f(u.uDay, env.day);
      gl.uniform1f(u.uBright, this.brightness);
      gl.uniform3fv(u.uSkyTint, env.skyTint);
      gl.uniform4fv(u.uHeld, env.held);
      gl.uniform3fv(u.uFogColor, env.fogColor);
      gl.uniform2fv(u.uFog, env.fog);
      gl.uniform3fv(u.uCam, env.cam);
      if (u.uTex) gl.uniform1i(u.uTex, 0);
    }

    uploadBatch(batch) {
      const gl = this.gl;
      this.ensureIndices(batch.n);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entVbo);
      gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.n * 40), gl.STREAM_DRAW);
    }

    drawBatch(batch, viewProj, env, opts) {
      if (!batch.n) return;
      const gl = this.gl;
      const pr = this.ent;
      gl.useProgram(pr.p);
      this.setCommon(pr, env);
      gl.uniformMatrix4fv(pr.u.uViewProj, false, viewProj);
      gl.uniform2fv(pr.u.uScroll, (opts && opts.scroll) || [0, 0]);
      gl.uniform1f(pr.u.uAlphaMul, (opts && opts.alpha) || 1);
      gl.uniform1f(pr.u.uNoFog, opts && opts.noFog ? 1 : 0);
      gl.bindVertexArray(this.entVao);
      this.uploadBatch(batch);
      gl.drawElements(gl.TRIANGLES, batch.n * 6, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    render(state) {
      const gl = this.gl;
      // Rendu relatif à la caméra : les coordonnées envoyées au GPU restent petites
      // même très loin de l'origine (pas de tremblement dû à la précision des flottants).
      const cam = state.cam;
      const env = Object.assign({}, state.env, {
        cam: [0, 0, 0],
        held: [state.env.held[0] - cam[0], state.env.held[1] - cam[1], state.env.held[2] - cam[2], state.env.held[3]],
      });
      this.resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const aspect = this.canvas.width / this.canvas.height;
      const far = (this.renderDist + 1) * 16 + 40;
      mat4.perspective(this.proj, (state.fov * Math.PI) / 180, aspect, 0.05, Math.max(far, 300));
      mat4.fps(this.view, 0, 0, 0, state.yaw, state.pitch);
      mat4.multiply(this.viewProj, this.proj, this.view);
      CM.frustumPlanes(this.viewProj, this.planes);

      gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);

      // Ciel
      mat4.fps(this.tmp, 0, 0, 0, state.yaw, state.pitch);
      mat4.multiply(this.tmp, this.proj, this.tmp);
      mat4.invert(this.invVP, this.tmp);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(this.sky.p);
      const su = this.sky.u;
      gl.uniformMatrix4fv(su.uInvVP, false, this.invVP);
      gl.uniform3fv(su.uSunDir, env.sunDir);
      gl.uniform3fv(su.uZenith, env.zenith);
      gl.uniform3fv(su.uHorizon, env.horizon);
      gl.uniform1f(su.uNight, env.night);
      gl.uniform1f(su.uSunset, env.sunset);
      gl.uniform1f(su.uTime, env.time);
      gl.uniform3f(su.uCamPos, cam[0] % 14000, cam[1], cam[2] % 14000);
      gl.uniform1f(su.uUnderwater, env.underwater ? 1 : 0);
      gl.uniform1f(su.uClouds, this.clouds ? 1 : 0);
      gl.bindVertexArray(this.skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      // Sections opaques
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
      const cp = this.chunk;
      gl.useProgram(cp.p);
      this.setCommon(cp, env);
      gl.uniformMatrix4fv(cp.u.uViewProj, false, this.viewProj);
      gl.uniform1f(cp.u.uTime, env.time);
      gl.uniform1f(cp.u.uWater, 0);
      gl.uniform1f(cp.u.uWaving, CM.Mesher.opts.waving ? 1 : 0);
      gl.uniform2f(cp.u.uWaveOrigin, cam[0] % ((2 * Math.PI * 1000) / 1.3), cam[2] % ((2 * Math.PI * 1000) / 1.1));
      let drawn = 0, quads = 0;
      const waterList = [];
      for (const sec of this.sections.values()) {
        if (!sec.opaque && !sec.water) continue;
        const x0 = sec.cx * 16 - cam[0], y0 = sec.sy * 16 - cam[1], z0 = sec.cz * 16 - cam[2];
        if (!CM.aabbInFrustum(this.planes, x0, y0, z0, x0 + 16, y0 + 16, z0 + 16)) continue;
        if (sec.water) {
          const dx = x0 + 8, dy = y0 + 8, dz = z0 + 8;
          waterList.push([dx * dx + dy * dy + dz * dz, sec, x0, y0, z0]);
        }
        if (!sec.opaque) continue;
        gl.uniform3f(cp.u.uOffset, x0, y0, z0);
        gl.bindVertexArray(sec.opaque.vao);
        gl.drawElements(gl.TRIANGLES, sec.opaque.quads * 6, gl.UNSIGNED_INT, 0);
        drawn++;
        quads += sec.opaque.quads;
      }
      gl.bindVertexArray(null);
      this.stats.drawn = drawn;
      this.stats.quads = quads;

      // Entités, objets, particules
      gl.disable(gl.CULL_FACE);
      this.drawBatch(state.batch, this.viewProj, env);

      // Contour du bloc visé + fissures
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (state.target) this.drawOutline(state.target, cam);
      if (state.overlay.n) {
        gl.depthMask(false);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-1, -2);
        this.drawBatch(state.overlay, this.viewProj, env);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.depthMask(true);
      }

      // Eau, glace et verre teinté (transparents, de l'arrière vers l'avant).
      // Faces arrière masquées : un bloc translucide ne montre pas ses faces cachées.
      waterList.sort((a, b) => b[0] - a[0]);
      gl.depthMask(false);
      gl.enable(gl.CULL_FACE);
      gl.useProgram(cp.p);
      gl.uniform1f(cp.u.uWater, 1);
      for (const [, sec, x0, y0, z0] of waterList) {
        gl.uniform3f(cp.u.uOffset, x0, y0, z0);
        gl.bindVertexArray(sec.water.vao);
        gl.drawElements(gl.TRIANGLES, sec.water.quads * 6, gl.UNSIGNED_INT, 0);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.CULL_FACE);
      if (state.translucent && state.translucent.n) this.drawBatch(state.translucent, this.viewProj, env, { alpha: 0.85 });
      gl.depthMask(true);

      // Main / objet tenu
      if (state.hand && state.hand.n) {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.BLEND);
        mat4.perspective(this.tmp, (70 * Math.PI) / 180, aspect, 0.01, 10);
        this.drawBatch(state.hand, this.tmp, Object.assign({}, env, { held: [0, 0, 0, env.held[3]] }), { noFog: true });
      }
      gl.disable(gl.BLEND);
    }

    drawOutline(t, cam) {
      const gl = this.gl;
      const e = 0.003;
      const x0 = t.x - cam[0] - e, y0 = t.y - cam[1] - e, z0 = t.z - cam[2] - e;
      const x1 = x0 + 1 + 2 * e, y1 = y0 + (t.h || 1) + 2 * e, z1 = z0 + 1 + 2 * e;
      const v = [
        x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
        x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
        x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1,
      ];
      gl.useProgram(this.line.p);
      gl.uniformMatrix4fv(this.line.u.uViewProj, false, this.viewProj);
      gl.uniform4f(this.line.u.uColor, 0, 0, 0, 0.65);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STREAM_DRAW);
      gl.drawArrays(gl.LINES, 0, 24);
      gl.bindVertexArray(null);
    }
  }

  CM.Renderer = Renderer;
})();
