import React from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {WB} from '../../src/client/core/runtime.ts'
import {WebAIPage} from '../../src/client/features/web-ai/WebAIPage.tsx'

const fixtures=vi.hoisted(()=>({probes:new Map()}))
vi.mock('../../src/client/features/web-ai/NativeWebsite.tsx',async()=>{
 const React=await import('react')
 return {nativeWebAIBridge:()=>({protocolVersion:1}),NativeWebsite:({providerId,onController})=>{
  React.useEffect(()=>{onController({authentication:fixtures.probes.get(providerId)});return()=>onController(null)},[providerId])
  return null
 }}
})
afterEach(()=>{cleanup();fixtures.probes.clear();vi.restoreAllMocks();vi.useRealTimers()})
describe('厂商菜单的登录结果回填',()=>{
 it('四家不发送回调也分别显示已登录，另一家挂起不让检查永久占用',async()=>{
  vi.useFakeTimers()
  for(const id of ['glm','doubao','yuanbao','qianwen'])fixtures.probes.set(id,vi.fn(async()=>({status:'authenticated'})))
  fixtures.probes.set('kimi',()=>new Promise(()=>{}))
  WB.store.set({data:{},status:'ready'})
  vi.spyOn(WB,'rpc').mockResolvedValue({state:{topics:[],rounds:[],chatgptEnabled:false},capabilities:{storageScope:'login-picker-fixture'}})
  const view=render(<WebAIPage/>);await act(async()=>{})
  const picker=view.container.querySelector('.wb-chat-provider-picker')
  await act(async()=>{picker.open=true;fireEvent(picker,new Event('toggle'))})
  await act(async()=>{await vi.advanceTimersByTimeAsync(100)})
  for(const name of ['智谱清言','豆包','元宝','千问'])expect(screen.getByLabelText(name+' 登录检查').textContent).toBe('已登录')
  expect(screen.getByLabelText('Kimi 登录检查').textContent).toBe('检查中…')
  await act(async()=>{await vi.advanceTimersByTimeAsync(12000)})
  expect(screen.getByLabelText('Kimi 登录检查').textContent).toBe('未确认')
  expect(view.container.textContent).not.toContain('检查中…')
  expect(fixtures.probes.get('glm')).toHaveBeenCalledTimes(1)
 })
})
