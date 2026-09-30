import test from 'node:test'
import assert from 'node:assert/strict'
import { decrypt,encrypt,validState } from '../api/_lib/bling'

test('tokens do Bling são armazenados cifrados e recuperados sem exposição',()=>{
 process.env.BLING_CLIENT_ID='client'
 process.env.BLING_CLIENT_SECRET='secret'
 process.env.TOKEN_ENCRYPTION_KEY='uma-chave-longa-e-exclusiva-para-o-artorganiz'
 const source={access_token:'access',refresh_token:'refresh',expires_in:3600,token_type:'Bearer',expires_at:Date.now()+3600000}
 const sealed=encrypt(source)
 assert.equal(sealed.includes('access'),false)
 assert.deepEqual(decrypt(sealed),source)
 assert.equal(decrypt(sealed.slice(0,-2)+'xx'),null)
})

test('estado OAuth exige correspondência exata',()=>{
 assert.equal(validState('estado-seguro','estado-seguro'),true)
 assert.equal(validState('estado-seguro','estado-alterado'),false)
 assert.equal(validState(undefined,'estado-seguro'),false)
})
