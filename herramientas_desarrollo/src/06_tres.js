
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
// ---------- grueso del canto en cada lado (mm; 0 = sin canto). Lados por su dirección: x- izquierdo, x+ derecho… ----------
const LADOS_CANTO = { 'x-': 'Izquierdo', 'x+': 'Derecho', 'y-': 'Inferior', 'y+': 'Superior', 'z-': 'Trasero', 'z+': 'Delantero' };
const GRUESOS_CANTO = [0, .4, .8, 1, 2, 3];
function llevaCanto(p) { const m = infoMaterial(p.material); return p.forma !== 'cilindro' && !['metal', 'metalpint', 'cristal'].includes(m.tipo) && nucleoDe(p) !== 'macizo' && p.cantos !== 'sin'; }
function ladosCanto(p) { const th = ejeGrosor(p); return Object.keys(LADOS_CANTO).filter(k => k[0] !== th); }
function cantoLado(p, l) { if (!llevaCanto(p)) return 0; const v = p.cantoG && p.cantoG[l]; return v == null ? 1 : +v; }
function resumenCantos(p) { // «1 mm» si todos iguales; si no, «delantero 2 mm, resto 1 mm» o lado a lado
  const L = ladosCanto(p), v = L.map(l => cantoLado(p, l)), f = x => String(x).replace('.', ',') + ' mm';
  if (v.every(x => x === v[0])) return v[0] ? f(v[0]) : 'sin canto';
  const cuenta = {}; v.forEach(x => cuenta[x] = (cuenta[x] || 0) + 1);
  const comun = +Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
  const d = L.filter((l, i) => v[i] !== comun).map(l => LADOS_CANTO[l].toLowerCase() + ' ' + (cantoLado(p, l) ? f(cantoLado(p, l)) : 'sin canto'));
  return d.join(', ') + ', resto ' + (comun ? f(comun) : 'sin canto');
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
  const th = 'xyz'.indexOf(ejeGrosor(p)), nuc = nucleoDe(p);
  // caras de la caja: +x, -x, +y, -y, +z, -z; un lado sin canto enseña el alma
  return [0, 1, 2, 3, 4, 5].map(i => (i >> 1) === th ? cara : (llevaCanto(p) && !cantoLado(p, 'xyz'[i >> 1] + (i & 1 ? '-' : '+')) ? matAlma(nuc) : canto));
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
