# Generates the pixel-art logo (public/logo.svg) and the app icon (src/app/icon.svg).
F = {
 'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
 'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
 'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
 'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
 'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
 'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
 'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
 'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
 'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
}
def word(txt, x, y, px, fill, gap=1):
    out = []
    cx = x
    for ch in txt:
        g = F[ch]
        for r, row in enumerate(g):
            for c, v in enumerate(row):
                if v == '#': out.append(f'<rect x="{cx + c*px}" y="{y + r*px}" width="{px}" height="{px}" fill="{fill}"/>')
        cx += (5 + gap) * px
    return ''.join(out), cx - gap * px - x
def sprite(rows, x, y, px, pal):
    out = []
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in pal: out.append(f'<rect x="{x + c*px}" y="{y + r*px}" width="{px}" height="{px}" fill="{pal[ch]}"/>')
    return ''.join(out)
# a little rocket (pixel art, facing up)
ROCKET = [
 '....W....', '...WCW...', '..WCCCW..', '..WCCCW..', '..WBBBW..', '..WBBBW..', '.WWBBBWW.', 'WWW.B.WWW', 'W.W.B.W.W', '..R.Y.R..', '....Y....',
]
PAL = {'W': '#e8f1ff', 'C': '#3de8ff', 'B': '#3d7bff', 'R': '#ff4d8d', 'Y': '#ffe84a'}
def logo():
    px = 8
    my, wmy = word('MY', 0, 0, px, '#ffe84a')
    sp, wsp = word('SPACE', 0, 0, px, '#3de8ff')
    ar, war = word('ARCADE', 0, 0, px, '#ff4de1')
    W = 640; H = 250
    # layout: rocket on the left, text on the right
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges">',
      '<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a1c"/><stop offset="1" stop-color="#150a2e"/></linearGradient></defs>',
      f'<rect width="{W}" height="{H}" rx="10" fill="url(#bg)"/>']
    # stars
    import random
    random.seed(7)
    for _ in range(46):
        parts.append(f'<rect x="{random.randrange(6, W-6, 4)}" y="{random.randrange(6, H-6, 4)}" width="4" height="4" fill="#ffffff" opacity="{random.choice([0.25,0.4,0.7])}"/>')
    # rocket with a flame trail
    parts.append('<g filter="url(#g)">' + sprite(ROCKET, 36, 52, 12, PAL) + '</g>')
    for i, c in enumerate(['#ffe84a', '#ff9a2e', '#ff4d4d']):
        parts.append(f'<rect x="{36+4*12}" y="{52+11*12+i*12}" width="12" height="12" fill="{c}" opacity="{0.95-i*0.25}"/>')
    # text
    tx = 190
    parts.append(f'<g filter="url(#g)"><g transform="translate({tx},34)">{my}</g><g transform="translate({tx+wmy+px*3},34)">{sp}</g></g>')
    parts.append(f'<g filter="url(#g)"><g transform="translate({tx},108)">{ar}</g></g>')
    # shadow underline + tagline blocks
    for i in range(0, 430, 8):
        parts.append(f'<rect x="{tx+i}" y="176" width="8" height="4" fill="{["#ffe84a","#3de8ff","#ff4de1"][(i//8)%3]}" opacity="0.8"/>')
    parts.append(f'<g transform="translate({tx},196)">' + sprite(['..#..', '.###.', '#####'], 0, 0, 4, {'#': '#7dff5a'}) + sprite(['#.#', '###', '#.#'], 40, 0, 4, {'#': '#3de8ff'}) + sprite(['.##.', '####', '.##.'], 80, 0, 4, {'#': '#ffb02e'}) + sprite(['###', '#.#', '###'], 124, 0, 4, {'#': '#ff4d8d'}) + '</g>')
    parts.append('</svg>')
    return ''.join(parts)
def icon():
    W = 128
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}" shape-rendering="crispEdges">',
      f'<rect width="{W}" height="{W}" rx="22" fill="#0a0e24"/><rect x="6" y="6" width="116" height="116" rx="18" fill="none" stroke="#3de8ff" stroke-width="4"/>']
    parts.append(sprite(ROCKET, 20, 8, 8, PAL))
    for i, c in enumerate(['#ff9a2e', '#ffe84a']):
        parts.append(f'<rect x="{20+4*8+(i%2)*8}" y="{8+11*8+i*8}" width="8" height="8" fill="{c}"/>')
    parts.append('<rect x="14" y="108" width="100" height="6" fill="#ff4de1"/>')
    parts.append('</svg>')
    return ''.join(parts)
open('public/logo.svg', 'w').write(logo())
open('src/app/icon.svg', 'w').write(icon())
print('ok')
