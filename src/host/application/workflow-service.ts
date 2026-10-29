import { enqueueOfficeWorkflow, controlOfficeWorkflow, adoptReplyArtifact } from '../workflows/office-jobs.js'
import { drainWorkflowJobs } from '../automation/jobs.js'
export function workflowService(context:()=>any){
 const drain=()=>{void drainWorkflowJobs(context()).catch(()=>{})}
 return {
  async officeWorkflowStart(kind:string,input:any){const state=await enqueueOfficeWorkflow(kind,input);drain();return state},
  async officeWorkflowControl(id:string,action:string){const state=await controlOfficeWorkflow(id,action);drain();return state},
  adoptReplyArtifact,
 }
}
