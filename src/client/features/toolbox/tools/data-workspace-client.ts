// Data-only host adapter. Its queues outlive React mounts; connection forms never enter it.
type Envelope = {id:string;key:string;revision:number;workspace:any;updatedAt?:string};
type Entry = {envelope:Envelope;pending:Record<string,any>;working?:Promise<void>;error:string;listeners:Set<()=>void>};
const fields=['query','instruction','generated','selected','pattern','connectionsOpen','aiOpen','pageSize','pageOffsets','pageIndex','result','queriedAt'];
export const dataWorkspacePatch=(patch:any)=>Object.fromEntries(fields.filter(field=>Object.prototype.hasOwnProperty.call(patch,field)).map(field=>[field,patch[field]]));
const clients=new WeakMap<Function,ReturnType<typeof createClient>>();
export function dataWorkspaceClient(rpc:Function){
    let client=clients.get(rpc);
    if(!client){client=createClient(rpc);clients.set(rpc,client)}
    return client;
}
function createClient(rpc:Function){
    const entries=new Map<string,Entry>();
    const call=(method:string,request:any)=>rpc('workbench/'+method,{request});
    const notify=(entry:Entry)=>entry.listeners.forEach(listener=>listener());
    function accept(envelope:Envelope){
        if(!envelope?.key)return envelope;
        let entry=entries.get(envelope.key);
        if(!entry){entry={envelope,pending:{},error:'',listeners:new Set()};entries.set(envelope.key,entry)}
        else if(envelope.revision>=entry.envelope.revision)entry.envelope=envelope;
        notify(entry);
        return {...entry.envelope,workspace:{...entry.envelope.workspace,...entry.pending}};
    }
    function drain(entry:Entry){
        if(entry.working||entry.error||!Object.keys(entry.pending).length)return;
        entry.working=Promise.resolve().then(async()=>{
            while(Object.keys(entry.pending).length){
                const patch=entry.pending;entry.pending={};
                try{
                    const {id,key,revision}=entry.envelope;
                    accept(await call('dataWorkspaceSave',{id,key,revision,patch}));
                }catch(error){
                    entry.pending={...patch,...entry.pending};entry.error=(error as Error).message;break;
                }
            }
        }).finally(()=>{entry.working=undefined;notify(entry)});
        notify(entry);
    }
    async function flush(key:string){
        const entry=entries.get(key);if(!entry)return;
        drain(entry);
        while(entry.working)await entry.working;
        if(entry.error)throw Error(entry.error);
    }
    return {
        accept,
        async load(id?:string){
            // Finish accepted edits even after the originating page unmounted.
            await Promise.all([...entries.keys()].map(key=>flush(key).catch(()=>{})));
            const envelope=await call('dataWorkspaceLoad',id===undefined?{}:{id});
            return accept(envelope);
        },
        patch(key:string,patch:any){
            const entry=entries.get(key);if(!entry)return;
            const clean=dataWorkspacePatch(patch);
            if(!Object.keys(clean).length)return;
            entry.pending={...entry.pending,...clean};drain(entry);notify(entry);
        },
        flush,
        status(key:string){const entry=entries.get(key);return {error:entry?.error||'',saving:!!entry?.working||!!entry&&!entry.error&&Object.keys(entry.pending).length>0}},
        subscribe(key:string,listener:()=>void){const entry=entries.get(key);entry?.listeners.add(listener);return()=>{entry?.listeners.delete(listener)}},
        async retry(key:string){
            const entry=entries.get(key);if(!entry)return;
            if(entry.error){
                try{
                    const current=await call('dataWorkspaceLoad',{id:entry.envelope.id});
                    if(!current?.key||current.key!==key)throw Error('连接目标已变化，请重新加载当前连接记忆');
                    // Keep local pending edits; only advance the durable revision they will save onto.
                    accept(current);
                }catch(error){
                    entry.error=(error as Error).message;notify(entry);throw error;
                }
            }
            entry.error='';drain(entry);await flush(key);
        },
        async perform<T>(key:string,operation:(envelope:Envelope)=>Promise<T>):Promise<T>{
            const entry=entries.get(key);if(!entry)throw Error('请重新加载当前连接记忆');
            while(entry.working||Object.keys(entry.pending).length)await flush(key);
            if(entry.error)throw Error(entry.error);
            let result:T;
            entry.working=Promise.resolve().then(async()=>{result=await operation(entry.envelope)});
            notify(entry);
            try{await entry.working;return result!}
            finally{entry.working=undefined;drain(entry);notify(entry)}
        },
        async clear(key:string){
            const entry=entries.get(key);
            if(entry?.working)await entry.working;
            // Confirmation explicitly discards local failed edits as well as durable memory.
            if(entry){entry.pending={};entry.error=''}
            return this.perform(key,async({id,key,revision})=>{
                const envelope=await call('dataWorkspaceClear',{id,key,revision});
                accept(envelope);return envelope;
            });
        },
    };
}
