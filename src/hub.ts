import { supabase } from './lib/supabase'
export type Source={kind:'orders'|'clients'|'interests';id:string;title?:string}
export type LinkedTask={id:string;title:string;priority:'low'|'normal'|'high';status:'pending'|'done';due_at:string|null;category:string|null;recurrence:string|null;origin:'nexus';source_kind:Source['kind'];source_id:string;updated_at:string}
export type PendingItem={id:string;kind:Source['kind'];title:string;detail:string;due_at:string;reason:string}
export async function bridge(body:Record<string,unknown>){
 if(!navigator.onLine)throw new Error('Você está sem conexão. Reconecte para consultar ou salvar.')
 const {data:{session},error}=await supabase.auth.getSession()
 if(error||!session)throw new Error('Entre novamente no ArtOrganiz para continuar.')
 const response=await fetch('https://jfzwssocriqysqofrdfl.supabase.co/functions/v1/artorganiz-bridge',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
 const data=await response.json()
 if(!response.ok||data.error)throw new Error(data.error||'Não foi possível consultar o Nexus.')
 return data
}
export async function hub(operation:string,payload:Record<string,unknown>={}){const data=await bridge({action:'hub',operation,payload});if(!data.connected)throw new Error('Conecte o Nexus para continuar.');return data}
export async function getWorkspace(){const tasks:LinkedTask[]=[];let cursor:string|null=null;do{const data=await hub('workspace',{cursor});tasks.push(...data.tasks);cursor=data.nextCursor}while(cursor);return tasks}
export function localInput(v:string|null|undefined){if(!v)return '';const d=new Date(v),p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
export function iso(value:string){if(!value)return null;const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error('Informe uma data válida.');return d.toISOString()}
export function money(value:unknown){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
export function fmt(value:unknown){return value?new Date(String(value)).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Sem prazo'}
