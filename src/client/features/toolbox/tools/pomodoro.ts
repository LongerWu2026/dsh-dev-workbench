import * as React from 'react'
import { Btn, Icon, T, WB, h } from '../../../core/runtime.js'

function ToolPomodoro(): any {
    const FOCUS = 25 * 60;
    const [left, setLeft] = React.useState<any>(FOCUS);
    const [running, setRunning] = React.useState<any>(false);
    React.useEffect(function (): any {
        if (!running)
            return undefined;
        const timer = setInterval(function (): any {
            setLeft(function (previous?: any): any {
                if (previous <= 1) {
                    setRunning(false);
                    WB.toast('番茄钟结束，休息一下', 'ok');
                    return FOCUS;
                }
                return previous - 1;
            });
        }, 1000);
        return function (): any {
            clearInterval(timer);
        };
    }, [running]);
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    return h('div',{className:'wb-pomodoro'},h('div',{className:'wb-row',style:{gap:8}},h(Icon,{name:'clock',size:20}),h('span',{className:'wb-label'},'专注计时')),h('strong',{className:'wb-pomodoro-time'},mm+':'+ss),h('div',{className:'wb-row',style:{gap:8}},h(Btn,{size:'sm',kind:running?'ghost':'primary',icon:running?'close':'play',onClick:()=>setRunning(!running),children:running?'暂停':'开始'}),h(Btn,{size:'sm',kind:'subtle',icon:'refresh',onClick:()=>{setRunning(false);setLeft(FOCUS)},children:'重置'})),h('p',{className:'wb-tiny wb-muted',style:{margin:0}},'切换工具后继续计时'));
}
export { ToolPomodoro }
