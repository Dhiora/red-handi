import {createContext,useContext,useRef,useCallback,useSyncExternalStore,useEffect} from 'react';
import {api} from '../api';
const RestaurantContext=createContext(null);
const empty=Object.freeze({data:null,error:'',loading:false,updatedAt:0});
export function RestaurantProvider({children}){
 const store=useRef(null);
 if(!store.current){
  const entries=new Map(),listeners=new Set(),pending=new Map();let generation=0;
  const emit=()=>listeners.forEach(fn=>fn());
  store.current={get:key=>entries.get(key)||empty,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
   invalidate(){generation++;pending.clear();for(const [key,value] of entries)entries.set(key,{...value,updatedAt:0});emit()},
   clear(){generation++;entries.clear();pending.clear();emit()},
   async load(key,{force=false}={}){
    if(!key)return null;if(pending.has(key))return pending.get(key);
    const old=entries.get(key)||empty;if(!force&&old.data&&Date.now()-old.updatedAt<15000)return old.data;
    const epoch=generation;entries.set(key,{...old,loading:true,error:''});emit();
    const request=api(key).then(data=>{if(epoch===generation){entries.set(key,{data,error:'',loading:false,updatedAt:Date.now()});emit()}return data}).catch(error=>{if(epoch===generation){entries.set(key,{...old,loading:false,error:error.message});emit()}throw error}).finally(()=>{if(pending.get(key)===request)pending.delete(key)});
    pending.set(key,request);return request;
   }
  };
 }
 return <RestaurantContext.Provider value={store.current}>{children}</RestaurantContext.Provider>;
}
export function useRestaurantStore(){const store=useContext(RestaurantContext);if(!store)throw new Error('RestaurantProvider is required');return store}
export function useRestaurantResource(path,{poll=0}={}){
 const store=useRestaurantStore();
 const snapshot=useSyncExternalStore(store.subscribe,useCallback(()=>store.get(path),[store,path]));
 const load=useCallback(()=>store.load(path,{force:true}),[store,path]);
 useEffect(()=>{if(!path)return;store.load(path).catch(()=>{});const refresh=()=>{if(!document.hidden)load().catch(()=>{})};const timer=poll?setInterval(refresh,poll):null;window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}},[store,path,poll,load]);
 return {...snapshot,load};
}
