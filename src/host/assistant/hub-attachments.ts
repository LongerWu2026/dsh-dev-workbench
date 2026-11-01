import {createHash} from 'node:crypto'
import {ASSISTANT_DEFAULT_IMAGE_LIMITS,ASSISTANT_IMAGE_MEDIA_TYPES,ASSISTANT_MAX_ATTACHMENTS,assistantAttachmentName,type AssistantAttachment} from '../../shared/assistant-attachments.js'
export function hubImageLimits(value:any){
 const defaults=ASSISTANT_DEFAULT_IMAGE_LIMITS
 return {maxImageBytes:Number.isSafeInteger(value?.maxImageBytes)&&value.maxImageBytes>0?value.maxImageBytes:defaults.maxImageBytes,maxImagesPerMessage:Number.isSafeInteger(value?.maxImagesPerMessage)&&value.maxImagesPerMessage>0?value.maxImagesPerMessage:defaults.maxImagesPerMessage,maxMessageImageBytes:Number.isSafeInteger(value?.maxMessageImageBytes)&&value.maxMessageImageBytes>0?value.maxMessageImageBytes:defaults.maxMessageImageBytes,mediaTypes:Array.isArray(value?.mediaTypes)?value.mediaTypes.filter((type:any)=>ASSISTANT_IMAGE_MEDIA_TYPES.includes(type)):defaults.mediaTypes}
}
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex')
/** Validate the complete ordered batch before any rule, allocation, or model operation. */
export function prepareHubAttachments(input:any,limitsValue?:any):{metadata:AssistantAttachment[];content:any[];signature?:string}{
 if(input===undefined)return {metadata:[],content:[]}
 if(!Array.isArray(input)||input.length>ASSISTANT_MAX_ATTACHMENTS)throw Error('每条消息最多添加 '+ASSISTANT_MAX_ATTACHMENTS+' 个附件')
 if(!input.length)return {metadata:[],content:[]}
 const limits=hubImageLimits(limitsValue),ids=new Set<string>(),metadata:AssistantAttachment[]=[],content:any[]=[],identity:any[]=[];let imageBytes=0,imageCount=0
 for(const item of input){
  if(!item||typeof item!=='object'||!['image','file'].includes(item.type)||typeof item.id!=='string'||!item.id.trim()||item.id.length>240||ids.has(item.id)||!Number.isSafeInteger(item.size)||item.size<0)throw Error('附件信息无效，请重新选择该附件')
  ids.add(item.id);const name=assistantAttachmentName(item.name,item.type==='image'?'图片':'文件'),base={id:item.id,type:item.type,name,size:item.size};let fingerprint=''
  if(item.type==='image'){
   if(!limits.mediaTypes.includes(item.mediaType))throw Error('图片「'+name+'」格式不支持，请使用 PNG、JPEG、WebP 或 GIF')
   if(typeof item.data!=='string'||item.data.length>Math.ceil(limits.maxImageBytes/3)*4||!item.data.length||item.data.length%4!==0||!(/^[A-Za-z0-9+/]+={0,2}$/).test(item.data))throw Error('图片「'+name+'」内容无效或超过大小限制')
   const bytes=Buffer.from(item.data,'base64');if(bytes.toString('base64')!==item.data||bytes.length!==item.size)throw Error('图片「'+name+'」内容与大小不一致，请重新选择')
   imageCount++;imageBytes+=bytes.length;if(bytes.length>limits.maxImageBytes||imageCount>limits.maxImagesPerMessage||imageBytes>limits.maxMessageImageBytes)throw Error('图片附件超过当前宿主的数量或大小限制')
   metadata.push({...base,mediaType:item.mediaType});content.push({type:'image',mediaType:item.mediaType,data:item.data,name});fingerprint=hash(bytes)
  }else{
   if(typeof item.receiptId!=='string'||!(/^[A-Za-z0-9_.:-]{1,240}$/).test(item.receiptId))throw Error('文件「'+name+'」尚未上传成功，请重试上传')
   if(item.file&&((typeof item.file.attachmentId!=='string'||!(/^[A-Za-z0-9_.:-]{16,180}$/).test(item.file.attachmentId))||item.file.bytes!==item.size))throw Error('文件「'+name+'」上传结果与所选文件不一致')
   metadata.push({...base,...(typeof item.mediaType==='string'?{mediaType:item.mediaType.slice(0,120)}:{})});content.push({type:'file',receiptId:item.receiptId});fingerprint=item.file?.attachmentId||hash(item.receiptId)
  }
  identity.push([item.id,item.type,name,item.size,item.mediaType||'',fingerprint])
 }
 return {metadata,content,signature:hash(JSON.stringify(identity))}
}
export function attachmentFailureMessage(error:any):string {
 const note=String(error?.message||error),reason=error?.details?.reason||error?.data?.reason
 if(reason==='MODEL_DOES_NOT_SUPPORT_IMAGES'||/does not support image input/i.test(note))return '当前模型不支持图片，请切换支持图片的模型或移除图片；附件草稿仍保留。'
 if(reason==='FILE_NOT_STAGED'||/not uploaded for this session/i.test(note))return '附件上传凭证已失效或不属于当前会话，请重新上传；未更换原会话。'
 return note
}
/** Only explicit native admission rejections prove that repeating this attempt is safe. */
export function attachmentAdmissionRejected(error:any):boolean {
 const reason=error?.details?.reason||error?.data?.reason
 if(['MODEL_DOES_NOT_SUPPORT_IMAGES','FILE_NOT_STAGED'].includes(reason))return true
 return ['session/attachment-invalid','session/model-unavailable','session/invalid-time-zone','gateway/bad-request'].includes(error?.code)
}
const attachmentReadTools=new Set(['workbench_list_tasks','workbench_search','workbench_task_brief','workbench_knowledge_retrieve','workbench_knowledge_read'])
const attachmentReadOperations=new Set(['analysis.status','analysis.results','knowledge.search','office.status','busyReply.status','development.detail'])
/** An attachment by itself is reference material, not authorization to change business records. */
export function attachmentOnlyToolGuard(execution:any):string|undefined {
 const name=String(execution?.name||'');if(!name.startsWith('workbench_'))return undefined
 let args=execution?.arguments;try{if(typeof args==='string')args=JSON.parse(args)}catch{args={}}
 if(attachmentReadTools.has(name)||name==='workbench_assistant_action'&&attachmentReadOperations.has(args?.operation)||name==='workbench_office_workflow'&&args?.action==='status'||['workbench_manage_replies','workbench_manage_knowledge'].includes(name)&&args?.action==='list')return undefined
 return '本条只有附件，尚未授权修改业务记录；请先概括附件或询问具体操作，等待用户明确指令。'
}
