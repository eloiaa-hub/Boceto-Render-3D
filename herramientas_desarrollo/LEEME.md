# Herramientas de desarrollo

No hacen falta para usar el programa: solo para cambiarlo.

| Archivo | Para qué |
|---|---|
| `src/01_base.js` … `src/09_inicio.js` | El código del programa en partes. `assets/js/app.js` es su unión, en orden |
| `construir.bat` / `construir.sh` | Une las partes en `../assets/js/app.js` (Windows / Linux o Mac) |
| `entry.js` + `package.json` | Empaqueta Three.js y sus añadidos (OrbitControls, RoomEnvironment, RoundedBoxGeometry, utilidades de geometría) en `../assets/js/three-bundle.js`, sin módulos: `npm install` y `npm run three` |
| `ejemplos.py` | Genera `../assets/ejemplos/ejemplos.js` con los muebles de ejemplo (todos menos la mesita): `python ejemplos.py` |
| `texturas.py` | Genera las maderas, el parquet, la pared y las almas de tablero (`python texturas.py ../assets/texturas`; necesita numpy, scipy y Pillow) |
| *(nota)* | Las partes de `src/` no están en el repositorio: desde la v3.4 los cambios se hacen directamente en `assets/js/app.js` |
| `../assets/mueblecad/mueblecad.html` | Copia de MUEBLECAD 2D. Se comunica por mensajes: `?modo=pieza3d` (mismo protocolo que el Calcador: `pieza3d-listo`, `pieza3d-datos`, `pieza3d-resultado`, `pieza3d-cancelar`) y `?desde=boceto` (`mueblecad-listo` → `boceto-mueble-envio` con el paquete de `paqueteMueblecad()`) |
| `calcador_modo_pieza3d.html` | El bloque que se añade al Calcador para el modo «Pieza 3D» (justo antes de `<!-- MODO LÁSER: inicio -->`). Solo actúa con `calcador.html?modo=pieza3d` |
