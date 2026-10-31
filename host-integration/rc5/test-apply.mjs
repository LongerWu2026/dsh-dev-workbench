/** Transactional preflight regression; exercises only newly created synthetic checkouts. */
import {execFileSync,spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'../..')
const source=resolve(process.env.WORKBENCH_HARNESS_SOURCE||join(project,'.local-host/rc5-source'))
const baseline=JSON.parse(readFileSync(join(here,'baseline.json'),'utf8'))
mkdirSync(join(here,'artifacts'),{recursive:true})
const directory=mkdtempSync(join(here,'artifacts/preflight-'))
const apply=(root,args=[])=>spawnSync(process.execPath,[join(here,'apply.mjs'),root,...args],{encoding:'utf8'})
function fixture(name){
 const target=join(directory,name)
 execFileSync('git',['clone','--shared','--no-checkout',source,target],{stdio:'pipe'})
 for(const path of [...baseline.files.map(row=>row.path),'apps/desktop/package.json']){
  mkdirSync(dirname(join(target,path)),{recursive:true})
  writeFileSync(join(target,path),execFileSync('git',['-C',source,'show',baseline.revision+':'+path]))
 }
 return target
}
const clean=fixture('clean'),before=baseline.files.map(row=>readFileSync(join(clean,row.path),'utf8'))
assert.equal(apply(clean,['--check']).status,0)
assert.deepEqual(baseline.files.map(row=>readFileSync(join(clean,row.path),'utf8')),before)
assert.equal(existsSync(join(clean,baseline.addedFiles[0])),false)
assert.equal(apply(clean).status,0)
const patched=baseline.files.map(row=>readFileSync(join(clean,row.path),'utf8'))
assert.equal(apply(clean).status,0)
assert.deepEqual(baseline.files.map(row=>readFileSync(join(clean,row.path),'utf8')),patched)
const drift=fixture('late-file-drift'),last=baseline.files.at(-1).path
writeFileSync(join(drift,last),readFileSync(join(drift,last),'utf8')+'\n// synthetic drift\n')
const driftResult=apply(drift);assert.notEqual(driftResult.status,0);assert.match(driftResult.stderr,/source drift/)
assert.equal(readFileSync(join(drift,baseline.files[0].path),'utf8'),before[0])
assert.equal(existsSync(join(drift,baseline.addedFiles[0])),false)
writeFileSync(join(clean,baseline.files[0].path),before[0])
const partialResult=apply(clean);assert.notEqual(partialResult.status,0);assert.match(partialResult.stderr,/source drift/)
assert.equal(readFileSync(join(clean,baseline.files[1].path),'utf8'),patched[1])
const noGit=join(directory,'no-independent-git');mkdirSync(noGit)
const wrongRoot=apply(noGit);assert.notEqual(wrongRoot.status,0);assert.match(wrongRoot.stderr,/independent source checkout/)
const record={date:new Date().toISOString(),revision:baseline.revision,checks:15,directory,result:'passed',coverage:['no-write preflight','idempotent output','late-file baseline drift prevents all writes','partial application rejected','parent git fallback rejected']}
writeFileSync(join(directory,'result.json'),JSON.stringify(record,null,2)+'\n')
console.log('rc.5 apply preflight: 15 assertions passed; evidence '+join(directory,'result.json'))
