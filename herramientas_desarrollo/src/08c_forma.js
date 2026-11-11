
/* ---------- forma libre de las piezas rectas: inclinación, cortes planos y redondeos ----------
   p.inc      = { ax, az, piv: 'arriba'|'centro'|'abajo', horiz: bool }  giro (°) sobre X y sobre Z alrededor del pivote;
                horiz: los extremos se cortan en horizontal (la pata apoya en el suelo y llega al tablero)
   p.cortes   = [{ n: [x,y,z], c, txt }]  se quita lo que cumple n·q > c (q en cm, desde el centro de la pieza, ejes del mundo)
   p.redondeo = { x: { r, m }, y: { r, m }, z: { r, m } }  radio (mm) de las aristas paralelas a cada eje; m: '1111' esquinas
   La pieza sigue guardando su caja (x, y, z, w, h, d) sin girar: es la madera de partida, centrada donde estaba. */
function inclinada(p) { return !!(p.inc && (Math.abs(p.inc.ax || 0) > .01 || Math.abs(p.inc.az || 0) > .01)); }
function redondeada(p) { return !!(p.redondeo && EJ3.some(k => p.redondeo[k] && +p.redondeo[k].r > 0)); }
function conCortes(p) { return !!((p.cortes && p.cortes.length) || ingletesDe(p.id).length); }
function especial(p) { return p.forma === 'caja' && !tieneContorno(p) && (inclinada(p) || conCortes(p) || redondeada(p)); }
const mul3 = (A, B) => A.map(f => [0, 1, 2].map(j => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const apl3 = (R, v) => R.map(f => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);
const tras3 = R => [0, 1, 2].map(i => [0, 1, 2].map(j => R[j][i]));
function matInc(p) {                                    // R = Rz(az) · Rx(ax)
  const a = (p.inc && p.inc.ax || 0) * Math.PI / 180, b = (p.inc && p.inc.az || 0) * Math.PI / 180;
  const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]], Rz = [[Math.cos(b), -Math.sin(b), 0], [Math.sin(b), Math.cos(b), 0], [0, 0, 1]];
  return mul3(Rz, Rx);
}
function pivoteInc(p) { const k = p.inc && p.inc.piv || 'arriba'; return [0, k === 'arriba' ? p.h / 2 : k === 'abajo' ? -p.h / 2 : 0, 0]; }
// medio espacio n·q ≥ c (para restar)
function semiespacio(n, c) {
  const B = 1e4, L = Math.hypot(...n), N = n.map(v => v / L), cc = c / L;
  const a = Math.abs(N[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
  let u = [a[1] * N[2] - a[2] * N[1], a[2] * N[0] - a[0] * N[2], a[0] * N[1] - a[1] * N[0]]; const lu = Math.hypot(...u); u = u.map(v => v / lu);
  const v = [N[1] * u[2] - N[2] * u[1], N[2] * u[0] - N[0] * u[2], N[0] * u[1] - N[1] * u[0]];
  const R = [0, 1, 2].map(i => [u[i], v[i], N[i]]);
  return CSG.transform(CSG.box(-B, -B, 0, B, B, B), R, N.map(x => x * cc));
}
// rectángulo redondeado (para el prisma que redondea las aristas paralelas a un eje)
function rectRedondeado(u0, v0, u1, v1, r, m) {
  r = Math.max(0, Math.min(r, (u1 - u0) / 2 - 1e-3, (v1 - v0) / 2 - 1e-3));
  const C = [[u0, v0, Math.PI], [u1, v0, Math.PI * 1.5], [u1, v1, 0], [u0, v1, Math.PI / 2]], o = [];
  C.forEach(([u, v, a0], i) => {
    if (m[i] !== '1' || r < .01) { o.push([u, v]); return; }
    const cu = u + (i === 0 || i === 3 ? r : -r), cv = v + (i < 2 ? r : -r);
    for (let k = 0; k <= 8; k++) { const a = a0 + Math.PI / 2 * k / 8; o.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
  });
  return o;
}
const cacheForma = new Map();
// sólido de la pieza: { loc } en su caja sin girar y { mun } girado (cm, desde el centro de la pieza); null si es una caja normal
function solidoPieza(p) {
  if (!window.CSG || p.forma !== 'caja' || tieneContorno(p)) return null;
  const ens = inclinada(p) ? [] : ensamblesDe(p.id).filter(e => e.marco && e.piezas.some(q => q.id === p.id && q.ops));
  if (!especial(p) && !ens.length) return null;
  const key = JSON.stringify([p.w, p.h, p.d, p.x, p.y, p.z, p.inc, p.cortes, p.redondeo, ingletesDe(p.id).map(g => g.ids.map(id => { const r = pieza(id); return [r.x, r.y, r.z, r.w, r.h, r.d]; })), ens.map(e => [e.uid, e.piezas.map(q => { const r = pieza(q.id); return r ? [r.x, r.y, r.z, r.w, r.h, r.d] : 0; })])]);
  const c0 = cacheForma.get(p.id); if (c0 && c0.key === key) return c0.s;
  let res = null;
  try {
    const R = matInc(p), pv = pivoteInc(p), inc = inclinada(p), t = pv.map((v, i) => v - apl3(R, pv)[i]);
    const ext = [0, 0, 0];
    if (inc && p.inc.horiz) {                           // la madera de partida es más larga: luego se corta en horizontal
      const th = Math.max(Math.abs(p.inc.ax || 0), Math.abs(p.inc.az || 0)) * Math.PI / 180;
      ext[1] = p.h * (1 / Math.cos(th) - 1) + Math.max(p.w, p.d) * Math.tan(th) + 1;
    }
    const x0 = -p.w / 2 - ext[0], x1 = p.w / 2 + ext[0], y0 = -p.h / 2 - ext[1], y1 = p.h / 2 + ext[1], z0 = -p.d / 2 - ext[2], z1 = p.d / 2 + ext[2];
    let s = CSG.box(x0, y0, z0, x1, y1, z1);
    // redondeos (en la caja sin girar)
    if (p.redondeo) for (const k of EJ3) {
      const o = p.redondeo[k]; if (!o || !(+o.r > 0)) continue;
      const lim = { x: [x0, x1], y: [y0, y1], z: [z0, z1] }, [a, b] = EJ3.filter(e => e !== k);
      s = s.intersect(CSG.prism(k, rectRedondeado(lim[a][0], lim[b][0], lim[a][1], lim[b][1], o.r / 10, o.m || '1111'), lim[k][0] - 1, lim[k][1] + 1));
    }
    // ensambles (solo en piezas sin girar)
    if (ens.length) {
      const c = [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2], add = [], sub = [];
      for (const e of ens) {
        const q = e.piezas.find(x => x.id === p.id), M = mapaEnsamble(e); if (!M) continue;
        const f = (x, y, z) => { const w = M.f(x, y, z); return [w[0] / 10 - c[0], w[1] / 10 - c[1], w[2] / 10 - c[2]]; };
        if (q.ops.add.length) add.push(CSG.deDatos(q.ops.add, f, M.espejo));
        if (q.ops.sub.length) sub.push(CSG.deDatos(q.ops.sub, f, M.espejo));
      }
      add.forEach(a => s = s.union(a)); sub.forEach(b => s = s.subtract(b));
    }
    // cortes (guardados en el mundo) → al sistema de la pieza: q_mun = R·q_loc + t
    const Rt = tras3(R), planos = cortesDe(p).map(k => ({ n: k.n, c: k.c }));
    if (inc && p.inc.horiz) planos.push({ n: [0, 1, 0], c: p.h / 2 }, { n: [0, -1, 0], c: p.h / 2 });
    for (const k of planos) { const nl = apl3(Rt, k.n), cl = k.c - (k.n[0] * t[0] + k.n[1] * t[1] + k.n[2] * t[2]); s = s.subtract(semiespacio(nl, cl)); }
    res = { loc: s, mun: inc ? CSG.transform(s, R, t) : s, R, t };
  } catch (err) { console.error('Forma de', p.nombre, err); res = null; }
  cacheForma.set(p.id, { key, s: res }); return res;
}
// compatibilidad con el código de los ensambles: el sólido en el mundo
function solidoEnsamble(p) { const s = solidoPieza(p); return s ? s.mun : null; }
// caja (x0…z1, cm de mundo) que ocupa de verdad la pieza
function cajaReal(p) {
  const s = solidoPieza(p); if (!s) return { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h, z0: p.z, z1: p.z + p.d };
  const b = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 }, c = [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2];
  s.mun.polys.forEach(pl => pl.verts.forEach(v => { const q = [v.pos.x + c[0], v.pos.y + c[1], v.pos.z + c[2]]; EJ3.forEach((k, i) => { b[k + '0'] = Math.min(b[k + '0'], q[i]); b[k + '1'] = Math.max(b[k + '1'], q[i]); }); }));
  return b;
}
// medidas de la madera de partida (mm, en los ejes de la pieza sin girar) y ángulos de los cortes
function medidasForma(p) {
  const s = solidoPieza(p); if (!s) return null;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  s.loc.polys.forEach(pl => pl.verts.forEach(v => [v.pos.x, v.pos.y, v.pos.z].forEach((q, i) => { mn[i] = Math.min(mn[i], q); mx[i] = Math.max(mx[i], q); })));
  return { dim: [0, 1, 2].map(i => Math.round((mx[i] - mn[i]) * 100) / 10), angulos: angulosCortes(p, s) };
}
function angulosCortes(p, s) {
  const th = ejeGrosor(p), eL = EJ3.filter(k => k !== th).sort((a, b) => med(p, b) - med(p, a))[0], eA = EJ3.find(k => k !== th && k !== eL), I = { x: 0, y: 1, z: 2 }, out = [];
  const planos = cortesDe(p).map(k => k.n);
  if (inclinada(p) && p.inc.horiz) planos.push([0, 1, 0], [0, -1, 0]);
  const vistos = new Set();
  for (const n0 of planos) {
    const L0 = Math.hypot(...n0), nl = apl3(s.R ? tras3(s.R) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]], n0.map(v => v / L0));
    const nL = Math.abs(nl[I[eL]]), nA = Math.abs(nl[I[eA]]), nG = Math.abs(nl[I[th]]), g = v => String(Math.round(v * 1800 / Math.PI) / 10).replace('.', ',');
    let t;
    if (nL >= nA - 1e-6 && nL >= nG - 1e-6) t = 'Testa: ' + (nA > 1e-3 ? 'inglete ' + g(Math.atan2(nA, nL)) + '°' : '') + (nA > 1e-3 && nG > 1e-3 ? ' · ' : '') + (nG > 1e-3 ? 'bisel ' + g(Math.asin(Math.min(1, nG))) + '°' : '') + (nA <= 1e-3 && nG <= 1e-3 ? 'recta' : '');
    else if (nA >= nG - 1e-6) t = 'Canto: ' + (nG > 1e-3 ? 'bisel ' + g(Math.atan2(nG, nA)) + '°' : '') + (nG > 1e-3 && nL > 1e-3 ? ' · ' : '') + (nL > 1e-3 ? 'inglete ' + g(Math.atan2(nL, nA)) + '°' : '') + (nG <= 1e-3 && nL <= 1e-3 ? 'recto' : '');
    else t = 'Cara: rebaje a ' + g(Math.acos(Math.min(1, nG))) + '°';
    if (!vistos.has(t)) { vistos.add(t); out.push(t); }
  }
  return out;
}

/* ---------- las piezas con forma en las vistas 2D: caras que miran al observador y aristas ---------- */
const cacheVistaForma = new Map();
function vistaForma(V, p) {
  const s = solidoPieza(p); if (!s) return null;
  const key = V.clave + V.h + V.v + V.frente + '|' + (cacheForma.get(p.id) || {}).key;
  const c0 = cacheVistaForma.get(p.id + V.clave); if (c0 && c0.key === key) return c0.r;
  const c = { x: p.x + p.w / 2, y: p.y + p.h / 2, z: p.z + p.d / 2 }, I = { x: 0, y: 1, z: 2 };
  const caras = [];
  s.mun.polys.forEach(pl => { const nv = [pl.plane.normal.x, pl.plane.normal.y, pl.plane.normal.z][I[V.prof]] * V.frente; if (nv > 1e-6) caras.push(pl.verts.map(v => { const q = [v.pos.x, v.pos.y, v.pos.z]; return [q[I[V.h]] + c[V.h], q[I[V.v]] + c[V.v]]; })); });
  // aristas: se ven si alguna de sus caras mira al observador y nada las tapa
  const segs = [], ES = CSG.edgeSegs(s.mun), cosT = Math.cos(20 * Math.PI / 180);
  ES.forEach(e => {
    if (!CSG.isFeature(e, cosT)) return;
    const A = [e.a[V.h] + c[V.h], e.a[V.v] + c[V.v]], B = [e.b[V.h] + c[V.h], e.b[V.v] + c[V.v]];
    if (Math.hypot(A[0] - B[0], A[1] - B[1]) < .02) return;
    const mira = e.ns.some(n => n[V.prof] * V.frente > 1e-6), prof = Math.max(e.a[V.prof] + c[V.prof], e.b[V.prof] + c[V.prof]) * V.frente;
    segs.push({ A, B, mira, prof });
  });
  const otras = P.piezas.filter(q => q.visible && q !== p && q.forma !== 'cilindro'), vis = [], ocu = [];
  for (const g of segs) {
    if (!g.mira) { ocu.push([g.A, g.B]); continue; }
    let tap = [];
    for (const q of otras) {
      if (cercaniaReal(V, q) <= g.prof + .02) continue;
      tap.push(...tramosDentro(g.A, g.B, siluetaVista(V, q), .005));
    }
    tap = unirIntervalos(tap);
    let t = 0; const pt = u => [g.A[0] + (g.B[0] - g.A[0]) * u, g.A[1] + (g.B[1] - g.A[1]) * u];
    for (const [t0, t1] of tap) { if (t0 > t + 1e-6) vis.push([pt(t), pt(t0)]); ocu.push([pt(t0), pt(t1)]); t = t1; }
    if (t < 1 - 1e-6) vis.push([pt(t), pt(1)]);
  }
  const r = { caras, vis, ocu };
  cacheVistaForma.set(p.id + V.clave, { key, r }); return r;
}
function cercaniaReal(V, q) { if (!especial(q)) return cercania(V, q); const b = cajaReal(q); return V.frente > 0 ? b[V.prof + '1'] : -b[V.prof + '0']; }
function siluetaVista(V, q) {   // para tapar: el rectángulo de la caja que ocupa (aproximado en las piezas giradas)
  const b = especial(q) ? cajaReal(q) : { [V.h + '0']: q[V.h], [V.h + '1']: q[V.h] + q[DIM[V.h]], [V.v + '0']: q[V.v], [V.v + '1']: q[V.v] + q[DIM[V.v]] };
  return [[b[V.h + '0'], b[V.v + '0']], [b[V.h + '1'], b[V.v + '0']], [b[V.h + '1'], b[V.v + '1']], [b[V.h + '0'], b[V.v + '1']]];
}
function trazarForma(c, V, p) {   // camino de la pieza con forma: sus caras de delante
  const r = vistaForma(V, p); if (!r) return false;
  c.beginPath();
  for (const f of r.caras) f.forEach((q, i) => { const [x, y] = w2s(V, q[0], q[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }), c.closePath();
  return true;
}
function rayasForma(c, V, p) {
  const r = vistaForma(V, p); if (!r) return;
  const tx = estilo('--texto'); c.strokeStyle = tx; c.lineWidth = 1;
  c.beginPath(); for (const [a, b] of r.vis) { const A = w2s(V, a[0], a[1]), B = w2s(V, b[0], b[1]); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); } c.stroke();
  c.setLineDash([4, 3]); c.globalAlpha = .55;
  c.beginPath(); for (const [a, b] of r.ocu) { const A = w2s(V, a[0], a[1]), B = w2s(V, b[0], b[1]); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); } c.stroke();
  c.setLineDash([]); c.globalAlpha = 1;
}

/* ---------- panel: inclinación y redondeos ---------- */
function pintarForma() {
  const caja = $('#formaSec'); if (!caja) return;
  const L = seleccionadas().filter(p => p.forma === 'caja' && !tieneContorno(p));
  caja.classList.toggle('oculto', !L.length); if (!L.length) return;
  const p = L[0], act = document.activeElement, set = (id, v) => { const e = $(id); if (e && e !== act) { if (e.type === 'checkbox') e.checked = !!v; else e.value = v; } };
  const inc = p.inc || {};
  set('#fAx', inc.ax || 0); set('#fAz', inc.az || 0); set('#fPiv', inc.piv || 'arriba'); set('#fHoriz', inc.horiz !== false);
  EJ3.forEach(k => { const o = (p.redondeo || {})[k] || {}; set('#fR' + k, o.r || 0); const m = o.m || '1111'; [0, 1, 2, 3].forEach(i => set('#fM' + k + i, m[i] === '1')); });
  const md = L.length === 1 ? medidasForma(p) : null;
  $('#fInfo').innerHTML = md ? `<div class="fila"><span>Madera de partida</span><b>${md.dim.slice().sort((a, b) => b - a).map(v => String(v).replace('.', ',')).join(' × ')} mm</b></div>` + (md.angulos.length ? `<p class="nota">${md.angulos.join('<br>')}</p>` : '') : '';
  $('#fCortes').textContent = ingletesDe(p.id).length ? 'Quitar el inglete' : conCortes(p) && p.tolvaLado == null ? 'Quitar cortes' : 'Sin ingletes';
  const tg = p.grupo && P.grupos[p.grupo] && P.grupos[p.grupo].tolva; $('#bEditTolva').classList.toggle('oculto', !tg);
  if (tg) $('#fInfo').insertAdjacentHTML('beforeend', '<p class="nota">Pieza de una tolva: sus medidas se cambian con «Editar tolva…».</p>');
  $('#fCortes').disabled = !L.some(conCortes);
}
function aplicarForma() {
  const L = seleccionadas().filter(p => p.forma === 'caja' && !tieneContorno(p)); if (!L.length) return;
  if (L.some(p => ensamblesDe(p.id).length) && (+$('#fAx').value || +$('#fAz').value)) { aviso('Quita antes el ensamble: las piezas con ensamble no se pueden inclinar'); pintarForma(); return; }
  guardarHistoria();
  for (const p of L) {
    const ax = parseFloat($('#fAx').value) || 0, az = parseFloat($('#fAz').value) || 0;
    p.inc = ax || az ? { ax, az, piv: $('#fPiv').value, horiz: $('#fHoriz').checked } : null;
    const r = {};
    EJ3.forEach(k => { const v = parseFloat($('#fR' + k).value) || 0; if (v > 0) r[k] = { r: v, m: [0, 1, 2, 3].map(i => $('#fM' + k + i).checked ? '1' : '0').join('') }; });
    p.redondeo = Object.keys(r).length ? r : null;
  }
  cambio(true);
}
// abre las patas seleccionadas hacia fuera del mueble
function abrirHaciaFuera() {
  const L = seleccionadas().filter(p => p.forma === 'caja'); if (!L.length) return aviso('Selecciona las patas');
  modal('Abrir hacia fuera', `<p>Inclina las ${L.length} piezas seleccionadas para que su extremo de abajo se separe del centro del mueble. Giran sobre su extremo de arriba y se cortan en horizontal arriba y abajo.</p>
    <label class="fila">Ángulo (°) <input type="number" id="hfAng" value="8" step="0.5" min="0" max="45"></label>
    <label class="fila">Dirección <select id="hfDir"><option value="diag">En diagonal (hacia la esquina)</option><option value="lados">Hacia los lados (izquierda / derecha)</option><option value="fondo">Hacia delante y hacia atrás</option></select></label>`,
    [{ txt: 'Cancelar' }, { txt: 'Inclinar', primario: true, fn: () => {
      const a = parseFloat($('#hfAng').value) || 0, dir = $('#hfDir').value, todo = bbox(P.piezas.filter(q => q.visible)), cx = (todo.x0 + todo.x1) / 2, cz = (todo.z0 + todo.z1) / 2;
      guardarHistoria();
      for (const p of L) {
        const sx = Math.sign(p.x + p.w / 2 - cx) || 1, sz = Math.sign(p.z + p.d / 2 - cz) || 1;
        p.inc = { ax: dir === 'lados' ? 0 : -sz * a, az: dir === 'fondo' ? 0 : sx * a, piv: 'arriba', horiz: true };
      }
      cambio(true); aviso('Piezas inclinadas ' + a + '°');
    } }]);
}
function quitarCortes() { const L = seleccionadas().filter(conCortes); if (!L.length) return; guardarHistoria(); const ids = new Set(L.map(p => p.id)); P.ingletes = (P.ingletes || []).filter(g => !g.ids.some(id => ids.has(id))); L.forEach(p => { if (p.tolvaLado == null) p.cortes = null; }); cambio(true); }

/* ---------- inglete entre 2 o 3 piezas que se encuentran en una esquina ----------
   Cada pieza se alarga hasta la esquina de fuera y cada pareja se corta por el plano que va de la arista de dentro a la de fuera. */
function ingleteEsquina() {
  const L = seleccionadas();
  if (L.length < 2 || L.length > 3) return aviso('Selecciona 2 o 3 piezas que se encuentran en una esquina');
  if (L.some(p => p.forma !== 'caja' || tieneContorno(p) || inclinada(p))) return aviso('El inglete es para piezas rectas sin inclinar');
  if (L.some(p => ensamblesDe(p.id).length)) return aviso('Quita antes los ensambles de esas piezas');
  const solape = (a, b, k) => Math.min(fin(a, k), fin(b, k)) - Math.max(ini(a, k), ini(b, k));
  guardarHistoria();
  const alargos = [];
  // 1. la pieza que llega con su testa se alarga a través de la otra, hasta su cara de fuera (solo esta vez)
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    if (EJ3.some(k => solape(a, b, k) < -.05)) continue;
    const c = contactoCajas(a, b); if (!c) continue;
    const dentro = (x, y) => EJ3.filter(k => k !== c.k).every(k => ini(x, k) >= ini(y, k) - .05 && fin(x, k) <= fin(y, k) + .05);
    const [lleg, rec] = dentro(a, b) ? [a, b] : dentro(b, a) ? [b, a] : [a, b], k = c.k;
    alargos.push({ id: lleg.id, ref: rec.id, k, lado: ini(lleg, k) < ini(rec, k) ? 'max' : 'min' });
  }
  alargos.forEach(alargar);
  // 2. se guarda la intención: los planos se recalculan siempre con las medidas que tengan las piezas
  const ids = L.map(p => p.id), n = [...planosInglete(ids).values()].reduce((s, v) => s + v.length, 0) / 2;
  if (!n) { deshacer(); return aviso('No hay uniones en ángulo entre esas piezas'); }
  P.ingletes = (P.ingletes || []).filter(g => !g.ids.some(id => ids.includes(id))).concat([{ uid: nuevoId('i'), ids, alargos }]);
  cambio(true); aviso(`Inglete hecho en ${n} ${n > 1 ? 'uniones' : 'unión'} · se rehace solo si cambias las medidas`);
}
// planos de inglete de un grupo de piezas, con sus medidas de ahora: Map id → [{ n, c }] (relativos al centro de cada pieza)
function planosInglete(ids) {
  const L = ids.map(pieza).filter(Boolean), out = new Map(L.map(p => [p.id, []]));
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], R = {};
    EJ3.forEach(k => { R[k + '0'] = Math.max(ini(a, k), ini(b, k)); R[k + '1'] = Math.min(fin(a, k), fin(b, k)); });
    if (EJ3.some(k => R[k + '1'] - R[k + '0'] < .01)) continue;
    const sale = p => EJ3.map(k => ({ k, v: Math.max(R[k + '0'] - ini(p, k), fin(p, k) - R[k + '1']) })).sort((x, y) => y.v - x.v)[0];
    const ea = sale(a), eb = sale(b); if (ea.k === eb.k || ea.v < .01 || eb.v < .01) continue;
    const ka = ea.k, kb = eb.k, sa = fin(a, ka) - R[ka + '1'] > R[ka + '0'] - ini(a, ka) ? 1 : -1, sb = fin(b, kb) - R[kb + '1'] > R[kb + '0'] - ini(b, kb) ? 1 : -1;
    const ent = (k, s) => s > 0 ? R[k + '1'] : R[k + '0'], opu = (k, s) => s > 0 ? R[k + '0'] : R[k + '1'];
    const O = { [ka]: opu(ka, sa), [kb]: opu(kb, sb) }, In = { [ka]: ent(ka, sa), [kb]: ent(kb, sb) }, Qa = { [ka]: ent(ka, sa), [kb]: opu(kb, sb) };
    const d = [In[ka] - O[ka], In[kb] - O[kb]]; let N = [d[1], -d[0]];
    if (N[0] * (Qa[ka] - O[ka]) + N[1] * (Qa[kb] - O[kb]) < 0) N = N.map(v => -v);
    const Nv = { x: 0, y: 0, z: 0 }; Nv[ka] = N[0]; Nv[kb] = N[1];
    const NO = Nv[ka] * O[ka] + Nv[kb] * O[kb];
    const corta = (p, sg) => { const c = { x: p.x + p.w / 2, y: p.y + p.h / 2, z: p.z + p.d / 2 }, nn = EJ3.map(k => sg * Nv[k]);
      out.get(p.id).push({ n: nn, c: sg * NO - EJ3.reduce((s, k, i) => s + nn[i] * c[k], 0), txt: 'inglete' }); };
    corta(a, -1); corta(b, 1);
  }
  return out;
}
// la pieza que llega se alarga hasta la cara de fuera de la otra (se repite cada vez que cambian las medidas)
function alargar(x) {
  const p = pieza(x.id), r = pieza(x.ref); if (!p || !r) return;
  if (x.lado === 'max') { const L = fin(r, x.k) - p[x.k]; if (L > .01) p[DIM[x.k]] = L; }
  else { const f = fin(p, x.k), o = ini(r, x.k); if (f - o > .01) { p[x.k] = o; p[DIM[x.k]] = f - o; } }
}
function ajustarIngletes() { for (const g of P.ingletes || []) (g.alargos || []).forEach(alargar); }
function ingletesDe(id) { return (P.ingletes || []).filter(g => g.ids.includes(id) && g.ids.every(pieza)); }
// todos los cortes de una pieza: los guardados (tolva) y los de sus ingletes, calculados ahora
function cortesDe(p) {
  const o = (p.cortes || []).slice();
  for (const g of ingletesDe(p.id)) o.push(...(planosInglete(g.ids).get(p.id) || []));
  return o;
}

/* ---------- tolva: cuatro laterales inclinados con ingletes compuestos ---------- */
function abrirTolva(grupo) {
  const t = grupo && P.grupos[grupo] && P.grupos[grupo].tolva || { A: 40, F: 30, H: 25, ang: 15, G: 1.8 };
  modal(grupo ? 'Editar tolva' : 'Tolva (laterales inclinados)', `<p class="nota">Cuatro laterales inclinados hacia fuera, unidos a inglete compuesto, con los cantos de arriba y de abajo en horizontal. Medidas exteriores.</p>
    <label class="fila">Ancho abajo (cm) <input type="number" id="tvA" value="${t.A}" step="0.5"></label>
    <label class="fila">Fondo abajo (cm) <input type="number" id="tvF" value="${t.F}" step="0.5"></label>
    <label class="fila">Alto (cm) <input type="number" id="tvH" value="${t.H}" step="0.5"></label>
    <label class="fila">Inclinación de los lados (°) <input type="number" id="tvI" value="${t.ang}" step="0.5" min="0" max="60"></label>
    <label class="fila">Grueso (cm) <input type="number" id="tvG" value="${t.G}" step="0.1"></label>
    <div id="tvRes" class="nota"></div>`,
    [{ txt: 'Cancelar' }, { txt: grupo ? 'Aplicar' : 'Crear', primario: true, fn: () => crearTolva(grupo) }]);
  const calc = () => { const r = angulosTolva(parseFloat($('#tvI').value) || 0), g = v => String(v).replace('.', ',');
    $('#tvRes').innerHTML = `Sierra (inglete compuesto, 4 lados): <b>inglete ${g(r.inglete)}°</b> · <b>bisel ${g(r.bisel)}°</b>. Cantos de arriba y abajo: bisel ${g(r.canto)}°.`; };
  $('#tvI').oninput = calc; calc();
}
function angulosTolva(gr) { const t = gr * Math.PI / 180, r = v => Math.round(v * 1800 / Math.PI) / 10; return { inglete: r(Math.atan(Math.sin(t) * Math.tan(Math.PI / 4))), bisel: r(Math.asin(Math.cos(t) * Math.sin(Math.PI / 4))), canto: r(t) }; }
// los cuatro laterales a partir de las medidas y del origen (centro de la base): [{ nombre, x, y, z, w, h, d, inc, cortes, veta, lado }]
function generarTolva(t, org) {
  const { A, F, H, G } = t, th = t.ang * Math.PI / 180, sh = H / Math.cos(th), ex = H * Math.tan(th);
  const lados = [['Lateral delantero', [0, 0, 1]], ['Lateral trasero', [0, 0, -1]], ['Lateral izquierdo', [-1, 0, 0]], ['Lateral derecho', [1, 0, 0]]];
  const caraFuera = o => ({ n: [o[0] * Math.cos(th), -Math.sin(th), o[2] * Math.cos(th)], d: (Math.abs(o[0]) * A / 2 + Math.abs(o[2]) * F / 2) * Math.cos(th) + o[0] * org[0] * Math.cos(th) + o[2] * org[2] * Math.cos(th) - Math.sin(th) * org[1] });
  const L = lados.map(([nombre, o], lado) => {
    const largo = o[0] ? 'z' : 'x', fP = caraFuera(o), Lg = (largo === 'x' ? A : F) + 2 * ex + 4;
    const w = largo === 'x' ? Lg : G, d = largo === 'x' ? G : Lg, h = sh + 4;
    const q = { nombre, lado, veta: largo, w, h, d, x: org[0] + o[0] * (A / 2 - G / 2) - w / 2, y: org[1] - 2, z: org[2] + o[2] * (F / 2 - G / 2) - d / 2,
      inc: { ax: largo === 'x' ? o[2] * t.ang : 0, az: largo === 'z' ? -o[0] * t.ang : 0, piv: 'abajo', horiz: false } };
    const Pv = [q.x + w / 2, q.y, q.z + d / 2], dAct = fP.n[0] * Pv[0] + fP.n[1] * Pv[1] + fP.n[2] * Pv[2] + G / 2, dl = (fP.d - dAct) / Math.cos(th);
    q.x += o[0] * dl; q.z += o[2] * dl;
    return { q, o, fP };
  });
  L.forEach(({ q, o, fP }) => {
    const c = [q.x + q.w / 2, q.y + q.h / 2, q.z + q.d / 2], plano = (n, d) => ({ n, c: d - (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) });
    q.cortes = [plano([0, -1, 0], -org[1]), plano([0, 1, 0], org[1] + H)];
    L.forEach(({ o: o2, fP: f2 }) => { if (o2 === o || (o2[0] === -o[0] && o2[2] === -o[2])) return;
      q.cortes.push(Object.assign(plano(fP.n.map((v, k) => f2.n[k] - v), f2.d - fP.d), { txt: 'inglete' })); });
  });
  return L.map(x => x.q);
}
function crearTolva(grupo) {
  const t = { A: parseFloat($('#tvA').value), F: parseFloat($('#tvF').value), H: parseFloat($('#tvH').value), ang: parseFloat($('#tvI').value) || 0, G: parseFloat($('#tvG').value) || 1.8 };
  if (!(t.A > 0 && t.F > 0 && t.H > 0 && t.G > 0 && t.ang >= 0 && t.ang < 60)) return aviso('Medidas no válidas');
  guardarHistoria();
  const G0 = grupo && P.grupos[grupo];
  if (G0 && G0.tolva) {
    // dónde está ahora (si se movió el grupo): se compara el lateral delantero con donde estaría
    const viejo = G0.tolva, prev = generarTolva(viejo, viejo.o)[0], act = piezasGrupo(grupo).find(q => q.tolvaLado === 0);
    const o = act ? [viejo.o[0] + act.x - prev.x, viejo.o[1] + act.y - prev.y, viejo.o[2] + act.z - prev.z] : viejo.o;
    const nuevas = generarTolva(t, o);
    piezasGrupo(grupo).forEach(p => { const q = nuevas[p.tolvaLado]; if (q) Object.assign(p, { x: q.x, y: q.y, z: q.z, w: q.w, h: q.h, d: q.d, inc: q.inc, cortes: q.cortes }); });
    G0.tolva = Object.assign(t, { o });
    cambio(true); return aviso('Tolva actualizada');
  }
  const o = [0, 0, 0], ids = [];
  generarTolva(t, o).forEach(q => { const p = nuevaPieza({ nombre: q.nombre, x: q.x, y: q.y, z: q.z, w: q.w, h: q.h, d: q.d, material: 'pino', veta: q.veta, canto: 0 }); Object.assign(p, { inc: q.inc, cortes: q.cortes, tolvaLado: q.lado }); P.piezas.push(p); ids.push(p.id); });
  const g = nuevoGrupo('Tolva', ids); P.grupos[g].tolva = Object.assign(t, { o });
  sel = new Set(ids); cambio(true); encuadrarTodo();
  aviso('Tolva creada: 4 laterales inclinados ' + String(t.ang).replace('.', ',') + '°');
}

['#fAx', '#fAz', '#fPiv', '#fHoriz'].concat(...EJ3.map(k => ['#fR' + k, ...[0, 1, 2, 3].map(i => '#fM' + k + i)])).forEach(id => { const e = $(id); if (e) e.onchange = aplicarForma; });
$('#bHaciaFuera').onclick = abrirHaciaFuera; $('#bInglete').onclick = ingleteEsquina; $('#fCortes').onclick = quitarCortes; $('#bTolva').onclick = () => abrirTolva(); $('#bEditTolva').onclick = () => { const p = seleccionadas()[0]; if (p && p.grupo) abrirTolva(p.grupo); };

/* ---------- modo básico (lo esencial, para empezar) o avanzado ---------- */
function ponerModo(m) {
  document.body.classList.toggle('basico', m === 'basico');
  $('#bModo').textContent = m === 'basico' ? '🎓 Básico' : '🛠 Avanzado';
  $('#bModo').classList.toggle('activo', m !== 'basico');
  try { localStorage.setItem('boceto3d.modo', m); } catch (e) {}
}
$('#bModo').onclick = () => { const m = document.body.classList.contains('basico') ? 'avanzado' : 'basico'; ponerModo(m); aviso(m === 'basico' ? 'Modo básico: se ocultan inclinación, redondeos, ensambles, cantos por lado y tolva' : 'Modo avanzado: todas las herramientas'); };
(() => { let m = 'avanzado'; try { m = localStorage.getItem('boceto3d.modo') || 'avanzado'; } catch (e) {} ponerModo(m); })();
