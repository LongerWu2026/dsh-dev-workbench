import {spawn,type ChildProcess} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {webAIProvider,webAIConversationUrl} from '../../shared/web-ai.js'

/** A connection to OUR dedicated Chrome profile. Never attaches to a user's normal browser. */
export class WebAIChrome {
 private socket:WebSocket|null=null
 private child:ChildProcess|null=null
 private starting:Promise<void>|null=null
 private sequence=0
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>()
 private tabs=new Map<string,{targetId:string;sessionId?:string}>()
 private closed=false
 constructor(readonly profileDir:string,private options:{executable?:string;headless?:boolean}={}){}
 executable(){return this.options.executable||[
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ...(process.platform==='win32'?[join(process.env.PROGRAMFILES||'C:\\Program Files','Google/Chrome/Application/chrome.exe'),join(process.env.LOCALAPPDATA||'C:\\','Google/Chrome/Application/chrome.exe')]:[]),
  '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser',
 ].find(p=>existsSync(p))||null}
 available(){return !!this.executable()&&typeof WebSocket==='function'}
 private fail(){this.socket=null;this.tabs.forEach(t=>delete t.sessionId);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('专用浏览器连接已断开；请核对官网后再操作'))}this.pending.clear()}
 private async connect(){
  const file=join(this.profileDir,'DevToolsActivePort');if(!existsSync(file))throw new Error('浏览器尚未就绪')
  const [port,path]=readFileSync(file,'utf8').trim().split(/\r?\n/)
  if(!/^\d{1,5}$/.test(port)||Number(port)>65535||Number(port)<1||!/^\/devtools\/browser\/[\w-]+$/.test(path))throw new Error('浏览器连接信息无效')
  const ws=new WebSocket('ws://127.0.0.1:'+port+path)
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(new Error('浏览器连接超时'))},1200);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('浏览器连接不可用'))},{once:true})})
  if(this.closed){ws.close();throw new Error('网页 AI 服务已停止')}
  this.socket=ws
  ws.addEventListener('message',e=>{let m:any;try{m=JSON.parse(String(e.data))}catch{return}const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(new Error('浏览器操作未成功，请在官网检查当前状态'));else p.resolve(m.result)})
  ws.addEventListener('close',()=>{if(this.socket===ws)this.fail()})
  await this.call('Browser.getVersion')
 }
 private async ensure(){
  if(this.closed)throw new Error('网页 AI 服务已停止')
  if(this.socket?.readyState===WebSocket.OPEN)return
  if(this.starting)return this.starting
  this.starting=(async()=>{
   mkdirSync(this.profileDir,{recursive:true,mode:0o700})
   try{await this.connect();return}catch{}
   const executable=this.executable();if(!executable)throw new Error('未找到本机 Chrome，请先安装 Chrome；不会下载或读取日常浏览器资料')
   const child=spawn(executable,['--user-data-dir='+this.profileDir,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check',...(this.options.headless?['--headless=new']:[]),'about:blank'],{stdio:'ignore',detached:false})
   this.child=child;child.unref();let launchError=false;child.once('error',()=>{launchError=true})
   const until=Date.now()+15000
   while(Date.now()<until&&!launchError&&!this.closed){try{await this.connect();return}catch{}await new Promise(r=>setTimeout(r,250))}
   throw new Error('专用浏览器启动失败或资料目录正被占用，请关闭该专用窗口后重试')
  })().finally(()=>{this.starting=null})
  return this.starting
 }
 private call(method:string,params:any={},sessionId?:string):Promise<any>{
  const ws=this.socket;if(!ws||ws.readyState!==WebSocket.OPEN)return Promise.reject(new Error('专用浏览器未连接'))
  const id=++this.sequence
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('浏览器操作超时；不会自动重复发送'))},10000);this.pending.set(id,{resolve,reject,timer});try{ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))}catch{this.pending.delete(id);clearTimeout(timer);reject(new Error('浏览器连接不可用'))}})
 }
 async open(key:string,providerId:string,url?:string|null){
  await this.ensure();const p=webAIProvider(providerId),expected=url?webAIConversationUrl(providerId,url):p.url
  if(!expected)throw new Error('官网会话地址无效')
  let tab=this.tabs.get(key)
  if(tab){try{await this.call('Target.getTargetInfo',{targetId:tab.targetId})}catch{this.tabs.delete(key);tab=undefined}}
  if(!tab){const targets=await this.call('Target.getTargets');const matches=url?targets.targetInfos.filter((t:any)=>t.type==='page'&&webAIConversationUrl(providerId,t.url)===expected&&!Array.from(this.tabs.values()).some(v=>v.targetId===t.targetId)):[];const targetId=matches.length===1?matches[0].targetId:(await this.call('Target.createTarget',{url:expected})).targetId;tab={targetId};this.tabs.set(key,tab)}
  await this.call('Target.activateTarget',{targetId:tab.targetId});return {opened:true}
 }
 private async attached(key:string,providerId:string){
  await this.ensure();const tab=this.tabs.get(key);if(!tab)throw new Error('请先打开该主题的官网页面')
  const info=await this.call('Target.getTargetInfo',{targetId:tab.targetId})
  if(!webAIConversationUrl(providerId,info.targetInfo.url))throw new Error('页面不在该厂商聊天官网，可能正在登录；请在官网完成后再试')
  if(!tab.sessionId)tab.sessionId=(await this.call('Target.attachToTarget',{targetId:tab.targetId,flatten:true})).sessionId
  return tab
 }
 async evaluate(key:string,providerId:string,script:string){
  const tab=await this.attached(key,providerId)
  const answer=await this.call('Runtime.evaluate',{expression:script,returnByValue:true,awaitPromise:true,timeout:8000},tab.sessionId)
  if(answer.exceptionDetails)throw new Error('当前官网界面尚无法识别，请直接在官网操作')
  return answer.result?.value
 }
 /** Releasing the connector leaves the visible browser and unsent website drafts intact. */
 dispose(){this.closed=true;this.socket?.close();this.fail();this.child=null}
 /** Only used by isolated browser tests on their own temporary profile. */
 async closeTestBrowser(){if(!this.options.headless)throw new Error('仅隔离测试可关闭浏览器');const child=this.child;try{await this.call('Browser.close')}catch{}this.dispose();if(child&&child.exitCode===null)await new Promise<void>(resolve=>{const timer=setTimeout(()=>{child.kill('SIGTERM');resolve()},5000);child.once('exit',()=>{clearTimeout(timer);resolve()})})}
}
