/** Deterministic browser-side helpers. Never execute imported commands. */
export function jsonType(value:any):string {
    if(value===null)return 'null';
    if(Array.isArray(value)){const types=[...new Set(value.map(jsonType))];return types.length?'Array<'+types.join(' | ')+'>':'unknown[]'}
    if(typeof value==='object'){
        const keys=Object.keys(value);return keys.length?'{\n'+keys.map(k=>'  '+JSON.stringify(k)+': '+jsonType(value[k]).replace(/\n/g,'\n  ')+';').join('\n')+'\n}':'Record<string, never>';
    }
    return typeof value;
}
export function jsonChanges(left:any,right:any,path='$',out:any[]=[]):any[]{
    if(Object.is(left,right))return out;
    if(left!==null&&right!==null&&typeof left==='object'&&typeof right==='object'&&Array.isArray(left)===Array.isArray(right)){
        const keys=new Set([...Object.keys(left),...Object.keys(right)]);
        for(const key of keys){const next=Array.isArray(left)?path+'['+key+']':path+'['+JSON.stringify(key)+']';
            if(!Object.hasOwn(left,key))out.push({path:next,type:'add',after:right[key]});
            else if(!Object.hasOwn(right,key))out.push({path:next,type:'del',before:left[key]});
            else jsonChanges(left[key],right[key],next,out);
        }
    }else out.push({path,type:'change',before:left,after:right});
    return out;
}
export function curlTokens(source:string):string[]{
    const tokens:string[]=[];let token='',quote='',started=false;
    for(let i=0;i<source.length;i++){const c=source[i];
        if(c==='\\'&&quote!=="'"){if(i+1>=source.length)throw Error('cURL 末尾转义不完整');const n=source[++i];if(n!=='\n'){token+=n;started=true}continue}
        if(quote){if(c===quote)quote='';else token+=c;continue}
        if(c==='"'||c==="'"){quote=c;started=true;continue}
        if(/\s/.test(c)){if(started){tokens.push(token);token='';started=false}continue}
        if(/[|;&<>`]/.test(c)||c==='$')throw Error('仅支持单条 cURL，不支持 Shell 展开或管道');
        token+=c;started=true;
    }
    if(quote)throw Error('cURL 引号未闭合');if(started)tokens.push(token);return tokens;
}
export function importCurl(source:string){
    const tokens=curlTokens(source.trim());if(tokens.shift()!=='curl')throw Error('请粘贴以 curl 开头的命令');
    let url='',method='',body='';const headers:Record<string,string>=Object.create(null);let data=false;
    for(let i=0;i<tokens.length;i++){const t=tokens[i];
        if(['-X','--request','-H','--header','-d','--data','--data-raw','--data-binary','--url'].includes(t)){
            const value=tokens[++i];if(value===undefined)throw Error(t+' 缺少参数');
            if(t==='-X'||t==='--request')method=value.toUpperCase();
            else if(t==='-H'||t==='--header'){const colon=value.indexOf(':');if(colon<1)throw Error('请求头必须为 Name: Value');headers[value.slice(0,colon).trim()]=value.slice(colon+1).trim()}
            else if(t==='--url')url=value;
            else {if(value.startsWith('@'))throw Error('不支持从文件读取请求正文');body+=(data?'&':'')+value;data=true}
        }else if(t==='--compressed')continue;
        else if(t.startsWith('-'))throw Error('暂不支持 cURL 选项：'+t);
        else {if(url)throw Error('仅支持一个请求地址');url=t}
    }
    if(!/^https?:\/\//i.test(url))throw Error('请提供 HTTP 或 HTTPS 地址');
    const parsed=new URL(url);if(parsed.username||parsed.password)throw Error('请通过请求头填写认证信息');
    method=method||(data?'POST':'GET');if(!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(method))throw Error('不支持的 HTTP 方法');
    if(data&&!Object.keys(headers).some(k=>k.toLowerCase()==='content-type'))headers['Content-Type']='application/x-www-form-urlencoded';
    return {url,method,body,headers:JSON.stringify(headers,null,2)};
}
export function analyzeLog(input:string,level='all',query=''){
    const lines=input.split('\n');const rows:any[]=[];let keep=false;
    for(let index=0;index<lines.length;index++){
        const raw=lines[index];let text=raw;try{text=JSON.stringify(JSON.parse(raw),null,2)}catch{}
        const severity=/\b(error|fatal|exception)\b/i.test(raw)?'error':/\bwarn(?:ing)?\b/i.test(raw)?'warn':/\binfo\b/i.test(raw)?'info':'other';
        const continuation=/^\s+at\s|^Caused by:|^\s*\.\.\. \d+ more/.test(raw);
        if(!continuation)keep=(level==='all'||severity===level)&&(!query||raw.toLowerCase().includes(query.toLowerCase()));
        if(keep)rows.push({line:index+1,text,level:severity});
    }
    return rows;
}
export function exportCurl(value:any):string{
    const quote=(s:string)=>"'"+s.replace(/'/g,"'\\''")+"'";
    const headers=JSON.parse(value.headers||'{}');if(!headers||Array.isArray(headers)||typeof headers!=='object')throw Error('请求头必须为 JSON 对象');
    const parts=['curl',quote(value.url||''),'-X',quote(value.method||'GET')];
    for(const [key,val] of Object.entries(headers))parts.push('-H',quote(key+': '+String(val)));
    if(value.body)parts.push('--data-raw',quote(value.body));return parts.join(' ');
}
