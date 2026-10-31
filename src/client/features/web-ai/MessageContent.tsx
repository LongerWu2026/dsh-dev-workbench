import * as React from 'react'
import {mdInline,mdParse} from '../toolbox/tools/markdown.js'

/** React text nodes only; website-provided HTML is never inserted into the workbench. */
export const MessageContent=React.memo(function MessageContent({text}:{text:string}){
 return <div className="wb-chat-markdown">{mdParse(text).map((block:any,index:number)=>{
  if(block.type==='code')return <pre key={index} className="wb-chat-code"><code>{block.text}</code></pre>
  if(block.type==='heading')return <h4 key={index}>{mdInline(block.text,'heading-'+index)}</h4>
  if(block.type==='list')return React.createElement(block.ordered?'ol':'ul',{key:index},block.items.map((item:string,i:number)=><li key={i}>{mdInline(item,'item-'+index+'-'+i)}</li>))
  if(block.type==='quote')return <blockquote key={index}>{mdInline(block.text,'quote-'+index)}</blockquote>
  if(block.type==='hr')return <hr key={index}/>
  return <p key={index}>{mdInline(block.text||'','paragraph-'+index)}</p>
 })}</div>
})
