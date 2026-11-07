/** Real temporary project searches, Git snapshots and durable per-project records. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,symlinkSync,utimesSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn,execFileSync} from 'node:child_process'
import {build} from 'esbuild'
const home=realpathSync(mkdtempSync(join(tmpdir(),'workbench-project-workspace-')));process.env.DSH_HOME=home
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {api,setShared_workbenchCtx}=await import(join(home,'host.mjs'));let checks=0
const check=(label,fn)=>{fn();checks++;console.log('✓',label)}
const subprocess={spawn(spec){const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,signal:spec.signal,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);return {done:new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',exitCode=>resolve({exitCode}))}),collected:{stdout:{readFrom:()=>({text:stdout})},stderr:{readFrom:()=>({text:stderr})}}}}}
try{
 const a=join(home,'project a'),b=join(home,'project b');mkdirSync(a);mkdirSync(b);mkdirSync(join(a,'src'))
 writeFileSync(join(a,'src/main.ts'),'first\n中文 Needle\nliteral.*\n');writeFileSync(join(a,'README.md'),'Needle document\n');writeFileSync(join(b,'README.md'),'Needle other project\n')
 for(const dir of ['node_modules','dist','.git']){mkdirSync(join(a,dir));writeFileSync(join(a,dir,'hidden.txt'),'EXCLUDED_NEEDLE')}
 writeFileSync(join(a,'binary.bin'),Buffer.from([0,1,2,78]));writeFileSync(join(a,'huge.txt'),'LARGE_NEEDLE'.repeat(100000));symlinkSync(b,join(a,'outside-link'))
 let state=await api.saveProject({name:'A',repoPath:a});const aid=state.projects[0].id
 state=await api.saveProject({name:'B',repoPath:b});const bid=state.projects.find(row=>row.name==='B').id,files=(id,request)=>api.projectFiles({projectId:id,...request})
 const found=await files(aid,{action:'search',query:'needle',root:b})
 check('全文搜索覆盖子目录，返回真实文件与行号并限定当前项目',()=>{assert.equal(found.hits.length,2);assert.ok(found.hits.some(row=>row.path==='src/main.ts'&&row.line===2&&row.snippet.includes('中文')));assert.equal(found.hits.some(row=>row.snippet.includes('other project')),false)})
 assert.equal((await files(aid,{action:'search',query:'needle',caseSensitive:true})).hits.length,0)
 assert.equal((await files(aid,{action:'search',query:'.*'})).hits.length,1)
 const excluded=await files(aid,{action:'search',query:'EXCLUDED_NEEDLE'});check('搜索跳过依赖、构建、Git、二进制、大文件和目录链接',()=>{assert.equal(excluded.hits.length,0);assert.ok(excluded.skipped>=5)})
 await assert.rejects(files('unknown',{action:'search',query:'needle'}),/已配置/);await assert.rejects(files(aid,{action:'search',query:''}),/搜索词/);await assert.rejects(files(aid,{action:'search',query:'bad\nquery'}),/搜索词/)
 const plain=await files(aid,{action:'read',path:'README.md'});await files(aid,{action:'reviewMark',view:'file',path:'README.md',fingerprint:plain.fingerprint})
 check('文件标记已审阅后可恢复，其他项目同名文件保持待审阅',()=>{})
 assert.equal((await files(aid,{action:'read',path:'README.md'})).review.status,'reviewed');assert.equal((await files(bid,{action:'read',path:'README.md'})).review.status,'pending')
 await assert.rejects(files(bid,{action:'reviewMark',view:'file',path:'README.md',fingerprint:plain.fingerprint}),/已变化/)
 const stamp=statSync(join(a,'README.md'));writeFileSync(join(a,'README.md'),'Needle altered!\n');utimesSync(join(a,'README.md'),stamp.atime,stamp.mtime)
 const stale=await files(aid,{action:'read',path:'README.md'});check('内容变化后旧审阅标记失效，不仅比较文件时间',()=>assert.equal(stale.review.status,'stale'))
 await assert.rejects(files(aid,{action:'reviewMark',view:'file',path:'README.md',fingerprint:plain.fingerprint}),/已变化/)
 await files(aid,{action:'reviewMark',view:'file',path:'README.md',fingerprint:stale.fingerprint})
 const beforeRestart=await files(aid,{action:'search',query:'Needle',caseSensitive:true}),workspace=await files(aid,{action:'workspace'}),other=await files(bid,{action:'workspace'})
 check('搜索词、大小写和最近搜索按项目分别保存',()=>{assert.equal(workspace.search.query,'Needle');assert.equal(workspace.search.caseSensitive,true);assert.ok(workspace.search.history.includes('needle'));assert.equal(other.search.query,'')})
 const restart=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`const {api}=await import(${JSON.stringify(join(home,'host.mjs'))});console.log(JSON.stringify({workspace:await api.projectFiles({projectId:${JSON.stringify(aid)},action:'workspace'}),file:await api.projectFiles({projectId:${JSON.stringify(aid)},action:'read',path:'README.md'})}))`],{encoding:'utf8',env:{...process.env,DSH_HOME:home}}))
 check('独立进程重启后仍恢复项目搜索和审阅状态',()=>{assert.equal(restart.workspace.search.query,'Needle');assert.equal(restart.file.review.status,'reviewed')})
 await files(aid,{action:'reviewUnmark',view:'file',path:'README.md'});assert.equal((await files(aid,{action:'read',path:'README.md'})).review.status,'pending')
 // Replace the synthetic .git folder with a real repository entirely inside the fixture.
 rmSync(join(a,'.git'),{recursive:true});const git=args=>execFileSync('git',args,{cwd:a,stdio:'pipe'})
 git(['init']);git(['add','README.md','src/main.ts']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','initial'])
 writeFileSync(join(a,'src/main.ts'),'first\nchanged value\n');setShared_workbenchCtx({get:key=>key==='subprocess'?subprocess:null})
 const diff=await files(aid,{action:'diff',path:'src/main.ts',changeStatus:' M'})
 await files(aid,{action:'reviewMark',view:'diff',path:'src/main.ts',changeStatus:' M',fingerprint:diff.fingerprint})
 let progress=await files(aid,{action:'reviews'});check('当前改动与已保存的审阅标记合并显示真实进度',()=>{assert.equal(progress.entries.find(row=>row.path==='src/main.ts'&&row.view==='diff').status,'reviewed');assert.equal(progress.summary.reviewed,1)})
 git(['add','src/main.ts']);progress=await files(aid,{action:'reviews'});check('暂存状态变化后提示重新审阅，且不重复列出旧记录',()=>{const rows=progress.entries.filter(row=>row.path==='src/main.ts'&&row.view==='diff');assert.equal(rows.length,1);assert.equal(rows[0].status,'stale')})
 const staged=await files(aid,{action:'diff',path:'src/main.ts',changeStatus:'M '});await files(aid,{action:'reviewMark',view:'diff',path:'src/main.ts',changeStatus:'M ',fingerprint:staged.fingerprint})
 git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','change']);progress=await files(aid,{action:'reviews'});check('已提交改动保留历史记录，并明确标为已无待审改动',()=>assert.ok(progress.entries.some(row=>row.path==='src/main.ts'&&row.status==='inactive')))
 const one=await files(aid,{action:'read',path:'README.md'}),two=await files(aid,{action:'read',path:'src/main.ts'})
 await Promise.all([files(aid,{action:'reviewMark',view:'file',path:'README.md',fingerprint:one.fingerprint}),files(aid,{action:'reviewMark',view:'file',path:'src/main.ts',fingerprint:two.fingerprint})])
 check('并发保存不同文件标记不丢记录',()=>{})
 assert.equal((await files(aid,{action:'read',path:'README.md'})).review.status,'reviewed');assert.equal((await files(aid,{action:'read',path:'src/main.ts'})).review.status,'reviewed')
 await api.saveProject({id:aid,repoPath:b});const rebound=await files(aid,{action:'workspace'});check('同一项目改绑目录后不继承旧目录记录，也不串入另一项目记录',()=>assert.equal(rebound.search.query,''));await api.saveProject({id:aid,repoPath:a})
 writeFileSync(join(a,'many.txt'),'CAP_NEEDLE\n'.repeat(250));const capped=await files(aid,{action:'search',query:'CAP_NEEDLE'});check('命中上限明确提示结果不完整，卡片无需无限加载',()=>{assert.equal(capped.hits.length,200);assert.equal(capped.limited,true)})
 assert.equal(readFileSync(join(b,'README.md'),'utf8'),'Needle other project\n');assert.ok(beforeRestart.hits.length)
 console.log('project-workspace: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
