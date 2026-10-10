// The playable cast and the lobby use the same articulated models.
// All coordinates are world-space; drawing never changes the simulation.
import { animeHead, branch, shape } from './artDirection.js'

const fur = [.24,.095,.038], warm = [.36,.16,.065], tan = [.72,.43,.22]
const dark = [.065,.027,.019], cream = [.96,.88,.67], red = [.73,.025,.035]
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t)
const ball = (api,p,size,c,rz=0,ry=0) => shape(api,'sculpt',...p,...size,c,rz,ry)
const bone = (api,a,b,w,c) => branch(api,a,b,w,c,'sculpt')

export function drawBarrel(api,x,y,z=0,rot=0,scale=1) {
  const P=(a,b,c)=>[x+a*scale,y+b*scale,z+c*scale]
  // Curved individual staves, inset end caps, iron hoops and end-grain seams.
  ball(api,P(0,0,0),[2.12*scale,2.12*scale,2.6*scale],[.39,.17,.045])
  for(let i=0;i<12;i++) {
    const a=rot+i*Math.PI/6,c=Math.cos(a),s=Math.sin(a)
    ball(api,P(c*.89,s*.89,0),[.49*scale,.49*scale,2.32*scale],i%2?[.55,.28,.085]:[.66,.36,.12])
  }
  for(const side of [-1,1]) {
    ball(api,P(0,0,side*1.14),[1.86*scale,1.86*scale,.18*scale],[.64,.35,.14])
    for(let i=0;i<12;i++) {
      const a=rot+i*Math.PI/6,b=a+Math.PI/6
      branch(api,P(Math.cos(a)*1.05,Math.sin(a)*1.05,side*.81),P(Math.cos(b)*1.05,Math.sin(b)*1.05,side*.81),.17*scale,[.12,.16,.19])
    }
    for(const off of [-.42,.42]) {
      const c=Math.cos(rot),s=Math.sin(rot),reach=Math.sqrt(.82*.82-off*off)
      branch(api,P(c*off+s*reach,s*off-c*reach,side*1.24),P(c*off-s*reach,s*off+c*reach,side*1.24),.035*scale,[.29,.12,.038])
    }
  }
}

export function drawGorilla(api,{x=0,y=0,z=0,id=0,wind=0,direction=1},t=0) {
  const breath=Math.sin(t*2.1+id)*.08, beatTime=(t+id*1.7)%7
  const beating=wind<=0&&beatTime<1.5, lift=wind>0?Math.sin((.6-wind)/.6*Math.PI):0
  const dip=-lift*.38, P=(a,b,c)=>[x+a,y+b+dip,z+c]
  const throwPhase=wind>0?Math.max(0,Math.min(1,(.6-wind)/.6)):0
  const lower=Math.max(0,Math.min(1,(throwPhase-.4)/.35)),eased=lower*lower*(3-2*lower)
  const barrelX=direction*3*eased,barrelY=throwPhase<.4?4.3+Math.sin(throwPhase/.4*Math.PI/2)*6.1:10.4-9.3*eased
  const barrelZ=2.35*(1-eased)

  for(const s of [-1,1]) {
    ball(api,P(s*1.45,1.85,-.05),[2.5,3.2,2.65],fur,-s*.12)
    ball(api,P(s*1.55,.47,.72),[2.5,.95,3.1],dark)
    for(let i=0;i<4;i++)ball(api,P(s*1.55+(i-1.5)*.48,.38,2),[.48,.55,.85],warm)
  }
  ball(api,P(0,3.65,-.12),[4.8,4.3,3.5],fur)
  ball(api,P(0,6+breath,-.45),[6.6,5.5,4.5],fur)
  ball(api,P(0,6.6+breath,-1.8),[5.5,4.2,2.1],warm)
  ball(api,P(0,4.35,1.63),[3.3,3.9,.65],tan)
  for(const s of [-1,1]) {
    ball(api,P(s*1.22,6.05+breath,1.69),[2.5,2.2,.95],tan,s*.12)
    ball(api,P(s*3.05,6.65+breath,-.15),[3.25,3.5,3.5],warm,-s*.18)
    // Broad shoulder locks break up the silhouette without spiky body geometry.
    for(let i=0;i<3;i++)shape(api,'cone',...P(s*(3.8+i*.11),6.6-i*.56,-.12),.78,1.45,1.15,fur,s*.65)
    const beat=beating?(Math.sin(beatTime*21+s*1.5)+1)/2:0
    const shoulder=P(s*3.3,6.6+breath,.1)
    const idleElbow=P(s*4.3,3.65,.4),idleHand=P(s*4.55,1.18,1.4)
    const chestElbow=P(s*4.1,5.45,1.35),chestHand=P(s*(1.6-beat*.45),5.5+beat*.8,2.65)
    let elbow=beating?chestElbow:idleElbow,hand=beating?chestHand:idleHand
    if(wind>0) {
      const recovery=Math.max(0,(throwPhase-.75)/.25)
      elbow=mix(P(s*3.55+barrelX*.45,3.4+barrelY*.56,1.1),idleElbow,recovery)
      hand=mix([x+barrelX+s*1.15,y+barrelY,z+barrelZ],idleHand,recovery)
    }
    bone(api,shoulder,elbow,2.65,warm);ball(api,elbow,[2.3,2.35,2.4],fur)
    bone(api,elbow,hand,2.15,fur)
    ball(api,hand,[2.2,1.85,2.1],dark)
    for(let i=0;i<4;i++)ball(api,[hand[0]+(i-1.5)*.46,hand[1]-.42,hand[2]+.6],[.52,.95,.87],warm,-s*.05)
    ball(api,[hand[0]-s*.9,hand[1]+.1,hand[2]+.5],[.7,1.1,.75],warm,s*.5)
  }
  const hy=8.6+breath+lift*.25, look=direction*.09
  ball(api,P(0,hy,.45),[4.1,3.85,3.4],fur)
  for(const s of [-1,1]) {
    ball(api,P(s*1.91,hy-.12,.65),[.7,1.08,.72],warm)
    ball(api,P(s*1.96,hy-.12,.97),[.38,.66,.18],tan)
    ball(api,P(s*1.18,hy-.6,1.74),[1.28,1.83,.85],warm,s*.2)
  }
  // Crest swept backward, a large sculpted muzzle and a separate lower jaw.
  for(let i=-1;i<=1;i++)ball(api,P(i*.48,hy+1.65,-.19),[.83,1.25,1.36],warm,-i*.3,.25)
  ball(api,P(look,hy-.61,1.99),[2.8,1.9,1.34],tan)
  const roar=.2+lift*.5+(beating?.18:0)
  ball(api,P(look,hy-1.13-roar*.2,2.54),[1.94,.55+roar,.27],dark)
  ball(api,P(look,hy-1.47-roar*.4,2.12),[2.15,.55,.75],tan)
  for(let i=0;i<6;i++)ball(api,P(look+(i-2.5)*.25,hy-.95,2.69),[.26,.25,.16],cream)
  if(roar>.25)ball(api,P(look,hy-1.35,2.69),[.8,.15,.15],[.7,.17,.16])
  ball(api,P(look,hy-.23,2.65),[1.4,.75,.64],warm)
  for(const s of [-1,1]) {
    ball(api,P(look+s*.34,hy-.34,2.96),[.29,.22,.13],dark)
    ball(api,P(s*.76,hy+.45,1.97),[1.08,.84,.59],tan)
    ball(api,P(s*.76,hy+.45,2.21),[.79,.65,.24],cream)
    ball(api,P(s*.76+look,hy+.42,2.34),[.32,.43,.12],[.28,.1,.025])
    ball(api,P(s*.76+look,hy+.43,2.40),[.17,.28,.08],dark)
    ball(api,P(s*.76+look-.055,hy+.54,2.44),[.085,.105,.04],[1,1,.94])
    ball(api,P(s*.72,hy+.92,2.06),[1.57,.48,.68],fur,s*.17)
  }
  // The red tie from the supplied artwork, with a small brass pin.
  ball(api,P(0,6.68,2.29),[.72,.61,.35],red)
  shape(api,'cloth',...P(Math.sin(t*2)*.09,5.48,2.33),1.02,2.05,.28,red,.04*Math.sin(t*2))
  ball(api,P(0,5.65,2.5),[.4,.35,.09],[.97,.67,.13])
  // The throw releases at wind=.15 in the simulation; do not retain a ghost barrel.
  if(wind>.15)drawBarrel(api,x+barrelX,y+barrelY,z+barrelZ,-lower*direction,1)
}

export function drawHammer(api,hand,angle=0,scale=1) {
  const end=[hand[0]+Math.sin(angle)*1.6*scale,hand[1]+Math.cos(angle)*1.6*scale,hand[2]]
  branch(api,hand,end,.22*scale,[.35,.17,.06])
  shape(api,'cloth',...end,1.65*scale,.82*scale,.86*scale,[.39,.48,.55],-angle)
  for(const s of [-1,1])ball(api,[end[0]+Math.cos(angle)*s*.7*scale,end[1]-Math.sin(angle)*s*.7*scale,end[2]],[.28*scale,.89*scale,.93*scale],[.67,.75,.76],-angle)
}

export function drawClimber(api,p,t=0) {
  if(p.out||p.gone||p.inv>0&&Math.floor(t*12)%2===0||p.dead>0&&Math.floor(t*20)%3===0)return
  const climbing=!!p.ladder,air=!p.ground&&!climbing,run=climbing||air?0:Math.min(1,Math.abs(p.in?.dx||0)),phase=(p.anim||0)*14
  const yaw=climbing?Math.PI:(p.face||1)*.82,cs=Math.cos(yaw),sn=Math.sin(yaw)
  const bob=run*Math.abs(Math.sin(phase))*.11, pink=p.color==='#ff6ab8'
  const shirt=pink?[.78,.075,.27]:red,denim=pink?[.27,.13,.46]:[.055,.18,.39],skin=[.94,.65,.43]
  const P=(a,b,c)=>[p.x+a*cs+c*sn,p.y+b+(b>1.4?bob:0),-a*sn+c*cs]
  for(const s of [-1,1]) {
    const swing=Math.sin(phase+s*Math.PI/2)*run,climb=climbing?Math.sin(p.y*2.6+s*Math.PI/2):0
    const hip=P(s*.36,1.57,0),knee=P(s*.4,.89+Math.max(0,climb)*.55+(air&&s>0?.35:0),swing*.52+(air?.26:0)),foot=P(s*.43,.26+Math.max(0,climb)*.62+(air&&s>0?.3:0),swing*.66+.15)
    bone(api,hip,knee,.65,denim);bone(api,knee,foot,.52,denim)
    ball(api,foot,[.65,.5,1.04],[.12,.065,.033],0,yaw)
    ball(api,[foot[0],foot[1]-.14,foot[2]],[.67,.18,1.07],[.045,.035,.025],0,yaw)
  }
  shape(api,'cloth',...P(0,2.25,0),1.55,1.65,1.12,shirt,0,yaw)
  shape(api,'cloth',...P(0,1.73,.12),1.43,.91,1.06,denim,0,yaw)
  ball(api,P(0,2.3,.52),[.82,.89,.2],denim,0,yaw)
  for(const s of [-1,1]) {
    bone(api,P(s*.43,2.03,.47),P(s*.43,2.95,.32),.17,denim)
    ball(api,P(s*.39,2.45,.6),[.13,.13,.11],[.95,.68,.19])
    const swing=-Math.sin(phase+s*Math.PI/2)*run
    const shoulder=P(s*.75,2.77,0)
    let elbow=P(s*.91,2.23,swing*.38),hand=P(s*.98,1.8,swing*.7+.15)
    if(climbing){const c=Math.sin(p.y*2.6+s*Math.PI/2);elbow=P(s*.82,2.85+c*.35,.37);hand=P(s*.68,3.43+c*.45,.76)}
    if(air){elbow=P(s*1.03,2.95,.15);hand=P(s*1.12,3.37,.34)}
    const hammer=s===1&&p.ham>0
    const swingAngle=(p.face||1)*(.2+(p.in?.hit?(Math.sin((p.anim||0)*16)+1)*1.05:.2))
    if(hammer){elbow=P(s*.92,2.83,.3);hand=P(s*1.07,3.04,.58)}
    bone(api,shoulder,elbow,.53,shirt);bone(api,elbow,hand,.42,shirt)
    ball(api,hand,[.55,.57,.53],cream)
    if(hammer)drawHammer(api,hand,swingAngle,.9)
  }
  animeHead(api,...P(0,3.66,0),1.18,yaw,{skin,hair:[.14,.063,.03],iris:[.045,.27,.39],time:t,helmet:shirt})
  ball(api,P(0,4.13,.55),[1.25,.15,.87],shirt,0,yaw)
  ball(api,P(0,4.27,.47),[.35,.28,.12],cream,0,yaw)
}

export function drawRescue(api,x,y,t=0) {
  const sway=Math.sin(t*2)*.07,skin=[.94,.65,.46],hair=[.22,.083,.028]
  const P=(a,b,c)=>[x+a+sway*b/4,y+b,c]
  for(const s of [-1,1]) {
    bone(api,P(s*.28,.25,0),P(s*.3,1.5,0),.34,skin)
    ball(api,P(s*.3,.2,.18),[.46,.38,.74],red)
  }
  shape(api,'cone',...P(0,1.6,0),2.1,1.9,1.65,red)
  shape(api,'cloth',...P(0,2.6,0),1.1,1.37,.86,red)
  ball(api,P(0,2.28,.02),[1.15,.22,.94],cream)
  animeHead(api,...P(0,3.7,0),1.22,-.2,{skin,hair,style:'bun',iris:[.16,.34,.12],time:t})
  for(let i=0;i<3;i++)shape(api,'cone',...P((i-1)*.27,4.01,.43),.35,.66,.24,hair,Math.PI+(i-1)*.17,-.2)
  // Long segmented ponytail, swept to one side, and a cloth bow.
  for(let i=0;i<4;i++)ball(api,P(.6+i*.08,3.91-i*.36,-.56),[.78-i*.09,.95,.71-i*.06],hair,-.22-Math.sin(t*2)*.1)
  for(const s of [-1,1])shape(api,'cloth',...P(.61+s*.3,4.3,-.34),.67,.45,.38,red,s*.6)
  ball(api,P(.61,4.3,-.16),[.24,.25,.22],cream)
  for(const s of [-1,1]) {
    const shoulder=P(s*.54,2.98,0),elbow=P(s*.83,s>0?3.38:2.44,.14)
    const hand=P(s>0?.93+Math.sin(t*5)*.18:-.77,s>0?4.03:2.13,.32)
    bone(api,shoulder,elbow,.33,skin);bone(api,elbow,hand,.29,skin);ball(api,hand,[.34,.41,.32],skin)
  }
}

export function drawFlame(api,x,y,t=0) {
  ball(api,[x,y+.78,0],[1.65,1.75,1.5],[1,.27,.018])
  for(let i=-1;i<=1;i++)shape(api,'cone',x+i*.4,y+1.65+Math.sin(t*12+i)*.18,0,.8,1.65,.85,[1,.45,.035],Math.sin(t*8+i)*.18)
  ball(api,[x,y+.72,.6],[.9,1.1,.45],[1,.8,.14])
  for(const s of [-1,1]){ball(api,[x+s*.36,y+1.02,.72],[.38,.5,.2],cream);ball(api,[x+s*.36,y+1.02,.83],[.16,.3,.08],dark)}
}
