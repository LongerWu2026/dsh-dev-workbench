import {execFile} from 'node:child_process'
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import {workbenchDir} from '../platform/runtime.js'

export type PasswordSeal={iv:string;tag:string;ciphertext:string}
export const canRememberDataPasswords=()=>process.platform==='darwin'
const service='AIWorkBench.database-passwords.v1'
const pendingKeys=new Map<string,Promise<Buffer>>()

function security(args:string[],input?:string):Promise<string|undefined>{
    return new Promise((resolve,reject)=>{
        const child=execFile('/usr/bin/security',args,{timeout:10000,maxBuffer:8192},(error,stdout)=>{
            if(!error)resolve(stdout.trim());
            else if(error.code===44&&args[0]==='find-generic-password')resolve(undefined);
            else reject(Error('无法访问 macOS 钥匙串，请解锁钥匙串后重试'));
        });
        child.stdin?.on('error',()=>{});
        child.stdin?.end(input);
    });
}

async function keyForProfile(create:boolean){
    if(!canRememberDataPasswords())throw Error('当前系统不支持安全保存连接密码');
    const account=createHash('sha256').update(workbenchDir()).digest('hex');
    const read=async()=>{
        const value=await security(['find-generic-password','-s',service,'-a',account,'-w']);
        if(value===undefined)return;
        if(!/^[0-9a-f]{64}$/.test(value))throw Error('钥匙串中的连接密钥无效');
        return Buffer.from(value,'hex');
    };
    const pending=pendingKeys.get(account);
    if(pending)return pending;
    if(!create){
        const key=await read();
        if(!key)throw Error('找不到连接密码的钥匙串密钥，请重新输入密码');
        return key;
    }
    const opening=(async()=>{
        const existing=await read();
        if(existing)return existing;
        const key=randomBytes(32);
        // The key goes through stdin, never a process argument. A concurrent
        // creator may win the insert, so read the key back before encrypting.
        try{await security(['-i'],`add-generic-password -s ${service} -a ${account} -w ${key.toString('hex')}\n`)}
        catch(error){const concurrent=await read();if(concurrent)return concurrent;throw error}
        const saved=await read();
        if(!saved)throw Error('连接密钥未写入 macOS 钥匙串');
        return saved;
    })();
    pendingKeys.set(account,opening);
    try{return await opening}finally{pendingKeys.delete(account)}
}

export async function sealDataPassword(password:string,target:string):Promise<PasswordSeal>{
    const key=await keyForProfile(true),iv=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(target));
    const ciphertext=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
    return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}

export async function openDataPassword(seal:PasswordSeal,target:string){
    const key=await keyForProfile(false);
    try{
        const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(seal.iv,'base64'));
        decipher.setAAD(Buffer.from(target));
        decipher.setAuthTag(Buffer.from(seal.tag,'base64'));
        return Buffer.concat([decipher.update(Buffer.from(seal.ciphertext,'base64')),decipher.final()]).toString('utf8');
    }catch{throw Error('已记住的连接密码无法读取，请重新输入密码')}
}
