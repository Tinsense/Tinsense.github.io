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
  vec2 halfSize = max(rect.zw * 0.5 - vec2(1.0), vec2(1.0));
  float r = min(radius, min(halfSize.x, halfSize.y));
  return roundedRectSDF(cssPoint - center, halfSize, r);
}

vec2 safeNormalize(vec2 v) {
  float l = length(v);
  return l > 0.0001 ? v / l : vec2(1.0, 0.0);
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

  /*
   * Flag 1 = site header. Suppress the bottom-facing optical rim entirely so
   * light mode does not show a long pale divider below the top bar.
   */
  float opticalEdgeMask = 1.0;
  if (surfaceFlag > 0.5 && surfaceFlag < 1.5) {
    float bottomFacing = smoothstep(0.38, 0.82, normal.y);
    opticalEdgeMask = 1.0 - bottomFacing;
  }

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

  float facing = 0.5 + 0.5 * cos(normalAngle - pointerAngle);
  float opposite = 0.5 + 0.5 * cos(normalAngle - pointerAngle - PI);
  float directional = pow(max(facing, opposite * 0.22), 3.8);
  float glare = directional * (1.0 - smoothstep(0.0, max(optics.w, 0.25), depth));
  glare *= (0.97 + 0.03 * sin(u_time * 0.42 + normalAngle * 1.9 + float(chosen) * 0.41)) * opticalEdgeMask;

  /* A compact lens shoulder, with a strong bend immediately inside the rim. */
  float refractField = 1.0 - smoothstep(0.0, max(optics.y, 2.0), depth);
  refractField = pow(refractField, 1.65) * opticalEdgeMask;

  float refractionPx = optics.x * refractField;
  vec2 pxToUV = vec2(1.0 / max(u_viewport.x, 1.0), 1.0 / max(u_viewport.y, 1.0));
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

    vec4 sampleR = texture(u_background, uvR);
    vec4 sampleG = texture(u_background, uvG);
    environment = sampleG.rgb;
    vec4 sampleB = texture(u_background, uvB);
    /* A small tangent-space aperture scatters actual lattice pixels at the
       lens edge. It vanishes toward the panel centre, where equations live. */
    vec2 tangent = vec2(-bendDir.y, bendDir.x);
    vec2 aperture = tangent * (1.6 * refractField) * pxToUV;
    vec4 scatterA = texture(u_background, clamp(uvG + aperture, vec2(0.001), vec2(0.999)));
    vec4 scatterB = texture(u_background, clamp(uvG - aperture, vec2(0.001), vec2(0.999)));
    sampledAlpha = max(max(sampleR.a, sampleG.a), max(sampleB.a, max(scatterA.a, scatterB.a)));

    /*
     * Do NOT premultiply the separated RGB by sampledAlpha here.
     * Alpha is applied exactly once below through refractedAlpha.
     * Premultiplying twice was suppressing chromatic separation on the
     * semi-transparent lattice lines / atom halos.
     */
    vec3 separatedRGB = vec3(sampleR.r, sampleG.g, sampleB.b);

    /* Boost only the chromatic difference created by spatially-separated
       R/G/B samples; neutral grey areas remain neutral. */
    float neutral = dot(separatedRGB, vec3(0.299, 0.587, 0.114));
    vec3 scattered = (scatterA.rgb + scatterB.rgb) * 0.5;
    refracted = clamp(mix(mix(vec3(neutral), separatedRGB, 1.08), scattered, 0.18 * refractField), 0.0, 1.0);
  }

  /*
   * Critical light-theme fix: transparent regions of the lattice canvas must
   * contribute ZERO refracted alpha. Previously only RGB was alpha-gated, so
   * transparent black pixels still produced a broad grey/black optical band.
   */
  /* Flat areas remain almost invisible; an actual displaced line or colour
     patch produces the stronger optical response. */
  float displacedDetail = clamp(length(refracted - environment) * 2.9, 0.0, 0.57);
  float refractedAlpha = u_hasBackground * refractField * sampledAlpha * (0.22 + displacedDetail);

  vec3 cool = vec3(0.42, 0.69, 1.00);
  vec3 warm = vec3(1.00, 0.80, 0.48);
  /* The thin reflection follows local environment luminance and surface
     orientation. No painted white side stripe or coloured outline. */
  float environmentLuma = dot(environment, vec3(0.2126, 0.7152, 0.0722));
  vec3 reflectedLight = mix(vec3(1.0), environment, 0.32);
  float incident = 0.42 + 0.58 * max(dot(normal, safeNormalize(vec2(-0.72, -0.69))), 0.0);
  vec3 highlight = reflectedLight * fresnel * incident * mix(0.070, 0.034, environmentLuma);
  highlight += reflectedLight * glare * mix(0.055, 0.028, environmentLuma);

  /* Light mode has no glass body tint. Dark mode retains only a trace. */
  vec3 darkTint = vec3(0.025, 0.030, 0.038);
  float darkTintStrength = 0.0;

  vec3 color = refracted * refractedAlpha;
  color += darkTint * darkTintStrength;
  color += highlight;

  float edgeAlpha = fresnel * incident * mix(0.032, 0.017, u_theme) + glare * mix(0.020, 0.012, u_theme);
  float alpha = refractedAlpha + darkTintStrength * 0.45 + edgeAlpha;
  alpha = clamp(alpha, 0.0, 0.84);

  fragColor = vec4(color, alpha);
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
      canvas.dataset.opticsVersion = "crystal-glass-7";
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
      const flagData = new Float32Array(MAX_SURFACES);
      visible.forEach(({ element, rect }, index) => {
        rectData[index * 4] = rect.left;
        rectData[index * 4 + 1] = rect.top;
        rectData[index * 4 + 2] = rect.width;
        rectData[index * 4 + 3] = rect.height;
        const cssRadius = Number.parseFloat(getComputedStyle(element).borderRadius) || 18;
        radiusData[index] = Math.max(2, Math.min(cssRadius, rect.width * 0.5, rect.height * 0.5));
        let refractionPx = window.innerWidth <= 700 ? 9 : 12;
        let refractionRange = window.innerWidth <= 700 ? 11 : 14;
        let fresnelRange = 1.4;
        let glareRange = 1;
        if (element.matches(".site-header, .header-wrapper, .chapter-rail, .mobile-rail-toggle")) {
          refractionPx = 5.5;
          refractionRange = 8;
          fresnelRange = 1.05;
          glareRange = 0.64;
        } else if (element.matches(".rail-item, .top-action, .liquid-button, .text-button, .segmented, .derivation-controls")) {
          refractionPx = 6;
          refractionRange = 8;
          fresnelRange = 1.3;
          glareRange = 0.82;
        } else if (element.matches(".source-note")) {
          refractionPx = 5;
          refractionRange = 7;
          fresnelRange = 1.4;
          glareRange = 0.88;
        }
        opticsData[index * 4] = refractionPx;
        opticsData[index * 4 + 1] = refractionRange;
        opticsData[index * 4 + 2] = fresnelRange;
        opticsData[index * 4 + 3] = glareRange;
        flagData[index] = element.matches(".chapter-menu") ? 5 : element.matches(".search-panel") ? 4 : element.matches(".mobile-rail-toggle") ? 3 : element.matches(".chapter-rail") ? 2 : element.matches(".site-header,.header-wrapper") ? 1 : 0;
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
      const candidates = Array.from(document.querySelectorAll(selector)).filter((element) => !element.matches(".hero-lead, .hero-lead-glass"));
      const roots = new Set(candidates.filter((element) => !element.matches(".section-header,.source-note,.text-button")));
      candidates.forEach((element) => {
        element.dataset.liquidGlass = renderer ? "shared-webgl2" : "frosted";
        let parent = element.parentElement;
        while (parent && !roots.has(parent)) parent = parent.parentElement;
        element.dataset.glassLayer = !roots.has(element) ? "plain" : parent ? "embedded" : "surface";
      });
      elements = candidates.filter((element) => element.dataset.glassLayer === "surface");
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
    const wash = (x, y, r, color) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const contour = (cx, cy, rx, ry, ink, phase) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase * 0.12);
      for (let ring = 0; ring < 5; ring++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * (1 + ring * 0.13), ry * (1 + ring * 0.19), -0.35, 0.12, Math.PI * 1.74);
        ctx.strokeStyle = ring % 2 ? ink.pale : ink.line;
        ctx.lineWidth = ring === 0 ? 1.1 : 0.7;
        ctx.stroke();
      }
      ctx.restore();
    };
    const crystal = (cell, cx, cy, size, yaw, tilt, ink, diamond) => {
      const project = (atom) => {
        const x = atom.x * Math.cos(yaw) + atom.z * Math.sin(yaw);
        const z = -atom.x * Math.sin(yaw) + atom.z * Math.cos(yaw);
        return { x: cx + x * size, y: cy + (atom.y * Math.cos(tilt) - z * Math.sin(tilt)) * size, z, tone: atom.tone };
      };
      const points = cell.atoms.map(project);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.18);
      ctx.fillStyle = ink.pale;
      ctx.beginPath();
      ctx.moveTo(-size * 0.65, -size * 0.8);
      ctx.bezierCurveTo(size * 0.23, -size * 1.16, size * 0.83, -size * 0.57, size * 0.79, size * 0.17);
      ctx.bezierCurveTo(size * 0.69, size * 0.98, -size * 0.62, size * 0.95, -size * 0.83, size * 0.19);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const drawBonds = (pairs, isFrame) => {
        ctx.beginPath();
        for (const [a, b] of pairs) {
          ctx.moveTo(points[a].x, points[a].y);
          ctx.lineTo(points[b].x, points[b].y);
        }
        ctx.strokeStyle = isFrame ? ink.pale : ink.line;
        ctx.lineWidth = isFrame ? 0.95 : 1.45;
        ctx.stroke();
      };
      drawBonds(cell.frame, true);
      drawBonds(cell.bonds, false);
      points.sort((a, b) => a.z - b.z).forEach((point, index) => {
        const r = (diamond ? 4.8 : 5.4) + Math.max(-0.8, point.z * 0.6);
        ctx.beginPath();
        ctx.arc(point.x, point.y, r + 3.8, 0, Math.PI * 2);
        ctx.fillStyle = ink.cream;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
        ctx.fillStyle = point.tone ? ink.lilac : index % 3 === 0 ? ink.strong : ink.blue;
        ctx.fill();
        ctx.strokeStyle = ink.line;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x - r * 0.25, point.y - r * 0.25, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = ink.cream;
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(cx, cy, size * (diamond ? 0.88 : 1.12), -0.42, 2.54);
      ctx.strokeStyle = ink.pale;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    const stipple = (cx, cy, spread, ink, phase) => {
      ctx.fillStyle = ink.line;
      for (let row = -7; row <= 7; row++) for (let col = -7; col <= 7; col++) {
        const distance2 = Math.hypot(row, col);
        if (distance2 > 7.5 || (row * 7 + col * 11) % 6 === 0) continue;
        const x = cx + (col + row * 0.28) * spread + Math.sin(row * 0.8 + phase) * 2;
        const y = cy + row * spread * 0.68;
        ctx.globalAlpha = Math.max(0.04, 0.25 - distance2 * 0.023);
        ctx.beginPath();
        ctx.arc(x, y, distance2 < 3 ? 1.3 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const bands = (ink, time) => {
      const baseline = height * 0.63;
      for (let layer = 2; layer >= 0; layer--) {
        const offset = layer * 30;
        ctx.beginPath();
        ctx.moveTo(-20, baseline + offset - 48);
        for (let x = 0; x <= width + 16; x += 12) {
          const y = baseline + offset + Math.sin(x * 6e-3 + time * 0.12 + layer * 0.38) * (18 + layer * 5);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width + 20, height + 20);
        ctx.lineTo(-20, height + 20);
        ctx.closePath();
        const light = document.documentElement.dataset.theme === "light";
        ctx.fillStyle = light ? ["rgba(164,185,210,.075)", "rgba(194,177,201,.075)", "rgba(193,207,195,.085)"][layer] : ["rgba(87,117,150,.11)", "rgba(123,98,133,.10)", "rgba(84,124,115,.10)"][layer];
        ctx.fill();
      }
      for (let line = 0; line < 5; line++) {
        ctx.beginPath();
        for (let x = 0; x <= width + 8; x += 8) {
          const y = baseline + line * 13 + Math.sin(x * 6e-3 + time * 0.16 + line * 0.32) * (15 + line * 3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = line === 1 ? 1.25 : 0.75;
        ctx.strokeStyle = line === 1 ? ink.line : ink.pale;
        ctx.stroke();
      }
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
      const ink = light ? { line: "rgba(78,105,133,.46)", pale: "rgba(115,143,165,.21)", strong: "#718fa9", cream: "#f4f0e7", blue: "#a8c0ce", lilac: "#c9bacf" } : { line: "rgba(172,197,217,.48)", pale: "rgba(154,184,208,.19)", strong: "#91afc6", cream: "#263341", blue: "#7294ad", lilac: "#a99dbb" };
      ctx.fillStyle = light ? "#edf0f0" : "#121923";
      ctx.fillRect(0, 0, width, height);
      wash(width * 0.07, height * 0.13, Math.max(width * 0.55, height * 0.45), light ? "rgba(174,196,213,.63)" : "rgba(71,101,132,.38)");
      wash(width * 0.95, height * 0.78, Math.max(width * 0.48, height * 0.55), light ? "rgba(215,196,186,.53)" : "rgba(126,103,126,.29)");
      wash(width * 0.55, height * 0.97, Math.max(width * 0.5, height * 0.3), light ? "rgba(200,210,191,.31)" : "rgba(88,112,103,.20)");
      wash(width * 0.94, height * 0.12, Math.max(width * 0.32, height * 0.31), light ? "rgba(194,188,212,.36)" : "rgba(119,103,142,.25)");
      wash(width * 0.04, height * 0.82, Math.max(width * 0.35, height * 0.31), light ? "rgba(177,204,192,.35)" : "rgba(79,122,111,.24)");
      bands(ink, t);
      contour(width * (mobile ? 0.12 : 0.08), height * 0.3, mobile ? 105 : 190, mobile ? 150 : 205, ink, t * 0.025);
      contour(width * (mobile ? 0.92 : 0.91), height * 0.72, mobile ? 90 : 155, mobile ? 115 : 180, ink, -t * 0.02);
      stipple(width * (mobile ? 0.01 : 0.13), height * 0.86, mobile ? 12 : 18, ink, t * 0.1);
      stipple(width * (mobile ? 0.95 : 0.89), height * 0.12, mobile ? 9 : 14, ink, -t * 0.08);
      const size = mobile ? Math.min(200, width * 0.53) : Math.min(330, Math.max(225, width * 0.22));
      crystal(cells[0], width * (mobile ? 0.06 : 0.09), height * 0.3, size, 0.58 + t * 0.038, -0.3, ink, true);
      crystal(cells[1], width * (mobile ? 0.95 : 0.93), height * 0.73, size * 0.72, -0.34 - t * 0.032, 0.3, ink, false);
      const quiet = ctx.createLinearGradient(0, 0, width, 0);
      const base = light ? "237,240,240" : "18,25,35";
      quiet.addColorStop(0, `rgba(${base},0)`);
      quiet.addColorStop(0.34, `rgba(${base},.20)`);
      quiet.addColorStop(0.5, `rgba(${base},.45)`);
      quiet.addColorStop(0.66, `rgba(${base},.20)`);
      quiet.addColorStop(1, `rgba(${base},0)`);
      ctx.fillStyle = quiet;
      ctx.fillRect(0, 0, width, height);
      canvas.dataset.wallpaperVersion = "crystal-illustration-8";
      canvas.dataset.crystalCells = "diamond,hcp";
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
  const selectors = ".site-header,.liquid-panel,.project-card,.tool-strip a,.card,.phase-panel,.reported-strip,.stats > div,.note-grid article,.header-wrapper,.home-post-item,.post-content-container,.post-content,.page-content,.archive-list,.category-list,.tag-list,.page-main-content-middle .main-content,.liquid-button,.top-action,.tip";
  const start = () => {
    if (document.querySelector("[data-wallpaper-version]")) return;
    const root = document.documentElement;
    const legacy = !root.dataset.theme;
    const theme = () => {
      if (legacy) root.dataset.theme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    };
    theme();
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
