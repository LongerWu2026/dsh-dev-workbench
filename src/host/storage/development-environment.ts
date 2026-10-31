import {accessSync,constants,readdirSync,statSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,isAbsolute,delimiter} from 'node:path'

/** Discover executables and profile names only. Never read credentials. */
export function discoverLinky(options:{home?:string;platform?:string;arch?:string;path?:string;applications?:string[]}={}){
    const home=options.home??homedir(),platform=options.platform??process.platform,arch=options.arch??process.arch
    const name=platform==='win32'?'linky.exe':'linky',apps=options.applications??['/Applications',join(home,'Applications')]
    const candidates=[join(home,'.local','bin',name),join(home,'.linky','bin',name),
        ...(options.path??process.env.PATH??'').split(delimiter).filter(isAbsolute).map(dir=>join(dir,name)),
        ...(platform==='darwin'?apps.map(dir=>join(dir,'Linky.app','Contents','Resources','bin','darwin',arch==='arm64'?'arm64':'amd64','linky')):[]),
        ...(platform==='win32'?[join(home,'AppData','Local','Linky','cli','bin',name)]:[])]
    const cliPaths=[...new Set(candidates)].filter(executable)
    let profiles:string[]=[]
    try{profiles=readdirSync(join(home,'.linky','profiles'),{withFileTypes:true}).filter(d=>d.isDirectory()&&/^[\w.-]{1,120}$/.test(d.name)).map(d=>d.name)}catch{}
    const profile=profiles.includes('desktop-linky.kingdee.com')?'desktop-linky.kingdee.com':profiles.length===1?profiles[0]:'default'
    return {cliPaths,profiles,profile}
}
export function executable(path:string){try{accessSync(path,constants.X_OK);return statSync(path).isFile()}catch{return false}}
