# PDF de test : cotes écrites en contours pleins (police convertie en dessins), chacune avec un petit repère
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
from reportlab.pdfgen import canvas
import random
random.seed(7)
c = canvas.Canvas('filled-z.pdf', pagesize=(600, 400))
fp = FontProperties(family='DejaVu Sans')
vals = []
for i in range(4):
    for j in range(5):
        v = round(290 + random.random() * 15, 2); vals.append(v)
        x, y = 60 + j * 105, 320 - i * 80
        c.setFillColorRGB(0.4, 0.4, 0.4)
        # repère : petit carré plein
        c.rect(x - 3, y - 1, 2, 2, stroke=0, fill=1)
        tp = TextPath((0, 0), '%.2f' % v, size=9, prop=fp)
        p = c.beginPath()
        for poly in tp.to_polygons(closed_only=True):
            p.moveTo(x + poly[0][0], y + poly[0][1])
            for q in poly[1:]: p.lineTo(x + q[0], y + q[1])
            p.close()
        c.drawPath(p, stroke=0, fill=1, fillMode=0)
c.save()
print(sorted(vals))
