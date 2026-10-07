// EMPIRE RISE campaign: "From Ember to Empire". Five scenarios, each with its own story, goals and surprises.
const L = (who, text) => [who, text]
export const EMWHO = { elder: ['ELDER ASHA', '#ffd23a', '👵'], nova: ['NOVA', '#ff4de1', '🤖'], scout: ['SCOUT KEL', '#6aff9a', '🏹'], crim: ['QUEEN CRIMSON', '#ff5a6a', '👑'], vio: ['LORD VIOLET', '#b27aff', '🧙'], ovl: ['OVERLORD', '#ff3a3a', '👁'], sys: ['THE LAND', '#9ad8ff', '🏞️'], gold: ['KING GOLDEN', '#ffd23a', '🤴'] }
export const EMCAMP = [
  {
    id: 1, name: 'A NEW HOME', sub: 'Scenario 1 · Ember', seed: 11, ai: 1, diff: 1, speed: 1, res: { food: 160, wood: 280, stone: 140, gold: 60 },
    raids: { first: 170, gap: 85, scale: 0.6 }, aiAtk: 1e9, brief: 'You are a few survivors with a fire, a field and a promise. Learn to build, to grow and to defend.',
    intro: [L('sys', 'THE LAND OF EMBERS. A HANDFUL OF SURVIVORS WALK OUT OF THE ASHES OF THE GRID AND FIND A VALLEY NOBODY HAS DELETED.'), L('elder', 'We stop here. Water, trees, stone, and nobody chasing us. We will build a village.'), L('nova', 'I will guide you. And remember: once a building has proved itself, upgrade it. A good house, a good farm, a good tower can grow with you. First: houses so more people can live here. A lumber camp beside the forest. Then a barracks, because nothing stays peaceful for long.'), L('scout', 'Elder, I saw smoke in the east. Crimson\'s people. They are watching us.'), L('elder', 'Then we build quickly, and we build strong walls.')],
    objectives: [
      { t: 'build', what: 'house', n: 2, text: 'Build 2 houses', hint: 'Open the build bar and pick HOUSE, then click the grass near your hall.' },
      { t: 'build', what: 'lumber', n: 2, text: 'Build a 2nd lumber camp', hint: 'Lumber camps work best right next to forest.' },
      { t: 'build', what: 'barracks', n: 1, text: 'Build a barracks', hint: 'Barracks (3rd building row) trains soldiers.' },
      { t: 'army', n: 8, text: 'Have 8 soldiers', hint: 'Click your barracks, then TRAIN swordsmen (T) and archers (Y).' },
      { t: 'build', what: 'tower', n: 1, text: 'Build a watch tower', hint: 'Raiders are coming. A tower shoots anything that comes near.' },
      { t: 'upgrade', n: 1, lv: 2, text: 'Upgrade a building to level 2', hint: 'Click a finished building and press UPGRADE (U). Upgraded buildings work harder and look grander.' },
      { t: 'hall', n: 2, text: 'Upgrade the hall to a TOWN', hint: 'Click your Town Hall and press UPGRADE (U).' },
      { t: 'raid', n: 1, text: 'Survive the first raid', hint: 'Keep your soldiers close to the hall and your towers fed.' },
    ],
    outro: [L('elder', 'We held. The village stands, and the children are laughing again. Even the old lumber camp has a new roof.'), L('scout', 'The raiders ran. But Elder... Queen Crimson\'s banners are on the border. She wants this valley.'), L('nova', 'Then it is time to meet her on the field.')],
  },
  {
    id: 2, name: 'THE BORDER WAR', sub: 'Scenario 2 · Spark', seed: 23, ai: 2, diff: 1, speed: 1, res: { food: 200, wood: 320, stone: 180, gold: 100 },
    raids: { first: 150, gap: 75, scale: 0.8 }, aiAtk: 150, brief: 'Queen Crimson claims your valley. Build an army and take her hall.',
    intro: [L('sys', 'THE BORDER. TWO KINGDOMS, ONE VALLEY, AND A RIVER THAT NEITHER WILL CROSS FIRST.'), L('crim', 'Little villagers, you are standing on my road. Leave the valley, and I shall let you take your pots and your children.'), L('elder', 'We will stay. Kel, how strong is she?'), L('scout', 'Archers and swordsmen, and soon knights. And King Golden is watching from the south. He will join whoever looks weaker.'), L('nova', 'Walls and towers first. Then a Town, then knights. Take her hall before Golden decides.')],
    objectives: [
      { t: 'hall', n: 2, text: 'Grow into a TOWN', hint: 'Upgrade the hall (U). Towns can build mines and train knights at a City.' },
      { t: 'build', what: 'tower', n: 3, text: 'Build 3 towers', hint: 'Queen Crimson attacks around the 2 minute mark.' },
      { t: 'upgrade', n: 3, lv: 2, text: 'Upgrade 3 buildings', hint: 'Upgraded towers shoot farther and harder; upgraded barracks train faster.' },
      { t: 'army', n: 16, text: 'Raise an army of 16', hint: 'More barracks train faster. Archers behind swordsmen is a strong mix.' },
      { t: 'destroy', who: 1, text: 'Destroy Crimson\'s Town Hall', hint: 'Right-click her hall (or press G then click) to send your army.' },
    ],
    outro: [L('crim', 'No... my crown... my hall...'), L('elder', 'Take what you need, and go in peace. The border is yours.'), L('gold', 'A new kingdom in the valley. Interesting. I shall keep my distance, for now.')],
  },
  {
    id: 3, name: 'SIEGE OF THE VALLEY', sub: 'Scenario 3 · Flame', seed: 37, ai: 0, diff: 2, speed: 1, res: { food: 220, wood: 360, stone: 240, gold: 120 },
    raids: { first: 95, gap: 50, scale: 1.5 }, aiAtk: 1e9, brief: 'No rivals this time: only the endless horde. Survive twelve waves of raiders.',
    intro: [L('sys', 'THE SIEGE OF THE VALLEY. THE OVERLORD HAS NO KINGDOM TO SEND, ONLY A HORDE THAT DOES NOT STOP.'), L('ovl', 'YOU THINK A WALL STOPS STATIC? I HAVE A MILLION MORE.'), L('nova', 'Raiders arrive every minute, from any edge. The warning shows you the direction, so put your towers on the side that is about to be hit.'), L('elder', 'Walls to slow them, towers to kill them, and a good hall to fall back on.'), L('scout', 'And do not forget the bigger ones, with the clubs. They come in later waves.')],
    objectives: [
      { t: 'hall', n: 3, text: 'Reach CITY rank', hint: 'A City hall has much more hit points and trains knights.' },
      { t: 'build', what: 'tower', n: 5, text: 'Build 5 towers', hint: 'Put towers near the hall and along the side the raiders come from.' },
      { t: 'upgrade', n: 3, lv: 3, text: 'Bring 3 buildings to MASTER level', hint: 'Level 3 needs a Town hall or better. Master towers and barracks win sieges.' },
      { t: 'build', what: 'wall', n: 10, text: 'Build 10 wall segments', hint: 'Walls cost only stone. Raiders stop to break them while the towers shoot.' },
      { t: 'raid', n: 12, text: 'Survive 12 waves of raiders', hint: 'Keep your army near the hall and recall (H) when a wave arrives.' },
    ],
    outro: [L('ovl', 'IMPOSSIBLE. THE HORDE IS ENDLESS.'), L('nova', 'It is, but the valley is stronger. The OVERLORD has nothing left to throw at us from the east.'), L('elder', 'There is one more thing, child. A Wonder, a monument to everything we saved. The other kingdoms are already racing to build it.')],
  },
  {
    id: 4, name: 'THE RACE TO THE WONDER', sub: 'Scenario 4 · Blaze', seed: 51, ai: 1, diff: 3, speed: 1, res: { food: 260, wood: 420, stone: 300, gold: 160 },
    raids: { first: 140, gap: 70, scale: 0.9 }, aiAtk: 200, brief: 'Lord Violet builds a Wonder in the north. Build yours first, or tear his down.',
    intro: [L('sys', 'THE WONDER. A GOLDEN TOWER THAT MAKES WHOEVER OWNS IT THE RULER OF THE VALLEY.'), L('vio', 'My architects began in the cold dawn. Lay down your arms, little king. History has already chosen.'), L('nova', 'Violet reached the Empire rank in half the time we did. He will start the Wonder soon. You will have to destroy it, or build faster.'), L('elder', 'The Wonder needs seven hundred of everything. Mines, quarries, farms. Burn your gold and build.'), L('scout', 'Or kill him before he finishes. His walls are thin on the north side.')],
    objectives: [
      { t: 'hall', n: 4, text: 'Become an EMPIRE', hint: 'Upgrade the hall three times. Mines need a Town, knights a City, the Wonder an Empire.' },
      { t: 'wonder', hold: 150, text: 'Build the Wonder and hold it for 2:30 (or destroy Violet)', hint: 'It costs 700 wood, 700 stone and 600 gold. Defend it while it stands.' },
    ],
    alt: { t: 'destroy', who: 1 },
    outro: [L('vio', 'My Wonder... my monument... gone.'), L('elder', 'A Wonder does not make a ruler. A people does.'), L('nova', 'There is one last thing. The Kingdoms at War, where every ruler wants the whole valley. And the OVERLORD is making them forget why they started.')],
  },
  {
    id: 5, name: 'KINGDOMS AT WAR', sub: 'Scenario 5 · Empire', seed: 67, ai: 3, diff: 3, speed: 1, res: { food: 300, wood: 480, stone: 320, gold: 200 },
    raids: { first: 120, gap: 62, scale: 1.1 }, aiAtk: 120, brief: 'Three brutal kingdoms, endless raiders, one valley. Only one empire can survive.',
    intro: [L('sys', 'THE LAST WAR. THREE CROWNS, ONE VALLEY, AND A SKY FULL OF STATIC.'), L('crim', 'There is room for only one queen.'), L('gold', 'There is room for only one king.'), L('vio', 'There is room for only one Wonder.'), L('ovl', 'FIGHT. EVERY ONE OF YOU. I WILL BE THE ONE WHO WINS WHEN YOU ARE ALL GONE.'), L('nova', 'They are all hunting you. And the OVERLORD feeds on the fighting. Whatever you do, do not let it win. Be the last kingdom standing.')],
    objectives: [
      { t: 'hall', n: 3, text: 'Reach CITY rank', hint: 'Build a strong economy before you fight.' },
      { t: 'last', text: 'Be the last kingdom standing (or hold the Wonder)', hint: 'Destroy every rival hall. Raiders hit everyone, so let them weaken your enemies.' },
    ],
    outro: [L('nova', 'It is over. All three crowns lie in the dust, and the valley is yours.'), L('elder', 'You are no longer survivors. You are an empire. Rule it kindly.'), L('sys', 'THE SUN RISES OVER THE VALLEY OF EMBERS. A HUNDRED CHIMNEYS SMOKE. SOMEWHERE, A CHILD LAUGHS.')],
  },
]
