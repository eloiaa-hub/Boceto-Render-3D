
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
  if (tieneContorno(p) && p.contorno.tipo === 'calcador') tipos.splice(1, 0, ['calcador', 'Dibujado en el Calcador (sin cambios)']);
  modal('Contorno de «' + p.nombre + '»', formulario([
    { id: 'plano', et: 'Se dibuja en la vista', v: plano0, sel: [['alzado', 'Alzado (grosor en Z)'], ['planta', 'Planta (grosor en Y)'], ['perfil', 'Perfil (grosor en X)']] },
    { id: 'tipo', et: 'Forma', v: p.contorno && p.contorno.tipo || (tieneContorno(p) ? 'importar' : 'redondeado'), sel: tipos }]) +
    `<div id="cParams"></div><canvas id="cPrev" class="prevc" width="440" height="220"></canvas>
     <p class="nota">Para dibujarlo a mano, con rectas, arcos y cotas, usa <b>🖊 Calcador…</b>. El contorno se estira con la pieza si luego cambias sus medidas. El grosor (3.ª medida) se extruye. Los cantos se redondean con «Canto redondeado».</p>`, [
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
