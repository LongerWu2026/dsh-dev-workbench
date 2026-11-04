/** Daily message sync slots in Asia/Shanghai, independent of the machine timezone. */
export const MESSAGE_SYNC_SCHEDULE={timezone:'Asia/Shanghai',start:'09:00',end:'21:00',intervalMinutes:5} as const
export function messageWindowOpen(now=Date.now()):boolean {
 const local=new Date(now+8*3600000),minute=local.getUTCHours()*60+local.getUTCMinutes()
 return minute>=9*60&&minute<=21*60
}
export function messageSyncDue(state:any,now=Date.now()):boolean {
 const config=state.settings?.automation
 if(!config?.enabled||config.mentions===false||!messageWindowOpen(now))return false
 const pending=state.syncCursors?.['__pending:'+state.messageInbox?.accountId]
 const retryAt=Date.parse(pending?.retryAt)
 if(retryAt>now)return false
 if(Number.isFinite(retryAt)&&retryAt<=now&&(Date.parse(state.lastMessageSyncAttemptAt||'')||0)<retryAt){
  const accountPrefix=state.messageInbox?.accountId+':',hasBackfill=pending?.pendingGroups?.length||Object.entries(state.syncCursors||{}).some(([key,cursor]:[string,any])=>key.startsWith(accountPrefix)&&cursor?.intakePolicy==='focused-v1'&&cursor.resumeBefore)
  if(hasBackfill)return true
 }
 const slot=Math.floor(now/300000)*300000
 const last=Math.max(Date.parse(state.lastMessageSyncAttemptAt||'')||0,Date.parse(state.messageInbox?.at||'')||0)
 return last<slot
}
