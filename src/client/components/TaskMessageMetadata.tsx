import * as React from 'react'
import {messageOrigin,messageSender,messageSentTime,taskSource} from '../../shared/message-display.js'

export function TaskMessageMetadata({task,data,showTime=true}:{task:any;data:any;showTime?:boolean}):React.ReactElement|null {
    const source=taskSource(task,data?.sources || []);
    if(source?.provider!=='yunzhijia')return null;
    return <div role="group" aria-label="消息来源" className="wb-tiny wb-muted" style={{overflowWrap:'anywhere',marginTop:3}}>
        <div>发件人：{messageSender(source)} · 来自：{messageOrigin(source)}</div>
        {showTime&&<div>消息发出时间：{messageSentTime(source)}</div>}
    </div>;
}
