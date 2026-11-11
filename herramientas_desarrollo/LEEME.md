# Herramientas de desarrollo

No hacen falta para usar el programa: solo para cambiarlo.

| Archivo | Para qué |
|---|---|
| `src/01_base.js` … `src/09_inicio.js` | El código del programa en partes. `assets/js/app.js` es su unión, en orden |
| `construir.bat` / `construir.sh` | Une las partes en `../assets/js/app.js` (Windows / Linux o Mac) |
| `entry.js` + `package.json` | Empaqueta Three.js y sus añadidos (OrbitControls, RoomEnvironment, RoundedBoxGeometry, utilidades de geometría) en `../assets/js/three-bundle.js`, sin módulos: `npm install` y `npm run three` |
| `ejemplos.py` | Genera `../assets/ejemplos/ejemplos.js` con los muebles de ejemplo (todos menos la mesita): `python ejemplos.py` |
| `texturas.py` | Genera las maderas, el parquet, la pared y las almas de tablero (`python texturas.py ../assets/texturas`; necesita numpy, scipy y Pillow) |
| `src/04b_mueblecad.js` | Ventana de dibujo de contornos con MUEBLECAD 2D (antes `04b_calcador.js`) |
| `../assets/mueblecad/mueblecad.html` | Copia de MUEBLECAD 2D. Se comunica por mensajes: `?modo=pieza3d` (mismo protocolo que el Calcador: `pieza3d-listo`, `pieza3d-datos`, `pieza3d-resultado`, `pieza3d-cancelar`) y `?desde=boceto` (`mueblecad-listo` → `boceto-mueble-envio` con el paquete de `paqueteMueblecad()`) |

## Pruebas automáticas

`pruebas/probar.js` abre Boceto y MUEBLECAD en un Chromium sin ventana y comprueba los casos importantes: los ejemplos (pasan a MUEBLECAD y «Comprobar» no da errores), los ensambles de la mesa, las piezas de distinta sección, la tolva (ángulos y edición), las patas abiertas, el inglete de tres piezas y el modo básico.

```
npm install --no-save playwright
npx playwright install chromium
node herramientas_desarrollo/pruebas/probar.js          # todas
node herramientas_desarrollo/pruebas/probar.js tolva    # solo las que contienen «tolva»
```

Termina con «N bien, M mal» y código de salida 1 si algo falla. Conviene pasarlas antes de publicar.

`extraer_ensambles.py` regenera `assets/ensambles/catalogo.js` desde `ensambles_3d.html` del programa Ensambles 3D.
