#!/usr/bin/env python3
"""Saca del programa Ensambles 3D (ensambles_3d.html) el núcleo CSG y la biblioteca de ensambles
y lo guarda en assets/ensambles/catalogo.js, que usa el selector de ensambles de Boceto.
Uso: python3 herramientas_desarrollo/extraer_ensambles.py ruta/a/ensambles_3d.html"""
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf8')
scripts = re.findall(r'<script[^>]*>(.*?)</script>', src, re.S)
cat = next(s for s in scripts if 'Núcleo CSG' in s and 'var JOINTS' in s)
# se exponen los constructores para poder rehacer sólidos a partir de sus polígonos (Boceto los guarda en el proyecto)
cat = cat.replace("return {Vec:Vec, box:box,", "return {Vec:Vec, Vert:Vert, Poly:Poly, Solid:Solid, box:box,", 1)
assert 'Solid:Solid' in cat, 'No encuentro el return del núcleo CSG'
cat += r"""

/* ===== Añadido para Boceto: sólidos ↔ datos (listas de polígonos) ===== */
CSG.aDatos = function(s){ var r=function(v){ return Math.round(v*1000)/1000; };
  return s.polys.map(function(p){ var o=[]; p.verts.forEach(function(v){ o.push(r(v.pos.x),r(v.pos.y),r(v.pos.z)); }); return o; }); };
/* f(x,y,z) → [x,y,z]: transformación de cada vértice; espejo: si invierte la orientación (se da la vuelta a los polígonos) */
CSG.deDatos = function(d, f, espejo){
  return new CSG.Solid((d||[]).map(function(a){ var vs=[];
    for(var i=0;i<a.length;i+=3){ var q=f?f(a[i],a[i+1],a[i+2]):[a[i],a[i+1],a[i+2]]; vs.push(new CSG.Vert(new CSG.Vec(q[0],q[1],q[2]), new CSG.Vec(0,0,1))); }
    if(espejo) vs.reverse();
    var p=new CSG.Poly(vs); p.verts.forEach(function(v){ v.normal=p.plane.normal.clone(); }); return p; }));
};
"""
dest = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'ensambles' / 'catalogo.js'
dest.write_text('/* Núcleo CSG y biblioteca de ensambles, tomados de «Ensambles de carpintería 3D» (Eloi A.A., EUPL-1.2).\n'
                '   Se regenera con herramientas_desarrollo/extraer_ensambles.py: no editar a mano. */\n' + cat.strip() + '\n', encoding='utf8')
print(dest, len(cat), 'caracteres ·', len(re.findall(r"\n  id:'", cat)), 'ensambles')
