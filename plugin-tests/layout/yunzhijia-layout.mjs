/** Connector states in isolated Chrome, without accessing enterprise accounts. */
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {build} from '../../node_modules/esbuild/lib/main.js'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const base=dirname(fileURLToPath(import.meta.url)),out='/tmp/workbench-yzj-layout'
mkdirSync(out,{recursive:true})
const built=await build({entryPoints:[resolve(base,'fixture.jsx')],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'})
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[],report=[]
page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort())
try{
    await page.setContent('<html><head><style>html,body,#app{margin:0;width:100%;height:100%;font-family:system-ui}html{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee;--dsw-alias-label-primary:#20242b;--dsw-alias-label-secondary:#666;--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#aaa;--dsw-alias-brand-primary:#356fee;--dsw-alias-state-error-primary:#d22;--dsw-alias-state-warn-primary:#b60;--dsw-alias-state-success-primary:#080}</style></head><body><div id="app"></div></body></html>')
    await page.addScriptTag({content:built.outputFiles[0].text});await page.addScriptTag({content:readFileSync(resolve(base,'../../client.js'),'utf8')});await page.evaluate(()=>window.mountWorkbench());await page.locator('.wb-root').waitFor()
    await page.evaluate(()=>{
        const original=window.WB.rpc
        window.WB.rpc=(method,args,signal)=>method==='workbench/yunzhijiaStatus'?Promise.resolve(window.connectorFixture):method==='workbench/yunzhijiaSetup'?Promise.resolve(window.connectorFixture.operation):original(method,args,signal)
    })
    for(const width of [360,560,800])for(const state of ['missing','installing','unauthorized','login','ok','error']){
        await page.setViewportSize({width,height:650})
        await page.evaluate(()=>window.WB.go('dashboard'))
        await page.getByLabel('云之家连接').waitFor({state:'detached'})
        await page.evaluate(state=>{
            window.connectorFixture={connector:{id:'yunzhijia',installed:!['missing','installing'].includes(state),authState:['missing','installing'].includes(state)?'unconfigured':state==='login'?'unauthorized':state,note:'连接状态布局验证：安装和登录完成后自动重新检测。'},operation:state==='installing'?{kind:'install',status:'running',note:'正在安装云之家 CLI…'}:state==='login'?{kind:'login',status:'running',note:'请在浏览器完成登录授权…'}:null}
            window.WB.store.set({data:{...window.WB.store.get().data,connectors:[window.connectorFixture.connector]}})
            window.WB.go('settings')
        },state)
        const section=page.getByLabel('云之家连接')
        await section.waitFor()
        if(state==='installing')await section.getByRole('button',{name:'安装',exact:true}).click()
        if(state==='login')await section.getByRole('button',{name:'登录授权',exact:true}).click()
        await section.getByText('同步云之家消息与文档，安装时获取最新版 CLI。',{exact:true}).waitFor()
        if(state==='missing')await section.getByRole('button',{name:'安装',exact:true}).waitFor()
        if(state==='installing')assert.equal(await section.getByRole('button',{name:'安装中…',exact:true}).isDisabled(),true)
        if(state==='unauthorized')await section.getByRole('button',{name:'登录授权',exact:true}).waitFor()
        if(state==='login')assert.equal(await section.getByRole('button',{name:'等待登录…',exact:true}).isDisabled(),true)
        if(state==='ok')await section.getByText('已连接',{exact:true}).waitFor()
        if(!['missing','installing'].includes(state))await section.getByRole('button',{name:'重新安装',exact:true}).waitFor()
        const geometry=await section.evaluate(el=>{const r=el.getBoundingClientRect(),title=el.querySelector('.wb-item-title').getBoundingClientRect(),actions=el.querySelector('button').getBoundingClientRect();return{overflow:el.scrollWidth-el.clientWidth,inline:Math.abs(title.top-actions.top)<8,clipped:[...el.querySelectorAll('button')].some(button=>{const b=button.getBoundingClientRect();return b.left<r.left-2||b.right>r.right+2})}})
        assert.ok(geometry.overflow<=2&&!geometry.clipped,JSON.stringify({width,state,...geometry}));if(width>=560)assert.equal(geometry.inline,true,JSON.stringify({width,state,...geometry}));report.push({width,state,...geometry})
        if(width===360||state==='missing')await section.screenshot({path:resolve(out,`${width}-${state}.png`)})
    }
    assert.deepEqual(errors,[]);writeFileSync(resolve(out,'report.json'),JSON.stringify({cases:report.length,errors,report},null,2));console.log('yunzhijia layout: '+report.length+' states passed; '+out)
}finally{await browser.close()}
