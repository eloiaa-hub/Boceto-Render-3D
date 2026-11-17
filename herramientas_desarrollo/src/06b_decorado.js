
/* ---------- decorado de la escena: suelos y paredes hechos en el momento ----------
   Los suelos de madera se componen con las maderas escaneadas (TEXTURAS_PBR): lamas una a una, cada una
   de un trozo distinto de la madera y con su tono, con la junta biselada en el relieve. Las texturas se
   repiten sin costura (el dibujo es periódico). Todo se hace en un lienzo: funciona sin conexión. */
const SUELOS = {
  tarima_roble: { n: 'Tarima de roble', tipo: 'tarima', madera: 'roble' },
  tarima_arce: { n: 'Tarima de arce (nórdico)', tipo: 'tarima', madera: 'arce' },
  tarima_nogal: { n: 'Tarima de nogal', tipo: 'tarima', madera: 'nogal' },
  tarima_pino: { n: 'Tarima de pino', tipo: 'tarima', madera: 'pino_barnizado' },
  espiga_roble: { n: 'Espiga de roble', tipo: 'espiga', madera: 'roble' },
  espiga_nogal: { n: 'Espiga de nogal', tipo: 'espiga', madera: 'nogal' },
  hormigon: { n: 'Hormigón pulido', tipo: 'hormigon' },
  baldosa: { n: 'Baldosa de 60 × 60', tipo: 'baldosa' },
  clasico: { n: 'Parquet clásico (el de antes)', tipo: 'clasico' }
};
const PAREDES = {
  lisa: { n: 'Lisa (pintada)' }, ladrillo: { n: 'Ladrillo visto' }, azulejo: { n: 'Azulejo metro blanco' },
  listones: { n: 'Listones de roble' }, ninguna: { n: 'Sin pared' }
};
// generador pseudoaleatorio con semilla (el dibujo sale siempre igual)
function azar(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function cargarImagen(src) { return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; }); }
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
// relieve (gris) → mapa de normales
function normalesDeRelieve(alt, fuerza) {
  const w = alt.width, h = alt.height, a = alt.getContext('2d').getImageData(0, 0, w, h).data, out = lienzo(w, h), x = out.getContext('2d'), im = x.createImageData(w, h), d = im.data;
  const H = (i, j) => a[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * fuerza, dy = (H(i, j + 1) - H(i, j - 1)) * fuerza, l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    d[k] = (-dx / l * .5 + .5) * 255; d[k + 1] = (dy / l * .5 + .5) * 255; d[k + 2] = (1 / l * .5 + .5) * 255; d[k + 3] = 255;
  }
  x.putImageData(im, 0, 0); return out;
}
// ruido suave periódico (para hormigón y manchas)
function ruidoPeriodico(w, cel, rnd) {
  const n = Math.max(2, Math.round(w / cel)), G = []; for (let i = 0; i < n * n; i++) G.push(rnd());
  const g = (i, j) => G[((j % n + n) % n) * n + ((i % n + n) % n)], s = t => t * t * (3 - 2 * t);
  return (x, y) => { const fx = x / cel, fy = y / cel, i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j);
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v; };
}
const cacheDecor = {};
/* Devuelve { map, normalMap, roughnessMap, cm } (texturas de lienzo que se rellenan al cargar las maderas).
   cm: lo que mide el dibujo en cm (para repetirlo a escala). */
function texturaDecorado(clave) {
  if (cacheDecor[clave]) return cacheDecor[clave];
  const N = 2048, col = lienzo(N), alt = lienzo(N / 2), rug = lienzo(N / 2);
  const mk = (c, datos) => { const t = new T.CanvasTexture(c); t.colorSpace = datos ? T.NoColorSpace : T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const R = { map: mk(col), normalMap: mk(lienzo(4), true), roughnessMap: mk(rug, true), cm: 240, listo: false };
  cacheDecor[clave] = R;
  const fin = () => { const nm = normalesDeRelieve(alt, R.fuerza || 3); R.normalMap.image = nm; [R.map, R.normalMap, R.roughnessMap].forEach(t => { t.dispose(); t.needsUpdate = true; }); R.listo = true; render3D(); };
  const S = SUELOS[clave], P_ = PAREDES[clave];
  const cx = col.getContext('2d'), ax = alt.getContext('2d'), rx = rug.getContext('2d'), rnd = azar(7 + clave.length * 131);
  if (S && (S.tipo === 'tarima' || S.tipo === 'espiga')) {
    const B = window.TEXTURAS_PBR && TEXTURAS_PBR[S.madera]; if (!B) { R.map.image = lienzo(4); return R; }
    // tarima: lamas de 18 × 140 cm al tresbolillo, en un dibujo de 280 × 270 cm (15 hileras)
    // espiga: tablillas de 9 × 54 cm (6:1) a 45°; el dibujo es de 12·9·√2 × 2·54·√2 cm
    // (el tamaño del lienzo se fija ya: si la textura llega a la tarjeta gráfica con otro tamaño, al cambiarlo quedaba una banda negra)
    const T_ = S.tipo === 'tarima', w = T_ ? 18 : 9, l = T_ ? 140 : 54;
    const anchoCm = T_ ? 2 * l : 12 * w * Math.SQRT2, altoCm = T_ ? 15 * w : 2 * l * Math.SQRT2;
    R.cm = anchoCm; col.height = Math.round(N * altoCm / anchoCm); alt.height = rug.height = Math.round(col.height / 2);
    cargarImagen(B.color).then(img => {
      const pxcm = img.width / (B.cm || 100);                                          // píxeles de la madera por cm
      const k = N / anchoCm, ka = k / 2;
      const lama = (x0, y0, L, W, rot, u, v, tono, brillo) => {   // una lama: en el lienzo de color, de relieve y de rugosidad
        for (const [c, kk, modo] of [[cx, k, 'col'], [ax, ka, 'alt'], [rx, ka, 'rug']]) {
          c.save(); c.translate(x0 * kk, y0 * kk); if (rot) c.rotate(rot);
          const Lp = L * kk, Wp = W * kk;
          if (modo === 'col') {
            c.filter = `brightness(${tono}) saturate(${.92 + brillo * .16})`;
            // la madera mide 100 cm: una lama más larga se hace con dos trozos
            let hecho = 0; while (hecho < L - .01) { const tr = Math.min(L - hecho, (B.cm || 100) * .9); c.drawImage(img, u * pxcm + hecho * pxcm * .37 % (img.width * .1), v * pxcm, tr * pxcm, W * pxcm, hecho * kk, 0, tr * kk + .6, Wp + .6); hecho += tr; }
            c.filter = 'none';
            c.strokeStyle = 'rgba(40,25,10,.45)'; c.lineWidth = Math.max(1, kk * .12); c.strokeRect(0, 0, Lp, Wp);
          } else if (modo === 'alt') {
            const g = c.createLinearGradient(0, 0, 0, Wp); g.addColorStop(0, '#606060'); g.addColorStop(.06, '#d8d8d8'); g.addColorStop(.94, '#d8d8d8'); g.addColorStop(1, '#606060');
            c.fillStyle = g; c.fillRect(0, 0, Lp, Wp);
            const g2 = c.createLinearGradient(0, 0, Lp, 0); g2.addColorStop(0, 'rgba(96,96,96,1)'); g2.addColorStop(Math.min(.5, .4 / L), 'rgba(96,96,96,0)'); g2.addColorStop(Math.max(.5, 1 - .4 / L), 'rgba(96,96,96,0)'); g2.addColorStop(1, 'rgba(96,96,96,1)');
            c.fillStyle = g2; c.fillRect(0, 0, Lp, Wp);
          } else { const r = Math.round(150 + brillo * 50); c.fillStyle = `rgb(${r},${r},${r})`; c.fillRect(0, 0, Lp, Wp); }
          c.restore();
        }
      };
      ax.fillStyle = '#404040'; ax.fillRect(0, 0, alt.width, alt.height); rx.fillStyle = '#a8a8a8'; rx.fillRect(0, 0, rug.width, rug.height);
      const im = { w: img.width / pxcm, h: img.height / pxcm };
      const sorteo = () => ({ u: rnd() * Math.max(0, im.w - Math.min(l, 90)), v: rnd() * Math.max(0, im.h - w), tono: .9 + rnd() * .16, brillo: rnd() });
      if (T_) {
        for (let f = 0; f < 15; f++) {
          const off = rnd() * l, y = f * w;
          const a = sorteo(), b = sorteo();
          for (const dx of [-2 * l, 0, 2 * l]) { lama(off - l + dx, y, l, w, 0, a.u, a.v, a.tono, a.brillo); lama(off + dx, y, l, w, 0, b.u, b.v, b.tono, b.brillo); }
        }
      } else {
        // espiga: celosía (w, w) y (l, −l), con la tablilla vertical [0,w]×[0,l] y la horizontal [w,w+l]×[0,w], todo girado −45°:
        // así el dibujo se repite cada (w·√2, 0) y (0, l·√2) y el lienzo (12 × 2 periodos, con las mismas tablillas en las celdas que se repiten) empalma sin costura
        const giro = (x, y) => [(x + y) * Math.SQRT1_2, (-x + y) * Math.SQRT1_2], clases = [];
        for (let i = -10; i <= 26; i++) for (let j = -3; j <= 4; j++) {
          const ox = i * w + j * l, oy = i * w - j * l;
          const cl = ((i % 12) + 12) % 12 + 12 * (((j % 2) + 2) % 2);                 // misma tablilla en las celdas que se repiten
          const sV = clases[cl * 2] || (clases[cl * 2] = sorteo()), sH = clases[cl * 2 + 1] || (clases[cl * 2 + 1] = sorteo());
          const [vx, vy] = giro(ox + w, oy);          // vertical: desde su esquina (w,0), largo hacia +y (45°), ancho hacia −x
          const [hx, hy] = giro(ox + w, oy);          // horizontal: desde (w,0), largo hacia +x (−45°), ancho hacia +y
          const cerca = (x, y) => x > -l * 1.5 && x < anchoCm + l * 1.5 && y > -l * 1.5 && y < altoCm + l * 1.5;
          if (cerca(vx, vy)) lama(vx, vy, l, w, Math.PI / 4, sV.u, sV.v, sV.tono, sV.brillo);
          if (cerca(hx, hy)) lama(hx, hy, l, w, -Math.PI / 4, sH.u, sH.v, sH.tono, sH.brillo);
        }
      }
      R.fuerza = 4; fin();
    }).catch(() => {});
    return R;
  }
  // suelos y paredes sin madera escaneada
  const W = col.width;
  const ruido = (cel, amp, base, cv) => { const f = ruidoPeriodico(W, cel, rnd), id = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), d = id.data, esc = W / cv.width;
    for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) { const v = f(i * esc, j * esc) * amp, k = (j * cv.width + i) * 4; d[k] += v * base[0]; d[k + 1] += v * base[1]; d[k + 2] += v * base[2]; }
    cv.getContext('2d').putImageData(id, 0, 0); };
  if (clave === 'hormigon') {
    R.cm = 300; cx.fillStyle = '#9d9a95'; cx.fillRect(0, 0, W, W);
    ruido(260, 26, [1, 1, 1], col); ruido(60, 14, [1, .98, .95], col); ruido(7, 12, [1, 1, 1], col); ruido(2.5, 8, [1, 1, 1], col);
    ax.fillStyle = '#808080'; ax.fillRect(0, 0, alt.width, alt.height); ruido(12, 40, [1, 1, 1], alt);
    rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, rug.width, rug.height); ruido(160, 70, [1, 1, 1], rug);
    R.fuerza = 1.2;
  } else if (clave === 'baldosa') {
    R.cm = 240; const n = 4, t = W / n, j = Math.max(2, W / R.cm * .3);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const v = 214 + rnd() * 14; cx.fillStyle = `rgb(${v},${v - 4},${v - 10})`; cx.fillRect(a * t, b * t, t, t); }
    ruido(60, 10, [1, 1, 1], col);
    cx.fillStyle = '#9c968c'; for (let a = 0; a <= n; a++) { cx.fillRect(a * t - j / 2, 0, j, W); cx.fillRect(0, a * t - j / 2, W, j); }
    ax.fillStyle = '#d0d0d0'; ax.fillRect(0, 0, alt.width, alt.height); ax.fillStyle = '#505050'; const ta = alt.width / n, ja = j / 2 + 1;
    for (let a = 0; a <= n; a++) { ax.fillRect(a * ta - ja / 2, 0, ja, alt.width); ax.fillRect(0, a * ta - ja / 2, alt.width, ja); }
    rx.fillStyle = '#5a5a5a'; rx.fillRect(0, 0, rug.width, rug.height); R.fuerza = 3;
  } else if (clave === 'ladrillo') {
    R.cm = 100; const lw = 24, lh = 5.5, jm = 1.1, ppc = W / R.cm, filas = Math.round(R.cm / (lh + jm));
    cx.fillStyle = '#bdb3a5'; cx.fillRect(0, 0, W, W); ax.fillStyle = '#404040'; ax.fillRect(0, 0, alt.width, alt.height);
    rx.fillStyle = '#e0e0e0'; rx.fillRect(0, 0, rug.width, rug.height);
    const fh = W / filas;
    for (let f = 0; f < filas; f++) {
      const off = f % 2 ? (lw + jm) / 2 : 0, n = Math.round(R.cm / (lw + jm)), bw = W / n;
      for (let i = -1; i <= n; i++) {
        const x = i * bw + off * ppc, h = 14 + rnd() * 14, s = 30 + rnd() * 14, lgt = 32 + rnd() * 12;
        cx.fillStyle = `hsl(${h},${s}%,${lgt}%)`; cx.fillRect(x + jm * ppc / 2, f * fh + jm * ppc / 2, bw - jm * ppc, fh - jm * ppc);
        ax.fillStyle = '#c8c8c8'; ax.fillRect((x + jm * ppc) / 2, (f * fh + jm * ppc) / 2, (bw - jm * ppc * 2) / 2, (fh - jm * ppc * 2) / 2);
      }
    }
    ruido(14, 34, [1, .95, .9], col); ruido(5, 20, [1, 1, 1], col); ruido(6, 50, [1, 1, 1], alt); R.fuerza = 5;
  } else if (clave === 'azulejo') {
    R.cm = 60; const tw = 15, th = 7.5, ppc = W / R.cm, j = .25 * ppc, filas = R.cm / th, nc = R.cm / tw;
    cx.fillStyle = '#c9c6c0'; cx.fillRect(0, 0, W, W); ax.fillStyle = '#404040'; ax.fillRect(0, 0, alt.width, alt.height); rx.fillStyle = '#c0c0c0'; rx.fillRect(0, 0, rug.width, rug.height);
    for (let f = 0; f < filas; f++) for (let i = -1; i <= nc; i++) {
      const x = (i * tw + (f % 2 ? tw / 2 : 0)) * ppc, y = f * th * ppc, v = 240 + rnd() * 10;
      cx.fillStyle = `rgb(${v},${v},${v - 2})`; cx.fillRect(x + j / 2, y + j / 2, tw * ppc - j, th * ppc - j);
      const g = ax.createLinearGradient(0, (y + j) / 2, 0, (y + th * ppc - j) / 2); g.addColorStop(0, '#b0b0b0'); g.addColorStop(.12, '#e8e8e8'); g.addColorStop(.88, '#e8e8e8'); g.addColorStop(1, '#b0b0b0');
      ax.fillStyle = g; ax.fillRect((x + j) / 2, (y + j) / 2, (tw * ppc - 2 * j) / 2, (th * ppc - 2 * j) / 2);
      rx.fillStyle = '#262626'; rx.fillRect((x + j) / 2, (y + j) / 2, (tw * ppc - 2 * j) / 2, (th * ppc - 2 * j) / 2);
    }
    R.fuerza = 4;
  } else if (clave === 'listones') {
    R.cm = 60; const B = window.TEXTURAS_PBR && TEXTURAS_PBR.roble; if (!B) return R;
    cargarImagen(B.color).then(img => {
      const pxcm = img.width / (B.cm || 100), ppc = W / R.cm, ls = 4, hueco = 1.5, n = R.cm / (ls + hueco);
      cx.fillStyle = '#2b2219'; cx.fillRect(0, 0, W, W); ax.fillStyle = '#202020'; ax.fillRect(0, 0, alt.width, alt.height); rx.fillStyle = '#909090'; rx.fillRect(0, 0, rug.width, rug.height);
      for (let i = 0; i < n; i++) {
        const x = i * (ls + hueco) * ppc, u = rnd() * (img.width / pxcm - 60), v = rnd() * (img.height / pxcm - ls), t = .9 + rnd() * .2;
        cx.save(); cx.translate(x + ls * ppc, 0); cx.rotate(Math.PI / 2); cx.filter = `brightness(${t})`;
        cx.drawImage(img, u * pxcm, v * pxcm, 60 * pxcm, ls * pxcm, 0, 0, W, ls * ppc); cx.restore();
        const g = ax.createLinearGradient(x / 2, 0, (x + ls * ppc) / 2, 0); g.addColorStop(0, '#707070'); g.addColorStop(.15, '#e0e0e0'); g.addColorStop(.85, '#e0e0e0'); g.addColorStop(1, '#707070');
        ax.fillStyle = g; ax.fillRect(x / 2, 0, ls * ppc / 2, alt.height);
      }
      R.fuerza = 6; fin();
    }).catch(() => {});
    return R;
  }
  fin(); return R;
}
// foto de fondo (escena.background): textura de la imagen que ha elegido el usuario
let texFoto = null, srcFoto = null;
function texturaFotoFondo(src) {
  if (srcFoto === src && texFoto) return texFoto;
  if (texFoto) texFoto.dispose();
  srcFoto = src; texFoto = new T.TextureLoader().load(src, () => render3D()); texFoto.colorSpace = T.SRGBColorSpace;
  return texFoto;
}
// la foto cubre la vista sin deformarse (como object-fit: cover)
function encajarFotoFondo() {
  const t = texFoto; if (!t || !t.image || !t.image.width) return;
  const a = camara.aspect, ai = t.image.width / t.image.height;
  if (a > ai) { t.repeat.set(1, ai / a); t.offset.set(0, (1 - ai / a) / 2); } else { t.repeat.set(a / ai, 1); t.offset.set((1 - a / ai) / 2, 0); }
}
function decoradoHabitacion(E, c, b, r) {
  const L = Math.max(r * 16, 600);
  const s = SUELOS[E.suelo] ? E.suelo : 'tarima_roble';
  let suelo;
  if (s === 'clasico') {
    const tp = textura(window.TEXTURAS.parquet, '_parquet'), gs = new T.PlaneGeometry(L, L); escalarUV(gs, L / 160);
    suelo = new T.Mesh(gs, new T.MeshPhysicalMaterial({ map: tp, roughness: .45, clearcoat: .3, clearcoatRoughness: .2 }));
  } else {
    const D = texturaDecorado(s), gs = new T.PlaneGeometry(L, L); escalarUV(gs, L / D.cm, L / D.cm * (D.map.image.width / Math.max(1, D.map.image.height)));
    const madera = SUELOS[s].tipo === 'tarima' || SUELOS[s].tipo === 'espiga';
    suelo = new T.Mesh(gs, new T.MeshPhysicalMaterial({ map: D.map, normalMap: D.normalMap, normalScale: new T.Vector2(.6, .6), roughnessMap: D.roughnessMap, roughness: 1,
      clearcoat: madera ? .2 : s === 'baldosa' ? .3 : .1, clearcoatRoughness: .45, envMapIntensity: .55 }));
  }
  suelo.rotation.x = -Math.PI / 2; suelo.position.set(c.x, 0, c.z); suelo.receiveShadow = true;
  grupoDecorado.add(suelo, contacto);
  const pw = PAREDES[E.pared] ? E.pared : 'lisa';
  if (pw === 'ninguna') return;
  const Hh = 400, gp = new T.PlaneGeometry(L, Hh);
  let mat;
  if (pw === 'lisa') mat = new T.MeshStandardMaterial({ color: new T.Color(E.colorPared || '#ece7df'), roughness: .95 });
  else { const D = texturaDecorado(pw); escalarUV(gp, L / D.cm, Hh / D.cm); mat = new T.MeshStandardMaterial({ map: D.map, normalMap: D.normalMap, roughnessMap: D.roughnessMap, roughness: 1 }); }
  const pared = new T.Mesh(gp, mat);
  pared.position.set(c.x, Hh / 2, b.z0 - 12); pared.receiveShadow = true;
  grupoDecorado.add(pared);
  if (pw !== 'listones') {
    const rod = new T.Mesh(new T.BoxGeometry(L, 8, 1.4), new T.MeshStandardMaterial({ color: 0xf4f2ee, roughness: .6 }));
    rod.position.set(c.x, 4, b.z0 - 11.3); rod.castShadow = rod.receiveShadow = true; grupoDecorado.add(rod);
  }
}
function pintarOpcionesEscena() {
  const e = P.escena.escenario;
  $('#filaSuelo').classList.toggle('oculto', e !== 'salon'); $('#filaPared').classList.toggle('oculto', e !== 'salon');
  $('#filaColorPared').classList.toggle('oculto', e !== 'salon' || (P.escena.pared || 'lisa') !== 'lisa');
  $('#filaFoto').classList.toggle('oculto', e !== 'foto');
  $('#eSuelo').value = SUELOS[P.escena.suelo] ? P.escena.suelo : 'tarima_roble';
  $('#ePared').value = PAREDES[P.escena.pared] ? P.escena.pared : 'lisa';
  $('#eColorPared').value = P.escena.colorPared || '#ece7df';
}
$('#eSuelo').innerHTML = Object.entries(SUELOS).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
$('#ePared').innerHTML = Object.entries(PAREDES).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
[['#eSuelo', 'suelo'], ['#ePared', 'pared'], ['#eColorPared', 'colorPared']].forEach(([id, k]) => $(id).addEventListener('input', e => { P.escena[k] = e.target.value; pintarOpcionesEscena(); decorado(); render3D(); guardarLocalPronto(); }));
$('#bFotoFondo').onclick = () => $('#fFotoFondo').click();
$('#fFotoFondo').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => cargarImagen(rd.result).then(img => {
    // se guarda reducida (1920 px como mucho) en el proyecto
    const k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = lienzo(Math.round(img.width * k), Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    P.escena.foto = c.toDataURL('image/jpeg', .85); P.escena.escenario = 'foto'; $('#eEscenario').value = 'foto';
    pintarOpcionesEscena(); decorado(); render3D(); guardarLocalPronto(); aviso('Foto de fondo puesta: el mueble deja su sombra encima');
  });
  rd.readAsDataURL(f);
};
