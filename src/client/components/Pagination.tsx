import * as React from 'react';
import { Btn } from '../core/runtime.js';
export const PAGE_SIZE = 30;
export function pageIndex(page: number, total: number) { return Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)); }
export function Pagination({ page, total, onChange }: {
    page: number;
    total: number;
    onChange: (page: number) => void;
}) {
    if (total <= PAGE_SIZE)
        return null;
    const index = pageIndex(page, total);
    return <nav aria-label="列表分页" className="wb-row" style={{ margin: '12px 0' }}><Btn size="sm" disabled={index === 0} onClick={() => onChange(index - 1)}>上一页</Btn><span>{index + 1} / {Math.ceil(total / PAGE_SIZE)} · {total} 条</span><Btn size="sm" disabled={(index + 1) * PAGE_SIZE >= total} onClick={() => onChange(index + 1)}>下一页</Btn></nav>;
}
