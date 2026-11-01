import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {join,isAbsolute} from 'node:path'

/** Read the SDK serializer identity, including when a linked plugin cannot resolve host-only dependencies. */
export function developmentAdapterRevision():string|undefined {
    const importers=[process.argv[1],fileURLToPath(import.meta.url)].filter((path):path is string=>typeof path==='string'&&isAbsolute(path))
    for(const importer of importers){
        for(const root of createRequire(importer).resolve.paths('@earendil-works/pi-ai')||[]){
            try{
                const pkg=join(root,'@earendil-works/pi-ai'),manifest=JSON.parse(readFileSync(join(pkg,'package.json'),'utf8'))
                if(manifest.name!=='@earendil-works/pi-ai')continue
                return createHash('sha256').update(String(manifest.version||'')).update(readFileSync(join(pkg,'dist/api/openai-completions.js'))).digest('hex')
            }catch{/* The next package root may own the SDK. */}
        }
    }
    return undefined
}
/** A repaired adapter permits one manual retry in the same compatibility session. */
export function developmentAdapterChanged(recovery:{adapterRevision?:string},revision?:string):boolean {
    return !!revision&&recovery.adapterRevision!==revision
}
