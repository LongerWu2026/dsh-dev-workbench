import {describe,it,expect} from 'vitest'
import {JSDOM} from 'jsdom'
import {webAIPageScript} from '../../src/shared/web-ai-page.ts'
import {selectCapturedTurn} from '../../src/client/features/web-ai/capture.ts'
import {collectWebsiteAnswer,runWebsiteQuestion} from '../../src/client/features/web-ai/runner.ts'

function page(html,provider='kimi'){
 const hosts={kimi:'https://kimi.com/',glm:'https://chatglm.cn/',qianwen:'https://qianwen.com/',chatgpt:'https://chatgpt.com/',yuanbao:'https://yuanbao.tencent.com/',doubao:'https://www.doubao.com/chat/'}
 const dom=new JSDOM(html,{url:hosts[provider],runScripts:'outside-only'})
 dom.window.Element.prototype.getClientRects=()=>[{}]
 const observe=(question='')=>dom.window.eval(webAIPageScript(provider,'observe',question))
 return {dom,observe}
}
const user=q=>'<div class="segment-user"><span class="user-content__text">'+q+'</span><button>编辑</button></div>'
const answer=(body,attrs='')=>'<div class="segment-assistant" '+attrs+'>'+body+'</div>'
const turn=(id,ordinal,question,text,complete=false,userIndex=ordinal)=>({id,ordinal,question,text,complete,userIndex,truncated:false,completionEvidence:complete?'attribute':null})
describe('完整回答与轮次观察',()=>{
 it('一轮多个Markdown块合并，保留首尾、代码缩进与链接，忽略思考和工具按钮',()=>{
  const p=page('<textarea></textarea>'+user('问题')+answer('<div class="thinking-content"><div class="markdown">不应采集的思考</div></div><div class="markdown"><p>BEGIN</p><p>第一段正文</p><pre><code class="language-python">def f():\n    return 42</code></pre><button>复制代码</button></div><div class="markdown"><ul><li>第二段条目</li></ul><a href="https://example.org/ref">来源</a><p>END</p></div>','data-streaming="false"'))
  try{const s=p.observe('问题');expect(s.answerCount).toBe(1);expect(s.turns[0].question).toBe('问题');expect(s.answers[0]).toContain('BEGIN');expect(s.answers[0]).toContain('END');expect(s.answers[0]).toContain('```python\ndef f():\n    return 42\n```');expect(s.answers[0]).toContain('- 第二段条目');expect(s.answers[0]).toContain('[来源](https://example.org/ref)');expect(s.answers[0]).not.toContain('不应采集的思考');expect(s.answers[0]).not.toContain('复制代码')}finally{p.dom.window.close()}
 })
 it('元宝多模态用户卡片只读取问题正文，文件名与大小不误判成其他问题',()=>{
  const p=page('<div class="ql-editor" contenteditable="true"></div><div class="agent-chat__bubble--human"><div class="hyc-content-text">问题</div><div class="hyc-content-file">sample.txt 6 Bytes</div></div><div class="agent-chat__bubble--ai"><div class="hyc-content-md">答案</div></div>','yuanbao')
  try{expect(p.observe('问题').lastQuestion).toBe('问题');expect(p.observe('问题').turns[0].question).toBe('问题')}finally{p.dom.window.close()}
 })
 it('豆包用户正文优先于含附件的外层容器',()=>{
  const p=page('<textarea></textarea><div data-testid="send_message"><div data-testid="message_text_content">问题</div><div>sample.txt</div></div><div data-testid="receive_message"><div class="md-box-root">答案</div></div>','doubao')
  try{expect(p.observe('问题').lastQuestion).toBe('问题');expect(p.observe('问题').turns[0].question).toBe('问题')}finally{p.dom.window.close()}
 })
 it('有序列表保留编号、起始值和显式序号，不降成无序条目',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown"><ol start="3"><li>第三条</li><li value="9">第九条</li><li>第十条</li></ol></div>','data-streaming="false"'))
  try{expect(p.observe().answers[0]).toContain('3. 第三条\n9. 第九条\n10. 第十条')}finally{p.dom.window.close()}
 })
 it('多套新旧选择器并存仍按DOM顺序排列，不因选择器优先级把旧答案放到最后',()=>{
  const p=page('<textarea></textarea>'+user('旧问题')+'<div data-message-author-role="assistant"><div class="markdown">旧答案</div></div>'+user('新问题')+answer('<div class="markdown">新答案</div>'))
  try{const s=p.observe('新问题');expect(s.answerCount).toBe(2);expect(s.answers).toEqual(['旧答案','新答案']);expect(s.turns.at(-1).question).toBe('新问题')}finally{p.dom.window.close()}
 })
 it('上一轮操作栏和页面级完成属性都不能把新的一轮标为结束',()=>{
  const p=page('<div data-streaming="false"><textarea></textarea><div class="chat-editor"><div class="send-button-container"><svg class="send-icon"></svg></div></div>'+user('旧')+answer('<div class="markdown">旧</div><div class="segment-assistant-actions-content"><svg></svg></div>')+user('新')+answer('<div class="markdown">新内容</div>')+'</div>')
  try{const s=p.observe();expect(s.turns[0].complete).toBe(true);expect(s.turns[1].complete).toBe(false);expect(s.complete).toBe(false)}finally{p.dom.window.close()}
 })
 it('同轮多个块必须全部结束，不能使用第一个块的完成标记',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown" data-streaming="false">第一块</div><div class="markdown">第二块尚未结束</div>'))
  try{expect(p.observe().complete).toBe(false)}finally{p.dom.window.close()}
 })
 it('真正停止按钮出现时，即使动作栏已出现也不能报告完成',()=>{
  const p=page('<textarea></textarea><button aria-label="Stop"></button><div class="chat-editor"><div class="send-button-container"><svg class="send-icon"></svg></div></div>'+answer('<div class="markdown">部分</div><div class="segment-assistant-actions-content"><svg></svg></div>'))
  try{expect(p.observe().busy).toBe(true);expect(p.observe().complete).toBe(false)}finally{p.dom.window.close()}
 })
 it('超过保存上限明确标记截断，不能假装为完整回答',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown">'+'字'.repeat(60001)+'</div>','data-streaming="false"'))
  try{const s=p.observe();expect(s.turns[0].truncated).toBe(true);expect(s.turns[0].text.length).toBe(60000)}finally{p.dom.window.close()}
 })
 it('诊断不包含问题或回答正文，也不读取输入框的登录凭据',()=>{
  const p=page('<textarea></textarea><input type="password" value="CREDENTIAL-MARKER">'+user('PRIVATE-QUESTION')+answer('<div class="markdown">PRIVATE-ANSWER</div>'))
  try{const s=p.dom.window.eval(webAIPageScript('kimi','inspect'));const d=JSON.stringify(s.diagnostics);expect(d).not.toContain('PRIVATE-QUESTION');expect(d).not.toContain('PRIVATE-ANSWER');expect(d).not.toContain('CREDENTIAL-MARKER')}finally{p.dom.window.close()}
 })
 it('ChatGPT新版没有markdown类时按回答操作栏定位整轮，合并正文、代码和列表',()=>{
  const p=page('<div class="ProseMirror" contenteditable="true" role="textbox" aria-label="Ask ChatGPT"></div><div class="bg-user-message">问题</div><div class="group flex flex-col"><div><p>BEGIN</p><pre><code>let x = 1</code></pre><ul><li>正文条目</li></ul><p>END</p></div><div class="turn-action-controls"><button aria-label="Copy">Copy</button><button aria-label="Regenerate response">Regenerate</button></div></div>','chatgpt')
  try{const s=p.observe('问题');expect(s.answerCount).toBe(1);expect(s.turns[0].question).toBe('问题');expect(s.answers[0]).toContain('BEGIN');expect(s.answers[0]).toContain('END');expect(s.answers[0]).toContain('let x = 1');expect(s.answers[0]).not.toContain('Regenerate');expect(s.complete).toBe(true)}finally{p.dom.window.close()}
 })
 it('ChatGPT新版一轮包含用户和助手时仅取Markdown正文，并将轮内用户绑定到该答',()=>{
  const p=page('<div class="ProseMirror" contenteditable="true"></div><div data-turn-key="one"><div class="group"><div class="bg-user-message">第一问题</div><h4 class="sr-only" data-conversation-role="assistant">ChatGPT said:</h4><div data-chatgpt-selection-message-id="a"><div data-markdown-text-style><p>BEGIN</p><div class="cm-content"><div class="cm-line">def f():</div><div class="cm-line">    return 42</div></div><p>END</p></div></div><div class="turn-action-controls"><button aria-label="Read aloud"></button></div></div></div><div data-turn-key="two"><div class="group"><div class="bg-user-message">第二问题</div><div data-chatgpt-selection-message-id="b"><div data-markdown-text-style><p>第二答</p></div></div><div class="turn-action-controls"><button aria-label="Regenerate response"></button></div></div></div>','chatgpt')
  try{const s=p.observe();expect(s.answerCount).toBe(2);expect(s.userCount).toBe(2);expect(s.turns.map(t=>t.question)).toEqual(['第一问题','第二问题']);expect(s.answers[0]).toContain('BEGIN');expect(s.answers[0]).toContain('END');expect(s.answers[0]).toContain('```\ndef f():\n    return 42\n```');expect(s.answers[0]).not.toContain('第一问题');expect(s.answers[0]).not.toContain('ChatGPT said');expect(s.answers[1]).toBe('第二答');expect(s.complete).toBe(true)}finally{p.dom.window.close()}
 })
 it('display:contents包装没有自己的矩形也不能丢弃可见正文',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown"><div style="display:contents"><p>正文不能丢失</p></div></div>','data-streaming="false"'))
  const element=p.dom.window.document.querySelector('[style]');element.getClientRects=()=>[]
  try{expect(p.observe().answers[0]).toContain('正文不能丢失')}finally{p.dom.window.close()}
 })
 it('代码块去掉语法高亮的行号但保留数字代码、缩进和空格',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown"><pre><code class="language-python"><span class="react-syntax-highlighter-line-number">1</span>def wb_probe():\n<span class="react-syntax-highlighter-line-number">2</span>    return 123\n<span class="react-syntax-highlighter-line-number">3</span>42 + 1</code></pre></div>','data-streaming="false"'))
  try{const s=p.observe();expect(s.answers[0]).toContain('def wb_probe():\n    return 123\n42 + 1');expect(s.answers[0]).not.toContain('1def')}finally{p.dom.window.close()}
 })
 it('不采集零高度裁剪副本，但可见的重复段落必须保留',()=>{
  const p=page('<textarea></textarea>'+answer('<div class="markdown"><p>保留重复段落</p><p>保留重复段落</p></div><div style="height:0;overflow-y:hidden"><div class="markdown">不能重复采集的副本</div></div>','data-streaming="false"'))
  try{const s=p.observe();expect(s.answers[0].split('保留重复段落')).toHaveLength(3);expect(s.answers[0]).not.toContain('不能重复采集的副本')}finally{p.dom.window.close()}
 })
 it('ChatGPT旧回答没有Regenerate后仍按Read aloud保留轮次，不在追问时减少基线',()=>{
  const p=page('<div class="ProseMirror" contenteditable="true"></div><div class="group"><p>第一答</p><div class="turn-action-controls"><button aria-label="Read aloud"></button></div></div><button aria-label="Stop"></button>','chatgpt')
  try{const s=p.observe();expect(s.answerCount).toBe(1);expect(s.answers).toEqual(['第一答']);expect(s.complete).toBe(false);p.dom.window.document.querySelector('[aria-label="Stop"]').remove();p.dom.window.document.body.insertAdjacentHTML('beforeend','<div class="group"><p>第二答</p><div class="turn-action-controls"><button aria-label="Regenerate response"></button></div></div>');expect(p.observe().answerCount).toBe(2);expect(p.observe().answers).toEqual(['第一答','第二答'])}finally{p.dom.window.close()}
 })
})
describe('回答归属及恢复采集',()=>{
 it('恢复旧轮次时选择对应问题，不拿后续另一问题的回答',()=>{
  const s={turns:[turn('a',0,'第一问','第一答',true),turn('b',1,'第二问','第二答',true),turn('c',2,'第三问','第三答',true)],answerCount:3,userCount:3,lastQuestion:'第三问'}
  const result=selectCapturedTurn(s,'第二问',{answerCount:1,userCount:1,lastAnswerId:'a'});expect(result.turn.text).toBe('第二答');expect(result.foreign).toBe(false)
 })
 it('问题和回答文本重复时只选择基线之后的一轮',()=>{
  const s={turns:[turn('a',0,'重复问题','相同答案',true),turn('b',1,'重复问题','相同答案',true)],answerCount:2,userCount:2}
  expect(selectCapturedTurn(s,'重复问题',{answerCount:1,userCount:1,lastAnswerId:'a'}).turn.id).toBe('b')
 })
 it('虚拟列表移除旧节点后，仍能沿存活的上一答锚点定位新答',()=>{
  const s={turns:[turn('anchor',0,'旧问题','旧回答',true),turn('new',1,'新问题','新回答',true)],answerCount:2,userCount:2}
  expect(selectCapturedTurn(s,'新问题',{answerCount:10,userCount:10,lastAnswerId:'anchor'}).turn.id).toBe('new')
 })
 it('官网从首页切换新会话且数量重置时，凭会话变化和精确问题绑定新答',()=>{
  const before={answerCount:4,userCount:4,lastAnswerId:'old',conversationKey:'11111111'},snapshot={turns:[turn('new',0,'新问题','新答',true)],answerCount:1,userCount:1,conversationKey:'22222222'}
  expect(selectCapturedTurn(snapshot,'新问题',before).turn.text).toBe('新答');expect(selectCapturedTurn({...snapshot,conversationKey:'11111111'},'新问题',before).turn).toBeNull()
 })
 it('页面可见范围缩短且锚点丢失时停止，不猜测某条旧回答',()=>{
  const s={turns:[turn('old',0,'旧问题','旧回答',true)],answerCount:1,userCount:1}
  const r=selectCapturedTurn(s,'新问题',{answerCount:10,userCount:10,lastAnswerId:'gone'});expect(r.turn).toBeNull();expect(r.ambiguous).toBe(true)
 })
 it('没有用户角色的官网只允许下一个回答序号，不能跨轮取最后一条',()=>{
  const s={turns:[turn('a',0,null,'旧答',true,null),turn('b',1,null,'本答',true,null),turn('c',2,null,'下一答',true,null)],answerCount:3,userCount:0}
  expect(selectCapturedTurn(s,'本题',{answerCount:1,userCount:0}).turn.text).toBe('本答')
 })
})
describe('采集时序与连续追问',()=>{
 const signal=()=>new AbortController().signal
 it('停止按钮短暂消失和正文暂停不能提前结束；等待本轮明确完成信号',async()=>{
  let now=0,reads=0;const updates=[]
  const states=[{busy:true,turns:[turn('a',0,'问题','第一段')]},{busy:false,turns:[turn('a',0,'问题','第一段')]},{busy:true,turns:[turn('a',0,'问题','第一段\n第二段')]},{busy:false,turns:[turn('a',0,'问题','第一段\n第二段\nEND',true)]}]
  const controller={execute:async action=>{expect(action).toBe('observe');return {status:'ready',answerCount:1,userCount:1,...states[Math.min(reads++,states.length-1)]}}}
  await collectWebsiteAnswer(controller,'问题',{answerCount:0,userCount:0},async p=>updates.push(p),signal(),()=>now,async ms=>{now+=ms})
  expect(reads).toBeGreaterThanOrEqual(5);expect(updates.at(-1).status).toBe('completed');expect(updates.at(-1).text).toContain('END')
 })
 it('截断回答保持待核对，不推进下一问',async()=>{
  let now=0;const updates=[];const t={...turn('a',0,'问题','部分正文',true),truncated:true}
  await collectWebsiteAnswer({execute:async()=>({status:'ready',busy:false,answerCount:1,userCount:1,turns:[t]})},'问题',{answerCount:0,userCount:0},async p=>updates.push(p),signal(),()=>now,async ms=>{now+=ms})
  expect(updates.at(-1).status).toBe('uncertain');expect(updates.at(-1).note).toContain('60000')
 })
 it('正文长时间暂停后再出现结束操作，仍等待真正完成，不在十秒左右提前截断',async()=>{
  let now=0,reads=0;const updates=[]
  const controller={execute:async()=>({status:'ready',busy:false,answerCount:1,userCount:1,turns:[turn('a',0,'问题',++reads>12?'完整正文 END':'已出现的第一段',reads>12)]})}
  await collectWebsiteAnswer(controller,'问题',{answerCount:0,userCount:0},async p=>updates.push(p),signal(),()=>now,async ms=>{now+=ms})
  expect(reads).toBeGreaterThan(12);expect(updates.at(-1).status).toBe('completed');expect(updates.at(-1).text).toContain('END')
 })
 it('同一官网连续两问先等第一答完整完成，再发送下一问；不重建或重复发送',async()=>{
  let now=0,current='',polls=0;const submitted=[],finished=[],updates=[]
  const questions=['第一问','根据上一答继续第二问']
  const controller={execute:async(action,q)=>{
   if(action==='prepare'){current=q;polls=0;return{status:'prepared'}}
   if(action==='submit'){if(submitted.length)expect(finished).toContain(questions[0]);submitted.push(q);return{status:'generating'}}
   const before=submitted.length===finished.length
   const turns=finished.map((q,i)=>turn('turn-'+i,i,q,'完整回答 '+q,true))
   if(!before){polls++;turns.push(turn('turn-'+finished.length,finished.length,current,'完整回答 '+current,polls>=2))}
   return {status:'ready',busy:!before&&polls===1,editorCount:1,answerCount:turns.length,userCount:turns.length,lastAnswerId:turns.at(-1)?.id,turns,answers:turns.map(t=>t.text)}
  }}
  for(const q of questions)await runWebsiteQuestion(controller,q,'request-'+q,async p=>{updates.push(p);if(p.status==='completed')finished.push(q)},signal(),false,()=>now,async ms=>{now+=ms})
  expect(submitted).toEqual(questions);expect(finished).toEqual(questions);expect(updates.filter(p=>p.status==='completed')).toHaveLength(2)
 })
})
