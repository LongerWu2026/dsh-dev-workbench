/** Fresh-install fetch behavior: isolated state and deterministic Host services only. */
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const home=mkdtempSync(join(tmpdir(),'workbench-news-first-'));process.env.DSH_HOME=home
const {apply}=await import('../index.js');let api,web=null,modelCalls=0,checks=0;const disposers=[]
const ctx={provide(name,value){if(name==='workbench')api=value},inject(){},effect(fn){const off=fn();if(typeof off==='function')disposers.push(off)},get(name){if(name==='web')return web;if(name==='sessionController')return {create(){modelCalls++;throw Error('Fetching must not create an AI conversation')},prompt(){modelCalls++;throw Error('Fetching must not invoke a model')}}}}
apply(ctx)
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)}
try{
 let state=await api.snapshot();check('全新安装没有资讯，AI默认关闭',()=>{assert.equal(state.radar.length,0);assert.equal(state.settings.aiExtract.enabled,false)})
 state=await api.fetchRadar();check('没有宿主联网服务时保留原因，而非伪造新增',()=>{assert.equal(state.radar.length,0);assert.match(state.lastRadarFetch.note,/没有 web.*搜索服务/);assert.equal(state.lastRadarFetch.added,0)})
 web={search:async()=>{throw Object.assign(new Error('no usable web provider is registered'),{code:'WEB_PROVIDER_UNAVAILABLE'})}}
 state=await api.fetchRadar();check('没有可用搜索提供方时逐项记录可操作的配置说明',()=>{assert.ok(state.lastRadarFetch.perFeed.length);assert.ok(state.lastRadarFetch.perFeed.every(row=>row.status==='error'&&row.note.includes('配置并授权搜索服务')));assert.equal(state.radar.length,0)})
 web={search:async()=>({answer:'只有回答，没有来源结构'})}
 state=await api.fetchRadar();check('无效来源结构不能伪装成查询成功且无新增',()=>assert.ok(state.lastRadarFetch.perFeed.every(row=>row.status==='error'&&row.note.includes('未返回有效'))))
 web={search:async()=>({sources:[]})}
 state=await api.fetchRadar();check('真实空结果与接口错误区分',()=>assert.ok(state.lastRadarFetch.perFeed.every(row=>row.status==='empty'&&row.note.includes('未返回资讯来源'))))
 web={search:async()=>({sources:[{title:'AI Agent new model release',url:'https://example.org/new-ai-model',snippet:'AI model release for agent development',publishedAt:new Date().toISOString()}]})}
 state=await api.fetchRadar();check('无需AI开关即可真实采集资讯并落盘',()=>{assert.equal(state.radar.length,1);assert.equal(state.lastRadarFetch.added,1);assert.equal(state.settings.aiExtract.enabled,false)})
 state=await api.fetchRadar();check('重复获取无新增时解释去重结果',()=>{assert.equal(state.radar.length,1);assert.equal(state.lastRadarFetch.added,0);assert.ok(state.lastRadarFetch.perFeed.some(row=>row.note.includes('重复或不符合筛选条件')))})
 check('获取资讯不自动创建AI会话或调用模型',()=>assert.equal(modelCalls,0))
 console.log('news-first-use: '+checks+' scenarios passed')
}finally{disposers.reverse().forEach(off=>off());rmSync(home,{recursive:true,force:true})}
