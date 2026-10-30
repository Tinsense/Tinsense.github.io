(() => {
  "use strict";

  const dataset = window.NFC_DATA;
  const samples = dataset.samples;
  const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
  const palette = [
    "#006D77", "#D1495B", "#2F5597", "#E08E0B", "#6B4C9A", "#0081A7",
    "#8A5A44", "#399E5A", "#A23B72", "#B5651D", "#4F6D7A", "#7A8B33"
  ];

  const state = {
    selected: new Set(samples.slice(0, 3).map((sample) => sample.id)),
    active: samples[0]?.id || null,
    temperatures: new Set([35, 60]),
    cycles: new Set([1]),
    search: "",
    recipe: "",
    showContext: false,
    ranges: { qMin: 0, qMax: 300, vMin: 2.4, vMax: 4.5 },
    renderedPoints: []
  };

  const el = Object.fromEntries([
    "search", "recipe-filter", "sample-list", "visible-count", "selected-count",
    "select-visible", "clear-selected", "export-csv", "capacity-min", "capacity-max",
    "voltage-min", "voltage-max", "apply-range", "reset-range", "show-context",
    "legend", "selection-table", "active-label", "chart", "chart-wrap", "tooltip",
    "empty-state", "stat-samples"
  ].map((id) => [id, document.getElementById(id)]));

  const ctx = el.chart.getContext("2d");
  let resizeFrame = null;

  function colorFor(id) {
    const index = Number(id.slice(1)) - 1;
    return palette[((index % palette.length) + palette.length) % palette.length];
  }

  function matchesFilters(sample) {
    const query = state.search.trim().toLowerCase();
    const matchesQuery = !query || [sample.name, sample.source, sample.file]
      .some((value) => value.toLowerCase().includes(query));
    return matchesQuery && state.temperatures.has(sample.temperature) &&
      (!state.recipe || sample.recipe === state.recipe);
  }

  function visibleSamples() {
    return samples.filter(matchesFilters);
  }

  function formatTime(value) {
    return value.replace(" ", " · ");
  }

  function populateRecipes() {
    const recipes = [...new Set(samples.map((sample) => sample.recipe))]
      .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
    for (const recipe of recipes) {
      const option = document.createElement("option");
      option.value = recipe;
      option.textContent = recipe;
      el["recipe-filter"].append(option);
    }
  }

  function renderSampleList() {
    const visible = visibleSamples();
    el["visible-count"].textContent = visible.length;
    el["selected-count"].textContent = `${state.selected.size} 已选`;
    el["sample-list"].replaceChildren();

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty-row";
      empty.textContent = "没有匹配的样品";
      el["sample-list"].append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const sample of visible) {
      const label = document.createElement("label");
      label.className = `sample-item${state.selected.has(sample.id) ? " is-selected" : ""}`;
      label.setAttribute("role", "listitem");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selected.has(sample.id);
      checkbox.setAttribute("aria-label", `选择 ${sample.name}`);
      checkbox.addEventListener("change", () => toggleSample(sample.id, checkbox.checked));

      const body = document.createElement("span");
      const name = document.createElement("span");
      name.className = "sample-name";
      name.textContent = sample.name;
      const meta = document.createElement("span");
      meta.className = "sample-meta";
      meta.textContent = `${formatTime(sample.startTime)} · ${sample.file}`;
      body.append(name, meta);

      const temp = document.createElement("span");
      temp.className = "temp-tag";
      temp.textContent = `${sample.temperature} °C`;
      label.append(checkbox, body, temp);
      fragment.append(label);
    }
    el["sample-list"].append(fragment);
  }

  function toggleSample(id, checked) {
    if (checked) {
      state.selected.add(id);
      if (!state.active) state.active = id;
    } else {
      state.selected.delete(id);
      if (state.active === id) state.active = state.selected.values().next().value || null;
    }
    renderAll(false);
  }

  function setActive(id) {
    if (!state.selected.has(id)) return;
    state.active = id;
    renderLegend();
    renderTable();
    drawChart();
  }

  function renderLegend() {
    el.legend.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const id of state.selected) {
      const sample = sampleById.get(id);
      if (!sample) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `legend-button${state.active === id ? " active" : ""}`;
      button.title = `设为主高亮：${sample.name}`;
      button.setAttribute("aria-pressed", state.active === id ? "true" : "false");
      button.addEventListener("click", () => setActive(id));
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = colorFor(id);
      const label = document.createElement("span");
      label.textContent = `${sample.name} · ${sample.temperature} °C`;
      button.append(swatch, label);
      fragment.append(button);
    }
    el.legend.append(fragment);
  }

  function renderTable() {
    el["selection-table"].replaceChildren();
    const selected = [...state.selected].map((id) => sampleById.get(id)).filter(Boolean);
    if (!selected.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "尚未选择样品";
      row.append(cell);
      el["selection-table"].append(row);
      el["active-label"].textContent = "未设置主高亮";
      return;
    }

    const activeSample = sampleById.get(state.active);
    el["active-label"].textContent = activeSample ? `主高亮：${activeSample.name}` : "未设置主高亮";
    const fragment = document.createDocumentFragment();
    for (const sample of selected) {
      const row = document.createElement("tr");
      const highlightCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `highlight-button${state.active === sample.id ? " active" : ""}`;
      button.textContent = state.active === sample.id ? "当前" : "高亮";
      button.setAttribute("aria-label", `将 ${sample.name} 设为主高亮曲线`);
      button.addEventListener("click", () => setActive(sample.id));
      highlightCell.append(button);
      const values = [sample.name, `${sample.temperature} °C`, sample.startTime, `DevID ${sample.devId}`, sample.source];
      row.append(highlightCell, ...values.map((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        return cell;
      }));
      fragment.append(row);
    }
    el["selection-table"].append(fragment);
  }

  function niceTicks(min, max, target = 6) {
    const span = Math.max(max - min, Number.EPSILON);
    const rough = span / target;
    const power = 10 ** Math.floor(Math.log10(rough));
    const scaled = rough / power;
    const step = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
    const ticks = [];
    const start = Math.ceil(min / step) * step;
    for (let value = start; value <= max + step * 0.01; value += step) ticks.push(Number(value.toFixed(10)));
    return ticks;
  }

  function chartLayout(width, height) {
    const mobile = width < 580;
    return {
      left: mobile ? 58 : 76,
      right: mobile ? 14 : 24,
      top: 18,
      bottom: mobile ? 56 : 62,
      width,
      height
    };
  }

  function drawChart() {
    const rect = el.chart.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(360, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (el.chart.width !== Math.round(width * dpr) || el.chart.height !== Math.round(height * dpr)) {
      el.chart.width = Math.round(width * dpr);
      el.chart.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const layout = chartLayout(width, height);
    const plotW = width - layout.left - layout.right;
    const plotH = height - layout.top - layout.bottom;
    const { qMin, qMax, vMin, vMax } = state.ranges;
    const xScale = (value) => layout.left + ((value - qMin) / (qMax - qMin)) * plotW;
    const yScale = (value) => layout.top + plotH - ((value - vMin) / (vMax - vMin)) * plotH;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(layout.left, layout.top, plotW, plotH);
    ctx.font = "11px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#e6edf2";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const xTicks = niceTicks(qMin, qMax, 6);
    for (const value of xTicks) {
      const x = xScale(value);
      ctx.beginPath(); ctx.moveTo(x, layout.top); ctx.lineTo(x, layout.top + plotH); ctx.stroke();
      ctx.fillStyle = "#5f7180";
      ctx.textAlign = "center";
      ctx.fillText(String(value), x, layout.top + plotH + 20);
    }
    const yTicks = niceTicks(vMin, vMax, 6);
    for (const value of yTicks) {
      const y = yScale(value);
      ctx.beginPath(); ctx.moveTo(layout.left, y); ctx.lineTo(layout.left + plotW, y); ctx.stroke();
      ctx.fillStyle = "#5f7180";
      ctx.textAlign = "right";
      ctx.fillText(Number(value.toFixed(2)).toString(), layout.left - 10, y);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.left, layout.top, plotW, plotH);
    ctx.clip();
    state.renderedPoints = [];

    if (state.showContext) {
      for (const sample of visibleSamples()) {
        if (state.selected.has(sample.id)) continue;
        drawSample(sample, "#9aa8b4", 0.14, 0.75, false, xScale, yScale);
      }
    }

    const ordered = [...state.selected].filter((id) => id !== state.active);
    if (state.active && state.selected.has(state.active)) ordered.push(state.active);
    for (const id of ordered) {
      const sample = sampleById.get(id);
      if (!sample) continue;
      const active = id === state.active;
      drawSample(sample, colorFor(id), 1, active ? 3.1 : 1.85, true, xScale, yScale);
    }
    ctx.restore();

    ctx.setLineDash([]);
    ctx.strokeStyle = "#213243";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(layout.left, layout.top, plotW, plotH);
    ctx.fillStyle = "#253747";
    ctx.textAlign = "center";
    ctx.font = "12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.fillText("比容量 / mAh g⁻¹", layout.left + plotW / 2, height - 17);
    ctx.save();
    ctx.translate(17, layout.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("电压 / V", 0, 0);
    ctx.restore();

    el["empty-state"].hidden = state.selected.size > 0;
  }

  function drawSample(sample, color, opacity, width, collect, xScale, yScale) {
    for (const segment of sample.segments) {
      if (!state.cycles.has(segment.cycle)) continue;
      const cycleOpacity = segment.cycle === 1 ? opacity : opacity * 0.58;
      ctx.globalAlpha = cycleOpacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(segment.mode === "discharge" ? [6, 4] : []);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < segment.q.length; i += 1) {
        const q = segment.q[i];
        const v = segment.v[i];
        if (!Number.isFinite(q) || !Number.isFinite(v)) continue;
        const x = xScale(q);
        const y = yScale(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        if (collect && i % 2 === 0 && q >= state.ranges.qMin && q <= state.ranges.qMax && v >= state.ranges.vMin && v <= state.ranges.vMax) {
          state.renderedPoints.push({ x, y, q, v, sample, cycle: segment.cycle, mode: segment.mode });
        }
      }
      if (started) ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function renderAll(includeList = true) {
    if (includeList) renderSampleList();
    else {
      el["selected-count"].textContent = `${state.selected.size} 已选`;
      for (const item of el["sample-list"].querySelectorAll(".sample-item")) {
        const input = item.querySelector("input");
        item.classList.toggle("is-selected", input.checked);
      }
    }
    renderLegend();
    renderTable();
    drawChart();
  }

  function applyRanges() {
    const next = {
      qMin: Number(el["capacity-min"].value),
      qMax: Number(el["capacity-max"].value),
      vMin: Number(el["voltage-min"].value),
      vMax: Number(el["voltage-max"].value)
    };
    if (!Object.values(next).every(Number.isFinite) || next.qMax <= next.qMin || next.vMax <= next.vMin) {
      window.alert("请确认容量和电压上限均大于下限。");
      return;
    }
    state.ranges = next;
    drawChart();
  }

  function resetRanges() {
    const [vMin, vMax] = dataset.meta.defaultVoltageRange;
    const [qMin, qMax] = dataset.meta.defaultCapacityRange;
    Object.assign(state.ranges, { qMin, qMax, vMin, vMax });
    el["capacity-min"].value = qMin;
    el["capacity-max"].value = qMax;
    el["voltage-min"].value = vMin;
    el["voltage-max"].value = vMax;
    drawChart();
  }

  function exportCsv() {
    const rows = [["sample", "temperature_C", "start_time", "source", "cycle", "mode", "step", "specific_capacity_mAh_g", "voltage_V"]];
    for (const id of state.selected) {
      const sample = sampleById.get(id);
      for (const segment of sample.segments) {
        if (!state.cycles.has(segment.cycle)) continue;
        for (let i = 0; i < segment.q.length; i += 1) {
          rows.push([sample.name, sample.temperature, sample.startTime, sample.source, segment.cycle, segment.mode, segment.step, segment.q[i], segment.v[i]]);
        }
      }
    }
    if (rows.length === 1) {
      window.alert("请先选择至少一个样品和一个圈次。");
      return;
    }
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = "\ufeff" + rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `NFC_selected_curves_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function showTooltip(event) {
    if (!state.renderedPoints.length) return hideTooltip();
    const rect = el.chart.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = null;
    let bestDistance = 14 ** 2;
    for (const point of state.renderedPoints) {
      const distance = (point.x - px) ** 2 + (point.y - py) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = point; }
    }
    if (!best) return hideTooltip();
    el.tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = best.sample.name;
    const detail = document.createElement("span");
    detail.textContent = `${best.sample.temperature} °C · 第 ${best.cycle} 圈 · ${best.mode === "charge" ? "充电" : "放电"}\n${best.q.toFixed(2)} mAh g⁻¹ · ${best.v.toFixed(3)} V`;
    detail.style.whiteSpace = "pre-line";
    el.tooltip.append(title, detail);
    el.tooltip.hidden = false;
    const left = Math.min(px + 14, rect.width - el.tooltip.offsetWidth - 8);
    const top = Math.max(8, Math.min(py - el.tooltip.offsetHeight - 12, rect.height - el.tooltip.offsetHeight - 8));
    el.tooltip.style.left = `${left}px`;
    el.tooltip.style.top = `${top}px`;
  }

  function hideTooltip() { el.tooltip.hidden = true; }

  el.search.addEventListener("input", () => { state.search = el.search.value; renderSampleList(); drawChart(); });
  el["recipe-filter"].addEventListener("change", () => { state.recipe = el["recipe-filter"].value; renderSampleList(); drawChart(); });
  document.getElementById("temperature-filter").addEventListener("change", (event) => {
    if (!event.target.matches("input")) return;
    const temp = Number(event.target.value);
    event.target.checked ? state.temperatures.add(temp) : state.temperatures.delete(temp);
    renderSampleList(); drawChart();
  });
  document.getElementById("cycle-filter").addEventListener("change", (event) => {
    if (!event.target.matches("input")) return;
    const cycle = Number(event.target.value);
    event.target.checked ? state.cycles.add(cycle) : state.cycles.delete(cycle);
    drawChart();
  });
  el["show-context"].addEventListener("change", () => { state.showContext = el["show-context"].checked; drawChart(); });
  el["select-visible"].addEventListener("click", () => {
    for (const sample of visibleSamples()) state.selected.add(sample.id);
    if (!state.active) state.active = state.selected.values().next().value || null;
    renderAll();
  });
  el["clear-selected"].addEventListener("click", () => { state.selected.clear(); state.active = null; renderAll(); });
  el["apply-range"].addEventListener("click", applyRanges);
  el["reset-range"].addEventListener("click", resetRanges);
  el["export-csv"].addEventListener("click", exportCsv);
  el.chart.addEventListener("pointermove", showTooltip);
  el.chart.addEventListener("pointerleave", hideTooltip);
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawChart);
  });

  populateRecipes();
  el["stat-samples"].textContent = dataset.meta.sampleCount;
  renderAll();
})();
