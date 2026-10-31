import {accessSync,constants,existsSync,lstatSync,readdirSync,readFileSync,readlinkSync,realpathSync,statSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {homedir} from 'node:os'
import {createHash} from 'node:crypto'
import {developmentDir,writeDevelopmentFile} from './development-store.js'
import type {DevelopmentTask} from '../../shared/development.js'

// Generated dependencies and VCS metadata are outside the reviewable source set.
const excluded=new Set(['.git','.hg','.svn','node_modules','.venv','venv','__pycache__','.idea','.vscode','.next','.nuxt','.DS_Store'])
type Entry={hash:string;mode:number;content?:string;link?:string}
type Snapshot={cwd:string;files:Record<string,Entry>}
function baselinePath(id:string){if(!/^[\w-]{1,120}$/.test(id))throw new Error('任务标识无效');return join(developmentDir(),'directory-baselines',id+'.json')}
export function directoryError(path:string){
    try{const cwd=realpathSync(path);if(!statSync(cwd).isDirectory())return '所选路径不是目录';if(cwd===resolve('/')||cwd===realpathSync(homedir()))return '请选择具体工程目录，不能使用系统根目录或用户主目录';accessSync(cwd,constants.R_OK|constants.W_OK|constants.X_OK);return ''}catch{return '所选目录不可读写，请选择当前用户有读写权限的目录'}
}
function capture(cwd:string):Snapshot{
    const files:Record<string,Entry>={},root=realpathSync(cwd);let count=0,bytes=0
    function walk(path:string,prefix:string){
        for(const name of readdirSync(path).sort()){
            if(excluded.has(name))continue
            const full=join(path,name),key=prefix+name,meta=lstatSync(full)
            if(meta.isDirectory()){if(++count>10000)throw new Error('工程文件过多，请选择更具体的开发目录');walk(full,key+'/');continue}
            if(++count>10000)throw new Error('工程文件过多，请选择更具体的开发目录')
            if(meta.isSymbolicLink()){const link=readlinkSync(full);files[key]={mode:meta.mode,hash:createHash('sha256').update(link).digest('hex'),link};continue}
            if(!meta.isFile())throw new Error('目录中存在无法审查的特殊文件：'+key)
            bytes+=meta.size;if(bytes>64*1024*1024)throw new Error('工程源码快照超过64MB，请选择更具体的开发目录')
            const content=readFileSync(full);files[key]={mode:meta.mode,hash:createHash('sha256').update(content).digest('hex'),content:content.toString('base64')}
        }
    }
    walk(root,'');return {cwd:root,files}
}
export function createDirectoryBaseline(row:DevelopmentTask){writeDevelopmentFile(baselinePath(row.id),capture(row.cwd))}
export function ensureDirectoryBaseline(row:DevelopmentTask){if(!existsSync(baselinePath(row.id))){if(row.steps.length)throw new Error('目录开发基线不存在，请恢复基线后继续，不能重新覆盖已有开发的基线');createDirectoryBaseline(row)}}
export function directoryChanges(row:DevelopmentTask){
    const path=baselinePath(row.id);if(!existsSync(path))throw new Error('目录开发基线不存在，无法核对实际变更；请恢复该任务基线后继续')
    const baseline=JSON.parse(readFileSync(path,'utf8')) as Snapshot,current=capture(row.cwd)
    if(current.cwd!==baseline.cwd)throw new Error('任务目录已改变，请核对工作目录')
    const names=[...new Set([...Object.keys(baseline.files),...Object.keys(current.files)])].sort(),hash=createHash('sha256')
    let text='',bytes=0,changed=0
    for(const name of names){
        const before=baseline.files[name],after=current.files[name]
        hash.update(JSON.stringify([name,after?.hash??null,after?.mode??null,after?.link??null]))
        if(before?.hash===after?.hash&&before?.mode===after?.mode&&before?.link===after?.link)continue
        if(++changed>200)throw new Error('变更超过200个文件，请拆分后审查')
        bytes+=(before?.content?Buffer.byteLength(before.content,'base64'):0)+(after?.content?Buffer.byteLength(after.content,'base64'):0)
        if(bytes>512*1024)throw new Error('变更内容超过512KB，请拆分后审查')
        const body=(entry:Entry|undefined)=>!entry?'（不存在）':entry.link!==undefined?'符号链接 → '+entry.link:Buffer.from(entry.content||'','base64').includes(0)?'二进制文件（Base64）：\n'+entry.content:Buffer.from(entry.content||'','base64').toString('utf8')
        text+='\n### '+(!before?'新增':!after?'删除':'修改')+' '+name+'\n--- 开发前\n'+body(before)+'\n+++ 当前\n'+body(after)+'\n'
    }
    return {diff:text||'（没有代码变更）',diffHash:hash.digest('hex')}
}
