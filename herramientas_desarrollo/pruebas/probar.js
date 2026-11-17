/* Pruebas automáticas de Boceto a Render 3D y MUEBLECAD 2D.
   Abren los programas en un Chromium sin ventana, hacen lo que haría una persona y comprueban el resultado.
   Uso (desde la carpeta del proyecto):
     npm install --no-save playwright && npx playwright install chromium     (solo la primera vez)
     node herramientas_desarrollo/pruebas/probar.js            todas
     node herramientas_desarrollo/pruebas/probar.js tolva      solo las que contienen «tolva» en el nombre
   Termina con código 0 si todo va bien y 1 si algo falla. */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Falta Playwright: npm install --no-save playwright && npx playwright install chromium'); process.exit(2); }
const RAIZ = path.resolve(__dirname, '..', '..'), url = r => 'file://' + path.join(RAIZ, r).replace(/\\/g, '/');
const BOCETO = url('Boceto_Render3D.html'), MC = url('assets/mueblecad/mueblecad.html');
const filtro = process.argv[2] || '';
const pruebas = [];
const prueba = (nombre, fn) => pruebas.push({ nombre, fn });
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg}: se esperaba ${JSON.stringify(b)} y sale ${JSON.stringify(a)}`); }
function cierto(v, msg) { if (!v) throw new Error(msg); }
function cerca(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg}: se esperaba ${b} ± ${tol} y sale ${a}`); }

async function abrirBoceto(ctx, ejemplo) {
  const p = await ctx.newPage(); p._err = []; p.on('pageerror', e => p._err.push(e.message));
  await p.goto(BOCETO); await p.waitForFunction(() => window.__app);
  await p.evaluate(() => { try { localStorage.setItem('boceto3d.modo', 'avanzado'); } catch (e) {} });
  if (ejemplo != null) { await p.click('#bEjemplo'); await p.click(`#mCuerpo [data-ej="${ejemplo}"]`); await p.waitForTimeout(800); }
  return p;
}
async function aMueblecad(ctx, pq) {
  const m = await ctx.newPage(); m._err = []; m.on('pageerror', e => m._err.push(e.message));
  await m.goto(MC); await m.waitForFunction(() => typeof importarMueble === 'function');
  const r = await m.evaluate(pq => { importarMueble(pq); return { piezas: D.ents.filter(e => e.pieza).map(e => ({ n: e.pieza.nombre, c: e.pieza.cant })), errores: comprobar().filter(o => o.niv === 'error').map(o => o.t), textos: D.ents.filter(e => e.t === 'text').map(e => e.s) }; }, pq);
  cierto(!m._err.length, 'MUEBLECAD da errores: ' + m._err.join(' | ')); await m.close(); return r;
}
async function ensamble(ctx, p, ids, id, aceptarTodas) {
  await p.evaluate(s => __app.seleccionar(s), ids);
  const [e] = await Promise.all([ctx.waitForEvent('page'), p.click('#bEnsamble')]);
  e._err = []; e.on('pageerror', x => e._err.push(x.message));
  await e.waitForFunction(() => window.__ens && __ens.resultado);
  const lista = await e.evaluate(() => [...document.querySelectorAll('.ens')].map(x => x.dataset.id + (x.classList.contains('no') ? '✗' : '')));
  if (id) await e.evaluate(j => __ens.elegir(j), id);
  cierto(!e._err.length, 'La página de ensambles da errores: ' + e._err.join(' | '));
  await e.click('#bAplicar'); await p.waitForTimeout(500);
  if (aceptarTodas) { await p.click('#mPie .primario'); await p.waitForTimeout(300); }
  return lista;
}

prueba('ejemplos: abren, pasan a MUEBLECAD y Comprobar no da errores', async ctx => {
  const p = await abrirBoceto(ctx);
  const n = await p.evaluate(() => { document.querySelector('#bEjemplo').click(); const k = document.querySelectorAll('#mCuerpo [data-ej]').length; document.querySelector('#mPie button').click(); return k; });
  cierto(n >= 7, 'faltan ejemplos');
  for (let i = 0; i < n; i++) {
    await p.click('#bEjemplo'); await p.click(`#mCuerpo [data-ej="${i}"]`); await p.waitForTimeout(700);
    const pq = await p.evaluate(() => __app.paqueteMueblecad('clavijas'));
    cierto(pq.piezas.length > 0, `ejemplo ${i}: sin piezas`);
    const r = await aMueblecad(ctx, pq);
    igual(r.errores.length, 0, `ejemplo ${i} (${pq.nombre}): errores de Comprobar ${r.errores.join(' | ')}`);
  }
  cierto(!p._err.length, 'Boceto da errores: ' + p._err.join(' | '));
});

prueba('ensambles: pata de la mesa, las cuatro patas, largo de corte y piezas agrupadas', async ctx => {
  const p = await abrirBoceto(ctx, 3);
  const lista = await ensamble(ctx, p, ['mes2', 'mes7', 'mes8'], null, true);
  igual(lista.join(','), 'pataMesa', 'ensambles propuestos');
  igual(await p.evaluate(() => __app.P().ensambles.length), 4, 'ensambles en las 4 patas');
  const pq = await p.evaluate(() => __app.paqueteMueblecad('clavijas'));
  igual(pq.piezas.find(x => x.nombre === 'Cintura delantera').largoCorte, 1400, 'largo de corte de la cintura');
  const r = await aMueblecad(ctx, pq);
  cierto(r.piezas.some(x => x.n === 'Pata' && x.c === 4), 'las patas no salen agrupadas: ' + JSON.stringify(r.piezas));
  igual(r.errores.length, 0, 'Comprobar');
});

prueba('ensambles: piezas de distinta sección solo admiten caja y espiga o tarugos', async ctx => {
  const p = await abrirBoceto(ctx, 6);
  const lista = await ensamble(ctx, p, ['cen2', 'cen6'], 'retalon');
  cierto(lista.includes('retalon') && lista.includes('horquilla✗'), 'lista: ' + lista);
  const ex = await p.evaluate(() => __app.P().ensambles[0].piezas.find(q => q.extra).extra);
  igual(ex, 30, 'espiga del retalón');
});

prueba('tolva: ángulos de inglete compuesto y edición de sus medidas', async ctx => {
  const p = await abrirBoceto(ctx);
  await p.evaluate(() => { __app.P().piezas = []; __app.sincronizar3D(); });
  await p.click('#bTolva'); await p.click('#mPie .primario'); await p.waitForTimeout(400);
  let pq = await p.evaluate(() => __app.paqueteMueblecad('ninguna'));
  igual(pq.piezas.length, 4, 'laterales');
  cierto(pq.piezas[0].notas.join(' ').includes('inglete 14,5° · bisel 43,1°'), 'ángulos con 15°: ' + pq.piezas[0].notas);
  // editar: 25° y otro alto; los ángulos salen de la geometría y tienen que coincidir con la fórmula
  await p.evaluate(() => __app.seleccionar([__app.P().piezas[0].id]));
  await p.click('#bEditTolva'); await p.fill('#tvI', '25'); await p.fill('#tvH', '30'); await p.click('#mPie .primario'); await p.waitForTimeout(400);
  pq = await p.evaluate(() => __app.paqueteMueblecad('ninguna'));
  const t = 25 * Math.PI / 180, g = v => String(Math.round(v * 1800 / Math.PI) / 10).replace('.', ',');
  cierto(pq.piezas[0].notas.join(' ').includes(`inglete ${g(Math.atan(Math.sin(t)))}° · bisel ${g(Math.asin(Math.cos(t) * Math.SQRT1_2))}°`), 'ángulos con 25°: ' + pq.piezas[0].notas);
  const b = await p.evaluate(() => { const q = __app.cajaReal(__app.P().piezas[0]); return q.y1 - q.y0; });
  cerca(b, 30, .01, 'alto de la tolva editada');
  const r = await aMueblecad(ctx, pq); igual(r.piezas.length, 2, 'laterales agrupados de dos en dos');
});

prueba('patas abiertas hacia fuera: madera de partida y cortes', async ctx => {
  const p = await abrirBoceto(ctx, 3);
  await p.evaluate(() => __app.seleccionar(['mes2', 'mes3', 'mes4', 'mes5']));
  await p.click('#bHaciaFuera'); await p.click('#mPie .primario'); await p.waitForTimeout(400);
  const pq = await p.evaluate(() => __app.paqueteMueblecad('ninguna'));
  const pt = pq.piezas.filter(x => /^Pata/.test(x.nombre));
  igual(pt.length, 4, 'patas'); pt.forEach(x => { igual(x.L, 754, 'madera de partida de ' + x.nombre); cierto(x.notas.join(' ').includes('Inclinada 8° y 8°'), 'nota de ' + x.nombre); });
  const pie = await p.evaluate(() => __app.cajaReal(__app.P().piezas.find(x => x.id === 'mes2')));
  cerca(pie.y0, 0, .01, 'la pata apoya en el suelo'); cerca(pie.y1, 72, .01, 'la pata llega al tablero');
});

prueba('inglete en esquina de tres piezas: se rehace al cambiar medidas', async ctx => {
  const p = await abrirBoceto(ctx, 3);
  await p.evaluate(() => { const P = __app.P(), b = JSON.parse(JSON.stringify(P.piezas[0])); P.piezas = []; P.ensambles = [];
    const mk = (id, nombre, x, y, z, w, h, d) => P.piezas.push(Object.assign(JSON.parse(JSON.stringify(b)), { id, nombre, x, y, z, w, h, d, grupo: null, material: 'roble' }));
    mk('L', 'Lateral', 0, 0, 0, 1.8, 40, 30); mk('T', 'Tapa', 0, 40, 0, 60, 1.8, 30); mk('A', 'Trasera', 1.8, 0, 0, 56.4, 40, 1.8); __app.sincronizar3D(); __app.seleccionar(['L', 'T', 'A']); });
  await p.click('#bInglete'); await p.waitForTimeout(300);
  igual(await p.evaluate(() => (__app.P().ingletes || []).length), 1, 'inglete guardado');
  const ang = await p.evaluate(() => __app.paqueteMueblecad('ninguna').piezas.map(x => x.nombre + ':' + x.notas.join('/')));
  cierto(ang.every(s => /45°/.test(s)), 'ángulos de 45°: ' + ang);
  // la tapa se hace más gruesa: el inglete deja de ser de 45° y se rehace solo
  await p.evaluate(() => { const t = __app.P().piezas.find(x => x.id === 'T'); t.h = 3.6; __app.cambio(true); });
  const nt = await p.evaluate(() => __app.paqueteMueblecad('ninguna').piezas.find(x => x.nombre === 'Lateral').notas.join('/'));
  cierto(/63,4°|26,6°/.test(nt), 'el inglete del lateral con la tapa más gruesa tiene que ser de 63,4° / 26,6°: ' + nt);
  await p.evaluate(() => __app.seleccionar(['L', 'T', 'A'])); await p.waitForTimeout(200);
  const est = await p.evaluate(() => { const b = document.querySelector('#fCortes'); return b.disabled + ' ' + b.textContent + ' ' + getComputedStyle(b).display; });
  cierto(est.startsWith('false'), 'botón de quitar: ' + est);
  await p.click('#fCortes'); igual(await p.evaluate(() => (__app.P().ingletes || []).length), 0, 'inglete quitado');
});

prueba('modo básico: oculta las herramientas avanzadas', async ctx => {
  const p = await abrirBoceto(ctx, 3);
  await p.evaluate(() => __app.seleccionar(['mes2']));
  await p.click('#bModo');
  cierto(await p.evaluate(() => document.body.classList.contains('basico') && getComputedStyle(document.querySelector('#formaSec')).display === 'none' && getComputedStyle(document.querySelector('#ensSec')).display === 'none'), 'en básico se siguen viendo');
  await p.click('#bModo');
  cierto(await p.evaluate(() => !document.body.classList.contains('basico') && getComputedStyle(document.querySelector('#formaSec')).display !== 'none'), 'en avanzado no se ven');
});

prueba('escena: suelos y paredes de la habitación y foto de fondo', async ctx => {
  const p = await abrirBoceto(ctx, 2);
  await p.selectOption('#eEscenario', 'salon');
  cierto(await p.evaluate(() => !document.querySelector('#filaSuelo').classList.contains('oculto')), 'no aparece el suelo');
  const suelos = await p.evaluate(() => [...document.querySelectorAll('#eSuelo option')].map(o => o.value));
  for (const s of suelos.concat(['ladrillo', 'azulejo', 'listones'])) {
    await p.evaluate(s => __app.texturaDecorado(s), s);
    await p.waitForFunction(s => __app.texturaDecorado(s).listo || s === 'clasico', s, { timeout: 15000 }).catch(() => { throw new Error('no se hace la textura ' + s); });
  }
  for (const s of suelos) await p.selectOption('#eSuelo', s);
  for (const w of ['lisa', 'ladrillo', 'azulejo', 'listones', 'ninguna']) await p.selectOption('#ePared', w);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.selectOption('#eEscenario', 'foto')]);
  await fc.setFiles(require('path').join(RAIZ, 'ayuda', 'img', 'escenarios.jpg')); await p.waitForTimeout(800);
  cierto(await p.evaluate(() => (__app.P().escena.foto || '').startsWith('data:image/jpeg')), 'la foto no se guarda en el proyecto');
  cierto(!p._err.length, 'errores: ' + p._err.join(' | '));
});

(async () => {
  const b = await chromium.launch(); let ok = 0, mal = 0; const t0 = Date.now();
  for (const t of pruebas.filter(t => t.nombre.includes(filtro))) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 860 } });
    try { await t.fn(ctx); ok++; console.log('✔ ' + t.nombre); }
    catch (e) { mal++; console.log('✘ ' + t.nombre + '\n    ' + String(e.message).split('\n')[0]); }
    await ctx.close();
  }
  await b.close();
  console.log(`\n${ok} bien, ${mal} mal (${Math.round((Date.now() - t0) / 1000)} s)`);
  process.exit(mal ? 1 : 0);
})();
