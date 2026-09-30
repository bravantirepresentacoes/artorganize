import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const BLING_AUTHORIZE_URL='https://www.bling.com.br/Api/v3/oauth/authorize'
export const BLING_TOKEN_URL='https://www.bling.com.br/Api/v3/oauth/token'
export const BLING_API_URL='https://www.bling.com.br/Api/v3'
export const TOKEN_COOKIE='artorganiz_bling'
export const STATE_COOKIE='artorganiz_bling_state'

type Tokens={access_token:string;refresh_token:string;expires_in:number;token_type:string;scope?:string;expires_at:number}
export type ApiRequest={method?:string;headers:Record<string,string|string[]|undefined>;query:Record<string,string|string[]|undefined>}
export type ApiResponse={status:(code:number)=>ApiResponse;json:(body:unknown)=>void;redirect:(code:number,url:string)=>void;setHeader:(name:string,value:string|string[])=>void}

export function appUrl(){return(process.env.PUBLIC_APP_URL||'https://artorganiz-app.vercel.app').replace(/\/$/,'')}
export function configured(){return Boolean(process.env.BLING_CLIENT_ID&&process.env.BLING_CLIENT_SECRET&&process.env.TOKEN_ENCRYPTION_KEY)}
function config(){if(!configured())throw Error('BLING_NOT_CONFIGURED');return{clientId:process.env.BLING_CLIENT_ID!,clientSecret:process.env.BLING_CLIENT_SECRET!}}
function key(){return createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY||'').digest()}
export function encrypt(value:Tokens){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv),body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url')}
export function decrypt(value?:string):Tokens|null{if(!value||!configured())return null;try{const payload=Buffer.from(value,'base64url'),iv=payload.subarray(0,12),tag=payload.subarray(12,28),body=payload.subarray(28),decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'))}catch{return null}}
export function cookies(req:ApiRequest){const raw=req.headers.cookie,source=Array.isArray(raw)?raw.join(';'):raw||'';return Object.fromEntries(source.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return[decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))]}))}
export function cookie(name:string,value:string,maxAge:number){return`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clear(name:string){return`${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value}
export function validState(a?:string,b?:string){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function auth(){const{clientId,clientSecret}=config();return`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`}
async function token(body:URLSearchParams){const response=await fetch(BLING_TOKEN_URL,{method:'POST',headers:{Authorization:auth(),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body}),json=await response.json().catch(()=>({}));if(!response.ok)throw Error(`BLING_TOKEN_${response.status}`);const result=json as Omit<Tokens,'expires_at'>;return{...result,expires_at:Date.now()+Math.max(60,result.expires_in-60)*1000}}
export function exchange(code:string){return token(new URLSearchParams({grant_type:'authorization_code',code}))}
export function renew(refresh_token:string){return token(new URLSearchParams({grant_type:'refresh_token',refresh_token}))}
export async function validTokens(tokens:Tokens){if(tokens.expires_at>Date.now())return{tokens,refreshed:false};return{tokens:await renew(tokens.refresh_token),refreshed:true}}
export async function get(tokens:Tokens,path:string){const response=await fetch(BLING_API_URL+path,{headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json'}}),json=await response.json().catch(()=>({}));if(!response.ok)throw Error(`BLING_API_${response.status}`);return json as{data?:unknown[]}}
