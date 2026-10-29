import React from 'react'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,cleanup,act,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {JSDOM} from 'jsdom'
import {normalizeWebAIAttachments} from '../../src/shared/web-ai-attachments.ts'
import {webAIPageScript} from '../../src/shared/web-ai-page.ts'
import {webAIUploadScript} from '../../src/shared/web-ai-upload.ts'
import {selectWebAIFiles,readWebAIFiles,WebAIAttachments} from '../../src/client/features/web-ai/attachments.tsx'
import {runWebsiteQuestion} from '../../src/client/features/web-ai/runner.ts'
import {NativeWebsite} from '../../src/client/features/web-ai/NativeWebsite.tsx'
import {runWebsiteBatch} from '../../src/client/features/web-ai/batch.ts'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const file={id:'file-test',name:'sample.txt',size:6,type:'text/plain',base64:'bWFya2Vy'}
function website(html){
 const d=new JSDOM('<div class="chat-editor">'+html+'</div>',{url:'https://www.kimi.com/',runScripts:'outside-only'}),w=d.window
 w.Element.prototype.getClientRects=()=>[{}]
 w.DataTransfer=class{files=[];items={add:f=>this.files.push(f)}}
 const input=w.document.querySelector('input[type=file]');if(input)Object.defineProperty(input,'files',{value:[],writable:true})
 w.DragEvent=class extends w.Event{constructor(n,o){super(n,o);this.dataTransfer=o.dataTransfer}}
 w.ClipboardEvent=class extends w.Event{constructor(n,o){super(n,o);this.clipboardData=o.clipboardData}}
 const run=(action='upload',q='测试',id='round:kimi:file-test',data=[file])=>w.eval(webAIUploadScript('kimi',action,data,q,id))
 return {d,w,input,run}
}
describe('附件选择、持久化边界与UI',()=>{
 it('连续粘贴同名截图自动编号，字节不变；普通选择重名仍明确拒绝',async()=>{
  const image=new File(['marker'],'image.png',{type:'image/png'}),first=selectWebAIFiles([],[image]);const all=selectWebAIFiles(first,[image,image],true)
  expect(all.map(f=>f.name)).toEqual(['image.png','image (2).png','image (3).png']);expect((await readWebAIFiles(all)).map(f=>f.base64)).toEqual([file.base64,file.base64,file.base64]);expect(()=>selectWebAIFiles(first,[image])).toThrow('重复')
 })
 it('只保留明确元数据，拒绝空文件、重复名、超限、路径和不支持的格式',()=>{
  expect(normalizeWebAIAttachments([{...file,path:'/private/local',cookie:'secret'}])).toEqual([{id:file.id,name:file.name,size:6,type:'text/plain'}])
  for(const bad of [{...file,size:0},{...file,size:11*1024*1024},{...file,name:'../sample.txt'},{...file,name:'evil.exe'}])expect(()=>normalizeWebAIAttachments([bad])).toThrow()
  expect(()=>normalizeWebAIAttachments([file,file])).toThrow('重复');expect(()=>normalizeWebAIAttachments(Array(6).fill(file))).toThrow('5')
 })
 it('选择真实File后才读取内容，浏览器FileReader编码保持字节；组件支持多选和逐项移除',async()=>{
  const picked=new File(['marker'],'sample.txt',{type:'text/plain'}),selected=selectWebAIFiles([],[picked]);expect(selected[0].file).toBe(picked);expect((await readWebAIFiles(selected))[0].base64).toBe(file.base64)
  const add=vi.fn(),remove=vi.fn();render(<WebAIAttachments files={selected} disabled={false} onAdd={add} onRemove={remove}/>);const user=userEvent.setup();await user.upload(screen.getByLabelText('选择问题附件'),picked);expect(add).toHaveBeenCalledWith([picked]);await user.click(screen.getByRole('button',{name:'移除附件 sample.txt'}));expect(remove).toHaveBeenCalledWith(selected[0].id)
 })
})
describe('官网受控上传与回执',()=>{
 it('可见官网安全验证停止自动操作，回答中提及验证码不误判',()=>{
  const p=website('<textarea>请解释验证码</textarea><button aria-label="Send"></button><iframe src="https://verify.example.org/captcha"></iframe>')
  try{let state=p.w.eval(webAIPageScript('kimi','observe'));expect(state.status).toBe('needs_login');expect(state.note).toContain('本人完成安全验证');p.w.document.querySelector('iframe').remove();state=p.w.eval(webAIPageScript('kimi','observe'));expect(state.status).toBe('ready')}finally{p.d.window.close()}
 })
 it('千问附件列表里的avatar标记是实际文件缩略图，普通头像仍排除并保护已有附件',()=>{
  const p=website('<div class="bg-capsule"><div><textarea>测试</textarea><button aria-label="发送消息"></button></div><img alt="avatar" src="https://cdn.example.org/profile.png"><div class="fileWrap-test"><div class="imageThumbWrapper-test"><img alt="avatar" src="https://cdn.example.org/uploaded.png"></div></div></div>');p.d.reconfigure({url:'https://qianwen.com/'})
  try{const state=p.w.eval(webAIPageScript('qianwen','observe'));expect(state.hasAttachmentDraft).toBe(true);expect(p.w.eval(webAIUploadScript('qianwen','upload',[{...file,name:'picture.png',type:'image/png'}],'测试','r:q:file')).status).toBe('unsupported');p.w.document.querySelector('.fileWrap-test').remove();expect(p.w.eval(webAIPageScript('qianwen','observe')).hasAttachmentDraft).toBe(false)}finally{p.d.window.close()}
 })
 it('智谱空输入隐藏发送按钮时仍限定输入区，页脚GitHub图标不算附件',()=>{
  const p=website('');p.d.reconfigure({url:'https://chatglm.cn/main/alltoolsdetail'});p.w.document.body.innerHTML='<div class="bottom"><div class="search-box-wrapper"><textarea></textarea></div><img class="github" src="https://cdn.example.org/github.svg"></div>'
  try{expect(p.w.eval(webAIPageScript('glm','observe')).hasAttachmentDraft).toBe(false)}finally{p.d.window.close()}
 })
 it('ChatGPT使用通用Attach files输入，避开仅拍照的输入',()=>{
  const p=website('');p.d.reconfigure({url:'https://chatgpt.com/'});p.w.document.body.innerHTML='<form><div id="prompt-textarea" contenteditable="true">测试</div><input type="file" aria-label="Take a photo" accept="image/*"><input type="file" aria-label="Attach files" multiple><button aria-label="Send prompt"></button></form>'
  let received=0;const input=p.w.document.querySelector('[aria-label="Attach files"]');Object.defineProperty(input,'files',{value:[],writable:true});input.onchange=()=>{received++;p.w.document.querySelector('form').insertAdjacentHTML('beforeend','<div class="file-info">sample.txt</div>')}
  try{const run=action=>p.w.eval(webAIUploadScript('chatgpt',action,[file],'测试','r:chatgpt:file-test'));expect(run('upload').status).toBe('uploading');expect(run('attachment-status').status).toBe('attached');expect(received).toBe(1)}finally{p.d.window.close()}
 })
 it('官网追加数字序号的文件名回执可识别，相似的其他文件名仍不放行',()=>{
  for(const [name,expected] of [['sample(3).txt','attached'],['sample (2).txt','attached'],['sample-other(3).txt','uploading'],['sample(3).csv','uploading']]){
   const p=website('<textarea>测试</textarea><input type="file"><button aria-label="Send"></button>');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<button aria-label="'+name+'"></button>')
   try{p.run();expect(p.run('attachment-status').status).toBe(expected)}finally{p.d.window.close()}
  }
 })
 it('隐藏文件input通过FileList交给官网，等文件名回执及启用按钮后确认；同轮不重复上传',()=>{
  const p=website('<textarea>测试</textarea><input type="file" multiple hidden><button aria-label="Send"></button>');let calls=0
  p.input.addEventListener('change',()=>{calls++;expect(p.input.files[0].name).toBe('sample.txt');p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div class="file-card">sample.txt</div>')})
  try{expect(p.run().status).toBe('uploading');expect(p.run('attachment-status').status).toBe('attached');p.run();expect(calls).toBe(1)}finally{p.d.window.close()}
 })
 it('图片处理后换成官网HTTPS预览也能确认，不要求blob地址；头像不算附件草稿',()=>{
  const p=website('<textarea>测试</textarea><img alt="avatar" src="https://cdn.example.org/avatar.png"><input type="file"><button aria-label="Send"></button>');p.w.document.body.insertAdjacentHTML('afterbegin','<img class="avatar" src="blob:avatar">');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<img class="image-main" src="https://cdn.example.org/test.png">')
  const image={...file,name:'sample.png',type:'image/png'}
  try{expect(p.run('upload','测试','round:kimi:file-test',[image]).status).toBe('uploading');expect(p.run('attachment-status','测试','round:kimi:file-test',[image]).status).toBe('attached')}finally{p.d.window.close()}
 })
 it('豆包固定上传按钮接收文档，千问回执包含输入区外层的附件列表',async()=>{
  const p=website('<textarea>测试</textarea>');p.d.reconfigure({url:'https://www.doubao.com/chat/'});p.w.document.body.innerHTML='<div class="guidance-input-surface"><textarea>测试</textarea><button data-testid="upload_file_button"></button><button data-testid="chat_input_send_button"></button></div>'
  let changes=0;p.w.document.querySelector('[data-testid="upload_file_button"]').onclick=()=>{const input=p.w.document.createElement('input');input.type='file';input.accept='.txt';Object.defineProperty(input,'files',{value:[],writable:true});input.onchange=()=>{changes++;p.w.document.querySelector('.guidance-input-surface').insertAdjacentHTML('beforeend','<div class="file-info">sample TXT 6 Bytes</div>')};input.click()}
  try{const run=action=>p.w.eval(webAIUploadScript('doubao',action,[file],'测试','r:doubao:file-test'));expect((await run('upload')).status).toBe('uploading');expect((await run('attachment-status')).status).toBe('attached');expect(changes).toBe(1)}finally{p.d.window.close()}
  const q=website('<div class="bg-capsule"><div><textarea>测试</textarea><button aria-label="发送消息"></button></div><div class="file-list"></div></div>');q.d.reconfigure({url:'https://qianwen.com/'});q.w.document.querySelector('textarea').ondrop=e=>{expect(e.dataTransfer.files[0].name).toBe(file.name);q.w.document.querySelector('.file-list').insertAdjacentHTML('beforeend','<div class="file-info">sample TXT 6 Bytes</div>')}
  try{const run=action=>q.w.eval(webAIUploadScript('qianwen',action,[file],'测试','r:qianwen:file-test'));expect((await run('upload')).status).toBe('uploading');expect((await run('attachment-status')).status).toBe('attached')}finally{q.d.window.close()}
 })
 it('文档没有上传input时只发送一次带File的drop；不能只因问题包含文件名就判上传成功',()=>{
  const p=website('<textarea>请总结 sample.txt</textarea><button aria-label="Send"></button>');let count=0;p.w.document.querySelector('textarea').addEventListener('drop',e=>{count++;expect(e.dataTransfer.files[0].name).toBe('sample.txt')})
  try{expect(p.run('upload','请总结 sample.txt').status).toBe('uploading');expect(p.run('attachment-status','请总结 sample.txt').status).toBe('uploading');p.run('upload','请总结 sample.txt');expect(count).toBe(1)}finally{p.d.window.close()}
 })
 it('已确认且仍留在官网的附件可继续追问，不重传；附件变化后重新保护',()=>{
  const p=website('<textarea>测试</textarea><input type="file"><button aria-label="Send"></button>');let uploads=0,sends=0;p.input.onchange=()=>{uploads++;p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div class="file-info">sample TXT 6 Bytes</div>')};p.w.document.querySelector('button').onclick=()=>{sends++;p.w.document.querySelector('textarea').value=''}
  const action=(a,q='测试',id='round:kimi')=>p.w.eval(webAIPageScript('kimi',a,q,id))
  try{action('prepare');p.run();p.run('attachment-status');expect(action('submit').status).toBe('generating');expect(action('observe').attachmentsOwned).toBe(true);action('prepare','追问','next:kimi');expect(action('submit','追问','next:kimi').status).toBe('generating');expect(uploads).toBe(1);expect(sends).toBe(2);p.w.document.querySelector('.file-info').textContent='other TXT 8 Bytes';expect(action('observe').attachmentsOwned).toBe(false);action('prepare','另一问','third:kimi');expect(action('submit','另一问','third:kimi').status).toBe('unsupported');expect(sends).toBe(2)}finally{p.d.window.close()}
 })
 it('内嵌控制器持有的签名可跨网页重载绑定已上传上下文，但不能绑定更换后的附件',()=>{
  const p=website('<textarea>测试</textarea><input type="file"><button aria-label="Send"></button>');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div class="file-info">sample TXT 6 Bytes</div>')
  try{p.run();const sig=p.run('attachment-status').signature;expect(p.w.eval(webAIPageScript('kimi','observe')).attachmentsOwned).toBe(false);expect(p.w.eval(webAIPageScript('kimi','observe','','',sig)).attachmentsOwned).toBe(true);p.w.document.querySelector('.file-info').textContent='other TXT 9 Bytes';expect(p.w.eval(webAIPageScript('kimi','observe','','',sig)).attachmentsOwned).toBe(false)}finally{p.d.window.close()}
 })
 it('混合附件最终核对发现先前图片被官网替换时不放行',()=>{
  const p=website('<textarea>测试</textarea><input type="file"><button aria-label="Send"></button>'),image={...file,id:'image',name:'picture.png',type:'image/png'}
  p.input.onchange=()=>{const root=p.w.document.querySelector('.chat-editor');root.querySelectorAll('.fixture-preview').forEach(el=>el.remove());root.insertAdjacentHTML('beforeend',p.input.files[0].type.startsWith('image/')?'<img class="fixture-preview" src="https://cdn.example.org/photo.png">':'<div class="fixture-preview file-info">sample TXT 6 Bytes</div>')}
  try{p.run('upload','测试','round:kimi:image',[image]);expect(p.run('attachment-status','测试','round:kimi:image',[image]).status).toBe('attached');p.run('upload','测试','round:kimi:file-test',[file]);expect(p.run('attachment-status','测试','round:kimi:file-test',[file]).status).toBe('attached');expect(p.run('attachment-verify','测试','round:kimi',[image,file]).status).toBe('unsupported')}finally{p.d.window.close()}
 })
 it('文档卡片把扩展名单独展示时，按文件基名、格式和大小匹配回执',()=>{
  const p=website('<textarea>测试</textarea><input type="file"><button aria-label="Send"></button>');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div class="file-info">sample TXT 6 Bytes</div>')
  try{expect(p.run().status).toBe('uploading');expect(p.run('attachment-status').status).toBe('attached')}finally{p.d.window.close()}
 })
 it('CSS背景缩略图可作为图片回执，无类名头像不能充当附件',()=>{
  const p=website('<textarea>测试</textarea><img alt="avatar" src="https://cdn.example.org/avatar.png"><input type="file"><button aria-label="Send"></button>');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div style="background-image:url(https://cdn.example.org/preview.png);width:48px;height:48px"></div>')
  const image={...file,name:'sample.png',type:'image/png'};try{expect(p.run('upload','测试','round:kimi:file-test',[image]).status).toBe('uploading');expect(p.run('attachment-status','测试','round:kimi:file-test',[image]).status).toBe('attached')}finally{p.d.window.close()}
 })
 it('官网菜单临时创建的input可接收已选File，不打开第二个文件对话框，且完整恢复原型',async()=>{
  const p=website('<textarea>测试</textarea>');const w=p.w;p.d.reconfigure({url:'https://yuanbao.tencent.com/'});w.document.body.innerHTML='<div class="app-search-bar"><div class="ql-editor" contenteditable="true">测试</div><button aria-label="Add"></button><div role="menuitem">Upload Image</div><div id="yuanbao-send-btn">Send</div></div>'
  const native=vi.fn();w.HTMLInputElement.prototype.click=native;let changes=0
  w.document.querySelector('[role="menuitem"]').onclick=()=>{const input=w.document.createElement('input');input.type='file';input.accept='image/*';Object.defineProperty(input,'files',{value:[],writable:true});input.onchange=()=>{changes++;expect(input.files[0].name).toBe('sample.png');w.document.querySelector('.app-search-bar').insertAdjacentHTML('beforeend','<img src="https://cdn.example.org/image.png">')};input.click()}
  try{const image={...file,name:'sample.png',type:'image/png'};const run=action=>w.eval(webAIUploadScript('yuanbao',action,[image],'测试','round:yuanbao:file-test'));expect((await run('upload')).status).toBe('uploading');expect((await run('attachment-status')).status).toBe('attached');expect(changes).toBe(1);expect(native).not.toHaveBeenCalled();expect(w.HTMLInputElement.prototype.click).toBe(native)}finally{p.d.window.close()}
 })
 it('页面上传中、按钮禁用或官网错误均不放行发送；已有附件草稿、其他文本草稿及格式不符均受保护',()=>{
  const p=website('<textarea>测试</textarea><input type="file" accept=".txt"><button aria-label="Send" disabled></button>');p.input.onchange=()=>p.w.document.querySelector('.chat-editor').insertAdjacentHTML('beforeend','<div class="file-card">sample.txt</div><div role="progressbar"></div>')
  try{p.run();expect(p.run('attachment-status').status).toBe('uploading');p.w.document.body.insertAdjacentHTML('beforeend','<div role="alert">上传失败</div>');expect(p.run('attachment-status').status).toBe('unsupported')}finally{p.d.window.close()}
  for(const html of ['<textarea>人工草稿</textarea>','<textarea>测试</textarea><div class="file-card">original.pdf</div>','<textarea>测试</textarea><input type="file" accept=".png">']){const q=website(html);try{expect(q.run().status).toBe('unsupported')}finally{q.d.window.close()}}
 })
 it('来源变化、无效字节和多入口歧义都在传输前拒绝',()=>{
  const p=website('<textarea>测试</textarea><input type="file"><input type="file">');try{expect(p.run().status).toBe('unsupported');p.d.reconfigure({url:'https://example.org/'});expect(p.run().status).toBe('unsupported')}finally{p.d.window.close()}
  const q=website('<textarea>测试</textarea>');try{expect(q.run('upload','测试','id',[{...file,base64:'bad!'}]).status).toBe('unsupported')}finally{q.d.window.close()}
 })
})
describe('附件发送时序与批量',()=>{
 it('必须先准备问题、等附件就绪，再且仅提交一次；附件失败阻止提交',async()=>{
  for(const good of [true,false]){
   let now=0;const actions=[],updates=[]
   const c={execute:async action=>{actions.push(action);return action==='observe'?{status:'ready',editorCount:1,answerCount:0,userCount:0}:action==='prepare'?{status:'prepared'}:{status:'uncertain'}},attach:async()=>{actions.push('attach');return{status:good?'attached':'unsupported',note:'上传失败'}}}
   await runWebsiteQuestion(c,'问题','request',async p=>updates.push(p),new AbortController().signal,false,()=>now,async ms=>{now+=ms},[file]);expect(actions).toEqual(good?['observe','prepare','attach','observe','submit']:['observe','prepare','attach']);expect(updates.at(-1).status).toBe(good?'uncertain':'unsupported')
  }
 })
 it('每个厂商仅首问带附件，追问复用会话；批量中不重复上传',async()=>{
  const rounds=['第一问','第二问'].map((question,i)=>({id:'round-'+i,question})),seen=[]
  await runWebsiteBatch(rounds,['kimi','glm'],{attachments:[file],claim:async()=>({executionId:'test'}),update:async()=>{},open:async(_r,p)=>({p}),run:async(c,q,_id,update,_signal,_prepare,_clock,_pause,files)=>{seen.push([c.p,q,files.length]);await update({status:'completed',text:'完整'})}},new AbortController().signal)
  for(const provider of ['kimi','glm'])expect(seen.filter(x=>x[0]===provider)).toEqual([[provider,'第一问',1],[provider,'第二问',0]])
 })
})

describe('原版内嵌附件控制器',()=>{
 it('千问混合图片和文档在传输前明确拒绝，不触发覆盖弹窗',async()=>{
  const keys=['loadURL','getURL','executeJavaScript'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(HTMLElement.prototype,k)]));let current='about:blank#files',controller;const execute=vi.fn()
  vi.stubGlobal('dshDesktop',{protocolVersion:1,browser:{acquire:async()=>({lease:'files',partition:'files-memory'}),release:async()=>{},onOpenRequested:()=>()=>{}}})
  HTMLElement.prototype.loadURL=async function(url){current=url;queueMicrotask(()=>this.dispatchEvent(new Event('dom-ready')))};HTMLElement.prototype.getURL=()=>current;HTMLElement.prototype.executeJavaScript=execute
  const view=render(<NativeWebsite providerId="qianwen" scope="synthetic" url="https://qianwen.com/" visible onController={c=>{controller=c}}/> )
  try{await waitFor(()=>expect(view.container.querySelector('webview')).toBeTruthy());await act(async()=>view.container.querySelector('webview').dispatchEvent(new Event('dom-ready')));await waitFor(()=>expect(controller?.attach).toBeTypeOf('function'));const result=await controller.attach([file,{...file,id:'image',name:'image.png',type:'image/png'}],'问题','mixed',new AbortController().signal);expect(result.status).toBe('unsupported');expect(result.note).toContain('分开提问');expect(execute).not.toHaveBeenCalled()}finally{view.unmount();for(const key of keys){if(old[key])Object.defineProperty(HTMLElement.prototype,key,old[key]);else delete HTMLElement.prototype[key]}}
 })
 it('准备、上传、连续两次就绪后完成；不依赖额外窗口',async()=>{
  const descriptors={},events=[];for(const key of ['loadURL','getURL','executeJavaScript','scrollIntoView'])descriptors[key]=Object.getOwnPropertyDescriptor(HTMLElement.prototype,key)
  let current='about:blank#native-file',controller
  vi.stubGlobal('dshDesktop',{protocolVersion:1,browser:{acquire:async()=>({lease:'native-file',partition:'native-file-memory'}),release:async()=>{},onOpenRequested:()=>()=>{}}})
  HTMLElement.prototype.loadURL=async function(url){current=url;queueMicrotask(()=>this.dispatchEvent(new Event('dom-ready')))};HTMLElement.prototype.getURL=()=>current;HTMLElement.prototype.scrollIntoView=()=>{}
  HTMLElement.prototype.executeJavaScript=async script=>{if(script.includes('"action":"attachment-verify"')){events.push('verify');return{status:'attached',signature:'abcdef12'}};if(script.includes('"action":"attachment-status"')){events.push('status');return{status:'attached',signature:'abcdef12'}};if(script.includes('"action":"upload"')){events.push('upload');return{status:'uploading'}}events.push('observe');return{status:'ready'}}
  const view=render(<NativeWebsite providerId="yuanbao" scope="synthetic" url="https://yuanbao.tencent.com/" visible onController={c=>{controller=c}}/> )
  try{await waitFor(()=>expect(view.container.querySelector('webview')).toBeTruthy());await act(async()=>view.container.querySelector('webview').dispatchEvent(new Event('dom-ready')));await waitFor(()=>expect(controller?.attach).toBeTypeOf('function'));let result;await act(async()=>{result=await controller.attach([file],'问题','round',new AbortController().signal)});expect(result.status).toBe('attached');expect(events).toEqual(['observe','upload','status','status','verify'])}finally{view.unmount();for(const key of Object.keys(descriptors)){if(descriptors[key])Object.defineProperty(HTMLElement.prototype,key,descriptors[key]);else delete HTMLElement.prototype[key]}}
 },8000)
})
