import { it, expect } from 'vitest'
import { isIrrelevantConversation } from '../../src/shared/inbox-triage.ts'
import { assertAnalysisShape } from '../../src/shared/contracts.ts'

const at='2026-10-29T00:00:00Z', analyzedAt='2026-10-29T00:01:00Z'
function fixture() {
  const conversation={groupId:'group',latestMsgId:'m2',unreadCount:2}
  const data={messageInbox:{accountId:'account'},syncCursors:{'account:group':{accountId:'account',intakePolicy:'focused-v1',lastMsgId:'m2',unreadHeadId:'m2',unreadCount:2,unreadMsgIds:['m1','m2']}},sources:[],analysisQueue:[],tasks:[],replies:[]}
  for(const id of ['m1','m2']) {
    data.sources.push({id:'source-'+id,provider:'yunzhijia',fetchedAt:at,selection:{policy:'focused-v1',reasons:['unread']},locator:{accountId:'account',groupId:'group',msgId:id,direction:'inbound'}})
    data.analysisQueue.push({sourceId:'source-'+id,accountId:'account',groupId:'group',msgId:id,status:'done',analyzedAt,analysis:{noise:true,relevance:'irrelevant',items:[]}})
  }
  return {data,conversation}
}
it('仅完整未读窗口全部明确无关且无既有义务时可收起，判断不修改状态',()=>{
  const {data,conversation}=fixture(),before=JSON.stringify(data)
  expect(isIrrelevantConversation(data,conversation)).toBe(true)
  expect(JSON.stringify(data)).toBe(before)
})
it.each([
  ['新消息到达',({conversation})=>{conversation.latestMsgId='m3'}],
  ['未读数增加',({conversation})=>{conversation.unreadCount=3}],
  ['未读减少且窗口过期',({conversation})=>{conversation.unreadCount=1}],
  ['缺少完整未读清单',({data})=>{delete data.syncCursors['account:group'].unreadMsgIds}],
  ['重复ID不能凑齐数量',({data})=>{data.syncCursors['account:group'].unreadMsgIds=['m2','m2']}],
  ['分页采集中',({data})=>{data.syncCursors['account:group'].resumeBefore='m1'}],
  ['会话等待续采',({data})=>{data.syncCursors['__pending:account']={pendingGroups:[{groupId:'group'}]}}],
  ['来源缺失',({data})=>{data.sources.pop()}],
  ['原文可能被截断',({data})=>{data.sources[0].excerpt='文'.repeat(4000)}],
  ['跨账号来源',({data})=>{data.sources[0].locator.accountId='other'}],
  ['跨账号结果',({data})=>{data.analysisQueue[0].accountId='other'}],
  ['旧识别没有相关性结论',({data})=>{delete data.analysisQueue[0].analysis.relevance}],
  ['仍与本人相关',({data})=>{data.analysisQueue[0].analysis.relevance='relevant'}],
  ['相关性不确定',({data})=>{data.analysisQueue[0].analysis.relevance='uncertain'}],
  ['不是noise',({data})=>{data.analysisQueue[0].analysis.noise=false}],
  ['仍有识别事项',({data})=>{data.analysisQueue[0].analysis.items=[{needsReply:false,needsAction:false}]}],
  ['待识别',({data})=>{data.analysisQueue[0].status='pending'}],
  ['识别失败',({data})=>{data.analysisQueue[0].status='failed'}],
  ['待人工复核',({data})=>{data.analysisQueue[0].status='awaiting_human'}],
  ['识别结果早于来源',({data})=>{data.analysisQueue[0].analyzedAt='2026-10-28T00:00:00Z'}],
  ['仍有待办',({data})=>{data.tasks.push({status:'ready',sourceRefId:'source-m1'})}],
  ['多个来源关联的待办',({data})=>{data.tasks.push({status:'running',sourceRefs:[{sourceId:'source-m1'}]})}],
  ['仍有待回复',({data})=>{data.replies.push({stage:'待回复',sourceId:'source-m1'})}],
  ['同会话仍有确认收到的义务',({data})=>{data.replies.push({stage:'已确认收到',accountId:'account',groupId:'group'})}],
])('%s时保持可见',(_name,mutate)=>{
  const state=fixture();mutate(state)
  expect(isIrrelevantConversation(state.data,state.conversation)).toBe(false)
})
it('其他账号的同名会话和已结束义务不阻止当前会话收起',()=>{
  const {data,conversation}=fixture()
  data.tasks.push({status:'completed',sourceRefId:'source-m1'})
  data.replies.push({stage:'不需回复',sourceId:'source-m1'},{stage:'待回复',accountId:'other',groupId:'group'})
  expect(isIrrelevantConversation(data,conversation)).toBe(true)
})
it('旧结果兼容，明确无关与事项冲突及非法相关性会被拒绝',()=>{
  expect(()=>assertAnalysisShape({noise:true,items:[]})).not.toThrow()
  expect(()=>assertAnalysisShape({noise:true,relevance:'irrelevant',items:[]})).not.toThrow()
  for(const value of [{noise:false,relevance:'irrelevant',items:[]},{noise:true,relevance:'irrelevant',items:[{}]},{noise:true,relevance:'guess',items:[]}])expect(()=>assertAnalysisShape(value)).toThrow()
})
