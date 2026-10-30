import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
const root=fileURLToPath(new URL('../../frontend',import.meta.url));
const imageFile=name=>name===path.basename(name)&&!name.startsWith('.')&&/\.(jpe?g|png|webp)$/i.test(name);
export const menuImageField=z.string().max(300).refine(value=>{
 if(value===''||value==='/food.jpg')return true;
 if(!value.startsWith('/menu/'))return false;
 try{const name=decodeURIComponent(value.slice('/menu/'.length));return imageFile(name)}catch{return false}
},'Choose a photo from the menu folder.');
export async function listMenuImages(){
 const found=new Set();
 for(const dir of [path.join(root,'public','menu'),path.join(root,'dist','menu')]){
  let names=[];try{names=await readdir(dir)}catch{continue}
  for(const name of names)if(imageFile(name))found.add('/menu/'+encodeURIComponent(name));
 }
 return ['/food.jpg',...[...found].sort()];
}
