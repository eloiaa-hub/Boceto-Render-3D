# Regenera las maderas derivadas de assets/texturas/pbr (haya, fresno, pino, cerezo, teca, wengue):
# toma el color de una textura escaneada (donante) y lo recolorea al tono de la madera de la
# biblioteca (assets/texturas/texturas.js). El relieve y la rugosidad no se duplican: el .js
# generado lleva la clave "base" con el nombre del donante.
#   Uso: python3 recolorear_maderas.py   (desde esta carpeta; necesita Pillow y numpy)
import base64, re, io, os
from PIL import Image
import numpy as np

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PBR = os.path.join(RAIZ, 'assets', 'texturas', 'pbr')

# destino: (donante, textura original de Poly Haven, metodo)
#   histograma: igualacion de histograma por canal (vetas sin nudos)
#   rampa: rampa de color por luminancia (conserva nudos sin virar el tono, p. ej. el pino)
PARES = {
    'haya':   ('arce', 'white_maple_veneer', 'histograma'),
    'fresno': ('roble', 'oak_veneer_01', 'histograma'),
    'pino':   ('pino_barnizado', 'coated_pine', 'rampa'),
    'cerezo': ('sapelli', 'sapele_veneer', 'histograma'),
    'teca':   ('nogal', 'black_walnut_veneer_02', 'histograma'),
    'wengue': ('palisandro', 'rosewood_veneer1', 'histograma'),
}
NOMBRES = {'haya': 'Haya', 'fresno': 'Fresno', 'pino': 'Pino', 'cerezo': 'Cerezo', 'teca': 'Teca', 'wengue': 'Wengué'}

def color_pbr(clave):
    s = open(os.path.join(PBR, clave + '.js')).read()
    m = re.search(r'"color": "data:image/jpeg;base64,([^"]+)"', s)
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))), re.search(r'"cm": (\d+)', s).group(1)

def textura_vieja(clave):
    s = open(os.path.join(RAIZ, 'assets', 'texturas', 'texturas.js')).read()
    m = re.search(r'"%s": "data:image/jpeg;base64,([^"]+)"' % clave, s)
    return Image.open(io.BytesIO(base64.b64decode(m.group(1))))

def igualar_histograma(don, tgt):
    out = np.empty_like(don)
    for c in range(3):
        d = don[..., c].ravel(); t = tgt[..., c].ravel()
        orden = np.argsort(d, kind='stable')
        tv = np.sort(t)[np.linspace(0, t.size - 1, d.size).astype(np.int64)]
        res = np.empty_like(d); res[orden] = tv
        out[..., c] = res.reshape(don[..., c].shape)
    return out

def rampa_luminancia(don, tgt):
    don = don.astype(np.float32); tgt = tgt.astype(np.float32)
    L = (don * [0.299, 0.587, 0.114]).sum(-1)
    orden = L.ravel().argsort(kind='stable'); rank = np.empty(L.size); rank[orden] = np.arange(L.size) / (L.size - 1)
    tL = (tgt * [0.299, 0.587, 0.114]).sum(-1).ravel()
    bins = np.array_split(tL.argsort(kind='stable'), 256)
    rampa = np.array([tgt.reshape(-1, 3)[b].mean(0) for b in bins])
    out = rampa[np.clip((rank * 255).astype(np.int32), 0, 255)].reshape(don.shape)
    med = don.reshape(-1, 3).mean(0)   # algo de variacion de color del donante
    gris = (don * [0.299, 0.587, 0.114]).sum(-1, keepdims=True) * med / (med * [0.299, 0.587, 0.114]).sum()
    return np.clip(out + (don - gris) * 0.25, 0, 255).astype(np.uint8)

for destino, (don, orig, metodo) in PARES.items():
    dimg, cm = color_pbr(don)
    dnp = np.asarray(dimg.convert('RGB')).astype(np.uint8)
    tnp = np.asarray(textura_vieja(destino).convert('RGB').resize((1024, 1024))).astype(np.uint8)
    out = rampa_luminancia(dnp, tnp) if metodo == 'rampa' else igualar_histograma(dnp, tnp)
    buf = io.BytesIO(); Image.fromarray(out).save(buf, 'JPEG', quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    js = ('/* %s: color derivado de %s (Poly Haven, CC0), recoloreado al tono de la biblioteca; '
          'relieve y rugosidad compartidos con %s.js (clave "base"). Color 2048 px; %s x %s cm. */\n'
          '(window.TEXTURAS_PBR = window.TEXTURAS_PBR || {})["%s"] = {"color": "data:image/jpeg;base64,%s", "base": "%s", "cm": %s};\n'
          ) % (NOMBRES[destino], orig, don, cm, cm, destino, b64, don, cm)
    open(os.path.join(PBR, destino + '.js'), 'w').write(js)
    print(destino, '<-', don, metodo, len(js) // 1024, 'KB')
print('Listo. Recarga el programa (Ctrl + F5) para verlas.')
