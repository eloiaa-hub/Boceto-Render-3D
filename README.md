# Boceto a Render 3D y MUEBLECAD 2D — Por Eloi A.A.

**Boceto a Render 3D versión 3.4** · **MUEBLECAD 2D v4** · novedades en [NOVEDADES.md](NOVEDADES.md)

**Portada en línea:** <https://eloiaa-hub.github.io/Boceto-Render-3D/>

Del boceto a mano de un mueble a una **imagen realista**, a un **plano de taller** con herrajes y cotas, y al **despiece para el Anidador**.
Funciona en el navegador (Chrome, Edge o Firefox), sin instalar nada y **sin conexión a internet**.

No usa inteligencia artificial: el mueble se construye con piezas (tableros, cajones, patas, tiradores…) que se dibujan
en alzado, planta y perfil, calcando el boceto. Con esas piezas monta el modelo 3D, le pone madera, luz y sombras, y genera
la imagen final en PNG.

## Cómo se usa

1. Descarga el repositorio (**Code → Download ZIP**) y descomprímelo.
2. Abre **`index.html`** (la portada de los dos programas) o directamente **`Boceto_Render3D.html`**, con doble clic.
3. Manuales en HTML y PDF: Boceto en `ayuda/` (también en el botón ❓ Ayuda) y MUEBLECAD en `assets/mueblecad/` (botón 📖 Manual).

> Copia siempre **la carpeta completa**: el programa necesita `assets/` y `ayuda/`.

## Qué hace

- **Boceto**: como fondo de una vista para calcarlo (escalado a su medida real) o como referencia flotante.
- **Vistas**: tres paneles 2D, cada uno con la vista que elijas (alzado, posterior, planta, hormiga, perfil izquierdo o derecho), ampliables, más la vista 3D.
- **Piezas**: cajas, cilindros y piezas con contorno (plantillas, DXF/SVG o **dibujadas a mano en MUEBLECAD 2D**, que se abre dentro del programa). Selección múltiple, grupos y repetición en serie.
- **Plantillas de taller**: cuerpo, frentes, cajón completo, bisagras, patas y tiradores.
- **Movimiento**: abrir puertas y cajones y vista explosionada, con animación.
- **Materiales**: maderas, melaminas, lacados, metales y cristal; tipo de tablero (macizo, aglomerado, MDF, contrachapado) y cantos; maderas desde fotos, con biblioteca personal y del aula.
- **Render**: imagen realista hasta 4K con sombras suaves, oclusión y desenfoque de fondo.
- **Lámina técnica**: vistas con aristas ocultas, cotas en mm y cajetín, en sistema europeo o americano; en **PDF** y **DXF**.
- **Plano de taller en MUEBLECAD 2D** (botón ▱ MUEBLECAD): lámina de conjunto (alzado, planta y perfil con aristas ocultas y apertura de puertas) y lámina con todas las piezas desplegadas, con material, grueso, veta y cantos.
- **Despiece**: en CSV para hoja de cálculo, en JSON para MUEBLECAD o en ZIP para el **Anidador de tableros** de la [Suite CNC](https://github.com/eloiaa-hub/Suite-CNC).
- **Ejemplos**: mesita de noche, estantería, aparador de dos puertas, mesa de comedor, cómoda, escritorio y mesa de centro.

## MUEBLECAD 2D

Programa de CAD 2D para muebles, también independiente (`assets/mueblecad/mueblecad.html`):

- Dibujo técnico con capas, tipos y grosores de línea, imanes, orto y polar; elipses y splines editables.
- Edición de CAD (mover, girar, escalar, simetría, matrices, estirar, recortar, alargar, equidistante, empalme, chaflán) y también como programa vectorial: caja para escalar y girar, arrastrar, menú del botón derecho.
- Operaciones booleanas y simplificación de curvas a rectas y arcos.
- Piezas de tablero con material, grueso, veta y cantos; biblioteca de materiales con su rayado de sección.
- Taladros y herrajes (sistema 32, bisagras, Minifix, clavijas, tiradores, galletas, espigas) y comprobaciones.
- Cotas UNE que siguen a las piezas y que cambian la medida con doble clic; cortes, detalles ampliados y apertura de puertas.
- Despiece con superficie y metros de canto, tabla de taladros, CSV para el Anidador.
- DXF R2000 de ida y vuelta, SVG y PDF a escala con cajetín y plantilla del centro.

## Archivos

| Archivo / carpeta | Qué es |
|---|---|
| `Boceto_Render3D.html` | El programa |
| `index.html` | Portada de los dos programas (también en GitHub Pages) |
| `assets/js/app.js` | Código del programa (se genera uniendo las partes de `herramientas_desarrollo/src`) |
| `assets/js/three-bundle.js` | [Three.js](https://threejs.org) empaquetado sin módulos, para funcionar con doble clic |
| `assets/texturas/` | Maderas y almas de tablero (`texturas.js`); `maderas_aula.js`, las maderas de fotos del aula |
| `assets/mueblecad/` | MUEBLECAD 2D (`mueblecad.html`) y su manual en HTML y PDF; dibuja los contornos de Boceto (modo «Pieza 3D») y recibe el mueble para el plano de taller |
| `assets/ejemplos/` | Muebles de ejemplo: `mesita.js` y `ejemplos.js` (generado con `herramientas_desarrollo/ejemplos.py`) |
| `ayuda/` | Manual en HTML y PDF |
| `herramientas_desarrollo/` | Generadores de texturas y ejemplos, empaquetado de Three.js (ver su `LEEME.md`) |

## Licencias

- Programa: **EUPL-1.2** (archivo [`LICENSE`](LICENSE)).
- Manuales: **CC BY-SA 4.0** (archivo [`LICENCIA-MANUAL.txt`](LICENCIA-MANUAL.txt)).
- Three.js: licencia MIT (`assets/js/three-LICENSE.txt`).
