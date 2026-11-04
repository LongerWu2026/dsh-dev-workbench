import {backgroundModel,backgroundModelKey,BACKGROUND_MODEL_PURPOSES,normalizeBackgroundModels} from '../../shared/background-models.js'
import {backgroundModelCatalog,validateBackgroundModel} from '../assistant/background-models.js'
import {mutateWorkbenchState,workbenchGenerationGuard} from '../storage/state-store.js'
import {auditEntry} from '../domain/model.js'
import {workbenchContext} from './service-context.js'

export const backgroundModelService={async backgroundModels(request:any={}):Promise<any>{
 const ctx=workbenchContext(),guard=workbenchGenerationGuard()
 if(request.action==='catalog')return backgroundModelCatalog(ctx)
 if(request.action!=='configure'||!BACKGROUND_MODEL_PURPOSES.includes(request.purpose))throw Error('后台模型配置参数无效')
 const route=backgroundModel(request.model)
 if(request.model!==null&&(!route||Object.keys(request.model).some(key=>!['provider','model'].includes(key))))throw Error('请选择有效的服务商与模型')
 if(route){
  const catalog=await backgroundModelCatalog(ctx);guard()
  if(!catalog.available)throw Error(catalog.note||'当前宿主不支持独立后台模型')
  if(!catalog.groups.some((group:any)=>group.id===route.provider&&group.models.some((model:any)=>model.id===route.model)))throw Error('所选模型当前不可用，请刷新模型列表')
  await validateBackgroundModel(ctx,route);guard()
 }
 return mutateWorkbenchState((state:any)=>{
  const models=normalizeBackgroundModels(state.settings.backgroundModels),changed=backgroundModelKey(models[request.purpose as 'analysis'|'summary'])!==backgroundModelKey(route)
  models[request.purpose as 'analysis'|'summary']=route;state.settings.backgroundModels=models
  if(changed&&state.modelHealth)delete state.modelHealth[request.purpose]
  auditEntry(state,'settings.backgroundModel',(request.purpose==='analysis'?'消息识别':'资讯摘要')+'模型已保存，下一轮生效')
 })
}}
