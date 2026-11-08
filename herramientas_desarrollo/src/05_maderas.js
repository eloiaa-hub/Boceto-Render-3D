
/* ===================== MADERAS DESDE FOTOS ===================== */
// Biblioteca personal: IndexedDB del navegador (queda en este ordenador, para todos los proyectos)
const DB = {
  abrir() {
    return new Promise((res, rej) => {
      try { const r = indexedDB.open('boceto3d', 1); r.onupgradeneeded = () => r.result.createObjectStore('maderas'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
      catch (e) { rej(e); }
    });
  },
  async todas() {
    const db = await this.abrir();
    return new Promise(res => { const o = {}; const tx = db.transaction('maderas'); const st = tx.objectStore('maderas');
      st.openCursor().onsuccess = e => { const c = e.target.result; if (c) { o[c.key] = c.value; c.continue(); } else res(o); }; tx.onerror = () => res(o); });
  },
  async poner(k, v) { const db = await this.abrir(); return new Promise(res => { const tx = db.transaction('maderas', 'readwrite'); tx.objectStore('maderas').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); },
  async quitar(k) { const db = await this.abrir(); return new Promise(res => { const tx = db.transaction('maderas', 'readwrite'); tx.objectStore('maderas').delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); },
};
async function cargarBiblioteca() { try { BIBLIO = await DB.todas(); } catch (e) { BIBLIO = {}; } }

// --- tratamiento de la foto ---
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function procesarFoto(im, o) {
  const max = 1024, esc0 = Math.min(1, max / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height));
  let w = Math.round((im.naturalWidth || im.width) * esc0), h = Math.round((im.naturalHeight || im.height) * esc0);
  // recorte central (porcentaje que se conserva)
  const rc = Math.max(.2, Math.min(1, o.recorte || 1));
  let c = lienzo(o.girar ? h : w, o.girar ? w : h), x = c.getContext('2d');
  if (o.girar) { x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(im, -w / 2, -h / 2, w, h); x.setTransform(1, 0, 0, 1, 0, 0); }
  else x.drawImage(im, 0, 0, w, h);
  if (rc < 1) {
    const cw = Math.round(c.width * rc), ch = Math.round(c.height * rc), c2 = lienzo(cw, ch);
    c2.getContext('2d').drawImage(c, (c.width - cw) / 2, (c.height - ch) / 2, cw, ch, 0, 0, cw, ch); c = c2; x = c.getContext('2d');
  }
  w = c.width; h = c.height;
  let img = x.getImageData(0, 0, w, h), d = img.data;
  if (o.igualar) { // quita las manchas de luz: divide por una versión muy borrosa
    const pw = 12, ph = Math.max(2, Math.round(12 * h / w)), peq = lienzo(pw, ph), px = peq.getContext('2d');
    px.imageSmoothingQuality = 'high'; px.drawImage(c, 0, 0, pw, ph);
    const gr = lienzo(w, h), gx = gr.getContext('2d'); gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high'; gx.drawImage(peq, 0, 0, w, h);
    const L = gx.getImageData(0, 0, w, h).data;
    let media = 0; for (let i = 0; i < L.length; i += 4) media += .3 * L[i] + .59 * L[i + 1] + .11 * L[i + 2]; media /= (L.length / 4);
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.max(8, .3 * L[i] + .59 * L[i + 1] + .11 * L[i + 2]), k = media / l;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
    }
    x.putImageData(img, 0, 0);
  }
  if (o.repetible) { // mezcla con una copia desplazada media imagen: los bordes empalman sin costura
    const sh = lienzo(w, h), sx = sh.getContext('2d'), hw = Math.floor(w / 2), hh = Math.floor(h / 2);
    sx.drawImage(c, hw, hh, w - hw, h - hh, 0, 0, w - hw, h - hh); sx.drawImage(c, 0, hh, hw, h - hh, w - hw, 0, hw, h - hh);
    sx.drawImage(c, hw, 0, w - hw, hh, 0, h - hh, w - hw, hh); sx.drawImage(c, 0, 0, hw, hh, w - hw, h - hh, hw, hh);
    const S = sx.getImageData(0, 0, w, h).data; img = x.getImageData(0, 0, w, h); d = img.data;
    const ven = t => { const v = Math.min(1, Math.min(t, 1 - t) / .22); return v * v * (3 - 2 * v); };
    const wx = new Float32Array(w), wy = new Float32Array(h);
    for (let i = 0; i < w; i++) wx[i] = ven((i + .5) / w); for (let j = 0; j < h; j++) wy[j] = ven((j + .5) / h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const m = wx[i] * wy[j], q = (j * w + i) * 4;
      d[q] = d[q] * m + S[q] * (1 - m); d[q + 1] = d[q + 1] * m + S[q + 1] * (1 - m); d[q + 2] = d[q + 2] * m + S[q + 2] * (1 - m);
    }
    x.putImageData(img, 0, 0);
  }
  let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 64) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
  return { lienzo: c, hex };
}
function mosaico(cv, src, n) { // vista previa repetida n x n
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  const tw = cv.width / n, th = tw * src.height / src.width;
  for (let j = 0; j * th < cv.height; j++) for (let i = 0; i < n; i++) c.drawImage(src, i * tw, j * th, tw, th);
}

function añadirMaderaFoto() {
  leerArchivo('image/*').then(async f => {
    if (!f) return;
    const im = await cargarImagen(f.datos);
    let res = null;
    modal('Madera desde foto', `<p class="nota">Foto frontal del tablero, sin sombras y con la <b>veta en horizontal</b> (si va en vertical, marca «Girar»). Abajo ves cómo queda repetida.</p>
      <canvas id="cMos" class="prevc" width="460" height="230"></canvas>` + formulario([
      { id: 'nom', et: 'Nombre', v: f.nombre.replace(/\.[^.]+$/, ''), txt: true },
      { id: 'cm', et: 'Ancho real que abarca la foto (cm)', v: 60, step: 1 },
      { id: 'recorte', et: 'Conservar del centro (%)', v: 100, step: 5 },
      { id: 'girar', et: 'Girar 90° (veta vertical en la foto)', v: im.naturalHeight > im.naturalWidth * 1.15, chk: true },
      { id: 'igualar', et: 'Igualar la luz (quita zonas más claras u oscuras)', v: true, chk: true },
      { id: 'repetible', et: 'Hacerla repetible sin costuras', v: true, chk: true },
      { id: 'biblio', et: 'Guardarla también en mi biblioteca (para otros proyectos)', v: true, chk: true }]), [
      { txt: 'Cancelar' },
      { txt: 'Añadir', primario: true, fn: () => {
        if (!res) return false;
        const cm = Math.max(1, fv('cm'));
        const datos = { nombre: (fv('nom') || 'Madera').trim(), src: res.lienzo.toDataURL('image/jpeg', .86), cm, cmV: cm * res.lienzo.height / res.lienzo.width, hex: res.hex };
        const clave = 'u_' + Date.now().toString(36);
        P.maderasUsuario[clave] = datos;
        if (fv('biblio')) { BIBLIO[clave] = datos; DB.poner(clave, datos).catch(() => aviso('No se pudo guardar en la biblioteca del navegador')); }
        opcionesMaterial(); opcionesMaterial('#pCantoMat');
        const L = seleccionadas();
        if (L.length) { guardarHistoria(); L.forEach(p => p.material = clave); ultimoMaterial = clave; }
        cambio(true); aviso('Madera «' + datos.nombre + '» añadida' + (L.length ? ' y aplicada' : ''));
      } }], '540px');
    const rehacerPrev = () => {
      res = procesarFoto(im, { girar: fv('girar'), igualar: fv('igualar'), repetible: fv('repetible'), recorte: fv('recorte') / 100 });
      mosaico($('#cMos'), res.lienzo, 3);
    };
    $$('#mCuerpo input').forEach(i => i.addEventListener('change', rehacerPrev));
    rehacerPrev();
  });
}

function gestorMaderas() {
  const fila = (k, m, origen) => `<div class="item" data-k="${k}" data-o="${origen}">
      <img src="${m.src}" alt="">
      <input type="text" value="${esc(m.nombre)}" ${origen === 'aula' ? 'disabled' : ''} data-campo="nombre">
      <label class="fila" style="margin:0">cm <input type="number" value="${r1(m.cm)}" step="1" style="width:70px" ${origen === 'aula' ? 'disabled' : ''} data-campo="cm"></label>
      <div class="acc">
        <button data-acc="usar" title="Aplicar a las piezas seleccionadas">Usar</button>
        ${origen === 'proyecto' && !BIBLIO[k] ? '<button data-acc="abib" title="Copiar a mi biblioteca">→ Bibl.</button>' : ''}
        ${origen !== 'aula' ? '<button data-acc="quitar" class="peligro" title="Quitar">🗑</button>' : ''}
      </div>
      <span class="orig">${{ proyecto: 'En este proyecto', biblio: 'Mi biblioteca', aula: 'Del aula' }[origen]}</span></div>`;
  const pintar = () => {
    const vistos = new Set(); let h = '';
    const sec = (tit, fuente, origen, vacio) => {
      const ks = Object.keys(fuente).filter(k => !vistos.has(k)); ks.forEach(k => vistos.add(k));
      h += `<h4>${tit}</h4>` + (ks.length ? `<div class="bib">${ks.map(k => fila(k, fuente[k], origen)).join('')}</div>` : `<p class="nota">${vacio}</p>`);
    };
    sec('Mi biblioteca (este ordenador)', BIBLIO, 'biblio', 'Vacía. Las fotos que añadas se guardan aquí para todos tus proyectos.');
    sec('En este proyecto', P.maderasUsuario, 'proyecto', 'Ninguna.');
    sec('Del aula (archivo assets/texturas/maderas_aula.js)', AULA, 'aula', 'Ninguna. Exporta tu biblioteca y copia el archivo en esa carpeta para que la tengan todos los ordenadores.');
    $('#mCuerpo').innerHTML = `<div class="col2"><button id="bAñadirFoto" class="primario">📷 Añadir madera desde foto…</button><button id="bExpAula">⬇ Exportar para el aula</button></div>` + h;
    $('#bAñadirFoto').onclick = () => { cerrarModal(); añadirMaderaFoto(); };
    $('#bExpAula').onclick = () => {
      const todas = Object.assign({}, AULA, BIBLIO);
      if (!Object.keys(todas).length) return aviso('La biblioteca está vacía');
      const js = '/* Maderas del aula — generado por Boceto a Render 3D. Copia este archivo en assets/texturas/ */\nwindow.MADERAS_AULA = ' + JSON.stringify(todas) + ';\n';
      descargar('maderas_aula.js', new Blob([js], { type: 'text/javascript' }));
      aviso('Copia maderas_aula.js en la carpeta assets/texturas del programa');
    };
    $$('.bib .item').forEach(it => {
      const k = it.dataset.k, o = it.dataset.o, fuente = o === 'biblio' ? BIBLIO : o === 'proyecto' ? P.maderasUsuario : AULA;
      it.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        const m = fuente[k]; if (!m) return;
        if (inp.dataset.campo === 'nombre') m.nombre = inp.value.trim() || m.nombre;
        else { const v = Math.max(1, parseFloat(inp.value) || m.cm); m.cmV = (m.cmV || m.cm) * v / m.cm; m.cm = v; }
        if (o === 'biblio') DB.poner(k, m);
        if (P.maderasUsuario[k] && o !== 'proyecto') Object.assign(P.maderasUsuario[k], { nombre: m.nombre, cm: m.cm, cmV: m.cmV });
        olvidarMaterial(k); opcionesMaterial(); opcionesMaterial('#pCantoMat'); cambio(true);
      }));
      it.querySelectorAll('button').forEach(bt => bt.onclick = async () => {
        const a = bt.dataset.acc;
        if (a === 'usar') {
          const L = seleccionadas(); if (!L.length) return aviso('Selecciona antes las piezas');
          guardarHistoria(); asegurarMadera(k); L.forEach(p => p.material = k); ultimoMaterial = k; opcionesMaterial(); cambio(true); aviso('Aplicada a ' + L.length + ' pieza(s)');
        }
        if (a === 'abib') { BIBLIO[k] = JSON.parse(JSON.stringify(P.maderasUsuario[k])); await DB.poner(k, BIBLIO[k]); pintar(); }
        if (a === 'quitar') {
          if (o === 'biblio') { delete BIBLIO[k]; await DB.quitar(k); }
          if (o === 'proyecto') {
            if (P.piezas.some(p => p.material === k || p.cantoMat === k)) return aviso('Hay piezas que la usan: cámbiales antes el material');
            delete P.maderasUsuario[k];
          }
          opcionesMaterial(); opcionesMaterial('#pCantoMat'); pintar(); guardarLocal();
        }
      });
    });
  };
  modal('Maderas desde fotos', '', [{ txt: 'Cerrar' }], '760px');
  pintar();
}
$('#bMaderas').onclick = gestorMaderas;
