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
ICONS = {
 'ship': (['..#....', '..##...', '#####..', '#######', '#####..', '..##...', '..#....'], '#3de8ff'),
 'ball': (['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'], '#ffe84a'),
 'bomb': (['....#.#', '...#...', '..###..', '.#####.', '.#####.', '.#####.', '..###..'], '#ff9a3a'),
 'tetris': (['.......', '.##....', '.##....', '.##....', '.####..', '.####..', '.......'], '#c58aff'),
 'chomp': (['..###..', '.#####.', '#####..', '####...', '#####..', '.#####.', '..###..'], '#ffd23a'),
 'card': (['.#####.', '#.....#', '#.#.#.#', '#..#..#', '#.#.#.#', '#.....#', '.#####.'], '#ff4a6a'),
 'car': (['.......', '..###..', '.#####.', '#######', '#.###.#', '.#...#.', '.......'], '#6aff9a'),
 'fist': (['.#####.', '#######', '#######', '#######', '.#####.', '..###..', '..###..'], '#ff5a5a'),
 'puck': (['.......', '..###..', '.#####.', '#######', '#######', '.#####.', '..###..'], '#3de8ff'),
 'eight': (['.#####.', '#######', '###.###', '##...##', '###.###', '#######', '.#####.'], '#e8e8ff'),
 'tower': (['#.#.#.#', '#######', '.#####.', '.#####.', '.#.#.#.', '.#####.', '#######'], '#ff8a2a'),
 'sword': (['.....##', '....##.', '...##..', '#.##...', '.##....', '.##....', '#..#...'], '#ffd23a'),
 'note': (['...####', '...#..#', '...#..#', '...#...', '.###...', '####...', '.##....'], '#ff4a8a'),
 'word': (['#.....#', '#..#..#', '#.#.#.#', '#.#.#.#', '##...##', '#.....#', '#.....#'], '#6aff9a'),
 'tile': (['#######', '#.....#', '#.###.#', '#...#.#', '#.###.#', '#.....#', '#######'], '#edc22e'),
}
def logo():
    px = 9
    my, wmy = word('MY', 0, 0, px, '#ffe84a')
    sp, wsp = word('SPACE', 0, 0, px, '#3de8ff')
    ar, war = word('ARCADE', 0, 0, px, '#ff4de1')
    def shadow(txt, x, y):  # a dark offset copy gives the letters a chunky 3D edge
        return f'<g transform="translate({x+4},{y+5})" opacity="0.55">' + txt.replace('#ffe84a', '#160a30').replace('#3de8ff', '#160a30').replace('#ff4de1', '#160a30') + '</g>'
    W = 760; H = 280
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" shape-rendering="crispEdges">',
      '<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050818"/><stop offset="0.55" stop-color="#150a34"/><stop offset="1" stop-color="#2a0a3a"/></linearGradient>',
      '<radialGradient id="n1" cx="0.15" cy="0.3" r="0.5"><stop offset="0" stop-color="#3de8ff" stop-opacity="0.28"/><stop offset="1" stop-color="#3de8ff" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="n2" cx="0.85" cy="0.75" r="0.55"><stop offset="0" stop-color="#ff4de1" stop-opacity="0.3"/><stop offset="1" stop-color="#ff4de1" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="pl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffb86a"/><stop offset="0.6" stop-color="#ff5a8a"/><stop offset="1" stop-color="#4a1a6a"/></radialGradient></defs>',
      f'<rect width="{W}" height="{H}" rx="14" fill="url(#bg)"/><rect width="{W}" height="{H}" rx="14" fill="url(#n1)"/><rect width="{W}" height="{H}" rx="14" fill="url(#n2)"/>',
      f'<rect x="3" y="3" width="{W-6}" height="{H-6}" rx="12" fill="none" stroke="#3de8ff" stroke-opacity="0.35" stroke-width="2"/>']
    import random
    random.seed(11)
    for _ in range(70):
        parts.append(f'<rect x="{random.randrange(8, W-8, 4)}" y="{random.randrange(8, H-8, 4)}" width="4" height="4" fill="#ffffff" opacity="{random.choice([0.2,0.35,0.6,0.9])}"/>')
    # a ringed planet in the top right
    parts.append('<g><circle cx="672" cy="74" r="38" fill="url(#pl)"/><ellipse cx="672" cy="78" rx="66" ry="14" fill="none" stroke="#ffe84a" stroke-opacity="0.8" stroke-width="5" transform="rotate(-16 672 78)"/><circle cx="660" cy="62" r="7" fill="#ffffff" fill-opacity="0.18"/></g>')
    # rocket with a long flame trail
    parts.append('<g filter="url(#g)">' + sprite(ROCKET, 34, 40, 13, PAL) + '</g>')
    for i, c in enumerate(['#ffe84a', '#ff9a2e', '#ff4d4d', '#8a2a6a']):
        parts.append(f'<rect x="{34+4*13}" y="{40+11*13+i*13}" width="13" height="13" fill="{c}" opacity="{0.95-i*0.2}"/>')
    tx = 198
    parts.append(shadow(my, tx, 30) + shadow(sp, tx + wmy + px * 3, 30) + shadow(ar, tx, 112))
    parts.append(f'<g filter="url(#g)"><g transform="translate({tx},30)">{my}</g><g transform="translate({tx+wmy+px*3},30)">{sp}</g></g>')
    parts.append(f'<g filter="url(#g)"><g transform="translate({tx},112)">{ar}</g></g>')
    for i in range(0, 520, 8):
        parts.append(f'<rect x="{tx+i}" y="188" width="8" height="4" fill="{["#ffe84a","#3de8ff","#ff4de1"][(i//8)%3]}" opacity="0.85"/>')
    # a strip of game icons: the arcade at a glance
    names = ['ship', 'ball', 'bomb', 'tetris', 'chomp', 'card', 'car', 'fist', 'puck', 'eight', 'tower', 'sword', 'note', 'word', 'tile']
    x = 26
    for n in names:
        rows, c = ICONS[n]
        parts.append(f'<g filter="url(#g)">' + sprite(rows, x, 214, 5, {'#': c}) + '</g>')
        x += 49
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
