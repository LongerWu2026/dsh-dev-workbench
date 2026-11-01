import React from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {WB,useStore} from '../../src/client/core/runtime.ts'
import {AssistantContextPicker,assistantContextCandidates} from '../../src/client/components/AssistantContextPicker.tsx'
import {AssistantAddMaterials,AssistantAttachmentCards,attachmentDragHandlers,selectAssistantFiles,useAssistantAttachments} from '../../src/client/components/AssistantAttachments.tsx'

afterEach(()=>{cleanup();vi.restoreAllMocks();delete WB.uploadAssistantFile;delete WB.nativeAttachmentCapabilities})
const key=()=>`materials-${Date.now()}-${Math.random()}`
function attachmentHarness(scope=key()){
 let current
 function Harness({scope}){current=useAssistantAttachments(scope);return <AssistantAttachmentCards items={current.items} onRemove={current.remove} onRetry={current.retry}/>}
 const view=render(<Harness scope={scope}/>);return {get:()=>current,scope,change:next=>view.rerender(<Harness scope={next}/>),unmount:view.unmount}
}
const fixture=()=>({tasks:[{id:'old',title:'历史验收记录',status:'completed',updatedAt:'2026-10-20T02:00:00Z'},{id:'active',title:'接口联调核对',status:'running',updatedAt:'2026-11-01T02:00:00Z'}],replies:[{id:'pending',snippet:'确认字段验收口径',stage:'待回复',updatedAt:'2026-11-01T03:00:00Z'},{id:'replied',snippet:'已回复的项目问题',stage:'已回复',updatedAt:'2026-10-30T03:00:00Z'}],sources:[{id:'message',excerpt:'原始项目说明',fetchedAt:'2026-11-01T02:30:00Z'}],radar:[{id:'news',title:'工具调用资讯'}],knowledge:[{id:'knowledge',title:'发布验收规范',reviewState:'confirmed'}]})
function pickerHarness(refs=[]){
 WB.store.set({assistantConversationId:key(),assistantHubThreadId:null,assistantRefs:refs})
 function Picker(){const state=useStore();return <AssistantContextPicker data={fixture()} refs={state.assistantRefs} compact/>}
 render(<Picker/>);return userEvent.setup()
}

describe('助手附件草稿与原生上传',()=>{
 it('选择和切换只保存当前草稿，不上传或创建会话；重开原scope恢复附件',async()=>{
  const upload=WB.uploadAssistantFile=vi.fn(),h=attachmentHarness(),file=new File(['notes'],'说明.txt',{type:'text/plain'})
  act(()=>h.get().add([file]));expect(h.get().items).toHaveLength(1);expect(screen.getByText('说明.txt')).toBeTruthy();expect(upload).not.toHaveBeenCalled()
  h.change(key());expect(h.get().items).toEqual([]);h.change(h.scope);expect(h.get().items[0].file).toBe(file);expect(upload).not.toHaveBeenCalled()
 })
 it('两份相同名称的粘贴截图具有独立显示名和ID，路径不能代替附件',()=>{
  const image=new File(['image'],'image.png',{type:'image/png'}),first=selectAssistantFiles([],[image],true),second=selectAssistantFiles(first,[image],true)
  expect(second.map(row=>row.name)).toEqual(['image.png','image (2).png']);expect(second[0].id).not.toBe(second[1].id);expect(()=>selectAssistantFiles([],[{name:'/tmp/file',size:1,path:'/tmp/file'}])).toThrow(/本地文件/)
 })
 it('准备图片与通用文件按原生协议传递，进度可见且不混入File对象或本地路径',async()=>{
  const upload=WB.uploadAssistantFile=vi.fn(async(sessionId,file,name,signal,progress)=>{progress({loaded:2,total:4});return {receiptId:'receipt-one',file:{attachmentId:'hash-one',name,bytes:file.size}}}),h=attachmentHarness()
  act(()=>h.get().add([new File(['png'],'截图.png',{type:'image/png'}),new File(['text'],'说明.txt',{type:'text/plain'})]))
  let payload;await act(async()=>{payload=await h.get().prepare({sessionId:'native-existing'})})
  expect(upload).toHaveBeenCalledTimes(1);expect(upload.mock.calls[0][0]).toBe('native-existing');expect(payload[0]).toMatchObject({type:'image',mediaType:'image/png',data:'cG5n',name:'截图.png'});expect(payload[1]).toMatchObject({type:'file',receiptId:'receipt-one',file:{attachmentId:'hash-one',name:'说明.txt',bytes:4}});expect(payload[0].file).toBeUndefined();expect(payload[1].file instanceof File).toBe(false);expect(h.get().items.every(row=>row.status==='prepared')).toBe(true)
 })
 it('部分上传失败保留全部草稿，只重试失败文件并复用同会话已准备项',async()=>{
  let fail=true;const upload=WB.uploadAssistantFile=vi.fn(async(_session,file,name)=>{if(name==='二.txt'&&fail)throw Error('上传连接中断');return {receiptId:'receipt-'+name,file:{attachmentId:'hash-'+name,name,bytes:file.size}}}),h=attachmentHarness()
  act(()=>h.get().add([new File(['a'],'一.txt'),new File(['b'],'二.txt')]))
  await act(async()=>{await expect(h.get().prepare({sessionId:'same-native'})).rejects.toThrow('上传连接中断')})
  expect(h.get().items.map(row=>row.status)).toEqual(['prepared','failed']);expect(screen.getByText('上传连接中断')).toBeTruthy()
  const ids=h.get().items.map(row=>row.id);act(()=>h.get().retry(ids[1]));fail=false;let payload;await act(async()=>{payload=await h.get().prepare({sessionId:'same-native',ids})})
  expect(upload.mock.calls.map(row=>row[2])).toEqual(['一.txt','二.txt','二.txt']);expect(payload.map(row=>row.id)).toEqual(ids)
  act(()=>h.get().clearSent(ids));expect(h.get().items).toEqual([])
 })
 it('本轮捕获ID不串入后来添加的附件，已移除项不能悄悄忽略',async()=>{
  WB.uploadAssistantFile=vi.fn(async(_session,file,name)=>({receiptId:name,file:{attachmentId:name,name,bytes:file.size}}));const h=attachmentHarness()
  act(()=>h.get().add([new File(['a'],'原附件.txt')]));const [id]=h.get().items.map(row=>row.id);act(()=>h.get().add([new File(['b'],'下条附件.txt')]))
  let payload;await act(async()=>{payload=await h.get().prepare({sessionId:'same-native',ids:[id]})});expect(payload.map(row=>row.name)).toEqual(['原附件.txt']);act(()=>h.get().clearSent([id]));expect(h.get().items.map(row=>row.name)).toEqual(['下条附件.txt']);await expect(h.get().prepare({sessionId:'same-native',ids:[id]})).rejects.toThrow(/已移除/)
 })
 it('上传中切换会话不把原回执写进新草稿，同scope并发准备只上传一次',async()=>{
  let release;const upload=WB.uploadAssistantFile=vi.fn(()=>new Promise(resolve=>{release=resolve})),h=attachmentHarness();act(()=>h.get().add([new File(['a'],'原文件.txt')]));const original=h.get(),first=original.prepare({sessionId:'native-one'}),second=original.prepare({sessionId:'native-one'});h.change(key());act(()=>h.get().add([new File(['b'],'新文件.txt')]));await act(async()=>release({receiptId:'r-one',file:{attachmentId:'hash-one',name:'原文件.txt',bytes:1}}));await Promise.all([first,second]);expect(upload).toHaveBeenCalledTimes(1);expect(h.get().items[0].name).toBe('新文件.txt');expect(h.get().items[0].receiptId).toBeUndefined();h.change(h.scope);expect(h.get().items[0].uploadedSessionId).toBe('native-one')
 })
 it('原生会话变化时不能复用别的会话上传授权，且发送失败保留可重传文件',async()=>{
  const upload=WB.uploadAssistantFile=vi.fn(async(session,file,name)=>({receiptId:session,file:{attachmentId:'hash',name,bytes:file.size}})),h=attachmentHarness();act(()=>h.get().add([new File(['a'],'文件.txt')]))
  await act(async()=>{await h.get().prepare({sessionId:'native-one'});await h.get().prepare({sessionId:'native-two'})});expect(upload.mock.calls.map(row=>row[0])).toEqual(['native-one','native-two']);act(()=>h.get().markFailed(h.get().items.map(row=>row.id),'模型暂不接受附件'));expect(h.get().items[0].file).toBeInstanceOf(File);expect(h.get().items[0].receiptId).toBeUndefined();expect(screen.getByText('模型暂不接受附件')).toBeTruthy()
 })
 it('图片限额或上传能力不满足时不丢附件、不发送文件',async()=>{
  const upload=WB.uploadAssistantFile=vi.fn(),h=attachmentHarness();act(()=>h.get().add([new File(['large'],'截图.png',{type:'image/png'})]));await act(async()=>{await expect(h.get().prepare({sessionId:'native',imageLimits:{maxImageBytes:2}})).rejects.toThrow(/超过/)});expect(upload).not.toHaveBeenCalled();expect(h.get().items[0].status).toBe('failed');act(()=>{h.get().remove(h.get().items[0].id);h.get().add([new File(['a'],'说明.txt')])});WB.nativeAttachmentCapabilities=()=>({fileUpload:false});await act(async()=>{await expect(h.get().prepare({sessionId:'native'})).rejects.toThrow(/上传能力/)});expect(upload).not.toHaveBeenCalled();expect(h.get().items).toHaveLength(1)
 })
 it('拖放和粘贴附件只交给本轮add，禁用时仍阻止浏览器打开文件',()=>{
  const add=vi.fn(),file=new File(['a'],'a.txt'),event={preventDefault:vi.fn(),dataTransfer:{types:['Files'],files:[file]},clipboardData:{files:[file]}};const handlers=attachmentDragHandlers(add);handlers.onDragOver(event);handlers.onDrop(event);handlers.onPaste(event);expect(add.mock.calls).toEqual([[[file]],[[file],true]]);attachmentDragHandlers(add,true).onDrop(event);expect(add).toHaveBeenCalledTimes(2);expect(event.preventDefault).toHaveBeenCalledTimes(4)
 })
})

describe('添加资料与引用事项选择',()=>{
 it('按类型列出中文状态和最近记录，默认隐藏已完成待办及已处理回复',async()=>{
  const user=pickerHarness();await user.click(screen.getByRole('button',{name:'添加上下文'}));const region=screen.getByRole('region',{name:'选择上下文'});expect(region.textContent).not.toContain('completed');expect(within(region).queryByText('历史验收记录')).toBeNull();expect(within(region).queryByText('已回复的项目问题')).toBeNull();expect(within(region).getByText(/待办 · 进行中/)).toBeTruthy();const rows=region.querySelectorAll('.wb-context-choice');expect(rows[0].textContent).toContain('确认字段验收口径');expect(rows[1].textContent).toContain('原始项目说明');await user.click(screen.getByRole('button',{name:'待回复',exact:true}));expect(within(region).getByRole('checkbox',{name:'引用待回复：确认字段验收口径'})).toBeTruthy();expect(within(region).queryByText('接口联调核对')).toBeNull();await user.click(screen.getByRole('checkbox',{name:'包含已完成'}));expect(within(region).getByText('已回复的项目问题')).toBeTruthy()
 })
 it('勾选和清空都暂存，取消保留原引用，确认后一次应用',async()=>{
  const original={kind:'knowledge',id:'knowledge',title:'发布验收规范'},user=pickerHarness([original]);await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.click(screen.getByRole('checkbox',{name:'引用待办：接口联调核对'}));expect(WB.store.get().assistantRefs).toEqual([original]);await user.click(screen.getByRole('button',{name:'清空选择'}));await user.click(screen.getByRole('button',{name:'取消',exact:true}));expect(WB.store.get().assistantRefs).toEqual([original]);await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.click(screen.getByRole('checkbox',{name:'引用待回复：确认字段验收口径'}));await user.click(screen.getByRole('button',{name:'添加 2 项'}));expect(WB.store.get().assistantRefs.map(row=>row.kind)).toEqual(['knowledge','reply'])
 })
 it('搜索被默认隐藏的已完成项时提供明确扩大范围入口',async()=>{
  const user=pickerHarness();await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.type(screen.getByRole('textbox',{name:'搜索上下文'}),'历史验收');expect(screen.getByText('没有匹配的事项')).toBeTruthy();await user.click(screen.getByRole('button',{name:'同时搜索已完成事项'}));await user.click(screen.getByRole('checkbox',{name:'引用待办：历史验收记录'}));await user.click(screen.getByRole('button',{name:'添加 1 项'}));expect(WB.store.get().assistantRefs[0]).toMatchObject({id:'old',kind:'task',meta:'待办 · 已完成'})
 })
 it('上下文变更时关闭旧选择窗口，不把旧事项草稿写到新会话',async()=>{
  const user=pickerHarness();await user.click(screen.getByRole('button',{name:'添加上下文'}));await user.click(screen.getByRole('checkbox',{name:'引用待办：接口联调核对'}));await act(async()=>WB.store.set({assistantConversationId:key(),assistantRefs:[]}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(WB.store.get().assistantRefs).toEqual([])
 })
 it('加号入口区分附件与事项，选择文件没有提交模型或改变引用',async()=>{
  const add=vi.fn(),user=userEvent.setup();WB.store.set({assistantRefs:[],assistantConversationId:key()});render(<AssistantAddMaterials data={fixture()} refs={[]} onAddFiles={add}/>);await user.click(screen.getByRole('button',{name:'添加资料'}));expect(screen.getByRole('menuitem',{name:/上传附件/})).toBeTruthy();await user.click(screen.getByRole('menuitem',{name:/引用事项/}));expect(screen.getByRole('dialog')).toBeTruthy();await user.click(screen.getByRole('button',{name:'取消',exact:true}));const file=new File(['file'],'说明.txt');await user.upload(screen.getByLabelText('选择助手附件'),file);expect(add).toHaveBeenCalledWith([file]);expect(WB.store.get().assistantRefs).toEqual([])
 })
 it('加号菜单支持键盘导航，引用弹窗聚焦搜索并在自身范围循环',async()=>{
  const user=userEvent.setup();WB.store.set({assistantRefs:[],assistantConversationId:key()});render(<AssistantAddMaterials data={fixture()} refs={[]} onAddFiles={vi.fn()}/>);const trigger=screen.getByRole('button',{name:'添加资料'});await user.click(trigger);expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:/上传附件/}));await user.keyboard('{ArrowDown}');expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:/引用事项/}));await user.keyboard('{Enter}');expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'搜索上下文'}));screen.getByRole('button',{name:'添加 0 项'}).focus();await user.tab();expect(document.activeElement).toBe(screen.getByRole('button',{name:'关闭'}));await user.tab({shift:true});expect(document.activeElement).toBe(screen.getByRole('button',{name:'添加 0 项'}));await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger)
 })
 it('本地文件选择器晚到时仍把文件交给打开选择器的原会话',async()=>{
  const original=vi.fn(),next=vi.fn(),user=userEvent.setup(),view=render(<AssistantAddMaterials data={fixture()} refs={[]} onAddFiles={original}/>);await user.click(screen.getByRole('button',{name:'添加资料'}));await user.click(screen.getByRole('menuitem',{name:/上传附件/}));view.rerender(<AssistantAddMaterials data={fixture()} refs={[]} onAddFiles={next}/>);const file=new File(['late'],'晚到的附件.txt');await user.upload(screen.getByLabelText('选择助手附件'),file);expect(original).toHaveBeenCalledWith([file]);expect(next).not.toHaveBeenCalled()
 })
 it('已有选中完成项仍可取消，五种可解析引用均在候选中',()=>{
  const rows=assistantContextCandidates(fixture());expect(new Set(rows.map(row=>row.kind))).toEqual(new Set(['task','reply','source','radar','knowledge']));expect(rows.find(row=>row.id==='knowledge').meta).toBe('知识 · 已确认')
 })
})
