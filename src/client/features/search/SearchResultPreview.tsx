import * as React from 'react'
import {WB,Modal,Btn,useStore} from '../../core/runtime.js'
import {continueSearchResult,searchRecord,searchResultBody} from './search-navigation.js'

export function SearchResultPreview(){
 const state=useStore(),selected=state.searchResult
 if(!selected)return null
 const {item,groupLabel}=selected,row=searchRecord(item),body=searchResultBody(item)
 const close=()=>WB.store.set({searchResult:null})
 return <Modal open title={row?.title||item.title||'搜索结果'} sub={groupLabel} onClose={close} width={680} footer={<><Btn onClick={close}>关闭</Btn><Btn kind="primary" icon="sparkles" onClick={()=>{close();continueSearchResult(item,groupLabel)}}>交给 AI 继续处理</Btn></>}>
  <p className="wb-tiny wb-muted">{row?'已保存的工作内容':'搜索来源摘要'}{!row?'，详细内容请核对原文':''}</p>
  <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8}}>{body||'暂无正文'}</div>
  {item.url&&/^https?:\/\//i.test(item.url)&&<p><a className="wb-link" href={item.url} target="_blank" rel="noopener noreferrer">查看原文</a></p>}
 </Modal>
}
