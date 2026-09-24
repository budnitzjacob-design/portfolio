(() => {
  'use strict';
  const desktopOnly = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  if (!desktopOnly.matches) { location.replace('index.html'); return; }
  desktopOnly.addEventListener('change', event => {
    if (!event.matches) location.replace('index.html');
  });
  const projects = [
    ['BIOCOOLER', 'biocooler.html', 'BIOMEDICAL'],
    ['SYLLABUS', 'https://syllabus.fly.dev/', 'SOFTWARE'],
    ['ATLANTA EXPLORER', 'https://atlanta-explorer.fly.dev', 'EXPLORATION'],
    ['PEPTOCOPIA', 'https://peptocopeia.com', 'MEDICINE'],
    ['ORGANISM LOGGER', 'https://organism-logger.fly.dev', 'FIELD NOTES'],
    ['THERMOROID', 'thermoroid.html', 'INVENTION'],
    ['ARTWORKS', 'artworks.html', 'CREATIVE WORK'],
    ['RELAY', 'https://relaycallbell.com', 'CONNECTION'],
    ['CURRICULUM VITAE', 'research.html', 'EXPERIENCE'],
    ['PATENTS', 'projects.html', 'INTELLECTUAL PROPERTY'],
    ['BIOGRAPHY', 'biography.html', 'THE HUMAN']
  ];
  const $ = (s) => document.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cells = [], boardTime = 0, cols, rows, animationFrame, trailFrame = null;
  let hoveredCells = new Set();
  let grid, pointerFrame = null, lastPointer = null;
  let pointerSamples = [];
  const glyphMetrics = new Map();
  const activeCells = new Set();
  const trails = new Map();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*—';
  const typeMetrics = document.createElement('canvas').getContext('2d');
  const randChar = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  function buildBoard() {
    const root = $('#tiles'), bounds = root.getBoundingClientRect();
    const mobile = innerWidth <= 650;
    cols = mobile ? 24 : Math.max(42, Math.min(84, Math.floor(bounds.width / 25)));
    rows = mobile ? 32 : Math.max(28, Math.floor(bounds.height / 28));
    root.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    root.style.gridTemplateRows = `repeat(${rows},1fr)`;
    const gap = mobile ? 2 : 4, rowGap = mobile ? 4 : 5;
    const cw = (bounds.width - (cols - 1) * gap) / cols;
    const ch = (bounds.height - (rows - 1) * rowGap) / rows;
    root.style.setProperty('--tile-font', `${Math.min((cw - (mobile ? 2 : 4)) * 1.12, (ch - (mobile ? 4 : 6)) * .95)}px`);
    root.style.setProperty('--tile-height', `${ch - (mobile ? 4 : 6)}px`);
    grid = {left: bounds.left + scrollX, top: bounds.top + scrollY, cw, ch, pitchX: cw + gap, pitchY: ch + rowGap};
    glyphMetrics.clear();
    typeMetrics.font = `${parseFloat(root.style.getPropertyValue('--tile-font'))}px \"Times New Roman\"`;
    clearTrails();
    root.replaceChildren(); $('#board-links').replaceChildren(); cells = [];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < rows * cols; i++) {
      const socket = document.createElement('span'); socket.className = 'socket'; socket.dataset.index = i;
      const tile = document.createElement('span'); tile.className = 'tile';
      const top = document.createElement('span'), bottom = document.createElement('span');
      top.className = 'leaf top'; bottom.className = 'leaf bottom';
      const upperGlyph = document.createElement('span'), lowerGlyph = document.createElement('span');
      upperGlyph.className = lowerGlyph.className = 'glyph';
      top.append(upperGlyph); bottom.append(lowerGlyph); tile.append(top, bottom); socket.append(tile); fragment.append(socket);
      cells.push({tile, upperGlyph, lowerGlyph, char: null, target:' ', start:0, end:0, settled:false,
        protected: false,
        x: bounds.left + scrollX + (i % cols) * (cw + gap) + cw / 2,
        y: bounds.top + scrollY + Math.floor(i / cols) * (ch + rowGap) + ch / 2});
    }
    root.append(fragment);
    function word(text, row, col, name = false, href) {
      const ids = [];
      for (let j = 0; j < text.length; j++) {
        const id = row * cols + col + j;
        cells[id].target = text[j]; cells[id].protected = true; cells[id].tile.classList.add(name ? 'name' : 'lit'); ids.push(id);
      }
      if (href || name) {
        const a = document.createElement('a');
        if (name) {
          a.href = 'index.html?home=classic';
          a.setAttribute('aria-label', 'Jacob Budnitz — switch to original homepage');
        } else a.href = href;
        a.textContent = text; a.className = 'board-link';
        a.style.left = `${col * (cw + gap)}px`; a.style.top = `${row * (ch + rowGap)}px`;
        a.style.width = `${text.length * (cw + gap) - gap}px`; a.style.height = `${ch}px`;
        const highlight = (on) => ids.forEach(id => cells[id].tile.classList.toggle('selected', on));
        a.addEventListener('mouseenter', () => highlight(true)); a.addEventListener('mouseleave', () => highlight(false));
        a.addEventListener('focus', () => highlight(true)); a.addEventListener('blur', () => highlight(false));
        $('#board-links').append(a);
      }
    }
    word('JACOB BUDNITZ', 3, Math.floor((cols - 13) / 2), true);
    if (mobile) projects.forEach(([label, href], i) => word(label, 8 + i * 2, Math.floor((cols - label.length) / 2), false, href));
    else projects.forEach(([label, href], i) => {
      const column = i % 2, row = 9 + Math.floor(i / 2) * 3;
      const center = Math.floor(cols * (column ? .73 : .27));
      word(label, row, center - Math.floor(label.length / 2), false, href);
    });
    replayBoard();
  }
  function setChar(cell, char) {
    if (cell.char === char) return;
    cell.char = char;
    cell.upperGlyph.textContent = cell.lowerGlyph.textContent = char;
    if (!glyphMetrics.has(char)) {
      const m = typeMetrics.measureText(char === ' ' ? 'H' : char);
      const offset = ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) -
        (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent)) / 2;
      glyphMetrics.set(char, `${Number.isFinite(offset) ? offset : 0}px`);
    }
    cell.tile.style.setProperty('--glyph-offset', glyphMetrics.get(char));
  }
  function finishCell(cell) {
    cell.settled = true; setChar(cell, cell.target);
    cell.tile.classList.remove('spinning');
    cell.tile.classList.toggle('blank', cell.target === ' ');
  }
  function replayBoard() {
    clearTrails();
    boardTime = 0; lastFlip = 0; cancelAnimationFrame(animationFrame);
    activeCells.clear();
    cells.forEach(cell => {
      // Every card starts together. Titles settle only after the surrounding board.
      cell.end = cell.protected ? 2800 + Math.random() * 200 : 2200 + Math.random() * 400;
      cell.settled = false;
      cell.tile.style.setProperty('--intro-phase', `${-Math.random() * 480}ms`);
      cell.tile.classList.remove('blank');
      cell.tile.classList.toggle('spinning', !reduced);
      if (reduced) finishCell(cell);
      else { setChar(cell, randChar()); activeCells.add(cell); }
    });
    if (!reduced) { previous = 0; animationFrame = requestAnimationFrame(frame); }
  }
  let lastFlip = 0;
  function tickBoard(delta) {
    boardTime += delta;
    // Slower glyph changes keep the full-board animation inexpensive.
    const scramble = boardTime - lastFlip >= 480;
    if (scramble) lastFlip = boardTime;
    for (const cell of activeCells) {
      if (boardTime >= cell.end) { finishCell(cell); activeCells.delete(cell); }
      else if (scramble) setChar(cell, randChar());
    }
    return activeCells.size > 0;
  }
  const trailDuration = 1800;
  const flipDuration = 180;
  const shadeCount = 20;
  const trailModes = [
    {name: 'yellow', colors: [[255, 222, 53]]},
    {name: 'rainbow', colors: [[255, 222, 53], [255, 134, 28], [40, 115, 255], [42, 208, 92], [229, 34, 32]]},
  ];
  let trailMode = 0;
  for (const mode of trailModes) {
    mode.shades = Array.from({length: shadeCount}, (_, index) => {
      const position = index / (shadeCount - 1) * (mode.colors.length - 1);
      const segment = Math.min(Math.floor(position), Math.max(0, mode.colors.length - 2));
      const from = mode.colors[segment], to = mode.colors[Math.min(segment + 1, mode.colors.length - 1)];
      const t = position - segment;
      return `rgb(${from.map((value, channel) => Math.round(value + (to[channel] - value) * t)).join(', ')})`;
    });
  }
  $('#departures-board').dataset.trailMode = trailModes[trailMode].name;
  function paintTrail(cell, modeIndex, phase) {
    const mode = trailModes[modeIndex];
    cell.tile.style.setProperty('--trail-color', mode.shades[phase]);
    cell.tile.style.setProperty('--reflection-position', `${phase / (shadeCount - 1) * 100}%`);

  }
  function clearTrails() {
    cancelAnimationFrame(trailFrame); trailFrame = null;
    cancelAnimationFrame(pointerFrame); pointerFrame = null; pointerSamples = []; lastPointer = null;
    for (const cell of trails.keys()) resetTrail(cell);
    trails.clear(); hoveredCells.clear();
  }
  function resetTrail(cell) {
    cell.tile.classList.remove('heat-trail', 'circle-trail', 'single-trail', 'trail-entering', 'trail-exiting');
    cell.tile.style.removeProperty('--trail-color');
  }
  function animateTrails(now) {
    for (const [cell, trail] of trails) {
      const elapsed = now - trail.started;
      if (elapsed >= trailDuration) {
        resetTrail(cell); trails.delete(cell); continue;
      }
      if (elapsed >= trailDuration - flipDuration) {
        if (!trail.exiting) {
          trail.exiting = true;
          cell.tile.classList.remove('trail-entering');
          cell.tile.classList.add('trail-exiting');
        }
        // Swap to the black face while the card is edge-on.
        if (elapsed >= trailDuration - flipDuration / 2 && !trail.black) {
          trail.black = true;
          cell.tile.classList.remove('heat-trail', 'circle-trail');
        }
        continue;
      }
      if (elapsed >= flipDuration && !trail.entered) {
        trail.entered = true; cell.tile.classList.remove('trail-entering');
      }
      if (!trail.multicolor) continue;
      const phase = Math.min(shadeCount - 1, Math.floor(elapsed / ((trailDuration - flipDuration) / shadeCount)));
      if (phase !== trail.phase) {
        paintTrail(cell, trail.mode, phase); trail.phase = phase;
      }
    }
    trailFrame = trails.size ? requestAnimationFrame(animateTrails) : null;
  }
  function flipNearPointer(event) {
    if (event.pointerType === 'touch') return;
    const radius = 14.7;
    const nextHovered = new Set();
    const started = performance.now();
    // Direct grid lookup visits only the handful of cells near the cursor.
    const x = event.clientX + scrollX, y = event.clientY + scrollY;
    const minCol = Math.max(0, Math.floor((x - radius - grid.left) / grid.pitchX));
    const maxCol = Math.min(cols - 1, Math.floor((x + radius - grid.left) / grid.pitchX));
    const minRow = Math.max(0, Math.floor((y - radius - grid.top) / grid.pitchY));
    const maxRow = Math.min(rows - 1, Math.floor((y + radius - grid.top) / grid.pitchY));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const cell = cells[row * cols + col];
      if (cell.protected || !cell.settled) continue;
      if (Math.hypot(cell.x - (event.clientX + scrollX), cell.y - (event.clientY + scrollY)) > radius) continue;
      nextHovered.add(cell);
      if (hoveredCells.has(cell)) continue;
      setChar(cell, ' ');
      const multicolor = trailModes[trailMode].name === 'rainbow';
      trails.set(cell, {started, phase: 0, mode: trailMode, multicolor});
      cell.tile.classList.remove('trail-exiting');
      cell.tile.classList.toggle('single-trail', !multicolor);
      cell.tile.classList.toggle('trail-entering', !multicolor);
      cell.tile.classList.add('heat-trail');
      cell.tile.classList.add('circle-trail');
      paintTrail(cell, trailMode, 0);
    }
    hoveredCells = nextHovered;
    if (trails.size && !trailFrame) trailFrame = requestAnimationFrame(animateTrails);
  }
  function flushPointerPath() {
    cancelAnimationFrame(pointerFrame); pointerFrame = null;
    const samples = pointerSamples;
    pointerSamples = [];
    // Keep every sampled bend and fill fast gaps at less than half a tile pitch.
    const spacing = Math.min(10, grid.pitchX / 2, grid.pitchY / 2);
    for (const point of samples) {
      if (!lastPointer) flipNearPointer(point);
      else {
        const dx = point.clientX - lastPointer.clientX;
        const dy = point.clientY - lastPointer.clientY;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / spacing));
        for (let step = 1; step <= steps; step++) {
          flipNearPointer({clientX: lastPointer.clientX + dx * step / steps,
            clientY: lastPointer.clientY + dy * step / steps});
        }
      }
      lastPointer = point;
    }
  }
  function endPointerPath() {
    flushPointerPath(); lastPointer = null; hoveredCells.clear();
  }
  $('#departures-board').addEventListener('click', event => {
    if (event.target.closest('a, button')) return;
    flushPointerPath();
    trailMode = (trailMode + 1) % trailModes.length;
    $('#departures-board').dataset.trailMode = trailModes[trailMode].name;
    hoveredCells.clear();
    flipNearPointer(event);
  });
  $('#departures-board').addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const coalesced = event.getCoalescedEvents?.() || [];
    const samples = coalesced.length ? coalesced : [event];
    for (const sample of samples) pointerSamples.push({clientX: sample.clientX, clientY: sample.clientY});
    if (!pointerFrame) pointerFrame = requestAnimationFrame(flushPointerPath);
  }, {passive: true});
  $('#departures-board').addEventListener('pointerleave', endPointerPath);
  $('#departures-board').addEventListener('pointercancel', endPointerPath);
  addEventListener('blur', endPointerPath);
  addEventListener('scroll', endPointerPath, {passive: true});
  let previous = 0;
  function frame(now) {
    const delta = previous ? now - previous : 0;
    previous = now;
    const remaining = tickBoard(delta);
    if (remaining) animationFrame = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame); clearTrails();
    } else if (activeCells.size) {
      previous = 0; animationFrame = requestAnimationFrame(frame);
    }
  });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildBoard, 150);
  });
  // Old experiment URLs now open the same uninterrupted board.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  buildBoard();
})();
