import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,screen} from '@testing-library/react'
import {useStreamingText} from '../../src/client/features/web-ai/useStreamingText.ts'
import {MessageContent} from '../../src/client/features/web-ai/MessageContent.tsx'
import {webAIPageScript} from '../../src/shared/web-ai-page.ts'
import {JSDOM} from 'jsdom'

afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
function Stream({id='a',text='',streaming=true,visible=true}){return <output>{useStreamingText(id,text,streaming,visible)}</output>}
const value=()=>screen.getByRole('status').textContent
const advance=ms=>act(()=>vi.advanceTimersByTime(ms))
describe('增量流式展示',()=>{
 it('只播放新内容，按Unicode字符推进，完成后准确收齐',()=>{
  vi.useFakeTimers();const view=render(<Stream/>)
  view.rerender(<Stream text={'你好😀世界'.repeat(8)}/>);expect(value()).toBe('');advance(32)
  expect(value().length).toBeGreaterThan(0);expect(value().length).toBeLessThan(48);expect(value()).not.toMatch(/[\uD800-\uDBFF]$/)
  view.rerender(<Stream text={'你好😀世界'.repeat(8)+' END'} streaming={false}/>);advance(600)
  expect(value()).toBe('你好😀世界'.repeat(8)+' END')
 })
 it('官网重排正文以最新内容为准，不重复拼接或残留旧后缀',()=>{
  vi.useFakeTimers();const view=render(<Stream text="初始"/>);view.rerender(<Stream text="初始新增内容"/>);advance(32)
  view.rerender(<Stream text="官网修订后的段落"/>);expect(value()).toBe('官网修订后的段落');advance(1000);expect(value()).toBe('官网修订后的段落')
 })
 it('切换厂商或会话立即展示对应历史，旧动画取消',()=>{
  vi.useFakeTimers();const view=render(<Stream/>);view.rerender(<Stream text="尚在播放的一大段回答"/>);advance(32)
  view.rerender(<Stream id="glm" text="智谱已有回答"/>);expect(value()).toBe('智谱已有回答');advance(1000);expect(value()).toBe('智谱已有回答')
  view.rerender(<Stream id="other-topic" text="另一会话的内容" streaming={false}/>);expect(value()).toBe('另一会话的内容')
 })
 it('长块追赶不积压数秒，完整历史不播放打字动画',()=>{
  vi.useFakeTimers();const view=render(<Stream/>),text='长'.repeat(60000)
  view.rerender(<Stream text={text}/>);advance(1800);expect(value()).toBe(text)
  view.rerender(<Stream id="history" text="完整历史" streaming={false}/>);expect(value()).toBe('完整历史')
 })
 it('减少动态效果和隐藏面板直接展示完整内容',()=>{
  vi.useFakeTimers();vi.stubGlobal('matchMedia',()=>({matches:true}));const view=render(<Stream/>);view.rerender(<Stream text="无动画回答"/>);expect(value()).toBe('无动画回答')
  vi.stubGlobal('matchMedia',()=>({matches:false}));view.rerender(<Stream text="隐藏面板的完整新回答" visible={false}/>);expect(value()).toBe('隐藏面板的完整新回答')
 })
 it('卸载清理所有动画定时器',()=>{
  vi.useFakeTimers();const view=render(<Stream/>);view.rerender(<Stream text="待展示内容"/>);expect(vi.getTimerCount()).toBeGreaterThan(0);view.unmount();expect(vi.getTimerCount()).toBe(0)
 })
})
describe('Markdown回答渲染',()=>{
 it('表格保留列和对齐，转义竖线不拆成多列',()=>{
  const view=render(<MessageContent text={'| 名称 | 说明 |\n| :--- | ---: |\n| A | foo\\|bar |'}/>),table=screen.getByRole('table')
  expect(table.querySelectorAll('th')).toHaveLength(2);expect(screen.getByRole('cell',{name:'foo|bar'})).toBeTruthy();expect(table.querySelector('td:last-child').style.textAlign).toBe('right');expect(view.container.querySelector('.wb-chat-table')).toBeTruthy()
 })
 it('有序起始值、嵌套列表、引用、粗斜体和删除线正常显示',()=>{
  const view=render(<MessageContent text={'3. **第三项**\n   - 嵌套 *内容*\n4. 第四项\n\n> 引用\n>\n> 第二段 ~~作废~~'}/> )
  expect(view.container.querySelector('ol').start).toBe(3);expect(view.container.querySelector('ol ul')).toBeTruthy();expect(view.container.querySelector('strong').textContent).toBe('第三项');expect(view.container.querySelector('em').textContent).toBe('内容');expect(view.container.querySelector('blockquote s').textContent).toBe('作废')
 })
 it('带语言标记和未闭合代码围栏在流式阶段也保留空白缩进',()=>{
  const view=render(<MessageContent text={'```c++\nint f() {\n    return 42;'}/> )
  expect(screen.getByText('c++')).toBeTruthy();expect(view.container.querySelector('pre code').textContent).toBe('int f() {\n    return 42;')
  view.rerender(<MessageContent text={'```c++\nint f() {\n    return 42;\n}\n```\n\n完成'}/>);expect(view.container.querySelector('pre code').textContent).toContain('    return 42;');expect(screen.getByText('完成')).toBeTruthy()
 })
 it('HTML、事件属性、图片和危险链接都不作为网页执行或加载',()=>{
  const view=render(<MessageContent text={'<img src=x onerror="alert(1)">\n\n![图](https://example.org/private.png)\n\n[危险](javascript:alert(1)) [凭据](https://user:pass@example.org/) [引用](https://example.org/ref)'}/> )
  expect(view.container.querySelector('img')).toBeNull();expect(view.container.querySelectorAll('a')).toHaveLength(1);expect(screen.getByRole('link',{name:'引用'}).href).toBe('https://example.org/ref');expect(view.container.textContent).toContain('<img src=x onerror="alert(1)">')
 })
 it('网页语义采集→Markdown→展示保留表格、加粗、引用和嵌套列表',()=>{
  const dom=new JSDOM('<textarea></textarea><div class="segment-assistant" data-streaming="false"><div class="markdown"><h2>方案</h2><p><strong>重点</strong>与<em>说明</em></p><blockquote><p>原文依据</p></blockquote><ol start="3"><li>主项<ul><li>子项</li></ul></li><li>下一项</li></ol><table><thead><tr><th>模型</th><th>备注</th></tr></thead><tbody><tr><td>Kimi</td><td>甲|乙</td></tr></tbody></table><pre><code>```\n    42</code></pre></div></div>',{url:'https://kimi.com/',runScripts:'outside-only'})
  dom.window.Element.prototype.getClientRects=()=>[{}]
  try{
   const snapshot=dom.window.eval(webAIPageScript('kimi','observe')),text=snapshot.answers[0],view=render(<MessageContent text={text}/>)
   expect(view.container.querySelector('strong').textContent).toBe('重点');expect(view.container.querySelector('blockquote').textContent).toContain('原文依据');expect(view.container.querySelector('ol ul')).toBeTruthy();expect(view.container.querySelector('ol').start).toBe(3);expect(screen.getByRole('cell',{name:'甲|乙'})).toBeTruthy();expect(view.container.querySelector('pre code').textContent).toBe('```\n    42')
  }finally{dom.window.close()}
 })
})
