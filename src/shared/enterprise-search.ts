export const ENTERPRISE_SEARCH_TYPES=[
 {id:'all',label:'全部',hint:'查找联系人、消息、文档和群聊。'},
 {id:'contacts',label:'联系人',hint:'按姓名或关键词查询通讯录，展示姓名、部门和岗位。'},
 {id:'messages',label:'消息',hint:'搜索当前账号可见的聊天消息。'},
 {id:'documents',label:'文档',hint:'匹配云之家文档标题和文件名，不检索文档正文。'},
 {id:'groups',label:'群聊',hint:'按群名查找当前账号可见的群聊。'},
 {id:'events',label:'日程',hint:'查询所选日期内的日程，可输入标题关键词。'},
 {id:'rooms',label:'会议室',hint:'查询所选时段的空闲会议室，可按名称筛选。'},
 {id:'attendance',label:'本人考勤',hint:'仅查询本人打卡流水，不代表迟到、缺卡等考勤结论。'},
] as const
export type EnterpriseSearchType=typeof ENTERPRISE_SEARCH_TYPES[number]['id']
export const isEnterpriseSearchType=(value:unknown):value is EnterpriseSearchType=>ENTERPRISE_SEARCH_TYPES.some(type=>type.id===value)
export const enterpriseHasDates=(kind:string)=>['events','rooms','attendance'].includes(kind)
export function enterpriseDefaultRange(kind:string,now=Date.now()){
 const local=(at:number)=>new Date(at+8*3600000).toISOString()
 if(kind==='rooms'){const start=Math.ceil(now/900000)*900000;return {start:local(start).slice(0,16),end:local(start+3600000).slice(0,16)}}
 return {start:local(now).slice(0,10),end:local(now+(kind==='events'?2:0)*86400000).slice(0,10)}
}
export function enterpriseSearchRange(kind:string,start?:unknown,end?:unknown){
 const defaults=enterpriseDefaultRange(kind),a=start===undefined?defaults.start:String(start),b=end===undefined?defaults.end:String(end)
 const pattern=kind==='rooms'?/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/:/^\d{4}-\d{2}-\d{2}$/
 if(!pattern.test(a)||!pattern.test(b))throw Error('请选择有效的查询起止时间（北京时间）')
 const parse=(value:string)=>Date.parse(value+(kind==='rooms'?':00+08:00':'T00:00:00+08:00'))
 const from=parse(a),to=parse(b)
 if(!Number.isFinite(from)||!Number.isFinite(to)||new Date(from+8*3600000).toISOString().slice(0,a.length)!==a||new Date(to+8*3600000).toISOString().slice(0,b.length)!==b||to<from||kind==='rooms'&&to===from)throw Error('查询结束时间必须晚于开始时间；按天查询可选择同一天')
 if((to-from)/86400000>180)throw Error('单次查询时间跨度不能超过 180 天')
 return {start:kind==='rooms'?a+':00+08:00':a,end:kind==='rooms'?b+':00+08:00':b}
}
