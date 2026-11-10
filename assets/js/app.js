/* Boceto a Render 3D — Por Eloi A.A.
   Programa: EUPL-1.2 · Manual: CC BY-SA 4.0
   Unidades internas: centímetros. Ejes: X ancho (izq→der), Y alto, Z fondo (atrás→delante; el frente mira a +Z).
   Este archivo se genera uniendo las partes de la carpeta src (01_base … 07_inicio). */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const T = window.THREE;
const CLAVE_LS = 'boceto3d.proyecto';
const VERSION = '3.4';

/* ===================== MATERIALES ===================== */
const MATERIALES = {
  roble:   { nombre: 'Roble', tipo: 'madera', tex: 'roble', hex: '#b88d5e' },
  haya:    { nombre: 'Haya', tipo: 'madera', tex: 'haya', hex: '#d4a67e' },
  pino:    { nombre: 'Pino', tipo: 'madera', tex: 'pino', hex: '#ddb77f' },
  fresno:  { nombre: 'Fresno', tipo: 'madera', tex: 'fresno', hex: '#d5bd97' },
  cerezo:  { nombre: 'Cerezo', tipo: 'madera', tex: 'cerezo', hex: '#a96a45' },
  teca:    { nombre: 'Teca', tipo: 'madera', tex: 'teca', hex: '#99693d' },
  nogal:   { nombre: 'Nogal', tipo: 'madera', tex: 'nogal', hex: '#6a4630' },
  wengue:  { nombre: 'Wengué', tipo: 'madera', tex: 'wengue', hex: '#3b2a1f' },
  melamina_blanca: { nombre: 'Melamina blanca', tipo: 'color', hex: '#f1f0ec', rough: .55 },
  melamina_gris:   { nombre: 'Melamina gris', tipo: 'color', hex: '#9a9c9e', rough: .6 },
  melamina_antracita: { nombre: 'Melamina antracita', tipo: 'color', hex: '#3a3c3f', rough: .6 },
  lacado:  { nombre: 'Lacado (color a elegir)', tipo: 'lacado', hex: '#ffffff' },
  negro_mate: { nombre: 'Metal negro mate', tipo: 'metalpint', hex: '#1d1d1f', rough: .55 },
  inox:    { nombre: 'Acero inoxidable', tipo: 'metal', hex: '#c7c9cb', rough: .3 },
  laton:   { nombre: 'Latón', tipo: 'metal', hex: '#c9a35a', rough: .28 },
  aluminio:{ nombre: 'Aluminio', tipo: 'metal', hex: '#b8bcc0', rough: .42 },
  cristal: { nombre: 'Cristal', tipo: 'cristal', hex: '#cfe3e6' },
};
const TEX_CM = 80; // las texturas de madera de la biblioteca representan 80 x 80 cm
const ALMAS = {
  aglomerado:    { nombre: 'Aglomerado', tex: 'alma_aglomerado', cm: 20, hex: '#c8a879' },
  mdf:           { nombre: 'MDF', tex: 'alma_mdf', cm: 20, hex: '#a9845c' },
  contrachapado: { nombre: 'Contrachapado', tex: 'alma_contrachapado', cm: 4.8, hex: '#dcc196' },
};
// Maderas de fotos: del aula (archivo assets/texturas/maderas_aula.js), de la biblioteca personal (navegador) y del proyecto
const AULA = window.MADERAS_AULA || {};
let BIBLIO = {}; // se carga de IndexedDB al iniciar

function datosMaderaFoto(clave) {
  return (P.maderasUsuario && P.maderasUsuario[clave]) || BIBLIO[clave] || AULA[clave] || null;
}
function infoMaterial(clave) {
  if (MATERIALES[clave]) return MATERIALES[clave];
  const u = datosMaderaFoto(clave);
  if (u) return { nombre: u.nombre, tipo: 'madera', usuario: true, hex: u.hex || '#a07850' };
  return MATERIALES.roble;
}
// al usar una madera de la biblioteca o del aula, se copia al proyecto para que el archivo .json sea completo
function asegurarMadera(clave) {
  if (MATERIALES[clave] || P.maderasUsuario[clave]) return;
  const u = BIBLIO[clave] || AULA[clave];
  if (u) P.maderasUsuario[clave] = JSON.parse(JSON.stringify(u));
}
function colorPieza(p) {
  const m = infoMaterial(p.material);
  return m.tipo === 'lacado' ? p.color : m.hex;
}
// alma del tablero según el material
function nucleoDe(p) {
  const m = infoMaterial(p.material);
  if (['metal', 'metalpint', 'cristal'].includes(m.tipo) || p.forma === 'cilindro') return 'macizo';
  if (p.nucleo && p.nucleo !== 'auto') return p.nucleo;
  return m.tipo === 'madera' ? 'macizo' : 'aglomerado';
}

/* ===================== ESTADO ===================== */
function escenaDefecto() {
  return { escenario: 'blanco', fondo: '#efeeea', azimut: -40, altura: 48, suave: .55, intens: 1.6, amb: .7, expo: 1, lente: 50, dof: 0 };
}
function proyectoVacio() {
  return { app: 'Boceto a Render 3D', version: 2, versionPrograma: VERSION, nombre: 'proyecto', piezas: [], grupos: {}, bocetos: {}, referencia: null,
           escena: escenaDefecto(), maderasUsuario: {}, camara: null, vista: { abrir: 0, explosion: 0 } };
}
let P = proyectoVacio();
let sel = new Set();          // ids de las piezas seleccionadas
let herramienta = 'sel';
let historial = [], futuro = [];
let contador = 1;
let renderFinalActivo = false;

function nuevoId(pref) { return (pref || 'p') + Date.now().toString(36) + (contador++).toString(36); }
function pieza(id) { return P.piezas.find(p => p.id === id); }
function seleccionadas() { return P.piezas.filter(p => sel.has(p.id)); }
function piezaSel() { if (sel.size !== 1) return null; return pieza([...sel][0]) || null; }
function piezasGrupo(g) { return P.piezas.filter(p => p.grupo === g); }
// si la selección es exactamente un grupo entero, devuelve su id
function grupoSel() {
  const L = seleccionadas(); if (!L.length) return null;
  const g = L[0].grupo; if (!g || !P.grupos[g]) return null;
  if (L.some(p => p.grupo !== g)) return null;
  return piezasGrupo(g).length === L.length ? g : null;
}

function nuevaPieza(o) {
  return Object.assign({ id: nuevoId(), nombre: 'Pieza ' + (P.piezas.length + 1), forma: 'caja', eje: 'y',
    x: 0, y: 0, z: 0, w: 10, h: 10, d: 10, material: 'roble', color: '#ffffff', acabado: 'satinado',
    veta: 'auto', canto: 1, visible: true, grupo: null,
    nucleo: 'auto', cantos: 'ajuego', cantoMat: 'roble', cantoColor: '#222222',
    plano: null, contorno: null }, o);
}
function nuevoGrupo(nombre, ids, mov) {
  const g = nuevoId('g');
  P.grupos[g] = { nombre: nombre || 'Grupo ' + (Object.keys(P.grupos).length + 1), mov: mov || { tipo: 'ninguno', valor: 0 }, plegado: false };
  ids.forEach(id => { const p = pieza(id); if (p) p.grupo = g; });
  return g;
}
function limpiarGrupos() { // quita grupos vacíos
  const usados = new Set(P.piezas.map(p => p.grupo).filter(Boolean));
  for (const g of Object.keys(P.grupos)) if (!usados.has(g)) delete P.grupos[g];
  P.piezas.forEach(p => { if (p.grupo && !P.grupos[p.grupo]) p.grupo = null; });
}

function foto() { return JSON.stringify({ piezas: P.piezas, grupos: P.grupos }); }
function restaurar(s) { const o = JSON.parse(s); P.piezas = o.piezas; P.grupos = o.grupos || {}; }
function guardarHistoria() {
  historial.push(foto());
  if (historial.length > 120) historial.shift();
  futuro = [];
}
function deshacer() {
  if (!historial.length) return aviso('Nada que deshacer');
  futuro.push(foto()); restaurar(historial.pop()); depurarSel(); cambio(true);
}
function rehacer() {
  if (!futuro.length) return aviso('Nada que rehacer');
  historial.push(foto()); restaurar(futuro.pop()); depurarSel(); cambio(true);
}
function depurarSel() { for (const id of [...sel]) if (!pieza(id)) sel.delete(id); }

/* ===================== UTILIDADES ===================== */
const DIM = { x: 'w', y: 'h', z: 'd' };
const r1 = v => Math.round(v * 100) / 100;
function bbox(lista, excluir) {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity, vacio: true };
  const ex = excluir instanceof Set ? excluir : new Set(excluir ? [excluir] : []);
  for (const p of (lista || P.piezas)) {
    if (!p.visible || ex.has(p.id)) continue;
    b.vacio = false;
    b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.z0 = Math.min(b.z0, p.z);
    b.x1 = Math.max(b.x1, p.x + p.w); b.y1 = Math.max(b.y1, p.y + p.h); b.z1 = Math.max(b.z1, p.z + p.d);
  }
  if (b.vacio) Object.assign(b, { x0: 0, y0: 0, z0: 0, x1: 50, y1: 60, z1: 40 });
  return b;
}
function bboxSel() { const L = seleccionadas(); return bbox(L.map(p => Object.assign({}, p, { visible: true }))); }
function aviso(t) {
  const a = $('#aviso'); a.textContent = t; a.classList.add('ver');
  clearTimeout(aviso._t); aviso._t = setTimeout(() => a.classList.remove('ver'), 2600);
}
function descargar(nombre, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function leerArchivo(accept, comoTexto, multiple) {
  return new Promise(res => {
    const f = $('#fArchivo'); f.value = ''; f.accept = accept; f.multiple = !!multiple;
    f.onchange = async () => {
      const files = [...f.files]; if (!files.length) return res(null);
      const leer = file => new Promise(r2 => { const rd = new FileReader(); rd.onload = () => r2({ nombre: file.name, datos: rd.result }); comoTexto ? rd.readAsText(file) : rd.readAsDataURL(file); });
      const L = []; for (const file of files) L.push(await leer(file));
      res(multiple ? L : L[0]);
    };
    f.click();
  });
}
function hashNum(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function cargarImagen(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ===================== MODAL ===================== */
function modal(titulo, html, botones, ancho) {
  if (cerrarModal.alCerrar) { const f = cerrarModal.alCerrar; cerrarModal.alCerrar = null; f(); }
  $('#mTitulo').textContent = titulo; $('#mCuerpo').innerHTML = html;
  const pie = $('#mPie'); pie.innerHTML = '';
  (botones || []).forEach(b => {
    const e = document.createElement('button'); e.textContent = b.txt; if (b.primario) e.className = 'primario';
    e.onclick = () => { if (b.fn && b.fn() === false) return; if (!b.mantener) cerrarModal(); };
    pie.appendChild(e); b.el = e;
  });
  $('#modal .caja').style.width = ancho || (html.includes('class="render"') ? 'auto' : '');
  arrastreModal.dx = arrastreModal.dy = 0; $('#modal .caja').style.transform = '';
  $('#modal').classList.remove('oculto');
  const prim = $('#mCuerpo input:not([type=checkbox])'); if (prim) setTimeout(() => prim.focus(), 30);
}
function cerrarModal() { $('#modal').classList.add('oculto'); if (cerrarModal.alCerrar) { const f = cerrarModal.alCerrar; cerrarModal.alCerrar = null; f(); } }
$('#mCerrar').onclick = cerrarModal;
// las ventanas se pueden arrastrar por su título para ver lo que hay detrás (doble clic: volver al centro)
const arrastreModal = { dx: 0, dy: 0, ini: null };
(function () {
  const tit = $('#modal .mtit'), caja = $('#modal .caja');
  const poner = () => { caja.style.transform = `translate(${arrastreModal.dx}px, ${arrastreModal.dy}px)`; };
  tit.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    arrastreModal.ini = [e.clientX - arrastreModal.dx, e.clientY - arrastreModal.dy]; tit.setPointerCapture(e.pointerId);
  });
  tit.addEventListener('pointermove', e => {
    if (!arrastreModal.ini) return;
    const r = caja.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    let dx = e.clientX - arrastreModal.ini[0], dy = e.clientY - arrastreModal.ini[1];
    // que siempre quede a la vista un trozo del título para poder recogerla
    const bx = r.left - arrastreModal.dx, by = r.top - arrastreModal.dy;
    dx = Math.max(60 - bx - r.width, Math.min(W - 60 - bx, dx)); dy = Math.max(-by, Math.min(H - 40 - by, dy));
    arrastreModal.dx = dx; arrastreModal.dy = dy; poner();
  });
  const fin = () => arrastreModal.ini = null;
  tit.addEventListener('pointerup', fin); tit.addEventListener('pointercancel', fin);
  tit.addEventListener('dblclick', e => { if (e.target.closest('button')) return; arrastreModal.dx = arrastreModal.dy = 0; poner(); });
})();
function formulario(campos) {
  return campos.map(c => c.sel
    ? `<label class="fila" ${c.idFila ? `id="${c.idFila}"` : ''}>${c.et} <select id="f_${c.id}">${c.sel.map(o => `<option value="${o[0]}" ${o[0] == c.v ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`
    : c.chk ? `<label class="fila chk"><input type="checkbox" id="f_${c.id}" ${c.v ? 'checked' : ''}> ${c.et}</label>`
    : `<label class="fila" ${c.idFila ? `id="${c.idFila}"` : ''}>${c.et} <input type="${c.txt ? 'text' : 'number'}" id="f_${c.id}" value="${esc(c.v)}" step="${c.step || 0.1}"></label>`).join('');
}
const fv = id => { const e = $('#f_' + id); return e.type === 'checkbox' ? e.checked : e.tagName === 'SELECT' || e.type === 'text' ? e.value : parseFloat(e.value); };

/* ===================== CONTORNOS (plantillas e importación DXF / SVG) =====================
   Un contorno se guarda en coordenadas de la vista donde se dibujó (u hacia la derecha, v hacia arriba en pantalla),
   con su tamaño original cw x ch. Al cambiar las medidas de la pieza, el contorno se estira con ella. */
function arcoPts(cx, cy, r, a0, a1, segs) {
  const n = segs || Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 24)));
  const L = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return L;
}
function bulgePts(p1, p2, b) { // arco de DXF definido por el «bulge» (sin el primer punto)
  if (!b || Math.abs(b) < 1e-9) return [p2];
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], c = Math.hypot(dx, dy); if (c < 1e-12) return [p2];
  const ang = 4 * Math.atan(b), r = c / (2 * Math.sin(ang / 2)), h = r * Math.cos(ang / 2);
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, cx = mx - dy / c * h, cy = my + dx / c * h;
  const a1 = Math.atan2(p1[1] - cy, p1[0] - cx), R = Math.abs(r);
  const n = Math.max(3, Math.ceil(Math.abs(ang) / (Math.PI / 24)));
  const L = []; for (let i = 1; i <= n; i++) { const a = a1 + ang * i / n; L.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  L[L.length - 1] = [p2[0], p2[1]];
  return L;
}
function areaPoly(P2) { let a = 0; for (let i = 0, j = P2.length - 1; i < P2.length; j = i++) a += (P2[j][0] + P2[i][0]) * (P2[j][1] - P2[i][1]); return a / 2; }
function puntoEnPoly(pt, P2) {
  let d = false;
  for (let i = 0, j = P2.length - 1; i < P2.length; j = i++) {
    const [xi, yi] = P2[i], [xj, yj] = P2[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function limpiarPoly(pts, tol) { // quita puntos repetidos y alineados (Douglas-Peucker sobre anillo cerrado)
  const L = [];
  for (const p of pts) if (!L.length || Math.hypot(p[0] - L[L.length - 1][0], p[1] - L[L.length - 1][1]) > tol) L.push(p);
  if (L.length > 2 && Math.hypot(L[0][0] - L[L.length - 1][0], L[0][1] - L[L.length - 1][1]) <= tol) L.pop();
  if (L.length < 4) return L;
  const dp = A => {
    if (A.length < 3) return A;
    let mx = -1, k = -1; const [x1, y1] = A[0], [x2, y2] = A[A.length - 1], dx = x2 - x1, dy = y2 - y1, ll = Math.hypot(dx, dy) || 1e-12;
    for (let i = 1; i < A.length - 1; i++) { const d = Math.abs(dy * A[i][0] - dx * A[i][1] + x2 * y1 - y2 * x1) / ll; if (d > mx) { mx = d; k = i; } }
    if (mx > tol) return dp(A.slice(0, k + 1)).slice(0, -1).concat(dp(A.slice(k)));
    return [A[0], A[A.length - 1]];
  };
  // partir el anillo por el punto más lejano al primero
  let lejos = 0, dmax = 0; L.forEach((p, i) => { const d = Math.hypot(p[0] - L[0][0], p[1] - L[0][1]); if (d > dmax) { dmax = d; lejos = i; } });
  const anillo = [...L, L[0]];
  return dp(anillo.slice(0, lejos + 1)).slice(0, -1).concat(dp(anillo.slice(lejos)).slice(0, -1));
}

/* ---------- plantillas ---------- */
function rectEsquinas(cw, ch, rad, chaflan) { // rad: [inf-izq, inf-der, sup-der, sup-izq]
  const P2 = [], esq = [[0, 0, Math.PI, 1.5 * Math.PI], [cw, 0, 1.5 * Math.PI, 2 * Math.PI], [cw, ch, 0, .5 * Math.PI], [0, ch, .5 * Math.PI, Math.PI]];
  esq.forEach(([x, y, a0, a1], i) => {
    const r = Math.max(0, Math.min(rad[i] || 0, cw / 2 - 1e-3, ch / 2 - 1e-3));
    if (r <= 0) { P2.push([x, y]); return; }
    const cx = x === 0 ? r : x - r, cy = y === 0 ? r : y - r;
    if (chaflan) { P2.push([cx + r * Math.cos(a0), cy + r * Math.sin(a0)], [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]); }
    else P2.push(...arcoPts(cx, cy, r, a0, a1, 10));
  });
  return P2;
}
function contornoPlantilla(t, cw, ch, o) {
  let ext;
  if (t === 'redondeado' || t === 'chaflan') ext = rectEsquinas(cw, ch, [o.r1, o.r2, o.r3, o.r4], t === 'chaflan');
  else if (t === 'trapecio') ext = [[o.ib, 0], [cw - o.ib, 0], [cw - o.ia, ch], [o.ia, ch]];
  else if (t === 'arco') {
    const f = Math.max(-ch + .1, Math.min(ch - .1, o.f)), hb = f > 0 ? ch - f : ch;
    ext = [[0, 0], [cw, 0], [cw, hb], ...bulgePts([cw, hb], [0, hb], 2 * f / cw)];
    ext.pop(); ext.push([0, hb]);
  } else if (t === 'unero') {
    const w = Math.min(o.w, cw - .2), d = Math.min(o.d, ch - .2), r = Math.max(0, Math.min(o.r, w / 2 - .01, d - .01));
    const xd = (cw + w) / 2, xi = (cw - w) / 2;
    ext = [[0, 0], [cw, 0], [cw, ch], [xd, ch]];
    if (r > 0) { ext.push(...arcoPts(xd - r, ch - d + r, r, 0, -Math.PI / 2, 8), ...arcoPts(xi + r, ch - d + r, r, -Math.PI / 2, -Math.PI, 8)); }
    else ext.push([xd, ch - d], [xi, ch - d]);
    ext.push([xi, ch], [0, ch]);
  } else ext = [[0, 0], [cw, 0], [cw, ch], [0, ch]];
  const huecos = [];
  if (o.agujeroD > 0) { // agujero pasante (pasacables) centrado
    const r = o.agujeroD / 2, cx = cw / 2, cy = o.agujeroY ?? ch / 2;
    huecos.push(arcoPts(cx, cy, r, 0, -2 * Math.PI, 40).slice(0, -1));
  }
  return { ext, huecos, cw, ch };
}

/* ---------- DXF ---------- */
function parseDXF(txt) {
  const L = txt.split(/\r?\n/), pares = [];
  for (let i = 0; i + 1 < L.length; i += 2) pares.push([parseInt(L[i].trim(), 10), L[i + 1].trim()]);
  let i = 0, enEnt = false; const ents = [];
  for (; i < pares.length; i++) {
    const [c, v] = pares[i];
    if (c === 2 && v === 'ENTITIES') { enEnt = true; continue; }
    if (c === 0 && v === 'ENDSEC') enEnt = false;
    if (!enEnt || c !== 0) continue;
    const e = { tipo: v, d: [] };
    for (let j = i + 1; j < pares.length && pares[j][0] !== 0; j++) e.d.push(pares[j]);
    ents.push(e);
  }
  const g = (e, c) => { const p = e.d.find(q => q[0] === c); return p ? parseFloat(p[1]) : 0; };
  const polys = [];
  for (let k = 0; k < ents.length; k++) {
    const e = ents[k];
    if (e.tipo === 'LINE') polys.push({ pts: [[g(e, 10), g(e, 20)], [g(e, 11), g(e, 21)]], cerrado: false });
    else if (e.tipo === 'ARC') {
      let a0 = g(e, 50) * Math.PI / 180, a1 = g(e, 51) * Math.PI / 180; if (a1 <= a0) a1 += 2 * Math.PI;
      polys.push({ pts: arcoPts(g(e, 10), g(e, 20), g(e, 40), a0, a1), cerrado: false });
    } else if (e.tipo === 'CIRCLE') polys.push({ pts: arcoPts(g(e, 10), g(e, 20), g(e, 40), 0, 2 * Math.PI, 64).slice(0, -1), cerrado: true });
    else if (e.tipo === 'ELLIPSE') {
      const cx = g(e, 10), cy = g(e, 20), mx = g(e, 11), my = g(e, 21), ra = g(e, 40) || 1;
      let t0 = e.d.some(q => q[0] === 41) ? g(e, 41) : 0, t1 = e.d.some(q => q[0] === 42) ? g(e, 42) : 2 * Math.PI; if (t1 <= t0) t1 += 2 * Math.PI;
      const n = Math.max(16, Math.ceil((t1 - t0) / (Math.PI / 32))), pts = [];
      for (let s = 0; s <= n; s++) { const t = t0 + (t1 - t0) * s / n; pts.push([cx + mx * Math.cos(t) - ra * my * Math.sin(t), cy + my * Math.cos(t) + ra * mx * Math.sin(t)]); }
      const completo = Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6; if (completo) pts.pop();
      polys.push({ pts, cerrado: completo });
    } else if (e.tipo === 'LWPOLYLINE') {
      const vs = []; let cur = null;
      for (const [c, v] of e.d) {
        if (c === 10) { cur = [parseFloat(v), 0, 0]; vs.push(cur); }
        else if (c === 20 && cur) cur[1] = parseFloat(v);
        else if (c === 42 && cur) cur[2] = parseFloat(v);
      }
      const cerrado = (g(e, 70) & 1) === 1;
      polys.push(polyBulges(vs, cerrado));
    } else if (e.tipo === 'POLYLINE') {
      const cerrado = (g(e, 70) & 1) === 1, vs = [];
      for (k++; k < ents.length && ents[k].tipo !== 'SEQEND'; k++) if (ents[k].tipo === 'VERTEX') vs.push([g(ents[k], 10), g(ents[k], 20), g(ents[k], 42)]);
      polys.push(polyBulges(vs, cerrado));
    } else if (e.tipo === 'SPLINE') {
      const pts = splineDXF(e); if (pts.length > 1) polys.push({ pts, cerrado: (g(e, 70) & 1) === 1 });
    }
  }
  return polys;
}
function polyBulges(vs, cerrado) {
  if (!vs.length) return { pts: [], cerrado };
  const pts = [[vs[0][0], vs[0][1]]];
  const n = cerrado ? vs.length : vs.length - 1;
  for (let i = 0; i < n; i++) { const a = vs[i], b = vs[(i + 1) % vs.length]; pts.push(...bulgePts([a[0], a[1]], [b[0], b[1]], a[2])); }
  if (cerrado) pts.pop();
  return { pts, cerrado };
}
function splineDXF(e) {
  const grado = parseInt((e.d.find(q => q[0] === 71) || [0, 3])[1]), nudos = [], ctrl = [], pesos = [], ajuste = [];
  let cur = null, curF = null;
  for (const [c, v] of e.d) {
    if (c === 40) nudos.push(parseFloat(v));
    else if (c === 41) pesos.push(parseFloat(v));
    else if (c === 10) { cur = [parseFloat(v), 0]; ctrl.push(cur); } else if (c === 20 && cur) cur[1] = parseFloat(v);
    else if (c === 11) { curF = [parseFloat(v), 0]; ajuste.push(curF); } else if (c === 21 && curF) curF[1] = parseFloat(v);
  }
  if (ctrl.length < grado + 1 || nudos.length !== ctrl.length + grado + 1) return ajuste.length > 1 ? ajuste : ctrl;
  const w = i => pesos.length === ctrl.length ? pesos[i] : 1;
  const t0 = nudos[grado], t1 = nudos[ctrl.length], N = Math.max(32, ctrl.length * 16), pts = [];
  for (let s = 0; s <= N; s++) {
    const t = Math.min(t0 + (t1 - t0) * s / N, t1 - 1e-9);
    let k = grado; while (k < ctrl.length - 1 && t >= nudos[k + 1]) k++;
    const d = []; for (let j = 0; j <= grado; j++) { const c = ctrl[k - grado + j], ww = w(k - grado + j); d.push([c[0] * ww, c[1] * ww, ww]); }
    for (let r = 1; r <= grado; r++) for (let j = grado; j >= r; j--) {
      const i2 = k - grado + j, a = (t - nudos[i2]) / ((nudos[i2 + grado - r + 1] - nudos[i2]) || 1);
      d[j] = [0, 1, 2].map(q => (1 - a) * d[j - 1][q] + a * d[j][q]);
    }
    pts.push([d[grado][0] / d[grado][2], d[grado][1] / d[grado][2]]);
  }
  return pts;
}

/* ---------- SVG ---------- */
function parseSVG(txt) {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const raiz = doc.documentElement; if (!raiz || raiz.nodeName.toLowerCase() !== 'svg') throw new Error('No es un SVG');
  const s2 = document.importNode(raiz, true);
  s2.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
  document.body.appendChild(s2);
  const polys = [];
  try {
    const Mr = s2.getScreenCTM().inverse();
    const els = s2.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line');
    let diag = 0;
    try { const bb = s2.getBBox(); diag = Math.hypot(bb.width, bb.height); } catch (e) {}
    const paso = Math.max(diag / 1500, 1e-3);
    for (const el of els) {
      if (el.closest('defs,clipPath,mask,symbol')) continue;
      let len = 0; try { len = el.getTotalLength(); } catch (e) { continue; }
      if (!(len > 0)) continue;
      const M = Mr.multiply(el.getScreenCTM());
      const n = Math.min(20000, Math.max(8, Math.ceil(len / paso)));
      let run = [], prev = null; const runs = [];
      for (let i = 0; i <= n; i++) {
        const q = el.getPointAtLength(len * i / n), p = new DOMPoint(q.x, q.y).matrixTransform(M), pt = [p.x, p.y];
        if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) > (len / n) * 3 + 1e-6) { runs.push(run); run = []; }
        run.push(pt); prev = q;
      }
      runs.push(run);
      const tipo = el.nodeName.toLowerCase(), cerradoTipo = ['rect', 'circle', 'ellipse', 'polygon'].includes(tipo);
      for (const r of runs) {
        if (r.length < 2) continue;
        const cierra = Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < paso * 3;
        polys.push({ pts: r, cerrado: cerradoTipo || cierra });
      }
    }
  } finally { s2.remove(); }
  // pasar a y hacia arriba
  polys.forEach(p => p.pts = p.pts.map(([x, y]) => [x, -y]));
  // unidades: mm por unidad si el SVG lo indica
  let mmPorUnidad = null;
  const wAt = raiz.getAttribute('width') || '', vb = (raiz.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const m = wAt.match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/);
  if (m && vb.length === 4 && vb[2] > 0) {
    const f = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[m[2] || 'px'];
    mmPorUnidad = parseFloat(m[1]) * f / vb[2];
  }
  return { polys, mmPorUnidad };
}

/* ---------- de líneas sueltas a contornos cerrados ---------- */
function encadenar(polys, tol) {
  const cerrados = polys.filter(p => p.cerrado && p.pts.length > 2).map(p => p.pts.slice());
  let abiertos = polys.filter(p => !p.cerrado && p.pts.length > 1).map(p => p.pts.slice());
  const cerca = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  let sueltos = 0;
  while (abiertos.length) {
    let c = abiertos.shift(), sigue = true;
    while (sigue) {
      sigue = false;
      if (cerca(c[0], c[c.length - 1]) && c.length > 2) break;
      for (let i = 0; i < abiertos.length; i++) {
        const o = abiertos[i], fin = c[c.length - 1], ini = c[0];
        if (cerca(fin, o[0])) c = c.concat(o.slice(1));
        else if (cerca(fin, o[o.length - 1])) c = c.concat(o.slice().reverse().slice(1));
        else if (cerca(ini, o[o.length - 1])) c = o.concat(c.slice(1));
        else if (cerca(ini, o[0])) c = o.slice().reverse().concat(c.slice(1));
        else continue;
        abiertos.splice(i, 1); sigue = true; break;
      }
    }
    if (c.length > 3 && cerca(c[0], c[c.length - 1])) { c.pop(); cerrados.push(c); } else sueltos++;
  }
  return { cerrados, sueltos };
}
function clasificar(anillos) { // [{ext, huecos}]: los anillos dentro de otro exterior son huecos
  const L = anillos.map(a => ({ pts: a, area: Math.abs(areaPoly(a)) })).filter(a => a.area > 1e-9).sort((a, b) => b.area - a.area);
  const piezas = [];
  for (const a of L) {
    let padre = null;
    for (let i = piezas.length - 1; i >= 0; i--) if (puntoEnPoly(a.pts[0], piezas[i].ext)) { padre = piezas[i]; break; }
    if (padre && !padre.huecos.some(h => puntoEnPoly(a.pts[0], h))) padre.huecos.push(a.pts);
    else piezas.push({ ext: a.pts, huecos: [] });
  }
  return piezas;
}
// normaliza un contorno a su caja (origen 0,0) y lo escala a cm
function normalizarContorno(c, k) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of c.ext) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const tol = Math.max(x1 - x0, y1 - y0) * 4e-4;
  const f = pts => limpiarPoly(pts, tol).map(([x, y]) => [r1((x - x0) * k * 1000) / 1000, r1((y - y0) * k * 1000) / 1000]);
  return { ext: f(c.ext), huecos: c.huecos.map(f), cw: (x1 - x0) * k, ch: (y1 - y0) * k };
}

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

/* ===================== SELECCIÓN ===================== */
function expandirGrupos(ids) {
  const S = new Set(ids);
  for (const id of ids) { const p = pieza(id); if (p && p.grupo) piezasGrupo(p.grupo).forEach(q => S.add(q.id)); }
  return [...S];
}
function seleccionar(x, o) {
  o = o || {};
  let ids = x == null ? [] : Array.isArray(x) ? x : [x];
  if (o.grupo !== false) ids = expandirGrupos(ids);
  if (o.alternar) { const todos = ids.every(id => sel.has(id)); ids.forEach(id => todos ? sel.delete(id) : sel.add(id)); }
  else sel = new Set(ids);
  pintarLista(); pintarProps(); dibujarVistas(); marcar3D();
}

/* ===================== LISTA ===================== */
let ultimoMaterial = 'roble';
function srcMadera(clave) { const m = infoMaterial(clave); return m.usuario ? datosMaderaFoto(clave).src : window.TEXTURAS[m.tex]; }
function muestraCss(p) {
  const m = infoMaterial(p.material);
  if (m.tipo === 'madera') return `background-image:url(${srcMadera(p.material)})`;
  return `background:${colorPieza(p)}`;
}
const ICONO_MOV = { cajon: '🗄', izq: '🚪', der: '🚪', arriba: '⤒', abajo: '⤓' };
function pintarLista() {
  const ul = $('#lista'); ul.innerHTML = '';
  $('#nPiezas').textContent = P.piezas.length;
  const hechos = new Set();
  const item = (p, hijo) => {
    const li = document.createElement('li');
    li.className = (sel.has(p.id) ? 'sel ' : '') + (p.visible ? '' : 'oculta ') + (hijo ? 'hijo' : '');
    li.innerHTML = `<span class="muestra" style="${muestraCss(p)}"></span><span class="nom"></span><button class="ojo" title="Mostrar / ocultar">${p.visible ? '👁' : '◌'}</button>`;
    li.querySelector('.nom').textContent = p.nombre + (tieneContorno(p) ? ' ✏' : '');
    li.onclick = e => {
      if (e.target.classList.contains('ojo')) { guardarHistoria(); p.visible = !p.visible; cambio(true); return; }
      seleccionar(p.id, { alternar: e.shiftKey || e.ctrlKey || e.metaKey, grupo: false });
    };
    ul.appendChild(li);
  };
  for (const p of P.piezas) {
    const g = p.grupo && P.grupos[p.grupo] ? p.grupo : null;
    if (!g) { item(p, false); continue; }
    if (hechos.has(g)) continue; hechos.add(g);
    const G = P.grupos[g], miembros = piezasGrupo(g), todosSel = miembros.every(q => sel.has(q.id)), vis = miembros.some(q => q.visible);
    const li = document.createElement('li');
    li.className = 'grupo' + (todosSel ? ' sel' : '') + (vis ? '' : ' oculta');
    li.innerHTML = `<button class="plegar" title="Plegar / desplegar">${G.plegado ? '▸' : '▾'}</button><span class="icono">${ICONO_MOV[G.mov && G.mov.tipo] || '▣'}</span><span class="nom"></span><button class="ojo" title="Mostrar / ocultar el grupo">${vis ? '👁' : '◌'}</button>`;
    li.querySelector('.nom').textContent = `${G.nombre} (${miembros.length})`;
    li.onclick = e => {
      if (e.target.classList.contains('plegar')) { G.plegado = !G.plegado; pintarLista(); return; }
      if (e.target.classList.contains('ojo')) { guardarHistoria(); miembros.forEach(q => q.visible = !vis); cambio(true); return; }
      seleccionar(miembros.map(q => q.id), { alternar: e.shiftKey || e.ctrlKey || e.metaKey, grupo: false });
    };
    ul.appendChild(li);
    if (!G.plegado) miembros.forEach(q => item(q, true));
  }
}

/* ===================== PROPIEDADES ===================== */
function opcionesMaterial(selId, conAula) {
  const s = $(selId || '#pMaterial'); const prev = s.value; s.innerHTML = '';
  const grupos = [['Maderas', k => MATERIALES[k].tipo === 'madera'], ['Tableros y lacas', k => ['color', 'lacado'].includes(MATERIALES[k].tipo)], ['Metal y cristal', k => ['metal', 'metalpint', 'cristal'].includes(MATERIALES[k].tipo)]];
  for (const [nom, f] of grupos) {
    const og = document.createElement('optgroup'); og.label = nom;
    Object.keys(MATERIALES).filter(f).forEach(k => og.appendChild(new Option(MATERIALES[k].nombre, k)));
    s.appendChild(og);
  }
  const vistos = new Set();
  for (const [nom, fuente] of [['Maderas del proyecto', P.maderasUsuario || {}], ['Mi biblioteca', BIBLIO], ['Maderas del aula', AULA]]) {
    const ks = Object.keys(fuente).filter(k => !vistos.has(k)); if (!ks.length) continue;
    const og = document.createElement('optgroup'); og.label = nom;
    ks.forEach(k => { vistos.add(k); og.appendChild(new Option(fuente[k].nombre, k)); }); s.appendChild(og);
  }
  if (prev) s.value = prev;
}
function pintarProps() {
  const L = seleccionadas(), n = L.length, g = grupoSel();
  $('#sinSel').classList.toggle('oculto', n > 0); $('#conSel').classList.toggle('oculto', !n);
  $('#tituloSel').textContent = !n ? 'Pieza seleccionada' : n === 1 ? 'Pieza seleccionada' : g ? 'Grupo · ' + n + ' piezas' : n + ' piezas seleccionadas';
  if (!n) return;
  const p = L[0], act = document.activeElement;
  const set = (id, v) => { const e = $(id); if (e !== act) e.value = v; };
  const uno = n === 1;
  $('#pNombre').disabled = !uno && !g;
  set('#pNombre', uno ? p.nombre : g ? P.grupos[g].nombre : '');
  $('#filaForma').classList.toggle('oculto', !uno); $('.contornoBtns').classList.toggle('oculto', !uno || p.forma === 'cilindro');
  set('#pForma', p.forma); set('#pEje', p.eje);
  const b = uno ? null : bboxSel();
  set('#pX', r1(uno ? p.x : b.x0)); set('#pY', r1(uno ? p.y : b.y0)); set('#pZ', r1(uno ? p.z : b.z0));
  set('#pW', r1(uno ? p.w : b.x1 - b.x0)); set('#pH', r1(uno ? p.h : b.y1 - b.y0)); set('#pD', r1(uno ? p.d : b.z1 - b.z0));
  ['#pW', '#pH', '#pD'].forEach(id => $(id).disabled = !uno);
  if (!$('#pMaterial').querySelector(`option[value="${p.material}"]`)) opcionesMaterial();
  if (!$('#pCantoMat').querySelector(`option[value="${p.cantoMat}"]`)) opcionesMaterial('#pCantoMat');
  set('#pMaterial', p.material); set('#pColor', p.color); set('#pAcabado', p.acabado); set('#pVeta', p.veta); set('#pCanto', p.canto);
  set('#pNucleo', p.nucleo || 'auto'); set('#pCantos', p.cantos || 'ajuego'); set('#pCantoMat', p.cantoMat || 'roble'); set('#pCantoColor', p.cantoColor || '#222222');
  const m = infoMaterial(p.material), nuc = nucleoDe(p);
  $('#filaColor').classList.toggle('oculto', m.tipo !== 'lacado');
  $('#filaVeta').classList.toggle('oculto', m.tipo !== 'madera');
  $('#filaEje').classList.toggle('oculto', !uno || p.forma !== 'cilindro');
  $('#bloqueTablero').classList.toggle('oculto', ['metal', 'metalpint', 'cristal'].includes(m.tipo) || p.forma === 'cilindro');
  $('#filaCantos').classList.toggle('oculto', nuc === 'macizo');
  $('#filaCantoMat').classList.toggle('oculto', nuc === 'macizo' || p.cantos !== 'otro');
  $('#filaCantoColor').classList.toggle('oculto', nuc === 'macizo' || p.cantos !== 'otro' || p.cantoMat !== 'lacado');
  $('#bDesagrupar').disabled = !L.some(q => q.grupo);
  // movimiento
  const mg = g || (uno && !p.grupo ? '_nuevo' : null);
  $('#movSec').classList.toggle('oculto', !mg);
  if (mg) {
    const mov = g ? P.grupos[g].mov || { tipo: 'ninguno' } : { tipo: 'ninguno' };
    set('#mTipo', mov.tipo || 'ninguno'); set('#mValor', mov.valor ?? 0);
    $('#filaMovValor').classList.toggle('oculto', !mov.tipo || mov.tipo === 'ninguno');
    $('#mValorEt').textContent = mov.tipo === 'cajon' ? 'Recorrido (cm)' : 'Ángulo de apertura (°)';
  }
}

const CAMPOS = { pNombre: 'nombre', pForma: 'forma', pEje: 'eje', pX: 'x', pY: 'y', pZ: 'z', pW: 'w', pH: 'h', pD: 'd', pMaterial: 'material', pColor: 'color', pAcabado: 'acabado', pVeta: 'veta', pCanto: 'canto',
  pNucleo: 'nucleo', pCantos: 'cantos', pCantoMat: 'cantoMat', pCantoColor: 'cantoColor' };
for (const [id, campo] of Object.entries(CAMPOS)) {
  const el = $('#' + id);
  let guardado = false;
  const aplicar = fin => {
    const L = seleccionadas(); if (!L.length) return;
    let v = el.value;
    if (el.type === 'number') { v = parseFloat(v); if (!isFinite(v)) return; if ('whd'.includes(campo) && campo.length === 1) v = Math.max(.1, v); if (campo === 'canto') v = Math.max(0, v); }
    const g = grupoSel();
    if (campo === 'forma' && v === 'perfil' && !tieneContorno(L[0])) { el.value = L[0].forma; abrirContorno(); return; }
    let hace;
    if (campo === 'nombre') {
      if (L.length === 1) hace = () => { L[0].nombre = v; };
      else if (g) hace = () => { P.grupos[g].nombre = v; };
      else return;
    } else if ('xyz'.includes(campo) && campo.length === 1 && L.length > 1) {
      const b = bboxSel(), d = v - b[campo + '0']; if (Math.abs(d) < 1e-9) return;
      hace = () => L.forEach(q => q[campo] = r1(q[campo] + d));
    } else if ('whd'.includes(campo) && campo.length === 1 && L.length > 1) return;
    else {
      if (L.every(q => q[campo] === v)) { if (fin) guardado = false; return; }
      hace = () => L.forEach(q => q[campo] = v);
    }
    if (!guardado) { guardarHistoria(); guardado = true; }
    hace();
    if (campo === 'material') { ultimoMaterial = v; asegurarMadera(v); }
    if (campo === 'cantoMat') asegurarMadera(v);
    if (fin) guardado = false;
    cambio(fin || el.tagName === 'SELECT' || el.type === 'color');
  };
  el.addEventListener('input', () => aplicar(el.tagName === 'SELECT'));
  el.addEventListener('change', () => aplicar(true));
}

/* ---------- movimiento de grupos ---------- */
function valorMovDefecto(tipo, L) {
  const b = bbox(L.map(q => Object.assign({}, q, { visible: true })));
  if (tipo === 'cajon') { const cajaFondo = Math.max(...L.map(q => q.d)); return Math.max(5, Math.round(cajaFondo * .8)); }
  if (tipo === 'izq' || tipo === 'der') return 95;
  if (tipo === 'arriba' || tipo === 'abajo') return 85;
  return 0;
}
$('#mTipo').addEventListener('change', () => {
  const L = seleccionadas(); if (!L.length) return;
  guardarHistoria();
  let g = grupoSel();
  if (!g) g = nuevoGrupo(L.length === 1 ? L[0].nombre : null, L.map(q => q.id));
  const tipo = $('#mTipo').value;
  P.grupos[g].mov = { tipo, valor: valorMovDefecto(tipo, L) };
  sel = new Set(piezasGrupo(g).map(q => q.id));
  if (tipo !== 'ninguno' && P.vista.abrir < .05) aviso('Usa «🚪 Abrir» bajo el 3D para verlo');
  cambio(true);
});
$('#mValor').addEventListener('change', () => {
  const g = grupoSel(); if (!g) return;
  const v = parseFloat($('#mValor').value); if (!isFinite(v)) return;
  guardarHistoria(); P.grupos[g].mov.valor = v; cambio(true);
});

/* ---------- duplicar, simetría, eliminar, grupos, serie ---------- */
// copia las piezas (y sus grupos completos como grupos nuevos); f(copia) la modifica
function copiar(L, f, sufijo) {
  const mapaG = {}, nuevas = [];
  for (const p of L) {
    const c = JSON.parse(JSON.stringify(p)); c.id = nuevoId();
    if (p.grupo && P.grupos[p.grupo]) {
      const enteroSel = piezasGrupo(p.grupo).every(q => L.includes(q));
      if (enteroSel) {
        if (!mapaG[p.grupo]) { const G = P.grupos[p.grupo]; const ng = nuevoId('g'); P.grupos[ng] = JSON.parse(JSON.stringify(G)); P.grupos[ng].nombre = G.nombre + (sufijo || ''); mapaG[p.grupo] = ng; }
        c.grupo = mapaG[p.grupo];
      }
    } else if (sufijo && L.length === 1) c.nombre = p.nombre + sufijo;
    f(c, p); P.piezas.push(c); nuevas.push(c);
  }
  return nuevas;
}
function duplicar() {
  const L = seleccionadas(); if (!L.length) return;
  guardarHistoria();
  const V = vistaActiva, b = bboxSel(), paso = (b[V.h + '1'] - b[V.h + '0']) + 2;
  const N = copiar(L, c => { c[V.h] = r1(c[V.h] + paso); }, ' (copia)');
  sel = new Set(N.map(q => q.id)); cambio(true);
}
function espejoContorno(c, plano, eje) {
  const V = TIPOS[plano]; if (!c || !V) return c;
  const f = V.h === eje ? ([u, v]) => [c.cw - u, v] : V.v === eje ? ([u, v]) => [u, c.ch - v] : null;
  if (!f) return c;
  return Object.assign({}, c, { ext: c.ext.map(f).reverse(), huecos: (c.huecos || []).map(h => h.map(f).reverse()) });
}
function simetria() {
  const L = seleccionadas(); if (!L.length) return;
  const b = bbox(); const V = vistaActiva, eje = V.h === 'z' ? 'z' : 'x';
  const lim = eje === 'x' ? [b.x0, b.x1] : [b.z0, b.z1], cen = (lim[0] + lim[1]) / 2;
  guardarHistoria();
  const N = copiar(L, c => {
    c[eje] = r1(2 * cen - c[eje] - c[DIM[eje]]);
    if (tieneContorno(c)) c.contorno = espejoContorno(c.contorno, c.plano, eje);
  }, ' (simétrica)');
  // las puertas cambian de mano
  const gs = new Set(N.map(q => q.grupo).filter(Boolean));
  gs.forEach(g => { const m = P.grupos[g].mov; if (m && eje === 'x') m.tipo = { izq: 'der', der: 'izq' }[m.tipo] || m.tipo; });
  sel = new Set(N.map(q => q.id)); cambio(true);
  aviso('Copia simétrica en ' + eje.toUpperCase());
}
function eliminar() {
  if (!sel.size) return;
  guardarHistoria(); P.piezas = P.piezas.filter(q => !sel.has(q.id)); sel.clear(); limpiarGrupos(); cambio(true);
}
function agrupar() {
  const L = seleccionadas(); if (!L.length) return;
  if (grupoSel()) return aviso('Ya forman un grupo');
  guardarHistoria();
  const g = nuevoGrupo(null, L.map(q => q.id)); limpiarGrupos();
  // el grupo va en la lista donde estaba su primera pieza
  cambio(true); aviso('Grupo creado: «' + P.grupos[g].nombre + '». Cambia su nombre arriba.');
  setTimeout(() => { $('#pNombre').focus(); $('#pNombre').select(); }, 50);
}
function desagrupar() {
  const L = seleccionadas().filter(q => q.grupo); if (!L.length) return;
  guardarHistoria(); L.forEach(q => q.grupo = null); limpiarGrupos(); cambio(true);
}
function serie() {
  const L = seleccionadas(); if (!L.length) return aviso('Selecciona primero lo que quieras repetir');
  const V = vistaActiva;
  modal('Repetir en serie', formulario([
    { id: 'n', et: 'Número de copias', v: 3, step: 1 },
    { id: 'eje', et: 'Dirección', v: V.h, sel: [['x', 'Ancho (X), hacia la derecha'], ['y', 'Alto (Y), hacia arriba'], ['z', 'Fondo (Z), hacia delante']] },
    { id: 'modo', et: 'Distancia', v: 'hueco', sel: [['hueco', 'Hueco libre entre copias'], ['paso', 'Paso (de inicio a inicio)']] },
    { id: 'val', et: 'Valor (cm)', v: 2 }]) +
    `<p class="nota">Ejemplo: listones de un somier, baldas a la misma distancia o varias patas iguales. Se repite todo lo seleccionado (los grupos se copian como grupos nuevos).</p>`, [
    { txt: 'Cancelar' },
    { txt: 'Repetir', primario: true, fn: () => {
      const n = Math.max(1, Math.min(200, Math.round(fv('n')))), eje = fv('eje'), b = bboxSel();
      const tam = b[eje + '1'] - b[eje + '0'], paso = fv('modo') === 'paso' ? fv('val') : tam + fv('val');
      guardarHistoria(); const todas = [...L];
      for (let i = 1; i <= n; i++) todas.push(...copiar(L, c => { c[eje] = r1(c[eje] + paso * i); }, ' ' + (i + 1)));
      sel = new Set(todas.map(q => q.id)); cambio(true); encuadrarTodo();
    } }]);
}
$('#bDuplicar').onclick = duplicar; $('#bSimetria').onclick = simetria; $('#bEliminar').onclick = eliminar;
$('#bAgrupar').onclick = agrupar; $('#bDesagrupar').onclick = desagrupar; $('#bSerie').onclick = serie;

/* ===================== CONTORNO DE UNA PIEZA ===================== */
function planoNatural(p) { const d = { x: p.w, y: p.h, z: p.d }; const ej = Object.keys(d).sort((a, b) => d[a] - d[b])[0]; return { z: 'alzado', y: 'planta', x: 'perfil' }[ej]; }
function dibujarPrevia(cv, cont) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  if (!cont) return;
  const k = Math.min((W - 30) / cont.cw, (H - 30) / cont.ch), ox = (W - cont.cw * k) / 2, oy = (H + cont.ch * k) / 2;
  c.beginPath();
  for (const an of [cont.ext, ...(cont.huecos || [])]) { an.forEach(([u, v], i) => i ? c.lineTo(ox + u * k, oy - v * k) : c.moveTo(ox + u * k, oy - v * k)); c.closePath(); }
  c.fillStyle = 'rgba(184,141,94,.55)'; c.fill('evenodd'); c.strokeStyle = '#1f2329'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#555'; c.font = '11px system-ui';
  c.fillText(r1(cont.cw) + ' × ' + r1(cont.ch) + ' cm', 6, 14);
}
function abrirContorno() {
  const p = piezaSel(); if (!p) return aviso('Selecciona una sola pieza');
  if (p.forma === 'cilindro') return aviso('Los cilindros no llevan contorno');
  let importado = null;
  const tipos = [['rect', 'Rectángulo (sin contorno)'], ['redondeado', 'Esquinas redondeadas'], ['chaflan', 'Esquinas achaflanadas'], ['trapecio', 'Trapecio (pata afilada, lateral inclinado)'], ['arco', 'Lado superior en arco'], ['unero', 'Uñero (tirador mecanizado arriba)'], ['importar', 'Desde un DXF o SVG…']];
  const plano0 = p.plano || planoNatural(p);
  if (tieneContorno(p) && p.contorno.tipo === 'calcador') tipos.splice(1, 0, ['calcador', 'Dibujado a mano (sin cambios)']);
  modal('Contorno de «' + p.nombre + '»', formulario([
    { id: 'plano', et: 'Se dibuja en la vista', v: plano0, sel: [['alzado', 'Alzado (grosor en Z)'], ['planta', 'Planta (grosor en Y)'], ['perfil', 'Perfil (grosor en X)']] },
    { id: 'tipo', et: 'Forma', v: p.contorno && p.contorno.tipo || (tieneContorno(p) ? 'importar' : 'redondeado'), sel: tipos }]) +
    `<div id="cParams"></div><canvas id="cPrev" class="prevc" width="440" height="220"></canvas>
     <p class="nota">Para dibujarlo a mano, con rectas, arcos y cotas, usa <b>🖊 Dibujar…</b> (MUEBLECAD 2D). El contorno se estira con la pieza si luego cambias sus medidas. El grosor (3.ª medida) se extruye. Los cantos se redondean con «Canto redondeado».</p>`, [
    { txt: 'Cancelar' },
    { txt: 'Aplicar', primario: true, fn: () => {
      const t = fv('tipo'), plano = fv('plano'), cont = calcular();
      guardarHistoria();
      if (t === 'calcador') return;
      if (t === 'rect' || !cont) { p.forma = 'caja'; p.contorno = null; p.plano = null; }
      else {
        if (t === 'importar' && $('#f_ajustar') && $('#f_ajustar').checked) { const V = TIPOS[plano]; p[DIM[V.h]] = r1(cont.cw); p[DIM[V.v]] = r1(cont.ch); }
        p.forma = 'perfil'; p.plano = plano; p.contorno = Object.assign(cont, { tipo: t, params: leerParams() });
      }
      cambio(true);
    } }], '520px');
  const V0 = () => TIPOS[fv('plano')];
  const params = {
    redondeado: [['r1', 'Radio inf. izq. (cm)', 3], ['r2', 'Radio inf. der.', 3], ['r3', 'Radio sup. der.', 3], ['r4', 'Radio sup. izq.', 3]],
    chaflan: [['r1', 'Chaflán inf. izq. (cm)', 2], ['r2', 'Chaflán inf. der.', 2], ['r3', 'Chaflán sup. der.', 2], ['r4', 'Chaflán sup. izq.', 2]],
    trapecio: [['ia', 'Estrechar arriba, por lado (cm)', 1], ['ib', 'Estrechar abajo, por lado (cm)', 0]],
    arco: [['f', 'Flecha del arco (cm; negativo = hacia dentro)', 4]],
    unero: [['w', 'Ancho del uñero (cm)', 12], ['d', 'Profundidad (cm)', 2.5], ['r', 'Radio de las esquinas (cm)', 1]],
  };
  const previos = p.contorno && p.contorno.params || {};
  function leerParams() {
    const o = {}; $$('#cParams input[type=number]').forEach(i => o[i.id.slice(2)] = parseFloat(i.value) || 0); return o;
  }
  function pintarParams() {
    const t = fv('tipo'); let h = '';
    if (params[t]) h = formulario(params[t].map(([id, et, v]) => ({ id, et, v: previos[id] ?? v })));
    if (params[t]) h += formulario([{ id: 'agujeroD', et: 'Agujero pasante, Ø (cm; 0 = sin agujero)', v: previos.agujeroD ?? 0 }]);
    if (t === 'importar') h = `<div class="col2"><button id="bImpC">📂 Elegir DXF o SVG…</button><span class="nota" id="impInfo">${importado ? '' : 'Sin archivo'}</span></div>` +
      formulario([{ id: 'unid', et: 'Unidades del dibujo', v: 'mm', sel: [['mm', 'Milímetros'], ['cm', 'Centímetros'], ['in', 'Pulgadas'], ['auto', 'Las del SVG']] }]) +
      formulario([{ id: 'ajustar', et: 'Ajustar las medidas de la pieza al dibujo', v: true, chk: true }]);
    $('#cParams').innerHTML = h;
    $$('#cParams input,#cParams select').forEach(i => i.addEventListener('input', previa));
    if (t === 'importar') $('#bImpC').onclick = async () => {
      const r = await importarArchivo(); if (!r) return;
      importado = r; previa();
    };
    previa();
  }
  function calcular() {
    const t = fv('tipo'), V = V0(), cw = p[DIM[V.h]], ch = p[DIM[V.v]];
    if (t === 'rect') return null;
    if (t === 'calcador') return p.contorno;
    if (t === 'importar') {
      if (!importado || !importado.piezas.length) return tieneContorno(p) && p.plano === fv('plano') && p.contorno.tipo === 'importar' ? Object.assign({}, p.contorno) : null;
      const k = factorUnidades(importado, $('#f_unid') ? fv('unid') : 'mm');
      const c = normalizarContorno(importado.piezas[0], k);
      if ($('#impInfo')) $('#impInfo').textContent = importado.nombre + ' · ' + importado.piezas.length + ' contorno(s), se usa el mayor';
      return c;
    }
    return contornoPlantilla(t, cw, ch, leerParams());
  }
  function previa() { dibujarPrevia($('#cPrev'), calcular()); }
  $('#f_tipo').addEventListener('input', pintarParams); $('#f_plano').addEventListener('input', previa);
  pintarParams();
}
$('#bContorno').onclick = abrirContorno;

async function importarArchivo() {
  const f = await leerArchivo('.dxf,.svg', true); if (!f) return null;
  try {
    let polys, mm = null;
    if (/\.svg$/i.test(f.nombre) || /^\s*(<\?xml|<svg)/.test(f.datos)) { const r = parseSVG(f.datos); polys = r.polys; mm = r.mmPorUnidad; }
    else polys = parseDXF(f.datos);
    let ext = 0; polys.forEach(p => p.pts.forEach(([x, y]) => ext = Math.max(ext, Math.abs(x), Math.abs(y))));
    const { cerrados, sueltos } = encadenar(polys, Math.max(1e-6, ext * 2e-5) * 50);
    const piezas = clasificar(cerrados);
    if (!piezas.length) { aviso('No se han encontrado contornos cerrados en ' + f.nombre); return null; }
    if (sueltos) aviso(sueltos + ' línea(s) abierta(s) no forman contorno y se ignoran');
    return { nombre: f.nombre, piezas, mmPorUnidad: mm };
  } catch (e) { console.error(e); aviso('No se ha podido leer ' + f.nombre); return null; }
}
function factorUnidades(imp, u) {
  if (u === 'auto') return imp.mmPorUnidad ? imp.mmPorUnidad / 10 : .1;
  return { mm: .1, cm: 1, in: 2.54 }[u] || .1;
}

/* ===================== PLANTILLAS ===================== */
function insertar(lista, msg, nombreGrupo, mov) {
  guardarHistoria();
  const N = lista.map(p => nuevaPieza(Object.assign({ material: ultimoMaterial }, p)));
  N.forEach(p => P.piezas.push(p));
  if (nombreGrupo) nuevoGrupo(nombreGrupo, N.map(p => p.id), mov);
  sel = new Set(N.map(p => p.id)); cambio(true); encuadrarTodo(); aviso(msg);
  return N;
}
// piezas delante de un frente (tiradores)
function tiradoresDe(f) {
  return P.piezas.filter(q => q !== f && q.visible && q.z >= f.z + f.d - .05 && q.z <= f.z + f.d + 6 &&
    q.x >= f.x - .1 && q.x + q.w <= f.x + f.w + .1 && q.y >= f.y - .1 && q.y + q.h <= f.y + f.h + .1);
}
// frente principal de una selección (la pieza con más superficie frontal)
function frenteDe(L) { return L.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0]; }

$$('[data-plantilla]').forEach(b => b.onclick = () => {
  const t = b.dataset.plantilla, bb = bbox(), hay = P.piezas.some(p => p.visible);
  const x0 = hay ? r1(bb.x1 + 10) : 0;
  if (t === 'cuerpo') modal('Cuerpo de mueble', formulario([
    { id: 'w', et: 'Ancho', v: 60 }, { id: 'h', et: 'Alto (sin patas)', v: 70 }, { id: 'd', et: 'Fondo', v: 40 },
    { id: 'g', et: 'Grosor tableros', v: 1.9 }, { id: 'z', et: 'Altura desde el suelo', v: 0 },
    { id: 'tr', et: 'Trasera', v: 'si', sel: [['si', 'Sí (0,4 cm)'], ['no', 'No']] },
    { id: 'es', et: 'Estantes intermedios', v: 0, step: 1 }]), [
    { txt: 'Cancelar' }, { txt: 'Insertar', primario: true, fn: () => {
      const W = fv('w'), H = fv('h'), D = fv('d'), g = fv('g'), z = fv('z'), es = Math.max(0, Math.round(fv('es')));
      const tr = fv('tr') === 'si' ? .4 : 0;
      const L = [
        { nombre: 'Lateral izquierdo', x: x0, y: z, z: 0, w: g, h: H, d: D },
        { nombre: 'Lateral derecho', x: x0 + W - g, y: z, z: 0, w: g, h: H, d: D },
        { nombre: 'Techo', x: x0 + g, y: z + H - g, z: 0, w: W - 2 * g, h: g, d: D },
        { nombre: 'Suelo', x: x0 + g, y: z, z: 0, w: W - 2 * g, h: g, d: D }];
      if (tr) L.push({ nombre: 'Trasera', x: x0 + g, y: z + g, z: 0, w: W - 2 * g, h: H - 2 * g, d: tr, veta: 'y', nucleo: 'mdf' });
      for (let i = 1; i <= es; i++) L.push({ nombre: 'Estante ' + i, x: x0 + g, y: r1(z + g + (H - 2 * g) * i / (es + 1) - g / 2), z: tr, w: W - 2 * g, h: g, d: D - tr - 1 });
      insertar(L, 'Cuerpo insertado');
    } }]);
  if (t === 'frente') {
    const cuerpo = P.piezas.filter(p => p.visible && p.y > .1);
    const yIni = cuerpo.length ? Math.min(...cuerpo.map(p => p.y)) : bb.y0;
    modal('Puerta / frente', formulario([
      { id: 'w', et: 'Ancho', v: hay ? r1(bb.x1 - bb.x0) : 40 }, { id: 'h', et: 'Alto', v: hay ? r1(bb.y1 - yIni) : 60 }, { id: 'g', et: 'Grosor', v: 1.9 },
      { id: 'n', et: 'Divididos en (frentes)', v: 1, step: 1 }, { id: 'j', et: 'Junta entre frentes (cm)', v: .3 }]) +
      `<p class="nota">Se coloca delante del conjunto, alineado arriba y a la izquierda. Luego puedes moverlo. Para que se abra, usa <b>🗄 Cajón</b> o <b>🚪 Bisagras</b>.</p>`, [
      { txt: 'Cancelar' }, { txt: 'Insertar', primario: true, fn: () => {
        const W = fv('w'), H = fv('h'), g = fv('g'), n = Math.max(1, Math.round(fv('n'))), j = fv('j');
        const xb = hay ? bb.x0 : 0, yb = hay ? r1(bb.y1 - H) : 0, zb = hay ? bb.z1 : 0;
        const hh = (H - j * (n - 1)) / n, L = [];
        for (let i = 0; i < n; i++) L.push({ nombre: n > 1 ? 'Frente ' + (n - i) : 'Puerta', x: xb, y: r1(yb + i * (hh + j)), z: zb, w: W, h: r1(hh), d: g, veta: n > 1 ? 'x' : 'y' });
        insertar(L, 'Frente insertado');
      } }]);
  }
  if (t === 'patas') modal('4 patas', formulario([
    { id: 's', et: 'Sección (cm)', v: 4 }, { id: 'h', et: 'Altura', v: 12 }, { id: 'r', et: 'Retranqueo desde el borde', v: 1.5 },
    { id: 'f', et: 'Forma', v: 'caja', sel: [['caja', 'Cuadrada'], ['cilindro', 'Redonda'], ['afilada', 'Cuadrada afilada (trapecio)']] },
    { id: 'm', et: 'Subir el mueble', v: 'si', sel: [['si', 'Sí, para que apoye en las patas'], ['no', 'No']] }]), [
    { txt: 'Cancelar' }, { txt: 'Insertar', primario: true, fn: () => {
      const s = fv('s'), H = fv('h'), r = fv('r'), forma = fv('f');
      guardarHistoria();
      if (fv('m') === 'si' && hay) P.piezas.forEach(p => { if (p.visible) p.y = r1(p.y - bb.y0 + H); });
      const b2 = bbox(); const L = [];
      for (const [x, z, nn] of [[b2.x0 + r, b2.z0 + r, 'trasera izq.'], [b2.x1 - r - s, b2.z0 + r, 'trasera der.'], [b2.x0 + r, b2.z1 - r - s, 'delantera izq.'], [b2.x1 - r - s, b2.z1 - r - s, 'delantera der.']]) {
        const o = { nombre: 'Pata ' + nn, x: r1(x), y: 0, z: r1(z), w: s, h: H, d: s, forma: forma === 'cilindro' ? 'cilindro' : 'caja', eje: 'y', veta: 'y', material: ultimoMaterial, canto: .5 };
        if (forma === 'afilada') Object.assign(o, { forma: 'perfil', plano: 'alzado', contorno: Object.assign(contornoPlantilla('trapecio', s, H, { ia: 0, ib: s * .2 }), { tipo: 'trapecio', params: { ia: 0, ib: r1(s * .2) } }) });
        L.push(nuevaPieza(o));
      }
      L.forEach(p => P.piezas.push(p)); nuevoGrupo('Patas', L.map(p => p.id));
      sel = new Set(L.map(p => p.id)); cambio(true); encuadrarTodo(); aviso('Patas insertadas (agrupadas)');
    } }]);
  if (t === 'tirador') {
    const L = seleccionadas(), s = L.length ? frenteDe(L) : null;
    if (!s) return aviso('Selecciona primero el frente o la puerta');
    modal('Tirador', formulario([
      { id: 'l', et: 'Largo', v: 12 }, { id: 'g', et: 'Grosor', v: 1.2 }, { id: 'sep', et: 'Separación del frente', v: 1.8 },
      { id: 'o', et: 'Orientación', v: 'h', sel: [['h', 'Horizontal'], ['v', 'Vertical']] },
      { id: 'p', et: 'Posición', v: 'c', sel: [['c', 'Centrado'], ['a', 'Arriba'], ['b', 'Abajo'], ['i', 'Lado izquierdo'], ['d', 'Lado derecho']] },
      { id: 'm', et: 'Material', v: 'negro_mate', sel: [['negro_mate', 'Metal negro mate'], ['inox', 'Acero inoxidable'], ['laton', 'Latón'], ['aluminio', 'Aluminio'], [s.material, 'Igual que la pieza']] }]), [
      { txt: 'Cancelar' }, { txt: 'Insertar', primario: true, fn: () => {
        const l = fv('l'), g = fv('g'), sep = fv('sep'), hor = fv('o') === 'h', pos = fv('p');
        const w = hor ? l : g, h = hor ? g : l;
        let cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        if (pos === 'a') cy = s.y + s.h - 4 - h / 2; if (pos === 'b') cy = s.y + 4 + h / 2;
        if (pos === 'i') cx = s.x + 4 + w / 2; if (pos === 'd') cx = s.x + s.w - 4 - w / 2;
        const N = insertar([{ nombre: 'Tirador', x: r1(cx - w / 2), y: r1(cy - h / 2), z: r1(s.z + s.d), w, h, d: sep, material: fv('m'), canto: 3, acabado: 'satinado' }], 'Tirador insertado');
        if (s.grupo) { N[0].grupo = s.grupo; cambio(true); }
      } }]);
  }
  if (t === 'cajon') plantillaCajon();
  if (t === 'bisagras') plantillaBisagras();
  if (t === 'importar') plantillaImportar();
  if (t === 'mano') piezaAMano();
});

function plantillaCajon() {
  const L = seleccionadas(), f = L.length ? frenteDe(L) : null;
  if (!f) return aviso('Selecciona primero el frente del cajón');
  // hueco interior: tableros verticales a izquierda y derecha, por detrás del frente
  const cand = P.piezas.filter(q => q.visible && q !== f && !L.includes(q) && q.w <= 4 && q.z + q.d <= f.z + .1 && q.y < f.y + f.h && q.y + q.h > f.y);
  const cx = f.x + f.w / 2;
  const izq = cand.filter(q => q.x + q.w <= cx).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
  const der = cand.filter(q => q.x >= cx).sort((a, b) => a.x - b.x)[0];
  const hx0 = izq ? izq.x + izq.w : f.x + 1.9, hx1 = der ? der.x : f.x + f.w - 1.9;
  const fondoMax = Math.max(10, f.z - (izq ? izq.z : bbox().z0) - 1.5);
  const fondo = Math.max(10, Math.floor(fondoMax / 5) * 5);
  modal('Cajón completo', `<p class="nota">Se crea la caja del cajón detrás de «${esc(f.nombre)}» y se agrupa con el frente y su tirador para poder abrirlo.</p>` + formulario([
    { id: 'hx', et: 'Hueco: empieza en X (cm)', v: r1(hx0) }, { id: 'hw', et: 'Ancho del hueco (cm)', v: r1(hx1 - hx0) },
    { id: 'hol', et: 'Holgura por lado para la guía (cm)', v: 1.25 },
    { id: 'alto', et: 'Alto de la caja (cm)', v: r1(Math.max(5, f.h - 5)) }, { id: 'fondo', et: 'Fondo de la caja (cm)', v: fondo },
    { id: 'g', et: 'Grosor de laterales y trasera (cm)', v: 1.6 }, { id: 'gf', et: 'Grosor del fondo (cm)', v: .4 },
    { id: 'mat', et: 'Material de la caja', v: 'haya', sel: Object.keys(MATERIALES).filter(k => !['metal', 'metalpint', 'cristal'].includes(MATERIALES[k].tipo)).map(k => [k, MATERIALES[k].nombre]) },
    { id: 'guias', et: 'Dibujar las guías metálicas', v: true, chk: true }]), [
    { txt: 'Cancelar' }, { txt: 'Crear cajón', primario: true, fn: () => {
      const hx = fv('hx'), hw = fv('hw'), hol = fv('hol'), Hb = fv('alto'), Fb = fv('fondo'), g = fv('g'), gf = fv('gf'), mat = fv('mat');
      const Wb = hw - 2 * hol, X = hx + hol, Y = r1(f.y + Math.max(.5, (f.h - Hb) / 2)), Z1 = f.z, Z0 = r1(f.z - Fb);
      if (Wb <= 2 * g + 1) { aviso('El hueco es demasiado estrecho'); return false; }
      const comun = { material: mat, canto: .5, acabado: 'satinado', veta: 'x' };
      const caja = [
        { nombre: 'Lateral cajón izq.', x: X, y: Y, z: Z0, w: g, h: Hb, d: Fb, veta: 'z' },
        { nombre: 'Lateral cajón der.', x: r1(X + Wb - g), y: Y, z: Z0, w: g, h: Hb, d: Fb, veta: 'z' },
        { nombre: 'Contrafrente', x: r1(X + g), y: Y, z: r1(Z1 - g), w: r1(Wb - 2 * g), h: Hb, d: g },
        { nombre: 'Trasera cajón', x: r1(X + g), y: r1(Y + 1.2), z: Z0, w: r1(Wb - 2 * g), h: r1(Hb - 1.2), d: g },
        { nombre: 'Fondo cajón', x: r1(X + g), y: r1(Y + .8), z: Z0, w: r1(Wb - 2 * g), h: gf, d: r1(Fb - g), nucleo: 'mdf', material: 'melamina_blanca', veta: 'auto' },
      ].map(o => Object.assign({}, comun, o));
      guardarHistoria();
      const N = caja.map(o => nuevaPieza(o)); N.forEach(p => P.piezas.push(p));
      const yG = r1(Y + Hb / 2 - 2.25);
      if (fv('guias')) [[r1(X - hol), 'izq.'], [r1(X + Wb), 'der.']].forEach(([x, n]) =>
        P.piezas.push(nuevaPieza({ nombre: 'Guía ' + n, x, y: yG, z: Z0, w: hol, h: 4.5, d: Fb, material: 'aluminio', canto: .3, acabado: 'satinado' })));
      const ids = [f.id, ...tiradoresDe(f).map(q => q.id), ...N.map(q => q.id)];
      let g0 = f.grupo;
      if (g0) ids.forEach(id => pieza(id).grupo = g0);
      else g0 = nuevoGrupo('Cajón · ' + f.nombre, ids);
      P.grupos[g0].mov = { tipo: 'cajon', valor: Math.round(Fb * .8) };
      limpiarGrupos(); sel = new Set(piezasGrupo(g0).map(q => q.id)); cambio(true);
      aviso('Cajón creado. Muévelo con «🚪 Abrir» bajo el 3D');
    } }]);
}

function plantillaBisagras() {
  const L = seleccionadas(), f = L.length ? frenteDe(L) : null;
  if (!f) return aviso('Selecciona primero la puerta');
  const vert = f.h >= f.w;
  modal('Bisagras', `<p class="nota">Se añaden a «${esc(f.nombre)}» y la puerta queda lista para abrirse.</p>` + formulario([
    { id: 'lado', et: 'Lado de las bisagras', v: vert ? 'izq' : 'arriba', sel: [['izq', 'Izquierda'], ['der', 'Derecha'], ['arriba', 'Arriba (abatible)'], ['abajo', 'Abajo (abatible)']] },
    { id: 'tipo', et: 'Tipo', v: 'cazoleta', sel: [['cazoleta', 'De cazoleta (ocultas, por dentro)'], ['pernio', 'Pernio (vistas, por fuera)']] },
    { id: 'n', et: 'Número de bisagras', v: (vert ? f.h : f.w) > 90 ? 3 : 2, step: 1 },
    { id: 'ang', et: 'Ángulo de apertura (°)', v: 95, step: 5 },
    { id: 'mat', et: 'Material', v: 'inox', sel: [['inox', 'Acero inoxidable'], ['laton', 'Latón'], ['negro_mate', 'Negro mate'], ['aluminio', 'Aluminio']] }]), [
    { txt: 'Cancelar' }, { txt: 'Poner bisagras', primario: true, fn: () => {
      const lado = fv('lado'), tipo = fv('tipo'), n = Math.max(1, Math.min(6, Math.round(fv('n')))), mat = fv('mat');
      const lateral = lado === 'izq' || lado === 'der';
      const largo = lateral ? f.h : f.w, ini = lateral ? f.y : f.x, marg = Math.min(10, largo * .15);
      const pos = n === 1 ? [ini + largo / 2] : Array.from({ length: n }, (_, i) => ini + marg + (largo - 2 * marg) * i / (n - 1));
      const nuevas = [];
      for (const c of pos) {
        if (tipo === 'cazoleta') {
          // cazoleta en la cara interior de la puerta, a 2,25 cm del canto
          const dc = 2.25, D = 3.5;
          let cx = lado === 'izq' ? f.x + dc : lado === 'der' ? f.x + f.w - dc : c;
          let cy = lado === 'arriba' ? f.y + f.h - dc : lado === 'abajo' ? f.y + dc : c;
          nuevas.push({ nombre: 'Cazoleta bisagra', forma: 'cilindro', eje: 'z', x: r1(cx - D / 2), y: r1(cy - D / 2), z: r1(f.z - .15), w: D, h: D, d: .15, material: mat, canto: 0, grupo: true });
          // brazo hacia el costado
          if (lateral) { nuevas.push({ nombre: 'Brazo bisagra', x: r1(lado === 'izq' ? f.x + .2 : f.x + f.w - 4.2), y: r1(cy - .7), z: r1(f.z - 1.25), w: 4, h: 1.4, d: 1.1, material: mat, canto: 2, grupo: true }); }
          else nuevas.push({ nombre: 'Brazo bisagra', x: r1(cx - .7), y: r1(lado === 'arriba' ? f.y + f.h - 4.2 : f.y + .2), z: r1(f.z - 1.25), w: 1.4, h: 4, d: 1.1, material: mat, canto: 2, grupo: true });
        } else {
          // pernio: nudillo cilíndrico en el canto, por fuera
          const D = 1, l = 6;
          if (lateral) nuevas.push({ nombre: 'Pernio', forma: 'cilindro', eje: 'y', x: r1((lado === 'izq' ? f.x : f.x + f.w) - D / 2), y: r1(c - l / 2), z: r1(f.z + f.d - D / 2), w: D, h: l, d: D, material: mat, canto: 0 });
          else nuevas.push({ nombre: 'Pernio', forma: 'cilindro', eje: 'x', x: r1(c - l / 2), y: r1((lado === 'arriba' ? f.y + f.h : f.y) - D / 2), z: r1(f.z + f.d - D / 2), w: l, h: D, d: D, material: mat, canto: 0 });
        }
      }
      guardarHistoria();
      const N = nuevas.map(o => { const q = nuevaPieza(Object.assign({ acabado: 'satinado' }, o, { grupo: null })); q._conPuerta = !!o.grupo; return q; });
      N.forEach(q => P.piezas.push(q));
      const ids = [f.id, ...tiradoresDe(f).map(q => q.id), ...N.filter(q => q._conPuerta).map(q => q.id)];
      N.forEach(q => delete q._conPuerta);
      let g0 = f.grupo;
      if (g0) ids.forEach(id => pieza(id).grupo = g0);
      else g0 = nuevoGrupo('Puerta · ' + f.nombre, ids);
      P.grupos[g0].mov = { tipo: lado, valor: fv('ang') };
      limpiarGrupos(); sel = new Set(piezasGrupo(g0).map(q => q.id)); cambio(true);
      aviso('Bisagras puestas. Ábrela con «🚪 Abrir» bajo el 3D');
    } }]);
}

async function plantillaImportar() {
  const imp = await importarArchivo(); if (!imp) return;
  const V = vistaActiva;
  modal('Importar ' + imp.nombre, `<p class="nota">${imp.piezas.length} contorno(s) cerrado(s). Cada uno será una pieza con su contorno; los contornos interiores se vuelven huecos.</p>` + formulario([
    { id: 'unid', et: 'Unidades del dibujo', v: imp.mmPorUnidad ? 'auto' : 'mm', sel: [['mm', 'Milímetros'], ['cm', 'Centímetros'], ['in', 'Pulgadas'], ['auto', 'Las del SVG']] },
    { id: 'plano', et: 'Dibujar en la vista', v: TIPOS[V.clave].plano, sel: [['alzado', 'Alzado (de frente; grosor en Z)'], ['planta', 'Planta (tumbada; grosor en Y)'], ['perfil', 'Perfil (de lado; grosor en X)']] },
    { id: 'g', et: 'Grosor (cm)', v: parseFloat($('#nGrosor').value) || 1.9 },
    { id: 'mat', et: 'Material', v: ultimoMaterial, sel: Object.keys(MATERIALES).map(k => [k, MATERIALES[k].nombre]) }]) +
    `<canvas id="cPrev" class="prevc" width="440" height="200"></canvas>`, [
    { txt: 'Cancelar' }, { txt: 'Importar', primario: true, fn: () => {
      const k = factorUnidades(imp, fv('unid')), plano = fv('plano'), W = TIPOS[plano], g = fv('g'), mat = fv('mat');
      let gx0 = Infinity, gy0 = Infinity;
      imp.piezas.forEach(c => c.ext.forEach(([x, y]) => { gx0 = Math.min(gx0, x); gy0 = Math.min(gy0, y); }));
      const bb = bbox(), hay = P.piezas.some(p => p.visible);
      const baseA = W.h === 'x' ? (hay ? bb.x1 + 10 : 0) : (hay ? bb.z1 + 10 : 0);
      let gy1 = -Infinity; imp.piezas.forEach(c => c.ext.forEach(([, y]) => gy1 = Math.max(gy1, y)));
      const L = imp.piezas.map((c, i) => {
        const cont = normalizarContorno(c, k);
        let x0 = Infinity, y0 = Infinity; c.ext.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); });
        const o = { nombre: (imp.piezas.length > 1 ? 'Pieza ' + (i + 1) : imp.nombre.replace(/\.[^.]+$/, '')), forma: 'perfil', plano, contorno: Object.assign(cont, { tipo: 'importar' }), material: mat, canto: .5 };
        o[DIM[W.h]] = r1(cont.cw); o[DIM[W.v]] = r1(cont.ch); o[DIM[W.prof]] = g;
        o[W.h] = r1(baseA + (x0 - gx0) * k);
        // en planta la pantalla «hacia arriba» es -Z: se invierte para que se vea como en el dibujo
        o[W.v] = W.vs > 0 ? r1((y0 - gy0) * k) : r1((gy1 - y0) * k - cont.ch);
        o[W.prof] = 0;
        return o;
      });
      insertar(L, imp.piezas.length + ' pieza(s) importada(s)', imp.piezas.length > 1 ? imp.nombre.replace(/\.[^.]+$/, '') : null);
    } }], '520px');
  const prev = () => {
    const cv = $('#cPrev'); if (!cv) return; const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    imp.piezas.forEach(p => p.ext.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
    const s = Math.min((cv.width - 20) / (x1 - x0 || 1), (cv.height - 30) / (y1 - y0 || 1)), ox = (cv.width - (x1 - x0) * s) / 2, oy = (cv.height + (y1 - y0) * s) / 2;
    c.beginPath(); imp.piezas.forEach(p => [p.ext, ...p.huecos].forEach(an => { an.forEach(([x, y], i) => i ? c.lineTo(ox + (x - x0) * s, oy - (y - y0) * s) : c.moveTo(ox + (x - x0) * s, oy - (y - y0) * s)); c.closePath(); }));
    c.fillStyle = 'rgba(184,141,94,.55)'; c.fill('evenodd'); c.strokeStyle = '#1f2329'; c.stroke();
    const k = factorUnidades(imp, fv('unid'));
    c.fillStyle = '#555'; c.font = '11px system-ui'; c.fillText(r1((x1 - x0) * k) + ' × ' + r1((y1 - y0) * k) + ' cm', 6, 14);
  };
  $('#f_unid').addEventListener('input', prev); prev();
}

/* ===================== BOCETOS ===================== */
$('#bBocetoVista').onclick = async () => {
  const f = await leerArchivo('image/*'); if (!f) return;
  const im = await cargarImagen(f.datos);
  const V = vistaActiva;
  const vis = s2w(V, 30, 40), vis2 = s2w(V, V.W - 30, V.H - 30);
  const ancho = Math.abs(vis2[0] - vis[0]) * .8;
  P.bocetos[V.clave] = { src: f.datos, x: vis[0], y: vis[1], cmPorPx: ancho / im.naturalWidth, opacidad: .6, visible: true };
  imgsBoceto[V.clave] = im;
  $('#sBocetoVista').value = V.clave; pintarCtlBoceto(); guardarLocal(); dibujarVistas();
  aviso('Boceto en «' + TIPOS[V.clave].nombre + '». Usa «📏 Escalar» para darle su medida real.');
};
function pintarCtlBoceto() {
  const v = $('#sBocetoVista').value, bo = P.bocetos[v];
  $('#bocetoCtl').classList.toggle('oculto', !Object.keys(P.bocetos).length);
  if (bo) $('#rOpacidad').value = bo.opacidad ?? .6;
}
$('#sBocetoVista').onchange = pintarCtlBoceto;
$('#rOpacidad').oninput = () => { const bo = P.bocetos[$('#sBocetoVista').value]; if (bo) { bo.opacidad = parseFloat($('#rOpacidad').value); dibujarVistas(); } };
$('#rOpacidad').onchange = guardarLocal;
$('#bBocetoOcultar').onclick = () => { const bo = P.bocetos[$('#sBocetoVista').value]; if (bo) { bo.visible = bo.visible === false; dibujarVistas(); guardarLocal(); } };
$('#bBocetoQuitar').onclick = () => { const k = $('#sBocetoVista').value; delete P.bocetos[k]; delete imgsBoceto[k]; pintarCtlBoceto(); dibujarVistas(); guardarLocal(); };
$('#bReferencia').onclick = async () => {
  const f = await leerArchivo('image/*'); if (!f) return;
  P.referencia = f.datos; mostrarReferencia(); guardarLocal();
};
function mostrarReferencia() {
  if (!P.referencia) { $('#flotante').classList.add('oculto'); return; }
  $('#flotImg').src = P.referencia; $('#flotante').classList.remove('oculto');
}
$('#bFlotCerrar').onclick = () => $('#flotante').classList.add('oculto');
(function () { // arrastrar la ventana flotante
  const f = $('#flotante'), t = f.querySelector('.ftit'); let d = null;
  t.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON') return; d = [e.clientX - f.offsetLeft, e.clientY - f.offsetTop]; t.setPointerCapture(e.pointerId); });
  t.addEventListener('pointermove', e => { if (!d) return; f.style.left = (e.clientX - d[0]) + 'px'; f.style.top = (e.clientY - d[1]) + 'px'; f.style.right = 'auto'; f.style.bottom = 'auto'; });
  t.addEventListener('pointerup', () => d = null);
})();

/* ===================== DIBUJAR EN EL CALCADOR =====================
   La copia de MUEBLECAD 2D (assets/mueblecad/mueblecad.html) se abre en modo «Pieza 3D» dentro de una ventana.
   (Los nombres «calc…» y la clave «calcador» de los datos vienen de cuando se usaba el Calcador: se mantienen
   para que los proyectos guardados sigan abriéndose; el formato de los contornos es el mismo.)
   Se le manda la pieza (medidas en mm de la vista donde se dibuja), su contorno si ya lo tiene y el boceto de esa vista;
   devuelve sus contornos con los arcos exactos (pts + bulge). El mayor es la pieza; los de dentro, sus huecos;
   otros contornos sueltos se convierten en piezas nuevas. */
const CALC_URL = 'assets/mueblecad/mueblecad.html?modo=pieza3d';
let calcSesion = null;

function calcPoligonos(calc) { // contornos cerrados del Calcador → polígonos en mm (y hacia arriba)
  return (calc.contornos || []).filter(c => c && c.cerrado && Array.isArray(c.pts) && c.pts.length >= 2 && !c.texto && !c.deTexto).map(c => {
    const pts = c.pts.map(q => [+q.x, +q.y]), b = c.b || [], out = [pts[0]];
    for (let i = 0; i < pts.length; i++) out.push(...bulgePts(pts[i], pts[(i + 1) % pts.length], +b[i] || 0));
    out.pop(); return out;
  });
}
function bocetoParaCalc(p, plano) { // el boceto de la vista, colocado en mm respecto a la esquina de la pieza
  const bo = P.bocetos[plano], im = imgsBoceto[plano]; if (!bo || !im) return null;
  const T0 = TIPOS[plano], c = bo.cmPorPx;
  const a0 = p[T0.h], b0 = p[T0.v], b1 = b0 + p[DIM[T0.v]];
  const vTop = T0.vs > 0 ? bo.y - b0 : b1 - bo.y;
  return { dataUrl: bo.src, nombre: 'boceto', s: c * 10, tx: (bo.x - a0) * 10, ty: (vTop - im.naturalHeight * c) * 10, opac: .5 };
}
function abrirCalcador(p, plano, nueva) {
  const T0 = TIPOS[plano];
  const ancho = p[DIM[T0.h]] * 10, alto = p[DIM[T0.v]] * 10;
  let calc = null, off = { x: 0, y: 0 };
  if (tieneContorno(p) && p.plano === plano) {
    if (p.contorno.tipo === 'calcador' && p.contorno.calc) { calc = p.contorno.calc; off = p.contorno.off || off; }
    else { // un contorno de plantilla o de DXF: se pasa como polilínea para retocarlo
      const ka = p[DIM[T0.h]] / p.contorno.cw * 10, kb = p[DIM[T0.v]] / p.contorno.ch * 10;
      calc = { contornos: [p.contorno.ext, ...(p.contorno.huecos || [])].map(an => ({ pts: an.map(([u, v]) => ({ x: r1(u * ka * 1000) / 1000, y: r1(v * kb * 1000) / 1000 })), b: an.map(() => 0), cerrado: true })) };
    }
  }
  calcSesion = { pid: p.id, nueva: !!nueva, plano, base: nueva ? p : null, off, enviado: false,
    datos: { tipo: 'pieza3d-datos', nombre: p.nombre, vista: T0.nombre, ancho, alto, calcador: calc, fondo: bocetoParaCalc(p, plano) } };
  const v = $('#calcVentana'); v.classList.remove('oculto');
  const f = document.createElement('iframe'); f.id = 'calcFrame'; f.src = CALC_URL; f.title = 'MUEBLECAD 2D';
  $('#calcCaja').innerHTML = ''; $('#calcCaja').appendChild(f);
  setTimeout(() => { if (calcSesion && !calcSesion.enviado) $('#calcAviso').classList.remove('oculto'); }, 6000);
}
function cerrarCalcador() {
  $('#calcVentana').classList.add('oculto'); $('#calcCaja').innerHTML = ''; $('#calcAviso').classList.add('oculto'); calcSesion = null;
}
$('#calcCerrar').onclick = cerrarCalcador;
window.addEventListener('message', e => {
  const d = e.data, f = $('#calcFrame');
  if (!calcSesion || !f || e.source !== f.contentWindow || !d || typeof d !== 'object') return;
  if (d.tipo === 'pieza3d-listo') { f.contentWindow.postMessage(calcSesion.datos, '*'); calcSesion.enviado = true; $('#calcAviso').classList.add('oculto'); }
  else if (d.tipo === 'pieza3d-cancelar') cerrarCalcador();
  else if (d.tipo === 'pieza3d-resultado') { const s = calcSesion; cerrarCalcador(); aplicarCalc(s, d.calcador, d.nombre); }
});

function aplicarCalc(s, calc, nombre) {
  const pz = clasificar(calcPoligonos(calc || {}));
  if (!pz.length) return aviso('No ha llegado ningún contorno cerrado');
  const T0 = TIPOS[s.plano];
  const caja = an => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; an.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return { x0, y0, x1, y1 }; };
  guardarHistoria();
  let p;
  if (s.nueva) { p = s.base; P.piezas.push(p); } else { p = pieza(s.pid); if (!p) return; }
  const B = caja(pz[0].ext);
  // la esquina de la pieza corresponde al punto «off» del dibujo (al principio, el 0,0 del rectángulo enviado)
  const dA = (B.x0 - s.off.x) / 10, cw = (B.x1 - B.x0) / 10, ch = (B.y1 - B.y0) / 10;
  const vOld0 = p[T0.v], vOld1 = p[T0.v] + p[DIM[T0.v]];
  p[T0.h] = r1(p[T0.h] + dA);
  if (T0.vs > 0) p[T0.v] = r1(vOld0 + (B.y0 - s.off.y) / 10);
  else p[T0.v] = r1(vOld1 - (B.y0 - s.off.y) / 10 - ch);
  p[DIM[T0.h]] = r1(cw); p[DIM[T0.v]] = r1(ch);
  const cont = normalizarContorno(pz[0], .1);
  p.forma = 'perfil'; p.plano = s.plano;
  p.contorno = Object.assign(cont, { tipo: 'calcador', calc: JSON.parse(JSON.stringify(calc)), off: { x: B.x0, y: B.y0 } });
  // en el mundo: coordenadas del dibujo (mm) → ejes de la vista
  const aDe = x => p[T0.h] + (x - B.x0) / 10;
  const bTop = p[T0.v] + p[DIM[T0.v]];
  const nuevas = [p];
  pz.slice(1).forEach((c, i) => {
    const b = caja(c.ext), q = nuevaPieza({ nombre: p.nombre + ' ' + (i + 2), material: p.material, acabado: p.acabado, canto: p.canto, nucleo: p.nucleo, cantos: p.cantos, cantoMat: p.cantoMat, color: p.color });
    const k = normalizarContorno(c, .1);
    q.forma = 'perfil'; q.plano = s.plano; q.contorno = Object.assign(k, { tipo: 'importar' });
    q[DIM[T0.h]] = r1(k.cw); q[DIM[T0.v]] = r1(k.ch); q[DIM[T0.prof]] = p[DIM[T0.prof]]; q[T0.prof] = p[T0.prof];
    q[T0.h] = r1(aDe(b.x0));
    q[T0.v] = T0.vs > 0 ? r1(p[T0.v] + (b.y0 - B.y0) / 10) : r1(bTop - (b.y1 - B.y0) / 10);
    P.piezas.push(q); nuevas.push(q);
  });
  if (nombre && s.nueva && nombre !== 'Pieza a mano') p.nombre = nombre;
  sel = new Set(nuevas.map(q => q.id)); cambio(true);
  if (s.nueva) encuadrarTodo();
  aviso(nuevas.length > 1 ? `Contorno aplicado; ${nuevas.length - 1} contorno(s) más, como piezas nuevas` : 'Contorno aplicado');
}

// Calcador → Anidador: los contornos con sus arcos, escalados a las medidas actuales de la pieza
function contornosCalcadorMM(p) {
  if (!tieneContorno(p) || p.contorno.tipo !== 'calcador' || !p.contorno.calc) return null;
  const T0 = TIPOS[p.plano], c = p.contorno;
  const ka = p[DIM[T0.h]] / c.cw, kb = p[DIM[T0.v]] / c.ch;
  if (Math.abs(ka - kb) > .002 * Math.max(ka, kb)) return null;              // estirada en una sola dirección: los arcos ya no lo son
  const polys = calcPoligonos(c.calc), ext = clasificar(polys)[0]; if (!ext) return null;
  const off = c.off || { x: 0, y: 0 };
  return (c.calc.contornos || []).filter(k => k && k.cerrado && k.pts && k.pts.length >= 2 && !k.texto && !k.deTexto)
    .filter((k, i) => { const pl = polys[i]; return pl === ext.ext || ext.huecos.includes(pl) || puntoEnPoly(pl[0], ext.ext); })
    .map(k => ({ pts: k.pts.map(q => ({ x: Math.round((q.x - off.x) * ka * 1000) / 1000, y: Math.round((q.y - off.y) * kb * 1000) / 1000 })), b: k.pts.map((_, j) => +(k.b || [])[j] || 0), cerrado: true }));
}

$('#bCalcador').onclick = () => {
  const p = piezaSel(); if (!p) return aviso('Selecciona una sola pieza');
  if (p.forma === 'cilindro') return aviso('Los cilindros no llevan contorno');
  abrirCalcador(p, p.plano || planoNatural(p), false);
};
function piezaAMano() {
  const V = vistaActiva, plano = TIPOS[V.clave].plano, T0 = TIPOS[plano], bb = bbox(), hay = P.piezas.some(q => q.visible);
  const g = parseFloat($('#nGrosor').value) || 1.9;
  const o = { nombre: 'Pieza a mano', material: ultimoMaterial };
  o[DIM[T0.h]] = 40; o[DIM[T0.v]] = 30; o[DIM[T0.prof]] = g;
  o[T0.h] = hay ? r1((T0.h === 'x' ? bb.x1 : bb.z1) + 10) : 0; o[T0.v] = 0; o[T0.prof] = 0;
  abrirCalcador(nuevaPieza(o), plano, true);
  aviso('Dibuja la pieza en MUEBLECAD 2D (vista ' + T0.nombre.toLowerCase() + ')');
}

/* ===================== MADERAS DESDE FOTOS ===================== */
// Biblioteca personal: IndexedDB del navegador (queda en este ordenador, para todos los proyectos)
const DB = {
  abrir() {
    return new Promise((res, rej) => {
      try { const r = indexedDB.open('boceto3d', 1); r.onupgradeneeded = () => r.result.createObjectStore('maderas'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
      catch (e) { rej(e); }
    });
  },
  async todas() {
    const db = await this.abrir();
    return new Promise(res => { const o = {}; const tx = db.transaction('maderas'); const st = tx.objectStore('maderas');
      st.openCursor().onsuccess = e => { const c = e.target.result; if (c) { o[c.key] = c.value; c.continue(); } else res(o); }; tx.onerror = () => res(o); });
  },
  async poner(k, v) { const db = await this.abrir(); return new Promise(res => { const tx = db.transaction('maderas', 'readwrite'); tx.objectStore('maderas').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); },
  async quitar(k) { const db = await this.abrir(); return new Promise(res => { const tx = db.transaction('maderas', 'readwrite'); tx.objectStore('maderas').delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); },
};
async function cargarBiblioteca() { try { BIBLIO = await DB.todas(); } catch (e) { BIBLIO = {}; } }

// --- tratamiento de la foto ---
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function procesarFoto(im, o) {
  const max = 1024, esc0 = Math.min(1, max / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height));
  let w = Math.round((im.naturalWidth || im.width) * esc0), h = Math.round((im.naturalHeight || im.height) * esc0);
  // recorte central (porcentaje que se conserva)
  const rc = Math.max(.2, Math.min(1, o.recorte || 1));
  let c = lienzo(o.girar ? h : w, o.girar ? w : h), x = c.getContext('2d');
  if (o.girar) { x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(im, -w / 2, -h / 2, w, h); x.setTransform(1, 0, 0, 1, 0, 0); }
  else x.drawImage(im, 0, 0, w, h);
  if (rc < 1) {
    const cw = Math.round(c.width * rc), ch = Math.round(c.height * rc), c2 = lienzo(cw, ch);
    c2.getContext('2d').drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, cw, ch); c = c2; x = c.getContext('2d');
  }
  w = c.width; h = c.height;
  let img = x.getImageData(0, 0, w, h), d = img.data;
  if (o.igualar) { // quita las manchas de luz: divide por una versión muy borrosa
    const pw = 12, ph = Math.max(2, Math.round(12 * h / w)), peq = lienzo(pw, ph), px = peq.getContext('2d');
    px.imageSmoothingQuality = 'high'; px.drawImage(c, 0, 0, pw, ph);
    const gr = lienzo(w, h), gx = gr.getContext('2d'); gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high'; gx.drawImage(peq, 0, 0, w, h);
    const L = gx.getImageData(0, 0, w, h).data;
    let media = 0; for (let i = 0; i < L.length; i += 4) media += .3 * L[i] + .59 * L[i + 1] + .11 * L[i + 2]; media /= (L.length / 4);
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.max(8, .3 * L[i] + .59 * L[i + 1] + .11 * L[i + 2]), k = media / l;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
    }
    x.putImageData(img, 0, 0);
  }
  if (o.repetible) { // mezcla con una copia desplazada media imagen: los bordes empalman sin costura
    const sh = lienzo(w, h), sx = sh.getContext('2d'), hw = Math.floor(w / 2), hh = Math.floor(h / 2);
    sx.drawImage(c, hw, hh, w - hw, h - hh, 0, 0, w - hw, h - hh); sx.drawImage(c, 0, hh, hw, h - hh, w - hw, 0, hw, h - hh);
    sx.drawImage(c, hw, 0, w - hw, hh, 0, h - hh, w - hw, hh); sx.drawImage(c, 0, 0, hw, hh, w - hw, h - hh, hw, hh);
    const S = sx.getImageData(0, 0, w, h).data; img = x.getImageData(0, 0, w, h); d = img.data;
    const ven = t => { const v = Math.min(1, Math.min(t, 1 - t) / .22); return v * v * (3 - 2 * v); };
    const wx = new Float32Array(w), wy = new Float32Array(h);
    for (let i = 0; i < w; i++) wx[i] = ven((i + .5) / w); for (let j = 0; j < h; j++) wy[j] = ven((j + .5) / h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const m = wx[i] * wy[j], q = (j * w + i) * 4;
      d[q] = d[q] * m + S[q] * (1 - m); d[q + 1] = d[q + 1] * m + S[q + 1] * (1 - m); d[q + 2] = d[q + 2] * m + S[q + 2] * (1 - m);
    }
    x.putImageData(img, 0, 0);
  }
  let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 64) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
  return { lienzo: c, hex };
}
function mosaico(cv, src, n) { // vista previa repetida n x n
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  const tw = cv.width / n, th = tw * src.height / src.width;
  for (let j = 0; j * th < cv.height; j++) for (let i = 0; i < n; i++) c.drawImage(src, i * tw, j * th, tw, th);
}

function añadirMaderaFoto() {
  leerArchivo('image/*').then(async f => {
    if (!f) return;
    const im = await cargarImagen(f.datos);
    let res = null;
    modal('Madera desde foto', `<p class="nota">Foto frontal del tablero, sin sombras y con la <b>veta en horizontal</b> (si va en vertical, marca «Girar»). Abajo ves cómo queda repetida.</p>
      <canvas id="cMos" class="prevc" width="460" height="230"></canvas>` + formulario([
      { id: 'nom', et: 'Nombre', v: f.nombre.replace(/\.[^.]+$/, ''), txt: true },
      { id: 'cm', et: 'Ancho real que abarca la foto (cm)', v: 60, step: 1 },
      { id: 'recorte', et: 'Conservar del centro (%)', v: 100, step: 5 },
      { id: 'girar', et: 'Girar 90° (veta vertical en la foto)', v: im.naturalHeight > im.naturalWidth * 1.15, chk: true },
      { id: 'igualar', et: 'Igualar la luz (quita zonas más claras u oscuras)', v: true, chk: true },
      { id: 'repetible', et: 'Hacerla repetible sin costuras', v: true, chk: true },
      { id: 'biblio', et: 'Guardarla también en mi biblioteca (para otros proyectos)', v: true, chk: true }]), [
      { txt: 'Cancelar' },
      { txt: 'Añadir', primario: true, fn: () => {
        if (!res) return false;
        const cm = Math.max(1, fv('cm'));
        const datos = { nombre: (fv('nom') || 'Madera').trim(), src: res.lienzo.toDataURL('image/jpeg', .86), cm, cmV: cm * res.lienzo.height / res.lienzo.width, hex: res.hex };
        const clave = 'u_' + Date.now().toString(36);
        P.maderasUsuario[clave] = datos;
        if (fv('biblio')) { BIBLIO[clave] = datos; DB.poner(clave, datos).catch(() => aviso('No se pudo guardar en la biblioteca del navegador')); }
        opcionesMaterial(); opcionesMaterial('#pCantoMat');
        const L = seleccionadas();
        if (L.length) { guardarHistoria(); L.forEach(p => p.material = clave); ultimoMaterial = clave; }
        cambio(true); aviso('Madera «' + datos.nombre + '» añadida' + (L.length ? ' y aplicada' : ''));
      } }], '540px');
    const rehacerPrev = () => {
      res = procesarFoto(im, { girar: fv('girar'), igualar: fv('igualar'), repetible: fv('repetible'), recorte: fv('recorte') / 100 });
      mosaico($('#cMos'), res.lienzo, 3);
    };
    $$('#mCuerpo input').forEach(i => i.addEventListener('change', rehacerPrev));
    rehacerPrev();
  });
}

function gestorMaderas() {
  const fila = (k, m, origen) => `<div class="item" data-k="${k}" data-o="${origen}">
      <img src="${m.src}" alt="">
      <input type="text" value="${esc(m.nombre)}" ${origen === 'aula' ? 'disabled' : ''} data-campo="nombre">
      <label class="fila" style="margin:0">cm <input type="number" value="${r1(m.cm)}" step="1" style="width:70px" ${origen === 'aula' ? 'disabled' : ''} data-campo="cm"></label>
      <div class="acc">
        <button data-acc="usar" title="Aplicar a las piezas seleccionadas">Usar</button>
        ${origen === 'proyecto' && !BIBLIO[k] ? '<button data-acc="abib" title="Copiar a mi biblioteca">→ Bibl.</button>' : ''}
        ${origen !== 'aula' ? '<button data-acc="quitar" class="peligro" title="Quitar">🗑</button>' : ''}
      </div>
      <span class="orig">${{ proyecto: 'En este proyecto', biblio: 'Mi biblioteca', aula: 'Del aula' }[origen]}</span></div>`;
  const pintar = () => {
    const vistos = new Set(); let h = '';
    const sec = (tit, fuente, origen, vacio) => {
      const ks = Object.keys(fuente).filter(k => !vistos.has(k)); ks.forEach(k => vistos.add(k));
      h += `<h4>${tit}</h4>` + (ks.length ? `<div class="bib">${ks.map(k => fila(k, fuente[k], origen)).join('')}</div>` : `<p class="nota">${vacio}</p>`);
    };
    sec('Mi biblioteca (este ordenador)', BIBLIO, 'biblio', 'Vacía. Las fotos que añadas se guardan aquí para todos tus proyectos.');
    sec('En este proyecto', P.maderasUsuario, 'proyecto', 'Ninguna.');
    sec('Del aula (archivo assets/texturas/maderas_aula.js)', AULA, 'aula', 'Ninguna. Exporta tu biblioteca y copia el archivo en esa carpeta para que la tengan todos los ordenadores.');
    $('#mCuerpo').innerHTML = `<div class="col2"><button id="bAñadirFoto" class="primario">📷 Añadir madera desde foto…</button><button id="bExpAula">⬇ Exportar para el aula</button></div>` + h;
    $('#bAñadirFoto').onclick = () => { cerrarModal(); añadirMaderaFoto(); };
    $('#bExpAula').onclick = () => {
      const todas = Object.assign({}, AULA, BIBLIO);
      if (!Object.keys(todas).length) return aviso('La biblioteca está vacía');
      const js = '/* Maderas del aula — generado por Boceto a Render 3D. Copia este archivo en assets/texturas/ */\nwindow.MADERAS_AULA = ' + JSON.stringify(todas) + ';\n';
      descargar('maderas_aula.js', new Blob([js], { type: 'text/javascript' }));
      aviso('Copia maderas_aula.js en la carpeta assets/texturas del programa');
    };
    $$('.bib .item').forEach(it => {
      const k = it.dataset.k, o = it.dataset.o, fuente = o === 'biblio' ? BIBLIO : o === 'proyecto' ? P.maderasUsuario : AULA;
      it.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        const m = fuente[k]; if (!m) return;
        if (inp.dataset.campo === 'nombre') m.nombre = inp.value.trim() || m.nombre;
        else { const v = Math.max(1, parseFloat(inp.value) || m.cm); m.cmV = (m.cmV || m.cm) * v / m.cm; m.cm = v; }
        if (o === 'biblio') DB.poner(k, m);
        if (P.maderasUsuario[k] && o !== 'proyecto') Object.assign(P.maderasUsuario[k], { nombre: m.nombre, cm: m.cm, cmV: m.cmV });
        olvidarMaterial(k); opcionesMaterial(); opcionesMaterial('#pCantoMat'); cambio(true);
      }));
      it.querySelectorAll('button').forEach(bt => bt.onclick = async () => {
        const a = bt.dataset.acc;
        if (a === 'usar') {
          const L = seleccionadas(); if (!L.length) return aviso('Selecciona antes las piezas');
          guardarHistoria(); asegurarMadera(k); L.forEach(p => p.material = k); ultimoMaterial = k; opcionesMaterial(); cambio(true); aviso('Aplicada a ' + L.length + ' pieza(s)');
        }
        if (a === 'abib') { BIBLIO[k] = JSON.parse(JSON.stringify(P.maderasUsuario[k])); await DB.poner(k, BIBLIO[k]); pintar(); }
        if (a === 'quitar') {
          if (o === 'biblio') { delete BIBLIO[k]; await DB.quitar(k); }
          if (o === 'proyecto') {
            if (P.piezas.some(p => p.material === k || p.cantoMat === k)) return aviso('Hay piezas que la usan: cámbiales antes el material');
            delete P.maderasUsuario[k];
          }
          opcionesMaterial(); opcionesMaterial('#pCantoMat'); pintar(); guardarLocal();
        }
      });
    });
  };
  modal('Maderas desde fotos', '', [{ txt: 'Cerrar' }], '760px');
  pintar();
}
$('#bMaderas').onclick = gestorMaderas;

/* ===================== 3D ===================== */
const c3d = $('#c3d');
const renderer = new T.WebGLRenderer({ canvas: c3d, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
const escena = new T.Scene();
const camara = new T.PerspectiveCamera(30, 1, 1, 20000);
camara.position.set(160, 110, 190);
const controles = new T.OrbitControls(camara, c3d);
controles.enableDamping = true; controles.dampingFactor = .12; controles.target.set(25, 30, 20);
controles.maxPolarAngle = Math.PI * .495;
const pmrem = new T.PMREMGenerator(renderer);
escena.environment = pmrem.fromScene(new T.RoomEnvironment(), .04).texture;

const luzPrincipal = new T.DirectionalLight(0xfff4e8, 1.6);
luzPrincipal.castShadow = true; luzPrincipal.shadow.mapSize.set(2048, 2048);
luzPrincipal.shadow.bias = -0.0004; luzPrincipal.shadow.normalBias = .04;
escena.add(luzPrincipal, luzPrincipal.target);
const luzCielo = new T.DirectionalLight(0xdfe8ff, 0); // solo en el render final (oclusión ambiental)
luzCielo.castShadow = true; luzCielo.shadow.mapSize.set(1024, 1024); luzCielo.shadow.bias = -0.0005; luzCielo.shadow.normalBias = .05;
escena.add(luzCielo, luzCielo.target);

const grupoPiezas = new T.Group(); escena.add(grupoPiezas);
const grupoAyudas = new T.Group(); escena.add(grupoAyudas);
const grupoDecorado = new T.Group(); escena.add(grupoDecorado);
const sombraSuelo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: .32 }));
sombraSuelo.rotation.x = -Math.PI / 2; sombraSuelo.receiveShadow = true;
const contacto = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, map: texturaContacto() }));
contacto.rotation.x = -Math.PI / 2; contacto.position.y = .05; contacto.renderOrder = -1;
function texturaContacto() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(.55, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// ---------- texturas y materiales ----------
const cacheTex = {};
function textura(src, ruta) {
  if (cacheTex[ruta]) return cacheTex[ruta];
  const t = new T.TextureLoader().load(src, () => render3D());
  t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return cacheTex[ruta] = t;
}
const cacheMat = {};
function olvidarMaterial(clave) {
  for (const k in cacheMat) if (k.split('|')[0] === clave) { cacheMat[k].dispose(); delete cacheMat[k]; }
  if (cacheTex[clave]) { cacheTex[clave].dispose(); delete cacheTex[clave]; }
}
function crearMaterial(clave, acabado, color) {
  const m = infoMaterial(clave);
  const ck = [clave, acabado, m.tipo === 'lacado' ? color : ''].join('|');
  if (cacheMat[ck]) return cacheMat[ck];
  const rough = { mate: .78, satinado: .5, brillo: .32 }[acabado] ?? .5;
  let mat;
  if (m.tipo === 'madera') {
    const tx = textura(srcMadera(clave), clave);
    mat = new T.MeshPhysicalMaterial({ map: tx, bumpMap: tx, bumpScale: .12, roughness: rough, specularIntensity: .45 });
    if (acabado === 'brillo') { mat.clearcoat = 1; mat.clearcoatRoughness = .06; }
    if (acabado === 'satinado') { mat.clearcoat = .3; mat.clearcoatRoughness = .35; }
  } else if (m.tipo === 'color' || m.tipo === 'lacado') {
    mat = new T.MeshPhysicalMaterial({ color: new T.Color(m.tipo === 'lacado' ? color : m.hex), roughness: m.tipo === 'color' ? Math.max(rough, .45) : rough, specularIntensity: .5 });
    if (acabado === 'brillo') { mat.clearcoat = 1; mat.clearcoatRoughness = .04; }
  } else if (m.tipo === 'metal') {
    mat = new T.MeshPhysicalMaterial({ color: new T.Color(m.hex), metalness: 1, roughness: acabado === 'brillo' ? .12 : acabado === 'mate' ? .5 : m.rough });
  } else if (m.tipo === 'metalpint') {
    mat = new T.MeshPhysicalMaterial({ color: new T.Color(m.hex), metalness: .4, roughness: m.rough });
  } else {
    mat = new T.MeshPhysicalMaterial({ color: new T.Color(m.hex), metalness: 0, roughness: .03, transmission: .94, thickness: .6, ior: 1.5, transparent: true, opacity: 1 });
  }
  const u = m.usuario ? datosMaderaFoto(clave) : null;
  mat.userData.cm = u ? u.cm : TEX_CM; mat.userData.cmV = u ? (u.cmV || u.cm) : TEX_CM;
  return cacheMat[ck] = mat;
}
function material(p) { return crearMaterial(p.material, p.acabado, p.color); }
function matAlma(n) {
  const ck = 'alma:' + n; if (cacheMat[ck]) return cacheMat[ck];
  const A = ALMAS[n], mat = new T.MeshStandardMaterial({ map: textura(window.TEXTURAS[A.tex], ck), roughness: .9 });
  mat.userData.cm = mat.userData.cmV = A.cm; return cacheMat[ck] = mat;
}
function cantoInfo(p) {
  const nuc = nucleoDe(p), cara = material(p);
  if (nuc === 'macizo') return { modo: 'macizo', mat: cara, cm: cara.userData.cm, cmV: cara.userData.cmV };
  if (p.cantos === 'sin') { const a = matAlma(nuc); return { modo: 'alma', mat: a, cm: a.userData.cm, cmV: a.userData.cmV }; }
  const m = p.cantos === 'otro' ? crearMaterial(p.cantoMat || 'roble', p.acabado, p.cantoColor) : cara;
  return { modo: 'chapa', mat: m, cm: m.userData.cm, cmV: m.userData.cmV };
}

// ---------- geometría ----------
function ejeVeta(p) {
  if (p.forma === 'cilindro') return p.eje;
  if (p.veta !== 'auto') return p.veta;
  const d = { x: p.w, y: p.h, z: p.d };
  return Object.keys(d).sort((a, b) => d[b] - d[a])[0];
}
function ejeGrosor(p) {
  if (tieneContorno(p)) return TIPOS[p.plano].prof;
  const d = { x: p.w, y: p.h, z: p.d }; return Object.keys(d).sort((a, b) => d[a] - d[b])[0];
}
function geometria(p) {
  let g, tipo = 'caja';
  if (p.forma === 'cilindro') {
    tipo = 'cilindro';
    g = new T.CylinderGeometry(1, 1, p[DIM[p.eje]], 48, 1);
    if (p.eje === 'y') g.scale(p.w / 2, 1, p.d / 2);
    if (p.eje === 'x') { g.rotateZ(Math.PI / 2); g.scale(1, p.h / 2, p.d / 2); }
    if (p.eje === 'z') { g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.h / 2, 1); }
  } else if (tieneContorno(p)) {
    tipo = 'perfil'; g = geomPerfil(p);
  } else {
    const r = Math.min(p.canto / 10, Math.min(p.w, p.h, p.d) / 2 - .001);
    g = r > .02 ? new T.RoundedBoxGeometry(p.w, p.h, p.d, 3, r) : new T.BoxGeometry(p.w, p.h, p.d);
  }
  asignarUVs(g, p, tipo);
  return { g, tipo };
}
function geomPerfil(p) {
  const V = TIPOS[p.plano], c = p.contorno;
  const A = p[DIM[V.h]], B = p[DIM[V.v]], E = p[DIM[V.prof]];
  const ka = A / (c.cw || 1), kb = B / (c.ch || 1);
  const f = ([u, v]) => new T.Vector2(u * ka, V.vs > 0 ? v * kb : B - v * kb);
  const forma = new T.Shape(c.ext.map(f));
  (c.huecos || []).forEach(h => forma.holes.push(new T.Path(h.map(f))));
  const r = Math.max(0, Math.min(p.canto / 10, E / 2 - .01, A / 6, B / 6));
  const bisel = r > .02;
  const g = new T.ExtrudeGeometry(forma, { depth: Math.max(.01, E - (bisel ? 2 * r : 0)), bevelEnabled: bisel, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: 3, curveSegments: 6 });
  if (bisel) g.translate(0, 0, r);
  // (s, t, e) → ejes de la vista; si la permutación invierte, se da la vuelta a e
  const col = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
  const m = new T.Matrix4().makeBasis(col[V.h], col[V.v], col[V.prof]);
  if (m.determinant() < 0) { m.makeBasis(col[V.h], col[V.v], col[V.prof].clone().negate()); m.setPosition(col[V.prof].clone().multiplyScalar(E)); }
  g.applyMatrix4(m);
  g.translate(-p.w / 2, -p.h / 2, -p.d / 2);
  return T.toCreasedNormals(g, Math.PI / 5);
}
function asignarUVs(g, p, tipo) {
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const uv = new Float32Array(n * 2), ve = 'xyz'.indexOf(ejeVeta(p)), th = 'xyz'.indexOf(ejeGrosor(p));
  const mc = material(p).userData, ca = cantoInfo(p);
  const ox = hashNum(p.id) * mc.cm, oy = hashNum(p.id + 'y') * mc.cmV;
  // eje de la cara de cada vértice (según el grupo de la geometría)
  const ejeV = new Int8Array(n).fill(-1);
  if (tipo === 'caja') { const idx = g.index; for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) ejeV[idx ? idx.getX(i) : i] = gr.materialIndex >> 1; }
  if (tipo === 'perfil') for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) ejeV[i] = gr.materialIndex === 0 ? th : -2;
  const dim = [p.w, p.h, p.d];
  for (let i = 0; i < n; i++) {
    const P3 = [pos.getX(i) + p.w / 2, pos.getY(i) + p.h / 2, pos.getZ(i) + p.d / 2];
    const N3 = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    let u, v, cm = mc.cm, cmV = mc.cmV, oX = ox, oY = oy;
    if (tipo === 'cilindro') {
      const otros = [0, 1, 2].filter(k => k !== ve);
      const a = P3[otros[0]] - dim[otros[0]] / 2, b = P3[otros[1]] - dim[otros[1]] / 2;
      const rad = (dim[otros[0]] + dim[otros[1]]) / 4;
      u = P3[ve]; v = (Math.atan2(b, a) + Math.PI) * rad;
      if (N3[ve] > .9) { u = P3[otros[0]]; v = P3[otros[1]] * 3; }
    } else {
      let k = ejeV[i];
      if (k === -1) k = N3[0] >= N3[1] && N3[0] >= N3[2] ? 0 : N3[1] >= N3[2] ? 1 : 2;
      if (k === -2) { const c2 = [0, 1, 2].filter(e => e !== th); k = N3[c2[0]] >= N3[c2[1]] ? c2[0] : c2[1]; }
      const plano = [0, 1, 2].filter(e => e !== k);
      const modo = k === th ? 'macizo' : ca.modo;
      if (modo === 'macizo') {
        if (plano.includes(ve)) { u = P3[ve]; v = P3[plano.find(e => e !== ve)]; }
        else { u = P3[plano[0]]; v = P3[plano[1]] * 3; } // testa: anillos apretados
      } else {
        const largo = plano.find(e => e !== th) ?? plano[0];
        u = P3[largo]; v = P3[th]; cm = ca.cm; cmV = ca.cmV;
        if (modo === 'alma') { oX = hashNum(p.id + 'a') * cm; oY = 0; }
      }
    }
    uv[i * 2] = (u + oX) / cm; uv[i * 2 + 1] = (v + oY) / cmV;
  }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
}
function materialesDe(p, tipo) {
  if (tipo === 'cilindro') return material(p);
  const cara = material(p), canto = cantoInfo(p).mat;
  if (tipo === 'perfil') return [cara, canto];
  const th = 'xyz'.indexOf(ejeGrosor(p));
  return [0, 1, 2, 3, 4, 5].map(i => (i >> 1) === th ? cara : canto);
}

const mallas = new Map();
function sincronizar3D() {
  for (const m of mallas.values()) { grupoPiezas.remove(m); m.geometry.dispose(); }
  mallas.clear();
  for (const p of P.piezas) {
    if (!p.visible) continue;
    let r;
    try { r = geometria(p); } catch (e) { console.error('Geometría', p.nombre, e); continue; }
    const m = new T.Mesh(r.g, materialesDe(p, r.tipo));
    m.userData.c = new T.Vector3(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2);
    m.position.copy(m.userData.c);
    m.castShadow = m.receiveShadow = true; m.userData.id = p.id;
    grupoPiezas.add(m); mallas.set(p.id, m);
  }
  aplicarPoses(); colocarLuces(); decorado(); render3D();
}

/* ---------- abrir puertas y cajones · vista explosionada ---------- */
function aplicarPoses() {
  const ab = P.vista.abrir || 0, ex = P.vista.explosion || 0;
  const C = radioEscena(true).c, giros = {};
  for (const [g, G] of Object.entries(P.grupos)) {
    const mov = G.mov; if (!mov || !mov.tipo || mov.tipo === 'ninguno' || ab <= 0) continue;
    const M = piezasGrupo(g).filter(q => q.visible); if (!M.length) continue;
    if (mov.tipo === 'cajon') { giros[g] = { t: new T.Vector3(0, 0, (mov.valor || 0) * ab) }; continue; }
    const f = frenteDe(M), a = T.MathUtils.degToRad(mov.valor || 90) * ab;
    const def = { izq: [[0, 1, 0], [f.x, 0, f.z], -a], der: [[0, 1, 0], [f.x + f.w, 0, f.z], a], arriba: [[1, 0, 0], [0, f.y + f.h, f.z], -a], abajo: [[1, 0, 0], [0, f.y, f.z], a] }[mov.tipo];
    if (!def) continue;
    giros[g] = { q: new T.Quaternion().setFromAxisAngle(new T.Vector3(...def[0]), def[2]), piv: new T.Vector3(...def[1]) };
  }
  let minY = Infinity;
  for (const m of mallas.values()) {
    const p = pieza(m.userData.id); if (!p) continue;
    const c = m.userData.c.clone(), G = p.grupo && giros[p.grupo];
    m.quaternion.identity();
    if (G && G.t) c.add(G.t);
    if (G && G.q) { c.sub(G.piv).applyQuaternion(G.q).add(G.piv); m.quaternion.copy(G.q); }
    if (ex > 0) c.add(m.userData.c.clone().sub(C).multiplyScalar(ex * .9));
    m.position.copy(c);
    minY = Math.min(minY, c.y - p.h / 2);
  }
  if (ex > 0 && minY < 0) for (const m of mallas.values()) m.position.y -= minY; // que nada atraviese el suelo
  marcar3D();
}
function marcar3D() {
  for (const o of grupoAyudas.children) o.geometry.dispose();
  grupoAyudas.clear();
  const mat = new T.LineBasicMaterial({ color: 0x2f86ff, depthTest: false, transparent: true, opacity: .9 });
  for (const id of sel) {
    const m = mallas.get(id); if (!m) continue;
    const e = new T.LineSegments(new T.EdgesGeometry(m.geometry, 30), mat);
    e.position.copy(m.position); e.quaternion.copy(m.quaternion); e.renderOrder = 10; grupoAyudas.add(e);
  }
  render3D();
}
let animando = null;
function animarVista(clave, objetivo, dur) {
  if (animando) cancelAnimationFrame(animando.raf);
  const ini = P.vista[clave] || 0, t0 = performance.now(), D = dur || 1100;
  // al explosionar, la cámara se aleja a la vez para que todo siga en el encuadre
  const d0 = camara.position.distanceTo(controles.target), kz = v => 1 + (clave === 'explosion' ? .6 : .15) * v;
  const paso = () => {
    const t = Math.min(1, (performance.now() - t0) / D), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    P.vista[clave] = ini + (objetivo - ini) * e;
    const dir = camara.position.clone().sub(controles.target).normalize();
    camara.position.copy(controles.target).addScaledVector(dir, d0 * kz(P.vista[clave]) / kz(ini));
    $(clave === 'abrir' ? '#rAbrir' : '#rExplosion').value = P.vista[clave];
    aplicarPoses(); colocarLuces();
    if (t < 1) animando = { raf: requestAnimationFrame(paso) }; else { animando = null; guardarLocalPronto(); }
  };
  paso();
}
$('#rAbrir').addEventListener('input', e => { P.vista.abrir = parseFloat(e.target.value); aplicarPoses(); guardarLocalPronto(); });
$('#rExplosion').addEventListener('input', e => { P.vista.explosion = parseFloat(e.target.value); aplicarPoses(); colocarLuces(); guardarLocalPronto(); });
$('#bAnimAbrir').onclick = () => {
  if (!Object.values(P.grupos).some(G => G.mov && G.mov.tipo && G.mov.tipo !== 'ninguno')) return aviso('Ningún grupo tiene movimiento: usa 🗄 Cajón, 🚪 Bisagras o «Movimiento» del grupo');
  animarVista('abrir', P.vista.abrir > .5 ? 0 : 1);
};
$('#bAnimExpl').onclick = () => animarVista('explosion', P.vista.explosion > .5 ? 0 : 1, 1400);

function radioEscena(sinExpl) {
  const b = bbox();
  const r = Math.max(20, Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) / 2);
  const k = sinExpl ? 1 : 1 + (P.vista.explosion || 0) * 1.1 + (P.vista.abrir || 0) * .35;
  return { c: new T.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2), r: r * k, b };
}
function dirLuz(az, alt) {
  const a = T.MathUtils.degToRad(az), e = T.MathUtils.degToRad(alt);
  return new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}
function ajustarSombra(luz, c, r, dir) {
  luz.target.position.copy(c);
  luz.position.copy(c).addScaledVector(dir, r * 4);
  const s = luz.shadow.camera, k = r * 1.9;
  s.left = -k; s.right = k; s.top = k; s.bottom = -k; s.near = r * .5; s.far = r * 8; s.updateProjectionMatrix();
}
function colocarLuces() {
  const E = P.escena, { c, r } = radioEscena();
  ajustarSombra(luzPrincipal, c, r, dirLuz(E.azimut, E.altura));
  luzPrincipal.intensity = E.intens * 1.25;
  luzPrincipal.shadow.radius = 1 + E.suave * 6;
  renderer.toneMappingExposure = E.expo;
  escena.environmentIntensity = E.amb;
  render3D();
}
function fondoTextura(hex) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 256; const x = c.getContext('2d');
  const col = new T.Color(hex), hsl = {}; col.getHSL(hsl);
  const claro = new T.Color().setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + .04)), osc = new T.Color().setHSL(hsl.h, hsl.s, Math.max(0, hsl.l - .1));
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + osc.getHexString()); g.addColorStop(.55, '#' + claro.getHexString()); g.addColorStop(1, '#' + col.getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const FONDOS = { blanco: '#efeeea', gris: '#b9bbbd', oscuro: '#2a2d31', salon: '#d9d4cc' };
function decorado() {
  const E = P.escena, { c, b } = radioEscena(true), r = radioEscena().r;
  for (const o of grupoDecorado.children) if (o !== sombraSuelo && o !== contacto) o.geometry.dispose();
  grupoDecorado.clear();
  if (escena.background && escena.background.dispose) escena.background.dispose();
  escena.background = fondoTextura(E.fondo);
  sombraSuelo.scale.set(r * 14, r * 14, 1); sombraSuelo.position.set(c.x, 0, c.z);
  sombraSuelo.material.opacity = E.escenario === 'oscuro' ? .55 : .32;
  const fx = (b.x1 - b.x0) + 14, fz = (b.z1 - b.z0) + 14;
  contacto.scale.set(fx * 1.25, fz * 1.25, 1); contacto.position.set(c.x, .05, c.z);
  contacto.material.opacity = E.escenario === 'oscuro' ? .9 : .65;
  contacto.visible = !(P.vista.explosion > .05);
  if (E.escenario === 'salon') {
    const tp = textura(window.TEXTURAS.parquet, '_parquet'), tw = textura(window.TEXTURAS.pared, '_pared');
    const L = r * 16;
    const gs = new T.PlaneGeometry(L, L); escalarUV(gs, L / 160);
    const suelo = new T.Mesh(gs, new T.MeshPhysicalMaterial({ map: tp, roughness: .45, clearcoat: .3, clearcoatRoughness: .2 }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.set(c.x, 0, c.z); suelo.receiveShadow = true;
    const gp = new T.PlaneGeometry(L, 400); escalarUV(gp, L / 160, 400 / 160);
    const pared = new T.Mesh(gp, new T.MeshStandardMaterial({ map: tw, roughness: .95 }));
    pared.position.set(c.x, 200, b.z0 - 12); pared.receiveShadow = true;
    const rod = new T.Mesh(new T.BoxGeometry(L, 8, 1.4), new T.MeshStandardMaterial({ color: 0xf4f2ee, roughness: .6 }));
    rod.position.set(c.x, 4, b.z0 - 11.3); rod.castShadow = rod.receiveShadow = true;
    grupoDecorado.add(suelo, pared, rod);
  } else grupoDecorado.add(sombraSuelo, contacto);
}
function escalarUV(g, ku, kv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ku, uv.getY(i) * (kv || ku)); }

function encuadrar3D(dirVista) {
  const { c, r } = radioEscena();
  const dir = dirVista || camara.position.clone().sub(controles.target).normalize();
  const dist = r / Math.sin(T.MathUtils.degToRad(camara.fov / 2)) * 1.12;
  controles.target.copy(c); camara.position.copy(c).addScaledVector(dir, dist);
  camara.near = Math.max(.5, dist / 100); camara.far = dist * 40; camara.updateProjectionMatrix();
  controles.update(); render3D();
}
$$('[data-cam]').forEach(b => b.onclick = () => {
  const d = { frente: [0, .08, 1], izq: [-.75, .45, .9], der: [.8, .45, .9], arriba: [0, 1, .04] }[b.dataset.cam];
  encuadrar3D(new T.Vector3(...d).normalize());
});
function lente() { camara.fov = 2 * T.MathUtils.radToDeg(Math.atan(24 / 2 / P.escena.lente)); camara.updateProjectionMatrix(); }
function ajustar3D() {
  const r = $('#v3d').getBoundingClientRect(); if (r.width < 2) return;
  renderer.setSize(r.width, r.height, false); camara.aspect = r.width / r.height; camara.updateProjectionMatrix(); render3D();
}
let pend3D = false;
function render3D() { pend3D = true; }
(function bucle() {
  requestAnimationFrame(bucle);
  if (renderFinalActivo) return;
  if (controles.update() || pend3D) { pend3D = false; renderer.render(escena, camara); }
})();
controles.addEventListener('change', () => { render3D(); guardarCamaraPronto(); });
let tCam;
function guardarCamaraPronto() { clearTimeout(tCam); tCam = setTimeout(() => { P.camara = { p: camara.position.toArray(), t: controles.target.toArray() }; guardarLocal(); }, 600); }
(function () { // seleccionar en 3D con un clic (Mayús/Ctrl: añadir; Alt: solo la pieza, sin su grupo)
  let ini = null; const ray = new T.Raycaster();
  c3d.addEventListener('pointerdown', e => ini = [e.clientX, e.clientY]);
  c3d.addEventListener('pointerup', e => {
    if (!ini || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) > 4) return;
    const r = c3d.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camara);
    const hit = ray.intersectObjects(grupoPiezas.children, false)[0];
    const mod = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!hit) { if (!mod) seleccionar(null); return; }
    seleccionar(hit.object.userData.id, { alternar: mod, grupo: !e.altKey });
  });
  c3d.addEventListener('dblclick', e => {
    const r = c3d.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camara);
    const hit = ray.intersectObjects(grupoPiezas.children, false)[0];
    if (hit) seleccionar(hit.object.userData.id, { grupo: false });
  });
})();

/* ===================== ESCENA (controles) ===================== */
const ESC = { eEscenario: 'escenario', eFondo: 'fondo', eAzimut: 'azimut', eAltura: 'altura', eSuave: 'suave', eIntens: 'intens', eAmb: 'amb', eExpo: 'expo', eLente: 'lente', eDof: 'dof' };
for (const [id, k] of Object.entries(ESC)) {
  $('#' + id).addEventListener('input', e => {
    let v = e.target.value; if (k !== 'escenario' && k !== 'fondo') v = parseFloat(v);
    P.escena[k] = v;
    if (k === 'escenario') { P.escena.fondo = FONDOS[v]; $('#eFondo').value = FONDOS[v]; if (v === 'oscuro') { P.escena.expo = 1.15; $('#eExpo').value = 1.15; } }
    if (k === 'lente') { lente(); encuadrar3D(); }
    if (k === 'dof' && v > 0) aviso('El desenfoque se ve en el render final. Sube la calidad para que quede suave.');
    colocarLuces(); decorado(); render3D(); guardarLocalPronto();
  });
}
function pintarEscena() {
  for (const [id, k] of Object.entries(ESC)) $('#' + id).value = P.escena[k];
  $('#rAbrir').value = P.vista.abrir || 0; $('#rExplosion').value = P.vista.explosion || 0; lente();
}

/* ===================== RENDER FINAL ===================== */
$('#bRender').onclick = () => {
  if (!P.piezas.some(p => p.visible)) return aviso('No hay piezas que renderizar');
  const r = $('#v3d').getBoundingClientRect(), asp = r.width / r.height;
  modal('Render final', formulario([
    { id: 'tam', et: 'Tamaño', v: '1920', sel: [['1280', 'Rápido · 1280 px'], ['1920', 'Full HD · 1920 px'], ['2560', '2560 px'], ['3840', '4K · 3840 px']] },
    { id: 'form', et: 'Proporción', v: 'vista', sel: [['vista', 'Igual que la vista 3D'], ['1.5', '3:2 horizontal'], ['1.7778', '16:9 horizontal'], ['1', 'Cuadrada'], ['0.8', '4:5 vertical']] },
    { id: 'q', et: 'Calidad (pasadas)', v: P.escena.dof > 0 ? '200' : '96', sel: [['32', 'Borrador · 32'], ['96', 'Buena · 96'], ['200', 'Alta · 200'], ['400', 'Máxima · 400']] },
    { id: 'dof', et: 'Desenfoque de fondo', v: String(P.escena.dof || 0), sel: [['0', 'No'], ['8', 'Suave (f/8)'], ['4', 'Medio (f/4)'], ['2.8', 'Marcado (f/2,8)'], ['1.4', 'Muy marcado (f/1,4)']] }]) +
    `<p class="nota">Cada pasada mueve un poco la luz y la cámara y se promedian: así salen sombras suaves, oclusión en las juntas y bordes sin dientes. Con desenfoque, la cámara se mueve dentro de la «apertura» del objetivo y se enfoca el centro del mueble. Se usa el encuadre de la vista 3D, con puertas y explosión tal como estén.</p>`, [
    { txt: 'Cancelar' },
    { txt: 'Renderizar', primario: true, fn: () => {
      const w = parseInt(fv('tam')), f = fv('form') === 'vista' ? asp : parseFloat(fv('form')), q = parseInt(fv('q'));
      P.escena.dof = parseFloat(fv('dof')); $('#eDof').value = P.escena.dof; guardarLocalPronto();
      setTimeout(() => renderFinal(w, Math.round(w / f), q), 30);
    } }]);
};

async function renderFinal(W, H, N) {
  let cancelar = false;
  modal('Renderizando…', `<div class="progreso"><div id="barra"></div></div><p class="nota" id="txtProg">Preparando…</p>`, [{ txt: 'Cancelar', fn: () => { cancelar = true; } }]);
  renderFinalActivo = true;
  const t0 = performance.now();
  const cv = document.createElement('canvas');
  const r2 = new T.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
  try {
    r2.setPixelRatio(1); r2.setSize(W, H, false);
    r2.toneMapping = renderer.toneMapping; r2.toneMappingExposure = renderer.toneMappingExposure; r2.outputColorSpace = T.SRGBColorSpace;
    r2.shadowMap.enabled = true; r2.shadowMap.type = T.PCFShadowMap;
    const pm2 = new T.PMREMGenerator(r2), env2 = pm2.fromScene(new T.RoomEnvironment(), .04).texture;
    const cam = camara.clone(); cam.aspect = W / H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const tipo = r2.extensions.has('EXT_color_buffer_float') ? T.HalfFloatType : T.UnsignedByteType;
    const rtS = new T.WebGLRenderTarget(W, H, { type: tipo, samples: 4 });
    const rtA = new T.WebGLRenderTarget(W, H, { type: tipo });
    const ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mq = new T.MeshBasicMaterial({ map: rtS.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mq), escQ = new T.Scene(); escQ.add(quad);
    const envAnt = escena.environment, intAnt = escena.environmentIntensity, mapAnt = luzPrincipal.shadow.mapSize.x, radAnt = luzPrincipal.shadow.radius;
    escena.environment = env2; grupoAyudas.visible = false; contacto.visible = false;
    luzPrincipal.shadow.mapSize.set(4096, 4096); luzPrincipal.shadow.map && luzPrincipal.shadow.map.dispose(); luzPrincipal.shadow.map = null;
    luzPrincipal.shadow.radius = 1.5;
    const E = P.escena, { c, r } = radioEscena(), base = dirLuz(E.azimut, E.altura);
    const amb = E.amb;
    escena.environmentIntensity = amb * .35;
    luzCielo.intensity = 0; sombraSuelo.material.opacity = E.escenario === 'oscuro' ? .6 : .42;
    const ang = .03 + E.suave * .28;
    const t1 = new T.Vector3(), t2 = new T.Vector3();
    t1.crossVectors(base, new T.Vector3(0, 1, 0)).normalize(); if (t1.lengthSq() < .1) t1.set(1, 0, 0); t2.crossVectors(base, t1).normalize();
    // profundidad de campo: apertura = focal / número f (en cm), enfoque en el centro del encuadre
    const posBase = cam.position.clone(), foco = controles.target.clone();
    const derCam = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), arrCam = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const radioAp = E.dof > 0 ? (E.lente / E.dof) / 10 / 2 : 0;
    for (let i = 0; i < N && !cancelar; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * ang;
      ajustarSombra(luzPrincipal, c, r, base.clone().addScaledVector(t1, Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr).normalize());
      const u1 = Math.random(), u2 = Math.random(), sr = Math.sqrt(u1);
      const ds = new T.Vector3(sr * Math.cos(2 * Math.PI * u2), Math.sqrt(1 - u1), sr * Math.sin(2 * Math.PI * u2));
      if (ds.y < .08) ds.y = .08; ds.normalize();
      ajustarSombra(luzCielo, c, r, ds); luzCielo.intensity = amb * 1.6;
      if (radioAp > 0) {
        const aa = Math.random() * Math.PI * 2, ra = Math.sqrt(Math.random()) * radioAp;
        cam.position.copy(posBase).addScaledVector(derCam, Math.cos(aa) * ra).addScaledVector(arrCam, Math.sin(aa) * ra);
        cam.lookAt(foco); cam.updateMatrixWorld();
      }
      cam.setViewOffset(W, H, Math.random() - .5, Math.random() - .5, W, H);
      r2.setRenderTarget(rtS); r2.clear(); r2.render(escena, cam);
      r2.setRenderTarget(rtA); r2.autoClear = false;
      if (i === 0) r2.clear();
      mq.opacity = 1 / (i + 1); r2.render(escQ, ortho); r2.autoClear = true;
      if (i % 2 === 1 || i === N - 1) {
        const pct = (i + 1) / N, t = (performance.now() - t0) / 1000;
        $('#barra').style.width = (pct * 100) + '%';
        $('#txtProg').textContent = `Pasada ${i + 1} de ${N} · quedan ~${Math.max(0, Math.round(t / pct - t))} s`;
        await new Promise(res => setTimeout(res, 0));
      }
    }
    escena.environment = envAnt; escena.environmentIntensity = intAnt; grupoAyudas.visible = true;
    luzCielo.intensity = 0; luzPrincipal.shadow.mapSize.set(mapAnt, mapAnt); luzPrincipal.shadow.radius = radAnt;
    luzPrincipal.shadow.map && luzPrincipal.shadow.map.dispose(); luzPrincipal.shadow.map = null;
    colocarLuces(); decorado();
    if (cancelar) { aviso('Render cancelado'); return; }
    mq.map = rtA.texture; mq.opacity = 1; mq.transparent = false; mq.toneMapped = true; mq.needsUpdate = true;
    r2.setRenderTarget(null); r2.render(escQ, ortho);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const url = URL.createObjectURL(blob), seg = ((performance.now() - t0) / 1000).toFixed(0);
    const nombre = (P.nombre || 'render').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]/g, '') + `_${W}x${H}.png`;
    modal(`Render terminado · ${W} × ${H} px · ${seg} s`, `<img class="render" src="${url}" alt="Render">`, [
      { txt: 'Cerrar' }, { txt: '💾 Guardar PNG', primario: true, mantener: true, fn: () => descargar(nombre, blob) }]);
    rtS.dispose(); rtA.dispose(); env2.dispose(); pm2.dispose();
  } catch (err) {
    console.error(err); cerrarModal(); aviso('Error en el render: ' + err.message);
  } finally {
    r2.dispose(); r2.forceContextLoss && r2.forceContextLoss();
    renderFinalActivo = false; render3D();
  }
}

/* ===================== LÁMINA TÉCNICA (PDF / DXF) Y EXPORTACIÓN AL ANIDADOR ===================== */

/* ---------- geometría de las vistas con aristas ocultas ---------- */
function anillosVista(T, p) { // contornos de la pieza vista desde T, en coordenadas de mundo (a, b)
  const Tp = TIPOS[p.plano];
  if (tieneContorno(p) && Tp.h === T.h && Tp.v === T.v) { const cm = contornoMundo(p); return { anillos: [cm.ext, ...cm.huecos], ocl: cm.ext }; }
  const r = rectVista(T, p);
  if (p.forma === 'cilindro' && p.eje === T.prof) {
    const ca = (r.a0 + r.a1) / 2, cb = (r.b0 + r.b1) / 2, ra = (r.a1 - r.a0) / 2, rb = (r.b1 - r.b0) / 2, L = [];
    for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; L.push([ca + ra * Math.cos(t), cb + rb * Math.sin(t)]); }
    return { anillos: [L], ocl: L };
  }
  const L = [[r.a0, r.b0], [r.a1, r.b0], [r.a1, r.b1], [r.a0, r.b1]];
  return { anillos: [L], ocl: L };
}
function cercania(T, p) { return T.frente > 0 ? p[T.prof] + p[DIM[T.prof]] : -p[T.prof]; }
function distBorde(pt, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i], dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / l2));
    m = Math.min(m, Math.hypot(pt[0] - x1 - t * dx, pt[1] - y1 - t * dy));
  }
  return m;
}
function tramosDentro(A, B, poly, eps) { // intervalos [t0,t1] del segmento AB estrictamente dentro del polígono
  const ts = [0, 1], dx = B[0] - A[0], dy = B[1] - A[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((x1 - A[0]) * ey - (y1 - A[1]) * ex) / den, u = ((x1 - A[0]) * dy - (y1 - A[1]) * dx) / den;
    if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < ts.length; k++) {
    const a = ts[k], b = ts[k + 1]; if (b - a < 1e-6) continue;
    const m = [A[0] + dx * (a + b) / 2, A[1] + dy * (a + b) / 2];
    if (puntoEnPoly(m, poly) && distBorde(m, poly) > eps) {
      if (out.length && Math.abs(out[out.length - 1][1] - a) < 1e-9) out[out.length - 1][1] = b; else out.push([a, b]);
    }
  }
  return out;
}
function unirIntervalos(L) {
  L.sort((a, b) => a[0] - b[0]); const out = [];
  for (const i of L) { if (out.length && i[0] <= out[out.length - 1][1] + 1e-9) out[out.length - 1][1] = Math.max(out[out.length - 1][1], i[1]); else out.push(i.slice()); }
  return out;
}
// segmentos visibles y ocultos de una vista (en mundo)
function aristasVista(T) {
  const piezas = P.piezas.filter(p => p.visible).map(p => Object.assign({ p, c: cercania(T, p) }, anillosVista(T, p)));
  const vis = [], ocu = [];
  for (const P1 of piezas) {
    const delante = piezas.filter(Q => Q !== P1 && Q.c > P1.c + .01);
    for (const an of P1.anillos) for (let i = 0; i < an.length; i++) {
      const A = an[i], B = an[(i + 1) % an.length];
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 1e-6) continue;
      let tapados = [];
      for (const Q of delante) tapados.push(...tramosDentro(A, B, Q.ocl, .02));
      tapados = unirIntervalos(tapados);
      let t = 0; const pt = s => [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s];
      for (const [t0, t1] of tapados) { if (t0 > t + 1e-6) vis.push([pt(t), pt(t0)]); ocu.push([pt(t0), pt(t1)]); t = t1; }
      if (t < 1 - 1e-6) vis.push([pt(t), pt(1)]);
    }
  }
  return { vis, ocu };
}

/* ---------- construcción de la lámina (primitivas en mm de papel, y hacia arriba) ---------- */
const FORMATOS = { A4: [297, 210], A3: [420, 297] };
const ESCALAS = [1, 2, 5, 10, 15, 20, 25, 50, 75, 100];
function cfgLaminaDefecto() {
  return { formato: 'A4', sistema: 'E', vistas: { alzado: true, planta: true, perfil: true, posterior: false, hormiga: false, perfilDer: false },
    persp: true, escala: 'auto', cotas: 'generales', ocultas: true, nombres: true,
    titulo: '', autor: '', centro: '', hoja: '1', fecha: new Date().toLocaleDateString('es-ES'), logo: null };
}
const POSICIONES = {
  E: { alzado: [0, 0], perfil: [1, 0], perfilDer: [-1, 0], posterior: [2, 0], planta: [0, 1], hormiga: [0, -1] },
  A: { alzado: [0, 0], perfil: [-1, 0], perfilDer: [1, 0], posterior: [2, 0], planta: [0, -1], hormiga: [0, 1] },
};
function fmtMM(v) { const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ','); }

function construirLamina(cfg, modo, imgPersp) {
  const real = modo === 'real';
  const [Wh, Hh] = FORMATOS[cfg.formato] || FORMATOS.A4;
  const b = bbox(), ext = { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, lim = { x: [b.x0, b.x1], y: [b.y0, b.y1], z: [b.z0, b.z1] };
  const tipos = Object.keys(TIPOS).filter(t => cfg.vistas[t]);
  if (!tipos.length) tipos.push('alzado');
  const pos = POSICIONES[cfg.sistema] || POSICIONES.E;
  const cols = {}, filas = {};
  tipos.forEach(t => { const [c, f] = pos[t]; cols[c] = Math.max(cols[c] || 0, ext[TIPOS[t].h]); filas[f] = Math.max(filas[f] || 0, ext[TIPOS[t].v]); });
  // perspectiva: celda libre a la derecha, en la fila de la planta (europeo) o de la hormiga (americano)
  const conPersp = cfg.persp && imgPersp && !real;
  let cP = null;
  if (conPersp) {
    const fp = cfg.sistema === 'A' ? -1 : 1, cMax = Math.max(...Object.keys(cols).map(Number));
    let c = 1; while (tipos.some(t => pos[t][0] === c && pos[t][1] === fp)) c++;
    cP = [Math.min(c, cMax + 1), fp];
  }
  const cotasG = cfg.cotas !== 'no', parc = cfg.cotas === 'parciales';
  const sep = u => ((cotasG ? 12 : 7) + (parc ? 7 : 0) + (cfg.nombres ? 4 : 0)) * u;
  // escala
  const marco = { x0: 20, y0: 10, x1: Wh - 10, y1: Hh - 10 }, caj = { w: 180, h: 32 };
  const area = { x0: marco.x0 + 6, y0: marco.y0 + caj.h + 6, x1: marco.x1 - 6, y1: marco.y1 - 6 };
  const areaIzq = { x0: marco.x0 + 6, y0: marco.y0 + 6, x1: marco.x1 - caj.w - 6, y1: marco.y1 - 6 }; // a la izquierda del cajetín, toda la altura
  const cabe = (m, a) => m.W <= a.x1 - a.x0 && m.H <= a.y1 - a.y0;
  const medir = (k, u) => {
    const cK = Object.keys(cols).map(Number), fK = Object.keys(filas).map(Number);
    const anchoC = c => c in cols ? cols[c] * k : (cP && cP[0] === c ? 0 : 0), altoF = f => f in filas ? filas[f] * k : 0;
    const cAll = [...new Set([...cK, ...(cP ? [cP[0]] : [])])].sort((a, b) => a - b), fAll = [...new Set([...fK, ...(cP ? [cP[1]] : [])])].sort((a, b) => a - b);
    const pw = cP ? Math.max(anchoC(cP[0]), 60 * u) : 0, ph = cP ? Math.max(altoF(cP[1]), 40 * u) : 0;
    const anchos = cAll.map(c => cP && c === cP[0] ? Math.max(anchoC(c), pw) : anchoC(c)), altos = fAll.map(f => cP && f === cP[1] ? Math.max(altoF(f), ph) : altoF(f));
    const s = sep(u);
    return { cAll, fAll, anchos, altos, W: anchos.reduce((a, v) => a + v, 0) + s * cAll.length, H: altos.reduce((a, v) => a + v, 0) + s * fAll.length };
  };
  let den = cfg.escala !== 'auto' ? parseFloat(cfg.escala) : null;
  if (!den) { den = ESCALAS[ESCALAS.length - 1]; for (const e of ESCALAS) { const m = medir(10 / e, 1); if (cabe(m, area) || cabe(m, areaIzq)) { den = e; break; } } }
  const u = real ? den : 1, k = real ? 10 : 10 / den;
  const M = medir(k, u), s = sep(u);
  // origen de la composición
  const W = real ? M.W : Wh, H = real ? M.H + 20 * u : Hh;
  const A2 = cabe(M, area) || !cabe(M, areaIzq) ? area : areaIzq;
  let ox = real ? 0 : A2.x0 + Math.max(0, (A2.x1 - A2.x0 - M.W) / 2), oyTop = real ? M.H : A2.y1 - Math.max(0, (A2.y1 - A2.y0 - M.H) / 2);
  const celdaX = {}, celdaY = {}; // esquina inferior izquierda de cada celda (dejando el hueco de cotas a la derecha y abajo)
  let x = ox; M.cAll.forEach((c, i) => { celdaX[c] = { x, w: M.anchos[i] }; x += M.anchos[i] + s; });
  let y = oyTop; M.fAll.forEach((f, i) => { y -= M.altos[i]; celdaY[f] = { y, h: M.altos[i] }; y -= s; });
  const prims = [];
  const L = (x1, y1, x2, y2, c) => prims.push({ t: 'l', x1, y1, x2, y2, c });
  const TX = (x, y, s2, h, o) => prims.push(Object.assign({ t: 'txt', x, y, s: s2, h, al: 'l', ang: 0, c: 'txt' }, o || {}));
  const flecha = (x, y, dx, dy, c) => { const l = 2.5 * u, w = .55 * u, px = -dy, py = dx; prims.push({ t: 'tri', pts: [[x, y], [x - dx * l + px * w, y - dy * l + py * w], [x - dx * l - px * w, y - dy * l - py * w]], c }); };
  const cotaH = (xa, xb, yObj, yCota, valor) => { // cota horizontal: yObj altura del objeto, yCota de la línea de cota
    const sg = yCota < yObj ? -1 : 1;
    L(xa, yObj + sg * 1 * u, xa, yCota + sg * 2 * u, 'cota'); L(xb, yObj + sg * 1 * u, xb, yCota + sg * 2 * u, 'cota');
    L(xa, yCota, xb, yCota, 'cota'); flecha(xa, yCota, -1, 0, 'cota'); flecha(xb, yCota, 1, 0, 'cota');
    TX((xa + xb) / 2, yCota + 1 * u, fmtMM(valor), 2.5 * u, { al: 'c', c: 'cota' });
  };
  const cotaV = (ya, yb, xObj, xCota, valor) => {
    const sg = xCota < xObj ? -1 : 1;
    L(xObj + sg * 1 * u, ya, xCota + sg * 2 * u, ya, 'cota'); L(xObj + sg * 1 * u, yb, xCota + sg * 2 * u, yb, 'cota');
    L(xCota, ya, xCota, yb, 'cota'); flecha(xCota, ya, 0, -1, 'cota'); flecha(xCota, yb, 0, 1, 'cota');
    TX(xCota - 1 * u, (ya + yb) / 2, fmtMM(valor), 2.5 * u, { al: 'c', ang: 90, c: 'cota' });
  };
  for (const t of tipos) {
    const T = TIPOS[t], [c, f] = pos[t], cx = celdaX[c], cy = celdaY[f];
    const wv = ext[T.h] * k, hv = ext[T.v] * k;
    const x0 = cx.x + (cx.w - wv) / 2, y0 = cy.y + (cy.h - hv) / 2;
    const [a0, a1] = lim[T.h], [b0, b1] = lim[T.v];
    const mp = ([a, b2]) => [x0 + (T.hs > 0 ? a - a0 : a1 - a) * k, y0 + (T.vs > 0 ? b2 - b0 : b1 - b2) * k];
    const ar = aristasVista(T);
    for (const [A, B] of ar.vis) { const p1 = mp(A), p2 = mp(B); L(p1[0], p1[1], p2[0], p2[1], 'vis'); }
    if (cfg.ocultas) for (const [A, B] of ar.ocu) { const p1 = mp(A), p2 = mp(B); L(p1[0], p1[1], p2[0], p2[1], 'ocu'); }
    if (cfg.nombres) TX(x0 + wv / 2, y0 + hv + 3 * u, T.nombre.toUpperCase(), 2.5 * u, { al: 'c', c: 'nom' });
    if (cotasG) {
      const dy0 = y0 - (parc ? 14 : 8) * u, dx0 = x0 + wv + (parc ? 14 : 8) * u;
      cotaH(x0, x0 + wv, y0, dy0, ext[T.h] * 10); cotaV(y0, y0 + hv, x0 + wv, dx0, ext[T.v] * 10);
      if (parc) { // cadenas con los cantos visibles
        const xs = [], ys = [];
        for (const [A, B] of ar.vis) { const p1 = mp(A), p2 = mp(B); if (Math.abs(p1[0] - p2[0]) < .01 * u) xs.push(p1[0]); if (Math.abs(p1[1] - p2[1]) < .01 * u) ys.push(p1[1]); }
        const limpia = (L2, lo, hi) => { const o = [lo]; L2.concat([hi]).sort((a, b2) => a - b2).forEach(v => { if (v >= lo - 1e-6 && v <= hi + 1e-6 && v - o[o.length - 1] >= 3 * u) o.push(v); }); if (hi - o[o.length - 1] > 1e-6) o[o.length - 1] = hi; return o; };
        const cx2 = limpia(xs, x0, x0 + wv), cy2 = limpia(ys, y0, y0 + hv);
        if (cx2.length > 2) for (let i = 0; i + 1 < cx2.length; i++) cotaH(cx2[i], cx2[i + 1], y0, y0 - 7 * u, (cx2[i + 1] - cx2[i]) / k * 10);
        if (cy2.length > 2) for (let i = 0; i + 1 < cy2.length; i++) cotaV(cy2[i], cy2[i + 1], x0 + wv, x0 + wv + 7 * u, (cy2[i + 1] - cy2[i]) / k * 10);
      }
    }
  }
  if (conPersp) {
    const cx = celdaX[cP[0]], cy = celdaY[cP[1]], bw = cx.w, bh = cy.h, ar = imgPersp.w / imgPersp.h;
    let w = bw, h = bw / ar; if (h > bh) { h = bh; w = bh * ar; }
    prims.push({ t: 'img', x: cx.x + (bw - w) / 2, y: cy.y + (bh - h) / 2, w, h, src: imgPersp.src, px: imgPersp.w, py: imgPersp.h });
    if (cfg.nombres) TX(cx.x + bw / 2, cy.y + (bh + h) / 2 + 3, 'PERSPECTIVA', 2.5, { al: 'c', c: 'nom' });
  }
  if (!real) { // marco y cajetín
    L(marco.x0, marco.y0, marco.x1, marco.y0, 'marco'); L(marco.x1, marco.y0, marco.x1, marco.y1, 'marco');
    L(marco.x1, marco.y1, marco.x0, marco.y1, 'marco'); L(marco.x0, marco.y1, marco.x0, marco.y0, 'marco');
    const X = marco.x1 - caj.w, Y = marco.y0, cw = caj.w, ch = caj.h;
    const R = (x1, y1, x2, y2) => { L(x1, y1, x2, y1, 'caj'); L(x2, y1, x2, y2, 'caj'); L(x2, y2, x1, y2, 'caj'); L(x1, y2, x1, y1, 'caj'); };
    R(X, Y, X + cw, Y + ch);
    L(X + 30, Y, X + 30, Y + ch, 'caj'); L(X + 120, Y, X + 120, Y + ch, 'caj'); L(X + 150, Y, X + 150, Y + ch, 'caj');
    L(X + 30, Y + 14, X + cw, Y + 14, 'caj'); L(X + 90, Y, X + 90, Y + 14, 'caj');
    const et = (x, y, t) => TX(x, y, t, 1.8, { c: 'etq' });
    et(X + 31.5, Y + ch - 3.2, 'TÍTULO'); et(X + 31.5, Y + 10.6, 'AUTOR / ALUMNO'); et(X + 91.5, Y + 10.6, 'FECHA');
    et(X + 121.5, Y + ch - 3.2, 'ESCALA'); et(X + 121.5, Y + 10.6, 'UNIDADES'); et(X + 151.5, Y + ch - 3.2, 'SISTEMA'); et(X + 151.5, Y + 10.6, 'HOJA');
    const tit = (cfg.titulo || P.nombre || 'Mueble').slice(0, 42);
    TX(X + 75, Y + 17.5, tit, tit.length > 30 ? 4 : 5, { al: 'c', bold: true });
    TX(X + 32, Y + 3.5, (cfg.autor || '').slice(0, 34), 3.2);
    TX(X + 105, Y + 3.5, (cfg.fecha || '').slice(0, 14), 3, { al: 'c' });
    TX(X + 135, Y + 17.5, '1:' + den, 5, { al: 'c', bold: true });
    TX(X + 135, Y + 3.5, 'mm', 3.2, { al: 'c' });
    TX(X + 165, Y + 20.5, cfg.sistema === 'A' ? 'Americano' : 'Europeo', 3, { al: 'c' });
    TX(X + 165, Y + 16.5, cfg.sistema === 'A' ? '(3.er diedro)' : '(1.er diedro)', 2.3, { al: 'c' });
    TX(X + 165, Y + 3.5, String(cfg.hoja || '1'), 4, { al: 'c', bold: true });
    if (cfg.logo && cfg.logo.src) {
      const ar = cfg.logo.w / cfg.logo.h; let w = 26, h = 26 / ar; if (h > (cfg.centro ? 18 : 26)) { h = cfg.centro ? 18 : 26; w = h * ar; }
      prims.push({ t: 'img', x: X + 15 - w / 2, y: Y + ch - 2 - h, w, h, src: cfg.logo.src, px: cfg.logo.w, py: cfg.logo.h });
    }
    if (cfg.centro) { const pal = cfg.centro.split(/\s+/); const lin = ['']; pal.forEach(p2 => { if ((lin[lin.length - 1] + ' ' + p2).trim().length > 16) lin.push(p2); else lin[lin.length - 1] = (lin[lin.length - 1] + ' ' + p2).trim(); });
      lin.slice(0, cfg.logo ? 2 : 5).reverse().forEach((t2, i) => TX(X + 15, Y + 2.5 + i * 2.9, t2, 2.2, { al: 'c' })); }
    TX(marco.x0, marco.y0 - 5, 'Boceto a Render 3D v' + VERSION, 2, { c: 'etq' });
  }
  return { W, H, prims, den };
}

/* ---------- salida SVG (vista previa) ---------- */
const ESTILO_LAM = { vis: { w: .5, col: '#000' }, ocu: { w: .25, col: '#000', d: [2.5, 1.2] }, cota: { w: .18, col: '#1a1a1a' }, marco: { w: .7, col: '#000' }, caj: { w: .35, col: '#000' },
  txt: { col: '#000' }, nom: { col: '#333' }, etq: { col: '#666' } };
function svgLamina(L) {
  const H = L.H, e = [];
  for (const p of L.prims) {
    if (p.t === 'l') { const st = ESTILO_LAM[p.c]; e.push(`<line x1="${p.x1.toFixed(2)}" y1="${(H - p.y1).toFixed(2)}" x2="${p.x2.toFixed(2)}" y2="${(H - p.y2).toFixed(2)}" stroke="${st.col}" stroke-width="${st.w}"${st.d ? ` stroke-dasharray="${st.d.join(' ')}"` : ''} stroke-linecap="round"/>`); }
    else if (p.t === 'tri') e.push(`<polygon points="${p.pts.map(q => q[0].toFixed(2) + ',' + (H - q[1]).toFixed(2)).join(' ')}" fill="#1a1a1a"/>`);
    else if (p.t === 'txt') { const an = { l: 'start', c: 'middle', r: 'end' }[p.al]; const tr = p.ang ? ` transform="rotate(${-p.ang} ${p.x.toFixed(2)} ${(H - p.y).toFixed(2)})"` : '';
      e.push(`<text x="${p.x.toFixed(2)}" y="${(H - p.y).toFixed(2)}" font-size="${p.h}" font-family="Helvetica,Arial,sans-serif"${p.bold ? ' font-weight="bold"' : ''} text-anchor="${an}" fill="${(ESTILO_LAM[p.c] || ESTILO_LAM.txt).col}"${tr}>${esc(p.s)}</text>`); }
    else if (p.t === 'img') e.push(`<image href="${p.src}" x="${p.x.toFixed(2)}" y="${(H - p.y - p.h).toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="100%" style="background:#fff;display:block"><rect width="100%" height="100%" fill="#fff"/>${e.join('')}</svg>`;
}

/* ---------- salida PDF (escrito a mano: líneas, texto Helvetica e imágenes JPEG) ---------- */
const HELV = (() => { // anchos de Helvetica (1/1000 em) para ASCII 32–126
  const w = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  return ch => { let c = ch.normalize('NFD').charCodeAt(0); if (c >= 32 && c <= 126) return w[c - 32]; return 556; };
})();
function anchoTexto(s, h, bold) { let t = 0; for (const ch of s) t += HELV(ch); return t / 1000 * h * (bold ? 1.06 : 1); }
const WINANSI = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151 };
function aLatin1(s) { let o = ''; for (const ch of s) { const c = ch.charCodeAt(0); o += String.fromCharCode(WINANSI[ch] || (c < 256 ? c : 63)); } return o; }
function bytesDe(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
function base64Bytes(dataURL) { const bin = atob(dataURL.split(',')[1]); return bytesDe(bin); }
function pdfLamina(L) {
  const f = n => (Math.round(n * 1000) / 1000).toString();
  const cs = [`${f(72 / 25.4)} 0 0 ${f(72 / 25.4)} 0 0 cm`, '1 J 1 j'];
  const imgs = []; let est = null;
  for (const p of L.prims) {
    if (p.t === 'l') {
      if (est !== p.c) { const s = ESTILO_LAM[p.c]; cs.push(`${s.w} w ${s.d ? '[' + s.d.join(' ') + '] 0 d' : '[] 0 d'} 0 G`); est = p.c; }
      cs.push(`${f(p.x1)} ${f(p.y1)} m ${f(p.x2)} ${f(p.y2)} l S`);
    } else if (p.t === 'tri') cs.push(`0.1 g ${f(p.pts[0][0])} ${f(p.pts[0][1])} m ${f(p.pts[1][0])} ${f(p.pts[1][1])} l ${f(p.pts[2][0])} ${f(p.pts[2][1])} l h f`);
    else if (p.t === 'txt') {
      const gris = p.c === 'etq' ? '0.4 g' : p.c === 'nom' ? '0.2 g' : '0 g';
      const w = anchoTexto(p.s, p.h, p.bold), off = p.al === 'c' ? -w / 2 : p.al === 'r' ? -w : 0;
      const a = (p.ang || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      const x = p.x + off * co, y = p.y + off * si;
      const str = aLatin1(p.s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      cs.push(`${gris} BT /${p.bold ? 'F2' : 'F1'} ${f(p.h)} Tf ${f(co)} ${f(si)} ${f(-si)} ${f(co)} ${f(x)} ${f(y)} Tm (${str}) Tj ET`);
    } else if (p.t === 'img') {
      let i = imgs.findIndex(q => q.src === p.src); if (i < 0) { imgs.push(p); i = imgs.length - 1; }
      cs.push(`q ${f(p.w)} 0 0 ${f(p.h)} ${f(p.x)} ${f(p.y)} cm /Im${i} Do Q`);
    }
  }
  const contenido = cs.join('\n');
  const Wpt = L.W * 72 / 25.4, Hpt = L.H * 72 / 25.4;
  const objs = []; // cada uno: array de partes (string o Uint8Array)
  objs.push(['<< /Type /Catalog /Pages 2 0 R >>']);
  objs.push(['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  const xo = imgs.map((_, i) => `/Im${i} ${7 + i} 0 R`).join(' ');
  objs.push([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(Wpt)} ${f(Hpt)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << ${xo} >> >> >>`]);
  const cb = bytesDe(aLatin1(contenido));
  objs.push([`<< /Length ${cb.length} >>\nstream\n`, cb, '\nendstream']);
  objs.push(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  objs.push(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  imgs.forEach(im => { const b = base64Bytes(im.src); objs.push([`<< /Type /XObject /Subtype /Image /Width ${im.px} /Height ${im.py} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${b.length} >>\nstream\n`, b, '\nendstream']); });
  const partes = [bytesDe('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let off = partes[0].length; const offs = [];
  objs.forEach((o, i) => {
    offs.push(off);
    const L2 = [bytesDe(`${i + 1} 0 obj\n`), ...o.map(x => typeof x === 'string' ? bytesDe(x) : x), bytesDe('\nendobj\n')];
    L2.forEach(b => { partes.push(b); off += b.length; });
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  partes.push(bytesDe(xref));
  return new Blob(partes, { type: 'application/pdf' });
}

/* ---------- salida DXF (R12, capas, ocultas con línea discontinua) ---------- */
function dxfLamina(L, escalaTipo) {
  const o = [], p = (c, v) => o.push(String(c), String(v));
  const CAPAS = { vis: ['VISIBLES', 7, 'CONTINUOUS'], ocu: ['OCULTAS', 8, 'DASHED'], cota: ['COTAS', 4, 'CONTINUOUS'], marco: ['MARCO', 7, 'CONTINUOUS'], caj: ['CAJETIN', 7, 'CONTINUOUS'], txt: ['TEXTOS', 7, 'CONTINUOUS'], nom: ['TEXTOS', 7, 'CONTINUOUS'], etq: ['CAJETIN', 8, 'CONTINUOUS'] };
  const nf = n => (Math.round(n * 10000) / 10000).toString();
  p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252'); p(9, '$LTSCALE'); p(40, nf(escalaTipo || 1));
  p(9, '$EXTMIN'); p(10, 0); p(20, 0); p(30, 0); p(9, '$EXTMAX'); p(10, nf(L.W)); p(20, nf(L.H)); p(30, 0); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'TABLES');
  p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 2);
  p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, '0.0');
  p(0, 'LTYPE'); p(2, 'DASHED'); p(70, 0); p(3, '__ __ __'); p(72, 65); p(73, 2); p(40, '3.7'); p(49, '2.5'); p(49, '-1.2');
  p(0, 'ENDTAB');
  const capas = [...new Map(Object.values(CAPAS).map(c => [c[0], c])).values()];
  p(0, 'TABLE'); p(2, 'LAYER'); p(70, capas.length + 1);
  p(0, 'LAYER'); p(2, '0'); p(70, 0); p(62, 7); p(6, 'CONTINUOUS');
  capas.forEach(([n, col, lt]) => { p(0, 'LAYER'); p(2, n); p(70, 0); p(62, col); p(6, lt); });
  p(0, 'ENDTAB'); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'ENTITIES');
  for (const e of L.prims) {
    const capa = (CAPAS[e.c] || CAPAS.txt)[0];
    if (e.t === 'l') { p(0, 'LINE'); p(8, capa); p(10, nf(e.x1)); p(20, nf(e.y1)); p(30, 0); p(11, nf(e.x2)); p(21, nf(e.y2)); p(31, 0); }
    else if (e.t === 'tri') { p(0, 'SOLID'); p(8, capa); [[10, 20, 30, 0], [11, 21, 31, 1], [12, 22, 32, 2], [13, 23, 33, 2]].forEach(([a, b2, c2, i]) => { p(a, nf(e.pts[i][0])); p(b2, nf(e.pts[i][1])); p(c2, 0); }); }
    else if (e.t === 'txt') {
      p(0, 'TEXT'); p(8, capa); p(10, nf(e.x)); p(20, nf(e.y)); p(30, 0); p(40, nf(e.h)); p(1, aLatin1(e.s)); if (e.ang) p(50, e.ang);
      const j = { l: 0, c: 1, r: 2 }[e.al] || 0; if (j) { p(72, j); p(11, nf(e.x)); p(21, nf(e.y)); p(31, 0); }
    }
  }
  p(0, 'ENDSEC'); p(0, 'EOF');
  return new Blob([bytesDe(o.join('\r\n') + '\r\n')], { type: 'application/dxf' });
}

/* ---------- captura de la perspectiva (vista 3D actual, fondo blanco) ---------- */
function capturaPersp(w, h) {
  const sz = new T.Vector2(); renderer.getSize(sz);
  const asp = camara.aspect, bg = escena.background, pr = renderer.getPixelRatio();
  grupoAyudas.visible = false; escena.background = new T.Color('#ffffff'); contacto.visible = false;
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
  renderer.render(escena, camara);
  const src = c3d.toDataURL('image/jpeg', .9);
  escena.background = bg; grupoAyudas.visible = true; contacto.visible = !(P.vista.explosion > .05);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false); camara.aspect = asp; camara.updateProjectionMatrix(); render3D();
  return { src, w, h };
}

/* ---------- diálogo de la lámina ---------- */
function abrirLamina() {
  if (!P.piezas.some(p => p.visible)) return aviso('No hay piezas');
  const cfg = Object.assign(cfgLaminaDefecto(), P.lamina || {});
  cfg.vistas = Object.assign(cfgLaminaDefecto().vistas, (P.lamina || {}).vistas || {});
  if (!cfg.titulo) cfg.titulo = P.nombre && P.nombre !== 'proyecto' ? P.nombre : '';
  const r3 = $('#v3d').getBoundingClientRect(), ar3 = Math.max(.6, Math.min(2.2, r3.width / Math.max(1, r3.height)));
  const persp = capturaPersp(Math.round(900 * Math.min(1, ar3)), Math.round(900 / Math.max(1, ar3)));
  const chk = (id, et, v) => `<label class="fila chk"><input type="checkbox" id="l_${id}" ${v ? 'checked' : ''}> ${et}</label>`;
  const sel = (id, et, v, ops) => `<label class="fila">${et} <select id="l_${id}">${ops.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
  const txt = (id, et, v) => `<label class="fila">${et} <input type="text" id="l_${id}" value="${esc(v || '')}"></label>`;
  modal('Lámina técnica', `<div class="lamina">
    <div class="lam-opc">
      <h4>Hoja</h4>
      ${sel('formato', 'Formato', cfg.formato, [['A4', 'A4 horizontal'], ['A3', 'A3 horizontal']])}
      ${sel('sistema', 'Sistema', cfg.sistema, [['E', 'Europeo (1.er diedro)'], ['A', 'Americano (3.er diedro)']])}
      ${sel('escala', 'Escala', cfg.escala, [['auto', 'Automática'], ...ESCALAS.map(e => [e, '1:' + e])])}
      <h4>Vistas</h4>
      ${Object.keys(TIPOS).map(t => chk('v_' + t, TIPOS[t].nombre, cfg.vistas[t])).join('')}
      ${chk('persp', 'Perspectiva (la vista 3D actual)', cfg.persp)}
      <h4>Dibujo</h4>
      ${sel('cotas', 'Cotas', cfg.cotas, [['no', 'Sin cotas'], ['generales', 'Generales'], ['parciales', 'Generales y parciales']])}
      ${chk('ocultas', 'Aristas ocultas (discontinuas)', cfg.ocultas)}
      ${chk('nombres', 'Nombre de cada vista', cfg.nombres)}
      <h4>Cajetín</h4>
      ${txt('titulo', 'Título', cfg.titulo)}${txt('autor', 'Autor / alumno', cfg.autor)}${txt('centro', 'Centro', cfg.centro)}
      ${txt('fecha', 'Fecha', cfg.fecha)}${txt('hoja', 'Hoja nº', cfg.hoja)}
      <div class="col2"><button id="l_logo">🖼 Logo…</button><button id="l_sinlogo">✕ Sin logo</button></div>
    </div>
    <div class="lam-prev"><div id="lamPrev"></div><p class="nota" id="lamInfo"></p></div></div>`, [
    { txt: 'Cerrar' },
    { txt: '⬇ DXF a 1:1', mantener: true, fn: () => { const L = construirLamina(leer(), 'real'); descargar(nombreLam() + ' 1a1.dxf', dxfLamina(L, L.den)); } },
    { txt: '⬇ DXF lámina', mantener: true, fn: () => { const L = construirLamina(leer(), 'hoja', persp); descargar(nombreLam() + '.dxf', dxfLamina(L, 1)); } },
    { txt: '⬇ PDF', primario: true, mantener: true, fn: () => { const L = construirLamina(leer(), 'hoja', persp); descargar(nombreLam() + '.pdf', pdfLamina(L)); } }], 'min(1180px,96vw)');
  const nombreLam = () => ((cfg.titulo || P.nombre || 'lamina') + ' - lámina').replace(/[\\/:*?"<>|]/g, '');
  function leer() {
    const g = id => $('#l_' + id);
    Object.assign(cfg, { formato: g('formato').value, sistema: g('sistema').value, escala: g('escala').value, cotas: g('cotas').value,
      ocultas: g('ocultas').checked, nombres: g('nombres').checked, persp: g('persp').checked,
      titulo: g('titulo').value, autor: g('autor').value, centro: g('centro').value, fecha: g('fecha').value, hoja: g('hoja').value });
    Object.keys(TIPOS).forEach(t => cfg.vistas[t] = g('v_' + t).checked);
    P.lamina = JSON.parse(JSON.stringify(cfg)); guardarLocalPronto();
    return cfg;
  }
  function previa() {
    const L = construirLamina(leer(), 'hoja', persp);
    $('#lamPrev').innerHTML = svgLamina(L);
    $('#lamInfo').textContent = `Escala 1:${L.den} · ${cfg.formato} horizontal · cotas en mm. «DXF lámina» guarda la hoja tal cual (en mm de papel); «DXF a 1:1» guarda solo las vistas a tamaño real, con capas VISIBLES, OCULTAS y COTAS.`;
  }
  $$('.lamina input, .lamina select').forEach(e => e.addEventListener(e.type === 'text' ? 'change' : 'input', previa));
  $('#l_logo').onclick = async () => {
    const f = await leerArchivo('image/*'); if (!f) return;
    const im = await cargarImagen(f.datos), e2 = Math.min(1, 400 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = lienzo(Math.round(im.naturalWidth * e2), Math.round(im.naturalHeight * e2)), x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
    cfg.logo = { src: cv.toDataURL('image/jpeg', .9), w: cv.width, h: cv.height }; previa();
  };
  $('#l_sinlogo').onclick = () => { cfg.logo = null; previa(); };
  previa();
}
$('#bLamina').onclick = abrirLamina;

/* ===================== EXPORTAR AL ANIDADOR ===================== */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipAlmacen(archivos) { // ZIP sin compresión; nombres en UTF-8
  const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const a of archivos) {
    const nom = enc.encode(a.nombre), dat = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos, c = crc32(dat);
    const loc = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(hora), ...u16(dia), ...u32(c), ...u32(dat.length), ...u32(dat.length), ...u16(nom.length), ...u16(0)]);
    partes.push(loc, nom, dat);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(hora), ...u16(dia), ...u32(c), ...u32(dat.length), ...u32(dat.length), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nom);
    off += loc.length + nom.length + dat.length;
  }
  const tamC = central.reduce((s, b) => s + b.length, 0);
  const fin = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length), ...u32(tamC), ...u32(off), ...u16(0)]);
  return new Blob([...partes, ...central, fin], { type: 'application/zip' });
}
function medidasTablero(p) { // {g, L, A, veta} en cm
  const th = ejeGrosor(p), cara = 'xyz'.split('').filter(e => e !== th), m = infoMaterial(p.material);
  const veta = m.tipo === 'madera';
  const dl = e => p[DIM[e]], ve = ejeVeta(p);
  const ejeL = veta && cara.includes(ve) ? ve : (dl(cara[0]) >= dl(cara[1]) ? cara[0] : cara[1]);
  const ejeA = cara.find(e => e !== ejeL);
  return { g: p[DIM[th]], L: p[DIM[ejeL]], A: p[DIM[ejeA]], veta, ejeL };
}
function exportarAnidador() {
  const tableros = {}, contornos = {}, fuera = [];
  for (const p of P.piezas) {
    if (!p.visible) continue;
    const m = infoMaterial(p.material);
    if (['metal', 'metalpint', 'cristal'].includes(m.tipo) || p.forma === 'cilindro') { fuera.push(p.nombre); continue; }
    const md = medidasTablero(p), gmm = Math.round(md.g * 100) / 10;
    const clave = `${m.tipo === 'lacado' ? 'Lacado ' + p.color : m.nombre} ${fmtMM(gmm)} mm`;
    const nuc = nucleoDe(p);
    let cl = 0, ca = 0, tc = '';
    if (nuc !== 'macizo' && p.cantos !== 'sin') { cl = 2; ca = 2; tc = 'Canto ' + (p.cantos === 'otro' ? infoMaterial(p.cantoMat).nombre : m.nombre); }
    const nombre = p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/\s\d+$/, '').replace(/;/g, ',');
    if (tieneContorno(p)) {
      const Tp = TIPOS[p.plano], c = p.contorno, ka = p[DIM[Tp.h]] / c.cw * 10, kb = p[DIM[Tp.v]] / c.ch * 10;
      const conv = an => ({ pts: an.map(([u2, v]) => ({ x: Math.round(u2 * ka * 1000) / 1000, y: Math.round(v * kb * 1000) / 1000 })), b: an.map(() => 0), cerrado: true });
      const cont = contornosCalcadorMM(p) || [conv(c.ext), ...(c.huecos || []).map(conv)];   // del Calcador, con sus arcos exactos
      const nomC = p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/;/g, ',');
      const firma = clave + '|' + nomC + '|' + JSON.stringify(cont);
      (contornos[firma] = contornos[firma] || { clave, nombre: nomC, cont, n: 0 }).n++;
      continue;
    }
    const T2 = tableros[clave] = tableros[clave] || {};
    const k = [nombre, fmtMM(md.L * 10), fmtMM(md.A * 10), md.veta ? 'sí' : 'no', cl, ca, tc].join(';');
    T2[k] = (T2[k] || 0) + 1;
  }
  const archivos = [];
  for (const [clave, filas] of Object.entries(tableros)) {
    const csv = 'nombre;largo;ancho;cantidad;veta;canto largo;canto ancho;tipo de canto\r\n' + Object.entries(filas).map(([k, n]) => { const c = k.split(';'); return [c[0], c[1], c[2], n, c[3], c[4], c[5], c[6]].join(';'); }).join('\r\n') + '\r\n';
    archivos.push({ nombre: clave.replace(/[\\/:*?"<>|]/g, '') + '.csv', datos: '﻿' + csv });
  }
  const usados = new Set();
  for (const c of Object.values(contornos)) {
    let nom = `${c.clave} - ${c.nombre}${c.n > 1 ? ' (x' + c.n + ')' : ''}`.replace(/[\\/:*?"<>|]/g, '');
    for (let k = 2; usados.has(nom); k++) nom = `${c.clave} - ${c.nombre} (${k})${c.n > 1 ? ' (x' + c.n + ')' : ''}`.replace(/[\\/:*?"<>|]/g, '');
    usados.add(nom);
    archivos.push({ nombre: 'contornos/' + nom + '.json', datos: JSON.stringify({ nombre: c.nombre + (c.n > 1 ? ' (x' + c.n + ')' : ''), origen: 'Boceto a Render 3D', calcador: { contornos: c.cont } }, null, 1) });
  }
  if (!archivos.length) return aviso('No hay tableros que anidar');
  const leeme = `Despiece de «${P.nombre || 'proyecto'}» para el Anidador (Suite CNC)\r\n\r\n` +
    `- Cada .csv es un tipo de tablero (material y grosor). Ábrelo en el Anidador con «📂 Abrir…» y pon las medidas de ese tablero.\r\n` +
    `- Medidas en mm. «veta = sí» en las maderas: el largo va en la dirección de la veta.\r\n` +
    `- Cantos: 2 y 2 = todos los cantos con el tipo indicado; 0 = sin canto.\r\n` +
    (Object.keys(contornos).length ? `- La carpeta «contornos» tiene las piezas con contorno como proyectos del Calcador (.json). Ábrelas junto al .csv del mismo tablero; si el nombre dice (xN), pon esa cantidad en el Anidador.\r\n` : '') +
    (fuera.length ? `- No se incluyen herrajes, metales, cristal ni piezas cilíndricas: ${[...new Set(fuera)].join(', ').replace(/\.$/, '')}.\r\n` : '');
  archivos.unshift({ nombre: 'LEEME.txt', datos: leeme });
  descargar(((P.nombre || 'proyecto') + ' - para el Anidador.zip').replace(/[\\/:*?"<>|]/g, ''), zipAlmacen(archivos));
  aviso(`${archivos.length - 1} archivo(s) para el Anidador`);
}

/* ===================== MUEBLECAD 2D: PLANO DE TALLER ===================== */
/* Se manda el mueble a MUEBLECAD 2D (assets/mueblecad/mueblecad.html): las vistas con aristas visibles y ocultas
   (en mm, Y hacia arriba) y cada pieza de tablero con su material, alma, grueso, veta, cantos y contorno.
   MUEBLECAD crea una lámina de conjunto y otra con las piezas desplegadas, listas para herrajes, cotas y despiece. */
const MC_URL = 'assets/mueblecad/mueblecad.html';
const PAT_ALMA = { macizo: 'MACIZO', aglomerado: 'AGLOMERADO', mdf: 'MDF', contrachapado: 'CONTRACHAPADO' };
function paqueteMueblecad() {
  const mm = v => Math.round(v * 10000) / 1000;
  const vistas = {};
  ['alzado', 'planta', 'perfil'].forEach(t => {
    const T = TIPOS[t], ar = aristasVista(T), mp = ([a, b]) => [mm(T.hs > 0 ? a : -a), mm(T.vs > 0 ? b : -b)];
    vistas[t] = { nombre: T.nombre, vis: ar.vis.map(s => s.map(mp)), ocu: ar.ocu.map(s => s.map(mp)) };
  });
  const piezas = [], fuera = [], vis = P.piezas.filter(p => p.visible);
  const esMetal = p => ['metal', 'metalpint'].includes(infoMaterial(p.material).tipo);
  for (const p of vis) {
    const m = infoMaterial(p.material);
    if (esMetal(p) || p.forma === 'cilindro') { fuera.push(p.nombre); continue; }
    const cristal = m.tipo === 'cristal', nuc = nucleoDe(p), md = medidasTablero(p);
    const base = m.tipo === 'lacado' ? 'Lacado ' + p.color : m.nombre;
    const mat = { n: cristal ? 'Vidrio' : base + (nuc === 'macizo' ? ' macizo' : ' · ' + ALMAS[nuc].nombre.toLowerCase()), pat: cristal ? 'VIDRIO' : PAT_ALMA[nuc] || 'AGLOMERADO', veta: md.veta && !cristal };
    const canto = !cristal && nuc !== 'macizo' && p.cantos !== 'sin' ? 1 : 0;
    const th = ejeGrosor(p), eL = md.ejeL, eA = 'xyz'.split('').find(e => e !== th && e !== eL);
    // contorno en coordenadas de la cara: a a lo largo de la veta (eje largo), b a lo ancho, en mm desde la esquina de la pieza
    let conts = null;
    if (tieneContorno(p) && TIPOS[p.plano].prof === th) {
      const Tp = TIPOS[p.plano], c = p.contorno, ka = p[DIM[Tp.h]] / c.cw * 10, kb = p[DIM[Tp.v]] / c.ch * 10;
      const conv = an => ({ pts: an.map(([u, v]) => ({ x: u * ka, y: v * kb })), b: an.map(() => 0) });
      const loc = contornosCalcadorMM(p) || [conv(c.ext), ...(c.huecos || []).map(conv)];
      const dv = p[DIM[Tp.v]] * 10, aCara = (u, v) => { const w = { [Tp.h]: u, [Tp.v]: Tp.vs > 0 ? v : dv - v }; return { x: Math.round(w[eL] * 1000) / 1000, y: Math.round(w[eA] * 1000) / 1000 }; };
      const espejo = (Tp.h === eL ? Tp.vs : -Tp.vs) < 0;
      conts = loc.map(l => ({ pts: l.pts.map(q => aCara(q.x, q.y)), b: (l.b || []).map(x => espejo ? -x : +x) }));
    }
    const nombre = p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/\s\d+$/, '') || p.nombre;
    piezas.push({ id: p.id, nombre, mat, gros: mm(md.g), L: mm(md.L), A: mm(md.A), veta: mat.veta, canto, conts, girar: false,
      tal: taladrosHerrajes(p, th, eL, eA, vis.filter(q => q !== p && esMetal(q))), marcaV: anclaMarca(p, vis) });
  }
  const aperturas = [];
  for (const [g, G] of Object.entries(P.grupos)) {
    if (!G.mov || !['izq', 'der', 'arriba', 'abajo'].includes(G.mov.tipo)) continue;
    const L = piezasGrupo(g).filter(p => p.visible); if (!L.length) continue;
    const b = bbox(L); aperturas.push({ tipo: G.mov.tipo, x0: mm(b.x0), y0: mm(b.y0), x1: mm(b.x1), y1: mm(b.y1) });
  }
  return { tipo: 'boceto-mueble', v: 2, app: 'Boceto a Render 3D', versionPrograma: VERSION, nombre: P.nombre || 'mueble', vistas, piezas, aperturas, fuera };
}
/* ---------- herrajes → taladros en la pieza (para MUEBLECAD) ----------
   Cada pieza de metal que toca la cara de un tablero deja sus agujeros, según su nombre. Medidas habituales,
   orientativas: se revisan en MUEBLECAD. Coordenadas en mm sobre la cara (a: eje largo, b: eje ancho). */
function taladrosHerrajes(p, th, eL, eA, metales) {
  const O = [], t0 = p[th], t1 = p[th] + p[DIM[th]], tol = .06, g = p[DIM[th]] * 10;
  const r = v => Math.round(v * 100) / 100, prof = v => Math.min(v, Math.max(1, g - 3));
  for (const q of metales) {
    if (q.forma === 'cilindro' && q.eje !== th) continue; // una cazoleta o un pernio solo marcan la pieza en la que entran de frente
    const a0 = Math.max(p[eL], q[eL]), a1 = Math.min(p[eL] + p[DIM[eL]], q[eL] + q[DIM[eL]]);
    const b0 = Math.max(p[eA], q[eA]), b1 = Math.min(p[eA] + p[DIM[eA]], q[eA] + q[DIM[eA]]);
    if (a1 - a0 <= 0 || b1 - b0 <= 0) continue;
    const m0 = q[th], m1 = q[th] + q[DIM[th]];
    if (m0 > t1 + tol || m1 < t0 - tol) continue;
    const cara = Math.abs(m0 - t1) <= Math.abs(m1 - t0) ? 'A' : 'B';
    const F = { a0: (a0 - p[eL]) * 10, a1: (a1 - p[eL]) * 10, b0: (b0 - p[eA]) * 10, b1: (b1 - p[eA]) * 10 };
    const ca = (F.a0 + F.a1) / 2, cb = (F.b0 + F.b1) / 2, la = F.a1 - F.a0, lb = F.b1 - F.b0, n = q.nombre.toLowerCase();
    const add = (a, b, d, pr, nom) => { if (a > 1 && b > 1 && a < p[DIM[eL]] * 10 - 1 && b < p[DIM[eA]] * 10 - 1) O.push({ a: r(a), b: r(b), d, prof: pr, cara, nom }); };
    if (/tirador|pomo|asa/.test(n)) {
      const L = Math.max(la, lb), alA = la >= lb;
      if (L < 30) { add(ca, cb, 4, 0, q.nombre); continue; }
      const ent = [32, 64, 96, 128, 160, 192, 224, 256, 320].filter(v => v <= L - 8).pop() || 32;
      for (const s of [-1, 1]) add(alA ? ca + s * ent / 2 : ca, alA ? cb : cb + s * ent / 2, 4, 0, q.nombre);
    } else if (/cazoleta/.test(n)) {
      add(ca, cb, 35, prof(13), 'Bisagra');
      // tornillos: 9,5 mm más hacia dentro que la cazoleta y a ±22,5 mm a lo largo del canto más cercano
      const dA = Math.min(ca, p[DIM[eL]] * 10 - ca), dB = Math.min(cb, p[DIM[eA]] * 10 - cb);
      if (dA <= dB) { const s = ca < p[DIM[eL]] * 5 ? 1 : -1; for (const k of [-1, 1]) add(ca + s * 9.5, cb + k * 22.5, 2.5, prof(10), 'Bisagra'); }
      else { const s = cb < p[DIM[eA]] * 5 ? 1 : -1; for (const k of [-1, 1]) add(ca + k * 22.5, cb + s * 9.5, 2.5, prof(10), 'Bisagra'); }
    } else if (/brazo|placa|base bisagra/.test(n)) {
      // placa de montaje: dos agujeros a 32 mm (sistema 32), a 37 mm del canto delantero si el brazo está junto a él
      const vert = eL === 'y' ? 'a' : eA === 'y' ? 'b' : (la <= lb ? 'b' : 'a');
      let pa = ca, pb = cb;
      if (vert === 'a') { const Lb = p[DIM[eA]] * 10; if (Lb - F.b1 < 60) pb = Lb - 37; else if (F.b0 < 60) pb = 37; }
      else { const La = p[DIM[eL]] * 10; if (La - F.a1 < 60) pa = La - 37; else if (F.a0 < 60) pa = 37; }
      for (const k of [-1, 1]) add(vert === 'a' ? pa + k * 16 : pa, vert === 'b' ? pb + k * 16 : pb, 5, prof(12), 'Placa de bisagra');
    } else if (/gu[ií]a|corredera/.test(n)) {
      const alA = la >= lb, L = alA ? la : lb, ini = alA ? F.a0 : F.b0;
      const pos = L > 150 ? [37, L / 2, L - 37] : L > 60 ? [20, L - 20] : [L / 2];
      for (const s of pos) add(alA ? ini + s : ca, alA ? cb : ini + s, 2.5, prof(10), 'Guía');
    } else if (/pata|pie/.test(n)) {
      for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(ca + i * la / 4, cb + j * lb / 4, 3, prof(10), q.nombre);
    }
  }
  return O;
}
/* ---------- marca de pieza: punto visible de la pieza en la vista donde más se ve ---------- */
function anclaMarca(p, todas) {
  let mejor = null, oculta = null;
  for (const t of ['alzado', 'perfil', 'planta']) {
    const T = TIPOS[t], H = T.h, Vv = T.v, Pr = T.prof;
    const fr = q => T.frente > 0 ? q[Pr] + q[DIM[Pr]] : -q[Pr];
    const a0 = p[H], a1 = p[H] + p[DIM[H]], b0 = p[Vv], b1 = p[Vv] + p[DIM[Vv]];
    if (a1 - a0 < .3 || b1 - b0 < .3) continue;
    const delante = todas.filter(q => q !== p && fr(q) > fr(p) + .01 && q[H] < a1 && q[H] + q[DIM[H]] > a0 && q[Vv] < b1 && q[Vv] + q[DIM[Vv]] > b0);
    let n = 0, best = null; const N = 9, ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = a0 + (a1 - a0) * (i + .5) / N, v = b0 + (b1 - b0) * (j + .5) / N;
      if (delante.some(q => u > q[H] && u < q[H] + q[DIM[H]] && v > q[Vv] && v < q[Vv] + q[DIM[Vv]])) continue;
      n++; const d = Math.hypot(u - ca, v - cb); if (!best || d < best.d) best = { u, v, d };
    }
    const proy = (a1 - a0) * (b1 - b0);
    if (!oculta || proy > oculta.proy) oculta = { proy, vista: t, x: Math.round((T.hs > 0 ? ca : -ca) * 10000) / 1000, y: Math.round((T.vs > 0 ? cb : -cb) * 10000) / 1000 };
    if (!best || n / (N * N) < .15) continue; // casi tapada en esta vista
    const area = proy * n / (N * N);
    if (!mejor || area > mejor.area * 1.0001) mejor = { area, vista: t, x: Math.round((T.hs > 0 ? best.u : -best.u) * 10000) / 1000, y: Math.round((T.vs > 0 ? best.v : -best.v) * 10000) / 1000 };
  }
  const r = mejor || oculta; // si no se ve bien en ninguna vista, apunta a su centro en la vista donde es más grande
  return r && { vista: r.vista, x: r.x, y: r.y, oculta: !mejor };
}
let mcVentana = null, mcPaquete = null;
function descargarPaqueteMC() {
  const pq = paqueteMueblecad();
  descargar(((P.nombre || 'mueble') + ' - para MUEBLECAD.json').replace(/[\\/:*?"<>|]/g, ''), new Blob([JSON.stringify(pq)], { type: 'application/json' }));
  aviso('Ábrelo en MUEBLECAD 2D con «📂 Abrir»');
}
function abrirMueblecad() {
  if (!P.piezas.some(p => p.visible)) return aviso('No hay piezas visibles');
  mcPaquete = paqueteMueblecad();
  if (!mcPaquete.piezas.length) return aviso('No hay tableros: los metales y los cilindros no pasan a MUEBLECAD');
  mcVentana = window.open(MC_URL + '?desde=boceto', '_blank');
  const fallo = () => modal('MUEBLECAD 2D', `<p>No se ha podido abrir MUEBLECAD en otra pestaña${mcVentana ? ' o no responde' : ' (el navegador ha bloqueado la ventana)'}.</p>
    <p class="nota">Comprueba que está el archivo <b>assets/mueblecad/mueblecad.html</b>. También puedes guardar el mueble y abrirlo en MUEBLECAD con «📂 Abrir».</p>`,
    [{ txt: 'Cerrar' }, { txt: '⬇ Guardar para MUEBLECAD', primario: true, fn: descargarPaqueteMC }]);
  if (!mcVentana) return fallo();
  aviso('Abriendo el plano en MUEBLECAD 2D…');
  setTimeout(() => { if (mcPaquete && !mcPaquete.enviado) fallo(); }, 8000);
}
window.addEventListener('message', e => {
  const d = e.data;
  if (!mcVentana || e.source !== mcVentana || !d || typeof d !== 'object') return;
  if (d.tipo === 'mueblecad-listo' && mcPaquete) { mcVentana.postMessage({ tipo: 'boceto-mueble-envio', paquete: mcPaquete }, '*'); mcPaquete.enviado = true; }
});
$('#bMueblecad').onclick = abrirMueblecad;

/* ===================== ARCHIVOS ===================== */
function serializar() { return JSON.stringify(P); }
let tLocal;
function guardarLocalPronto() { clearTimeout(tLocal); tLocal = setTimeout(guardarLocal, 500); }
let avisoEspacio = false;
function guardarLocal() {
  try { localStorage.setItem(CLAVE_LS, serializar()); }
  catch (e) { if (!avisoEspacio) { avisoEspacio = true; aviso('No cabe en el autoguardado del navegador: usa 💾 Guardar'); } }
}
async function cargarProyecto(obj) {
  const base = proyectoVacio();
  P = Object.assign(base, obj); P.escena = Object.assign(escenaDefecto(), obj.escena || {});
  P.maderasUsuario = P.maderasUsuario || {}; P.bocetos = P.bocetos || {}; P.grupos = P.grupos || {};
  P.vista = Object.assign({ abrir: 0, explosion: 0 }, obj.vista || {});
  P.piezas = (P.piezas || []).map(p => nuevaPieza(p));
  for (const g of Object.values(P.grupos)) g.mov = g.mov || { tipo: 'ninguno', valor: 0 };
  limpiarGrupos();
  for (const k in imgsBoceto) delete imgsBoceto[k];
  for (const k in P.bocetos) { try { imgsBoceto[k] = await cargarImagen(P.bocetos[k].src); } catch (e) { delete P.bocetos[k]; } }
  for (const k in cacheMat) { cacheMat[k].dispose(); delete cacheMat[k]; }
  for (const k in cacheTex) if (k.startsWith('u_')) { cacheTex[k].dispose(); delete cacheTex[k]; }
  sel = new Set(); historial = []; futuro = [];
  opcionesMaterial(); opcionesMaterial('#pCantoMat'); pintarEscena(); pintarCtlBoceto(); mostrarReferencia();
  cambio(true);
  Object.values(VISTAS).forEach(encuadrarVista);
  if (P.camara) { camara.position.fromArray(P.camara.p); controles.target.fromArray(P.camara.t); controles.update(); }
  else encuadrar3D(new T.Vector3(.8, .45, .9).normalize());
  dibujarVistas();
}
$('#bNuevo').onclick = () => modal('Proyecto nuevo', '<p>Se borrarán las piezas actuales (puedes guardarlas antes). ¿Continuar?</p>', [
  { txt: 'Cancelar' }, { txt: 'Nuevo', primario: true, fn: () => { cargarProyecto(proyectoVacio()); } }]);
$('#bGuardar').onclick = () => modal('Guardar proyecto', `<label class="fila">Nombre <input type="text" id="f_nombre" value="${esc(P.nombre || 'proyecto')}"></label>
  <p class="nota">Se guarda todo: piezas, grupos y movimientos, bocetos, maderas de fotos, escena y cámara.</p>`, [
  { txt: 'Cancelar' }, { txt: '💾 Guardar', primario: true, fn: () => {
    P.nombre = ($('#f_nombre').value || 'proyecto').trim(); P.camara = { p: camara.position.toArray(), t: controles.target.toArray() };
    descargar(P.nombre + '.boceto3d.json', new Blob([serializar()], { type: 'application/json' })); guardarLocal();
  } }]);
$('#bAbrir').onclick = async () => {
  const f = await leerArchivo('.json,application/json', true); if (!f) return;
  try { const o = JSON.parse(f.datos); if (!Array.isArray(o.piezas)) throw 0; await cargarProyecto(o); aviso('Proyecto abierto: ' + f.nombre); }
  catch (e) { aviso('Ese archivo no es un proyecto de Boceto a Render 3D'); }
};
function listaEjemplos() {
  return [{ clave: 'mesita', nombre: 'mesita de noche', desc: 'Roble macizo, dos cajones completos, tapa con las esquinas redondeadas y su boceto de fondo', proyecto: window.EJEMPLO_MESITA }]
    .concat(window.EJEMPLOS_MUEBLES || []).filter(e => e.proyecto);
}
function abrirEjemplo(e) { cargarProyecto(JSON.parse(JSON.stringify(e.proyecto))).then(() => { encuadrarTodo(); aviso('Ejemplo: ' + e.nombre); }); }
$('#bEjemplo').onclick = () => {
  const L = listaEjemplos();
  const html = `<p class="nota">Se cargan en lugar del proyecto actual (guárdalo antes si lo necesitas). Puedes cambiarlos, renderizarlos o pasarlos a MUEBLECAD.</p>
    <div class="ejemplos">${L.map((e, i) => `<button data-ej="${i}"><b>${esc(e.nombre.charAt(0).toUpperCase() + e.nombre.slice(1))}</b><small>${esc(e.desc)} · ${e.proyecto.piezas.length} piezas</small></button>`).join('')}</div>`;
  modal('Muebles de ejemplo', html, [{ txt: 'Cancelar' }], '560px');
  $$('#mCuerpo [data-ej]').forEach(b => b.onclick = () => { cerrarModal(); abrirEjemplo(L[+b.dataset.ej]); });
};
$('#bDespiece').onclick = () => {
  if (!P.piezas.length) return aviso('No hay piezas');
  modal('Despiece', `<p>¿Para qué lo quieres?</p>
    <p class="nota"><b>Hoja de cálculo</b>: un .csv con todas las piezas (medidas en cm, material, tablero, cantos y grupo).<br>
    <b>MUEBLECAD</b>: el mueble para abrirlo en MUEBLECAD 2D (vistas y piezas).<br>
    <b>Anidador</b>: un .zip con un .csv por cada tablero (material y grosor, medidas en mm, veta y cantos) y las piezas con contorno como proyectos del Calcador, listos para abrir en el Anidador de la Suite CNC.</p>`, [
    { txt: 'Cancelar' }, { txt: '📊 Hoja de cálculo (.csv)', fn: despieceCSV }, { txt: '▱ Para MUEBLECAD (.json)', fn: descargarPaqueteMC }, { txt: '🧩 Para el Anidador (.zip)', primario: true, fn: exportarAnidador }]);
};
function despieceCSV() {
  const filas = {};
  for (const p of P.piezas) {
    const m = [p.w, p.h, p.d].sort((a, b) => b - a).map(v => (Math.round(v * 10) / 10).toString().replace('.', ','));
    const nuc = nucleoDe(p), mi = infoMaterial(p.material);
    const obs = [];
    if (tieneContorno(p)) obs.push('con contorno (' + ({ redondeado: 'esquinas redondeadas', chaflan: 'chaflanes', trapecio: 'trapecio', arco: 'arco', unero: 'uñero', importar: 'DXF/SVG', calcador: 'dibujado a mano' }[p.contorno.tipo] || 'contorno') + ')');
    if (p.forma === 'cilindro') obs.push('cilíndrica');
    if (nuc !== 'macizo' && !['metal', 'metalpint', 'cristal'].includes(mi.tipo)) obs.push(ALMAS[nuc].nombre + (p.cantos === 'sin' ? ', sin canto' : p.cantos === 'otro' ? ', canto ' + infoMaterial(p.cantoMat).nombre : ', canto a juego'));
    const g = p.grupo && P.grupos[p.grupo] ? P.grupos[p.grupo].nombre : '';
    const k = [p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/\s\d+$/, ''), ...m, mi.nombre, obs.join('; '), g].map(s => String(s).replace(/;/g, ',')).join(';');
    filas[k] = (filas[k] || 0) + 1;
  }
  const csv = 'Nombre;Largo (cm);Ancho (cm);Grosor (cm);Material;Observaciones;Grupo;Cantidad\n' + Object.entries(filas).map(([k, n]) => k + ';' + n).join('\n');
  descargar((P.nombre || 'proyecto') + '_despiece.csv', new Blob(['﻿' + csv], { type: 'text/csv' }));
}

/* ===================== GENERAL ===================== */
function cambio(confirmado) {
  pintarLista(); pintarProps(); dibujarVistas(); sincronizar3D();
  if (confirmado) guardarLocal();
}
$$('[data-herr]').forEach(b => b.onclick = () => ponerHerramienta(b.dataset.herr));
function ponerHerramienta(h) {
  herramienta = h; calib = null; $$('[data-herr]').forEach(b => b.classList.toggle('activo', b.dataset.herr === h));
  if (h === 'calibrar') aviso('Marca dos puntos del boceto cuya medida conozcas');
  if (h === 'rect') aviso('Arrastra en una vista para dibujar la pieza');
  dibujarVistas();
}
$('#v3d .bGrande').addEventListener('click', () => agrandar($('#v3d')));
$$('[data-dist]').forEach(b => b.onclick = () => {
  $$('[data-dist]').forEach(x => x.classList.toggle('activo', x === b));
  $$('.vista').forEach(v => v.classList.remove('grande')); $$('.bGrande').forEach(x => x.textContent = '⤢');
  $('#vistas').className = 'vistas ' + b.dataset.dist;
  setTimeout(redimensionar, 20);
});
$('#bEncuadrar').onclick = encuadrarTodo;
$('#bDeshacer').onclick = deshacer; $('#bRehacer').onclick = rehacer;
$('#bAyuda').onclick = () => window.open('ayuda/manual.html', '_blank');
$('#bTema').onclick = () => {
  const osc = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = osc ? 'dark' : 'light';
  try { localStorage.setItem('boceto3d.tema', osc ? 'dark' : 'light'); } catch (e) {}
  dibujarVistas();
};
try { const t = localStorage.getItem('boceto3d.tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || !$('#modal').classList.contains('oculto')) {
    if (e.key === 'Escape') cerrarModal();
    if (e.key === 'Enter' && !$('#modal').classList.contains('oculto') && e.target.tagName !== 'BUTTON') { const b = $('#mPie .primario'); if (b) b.click(); }
    return;
  }
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
  else if (ctrl && k === 'y') { e.preventDefault(); rehacer(); }
  else if (ctrl && k === 'd') { e.preventDefault(); duplicar(); }
  else if (ctrl && k === 's') { e.preventDefault(); $('#bGuardar').click(); }
  else if (ctrl && k === 'g') { e.preventDefault(); e.shiftKey ? desagrupar() : agrupar(); }
  else if (ctrl && k === 'a') { e.preventDefault(); seleccionar(P.piezas.filter(p => p.visible).map(p => p.id), { grupo: false }); }
  else if (k === 'delete' || k === 'backspace') eliminar();
  else if (k === 'escape') { seleccionar(null); ponerHerramienta('sel'); }
  else if (k === 'v') ponerHerramienta('sel');
  else if (k === 'r') ponerHerramienta('rect');
  else if (k === 'f') encuadrarTodo();
  else if (k === ' ') { teclaEspacio = true; e.preventDefault(); }
  else if (k.startsWith('arrow')) {
    const L = seleccionadas(); if (!L.length) return; e.preventDefault();
    const V = vistaActiva, paso = (e.shiftKey ? 10 : 1) * (rejilla() || .1);
    guardarHistoria();
    L.forEach(p => {
      if (k === 'arrowleft') p[V.h] = r1(p[V.h] - paso * V.hs); if (k === 'arrowright') p[V.h] = r1(p[V.h] + paso * V.hs);
      if (k === 'arrowup') p[V.v] = r1(p[V.v] + paso * V.vs); if (k === 'arrowdown') p[V.v] = r1(p[V.v] - paso * V.vs);
    });
    cambio(true);
  }
});
document.addEventListener('keyup', e => { if (e.key === ' ') teclaEspacio = false; });

function redimensionar() { Object.values(VISTAS).forEach(ajustarTam); dibujarVistas(); ajustar3D(); }
new ResizeObserver(redimensionar).observe($('#vistas'));
window.addEventListener('resize', redimensionar);

/* ---------- barra superior compacta: en pantallas estrechas los botones se quedan en su icono (el nombre sigue en la ayuda emergente) ---------- */
$$('.barra .grupo button').forEach(b => {
  const t = b.textContent.trim(), i = t.indexOf(' '); if (i < 1) return;
  const ico = t.slice(0, i), txt = t.slice(i + 1);
  b.innerHTML = ''; b.append(ico); const s = document.createElement('span'); s.className = 'txt'; s.textContent = ' ' + txt; b.append(s);
  if (!b.title) b.title = txt;
});

/* ---------- apartados plegables y paneles ocultables ---------- */
(function () {
  let est = {}; try { est = JSON.parse(localStorage.getItem('boceto3d.plegados') || '{}'); } catch (e) {}
  const guardar = () => { try { localStorage.setItem('boceto3d.plegados', JSON.stringify(est)); } catch (e) {} };
  $$('.panel section').forEach((sec, i) => {
    const h3 = sec.querySelector(':scope > h3'); if (!h3) return;
    const cuerpo = document.createElement('div'); cuerpo.className = 'sec-cuerpo';
    while (h3.nextSibling) cuerpo.appendChild(h3.nextSibling);
    sec.appendChild(cuerpo);
    const clave = (sec.closest('.izq') ? 'i' : 'd') + i;
    h3.title = 'Plegar / desplegar';
    if (est[clave]) sec.classList.add('plegada');
    h3.addEventListener('click', () => { sec.classList.toggle('plegada'); est[clave] = sec.classList.contains('plegada'); guardar(); });
  });
  const app = $('.app');
  const pintar = () => {
    $('#bPanelIzq').textContent = app.classList.contains('sin-izq') ? '▶' : '◀';
    $('#bPanelDer').textContent = app.classList.contains('sin-der') ? '◀' : '▶';
    setTimeout(redimensionar, 30);
  };
  if (est.sinIzq) app.classList.add('sin-izq'); if (est.sinDer) app.classList.add('sin-der');
  $('#bPanelIzq').onclick = () => { app.classList.toggle('sin-izq'); est.sinIzq = app.classList.contains('sin-izq'); guardar(); pintar(); };
  $('#bPanelDer').onclick = () => { app.classList.toggle('sin-der'); est.sinDer = app.classList.contains('sin-der'); guardar(); pintar(); };
  pintar();
})();

/* ===================== INICIO ===================== */
(async function inicio() {
  await cargarBiblioteca();
  opcionesMaterial(); opcionesMaterial('#pCantoMat');
  redimensionar();
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(CLAVE_LS) || 'null'); } catch (e) {}
  await cargarProyecto(guardado && guardado.piezas ? guardado : JSON.parse(JSON.stringify(window.EJEMPLO_MESITA)));
  marcarActiva(VISTAS.v1);
  window.__app = { paqueteMueblecad, aplicarCalc, abrirCalcador, piezaAMano, contornosCalcadorMM, construirLamina, exportarAnidador, aristasVista, TIPOS, P: () => P, seleccionar, renderFinal, encuadrarTodo, VISTAS, cargarProyecto, sel: () => [...sel], procesarFoto, parseDXF, parseSVG, encadenar, clasificar };
})();
})();
