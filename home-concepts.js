(() => {
  'use strict';
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
  let cells = [], boardTime = 0, cols, rows, animationFrame, hoverFrame;
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
    typeMetrics.font = `${parseFloat(root.style.getPropertyValue('--tile-font'))}px \"Times New Roman\"`;
    cancelAnimationFrame(hoverFrame); hoverFrame = null;
    root.replaceChildren(); $('#board-links').replaceChildren(); cells = [];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < rows * cols; i++) {
      const socket = document.createElement('span'); socket.className = 'socket';
      const tile = document.createElement('span'); tile.className = 'tile';
      const top = document.createElement('span'), bottom = document.createElement('span');
      top.className = 'leaf top'; bottom.className = 'leaf bottom';
      const upperGlyph = document.createElement('span'), lowerGlyph = document.createElement('span');
      upperGlyph.className = lowerGlyph.className = 'glyph';
      top.append(upperGlyph); bottom.append(lowerGlyph); tile.append(top, bottom); socket.append(tile); fragment.append(socket);
      cells.push({tile, upperGlyph, lowerGlyph, target:' ', end:0, settled:false,
        protected: false, hoverUntil: 0, nextScramble: 0,
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
      if (href) {
        const a = document.createElement('a'); a.href = href; a.textContent = text; a.className = 'board-link';
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
    lightBoard(bounds, cw, ch, gap, rowGap, mobile);
    replayBoard();
  }
  function setChar(cell, char) {
    cell.upperGlyph.textContent = cell.lowerGlyph.textContent = char;
    const m = typeMetrics.measureText(char === ' ' ? 'H' : char);
    const offset = ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) -
      (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent)) / 2;
    cell.tile.style.setProperty('--glyph-offset', `${Number.isFinite(offset) ? offset : 0}px`);
  }
  function replayBoard() {
    boardTime = 0; lastFlip = 0; cancelAnimationFrame(animationFrame);
    cells.forEach((cell, i) => {
      cell.end = 650 + (i % cols) * 22 + Math.floor(i / cols) * 45 + Math.random() * 1000;
      if (cell.target !== ' ') cell.end += 900;
      cell.settled = false; cell.tile.classList.remove('blank');
      cell.tile.classList.toggle('spinning', !reduced); setChar(cell, randChar());
    });
    if (reduced) settleBoard();
    else { previous = 0; animationFrame = requestAnimationFrame(frame); }
  }
  function settleBoard() {
    cells.forEach(cell => {cell.settled = true; setChar(cell, cell.target); cell.tile.classList.remove('spinning'); cell.tile.classList.toggle('blank', cell.target === ' ');});
  }
  let lastFlip = 0;
  function tickBoard(delta) {
    boardTime += delta;
    if (boardTime - lastFlip < 90 && boardTime >= lastFlip) return true;
    lastFlip = boardTime;
    let remaining = false;
    cells.forEach(cell => {
      if (cell.settled) return;
      if (boardTime >= cell.end) {
        cell.settled = true; setChar(cell, cell.target); cell.tile.classList.remove('spinning'); cell.tile.classList.toggle('blank', cell.target === ' ');
      } else {remaining = true; setChar(cell, randChar());}
    });
    return remaining;
  }
  // A fixed warm source above the upper-left corner shades the board relief.
  const lightCanvas = document.createElement('canvas');
  lightCanvas.id = 'board-light'; lightCanvas.setAttribute('aria-hidden', 'true');
  $('#departures-board').append(lightCanvas);
  const gl = lightCanvas.getContext('webgl', {alpha: false, antialias: false});
  let lightProgram;
  if (gl) {
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec2 resolution, boardSize, pitch, cardSize, inset;
      uniform float padding;
      void main() {
        vec2 uv = vec2(gl_FragCoord.x / resolution.x, 1.0 - gl_FragCoord.y / resolution.y);
        vec2 p = uv * boardSize;
        vec2 local = mod(p - vec2(padding), pitch);
        vec2 q = local - inset;
        vec2 inner = cardSize - inset * 2.0;
        vec3 normal = vec3(0.0, 0.0, 1.0);
        bool onCard = q.x > 0.0 && q.y > 0.0 && q.x < inner.x && q.y < inner.y;
        if (onCard) {
          // Beveled leaf edges face toward or away from the same light.
          normal.x = -exp(-q.x * 1.7) + exp(-(inner.x - q.x) * 1.7);
          normal.y = -exp(-q.y * 1.7) + exp(-(inner.y - q.y) * 1.7);
          normal = normalize(normal);
        }
        vec3 direction = vec3((vec2(.19, -.08) * boardSize - p) / boardSize.y, .42);
        float distanceToLight = length(direction);
        vec3 light = normalize(direction);
        float diffuse = max(dot(normal, light), 0.0);
        float intensity = .34 + .88 * diffuse / (1.0 + distanceToLight * distanceToLight * .85);
        float beam = exp(-length((uv - vec2(.19, .04)) * vec2(1.2, 1.0)) * 2.7);
        vec3 tint = mix(vec3(.83, .87, .94), vec3(1.0, .96, .87), beam);
        gl_FragColor = vec4(clamp(tint * intensity, .29, 1.0), 1.0);
      }
    `);
    if (vertex && fragment) {
      lightProgram = gl.createProgram(); gl.attachShader(lightProgram, vertex); gl.attachShader(lightProgram, fragment);
      gl.linkProgram(lightProgram);
      if (!gl.getProgramParameter(lightProgram, gl.LINK_STATUS)) lightProgram = null;
    }
    if (lightProgram) {
      gl.useProgram(lightProgram);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(lightProgram, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    }
  }
  function lightBoard(bounds, cw, ch, gap, rowGap, mobile) {
    if (!lightProgram) {
      lightCanvas.style.background = 'radial-gradient(ellipse at 19% 0%, #fff4db, #89909a 65%, #555b67)';
      return;
    }
    const board = $('#departures-board').getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    lightCanvas.width = Math.round(board.width * ratio); lightCanvas.height = Math.round(board.height * ratio);
    gl.viewport(0, 0, lightCanvas.width, lightCanvas.height);
    const vec = (name, x, y) => gl.uniform2f(gl.getUniformLocation(lightProgram, name), x, y);
    vec('resolution', lightCanvas.width, lightCanvas.height); vec('boardSize', board.width, board.height);
    vec('pitch', cw + gap, ch + rowGap); vec('cardSize', cw, ch); vec('inset', mobile ? 1 : 2, mobile ? 2 : 3);
    gl.uniform1f(gl.getUniformLocation(lightProgram, 'padding'), mobile ? 4 : 7);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function flipNearPointer(event) {
    if (reduced || event.pointerType === 'touch') return;
    const now = performance.now();
    const radius = 78;
    let touched = false;
    // Centers are recorded in document coordinates so this also works after scrolling.
    for (const cell of cells) {
      if (cell.protected || !cell.settled) continue;
      const distance = Math.hypot(cell.x - (event.clientX + scrollX), cell.y - (event.clientY + scrollY));
      if (distance > radius) continue;
      const strength = 1 - distance / radius;
      cell.hoverUntil = now + 170 + strength * 330 + Math.random() * 170;
      if (!cell.tile.classList.contains('hover-flipping')) {
        cell.tile.style.setProperty('--hover-speed', `${65 + Math.random() * 110}ms`);
        cell.tile.style.setProperty('--hover-phase', `${-Math.random() * 180}ms`);
        cell.tile.classList.remove('blank'); cell.tile.classList.add('hover-flipping');
        cell.nextScramble = 0;
      }
      touched = true;
    }
    if (touched && !hoverFrame) hoverFrame = requestAnimationFrame(animateHover);
  }
  function animateHover(now) {
    let active = false;
    for (const cell of cells) {
      if (!cell.hoverUntil) continue;
      if (now >= cell.hoverUntil) {
        cell.hoverUntil = 0; cell.tile.classList.remove('hover-flipping');
        cell.tile.classList.add('blank'); setChar(cell, ' ');
      } else {
        active = true;
        if (now >= cell.nextScramble) {
          setChar(cell, randChar()); cell.nextScramble = now + 45 + Math.random() * 70;
        }
      }
    }
    hoverFrame = active ? requestAnimationFrame(animateHover) : null;
  }
  $('#departures-board').addEventListener('pointermove', flipNearPointer, {passive: true});
  let previous = 0;
  function frame(now) {
    const delta = previous ? Math.min(now - previous, 100) : 0;
    previous = now;
    const remaining = document.hidden || tickBoard(delta);
    if (remaining) animationFrame = requestAnimationFrame(frame);
  }
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildBoard, 150);
  });
  // Old experiment URLs now open the same uninterrupted board.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  buildBoard();
})();
