
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
$('#bEjemplo').onclick = () => cargarProyecto(JSON.parse(JSON.stringify(window.EJEMPLO_MESITA)));
$('#bDespiece').onclick = () => {
  if (!P.piezas.length) return aviso('No hay piezas');
  modal('Despiece', `<p>¿Para qué lo quieres?</p>
    <p class="nota"><b>Hoja de cálculo</b>: un .csv con todas las piezas (medidas en cm, material, tablero, cantos y grupo).<br>
    <b>Anidador</b>: un .zip con un .csv por cada tablero (material y grosor, medidas en mm, veta y cantos) y las piezas con contorno como proyectos del Calcador, listos para abrir en el Anidador de la Suite CNC.</p>`, [
    { txt: 'Cancelar' }, { txt: '📊 Hoja de cálculo (.csv)', fn: despieceCSV }, { txt: '🧩 Para el Anidador (.zip)', primario: true, fn: exportarAnidador }]);
};
function despieceCSV() {
  const filas = {};
  for (const p of P.piezas) {
    const m = [p.w, p.h, p.d].sort((a, b) => b - a).map(v => (Math.round(v * 10) / 10).toString().replace('.', ','));
    const nuc = nucleoDe(p), mi = infoMaterial(p.material);
    const obs = [];
    if (tieneContorno(p)) obs.push('con contorno (' + ({ redondeado: 'esquinas redondeadas', chaflan: 'chaflanes', trapecio: 'trapecio', arco: 'arco', unero: 'uñero', importar: 'DXF/SVG', calcador: 'dibujado en el Calcador' }[p.contorno.tipo] || 'contorno') + ')');
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
  window.__app = { aplicarCalc, abrirCalcador, piezaAMano, contornosCalcadorMM, construirLamina, exportarAnidador, aristasVista, TIPOS, P: () => P, seleccionar, renderFinal, encuadrarTodo, VISTAS, cargarProyecto, sel: () => [...sel], procesarFoto, parseDXF, parseSVG, encadenar, clasificar };
})();
})();
