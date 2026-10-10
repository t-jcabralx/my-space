// Renderer ownership stays outside the simulation and network snapshots.
export const kongAnimeReady = new Set()

export function kongAnimePresentation(player,time,motionX=player.vx) {
  const action=player.dead>0?'hurt':player.ladder?'climb':!player.ground?'jump':player.ham>0&&(player.in?.hit||player.hit>0)?'hammer':player.done?'greet':Math.abs(motionX)>0.1?'run':'idle'
  return {
    action,
    time:action==='climb'?player.y*.55:player.anim||0,
    yaw:player.ladder?Math.PI:(player.face||1)*1.12,
    visible:!player.out&&!player.gone&&!(player.inv>0&&Math.floor(time*12)%2===0)&&!(player.dead>0&&Math.floor(time*20)%3===0),
  }
}
