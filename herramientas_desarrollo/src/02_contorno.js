
/* ===================== CONTORNOS (plantillas e importación DXF / SVG) =====================
   Un contorno se guarda en coordenadas de la vista donde se dibujó (u hacia la derecha, v hacia arriba en pantalla),
   con su tamaño original cw x ch. Al cambiar las medidas de la pieza, el contorno se estira con ella. */
function arcoPts(cx, cy, r, a0, a1, segs) {
  const n = segs || Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 24)));
  const L = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return L;
}
function bulgePts(p1, p2, b) { // arco de DXF definido por el «bulge» (sin el primer punto)
  if (!b || Math.abs(b) < 1e-9) return [p2];
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], c = Math.hypot(dx, dy); if (c < 1e-12) return [p2];
  const ang = 4 * Math.atan(b), r = c / (2 * Math.sin(ang / 2)), h = r * Math.cos(ang / 2);
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, cx = mx - dy / c * h, cy = my + dx / c * h;
  const a1 = Math.atan2(p1[1] - cy, p1[0] - cx), R = Math.abs(r);
  const n = Math.max(3, Math.ceil(Math.abs(ang) / (Math.PI / 24)));
  const L = []; for (let i = 1; i <= n; i++) { const a = a1 + ang * i / n; L.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  L[L.length - 1] = [p2[0], p2[1]];
  return L;
}
function areaPoly(P2) { let a = 0; for (let i = 0, j = P2.length - 1; i < P2.length; j = i++) a += (P2[j][0] + P2[i][0]) * (P2[j][1] - P2[i][1]); return a / 2; }
function puntoEnPoly(pt, P2) {
  let d = false;
  for (let i = 0, j = P2.length - 1; i < P2.length; j = i++) {
    const [xi, yi] = P2[i], [xj, yj] = P2[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function limpiarPoly(pts, tol) { // quita puntos repetidos y alineados (Douglas-Peucker sobre anillo cerrado)
  const L = [];
  for (const p of pts) if (!L.length || Math.hypot(p[0] - L[L.length - 1][0], p[1] - L[L.length - 1][1]) > tol) L.push(p);
  if (L.length > 2 && Math.hypot(L[0][0] - L[L.length - 1][0], L[0][1] - L[L.length - 1][1]) <= tol) L.pop();
  if (L.length < 4) return L;
  const dp = A => {
    if (A.length < 3) return A;
    let mx = -1, k = -1; const [x1, y1] = A[0], [x2, y2] = A[A.length - 1], dx = x2 - x1, dy = y2 - y1, ll = Math.hypot(dx, dy) || 1e-12;
    for (let i = 1; i < A.length - 1; i++) { const d = Math.abs(dy * A[i][0] - dx * A[i][1] + x2 * y1 - y2 * x1) / ll; if (d > mx) { mx = d; k = i; } }
    if (mx > tol) return dp(A.slice(0, k + 1)).slice(0, -1).concat(dp(A.slice(k)));
    return [A[0], A[A.length - 1]];
  };
  // partir el anillo por el punto más lejano al primero
  let lejos = 0, dmax = 0; L.forEach((p, i) => { const d = Math.hypot(p[0] - L[0][0], p[1] - L[0][1]); if (d > dmax) { dmax = d; lejos = i; } });
  const anillo = [...L, L[0]];
  return dp(anillo.slice(0, lejos + 1)).slice(0, -1).concat(dp(anillo.slice(lejos)).slice(0, -1));
}

/* ---------- plantillas ---------- */
function rectEsquinas(cw, ch, rad, chaflan) { // rad: [inf-izq, inf-der, sup-der, sup-izq]
  const P2 = [], esq = [[0, 0, Math.PI, 1.5 * Math.PI], [cw, 0, 1.5 * Math.PI, 2 * Math.PI], [cw, ch, 0, .5 * Math.PI], [0, ch, .5 * Math.PI, Math.PI]];
  esq.forEach(([x, y, a0, a1], i) => {
    const r = Math.max(0, Math.min(rad[i] || 0, cw / 2 - 1e-3, ch / 2 - 1e-3));
    if (r <= 0) { P2.push([x, y]); return; }
    const cx = x === 0 ? r : x - r, cy = y === 0 ? r : y - r;
    if (chaflan) { P2.push([cx + r * Math.cos(a0), cy + r * Math.sin(a0)], [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]); }
    else P2.push(...arcoPts(cx, cy, r, a0, a1, 10));
  });
  return P2;
}
function contornoPlantilla(t, cw, ch, o) {
  let ext;
  if (t === 'redondeado' || t === 'chaflan') ext = rectEsquinas(cw, ch, [o.r1, o.r2, o.r3, o.r4], t === 'chaflan');
  else if (t === 'trapecio') ext = [[o.ib, 0], [cw - o.ib, 0], [cw - o.ia, ch], [o.ia, ch]];
  else if (t === 'arco') {
    const f = Math.max(-ch + .1, Math.min(ch - .1, o.f)), hb = f > 0 ? ch - f : ch;
    ext = [[0, 0], [cw, 0], [cw, hb], ...bulgePts([cw, hb], [0, hb], 2 * f / cw)];
    ext.pop(); ext.push([0, hb]);
  } else if (t === 'unero') {
    const w = Math.min(o.w, cw - .2), d = Math.min(o.d, ch - .2), r = Math.max(0, Math.min(o.r, w / 2 - .01, d - .01));
    const xd = (cw + w) / 2, xi = (cw - w) / 2;
    ext = [[0, 0], [cw, 0], [cw, ch], [xd, ch]];
    if (r > 0) { ext.push(...arcoPts(xd - r, ch - d + r, r, 0, -Math.PI / 2, 8), ...arcoPts(xi + r, ch - d + r, r, -Math.PI / 2, -Math.PI, 8)); }
    else ext.push([xd, ch - d], [xi, ch - d]);
    ext.push([xi, ch], [0, ch]);
  } else ext = [[0, 0], [cw, 0], [cw, ch], [0, ch]];
  const huecos = [];
  if (o.agujeroD > 0) { // agujero pasante (pasacables) centrado
    const r = o.agujeroD / 2, cx = cw / 2, cy = o.agujeroY ?? ch / 2;
    huecos.push(arcoPts(cx, cy, r, 0, -2 * Math.PI, 40).slice(0, -1));
  }
  return { ext, huecos, cw, ch };
}

/* ---------- DXF ---------- */
function parseDXF(txt) {
  const L = txt.split(/\r?\n/), pares = [];
  for (let i = 0; i + 1 < L.length; i += 2) pares.push([parseInt(L[i].trim(), 10), L[i + 1].trim()]);
  let i = 0, enEnt = false; const ents = [];
  for (; i < pares.length; i++) {
    const [c, v] = pares[i];
    if (c === 2 && v === 'ENTITIES') { enEnt = true; continue; }
    if (c === 0 && v === 'ENDSEC') enEnt = false;
    if (!enEnt || c !== 0) continue;
    const e = { tipo: v, d: [] };
    for (let j = i + 1; j < pares.length && pares[j][0] !== 0; j++) e.d.push(pares[j]);
    ents.push(e);
  }
  const g = (e, c) => { const p = e.d.find(q => q[0] === c); return p ? parseFloat(p[1]) : 0; };
  const polys = [];
  for (let k = 0; k < ents.length; k++) {
    const e = ents[k];
    if (e.tipo === 'LINE') polys.push({ pts: [[g(e, 10), g(e, 20)], [g(e, 11), g(e, 21)]], cerrado: false });
    else if (e.tipo === 'ARC') {
      let a0 = g(e, 50) * Math.PI / 180, a1 = g(e, 51) * Math.PI / 180; if (a1 <= a0) a1 += 2 * Math.PI;
      polys.push({ pts: arcoPts(g(e, 10), g(e, 20), g(e, 40), a0, a1), cerrado: false });
    } else if (e.tipo === 'CIRCLE') polys.push({ pts: arcoPts(g(e, 10), g(e, 20), g(e, 40), 0, 2 * Math.PI, 64).slice(0, -1), cerrado: true });
    else if (e.tipo === 'ELLIPSE') {
      const cx = g(e, 10), cy = g(e, 20), mx = g(e, 11), my = g(e, 21), ra = g(e, 40) || 1;
      let t0 = e.d.some(q => q[0] === 41) ? g(e, 41) : 0, t1 = e.d.some(q => q[0] === 42) ? g(e, 42) : 2 * Math.PI; if (t1 <= t0) t1 += 2 * Math.PI;
      const n = Math.max(16, Math.ceil((t1 - t0) / (Math.PI / 32))), pts = [];
      for (let s = 0; s <= n; s++) { const t = t0 + (t1 - t0) * s / n; pts.push([cx + mx * Math.cos(t) - ra * my * Math.sin(t), cy + my * Math.cos(t) + ra * mx * Math.sin(t)]); }
      const completo = Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6; if (completo) pts.pop();
      polys.push({ pts, cerrado: completo });
    } else if (e.tipo === 'LWPOLYLINE') {
      const vs = []; let cur = null;
      for (const [c, v] of e.d) {
        if (c === 10) { cur = [parseFloat(v), 0, 0]; vs.push(cur); }
        else if (c === 20 && cur) cur[1] = parseFloat(v);
        else if (c === 42 && cur) cur[2] = parseFloat(v);
      }
      const cerrado = (g(e, 70) & 1) === 1;
      polys.push(polyBulges(vs, cerrado));
    } else if (e.tipo === 'POLYLINE') {
      const cerrado = (g(e, 70) & 1) === 1, vs = [];
      for (k++; k < ents.length && ents[k].tipo !== 'SEQEND'; k++) if (ents[k].tipo === 'VERTEX') vs.push([g(ents[k], 10), g(ents[k], 20), g(ents[k], 42)]);
      polys.push(polyBulges(vs, cerrado));
    } else if (e.tipo === 'SPLINE') {
      const pts = splineDXF(e); if (pts.length > 1) polys.push({ pts, cerrado: (g(e, 70) & 1) === 1 });
    }
  }
  return polys;
}
function polyBulges(vs, cerrado) {
  if (!vs.length) return { pts: [], cerrado };
  const pts = [[vs[0][0], vs[0][1]]];
  const n = cerrado ? vs.length : vs.length - 1;
  for (let i = 0; i < n; i++) { const a = vs[i], b = vs[(i + 1) % vs.length]; pts.push(...bulgePts([a[0], a[1]], [b[0], b[1]], a[2])); }
  if (cerrado) pts.pop();
  return { pts, cerrado };
}
function splineDXF(e) {
  const grado = parseInt((e.d.find(q => q[0] === 71) || [0, 3])[1]), nudos = [], ctrl = [], pesos = [], ajuste = [];
  let cur = null, curF = null;
  for (const [c, v] of e.d) {
    if (c === 40) nudos.push(parseFloat(v));
    else if (c === 41) pesos.push(parseFloat(v));
    else if (c === 10) { cur = [parseFloat(v), 0]; ctrl.push(cur); } else if (c === 20 && cur) cur[1] = parseFloat(v);
    else if (c === 11) { curF = [parseFloat(v), 0]; ajuste.push(curF); } else if (c === 21 && curF) curF[1] = parseFloat(v);
  }
  if (ctrl.length < grado + 1 || nudos.length !== ctrl.length + grado + 1) return ajuste.length > 1 ? ajuste : ctrl;
  const w = i => pesos.length === ctrl.length ? pesos[i] : 1;
  const t0 = nudos[grado], t1 = nudos[ctrl.length], N = Math.max(32, ctrl.length * 16), pts = [];
  for (let s = 0; s <= N; s++) {
    const t = Math.min(t0 + (t1 - t0) * s / N, t1 - 1e-9);
    let k = grado; while (k < ctrl.length - 1 && t >= nudos[k + 1]) k++;
    const d = []; for (let j = 0; j <= grado; j++) { const c = ctrl[k - grado + j], ww = w(k - grado + j); d.push([c[0] * ww, c[1] * ww, ww]); }
    for (let r = 1; r <= grado; r++) for (let j = grado; j >= r; j--) {
      const i2 = k - grado + j, a = (t - nudos[i2]) / ((nudos[i2 + grado - r + 1] - nudos[i2]) || 1);
      d[j] = [0, 1, 2].map(q => (1 - a) * d[j - 1][q] + a * d[j][q]);
    }
    pts.push([d[grado][0] / d[grado][2], d[grado][1] / d[grado][2]]);
  }
  return pts;
}

/* ---------- SVG ---------- */
function parseSVG(txt) {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const raiz = doc.documentElement; if (!raiz || raiz.nodeName.toLowerCase() !== 'svg') throw new Error('No es un SVG');
  const s2 = document.importNode(raiz, true);
  s2.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden';
  document.body.appendChild(s2);
  const polys = [];
  try {
    const Mr = s2.getScreenCTM().inverse();
    const els = s2.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line');
    let diag = 0;
    try { const bb = s2.getBBox(); diag = Math.hypot(bb.width, bb.height); } catch (e) {}
    const paso = Math.max(diag / 1500, 1e-3);
    for (const el of els) {
      if (el.closest('defs,clipPath,mask,symbol')) continue;
      let len = 0; try { len = el.getTotalLength(); } catch (e) { continue; }
      if (!(len > 0)) continue;
      const M = Mr.multiply(el.getScreenCTM());
      const n = Math.min(20000, Math.max(8, Math.ceil(len / paso)));
      let run = [], prev = null; const runs = [];
      for (let i = 0; i <= n; i++) {
        const q = el.getPointAtLength(len * i / n), p = new DOMPoint(q.x, q.y).matrixTransform(M), pt = [p.x, p.y];
        if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) > (len / n) * 3 + 1e-6) { runs.push(run); run = []; }
        run.push(pt); prev = q;
      }
      runs.push(run);
      const tipo = el.nodeName.toLowerCase(), cerradoTipo = ['rect', 'circle', 'ellipse', 'polygon'].includes(tipo);
      for (const r of runs) {
        if (r.length < 2) continue;
        const cierra = Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < paso * 3;
        polys.push({ pts: r, cerrado: cerradoTipo || cierra });
      }
    }
  } finally { s2.remove(); }
  // pasar a y hacia arriba
  polys.forEach(p => p.pts = p.pts.map(([x, y]) => [x, -y]));
  // unidades: mm por unidad si el SVG lo indica
  let mmPorUnidad = null;
  const wAt = raiz.getAttribute('width') || '', vb = (raiz.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const m = wAt.match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/);
  if (m && vb.length === 4 && vb[2] > 0) {
    const f = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 }[m[2] || 'px'];
    mmPorUnidad = parseFloat(m[1]) * f / vb[2];
  }
  return { polys, mmPorUnidad };
}

/* ---------- de líneas sueltas a contornos cerrados ---------- */
function encadenar(polys, tol) {
  const cerrados = polys.filter(p => p.cerrado && p.pts.length > 2).map(p => p.pts.slice());
  let abiertos = polys.filter(p => !p.cerrado && p.pts.length > 1).map(p => p.pts.slice());
  const cerca = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  let sueltos = 0;
  while (abiertos.length) {
    let c = abiertos.shift(), sigue = true;
    while (sigue) {
      sigue = false;
      if (cerca(c[0], c[c.length - 1]) && c.length > 2) break;
      for (let i = 0; i < abiertos.length; i++) {
        const o = abiertos[i], fin = c[c.length - 1], ini = c[0];
        if (cerca(fin, o[0])) c = c.concat(o.slice(1));
        else if (cerca(fin, o[o.length - 1])) c = c.concat(o.slice().reverse().slice(1));
        else if (cerca(ini, o[o.length - 1])) c = o.concat(c.slice(1));
        else if (cerca(ini, o[0])) c = o.slice().reverse().concat(c.slice(1));
        else continue;
        abiertos.splice(i, 1); sigue = true; break;
      }
    }
    if (c.length > 3 && cerca(c[0], c[c.length - 1])) { c.pop(); cerrados.push(c); } else sueltos++;
  }
  return { cerrados, sueltos };
}
function clasificar(anillos) { // [{ext, huecos}]: los anillos dentro de otro exterior son huecos
  const L = anillos.map(a => ({ pts: a, area: Math.abs(areaPoly(a)) })).filter(a => a.area > 1e-9).sort((a, b) => b.area - a.area);
  const piezas = [];
  for (const a of L) {
    let padre = null;
    for (let i = piezas.length - 1; i >= 0; i--) if (puntoEnPoly(a.pts[0], piezas[i].ext)) { padre = piezas[i]; break; }
    if (padre && !padre.huecos.some(h => puntoEnPoly(a.pts[0], h))) padre.huecos.push(a.pts);
    else piezas.push({ ext: a.pts, huecos: [] });
  }
  return piezas;
}
// normaliza un contorno a su caja (origen 0,0) y lo escala a cm
function normalizarContorno(c, k) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of c.ext) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const tol = Math.max(x1 - x0, y1 - y0) * 4e-4;
  const f = pts => limpiarPoly(pts, tol).map(([x, y]) => [r1((x - x0) * k * 1000) / 1000, r1((y - y0) * k * 1000) / 1000]);
  return { ext: f(c.ext), huecos: c.huecos.map(f), cw: (x1 - x0) * k, ch: (y1 - y0) * k };
}
