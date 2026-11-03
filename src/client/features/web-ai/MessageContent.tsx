import * as React from 'react'
import MarkdownIt,{type Token} from 'markdown-it'

const markdown=new MarkdownIt({html:false,breaks:true,linkify:false,typographer:false})
const tags=new Set(['p','strong','em','s','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','a'])
const safeLink=(href:string)=>{try{const url=new URL(href);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined}catch{return undefined}}

/** Older captures put multiline trees in inline backticks. Their line breaks
 * still exist in storage; recover only this unambiguous shape for display.
 * Existing fenced/indented code and ordinary inline prose remain untouched. */
function legacyDiagramMarkdown(text:string,tokens:Token[]):string {
 const offsets=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')offsets.push(i+1)
 const protectedRanges=tokens.filter(token=>['fence','code_block'].includes(token.type)&&token.map).map(token=>[offsets[token.map![0]]??text.length,offsets[token.map![1]]??text.length])
 const repair=(part:string)=>part.replace(/(^|[^\\`])`(?!`)([^`]*)`(?!`)/g,(original,prefix:string,body:string)=>{
  if(!body.includes('\n')||!/^[ \t│┃|]*[├└┣┗][─━]{1,}/m.test(body))return original
  return prefix+'\n\n```\n'+body+'\n```\n\n'
 })
 let result='',cursor=0
 for(const [start,end] of protectedRanges){if(start<cursor)continue;result+=repair(text.slice(cursor,start))+text.slice(start,end);cursor=end}
 return result+repair(text.slice(cursor))
}

/** Render parsed tokens through an explicit React allowlist, never site HTML/CSS. */
function renderTokens(tokens:Token[],prefix='md'):React.ReactNode[]{
 let index=0
 const children=():React.ReactNode[]=>{
  const result:React.ReactNode[]=[]
  while(index<tokens.length){
   const token=tokens[index++],key=prefix+'-'+index
   if(token.nesting===-1)break
   if(token.type==='inline'){result.push(<React.Fragment key={key}>{renderTokens(token.children||[],key)}</React.Fragment>);continue}
   if(token.nesting===1){
    const content=children(),tag=token.tag
    if(!tags.has(tag)){result.push(<React.Fragment key={key}>{content}</React.Fragment>);continue}
    const attrs:Record<string,any>={key}
    if(tag==='a'){const href=safeLink(String(token.attrGet('href')||''));if(!href){result.push(<React.Fragment key={key}>{content}</React.Fragment>);continue}Object.assign(attrs,{href,target:'_blank',rel:'noopener noreferrer',className:'wb-link'})}
    if(tag==='ol'){const start=Number(token.attrGet('start'));if(Number.isSafeInteger(start)&&start>0)attrs.start=start}
    if(tag==='th'||tag==='td'){const align=String(token.attrGet('style')||'').match(/^text-align:(left|right|center)$/)?.[1];if(align)attrs.style={textAlign:align}}
    const node=React.createElement(tag,attrs,content)
    result.push(tag==='table'?<div key={key} className="wb-chat-table" role="region" aria-label="回答表格" tabIndex={0}>{node}</div>:node)
    continue
   }
   if(token.type==='fence'||token.type==='code_block'){const language=token.info.trim().split(/\s+/)[0];result.push(<div key={key} className="wb-chat-code-block">{language&&<div className="wb-chat-code-language">{language}</div>}<pre className="wb-chat-code"><code>{token.content.replace(/\n$/,'')}</code></pre></div>);continue}
   if(token.type==='code_inline'){result.push(<code key={key}>{token.content}</code>);continue}
   if(token.type==='softbreak'||token.type==='hardbreak'){result.push(<br key={key}/>);continue}
   if(token.type==='hr'){result.push(<hr key={key}/>);continue}
   // Images remain textual; displaying a captured answer never contacts an image host.
   result.push(<React.Fragment key={key}>{token.type==='image'?'[图片：'+token.content+']':token.content}</React.Fragment>)
  }
  return result
 }
 return children()
}

/** React text nodes only; website-provided HTML is never inserted into the workbench. */
export const MessageContent=React.memo(function MessageContent({text}:{text:string}){
 let tokens=markdown.parse(text,{})
 if(text.includes('`')&&/[├└┣┗][─━]/.test(text)){
  const repaired=legacyDiagramMarkdown(text,tokens)
  if(repaired!==text)tokens=markdown.parse(repaired,{})
 }
 return <div className="wb-chat-markdown">{renderTokens(tokens)}</div>
})
