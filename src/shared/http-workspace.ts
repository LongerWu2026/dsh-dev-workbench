import {debugHeaders,debugUrl} from './developer-tools.js'

export const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'] as const
export type AssertionValue = string | number | boolean | null
export type HttpAssertion =
    | {kind:'status'; expected:number}
    | {kind:'duration'; expected:number}
    | {kind:'json'; path:string; expected:AssertionValue}
export type HttpRequest = {name:string; method:string; url:string; headers:string; body:string; timeoutMs:number; assertions:HttpAssertion[]}
export type SavedHttpRequest = HttpRequest & {id:string}
export type HttpCollection = {id:string; name:string; requests:SavedHttpRequest[]; variables?:Record<string,string>}
export type HttpWorkspace = {revision:number; collections:HttpCollection[]}
export type HttpResponse = {status:number; statusText?:string; durationMs:number; headers:Record<string,string>; text:string; truncated?:boolean}
export type HttpCheck = {label:string; expected:AssertionValue; actual:string; passed:boolean}
export type HttpOutcome = {state:'passed'|'failed'|'unchecked'; response:HttpResponse; checks:HttpCheck[]}

const variableName = /^[A-Za-z_][\w.-]{0,63}$/
const variables = /\{\{([A-Za-z_][\w.-]{0,63})\}\}/g
const basePlaceholder = '{{baseUrl}}'
const credentialKey = /(?:^authorization$|^proxy-authorization$|^cookie$|^set-cookie$|^x-auth$|token$|api[-_]?key$|password$|passwd$|secret$|session[-_]?id$)/i
const credentialVariable = /^(?:[a-z]+ )?\{\{[A-Za-z_][\w.-]{0,63}\}\}$/i
const formContentType = /^application\/x-www-form-urlencoded\b/i

export function httpRecord(value:unknown): Record<string,unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('请提供 JSON 对象')
    return value as Record<string,unknown>
}

function boundedText(value:unknown, label:string, max:number, optional=false):string {
    if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw Error(label + '无效或过长')
    return value
}

function id(value:unknown):string {
    if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) throw Error('工作区条目编号无效')
    return value
}

function entries<T extends {id:string}>(value:unknown, max:number, normalize:(row:unknown)=>T):T[] {
    if (!Array.isArray(value) || value.length > max) throw Error('工作区条目数量超出上限 ' + max)
    const rows = value.map(normalize)
    if (new Set(rows.map(row=>row.id)).size !== rows.length) throw Error('工作区条目编号重复')
    return rows
}

function jsonPath(path:string):string[] {
    if (!path.startsWith('$') || path.length > 240) throw Error('JSON 路径须以 $ 开头')
    const keys:string[] = []
    let rest = path.slice(1)
    while (rest) {
        const match = /^(?:\.([\w-]+)|\[(\d+|"(?:[^"\\]|\\.)*")\])/.exec(rest)
        if (!match) throw Error('JSON 路径仅支持字段和数组下标，例如 $.data[0].code')
        keys.push(match[1] ?? (match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]))
        rest = rest.slice(match[0].length)
    }
    return keys
}

export function normalizeHttpAssertions(value:unknown):HttpAssertion[] {
    if (!Array.isArray(value) || value.length > 24) throw Error('断言须为数组，最多 24 条')
    return value.map(item=>{
        const {kind, expected, path} = httpRecord(item)
        if (kind === 'status' || kind === 'duration') {
            const min = kind === 'status' ? 100 : 0, max = kind === 'status' ? 599 : 60000
            if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < min || expected > max) throw Error('断言数值无效')
            return {kind,expected}
        }
        if (kind !== 'json') throw Error('不支持的断言类型')
        const key = boundedText(path,'JSON 路径',240).trim()
        jsonPath(key)
        if (!(expected === null || typeof expected === 'boolean' || typeof expected === 'number' && Number.isFinite(expected) || typeof expected === 'string' && expected.length <= 2000)) {
            throw Error('JSON 字段断言的期望值须为字符串、数字、布尔值或 null')
        }
        return {kind,path:key,expected:expected as AssertionValue}
    })
}

function inspectUrl(url:string):URL {
    const relative = url.startsWith('/') && !url.startsWith('//')
    const based = url.startsWith(basePlaceholder + '/')
    if (!relative && !based && !/^https?:\/\/[^/?#]/i.test(url)) throw Error('请填写 HTTP/HTTPS 地址、相对路径或 {{baseUrl}}/路径')
    const target = relative ? 'http://http-workspace.invalid' + url : based ? 'http://http-workspace.invalid' + url.slice(basePlaceholder.length) : url
    const parsed = new URL(debugUrl(target))
    if (target.includes('#') || /[{}]/.test(target.split(/[/?#]/,3)[2]) || /[\\\r\n\t]/.test(target)) throw Error('请求地址不支持片段、反斜杠或动态主机，请使用 {{baseUrl}}/路径')
    return parsed
}

export function normalizeHttpVariables(input:unknown):Record<string,string> {
    const values = httpRecord(input)
    if (JSON.stringify(values).length > 32000) throw Error('变量超过 32000 字符')
    return Object.fromEntries(Object.entries(values).map(([key,value])=>{
        if (!variableName.test(key) || typeof value !== 'string') throw Error('变量须为 JSON 字符串键值对，名称以字母或下划线开头')
        if (key === 'baseUrl' && value) {
            const base = new URL(debugUrl(value.trim()))
            if (base.search || base.hash || /[{}]/.test(base.href)) throw Error('baseUrl 只支持固定的 HTTP/HTTPS 地址，可包含路径')
            return [key,base.href.replace(/\/+$/,'')]
        }
        return [key,value]
    }))
}

function validateCredential(key:string, value:unknown) {
    if (credentialKey.test(key) && value !== '' && value !== null && (typeof value !== 'string' || !credentialVariable.test(value))) {
        throw Error('请将凭据字段 ' + key + ' 改为变量，例如 {{token}}，并在集合变量中输入实际值')
    }
}

function inspectBody(value:unknown) {
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
        validateCredential(key,item)
        inspectBody(item)
    }
}

function contentType(headers:Record<string,string>):string {
    return Object.entries(headers).find(([key])=>key.toLowerCase() === 'content-type')?.[1] ?? ''
}

export function normalizeHttpRequest(value:unknown, persist=false):HttpRequest {
    const row = httpRecord(value)
    const name = boundedText(row.name,'请求名称',100).trim()
    const url = boundedText(row.url,'请求地址',4000).trim()
    const parsed = inspectUrl(url)
    const method = row.method
    if (typeof method !== 'string' || !HTTP_METHODS.some(item=>item === method)) throw Error('不支持的 HTTP 方法')
    const timeoutMs = row.timeoutMs ?? 30000
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw Error('超时须为 1000–60000 毫秒')
    const headers = debugHeaders(row.headers)
    const body = boundedText(row.body ?? '','请求正文',512*1024,true)
    if ((method === 'GET' || method === 'HEAD') && body) throw Error('GET/HEAD 请求不能带正文')
    const assertions = normalizeHttpAssertions(row.assertions ?? [])
    if (persist) {
        for (const [key,item] of Object.entries(headers)) validateCredential(key,item)
        parsed.searchParams.forEach((item,key)=>validateCredential(key,item))
        if (/^\s*[\[{]/.test(body)) {
            let json:unknown
            try {json = JSON.parse(body)} catch { /* Plain text may also start with a bracket. */ }
            inspectBody(json)
        }
        if (formContentType.test(contentType(headers))) {
            new URLSearchParams(body).forEach((item,key)=>validateCredential(key,item))
        }
        for (const rule of assertions) {
            if (rule.kind === 'json') validateCredential(jsonPath(rule.path).at(-1) || '',rule.expected)
        }
    }
    return {name,url,method,timeoutMs,headers:JSON.stringify(headers,null,2),body,assertions}
}

export function emptyHttpWorkspace():HttpWorkspace {
    return {revision:0,collections:[{id:'default',name:'默认集合',requests:[],variables:{}}]}
}

export function normalizeHttpWorkspace(value:unknown):HttpWorkspace {
    const {revision,collections} = httpRecord(value)
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) throw Error('工作区修订号无效')
    const groups = entries(collections,20,value=>{
        const row = httpRecord(value)
        return {id:id(row.id),name:boundedText(row.name,'集合名称',100).trim(),variables:normalizeHttpVariables(row.variables ?? {}),requests:entries(row.requests,100,value=>{
            const request = httpRecord(value)
            return {...normalizeHttpRequest(request,true),id:id(request.id)}
        })}
    })
    if (!groups.length) throw Error('至少保留一个集合')
    return {revision,collections:groups}
}

function replaceVariables(text:string, values:Record<string,string>, encode=false):string {
    return text.replace(variables,(_match,key:string)=>{
        if (!Object.hasOwn(values,key)) throw Error('缺少运行变量 {{' + key + '}}')
        return encode ? encodeURIComponent(values[key]) : values[key]
    })
}

function resolveBody(body:string, headers:Record<string,string>, values:Record<string,string>):string {
    if (!body.includes('{{')) return body
    const mime = contentType(headers)
    if (formContentType.test(mime)) return replaceVariables(body,values,true)
    if (/\bjson\b/i.test(mime) || /^\s*[\[{"]/.test(body)) {
        let document:unknown
        try {document = JSON.parse(body)} catch { /* Invalid JSON is also a valid test input. */ }
        if (document !== undefined) {
            return JSON.stringify(document,(_key,item)=>typeof item === 'string' ? replaceVariables(item,values) : item)
        }
    }
    return replaceVariables(body,values)
}

export function resolveHttpRequest(request:HttpRequest, input='{}') {
    if (input.length > 32000) throw Error('变量超过 32000 字符')
    const values = normalizeHttpVariables(JSON.parse(input || '{}'))
    const {baseUrl} = values
    const url = request.url
    const relative = url.startsWith('/') || url.startsWith(basePlaceholder)
    if (relative && !baseUrl) throw Error('使用相对路径或 {{baseUrl}} 时，请先在集合变量中保存 baseUrl')
    const target = debugUrl((relative ? baseUrl! : '') + replaceVariables(url.replace(/^\{\{baseUrl\}\}/,''),values,true))
    if (baseUrl && new URL(target).origin !== new URL(baseUrl).origin) {
        throw Error('请求地址与集合 baseUrl 不同，请改用相对路径或修改 baseUrl')
    }
    const headers = debugHeaders(Object.fromEntries(Object.entries(debugHeaders(request.headers)).map(([key,item])=>[key,replaceVariables(item,values)])))
    const body = resolveBody(request.body,headers,values)
    const assertions = request.assertions.map(rule=>rule.kind === 'json' && typeof rule.expected === 'string'
        ? {...rule,expected:replaceVariables(rule.expected,values)}
        : rule)
    return {payload:{url:target,method:request.method,headers,body,timeoutMs:request.timeoutMs},assertions}
}

function actualText(value:unknown):string {
    const text = JSON.stringify(value)
    return text.length > 1000 ? text.slice(0,1000) + '…' : text
}

export function checkHttpResponse(response:HttpResponse, assertions:HttpAssertion[]):HttpOutcome {
    let body:unknown, bodyError = ''
    if (assertions.some(rule=>rule.kind === 'json')) {
        if (response.truncated) bodyError = '响应已截断'
        else try {body = JSON.parse(response.text)} catch {bodyError = '响应正文不是有效的 JSON'}
    }
    const checks = assertions.map(rule=>{
        if (rule.kind === 'status') return {label:'HTTP 状态码',expected:rule.expected,actual:String(response.status),passed:response.status === rule.expected}
        if (rule.kind === 'duration') return {label:'耗时上限（ms）',expected:rule.expected,actual:String(response.durationMs),passed:response.durationMs <= rule.expected}
        let actual = body
        if (!bodyError) for (const key of jsonPath(rule.path)) {
            actual = actual !== null && typeof actual === 'object' && Object.hasOwn(actual,key) ? (actual as Record<string,unknown>)[key] : undefined
        }
        return {
            label:rule.path,expected:rule.expected,
            actual:bodyError || (actual === undefined ? '字段缺失' : actualText(actual)),
            passed:!bodyError && actual === rule.expected,
        }
    })
    return {state:!checks.length ? 'unchecked' : checks.every(row=>row.passed) ? 'passed' : 'failed',response,checks}
}
