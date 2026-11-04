export const BACKGROUND_MODEL_PURPOSES=['analysis','summary'] as const
export type BackgroundModelPurpose=typeof BACKGROUND_MODEL_PURPOSES[number]
export type BackgroundModel={provider:string;model:string}
export type BackgroundModels=Record<BackgroundModelPurpose,BackgroundModel|null>
const identifier=(value:any)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=256&&!/[\u0000-\u001f\u007f]/.test(value)
export function backgroundModel(value:any):BackgroundModel|null{
 return value&&identifier(value.provider)&&identifier(value.model)?{provider:value.provider,model:value.model}:null
}
export function normalizeBackgroundModels(value:any):BackgroundModels{return {analysis:backgroundModel(value?.analysis),summary:backgroundModel(value?.summary)}}
export function backgroundModelKey(value:BackgroundModel|null):string{return value?JSON.stringify([value.provider,value.model]):''}
