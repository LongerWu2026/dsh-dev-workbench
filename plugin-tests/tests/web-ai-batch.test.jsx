import {describe,it,expect} from 'vitest'
import {runWebsiteBatch,persistWebAIState} from '../../src/client/features/web-ai/batch.ts'

const rounds=['一问','二问'].map((question,i)=>({id:'round-'+i,requestId:'batch',topicId:'topic',question,createdAt:'2026-10-29T00:00:00Z',answers:[]}))
describe('多官网批量追问调度',()=>{
 it('最多两个厂商并发，同厂商下一问必须晚于上一答完成且复用控制器',async()=>{
  const signal=new AbortController().signal,events=[],controllers=new Map();let active=0,max=0
  const vendors=['kimi','glm','qianwen','chatgpt']
  await runWebsiteBatch(rounds,vendors,{
   claim:async(r,p)=>({executionId:r.id+p}),update:async()=>{},
   open:async(r,p)=>{if(!controllers.has(p))controllers.set(p,{p});return controllers.get(p)},
   run:async(c,q,id,update)=>{if(q==='二问')expect(events).toContain(c.p+':一问:done');events.push(c.p+':'+q+':send');active++;max=Math.max(max,active);await Promise.resolve();await update({status:'generating'});await Promise.resolve();await update({status:'completed',text:'完整正文'});events.push(c.p+':'+q+':done');active--},
  },signal)
  expect(max).toBe(2);expect(controllers.size).toBe(4);for(const p of vendors)expect(events.filter(e=>e.startsWith(p)&&e.endsWith('send'))).toEqual([p+':一问:send',p+':二问:send'])
 })
 it('一家的首问需要核对时不发送它的第二问，其他厂商仍可完成',async()=>{
  const sent=[],updates=[]
  await runWebsiteBatch(rounds,['kimi','glm'],{claim:async(r,p)=>({executionId:r.id+p}),update:async(r,p,_id,patch)=>updates.push({r:r.id,p,...patch}),open:async(_r,p)=>({p}),run:async(c,q,_id,update)=>{sent.push(c.p+q);await update({status:c.p==='kimi'?'uncertain':'completed',text:'正文'})}},new AbortController().signal)
  expect(sent).toEqual(expect.arrayContaining(['kimi一问','glm一问','glm二问']));expect(sent).not.toContain('kimi二问');expect(updates.find(u=>u.p==='kimi'&&u.r==='round-1').note).toContain('未发送')
 })
 it('取消后不发送后续问题，也不打开队列中尚未启动的厂商',async()=>{
  const abort=new AbortController(),sent=[]
  await runWebsiteBatch(rounds,['kimi','glm','qianwen'],{claim:async(r,p)=>({executionId:r.id+p}),update:async()=>{},open:async(_r,p)=>({p}),run:async(c,q,_id,update)=>{sent.push(c.p+q);abort.abort();await update({status:'completed',text:'正文'})}},abort.signal)
  expect(sent.every(s=>s.endsWith('一问'))).toBe(true);expect(sent).not.toContain('qianwen一问')
 })
})

describe('采集状态回写的有限恢复',()=>{
 it('临时网络失败仅重试相同的状态回写，不重新执行网页发送',async()=>{
  let calls=0;const pauses=[];const result=await persistWebAIState(async()=>{if(++calls<3)throw new TypeError('Failed to fetch');return 'saved'},new AbortController().signal,async ms=>pauses.push(ms));expect(result).toBe('saved');expect(calls).toBe(3);expect(pauses).toEqual([300,600])
 })
 it('业务错误不重试；等待期间取消后不再回写',async()=>{
  let calls=0;await expect(persistWebAIState(async()=>{calls++;throw new Error('执行租约不匹配')},new AbortController().signal,async()=>{})).rejects.toThrow('租约');expect(calls).toBe(1)
  const abort=new AbortController();calls=0;await expect(persistWebAIState(async()=>{calls++;throw new TypeError('Failed to fetch')},abort.signal,async()=>abort.abort())).rejects.toThrow('已停止采集');expect(calls).toBe(1)
 })
})
