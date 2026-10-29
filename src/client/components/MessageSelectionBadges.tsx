import * as React from 'react'
import {Badge} from '../core/runtime.js'
export function MessageSelectionBadges({source,inbox}:{source:any;inbox?:any}){
 if(source?.provider==='yunzhijia-calendar')return <Badge tone="accent">日历会议</Badge>
 const selection=source?.selection;if(selection?.policy!=='focused-v1')return null
 const current=inbox&&inbox.accountId===source.locator?.accountId?inbox.conversations?.find((c:any)=>c.groupId===source.locator?.groupId):null
 const count=current?current.unreadCount:selection.unreadCount
 return <span className="wb-row wb-row--wrap" style={{gap:5}}>{selection.reasons.includes('mention_me')&&<Badge tone="accent">@本人</Badge>}{selection.reasons.includes('mention_all')&&<Badge tone="warn">@全员</Badge>}{selection.reasons.includes('followup')&&<Badge tone="idle">事项跟进</Badge>}{count==null?<Badge tone="idle">会话未读未知</Badge>:<Badge tone={count>0?'warn':'idle'}>{count>0?'会话未读 '+count:'会话已读'}</Badge>}</span>
}
