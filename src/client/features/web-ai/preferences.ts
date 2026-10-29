import type {WebAITopic} from '../../../shared/web-ai.js'
const key=(scope:string)=>'dsh-workbench:web-ai:last-topic:'+scope
/** UI preference only. Website credentials and question text never enter this store. */
export function restoreWebAITopic(scope:string,topics:readonly WebAITopic[],storage?:Pick<Storage,'getItem'>):string{
 try{const value=(storage||window.localStorage).getItem(key(scope));if(value===''||topics.some(t=>t.id===value&&!t.deletedAt))return value||''}catch{}
 return topics.filter(t=>!t.deletedAt).at(-1)?.id||''
}
export function rememberWebAITopic(scope:string|undefined,id:string,storage?:Pick<Storage,'setItem'>){
 if(!scope)return
 try{(storage||window.localStorage).setItem(key(scope),id)}catch{/* Memory-only UI remains usable when storage is unavailable. */}
}
