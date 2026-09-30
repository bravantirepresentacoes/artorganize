import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, RefreshCw, Unplug, ExternalLink, Search, Pencil, CheckCircle2, ShieldCheck, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './NexusPanel.css'
import { hub } from './hub'
import type { Source } from './hub'
const endpoint='https://jfzwssocriqysqofrdfl.supabase.co/functions/v1/artorganiz-bridge'
type Kind='orders'|'clients'|'interests'|'events'
type Connection={connected:boolean;account?:string;company?:string;reason?:string;accessMode?:'read'|'manage'}
type Item={id:string;[key:string]:unknown}
const tabs:[Kind,string][]=[['orders','Pedidos'],['clients','Clientes'],['interests','Interesses'],['events','Atividades']]
async function bridge(body:Record<string,unknown>){
 const {data:{session},error}=await supabase.auth.getSession()
 if(error||!session)throw new Error('Entre novamente no ArtOrganiz para continuar.')
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
 const data=await response.json()
 if(!response.ok||data.error)throw new Error(data.error||'Não foi possível consultar o Nexus.')
 return data
}
const text=(value:unknown)=>value==null?'':String(value)
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):''
const money=(value:unknown)=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const status=(value:unknown)=>text(value).toLowerCase().replaceAll('_',' ')
export function NexusPanel({initialTarget,onTask,onClient,onConnectionChange}:{onConnectionChange:()=>Promise<void>;initialTarget?:Source|null;onTask:(s:Source)=>void;onClient:(id:string)=>void}){
 const [target,setTarget]=useState(initialTarget||null)
 const [editing,setEditing]=useState<Item|null>(null),[draft,setDraft]=useState<Record<string,string>>({}),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[success,setSuccess]=useState(''),[filter,setFilter]=useState('all'),[pendingAccess,setPendingAccess]=useState<'read'|'manage'>('read')
 const dialog=useRef<HTMLDialogElement>(null),savingGuard=useRef(false)
 const [connection,setConnection]=useState<Connection|null>(null),[kind,setKind]=useState<Kind>(initialTarget?.kind||'orders')
 const [items,setItems]=useState<Item[]>([]),[cursor,setCursor]=useState<string|null>(null),[search,setSearch]=useState('')
 const [loading,setLoading]=useState(false),[link,setLink]=useState(''),[expires,setExpires]=useState(0),[error,setError]=useState(''),[readAt,setReadAt]=useState('')
 useEffect(()=>{if(connection)void onConnectionChange()},[connection?.connected,onConnectionChange])
 const sequence=useRef(0),alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++}},[])
 const checkConnection=useCallback(async()=>{
  try{const data=await bridge({action:'connection'});if(!alive.current)return;setConnection(data);if(data.connected&&(!link||data.accessMode===pendingAccess)){setLink('');setError('')}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Não foi possível verificar a conexão.')}
 },[link,pendingAccess])
 useEffect(()=>{void checkConnection()},[checkConnection])
 useEffect(()=>{
  if(!link)return
  const timer=setInterval(()=>{if(Date.now()>expires){setLink('');setError('A autorização expirou. Inicie uma nova conexão.')}else if(document.visibilityState==='visible')void checkConnection()},3000)
  return()=>clearInterval(timer)
 },[link,expires,checkConnection])
 const load=useCallback(async(next:string|null=null)=>{
  const request=++sequence.current;setLoading(true);setError('')
  try{
   const data=target?await hub('record',{kind:target.kind,id:target.id}):await bridge({action:'snapshot',kind,cursor:next})
   if(!alive.current||request!==sequence.current)return
   if(!data.connected){setConnection(data);setItems([]);setCursor(null);return}
   setItems(previous=>next?Array.from(new Map([...previous,...data.items].map((item:Item)=>[item.id,item])).values()):data.items)
   setCursor(data.nextCursor);setReadAt(data.readAt)
  }catch(e){if(alive.current&&request===sequence.current)setError(e instanceof Error?e.message:'Não foi possível atualizar os dados.')}
  finally{if(alive.current&&request===sequence.current)setLoading(false)}
 },[kind,target])
 useEffect(()=>{setItems([]);setCursor(null);setReadAt('');setSearch('');setFilter('all');setEditing(null);setSuccess('');if(connection?.connected)void load();return()=>{sequence.current++}},[connection?.connected,load])
 const begin=async(accessMode:'read'|'manage'='read')=>{
  if(loading)return;setLoading(true);setError('')
  try{const data=await bridge({action:'begin',accessMode});if(!alive.current)return;setPendingAccess(accessMode);setLink(data.url);setExpires(new Date(data.expiresAt).getTime())}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Não foi possível iniciar a conexão.')}
  finally{if(alive.current)setLoading(false)}
 }
 const disconnect=async()=>{
  if(loading||!window.confirm('Desconectar o Nexus desta conta ArtOrganiz? Os dados do Nexus serão preservados.'))return
  setLoading(true);setError('');sequence.current++
  try{await bridge({action:'disconnect'});if(alive.current){setConnection({connected:false});setItems([]);setCursor(null);setLink('');setReadAt('')}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Não foi possível desconectar.')}
  finally{if(alive.current)setLoading(false)}
 }
 const startEdit=(item:Item)=>{setEditing(item);setSaveError('');setSuccess('');setDraft(Object.fromEntries((kind==='clients'?['contact_name','phone','city','state']:kind==='orders'?['notes','delivery_date']:['priority','status','desired_quantity']).map(key=>[key,text(item[key])])))}
 useEffect(()=>{if(editing)dialog.current?.showModal();else dialog.current?.close()},[editing])
 const save=async(event:React.FormEvent)=>{
  event.preventDefault();if(!editing||savingGuard.current)return
  const patch:Record<string,unknown>={}
  for(const [key,value] of Object.entries(draft)){const normalized=key==='state'?value.trim().toUpperCase():value.trim();if(normalized!==text(editing[key]))patch[key]=key==='desired_quantity'?(normalized?Number(normalized):null):(normalized||null)}
  if(Object.keys(patch).length===0){setEditing(null);return}
  savingGuard.current=true;setSaving(true);setSaveError('')
  try{await bridge({action:'update',kind,id:editing.id,expected:editing.updated_at,patch});if(!alive.current)return;setEditing(null);setSuccess('Alteração salva no Nexus e registrada no histórico.');await load()}
  catch(e){if(alive.current)setSaveError(e instanceof Error?e.message:'Não foi possível salvar.')}
  finally{savingGuard.current=false;if(alive.current)setSaving(false)}
 }
 const statuses=Array.from(new Set(items.map(item=>text(kind==='clients'?item.registration_status:item.status)).filter(Boolean)))
 const filtered=items.filter(item=>(filter==='all'||text(kind==='clients'?item.registration_status:item.status)===filter)&&Object.values(item).some(value=>text(value).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))))
 return <section className="panel nexusPanel" aria-labelledby="nexus-title">
  <div className="panelHead"><div><p className="eyebrow">INTEGRAÇÃO · {connection?.accessMode==='manage'?'CONSULTA E EDIÇÃO':'SOMENTE LEITURA'}</p><h2 id="nexus-title">Nexus Bravanti</h2><p className="muted">{connection?.connected?`${connection.company||'Empresa conectada'} · ${connection.account||'Administrador'}`:'Consulte seus pedidos, clientes, interesses e atividades do Nexus aqui.'}</p></div>
   {connection?.connected&&<button disabled={loading} onClick={()=>void disconnect()}><Unplug size={17}/>Desconectar</button>}
  </div>
  {success&&<div className="nexusSuccess" role="status"><CheckCircle2 size={18}/>{success}</div>}
  {error&&<div className="nexusError" role="alert">{error}</div>}
  {!connection&&!error&&<p role="status">Verificando conexão...</p>}
  {!connection&&error&&<button onClick={()=>void checkConnection()}>Tentar novamente</button>}
  {connection&&!connection.connected&&<div className="nexusConnect">
   {connection.reason&&<p>{connection.reason}</p>}
   <p>Conecte sua conta de administrador para acompanhar a empresa. Você pode habilitar a edição depois, quando precisar.</p>
   {link?<><a className="nexusAuthorize" href={link} target="_blank" rel="noopener noreferrer">Autorizar no Nexus <ExternalLink size={17}/></a><p role="status">Após autorizar, volte para esta aba. A conexão será reconhecida automaticamente.</p><button onClick={()=>void checkConnection()}>Já autorizei, verificar</button></>:<button disabled={loading} onClick={()=>void begin()}><Link2 size={17}/>{loading?'Preparando...':'Conectar Nexus'}</button>}
  </div>}
  {connection?.connected&&<>
   <div className="nexusPermission"><ShieldCheck size={19}/><div><strong>{connection.accessMode==='manage'?'Você pode gerenciar por aqui':'Pronto para gerenciar sua empresa?'}</strong><p>{connection.accessMode==='manage'?'Edite contatos, observações e previsão de entrega dos pedidos, e acompanhe os interesses.':'Habilite a edição para fazer alterações no Nexus sem sair da central.'}</p></div>{connection.accessMode!=='manage'&&!link&&<button disabled={loading} onClick={()=>void begin('manage')}>Habilitar edição</button>}</div>
   {link&&<div className="nexusConnect"><a className="nexusAuthorize" href={link} target="_blank" rel="noopener noreferrer">Autorizar edição no Nexus <ExternalLink size={17}/></a><p>Confirme com a conta de administrador da empresa. Sua consulta continua disponível.</p><button onClick={()=>void checkConnection()}>Já autorizei, verificar</button></div>}
   {target&&<p className="focusedRecord">Registro vinculado à sua tarefa. <button onClick={()=>setTarget(null)}>Mostrar todos os registros</button></p>}
   <div className="nexusTabs" role="tablist" aria-label="Dados do Nexus">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={kind===id} onClick={()=>{setTarget(null);setKind(id)}}>{label}</button>)}</div>
   <div className="nexusToolbar"><label><Search size={17}/><input aria-label="Buscar nos registros carregados" placeholder="Buscar nos registros carregados..." value={search} onChange={e=>setSearch(e.target.value)}/></label>{kind!=='events'&&<select aria-label="Filtrar situação" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as situações</option>{statuses.map(value=><option key={value} value={value}>{status(value)}</option>)}</select>}<button disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/>{loading?'Atualizando...':'Atualizar'}</button></div>
   <p className="muted">{readAt?`Consulta: ${date(readAt)} · ${items.length} registros carregados`:'Os dados são consultados diretamente no Nexus.'}</p>
   {loading&&items.length===0?<p role="status">Carregando {tabs.find(([id])=>id===kind)?.[1].toLowerCase()}...</p>:filtered.length===0?<p className="nexusEmpty">{search?'Nenhum resultado nesta consulta.':error?'A consulta não foi concluída. Use Atualizar para tentar novamente.':'Nenhum registro disponível.'}</p>:<div role="tabpanel">{filtered.map(item=><article className="nexusRecord" key={item.id}>
    {kind==='orders'?<><div><strong>{text(item.order_number)}</strong><p>{text(item.client_name)}</p><small>{status(item.status)} · {date(item.date)}{item.delivery_date?` · Entrega: ${String(item.delivery_date).split('-').reverse().join('/')}`:''}</small>{Boolean(item.notes)&&<small>{text(item.notes)}</small>}</div><b>{money(item.total)}</b></>:kind==='clients'?<><div><strong>{text(item.trade_name||item.company_name||item.contact_name)}</strong><p>{[item.contact_name,item.city,item.state].filter(Boolean).map(text).join(' · ')}</p><small>{[item.phone,item.email].filter(Boolean).map(text).join(' · ')}</small></div><span>{status(item.registration_status)}</span></>:kind==='interests'?<><div><strong>{text(item.requested_product)}</strong><p>{text(item.client_name)} · Quantidade: {text(item.desired_quantity)}</p><small>{status(item.priority)} · {date(item.updated_at)}</small></div><span>{status(item.status)}</span></>:<div><strong>{text(item.entity_label)||status(item.entity_type)}</strong><p>{status(item.action)} · {text(item.actor_name)}</p><small>{date(item.created_at)}</small></div>}
   {kind!=='events'&&<div className="recordActions"><button onClick={()=>onTask({kind:kind as Source['kind'],id:item.id,title:text(item.order_number||item.trade_name||item.company_name||item.requested_product)})}>Criar tarefa</button>{(kind==='clients'||Boolean(item.client_id))&&<button onClick={()=>onClient(kind==='clients'?item.id:text(item.client_id))}>Ver cliente</button>}</div>}
   {connection.accessMode==='manage'&&kind!=='events'&&<button className="nexusEdit" disabled={loading} onClick={()=>startEdit(item)} aria-label={'Editar '+text(item.order_number||item.trade_name||item.company_name||item.requested_product)}><Pencil size={15}/>Editar</button>}
   </article>)}</div>}
   {cursor&&<button className="nexusMore" disabled={loading} onClick={()=>void load(cursor)}>Carregar mais</button>}
  </>}
 <dialog ref={dialog} className="nexusDialog" onCancel={e=>{e.preventDefault();if(!saving)setEditing(null)}} onClose={()=>{if(!saving)setEditing(null)}} aria-labelledby="nexus-edit-title">
 {editing&&<form onSubmit={e=>void save(e)}><div className="nexusDialogHead"><div><p className="eyebrow">EDITAR NO NEXUS</p><h2 id="nexus-edit-title">{text(editing.order_number||editing.trade_name||editing.company_name||editing.requested_product)}</h2></div><button type="button" aria-label="Fechar edição" disabled={saving} onClick={()=>setEditing(null)}><X size={20}/></button></div><p className="muted">As alterações serão aplicadas à empresa {connection?.company} e registradas no histórico.</p>
 <div className="nexusFields">{Object.entries(draft).map(([key,value])=><label key={key}>{({contact_name:'Nome do contato',phone:'Telefone',city:'Cidade',state:'UF',notes:'Observações do pedido',delivery_date:'Previsão de entrega',priority:'Prioridade',status:'Situação',desired_quantity:'Quantidade desejada'} as Record<string,string>)[key]}
 {key==='notes'?<textarea maxLength={2000} rows={4} value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>:key==='priority'||key==='status'?<select value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})}>{(key==='priority'?['BAIXA','NORMAL','ALTA']:['PENDENTE','PRODUTO_ENCONTRADO','ATENDIDO','CANCELADO']).map(v=><option key={v} value={v}>{status(v)}</option>)}</select>:<input type={key==='delivery_date'?'date':key==='desired_quantity'?'number':key==='phone'?'tel':'text'} min={key==='desired_quantity'?1:undefined} max={key==='desired_quantity'?9999999:undefined} step={key==='desired_quantity'?1:undefined} maxLength={key==='state'?2:160} value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>}
 </label>)}</div>{saveError&&<p className="nexusError" role="alert">{saveError}</p>}<div className="nexusDialogActions"><button type="button" disabled={saving} onClick={()=>setEditing(null)}>Cancelar</button><button type="submit" disabled={saving}>{saving?'Salvando...':'Salvar alterações no Nexus'}</button></div></form>}
 </dialog>
 </section>
}
