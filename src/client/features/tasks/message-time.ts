import {taskSource} from '../../../shared/message-display.js'

/** Original task evidence time only; later follow-ups must not change its position. */
export function taskMessageTime(task:any,sources:any[]):number|null {
    const source=taskSource(task,sources)
    if(source?.provider!=='yunzhijia'||typeof source.locator?.sentAt!=='string')return null
    const time=Date.parse(source.locator.sentAt)
    return Number.isFinite(time)?time:null
}

/** Date inputs use Beijing calendar days, including the complete final day. */
export function matchesTaskMessageDates(time:number|null,from:string,to:string):boolean {
    if(!from&&!to)return true
    if(time===null)return false
    const day=new Date(time+8*3600000).toISOString().slice(0,10)
    return (!from||day>=from)&&(!to||day<=to)
}

/** Missing message times stay last in both directions; stable ties keep default order. */
export function sortTasksByMessageTime(tasks:any[],sources:any[],order:string):any[] {
    if(order!=='message-newest'&&order!=='message-oldest')return tasks
    const times=new Map(tasks.map(task=>[task,taskMessageTime(task,sources)]))
    return tasks.slice().sort((a,b)=>{
        const left=times.get(a)!,right=times.get(b)!
        if(left===null)return right===null?0:1
        if(right===null)return -1
        return order==='message-newest'?right-left:left-right
    })
}
