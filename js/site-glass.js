var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const FULL_LENS_SELECTOR = ".liquid-button,.top-action,.brand,.chapter-title,.chapter-menu-trigger,.mobile-rail-toggle,.header-center,.header-link,.tool-strip a,.segmented,.derivation-controls";
  const svgNode = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const supportsNativeBackdrop = () => /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) && !/CriOS|EdgiOS/.test(navigator.userAgent) && CSS.supports("backdrop-filter", "url(#glass-probe)");
  class NativeBackdrop {
    constructor() {
      __publicField(this, "svg", svgNode("svg", { "aria-hidden": "true", width: "0", height: "0" }));
      __publicField(this, "defs", svgNode("defs"));
      __publicField(this, "lenses", /* @__PURE__ */ new Map());
      __publicField(this, "sequence", 0);
      __publicField(this, "invalidated", false);
      this.svg.classList.add("studio-glass-filter-defs");
      this.svg.append(this.defs);
      document.body.append(this.svg);
    }
    update(element, width, height, radius, strength, range, filter) {
      const fullLens = element.matches(FULL_LENS_SELECTOR);
      element.dataset.lensCoverage = fullLens ? "full" : "shoulder";
      let lens = this.lenses.get(element);
      if (!lens) {
        const id = `studio-native-lens-${++this.sequence}`;
        const f = svgNode("filter", { id, x: "0", y: "0", width: "100%", height: "100%", filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
        const image = svgNode("feImage", { result: "lens-map", preserveAspectRatio: "none" });
        f.append(image, svgNode("feDisplacementMap", { in: "SourceGraphic", in2: "lens-map", scale: String(strength * 2), xChannelSelector: "R", yChannelSelector: "G" }));
        const layer = document.createElement("span");
        layer.className = "studio-glass-optics";
        layer.setAttribute("aria-hidden", "true");
        const shine = document.createElement("canvas");
        shine.className = "studio-glass-surface-canvas";
        layer.append(shine);
        element.append(layer);
        this.defs.append(f);
        lens = { filter: f, image, layer, shine, key: "" };
        this.lenses.set(element, lens);
        element.dataset.refractionSource = "dom-backdrop";
        element.style.setProperty("--glass-native-lens", `url("#${id}")`);
      }
      const key = [width, height, radius, strength, range, Number(fullLens)].map((v) => v.toFixed(1)).join(":");
      if (lens.key !== key) {
        lens.key = key;
        lens.filter.setAttribute("width", String(width));
        lens.filter.setAttribute("height", String(height));
        lens.image.setAttribute("width", String(width));
        lens.image.setAttribute("height", String(height));
        lens.filter.lastElementChild.setAttribute("scale", String(strength * 2));
        const scale = Math.min(1, 512 / width, 2048 / height), w = Math.max(1, Math.ceil(width * scale)), h = Math.max(1, Math.ceil(height * scale));
        const map = document.createElement("canvas");
        map.width = w;
        map.height = h;
        const ctx = map.getContext("2d"), pixels = ctx.createImageData(w, h);
        const glow = lens.shine;
        glow.width = w;
        glow.height = h;
        const glowCtx = glow.getContext("2d"), lights = glowCtx.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const px = (x + 0.5) / scale - width / 2, py = (y + 0.5) / scale - height / 2;
          const qx = Math.abs(px) - width / 2 + radius, qy = Math.abs(py) - height / 2 + radius;
          const ox = Math.max(qx, 0), oy = Math.max(qy, 0), length = Math.hypot(ox, oy);
          const distance = Math.min(Math.max(qx, qy), 0) + length - radius, depth = Math.max(0, -distance);
          let nx = length ? ox / length : qx > qy ? 1 : 0, ny = length ? oy / length : qy >= qx ? 1 : 0;
          nx *= Math.sign(px);
          ny *= Math.sign(py);
          const t = Math.min(1, depth / range), bend = Math.pow(1 - t * t * (3 - 2 * t), 0.88);
          const bodyX = fullLens ? Math.max(-24, Math.min(24, -px * 0.35)) + 2 : 0;
          const bodyY = fullLens ? Math.max(-15, Math.min(15, -py * 0.4)) - 1.5 : 0;
          const displacementX = nx * strength * bend + bodyX * (1 - bend);
          const displacementY = ny * strength * bend + bodyY * (1 - bend);
          const offset = (y * w + x) * 4;
          pixels.data[offset] = Math.round(127.5 + 127.5 * displacementX / strength);
          pixels.data[offset + 1] = Math.round(127.5 + 127.5 * displacementY / strength);
          pixels.data[offset + 2] = 128;
          pixels.data[offset + 3] = 255;
          const diagonal = Math.pow(Math.max(0, (-nx - ny) / Math.SQRT2), 6);
          const far = Math.pow(Math.max(0, (nx + ny) / Math.SQRT2), 8) * 0.13;
          const edge = Math.max(0, 1 - depth / 1.6), coverage = Math.max(0, Math.min(1, 0.5 - distance));
          lights.data[offset] = lights.data[offset + 1] = lights.data[offset + 2] = 255;
          lights.data[offset + 3] = Math.round(255 * coverage * (0.018 * Math.pow(edge, 2) + 0.16 * (diagonal + far) * edge));
        }
        ctx.putImageData(pixels, 0, 0);
        lens.image.setAttribute("href", map.toDataURL());
        glowCtx.putImageData(lights, 0, 0);
      }
      const material = filter === "none" ? "" : filter.replace(/url\([^)]*\)/g, "").trim();
      element.style.setProperty("--glass-native-frost", material || "blur(0px)");
      element.dataset.nativeLens = "true";
    }
    retain(elements) {
      for (const [element, lens] of this.lenses) if (!elements.has(element)) {
        lens.filter.remove();
        lens.layer.remove();
        element.style.removeProperty("--glass-native-lens");
        element.style.removeProperty("--glass-native-frost");
        delete element.dataset.nativeLens;
        delete element.dataset.refractionSource;
        delete element.dataset.lensCoverage;
        this.lenses.delete(element);
      }
    }
    invalidate() {
      this.invalidated = true;
    }
    beginFrame() {
      if (this.invalidated) {
        for (const element of this.lenses.keys()) delete element.dataset.nativeLens;
        this.invalidated = false;
      }
    }
    dispose() {
      this.retain(/* @__PURE__ */ new Set());
      this.svg.remove();
    }
  }
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
// 0 is the combined diagnostic pass; positive indices draw one local layer.
uniform int u_surfaceIndex;
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
    if (u_surfaceIndex > 0 && i != u_surfaceIndex - 1) continue;
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
  bool fullLens = surfaceFlag == 3.0;
  if (!fullLens && depth > optics.y) { fragColor = vec4(0.0); return; }

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
  if (fullLens) {
    vec2 body = clamp(-(cssPoint - center) * vec2(0.35, 0.40), vec2(-24.0,-15.0), vec2(24.0,15.0)) + vec2(2.0,-1.5);
    refractionUV = mix(body * pxToUV, refractionUV, refractField);
  }

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
  float coverageField = fullLens ? 1.0 : refractField;
  float response = fullLens ? 0.92 : mix(0.12, 0.92, displacedDetail);
  float refractedAlpha = min(0.92, u_hasBackground * coverageField * sampledAlpha * response);

  vec3 cool = vec3(0.42, 0.69, 1.00);
  vec3 warm = vec3(1.00, 0.80, 0.48);
  /* The thin reflection follows local environment luminance and surface
     orientation. No painted white side stripe or coloured outline. */
  float environmentLuma = dot(environment, vec3(0.2126, 0.7152, 0.0722));
  vec3 reflectedLight = mix(vec3(1.0), environment, 0.32);
  float incident = 0.22 + 0.78 * pow(max(dot(normal, lightDir), 0.0), 2.0);
  float compactGlint = surfaceFlag == 3.0 ? 1.45 : 1.0;
  vec3 highlight = reflectedLight * fresnel * incident * mix(0.052, 0.035, environmentLuma) * compactGlint;
  highlight += reflectedLight * glare * mix(0.18, 0.12, environmentLuma) * compactGlint;

  /* Light mode has no glass body tint. Dark mode retains only a trace. */
  vec3 darkTint = vec3(0.025, 0.030, 0.038);
  float darkTintStrength = 0.0;

  vec3 color = refracted * refractedAlpha;
  color += darkTint * darkTintStrength;
  color += highlight;

  float edgeAlpha = fresnel * incident * mix(0.020, 0.014, u_theme) + glare * mix(0.09, 0.065, u_theme) * compactGlint;
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
      __publicField(this, "native", supportsNativeBackdrop() ? new NativeBackdrop() : null);
      __publicField(this, "layers", /* @__PURE__ */ new Map());
      const canvas = document.createElement("canvas");
      canvas.className = "studio-glass-shared-canvas";
      canvas.dataset.opticsVersion = "crystal-glass-14";
      canvas.dataset.presentation = this.native ? "native-backdrop" : "element-attached";
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
    invalidateMaterial() {
      this.native?.invalidate();
    }
    render(elements, time) {
      this.native?.beginFrame();
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
      const visible = elements.map((element) => ({ element, rect: element.getBoundingClientRect(), style: getComputedStyle(element) })).filter(
        ({ rect }) => rect.width > 3 && rect.height > 3 && // Bake local native maps before a fast fling reaches the next unit.
        rect.bottom > -window.innerHeight && rect.top < window.innerHeight * 2 && rect.right > -40 && rect.left < window.innerWidth + 40
      ).slice(0, MAX_SURFACES);
      const rectData = new Float32Array(MAX_SURFACES * 4);
      const radiusData = new Float32Array(MAX_SURFACES);
      const opticsData = new Float32Array(MAX_SURFACES * 4);
      const frostData = new Float32Array(MAX_SURFACES * 3);
      const flagData = new Float32Array(MAX_SURFACES);
      visible.forEach(({ element, rect, style }, index) => {
        rectData[index * 4] = rect.left;
        rectData[index * 4 + 1] = rect.top;
        rectData[index * 4 + 2] = rect.width;
        rectData[index * 4 + 3] = rect.height;
        const cssRadius = Number.parseFloat(style.borderRadius) || 18;
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
          refractionPx = 26;
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
        flagData[index] = element.matches(".chapter-menu") ? 5 : element.matches(".search-panel") ? 4 : element.matches(".liquid-button,.top-action,.brand,.chapter-title,.chapter-menu-trigger,.mobile-rail-toggle,.header-center,.header-link,.tool-strip a,.segmented,.derivation-controls") ? 3 : element.matches(".chapter-rail") ? 2 : element.matches(".site-header,.header-wrapper") ? 1 : 0;
        if (this.native) {
          this.native.update(element, element.offsetWidth, element.offsetHeight, radiusData[index], refractionPx, refractionRange, style.backdropFilter);
        }
      });
      this.native?.retain(new Set(visible.map(({ element }) => element)));
      const backgroundCanvas = document.querySelector(
        "canvas.lattice-atmosphere, canvas[data-testid='lattice-atmosphere']"
      );
      let hasBackground = 0;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
      if (!this.native && backgroundCanvas && backgroundCanvas !== this.canvas && backgroundCanvas.width > 1 && backgroundCanvas.height > 1) {
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
      if (!this.native) {
        gl.enable(gl.SCISSOR_TEST);
        const retained = new Set(visible.map(({ element }) => element));
        for (const [element, layer] of this.layers) if (!retained.has(element)) {
          layer.host.remove();
          this.layers.delete(element);
        }
        visible.forEach(({ element, rect, style }, index) => {
          const x = Math.max(0, Math.floor(rect.left * dpr)), y = Math.max(0, Math.floor(rect.top * dpr));
          const right = Math.min(width, Math.ceil(rect.right * dpr)), bottom = Math.min(height, Math.ceil(rect.bottom * dpr));
          if (right <= x || bottom <= y) return;
          gl.scissor(x, height - bottom, right - x, bottom - y);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform1i(uniform(gl, this.program, "u_surfaceIndex"), index + 1);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          let layer = this.layers.get(element);
          if (!layer) {
            const host = document.createElement("span");
            host.className = "studio-glass-optics";
            host.setAttribute("aria-hidden", "true");
            const canvas = document.createElement("canvas");
            canvas.className = "studio-glass-surface-canvas";
            host.append(canvas);
            const ctx = canvas.getContext("2d");
            layer = { host, canvas, ctx };
            this.layers.set(element, layer);
            element.append(host);
            element.dataset.refractionSource = "wallpaper-fallback";
          }
          const sx = rect.width / element.offsetWidth, sy = rect.height / element.offsetHeight;
          layer.host.style.left = `-${parseFloat(style.borderLeftWidth) || 0}px`;
          layer.host.style.top = `-${parseFloat(style.borderTopWidth) || 0}px`;
          layer.host.style.width = `${element.offsetWidth}px`;
          layer.host.style.height = `${element.offsetHeight}px`;
          if (layer.canvas.width !== right - x) layer.canvas.width = right - x;
          if (layer.canvas.height !== bottom - y) layer.canvas.height = bottom - y;
          Object.assign(layer.canvas.style, { left: `${(x / dpr - rect.left) / sx}px`, top: `${(y / dpr - rect.top) / sy}px`, width: `${(right - x) / dpr / sx}px`, height: `${(bottom - y) / dpr / sy}px` });
          layer.ctx.clearRect(0, 0, right - x, bottom - y);
          layer.ctx.drawImage(this.canvas, x, y, right - x, bottom - y, 0, 0, right - x, bottom - y);
        });
        gl.disable(gl.SCISSOR_TEST);
      }
      gl.uniform1i(uniform(gl, this.program, "u_surfaceIndex"), 0);
      gl.bindVertexArray(null);
    }
    dispose() {
      this.native?.dispose();
      for (const layer of this.layers.values()) layer.host.remove();
      this.layers.clear();
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
      renderer?.invalidateMaterial();
      syncElements();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const onScroll = () => {
      const now = performance.now();
      scrollActiveUntil = now + 180;
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
  function startLatticeWallpaper(canvas) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return () => {
    };
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, frame = 0, last = 0, time = 0, revision = 0, disposed = false;
    let disk = [], halo = [];
    const grain = document.createElement("canvas");
    grain.width = grain.height = 512;
    let pattern = null, grainTheme = "";
    let seed = 28109;
    const random = () => {
      seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
      return seed / 4294967296;
    };
    const orbits = (count, kind) => Array.from({ length: count }, () => {
      const radius = kind === "disk" ? 1.02 + Math.pow(random(), 1.8) * 5.2 : kind === "halo" ? 1.02 + Math.pow(random(), 2.4) * 0.62 : 1.5 + random() * 10;
      return {
        radius,
        phase: random() * Math.PI * 2,
        thickness: random() + random() + random() - 1.5,
        speed: (kind === "field" ? 0.045 : 0.54) / Math.pow(radius, 1.5),
        size: 0.4 + random() * 0.65,
        brightness: 0.35 + random() * 0.65
      };
    });
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const compact = width < 700;
      seed = 28109;
      disk = orbits(compact ? 24e3 : 4e4, "disk");
      halo = orbits(compact ? 9500 : 16e3, "halo");
      pattern = null;
      grainTheme = "";
      canvas.dataset.particleCount = String(disk.length + halo.length + 28e3);
    };
    const draw = (stamp) => {
      frame = 0;
      if (disposed || document.hidden) return;
      const interval = document.querySelector(".chapter-menu,.chapter-rail.is-open") ? 83 : 33;
      if (!motion.matches && last && stamp - last < interval) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (!motion.matches && last) time += Math.min((stamp - last) / 1e3, 0.1);
      last = stamp;
      const t = motion.matches ? 0 : time, light = document.documentElement.dataset.theme === "light", mobile = width < 700;
      const cx = width * 0.51, cy = height * (mobile ? 0.51 : 0.53);
      const horizon = Math.min(width * (mobile ? 0.135 : 0.082), height * 0.145);
      const tilt = -Math.PI / 9;
      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, light ? "#f1f3f4" : "#141918");
      background.addColorStop(1, light ? "#e7edf0" : "#171c1a");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      const dot = (x, y, point, alpha) => {
        if (x < 0 || x > width || y < 0 || y > height) return;
        ctx.globalAlpha = Math.max(0, Math.min(0.8, alpha));
        ctx.fillRect(x, y, point.size, point.size);
      };
      const theme = light ? "light" : "dark";
      if (grainTheme !== theme || !pattern) {
        const g = grain.getContext("2d");
        g.clearRect(0, 0, 512, 512);
        seed = 81726;
        g.fillStyle = light ? "#597082" : "#d4d5bb";
        for (let i = 0; i < 28e3; i++) {
          g.globalAlpha = (light ? 0.08 : 0.18) + random() * (light ? 0.25 : 0.42);
          const size = 0.35 + random() * 0.65;
          g.fillRect(random() * 512, random() * 512, size, size);
        }
        pattern = ctx.createPattern(grain, "repeat");
        grainTheme = theme;
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 8e-3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pattern;
      const extent = Math.hypot(width, height);
      ctx.fillRect(-extent, -extent, extent * 2, extent * 2);
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.translate(-cx, -cy);
      ctx.save();
      ctx.translate(cx - horizon * 0.65, cy + horizon * 0.07);
      ctx.scale(1, 0.145);
      const emission = ctx.createRadialGradient(0, 0, 0, 0, 0, horizon * 4.4);
      emission.addColorStop(0, light ? "rgba(66,88,104,.08)" : "rgba(220,222,186,.24)");
      emission.addColorStop(0.42, light ? "rgba(66,88,104,.04)" : "rgba(220,222,186,.12)");
      emission.addColorStop(0.75, light ? "rgba(66,88,104,.015)" : "rgba(220,222,186,.045)");
      emission.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = emission;
      ctx.fillRect(-horizon * 4.4, -horizon * 4.4, horizon * 8.8, horizon * 8.8);
      ctx.restore();
      const drawDisk = (front) => {
        ctx.fillStyle = light ? "#435f70" : "#f0efd0";
        for (const point of disk) {
          const angle = point.phase + t * point.speed, depth = Math.sin(angle);
          if (depth >= 0 !== front) continue;
          const sideAngle = Math.cos(angle), left = Math.max(0, -sideAngle);
          const ripple = 1 + 0.035 * Math.sin(angle * 3 + point.radius * 2.7 - t * 0.18);
          const x = cx + sideAngle * point.radius * horizon * (1.03 - 0.07 * sideAngle) * ripple;
          const y = cy + depth * point.radius * horizon * (0.13 + 0.035 * left) + point.thickness * horizon * (0.105 + 0.065 * left);
          const radial = Math.exp(-(point.radius - 1.02) * 0.3);
          const side = 0.68 + 0.32 * Math.pow((1 - sideAngle) * 0.5, 1.35);
          const clump = 0.86 + 0.14 * Math.sin(angle * 4 + point.radius * 1.6 - t * 0.12);
          dot(x, y, point, (light ? 0.43 : 0.95) * point.brightness * radial * side * clump);
        }
      };
      drawDisk(false);
      ctx.fillStyle = light ? "#536b79" : "#d6dcc4";
      for (const point of halo) {
        const angle = point.phase + t * point.speed;
        const x = cx + Math.cos(angle) * point.radius * horizon;
        const y = cy - Math.abs(Math.sin(angle)) * point.radius * horizon * 0.91 + point.thickness * horizon * 0.045;
        dot(x, y, point, (light ? 0.38 : 0.8) * point.brightness * Math.exp(-(point.radius - 1.02) * 2.2));
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = light ? "#e6ebee" : "#101412";
      ctx.beginPath();
      ctx.arc(cx, cy, horizon, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      drawDisk(true);
      ctx.restore();
      ctx.globalAlpha = 1;
      canvas.dataset.wallpaperVersion = "orbital-point-cloud-12";
      canvas.dataset.wallpaperLoaded = "true";
      canvas.dataset.wallpaperFrame = String(++revision);
      canvas.dataset.orbitTime = t.toFixed(4);
      canvas.dataset.horizon = JSON.stringify([cx, cy, horizon]);
      canvas.dataset.orbitTilt = String(tilt);
      canvas.dataset.diskProfile = "eccentric-left-plume";
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      last = 0;
      frame = requestAnimationFrame(draw);
    };
    const onResize = () => {
      resize();
      refresh();
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    motion.addEventListener("change", refresh);
    resize();
    refresh();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      removeEventListener("resize", onResize);
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
