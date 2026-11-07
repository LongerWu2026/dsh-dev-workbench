import React from 'react'
import {describe,it,expect,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {toolDiffLines,toolDiffPairs,toolDiffInline} from '../../src/client/features/toolbox/tools/diff-model.ts'
import {loadClientBundle} from './load-plugin.mjs'
import {openTools} from './tool-picker.mjs'
afterEach(cleanup)
const compare=(left,right,ignore=false)=>toolDiffPairs(toolDiffLines(left,right,ignore).rows)

describe('左右逐行 Diff',()=>{
 it('修改成对显示，新增留空补齐，后续原文与修改行号各自连续',()=>{
  expect(compare('alpha\nbeta\ngamma\ndelta','alpha\nbeta changed\ngamma\ndelta\nepsilon')).toEqual([
   {type:'same',left:{line:1,text:'alpha'},right:{line:1,text:'alpha'}},
   {type:'change',left:{line:2,text:'beta'},right:{line:2,text:'beta changed'}},
   {type:'same',left:{line:3,text:'gamma'},right:{line:3,text:'gamma'}},
   {type:'same',left:{line:4,text:'delta'},right:{line:4,text:'delta'}},
   {type:'add',left:null,right:{line:5,text:'epsilon'}}])
 })
 it('删除与空行不会导致下一段相同行错位',()=>{
  expect(compare('a\nremove\n\nc','a\n\nc')).toEqual([
   {type:'same',left:{line:1,text:'a'},right:{line:1,text:'a'}},
   {type:'del',left:{line:2,text:'remove'},right:null},
   {type:'same',left:{line:3,text:''},right:{line:2,text:''}},
   {type:'same',left:{line:4,text:'c'},right:{line:3,text:'c'}}])
 })
 it('忽略空白只影响比较，保留左右原始缩进',()=>{
  expect(compare('  a  \n b','a\nb ',true)).toEqual([
   {type:'same',left:{line:1,text:'  a  '},right:{line:1,text:'a'}},
   {type:'same',left:{line:2,text:' b'},right:{line:2,text:'b '}}])
 })
 it('标出一行内多处不同字符，保留中文与完整 emoji',()=>{
  const parts=toolDiffInline('价格10元，库存20件😀','价格15元，库存25件😃')
  expect(parts.left.filter(p=>p.changed).map(p=>p.text)).toEqual(['0','0','😀'])
  expect(parts.right.filter(p=>p.changed).map(p=>p.text)).toEqual(['5','5','😃'])
  expect(parts.left.map(p=>p.text).join('')).toBe('价格10元，库存20件😀')
  expect(parts.right.map(p=>p.text).join('')).toBe('价格15元，库存25件😃')
 })
 it('空行与超长行的行内差异不丢内容，大段替换走有界计算',()=>{
  expect(toolDiffInline('','new')).toEqual({left:[],right:[{text:'new',changed:true}]})
  const left='prefix'+'x'.repeat(10000)+'suffix',right='prefix'+'y'.repeat(10000)+'suffix'
  const parts=toolDiffInline(left,right)
  expect(parts.left).toEqual([{text:'prefix',changed:false},{text:'x'.repeat(10000),changed:true},{text:'suffix',changed:false}])
  expect(parts.right.map(p=>p.text).join('')).toBe(right)
  expect(toolDiffInline('x'.repeat(100000),'').left).toEqual([{text:'x'.repeat(100000),changed:true}])
 })
 it('JSON 删除和新增字段不会被合成同一条字段修改',()=>{
  expect(toolDiffPairs([{type:'del',text:'a: 1'},{type:'add',text:'b: 2'}],true)).toEqual([
   {type:'del',left:{text:'a: 1'},right:null},{type:'add',left:null,right:{text:'b: 2'}}])
 })
 it('超过400行仍拒绝计算',()=>expect(()=>toolDiffLines('a\n'.repeat(400),'a')).toThrow('上限 400 行'))
 it('实际页面显示左右源行号、空位和行内高亮，文本按原样显示',()=>{
  const {WB}=loadClientBundle();render(<WB.pages.toolbox/>);openTools();fireEvent.click(screen.getByRole('button',{name:/文本 Diff/}))
  fireEvent.change(screen.getByRole('textbox',{name:'原始文本'}),{target:{value:'<img src=x>\nold\nremove\nend'}})
  fireEvent.change(screen.getByRole('textbox',{name:'修改后文本'}),{target:{value:'<img src=x>\nnew\nend\nadded'}})
  fireEvent.click(screen.getByRole('button',{name:'对比',exact:true}))
  const output=screen.getByRole('region',{name:'左右逐行对比结果，可滚动'})
  expect(output.querySelectorAll('.wb-diff-head>span')).toHaveLength(2)
  expect(output.querySelectorAll('.wb-diff-pair')).toHaveLength(5)
  expect(output.querySelectorAll('.wb-diff-cell--empty')).toHaveLength(2)
  expect(output.querySelector('mark').textContent).toBe('old')
  expect(output.querySelector('img')).toBeNull()
  expect(output.querySelector('[aria-label="原文第 4 行"]').parentElement.textContent).toContain('end')
  expect(output.querySelector('[aria-label="修改后第 3 行"]').parentElement.textContent).toContain('end')
  fireEvent.change(screen.getByRole('textbox',{name:'修改后文本'}),{target:{value:'a\n'.repeat(400)}})
  fireEvent.click(screen.getByRole('button',{name:'对比',exact:true}))
  expect(screen.getByRole('alert').textContent).toContain('上限 400 行')
  expect(screen.queryByRole('region',{name:'左右逐行对比结果，可滚动'})).toBeNull()
 })
})
