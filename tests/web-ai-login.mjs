/** Temporary OAuth URLs are navigable but never saved as conversation links. No accounts or network. */
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const temporary=mkdtempSync(join(tmpdir(),'web-ai-login-'));let checks=0
try{
 await build({stdin:{contents:`export * from './src/shared/web-ai.ts';export {workbenchBrowserPolicy} from './host-integration/rc5/overlay/apps/desktop/src/workbench-browser-policy.ts';export {DesktopBrowserPersistence} from './host-integration/rc5/overlay/apps/desktop/src/browser-persistence.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(temporary,'fixture.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
 const h=await import(join(temporary,'fixture.mjs')),pool=new h.DesktopBrowserPersistence(temporary,[h.workbenchBrowserPolicy]),chatgpt=pool.resolve({namespace:h.workbenchBrowserPolicy.namespace,providerId:'chatgpt'}),kimi=pool.resolve({namespace:h.workbenchBrowserPolicy.namespace,providerId:'kimi'})
 for(const url of ['https://chatgpt.com/auth/login_with?state=synthetic-only','https://auth.openai.com/oauth/authorize?state=synthetic-only','https://accounts.google.com/v3/signin/identifier?state=synthetic-only']){
  assert.equal(h.webAINavigationUrl('chatgpt',url),url);assert.equal(chatgpt.allowsNavigation(url),true);assert.equal(h.webAIConversationUrl('chatgpt',url),null);assert.equal(kimi.allowsNavigation(url),false);assert.equal(h.webAINavigationUrl('kimi',url),null);checks++
 }
 for(const url of ['http://auth.openai.com/','https://auth.openai.com.evil.invalid/','https://auth.openai.com@evil.invalid/','https://auth.openai.com:444/','https://user:password@auth.openai.com/','https://evil.invalid/','javascript:alert(1)']){
  assert.equal(h.webAINavigationUrl('chatgpt',url),null);assert.equal(chatgpt.allowsNavigation(url),false);checks++
 }
 const state=h.normalizeWebAI({topics:[{id:'synthetic',title:'合成登录验证',conversations:{chatgpt:'https://auth.openai.com/oauth/authorize?state=DO-NOT-PERSIST'}}],rounds:[]})
 assert.equal(JSON.stringify(state).includes('DO-NOT-PERSIST'),false);assert.deepEqual(state.topics[0].conversations,{});checks++
 const denied=[],diagnosticPool=new h.DesktopBrowserPersistence(temporary,[h.workbenchBrowserPolicy],entry=>denied.push(entry)),account=diagnosticPool.resolve({namespace:h.workbenchBrowserPolicy.namespace,providerId:'chatgpt'})
 assert.equal(account.allowsNavigation('https://private-user:private-password@blocked.invalid/private-path?code=PRIVATE-CODE'),false)
 assert.deepEqual(denied[0],{providerId:'chatgpt',origin:'https://blocked.invalid',reason:'policy'})
 account.reportBlockedNavigation('https://accounts.google.com/private-path?state=PRIVATE-STATE','popup_post')
 assert.deepEqual(denied[1],{providerId:'chatgpt',origin:'https://accounts.google.com',reason:'popup_post'})
 assert.equal(/PRIVATE|private-user|private-password|private-path/.test(JSON.stringify(denied)),false);checks++
 console.log(`web-ai-login: ${checks} navigation/policy/persistence checks passed; no network or real accounts`)
}finally{rmSync(temporary,{recursive:true,force:true})}
