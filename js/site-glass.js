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

  /* Refraction is now local to the edge instead of spanning ~46 px inward. */
  float refractField = 1.0 - smoothstep(0.8, max(optics.y, 2.0), depth);
  refractField = pow(refractField, 1.30) * opticalEdgeMask;

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
    float dispersionPx = min(1.15, optics.x * 0.055) * refractField;
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
    vec2 aperture = tangent * (2.8 * refractField) * pxToUV;
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
    refracted = clamp(mix(mix(vec3(neutral), separatedRGB, 1.05), scattered, 0.32 * refractField), 0.0, 1.0);
  }

  /*
   * Critical light-theme fix: transparent regions of the lattice canvas must
   * contribute ZERO refracted alpha. Previously only RGB was alpha-gated, so
   * transparent black pixels still produced a broad grey/black optical band.
   */
  float refractedAlpha = u_hasBackground * refractField * sampledAlpha * mix(0.58, 0.52, u_theme);

  vec3 cool = vec3(0.42, 0.69, 1.00);
  vec3 warm = vec3(1.00, 0.80, 0.48);
  vec3 rimDispersion = mix(cool, warm, clamp(0.5 + normal.x * 0.42, 0.0, 1.0));

  /* Small range, clean specular response. */
  float environmentLuma = dot(environment, vec3(0.2126, 0.7152, 0.0722));
  vec3 reflectedLight = mix(vec3(1.0), environment, 0.16);
  vec3 highlight = reflectedLight * fresnel * mix(0.052, 0.025, environmentLuma);
  highlight += reflectedLight * glare * mix(0.115, 0.052, environmentLuma);
  highlight += rimDispersion * fresnel * (0.0045 + 0.0080 * glare);

  /* Light mode has no glass body tint. Dark mode retains only a trace. */
  vec3 darkTint = vec3(0.025, 0.030, 0.038);
  float darkTintStrength = (1.0 - u_theme) * 0.024;

  vec3 color = refracted * refractedAlpha;
  color += darkTint * darkTintStrength;
  color += highlight;

  float edgeAlpha = fresnel * mix(0.034, 0.014, u_theme) + glare * mix(0.05, 0.025, u_theme);
  float alpha = refractedAlpha + darkTintStrength * 0.45 + edgeAlpha;
  alpha = clamp(alpha, 0.0, mix(0.78, 0.50, u_theme));

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
      const canvas = document.createElement("canvas");
      canvas.className = "studio-glass-shared-canvas";
      canvas.dataset.opticsVersion = "lattice-shared-4";
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
        let refractionPx = 19;
        let refractionRange = 28;
        let fresnelRange = 1.95;
        let glareRange = 1.18;
        if (element.matches(".site-header, .header-wrapper, .chapter-rail, .mobile-rail-toggle")) {
          refractionPx = 10;
          refractionRange = 18;
          fresnelRange = 1.05;
          glareRange = 0.64;
        } else if (element.matches(".rail-item, .top-action, .liquid-button, .text-button, .segmented, .derivation-controls")) {
          refractionPx = 8;
          refractionRange = 10.3;
          fresnelRange = 1.3;
          glareRange = 0.82;
        } else if (element.matches(".source-note")) {
          refractionPx = 6.9;
          refractionRange = 11.8;
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
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            backgroundCanvas
          );
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
    let scrollTimer = 0;
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
      if (disposed) return;
      if (renderer) renderer.canvas.style.display = "block";
      if (renderer) {
        const scrolling = timestamp <= scrollActiveUntil;
        if (renderer.canvas.style.visibility !== "hidden" && (motion.matches || scrolling || timestamp - lastPaint >= 40)) {
          lastPaint = timestamp;
          renderer.render(elements, motion.matches ? 0 : timestamp / 1e3);
        }
        if (!motion.matches) frame = requestAnimationFrame(render);
      }
    };
    const schedule = () => {
      syncElements();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const onScroll = () => {
      scrollActiveUntil = performance.now() + 180;
      if (renderer) renderer.canvas.style.visibility = "hidden";
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (disposed) return;
        renderer?.render(elements, motion.matches ? 0 : performance.now() / 1e3);
        if (renderer) renderer.canvas.style.visibility = "visible";
        if (!frame) frame = requestAnimationFrame(render);
      }, 140);
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
    syncElements();
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(scrollTimer);
      mutation.disconnect();
      theme.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      motion.removeEventListener("change", schedule);
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
    let width = 0, height = 0, frame = 0, last = -Infinity;
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      const time = motion.matches ? 0 : timestamp / 1e3;
      ctx.fillStyle = light ? "#f5f5f7" : "#080b11";
      ctx.fillRect(0, 0, width, height);
      const hues = [210, 157, 276, 27];
      for (let k = 0; k < hues.length; k++) {
        const phase = k * Math.PI * 0.5 + time * 0.025;
        const x = width * (0.5 + 0.46 * Math.cos(phase));
        const y = height * (0.5 + 0.4 * Math.sin(phase));
        const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * 0.65);
        glow.addColorStop(0, `hsla(${hues[k]},35%,${light ? 72 : 49}%,${light ? 0.25 : 0.15})`);
        glow.addColorStop(1, `hsla(${hues[k]},35%,50%,0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }
      const count = 9, depth = 3, step = Math.max(width / 8, height / 7);
      const yaw = 0.34 + time * 0.035, tilt = 0.3 + 0.12 * Math.sin(time * 0.027), roll = -0.16;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      const cr = Math.cos(roll), sr = Math.sin(roll), camera = step * 16;
      const nodes = [];
      const index = (i, j, k) => (k * count + j) * count + i;
      for (let k = 0; k < depth; k++) for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
        const x0 = (i - 4) * step, y0 = (j - 4) * step, z0 = (k - 1) * step;
        const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
        const y1 = y0 * ct - z1 * st, z = y0 * st + z1 * ct;
        const scale = camera / (camera - z);
        const x = width * 0.52 + (x1 * cr - y1 * sr) * scale;
        const y = height * 0.51 + (x1 * sr + y1 * cr) * scale;
        const edge = Math.min(1, Math.abs(x - width * 0.5) / (width * 0.5));
        nodes.push({ x, y, z, scale, alpha: (0.48 + 0.3 * edge) * Math.min(1.2, scale), parity: (i + j + k) % 2, hue: hues[(i + 2 * j + k) % hues.length] });
      }
      const bonds = [];
      for (let k = 0; k < depth; k++) for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
        const a = nodes[index(i, j, k)];
        if (i + 1 < count) bonds.push({ a, b: nodes[index(i + 1, j, k)] });
        if (j + 1 < count) bonds.push({ a, b: nodes[index(i, j + 1, k)] });
        if (k + 1 < depth) bonds.push({ a, b: nodes[index(i, j, k + 1)] });
      }
      bonds.sort((a, b) => a.a.z + a.b.z - b.a.z - b.b.z);
      for (const { a, b } of bonds) {
        ctx.strokeStyle = `hsla(${a.hue},20%,${light ? 40 : 76}%,${(a.alpha + b.alpha) * (light ? 0.065 : 0.075)})`;
        ctx.lineWidth = Math.max(0.6, (a.scale + b.scale) * 0.4);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const p of [...nodes].sort((a, b) => a.z - b.z)) {
        const radius = (p.parity ? 3.3 : 5.1) * p.scale;
        if (p.x < -radius * 3 || p.x > width + radius * 3 || p.y < -radius * 3 || p.y > height + radius * 3) continue;
        ctx.fillStyle = `hsla(${p.hue},30%,${light ? 44 : 74}%,${p.alpha * 0.055})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        const sphere = ctx.createRadialGradient(p.x - radius * 0.28, p.y - radius * 0.35, 0.1, p.x, p.y, radius);
        sphere.addColorStop(0, `hsla(${p.hue},25%,${light ? 73 : 88}%,${p.alpha * 0.78})`);
        sphere.addColorStop(1, `hsla(${p.hue},25%,${light ? 34 : 57}%,${p.alpha * 0.55})`);
        ctx.fillStyle = sphere;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let x = -10; x <= width + 10; x += 8) {
          const y = height * 0.54 + k * 29 + 49 * Math.sin(x * 6e-3 - time * 0.22) + 17 * Math.sin(x * 0.012 - time * 0.14);
          if (x === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${hues[k]},25%,${light ? 40 : 76}%,${light ? 0.09 : 0.12})`;
        ctx.lineWidth = k === 1 ? 1.6 : 0.8;
        ctx.stroke();
      }
      canvas.dataset.wallpaperVersion = "rotating-lattice-5";
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
