import { ApiRequest,ApiResponse,STATE_COOKIE,TOKEN_COOKIE,clear } from '../_lib/bling.js'
export default function handler(req:ApiRequest,res:ApiResponse){if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});res.setHeader('Set-Cookie',[clear(TOKEN_COOKIE),clear(STATE_COOKIE)]);return res.status(200).json({ok:true})}
