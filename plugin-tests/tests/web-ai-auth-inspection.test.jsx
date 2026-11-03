import {describe,it,expect} from 'vitest'
import {JSDOM} from 'jsdom'
import {webAIAuthInspectionScript} from '../../src/shared/web-ai-auth-inspection.ts'
describe('登录结构诊断只返回非身份元数据',()=>{
 it('不输出昵称、邮箱、密码、图片地址或请求参数',()=>{
  const dom=new JSDOM('<aside><button class="user-avatar"><img alt="PRIVATE-NAME" src="https://private.invalid/avatar?token=PRIVATE-TOKEN"><span>PRIVATE-NAME</span></button><button>设置</button></aside><input type="password" value="PRIVATE-PASSWORD"><article><button class="user-avatar">PRIVATE-CHAT</button></article>',{url:'https://chatglm.cn/',runScripts:'outside-only'})
  dom.window.Element.prototype.getClientRects=()=>[{}]
  dom.window.performance.getEntriesByType=()=>[{name:'https://chatglm.cn/api/user/PRIVATE-IDENTITY?token=PRIVATE-TOKEN'},{name:'https://outside.invalid/api/user/info'}]
  try{const result=dom.window.eval(webAIAuthInspectionScript('glm'));expect(result.supported).toBe(true);expect(result.nodes.some(node=>node.classes.includes('user-avatar'))).toBe(true);expect(result.resources).toEqual(['/api/user/:segment']);expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private\.invalid|outside\.invalid/)}finally{dom.window.close()}
 })
 it('不在所选厂商时拒绝读取结构',()=>{
  const dom=new JSDOM('<button>设置</button>',{url:'https://outside.invalid/',runScripts:'outside-only'});try{expect(dom.window.eval(webAIAuthInspectionScript('glm'))).toEqual({supported:false})}finally{dom.window.close()}
 })
})
