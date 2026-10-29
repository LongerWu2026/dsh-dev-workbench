/** Check source boundaries without executing plugin code or touching business data. */
import ts from 'typescript'
import {readdirSync,readFileSync} from 'node:fs'
import {resolve,dirname,relative,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(dir,entry.name)):/\.tsx?$/.test(entry.name)?[resolve(dir,entry.name)]:[])
const files=walk(resolve(root,'src')),known=new Set(files),graph=new Map(),errors=[]
for(const file of files){
 const label=relative(root,file)
 if(/^\d/.test(basename(file)))errors.push(`${label}: use a responsibility name, not a numeric prefix`)
 const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true),edges=[]
 for(const node of sf.statements){
  if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier||node.isTypeOnly||node.importClause?.isTypeOnly)continue
  const spec=node.moduleSpecifier.text
  if(label.startsWith('src/shared/')&&!spec.startsWith('.'))errors.push(`${label}: shared contracts cannot import runtime package ${spec}`)
  if(!spec.startsWith('.'))continue
  const base=resolve(dirname(file),spec.replace(/\.js$/,'')),target=[base+'.ts',base+'.tsx',base+'/index.ts'].find(path=>known.has(path))
  if(!target){errors.push(`${label}: unresolved ${spec}`);continue}
  const destination=relative(root,target)
  if(label.startsWith('src/client/')&&destination.startsWith('src/host/'))errors.push(`${label}: Client must call Host through Remote`)
  if(label.startsWith('src/shared/')&&!destination.startsWith('src/shared/'))errors.push(`${label}: shared module depends on ${destination}`)
  edges.push(target)
 }
 graph.set(file,edges)
}
const done=new Set(),active=new Set(),stack=[]
function visit(file){
 if(active.has(file)){errors.push('Import cycle: '+[...stack.slice(stack.indexOf(file)),file].map(path=>relative(root,path)).join(' -> '));return}
 if(done.has(file))return
 active.add(file);stack.push(file)
 for(const edge of graph.get(file)||[])visit(edge)
 stack.pop();active.delete(file);done.add(file)
}
for(const file of files)visit(file)
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log(`architecture: ${files.length} modules; no numeric prefixes, import cycles or layer violations`)
