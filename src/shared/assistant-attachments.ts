/** Metadata may be persisted. Upload receipts and image bytes belong only to a send request. */
export interface AssistantAttachment {
 id:string;type:'image'|'file';name:string;size:number;mediaType?:string
 attachmentId?:string;width?:number;height?:number
}
export interface AssistantAttachmentInput extends AssistantAttachment {
 data?:string;receiptId?:string;file?:{attachmentId:string;name:string;bytes:number}
}
export const ASSISTANT_MAX_ATTACHMENTS=20
export const ASSISTANT_IMAGE_MEDIA_TYPES=['image/png','image/jpeg','image/webp','image/gif'] as const
export const ASSISTANT_DEFAULT_IMAGE_LIMITS={maxImageBytes:20*1024*1024,maxImagesPerMessage:20,maxMessageImageBytes:200*1024*1024,mediaTypes:[...ASSISTANT_IMAGE_MEDIA_TYPES]}
export function assistantAttachmentName(value:any,fallback='附件'):string {
 const name=typeof value==='string'?value.split(/[\\/]/).at(-1)||'':''
 return name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,180)||fallback
}
/** Read only durable references written by Harness; never project inline bytes or bearer receipts. */
export function nativeAssistantAttachments(content:any,previous:AssistantAttachment[]=[]):AssistantAttachment[]{
 if(!Array.isArray(content))return []
 return content.filter(part=>part?.type==='image'||part?.type==='file').flatMap((part,index)=>{
  const ref=part.attachment
  if(!ref||typeof ref.attachmentId!=='string'||!Number.isSafeInteger(ref.bytes)||ref.bytes<0)return []
  return [{id:previous[index]?.id||ref.attachmentId,type:part.type,name:assistantAttachmentName(ref.name,part.type==='image'?'图片':'文件'),size:ref.bytes,attachmentId:ref.attachmentId,...(part.type==='image'?{mediaType:ref.mediaType,...(Number.isFinite(ref.width)?{width:ref.width}:{}),...(Number.isFinite(ref.height)?{height:ref.height}:{})}:{})}]
 })
}
