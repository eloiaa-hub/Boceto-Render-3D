#!/usr/bin/env python3
"""Saca del programa Ensambles 3D (ensambles_3d.html) el núcleo CSG y la biblioteca de ensambles
y lo guarda en assets/ensambles/catalogo.js, que usa el selector de ensambles de Boceto.
Uso: python3 herramientas_desarrollo/extraer_ensambles.py ruta/a/ensambles_3d.html"""
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf8')
scripts = re.findall(r'<script[^>]*>(.*?)</script>', src, re.S)
cat = next(s for s in scripts if 'Núcleo CSG' in s and 'var JOINTS' in s)
dest = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'ensambles' / 'catalogo.js'
dest.write_text('/* Núcleo CSG y biblioteca de ensambles, tomados de «Ensambles de carpintería 3D» (Eloi A.A., EUPL-1.2).\n'
                '   Se regenera con herramientas_desarrollo/extraer_ensambles.py: no editar a mano. */\n' + cat.strip() + '\n', encoding='utf8')
print(dest, len(cat), 'caracteres ·', len(re.findall(r"\n  id:'", cat)), 'ensambles')
