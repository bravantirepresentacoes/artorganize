import { useCallback, useEffect, useRef, useState } from 'react'
import { bridge } from './hub'
import { collectNexusOrders, orderTotal } from './nexusSalesModel'
import type { NexusOrder } from './nexusSalesModel'
export function useNexusSales(userId:string|undefined){
 const [state,setState]=useState<{userId?:string;orders:NexusOrder[];status:'loading'|'ready'|'error'|'disconnected';error:string;readAt:string}>({orders:[],status:'loading',error:'',readAt:''})
 const version=useRef(0)
 const refresh=useCallback(async()=>{const request=++version.current;if(!userId)return
 setState({userId,orders:[],status:'loading',error:'',readAt:''})
 try{const result=await collectNexusOrders(cursor=>bridge({action:'snapshot',kind:'orders',cursor}));orderTotal(result.orders)
 if(request===version.current)setState({userId,orders:result.orders,status:result.connected?'ready':'disconnected',error:result.reason||'',readAt:new Date().toISOString()})
 }catch(e){if(request===version.current)setState({userId,orders:[],status:'error',error:e instanceof Error?e.message:'Não foi possível consultar as vendas do Nexus.',readAt:''})}
 },[userId])
 useEffect(()=>{void refresh();const visible=()=>{if(document.visibilityState==='visible')void refresh()};const timer=setInterval(visible,120000);document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible)
 return()=>{version.current++;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible)}},[refresh])
 return {...(state.userId===userId?state:{orders:[],status:'loading' as const,error:'',readAt:''}),refresh}
}
