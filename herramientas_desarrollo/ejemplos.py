"""Genera ../assets/ejemplos/ejemplos.js: muebles de ejemplo de Boceto a Render 3D (además de la mesita).
Uso: python ejemplos.py   (unidades en cm; Y alto, Z fondo con el frente hacia +Z)"""
import json, os

class Mueble:
    def __init__(s, clave, nombre, desc):
        s.clave, s.nombre, s.desc, s.piezas, s.grupos, s.n = clave, nombre, desc, [], {}, 0
    def p(s, nombre, x, y, z, w, h, d, mat, veta=None, canto=1, nucleo='auto', grupo=None, forma='caja', eje='y', color='#ffffff', cantos='ajuego', cantoMat=None):
        s.n += 1
        q = dict(id=f'{s.clave}{s.n}', nombre=nombre, forma=forma, eje=eje, x=round(x, 2), y=round(y, 2), z=round(z, 2), w=round(w, 2), h=round(h, 2), d=round(d, 2),
                 material=mat, color=color, acabado='satinado', veta=veta or 'auto', canto=canto, visible=True, grupo=grupo,
                 nucleo=nucleo, cantos=cantos, cantoMat=cantoMat or mat, cantoColor='#222222', plano=None, contorno=None)
        s.piezas.append(q); return q
    def g(s, nombre, tipo='ninguno', valor=0):
        k = f'g{s.clave}{len(s.grupos) + 1}'; s.grupos[k] = dict(nombre=nombre, mov=dict(tipo=tipo, valor=valor), plegado=True); return k
    def cajon(s, nombre, x0, x1, y, h, prof, frente_z, mat_frente, mat_caja='haya', recorrido=None, tirador='negro_mate', g_lat=1.9):
        """Frente + caja (laterales, contrafrente, trasera, fondo) + guías + tirador, en un grupo con movimiento de cajón."""
        G = s.g(nombre, 'cajon', recorrido or round(prof * .65))
        s.p('Frente ' + nombre.lower(), x0 + .3, y, frente_z, x1 - x0 - .6, h, 1.9, mat_frente, 'x', 1.5, grupo=G)
        xi0, xi1, yb, hc, zc = x0 + 1.25, x1 - 1.25, y + 2.5, h - 5, frente_z - prof
        s.p('Lateral cajón izq.', xi0, yb, zc, 1.6, hc, prof - 1.6, mat_caja, 'z', .5, grupo=G)
        s.p('Lateral cajón der.', xi1 - 1.6, yb, zc, 1.6, hc, prof - 1.6, mat_caja, 'z', .5, grupo=G)
        s.p('Contrafrente', xi0 + 1.6, yb, frente_z - 1.6, xi1 - xi0 - 3.2, hc, 1.6, mat_caja, 'x', .5, grupo=G)
        s.p('Trasera cajón', xi0 + 1.6, yb + 1.2, zc, xi1 - xi0 - 3.2, hc - 1.2, 1.6, mat_caja, 'x', .5, grupo=G)
        s.p('Fondo cajón', xi0 + 1.6, yb + .8, zc, xi1 - xi0 - 3.2, .4, prof - 3.2, 'melamina_blanca', None, .5, 'mdf', grupo=G)
        s.p('Guía izq.', x0, yb + hc / 2 - 2.25, zc, 1.25, 4.5, prof - 1.6, 'aluminio', None, .3)
        s.p('Guía der.', x1 - 1.25, yb + hc / 2 - 2.25, zc, 1.25, 4.5, prof - 1.6, 'aluminio', None, .3)
        if tirador: s.p('Tirador ' + nombre.lower(), (x0 + x1) / 2 - 6, y + h / 2 - .6, frente_z + 1.9, 12, 1.2, 1.8, tirador, None, 3, grupo=G)
    def datos(s, escena=None):
        e = dict(escenario='blanco', fondo='#efeeea', azimut=-40, altura=48, suave=.55, intens=1.6, amb=.7, expo=1, lente=50, dof=0)
        e.update(escena or {})
        return dict(clave=s.clave, nombre=s.nombre, desc=s.desc, proyecto=dict(app='Boceto a Render 3D', version=2, nombre=s.nombre, piezas=s.piezas, grupos=s.grupos,
                    bocetos={}, referencia=None, escena=e, maderasUsuario={}, camara=None, vista=dict(abrir=0, explosion=0)))

E = []
# 1. Estantería de melamina blanca
m = Mueble('est', 'estantería', 'Melamina blanca de 19 mm sobre aglomerado, cuatro baldas, trasera de 4 mm y zócalo')
W, H, D, g = 80, 180, 30, 1.9
m.p('Lateral izquierdo', 0, 0, 0, g, H, D, 'melamina_blanca', None, 1, 'aglomerado')
m.p('Lateral derecho', W - g, 0, 0, g, H, D, 'melamina_blanca', None, 1, 'aglomerado')
m.p('Techo', g, H - g, 0, W - 2 * g, g, D, 'melamina_blanca', None, 1, 'aglomerado')
m.p('Suelo', g, 8, 0, W - 2 * g, g, D, 'melamina_blanca', None, 1, 'aglomerado')
m.p('Zócalo', g, 0, D - 3, W - 2 * g, 8, g, 'melamina_blanca', None, 1, 'aglomerado')
m.p('Trasera', g, 8 + g, 0, W - 2 * g, H - 8 - 2 * g, .4, 'melamina_blanca', None, .5, 'mdf')
for i, y in enumerate([42, 76, 110, 144]):
    m.p('Balda', g, y, .4, W - 2 * g, g, D - 1.4, 'melamina_blanca', None, 1, 'aglomerado')
E.append(m.datos())

# 2. Aparador de dos puertas en roble chapado
m = Mueble('apa', 'aparador de dos puertas', 'Roble chapado sobre aglomerado, dos puertas que se abren, balda interior y patas de metal')
W, H, D, g, yP = 120, 70, 45, 1.9, 14
m.p('Lateral izquierdo', 0, yP, 0, g, H, D, 'roble', 'y', 1, 'aglomerado')
m.p('Lateral derecho', W - g, yP, 0, g, H, D, 'roble', 'y', 1, 'aglomerado')
m.p('Tapa', 0, yP + H, 0, W, 2.5, D, 'roble', 'x', 2, 'aglomerado')
m.p('Suelo', g, yP, 0, W - 2 * g, g, D - 2, 'roble', 'x', 1, 'aglomerado')
m.p('Balda', g, yP + 32, 1, W - 2 * g, g, D - 6, 'roble', 'x', 1, 'aglomerado')
m.p('Trasera', g, yP + g, 0, W - 2 * g, H - g, .4, 'roble', 'y', .5, 'mdf')
for lado, x0 in (('izq', 0), ('der', W / 2)):
    G = m.g('Puerta ' + ('izquierda' if lado == 'izq' else 'derecha'), lado, 95)
    m.p('Puerta ' + ('izquierda' if lado == 'izq' else 'derecha'), x0 + .2, yP + .2, D, W / 2 - .4, H - .4, 1.9, 'roble', 'y', 1, 'aglomerado', grupo=G)
    xt = x0 + W / 2 - 6 if lado == 'izq' else x0 + 4.8
    m.p('Tirador ' + ('izquierdo' if lado == 'izq' else 'derecho'), xt, yP + H / 2 - 8, D + 1.9, 1.2, 16, 1.8, 'negro_mate', None, 3, grupo=G)
Gp = m.g('Patas')
for nom, x, z in (('trasera izq.', 3, 3), ('trasera der.', W - 6, 3), ('delantera izq.', 3, D - 6), ('delantera der.', W - 6, D - 6)):
    m.p('Pata ' + nom, x, 0, z, 3, yP, 3, 'negro_mate', None, 1, grupo=Gp)
E.append(m.datos())

# 3. Mesa de comedor de fresno macizo
m = Mueble('mes', 'mesa de comedor', 'Fresno macizo: tablero de 3 cm, cuatro patas de 7 × 7 y cintura de 2,2 cm')
W, D, H, t, pa, ci = 160, 90, 75, 3, 7, 2.2
m.p('Tablero', 0, H - t, 0, W, t, D, 'fresno', 'x', 3)
for nom, x, z in (('trasera izq.', 6, 6), ('trasera der.', W - 6 - pa, 6), ('delantera izq.', 6, D - 6 - pa), ('delantera der.', W - 6 - pa, D - 6 - pa)):
    m.p('Pata ' + nom, x, 0, z, pa, H - t, pa, 'fresno', 'y', 1)
m.p('Cintura delantera', 6 + pa, H - t - 10, D - 6 - pa / 2 - ci / 2, W - 12 - 2 * pa, 10, ci, 'fresno', 'x', .5)
m.p('Cintura trasera', 6 + pa, H - t - 10, 6 + pa / 2 - ci / 2, W - 12 - 2 * pa, 10, ci, 'fresno', 'x', .5)
m.p('Cintura izquierda', 6 + pa / 2 - ci / 2, H - t - 10, 6 + pa, ci, 10, D - 12 - 2 * pa, 'fresno', 'z', .5)
m.p('Cintura derecha', W - 6 - pa / 2 - ci / 2, H - t - 10, 6 + pa, ci, 10, D - 12 - 2 * pa, 'fresno', 'z', .5)
E.append(m.datos())

# 4. Cómoda de tres cajones en nogal
m = Mueble('com', 'cómoda de tres cajones', 'Nogal macizo de 19 mm, tres cajones completos con guías y patas')
W, H, D, g, yP = 90, 78, 45, 1.9, 12
m.p('Lateral izquierdo', 0, yP, 0, g, H, D, 'nogal', 'y', 1)
m.p('Lateral derecho', W - g, yP, 0, g, H, D, 'nogal', 'y', 1)
m.p('Tapa', -1, yP + H, -1, W + 2, 2.5, D + 2, 'nogal', 'x', 2)
m.p('Suelo', g, yP, 0, W - 2 * g, g, D, 'nogal', 'x', 1)
m.p('Trasera', g, yP + g, 0, W - 2 * g, H - g, .4, 'nogal', 'y', .5, 'contrachapado')
hc = (H - g) / 3
for i, nom in enumerate(['Cajón inferior', 'Cajón central', 'Cajón superior']):
    m.cajon(nom, g, W - g, yP + g + i * hc, hc - .4, D - 3, D, 'nogal')
Gp = m.g('Patas')
for nom, x, z in (('trasera izq.', 1.5, 1.5), ('trasera der.', W - 5.5, 1.5), ('delantera izq.', 1.5, D - 5.5), ('delantera der.', W - 5.5, D - 5.5)):
    m.p('Pata ' + nom, x, 0, z, 4, yP, 4, 'nogal', 'y', .5, grupo=Gp)
E.append(m.datos())

# 5. Escritorio con cajonera
m = Mueble('esc', 'escritorio', 'Melamina antracita con tapa de roble chapado, cajonera de dos cajones y faldón trasero')
W, H, D, g, t = 120, 75, 60, 1.9, 2.5
m.p('Tablero', 0, H - t, 0, W, t, D, 'roble', 'x', 2, 'aglomerado')
m.p('Costado izquierdo', 0, 0, 0, g, H - t, D, 'melamina_antracita', None, 1, 'aglomerado')
m.p('Costado derecho', W - g, 0, 0, g, H - t, D, 'melamina_antracita', None, 1, 'aglomerado')
m.p('Faldón', g, H - t - 30, 3, W - 2 * g, 30, g, 'melamina_antracita', None, 1, 'aglomerado')
xc = W - g - 40
m.p('Costado cajonera', xc - g, H - t - 30, 5, g, 30 - .1, D - 5, 'melamina_antracita', None, 1, 'aglomerado')
m.p('Suelo cajonera', xc, H - t - 30, 5, 40, g, D - 5, 'melamina_antracita', None, 1, 'aglomerado')
hc = (30 - g) / 2
for i, nom in enumerate(['Cajón inferior', 'Cajón superior']):
    m.cajon(nom, xc, W - g, H - t - 30 + g + i * hc, hc - .4, D - 8, D, 'melamina_antracita', 'haya', tirador='inox')
E.append(m.datos())

# 6. Mesa de centro con tapa de cristal
m = Mueble('cen', 'mesa de centro', 'Bastidor de roble macizo con balda inferior y tapa de cristal templado de 8 mm')
W, D, H, pa = 110, 60, 42, 5
m.p('Tapa de cristal', 0, H - .8, 0, W, .8, D, 'cristal', None, 1)
for nom, x, z in (('trasera izq.', 0, 0), ('trasera der.', W - pa, 0), ('delantera izq.', 0, D - pa), ('delantera der.', W - pa, D - pa)):
    m.p('Pata ' + nom, x, 0, z, pa, H - .8, pa, 'roble', 'y', 1)
for nom, z in (('trasero', 0), ('delantero', D - 2.5)):
    m.p('Travesaño ' + nom, pa, H - .8 - 6, z, W - 2 * pa, 6, 2.5, 'roble', 'x', .5)
for nom, x in (('izquierdo', 0), ('derecho', W - 2.5)):
    m.p('Travesaño ' + nom, x, H - .8 - 6, pa, 2.5, 6, D - 2 * pa, 'roble', 'z', .5)
m.p('Balda inferior', pa, 10, pa, W - 2 * pa, 2, D - 2 * pa, 'roble', 'x', 1)
E.append(m.datos())

dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ejemplos', 'ejemplos.js')
with open(dst, 'w', encoding='utf8') as f:
    f.write('/* Muebles de ejemplo de Boceto a Render 3D (generado con herramientas_desarrollo/ejemplos.py) */\n')
    f.write('window.EJEMPLOS_MUEBLES = ' + json.dumps(E, ensure_ascii=False) + ';\n')
print(len(E), 'ejemplos ->', os.path.normpath(dst))
