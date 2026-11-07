import {readdir,open,realpath} from 'node:fs/promises'
import {constants} from 'node:fs'
import {join,relative,isAbsolute,sep} from 'node:path'

const excluded=new Set(['.git','node_modules','vendor','.pnpm','.yarn','dist','build','target','coverage','.next','.nuxt','.cache','.idea','.DS_Store'])
const MAX_FILE=1024*1024,MAX_BYTES=32*1024*1024,MAX_FILES=5000,MAX_RESULTS=200
/** Literal text search of the configured root, with no shell, network or symlink traversal. */
export async function searchProjectFiles(root:string,request:any){
    if(typeof request.query!=='string'||!request.query.trim()||request.query.length>200||/[\x00\r\n]/.test(request.query))throw Error('请输入 1–200 个字符的单行搜索词')
    const query=request.query,caseSensitive=request.caseSensitive===true,needle=caseSensitive?query:query.toLocaleLowerCase()
    const result:any={query,caseSensitive,at:new Date().toISOString(),hits:[],scanned:0,skipped:0,bytes:0,limited:false,note:''}
    const deadline=Date.now()+5000,queue=['']
    const stop=()=>{if(Date.now()>deadline||result.scanned>=MAX_FILES||result.bytes>=MAX_BYTES||result.hits.length>=MAX_RESULTS){result.limited=true;return true}return false}
    while(queue.length&&!stop()){
        const directory=queue.shift()!
        let entries
        try{entries=await readdir(join(root,directory),{withFileTypes:true})}catch{result.skipped++;continue}
        entries.sort((a,b)=>a.name.localeCompare(b.name))
        for(const entry of entries){
            if(stop())break
            if(excluded.has(entry.name)||entry.isSymbolicLink()){result.skipped++;continue}
            const path=join(directory,entry.name)
            if(entry.isDirectory()){if(queue.length<MAX_FILES)queue.push(path);else result.limited=true;continue}
            if(!entry.isFile()){result.skipped++;continue}
            let handle
            try{
                const absolute=await realpath(join(root,path)),rel=relative(root,absolute)
                if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)){result.skipped++;continue}
                handle=await open(absolute,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK)
                const info=await handle.stat();result.scanned++
                if(!info.isFile()||info.size>MAX_FILE||result.bytes+info.size>MAX_BYTES){result.skipped++;continue}
                const bytes=Buffer.alloc(Math.min(info.size+1,MAX_FILE+1)),read=await handle.read(bytes,0,bytes.length,0)
                result.bytes+=read.bytesRead
                if(read.bytesRead>MAX_FILE||read.bytesRead!==info.size||bytes.subarray(0,read.bytesRead).includes(0)){result.skipped++;continue}
                let text:string
                try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,read.bytesRead))}catch{result.skipped++;continue}
                const lines=text.split(/\r?\n/)
                for(let i=0;i<lines.length;i++){
                    if(stop())break
                    const line=lines[i],at=(caseSensitive?line:line.toLocaleLowerCase()).indexOf(needle)
                    if(at<0)continue
                    const from=Math.max(0,at-80),to=Math.min(line.length,at+query.length+160)
                    result.hits.push({path:path.split(sep).join('/'),line:i+1,column:at+1,snippet:(from?'…':'')+line.slice(from,to)+(to<line.length?'…':'')})
                }
            }catch{result.skipped++}finally{await handle?.close()}
        }
    }
    if(result.limited)result.note='达到搜索上限（200 条结果、5000 个文件、32 MB 或 5 秒），请缩小关键词范围。'
    return result
}
