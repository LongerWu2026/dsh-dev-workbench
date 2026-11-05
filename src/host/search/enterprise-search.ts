import {ENTERPRISE_SEARCH_TYPES,isEnterpriseSearchType,enterpriseHasDates,enterpriseSearchRange} from '../../shared/enterprise-search.js'
import {probeYunzhijia,runYzj,searchEnterpriseGroup,searchContactsGroup,searchRoomsGroup,searchEventsGroup,searchAttendanceGroup} from '../integrations/yunzhijia.js'
import {asString,hostNowIso} from '../platform/runtime.js'

/** Explicit enterprise searches never fall through to web, GitHub or local files. */
export async function searchYunzhijia(ctx:any,request:any){
 const type=request.enterpriseType??'all'
 if(!isEnterpriseSearchType(type))throw Error('云之家搜索类型无效')
 const query=asString(request.query,200).trim(),spec=ENTERPRISE_SEARCH_TYPES.find(row=>row.id===type)!,dated=enterpriseHasDates(type)
 if(!query&&!dated)throw Error('请输入云之家搜索关键词')
 const options={force:true,...(dated?enterpriseSearchRange(type,request.start,request.end):{})}
 const finish=(groups:any[])=>({query:query||spec.label,scope:'enterprise',enterpriseType:type,at:hostNowIso(),total:groups.reduce((sum,group)=>sum+group.items.length,0),groups})
 const probe=await probeYunzhijia(ctx)
 if(probe.state!=='ok')return finish([{id:'enterprise',label:'云之家',status:'unavailable',items:[],note:probe.note||'请在连接与设置中检查云之家 CLI 与登录状态'}])
 const groups:any[]=[]
 const add=async(id:string,label:string,read:()=>Promise<any>)=>{
  try{groups.push(await read()||{id,label,status:'empty',items:[],note:'当前可见范围内没有匹配结果'})}
  catch(error){groups.push({id,label,status:'error',items:[],note:String(error.message||error)})}
 }
 if(['all','messages','documents'].includes(type))await add('enterprise','云之家消息与文档',()=>searchEnterpriseGroup(ctx,query,type==='all'?'all':type as 'messages'|'documents',probe))
 if(['all','contacts'].includes(type))await add('contacts','企业联系人',()=>searchContactsGroup(ctx,query,options))
 if(['all','groups'].includes(type))await add('groups','群聊',async()=>{
  const result=await runYzj(ctx,['im','group','search','--keyword',query])
  if(result.status!=='ok')return {id:'groups',label:'群聊',status:'error',items:[],note:'群聊查询失败：'+(result.note||result.status)}
  const items=(Array.isArray(result.json?.data?.list)?result.json.data.list:[]).slice(0,20).filter((row:any)=>row?.groupId&&(row.groupName||row.name)).map((row:any)=>({id:'yzj-group-'+asString(row.groupId,120),title:asString(row.groupName||row.name,160),snippet:'云之家群聊',url:null,kind:'group',extra:{provider:'yunzhijia',groupId:asString(row.groupId,120),accountId:probe.accountId}}))
  return {id:'groups',label:'群聊',status:items.length?'ok':'empty',items,note:result.json?.data?.more?'仅展示本次返回的群聊，未加载的结果不代表不存在':'按群名搜索当前账号可见的群聊'}
 })
 if(type==='events')await add('events','日程与会议',()=>searchEventsGroup(ctx,query,options))
 if(type==='rooms')await add('rooms','会议室',()=>searchRoomsGroup(ctx,query,options))
 if(type==='attendance')await add('attendance','本人考勤',()=>searchAttendanceGroup(ctx,query,options))
 for(const group of groups)for(const item of group.items)item.extra={...item.extra,accountId:probe.accountId,provider:'yunzhijia'}
 return finish(groups)
}
