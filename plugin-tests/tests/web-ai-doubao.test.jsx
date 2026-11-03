import {describe,it,expect} from 'vitest'
import {JSDOM} from 'jsdom'
import {webAIPageScript} from '../../src/shared/web-ai-page.ts'
import {collectWebsiteAnswer,runWebsiteQuestion} from '../../src/client/features/web-ai/runner.ts'

const fragment=text=>'<section data-streaming="false"><div class="md-box-root" data-testid="message_text_content"><p>'+text+'</p></div></section>'
const conclusion='<div class="blockLayout-fixture"><div class="md-box-root" data-testid="message_text_content"><h2>结论：TypeScript + Cordis 插件架构</h2><p>官方插件使用<strong>TypeScript</strong>。</p><p>FINAL-CONCLUSION-END</p></div></div>'
const done='<button data-testid="message_action_regenerate"></button>'
function website(body=''){
 const dom=new JSDOM('<textarea></textarea>'+body,{url:'https://www.doubao.com/chat/example',runScripts:'outside-only'}),d=dom.window.document
 dom.window.Element.prototype.getClientRects=()=>[{}]
 return{dom,d,observe:()=>dom.window.eval(webAIPageScript('doubao','observe','问题'))}
}
const user='<div data-testid="send_message"><div data-testid="message_text_content">问题</div></div>'
describe('豆包多阶段回答的整轮结束判断',()=>{
 it('两个已结束检索说明不能标记整轮完成，随后结论完整合并且不重复',()=>{
  const p=website(user+'<div data-testid="receive_message">'+fragment('我先查一下官方文档')+fragment('我再精读一下插件契约')+'</div>')
  try{
   let state=p.observe();expect(state.complete).toBe(false);expect(state.turns[0].completionEvidence).toBeNull();const id=state.turns[0].id
   p.d.querySelector('[data-testid="receive_message"]').insertAdjacentHTML('beforeend',conclusion+done)
   state=p.observe();expect(state.answerCount).toBe(1);expect(state.turns[0].id).toBe(id);expect(state.complete).toBe(true);expect(state.turns[0].completionEvidence).toBe('turn-control');expect(state.answers[0]).toContain('## 结论：TypeScript + Cordis 插件架构');expect(state.answers[0]).toContain('**TypeScript**');expect(state.answers[0]).toContain('FINAL-CONCLUSION-END');expect(state.answers[0].split('FINAL-CONCLUSION-END')).toHaveLength(2)
  }finally{p.dom.window.close()}
 })
 it('已结束包装属性及较早轮次的重新生成按钮不能结束当前过程说明',()=>{
  const p=website(user+'<div data-testid="receive_message">'+conclusion+done+'</div>'+user+'<div data-testid="receive_message" data-streaming="false">'+fragment('仍在检索')+'</div>')
  try{const s=p.observe();expect(s.turns[0].complete).toBe(true);expect(s.turns[1].complete).toBe(false);expect(s.complete).toBe(false)}finally{p.dom.window.close()}
 })
 it('结束控件隐藏、禁用或仍有停止按钮时不报告完成',()=>{
  const p=website(user+'<div data-testid="receive_message">'+conclusion+'<button data-testid="message_action_regenerate" hidden></button></div>')
  try{const b=p.d.querySelector('button');expect(p.observe().complete).toBe(false);b.hidden=false;b.disabled=true;expect(p.observe().complete).toBe(false);b.disabled=false;p.d.body.insertAdjacentHTML('beforeend','<button data-testid="chat_input_stop_button"></button>');expect(p.observe().complete).toBe(false);p.d.querySelector('[data-testid="chat_input_stop_button"]').remove();expect(p.observe().complete).toBe(true)}finally{p.dom.window.close()}
 })
 it('重新生成按钮不作为正文采集，保留表格、代码及结论末尾',()=>{
  const p=website(user+'<div data-testid="receive_message">'+conclusion+'<div class="md-box-root"><table><tr><th>语言</th><th>架构</th></tr><tr><td>TS</td><td>Cordis</td></tr></table><pre><code class="language-ts">const value = 42;</code></pre></div><button data-testid="message_action_regenerate">重新生成</button></div>')
  try{const s=p.observe();expect(s.answers[0]).toContain('| TS | Cordis |');expect(s.answers[0]).toContain('```ts\nconst value = 42;\n```');expect(s.answers[0]).not.toContain('重新生成')}finally{p.dom.window.close()}
 })
 it('真实观察器驱动采集：过程说明停顿10秒仍继续等待结论及本轮结束控件',async()=>{
  const p=website(user+'<div data-testid="receive_message">'+fragment('我先查官方文档')+fragment('我再精读插件契约')+'</div>'),updates=[];let now=0,reads=0
  try{
   await collectWebsiteAnswer({execute:async action=>{expect(action).toBe('observe');if(++reads===16)p.d.querySelector('[data-testid="receive_message"]').insertAdjacentHTML('beforeend',conclusion+done);return p.observe()}},'问题',{answerCount:0,userCount:0},async patch=>updates.push(patch),new AbortController().signal,()=>now,async ms=>{now+=ms})
   expect(reads).toBe(17);expect(updates.filter(p=>p.status==='completed')).toHaveLength(1);expect(updates.at(-1).text).toContain('FINAL-CONCLUSION-END');expect(updates.filter(p=>p.status==='generating')).toHaveLength(2)
  }finally{p.dom.window.close()}
 })
 it('批量追问等结论完整采集后才发送下一问，同一会话不重复提交',async()=>{
  const p=website(),submitted=[],finished=[];let now=0,current='',polls=0
  const controller={execute:async(action,question)=>{
   if(action==='prepare'){current=question;polls=0;return{status:'prepared'}}
   if(action==='submit'){if(submitted.length)expect(finished).toContain('第一问');submitted.push(question);p.d.body.insertAdjacentHTML('beforeend','<div data-testid="send_message"><div data-testid="message_text_content">'+question+'</div></div><div data-testid="receive_message">'+fragment('查询中')+'</div>');return{status:'generating'}}
   if(submitted.length>finished.length&&++polls===5)p.d.querySelectorAll('[data-testid="receive_message"]')[submitted.length-1].insertAdjacentHTML('beforeend',conclusion+done)
   return p.dom.window.eval(webAIPageScript('doubao','observe',question))
  }}
  try{for(const q of ['第一问','第二问'])await runWebsiteQuestion(controller,q,'request-'+q,async patch=>{if(patch.status==='completed'){expect(patch.text).toContain('FINAL-CONCLUSION-END');finished.push(current)}},new AbortController().signal,false,()=>now,async ms=>{now+=ms});expect(submitted).toEqual(['第一问','第二问']);expect(finished).toEqual(submitted)}finally{p.dom.window.close()}
 })
})
