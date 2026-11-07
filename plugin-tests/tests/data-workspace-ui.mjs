import {screen,fireEvent} from '@testing-library/react'
export function dataAction(name){
 const trigger=screen.getByLabelText('数据连接更多操作')
 if(!trigger.closest('details').open)fireEvent.click(trigger)
 return screen.getByRole('button',{name,exact:true})
}
export function showDataObjects(){fireEvent.click(screen.getByRole('tab',{name:'对象',exact:true}))}
export function showDataConnections(){fireEvent.click(screen.getByRole('tab',{name:'连接',exact:true}))}
