import type {WebAIFile} from '../../../shared/web-ai-attachments.js'
import {WEB_AI_ACTIVE,type WebAIState,type WebAIAnswer} from '../../../shared/web-ai.js'
import type {WebsiteController} from './NativeWebsite.js'
import {selectCapturedTurn} from './capture.js'
type Update=(value:Partial<WebAIAnswer>)=>Promise<void>
/** A submitted message is never automatically retried, including after sleep or timeout. */
export async function runWebsiteQuestion(controller:WebsiteController,question:string,requestId:string,update:Update,signal:AbortSignal,prepareOnly=false,clock=()=>Date.now(),pause=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms)),attachments:WebAIFile[]=[]){
 const check=()=>{if(signal.aborted)throw new Error('已停止采集；请在官网核对已发送的内容')}
 check();let before=await controller.execute('observe',question);check()
 const readyUntil=clock()+15000
 while(before.status==='unsupported'&&before.editorCount===0&&!/弹窗/.test(before.note||'')&&clock()<readyUntil){await pause(500);check();before=await controller.execute('observe',question);check()}
 await update({status:'preparing',capture:{answerCount:Number.isFinite(before.answerCount)?before.answerCount:(before.answers||[]).length,userCount:Number.isFinite(before.userCount)?before.userCount:null,...(before.lastAnswerId?{lastAnswerId:before.lastAnswerId}:{}),...(before.lastAnswerHash?{lastAnswerHash:before.lastAnswerHash}:{}),...(before.conversationKey?{conversationKey:before.conversationKey}:{})}})
 if(before.status==='needs_login'||before.status==='unsupported'||before.busy||before.hasAttachmentDraft&&!before.attachmentsOwned){await update({status:before.status==='needs_login'?'needs_login':'unsupported',note:before.hasAttachmentDraft?'官网已有附件草稿，请先在原对话处理；本轮未发送':before.note||'请先在官网结束当前操作',url:before.url});return}
 const prepared=await controller.execute('prepare',question,requestId);check()
 if(prepared.status!=='prepared'){await update({status:prepared.status==='needs_login'?'needs_login':prepared.status==='uncertain'?'uncertain':'unsupported',note:prepared.note,url:prepared.url});return}
 if(attachments.length){
  if(!controller.attach){await update({status:'unsupported',note:'当前环境未提供官网附件能力，问题未发送'});return}
  await update({status:'preparing',note:'正在上传附件，就绪后才发送问题',url:prepared.url})
  const uploaded=await controller.attach(attachments,question,requestId,signal);check()
  if(uploaded.status!=='attached'){await update({status:'unsupported',note:uploaded.note||'附件未就绪，问题未发送',url:prepared.url});return}
  before=await controller.execute('observe',question);check()
  if(before.busy||before.status==='needs_login'){await update({status:'unsupported',note:'附件处理期间官网状态已变化，问题未发送，请核对原对话'});return}
  await update({status:'preparing',capture:{answerCount:before.answerCount||0,userCount:before.userCount??null,...(before.lastAnswerId?{lastAnswerId:before.lastAnswerId}:{}),...(before.lastAnswerHash?{lastAnswerHash:before.lastAnswerHash}:{}),...(before.conversationKey?{conversationKey:before.conversationKey}:{})}})
 }
 await update({status:'prepared',note:prepared.note,url:prepared.url})
 if(prepareOnly)return
 // Let framework-controlled inputs settle; submission uses a fresh DOM observation.
 await pause(150);check();let sent=await controller.execute('submit',question,requestId);check()
 // Only wait before a click. Never retry a submission that might already have reached the website.
 for(let attempt=0;sent.status==='prepared'&&sent.retryableBeforeSend===true&&attempt<4;attempt++){
  await pause(300);check();sent=await controller.execute('submit',question,requestId);check()
 }
 if(sent.status!=='generating'){await update({status:sent.status==='prepared'?'prepared':sent.status==='needs_login'?'needs_login':'uncertain',note:sent.note,url:sent.url});return}
 await update({status:'generating',note:sent.note,url:sent.url})
 await collectWebsiteAnswer(controller,question,before,update,signal,clock,pause)
}
export async function collectWebsiteAnswer(controller:WebsiteController,question:string,before:any,update:Update,signal:AbortSignal,clock=()=>Date.now(),pause=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))){
 const check=()=>{if(signal.aborted)throw new Error('已停止采集；不会发送问题')}
 const baseline=Array.isArray(before.answers)?before.answers:null,baselineCount=Number.isFinite(before.answerCount)?before.answerCount:(baseline?.length||0)
 const started=clock();let previousTime=started,last='',stable=0,sawBusy=false,accepted=false,lastIdentity=''
 while(clock()-started<300000){
  await pause(1500);check();const now=clock();if(now-previousTime>45000)throw new Error('检测到休眠或运行暂停，请核对官网；不会重新发送');previousTime=now
  const next=await controller.execute('observe',question);check()
  if(next.status==='needs_login'){await update({status:'needs_login',note:next.note,url:next.url});return}
  if(next.status==='unsupported'&&/弹窗/.test(next.note||'')){await update({status:'uncertain',note:next.note,url:next.url});return}
  sawBusy||=!!next.busy
  if(Array.isArray(next.turns)){
   const selected=selectCapturedTurn(next,question,before)
   if(selected.ambiguous&&(next.busy||clock()-started<15000))continue
   if(selected.foreign||selected.ambiguous){await update({status:'uncertain',note:selected.foreign?'官网已出现其他提问，本轮停止采集以免混入其他回答。':'官网可见历史范围已变化，无法确认本轮回答；请核对后恢复采集。',url:next.url});return}
   const turn=selected.turn
   accepted||=!!next.busy||!!turn||Number.isFinite(next.userCount)&&Number.isFinite(before.userCount)&&next.userCount>before.userCount
   if(turn?.text){
    const same=turn.id===lastIdentity&&turn.text===last;stable=same?stable+1:0;lastIdentity=turn.id;last=turn.text
    if(turn.truncated){await update({status:'uncertain',text:last,note:'回答超过60000字符，已保留前段，请在官网查看完整内容。',url:next.url});return}
    await update({status:'generating',text:last,note:'正在采集官网本轮完整回答',url:next.url})
    if(!next.busy&&turn.complete&&stable>=1){await update({status:'completed',text:last,note:'已采集官网完整回答',url:next.url});return}
   }
   if(!accepted&&clock()-started>15000){await update({status:'prepared',note:'官网尚未确认接收问题，请在原对话核对；不会重复点击发送。',url:next.url});return}
   continue
  }
  const newUser=Number.isFinite(next.userCount)&&Number.isFinite(before.userCount)&&next.userCount>before.userCount
  if(newUser&&next.lastQuestion&&String(next.lastQuestion).replace(/\s+/g,' ').trim()!==question.replace(/\s+/g,' ').trim()){await update({status:'uncertain',note:'官网已出现其他提问，本轮停止采集以免混入其他回答。',url:next.url});return}
  const answers=Array.isArray(next.answers)?next.answers:[],tail=answers.at(-1)||''
  // A new container or changed last container is required. Never reuse an old answer.
  const count=Number.isFinite(next.answerCount)?next.answerCount:answers.length
  const changed=tail&&(count>baselineCount||baseline!==null&&tail!==baseline.at(-1))
  accepted||=!!next.busy||newUser||!!changed
  if(!accepted&&clock()-started>12000){await update({status:'prepared',note:'官网尚未确认接收问题，请登录或在原对话核对；不会重复点击发送。',url:next.url});return}
  if(changed){stable=tail===last?stable+1:0;last=tail;await update({status:'generating',text:tail,url:next.url,note:'正在采集官网本轮回答'})
   if(!next.busy&&(sawBusy||next.complete===true)&&stable>=1){await update({status:'completed',text:tail,url:next.url,note:'已采集官网回答'});return}
   if(!next.busy&&!sawBusy&&next.complete!==true&&stable>=3){await update({status:'uncertain',text:tail,url:next.url,note:'已采集新内容，但未识别官网结束状态，请核对后保存。'});return}}
 }
 await update({status:'uncertain',text:last,note:'五分钟内未能确认新回答完成，可在官网核对后粘贴保存。'})
}
export function pendingWebAIRounds(state:WebAIState,requestId:string){return state.rounds.filter(r=>r.requestId===requestId&&r.answers.some(a=>WEB_AI_ACTIVE.has(a.status)))}
