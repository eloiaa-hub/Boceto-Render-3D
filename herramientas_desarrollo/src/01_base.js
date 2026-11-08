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
const VERSION = '3.3';

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
