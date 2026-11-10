# Novedades de Boceto a Render 3D

## v3.4
- ▱ **MUEBLECAD 2D**: el mueble pasa a un plano de taller con dos láminas A3: vistas de conjunto (alzado, planta y perfil, con aristas ocultas y apertura de puertas) y las piezas desplegadas como piezas de tablero (material, alma, grueso, veta, cantos y contorno), listas para añadir herrajes y taladros, acotar y sacar el despiece.
- **Grueso del canto en cada lado** (sin canto, 0,4, 0,8, 1, 2 o 3 mm): se ve en el 3D (sin canto enseña el alma) y pasa al despiece, al Anidador y a MUEBLECAD.
- Al pasar a MUEBLECAD, los **herrajes dejan sus taladros** en los tableros (tiradores, bisagras de cazoleta, guías de cajón y patas de metal) y las vistas de conjunto llevan la **marca con el número de cada pieza**.
- **Uniones entre tableros** al pasar a MUEBLECAD: clavijas Ø8, Minifix en los extremos y clavijas, o ninguna. Cada unión deja los taladros en la cara de una pieza y en el canto de la otra.
- **Cotas automáticas** en MUEBLECAD: generales del mueble (ancho y alto en el alzado, fondo en el perfil) y largo × ancho en cada pieza desplegada. Son cotas normales: siguen al dibujo y se pueden mover o borrar.
- **Lista de compra y presupuesto** en MUEBLECAD (€ Presupuesto…): m² de tablero con su desperdicio, metros de canto, herrajes (los del mueble y las uniones llegan de Boceto) y conceptos libres, con precios que se recuerdan, IVA y total. Se descarga en CSV o se coloca en la lámina.
- **Reenviar sin perder el trabajo**: al volver a pasar el mueble, MUEBLECAD ofrece actualizar el plano. Se rehace lo que llega de Boceto y se conserva lo añadido en MUEBLECAD (taladros, herrajes, cotas, textos, cajetín, presupuesto y cambios en las piezas que no han cambiado de forma); lo que pertenece a una pieza la sigue a su nuevo sitio.
- El aparador de ejemplo lleva bisagras de cazoleta.
- 📋 Despiece → **Para MUEBLECAD (.json)**: el mismo envío en un archivo, por si el navegador bloquea la pestaña nueva.
- 🪑 **Ejemplos**: además de la mesita, una estantería de melamina, un aparador de dos puertas, una mesa de comedor de fresno, una cómoda de tres cajones, un escritorio con cajonera y una mesa de centro con tapa de cristal.
- En pantallas estrechas, los botones de la barra superior se quedan solo con su icono (el nombre aparece al pasar el ratón), para que no se salgan de la barra.
- En modo oscuro, el boceto de fondo se ve con el papel oscuro y el trazo claro, en lugar de un recuadro gris que tapaba la vista.
- El apartado «Piezas» del panel izquierdo ya se pliega con su triángulo.
- 🖊 Los contornos se dibujan ahora en **MUEBLECAD 2D** (modo «Pieza 3D»), en lugar del Calcador: mismo funcionamiento y mismos datos, con elipses, splines, booleanas y simplificación de curvas. La copia del Calcador (`assets/calcador`) se ha quitado de la carpeta; los proyectos con contornos dibujados en él se siguen abriendo y editando.

## v3.3
- 🖊 **Calcador** en una ventana dentro del programa (modo «Pieza 3D»): dibujar o retocar el contorno de una pieza con rectas, arcos y cotas, con el boceto de fondo. Los arcos llegan exactos al 3D, a la lámina y al Anidador.
- 🖊 **Pieza a mano…**: pieza nueva dibujada en el Calcador.

## v3.2
- Número de versión junto al nombre.
- Apartados de los paneles plegables (▾/▸) y paneles izquierdo y derecho ocultables (◀ ▶).

## v3.1
- Las ventanas emergentes se arrastran por su título.

## v3
- Cada panel 2D muestra la vista que se elija (alzado, posterior, planta, hormiga, perfil izquierdo o derecho) y se puede agrandar.
- 📐 **Lámina técnica**: vistas con aristas ocultas, cotas generales o parciales, cajetín y perspectiva; PDF, DXF de la hoja y DXF a 1:1.
- 📋 **Despiece para el Anidador**: un CSV por tablero (material y grosor) y las piezas con contorno como proyectos del Calcador.

## v2
- Selección múltiple y por ventana, grupos, repetir en serie.
- Piezas con contorno: plantillas e importación DXF/SVG.
- Cajón completo, bisagras, abrir puertas y cajones, vista explosionada.
- Tipo de tablero (alma) y cantos; desenfoque de fondo; maderas desde fotos con biblioteca personal y del aula.

## v1
- Boceto de fondo o flotante, piezas en alzado, planta y perfil, materiales, escenarios y render final por pasadas.
