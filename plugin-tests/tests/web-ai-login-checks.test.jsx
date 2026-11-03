import {afterEach,describe,it,expect,vi} from 'vitest'
import {checkWebsiteLogin} from '../../src/client/features/web-ai/login-checks.ts'
afterEach(()=>vi.useRealTimers())
describe('每家官网登录检查有独立的结果和期限',()=>{
 it('直接返回真实结果，不依赖网页状态回调',async()=>{
  const result=await checkWebsiteLogin(async()=>({authentication:async()=>({status:'authenticated',email:'PRIVATE',token:'PRIVATE'})}))
  expect(result.status).toBe('authenticated');expect(JSON.stringify(result)).not.toContain('PRIVATE')
 })
 it.each(['controller','authentication'])('%s 永不返回也按期收尾',async phase=>{
  vi.useFakeTimers();const never=new Promise(()=>{}),get=()=>phase==='controller'?never:Promise.resolve({authentication:()=>never})
  const promise=checkWebsiteLogin(get,{timeoutMs:12000});await vi.advanceTimersByTimeAsync(12000);expect((await promise).status).toBe('unknown');expect(vi.getTimerCount()).toBe(0)
 })
 it('一站超时不阻塞其他厂商，超时后的迟到结果不会再次运行',async()=>{
  vi.useFakeTimers();let finish;const late=new Promise(resolve=>{finish=resolve}),probe=vi.fn(()=>late)
  const slow=checkWebsiteLogin(async()=>({authentication:probe}),{timeoutMs:12000}),fast=checkWebsiteLogin(async()=>({authentication:async()=>({status:'authenticated'})}),{timeoutMs:12000})
  expect((await fast).status).toBe('authenticated');await vi.advanceTimersByTimeAsync(12000);expect((await slow).status).toBe('unknown');finish({status:'authenticated'});await vi.advanceTimersByTimeAsync(20000);expect(probe).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0)
 })
 it('页面稍后就绪可以恢复，显式未登录和安全验证不被改成已登录',async()=>{
  vi.useFakeTimers();const probe=vi.fn().mockResolvedValueOnce({status:'unknown'}).mockResolvedValue({status:'authenticated'})
  const promise=checkWebsiteLogin(async()=>({authentication:probe}));await vi.advanceTimersByTimeAsync(1000);expect((await promise).status).toBe('authenticated')
  for(const status of ['needs_login','verification'])expect((await checkWebsiteLogin(async()=>({authentication:async()=>({status})}))).status).toBe(status)
 })
})
