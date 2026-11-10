
/* ===================== LÁMINA TÉCNICA (PDF / DXF) Y EXPORTACIÓN AL ANIDADOR ===================== */

/* ---------- geometría de las vistas con aristas ocultas ---------- */
function anillosVista(T, p) { // contornos de la pieza vista desde T, en coordenadas de mundo (a, b)
  const Tp = TIPOS[p.plano];
  if (tieneContorno(p) && Tp.h === T.h && Tp.v === T.v) { const cm = contornoMundo(p); return { anillos: [cm.ext, ...cm.huecos], ocl: cm.ext }; }
  const r = rectVista(T, p);
  if (p.forma === 'cilindro' && p.eje === T.prof) {
    const ca = (r.a0 + r.a1) / 2, cb = (r.b0 + r.b1) / 2, ra = (r.a1 - r.a0) / 2, rb = (r.b1 - r.b0) / 2, L = [];
    for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; L.push([ca + ra * Math.cos(t), cb + rb * Math.sin(t)]); }
    return { anillos: [L], ocl: L };
  }
  const L = [[r.a0, r.b0], [r.a1, r.b0], [r.a1, r.b1], [r.a0, r.b1]];
  return { anillos: [L], ocl: L };
}
function cercania(T, p) { return T.frente > 0 ? p[T.prof] + p[DIM[T.prof]] : -p[T.prof]; }
function distBorde(pt, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i], dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / l2));
    m = Math.min(m, Math.hypot(pt[0] - x1 - t * dx, pt[1] - y1 - t * dy));
  }
  return m;
}
function tramosDentro(A, B, poly, eps) { // intervalos [t0,t1] del segmento AB estrictamente dentro del polígono
  const ts = [0, 1], dx = B[0] - A[0], dy = B[1] - A[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((x1 - A[0]) * ey - (y1 - A[1]) * ex) / den, u = ((x1 - A[0]) * dy - (y1 - A[1]) * dx) / den;
    if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < ts.length; k++) {
    const a = ts[k], b = ts[k + 1]; if (b - a < 1e-6) continue;
    const m = [A[0] + dx * (a + b) / 2, A[1] + dy * (a + b) / 2];
    if (puntoEnPoly(m, poly) && distBorde(m, poly) > eps) {
      if (out.length && Math.abs(out[out.length - 1][1] - a) < 1e-9) out[out.length - 1][1] = b; else out.push([a, b]);
    }
  }
  return out;
}
function unirIntervalos(L) {
  L.sort((a, b) => a[0] - b[0]); const out = [];
  for (const i of L) { if (out.length && i[0] <= out[out.length - 1][1] + 1e-9) out[out.length - 1][1] = Math.max(out[out.length - 1][1], i[1]); else out.push(i.slice()); }
  return out;
}
// segmentos visibles y ocultos de una vista (en mundo)
function aristasVista(T) {
  const piezas = P.piezas.filter(p => p.visible).map(p => Object.assign({ p, c: cercania(T, p) }, anillosVista(T, p)));
  const vis = [], ocu = [];
  for (const P1 of piezas) {
    const delante = piezas.filter(Q => Q !== P1 && Q.c > P1.c + .01);
    for (const an of P1.anillos) for (let i = 0; i < an.length; i++) {
      const A = an[i], B = an[(i + 1) % an.length];
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 1e-6) continue;
      let tapados = [];
      for (const Q of delante) tapados.push(...tramosDentro(A, B, Q.ocl, .02));
      tapados = unirIntervalos(tapados);
      let t = 0; const pt = s => [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s];
      for (const [t0, t1] of tapados) { if (t0 > t + 1e-6) vis.push([pt(t), pt(t0)]); ocu.push([pt(t0), pt(t1)]); t = t1; }
      if (t < 1 - 1e-6) vis.push([pt(t), pt(1)]);
    }
  }
  return { vis, ocu };
}

/* ---------- construcción de la lámina (primitivas en mm de papel, y hacia arriba) ---------- */
const FORMATOS = { A4: [297, 210], A3: [420, 297] };
const ESCALAS = [1, 2, 5, 10, 15, 20, 25, 50, 75, 100];
function cfgLaminaDefecto() {
  return { formato: 'A4', sistema: 'E', vistas: { alzado: true, planta: true, perfil: true, posterior: false, hormiga: false, perfilDer: false },
    persp: true, escala: 'auto', cotas: 'generales', ocultas: true, nombres: true,
    titulo: '', autor: '', centro: '', hoja: '1', fecha: new Date().toLocaleDateString('es-ES'), logo: null };
}
const POSICIONES = {
  E: { alzado: [0, 0], perfil: [1, 0], perfilDer: [-1, 0], posterior: [2, 0], planta: [0, 1], hormiga: [0, -1] },
  A: { alzado: [0, 0], perfil: [-1, 0], perfilDer: [1, 0], posterior: [2, 0], planta: [0, -1], hormiga: [0, 1] },
};
function fmtMM(v) { const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ','); }

function construirLamina(cfg, modo, imgPersp) {
  const real = modo === 'real';
  const [Wh, Hh] = FORMATOS[cfg.formato] || FORMATOS.A4;
  const b = bbox(), ext = { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, lim = { x: [b.x0, b.x1], y: [b.y0, b.y1], z: [b.z0, b.z1] };
  const tipos = Object.keys(TIPOS).filter(t => cfg.vistas[t]);
  if (!tipos.length) tipos.push('alzado');
  const pos = POSICIONES[cfg.sistema] || POSICIONES.E;
  const cols = {}, filas = {};
  tipos.forEach(t => { const [c, f] = pos[t]; cols[c] = Math.max(cols[c] || 0, ext[TIPOS[t].h]); filas[f] = Math.max(filas[f] || 0, ext[TIPOS[t].v]); });
  // perspectiva: celda libre a la derecha, en la fila de la planta (europeo) o de la hormiga (americano)
  const conPersp = cfg.persp && imgPersp && !real;
  let cP = null;
  if (conPersp) {
    const fp = cfg.sistema === 'A' ? -1 : 1, cMax = Math.max(...Object.keys(cols).map(Number));
    let c = 1; while (tipos.some(t => pos[t][0] === c && pos[t][1] === fp)) c++;
    cP = [Math.min(c, cMax + 1), fp];
  }
  const cotasG = cfg.cotas !== 'no', parc = cfg.cotas === 'parciales';
  const sep = u => ((cotasG ? 12 : 7) + (parc ? 7 : 0) + (cfg.nombres ? 4 : 0)) * u;
  // escala
  const marco = { x0: 20, y0: 10, x1: Wh - 10, y1: Hh - 10 }, caj = { w: 180, h: 32 };
  const area = { x0: marco.x0 + 6, y0: marco.y0 + caj.h + 6, x1: marco.x1 - 6, y1: marco.y1 - 6 };
  const areaIzq = { x0: marco.x0 + 6, y0: marco.y0 + 6, x1: marco.x1 - caj.w - 6, y1: marco.y1 - 6 }; // a la izquierda del cajetín, toda la altura
  const cabe = (m, a) => m.W <= a.x1 - a.x0 && m.H <= a.y1 - a.y0;
  const medir = (k, u) => {
    const cK = Object.keys(cols).map(Number), fK = Object.keys(filas).map(Number);
    const anchoC = c => c in cols ? cols[c] * k : (cP && cP[0] === c ? 0 : 0), altoF = f => f in filas ? filas[f] * k : 0;
    const cAll = [...new Set([...cK, ...(cP ? [cP[0]] : [])])].sort((a, b) => a - b), fAll = [...new Set([...fK, ...(cP ? [cP[1]] : [])])].sort((a, b) => a - b);
    const pw = cP ? Math.max(anchoC(cP[0]), 60 * u) : 0, ph = cP ? Math.max(altoF(cP[1]), 40 * u) : 0;
    const anchos = cAll.map(c => cP && c === cP[0] ? Math.max(anchoC(c), pw) : anchoC(c)), altos = fAll.map(f => cP && f === cP[1] ? Math.max(altoF(f), ph) : altoF(f));
    const s = sep(u);
    return { cAll, fAll, anchos, altos, W: anchos.reduce((a, v) => a + v, 0) + s * cAll.length, H: altos.reduce((a, v) => a + v, 0) + s * fAll.length };
  };
  let den = cfg.escala !== 'auto' ? parseFloat(cfg.escala) : null;
  if (!den) { den = ESCALAS[ESCALAS.length - 1]; for (const e of ESCALAS) { const m = medir(10 / e, 1); if (cabe(m, area) || cabe(m, areaIzq)) { den = e; break; } } }
  const u = real ? den : 1, k = real ? 10 : 10 / den;
  const M = medir(k, u), s = sep(u);
  // origen de la composición
  const W = real ? M.W : Wh, H = real ? M.H + 20 * u : Hh;
  const A2 = cabe(M, area) || !cabe(M, areaIzq) ? area : areaIzq;
  let ox = real ? 0 : A2.x0 + Math.max(0, (A2.x1 - A2.x0 - M.W) / 2), oyTop = real ? M.H : A2.y1 - Math.max(0, (A2.y1 - A2.y0 - M.H) / 2);
  const celdaX = {}, celdaY = {}; // esquina inferior izquierda de cada celda (dejando el hueco de cotas a la derecha y abajo)
  let x = ox; M.cAll.forEach((c, i) => { celdaX[c] = { x, w: M.anchos[i] }; x += M.anchos[i] + s; });
  let y = oyTop; M.fAll.forEach((f, i) => { y -= M.altos[i]; celdaY[f] = { y, h: M.altos[i] }; y -= s; });
  const prims = [];
  const L = (x1, y1, x2, y2, c) => prims.push({ t: 'l', x1, y1, x2, y2, c });
  const TX = (x, y, s2, h, o) => prims.push(Object.assign({ t: 'txt', x, y, s: s2, h, al: 'l', ang: 0, c: 'txt' }, o || {}));
  const flecha = (x, y, dx, dy, c) => { const l = 2.5 * u, w = .55 * u, px = -dy, py = dx; prims.push({ t: 'tri', pts: [[x, y], [x - dx * l + px * w, y - dy * l + py * w], [x - dx * l - px * w, y - dy * l - py * w]], c }); };
  const cotaH = (xa, xb, yObj, yCota, valor) => { // cota horizontal: yObj altura del objeto, yCota de la línea de cota
    const sg = yCota < yObj ? -1 : 1;
    L(xa, yObj + sg * 1 * u, xa, yCota + sg * 2 * u, 'cota'); L(xb, yObj + sg * 1 * u, xb, yCota + sg * 2 * u, 'cota');
    L(xa, yCota, xb, yCota, 'cota'); flecha(xa, yCota, -1, 0, 'cota'); flecha(xb, yCota, 1, 0, 'cota');
    TX((xa + xb) / 2, yCota + 1 * u, fmtMM(valor), 2.5 * u, { al: 'c', c: 'cota' });
  };
  const cotaV = (ya, yb, xObj, xCota, valor) => {
    const sg = xCota < xObj ? -1 : 1;
    L(xObj + sg * 1 * u, ya, xCota + sg * 2 * u, ya, 'cota'); L(xObj + sg * 1 * u, yb, xCota + sg * 2 * u, yb, 'cota');
    L(xCota, ya, xCota, yb, 'cota'); flecha(xCota, ya, 0, -1, 'cota'); flecha(xCota, yb, 0, 1, 'cota');
    TX(xCota - 1 * u, (ya + yb) / 2, fmtMM(valor), 2.5 * u, { al: 'c', ang: 90, c: 'cota' });
  };
  for (const t of tipos) {
    const T = TIPOS[t], [c, f] = pos[t], cx = celdaX[c], cy = celdaY[f];
    const wv = ext[T.h] * k, hv = ext[T.v] * k;
    const x0 = cx.x + (cx.w - wv) / 2, y0 = cy.y + (cy.h - hv) / 2;
    const [a0, a1] = lim[T.h], [b0, b1] = lim[T.v];
    const mp = ([a, b2]) => [x0 + (T.hs > 0 ? a - a0 : a1 - a) * k, y0 + (T.vs > 0 ? b2 - b0 : b1 - b2) * k];
    const ar = aristasVista(T);
    for (const [A, B] of ar.vis) { const p1 = mp(A), p2 = mp(B); L(p1[0], p1[1], p2[0], p2[1], 'vis'); }
    if (cfg.ocultas) for (const [A, B] of ar.ocu) { const p1 = mp(A), p2 = mp(B); L(p1[0], p1[1], p2[0], p2[1], 'ocu'); }
    if (cfg.nombres) TX(x0 + wv / 2, y0 + hv + 3 * u, T.nombre.toUpperCase(), 2.5 * u, { al: 'c', c: 'nom' });
    if (cotasG) {
      const dy0 = y0 - (parc ? 14 : 8) * u, dx0 = x0 + wv + (parc ? 14 : 8) * u;
      cotaH(x0, x0 + wv, y0, dy0, ext[T.h] * 10); cotaV(y0, y0 + hv, x0 + wv, dx0, ext[T.v] * 10);
      if (parc) { // cadenas con los cantos visibles
        const xs = [], ys = [];
        for (const [A, B] of ar.vis) { const p1 = mp(A), p2 = mp(B); if (Math.abs(p1[0] - p2[0]) < .01 * u) xs.push(p1[0]); if (Math.abs(p1[1] - p2[1]) < .01 * u) ys.push(p1[1]); }
        const limpia = (L2, lo, hi) => { const o = [lo]; L2.concat([hi]).sort((a, b2) => a - b2).forEach(v => { if (v >= lo - 1e-6 && v <= hi + 1e-6 && v - o[o.length - 1] >= 3 * u) o.push(v); }); if (hi - o[o.length - 1] > 1e-6) o[o.length - 1] = hi; return o; };
        const cx2 = limpia(xs, x0, x0 + wv), cy2 = limpia(ys, y0, y0 + hv);
        if (cx2.length > 2) for (let i = 0; i + 1 < cx2.length; i++) cotaH(cx2[i], cx2[i + 1], y0, y0 - 7 * u, (cx2[i + 1] - cx2[i]) / k * 10);
        if (cy2.length > 2) for (let i = 0; i + 1 < cy2.length; i++) cotaV(cy2[i], cy2[i + 1], x0 + wv, x0 + wv + 7 * u, (cy2[i + 1] - cy2[i]) / k * 10);
      }
    }
  }
  if (conPersp) {
    const cx = celdaX[cP[0]], cy = celdaY[cP[1]], bw = cx.w, bh = cy.h, ar = imgPersp.w / imgPersp.h;
    let w = bw, h = bw / ar; if (h > bh) { h = bh; w = bh * ar; }
    prims.push({ t: 'img', x: cx.x + (bw - w) / 2, y: cy.y + (bh - h) / 2, w, h, src: imgPersp.src, px: imgPersp.w, py: imgPersp.h });
    if (cfg.nombres) TX(cx.x + bw / 2, cy.y + (bh + h) / 2 + 3, 'PERSPECTIVA', 2.5, { al: 'c', c: 'nom' });
  }
  if (!real) { // marco y cajetín
    L(marco.x0, marco.y0, marco.x1, marco.y0, 'marco'); L(marco.x1, marco.y0, marco.x1, marco.y1, 'marco');
    L(marco.x1, marco.y1, marco.x0, marco.y1, 'marco'); L(marco.x0, marco.y1, marco.x0, marco.y0, 'marco');
    const X = marco.x1 - caj.w, Y = marco.y0, cw = caj.w, ch = caj.h;
    const R = (x1, y1, x2, y2) => { L(x1, y1, x2, y1, 'caj'); L(x2, y1, x2, y2, 'caj'); L(x2, y2, x1, y2, 'caj'); L(x1, y2, x1, y1, 'caj'); };
    R(X, Y, X + cw, Y + ch);
    L(X + 30, Y, X + 30, Y + ch, 'caj'); L(X + 120, Y, X + 120, Y + ch, 'caj'); L(X + 150, Y, X + 150, Y + ch, 'caj');
    L(X + 30, Y + 14, X + cw, Y + 14, 'caj'); L(X + 90, Y, X + 90, Y + 14, 'caj');
    const et = (x, y, t) => TX(x, y, t, 1.8, { c: 'etq' });
    et(X + 31.5, Y + ch - 3.2, 'TÍTULO'); et(X + 31.5, Y + 10.6, 'AUTOR / ALUMNO'); et(X + 91.5, Y + 10.6, 'FECHA');
    et(X + 121.5, Y + ch - 3.2, 'ESCALA'); et(X + 121.5, Y + 10.6, 'UNIDADES'); et(X + 151.5, Y + ch - 3.2, 'SISTEMA'); et(X + 151.5, Y + 10.6, 'HOJA');
    const tit = (cfg.titulo || P.nombre || 'Mueble').slice(0, 42);
    TX(X + 75, Y + 17.5, tit, tit.length > 30 ? 4 : 5, { al: 'c', bold: true });
    TX(X + 32, Y + 3.5, (cfg.autor || '').slice(0, 34), 3.2);
    TX(X + 105, Y + 3.5, (cfg.fecha || '').slice(0, 14), 3, { al: 'c' });
    TX(X + 135, Y + 17.5, '1:' + den, 5, { al: 'c', bold: true });
    TX(X + 135, Y + 3.5, 'mm', 3.2, { al: 'c' });
    TX(X + 165, Y + 20.5, cfg.sistema === 'A' ? 'Americano' : 'Europeo', 3, { al: 'c' });
    TX(X + 165, Y + 16.5, cfg.sistema === 'A' ? '(3.er diedro)' : '(1.er diedro)', 2.3, { al: 'c' });
    TX(X + 165, Y + 3.5, String(cfg.hoja || '1'), 4, { al: 'c', bold: true });
    if (cfg.logo && cfg.logo.src) {
      const ar = cfg.logo.w / cfg.logo.h; let w = 26, h = 26 / ar; if (h > (cfg.centro ? 18 : 26)) { h = cfg.centro ? 18 : 26; w = h * ar; }
      prims.push({ t: 'img', x: X + 15 - w / 2, y: Y + ch - 2 - h, w, h, src: cfg.logo.src, px: cfg.logo.w, py: cfg.logo.h });
    }
    if (cfg.centro) { const pal = cfg.centro.split(/\s+/); const lin = ['']; pal.forEach(p2 => { if ((lin[lin.length - 1] + ' ' + p2).trim().length > 16) lin.push(p2); else lin[lin.length - 1] = (lin[lin.length - 1] + ' ' + p2).trim(); });
      lin.slice(0, cfg.logo ? 2 : 5).reverse().forEach((t2, i) => TX(X + 15, Y + 2.5 + i * 2.9, t2, 2.2, { al: 'c' })); }
    TX(marco.x0, marco.y0 - 5, 'Boceto a Render 3D v' + VERSION, 2, { c: 'etq' });
  }
  return { W, H, prims, den };
}

/* ---------- salida SVG (vista previa) ---------- */
const ESTILO_LAM = { vis: { w: .5, col: '#000' }, ocu: { w: .25, col: '#000', d: [2.5, 1.2] }, cota: { w: .18, col: '#1a1a1a' }, marco: { w: .7, col: '#000' }, caj: { w: .35, col: '#000' },
  txt: { col: '#000' }, nom: { col: '#333' }, etq: { col: '#666' } };
function svgLamina(L) {
  const H = L.H, e = [];
  for (const p of L.prims) {
    if (p.t === 'l') { const st = ESTILO_LAM[p.c]; e.push(`<line x1="${p.x1.toFixed(2)}" y1="${(H - p.y1).toFixed(2)}" x2="${p.x2.toFixed(2)}" y2="${(H - p.y2).toFixed(2)}" stroke="${st.col}" stroke-width="${st.w}"${st.d ? ` stroke-dasharray="${st.d.join(' ')}"` : ''} stroke-linecap="round"/>`); }
    else if (p.t === 'tri') e.push(`<polygon points="${p.pts.map(q => q[0].toFixed(2) + ',' + (H - q[1]).toFixed(2)).join(' ')}" fill="#1a1a1a"/>`);
    else if (p.t === 'txt') { const an = { l: 'start', c: 'middle', r: 'end' }[p.al]; const tr = p.ang ? ` transform="rotate(${-p.ang} ${p.x.toFixed(2)} ${(H - p.y).toFixed(2)})"` : '';
      e.push(`<text x="${p.x.toFixed(2)}" y="${(H - p.y).toFixed(2)}" font-size="${p.h}" font-family="Helvetica,Arial,sans-serif"${p.bold ? ' font-weight="bold"' : ''} text-anchor="${an}" fill="${(ESTILO_LAM[p.c] || ESTILO_LAM.txt).col}"${tr}>${esc(p.s)}</text>`); }
    else if (p.t === 'img') e.push(`<image href="${p.src}" x="${p.x.toFixed(2)}" y="${(H - p.y - p.h).toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="100%" style="background:#fff;display:block"><rect width="100%" height="100%" fill="#fff"/>${e.join('')}</svg>`;
}

/* ---------- salida PDF (escrito a mano: líneas, texto Helvetica e imágenes JPEG) ---------- */
const HELV = (() => { // anchos de Helvetica (1/1000 em) para ASCII 32–126
  const w = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  return ch => { let c = ch.normalize('NFD').charCodeAt(0); if (c >= 32 && c <= 126) return w[c - 32]; return 556; };
})();
function anchoTexto(s, h, bold) { let t = 0; for (const ch of s) t += HELV(ch); return t / 1000 * h * (bold ? 1.06 : 1); }
const WINANSI = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151 };
function aLatin1(s) { let o = ''; for (const ch of s) { const c = ch.charCodeAt(0); o += String.fromCharCode(WINANSI[ch] || (c < 256 ? c : 63)); } return o; }
function bytesDe(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
function base64Bytes(dataURL) { const bin = atob(dataURL.split(',')[1]); return bytesDe(bin); }
function pdfLamina(L) {
  const f = n => (Math.round(n * 1000) / 1000).toString();
  const cs = [`${f(72 / 25.4)} 0 0 ${f(72 / 25.4)} 0 0 cm`, '1 J 1 j'];
  const imgs = []; let est = null;
  for (const p of L.prims) {
    if (p.t === 'l') {
      if (est !== p.c) { const s = ESTILO_LAM[p.c]; cs.push(`${s.w} w ${s.d ? '[' + s.d.join(' ') + '] 0 d' : '[] 0 d'} 0 G`); est = p.c; }
      cs.push(`${f(p.x1)} ${f(p.y1)} m ${f(p.x2)} ${f(p.y2)} l S`);
    } else if (p.t === 'tri') cs.push(`0.1 g ${f(p.pts[0][0])} ${f(p.pts[0][1])} m ${f(p.pts[1][0])} ${f(p.pts[1][1])} l ${f(p.pts[2][0])} ${f(p.pts[2][1])} l h f`);
    else if (p.t === 'txt') {
      const gris = p.c === 'etq' ? '0.4 g' : p.c === 'nom' ? '0.2 g' : '0 g';
      const w = anchoTexto(p.s, p.h, p.bold), off = p.al === 'c' ? -w / 2 : p.al === 'r' ? -w : 0;
      const a = (p.ang || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      const x = p.x + off * co, y = p.y + off * si;
      const str = aLatin1(p.s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      cs.push(`${gris} BT /${p.bold ? 'F2' : 'F1'} ${f(p.h)} Tf ${f(co)} ${f(si)} ${f(-si)} ${f(co)} ${f(x)} ${f(y)} Tm (${str}) Tj ET`);
    } else if (p.t === 'img') {
      let i = imgs.findIndex(q => q.src === p.src); if (i < 0) { imgs.push(p); i = imgs.length - 1; }
      cs.push(`q ${f(p.w)} 0 0 ${f(p.h)} ${f(p.x)} ${f(p.y)} cm /Im${i} Do Q`);
    }
  }
  const contenido = cs.join('\n');
  const Wpt = L.W * 72 / 25.4, Hpt = L.H * 72 / 25.4;
  const objs = []; // cada uno: array de partes (string o Uint8Array)
  objs.push(['<< /Type /Catalog /Pages 2 0 R >>']);
  objs.push(['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  const xo = imgs.map((_, i) => `/Im${i} ${7 + i} 0 R`).join(' ');
  objs.push([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(Wpt)} ${f(Hpt)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << ${xo} >> >> >>`]);
  const cb = bytesDe(aLatin1(contenido));
  objs.push([`<< /Length ${cb.length} >>\nstream\n`, cb, '\nendstream']);
  objs.push(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  objs.push(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  imgs.forEach(im => { const b = base64Bytes(im.src); objs.push([`<< /Type /XObject /Subtype /Image /Width ${im.px} /Height ${im.py} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${b.length} >>\nstream\n`, b, '\nendstream']); });
  const partes = [bytesDe('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let off = partes[0].length; const offs = [];
  objs.forEach((o, i) => {
    offs.push(off);
    const L2 = [bytesDe(`${i + 1} 0 obj\n`), ...o.map(x => typeof x === 'string' ? bytesDe(x) : x), bytesDe('\nendobj\n')];
    L2.forEach(b => { partes.push(b); off += b.length; });
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  partes.push(bytesDe(xref));
  return new Blob(partes, { type: 'application/pdf' });
}

/* ---------- salida DXF (R12, capas, ocultas con línea discontinua) ---------- */
function dxfLamina(L, escalaTipo) {
  const o = [], p = (c, v) => o.push(String(c), String(v));
  const CAPAS = { vis: ['VISIBLES', 7, 'CONTINUOUS'], ocu: ['OCULTAS', 8, 'DASHED'], cota: ['COTAS', 4, 'CONTINUOUS'], marco: ['MARCO', 7, 'CONTINUOUS'], caj: ['CAJETIN', 7, 'CONTINUOUS'], txt: ['TEXTOS', 7, 'CONTINUOUS'], nom: ['TEXTOS', 7, 'CONTINUOUS'], etq: ['CAJETIN', 8, 'CONTINUOUS'] };
  const nf = n => (Math.round(n * 10000) / 10000).toString();
  p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252'); p(9, '$LTSCALE'); p(40, nf(escalaTipo || 1));
  p(9, '$EXTMIN'); p(10, 0); p(20, 0); p(30, 0); p(9, '$EXTMAX'); p(10, nf(L.W)); p(20, nf(L.H)); p(30, 0); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'TABLES');
  p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 2);
  p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, '0.0');
  p(0, 'LTYPE'); p(2, 'DASHED'); p(70, 0); p(3, '__ __ __'); p(72, 65); p(73, 2); p(40, '3.7'); p(49, '2.5'); p(49, '-1.2');
  p(0, 'ENDTAB');
  const capas = [...new Map(Object.values(CAPAS).map(c => [c[0], c])).values()];
  p(0, 'TABLE'); p(2, 'LAYER'); p(70, capas.length + 1);
  p(0, 'LAYER'); p(2, '0'); p(70, 0); p(62, 7); p(6, 'CONTINUOUS');
  capas.forEach(([n, col, lt]) => { p(0, 'LAYER'); p(2, n); p(70, 0); p(62, col); p(6, lt); });
  p(0, 'ENDTAB'); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'ENTITIES');
  for (const e of L.prims) {
    const capa = (CAPAS[e.c] || CAPAS.txt)[0];
    if (e.t === 'l') { p(0, 'LINE'); p(8, capa); p(10, nf(e.x1)); p(20, nf(e.y1)); p(30, 0); p(11, nf(e.x2)); p(21, nf(e.y2)); p(31, 0); }
    else if (e.t === 'tri') { p(0, 'SOLID'); p(8, capa); [[10, 20, 30, 0], [11, 21, 31, 1], [12, 22, 32, 2], [13, 23, 33, 2]].forEach(([a, b2, c2, i]) => { p(a, nf(e.pts[i][0])); p(b2, nf(e.pts[i][1])); p(c2, 0); }); }
    else if (e.t === 'txt') {
      p(0, 'TEXT'); p(8, capa); p(10, nf(e.x)); p(20, nf(e.y)); p(30, 0); p(40, nf(e.h)); p(1, aLatin1(e.s)); if (e.ang) p(50, e.ang);
      const j = { l: 0, c: 1, r: 2 }[e.al] || 0; if (j) { p(72, j); p(11, nf(e.x)); p(21, nf(e.y)); p(31, 0); }
    }
  }
  p(0, 'ENDSEC'); p(0, 'EOF');
  return new Blob([bytesDe(o.join('\r\n') + '\r\n')], { type: 'application/dxf' });
}

/* ---------- captura de la perspectiva (vista 3D actual, fondo blanco) ---------- */
function capturaPersp(w, h) {
  const sz = new T.Vector2(); renderer.getSize(sz);
  const asp = camara.aspect, bg = escena.background, pr = renderer.getPixelRatio();
  grupoAyudas.visible = false; escena.background = new T.Color('#ffffff'); contacto.visible = false;
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
  renderer.render(escena, camara);
  const src = c3d.toDataURL('image/jpeg', .9);
  escena.background = bg; grupoAyudas.visible = true; contacto.visible = !(P.vista.explosion > .05);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false); camara.aspect = asp; camara.updateProjectionMatrix(); render3D();
  return { src, w, h };
}

/* ---------- diálogo de la lámina ---------- */
function abrirLamina() {
  if (!P.piezas.some(p => p.visible)) return aviso('No hay piezas');
  const cfg = Object.assign(cfgLaminaDefecto(), P.lamina || {});
  cfg.vistas = Object.assign(cfgLaminaDefecto().vistas, (P.lamina || {}).vistas || {});
  if (!cfg.titulo) cfg.titulo = P.nombre && P.nombre !== 'proyecto' ? P.nombre : '';
  const r3 = $('#v3d').getBoundingClientRect(), ar3 = Math.max(.6, Math.min(2.2, r3.width / Math.max(1, r3.height)));
  const persp = capturaPersp(Math.round(900 * Math.min(1, ar3)), Math.round(900 / Math.max(1, ar3)));
  const chk = (id, et, v) => `<label class="fila chk"><input type="checkbox" id="l_${id}" ${v ? 'checked' : ''}> ${et}</label>`;
  const sel = (id, et, v, ops) => `<label class="fila">${et} <select id="l_${id}">${ops.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
  const txt = (id, et, v) => `<label class="fila">${et} <input type="text" id="l_${id}" value="${esc(v || '')}"></label>`;
  modal('Lámina técnica', `<div class="lamina">
    <div class="lam-opc">
      <h4>Hoja</h4>
      ${sel('formato', 'Formato', cfg.formato, [['A4', 'A4 horizontal'], ['A3', 'A3 horizontal']])}
      ${sel('sistema', 'Sistema', cfg.sistema, [['E', 'Europeo (1.er diedro)'], ['A', 'Americano (3.er diedro)']])}
      ${sel('escala', 'Escala', cfg.escala, [['auto', 'Automática'], ...ESCALAS.map(e => [e, '1:' + e])])}
      <h4>Vistas</h4>
      ${Object.keys(TIPOS).map(t => chk('v_' + t, TIPOS[t].nombre, cfg.vistas[t])).join('')}
      ${chk('persp', 'Perspectiva (la vista 3D actual)', cfg.persp)}
      <h4>Dibujo</h4>
      ${sel('cotas', 'Cotas', cfg.cotas, [['no', 'Sin cotas'], ['generales', 'Generales'], ['parciales', 'Generales y parciales']])}
      ${chk('ocultas', 'Aristas ocultas (discontinuas)', cfg.ocultas)}
      ${chk('nombres', 'Nombre de cada vista', cfg.nombres)}
      <h4>Cajetín</h4>
      ${txt('titulo', 'Título', cfg.titulo)}${txt('autor', 'Autor / alumno', cfg.autor)}${txt('centro', 'Centro', cfg.centro)}
      ${txt('fecha', 'Fecha', cfg.fecha)}${txt('hoja', 'Hoja nº', cfg.hoja)}
      <div class="col2"><button id="l_logo">🖼 Logo…</button><button id="l_sinlogo">✕ Sin logo</button></div>
    </div>
    <div class="lam-prev"><div id="lamPrev"></div><p class="nota" id="lamInfo"></p></div></div>`, [
    { txt: 'Cerrar' },
    { txt: '⬇ DXF a 1:1', mantener: true, fn: () => { const L = construirLamina(leer(), 'real'); descargar(nombreLam() + ' 1a1.dxf', dxfLamina(L, L.den)); } },
    { txt: '⬇ DXF lámina', mantener: true, fn: () => { const L = construirLamina(leer(), 'hoja', persp); descargar(nombreLam() + '.dxf', dxfLamina(L, 1)); } },
    { txt: '⬇ PDF', primario: true, mantener: true, fn: () => { const L = construirLamina(leer(), 'hoja', persp); descargar(nombreLam() + '.pdf', pdfLamina(L)); } }], 'min(1180px,96vw)');
  const nombreLam = () => ((cfg.titulo || P.nombre || 'lamina') + ' - lámina').replace(/[\\/:*?"<>|]/g, '');
  function leer() {
    const g = id => $('#l_' + id);
    Object.assign(cfg, { formato: g('formato').value, sistema: g('sistema').value, escala: g('escala').value, cotas: g('cotas').value,
      ocultas: g('ocultas').checked, nombres: g('nombres').checked, persp: g('persp').checked,
      titulo: g('titulo').value, autor: g('autor').value, centro: g('centro').value, fecha: g('fecha').value, hoja: g('hoja').value });
    Object.keys(TIPOS).forEach(t => cfg.vistas[t] = g('v_' + t).checked);
    P.lamina = JSON.parse(JSON.stringify(cfg)); guardarLocalPronto();
    return cfg;
  }
  function previa() {
    const L = construirLamina(leer(), 'hoja', persp);
    $('#lamPrev').innerHTML = svgLamina(L);
    $('#lamInfo').textContent = `Escala 1:${L.den} · ${cfg.formato} horizontal · cotas en mm. «DXF lámina» guarda la hoja tal cual (en mm de papel); «DXF a 1:1» guarda solo las vistas a tamaño real, con capas VISIBLES, OCULTAS y COTAS.`;
  }
  $$('.lamina input, .lamina select').forEach(e => e.addEventListener(e.type === 'text' ? 'change' : 'input', previa));
  $('#l_logo').onclick = async () => {
    const f = await leerArchivo('image/*'); if (!f) return;
    const im = await cargarImagen(f.datos), e2 = Math.min(1, 400 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = lienzo(Math.round(im.naturalWidth * e2), Math.round(im.naturalHeight * e2)), x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
    cfg.logo = { src: cv.toDataURL('image/jpeg', .9), w: cv.width, h: cv.height }; previa();
  };
  $('#l_sinlogo').onclick = () => { cfg.logo = null; previa(); };
  previa();
}
$('#bLamina').onclick = abrirLamina;

/* ===================== EXPORTAR AL ANIDADOR ===================== */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipAlmacen(archivos) { // ZIP sin compresión; nombres en UTF-8
  const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const a of archivos) {
    const nom = enc.encode(a.nombre), dat = typeof a.datos === 'string' ? enc.encode(a.datos) : a.datos, c = crc32(dat);
    const loc = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(hora), ...u16(dia), ...u32(c), ...u32(dat.length), ...u32(dat.length), ...u16(nom.length), ...u16(0)]);
    partes.push(loc, nom, dat);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(hora), ...u16(dia), ...u32(c), ...u32(dat.length), ...u32(dat.length), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nom);
    off += loc.length + nom.length + dat.length;
  }
  const tamC = central.reduce((s, b) => s + b.length, 0);
  const fin = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length), ...u32(tamC), ...u32(off), ...u16(0)]);
  return new Blob([...partes, ...central, fin], { type: 'application/zip' });
}
function medidasTablero(p) { // {g, L, A, veta} en cm
  const th = ejeGrosor(p), cara = 'xyz'.split('').filter(e => e !== th), m = infoMaterial(p.material);
  const veta = m.tipo === 'madera';
  const dl = e => p[DIM[e]], ve = ejeVeta(p);
  const ejeL = veta && cara.includes(ve) ? ve : (dl(cara[0]) >= dl(cara[1]) ? cara[0] : cara[1]);
  const ejeA = cara.find(e => e !== ejeL);
  return { g: p[DIM[th]], L: p[DIM[ejeL]], A: p[DIM[ejeA]], veta, ejeL };
}
function exportarAnidador() {
  const tableros = {}, contornos = {}, fuera = [];
  for (const p of P.piezas) {
    if (!p.visible) continue;
    const m = infoMaterial(p.material);
    if (['metal', 'metalpint', 'cristal'].includes(m.tipo) || p.forma === 'cilindro') { fuera.push(p.nombre); continue; }
    const md = medidasTablero(p), gmm = Math.round(md.g * 100) / 10;
    const clave = `${m.tipo === 'lacado' ? 'Lacado ' + p.color : m.nombre} ${fmtMM(gmm)} mm`;
    const nuc = nucleoDe(p);
    let cl = 0, ca = 0, tc = '';
    if (llevaCanto(p)) {
      const eA = 'xyz'.split('').find(e => e !== ejeGrosor(p) && e !== md.ejeL), gL = [eA + '-', eA + '+'].map(l => cantoLado(p, l)), gA = [md.ejeL + '-', md.ejeL + '+'].map(l => cantoLado(p, l));
      cl = gL.filter(Boolean).length; ca = gA.filter(Boolean).length;
      const gs = [...new Set(gL.concat(gA).filter(Boolean))].sort((a, b) => a - b).map(v => String(v).replace('.', ',')).join('/');
      if (cl || ca) tc = 'Canto ' + (p.cantos === 'otro' ? infoMaterial(p.cantoMat).nombre : m.nombre) + ' ' + gs + ' mm';
    }
    const nombre = p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/\s\d+$/, '').replace(/;/g, ',');
    if (tieneContorno(p)) {
      const Tp = TIPOS[p.plano], c = p.contorno, ka = p[DIM[Tp.h]] / c.cw * 10, kb = p[DIM[Tp.v]] / c.ch * 10;
      const conv = an => ({ pts: an.map(([u2, v]) => ({ x: Math.round(u2 * ka * 1000) / 1000, y: Math.round(v * kb * 1000) / 1000 })), b: an.map(() => 0), cerrado: true });
      const cont = contornosCalcadorMM(p) || [conv(c.ext), ...(c.huecos || []).map(conv)];   // del Calcador, con sus arcos exactos
      const nomC = p.nombre.replace(/ \((copia|simétrica)\)/g, '').replace(/;/g, ',');
      const firma = clave + '|' + nomC + '|' + JSON.stringify(cont);
      (contornos[firma] = contornos[firma] || { clave, nombre: nomC, cont, n: 0 }).n++;
      continue;
    }
    const T2 = tableros[clave] = tableros[clave] || {};
    const k = [nombre, fmtMM(md.L * 10), fmtMM(md.A * 10), md.veta ? 'sí' : 'no', cl, ca, tc].join(';');
    T2[k] = (T2[k] || 0) + 1;
  }
  const archivos = [];
  for (const [clave, filas] of Object.entries(tableros)) {
    const csv = 'nombre;largo;ancho;cantidad;veta;canto largo;canto ancho;tipo de canto\r\n' + Object.entries(filas).map(([k, n]) => { const c = k.split(';'); return [c[0], c[1], c[2], n, c[3], c[4], c[5], c[6]].join(';'); }).join('\r\n') + '\r\n';
    archivos.push({ nombre: clave.replace(/[\\/:*?"<>|]/g, '') + '.csv', datos: '﻿' + csv });
  }
  const usados = new Set();
  for (const c of Object.values(contornos)) {
    let nom = `${c.clave} - ${c.nombre}${c.n > 1 ? ' (x' + c.n + ')' : ''}`.replace(/[\\/:*?"<>|]/g, '');
    for (let k = 2; usados.has(nom); k++) nom = `${c.clave} - ${c.nombre} (${k})${c.n > 1 ? ' (x' + c.n + ')' : ''}`.replace(/[\\/:*?"<>|]/g, '');
    usados.add(nom);
    archivos.push({ nombre: 'contornos/' + nom + '.json', datos: JSON.stringify({ nombre: c.nombre + (c.n > 1 ? ' (x' + c.n + ')' : ''), origen: 'Boceto a Render 3D', calcador: { contornos: c.cont } }, null, 1) });
  }
  if (!archivos.length) return aviso('No hay tableros que anidar');
  const leeme = `Despiece de «${P.nombre || 'proyecto'}» para el Anidador (Suite CNC)\r\n\r\n` +
    `- Cada .csv es un tipo de tablero (material y grosor). Ábrelo en el Anidador con «📂 Abrir…» y pon las medidas de ese tablero.\r\n` +
    `- Medidas en mm. «veta = sí» en las maderas: el largo va en la dirección de la veta.\r\n` +
    `- Cantos: lados largos y anchos con canto (2 y 2 = todos), con el material y el grueso indicados; 0 = sin canto.\r\n` +
    (Object.keys(contornos).length ? `- La carpeta «contornos» tiene las piezas con contorno como proyectos del Calcador (.json). Ábrelas junto al .csv del mismo tablero; si el nombre dice (xN), pon esa cantidad en el Anidador.\r\n` : '') +
    (fuera.length ? `- No se incluyen herrajes, metales, cristal ni piezas cilíndricas: ${[...new Set(fuera)].join(', ').replace(/\.$/, '')}.\r\n` : '');
  archivos.unshift({ nombre: 'LEEME.txt', datos: leeme });
  descargar(((P.nombre || 'proyecto') + ' - para el Anidador.zip').replace(/[\\/:*?"<>|]/g, ''), zipAlmacen(archivos));
  aviso(`${archivos.length - 1} archivo(s) para el Anidador`);
}
