import * as React from 'react'
import lulu from '../assets/avatars/lulu.svg'

/** Bundled locally so chat avatars work offline and need no asset endpoint. */
export function AssistantAvatar(){
 return <img src={lulu} alt="" aria-hidden="true" data-avatar="lulu" draggable={false} style={{display:'block'}}/>
}
