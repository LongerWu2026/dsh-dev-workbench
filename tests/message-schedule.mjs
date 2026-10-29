import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
const home=mkdtempSync(join(tmpdir(),'workbench-hours-'));process.env.DSH_HOME=home
const OriginalDate=Date;let instant=OriginalDate.parse('2026-10-29T08:00:00+08:00')
globalThis.Date=class extends OriginalDate{constructor(...args){if(args.length)super(...args);else super(instant)}static now(){return instant}}
await build({stdin:{contents:`export * from './src/shared/message-schedule.ts';export {runAutomationTick} from './src/host/automation/scheduler.ts';export {apply} from './src/host/plugin.ts';export {loadWorkbenchState,mutateWorkbenchState} from './src/host/storage/state-store.ts';export {normalizeState} from './src/host/domain/model.ts'`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const h=await import(join(home,'host.mjs')),cleanups=[],calls=[];let checks=0
const check=(name,fn)=>{fn();checks++;console.log('✓ '+name)},time=t=>OriginalDate.parse('2026-10-29T'+t+'+08:00'),s={settings:{automation:{enabled:true,mentions:true}},syncCursors:{}}
const subprocess={resolveExecutable:async()=>'/fixture/yzj-cli',spawn(spec){const args=spec.argv.slice(1);calls.push(args);const data=args[0]==='whoami'?{orgId:'org',openId:'me',name:'本人'}:{list:[],more:false};const text=JSON.stringify({success:true,data});return{done:Promise.resolve({exitCode:0}),collected:{stdout:{readFrom:()=>({text})},stderr:{readFrom:()=>({text:''})}}}}}
const ctx={provide(){},inject(){},get:k=>k==='subprocess'?subprocess:null,effect:fn=>{const d=fn();if(typeof d==='function')cleanups.push(d)}}
try{
 check('北京时间09:00开启，21:00最后一轮，21:01关闭',()=>{assert.equal(h.messageSyncDue(s,time('08:59:59')),false);assert.equal(h.messageSyncDue(s,time('09:00:00')),true);assert.equal(h.messageSyncDue(s,time('21:00:59')),true);assert.equal(h.messageSyncDue(s,time('21:01:00')),false)})
 check('同一五分钟槽不重复，下一槽到期，与资讯60分钟间隔无关',()=>{const st={...s,lastMessageSyncAttemptAt:new OriginalDate(time('09:00:30')).toISOString(),lastAutomation:{collectedAt:new OriginalDate(time('09:00:30')).toISOString()}};assert.equal(h.messageSyncDue(st,time('09:04:59')),false);assert.equal(h.messageSyncDue(st,time('09:05:00')),true)})
 check('重启持久化尝试时间，手动同步也避免同槽重复',()=>{const st=h.normalizeState({...s,lastMessageSyncAttemptAt:new OriginalDate(time('10:00:15')).toISOString()}).state;assert.equal(h.messageSyncDue(st,time('10:04:00')),false);assert.equal(h.messageSyncDue({...s,messageInbox:{at:new OriginalDate(time('10:00:15')).toISOString()}},time('10:04:00')),false)})
 check('冷却报告不冒充实际消息快照，不吞掉本轮应执行的同步',()=>assert.equal(h.messageSyncDue({...s,lastMessageSyncAttemptAt:new OriginalDate(time('09:00:00')).toISOString(),lastMentionsFetch:{at:new OriginalDate(time('09:05:00')).toISOString()},messageInbox:{at:new OriginalDate(time('09:00:00')).toISOString()}},time('09:06:00')),true))
 check('限流冷却优先，恢复后只补当前一轮，过21点不补发',()=>{const st={...s,messageInbox:{accountId:'org:me'},syncCursors:{'__pending:org:me':{retryAt:new OriginalDate(time('09:06:00')).toISOString()}}};assert.equal(h.messageSyncDue(st,time('09:05:00')),false);assert.equal(h.messageSyncDue(st,time('09:06:00')),true);assert.equal(h.messageSyncDue(st,time('21:02:00')),false)})
 check('关闭总开关或消息开关均不自动同步；周末也按每日规则',()=>{assert.equal(h.messageSyncDue({settings:{automation:{enabled:false}}},time('12:00:00')),false);assert.equal(h.messageSyncDue({settings:{automation:{enabled:true,mentions:false}}},time('12:00:00')),false);assert.equal(h.messageSyncDue(s,OriginalDate.parse('2026-10-31T09:00:00+08:00')),true)})
 h.apply(ctx,{})
 await h.mutateWorkbenchState(st=>{st.settings.automation={enabled:true,mentions:true,radar:false,analyze:false,summarize:false,intervalMinutes:60};return st})
 await h.runAutomationTick(ctx,{automatic:true});check('08点自动完整调度也不会调用云之家，包括历史补采',()=>assert.equal(calls.length,0))
 await h.runAutomationTick(ctx);check('非工作时段手动同步仍可执行',()=>assert.ok(calls.some(a=>a.includes('recent'))))
 instant=time('09:00:00');const first=calls.length;await h.runAutomationTick(ctx,{automatic:true,resumeMentionsOnly:true});check('09点消息独立调度执行真实CLI适配的只读夹具',()=>assert.ok(calls.length>first))
 instant=time('09:04:59');const after=calls.length;await h.runAutomationTick(ctx,{automatic:true,resumeMentionsOnly:true});check('同槽重复调度不会重复请求',()=>assert.equal(calls.length,after))
 instant=time('09:05:00');await h.runAutomationTick(ctx,{automatic:true,resumeMentionsOnly:true});check('下一五分钟槽会执行且持久化，资讯间隔仍为60分钟',()=>{assert.ok(calls.length>after);assert.equal(h.loadWorkbenchState().lastMessageSyncAttemptAt,new OriginalDate(instant).toISOString());assert.equal(h.loadWorkbenchState().settings.automation.intervalMinutes,60)})
 instant=time('21:00:00');await h.runAutomationTick(ctx,{automatic:true,resumeMentionsOnly:true});const end=calls.length;instant=time('21:01:00');await h.runAutomationTick(ctx,{automatic:true});check('21点末轮执行，21:01完整调度也不能绕过工作时段',()=>assert.equal(calls.length,end))
 check('所有云之家调用都为只读',()=>assert.ok(calls.every(a=>!a.includes('send')&&!a.includes('update'))))
 console.log('message-schedule: '+checks+' scenarios passed')
}finally{cleanups.forEach(fn=>fn());globalThis.Date=OriginalDate;rmSync(home,{recursive:true,force:true})}
