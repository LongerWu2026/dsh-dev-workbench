import * as React from 'react'
import { WB } from '../core/runtime.js'
interface Counts { open: number; today: number; overdue: number; running?: number }
interface Props { counts: Counts; onFilter: (preset: Partial<Record<string, string>>) => void }
export function StatsStrip({counts,onFilter}: Props): React.ReactElement {
  const items = [
    {label:'待处理',value:counts.open,preset:{status:'open'}},
    {label:'今日到期',value:counts.today,preset:{dueFilter:'today'}},
    {label:'已逾期',value:counts.overdue,preset:{dueFilter:'overdue'}},
    {label:'执行中',value:counts.running || 0,preset:{status:'running'}},
  ]
  return <div className="wb-stats-strip" aria-label="待办统计">{items.map(item=><button type="button" className="wb-chip" key={item.label} onClick={()=>onFilter(item.preset)}>{item.label} <strong>{item.value}</strong></button>)}<button type="button" className="wb-chip" onClick={()=>WB.go('tasks')}>查看全部待办 →</button></div>
}
