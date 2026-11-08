# Boceto a Render 3D — Por Eloi A.A.

**Versión 3.3** · novedades en [NOVEDADES.md](NOVEDADES.md)

Del boceto a mano de un mueble a una **imagen realista**, a un **plano acotado** y al **despiece para el Anidador**.
Funciona en el navegador (Chrome, Edge o Firefox), sin instalar nada y **sin conexión a internet**.

No usa inteligencia artificial: el mueble se construye con piezas (tableros, cajones, patas, tiradores…) que se dibujan
en alzado, planta y perfil, calcando el boceto. Con esas piezas monta el modelo 3D, le pone madera, luz y sombras, y genera
la imagen final en PNG.

## Cómo se usa

1. Descarga el repositorio (**Code → Download ZIP**) y descomprímelo.
2. Abre **`Boceto_Render3D.html`** con doble clic.
3. El manual está en `ayuda/manual.html` y `ayuda/manual.pdf` (también en el botón ❓ Ayuda).

> Copia siempre **la carpeta completa**: el programa necesita `assets/` y `ayuda/`.

## Qué hace

- **Boceto**: como fondo de una vista para calcarlo (escalado a su medida real) o como referencia flotante.
- **Vistas**: tres paneles 2D, cada uno con la vista que elijas (alzado, posterior, planta, hormiga, perfil izquierdo o derecho), ampliables, más la vista 3D.
- **Piezas**: cajas, cilindros y piezas con contorno (plantillas, DXF/SVG o **dibujadas en el Calcador**, que se abre dentro del programa). Selección múltiple, grupos y repetición en serie.
- **Plantillas de taller**: cuerpo, frentes, cajón completo, bisagras, patas y tiradores.
- **Movimiento**: abrir puertas y cajones y vista explosionada, con animación.
- **Materiales**: maderas, melaminas, lacados, metales y cristal; tipo de tablero (macizo, aglomerado, MDF, contrachapado) y cantos; maderas desde fotos, con biblioteca personal y del aula.
- **Render**: imagen realista hasta 4K con sombras suaves, oclusión y desenfoque de fondo.
- **Lámina técnica**: vistas con aristas ocultas, cotas en mm y cajetín, en sistema europeo o americano; en **PDF** y **DXF**.
- **Despiece**: en CSV para hoja de cálculo o en ZIP para el **Anidador de tableros** de la [Suite CNC](https://github.com/eloiaa-hub/Suite-CNC).

## Archivos

| Archivo / carpeta | Qué es |
|---|---|
| `Boceto_Render3D.html` | El programa |
| `index.html` | Lleva al programa (para GitHub Pages) |
| `assets/js/app.js` | Código del programa (se genera a partir de `herramientas_desarrollo/src`) |
| `assets/js/three-bundle.js` | [Three.js](https://threejs.org) empaquetado sin módulos, para funcionar con doble clic |
| `assets/texturas/` | Maderas y almas de tablero (`texturas.js`); `maderas_aula.js`, las maderas de fotos del aula |
| `assets/calcador/calcador.html` | Copia del Calcador de contornos (v130) con el modo «Pieza 3D» |
| `assets/ejemplos/` | Mesita de noche de ejemplo |
| `ayuda/` | Manual en HTML y PDF |
| `herramientas_desarrollo/` | Partes del código, generador de texturas y empaquetado de Three.js (ver su `LEEME.md`) |

## Licencias

- Programa: **EUPL-1.2** (archivo [`LICENSE`](LICENSE)).
- Manual: **CC BY-SA 4.0** (archivo [`LICENCIA-MANUAL.txt`](LICENCIA-MANUAL.txt)).
- Three.js: licencia MIT (`assets/js/three-LICENSE.txt`).
