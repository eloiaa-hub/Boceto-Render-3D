#!/usr/bin/env python3
"""Recorta las miniaturas de los ejemplos alrededor del mueble (con un margen), a 16:10 y 480 × 300 px.
Se usa después de herramientas_desarrollo/miniaturas.js."""
import glob, pathlib
from PIL import Image, ImageChops
DEST = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'ejemplos' / 'miniaturas'
for f in sorted(DEST.glob('*.jpg')):
    im = Image.open(f).convert('RGB'); w, h = im.size
    fondo = Image.new('RGB', im.size, im.getpixel((5, 5)))
    caja = ImageChops.difference(im, fondo).convert('L').point(lambda v: 255 if v > 22 else 0).getbbox() or (0, 0, w, h)
    x0, y0, x1, y1 = caja; cw, ch = x1 - x0, y1 - y0
    m = .14 * max(cw, ch / .625)                       # margen
    tw = max(cw + 2 * m, (ch + 2 * m) * 1.6); th = tw / 1.6
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    bx0 = int(max(0, min(w - tw, cx - tw / 2))); by0 = int(max(0, min(h - th, cy - th / 2)))
    im.crop((bx0, by0, int(bx0 + min(tw, w)), int(by0 + min(th, h)))).resize((480, 300), Image.LANCZOS).save(f, quality=82, optimize=True)
    print(f.name, caja)
