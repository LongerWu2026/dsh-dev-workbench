/** Exercise real directory replacement, refusal and rollback using newly created synthetic apps only. */
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {replaceDailyEntry} from './daily-entry-transaction.mjs'
const here=dirname(fileURLToPath(import.meta.url));mkdirSync(join(here,'artifacts'),{recursive:true})
const directory=mkdtempSync(join(here,'artifacts/daily-entry-')),fixture=name=>{
 // No .app suffix: macOS indexes even an empty directory with that suffix as an application.
 const root=join(directory,name),target=join(root,'Applications/DeepSeek Harness.fixture'),staged=join(root,'stage/DeepSeek Harness.fixture'),backup=join(root,'backup/DeepSeek Harness.fixture.backup')
 for(const [path,content] of [[target,'original'],[staged,'persistent']]){mkdirSync(path,{recursive:true});writeFileSync(join(path,'app-marker'),content)}
 const cache=join(root,'browser-data');mkdirSync(cache);writeFileSync(join(cache,'marker'),'existing-login-fixture')
 return {root,target,staged,backup,cache}
}
let checks=0
const success=fixture('success')
replaceDailyEntry({...success,verifyInstalled:path=>{assert.equal(readFileSync(join(path,'app-marker'),'utf8'),'persistent');checks++}})
assert.equal(readFileSync(join(success.target,'app-marker'),'utf8'),'persistent');checks++
assert.equal(readFileSync(join(success.backup,'app-marker'),'utf8'),'original');checks++
assert.equal(readFileSync(join(success.cache,'marker'),'utf8'),'existing-login-fixture');checks++
const failure=fixture('rollback');assert.throws(()=>replaceDailyEntry({...failure,verifyInstalled:()=>{throw new Error('post-install verification failed')}}),/verification failed/);checks++
assert.equal(readFileSync(join(failure.target,'app-marker'),'utf8'),'original');checks++
assert.equal(readFileSync(join(failure.staged+'.failed','app-marker'),'utf8'),'persistent');checks++
assert.equal(readFileSync(join(failure.cache,'marker'),'utf8'),'existing-login-fixture');checks++
assert.equal(existsSync(failure.backup),false);checks++
const collision=fixture('collision');mkdirSync(collision.backup,{recursive:true})
assert.throws(()=>replaceDailyEntry({...collision,verifyInstalled:()=>{}}),/existing backup/);checks++
assert.equal(readFileSync(join(collision.target,'app-marker'),'utf8'),'original');checks++
const link=fixture('symlink');const targetLink=join(link.root,'app-link');symlinkSync(link.target,targetLink)
assert.throws(()=>replaceDailyEntry({...link,target:targetLink,verifyInstalled:()=>{}}),/real application/);checks++
assert.equal(readFileSync(join(link.target,'app-marker'),'utf8'),'original');checks++
console.log(JSON.stringify({checks,directory,personalDataUsed:false,installedAppModified:false}))
