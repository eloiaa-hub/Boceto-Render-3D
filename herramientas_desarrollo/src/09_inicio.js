
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
