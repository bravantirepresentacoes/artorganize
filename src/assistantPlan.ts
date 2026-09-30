export type Plan={kind:'answer';text:string}|{kind:'action';title:string;table:string;id?:string;source?:any;values:Record<string,unknown>;summary:string}|{kind:'clarify';text:string}
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function dayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function parseDate(input:string,now=new Date()){
 const text=normalize(input),date=new Date(now);const fragments:string[]=[];let day=false,time=false
 const named=text.match(/\b(depois de amanha|amanha|hoje)\b/)
 if(named){date.setDate(date.getDate()+(named[0]==='hoje'?0:named[0]==='amanha'?1:2));fragments.push(input.slice(named.index!,named.index!+named[0].length));day=true}
 const explicit=text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/)
 if(explicit){const y=Number(explicit[3]||date.getFullYear()),m=Number(explicit[2])-1,d=Number(explicit[1]);const next=new Date(y,m,d);if(next.getMonth()!==m||next.getDate()!==d)return null;date.setFullYear(y,m,d);fragments.push(explicit[0]);day=true}
 const hour=text.match(/(?:\bas?\s+)(\d{1,2})(?:(?::|h)(\d{2}))?\s*h?\b/)||text.match(/\b(\d{1,2})h(?:(\d{2}))?\b/)
 if(hour){const h=Number(hour[1]),m=Number(hour[2]||0);if(h>23||m>59)return null;date.setHours(h,m,0,0);fragments.push(input.slice(hour.index!,hour.index!+hour[0].length));time=true}
 if(!day){const names=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];const week=text.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/);if(week){let add=(names.indexOf(week[1])-now.getDay()+7)%7;if(add===0&&(!time||date<=now))add=7;date.setFullYear(now.getFullYear(),now.getMonth(),now.getDate()+add);fragments.push(input.slice(week.index!,week.index!+week[0].length));day=true}}
 if(!day&&!time)return null
 if(day&&!time)date.setHours(9,0,0,0)
 if(!day&&time&&date<=now)date.setDate(date.getDate()+1)
 return {iso:date.toISOString(),fragments}
}
function clean(input:string,fragments:string[]=[]){let out=input;for(const f of fragments)out=out.replace(f,' ');return out.replace(/\s+/g,' ').replace(/^[\s:,-]+|[\s:,-]+$/g,'').trim()}
function unique(list:any[],query:string,label:string){const q=normalize(query);const exact=list.filter(x=>normalize(x[label])===q);const matches=exact.length?exact:list.filter(x=>normalize(x[label]).includes(q));return matches.length===1?matches[0]:null}
export function planAssistant(input:string,data:any,now=new Date()):Plan{
 const raw=input.trim(),q=normalize(raw),date=parseDate(raw,now),answer=(text:string):Plan=>({kind:'answer',text}),clarify=(text:string):Plan=>({kind:'clarify',text})
 const action=(title:string,table:string,values:Record<string,unknown>,id?:string,source?:any):Plan=>({kind:'action',title,table,values,id,source,summary:id?'Confira os campos. A alteração só será salva quando você confirmar.':'Confira os campos. O registro só será criado quando você confirmar.'})
 if(/^(quais|quem|quantos|mostrar|ver|clientes|retornos)/.test(q)&&/(cliente|contato|retorno)/.test(q)){
  const local=data.contacts.filter((c:any)=>c.next_contact_at&&new Date(c.next_contact_at)<=now).map((c:any)=>c.name),remote=data.nexus.filter((n:any)=>n.kind==='clients').map((n:any)=>n.title),names=[...local,...remote]
  return answer(names.length?`Você tem ${names.length} retornos pendentes: ${names.join(' · ')}. Abra a Central de pendências para acompanhar.`:'Nenhum retorno pendente nos dados carregados. Você pode agendar retornos na página de cada cliente.')
 }
 if(/^(quais|quantas|mostrar|ver)/.test(q)&&/(tarefa|pendente|atrasad)/.test(q)){const list=data.tasks.filter((t:any)=>t.status!=='done'&&(!q.includes('atrasad')||t.due_at&&new Date(t.due_at)<now));return answer(list.length?`${list.length} tarefas: ${list.map((t:any)=>t.title).join(' · ')}`:'Nenhuma tarefa nessa condição.')}
 if(/(quanto|total|faturei|vendi).*(hoje|mes|vendas|fatur)/.test(q)){const today=dayKey(now),list=data.sales.filter((s:any)=>q.includes('hoje')?s.sold_at===today:q.includes('mes')?s.sold_at.startsWith(today.slice(0,7)):true),value=list.reduce((sum:number,s:any)=>sum+Number(s.amount),0);return answer(`Vendas registradas: ${value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}, em ${list.length} lançamentos.`)}
 if(/^(agenda|compromissos|o que tenho)/.test(q)){const d=new Date(now);if(q.includes('amanha'))d.setDate(d.getDate()+1);const list=data.events.filter((e:any)=>dayKey(new Date(e.starts_at))===dayKey(d));return answer(list.length?list.map((e:any)=>`${new Date(e.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${e.title}`).join('\n'):'Nenhum compromisso nesse dia.')}
 if(/^(concluir|finalizar|adiar|reagendar)\s+/.test(q)){
  const m=raw.match(/^(concluir|finalizar|adiar|reagendar)\s+(?:a\s+|o\s+)?(tarefa|lembrete)\s+(.+)$/i);if(!m)return clarify('Informe o tipo e o nome: concluir tarefa ligar para João.')
  const type=m[2].toLowerCase(),name=clean(m[3],date?.fragments),list=type==='tarefa'?data.tasks:data.reminders,found=unique(list,name,'title');if(!found)return clarify('Não encontrei um registro único com esse nome. Escreva o título completo.')
  const finish=/concluir|finalizar/i.test(m[1]);if(!finish&&!date)return clarify('Qual será o novo prazo? Inclua a data e o horário.')
  const values=type==='tarefa'?{title:found.title,status:finish?'done':found.status,priority:found.priority,due_at:finish?found.due_at:date!.iso}:{title:found.title,done:finish,remind_at:finish?found.remind_at:date!.iso}
  return action(finish?'Concluir '+type:'Reagendar '+type,type==='tarefa'?'tasks':'reminders',values,found.id,found)
 }
 if(/^(tarefa|criar tarefa|adicionar tarefa)\b/.test(q)){const title=clean(raw.replace(/^(criar |adicionar )?tarefa\s*/i,'').replace(/\b(urgente|alta prioridade|baixa prioridade)\b/gi,''),date?.fragments);if(!title)return clarify('Qual tarefa você quer criar?');return action('Criar tarefa','tasks',{title,priority:/urgente|alta prioridade/.test(q)?'high':q.includes('baixa prioridade')?'low':'normal',due_at:date?.iso||null})}
 if(/^(lembrete|lembrar|me lembre|lembra)\b/.test(q)){if(!date)return clarify('Inclua uma data ou horário. Ex.: me lembre amanhã às 9 de ligar para João.');const title=clean(raw.replace(/^(lembrete|lembrar|me lembre|lembra)(\s+de)?\s*/i,''),date.fragments).replace(/^de\s+/i,'');if(!title)return clarify('O que você quer lembrar?');return action('Criar lembrete','reminders',{title,remind_at:date.iso})}
 if(/^(agendar|marcar|compromisso)\b/.test(q)){if(!date)return clarify('Inclua a data e o horário do compromisso.');const title=clean(raw.replace(/^(agendar|marcar|compromisso)\s*/i,''),date.fragments);if(!title)return clarify('Qual será o compromisso?');return action('Agendar compromisso','calendar_events',{title,starts_at:date.iso,ends_at:null,notes:''})}
 if(/^(nota|criar nota|adicionar nota)\b/.test(q)){const content=raw.replace(/^(criar |adicionar )?nota\s*[:-]?\s*/i,'').trim();if(!content)return clarify('Qual anotação deseja salvar?');return action('Criar nota','notes',{title:content.slice(0,60),content})}
 if(/^(retornar|retorno|ligar para|contatar)\b/.test(q)){if(!date)return clarify('Inclua a data e o horário do retorno.');const name=clean(raw.replace(/^(retornar|retorno|ligar para|contatar)\s*/i,''),date.fragments),found=unique(data.contacts,name,'name');if(!found)return clarify('Não encontrei um contato único. Use o nome completo ou abra a página do cliente Nexus para agendar o retorno.');return action('Agendar retorno','contacts',{name:found.name,next_contact_at:date.iso},found.id)}
 if(/^(venda|registrar venda|vendi)\b/.test(q)){const m=raw.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);if(!m)return clarify('Informe o valor da venda. Ex.: venda 350,50 para Loja Silva - climatizador.');const amount=Number(m[1].includes(',')?m[1].replaceAll('.','').replace(',','.'):m[1]);if(!Number.isFinite(amount)||amount<=0)return clarify('Informe um valor positivo.');let description=raw.replace(/^(registrar venda|venda|vendi)\s*/i,'').replace(m[0],'').trim();const customer=description.match(/^para\s+(.+?)(?:\s+-\s+|$)/i);if(customer)description=description.replace(customer[0],'');return action('Registrar venda','sales',{customer:customer?.[1]||'',description:description||'Venda',amount,sold_at:dayKey(now),notes:''})}
 if(/meu dia|prioridades|o que fazer/.test(q))return answer(`Comece pela Central de pendências: ${data.tasks.filter((t:any)=>t.status!=='done').length} tarefas abertas e ${data.nexus.length} itens do Nexus nos dados carregados.`)
 return action('Salvar na Caixa rápida','inbox',{content:raw})
}
