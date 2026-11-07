import math, sys
def shell(cx=512, hy=790, R=480, n=9, a0=213, a1=327, scale=1.0, mono=False):
    # Scalloped fan: hinge at (cx, hy), edge spans angles a0..a1 (deg, SVG y-down so up is 270)
    pts=[]
    for i in range(n+1):
        a=math.radians(a0+(a1-a0)*i/n)
        pts.append((cx+R*math.cos(a), hy+R*math.sin(a)))
    d=f"M{cx:.1f},{hy:.1f} L{pts[0][0]:.1f},{pts[0][1]:.1f} "
    for i in range(n):
        am=math.radians(a0+(a1-a0)*(i+0.5)/n)
        c=(cx+(R+60)*math.cos(am), hy+(R+60)*math.sin(am))
        d+=f"Q{c[0]:.1f},{c[1]:.1f} {pts[i+1][0]:.1f},{pts[i+1][1]:.1f} "
    d+="Z"
    ribs=""
    for i in range(1,n):
        a=math.radians(a0+(a1-a0)*i/n)
        x,y=cx+(R-15)*math.cos(a), hy+(R-15)*math.sin(a)
        sx,sy=cx+120*math.cos(a), hy+120*math.sin(a)
        ribs+=f'<path d="M{sx:.1f},{sy:.1f} L{x:.1f},{y:.1f}" />'
    # ears: hinge wings
    ears=f'M{cx-135},{hy+30} L{cx-120},{hy-80} L{cx+120},{hy-80} L{cx+135},{hy+30} Q{cx},{hy+50} {cx-135},{hy+30} Z'
    if mono:
        return f'<g><path d="{d}" fill="#000"/><path d="{ears}" fill="#000"/><g stroke="#fff" stroke-width="22" stroke-linecap="round" fill="none">{ribs}</g></g>'
    return f'''<g>
<path d="{ears}" fill="url(#ear)"/>
<path d="{d}" fill="url(#shell)" stroke="#c4542f" stroke-width="10" stroke-linejoin="round"/>
<g stroke="#d9623a" stroke-opacity="0.75" stroke-width="16" stroke-linecap="round" fill="none">{ribs}</g>
</g>'''
defs='''<defs>
<linearGradient id="shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6b3"/><stop offset="1" stop-color="#f08c5a"/></linearGradient>
<linearGradient id="ear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a072"/><stop offset="1" stop-color="#d9623a"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f8794"/><stop offset="1" stop-color="#0a5560"/></linearGradient>
</defs>'''
def bg():
    return '<rect width="1024" height="1024" fill="url(#sea)"/><path d="M0,840 Q256,790 512,840 T1024,840 V1024 H0 Z" fill="#0a4a54" opacity="0.6"/>'
def svg(body, w=1024): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{w}" viewBox="0 0 1024 1024">{defs}{body}</svg>'
# full icon: shell slightly smaller
icon=svg(bg()+f'<g transform="translate(512 520) scale(0.92) translate(-512 -540)">{shell()}</g>')
# adaptive foreground: content within central 66% (338..686) -> scale ~0.6
fg=svg(f'<g transform="translate(512 545) scale(0.58) translate(-512 -540)">{shell()}</g>')
bgonly=svg(bg())
mono=svg(f'<g transform="translate(512 545) scale(0.58) translate(-512 -540)">{shell(mono=True)}</g>')
splash=svg(f'<g transform="translate(512 545) scale(0.8) translate(-512 -540)">{shell()}</g>')
for n,s in dict(icon=icon,fg=fg,bg=bgonly,mono=mono,splash=splash).items(): open(n+'.svg','w').write(s)
