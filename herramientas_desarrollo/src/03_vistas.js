
/* ===================== VISTAS 2D ===================== */
// Tipos de vista. h/v: ejes del mundo en horizontal/vertical de pantalla; hs/vs: sentido (+1 crece a la derecha / hacia arriba);
// prof: eje de profundidad; frente: +1 si lo más cercano al observador tiene la coordenada mayor. plano: plano de los contornos.
const TIPOS = {
  alzado:    { nombre: 'Alzado (frente)', h: 'x', hs: 1, v: 'y', vs: 1, prof: 'z', frente: 1, plano: 'alzado' },
  posterior: { nombre: 'Vista posterior', h: 'x', hs: -1, v: 'y', vs: 1, prof: 'z', frente: -1, plano: 'alzado' },
  planta:    { nombre: 'Planta (superior)', h: 'x', hs: 1, v: 'z', vs: -1, prof: 'y', frente: 1, plano: 'planta' },
  hormiga:   { nombre: 'Vista hormiga (inferior)', h: 'x', hs: -1, v: 'z', vs: -1, prof: 'y', frente: -1, plano: 'planta' },
  perfil:    { nombre: 'Perfil izquierdo', h: 'z', hs: 1, v: 'y', vs: 1, prof: 'x', frente: -1, plano: 'perfil' },
  perfilDer: { nombre: 'Perfil derecho', h: 'z', hs: -1, v: 'y', vs: 1, prof: 'x', frente: 1, plano: 'perfil' },
};
// Los tres paneles 2D: cada uno muestra el tipo de vista que se elija
const VISTAS = {};
const PANELES_DEF = { v1: 'alzado', v2: 'perfil', v3: 'planta' };
let panelesGuardados = {}; try { panelesGuardados = JSON.parse(localStorage.getItem('boceto3d.paneles') || '{}'); } catch (e) {}
for (const id in PANELES_DEF) {
  const el = document.querySelector(`.vista[data-vista="${id}"]`);
  VISTAS[id] = { id, el, cv: el.querySelector('canvas'), s: 4, ox: 60, oy: 300, W: 0, H: 0 };
  const selT = el.querySelector('.selVista');
  for (const [k, t] of Object.entries(TIPOS)) selT.appendChild(new Option(t.nombre, k));
  ponerTipo(VISTAS[id], TIPOS[panelesGuardados[id]] ? panelesGuardados[id] : PANELES_DEF[id], true);
  selT.addEventListener('change', () => { ponerTipo(VISTAS[id], selT.value); marcarActiva(VISTAS[id]); });
  el.querySelector('.bGrande').addEventListener('click', () => agrandar(el));
}
function ponerTipo(V, t, inicio) {
  Object.assign(V, TIPOS[t], { clave: t });
  V.el.querySelector('.selVista').value = t;
  V.el.querySelector('.vtit small').textContent = `(${V.h.toUpperCase()} · ${V.v.toUpperCase()})`;
  if (!inicio) {
    try { const o = {}; for (const k in VISTAS) o[k] = VISTAS[k].clave; localStorage.setItem('boceto3d.paneles', JSON.stringify(o)); } catch (e) {}
    encuadrarVista(V); dibujarVistas();
  }
}
function agrandar(el) {
  const cont = $('#vistas'), ya = el.classList.contains('grande');
  $$('.vista').forEach(v => v.classList.remove('grande'));
  if (ya) cont.classList.remove('maxi'); else { el.classList.add('grande'); cont.classList.add('maxi'); }
  $$('.bGrande').forEach(b => b.textContent = '⤢');
  if (!ya) el.querySelector('.bGrande').textContent = '⤡';
  setTimeout(() => { redimensionar(); Object.values(VISTAS).forEach(encuadrarVista); dibujarVistas(); }, 30);
}
const imgsBoceto = {}; // clave vista -> HTMLImageElement

function w2s(V, a, b) { return [V.ox + a * V.s * V.hs, V.oy - b * V.s * V.vs]; }
function s2w(V, sx, sy) { return [(sx - V.ox) / (V.s * V.hs), -(sy - V.oy) / (V.s * V.vs)]; }
function rectVista(V, p) { return { a0: p[V.h], a1: p[V.h] + p[DIM[V.h]], b0: p[V.v], b1: p[V.v] + p[DIM[V.v]] }; }
function rectPantalla(V, p) {
  const r = rectVista(V, p);
  const [xA, yA] = w2s(V, r.a0, r.b0), [xB, yB] = w2s(V, r.a1, r.b1);
  return { x: Math.min(xA, xB), y: Math.min(yA, yB), w: Math.abs(xB - xA), h: Math.abs(yB - yA) };
}
function profundidad(V, p) { return (p[V.prof] + p[DIM[V.prof]] / 2) * V.frente; }
// contorno de una pieza «con contorno» en coordenadas de mundo de su vista
function contornoMundo(p) {
  const V = TIPOS[p.plano] || TIPOS.alzado, c = p.contorno;
  const ka = p[DIM[V.h]] / (c.cw || 1), kb = p[DIM[V.v]] / (c.ch || 1);
  const a0 = p[V.h], b0 = p[V.v], b1 = b0 + p[DIM[V.v]];
  const f = ([u, v]) => [a0 + u * ka, V.vs > 0 ? b0 + v * kb : b1 - v * kb];
  return { V, ext: c.ext.map(f), huecos: (c.huecos || []).map(h => h.map(f)) };
}
function tieneContorno(p) { return p.forma === 'perfil' && p.contorno && p.contorno.ext && p.contorno.ext.length > 2; }

function ajustarTam(V) {
  const r = V.el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (r.width < 2) return;
  V.W = r.width; V.H = r.height;
  V.cv.width = Math.round(r.width * dpr); V.cv.height = Math.round(r.height * dpr);
}
function encuadrarVista(V) {
  if (!V.W) return;
  const b = bbox();
  const lim = { x: [b.x0, b.x1], y: [b.y0, b.y1], z: [b.z0, b.z1] };
  const [a0, a1] = lim[V.h], [b0, b1] = lim[V.v];
  const m = 40;
  V.s = Math.max(.2, Math.min((V.W - 2 * m) / Math.max(a1 - a0, 1), (V.H - 2 * m - 20) / Math.max(b1 - b0, 1)));
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  V.ox = V.W / 2 - ca * V.s * V.hs;
  V.oy = (V.H + 14) / 2 + cb * V.s * V.vs;
}
function encuadrarTodo() { Object.values(VISTAS).forEach(encuadrarVista); dibujarVistas(); encuadrar3D(); }

function estilo(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function trazarPieza(c, V, p) { // crea el camino de la pieza en la vista; devuelve true si es elipse/contorno
  c.beginPath();
  if (tieneContorno(p) && TIPOS[p.plano].h === V.h && TIPOS[p.plano].v === V.v) {
    const cm = contornoMundo(p);
    for (const anillo of [cm.ext, ...cm.huecos]) anillo.forEach((q, i) => { const [x, y] = w2s(V, q[0], q[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }), c.closePath();
    return true;
  }
  const r = rectPantalla(V, p);
  if (p.forma === 'cilindro' && p.eje === V.prof) { c.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.abs(r.w / 2), r.h / 2, 0, 0, Math.PI * 2); return true; }
  c.rect(Math.round(r.x) + .5, Math.round(r.y) + .5, Math.round(r.w), Math.round(r.h));
  return false;
}

function dibujarVista(V) {
  if (!V.W) return;
  const c = V.cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = estilo('--vista'); c.fillRect(0, 0, V.W, V.H);
  // boceto de fondo
  const bo = P.bocetos[V.clave], im = imgsBoceto[V.clave];
  if (bo && im && bo.visible !== false) {
    const [sx, sy] = w2s(V, bo.x, bo.y);
    c.globalAlpha = bo.opacidad ?? .6;
    // en modo oscuro el papel blanco del boceto taparía la vista: se invierte (papel negro, trazo claro) y se suma al fondo
    const oscuro = document.documentElement.dataset.theme === 'dark';
    if (oscuro) { c.save(); c.filter = 'invert(1)'; c.globalCompositeOperation = 'screen'; }
    c.drawImage(im, sx, sy, im.naturalWidth * bo.cmPorPx * V.s, im.naturalHeight * bo.cmPorPx * V.s);
    if (oscuro) c.restore();
    c.globalAlpha = 1;
  }
  // rejilla
  let paso = 1; const pasos = [0.1, 0.5, 1, 5, 10, 50, 100, 500];
  for (const p of pasos) { if (p * V.s >= 9) { paso = p; break; } }
  const [wA, wb0] = s2w(V, 0, V.H), [wB, wb1] = s2w(V, V.W, 0);
  const wa0 = Math.min(wA, wB), wa1 = Math.max(wA, wB), bmin = Math.min(wb0, wb1), bmax = Math.max(wb0, wb1);
  c.lineWidth = 1;
  const r1c = estilo('--rejilla'), r2c = estilo('--rejilla2');
  for (let a = Math.floor(wa0 / paso) * paso; a <= wa1; a += paso) {
    const x = Math.round(w2s(V, a, 0)[0]) + .5;
    const mayor = Math.abs(a / (paso * 10) - Math.round(a / (paso * 10))) < 1e-6;
    c.strokeStyle = mayor ? r2c : r1c; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, V.H); c.stroke();
  }
  for (let b = Math.floor(bmin / paso) * paso; b <= bmax; b += paso) {
    const y = Math.round(w2s(V, 0, b)[1]) + .5;
    const mayor = Math.abs(b / (paso * 10) - Math.round(b / (paso * 10))) < 1e-6;
    c.strokeStyle = mayor ? r2c : r1c; c.beginPath(); c.moveTo(0, y); c.lineTo(V.W, y); c.stroke();
  }
  // ejes
  const [ox, oy] = w2s(V, 0, 0);
  c.strokeStyle = estilo('--ejes'); c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(0, oy); c.lineTo(V.W, oy); c.moveTo(ox, 0); c.lineTo(ox, V.H); c.stroke();
  c.fillStyle = estilo('--suave'); c.font = '11px system-ui';
  c.fillText(V.h.toUpperCase(), V.hs > 0 ? V.W - 16 : 8, oy - 5); c.fillText(V.v.toUpperCase(), ox + 5, V.vs > 0 ? 30 : V.H - 8);
  // piezas
  const lista = P.piezas.filter(p => p.visible).slice().sort((a, b) => profundidad(V, a) - profundidad(V, b));
  if (temp && temp.V === V) lista.push(temp.p);
  const tx = estilo('--texto');
  for (const p of lista) {
    trazarPieza(c, V, p);
    c.fillStyle = colorPieza(p); c.globalAlpha = .42; c.fill('evenodd');
    c.globalAlpha = 1; c.strokeStyle = tx; c.lineWidth = 1; c.stroke();
  }
  c.globalAlpha = 1;
  // selección
  const acento = estilo('--acento');
  const L = temp && temp.V === V ? [temp.p] : seleccionadas().filter(p => p.visible);
  for (const p of L) { trazarPieza(c, V, p); c.strokeStyle = acento; c.lineWidth = 2; c.stroke(); }
  if (L.length === 1) {
    const ps = L[0], r = rectPantalla(V, ps);
    if (!temp) { c.strokeStyle = acento; c.lineWidth = 1; for (const h of manijas(V, ps)) { c.fillStyle = '#fff'; c.fillRect(h.x - 4, h.y - 4, 8, 8); c.strokeRect(h.x - 4, h.y - 4, 8, 8); } }
    const rv = rectVista(V, ps);
    cota(c, r.x, r.y + r.h + 16, r.x + r.w, r.y + r.h + 16, r1(rv.a1 - rv.a0) + '');
    cota(c, r.x + r.w + 16, r.y, r.x + r.w + 16, r.y + r.h, r1(rv.b1 - rv.b0) + '', true);
  } else if (L.length > 1) {
    const b = bboxSel(), q = { x: b.x0, y: b.y0, z: b.z0, w: b.x1 - b.x0, h: b.y1 - b.y0, d: b.z1 - b.z0 };
    const r = rectPantalla(V, q);
    c.setLineDash([6, 4]); c.strokeStyle = acento; c.lineWidth = 1; c.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); c.setLineDash([]);
    cota(c, r.x, r.y + r.h + 18, r.x + r.w, r.y + r.h + 18, r1(q[DIM[V.h]]) + '');
    cota(c, r.x + r.w + 18, r.y, r.x + r.w + 18, r.y + r.h, r1(q[DIM[V.v]]) + '', true);
  }
  // ventana de selección
  if (arrastre && arrastre.tipo === 'ventana' && arrastre.V === V && arrastre.x1 != null) {
    const A = arrastre, x = Math.min(A.sx, A.x1), y = Math.min(A.sy, A.y1), w = Math.abs(A.x1 - A.sx), h = Math.abs(A.y1 - A.sy);
    const cruce = A.x1 < A.sx;
    c.fillStyle = cruce ? 'rgba(40,170,90,.10)' : 'rgba(47,134,255,.10)'; c.fillRect(x, y, w, h);
    c.strokeStyle = cruce ? '#28aa5a' : '#2f86ff'; c.setLineDash(cruce ? [5, 4] : []); c.strokeRect(x + .5, y + .5, w, h); c.setLineDash([]);
  }
  // guías de imán
  if (guias.V === V) {
    c.strokeStyle = '#e0457b'; c.setLineDash([4, 4]); c.lineWidth = 1;
    for (const a of guias.a) { const x = w2s(V, a, 0)[0]; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, V.H); c.stroke(); }
    for (const b of guias.b) { const y = w2s(V, 0, b)[1]; c.beginPath(); c.moveTo(0, y); c.lineTo(V.W, y); c.stroke(); }
    c.setLineDash([]);
  }
  // calibración
  if (calib && calib.V === V) {
    c.strokeStyle = '#e0457b'; c.fillStyle = '#e0457b'; c.lineWidth = 2;
    const pts = calib.pts.map(q => w2s(V, q[0], q[1]));
    if (calib.mov) pts.push(calib.mov);
    c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
    pts.forEach(q => { c.beginPath(); c.arc(q[0], q[1], 4, 0, 7); c.fill(); });
  }
}
function cota(c, x0, y0, x1, y1, txt, vert) {
  const acento = estilo('--acento');
  c.strokeStyle = acento; c.fillStyle = acento; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  const t = 4;
  c.beginPath();
  if (vert) { c.moveTo(x0 - t, y0); c.lineTo(x0 + t, y0); c.moveTo(x1 - t, y1); c.lineTo(x1 + t, y1); }
  else { c.moveTo(x0, y0 - t); c.lineTo(x0, y0 + t); c.moveTo(x1, y1 - t); c.lineTo(x1, y1 + t); }
  c.stroke();
  c.font = '600 11px system-ui';
  const w = c.measureText(txt).width;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.fillStyle = estilo('--vista'); c.fillRect(cx - w / 2 - 3, cy - 7, w + 6, 14);
  c.fillStyle = acento; c.fillText(txt, cx - w / 2, cy + 4);
}
function manijas(V, p) {
  const r = rectPantalla(V, p), L = [];
  for (const [fx, fy] of [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]]) {
    const ea = (fx === 0 ? -1 : fx === 1 ? 1 : 0) * V.hs;
    const arriba = fy === 0 ? 1 : fy === 1 ? -1 : 0;
    L.push({ x: r.x + r.w * fx, y: r.y + r.h * fy, ea, eb: arriba * V.vs, fx, fy });
  }
  return L;
}
let pendienteDibujo = false;
function dibujarVistas() {
  if (pendienteDibujo) return; pendienteDibujo = true;
  requestAnimationFrame(() => { pendienteDibujo = false; Object.values(VISTAS).forEach(dibujarVista); });
}

/* ---------- Imán y rejilla ---------- */
let guias = { V: null, a: [], b: [] };
function rejilla() { return parseFloat($('#sRejilla').value) || 0; }
function candidatos(eje, excluir) {
  const ex = excluir instanceof Set ? excluir : new Set(excluir ? [excluir] : []);
  const L = [0];
  for (const p of P.piezas) { if (!p.visible || ex.has(p.id)) continue; L.push(p[eje], p[eje] + p[DIM[eje]]); }
  return L;
}
function imanar(V, valor, eje, excluir) {
  if ($('#cImanes').checked) {
    const tol = 7 / V.s; let mejor = null;
    for (const c of candidatos(eje, excluir)) { const d = Math.abs(c - valor); if (d < tol && (!mejor || d < mejor.d)) mejor = { d, v: c }; }
    if (mejor) return { v: mejor.v, guia: true };
  }
  const g = rejilla(); return { v: g ? Math.round(valor / g) * g : valor, guia: false };
}
function imanarMovimiento(V, ini, tam, eje, excluir) {
  if ($('#cImanes').checked) {
    const tol = 7 / V.s; let mejor = null;
    for (const c of candidatos(eje, excluir)) {
      for (const off of [0, tam]) { const d = Math.abs(c - (ini + off)); if (d < tol && (!mejor || d < mejor.d)) mejor = { d, v: c - off, g: c }; }
    }
    if (mejor) return { v: mejor.v, guia: mejor.g };
  }
  const g = rejilla(); return { v: g ? Math.round(ini / g) * g : ini, guia: null };
}

/* ---------- Interacción en vistas ---------- */
let arrastre = null, temp = null, calib = null;
const punteros = new Map();

function piezaEn(V, sx, sy) {
  const dentro = p => { const r = rectPantalla(V, p); return sx >= r.x - 2 && sx <= r.x + r.w + 2 && sy >= r.y - 2 && sy <= r.y + r.h + 2; };
  const candidatas = P.piezas.filter(p => p.visible && dentro(p));
  if (!candidatas.length) return null;
  // la más pequeña en pantalla: facilita coger tiradores y frentes que quedan encima de laterales
  candidatas.sort((a, b) => { const ra = rectPantalla(V, a), rb = rectPantalla(V, b); return Math.abs(ra.w * ra.h) - Math.abs(rb.w * rb.h); });
  return candidatas[0];
}
function piezasEnVentana(V, x0, y0, x1, y1, cruce) {
  const X0 = Math.min(x0, x1), X1 = Math.max(x0, x1), Y0 = Math.min(y0, y1), Y1 = Math.max(y0, y1);
  return P.piezas.filter(p => {
    if (!p.visible) return false;
    const r = rectPantalla(V, p), rx0 = Math.min(r.x, r.x + r.w), rx1 = Math.max(r.x, r.x + r.w);
    if (cruce) return rx1 >= X0 && rx0 <= X1 && r.y + r.h >= Y0 && r.y <= Y1;
    return rx0 >= X0 && rx1 <= X1 && r.y >= Y0 && r.y + r.h <= Y1;
  });
}

function tercera(V) {
  const b = bbox(), eje = V.prof, modo = $('#sTercera').value;
  const lim = { x: [b.x0, b.x1], y: [b.y0, b.y1], z: [b.z0, b.z1] }[eje];
  const g = parseFloat($('#nGrosor').value) || 1.9;
  if (modo === 'grosor') return V.frente > 0 ? [lim[1] - g, g] : [lim[0], g];
  return [lim[0], Math.max(lim[1] - lim[0], .1)];
}

Object.values(VISTAS).forEach(V => {
  const cv = V.cv;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, [e.offsetX, e.offsetY]);
    marcarActiva(V);
    if (punteros.size === 2) { // pellizco
      const [p1, p2] = [...punteros.values()];
      arrastre = { tipo: 'pellizco', V, d0: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), s0: V.s, ox0: V.ox, oy0: V.oy, c0: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2] };
      temp = null; return;
    }
    const sx = e.offsetX, sy = e.offsetY;
    const [wa, wb] = s2w(V, sx, sy);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && teclaEspacio)) {
      arrastre = { tipo: 'pan', V, sx, sy, ox: V.ox, oy: V.oy }; return;
    }
    if (herramienta === 'calibrar') {
      if (!P.bocetos[V.clave]) { aviso('Primero carga un boceto en esta vista'); return; }
      if (!calib || calib.V !== V) calib = { V, pts: [] };
      calib.pts.push([wa, wb]);
      if (calib.pts.length === 2) terminarCalibracion();
      dibujarVistas(); return;
    }
    if (herramienta === 'mover-boceto') {
      const bo = P.bocetos[V.clave]; if (!bo) { aviso('No hay boceto en esta vista'); return; }
      arrastre = { tipo: 'boceto', V, wa, wb, x0: bo.x, y0: bo.y }; return;
    }
    if (herramienta === 'rect') {
      arrastre = { tipo: 'nueva', V, a: imanar(V, wa, V.h, null).v, b: imanar(V, wb, V.v, null).v };
      return;
    }
    // ---- seleccionar ----
    const mod = e.shiftKey || e.ctrlKey || e.metaKey;
    const s = piezaSel();
    if (s && s.visible && !mod) {
      const h = manijas(V, s).find(h => Math.abs(h.x - sx) < 7 && Math.abs(h.y - sy) < 7);
      if (h) { arrastre = { tipo: 'tam', V, h, orig: Object.assign({}, s), movido: false }; return; }
    }
    const p = piezaEn(V, sx, sy);
    if (p) {
      if (mod) seleccionar(p.id, { alternar: true, grupo: !e.altKey });
      else if (!sel.has(p.id) || e.altKey) seleccionar(p.id, { grupo: !e.altKey });
      if (!sel.has(p.id)) return;
      const L = seleccionadas();
      const b = bboxSel();
      arrastre = { tipo: 'mover', V, wa, wb, orig: new Map(L.map(q => [q.id, { x: q.x, y: q.y, z: q.z }])),
        b0: { x: b.x0, y: b.y0, z: b.z0 }, tam: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, movido: false };
    } else {
      if (!mod) seleccionar(null);
      arrastre = { tipo: 'ventana', V, sx, sy, x1: null, y1: null, base: mod ? new Set(sel) : new Set() };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (punteros.has(e.pointerId)) punteros.set(e.pointerId, [e.offsetX, e.offsetY]);
    const sx = e.offsetX, sy = e.offsetY;
    const [wa, wb] = s2w(V, sx, sy);
    $('#estado').textContent = `${V.h.toUpperCase()} ${r1(wa).toFixed(1)}   ${V.v.toUpperCase()} ${r1(wb).toFixed(1)} cm`;
    if (calib && calib.V === V && calib.pts.length === 1) { calib.mov = [sx, sy]; dibujarVistas(); }
    if (!arrastre) {
      let cur = herramienta === 'rect' || herramienta === 'calibrar' ? 'crosshair' : herramienta === 'mover-boceto' ? 'move' : 'default';
      const s = piezaSel();
      if (herramienta === 'sel') {
        const h = s && s.visible ? manijas(V, s).find(h => Math.abs(h.x - sx) < 7 && Math.abs(h.y - sy) < 7) : null;
        if (h) cur = (h.ea && h.eb) ? (h.fx === h.fy ? 'nwse-resize' : 'nesw-resize') : h.ea ? 'ew-resize' : 'ns-resize';
        else if (piezaEn(V, sx, sy)) cur = 'move';
      }
      cv.style.cursor = cur; return;
    }
    const A = arrastre;
    if (A.tipo === 'pellizco') {
      if (punteros.size < 2) return;
      const [p1, p2] = [...punteros.values()];
      const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      V.s = Math.max(.1, Math.min(400, A.s0 * d / A.d0));
      V.ox = c[0] - (A.c0[0] - A.ox0) * (V.s / A.s0); V.oy = c[1] - (A.c0[1] - A.oy0) * (V.s / A.s0);
      dibujarVistas(); return;
    }
    if (A.tipo === 'pan') { V.ox = A.ox + sx - A.sx; V.oy = A.oy + sy - A.sy; dibujarVistas(); return; }
    if (A.tipo === 'boceto') { const bo = P.bocetos[V.clave]; bo.x = A.x0 + (wa - A.wa); bo.y = A.y0 + (wb - A.wb); dibujarVistas(); return; }
    if (A.tipo === 'ventana') {
      A.x1 = sx; A.y1 = sy;
      if (Math.hypot(sx - A.sx, sy - A.sy) > 3) {
        const ids = piezasEnVentana(V, A.sx, A.sy, sx, sy, sx < A.sx).map(p => p.id);
        sel = new Set([...A.base, ...expandirGrupos(ids)]);
        pintarLista(); pintarProps(); marcar3D();
      }
      dibujarVistas(); return;
    }
    if (A.tipo === 'nueva') {
      const ra = imanar(V, wa, V.h, null), rb = imanar(V, wb, V.v, null);
      const a0 = Math.min(A.a, ra.v), a1 = Math.max(A.a, ra.v), b0 = Math.min(A.b, rb.v), b1 = Math.max(A.b, rb.v);
      const [t0, tt] = tercera(V);
      const o = {}; o[V.h] = a0; o[DIM[V.h]] = Math.max(a1 - a0, .01); o[V.v] = b0; o[DIM[V.v]] = Math.max(b1 - b0, .01);
      o[V.prof] = t0; o[DIM[V.prof]] = tt;
      temp = { V, p: nuevaPieza(Object.assign(o, { material: ultimoMaterial })) };
      guias = { V, a: ra.guia ? [ra.v] : [], b: rb.guia ? [rb.v] : [] };
      dibujarVistas(); return;
    }
    if (A.tipo === 'mover') {
      const da = wa - A.wa, db = wb - A.wb;
      if (!A.movido && Math.hypot(da, db) * V.s < 3) return;
      if (!A.movido) { guardarHistoria(); A.movido = true; }
      const ma = imanarMovimiento(V, A.b0[V.h] + da, A.tam[V.h], V.h, sel);
      const mb = imanarMovimiento(V, A.b0[V.v] + db, A.tam[V.v], V.v, sel);
      if (e.shiftKey) { if (Math.abs(da) > Math.abs(db)) mb.v = A.b0[V.v]; else ma.v = A.b0[V.h]; }
      const dA = ma.v - A.b0[V.h], dB = mb.v - A.b0[V.v];
      for (const q of seleccionadas()) { const o = A.orig.get(q.id); if (!o) continue; q[V.h] = r1(o[V.h] + dA); q[V.v] = r1(o[V.v] + dB); }
      guias = { V, a: ma.guia != null ? [ma.guia] : [], b: mb.guia != null ? [mb.guia] : [] };
      cambio(false); return;
    }
    if (A.tipo === 'tam') {
      const s = piezaSel(); if (!s) return;
      if (!A.movido) { guardarHistoria(); A.movido = true; }
      const o = A.orig, h = A.h; guias = { V, a: [], b: [] };
      if (h.ea) {
        const r = imanar(V, wa, V.h, s.id); if (r.guia) guias.a.push(r.v);
        let a0 = o[V.h], a1 = o[V.h] + o[DIM[V.h]];
        if (h.ea < 0) a0 = Math.min(r.v, a1 - .1); else a1 = Math.max(r.v, a0 + .1);
        s[V.h] = r1(a0); s[DIM[V.h]] = r1(a1 - a0);
      }
      if (h.eb) {
        const r = imanar(V, wb, V.v, s.id); if (r.guia) guias.b.push(r.v);
        let b0 = o[V.v], b1 = o[V.v] + o[DIM[V.v]];
        if (h.eb < 0) b0 = Math.min(r.v, b1 - .1); else b1 = Math.max(r.v, b0 + .1);
        s[V.v] = r1(b0); s[DIM[V.v]] = r1(b1 - b0);
      }
      cambio(false); return;
    }
  });
  const fin = e => {
    punteros.delete(e.pointerId);
    const A = arrastre; arrastre = null;
    guias = { V: null, a: [], b: [] };
    if (!A) return;
    if (A.tipo === 'nueva') {
      if (temp && temp.p[DIM[V.h]] > .2 && temp.p[DIM[V.v]] > .2) {
        guardarHistoria(); P.piezas.push(temp.p); const id = temp.p.id; temp = null; seleccionar(id); cambio(true);
      } else { temp = null; dibujarVistas(); }
      return;
    }
    if (A.tipo === 'ventana') { pintarLista(); pintarProps(); }
    if (A.tipo === 'boceto') guardarLocal();
    if ((A.tipo === 'mover' || A.tipo === 'tam') && A.movido) cambio(true);
    dibujarVistas();
  };
  cv.addEventListener('pointerup', fin);
  cv.addEventListener('pointercancel', fin);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * .0015), s0 = V.s;
    V.s = Math.max(.1, Math.min(400, V.s * k));
    V.ox = e.offsetX - (e.offsetX - V.ox) * (V.s / s0); V.oy = e.offsetY - (e.offsetY - V.oy) * (V.s / s0);
    dibujarVistas();
  }, { passive: false });
  cv.addEventListener('dblclick', e => {
    if (herramienta !== 'sel') return;
    const p = piezaEn(V, e.offsetX, e.offsetY);
    if (!p) { encuadrarVista(V); dibujarVistas(); }
    else if (p.grupo) seleccionar(p.id, { grupo: false }); // entrar en el grupo
  });
});
let vistaActiva = VISTAS.v1;
function marcarActiva(V) { vistaActiva = V; $$('.vista').forEach(e => e.classList.toggle('activa', e === V.el)); }

let teclaEspacio = false;

function terminarCalibracion() {
  const V = calib.V, [p1, p2] = calib.pts;
  const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  modal('Escalar boceto', `<p class="nota">Has marcado ${r1(dist)} cm según la escala actual. ¿Cuánto mide en la realidad?</p>
    <label class="fila">Medida real (cm) <input type="number" id="f_real" value="${r1(dist)}" step="0.1"></label>`, [
    { txt: 'Cancelar' },
    { txt: 'Aplicar', primario: true, fn: () => {
      const real = fv('real'); if (!(real > 0) || dist <= 0) return false;
      const bo = P.bocetos[V.clave], k = real / dist;
      bo.x = p1[0] + (bo.x - p1[0]) * k; bo.y = p1[1] + (bo.y - p1[1]) * k; bo.cmPorPx *= k;
      guardarLocal(); aviso('Boceto escalado'); } }]);
  cerrarModal.alCerrar = () => { calib = null; dibujarVistas(); };
}
