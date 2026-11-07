export function projectChangeLabel(status:string){
    if(status==='??')return '新增（未跟踪）'
    const labels=[['U','冲突'],['R','重命名'],['C','复制'],['D','删除'],['A','新增'],['M','修改'],['T','类型变化']]
    return labels.find(([code])=>status.includes(code))?.[1]||status.trim()||'改动'
}
export function projectHandoff(snapshot:any):string {
    const entries=snapshot.entries||[]
    return ['# '+(snapshot.projectName||'项目')+' · 研发交接','目录：'+snapshot.root,'快照时间：'+snapshot.at,
        '变更文件：'+entries.length+' 项','','## 本次改动',
        ...(entries.length?entries.map((row:any)=>'- ['+projectChangeLabel(row.status)+'] '+row.path+(row.previousPath?'（原路径：'+row.previousPath+'）':'')):['- 当前没有未提交改动。']),
        '','## 交接补充','- 改动目的：待补充','- 验证情况：本页未执行测试，请填写实际测试命令和结果。','- 风险与后续事项：待补充'].join('\n')
}
export function projectDiffText(preview:any):string {
    return ['项目：'+(preview.projectName||preview.projectId),'文件：'+preview.path,'状态：'+projectChangeLabel(preview.changeStatus||preview.status||''),
        ...(preview.previousPath?['原路径：'+preview.previousPath]:[]),
        ...(preview.sections||[]).flatMap((section:any)=>['','## '+section.label,section.unavailable?'内容未读取：'+section.unavailable:section.text||'此部分没有差异。'])].join('\n')
}
export function projectReviewPrompt(preview:any):string {
    const evidence=projectDiffText(preview),limit=12000,excerpt=evidence.length>limit
    return '请解释以下项目代码改动，按“改了什么、为什么可能这样改、潜在影响、建议验证”整理。只依据所给差异，不修改文件，不把建议测试当作已通过测试。'+
        (excerpt?'\n注意：以下仅为差异节选，尚有 '+(evidence.length-limit)+' 个字符未提供，不能作为完整审查结论。':'')+
        '\n\n'+evidence.slice(0,limit)
}
