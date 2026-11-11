/* Ensambles para Boceto a Render 3D (versión de prueba)
   Recibe de Boceto las piezas de madera maciza que se unen, propone los ensambles que encajan
   (de la biblioteca de «Ensambles de carpintería 3D»), deja ajustar sus medidas con vista 3D
   y devuelve a Boceto el ensamble elegido con lo que cambia en cada pieza. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const DESDE = new URLSearchParams(location.search).get('desde') === 'boceto';
  const SIT = {
    pata: { t: 'Pata con dos travesaños', ids: ['pataMesa'] },
    esquina: { t: 'Esquina (L)', ids: ['retalon', 'horquilla', 'horquillaInglete', 'mmRecta', 'mmInglete', 'lengueta'] },
    T: { t: 'Unión en T', ids: ['pasante', 'doble', 'acunada', 'tarugos', 'mmT', 'horquillaT', 'mmmilano'] }
  };
  const JM = {}; JOINTS.forEach(j => JM[j.id] = j);
  // Ejemplo para abrir la página sola (sin Boceto): la pata de la mesa de comedor
  const DEMO = {
    sit: 'pata', demo: true,
    piezas: [{ id: 'p', nombre: 'Pata', rol: 'pata', L: 720, A: 70, G: 70 },
      { id: 'a', nombre: 'Cintura delantera', rol: 'travesano', L: 1340, A: 100, G: 22 },
      { id: 'b', nombre: 'Cintura izquierda', rol: 'travesano', L: 640, A: 100, G: 22 }],
    medidas: { P: 70, H: 720, Wr: 100, Tr: 22, Lr: 1340, re: 24 }, avisos: []
  };
  let DAT = null, J = null, P = null;
  const editados = {};                       // medidas cambiadas a mano, por ensamble

  const num = (x, d) => { const k = Math.pow(10, d === undefined ? 1 : d); return (Math.round(x * k) / k).toString().replace('.', ','); };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function aviso(t) { const a = $('aviso'); a.textContent = t; a.classList.add('ver'); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), 3500); }
  const clamp = (v, d) => Math.max(d.min, Math.min(d.max, v));

  /* ---------- medidas: las de Boceto mandan; los largos solo sirven para la vista ---------- */
  function fijas(j) {
    if (j.id === 'pataMesa') return ['P', 'H', 'Wr', 'Tr', 'Lr', 're'];
    if (j.id === 'retalon') return ['W', 'T', 'Wr', 'L1', 'L2'];
    return ['W', 'T', 'L1', 'L2'];
  }
  function valoresReales(j) {                 // lo que se muestra como «de Boceto»
    const m = DAT.medidas, pz = DAT.piezas;
    if (j.id === 'pataMesa') return { P: m.P, H: m.H, Wr: m.Wr, Tr: m.Tr, Lr: m.Lr, re: m.re };
    const r = pz.find(p => p.rol === 'recibe'), l = pz.find(p => p.rol === 'llega');
    if (j.id === 'retalon') return { W: m.W1, T: m.T, Wr: m.W, L1: r && r.L, L2: l && l.L };
    return { W: m.W, T: m.T, L1: r && r.L, L2: l && l.L };
  }
  function parametros(j) {
    const p = {}, defs = {}, m = DAT.medidas;
    j.params.forEach(d => { if (d.k) { p[d.k] = d.v; defs[d.k] = d; } });
    if (j.id === 'pataMesa') {
      Object.assign(p, { P: m.P, Wr: m.Wr, Tr: m.Tr, re: m.re });
      p.H = Math.max(200, m.Wr + 120); p.Lr = Math.max(120, 2 * m.P);
      if (defs.e) p.e = clamp(Math.round(m.Tr / 3), defs.e);
      if (defs.l) p.l = Math.max(10, Math.min(defs.l.v, Math.round(m.P * .6)));
      if (defs.hz) p.hz = Math.min(p.hz, Math.round(m.Wr * .2));
      if (defs.s) p.s = Math.min(p.s, Math.round(m.Wr * .12));
    } else {
      const W = m.W, T = m.T;
      if (j.id === 'retalon') { p.W = m.W1; p.Wr = W; p.L1 = Math.max(200, W + 120); p.L2 = Math.max(150, 2 * m.W1 + 40); }
      else { p.W = W; p.L1 = Math.max(defs.L1 ? defs.L1.v : 180, 3 * W + 60); if ('L2' in p) p.L2 = Math.max(defs.L2.v, 2 * W + 60); }
      p.T = T;
      if (defs.e) p.e = clamp(Math.round(T / 3), defs.e);
      if (defs.l && j.id === 'retalon') p.l = Math.max(10, Math.min(defs.l.v, m.W1 - 12));
      if (defs.d && j.id === 'tarugos') p.d = clamp(Math.round(T / 2.5), defs.d);
    }
    const prev = DAT.previo && DAT.previo.id === j.id ? DAT.previo.params : null;
    Object.assign(p, prev || {}, editados[j.id] || {});
    return p;
  }

  /* ---------- lista de ensambles ---------- */
  function pintarPiezas() {
    const S = SIT[DAT.sit];
    $('piezas').innerHTML = `<p class="nota"><b>${esc(S ? S.t : 'Sin ensambles para estas piezas')}</b>${DAT.demo ? ' · ejemplo (página abierta sin Boceto)' : ''}</p>` +
      DAT.piezas.map(p => `<div class="pz"><b style="grid-column:1/3">${esc(p.nombre)}</b><span>Largo</span>${num(p.L)} mm<span>Sección</span>${num(p.A)} × ${num(p.G)} mm</div>`).join('');
    $('avisosB').innerHTML = (DAT.avisos || []).map(a => `<div class="aviso2">${esc(a)}</div>`).join('');
  }
  function pintarLista() {
    const S = SIT[DAT.sit], ids = S ? S.ids : [];
    $('nEns').textContent = ids.length;
    $('lista').innerHTML = ids.map(id => { const j = JM[id]; return j ? `<div class="ens${J && J.id === id ? ' sel' : ''}" data-id="${id}"><span class="num">n.º ${j.num}</span><b>${esc(j.name)}</b><small>${esc(j.short || '')}</small></div>` : ''; }).join('') ||
      '<p class="nota">No hay ensambles de la biblioteca para esta posición.</p>';
    $('lista').querySelectorAll('.ens').forEach(d => d.onclick = () => elegir(d.dataset.id));
  }
  function elegir(id) {
    J = JM[id]; P = parametros(J); pintarLista();
    $('tit').textContent = J.num + '. ' + J.name; $('desc').textContent = J.desc || '';
    pintarParams(); reconstruir(true);
  }

  /* ---------- panel de medidas ---------- */
  function pintarParams() {
    const fx = fijas(J), real = valoresReales(J);
    let h = '<div class="g">De Boceto</div>';
    J.params.filter(d => d.k && fx.includes(d.k) && real[d.k] != null).forEach(d => h += `<div class="fijo"><span>${esc(d.label)} (${esc(d.sym)})</span><b>${num(real[d.k])} mm</b></div>`);
    let g = '';
    J.params.forEach(d => {
      if (d.g) { g = d.g; return; }
      if (fx.includes(d.k)) return;
      if (g) { h += `<div class="g">${esc(g)}</div>`; g = ''; }
      const st = d.step || (d.max - d.min > 30 ? 1 : 0.5);
      h += `<div class="par"><label>${esc(d.label)} <small>${esc(d.sym)}</small></label><input type="number" data-k="${d.k}" min="${d.min}" max="${d.max}" step="${st}" value="${P[d.k]}">
        <input type="range" data-r="${d.k}" min="${d.min}" max="${d.max}" step="${st}" value="${P[d.k]}"></div>`;
    });
    $('params').innerHTML = h;
    const pon = (k, v) => { P[k] = v; (editados[J.id] = editados[J.id] || {})[k] = v; $('params').querySelector(`[data-k="${k}"]`).value = v; $('params').querySelector(`[data-r="${k}"]`).value = v; reconstruir(false); };
    $('params').querySelectorAll('[data-k]').forEach(i => i.onchange = () => { const v = parseFloat(i.value); if (isFinite(v)) pon(i.dataset.k, v); });
    $('params').querySelectorAll('[data-r]').forEach(i => i.oninput = () => pon(i.dataset.r, parseFloat(i.value)));
  }

  /* ---------- geometría: construir, medir lo que cambia en cada pieza ---------- */
  function caja(solid) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    solid.polys.forEach(p => p.verts.forEach(v => ['x', 'y', 'z'].forEach((k, i) => { mn[i] = Math.min(mn[i], v.pos[k]); mx[i] = Math.max(mx[i], v.pos[k]); })));
    return { mn, mx, t: [0, 1, 2].map(i => mx[i] - mn[i]) };
  }
  // lo que la pieza que llega mete dentro de la otra (espiga, media madera…): se suma a su largo de corte
  function sobrelargo(llega, recibe) {
    const a = caja(llega), b = caja(recibe), ax = a.t.indexOf(Math.max(...a.t));
    const fuera = Math.max(b.mn[ax] - a.mn[ax], a.mx[ax] - b.mx[ax]);
    return Math.max(0, Math.round((a.t[ax] - fuera) * 10) / 10);
  }
  let partes = [], resultado = null;
  function reconstruir(encuadrar) {
    const err = J.validate ? J.validate(P) : '';
    $('msg').innerHTML = err ? `<div class="error">${esc(err)}</div>` : '';
    $('bAplicar').disabled = !!err;
    let defs = [];
    try { defs = J.build(P); } catch (e) { $('msg').innerHTML = `<div class="error">No se puede construir con estas medidas.</div>`; $('bAplicar').disabled = true; return; }
    partes = defs; dibujar(defs, encuadrar);
    const ch = J.check ? J.check(P) : [];
    $('check').innerHTML = ch.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}${r[3] ? ` <b class="${r[2]}">${esc(r[3])}</b>` : ''}</td></tr>`).join('');
    const nota = typeof J.nota === 'function' ? J.nota(P) : (J.nota || '');
    $('nota').textContent = nota;
    // piezas de Boceto ↔ piezas del ensamble
    const recibe = defs.find(d => d.num === 1), llegan = defs.filter(d => d.num === 2 || (J.id === 'pataMesa' && d.num === 3));
    const pzB = DAT.piezas, out = [];
    if (J.id === 'pataMesa') {
      const pata = pzB.find(p => p.rol === 'pata'), trav = pzB.filter(p => p.rol === 'travesano');
      out.push({ id: pata.id, nombre: pata.nombre, parte: recibe.name, extra: 0 });
      trav.forEach((t, i) => { const d = llegan[i] || llegan[0]; out.push({ id: t.id, nombre: t.nombre, parte: d.name, extra: sobrelargo(d.solid, recibe.solid) }); });
    } else {
      const r = pzB.find(p => p.rol === 'recibe'), l = pzB.find(p => p.rol === 'llega');
      out.push({ id: r.id, nombre: r.nombre, parte: recibe.name, extra: 0 });
      if (llegan[0]) out.push({ id: l.id, nombre: l.nombre, parte: llegan[0].name, extra: sobrelargo(llegan[0].solid, recibe.solid) });
    }
    // piezas sueltas: tarugos, cuñas, lengüetas…
    const suelt = {};
    defs.forEach(d => { if (d === recibe || llegan.includes(d)) return; const s = suelt[d.name] || (suelt[d.name] = { n: d.name, qty: 0, fijo: 0, med: '' });
      if (d.qty) s.fijo = Math.max(s.fijo, d.qty); else if (!d.drawSkip) s.qty++;
      if (!s.med) { const t = caja(d.solid).t.slice().sort((a, b) => b - a); s.med = t.map(x => num(x)).join(' × ') + ' mm'; } });
    const sueltas = Object.values(suelt).map(s => ({ n: s.n, qty: Math.max(s.fijo, s.qty) || 1, med: s.med }));
    const editables = {}; J.params.forEach(d => { if (d.k && !fijas(J).includes(d.k)) editables[d.k] = P[d.k]; });
    resultado = { id: J.id, num: J.num, nombre: J.name, sit: DAT.sit, params: editables,
      piezas: out, sueltas, resumen: ch.map(r => [r[0], r[1]]), nota };
    $('resumen').innerHTML = out.map(o => {
      const pb = pzB.find(p => p.id === o.id);
      return `<li><b>${esc(o.nombre)}</b> (${esc(o.parte.toLowerCase())}): ` + (o.extra ? `entra ${num(o.extra)} mm en la otra pieza → largo de corte ${num(pb.L)} + ${num(o.extra)} = <b>${num(pb.L + o.extra)} mm</b> en este extremo` : 'mismo largo; lleva la caja o el rebaje') + '</li>';
    }).join('') + sueltas.map(s => `<li>${s.qty} × ${esc(s.n.toLowerCase())} de ${s.med}</li>`).join('');
  }

  /* ---------- vista 3D ---------- */
  const T = THREE, cont = $('vista');
  const ren = new T.WebGLRenderer({ antialias: true, alpha: true }); ren.setPixelRatio(Math.min(2, devicePixelRatio || 1)); cont.prepend(ren.domElement);
  const esc3 = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, 1, 20000), ctl = new T.OrbitControls(cam, ren.domElement);
  ctl.enableDamping = true;
  esc3.add(new T.HemisphereLight(0xffffff, 0x8a8170, 1.6));
  const sol = new T.DirectionalLight(0xffffff, 1.6); sol.position.set(1, 2, 1.4); esc3.add(sol);
  const sol2 = new T.DirectionalLight(0xffffff, .5); sol2.position.set(-1.5, .5, -1); esc3.add(sol2);
  let grupo = null, meshes = [], centro = new T.Vector3(), radio = 100;
  function dibujar(defs, encuadrar) {
    if (grupo) { esc3.remove(grupo); grupo.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    grupo = new T.Group(); meshes = [];
    const bb = new T.Box3();
    defs.forEach(d => {
      const a = CSG.toArrays(d.solid), g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(a.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(a.nor, 3));
      const eg = new T.BufferGeometry(); eg.setAttribute('position', new T.Float32BufferAttribute(CSG.edges(d.solid, 20), 3));
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: d.wood.color, roughness: .8, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      const s = new T.Group(); s.add(m); s.add(new T.LineSegments(eg, new T.LineBasicMaterial({ color: 0x1b1f22 })));
      g.computeBoundingBox(); bb.union(g.boundingBox);
      const dir = new T.Vector3().fromArray(d.dir || [0, 0, 0]); if (dir.lengthSq()) dir.normalize();
      s.userData = { dir, dist: d.dist || 0 }; grupo.add(s); meshes.push(s);
    });
    esc3.add(grupo); explotar();
    if (encuadrar) { bb.getCenter(centro); radio = bb.getSize(new T.Vector3()).length() / 2 || 100; encuadre(); }
  }
  function explotar() { const t = +$('explota').value; meshes.forEach(s => s.position.copy(s.userData.dir).multiplyScalar(s.userData.dist * t)); }
  function encuadre() {
    ctl.target.copy(centro);
    const d = radio / Math.sin(cam.fov * Math.PI / 360) * 1.1;
    cam.position.copy(centro).add(new T.Vector3(1, .8, 1.25).normalize().multiplyScalar(d));
    cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix(); ctl.update();
  }
  function tam() { const w = cont.clientWidth, h = cont.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
  new ResizeObserver(tam).observe(cont); tam();
  (function bucle() { requestAnimationFrame(bucle); ctl.update(); ren.render(esc3, cam); })();
  $('explota').oninput = explotar; $('bEncuadre').onclick = encuadre;

  /* ---------- conversación con Boceto ---------- */
  function enviar(m) { if (window.opener) try { window.opener.postMessage(m, '*'); } catch (e) {} }
  function iniciar(d) {
    DAT = d; pintarPiezas();
    $('estadoB').textContent = d.demo ? 'Sin Boceto: ejemplo de prueba' : 'Conectado con Boceto';
    const S = SIT[d.sit], prim = d.previo && JM[d.previo.id] ? d.previo.id : S && S.ids[0];
    pintarLista(); if (prim) elegir(prim); else { $('bAplicar').disabled = true; $('tit').textContent = 'Sin ensamble'; }
  }
  $('bAplicar').onclick = () => {
    if (!resultado) return;
    if (!DESDE || !window.opener) { console.log(JSON.stringify(resultado)); aviso('Ejemplo sin Boceto: el resultado se ha escrito en la consola'); return; }
    enviar({ tipo: 'ensamble-resultado', ensamble: resultado }); window.close();
    setTimeout(() => aviso('Ensamble enviado a Boceto. Ya puedes cerrar esta pestaña.'), 300);
  };
  $('bCancelar').onclick = () => { enviar({ tipo: 'ensamble-cancelar' }); if (DESDE) window.close(); };
  addEventListener('message', e => { const m = e.data; if (m && m.tipo === 'boceto-ensamble-envio' && m.datos) iniciar(m.datos); });
  if (DESDE && window.opener) { enviar({ tipo: 'ensambles-listo' }); setTimeout(() => { if (!DAT) iniciar(DEMO); }, 4000); }
  else iniciar(DEMO);
  window.__ens = { iniciar, get resultado() { return resultado; }, elegir };
})();
