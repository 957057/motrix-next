/**
 * WebGL2 compositor.
 *
 *   sub-frames (Canvas2D) ──► linear accumulation (RGBA16F) = motion blur
 *                          ──► bloom (soft-threshold prefilter + dual-Kawase pyramid)
 *                          ──► lens pass: chromatic aberration, flash, grade,
 *                              highlight shoulder, vignette, grain, dither
 *
 * Every effect acts on the whole frame, text and UI included, so the film reads
 * as one photographed image rather than layered graphics.
 */

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const ACCUM = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform float weight;
out vec4 o;
void main() {
  vec3 c = texture(src, uv).rgb;
  o = vec4(pow(c, vec3(2.2)) * weight, weight);
}`

const PREFILTER = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
out vec4 o;
void main() {
  // Colour: the 2x2 block under this half-resolution texel.
  vec3 c = texture(src, uv + vec2(-texel.x, -texel.y) * 0.5).rgb
         + texture(src, uv + vec2( texel.x, -texel.y) * 0.5).rgb
         + texture(src, uv + vec2(-texel.x,  texel.y) * 0.5).rgb
         + texture(src, uv + vec2( texel.x,  texel.y) * 0.5).rgb;
  c *= 0.25;
  // Key: mean brightness over a 16x16 neighbourhood. Thin strokes (text, UI
  // hairlines) cover little of it and stay below the threshold, so type stays
  // crisp while broad light sources still bloom.
  float key = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec3 s = texture(src, uv + vec2(float(i) * 4.0 - 6.0, float(j) * 4.0 - 6.0) * texel).rgb;
      key += max(s.r, max(s.g, s.b));
    }
  }
  key *= 1.0 / 16.0;
  float soft = clamp(key - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, key - threshold) / max(key, 1e-4);
  o = vec4(c * contrib, 1.0);
}`

const DOWN = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform vec2 texel;
out vec4 o;
void main() {
  vec3 s = texture(src, uv).rgb * 4.0;
  s += texture(src, uv - texel).rgb;
  s += texture(src, uv + texel).rgb;
  s += texture(src, uv + vec2(texel.x, -texel.y)).rgb;
  s += texture(src, uv - vec2(texel.x, -texel.y)).rgb;
  o = vec4(s / 8.0, 1.0);
}`

const UP = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform sampler2D base;
uniform vec2 texel;
out vec4 o;
void main() {
  vec3 s = texture(src, uv + vec2(-texel.x * 2.0, 0.0)).rgb;
  s += texture(src, uv + vec2(-texel.x, texel.y)).rgb * 2.0;
  s += texture(src, uv + vec2(0.0, texel.y * 2.0)).rgb;
  s += texture(src, uv + vec2(texel.x, texel.y)).rgb * 2.0;
  s += texture(src, uv + vec2(texel.x * 2.0, 0.0)).rgb;
  s += texture(src, uv + vec2(texel.x, -texel.y)).rgb * 2.0;
  s += texture(src, uv + vec2(0.0, -texel.y * 2.0)).rgb;
  s += texture(src, uv + vec2(-texel.x, -texel.y)).rgb * 2.0;
  o = vec4(s / 12.0 + texture(base, uv).rgb, 1.0);
}`

const COMPOSITE = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform vec2 res;
uniform float bloomStrength;
uniform float aberration;
uniform float vignette;
uniform float grain;
uniform float grainSize;
uniform float exposure;
uniform float saturation;
uniform float contrast;
uniform float flash;
uniform vec3 flashColor;
uniform vec3 tint;
uniform float seed;
out vec4 o;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 shoulder(vec3 c) {
  // Identity below 0.8 (brand colours untouched), smooth roll-off above.
  vec3 k = max(c - 0.8, 0.0);
  return min(c, 0.8) + 0.2 * (k / (k + 0.2)) * 1.25;
}

void main() {
  vec2 d = uv - 0.5;
  d.x *= res.x / res.y;
  float r2 = dot(d, d);
  // Lateral chromatic aberration in pixels (1080p reference) at the frame
  // corners. The centre 35% of the frame is untouched so type stays sharp.
  vec2 px = (uv - 0.5) * res;
  float pl = length(px);
  float edge = smoothstep(0.35, 1.0, pl / (0.5 * length(res)));
  vec2 off = (pl > 1e-3 ? px / pl : vec2(0.0)) * aberration * (res.y / 1080.0) * edge * edge / res;
  vec3 c;
  c.r = texture(scene, uv - off).r;
  c.g = texture(scene, uv).g;
  c.b = texture(scene, uv + off).b;
  // The pyramid sums every level, so normalise by the level count.
  c += texture(bloom, uv).rgb * bloomStrength * 0.18;
  c = c * exposure * tint + flashColor * flash;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.18) * contrast + 0.18;
  c = shoulder(max(c, 0.0));
  c *= 1.0 - vignette * smoothstep(0.35, 1.25, sqrt(r2) * 1.25);
  c = pow(c, vec3(1.0 / 2.2));
  vec2 gp = floor(gl_FragCoord.xy / grainSize);
  float n = hash12(gp + seed * vec2(17.13, 91.71)) + hash12(gp * 1.37 + seed * vec2(51.3, 7.9)) - 1.0;
  float ld = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Grain sits in the shadows; bright type and UI stay clean.
  c += n * grain * (1.0 - 0.85 * ld);
  c += (hash12(gl_FragCoord.xy + seed * 3.7) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

/**
 * Defaults. `aberration` is the channel offset in pixels at the frame corners
 * (1080p reference); keep it below 1 except for brief impact pulses.
 */
export const DEFAULT_POST = Object.freeze({
  bloom: 0.55,
  threshold: 0.62,
  knee: 0.12,
  aberration: 0.6,
  vignette: 0.32,
  grain: 0.03,
  exposure: 1,
  saturation: 1,
  contrast: 1,
  flash: 0,
  flashColor: [1, 0.93, 1],
  tint: [1, 1, 1],
})

const LEVELS = 6

export class Post {
  constructor(canvas, width, height) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 is not available in this browser')
    this.gl = gl
    this.canvas = canvas
    this.float = Boolean(gl.getExtension('EXT_color_buffer_float'))
    if (!this.float) console.warn('EXT_color_buffer_float missing: falling back to 8-bit accumulation')
    gl.getExtension('OES_texture_float_linear')

    this.programs = {
      accum: this.#program(ACCUM),
      prefilter: this.#program(PREFILTER),
      down: this.#program(DOWN),
      up: this.#program(UP),
      composite: this.#program(COMPOSITE),
    }
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.src = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.src)
    this.#params()
    this.resize(width, height)
  }

  #program(fs) {
    const gl = this.gl
    const compile = (type, code) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, code)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
      return s
    }
    const p = gl.createProgram()
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(p, 0, 'p')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error')
    const uniforms = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)
      uniforms[info.name] = gl.getUniformLocation(p, info.name)
    }
    return { p, u: uniforms }
  }

  #params() {
    const gl = this.gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  #target(w, h) {
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    this.#params()
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fbo, w, h }
  }

  resize(width, height) {
    const gl = this.gl
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    for (const t of [this.accum, ...(this.down ?? []), ...(this.up ?? [])]) {
      if (!t) continue
      gl.deleteTexture(t.tex)
      gl.deleteFramebuffer(t.fbo)
    }
    this.accum = this.#target(width, height)
    this.down = []
    this.up = []
    let w = width
    let h = height
    for (let i = 0; i < LEVELS; i++) {
      w = Math.max(1, w >> 1)
      h = Math.max(1, h >> 1)
      this.down.push(this.#target(w, h))
      if (i < LEVELS - 1) this.up.push(this.#target(w, h))
    }
  }

  #draw(prog, target, bind) {
    const gl = this.gl
    gl.useProgram(prog.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null)
    gl.viewport(0, 0, target ? target.w : this.width, target ? target.h : this.height)
    bind(prog.u)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  #tex(unit, tex, loc) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(loc, unit)
  }

  begin() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fbo)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** Add one Canvas2D sub-frame to the accumulation buffer. */
  add(source, weight) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.src)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    this.#draw(this.programs.accum, this.accum, (u) => {
      this.#tex(0, this.src, u.src)
      gl.uniform1f(u.weight, weight)
    })
    gl.disable(gl.BLEND)
  }

  /** Bloom and lens pass to the visible canvas. */
  finish(params, seed = 0) {
    const gl = this.gl
    const P = { ...DEFAULT_POST, ...params }
    const { prefilter, down, up, composite } = this.programs

    this.#draw(prefilter, this.down[0], (u) => {
      this.#tex(0, this.accum.tex, u.src)
      gl.uniform2f(u.texel, 1 / this.width, 1 / this.height)
      gl.uniform1f(u.threshold, P.threshold)
      gl.uniform1f(u.knee, P.knee)
    })
    for (let i = 1; i < LEVELS; i++) {
      const src = this.down[i - 1]
      this.#draw(down, this.down[i], (u) => {
        this.#tex(0, src.tex, u.src)
        gl.uniform2f(u.texel, 1 / src.w, 1 / src.h)
      })
    }
    let small = this.down[LEVELS - 1]
    for (let i = LEVELS - 2; i >= 0; i--) {
      const target = this.up[i]
      const base = this.down[i]
      const src = small
      this.#draw(up, target, (u) => {
        this.#tex(0, src.tex, u.src)
        this.#tex(1, base.tex, u.base)
        gl.uniform2f(u.texel, 0.5 / src.w, 0.5 / src.h)
      })
      small = target
    }

    this.#draw(composite, null, (u) => {
      this.#tex(0, this.accum.tex, u.scene)
      this.#tex(1, this.up[0].tex, u.bloom)
      gl.uniform2f(u.res, this.width, this.height)
      gl.uniform1f(u.bloomStrength, P.bloom)
      gl.uniform1f(u.aberration, P.aberration)
      gl.uniform1f(u.vignette, P.vignette)
      gl.uniform1f(u.grain, P.grain)
      gl.uniform1f(u.grainSize, Math.max(1, Math.round(this.height / 1080)))
      gl.uniform1f(u.exposure, P.exposure)
      gl.uniform1f(u.saturation, P.saturation)
      gl.uniform1f(u.contrast, P.contrast)
      gl.uniform1f(u.flash, P.flash)
      gl.uniform3fv(u.flashColor, P.flashColor)
      gl.uniform3fv(u.tint, P.tint)
      gl.uniform1f(u.seed, (seed % 997) + 1)
    })
  }

  /** Read the finished frame as tightly packed RGB, bottom row first. */
  readRGB(out) {
    const gl = this.gl
    const n = this.width * this.height
    const rgba = this.rgba && this.rgba.length === n * 4 ? this.rgba : (this.rgba = new Uint8Array(n * 4))
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
    const rgb = out && out.length === n * 3 ? out : new Uint8Array(n * 3)
    for (let i = 0, j = 0; i < n * 4; i += 4, j += 3) {
      rgb[j] = rgba[i]
      rgb[j + 1] = rgba[i + 1]
      rgb[j + 2] = rgba[i + 2]
    }
    return rgb
  }
}
