/* Hace las miniaturas de los muebles de ejemplo (assets/ejemplos/miniaturas/<clave>.jpg) con la vista 3D del programa.
   Uso (desde la carpeta del proyecto), con Playwright instalado como para las pruebas:
     node herramientas_desarrollo/miniaturas.js
   Vuelve a hacerlas cuando cambies o añadas un ejemplo (herramientas_desarrollo/ejemplos.py). */
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..'), DEST = path.join(RAIZ, 'assets', 'ejemplos', 'miniaturas');
(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1760, height: 900 } });   // vista 3D apaisada
  await p.goto('file://' + path.join(RAIZ, 'Boceto_Render3D.html')); await p.waitForFunction(() => window.__app);
  await p.evaluate(() => { try { localStorage.setItem('boceto3d.tema', 'claro'); } catch (e) {} document.documentElement.dataset.theme = 'claro'; });
  await p.click('[data-dist="solo3d"]');
  const L = await p.evaluate(() => { document.querySelector('#bEjemplo').click(); const n = [...document.querySelectorAll('#mCuerpo [data-ej]')].map(x => x.dataset.clave); document.querySelector('#mPie button').click(); return n; });
  for (let i = 0; i < L.length; i++) {
    await p.click('#bEjemplo'); await p.click(`#mCuerpo [data-ej="${i}"]`); await p.waitForTimeout(1500);
    await p.evaluate(() => { __app.seleccionar([]); document.querySelector('[data-cam="izq"]').click(); __app.P().piezas.forEach(q => { if (q.boceto) q.visible = false; }); });
    await p.waitForTimeout(1200);
    // se aleja la cámara un poco para que el mueble quepa entero con aire; se ocultan los botones y ventanas que hay encima de la vista
    await p.evaluate(() => { const A = __app, c = A.camara, t = A.controles.target; c.position.sub(t).multiplyScalar(1.22).add(t); A.controles.update(); A.render3D(); });
    await p.addStyleTag({ content: '#v3d .vtit,#v3d .mov3d,.flotante,[id^=flot],.aviso{visibility:hidden!important}' });
    const fl = await p.$('#bFlotCerrar'); if (fl && await fl.isVisible()) await fl.click();
    await p.waitForTimeout(500);
    fs.writeFileSync(path.join(DEST, L[i] + '.jpg'), await (await p.$('#c3d')).screenshot({ type: 'jpeg', quality: 90 }));
    console.log('✔', L[i]);
  }
  await b.close();
})();
