
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
