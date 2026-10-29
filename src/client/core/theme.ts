import * as React from 'react'

/* ============================================================================
 * dev-workbench client core
 *
 * Shared Client controls and state, imported by TypeScript page modules.
 * scripts/build.mjs bundles explicit imports into the host module factory:
 *
 *   React, h                    – React and createElement
 *   Icon({name,size})           – inline SVG icon; see WB.ICONS for names
 *   Panel({title,sub,icon,actions,children,style,bodyStyle,className})
 *   PageHead({icon,title,sub,actions})
 *   Btn({kind,size,icon,onClick,disabled,title,children})
 *                               – kind: primary | ghost | subtle | danger
 *   IconBtn({name,label,onClick,active})
 *   Badge({tone,children})      – tone: accent|ok|warn|err|idle
 *   Stat({label,value,sub,tone,icon,onClick})
 *   Field({label,hint,children})
 *   Input / Textarea / Select   – styled native controls (props pass through)
 *   Toggle({checked,onChange,label})
 *   Segmented({items,value,onChange})
 *                               – items: [{value,label}]
 *   Tabs({items,value,onChange})– items: [{value,label,count}]
 *   Empty({icon,title,hint,action})
 *   Spinner({size})
 *   Progress({value,max})
 *   Chip({children,active,onClick,onRemove})
 *   Kbd({children})
 *   Modal({open,title,sub,onClose,children,footer,width})
 *   Divider()
 *
 *   WB.store.get() / WB.store.set(patch) / WB.useStore()
 *   WB.actions.*                – see below; every action resolves the new snapshot
 *   WB.t(key, fallback)         – locale lookup with a fallback literal
 *   WB.fmt.*                    – date / relative / due / num / bytes
 *   WB.util.*                   – uid / debounce / truncate / groupBy / sortTasks
 *   WB.pages.<id> = Component   – a page registers itself here
 *   WB.PAGE_META                – nav metadata (id → {title, icon, hint})
 *
 * Store snapshot (`WB.useStore()`):
 *   {
 *     status: 'loading' | 'ready' | 'error',
 *     error: string | null,
 *     data: {tasks, sources, runs, knowledge, radar, connectors, settings,
 *            projects, audit, version, updatedAt} | null,
 *     busy: boolean,
 *     toasts: [{id, kind, text}],
 *     page: string,           // active page id
 *   }
 *
 * Rules for page modules:
 *   - import shared controls; use TSX for reusable components; keep business writes in Host;
 *   - React hooks only at the top of a component;
 *   - every list needs a stable `key`;
 *   - all user-visible numbers come from `data`, never invented;
 *   - an empty collection renders <Empty>, never fabricated rows.
 * ========================================================================== */
const h: any = React.createElement;

/* ------------------------------------------------------------------ tokens */
const T: any = {
    bg: 'var(--dsw-alias-bg-base)',
    layer1: 'var(--dsw-alias-bg-layer-1)',
    layer2: 'var(--dsw-alias-bg-layer-2)',
    overlay: 'var(--dsw-alias-bg-overlay)',
    border1: 'var(--dsw-alias-border-l1)',
    border2: 'var(--dsw-alias-border-l2)',
    text: 'var(--dsw-alias-label-primary)',
    text2: 'var(--dsw-alias-label-secondary)',
    accent: 'var(--dsw-alias-brand-primary)',
    ok: 'var(--dsw-alias-state-success-primary)',
    warn: 'var(--dsw-alias-state-warn-primary)',
    err: 'var(--dsw-alias-state-error-primary)',
    idle: 'var(--dsw-alias-state-idle-primary)',
    sidebar: 'var(--dsw-specific-sidebar-fill)',
    radius: { card: 16, ctl: 10, pill: 999 },
    gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    font: {
        title: 19,
        h3: 14,
        body: 13,
        small: 12,
        tiny: 11,
        mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
};
export { h, T }
