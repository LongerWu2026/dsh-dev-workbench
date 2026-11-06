type Snapshot<T> = {getSnapshot(): T}
type HostFileContext = {
    get?(name: string): unknown
}
type HostLayout = {
    panelInfo: Snapshot<{activePanelId: string | null}>
    selectPanel(panel: string | null): void
}
type HostSidebar = {
    mounted: Snapshot<string | undefined>
    openResource(address: string): void
}
type HostSession = {
    adapter: {current: Snapshot<{key?: string}>}
}

/** Harness scopes file tabs to the selected native conversation. */
export async function openHarnessFile(ctx: HostFileContext, path: string): Promise<boolean> {
    const sidebar = ctx.get?.('sidebarRight') as HostSidebar | undefined
    const layout = ctx.get?.('layout') as HostLayout | undefined
    const selected = (ctx.get?.('uiSession') as HostSession | undefined)?.adapter?.current
    const sessionId = selected?.getSnapshot().key
    if (!sessionId || !sidebar?.mounted || typeof sidebar.openResource !== 'function' || !layout?.panelInfo) return false
    const panel = layout.panelInfo.getSnapshot().activePanelId
    const encode = (part: string) => encodeURIComponent(part).replace(/%3A/gi, ':')
    const address = 'dsh-resource://file/session/' + encode(sessionId) + '/' + path.replace(/\\/g, '/').split('/').map(encode).join('/')
    let opened = false
    try {
        if (panel !== null) layout.selectPanel(null)
        for (let attempt = 0; attempt < 25; attempt++) {
            if (selected.getSnapshot().key !== sessionId || layout.panelInfo.getSnapshot().activePanelId !== null) return false
            if (sidebar.mounted.getSnapshot() === sessionId) {
                try {
                    sidebar.openResource(address)
                    opened = true
                    return true
                } catch (error) {
                    if (!(error instanceof Error) || !error.message.includes('no session surface is mounted')) return false
                }
            }
            await new Promise(resolve => setTimeout(resolve, 16))
        }
        return false
    } finally {
        if (!opened && panel !== null && selected.getSnapshot().key === sessionId && layout.panelInfo.getSnapshot().activePanelId === null) {
            layout.selectPanel(panel)
        }
    }
}
