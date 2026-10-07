(() => {
  "use strict";

  const FEATURES = [
    { key: "Alcohol", label: "Alcool", short: "Alc." },
    { key: "Malic acid", label: "Acide malique", short: "Malic." },
    { key: "Ash", label: "Cendres", short: "Cendres" },
    { key: "Alcalinity of ash", label: "Alcalinité des cendres", short: "Alcal." },
    { key: "Magnesium", label: "Magnésium", short: "Mg" },
    { key: "Total phenols", label: "Phénols totaux", short: "Phén." },
    { key: "Flavanoids", label: "Flavonoïdes", short: "Flav." },
    { key: "Nonflavanoid phenols", label: "Phénols non flavonoïdes", short: "Nonflav." },
    { key: "Proanthocyanins", label: "Proanthocyanidines", short: "Proanth." },
    { key: "Color intensity", label: "Intensité de couleur", short: "Coul." },
    { key: "Hue", label: "Teinte", short: "Teint." },
    { key: "OD280/OD315 of diluted wines", label: "OD280/OD315 des vins dilués", short: "OD280/315" },
    { key: "Proline", label: "Proline", short: "Proline" }
  ];

  const DATA = (window.WINE_DATA || []).map((row, index) => ({ ...row, __id: index }));
  const FEATURE_BY_KEY = new Map(FEATURES.map(d => [d.key, d]));
  const extents = new Map(FEATURES.map(f => [f.key, d3.extent(DATA, d => d[f.key])]));
  let selectedIds = null;
  let detailKey = FEATURES[0].key;
  let suppressBrushEvents = false;
  let parallelBrushSelections = new Map();
  let matrixCellSize = 58;
  let matrixOffsets = { left: 82, top: 116 };
  let matrixScales = new Map();
  let parallelScales = new Map();
  let resizeTimer;

  const $ = selector => document.querySelector(selector);
  const safeRange = key => {
    const [min, max] = extents.get(key);
    return (max - min) || 1;
  };
  const niceNumber = (value, digits = 3) => d3.format(`.${digits}~g`)(value);
  const selectionActive = () => selectedIds instanceof Set;
  const visibleData = () => selectionActive() ? DATA.filter(d => selectedIds.has(d.__id)) : DATA;

  function initialize() {
    if (!DATA.length || !FEATURES.every(f => DATA.every(d => Number.isFinite(d[f.key])))) {
      document.querySelector("main").innerHTML = '<section class="card"><h2>Données introuvables</h2><p>Vérifiez que wine-data.js se trouve dans le même dossier que index.html.</p></section>';
      return;
    }
    document.querySelector("#dataset-summary").textContent = `${DATA.length} observations · 13 mesures continues`;
    document.querySelector("#row-count").textContent = DATA.length;
    document.querySelector("#feature-count").textContent = FEATURES.length;
    populateFeatureSelect();
    configureSliders();
    drawMatrix();
    drawParallel();
    drawDistribution();
    updateStatus();

    $("#feature-select").addEventListener("change", event => setDetailFeature(event.target.value));
    $("#bin-width").addEventListener("input", drawDistribution);
    $("#bandwidth").addEventListener("input", drawDistribution);
    $("#clear-selection").addEventListener("click", clearSelection);
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        drawMatrix();
        drawParallel();
        drawDistribution();
        updateHighlights();
      }, 120);
    });
  }

  function populateFeatureSelect() {
    d3.select("#feature-select").selectAll("option")
      .data(FEATURES).join("option")
      .attr("value", d => d.key).text(d => d.label);
  }

  function configureSliders() {
    const range = safeRange(detailKey);
    const binInput = $("#bin-width");
    binInput.min = String(range / 60);
    binInput.max = String(range / 5);
    binInput.step = String(range / 500);
    binInput.value = String(range / 15);
    const bandwidthInput = $("#bandwidth");
    bandwidthInput.min = String(range * .015);
    bandwidthInput.max = String(range * .45);
    bandwidthInput.step = String(range * .004);
    bandwidthInput.value = String(range * .08);
  }

  function setDetailFeature(key) {
    if (!FEATURE_BY_KEY.has(key)) return;
    detailKey = key;
    $("#feature-select").value = key;
    configureSliders();
    drawDistribution();
  }

  function setSelection(ids) {
    selectedIds = new Set(ids);
    updateHighlights();
    updateStatus();
    drawDistribution();
  }

  function clearSelection() {
    suppressBrushEvents = true;
    d3.selectAll(".matrix-brush").each(function() {
      const behavior = this.__brushBehavior;
      if (behavior) d3.select(this).call(behavior.move, null);
    });
    d3.selectAll(".parallel-brush").each(function() {
      const behavior = this.__brushBehavior;
      if (behavior) d3.select(this).call(behavior.move, null);
    });
    suppressBrushEvents = false;
    selectedIds = null;
    updateHighlights();
    updateStatus();
    drawDistribution();
  }

  function clearMatrixBrushes() {
    suppressBrushEvents = true;
    d3.selectAll(".matrix-brush").each(function() {
      if (this.__brushBehavior) d3.select(this).call(this.__brushBehavior.move, null);
    });
    suppressBrushEvents = false;
  }

  function clearOtherMatrixBrushes(activeNode) {
    suppressBrushEvents = true;
    d3.selectAll(".matrix-brush").each(function() {
      if (this !== activeNode && this.__brushBehavior) {
        d3.select(this).call(this.__brushBehavior.move, null);
      }
    });
    suppressBrushEvents = false;
  }

  function clearParallelBrushes() {
    suppressBrushEvents = true;
    d3.selectAll(".parallel-brush").each(function() {
      if (this.__brushBehavior) d3.select(this).call(this.__brushBehavior.move, null);
    });
    suppressBrushEvents = false;
  }

  function updateStatus() {
    const count = selectionActive() ? selectedIds.size : DATA.length;
    $("#selection-count").textContent = `${count} / ${DATA.length}`;
    $("#selection-label").textContent = selectionActive() ? "observations sélectionnées" : "observations visibles";
  }

  function updateHighlights() {
    d3.selectAll(".matrix-dot, .parallel-path")
      .classed("is-selected", d => selectionActive() && selectedIds.has(d.__id))
      .attr("opacity", d => !selectionActive() || selectedIds.has(d.__id) ? 1 : .14);
  }

  function clickableLabel(selection, keyAccessor) {
    selection.attr("role", "button").attr("tabindex", 0)
      .on("click", (event, d) => setDetailFeature(keyAccessor(d)))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setDetailFeature(keyAccessor(d));
        }
      });
  }

  function drawMatrix() {
    const scroll = $(".matrix-scroll");
    const containerWidth = Math.max(scroll.clientWidth, 700);
    const n = FEATURES.length;
    matrixCellSize = Math.max(43, Math.min(69, (containerWidth - 112) / n));
    matrixOffsets = { left: 82, top: 116 };
    const width = matrixOffsets.left + n * matrixCellSize + 18;
    const height = matrixOffsets.top + n * matrixCellSize + 16;
    const svg = d3.select("#scatter-matrix").attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    matrixScales = new Map();

    FEATURES.forEach(feature => {
      const [min, max] = extents.get(feature.key);
      const pad = (max - min) * .025 || .5;
      matrixScales.set(feature.key, d3.scaleLinear().domain([min - pad, max + pad]).range([4, matrixCellSize - 4]));
    });

    const nBins = 5;
    const rows = [];
    FEATURES.forEach((yFeature, row) => {
      FEATURES.forEach((xFeature, col) => {
        rows.push({ yFeature, xFeature, row, col });
      });
    });
    const cells = svg.append("g").selectAll("g.matrix-cell").data(rows).join("g")
      .attr("class", "matrix-cell")
      .attr("transform", d => `translate(${matrixOffsets.left + d.col * matrixCellSize},${matrixOffsets.top + d.row * matrixCellSize})`);
    cells.append("rect").attr("class", d => `matrix-cell-bg${d.row === d.col ? " diagonal" : ""}`)
      .attr("width", matrixCellSize).attr("height", matrixCellSize);

    cells.filter(d => d.row === d.col).each(function(cell) {
      const x = matrixScales.get(cell.xFeature.key);
      const [min, max] = extents.get(cell.xFeature.key);
      const bins = d3.bin().value(d => d[cell.xFeature.key]).domain([min, max]).thresholds(nBins)(DATA);
      const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length) || 1]).range([matrixCellSize - 4, 4]);
      d3.select(this).selectAll("rect.matrix-diag-bar").data(bins).join("rect")
        .attr("class", "matrix-diag-bar")
        .attr("x", b => Math.max(1, x(b.x0))).attr("y", b => y(b.length))
        .attr("width", b => Math.max(0, x(b.x1) - x(b.x0) - 1)).attr("height", b => matrixCellSize - 4 - y(b.length));
      d3.select(this).append("title").text(`Distribution : ${cell.xFeature.label}`);
    });

    cells.filter(d => d.row !== d.col).each(function(cell) {
      const sx = matrixScales.get(cell.xFeature.key);
      const sy = matrixScales.get(cell.yFeature.key);
      const group = d3.select(this);
      group.selectAll("circle.matrix-dot").data(DATA).join("circle")
        .attr("class", "matrix-dot")
        .attr("data-observation", d => d.__id)
        .attr("cx", d => sx(d[cell.xFeature.key]))
        .attr("cy", d => matrixCellSize - sy(d[cell.yFeature.key]))
        .attr("r", matrixCellSize < 51 ? 1.55 : 1.8)
        .attr("opacity", 1)
        .on("mouseenter", (event, d) => showTooltip(event, d, `${cell.xFeature.label} : ${niceNumber(d[cell.xFeature.key])}<br>${cell.yFeature.label} : ${niceNumber(d[cell.yFeature.key])}`))
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);
      group.append("title").text(`${cell.xFeature.label} × ${cell.yFeature.label} — glisser pour sélectionner`);
      let brushGroup;
      const brush = d3.brush().extent([[2, 2], [matrixCellSize - 2, matrixCellSize - 2]])
        .on("start", event => {
          if (event.sourceEvent && !suppressBrushEvents) {
            clearParallelBrushes();
            clearOtherMatrixBrushes(brushGroup.node());
          }
        })
        .on("brush end", event => {
          if (suppressBrushEvents) return;
          if (!event.selection) {
            if (event.type === "end") setSelection([]);
            return;
          }
          const [[x0, y0], [x1, y1]] = event.selection;
          const xv = [sx.invert(x0), sx.invert(x1)].sort((a, b) => a - b);
          const yv = [sy.invert(matrixCellSize - y1), sy.invert(matrixCellSize - y0)].sort((a, b) => a - b);
          setSelection(DATA.filter(d => d[cell.xFeature.key] >= xv[0] && d[cell.xFeature.key] <= xv[1] && d[cell.yFeature.key] >= yv[0] && d[cell.yFeature.key] <= yv[1]).map(d => d.__id));
        });
      brushGroup = group.append("g").attr("class", "matrix-brush").call(brush);
      brushGroup.node().__brushBehavior = brush;
    });

    const headerData = FEATURES.map((feature, i) => ({ feature, i }));
    const xLabels = svg.append("g").selectAll("text.matrix-label.x-label").data(headerData).join("text")
      .attr("class", "matrix-label x-label")
      .attr("x", d => matrixOffsets.left + d.i * matrixCellSize + matrixCellSize * .52)
      .attr("y", matrixOffsets.top - 12)
      .attr("text-anchor", "start")
      .attr("transform", d => {
        const x = matrixOffsets.left + d.i * matrixCellSize + matrixCellSize * .52;
        return `rotate(-55,${x},${matrixOffsets.top - 12})`;
      })
      .text(d => d.feature.short)
      .append("title").text(d => d.feature.label);
    clickableLabel(svg.selectAll("text.x-label"), d => d.feature.key);
    const yLabels = svg.append("g").selectAll("text.matrix-label.y-label").data(headerData).join("text")
      .attr("class", "matrix-label y-label")
      .attr("x", matrixOffsets.left - 7)
      .attr("y", d => matrixOffsets.top + d.i * matrixCellSize + matrixCellSize / 2 + 3)
      .attr("text-anchor", "end")
      .text(d => d.feature.short)
      .append("title").text(d => d.feature.label);
    clickableLabel(svg.selectAll("text.y-label"), d => d.feature.key);
  }

  function drawParallel() {
    const scroll = $(".parallel-scroll");
    const width = Math.max(1120, scroll.clientWidth - 5);
    const height = 410;
    const margin = { top: 112, right: 48, bottom: 43, left: 48 };
    const top = margin.top;
    const bottom = height - margin.bottom;
    const x = d3.scalePoint().domain(FEATURES.map(d => d.key)).range([margin.left, width - margin.right]);
    const svg = d3.select("#parallel-plot").attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    parallelScales = new Map();
    parallelBrushSelections = new Map();

    FEATURES.forEach(feature => {
      const [min, max] = extents.get(feature.key);
      const pad = (max - min) * .025 || .5;
      parallelScales.set(feature.key, d3.scaleLinear().domain([min - pad, max + pad]).range([bottom, top]));
    });
    const line = d3.line().x(feature => x(feature.key)).y(feature => parallelScales.get(feature.key)(feature.value));
    const lineRows = DATA.map(d => ({ ...d, coords: FEATURES.map(feature => ({ key: feature.key, value: d[feature.key] })) }));
    svg.append("g").attr("class", "parallel-lines").selectAll("path.parallel-path").data(lineRows).join("path")
      .attr("class", "parallel-path")
      .attr("data-observation", d => d.__id)
      .attr("d", d => line(d.coords))
      .on("mouseenter", (event, d) => showTooltip(event, d, `Observation ${d.__id + 1}<br>${FEATURES[0].label} : ${niceNumber(d[FEATURES[0].key])}`))
      .on("mousemove", moveTooltip).on("mouseleave", hideTooltip);

    FEATURES.forEach(feature => {
      const axisScale = parallelScales.get(feature.key);
      const axisX = x(feature.key);
      const axisGroup = svg.append("g").attr("class", "parallel-axis")
        .attr("transform", `translate(${axisX},0)`)
        .call(d3.axisLeft(axisScale).ticks(4).tickSize(3).tickFormat(v => niceNumber(v, 3)));
      axisGroup.append("text").attr("class", "parallel-axis-label")
        .attr("x", 0).attr("y", top - 20)
        .attr("text-anchor", "middle").text(feature.short)
        .append("title").text(feature.label);
      clickableLabel(axisGroup.selectAll("text.parallel-axis-label"), () => feature.key);
      const brush = d3.brushY().extent([[-10, top], [10, bottom]])
        .on("start", event => {
          if (event.sourceEvent && !suppressBrushEvents) clearMatrixBrushes();
        })
        .on("brush end", () => {
          if (suppressBrushEvents) return;
          const ranges = [];
          parallelBrushSelections.forEach((selection, key) => {
            const pixels = d3.brushSelection(selection.node());
            if (pixels) {
              const scale = parallelScales.get(key);
              const values = [scale.invert(pixels[0]), scale.invert(pixels[1])].sort((a, b) => a - b);
              ranges.push({ key, values });
            }
          });
          if (!ranges.length) {
            setSelection([]);
            return;
          }
          setSelection(DATA.filter(d => ranges.every(r => d[r.key] >= r.values[0] && d[r.key] <= r.values[1])).map(d => d.__id));
        });
      const brushGroup = axisGroup.append("g").attr("class", "parallel-brush").call(brush);
      brushGroup.node().__brushBehavior = brush;
      parallelBrushSelections.set(feature.key, brushGroup);
    });
  }

  function gaussianKde(values, samplePoints, bandwidth) {
    if (!values.length) return samplePoints.map(x => ({ x, y: 0 }));
    const coefficient = 1 / Math.sqrt(2 * Math.PI);
    return samplePoints.map(x => ({
      x,
      y: values.reduce((sum, value) => {
        const z = (x - value) / bandwidth;
        return sum + coefficient * Math.exp(-.5 * z * z);
      }, 0) / (values.length * bandwidth)
    }));
  }

  function drawDistribution() {
    if (!DATA.length || !FEATURE_BY_KEY.has(detailKey)) return;
    const feature = FEATURE_BY_KEY.get(detailKey);
    const [minValue, maxValue] = extents.get(detailKey);
    const dataRange = safeRange(detailKey);
    const scroll = $(".distribution-scroll");
    const width = Math.max(650, scroll.clientWidth - 6);
    const height = 325;
    const margin = { top: 25, right: 26, bottom: 55, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const x = d3.scaleLinear().domain([minValue - dataRange * .025, maxValue + dataRange * .025]).range([0, innerWidth]);
    const subset = visibleData();
    const binInput = $("#bin-width");
    const bandwidthInput = $("#bandwidth");
    const binWidth = Number(binInput.value) || dataRange / 15;
    const bandwidth = Number(bandwidthInput.value) || dataRange * .08;
    $("#bin-width-output").value = niceNumber(binWidth, 4);
    $("#bin-width-output").textContent = niceNumber(binWidth, 4);
    $("#bandwidth-output").value = niceNumber(bandwidth, 4);
    $("#bandwidth-output").textContent = niceNumber(bandwidth, 4);

    const domain = x.domain();
    const thresholds = d3.range(domain[0] + binWidth, domain[1], binWidth);
    const binning = d3.bin().value(d => d[detailKey]).domain(domain).thresholds(thresholds);
    const bins = binning(DATA);
    const selectedBins = binning(subset);
    const samples = d3.range(121).map(i => domain[0] + i / 120 * (domain[1] - domain[0]));
    const allDensity = gaussianKde(DATA.map(d => d[detailKey]), samples, bandwidth)
      .map(d => ({ x: d.x, count: d.y * DATA.length * binWidth }));
    const selectedDensity = gaussianKde(subset.map(d => d[detailKey]), samples, bandwidth)
      .map(d => ({ x: d.x, count: d.y * subset.length * binWidth }));
    const countMax = Math.max(
      1,
      d3.max(bins, b => b.length) || 0,
      d3.max(selectedBins, b => b.length) || 0,
      d3.max(allDensity, d => d.count) || 0,
      d3.max(selectedDensity, d => d.count) || 0
    );
    const y = d3.scaleLinear().domain([0, countMax * 1.12]).nice().range([innerHeight, 0]);
    const svg = d3.select("#distribution-plot").attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    plot.append("g").attr("class", "chart-grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    const baseBars = plot.append("g").selectAll("rect.hist-bar").data(bins).join("rect")
      .attr("class", "hist-bar")
      .attr("x", b => x(b.x0) + 1)
      .attr("y", b => y(b.length))
      .attr("width", b => Math.max(0, x(b.x1) - x(b.x0) - 2))
      .attr("height", b => innerHeight - y(b.length));
    baseBars.append("title").text(b => `${niceNumber(b.x0)}–${niceNumber(b.x1)} : ${b.length} observation(s)`);
    if (selectionActive()) {
      const selectedBars = plot.append("g").selectAll("rect.hist-selected").data(selectedBins).join("rect")
        .attr("class", "hist-selected")
        .attr("x", b => x(b.x0) + 2)
        .attr("y", b => y(b.length))
        .attr("width", b => Math.max(0, x(b.x1) - x(b.x0) - 4))
        .attr("height", b => innerHeight - y(b.length));
      selectedBars.append("title").text(b => `${b.length} observation(s) sélectionnée(s)`);
    }

    const densityLine = d3.line().x(d => x(d.x)).y(d => y(d.count)).curve(d3.curveCatmullRom.alpha(.5));
    plot.append("path").datum(allDensity).attr("class", "kde-line").attr("d", densityLine);
    if (selectionActive() && subset.length) plot.append("path").datum(selectedDensity).attr("class", "kde-selected").attr("d", densityLine);
    plot.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(Math.max(4, Math.floor(innerWidth / 100))).tickFormat(v => niceNumber(v, 4)));
    plot.append("g").attr("class", "chart-axis").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")));
    plot.append("text").attr("class", "axis-title").attr("x", innerWidth / 2).attr("y", innerHeight + 43).attr("text-anchor", "middle").text(feature.label);
    plot.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", -innerHeight / 2).attr("y", -43).attr("text-anchor", "middle").text("Effectif équivalent");
    svg.append("text").attr("x", width - margin.right).attr("y", 17).attr("text-anchor", "end").attr("fill", "#6d7c78").attr("font-size", 10)
      .text(selectionActive() ? `${subset.length} sélectionnée(s) / ${DATA.length}` : `${DATA.length} observations`);
  }

  function showTooltip(event, row, content) {
    const tooltip = $("#tooltip");
    tooltip.innerHTML = `<strong>Observation ${row.__id + 1}</strong><br>${content}`;
    tooltip.style.display = "block";
    moveTooltip(event);
  }
  function moveTooltip(event) {
    const tooltip = $("#tooltip");
    tooltip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - 275)}px`;
    tooltip.style.top = `${Math.min(event.clientY + 12, window.innerHeight - 90)}px`;
  }
  function hideTooltip() { $("#tooltip").style.display = "none"; }

  document.addEventListener("DOMContentLoaded", initialize, { once: true });
})();
