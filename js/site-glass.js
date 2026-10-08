var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
  const SURFACE_SELECTOR = [
    ".site-header",
    ".chapter-rail",
    ".mobile-rail-toggle",
    ".hero-module",
    ".chapter-hero-visual",
    ".liquid-panel",
    ".liquid-button",
    ".top-action",
    ".glass-toolbar .brand",
    ".glass-toolbar .chapter-title",
    ".rail-item",
    ".segmented",
    ".derivation-controls",
    ".search-panel",
    ".section-header",
    ".content-section > .prose",
    ".feature-figure",
    ".formula-card",
    ".derivation",
    ".reading-callout",
    ".concept-check",
    ".unit-switch-panel",
    ".split-explanation",
    ".inverse-lab",
    ".knowledge-map",
    ".chapter-summary",
    ".exercise-card",
    ".completion-panel",
    ".source-note",
    ".lab-grid",
    ".compact-lab",
    ".lj-lab",
    ".companion-lab",
    ".learning-contract",
    ".reasoning-chain",
    ".worked-example",
    ".pitfall-card",
    ".symbol-card",
    ".chapter-menu",
    ".chapter-menu-trigger",
    ".text-button"
  ].join(",");
  const MAX_SURFACES = 40;
  const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const SHARED_GLASS_SHADER = `#version 300 es
precision highp float;
#define MAX_SURFACES ${MAX_SURFACES}
#define PI 3.14159265359

out vec4 fragColor;
uniform vec2 u_viewport;
uniform float u_dpr;
uniform int u_count;
uniform vec4 u_rects[MAX_SURFACES];
uniform float u_radii[MAX_SURFACES];
uniform vec4 u_optics[MAX_SURFACES];
uniform vec3 u_frost[MAX_SURFACES];
uniform float u_flags[MAX_SURFACES];
uniform vec2 u_pointer;
uniform float u_time;

/* Actual background-canvas sampling for visible refraction. */
uniform sampler2D u_background;
uniform float u_hasBackground;
uniform float u_theme;

float roundedRectSDF(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float surfaceSDF(vec2 cssPoint, vec4 rect, float radius) {
  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 halfSize = max(rect.zw * 0.5, vec2(1.0));
  float r = min(radius, min(halfSize.x, halfSize.y));
  return roundedRectSDF(cssPoint - center, halfSize, r);
}

vec2 safeNormalize(vec2 v) {
  float l = length(v);
  return l > 0.0001 ? v / l : vec2(1.0, 0.0);
}

/* Blur the scene BEFORE bending it. The rim and the central DOM material
   share the same CSS blur/saturation/brightness, not clear vs frosted glass. */
vec4 frostSample(vec2 uv, vec3 frost) {
  float textureScale = float(textureSize(u_background, 0).x) / max(u_viewport.x, 1.0);
  float lod = max(0.0, log2(max(frost.x * textureScale, 1.0)) - 1.0);
  vec2 aperture = vec2(1.41421356 * frost.x) / max(u_viewport, vec2(1.0));
  vec4 sampleValue = textureLod(u_background, clamp(uv, vec2(0.001), vec2(0.999)), lod) * 0.25;
  sampleValue += textureLod(u_background, clamp(uv + vec2(aperture.x, 0.0), vec2(0.001), vec2(0.999)), lod) * 0.125;
  sampleValue += textureLod(u_background, clamp(uv - vec2(aperture.x, 0.0), vec2(0.001), vec2(0.999)), lod) * 0.125;
  sampleValue += textureLod(u_background, clamp(uv + vec2(0.0, aperture.y), vec2(0.001), vec2(0.999)), lod) * 0.125;
  sampleValue += textureLod(u_background, clamp(uv - vec2(0.0, aperture.y), vec2(0.001), vec2(0.999)), lod) * 0.125;
  sampleValue += textureLod(u_background, clamp(uv + aperture, vec2(0.001), vec2(0.999)), lod) * 0.0625;
  sampleValue += textureLod(u_background, clamp(uv - aperture, vec2(0.001), vec2(0.999)), lod) * 0.0625;
  sampleValue += textureLod(u_background, clamp(uv + vec2(aperture.x, -aperture.y), vec2(0.001), vec2(0.999)), lod) * 0.0625;
  sampleValue += textureLod(u_background, clamp(uv + vec2(-aperture.x, aperture.y), vec2(0.001), vec2(0.999)), lod) * 0.0625;
  float luma = dot(sampleValue.rgb, vec3(0.2126, 0.7152, 0.0722));
  sampleValue.rgb = clamp(mix(vec3(luma), sampleValue.rgb, frost.y) * frost.z, 0.0, 1.0);
  return sampleValue;
}

void main() {
  vec2 cssPoint = vec2(
    gl_FragCoord.x / u_dpr,
    u_viewport.y - gl_FragCoord.y / u_dpr
  );

  int chosen = -1;
  float chosenDistance = 1e6;
  float bestScore = 1e6;
  float chosenPriority = -1.0;

  for (int i = 0; i < MAX_SURFACES; i++) {
    if (i >= u_count) break;
    float d = surfaceSDF(cssPoint, u_rects[i], u_radii[i]);
    if (d <= 0.75) {
      float score = abs(d);
      float priority = u_flags[i];
      if (priority > chosenPriority || (priority == chosenPriority && score < bestScore)) {
        bestScore = score;
        chosenPriority = priority;
        chosenDistance = d;
        chosen = i;
      }
    }
  }

  if (chosen < 0) {
    fragColor = vec4(0.0);
    return;
  }

  vec4 rect = u_rects[chosen];
  float radius = u_radii[chosen];
  vec4 optics = u_optics[chosen];
  vec3 frost = u_frost[chosen];
  float surfaceFlag = u_flags[chosen];
  float depth = max(-chosenDistance, 0.0);
  // Keep the whole reading area untouched, not just almost transparent.
  if (depth > optics.y) { fragColor = vec4(0.0); return; }

  /* SDF normal. */
  float eps = 0.8;
  float dx = surfaceSDF(cssPoint + vec2(eps, 0.0), rect, radius)
           - surfaceSDF(cssPoint - vec2(eps, 0.0), rect, radius);
  float dy = surfaceSDF(cssPoint + vec2(0.0, eps), rect, radius)
           - surfaceSDF(cssPoint - vec2(0.0, eps), rect, radius);
  vec2 normal = safeNormalize(vec2(dx, dy));

  /* Every side belongs to the same lens: dropping the bottom-facing part
     interrupted the bend through the lower rounded corners. */
  float opticalEdgeMask = 1.0;

  vec2 center = rect.xy + rect.zw * 0.5;
  vec2 centerDir = safeNormalize(cssPoint - center);
  vec2 bendDir = safeNormalize(mix(centerDir, normal, 0.78));

  float normalAngle = atan(normal.y, normal.x);
  float pointerAngle = atan(center.y - u_pointer.y, u_pointer.x - center.x);

  /*
   * Per-surface optics. The large content panels remain expressive, while the
   * site header, chapter rail and controls use much smaller optical ranges.
   * optics = vec4(refractionPx, refractionRangePx, fresnelRangePx, glareRangePx)
   */
  float fresnel = 1.0 - smoothstep(0.0, max(optics.z, 0.35), depth);
  fresnel = pow(fresnel, 2.10) * opticalEdgeMask;

  /* The main glint sits on the rounded corner facing a 45-degree light.
     Pointer motion only modulates it; it never paints a moving full-side rim. */
  vec2 lightDir = safeNormalize(vec2(-1.0, -1.0));
  float diagonalGlint = pow(max(dot(normal, lightDir), 0.0), 6.0);
  float farGlint = pow(max(dot(normal, -lightDir), 0.0), 8.0) * 0.13;
  float pointerGlint = 0.5 + 0.5 * cos(normalAngle - pointerAngle);
  float glare = (diagonalGlint + farGlint) * (0.86 + 0.14 * pointerGlint);
  glare *= (1.0 - smoothstep(0.0, max(optics.w, 0.25), depth)) * opticalEdgeMask;

  /* The same frost across the curved shoulder, with continuous displacement
     falloff into the undistorted native material. */
  float refractField = 1.0 - smoothstep(0.0, max(optics.y, 2.0), depth);
  refractField = pow(refractField, 0.88) * opticalEdgeMask;

  float refractionPx = optics.x * refractField;
  /* DOM/SDF y points down; the uploaded texture's UV y points up.
     Use the same conversion for bend, dispersion and the scatter aperture. */
  vec2 pxToUV = vec2(1.0 / max(u_viewport.x, 1.0), -1.0 / max(u_viewport.y, 1.0));
  vec2 refractionUV = bendDir * refractionPx * pxToUV;

  /*
   * Canvas texture is uploaded with UNPACK_FLIP_Y_WEBGL=true,
   * therefore gl_FragCoord-normalized UV aligns directly to the viewport.
   */
  vec2 baseUV = vec2(
    gl_FragCoord.x / (u_dpr * max(u_viewport.x, 1.0)),
    gl_FragCoord.y / (u_dpr * max(u_viewport.y, 1.0))
  );
  baseUV = clamp(baseUV, vec2(0.001), vec2(0.999));

  vec3 refracted = vec3(0.0);
  vec3 environment = mix(vec3(0.08), vec3(0.92), u_theme);
  float sampledAlpha = 0.0;
  if (u_hasBackground > 0.5) {
    /*
     * Real RGB dispersion. The channels sample three genuinely different
     * background positions, so the split is visible on lattice lines/atoms
     * without creating a synthetic coloured outline around empty glass.
     */
    float dispersionPx = min(0.95, optics.x * 0.065) * refractField;
    vec2 dispersionUV = bendDir * dispersionPx * pxToUV;

    vec2 uvR = clamp(baseUV + refractionUV * 1.035 + dispersionUV, vec2(0.001), vec2(0.999));
    vec2 uvG = clamp(baseUV + refractionUV,                  vec2(0.001), vec2(0.999));
    vec2 uvB = clamp(baseUV + refractionUV * 0.965 - dispersionUV, vec2(0.001), vec2(0.999));

    vec4 sampleR = frostSample(uvR, frost);
    vec4 sampleG = frostSample(uvG, frost);
    environment = frostSample(baseUV, frost).rgb;
    vec4 sampleB = frostSample(uvB, frost);
    sampledAlpha = max(max(sampleR.a, sampleG.a), sampleB.a);

    /*
     * Do NOT premultiply the separated RGB by sampledAlpha here.
     * Alpha is applied exactly once below through refractedAlpha.
     * Premultiplying twice was suppressing chromatic separation on the
     * semi-transparent lattice lines / atom halos.
     */
    vec3 separatedRGB = vec3(sampleR.r, sampleG.g, sampleB.b);

    refracted = separatedRGB;
  }

  /*
   * Critical light-theme fix: transparent regions of the lattice canvas must
   * contribute ZERO refracted alpha. Previously only RGB was alpha-gated, so
   * transparent black pixels still produced a broad grey/black optical band.
   */
  /* Flat areas remain almost invisible; an actual displaced line or colour
     patch produces the stronger optical response. */
  float displacedDetail = smoothstep(0.006, 0.055, length(refracted - environment));
  /* A strong sampled lens when a real line moves; nearly absent over a flat
     scene. Constant high alpha overlaid raw wallpaper on the DOM material
     and caused a dark inset outline around controls. */
  float refractedAlpha = min(0.92, u_hasBackground * refractField * sampledAlpha * mix(0.12, 0.92, displacedDetail));

  vec3 cool = vec3(0.42, 0.69, 1.00);
  vec3 warm = vec3(1.00, 0.80, 0.48);
  /* The thin reflection follows local environment luminance and surface
     orientation. No painted white side stripe or coloured outline. */
  float environmentLuma = dot(environment, vec3(0.2126, 0.7152, 0.0722));
  vec3 reflectedLight = mix(vec3(1.0), environment, 0.32);
  float incident = 0.22 + 0.78 * pow(max(dot(normal, lightDir), 0.0), 2.0);
  float compactGlint = surfaceFlag == 3.0 ? 1.45 : 1.0;
  vec3 highlight = reflectedLight * fresnel * incident * mix(0.036, 0.019, environmentLuma) * compactGlint;
  highlight += reflectedLight * glare * mix(0.067, 0.040, environmentLuma) * compactGlint;

  /* Light mode has no glass body tint. Dark mode retains only a trace. */
  vec3 darkTint = vec3(0.025, 0.030, 0.038);
  float darkTintStrength = 0.0;

  vec3 color = refracted * refractedAlpha;
  color += darkTint * darkTintStrength;
  color += highlight;

  float edgeAlpha = fresnel * incident * mix(0.014, 0.008, u_theme) + glare * mix(0.026, 0.018, u_theme);
  float alpha = refractedAlpha + darkTintStrength * 0.45 + edgeAlpha;
  /* Keep premultiplied RGB and alpha together, including subpixel coverage.
     Clamping only alpha made the rounded lens shoulder falsely brighten. */
  float coverage = 1.0 - smoothstep(-0.6, 0.6, chosenDistance);
  fragColor = vec4(color * coverage, clamp(alpha, 0.0, 1.0) * coverage);
}`;
  function compileProgram(gl, fragment, vertexSource = VERTEX_SHADER) {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create WebGL shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const pixel = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create WebGL program");
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Unknown WebGL link error";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return { program, uniforms: /* @__PURE__ */ new Map() };
  }
  function uniform(gl, info, name) {
    if (!info.uniforms.has(name)) info.uniforms.set(name, gl.getUniformLocation(info.program, name));
    return info.uniforms.get(name) ?? null;
  }
  let supportCache;
  function supportsStudioGlass() {
    if (supportCache !== void 0) return supportCache;
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      supportCache = Boolean(gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      supportCache = false;
    }
    return supportCache;
  }
  class SharedGlassRenderer {
    constructor() {
      __publicField(this, "canvas");
      __publicField(this, "gl");
      __publicField(this, "program");
      __publicField(this, "vao");
      __publicField(this, "buffer");
      __publicField(this, "backgroundTexture");
      __publicField(this, "pointerX", window.innerWidth * 0.72);
      __publicField(this, "pointerY", window.innerHeight * 0.18);
      __publicField(this, "backgroundFrame", "");
      __publicField(this, "backgroundCanvas", null);
      const canvas = document.createElement("canvas");
      canvas.className = "studio-glass-shared-canvas";
      canvas.dataset.opticsVersion = "crystal-glass-11";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
      this.canvas = canvas;
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance"
      });
      if (!gl) {
        canvas.remove();
        throw new Error("WebGL2 is unavailable");
      }
      this.gl = gl;
      this.program = compileProgram(gl, SHARED_GLASS_SHADER);
      const vao = gl.createVertexArray();
      const buffer = gl.createBuffer();
      if (!vao || !buffer) throw new Error("Unable to create shared WebGL geometry");
      this.vao = vao;
      this.buffer = buffer;
      const backgroundTexture = gl.createTexture();
      if (!backgroundTexture) throw new Error("Unable to create background texture");
      this.backgroundTexture = backgroundTexture;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(this.program.program, "a_position");
      gl.useProgram(this.program.program);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    setPointer(x, y) {
      this.pointerX = x;
      this.pointerY = y;
    }
    render(elements, time) {
      const gl = this.gl;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(window.innerWidth * dpr));
      const height = Math.max(1, Math.round(window.innerHeight * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${window.innerWidth}px`;
        this.canvas.style.height = `${window.innerHeight}px`;
      }
      const visible = elements.map((element) => ({ element, rect: element.getBoundingClientRect() })).filter(
        ({ rect }) => rect.width > 3 && rect.height > 3 && rect.bottom > -40 && rect.top < window.innerHeight + 40 && rect.right > -40 && rect.left < window.innerWidth + 40
      ).slice(0, MAX_SURFACES);
      const rectData = new Float32Array(MAX_SURFACES * 4);
      const radiusData = new Float32Array(MAX_SURFACES);
      const opticsData = new Float32Array(MAX_SURFACES * 4);
      const frostData = new Float32Array(MAX_SURFACES * 3);
      const flagData = new Float32Array(MAX_SURFACES);
      visible.forEach(({ element, rect }, index) => {
        rectData[index * 4] = rect.left;
        rectData[index * 4 + 1] = rect.top;
        rectData[index * 4 + 2] = rect.width;
        rectData[index * 4 + 3] = rect.height;
        const cssRadius = Number.parseFloat(getComputedStyle(element).borderRadius) || 18;
        radiusData[index] = Math.max(2, Math.min(cssRadius, rect.width * 0.5, rect.height * 0.5));
        const materialElement = element.dataset.glassLayer === "control" ? element.parentElement?.closest('[data-glass-layer="surface"]') ?? element : element;
        const filter = getComputedStyle(materialElement).backdropFilter;
        const filterValue = (name, fallback) => {
          const value = filter.match(new RegExp(`${name}\\(([^)]+)\\)`))?.[1];
          if (!value) return fallback;
          return Number.parseFloat(value) / (value.includes("%") ? 100 : 1);
        };
        frostData.set([filterValue("blur", 0), filterValue("saturate", 1), filterValue("brightness", 1)], index * 3);
        let refractionPx = window.innerWidth <= 700 ? 20 : 26;
        let refractionRange = window.innerWidth <= 700 ? 16 : 22;
        let fresnelRange = 1.4;
        let glareRange = 1;
        if (element.matches(".site-header, .header-wrapper, .chapter-rail")) {
          refractionPx = 18;
          refractionRange = 14;
          fresnelRange = 1.1;
          glareRange = 1.15;
        } else if (element.matches(".rail-item, .top-action, .liquid-button, .text-button, .segmented, .derivation-controls, .brand, .chapter-title, .chapter-menu-trigger, .mobile-rail-toggle, .header-center, .header-link, .tool-strip a")) {
          refractionPx = 18;
          refractionRange = 11;
          fresnelRange = 1.6;
          glareRange = 1.6;
        } else if (element.matches(".source-note")) {
          refractionPx = 5;
          refractionRange = 7;
          fresnelRange = 1.4;
          glareRange = 0.88;
        }
        refractionRange = Math.min(refractionRange, Math.min(rect.width, rect.height) * 0.22);
        opticsData[index * 4] = refractionPx;
        opticsData[index * 4 + 1] = refractionRange;
        opticsData[index * 4 + 2] = fresnelRange;
        opticsData[index * 4 + 3] = glareRange;
        flagData[index] = element.matches(".chapter-menu") ? 5 : element.matches(".search-panel") ? 4 : element.matches(".liquid-button,.top-action,.brand,.chapter-title,.chapter-menu-trigger,.mobile-rail-toggle,.header-center,.header-link,.tool-strip a") ? 3 : element.matches(".chapter-rail") ? 2 : element.matches(".site-header,.header-wrapper") ? 1 : 0;
      });
      const backgroundCanvas = document.querySelector(
        "canvas.lattice-atmosphere, canvas[data-testid='lattice-atmosphere']"
      );
      let hasBackground = 0;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
      if (backgroundCanvas && backgroundCanvas !== this.canvas && backgroundCanvas.width > 1 && backgroundCanvas.height > 1) {
        try {
          const backgroundFrame = backgroundCanvas.dataset.wallpaperFrame;
          if (!backgroundFrame || backgroundFrame !== this.backgroundFrame || backgroundCanvas !== this.backgroundCanvas) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              gl.RGBA,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              backgroundCanvas
            );
            gl.generateMipmap(gl.TEXTURE_2D);
            this.backgroundFrame = backgroundFrame || "";
            this.backgroundCanvas = backgroundCanvas;
          }
          hasBackground = 1;
        } catch {
          hasBackground = 0;
        }
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program.program);
      gl.bindVertexArray(this.vao);
      gl.uniform2f(uniform(gl, this.program, "u_viewport"), window.innerWidth, window.innerHeight);
      gl.uniform1f(uniform(gl, this.program, "u_dpr"), dpr);
      gl.uniform1i(uniform(gl, this.program, "u_count"), visible.length);
      gl.uniform4fv(uniform(gl, this.program, "u_rects[0]"), rectData);
      gl.uniform1fv(uniform(gl, this.program, "u_radii[0]"), radiusData);
      gl.uniform4fv(uniform(gl, this.program, "u_optics[0]"), opticsData);
      gl.uniform3fv(uniform(gl, this.program, "u_frost[0]"), frostData);
      gl.uniform1fv(uniform(gl, this.program, "u_flags[0]"), flagData);
      gl.uniform2f(uniform(gl, this.program, "u_pointer"), this.pointerX, this.pointerY);
      gl.uniform1f(uniform(gl, this.program, "u_time"), time);
      gl.uniform1i(uniform(gl, this.program, "u_background"), 0);
      gl.uniform1f(uniform(gl, this.program, "u_hasBackground"), hasBackground);
      gl.uniform1f(
        uniform(gl, this.program, "u_theme"),
        document.documentElement.dataset.theme === "light" ? 1 : 0
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
    dispose() {
      const gl = this.gl;
      gl.deleteProgram(this.program.program);
      gl.deleteBuffer(this.buffer);
      gl.deleteVertexArray(this.vao);
      gl.deleteTexture(this.backgroundTexture);
      this.canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
  function startGlassSystem(selector = SURFACE_SELECTOR) {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer = null;
    let elements = [];
    let frame = 0;
    let lastPaint = -Infinity;
    let scrollActiveUntil = 0;
    let disposed = false;
    const syncElements = () => {
      const candidates = Array.from(document.querySelectorAll(selector)).filter((element) => !element.matches(".hero-lead, .hero-lead-glass, .glass-toolbar"));
      const roots = new Set(candidates.filter((element) => !element.matches(".section-header,.source-note,.text-button")));
      candidates.forEach((element) => {
        element.dataset.liquidGlass = renderer ? "shared-webgl2" : "frosted";
        let parent = element.parentElement;
        while (parent && !roots.has(parent)) parent = parent.parentElement;
        const control = element.matches(".liquid-button,.top-action,.chapter-menu-trigger,.glass-toolbar .brand,.glass-toolbar .chapter-title");
        element.dataset.glassLayer = !roots.has(element) ? "plain" : parent ? control ? "control" : "embedded" : "surface";
      });
      document.querySelectorAll(".glass-toolbar").forEach((element) => {
        element.dataset.liquidGlass = renderer ? "shared-webgl2" : "frosted";
        element.dataset.glassLayer = "plain";
      });
      elements = candidates.filter((element) => element.dataset.glassLayer === "surface" || element.dataset.glassLayer === "control");
      document.documentElement.dataset.glassEngine = renderer ? "shared-webgl2" : "frosted";
    };
    if (supportsStudioGlass()) {
      try {
        renderer = new SharedGlassRenderer();
      } catch (error) {
        console.warn("Liquid Glass Studio shared WebGL2 fallback:", error);
        renderer = null;
      }
    }
    const render = (timestamp) => {
      frame = 0;
      if (disposed || document.hidden) return;
      if (renderer) renderer.canvas.style.display = "block";
      if (renderer) {
        const scrolling = timestamp <= scrollActiveUntil;
        const animating = elements.some((element) => element.matches(".chapter-menu") && element.getAnimations().some((animation) => animation.playState === "running"));
        if (motion.matches || scrolling || animating || timestamp - lastPaint >= 33) {
          lastPaint = timestamp;
          renderer.render(elements, motion.matches ? 0 : timestamp / 1e3);
        }
        if (!motion.matches || scrolling || animating) frame = requestAnimationFrame(render);
      }
    };
    const schedule = () => {
      syncElements();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const onScroll = () => {
      const now = performance.now();
      scrollActiveUntil = now + 180;
      if (!document.hidden) renderer?.render(elements, motion.matches ? 0 : now / 1e3);
      lastPaint = now;
      if (!frame) frame = requestAnimationFrame(render);
    };
    const onPointerMove = (event) => {
      renderer?.setPointer(event.clientX, event.clientY);
      if (!frame) frame = requestAnimationFrame(render);
    };
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    syncElements();
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      mutation.disconnect();
      theme.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      motion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
      document.querySelectorAll("[data-liquid-glass]").forEach((element) => {
        delete element.dataset.liquidGlass;
        delete element.dataset.glassLayer;
      });
      renderer?.dispose();
      delete document.documentElement.dataset.glassEngine;
    };
  }
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  function neighbors(atoms, length) {
    const pairs = [];
    atoms.forEach((a, i) => atoms.forEach((b, j) => {
      if (j > i && Math.abs(distance(a, b) - length) < 1e-6) pairs.push([i, j]);
    }));
    return pairs;
  }
  function diamondCell() {
    const atoms = [];
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) atoms.push({ x, y, z, tone: 0 });
    for (let axis = 0; axis < 3; axis++) for (const side of [0, 1]) {
      const p = [0.5, 0.5, 0.5];
      p[axis] = side;
      atoms.push({ x: p[0], y: p[1], z: p[2], tone: 0 });
    }
    for (const [x, y, z] of [[0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25]]) atoms.push({ x, y, z, tone: 1 });
    const frame = neighbors(atoms.slice(0, 8), 1);
    return { atoms: atoms.map((p) => ({ ...p, x: p.x - 0.5, y: p.y - 0.5, z: p.z - 0.5 })), bonds: neighbors(atoms, Math.sqrt(3) / 4), frame, radius: 0.068 };
  }
  function hcpCell() {
    const atoms = [], frame = [];
    const c = Math.sqrt(8 / 3);
    for (const y of [-c / 2, c / 2]) {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        atoms.push({ x: Math.cos(a), y, z: Math.sin(a), tone: 0 });
      }
      atoms.push({ x: 0, y, z: 0, tone: 0 });
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 6 + i * 2 * Math.PI / 3;
      atoms.push({ x: Math.cos(a) / Math.sqrt(3), y: 0, z: Math.sin(a) / Math.sqrt(3), tone: 1 });
    }
    for (let i = 0; i < 6; i++) frame.push([i, (i + 1) % 6], [i + 7, (i + 1) % 6 + 7], [i, i + 7]);
    return { atoms, bonds: neighbors(atoms, 1), frame, radius: 0.125 };
  }
  function startLatticeWallpaper(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return () => {
    };
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const cells = [diamondCell(), hcpCell()];
    let width = 0, height = 0, frame = 0, last = -Infinity, revision = 0;
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const planes = (light, t) => {
      const drift = Math.sin(t * 0.13) * Math.min(12, width * 0.02);
      const fills = light ? ["rgba(91,136,166,.10)", "rgba(78,130,162,.13)", "rgba(172,193,200,.12)"] : ["rgba(54,91,130,.28)", "rgba(52,103,139,.23)", "rgba(134,169,184,.12)"];
      const edge = light ? "rgba(73,111,140,.13)" : "rgba(164,202,220,.19)";
      const polygon = (points, fill) => {
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = edge;
        ctx.stroke();
      };
      const d = drift / Math.max(1, width);
      polygon([[-0.12, -0.1], [0.17 + d, -0.1], [0.29 + d, 0.21], [0.12, 0.54], [-0.12, 0.74]], fills[0]);
      polygon([[-0.13, 0.41], [0.13 + d, 0.22], [0.3, 0.44], [0.07, 0.81], [-0.13, 0.9]], fills[1]);
      polygon([[0.85, -0.11], [1.15, -0.1], [1.13, 0.65], [0.92 - d, 0.48], [0.77, 0.13]], fills[2]);
      polygon([[0.92 - d, 0.38], [1.14, 0.55], [1.09, 1.12], [0.76, 1.12], [0.72, 0.82]], fills[0]);
    };
    const lattice = (light, t) => {
      const step = width < 700 ? 64 : 78;
      const cols = width < 700 ? 3 : 5;
      const rows = Math.ceil(height / step) + 2;
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = light ? "rgba(49,101,135,.17)" : "rgba(159,203,225,.24)";
      ctx.fillStyle = light ? "rgba(51,107,143,.34)" : "rgba(168,207,226,.48)";
      for (const side of [-1, 1]) for (let row = -1; row < rows; row++) {
        const direction = side < 0 ? 1 : -1;
        const anchor = side < 0 ? -step : width + step;
        const y = row * step;
        for (let col = 0; col < cols; col++) {
          const x = anchor + direction * (col * step + (row & 1) * step * 0.5);
          const wave = Math.sin(col * 0.65 + row * 0.31 - t * 0.34) * 3;
          ctx.globalAlpha = Math.max(0.08, 1 - col * 0.24);
          if (col < cols - 1) {
            ctx.beginPath();
            ctx.moveTo(x, y + wave);
            ctx.lineTo(x + direction * step, y + Math.sin((col + 1) * 0.65 + row * 0.31 - t * 0.34) * 3);
            ctx.stroke();
          }
          if (row < rows - 1) {
            ctx.beginPath();
            ctx.moveTo(x, y + wave);
            const nextRowOffset = (row + 1 & 1) - (row & 1);
            ctx.lineTo(
              x + direction * nextRowOffset * step * 0.5,
              y + step + Math.sin(col * 0.65 + (row + 1) * 0.31 - t * 0.34) * 3
            );
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(x, y + wave, col ? 1.8 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    const phonon = (ink, t) => {
      const mobile = width < 700;
      for (let track = 0; track < 3; track++) {
        const baseline = height * 0.8 + track * (mobile ? 11 : 17);
        ctx.beginPath();
        for (let x = 0; x <= width + 5; x += 5) {
          const y = baseline + Math.sin(x * (mobile ? 0.017 : 0.01) - t * 0.28 + track * 0.43) * (mobile ? 9 : 15);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ink.wave;
        ctx.globalAlpha = track === 0 ? 0.7 : 0.38;
        ctx.lineWidth = track === 0 ? 1.2 : 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const crystal = (cell, cx, cy, size, yaw, tilt, ink) => {
      const project = (atom) => {
        const x = atom.x * Math.cos(yaw) + atom.z * Math.sin(yaw);
        const z = -atom.x * Math.sin(yaw) + atom.z * Math.cos(yaw);
        return { x: cx + x * size, y: cy + (atom.y * Math.cos(tilt) - z * Math.sin(tilt)) * size, z, tone: atom.tone };
      };
      const points = cell.atoms.map(project);
      for (const [pairs, stroke, lineWidth] of [[cell.frame, ink.frame, 0.8], [cell.bonds, ink.bond, 1.25]]) {
        ctx.beginPath();
        for (const [a, b] of pairs) {
          ctx.moveTo(points[a].x, points[a].y);
          ctx.lineTo(points[b].x, points[b].y);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      points.sort((a, b) => a.z - b.z).forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.9 + Math.max(-0.4, point.z * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = point.tone ? ink.alternate : ink.node;
        ctx.fill();
      });
    };
    const draw = (timestamp) => {
      frame = 0;
      if (document.hidden) return;
      if (!motion.matches && timestamp - last < 33) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = timestamp;
      const light = document.documentElement.dataset.theme === "light";
      const mobile = width < 700, t = motion.matches ? 0 : timestamp / 1e3;
      const ink = light ? { frame: "rgba(65,115,145,.25)", bond: "rgba(49,101,137,.49)", node: "#719bb4", alternate: "#bdaea0", wave: "rgba(48,102,137,.53)" } : { frame: "rgba(150,191,214,.29)", bond: "rgba(157,205,230,.66)", node: "#aacbdc", alternate: "#a8b8bb", wave: "rgba(165,207,227,.69)" };
      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, light ? "#e5edf2" : "#172b3e");
      background.addColorStop(0.46, light ? "#f0f3f5" : "#101c2b");
      background.addColorStop(1, light ? "#e8eef1" : "#1a2d3e");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      planes(light, t);
      lattice(light, t);
      phonon(ink, t);
      const size = mobile ? Math.min(142, width * 0.36) : Math.min(250, Math.max(170, width * 0.17));
      crystal(cells[0], width * (mobile ? -0.04 : 0.075), height * 0.31, size, 0.57 + t * 0.032, -0.27, ink);
      crystal(cells[1], width * (mobile ? 1.05 : 0.94), height * 0.67, size * 0.76, -0.31 - t * 0.028, 0.29, ink);
      canvas.dataset.wallpaperVersion = "crystal-planes-11";
      canvas.dataset.crystalCells = "diamond,hcp";
      canvas.dataset.wallpaperLoaded = "true";
      canvas.dataset.wallpaperFrame = String(++revision);
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      resize();
      last = -Infinity;
      frame = requestAnimationFrame(draw);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    addEventListener("resize", refresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    motion.addEventListener("change", refresh);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
      motion.removeEventListener("change", refresh);
    };
  }
  const selectors = ".site-header,.glass-toolbar .brand,.glass-toolbar .header-center,.glass-toolbar .header-link,.liquid-panel,.project-card,.tool-strip a,.card,.phase-panel,.reported-strip,.stats > div,.note-grid article,.header-wrapper,.home-post-item,.post-content-container,.post-content,.page-content,.archive-list,.category-list,.tag-list,.page-main-content-middle .main-content,.liquid-button,.top-action,.tip";
  const start = () => {
    if (document.querySelector("[data-wallpaper-version]")) return;
    const root = document.documentElement;
    const legacy = !root.dataset.theme;
    const theme = () => {
      if (legacy) root.dataset.theme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    };
    theme();
    document.querySelectorAll(".site-header").forEach((header) => header.classList.add("glass-toolbar"));
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/css/site-glass.css";
    style.dataset.siteGlassStyle = "";
    document.head.append(style);
    const canvas = document.createElement("canvas");
    canvas.id = "site-lattice-background";
    canvas.className = "lattice-atmosphere";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    startLatticeWallpaper(canvas);
    startGlassSystem(selectors);
    const optics = document.querySelector(".studio-glass-shared-canvas");
    if (optics) optics.id = "site-glass-optics";
    if (legacy) new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
