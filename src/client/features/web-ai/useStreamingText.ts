import * as React from 'react'

/** Animate only newly received suffixes. History, provider switches and corrections are immediate. */
export function useStreamingText(identity:string,text:string,streaming:boolean,visible=true){
 const [shown,setShown]=React.useState({identity,text})
 const current=React.useRef(shown),target=React.useRef(text),previous=React.useRef({identity,streaming})
 React.useEffect(()=>{
  const old=previous.current;previous.current={identity,streaming};target.current=text
  let timer:ReturnType<typeof setTimeout>|undefined,disposed=false
  const publish=(value:string)=>{current.current={identity,text:value};setShown(current.current)}
  const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
  const snap=()=>publish(target.current)
  const visibility=()=>{if(document.hidden)snap()}
  const tick=()=>{
   if(disposed)return
   if(document.hidden||reduced()){snap();return}
   const tail=Array.from(target.current.slice(current.current.text.length))
   if(!tail.length)return
   // Catch up in a bounded number of frames, including very long website chunks.
   const step=Math.max(streaming?1:4,Math.ceil(tail.length/(streaming?6:3)))
   publish(current.current.text+tail.slice(0,step).join(''))
   if(current.current.text!==target.current)timer=setTimeout(tick,32)
  }
  if(old.identity!==identity||!visible||document.hidden||reduced()||!streaming&&!old.streaming||!text.startsWith(current.current.text))snap()
  else if(text!==current.current.text)timer=setTimeout(tick,32)
  document.addEventListener('visibilitychange',visibility)
  return()=>{disposed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)}
 },[identity,text,streaming,visible])
 return shown.identity===identity?shown.text:text
}
