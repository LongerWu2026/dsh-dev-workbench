import {closeSync,mkdirSync,openSync} from 'node:fs'
import {join} from 'node:path'
import type {DatabaseSync} from 'node:sqlite'
import {workbenchDir} from '../platform/runtime.js'

export type CatalogTable = {schemaName:string;name:string;comment?:string}
type CatalogEntry = CatalogTable & {fields:string[]}
type CatalogState = {checkedAt:number;ready:number;revision:number}
const MAX_AGE=5*60*1000;
const segmenter=new Intl.Segmenter('zh',{granularity:'word'});

function tokens(text:string){
    const words=[...segmenter.segment(text.toLowerCase().replaceAll('_',' '))];
    return words.filter(word=>word.isWordLike).map(word=>word.segment).join(' ');
}

async function withCatalog<T>(key:string,run:(db:DatabaseSync)=>Promise<T>|T){
    let db:DatabaseSync|undefined;
    try{
        const {DatabaseSync}=await import('node:sqlite');
        const dir=join(workbenchDir(),'data-catalog-v1');
        mkdirSync(dir,{recursive:true,mode:0o700});
        const path=join(dir,key+'.sqlite');
        closeSync(openSync(path,'a',0o600));
        db=new DatabaseSync(path);
        db.exec(`PRAGMA busy_timeout=100;
            CREATE TABLE IF NOT EXISTS catalog_state(id INTEGER PRIMARY KEY CHECK(id=1), checked_at INTEGER, ready INTEGER, revision INTEGER);
            INSERT OR IGNORE INTO catalog_state VALUES (1,0,-1,0);
            CREATE TABLE IF NOT EXISTS catalog_tables(id INTEGER PRIMARY KEY, schema_name TEXT, table_name TEXT,
                description TEXT, fields TEXT, search_text TEXT, UNIQUE(schema_name,table_name));
            CREATE VIRTUAL TABLE IF NOT EXISTS catalog_fts USING fts5(tokens);`);
        return await run(db);
    }catch{
        // SQLite and FTS5 are optional on older hosts. The live catalog still works.
        return undefined;
    }finally{db?.close()}
}

function state(db:DatabaseSync){
    return db.prepare('SELECT checked_at AS checkedAt,ready,revision FROM catalog_state WHERE id=1').get() as CatalogState;
}

function updateCatalog(db:DatabaseSync,entries:CatalogEntry[]|null,startedAt:number,revision:number){
    db.exec('BEGIN IMMEDIATE');
    try{
        if(state(db).revision===revision){
            const old=db.prepare('SELECT id,schema_name AS schemaName,table_name AS name,description,fields FROM catalog_tables').all() as
                (CatalogTable & {id:number;description:string;fields:string})[];
            const remaining=new Map(old.map(row=>[JSON.stringify([row.schemaName,row.name]),row]));
            const upsert=db.prepare(`INSERT INTO catalog_tables(schema_name,table_name,description,fields,search_text) VALUES (?,?,?,?,?)
                ON CONFLICT(schema_name,table_name) DO UPDATE SET description=excluded.description,fields=excluded.fields,search_text=excluded.search_text
                RETURNING id`);
            const addTokens=db.prepare('INSERT INTO catalog_fts(rowid,tokens) VALUES (?,?)');
            const removeTokens=db.prepare('DELETE FROM catalog_fts WHERE rowid=?');
            const removeTable=db.prepare('DELETE FROM catalog_tables WHERE id=?');
            for(const {schemaName,name,comment,fields} of entries??[]){
                const key=JSON.stringify([schemaName,name]);
                const previous=remaining.get(key);
                remaining.delete(key);
                const description=comment?.slice(0,1024)??'';
                const serialized=JSON.stringify(fields);
                if(previous?.description===description&&previous.fields===serialized)continue;
                if(previous)removeTokens.run(previous.id);
                const searchable=`${schemaName}.${name} ${description}`;
                const {id}=upsert.get(schemaName,name,description,serialized,searchable.toLowerCase())!;
                addTokens.run(id,tokens(`${searchable} ${fields.join(' ')}`));
            }
            for(const {id} of remaining.values()){
                removeTokens.run(id);
                removeTable.run(id);
            }
            db.prepare('UPDATE catalog_state SET checked_at=?,ready=?,revision=revision+1 WHERE id=1').run(startedAt,entries===null?0:1);
        }
        db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error}
}

export function invalidateCatalog(key:string){
    return withCatalog(key,db=>db.exec('UPDATE catalog_state SET ready=-1,revision=revision+1 WHERE id=1'));
}

export function findCatalogTables(key:string,query:{keyword:string}|{terms:string[]},load:()=>Promise<CatalogEntry[]|null>){
    return withCatalog(key,async db=>{
        const startedAt=Date.now();
        const initial=state(db);
        if(initial.ready<0||startedAt-initial.checkedAt>=MAX_AGE)updateCatalog(db,await load(),startedAt,initial.revision);
        if(state(db).ready!==1)return;
        if('keyword' in query){
            return db.prepare('SELECT schema_name AS schemaName,table_name AS name FROM catalog_tables WHERE instr(search_text,?)>0 LIMIT 501')
                .all(query.keyword) as CatalogTable[];
        }
        const match=query.terms.map(tokens).filter(Boolean).map(phrase=>`"${phrase.replaceAll('"','""')}"`).join(' OR ');
        if(!match)return [];
        return db.prepare(`SELECT t.schema_name AS schemaName,t.table_name AS name
            FROM catalog_fts JOIN catalog_tables t ON t.id=catalog_fts.rowid
            WHERE catalog_fts MATCH ? ORDER BY bm25(catalog_fts),t.id LIMIT 501`).all(match) as CatalogTable[];
    });
}
