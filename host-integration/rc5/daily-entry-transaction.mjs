/** Filesystem-only swap with rollback. The production caller owns signature/process/version validation. */
import {existsSync,lstatSync,mkdirSync,renameSync} from 'node:fs'
import {dirname} from 'node:path'
import assert from 'node:assert/strict'
export function replaceDailyEntry({target,staged,backup,verifyInstalled}){
 for(const path of [target,staged])assert.ok(lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink(),'Expected a real application directory: '+path)
 assert.ok(!existsSync(backup),'Refusing an existing backup')
 const failed=staged+'.failed';assert.ok(!existsSync(failed),'Refusing an existing rollback artifact')
 mkdirSync(dirname(backup),{recursive:true,mode:0o700})
 renameSync(target,backup)
 try{renameSync(staged,target);verifyInstalled(target)}catch(error){
  // Preserve failed output for inspection; never delete application files during rollback.
  if(existsSync(target))renameSync(target,failed)
  renameSync(backup,target)
  throw error
 }
 return {target,backup}
}
