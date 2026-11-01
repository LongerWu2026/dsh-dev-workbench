import * as React from 'react'
import {WB,Icon,Input,Btn,Modal} from '../core/runtime.js'
import {safeAssistantAvatar} from '../core/assistant-native.js'

export type MessageAuthor='user'|'assistant'|'rule'|'system'|'function'|'history'
type IdentityContext={assistantName:string;user:{name?:string;avatarUrl?:string};conversationId:string}
export const AssistantIdentityContext=React.createContext<IdentityContext>({assistantName:'AI 助手',user:{},conversationId:''})
export function assistantFunctionName(conversationId:string,operation?:string){
 const kind=operation?.split('.')[0]||conversationId.split(':')[0]
 if(conversationId==='system:analysis'||kind==='analysis')return '消息识别'
 if(conversationId==='system:radar'||kind==='radar'||kind==='summary')return 'AI 资讯'
 if(conversationId==='system:knowledge'||kind==='knowledge')return '知识助手'
 if(kind==='development')return '研发任务'
 if(kind==='task'||kind==='task_assist')return '待办助手'
 if(kind==='reply'||kind==='reply_batch')return '回复助手'
 if(kind==='busyReply')return '自动回复'
 if(kind==='work_report')return '工作报告'
 if(kind==='office'||conversationId==='system:office')return '工作台'
 return '系统'
}
export function MessageRow({author='assistant',at,detail,operation,label,children,className=''}:{author?:MessageAuthor;at?:any;detail?:string;operation?:string;label?:string;children:React.ReactNode;className?:string}){
 const context=React.useContext(AssistantIdentityContext),[failedAvatar,setFailedAvatar]=React.useState<string|null>(null),me=author==='user',name=label||(me?(context.user.name||'我'):author==='assistant'?context.assistantName:author==='rule'?'规则助手':author==='history'?'历史记录':author==='function'?assistantFunctionName(context.conversationId,operation):'系统'),photo=me?safeAssistantAvatar(context.user.avatarUrl):undefined,icon=author==='assistant'?'agent':author==='rule'?'command':author==='history'?'clock':'layers',time=at?new Date(at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''
 return <div className={'wb-hub-chat-row is-'+author+(me?' is-outgoing':' is-incoming')+(className?' '+className:'')} data-chat-author={author} aria-label={'消息身份：'+name}>
  <span className={'wb-hub-avatar is-'+author} aria-label={name+'的头像'}>{photo&&failedAvatar!==photo?<img src={photo} alt="" referrerPolicy="no-referrer" onError={()=>setFailedAvatar(photo)}/>:me?<span>{Array.from(name.trim())[0]||'我'}</span>:<Icon name={icon} size={17}/>}</span>
  <div className="wb-hub-chat-content"><div className="wb-hub-author"><span className="wb-hub-author-name">{name}</span>{detail&&<span className="wb-hub-author-detail">{detail}</span>}{time&&<time>{time}</time>}</div>{children}</div>
 </div>
}

export function AssistantIdentitySettings({open,onClose,name}:{open:boolean;onClose:()=>void;name:string}){
 const [draft,setDraft]=React.useState(name),[saving,setSaving]=React.useState(false),[error,setError]=React.useState('')
 React.useEffect(()=>{if(open){setDraft(name);setError('')}},[open])
 const value=draft.trim(),valid=!!value&&value.length<=40
 async function save(){if(saving||!valid)return;setSaving(true);setError('');try{await WB.actions.saveSettings({assistantName:value});onClose()}catch(failure:any){setError(failure?.message||'助手名称保存失败，请重试')}finally{setSaving(false)}}
 return <Modal open={open} title="助手设置" onClose={()=>{if(!saving)onClose()}} footer={<><Btn disabled={saving} onClick={onClose}>取消</Btn><Btn kind="primary" disabled={saving||!valid} onClick={save}>{saving?'保存中…':'保存'}</Btn></>}>
  <div className="wb-hub-identity-settings"><label htmlFor="wb-assistant-display-name">助手名称</label><Input id="wb-assistant-display-name" aria-label="助手名称" value={draft} placeholder="例如：小鲸助手" disabled={saving} onChange={(event:any)=>setDraft(event.target.value)}/><p className="wb-tiny wb-muted">用于 AI 回复的显示名称。规则和系统消息保留各自身份。</p>{!valid&&draft&&<p role="status" className="wb-tiny wb-muted">名称需要 1–40 个字符。</p>}{error&&<p role="alert" className="wb-hub-error">{error}</p>}<div className="wb-hub-identity-preview"><span className="wb-hub-avatar is-assistant"><Icon name="agent" size={17}/></span><span>{value||'AI 助手'}</span></div></div>
 </Modal>
}

export const MESSAGE_IDENTITY_CSS=`
.wb-hub-chat-row{display:flex;align-items:flex-start;gap:10px;width:100%;max-width:780px;margin:0 auto;min-width:0;flex:none}.wb-hub-chat-row.is-outgoing{flex-direction:row-reverse;padding-left:34px}.wb-hub-chat-row.is-incoming{padding-right:10px}.wb-hub-avatar{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;flex:none;margin-top:0;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);overflow:hidden;border:1px solid var(--dsw-alias-border-l1);font-size:12px;font-weight:500}.wb-hub-avatar.is-user{border-radius:50%;color:var(--dsw-alias-label-primary)}.wb-hub-avatar.is-assistant{color:var(--dsw-alias-label-primary)}.wb-hub-avatar img{width:100%;height:100%;object-fit:cover}.wb-hub-chat-content{min-width:0;max-width:calc(100% - 40px);flex:1}.wb-hub-chat-row.is-outgoing>.wb-hub-chat-content{flex:0 1 auto;min-width:100px;max-width:min(88%,680px)}.wb-hub-author{display:flex;align-items:center;min-height:30px;gap:7px;flex-wrap:wrap;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);margin:0 0 6px;line-height:1.6}.wb-hub-author-name{font-weight:500;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}.wb-hub-author-detail{font-size:10px}.wb-hub-author time{font-size:10px}.wb-hub-chat-row.is-outgoing .wb-hub-author{justify-content:flex-end}.wb-hub-chat-row .wb-assistant-message,.wb-hub-chat-row .wb-hub-event,.wb-hub-chat-row .wb-hub-notice{max-width:100%;width:100%;margin:0}.wb-hub-chat-row .wb-assistant-message.is-user{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:12px 3px 12px 12px;padding:11px 14px}.wb-hub-chat-row.is-incoming .wb-assistant-message{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:3px 12px 12px 12px;padding:12px 14px}.wb-hub-chat-row .wb-hub-turn-response{border-radius:3px 12px 12px 12px}.wb-hub-chat-row .wb-hub-system-message{border-radius:3px 12px 12px 12px;background:var(--dsw-alias-bg-layer-1)}.wb-hub-chat-row .wb-hub-confirm{max-width:100%}.wb-hub-identity-settings{display:flex;flex-direction:column;gap:10px;padding-top:8px}.wb-hub-identity-settings p{margin:0}.wb-hub-identity-preview{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}.wb-hub-identity-preview .wb-hub-avatar{margin:0}
@media(max-width:640px){.wb-hub-chat-row{gap:7px}.wb-hub-avatar{width:26px;height:26px;border-radius:8px}.wb-hub-chat-content{max-width:calc(100% - 33px)}.wb-hub-chat-row.is-incoming{padding-right:0}.wb-hub-chat-row.is-outgoing{padding-left:14px}.wb-hub-chat-row.is-outgoing>.wb-hub-chat-content{max-width:calc(100% - 33px)}.wb-hub-chat-row .wb-assistant-message.is-user{padding:9px 11px}.wb-hub-chat-row.is-incoming .wb-assistant-message{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:3px 12px 12px 12px;padding:12px 14px}.wb-hub-chat-row .wb-hub-turn-response{padding:10px}.wb-hub-author{gap:5px;min-height:26px}}
`
