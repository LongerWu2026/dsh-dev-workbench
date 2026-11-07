/** Real temporary files and Git repositories; no user projects or external writes. */
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
const home=realpathSync(mkdtempSync(join(tmpdir(),'workbench-project-files-')));process.env.DSH_HOME=home
await build({stdin:{contents:`export {workbenchApi as api,setShared_workbenchCtx} from './src/host/application/workbench-service.ts';export {projectChangeEntries} from './src/host/integrations/project-files.ts';`,resolveDir:resolve('.'),loader:'ts'},outfile:join(home,'host.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'})
const {api,setShared_workbenchCtx,projectChangeEntries}=await import(join(home,'host.mjs'))
let checks=0
const check=(label,fn)=>{fn();checks++;console.log('✓',label)}
const subprocess={spawn(spec){
 const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,signal:spec.signal,stdio:['ignore','pipe','pipe']});let stdout='',stderr=''
 child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk})
 return {done:new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',exitCode=>resolve({exitCode}))}),collected:{stdout:{readFrom:()=>({text:stdout})},stderr:{readFrom:()=>({text:stderr})}}}
}}
try{
 const root=join(home,'项目 with spaces'),outside=join(home,'outside');mkdirSync(root);mkdirSync(outside);mkdirSync(join(root,'src'))
 const content='中文文件 #1\n<img src=x onerror=alert(1)>\n';writeFileSync(join(root,'src','报告 #1.ts'),content);writeFileSync(join(root,'empty.txt'),'');writeFileSync(join(outside,'secret.txt'),'outside')
 const state=await api.saveProject({name:'项目',repoPath:root}),projectId=state.projects[0].id,files=request=>api.projectFiles({projectId,...request})
 await assert.rejects(api.projectFiles({projectId:'unknown',root}),/已配置/)
 let list=await files({root:outside});check('只读取登记的工程目录，忽略客户端提供的根目录',()=>{assert.equal(list.root,root);assert.equal(list.entries[0].name,'src');assert.equal(list.entries.some(row=>row.name==='secret.txt'),false)})
 list=await files({path:'src'});check('保留中文、空格与特殊字符路径',()=>assert.equal(list.entries[0].path,'src/报告 #1.ts'))
 const read=await files({action:'read',path:'src/报告 #1.ts'});check('只读预览返回真实UTF-8内容和经过校验的绝对路径',()=>{assert.equal(read.text,content);assert.equal(read.absolutePath,join(root,'src','报告 #1.ts'));assert.equal(readFileSync(read.absolutePath,'utf8'),content)})
 assert.equal((await files({action:'read',path:'empty.txt'})).text,'')
 for(const path of ['../outside/secret.txt','/etc/passwd','C:\\secret','\\server\\share','.git/config','src/../../outside/secret.txt'])await assert.rejects(files({action:'read',path}),/当前项目/)
 check('拒绝越界、绝对路径、Windows路径及Git内部文件',()=>{})
 symlinkSync(outside,join(root,'escape'));symlinkSync(join(root,'src'),join(root,'source-link'))
 await assert.rejects(files({path:'escape'}),/项目以外/);await assert.rejects(files({action:'resolve',path:'escape/secret.txt'}),/项目以外/)
 check('符号链接不能绕过工程范围，工程内目录链接可浏览',()=>{})
 assert.equal((await files({action:'resolve',path:'source-link'})).kind,'directory');assert.equal((await files({path:'source-link'})).entries[0].name,'报告 #1.ts')
 writeFileSync(join(root,'big.txt'),'x'.repeat(256*1024+1));writeFileSync(join(root,'binary.bin'),Buffer.from([0,1,2]));writeFileSync(join(root,'invalid.txt'),Buffer.from([0xff,0xfe]))
 await assert.rejects(files({action:'read',path:'big.txt'}),/256 KB/);await assert.rejects(files({action:'read',path:'binary.bin'}),/二进制/);await assert.rejects(files({action:'read',path:'invalid.txt'}),/UTF-8/);await assert.rejects(files({action:'read',path:'src'}),/普通文件/)
 check('大文件、二进制、非UTF-8及目录不伪装成完整文本',()=>{})
 mkdirSync(join(root,'many'));for(let i=0;i<105;i++)writeFileSync(join(root,'many',String(i).padStart(3,'0')+'.ts'),'test')
 const page1=await files({path:'many'}),page2=await files({path:'many',offset:100}),filtered=await files({path:'many',query:'104'})
 check('目录分页和筛选覆盖第100项之后的文件',()=>{assert.equal(page1.total,105);assert.equal(page1.entries.length,100);assert.equal(page2.entries.length,5);assert.equal(page2.hasMore,false);assert.equal(filtered.entries[0].name,'104.ts')})
 writeFileSync(join(root,':(glob)*.ts'),'literal\n')
 const git=args=>execFileSync('git',args,{cwd:root,stdio:'pipe'})
 git(['init']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','initial'])
 git(['mv','src/报告 #1.ts','src/重命名 "报告".ts']);rmSync(join(root,'empty.txt'));writeFileSync(join(root,'新增文件.txt'),'new')
 setShared_workbenchCtx({get:key=>key==='subprocess'?subprocess:null})
 const changes=await files({action:'changes'}),renamed=changes.entries.find(row=>row.path==='src/重命名 "报告".ts')
 check('真实Git改动正确识别中文重命名、删除和未跟踪文件',()=>{assert.equal(renamed.previousPath,'src/报告 #1.ts');assert.equal(changes.entries.find(row=>row.path==='empty.txt').deleted,true);assert.equal(changes.entries.find(row=>row.path==='新增文件.txt').status,'??')})
 assert.equal((await files({action:'read',path:renamed.path})).text,content)
 const subState=await api.saveProject({name:'子目录',repoPath:join(root,'src')}),subId=subState.projects.find(row=>row.name==='子目录').id
 const subChanges=await api.projectFiles({projectId:subId,action:'changes'})
 check('登记仓库子目录时，Git路径相对于该项目且可打开',()=>{assert.equal(subChanges.entries.length,1);assert.equal(subChanges.entries[0].path,'重命名 "报告".ts')})
 assert.equal((await api.projectFiles({projectId:subId,action:'read',path:subChanges.entries[0].path})).text,content)
 writeFileSync(join(root,'many/000.ts'),'staged value\n');git(['add','many/000.ts']);writeFileSync(join(root,'many/000.ts'),'unstaged value\n')
 const before=readFileSync(join(root,'many/000.ts'),'utf8'),review=await files({action:'diff',path:'many/000.ts'})
 check('审阅区分别返回真实暂存和工作区差异，且不改写文件',()=>{assert.match(review.sections[0].text,/\+staged value/);assert.match(review.sections[1].text,/-staged value/);assert.match(review.sections[1].text,/\+unstaged value/);assert.equal(readFileSync(join(root,'many/000.ts'),'utf8'),before)})
 const deletion=await files({action:'diff',path:'empty.txt'});check('已删除文件仍可查看差异，不依赖当前文件存在',()=>assert.match(deletion.sections[1].text,/deleted file mode/))
 const renameDiff=await files({action:'diff',path:renamed.path});check('重命名审阅保留原路径和真实Git重命名记录',()=>{assert.equal(renameDiff.previousPath,'src/报告 #1.ts');assert.match(renameDiff.sections[0].text,/rename from/)})
 const newDiff=await files({action:'diff',path:'新增文件.txt'});check('新增未跟踪文件显示当前内容，未伪造历史基线',()=>{assert.equal(newDiff.sections[0].id,'untracked');assert.equal(newDiff.sections[0].text,'new')})
 git(['rm','--cached','--','many/002.ts']);const uncached=await files({action:'diff',path:'many/002.ts',changeStatus:'??'}),removedFromIndex=await files({action:'diff',path:'many/002.ts',changeStatus:'D '})
 check('同一路径同时移出索引并保留本地文件时，删除与新增审阅不会混淆',()=>{assert.equal(uncached.sections[0].text,'test');assert.match(removedFromIndex.sections[0].text,/deleted file mode/)})
 writeFileSync(join(root,':(glob)*.ts'),'literal changed\n');const literal=await files({action:'diff',path:':(glob)*.ts'});check('特殊Git路径按字面量读取，不能扩展为其他文件的差异',()=>{assert.match(literal.sections[1].text,/literal changed/);assert.doesNotMatch(literal.sections[1].text,/unstaged value/)})
 const subDiff=await api.projectFiles({projectId:subId,action:'diff',path:'重命名 "报告".ts'});assert.ok(subDiff.sections[0].text);await assert.rejects(files({action:'diff',path:'many/001.ts'}),/已无未提交改动/);await assert.rejects(files({action:'diff',path:'../outside/secret.txt'}),/当前项目/)
 for(let i=0;i<105;i++)writeFileSync(join(root,'handoff-'+i+'.txt'),'new')
 const handoff=await files({action:'handoff',query:'only-current-page',offset:100});check('交接读取完整项目变更，覆盖分页之外的文件且不受当前筛选影响',()=>{assert.ok(handoff.total>100);assert.ok(handoff.entries.some(row=>row.path==='handoff-104.txt'));assert.ok(handoff.entries.some(row=>row.path==='many/000.ts'))})
 writeFileSync(join(root,'new-binary.bin'),Buffer.from([0,1,2]));const binary=await files({action:'diff',path:'new-binary.bin'});check('无法读取的新增二进制保留原因，不生成虚假的文本差异',()=>{assert.match(binary.sections[0].unavailable,/二进制/);assert.equal(binary.sections[0].text,undefined)})
 assert.throws(()=>projectChangeEntries(' M incomplete'),/不完整/);assert.throws(()=>projectChangeEntries('R  dest\0'),/不完整/)
 check('拒绝截断的Git输出，不显示不完整的改动列表',()=>{})
 setShared_workbenchCtx({get:key=>key==='subprocess'?{spawn:()=>({done:Promise.resolve({exitCode:0}),collected:{stdout:{readFrom:()=>({text:'?? lost.txt\0',lossy:true})}}})}:null})
 await assert.rejects(files({action:'changes'}),/读取上限/)
 check('进程缓冲丢失时明确失败，避免把缺失记录当成完整结果',()=>{})
 console.log('project-files: '+checks+' checks passed')
}finally{rmSync(home,{recursive:true,force:true})}
