// Real GPU geometry for the mini arcade. The existing software renderer remains
// available for lightweight thumbnails and for devices without WebGL.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { artGeometries } from '../artDirection.js'
import { makeR3, parse } from './r3.js'

export function makeMiniWebGL(canvas, g, W = 360, H = 540) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setSize(W, H, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const scene = new THREE.Scene()
  // The arcade uses +X to screen-right while its camera faces +Z.
  // Mirror the scene root (not the projection) so lighting/front faces remain correct.
  scene.scale.x = -1
  const perspective = new THREE.PerspectiveCamera(45, W / H, 1, 6000)
  const ortho = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 6000)
  let camera = perspective, board = false
  const hemi = new THREE.HemisphereLight('#d8efff', '#77718c', 1.65)
  const sun = new THREE.DirectionalLight('#fff0d5', 2.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = sun.shadow.camera.bottom = -460
  sun.shadow.camera.right = sun.shadow.camera.top = 460
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 1600
  sun.shadow.normalBias = 1.4; sun.shadow.bias = -0.0003
  scene.add(hemi, sun, sun.target)
  const sky = document.createElement('canvas'); sky.width = 2; sky.height = 128
  const skyContext = sky.getContext('2d'), skyTexture = new THREE.CanvasTexture(sky)
  skyTexture.colorSpace = THREE.SRGBColorSpace; scene.background = skyTexture
  let skyKey = ''
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    round: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
    pyramid: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
    gem: new THREE.OctahedronGeometry(0.6),
    torus: new THREE.TorusGeometry(1, 0.07, 6, 40),
    panel: new THREE.PlaneGeometry(1,1),
    ...artGeometries(),
  }
  const batches = new Map(), gradients=new Map(), object = new THREE.Object3D(), color = new THREE.Color()
  const from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(), hit = new THREE.Vector3()
  const r = makeR3(g, W, H)
  r.isWebGL = true
  const swLook = r.look, labels = []
  const lightAt = (x, y, z) => { sun.position.set(x - 240, y + 480, z - 420); sun.target.position.set(x, y, z) }
  r.look = (ex, ey, ez, tx, ty, tz, fov = 45) => {
    board = false
    swLook(ex, ey, ez, tx, ty, tz, fov)
    camera = perspective; camera.fov = fov; camera.updateProjectionMatrix()
    camera.position.set(-r.E[0],r.E[1],r.E[2]); camera.lookAt(-tx, ty, tz); camera.updateMatrixWorld()
    lightAt(tx, ty, tz)
  }
  // A slight tilt reveals the modeled edges; input is ray-mapped back to the board.
  r.screen = (offsetY = 0) => {
    board = true
    camera = ortho; camera.position.set(-80, H / 2 + offsetY + 95, -1000)
    camera.lookAt(0, H / 2 + offsetY, 0); camera.updateMatrixWorld()
    lightAt(0, H / 2 + offsetY, 0)
  }
  r.proj = (p) => {
    const v = new THREE.Vector3(-p[0],p[1],p[2]).project(camera)
    if (v.z < -1 || v.z > 1) return null
    const depth = new THREE.Vector3(-p[0],p[1],p[2]).applyMatrix4(camera.matrixWorldInverse).z
    return { x: (v.x + 1) * W / 2, y: (1 - v.y) * H / 2, z: -depth, k: camera === ortho ? 1 : H / (2 * Math.tan(camera.fov * Math.PI / 360) * -depth) }
  }
  r.pickGround = (x, y, height = 0) => {
    raycaster.setFromCamera(new THREE.Vector2(x / W * 2 - 1, 1 - y / H * 2), camera)
    plane.set(up, -height)
    return raycaster.ray.intersectPlane(plane, hit) ? [-hit.x, hit.z] : null
  }
  r.boardPoint = (x,y) => {
    if(!board)return null
    raycaster.setFromCamera(new THREE.Vector2(x/W*2-1,1-y/H*2),camera)
    plane.set(new THREE.Vector3(0,0,1),0)
    return raycaster.ray.intersectPlane(plane,hit)?[-hit.x+W/2,H-hit.y]:null
  }
  function mesh(kind, x, y, z, sx, sy, sz, c, o = {}) {
    if (!Number.isFinite(x + y + z + sx + sy + sz) || !sx || !sy || !sz) return
    const alpha = Math.round(Math.min(1, Math.max(0, o.alpha ?? 1)) * 10) / 10
    if (!alpha) return
    const glow = o.glow > 1.2 ? 0.25 : 0, surface=o.unlit?'unlit':o.surface||(['leaf','organic','cloth','branch','sculpt'].includes(kind)?'matte':'paint'),key = `${kind}:${alpha}:${glow}:${surface}`
    let batch = batches.get(key)
    if (!batch) {
      const material = surface==='unlit'?new THREE.MeshBasicMaterial({color:'#ffffff',transparent:alpha<1,opacity:alpha,depthWrite:alpha===1,side:THREE.DoubleSide,toneMapped:false}):new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: surface==='gel'?.24:surface==='matte'?.88:.48, metalness: surface==='paint'?.08:0, transparent: alpha < 1, opacity: alpha, depthWrite: alpha === 1, emissive: '#ffffff', emissiveIntensity: glow, side: THREE.DoubleSide })
      // Keep neon rims in their instance color instead of bleaching every glow white.
      if(glow&&surface!=='unlit')material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
        totalEmissiveRadiance *= vColor.rgb;
#endif`)
      }
      const instances = new THREE.InstancedMesh(geometries[kind], material, 2048)
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage); instances.frustumCulled = false
      instances.castShadow = alpha === 1&&surface!=='unlit'; instances.receiveShadow = surface!=='unlit'
      scene.add(instances); batch = { instances, used: 0, capacity: 2048 }; batches.set(key, batch)
    }
    if (batch.used >= batch.capacity) {
      const old = batch.instances, replacement = new THREE.InstancedMesh(old.geometry, old.material, batch.capacity * 2)
      replacement.instanceMatrix.array.set(old.instanceMatrix.array)
      if (old.instanceColor) { replacement.setColorAt(0, color); replacement.instanceColor.array.set(old.instanceColor.array) }
      replacement.castShadow = old.castShadow; replacement.receiveShadow = old.receiveShadow; replacement.frustumCulled = false
      replacement.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      scene.remove(old); old.dispose(); scene.add(replacement)
      batch.instances = replacement; batch.capacity *= 2
    }
    object.position.set(x, y, z); object.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')
    if (o.quaternion) object.quaternion.copy(o.quaternion)
    object.scale.set(sx, sy, sz); object.updateMatrix()
    const col = parse(c)
    color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace)
    batch.instances.setMatrixAt(batch.used, object.matrix); batch.instances.setColorAt(batch.used++, color)
  }
  r.begin = (top = '#172743', bottom = '#080f20') => {
    for (const batch of batches.values()) batch.used = 0
    for(const panel of gradients.values())panel.visible=false
    labels.length = 0; r.q.length = 0
    g.clearRect(0, 0, W, H)
    const next = top + bottom
    if (next !== skyKey) {
      const gradient = skyContext.createLinearGradient(0, 0, 0, 128)
      gradient.addColorStop(0, top || '#101b30'); gradient.addColorStop(1, bottom || '#080f20')
      skyContext.fillStyle = gradient; skyContext.fillRect(0, 0, 2, 128); skyTexture.needsUpdate = true; skyKey = next
    }
  }
  r.gradient=(x,y,z,width,height,top,bottom)=>{
    const key=top+bottom;let panel=gradients.get(key)
    if(!panel){
      const c=document.createElement('canvas');c.width=2;c.height=128;const ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128)
      gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);ctx.fillStyle=gradient;ctx.fillRect(0,0,2,128)
      const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace
      panel=new THREE.Mesh(geometries.panel,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));scene.add(panel);gradients.set(key,panel)
    }
    panel.visible=true;panel.position.set(x,y,z);panel.scale.set(width,height,1)
  }
  r.box = (x,y,z,sx,sy,sz,c,o={}) => mesh(o.edge === false || o.bevel === false ? 'box' : 'round',x,y,z,sx,sy,sz,c,o)
  r.sphere = (x,y,z,s,c,o={}) => { mesh('sphere',x,y,z,s,s,s,c,o); if (o.ring) mesh('torus',x,y,z-s*.1,s*1.03,s*1.03,s*1.03,o.ring,o) }
  r.ellipsoid = (x,y,z,sx,sy,sz,c,o={}) => mesh('sphere',x,y,z,sx,sy,sz,c,o)
  r.cyl = (x,y,z,rad,h,c,o={}) => mesh('cylinder',x,y+h/2,z,rad,h,rad,c,o)
  r.disc = (x,y,z,rad,thick,c,o={}) => mesh('cylinder',x,y,z+thick/2,rad,thick,rad,o.top||c,{...o,rx:Math.PI/2})
  r.pyramid = (x,y,z,w,h,d,c,o={}) => mesh('pyramid',x,y+h/2,z,w,h,d,c,o)
  r.gem = (x,y,z,s,c,o={}) => mesh('gem',x,y,z,s,s,s,c,o)
  r.floor = (x0,z0,x1,z1,y,c,o={}) => r.box((x0+x1)/2,y-1,(z0+z1)/2,x1-x0,2,z1-z0,c,{...o,edge:false})
  r.quad = (pts,c,o={}) => {
    // Existing mini-game quads are rectangular floors.
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), zs=pts.map(p=>p[2])
    r.box((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,(Math.min(...zs)+Math.max(...zs))/2,Math.max(...xs)-Math.min(...xs)||1,Math.max(...ys)-Math.min(...ys)||1,Math.max(...zs)-Math.min(...zs)||1,c,{...o,edge:false})
  }
  r.line = (a,b,c='#ffffff',width=2) => {
    from.fromArray(a); to.fromArray(b); direction.subVectors(to,from)
    const length=direction.length(); if(length<.001)return
    object.quaternion.setFromUnitVectors(up,direction.normalize())
    mesh('cylinder',(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width/2,length,width/2,c,{quaternion:object.quaternion.clone()})
  }
  r.car = (x,y,z,c,scale=1,phase=0) => {
    const box=(a,b,d,w,h,l,col,o={})=>r.box(x+a*scale,y+b*scale,z+d*scale,w*scale,h*scale,l*scale,col,o)
    // Low, wide sports-car silhouette with a raked windscreen and rear wing.
    box(0,.98,0,4.15,1.1,8,c);box(0,1.51,-2.45,3.85,.18,2.5,c,{rx:-.06})
    box(0,1.76,.2,3.05,.82,3.25,'#183552');box(0,2.22,.45,2.8,.2,2.15,c)
    box(0,1.86,-1.15,2.95,.64,.15,'#427caa',{rx:.48})
    box(0,1.2,-4.04,2.65,.3,.16,'#131c2c');box(0,.5,-3.9,4.25,.16,.45,'#253247')
    box(0,1.55,-2.6,.3,.06,2.4,'#ffd971');box(0,2.34,.45,.3,.05,2,c)
    for(const side of [-1,1])box(side*1.25,1.62,3.25,.17,.9,.2,'#283345')
    box(0,2.12,3.25,4.2,.16,.7,'#253247')
    for(const side of [-1,1]) {
      box(side*1.5,1.24,-4,.9,.19,.14,'#9de9ff',{glow:1.8});box(side*1.45,1.25,4,.85,.22,.14,'#e52951');box(side*1.79,1.78,-.85,.5,.2,.4,c)
      for(const zz of [-2.45,2.5]) {
        mesh('cylinder',x+side*1.87*scale,y+.75*scale,z+zz*scale,.83*scale,.54*scale,.83*scale,'#293140',{rz:Math.PI/2})
        mesh('cylinder',x+side*2.15*scale,y+.75*scale,z+zz*scale,.47*scale,.05*scale,.47*scale,'#b4c4d2',{rz:Math.PI/2})
        r.line([x+side*2.19*scale,y+(.75+Math.sin(phase)*.38)*scale,z+(zz+Math.cos(phase)*.38)*scale],[x+side*2.19*scale,y+(.75-Math.sin(phase)*.38)*scale,z+(zz-Math.cos(phase)*.38)*scale],'#556679',.13*scale)
      }
    }
  }
  r.shadow = () => {} // Real contact shadows are rendered by the light.
  r.text = (x,y,z,s,size,c='#ffffff') => labels.push({x,y,z,s,size,c})
  r.emoji = (x,y,z,s,size) => labels.push({x,y,z,s,size,c:'#ffffff',emoji:true})
  r.modelApi.putShape = (kind,x,y,z,sx,sy,sz,rz,red,green,blue,ry=0) => mesh(kind,x,y,z,sx,sy,sz,[red*255,green*255,blue*255],{rz,ry,alpha:r.modelAlpha??1})
  r.modelApi.put3 = (x,y,z,sx,sy,sz,rz,red,green,blue,ry=0) => r.box(x,y,z,sx,sy,sz,[red*255,green*255,blue*255],{rz,ry,alpha:r.modelAlpha??1})
  r.flush = () => {
    for (const {instances,used} of batches.values()) { instances.count=used; instances.visible=used>0; instances.instanceMatrix.needsUpdate=true; if(instances.instanceColor) instances.instanceColor.needsUpdate=true }
    renderer.render(scene,camera)
    for (const label of labels) {
      const p=r.proj([label.x,label.y,label.z]); if(!p)continue
      g.font=`${label.emoji?'':'700 '}${Math.max(8,label.size*p.k)}px ${label.emoji?'serif':'system-ui, sans-serif'}`
      g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=label.c; g.fillText(label.s,p.x,p.y)
    }
    r.info={tod:'DAY',weather:'CLEAR'}
  }
  r.dispose = () => {
    for(const {instances} of batches.values()) {instances.material.dispose(); instances.dispose()}
    for(const panel of gradients.values()){panel.material.map.dispose();panel.material.dispose()}
    for(const geometry of Object.values(geometries))geometry.dispose()
    skyTexture.dispose(); sun.shadow.dispose(); renderer.dispose()
    // React may replay an effect on the same canvas during development.
    requestAnimationFrame(()=>{if(!canvas.isConnected)renderer.forceContextLoss()})
  }
  return r
}
