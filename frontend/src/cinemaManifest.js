// Invalid or unavailable media leaves an orderable static poster; never load WebGL.
export function selectCinema(manifest,{portrait=false,order=false}={}){
 if(!manifest||manifest.enabled!==true)return null;
 const variant=portrait?manifest.portrait:manifest.landscape;
 const fallback=manifest.landscape;
 const media=variant||fallback;
 const valid=url=>typeof url==='string'&&/^\/cinema\/[a-z0-9/_-]+\.(mp4|webm)$/i.test(url);
 if(!media||!valid(media.welcome)||!valid(media.confirmation))return null;
 const poster=order&&media.confirmationPoster?media.confirmationPoster:media.poster;
 return {src:order?media.confirmation:media.welcome,idle:!order&&valid(media.idle)?media.idle:null,poster:typeof poster==='string'&&/^\/cinema\/[a-z0-9/_-]+\.(png|jpg|webp)$/i.test(poster)?poster:'/cinema/waiter-keyframe.png'};
}
