import type {WebAIAnswer} from '../../../shared/web-ai.js'
import type {WebAIAuthentication} from '../../../shared/web-ai-auth.js'

const LABEL:Record<WebAIAnswer['status'],string>={queued:'等待回答',preparing:'准备中',prepared:'已填入官网',generating:'正在回答',completed:'已保存',needs_login:'待继续采集',unsupported:'需官网操作',uncertain:'需要核对',cancelled:'已停止'}
/** A persisted capture failure is not evidence of the website's current authentication state. */
export function answerPresentation(answer:WebAIAnswer,auth?:WebAIAuthentication){
 if(answer.submission==='not_sent'&&!['queued','preparing'].includes(answer.status)&&answer.status!=='completed')return {label:auth?.status==='needs_login'?'需要登录':'尚未发送',note:auth?.status==='needs_login'?'请打开官网完成登录，本厂商的问题尚未发送。':auth?.status==='authenticated'?'官网已登录，点击发送仅提交给本厂商。':'本厂商尚未发送，请先打开官网检查登录。'}
 if(answer.status!=='needs_login')return {label:LABEL[answer.status],note:answer.note}
 if(auth?.status==='authenticated')return {label:'待继续采集',note:'官网已登录，可继续采集本轮回答。'}
 if(auth?.status==='needs_login')return {label:'需要登录',note:'官网确认需要登录，完成后可继续采集本轮回答。'}
 if(auth?.status==='verification')return {label:'需要验证',note:'请在官网完成安全验证后继续采集。'}
 return {label:'待继续采集',note:'上次采集中断，打开官网核对当前状态后可继续采集。'}
}
