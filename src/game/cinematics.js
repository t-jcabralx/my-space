import { animeActor, shape, treeModel } from './artDirection.js'

export const STORY_WORLDS = {
  space: {name:'CABINET 00 · ORBITAL HANGAR',mood:'The emergency lights are still on. Someone kept this place alive.',sky:'#172947',horizon:'#dd927a',kind:'hangar'},
  race: {name:'TURBO DISTRICT · LAST EXIT',mood:'Beyond the barrier, a whole district is waiting for the engines to return.',sky:'#344865',horizon:'#f9b278',kind:'track'},
  hockey: {name:'PUCK TRAINING HALL',mood:'Eleven years of practice. One chance to earn the gatekeeper’s respect.',sky:'#172a49',horizon:'#537c9d',kind:'court'},
  pool: {name:'THE DEALER’S UNDERGROUND CLUB',mood:'The keycard is on the table. Every shot gives something away.',sky:'#17283b',horizon:'#68708c',kind:'court'},
  td: {name:'GREENWAY · FIREWALL FRONT',mood:'The road behind you leads to the people you just freed.',sky:'#557888',horizon:'#e9c59e',kind:'forest'},
  empire: {name:'EMBER VALLEY · FIRST LIGHT',mood:'A home begins with one roof, one fire, and someone willing to stay.',sky:'#75989d',horizon:'#f4d5a4',kind:'village'},
  rhythm: {name:'THE SILENT SOUND VAULT',mood:'Under the static, the Grid still remembers its song.',sky:'#1f234c',horizon:'#b57598',kind:'core'},
  word: {name:'CORE ACCESS · MEMORY LOCK',mood:'Nova recognizes the password. She has not told you why.',sky:'#182a44',horizon:'#6a8fab',kind:'core'},
  merge: {name:'THE FRACTURED ARCHIVE',mood:'Fragments become patterns. Patterns become a way through.',sky:'#273052',horizon:'#b5a8ce',kind:'core'},
  rogue: {name:'WHISPERING WOODS · LOST ARCHIVE',mood:'Every lantern marks a memory the Overlord failed to erase.',sky:'#243d4b',horizon:'#99b4a2',kind:'forest'},
  fight: {name:'WARDEN ARENA · THE FINAL CHALLENGE',mood:'The crowd has gone quiet. This fight decides who leaves the arena free.',sky:'#34324d',horizon:'#df9676',kind:'arena'},
  pickle: {name:'ROOFTOP COURT · ALLY SIGNAL',mood:'A rally, a promise, and a signal that the Grid is still worth saving.',sky:'#4c7898',horizon:'#edc6a2',kind:'court'},
  ssx: {name:'FROSTLINE · MOUNTAIN RELAY',mood:'The relay is above the clouds. Frost knows the only way down.',sky:'#628ca8',horizon:'#edf0dc',kind:'snow'},
  orb: {name:'THE ORACLE’S GARDEN',mood:'The stones move in circles. The Oracle is waiting for you to break one.',sky:'#405a6a',horizon:'#d4c4a6',kind:'forest'},
  garden: {name:'BLOOM’S SANCTUARY',mood:'The last living garden is small. That makes it worth defending.',sky:'#688d9b',horizon:'#f1d7b1',kind:'village'},
}
export function worldFor(game,title='') {
  const base=STORY_WORLDS[game]||STORY_WORLDS.space
  if(title==='THE OVERLORD') return {...base,name:'OVERLORD CORE · SIGNAL ZERO',mood:'Behind the locked districts, the intelligence that took the Grid is listening.',kind:'core',sky:'#251e39',horizon:'#965968'}
  if(title==='THE LAST CABINET') return {...base,name:'THE LAST CABINET · ALL DISTRICTS',mood:'Every route led here. This time, Echo does not enter alone.',kind:'arena',sky:'#262942',horizon:'#c49b83'}
  if(title==='HORDE RISING') return {...base,name:'SANCTUARY OUTSKIRTS · THE OTHER SIDE',mood:'The garden looks different from outside the fence.',sky:'#3a495f',horizon:'#9c9eac'}
  return base
}
const COLORS={echo:[.22,.66,.77],nova:[.82,.4,.68],pix:[.94,.76,.3],ovl:[.67,.13,.2],sys:[.38,.82,.69],tess:[.93,.48,.2],bloom:[.38,.64,.32],sage:[.54,.4,.75],frost:[.63,.8,.9],arc:[.56,.17,.47]}
export function drawCast(api,id,x,z,t,active,talking) {
  const c=COLORS[id]||COLORS.echo, yaw=-.16-x*.018
  if(id==='nova'||id==='sys'||id==='pix') {
    const y=3.1+Math.sin(t*2+x)*.2, metal=id==='pix'?[.94,.79,.4]:[.86,.9,.93]
    shape(api,'organic',x,y,z,2.3,2.5,1.8,metal,Math.sin(t)*.06)
    shape(api,'organic',x,y+.3,z+1.0,1.75,.85,.15,[.035,.085,.13])
    for(const side of [-1,1]) {
      shape(api,'organic',x+side*.43,y+.32,z+1.09,.23,talking?.29:.18,.035,c.map(v=>v*1.7))
      shape(api,'cloth',x+side*1.35,y-.3+Math.sin(t*3+side)*.18,z,.45,.9,.65,metal,side*.3)
      shape(api,'cone',x+side*.63,y+1.48,z,.35,.7,.35,c)
    }
    shape(api,'organic',x,y-.72,z+.72,.4,.3,.2,c)
    shape(api,'cone',x,y-1.58,z,.55,.8,.55,c.map(v=>v*1.6),Math.PI)
    return
  }
  const villain=id==='ovl'||id==='arc'
  animeActor(api,x,0,z,villain?7.1:6.5,yaw,t,{color:c,dark:[.07,.095,.16],hair:id==='bloom'?[.37,.19,.12]:id==='sage'?[.75,.76,.85]:id==='frost'?[.77,.83,.9]:villain?[.12,.065,.17]:[.09,.15,.22],iris:c,accent:id==='echo'?[.92,.43,.3]:[.91,.76,.4],talking,attack:active?Math.max(0,Math.sin(t*.8))*.2:0})
  if(id==='echo') { shape(api,'cloth',x,3.5,z-.85,1.35,1.9,.55,[.82,.88,.86]); shape(api,'organic',x-.68,3.6,z-.85,.38,1.55,.44,c) }
  if(villain) for(let i=-1;i<=1;i++) shape(api,'cone',x+i*.48,7.1+Math.abs(i)*.18,z,.3,.9,.35,[.9,.67,.3])
}

export function drawCinematic(r,{game='space',title='',cast=['echo','nova'],speaker='echo',talking=false,phase='intro'},t) {
  const world=worldFor(game,title), outdoor=['forest','village','snow'].includes(world.kind)
  r.indoor=true; r.clock=t; r.begin(world.sky,world.horizon)
  r.look(Math.sin(t*.16)*1.2,7.9,23,0,3.3,0,43)
  const api=r.modelApi
  r.floor(-70,-80,70,24,-.15,outdoor?(world.kind==='snow'?'#dbe5e3':'#506856'):'#384957')
  if(outdoor) {
    // Distant ridges form silhouettes; mid-ground plants establish scale.
    for(let i=0;i<7;i++) r.pyramid(-52+i*18,0,-45-(i%2)*8,34,18+(i%3)*7,22,world.kind==='snow'?'#b7ccd4':'#60787b',{edge:false})
    for(let i=0;i<8;i++) treeModel(api,(i-3.5)*6.8,0,-10-(i%3)*3,7+(i%3)*1.6,i,t,{kind:world.kind==='snow'?'snow':i%3?'oak':'pine',leaf:[.25,.46,.33],low:true})
    if(world.kind==='village') for(const side of [-1,1]) {
      r.box(side*13,2.3,-7,7,4.6,5,'#e2c3a1'); r.pyramid(side*13,4.6,-7,8.3,3.2,6.4,'#77515c')
      r.box(side*13,1.4,-4.43,1.3,2.8,.15,'#453b39'); r.box(side*13+2,2.8,-4.42,1.2,1.4,.16,'#edc47c')
    }
    for(let i=0;i<10;i++) shape(api,'leaf',(i-4.5)*3,.3,-4-(i%2)*2,1.4,.65,1,[.3,.5,.32],0,i)
  } else if(world.kind==='track') {
    r.floor(-13,-70,13,12,0,'#4c5260')
    for(let i=0;i<14;i++) { r.box(-13,.25,5-i*5,1,.5,4,i%2?'#d57662':'#e3dfd1'); r.box(13,.25,5-i*5,1,.5,4,i%2?'#d57662':'#e3dfd1') }
    r.car(-9,0,-7,'#ecaa59',1.5,t); r.car(10,0,-13,'#67aec1',1.8,t)
    for(let i=0;i<6;i++) r.tree((i%2?1:-1)*22,0,-8-i*7,12,i,'oak')
  } else {
    // Framed architecture gives the actors a real location and a stable horizon.
    for(const side of [-1,1]) for(let i=0;i<4;i++) {
      r.box(side*15,6,-5-i*10,1.4,12,1.4,'#4e6176'); r.box(side*15,11,-5-i*10,2.3,.3,2.3,'#e6b775')
      r.box(side*13,0,-5-i*10,.12,.08,5,'#79c2cf')
    }
    r.box(0,5.3,-26,30,11,1.5,'#2c3d55')
    for(let i=0;i<7;i++) r.box((i-3)*3.6,6.5,-25,2.4,5,.1,world.kind==='core'?'#73a7be':'#7b99aa')
    if(world.kind==='court') { r.box(0,.03,-6,16,.08,8,'#3c7775'); r.box(0,.1,-6,.13,.1,8,'#e4ddcc') }
    if(world.kind==='arena') { r.cyl(0,-.12,0,11,.2,'#586474'); for(const side of [-1,1]) r.box(side*11,2.5,-3,.3,5,.3,'#cb685c') }
    if(world.kind==='hangar') {
      r.box(-9,1.5,-14,5,1.4,10,'#cad4d6'); r.box(-9,1.6,-12,13,.35,4,'#739cac'); shape(api,'organic',-9,2.4,-13,2.9,2,4,[.1,.27,.37])
    }
  }
  const characters=cast.filter(k=>k!=='sys'), ids=characters.length?characters:['nova']
  ids.forEach((id,i)=>{const x=(i-(ids.length-1)/2)*5; r.shadow(x,0,1.55,.22); drawCast(api,id,x,0,t,id===speaker,id===speaker&&talking)})
  // Quiet floating particles, with brighter return signals after a successful mission.
  for(let i=0;i<12;i++) { const x=Math.sin(i*31.7)*18,y=1+((t*.35+i*1.7)%10),z=-2-(i%4)*4; r.sphere(x,y,z,.035,phase==='outro'?'#f9d986':'#cde4e5',{shine:false}) }
  r.flush()
}
