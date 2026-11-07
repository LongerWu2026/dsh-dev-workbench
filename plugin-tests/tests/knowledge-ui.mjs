import {screen} from '@testing-library/react'
export async function openKnowledgeTool(user,name){
 await user.click(screen.getByLabelText('知识更多操作'))
 await user.click(screen.getByRole('button',{name,exact:true}))
}
