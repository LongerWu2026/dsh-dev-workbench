import {WB} from '../../core/runtime.js'

const collections:Record<string,string>={task:'tasks',reply:'replies',source:'sources',knowledge:'knowledge',radar:'radar'}
const enterpriseChats=new Map<string,Promise<any>>()
let continuationVersion=0
async function continueEnterpriseResult(ref:any,accountId:string){
 const token=++continuationVersion,state=WB.store.get(),page=state.page,opened=state.assistantOpenSeq
 try{
  let conversationId=state.enterpriseSearchConversationId===state.assistantConversationId&&state.enterpriseSearchAccountId===accountId&&state.assistantConversationId?.startsWith('chat:')?state.assistantConversationId:null
  if(!conversationId){
   let pending=enterpriseChats.get(accountId)
   if(!pending){const created=Promise.resolve(WB.actions.assistantHub({action:'reset'}));pending=created;enterpriseChats.set(accountId,created);void created.finally(()=>{if(enterpriseChats.get(accountId)===created)enterpriseChats.delete(accountId)}).catch(()=>{})}
   const result=await pending
   if(result?.status!=='ok'||!result.conversationId?.startsWith('chat:'))throw Error(result?.note||'无法打开云之家查询对话')
   conversationId=result.conversationId
  }
  const current=WB.store.get()
  if(token!==continuationVersion||current.page!==page||current.assistantOpenSeq!==opened)return
  WB.assistant.openHub(conversationId)
  WB.store.set({assistantRefs:[ref],enterpriseSearchConversationId:conversationId,enterpriseSearchAccountId:accountId})
 }catch(error){if(token===continuationVersion)WB.toast(String(error.message||error),'err')}
}
export function searchRecord(item:any){return (WB.store.get().data?.[collections[item.kind]]||[]).find((row:any)=>row.id===item.id)}
export function searchResultBody(item:any):string {
 const row=searchRecord(item)
 if(!row)return String(item.snippet||'')
 return String(row.description||row.body||row.excerpt||row.snippet||Object.values(row.summary||{}).filter(value=>typeof value==='string').join('\n')||item.snippet||'')
}
/** Each entry replaces the selected context and restores the item's original
 * conversation. External hits remain attributed excerpts, never local IDs. */
export function continueSearchResult(item:any,groupLabel=''){
 const data=WB.store.get().data||{},record=searchRecord(item)
 const local=!!record||item.kind==='task'||item.kind==='reply'
 const ref={kind:local?item.kind:'search',id:String(item.id),title:item.title,url:item.url||undefined,body:item.snippet||'',meta:'搜索来源：'+groupLabel}
 if(local&&['task','reply','knowledge','radar'].includes(item.kind)){WB.assistant.openFor(ref);return}
 if(!record&&item.extra?.provider==='yunzhijia'){void continueEnterpriseResult({...ref,meta:'搜索来源：云之家 · '+groupLabel},String(item.extra.accountId||''));return}
 if(record&&item.kind==='source'){
  const reply=(data.replies||[]).find((row:any)=>!row.archivedAt&&row.sourceId===item.id)
  const task=(data.tasks||[]).find((row:any)=>!row.archivedAt&&(row.sourceRefId===item.id||row.sourceRefs?.some((source:any)=>source.sourceId===item.id)))
  if(reply){WB.assistant.openFor({kind:'reply',id:reply.id,title:reply.snippet||reply.contact});return}
  if(task){WB.assistant.openFor({kind:'task',id:task.id,title:task.title});return}
 }
 WB.assistant.openHub('system',record&&item.kind==='source'?'analysis':item.kind==='knowledge'?'knowledge':'radar')
 WB.store.set({assistantRefs:[{...ref,kind:record?item.kind:'search'}]})
}
export function openSearchResult(item:any,groupLabel=''){
 if(item.kind==='task'){WB.focusTask(item.id);return}
 if(item.kind==='reply'){WB.openReply(item.id);return}
 WB.store.set({searchResult:{item,groupLabel}})
}
export function fullSearchResults(query:string,category='all',scope='local'){
 WB.setSearchPreset({query,category,scope});WB.go('search');WB.store.set({assistantOpen:false,contextHidden:true})
}
export function searchInternetWithAssistant(query=''){
 const conversationId='system:radar'
 WB.assistant.openHub('system','radar')
 WB.store.set({assistantDraftRequest:{id:'search-'+Date.now(),conversationId,text:query?'请搜索互联网：'+query+'。请提供可核对的来源链接。':'请帮我搜索互联网资料。'}})
}
