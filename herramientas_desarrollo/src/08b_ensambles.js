
/* ---------- Ensambles de madera maciza (versión de prueba) ----------
   Se seleccionan 2 piezas que se tocan (esquina o T) o una pata y sus dos travesaños, y se abre
   assets/ensambles/ensambles.html, que propone los ensambles de la biblioteca de «Ensambles de carpintería 3D».
   Vuelve el ensamble elegido: se guarda en P.ensambles y cada pieza que mete una espiga o un rebaje
   en la otra suma ese sobrelargo a su largo de corte. */
const ENS_URL = 'assets/ensambles/ensambles.html';
let ensVentana = null, ensDatos = null;
function ensamblesDe(id) { return (P.ensambles || []).filter(e => e.piezas.some(q => q.id === id)); }
function sobrelargoDe(id) { return ensamblesDe(id).reduce((s, e) => s + (e.piezas.find(q => q.id === id).extra || 0), 0); }
function depurarEnsambles() { if (P.ensambles) P.ensambles = P.ensambles.filter(e => e.piezas.every(q => pieza(q.id))); }
const EJ3 = ['x', 'y', 'z'], LIM = { x: ['x', 'w'], y: ['y', 'h'], z: ['z', 'd'] };
const ini = (p, k) => p[LIM[k][0]], fin = (p, k) => p[LIM[k][0]] + p[LIM[k][1]], med = (p, k) => p[LIM[k][1]];
const ejeLargo = p => EJ3.reduce((a, k) => med(p, k) > med(p, a) ? k : a, 'x');
const mm = v => Math.round(v * 100) / 10;
function contactoCajas(a, b, tol = .05) {
  for (const k of EJ3) {
    const cara = Math.abs(fin(a, k) - ini(b, k)) < tol ? 'max' : Math.abs(fin(b, k) - ini(a, k)) < tol ? 'min' : null;
    if (!cara) continue;
    if (EJ3.filter(o => o !== k).every(o => Math.min(fin(a, o), fin(b, o)) - Math.max(ini(a, o), ini(b, o)) > tol)) return { k, cara };
  }
  return null;
}
function analizarEnsamble(L) {
  if (L.length < 2 || L.length > 3) return { error: 'Selecciona 2 piezas que se tocan (esquina o T), o una pata y sus dos travesaños.' };
  if (L.some(p => p.forma !== 'caja')) return { error: 'Por ahora los ensambles son solo entre piezas rectas (forma «Caja / tablero»).' };
  if (L.some(p => inclinada(p) || conCortes(p))) return { error: 'Las piezas inclinadas o con ingletes no admiten todavía ensambles de la biblioteca.' };
  if (L.some(p => ['metal', 'metalpint', 'cristal'].includes(infoMaterial(p.material).tipo))) return { error: 'Los ensambles son para piezas de madera: hay una pieza de metal o de cristal en la selección.' };
  const avisos = [];
  if (L.some(p => nucleoDe(p) !== 'macizo')) avisos.push('Alguna pieza no es de madera maciza: los ensambles clásicos son para macizo.');
  const prev = (P.ensambles || []).find(e => e.piezas.length === L.length && L.every(p => e.piezas.some(q => q.id === p.id)));
  const previo = prev ? { id: prev.id, params: prev.params } : null;
  if (L.length === 2) {
    const [A, B] = L, c = contactoCajas(A, B);
    if (!c) return { error: 'Las dos piezas no se tocan. Junta sus caras (el imán ayuda) y vuelve a probar.' };
    const aTesta = ejeLargo(A) === c.k, bTesta = ejeLargo(B) === c.k;
    if (!aTesta && !bTesta) return { error: 'Las piezas se tocan cara con cara, no por la testa de una de ellas: no hay ensamble de la biblioteca para eso.' };
    let llega = bTesta && !aTesta ? B : aTesta && !bTesta ? A : (ejeLargo(A) === 'y' ? B : A);
    const recibe = llega === A ? B : A, kL = ejeLargo(llega), kR = ejeLargo(recibe);
    if (kL === kR) return { error: 'Las piezas están en línea (empalme): la biblioteca no tiene empalmes todavía.' };
    const kN = EJ3.find(k => k !== kL && k !== kR);
    const T = mm(med(llega, kN)), W = mm(med(llega, kR)), W1 = mm(med(recibe, kL)), T1 = mm(med(recibe, kN));
    const esquina = Math.abs(ini(llega, kR) - ini(recibe, kR)) < .05 || Math.abs(fin(llega, kR) - fin(recibe, kR)) < .05;
    if (Math.abs(T - T1) > 1 || Math.abs(W - W1) > 1) avisos.push(`Las piezas no tienen la misma sección (${W1} × ${T1} mm la que recibe, ${W} × ${T} mm la que llega): solo se ofrecen los ensambles que lo admiten, como la caja y espiga o los tarugos.`);
    return { sit: esquina ? 'esquina' : 'T', avisos, previo, medidas: { W, T, W1, T1 },
      piezas: [{ id: recibe.id, nombre: recibe.nombre, rol: 'recibe', L: mm(med(recibe, kR)), A: W1, G: T1 },
        { id: llega.id, nombre: llega.nombre, rol: 'llega', L: mm(med(llega, kL)), A: W, G: T }] };
  }
  // pata y dos travesaños
  const pata = L.find(p => L.filter(q => q !== p).every(q => contactoCajas(p, q)));
  if (!pata) return { error: 'Con 3 piezas, una de ellas (la pata) tiene que tocar a las otras dos.' };
  const tr = L.filter(q => q !== pata), kP = ejeLargo(pata), kA = ejeLargo(tr[0]), kB = ejeLargo(tr[1]);
  if (kA === kB || kA === kP || kB === kP) return { error: 'Los dos travesaños tienen que llegar a la pata en dos caras distintas, en ángulo recto.' };
  if (tr.some(t => contactoCajas(pata, t).k !== ejeLargo(t))) return { error: 'Cada travesaño tiene que llegar a la pata por su testa.' };
  // travesaños a distinta altura (no se cruzan dentro de la pata): dos ensambles, uno detrás de otro
  if (Math.min(fin(tr[0], kP), fin(tr[1], kP)) - Math.max(ini(tr[0], kP), ini(tr[1], kP)) < .05) return { secuencia: tr.map(t => [pata, t]) };
  // tres listones iguales en un nudo: no caben dos cajas; mejor a inglete
  if (tr.some(t => Math.min(...EJ3.filter(k => k !== ejeLargo(t)).map(k => med(t, k))) >= Math.min(...EJ3.filter(q => q !== kP).map(q => med(pata, q))) - .5)) return { error: 'Los travesaños son tan gruesos como la pata: dos cajas no caben. Para un nudo de tres listones iguales usa «◿ Inglete en esquina».' };
  const sec = EJ3.filter(k => k !== kP).map(k => mm(med(pata, k)));
  if (Math.abs(sec[0] - sec[1]) > 1) avisos.push(`La pata no es cuadrada (${sec[0]} × ${sec[1]} mm): se calcula con ${Math.min(...sec)} mm.`);
  const a = tr[0], kt = kB;                                  // grueso del travesaño A: en la dirección del B
  const haciaMas = (ini(tr[1], kt) + fin(tr[1], kt)) / 2 > (ini(pata, kt) + fin(pata, kt)) / 2;
  const re = mm(haciaMas ? ini(a, kt) - ini(pata, kt) : fin(pata, kt) - fin(a, kt));
  const enr = tr.map(t => mm(Math.abs(fin(pata, kP) - fin(t, kP))));
  if (enr.some(v => v > .5)) avisos.push(`Los travesaños no están enrasados arriba con la pata (${enr.join(' y ')} mm). El ensamble los supone enrasados.`);
  const Wr = mm(med(a, kP)), Tr = mm(med(a, kt));
  if (Math.abs(mm(med(tr[1], kP)) - Wr) > 1 || Math.abs(mm(med(tr[1], kA)) - Tr) > 1) avisos.push('Los dos travesaños no tienen la misma sección: se calcula con la del primero.');
  return { sit: 'pata', avisos, previo, medidas: { P: Math.min(...sec), H: mm(med(pata, kP)), Wr, Tr, Lr: mm(med(a, kA)), re: Math.max(0, re) },
    piezas: [{ id: pata.id, nombre: pata.nombre, rol: 'pata', L: mm(med(pata, kP)), A: sec[0], G: sec[1] }]
      .concat(tr.map(t => { const k = ejeLargo(t), o = EJ3.filter(x => x !== k && x !== kP)[0]; return { id: t.id, nombre: t.nombre, rol: 'travesano', L: mm(med(t, k)), A: mm(med(t, kP)), G: mm(med(t, o)) }; })) };
}
let ensCola = [];
function abrirEnsamble() {
  let r = analizarEnsamble(seleccionadas());
  ensCola = [];
  if (r.secuencia) { ensCola = r.secuencia.slice(1); r = analizarEnsamble(r.secuencia[0]); if (!r.error) (r.avisos = r.avisos || []).unshift('Travesaños a distinta altura: primero este y luego el otro (1 de 2).'); }
  if (r.error) return modal('🪵 Ensamble', `<p>${r.error}</p><p class="nota">Ejemplo: en la mesa de comedor, selecciona una pata y las dos cinturas que llegan a ella (Mayús + clic).</p>`, [{ txt: 'Cerrar', primario: true }]);
  ensDatos = r;
  ensVentana = window.open(ENS_URL + '?desde=boceto', '_blank');
  if (!ensVentana) return aviso('El navegador ha bloqueado la pestaña de ensambles');
  aviso('Abriendo los ensambles…');
}
window.addEventListener('message', e => {
  const d = e.data;
  if (!ensVentana || e.source !== ensVentana || !d || typeof d !== 'object') return;
  if (d.tipo === 'ensambles-listo' && ensDatos) ensVentana.postMessage({ tipo: 'boceto-ensamble-envio', datos: ensDatos }, '*');
  if (d.tipo === 'ensamble-resultado' && d.ensamble) {
    const en = d.ensamble; if (!en.piezas.every(q => pieza(q.id))) return aviso('Las piezas del ensamble ya no existen');
    guardarHistoria();
    P.ensambles = (P.ensambles || []).filter(x => !(x.piezas.length === en.piezas.length && en.piezas.every(q => x.piezas.some(y => y.id === q.id))));
    P.ensambles.push(Object.assign({ uid: nuevoId('e') }, en));
    cambio(true);
    if (ensCola.length) {                   // el siguiente travesaño del nudo, en la misma pestaña
      const sig = analizarEnsamble(ensCola.shift());
      if (!sig.error) { (sig.avisos = sig.avisos || []).unshift('Ahora el segundo travesaño (2 de 2).'); ensDatos = sig; ensVentana.postMessage({ tipo: 'boceto-ensamble-envio', datos: sig }, '*'); return; }
      aviso(sig.error);
    }
    window.focus(); ofrecerRepetir(en);
    const ex = en.piezas.filter(q => q.extra).map(q => `${q.nombre} +${String(q.extra).replace('.', ',')} mm`);
    aviso(`Ensamble «${en.nombre}» guardado` + (ex.length ? ' · largo de corte: ' + ex.join(', ') : ''));
  }
  if (d.tipo === 'ensamble-cancelar') window.focus();
});
// las demás patas iguales (mismas medidas, con sus dos travesaños): ofrecer el mismo ensamble
function ofrecerRepetir(en) {
  if (en.sit !== 'pata') return;
  const hechos = new Set((P.ensambles || []).flatMap(e => e.sit === 'pata' ? [e.piezas[0].id] : []));
  const base = analizarEnsamble(en.piezas.map(q => pieza(q.id))), cand = [];
  for (const pt of P.piezas) {
    if (hechos.has(pt.id) || pt.forma !== 'caja' || ejeLargo(pt) !== ejeLargo(pieza(en.piezas[0].id))) continue;
    const tr = P.piezas.filter(q => q !== pt && q.forma === 'caja' && contactoCajas(pt, q) && contactoCajas(pt, q).k === ejeLargo(q));
    if (tr.length !== 2) continue;
    const r = analizarEnsamble([pt, ...tr]);
    if (r.error || JSON.stringify(r.medidas, ['P', 'H', 'Wr', 'Tr', 're']) !== JSON.stringify(base.medidas, ['P', 'H', 'Wr', 'Tr', 're'])) continue;
    cand.push(r);
  }
  if (!cand.length) return;
  modal('🪵 Ensamble', `<p>Hay ${cand.length} pata${cand.length > 1 ? 's' : ''} más igual${cand.length > 1 ? 'es' : ''}, con sus dos travesaños: ${cand.map(r => '<b>' + r.piezas[0].nombre + '</b>').join(', ')}.</p><p>¿Les pongo el mismo ensamble («${en.nombre}», con las mismas medidas)?</p>`,
    [{ txt: 'No' }, { txt: 'Sí, a todas', primario: true, fn: () => {
      guardarHistoria();
      cand.forEach(r => P.ensambles.push(Object.assign({}, JSON.parse(JSON.stringify(en)), { uid: nuevoId('e'),
        piezas: r.piezas.map((q, i) => Object.assign(JSON.parse(JSON.stringify(en.piezas[Math.min(i, en.piezas.length - 1)])), { id: q.id, nombre: q.nombre })) })));
      cambio(true); aviso('Ensamble puesto en ' + (cand.length + 1) + ' patas');
    } }]);
}
function quitarEnsamble(uid) { guardarHistoria(); P.ensambles = (P.ensambles || []).filter(e => e.uid !== uid); cambio(true); }
function pintarEnsambles() {
  const caja = $('#ensLista'); if (!caja) return;
  depurarEnsambles();
  const L = seleccionadas(), ids = new Set(L.map(p => p.id));
  $('#bEnsamble').disabled = L.length < 2 || L.length > 3;
  const lista = (P.ensambles || []).filter(e => e.piezas.some(q => ids.has(q.id)));
  const uno = L.length === 1 ? L[0] : null, ex = uno ? sobrelargoDe(uno.id) : 0;
  let h = '';
  if (uno && ex) { const l = mm(med(uno, ejeLargo(uno))); h += `<div class="fila"><span>Largo de corte</span><b>${String(l + ex).replace('.', ',')} mm</b></div><p class="nota">${String(l).replace('.', ',')} mm de la pieza + ${String(ex).replace('.', ',')} mm de espigas o rebajes.</p>`; }
  h += lista.map(e => `<div class="ensItem"><b>${e.nombre}</b><small>${e.piezas.map(q => q.nombre + (q.extra ? ' (+' + String(q.extra).replace('.', ',') + ' mm)' : '')).join(' · ')}</small>
    <span class="col2"><button data-ens-ed="${e.uid}">✎ Editar</button><button data-ens-q="${e.uid}" class="peligro">✕ Quitar</button></span></div>`).join('');
  if (!h) h = `<p class="nota">${L.length >= 2 ? 'Pulsa «🪵 Ensamble…» para elegir cómo se unen.' : 'Selecciona 2 piezas de macizo que se tocan, o una pata y sus dos travesaños.'}</p>`;
  caja.innerHTML = h;
  caja.querySelectorAll('[data-ens-q]').forEach(b => b.onclick = () => quitarEnsamble(b.dataset.ensQ));
  caja.querySelectorAll('[data-ens-ed]').forEach(b => b.onclick = () => { const e = P.ensambles.find(x => x.uid === b.dataset.ensEd); sel = new Set(e.piezas.map(q => q.id)); cambio(); abrirEnsamble(); });
}
$('#bEnsamble').onclick = abrirEnsamble;

/* ---------- el ensamble en la geometría: espigas, cajas y rebajes ----------
   Cada ensamble guarda, por pieza, lo que se quita y lo que se añade en el sistema del ensamble (mm)
   y el «marco» para llevarlo a las piezas reales, aunque luego se muevan. */
function paridad(pm) { let s = 1; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (pm[i] > pm[j]) s = -s; return s; }
function mapaEnsamble(e) {
  const m = e.marco; if (!m) return null;
  const Pz = e.piezas.map(q => pieza(q.id)); if (Pz.some(x => !x)) return null;
  const I = k => 'xyz'.indexOf(k), cen = (p, k) => (ini(p, k) + fin(p, k)) / 2, ax = [];
  if (m.tipo === 'pata') {
    const [leg, A, B] = Pz, kP = ejeLargo(leg), kA = ejeLargo(A), kB = ejeLargo(B);
    if (new Set([kP, kA, kB]).size < 3) return null;
    const sA = Math.sign(cen(A, kA) - cen(leg, kA)) || 1, sB = Math.sign(cen(B, kB) - cen(leg, kB)) || 1, sP = Math.sign(cen(A, kP) - cen(leg, kP)) || 1;
    ax[I(kA)] = { l: 0, s: sA, aL: 0, aW: (sA > 0 ? ini(leg, kA) : fin(leg, kA)) * 10 };
    ax[I(kP)] = { l: 1, s: sP, aL: m.H, aW: (sP > 0 ? fin(leg, kP) : ini(leg, kP)) * 10 };
    ax[I(kB)] = { l: 2, s: sB, aL: 0, aW: (sB > 0 ? ini(leg, kB) : fin(leg, kB)) * 10 };
  } else {
    const [R, A] = Pz, kR = ejeLargo(R), kL = ejeLargo(A); if (kR === kL) return null;
    const kN = EJ3.find(k => k !== kR && k !== kL);
    const dw = Math.sign(cen(A, kL) - cen(R, kL)) || 1, d = cen(A, kR) - cen(R, kR), ew = Math.abs(d) < .05 ? 0 : Math.sign(d);
    ax[I(kL)] = { l: m.la, s: dw * m.dl, aL: m.cara, aW: (dw > 0 ? fin(R, kL) : ini(R, kL)) * 10 };
    ax[I(kR)] = { l: m.lr, s: m.el && ew ? m.el * ew : 1, aL: m.cA[m.lr], aW: cen(A, kR) * 10 };
    ax[I(kN)] = { l: m.ln, s: 1, aL: m.cA[m.ln], aW: cen(A, kN) * 10 };
  }
  const sg = ax.reduce((s, a) => s * a.s, 1) * paridad(ax.map(a => a.l));
  return { f: (x, y, z) => { const L = [x, y, z]; return ax.map(a => a.s * (L[a.l] - a.aL) + a.aW); }, espejo: sg < 0 };
}
const cacheEns = new Map();
// sólido de la pieza con sus ensambles, en cm y centrado en la pieza (como la malla del 3D); null si no lleva
function solidoEnsamble(p) {
  if (!window.CSG || p.forma !== 'caja' || tieneContorno(p)) return null;
  const L = ensamblesDe(p.id).filter(e => e.marco && e.piezas.some(q => q.id === p.id && q.ops)); if (!L.length) return null;
  const key = JSON.stringify([p.w, p.h, p.d, p.x, p.y, p.z, L.map(e => [e.uid, e.piezas.map(q => { const r = pieza(q.id); return r ? [r.x, r.y, r.z, r.w, r.h, r.d] : 0; })])]);
  const c0 = cacheEns.get(p.id); if (c0 && c0.key === key) return c0.s;
  const c = [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2];
  let s = CSG.box(-p.w / 2, -p.h / 2, -p.d / 2, p.w / 2, p.h / 2, p.d / 2);
  try {
    const add = [], sub = [];
    for (const e of L) {
      const q = e.piezas.find(x => x.id === p.id), M = mapaEnsamble(e); if (!M) continue;
      const f = (x, y, z) => { const w = M.f(x, y, z); return [w[0] / 10 - c[0], w[1] / 10 - c[1], w[2] / 10 - c[2]]; };
      if (q.ops.add.length) add.push(CSG.deDatos(q.ops.add, f, M.espejo));
      if (q.ops.sub.length) sub.push(CSG.deDatos(q.ops.sub, f, M.espejo));
    }
    add.forEach(a => s = s.union(a)); sub.forEach(b => s = s.subtract(b));
  } catch (err) { console.error('Ensamble', p.nombre, err); s = null; }
  cacheEns.set(p.id, { key, s }); return s;
}
// malla del 3D: triángulos agrupados por la cara de la caja a la que miran (+x, −x, +y, −y, +z, −z), como BoxGeometry
function geomEnsamble(s) {
  const a = CSG.toArrays(s), cubo = [[], [], [], [], [], []], cn = [[], [], [], [], [], []];
  for (let i = 0; i < a.pos.length; i += 9) {
    const n = [a.nor[i], a.nor[i + 1], a.nor[i + 2]], k = [0, 1, 2].reduce((m, j) => Math.abs(n[j]) > Math.abs(n[m]) ? j : m, 0), mi = k * 2 + (n[k] < 0 ? 1 : 0);
    for (let j = 0; j < 9; j++) { cubo[mi].push(a.pos[i + j]); cn[mi].push(a.nor[i + j]); }
  }
  const g = new T.BufferGeometry(), pos = [], nor = []; let o = 0;
  cubo.forEach((c, mi) => { if (!c.length) return; pos.push(...c); nor.push(...cn[mi]); g.addGroup(o, c.length / 3, mi); o += c.length / 3; });
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  return g;
}
// para MUEBLECAD: huella de la pieza vista de cara (para el contorno, con la espiga) y aristas de la caja, espiga, retalón…
function caraEnsamble(p, th, eL, eA) {
  const sp = solidoPieza(p), s = sp && sp.loc; if (!s) return null;
  const I = k => 'xyz'.indexOf(k), it = I(th), iL = I(eL), iA = I(eA), half = [p.w / 2, p.h / 2, p.d / 2], r3 = v => Math.round(v * 1000) / 1000;
  const loc = (x, y, z) => { const v = [x, y, z]; return [(v[iL] + half[iL]) * 10, (v[iA] + half[iA]) * 10, (v[it] + half[it]) * 10]; };
  const huella = s.polys.filter(pl => Math.abs(pl.plane.normal[th]) > .99).map(pl => pl.verts.map(v => { const q = loc(v.pos.x, v.pos.y, v.pos.z); return { x: r3(q[0]), y: r3(q[1]) }; }));
  const E = CSG.edges(s, 20), G = med(p, th) * 10, Lm = med(p, eL) * 10, Am = med(p, eA) * 10, vistas = new Map();
  for (let i = 0; i < E.length; i += 6) {
    const a = loc(E[i], E[i + 1], E[i + 2]), b = loc(E[i + 3], E[i + 4], E[i + 5]);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .05) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dentro = mx > .05 && mx < Lm - .05 && my > .05 && my < Am - .05;
    const oculta = dentro && Math.max(a[2], b[2]) < G - .05 ? 1 : 0;
    const A2 = [r3(a[0]), r3(a[1])], B2 = [r3(b[0]), r3(b[1])], k = [A2.join(','), B2.join(',')].sort().join('|');
    if (!vistas.has(k) || (vistas.get(k).o && !oculta)) vistas.set(k, { a: A2, b: B2, o: oculta });
  }
  return { huella, lineas: [...vistas.values()] };
}

/* ---------- el ensamble en las vistas 2D de Boceto: aristas de cajas, espigas y rebajes ----------
   Continuas si se ven; a trazos si las tapa la propia pieza u otra que está delante. */
const cacheVistaEns = new Map();
function aristasEnsambleVista(V, p) {
  const s = solidoEnsamble(p); if (!s) return null;
  const key = V.h + V.v + V.prof + V.frente + '|' + (cacheEns.get(p.id) || {}).key;
  const c0 = cacheVistaEns.get(p.id + V.clave); if (c0 && c0.key === key) return c0.r;
  const E = CSG.edges(s, 20), cx = { x: p.x + p.w / 2, y: p.y + p.h / 2, z: p.z + p.d / 2 }, I = { x: 0, y: 1, z: 2 };
  const pr = (i, k) => E[i + I[k]] + cx[k], r = rectVista(V, p), segs = [];
  const enBorde = (a, b) => [[0, r.a0], [0, r.a1], [1, r.b0], [1, r.b1]].some(([k, v]) => Math.abs(a[k] - v) < .02 && Math.abs(b[k] - v) < .02 && (k ? a[0] >= r.a0 - .02 && a[0] <= r.a1 + .02 && b[0] >= r.a0 - .02 && b[0] <= r.a1 + .02 : a[1] >= r.b0 - .02 && a[1] <= r.b1 + .02 && b[1] >= r.b0 - .02 && b[1] <= r.b1 + .02));
  for (let i = 0; i < E.length; i += 6) {
    const A = [pr(i, V.h), pr(i, V.v)], B = [pr(i + 3, V.h), pr(i + 3, V.v)];
    if (Math.hypot(A[0] - B[0], A[1] - B[1]) < .02 || enBorde(A, B)) continue;
    const prof = Math.max(pr(i, V.prof) * V.frente, pr(i + 3, V.prof) * V.frente);
    segs.push({ A, B, prof });
  }
  // ocultación: la propia pieza (si la arista no está en su cara de delante) y las piezas que tiene delante
  const vis = [], ocu = [], otras = P.piezas.filter(q => q.visible && q !== p && q.forma !== 'cilindro');
  for (const g of segs) {
    let tap = [];
    for (const q of [p, ...otras]) {
      if (cercania(V, q) <= g.prof + .02) continue;
      const rr = rectVista(V, q), L = [[rr.a0, rr.b0], [rr.a1, rr.b0], [rr.a1, rr.b1], [rr.a0, rr.b1]];
      tap.push(...tramosDentro(g.A, g.B, L, .005));
    }
    tap = unirIntervalos(tap);
    let t = 0; const pt = u => [g.A[0] + (g.B[0] - g.A[0]) * u, g.A[1] + (g.B[1] - g.A[1]) * u];
    for (const [t0, t1] of tap) { if (t0 > t + 1e-6) vis.push([pt(t), pt(t0)]); ocu.push([pt(t0), pt(t1)]); t = t1; }
    if (t < 1 - 1e-6) vis.push([pt(t), pt(1)]);
  }
  const res = { vis, ocu };
  cacheVistaEns.set(p.id + V.clave, { key, r: res });
  return res;
}
function dibujarEnsamblesVista(c, V) {
  if (!(P.ensambles || []).length) return;
  const tx = estilo('--texto');
  for (const p of P.piezas) {
    if (!p.visible || !ensamblesDe(p.id).length) continue;
    const r = aristasEnsambleVista(V, p); if (!r) continue;
    c.strokeStyle = tx; c.lineWidth = 1;
    c.beginPath(); for (const [a, b] of r.vis) { const A = w2s(V, a[0], a[1]), B = w2s(V, b[0], b[1]); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); } c.stroke();
    c.setLineDash([4, 3]); c.globalAlpha = .7;
    c.beginPath(); for (const [a, b] of r.ocu) { const A = w2s(V, a[0], a[1]), B = w2s(V, b[0], b[1]); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); } c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
  }
}

/* ---------- forma de la pieza para agrupar en MUEBLECAD ----------
   Dos piezas son iguales si una, girada, coincide con la otra (medidas, veta, cantos, taladros y ensambles);
   «simétricas» si coinciden reflejadas. Devuelve dos firmas: igual (solo giros) y sim (giros y simetrías). */
function firmaForma(p, tal, th, eL, eA) {
  const I = { x: 0, y: 1, z: 2 }, D = [p.w * 10, p.h * 10, p.d * 10], els = [];
  const cara3 = (a, b, t) => { const q = [0, 0, 0]; q[I[eL]] = a; q[I[eA]] = b; q[I[th]] = t; return q; };
  const G = D[I[th]];
  if (infoMaterial(p.material).tipo === 'madera') { const v = I[ejeVeta(p)], a = D.map(x => x / 2), b = a.slice(); a[v] -= 10; b[v] += 10; els.push(['v', a, b]); }
  if (llevaCanto(p)) ladosCanto(p).forEach(l => { const v = cantoLado(p, l); if (!v) return; const q = D.map(x => x / 2); q[I[l[0]]] = l[1] === '+' ? D[I[l[0]]] : 0; els.push(['c' + v, q, q]); });
  (tal || []).forEach(t => {
    if (t.tipo === 'canto') { const a = cara3(t.a, t.b, G / 2), b = cara3(t.a + t.dir.x * t.prof, t.b + t.dir.y * t.prof, G / 2); els.push(['h' + t.d, a, b]); }
    else { const z0 = t.cara === 'A' ? G : 0, z1 = t.cara === 'A' ? G - t.prof : t.prof; els.push(['h' + t.d, cara3(t.a, t.b, z0), cara3(t.a, t.b, z1)]); }
  });
  const sp = solidoPieza(p), s = sp && sp.loc;
  if (s) { const E = CSG.edges(s, 20), sg = []; for (let i = 0; i < E.length; i += 6) sg.push([[0, 1, 2].map(k => E[i + k] * 10 + D[k] / 2), [0, 1, 2].map(k => E[i + 3 + k] * 10 + D[k] / 2)]); fundirTramos(sg).forEach(([a, b]) => els.push(['e', a, b])); }
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let igual = null, sim = null;
  for (const pm of perms) {
    if (pm.some((j, i) => Math.abs(D[j] - D[i]) > .05)) continue;
    for (let sg = 0; sg < 8; sg++) {
      const sgn = [0, 1, 2].map(i => (sg >> i) & 1 ? -1 : 1), det = sgn[0] * sgn[1] * sgn[2] * paridad(pm);
      const tf = q => { const o = [0, 0, 0]; for (let i = 0; i < 3; i++) o[pm[i]] = sgn[i] > 0 ? q[i] : D[i] - q[i]; return o.map(v => Math.round(v * 2) / 2 + 0); };
      const txt = els.map(([k, a, b]) => { const A = tf(a).join(','), B = tf(b).join(','); return k + ':' + (A < B ? A + ';' + B : B + ';' + A); }).sort().join('|');
      if (det > 0 && (igual === null || txt < igual)) igual = txt;
      if (sim === null || txt < sim) sim = txt;
    }
  }
  return { igual: hashTexto(igual || ''), sim: hashTexto(sim || '') };
}
function hashTexto(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length.toString(36); }

// une los tramos que están sobre la misma recta y se tocan (el CSG parte las aristas de forma distinta según la operación)
function fundirTramos(L) {
  const R = new Map(), r = v => Math.round(v * 10) / 10;
  for (const [a, b] of L) {
    let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const n = Math.hypot(...d); if (n < .05) continue;
    d = d.map(x => x / n); const k0 = d.findIndex(x => Math.abs(x) > 1e-6); if (d[k0] < 0) d = d.map(x => -x);
    const ta = a[0] * d[0] + a[1] * d[1] + a[2] * d[2], tb = b[0] * d[0] + b[1] * d[1] + b[2] * d[2];
    const o = [0, 1, 2].map(k => a[k] - ta * d[k]), key = d.map(x => Math.round(x * 1e4)).join(',') + '|' + o.map(r).join(',');
    if (!R.has(key)) R.set(key, { d, o, iv: [] }); R.get(key).iv.push([Math.min(ta, tb), Math.max(ta, tb)]);
  }
  const out = [];
  for (const { d, o, iv } of R.values()) {
    iv.sort((x, y) => x[0] - y[0]); const m = [];
    for (const i of iv) { if (m.length && i[0] <= m[m.length - 1][1] + .05) m[m.length - 1][1] = Math.max(m[m.length - 1][1], i[1]); else m.push(i.slice()); }
    m.forEach(([t0, t1]) => out.push([o.map((v, k) => v + d[k] * t0), o.map((v, k) => v + d[k] * t1)]));
  }
  return out;
}
