import {screen,fireEvent,within} from '@testing-library/react'
export function dataAction(name,connectionName){
 const trigger=connectionName
  ?screen.getByRole('button',{name:connectionName+'的更多操作',exact:true})
  :screen.queryByRole('list',{name:'已保存连接'})?.querySelector('[data-active=true] .wb-data-more > button')
 if(!trigger&&name==='连接配置')return screen.getByRole('button',{name:'新建连接',exact:true})
 if(!trigger)throw Error('没有选中的数据库连接')
 const menu=trigger.closest('.wb-data-more')
 if(trigger.getAttribute('aria-expanded')!=='true')fireEvent.click(trigger)
 return within(menu).getByRole('button',{name,exact:true})
}
