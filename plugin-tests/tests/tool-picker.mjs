import {screen,fireEvent} from '@testing-library/react'
export function openTools(){const trigger=screen.getByRole('button',{name:'切换工具',exact:true});if(trigger.getAttribute('aria-expanded')!=='true')fireEvent.click(trigger)}
export function toolButton(name){openTools();return screen.getByRole('button',{name})}
