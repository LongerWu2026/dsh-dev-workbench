import React from 'react'
import {afterEach,expect,it} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {JSDOM} from 'jsdom'
import {webAIPageScript} from '../../src/shared/web-ai-page.ts'
import {MessageContent} from '../../src/client/features/web-ai/MessageContent.tsx'

afterEach(cleanup)
const tree='DeepSeek Harness\n│\n├── Developer Workspace Plugin\n│   ├── UI Layer（React + TypeScript）\n│   │   ├── AI 资讯面板\n│   │   └── 每日待办面板\n│   └── Plugin Host\n└── Optional External Services'
const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
function capture(html){
 const dom=new JSDOM('<div data-message-author-role="user">架构图</div><div data-message-author-role="assistant"><div class="markdown">'+html+'</div></div><textarea></textarea>',{url:'https://chatgpt.com/',runScripts:'outside-only'})
 dom.window.Element.prototype.getClientRects=()=>[{}]
 try{return dom.window.eval(webAIPageScript('chatgpt','observe')).answers[0]}finally{dom.window.close()}
}
it.each(['code','pre','editor'])('%s形式的官网架构树采集和渲染后逐行逐空格一致',kind=>{
 const html=kind==='code'?'<p>纯文本</p><code>'+escape(tree)+'</code>':kind==='pre'?'<pre><code>'+escape(tree)+'</code></pre>':'<pre><div class="cm-content">'+tree.split('\n').map(line=>'<div class="cm-line">'+escape(line)+'</div>').join('')+'</div></pre>'
 const text=capture('<h2>架构</h2>'+html+'<p>这里最重要的是</p>'),view=render(<MessageContent text={text}/>)
 expect(text).toContain('```\n'+tree+'\n```');expect(view.container.querySelectorAll('pre')).toHaveLength(1);expect(view.container.querySelector('pre code').textContent).toBe(tree)
 expect(screen.getByRole('heading',{name:'架构'})).toBeTruthy();expect(screen.getByText('这里最重要的是')).toBeTruthy()
})
it('代码中的br、空行、高亮片段和缩进保留，按钮和行号排除',()=>{
 const text=capture('<pre><code class="language-text"><span class="line-number">1</span>root<br><br>│   <span>├── </span>UI<br><span class="line-number">4</span>    └── Host<button>复制代码</button></code></pre>'),view=render(<MessageContent text={text}/>)
 expect(view.container.querySelector('pre code').textContent).toBe('root\n\n│   ├── UI\n    └── Host');expect(text).not.toContain('复制代码')
})
it('代码含反引号时使用更长围栏，不提前闭合或执行HTML',()=>{
 const code=tree+'\n```\n<img src=x onerror=alert(1)>'
 const text=capture('<code>'+escape(code)+'</code>'),view=render(<MessageContent text={text}/>)
 expect(text).toContain('````\n');expect(view.container.querySelector('pre code').textContent).toBe(code);expect(view.container.querySelector('img')).toBeNull()
})
it('普通行内代码继续行内显示，不被包成代码块',()=>{
 const text=capture('<p>使用 <code>ctx.tools</code> 注册工具。</p>'),view=render(<MessageContent text={text}/>)
 expect(view.container.querySelector('pre')).toBeNull();expect(view.container.querySelector('code').textContent).toBe('ctx.tools')
})
it('历史单反引号目录树恢复为多行代码块，不改写传入历史文本',()=>{
 const text='## 整体架构\n\n使用 `ctx.tools` 注册。\n\n纯文本\n\n`'+tree+'`\n\n这里最重要的是',copy=text,view=render(<MessageContent text={text}/>)
 expect(view.container.querySelector('pre code').textContent).toBe(tree);expect(view.container.querySelector('p code').textContent).toBe('ctx.tools');expect(screen.getByText('这里最重要的是')).toBeTruthy();expect(text).toBe(copy)
})
it('现有代码围栏和缩进代码示例中的反引号目录树不被二次修复',()=>{
 const raw='`'+tree+'`',text='```text\n'+raw+'\n```\n\n'+raw.split('\n').map(line=>'    '+line).join('\n'),view=render(<MessageContent text={text}/>)
 expect([...view.container.querySelectorAll('pre code')].map(el=>el.textContent)).toEqual([raw,raw])
})
it('跨行的普通行内代码以及正文中的树形符号不被强行改写',()=>{
 const text='`first\nsecond`\n\n正文中提到 ├── 符号，使用 `ctx.tools`。',view=render(<MessageContent text={text}/>)
 expect(view.container.querySelector('pre')).toBeNull();expect([...view.container.querySelectorAll('code')].map(el=>el.textContent)).toEqual(['first second','ctx.tools'])
})
