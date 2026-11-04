import * as React from 'react'

const PREVIEW_ROWS = 3

/** Keep whole flex rows visible, including when names, fonts or container width change. */
export function useConversationRows(account: string | undefined, signature: string) {
 const ref = React.useRef<HTMLDivElement>(null)
 const [expanded, setExpanded] = React.useState({account, rows: PREVIEW_ROWS})
 React.useEffect(() => { setExpanded(previous => previous.account === account ? previous : {account, rows: PREVIEW_ROWS}) }, [account])
 const rowLimit = expanded.account === account ? expanded.rows : PREVIEW_ROWS
 const [layout, setLayout] = React.useState<{count: number; rows: number; height?: number}>({count: Infinity, rows: 0})

 React.useLayoutEffect(() => {
  const list = ref.current
  if (!list) return
  let active = true
  const measure = () => {
   if (!active || list.getBoundingClientRect().width === 0) return
   const rows: {top: number; bottom: number; count: number}[] = []
   for (const item of Array.from(list.children)) {
    const box = item.getBoundingClientRect()
    const last = rows[rows.length - 1]
    if (!last || Math.abs(last.top - box.top) > 1) rows.push({top: box.top, bottom: box.bottom, count: 1})
    else { last.bottom = Math.max(last.bottom, box.bottom); last.count++ }
   }
   const visible = rows.slice(0, rowLimit)
   const next = {
    count: visible.reduce((sum, row) => sum + row.count, 0),
    rows: rows.length,
    height: rows.length > rowLimit ? Math.ceil(visible[visible.length - 1].bottom - list.getBoundingClientRect().top) : undefined,
   }
   setLayout(previous => previous.count === next.count && previous.rows === next.rows && previous.height === next.height ? previous : next)
  }
  measure()
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
  observer?.observe(list)
  window.addEventListener('resize', measure)
  document.fonts?.ready.then(measure)
  return () => { active = false; observer?.disconnect(); window.removeEventListener('resize', measure) }
 }, [account, signature, rowLimit])

 return {ref, ...layout, rowLimit,
  more: () => setExpanded({account, rows: rowLimit + PREVIEW_ROWS}),
  collapse: () => setExpanded({account, rows: PREVIEW_ROWS}),
 }
}
