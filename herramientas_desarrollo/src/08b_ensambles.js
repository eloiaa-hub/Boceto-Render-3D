
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
    if (Math.abs(T - T1) > 1) avisos.push(`Las piezas no tienen el mismo grueso (${T} y ${T1} mm). Los ensambles de bastidor lo suponen igual: se calcula con ${T} mm.`);
    if (Math.abs(W - W1) > 1) avisos.push(`Anchos distintos (${W1} mm la pieza que recibe, ${W} mm la que llega). La caja y espiga con retalón admite anchos distintos; los demás ensambles se calculan con el de la que llega.`);
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
function abrirEnsamble() {
  const r = analizarEnsamble(seleccionadas());
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
    cambio(true); window.focus(); ofrecerRepetir(en);
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
      const ex = en.piezas.find(q => q.extra) || { extra: 0 };
      cand.forEach(r => P.ensambles.push(Object.assign({}, JSON.parse(JSON.stringify(en)), { uid: nuevoId('e'),
        piezas: r.piezas.map((q, i) => ({ id: q.id, nombre: q.nombre, parte: en.piezas[Math.min(i, en.piezas.length - 1)].parte, extra: i ? ex.extra : 0 })) })));
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
