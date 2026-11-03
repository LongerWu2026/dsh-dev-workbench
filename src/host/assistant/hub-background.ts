import {transcriptDelta} from './transcript.js'

interface BackgroundSnapshot {session:any;seq:number;entries:any[];turnActive:boolean;openTurn?:{turn?:number;hasOutput:boolean;emptyEntry?:any}|null}
interface BackgroundReader {snapshots:Map<string,BackgroundSnapshot>;pending:Map<string,Promise<any>>;failures:Map<string,{at:number;error:any}>}
const readers=new WeakMap<object,BackgroundReader>()
/** Keep repeated detail polls incremental, including concurrent cold restores.
 * Only already-associated session identities reach this reader. */
export async function readBackgroundSnapshot(ctx:object,id:string,restore:()=>Promise<any>){
    let reader=readers.get(ctx)
    if(!reader){reader={snapshots:new Map(),pending:new Map(),failures:new Map()};readers.set(ctx,reader)}
    if(reader.pending.has(id))return reader.pending.get(id)!
    const failure=reader.failures.get(id)
    if(failure&&Date.now()-failure.at<15000)throw failure.error
    const read=(async()=>{
        const session=await restore(),prior=reader!.snapshots.get(id),seq=Number(session.seq)||0
        if(prior&&prior.session===session&&prior.seq===seq)return prior
        const reused=prior&&prior.session===session&&prior.seq<seq?prior:null
        const native=session.snapshotEvents(reused?.seq||0)
        const delta=transcriptDelta({seq,snapshotEvents:()=>native},reused?.seq||0)
        const entries=delta.entries.filter((row:any)=>['user','assistant','error'].includes(row.role))
        let openTurn:BackgroundSnapshot['openTurn']=reused?.openTurn?{...reused.openTurn}:null
        for(const event of native){
            if(event.type==='turn/start')openTurn={turn:event.data?.turn,hasOutput:false}
            else if(event.type==='assistant/message'){
                const text=(event.data?.message?.content||[]).filter((block:any)=>block?.type==='text'&&typeof block.text==='string').map((block:any)=>block.text).join('\n').trim()
                if(openTurn){if(text)openTurn.hasOutput=true;else openTurn.emptyEntry={role:'assistant',text:'',at:event.time,seq:event.seq,emptyOutput:true}}
            }else if(event.type==='turn/error'){if(openTurn)openTurn.hasOutput=true}
            else if(event.type==='turn/end'){
                if(openTurn&&!openTurn.hasOutput&&event.data?.reason?.kind!=='error')entries.push({...openTurn.emptyEntry||{role:'assistant',text:'',at:event.time,seq:event.seq,emptyOutput:true},terminalReason:event.data?.reason?.kind})
                openTurn=null
            }
        }
        const snapshot={session,seq,entries:(reused?[...reused.entries,...entries]:entries).sort((a:any,b:any)=>(new Date(a.at).getTime()||0)-(new Date(b.at).getTime()||0)||a.seq-b.seq),turnActive:delta.turnActive||(!delta.turnEnded&&!!reused?.turnActive),openTurn}
        reader!.snapshots.set(id,snapshot);reader!.failures.delete(id)
        return snapshot
    })()
    reader.pending.set(id,read)
    try{return await read}catch(error){reader.failures.set(id,{at:Date.now(),error});throw error}finally{reader.pending.delete(id)}
}

export interface BackgroundRecognitionItem {sourceId:string;label?:string;summary:string;instructions:string[];status:'recognized'|'invalid';reason?:string}
export interface BackgroundRecognition {batchId?:string;items:BackgroundRecognitionItem[];note:string}
function parse(value:string):any {try{return JSON.parse(value.trim().replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```\s*$/,''))}catch{return null}}
const cut=(value:any,size=400)=>{const text=typeof value==='string'?value:'';return text.length<=size?text:text.slice(0,size)+'（节选）'}
/** The caller must supply the preceding packet from the same already-associated session. */
export function backgroundSubmittedPacket(input:any):any|undefined {
    if(input?.batchId&&Array.isArray(input.messages))return input
    const text=typeof input==='string'?input:String(input?.text||'')
    const packet=parse(text)||parse(text.trim().split('\n').at(-1)||'')
    return packet?.batchId&&Array.isArray(packet.messages)?packet:undefined
}
function invalid(sourceId:string,summary:string,reason:string):BackgroundRecognitionItem{return {sourceId,summary,instructions:['未返回有效结果'],status:'invalid',reason}}
function recognized(sourceId:string,analysis:any,sourceText=''):BackgroundRecognitionItem {
    if(!analysis||typeof analysis.noise!=='boolean'||!Array.isArray(analysis.items)||analysis.items.length>3)return invalid(sourceId,cut(sourceText),'识别结构无效：需要 noise 和最多 3 个 items。')
    if(analysis.items.some((item:any)=>!item||typeof item.title!=='string'||!item.title.trim()||typeof item.needsAction!=='boolean'||typeof item.needsReply!=='boolean'))return invalid(sourceId,cut(sourceText),'事项缺少标题、是否需待办或是否需回复的有效判断。')
    if(analysis.needsReview===true)return {sourceId,summary:cut(analysis.summary)||cut(sourceText),instructions:['需要人工确认，可核对原消息后重试本条'],status:'recognized',reason:cut(analysis.reviewReason)||'AI 无法可靠判断本条消息'}
    const instructions:string[]=[]
    if(analysis.noise)instructions.push('无需处理（AI 判定无待办或回复义务）')
    else for(const item of analysis.items){
        const title=cut(item.title,200)
        if(item.needsAction)instructions.push('需待办：'+title)
        else if(item.relatedTaskId)instructions.push('更新已有待办：'+title+(item.completed?'（标记完成）':item.cancelled?'（标记取消）':''))
        if(item.needsReply)instructions.push('需待回复：'+title)
        else if(item.relatedReplyId||item.replyToMsgId)instructions.push('更新待回复：'+title+(typeof item.replyStage==='string'?'（'+cut(item.replyStage,80)+'）':''))
    }
    if(!instructions.length)instructions.push('无需处理（本次 AI 未识别出待办或待回复事项）')
    return {sourceId,summary:cut(analysis.summary)||analysis.items.map((item:any)=>cut(item.title,120)).join('；')||cut(sourceText)||'AI 未提供事项摘要',instructions,status:'recognized'}
}
/** Read-only interpretation of AI returns; it never asserts that proposed changes were committed. */
export function backgroundRecognitionDetails(purpose:string,entry:any,submitted?:any):BackgroundRecognition|undefined {
    if(entry?.role!=='assistant'||!['analysis','summary'].includes(purpose))return undefined
    const text=String(entry.text||''),parsed=parse(text),packet=backgroundSubmittedPacket(submitted)
    const failure=!text.trim()?(entry.terminalReason&&entry.terminalReason!=='completed'?'本轮已中断或停止，AI 未返回可展示结果。':'AI 本轮未返回可展示内容。'):!parsed||typeof parsed!=='object'||Array.isArray(parsed)?'AI 返回内容不是有效的 JSON 对象。':''
    if(purpose==='summary'){
        if(!failure&&typeof parsed.overview==='string'&&parsed.overview.trim())return {items:[{sourceId:'batch-overview',label:'本批资讯总结',summary:cut(parsed.overview,6000),instructions:[],status:'recognized' as const}],note:'以下为 AI 实际返回的整批资讯总结；是否已保存以资讯处理结果为准。'}
        const labels:Record<string,string>={change:'技术变化',usage:'应用场景',risk:'采用风险',practice:'推荐实践'}
        const items=Object.entries(labels).map(([key,label])=>{
            const value=parsed?.[key]
            if(failure||typeof value!=='string'||!value.trim())return {...invalid(key,'',failure||'AI 未返回该段有效文本。'),label}
            return {sourceId:key,label,summary:cut(value,6000),instructions:[],status:'recognized' as const}
        })
        return {items,note:'以下为 AI 实际返回的资讯摘要；是否已保存以资讯处理结果为准。'+(items.some(item=>item.status==='invalid')?'存在未返回有效内容的段落。':'')}
    }
    const expected=packet?.messages?.slice(0,50)||[],items:BackgroundRecognitionItem[]=[],notes=['以下为 AI 返回的识别建议；是否已登记待办或待回复，以业务处理结果为准。']
    const legacy=typeof parsed?.noise==='boolean'&&!parsed.results
    const batchMismatch=!!packet&&!legacy&&parsed?.batchId!==packet.batchId
    const shapeError=failure||(!legacy&&!Array.isArray(parsed?.results)?'返回缺少 results 数组。':'')||(batchMismatch?'返回 batchId 与提交批次不一致。':'')
    const results=legacy?(expected.length===1?[{sourceId:expected[0].sourceId,analysis:parsed}]:[]):Array.isArray(parsed?.results)?parsed.results:[]
    const byId=new Map<string,any[]>();for(const row of results){const id=typeof row?.sourceId==='string'?row.sourceId:'';byId.set(id,[...(byId.get(id)||[]),row])}
    if(expected.length){
        const allowed=new Set(expected.map((row:any)=>row.sourceId)),unknown=results.filter((row:any)=>!allowed.has(row?.sourceId))
        for(const row of expected){
            const id=String(row.sourceId||''),matches=byId.get(id)||[],reason=shapeError||(legacy&&expected.length!==1?'旧格式单条结果无法对应本批多条消息。':'')||(!matches.length?'AI 未返回本条消息结果。':matches.length>1?'AI 重复返回相同 sourceId，无法确定有效结果。':'')
            items.push(reason?invalid(id,cut(row.text),reason):recognized(id,matches[0].analysis,row.text))
        }
        if(unknown.length){notes.push('返回包含 '+unknown.length+' 条不属于本批的 sourceId（'+unknown.slice(0,8).map((row:any)=>cut(row?.sourceId,80)||'缺失编号').join('、')+'），不能视为整批有效。');for(const row of unknown.slice(0,Math.max(0,50-items.length)))items.push(invalid(String(row?.sourceId||''),'未匹配到本批原消息','返回 sourceId 不属于提交批次。'))}
        if(results.some((row:any)=>(byId.get(row?.sourceId)||[]).length>1))notes.push('返回含重复 sourceId，不能视为整批有效。')
        if(packet.messages.length>50)notes.push('本页仅展示前 50 条提交消息，不能据此确认其余消息结果。')
    }else {
        notes.push('未找到对应提交批次，无法确认是否覆盖全部原消息。')
        if(shapeError)items.push(invalid('', '',shapeError))
        else if(legacy)items.push({...recognized('',parsed),label:'旧格式单条结果（未记录来源编号）'})
        else for(const row of results.slice(0,50)){const id=typeof row?.sourceId==='string'?row.sourceId:'';items.push(!id?invalid('','', 'AI 返回缺少有效 sourceId。'):(byId.get(id)||[]).length>1?invalid(id,'','AI 重复返回相同 sourceId，无法确定有效结果。'):recognized(id,row.analysis))}
        if(!items.length)items.push(invalid('','','AI 没有返回任何消息识别结果。'))
        if(results.length>50)notes.push('本页仅展示前 50 条 AI 返回记录。')
    }
    return {batchId:packet?.batchId||parsed?.batchId,items,note:notes.join('')}
}
/** Presentation of actual background input and outputs, including all messages in a batch. */
export function backgroundDisplayText(purpose:string,entry:any,submitted?:any):string|undefined {
    const text=String(entry.text||'')
    if(entry.role==='user'&&purpose==='analysis'){
        const packet=backgroundSubmittedPacket(entry)
        if(packet)return ['已提交 '+packet.messages.length+' 条消息进行 AI 识别。',...packet.messages.slice(0,50).map((row:any,index:number)=>`${index+1}. [${String(row.sourceId||'来源编号缺失')}] ${cut(row.text)}`),packet.messages.length>50?'仅展示前 50 条。':''].filter(Boolean).join('\n')
    }
    if(entry.role==='user'&&purpose==='summary'&&text.startsWith('请阅读下面这篇资讯原文，输出一个 JSON 对象')){
        const title=text.match(/^标题：(.*)$/m)?.[1];if(title)return '已提交资讯摘要：'+title
    }
    if(entry.role==='error')return '本轮 AI 处理失败：'+text
    const details=backgroundRecognitionDetails(purpose,entry,submitted)
    if(!details)return undefined
    return [details.note,...details.items.map((item,index)=>`${index+1}. ${item.label||('['+(item.sourceId||'来源未确认')+']')}${item.summary?' '+item.summary:''}\n${item.status==='invalid'?'未返回有效结果：'+item.reason:item.instructions.join('\n')}`)].join('\n\n')
}

export function backgroundMessageOrder(a:any,b:any):number {
    const time=(row:any)=>new Date(row.at).getTime()||0
    return time(a)-time(b)||String(a.sessionId).localeCompare(String(b.sessionId))||a.seq-b.seq
}
