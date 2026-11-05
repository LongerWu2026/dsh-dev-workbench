import {loadWorkbenchState,mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {readKnowledgeContent,storeKnowledgeContent,MAX_KNOWLEDGE_TEXT} from '../knowledge/content-store.js'
import {fetchPublicArticle} from './article-transport.js'
import {readArticleWithFallback} from './article-read.js'

export async function articleMarkdown(html:string,url:string){
 const [{Readability},{parseHTML},{default:TurndownService},{default:gfmPlugins}]=await Promise.all([import('@mozilla/readability'),import('linkedom'),import('turndown'),import('turndown-plugin-gfm')])
 if(html.length>3*MAX_KNOWLEDGE_TEXT)throw Error('网页内容过大，请选择较小的文章')
 const document=parseHTML(html).document
 for(const node of document.querySelectorAll('script,style,iframe,form,button,nav,footer,aside'))node.remove()
 // Resolve links before conversion so the offline snapshot remains useful.
 for(const node of document.querySelectorAll('[href],[src]'))for(const attr of ['href','src']){const value=node.getAttribute(attr);if(value){try{const resolved=new URL(value,url);if(['http:','https:'].includes(resolved.protocol))node.setAttribute(attr,resolved.href);else node.removeAttribute(attr)}catch{node.removeAttribute(attr)}}}
 const readme=document.querySelector('article.markdown-body')
 const article=readme?{title:document.title,content:readme.innerHTML,textContent:readme.textContent,byline:null}:new Readability(document as any,{charThreshold:80}).parse()
 if(!article?.content||String(article.textContent||'').trim().length<80)throw Error('网页未提供可读取正文，可能需要登录或已失效')
 const converter=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});converter.use(gfmPlugins.gfm)
 const body=converter.turndown(article.content).trim()
 if(body.length>MAX_KNOWLEDGE_TEXT)throw Error('文章超过100万字符，未截断保存')
 return {title:article.title||'',body,author:article.byline||null}
}
const pending=new Map<string,Promise<any>>()
export async function readRadarArticle(ctx:any,id:string,reload=false){
 const item=loadWorkbenchState().radar.find((row:any)=>row.id===id)
 if(!item?.url)throw Error('资讯没有有效的原文链接')
 if(item.article?.contentRef&&!reload)return {...item.article,body:readKnowledgeContent(item.article.contentRef),title:item.title,url:item.url,cached:true}
 const key=id+':'+item.url;if(pending.has(key))return pending.get(key)
 const active=workbenchGenerationGuard()
 const operation=(async()=>{
  const web=ctx?.get?.('web')
  const provider=(signal:AbortSignal)=>{if(!web?.fetch)throw Error('宿主提取服务不可用');return web.fetch({url:item.url},signal)},direct=(signal:AbortSignal)=>fetchPublicArticle(item.url,signal)
  const complete=(read:(signal:AbortSignal)=>any)=>async(signal:AbortSignal)=>{
   const fetched=await read(signal);active();signal.throwIfAborted()
   if(Number(fetched?.statusCode)>=400||fetched?.truncated)throw Error(fetched?.truncated?'网页返回内容被截断，未标记为完整原文':'原文读取失败：HTTP '+fetched.statusCode)
   const raw=fetched?.body?.content;if(typeof raw!=='string')throw Error('网页未返回正文')
   const parsed=/<(?:html|article|main|p|div)\b/i.test(raw)?await articleMarkdown(raw,item.url):{title:item.title,body:raw.trim(),author:null}
   if(parsed.body.length<80||parsed.body.length>MAX_KNOWLEDGE_TEXT)throw Error('原文内容不足或过长，未保存')
   signal.throwIfAborted();active();return parsed
  }
  // GitHub's README DOM is more precise than provider-generated navigation-heavy Markdown.
  const [primary,fallback]=new URL(item.url).hostname==='github.com'?[direct,provider]:[provider,direct]
  const parsed=await readArticleWithFallback(complete(primary),complete(fallback)).catch(error=>{active();throw Error('原文读取失败：'+String(error?.message||error).slice(0,200))})
  active()
  const article={contentRef:storeKnowledgeContent(parsed.body),fetchedAt:new Date().toISOString(),author:parsed.author,status:'ready'}
  await mutateWorkbenchState((state:any)=>{active();const target=state.radar.find((row:any)=>row.id===id);if(!target||target.url!==item.url)throw Error('资讯来源已变化，请重新打开');target.article=article;return state})
  return {...article,...parsed,url:item.url,cached:false}
 })().finally(()=>pending.delete(key));pending.set(key,operation);return operation
}
