import test from 'node:test'
import assert from 'node:assert/strict'
import { collectNexusOrders, orderDay, orderTotal, salesForPeriod } from '../src/nexusSalesModel.ts'
const order=(id:string,date='2026-09-20',total:number|string=0.1)=>({id,date,total,order_number:id,client_name:'Cliente',status:'PEDIDO_RECEBIDO'})
test('consulta todas as páginas e remove duplicatas por ID',async()=>{
 const cursors:(string|null)[]=[];const result=await collectNexusOrders(async cursor=>{cursors.push(cursor);return cursor?{connected:true,items:[order('199'),order('200','2026-09-20',5)],nextCursor:null}:{connected:true,items:Array.from({length:200},(_,i)=>order(String(i))),nextCursor:'199'}})
 assert.deepEqual(cursors,[null,'199']);assert.equal(result.orders.length,201);assert.equal(orderTotal(result.orders),25)
})
test('falha posterior não retorna total parcial e desconexão descarta páginas',async()=>{
 await assert.rejects(collectNexusOrders(async cursor=>{if(cursor)throw new Error('offline');return {connected:true,items:[order('1')],nextCursor:'1'}}),/offline/)
 const result=await collectNexusOrders(async cursor=>cursor?{connected:false}:{connected:true,items:[order('1')],nextCursor:'1'});assert.equal(result.connected,false);assert.deepEqual(result.orders,[])
 await assert.rejects(collectNexusOrders(async()=>({connected:true,items:[],nextCursor:'loop'})),/concluir/)
})
test('separa hoje, mês, ano e histórico e soma centavos',()=>{
 const data=[order('1'),order('2','2026-09-01',0.2),order('3','2026-08-31',30),order('4','2025-09-20',40),order('5','20/09/2026',2)]
 assert.equal(orderTotal(salesForPeriod(data,'2026-09-20','month')),2.3);assert.equal(orderTotal(salesForPeriod(data,'2026-09-20','today')),2.1);assert.equal(salesForPeriod(data,'2026-09-20','all').length,5)
 assert.equal(orderDay('2026-09-01'),'2026-09-01');assert.equal(orderDay('inválida'),'');assert.throws(()=>orderTotal([order('x','2026-09-20','inválido')]))
})
