import {useEffect,useState} from 'react';
import RestaurantFilm from './RestaurantFilm';
import {selectCinema} from './cinemaManifest';

export default function RestaurantWelcome(props){
 const [manifest,setManifest]=useState(null);
 const [portrait,setPortrait]=useState(()=>window.matchMedia('(max-aspect-ratio: 4/5)').matches);
 useEffect(()=>{const controller=new AbortController();fetch('/cinema/manifest.json',{signal:controller.signal,cache:'no-cache'}).then(r=>r.ok?r.json():null).then(setManifest).catch(()=>{});return()=>controller.abort()},[]);
 useEffect(()=>{const media=window.matchMedia('(max-aspect-ratio: 4/5)');const change=e=>setPortrait(e.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 const film=selectCinema(manifest,{portrait,order:!!props.order});
 return <RestaurantFilm key={(props.order?._id||'welcome')+(film?.src||'poster')} {...props} film={film}/>;
}
