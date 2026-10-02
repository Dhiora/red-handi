import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

/** Play the baked Blender timeline. Checkout state, never a UI click, selects delivery. */
export async function createRestaurantScene(container,{order,paused,onReady,onError,onComplete,signal}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#9d7850');scene.fog=new THREE.Fog('#9d7850',19,35);
 const camera=new THREE.PerspectiveCamera(42,1,.1,70);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.domElement.setAttribute('aria-label','Full-screen 3D Red Handi cartoon restaurant');renderer.domElement.setAttribute('role','img');container.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffefd5,0x67432c,1.6));
 const key=new THREE.DirectionalLight(0xffddb0,2.8);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:25});key.shadow.bias=-.0003;key.shadow.normalBias=.035;scene.add(key);
 const fill=new THREE.DirectionalLight(0xc0d8ff,.8);fill.position.set(5,4,1);scene.add(fill);
 const warm=new THREE.PointLight(0xffb45f,55,12,2);warm.position.set(1,4,-2);scene.add(warm);
 const draco=new DRACOLoader();draco.setDecoderPath('/models/draco/');draco.setWorkerLimit(2);
 const resources={geometries:new Set(),materials:new Set(),textures:new Set()};
 let disposed=false,mixer=null,action=null,last=0,frame=0,isPaused=paused,finished=false,root=null;
 function resize(){const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;camera.aspect=width/height;
  if(camera.aspect<.8){camera.fov=48;camera.position.set(1.7,3.4,8.1);camera.lookAt(.55,1.65,-.8)}
  else if(camera.aspect<1.25){camera.fov=42;camera.position.set(1.5,2.9,8.2);camera.lookAt(.3,1.8,-.5)}
  else{camera.fov=39;camera.position.set(1.3,2.65,7.5);camera.lookAt(.25,1.9,-.3)}
  camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scene,camera);
 }
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const contextLost=e=>{e.preventDefault();onError('The 3D scene paused on this device. You can still order from the menu.');dispose()};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);renderer.domElement.removeEventListener('webglcontextlost',contextLost);resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());resources.textures.forEach(t=>{t.dispose();t.source?.data?.close?.()});draco.dispose();renderer.dispose();renderer.domElement.remove();signal?.removeEventListener('abort',dispose)}
 signal?.addEventListener('abort',dispose,{once:true});
 const collect=object=>object.traverse(o=>{if(o.geometry)resources.geometries.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){resources.materials.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.textures.add(value)}});
 try{
  const response=await fetch('/models/redhandi-restaurant.glb',{signal});if(!response.ok)throw new Error('Unable to load restaurant scene');const buffer=await response.arrayBuffer();if(disposed)return null;
  const gltf=await new GLTFLoader().setDRACOLoader(draco).parseAsync(buffer,'/models/');root=gltf.scene;collect(root);if(disposed){resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());resources.textures.forEach(t=>t.dispose());return null;}
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(root);
  if(order){const ticket=root.getObjectByName('TicketFace');if(ticket){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;const c=canvas.getContext('2d');c.fillStyle='#fff9e7';c.fillRect(0,0,256,384);c.fillStyle='#8d2c20';c.textAlign='center';c.font='bold 26px sans-serif';c.fillText('REDHANDI',128,48);c.fillStyle='#30251f';c.font='bold 28px sans-serif';c.fillText('#'+order.number,128,101,230);c.font='18px sans-serif';c.fillText(order.tableName||'IN-PERSON',128,133,230);c.textAlign='left';c.font='16px sans-serif';(order.items||[]).slice(0,6).forEach((item,i)=>c.fillText(`${item.quantity} × ${item.name}`,20,181+i*27,215));c.strokeStyle='#c5ac83';c.beginPath();c.moveTo(20,151);c.lineTo(236,151);c.stroke();const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;const material=new THREE.MeshStandardMaterial({map:texture,roughness:.85,side:THREE.DoubleSide});ticket.material=material;resources.textures.add(texture);resources.materials.add(material)}}
  if(!gltf.animations.length)throw new Error('Restaurant animation is missing');
  const timeline=new THREE.AnimationClip('RestaurantTimeline',-1,gltf.animations.filter(clip=>! /^(Chef|Steam)/.test(clip.name)).flatMap(clip=>clip.tracks));
  mixer=new THREE.AnimationMixer(root);const clip=THREE.AnimationUtils.subclip(timeline,order?'DeliverOrder':'Welcome',order?240:0,order?481:240,30);action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const cookingTimeline=new THREE.AnimationClip('CookingTimeline',-1,gltf.animations.filter(clip=>/^(Chef|Steam)/.test(clip.name)).flatMap(clip=>clip.tracks));
  mixer.clipAction(THREE.AnimationUtils.subclip(cookingTimeline,'Cooking',0,240,30)).play();mixer.update(0);
  if(isPaused){action.time=order?Math.max(0,clip.duration-.01):5;mixer.update(0);if(order){finished=true;onComplete?.()}}
  mixer.addEventListener('finished',event=>{if(event.action!==action)return;if(order){finished=true;onComplete?.()}else{const idle=mixer.clipAction(THREE.AnimationUtils.subclip(timeline,'AttentiveWaiter',120,240,30));idle.reset().setLoop(THREE.LoopRepeat,Infinity).play();action.crossFadeTo(idle,.45,false);action=idle;}});
  onReady();renderer.render(scene,camera);
  function tick(time){if(disposed)return;frame=requestAnimationFrame(tick);if(document.hidden){last=time;return}if(time-last<1000/30)return;const dt=Math.min((time-last)/1000,.08);last=time;if(isPaused)return;mixer.update(dt);renderer.render(scene,camera)}
  frame=requestAnimationFrame(tick);
  return {dispose,setPaused(value){isPaused=value},replay(){finished=false;mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopOnce,1).play();mixer.clipAction(THREE.AnimationUtils.subclip(cookingTimeline,'Cooking',0,240,30)).play();if(isPaused&&order){action.time=clip.duration-.01;mixer.update(0)}},};
 }catch(error){dispose();if(error.name!=='AbortError')onError('The 3D scene could not load. Your menu and ordering are still available.');return null}
}
