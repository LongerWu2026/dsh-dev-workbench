export interface LaunchCommand { id: string; name: string; argv: string[] }
const binaries = new Set(['npm','pnpm','yarn','bun','node','python','python3','java','mvn','mvnw','gradle','gradlew','dotnet','go','cargo'])
export function normalizeLaunchCommands(value: unknown): LaunchCommand[] {
    if (!Array.isArray(value) || value.length > 20) throw new Error('启动配置须为数组，最多20项')
    const ids = new Set<string>()
    return value.map((row:any,index) => {
        if (!Array.isArray(row?.argv) || !row.argv.length || row.argv.length > 64 || row.argv.some((v:any)=>typeof v!=='string'||v.length>2000||/[\x00\r\n]/.test(v))) throw new Error('启动命令须为非空 argv 字符串数组')
        if (!binaries.has(row.argv[0].replace(/^\.\//,''))) throw new Error('仅支持项目开发命令：npm/pnpm/yarn/bun/node/python/java/mvn/gradle/dotnet/go/cargo')
        const id = typeof row.id==='string' && /^[\w-]{1,80}$/.test(row.id) ? row.id : 'custom-'+index
        if (ids.has(id)) throw new Error('启动配置ID重复')
        ids.add(id)
        return {id, name:String(row.name||row.argv.join(' ')).slice(0,100), argv:row.argv.slice()}
    })
}
export function debugHeaders(value: unknown): Record<string,string> {
    const row=typeof value==='string'?JSON.parse(value||'{}'):value||{}
    if (!row || Array.isArray(row) || typeof row!=='object') throw new Error('请求头须为JSON对象')
    const result:Record<string,string>={}
    for(const [key,item] of Object.entries(row)) {
        if(!/^[!#$%&'*+.^_`|~\w-]+$/.test(key)||typeof item!=='string'||/[\r\n\x00]/.test(item)) throw new Error('请求头名称或值无效')
        if(['host','content-length','connection','transfer-encoding'].includes(key.toLowerCase())) throw new Error('此请求头由宿主管理：'+key)
        result[key]=item
    }
    if(JSON.stringify(result).length>32000)throw new Error('请求头过大')
    return result
}
export function debugUrl(value: unknown): string {
    const url=new URL(String(value||''))
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('仅支持无内嵌凭据的HTTP/HTTPS地址')
    return url.href
}
