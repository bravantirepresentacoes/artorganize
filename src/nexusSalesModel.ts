export type NexusOrder={id:string;order_number:string;client_name:string;total:number|string;date:string;status:string}
export type OrderPage={connected:boolean;items?:NexusOrder[];nextCursor?:string|null;reason?:string}
export async function collectNexusOrders(read:(cursor:string|null)=>Promise<OrderPage>){
 const orders=new Map<string,NexusOrder>(),seen=new Set<string>();let cursor:string|null=null
 do{const page=await read(cursor);if(!page.connected)return {connected:false,orders:[],reason:page.reason};
 if(!Array.isArray(page.items))throw new Error('Resposta incompleta do Nexus. Tente atualizar.');
 for(const order of page.items)orders.set(order.id,order);cursor=page.nextCursor||null;
 if(cursor&&seen.has(cursor))throw new Error('Não foi possível concluir a consulta de pedidos.');if(cursor)seen.add(cursor)
 }while(cursor)
 return {connected:true,orders:[...orders.values()]}
}
export function orderDay(value:string){
 const br=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)return `${br[3]}-${br[2]}-${br[1]}`
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value
 const d=new Date(value);if(!Number.isFinite(d.getTime()))return ''
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function orderTotal(orders:NexusOrder[]){return orders.reduce((sum,o)=>{const n=Number(o.total);if(!Number.isFinite(n))throw new Error('Pedido com valor inválido no Nexus.');return sum+Math.round(n*100)},0)/100}
export function salesForPeriod(orders:NexusOrder[],today:string,period:'today'|'month'|'all'){
 return orders.filter(o=>period==='all'||(period==='today'?orderDay(o.date)===today:orderDay(o.date).slice(0,7)===today.slice(0,7)))
}
