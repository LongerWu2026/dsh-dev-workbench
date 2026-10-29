/** Optional real Chrome lifecycle test; own temporary profile and a non-sensitive marker only. */
import {build} from 'esbuild'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const root=mkdtempSync(join(tmpdir(),'workbench-web-ai-browser-'))
await build({entryPoints:[resolve('src/host/web-ai/chrome.ts')],outfile:join(root,'chrome.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {WebAIChrome}=await import(join(root,'chrome.mjs'));const dir=join(root,'profile');let browser
const wait=async fn=>{let last;for(let i=0;i<40;i++){try{return await fn()}catch(e){last=e;await new Promise(r=>setTimeout(r,500))}}throw last}
try{
 browser=new WebAIChrome(dir,{headless:true});assert.ok(browser.available());await browser.open('own-tab','kimi')
 await wait(()=>browser.evaluate('own-tab','kimi',"localStorage.setItem('workbench-test-marker-20261028','synthetic-only');({ready:true})"))
 await browser.closeTestBrowser();browser=new WebAIChrome(dir,{headless:true});await browser.open('own-tab','kimi')
 const marker=await wait(()=>browser.evaluate('own-tab','kimi',"({marker:localStorage.getItem('workbench-test-marker-20261028')})"));assert.equal(marker.marker,'synthetic-only')
 await assert.rejects(()=>browser.evaluate('unowned-tab','kimi','1'),/先打开/)
 await assert.rejects(()=>browser.open('bad-tab','kimi','https://example.org/'),/无效/)
 console.log('web-ai-browser: dedicated headless Chrome opened twice; synthetic localStorage survived; unowned targets and other origins rejected. No real accounts used.')
}finally{if(browser)await browser.closeTestBrowser();rmSync(root,{recursive:true,force:true})}
