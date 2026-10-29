/** Apply a narrowly pinned source integration; refuse drift or unrelated local edits. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(process.argv[2]||'')
if(!process.argv[2])throw new Error('Usage: node host-integration/apply.mjs <Harness 0.2.1-rc.3 source>')
const packageFile=join(root,'apps/desktop/package.json')
if(JSON.parse(readFileSync(packageFile,'utf8')).version!=='0.2.1-rc.3')throw new Error('Expected Harness 0.2.1-rc.3 source')
const pending=[]
const replace=(text,from,to)=>{if(text.split(from).length!==2)throw new Error('Source drift at '+from.slice(0,80));return text.replace(from,to)}
const edit=(path,transform)=>{const file=join(root,path),original=readFileSync(file,'utf8'),updated=transform(original);pending.push({path,original,updated})}

edit('apps/desktop/src/browser-guests.ts',text=>{
 if(createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex')!=='c3f0b10eea72c514d80ee19bbe199c02977198ee')throw new Error('Browser implementation differs from pinned official source')
 text=replace(text,"import { DESKTOP_IPC } from './ipc.ts'","import { DESKTOP_IPC } from './ipc.ts'\nimport { DesktopBrowserPersistence, type PersistentBrowserAccount } from './browser-persistence.ts'")
 text=replace(text,'  readonly partition: string\n  attached: boolean','  readonly partition: string\n  readonly persistent?: PersistentBrowserAccount\n  attached: boolean')
 text=replace(text,'  /** @param hostUrl - current authenticated DSH Host, which guests cannot request. */\n  constructor(private readonly hostUrl: () => string | undefined) {}',`  private readonly persistentPartitions = new Set<string>()
  private readonly releases = new Map<DesktopBrowserLeaseId, { owner: WebContents; operation: Promise<void> }>()
  private closing = false
  private shutdownOperation?: Promise<void>

  /** @param hostUrl - application endpoint. @param persistence - trusted accounts, or absent for memory-only mode. */
  constructor(private readonly hostUrl: () => string | undefined, private readonly persistence?: DesktopBrowserPersistence) {}`)
 text=replace(text,"  acquire(owner: WebContents, workspace: unknown): DesktopBrowserReservation {","  acquire(owner: WebContents, workspace: unknown): DesktopBrowserReservation {\n    if (this.closing) throw new Error('desktop browser: shutting down')")
 text=replace(text,'  /**\n   * Release only a lease issued',`  /** @param owner - authenticated main renderer. @param request - fixed namespace and provider. @returns approved persistent lease. */
  acquirePersistent(owner: WebContents, request: unknown): DesktopBrowserReservation & { persistence: 'persistent'; providerId: string } {
    if (this.closing || this.persistence === undefined) throw new Error('desktop browser: persistent storage unavailable')
    const account = this.persistence.resolve(request)
    if (!this.persistentPartitions.has(account.partition)) {
      const value = session.fromPartition(account.partition)
      this.configureSession(value, account)
      this.persistence.register(account.partition, value)
      this.persistentPartitions.add(account.partition)
    }
    const lease = randomUUID() as DesktopBrowserLeaseId
    this.leases.set(lease, { owner, partition: account.partition, persistent: account, attached: false })
    return { lease, partition: account.partition, persistence: 'persistent', providerId: account.providerId }
  }

  /** @returns after bounded flush of all persistent accounts; rejects on failure or deadline. */
  async flushPersistent(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const failures = await Promise.race([
        this.persistence?.flushAll() ?? Promise.resolve(0),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('desktop browser: storage flush deadline')), 3000) }),
      ])
      if (failures > 0) throw new Error('desktop browser: storage flush failed')
    } finally { clearTimeout(timer) }
  }

  /** @returns after guest destruction and bounded storage drain; no new leases are accepted. */
  shutdown(): Promise<void> {
    if (this.shutdownOperation !== undefined) return this.shutdownOperation
    this.closing = true
    const drain = async (): Promise<void> => {
      const tasks = new Set([...this.releases.values()].map(value => value.operation))
      for (const [id, lease] of this.leases) tasks.add(this.release(lease.owner, id))
      const results = await Promise.allSettled(tasks)
      await this.flushPersistent()
      if (results.some(value => value.status === 'rejected')) throw new Error('desktop browser: guest release failed')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    this.shutdownOperation = Promise.race([drain(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('desktop browser: shutdown deadline')), 4000)
    })]).finally(() => { clearTimeout(timer) })
    return this.shutdownOperation
  }

  /**
   * Release only a lease issued`)
 text=replace(text,`    const lease = this.leases.get(key)
    if (lease === undefined) return
    if (lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    lease.releaseInput?.()
    this.leases.delete(key)
    const guest = lease.guest
    if (guest !== undefined && !guest.isDestroyed()) {
      const destroyed = new Promise<void>((resolve) => { guest.once('destroyed', resolve) })
      guest.close({ waitForBeforeUnload: false })
      await destroyed
    }`, `    const pending = this.releases.get(key)
    if (pending !== undefined) {
      if (pending.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
      return pending.operation
    }
    const lease = this.leases.get(key)
    if (lease === undefined) return
    if (lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    const release = async (): Promise<void> => {
      lease.releaseInput?.()
      delete lease.releaseInput
      this.leases.delete(key)
      const guest = lease.guest
      if (guest !== undefined && !guest.isDestroyed()) {
        const destroyed = new Promise<void>((resolve) => { guest.once('destroyed', resolve) })
        guest.close({ waitForBeforeUnload: false })
        await destroyed
      }
      if (lease.persistent !== undefined) await this.persistence?.flush(lease.partition)
    }
    const operation = release()
    this.releases.set(key, { owner, operation })
    try { await operation } finally { this.releases.delete(key) }`)
 text=replace(text,"guest.once('destroyed', () => { lease.releaseInput?.(); this.leases.delete(id) })",`guest.once('destroyed', () => {
          lease.releaseInput?.()
          delete lease.releaseInput
          this.leases.delete(id)
          if (lease.persistent !== undefined) void this.persistence?.flush(lease.partition)
            .catch((_error: unknown) => { console.error('desktop browser: persistent storage flush failed') })
        })`)
 text=replace(text,'this.allowedNavigation(url)) {','this.allowedNavigation(url, lease.persistent)) {')
 text=replace(text,'this.allowedNavigation(event.url)) event.preventDefault()','this.allowedNavigation(event.url, attachedLease === undefined ? undefined : this.leases.get(attachedLease)?.persistent)) event.preventDefault()')
 text=replace(text,'this.allowedNavigation(url)) event.preventDefault()','this.allowedNavigation(url, attachedLease === undefined ? undefined : this.leases.get(attachedLease)?.persistent)) event.preventDefault()')
 text=replace(text,'private configureSession(browserSession: Session): void','private configureSession(browserSession: Session, account?: PersistentBrowserAccount): void')
 text=replace(text,"? url.username !== '' || url.password !== '' || this.isApplicationHost(url)","? url.username !== '' || url.password !== '' || this.isApplicationHost(url)\n          || account !== undefined && details.resourceType === 'mainFrame' && !account.allowsNavigation(details.url)")
 text=replace(text,"private allowedNavigation(value: string): boolean","private allowedNavigation(value: string, account?: PersistentBrowserAccount): boolean")
 text=replace(text,'      && !this.isApplicationHost(url)','      && !this.isApplicationHost(url) && (account === undefined || account.allowsNavigation(value))')
 return text
})
edit('apps/desktop/src/preload-browser.ts',text=>replace(text,'  return {\n    acquire:',`  return {
    persistence: {
      protocolVersion: 1,
      acquire: request => ipcRenderer.invoke(DESKTOP_IPC.browserAcquirePersistent, request) as Promise<import('@deepseek-ai/dsh-client-ui-sidebar-browser/types').DesktopPersistentBrowserReservation>,
    },
    acquire:`))
edit('apps/desktop/src/ipc.ts',text=>replace(text,"  browserAcquire: 'dsh-desktop:browser-acquire',","  browserAcquire: 'dsh-desktop:browser-acquire',\n  browserAcquirePersistent: 'dsh-desktop:browser-acquire-persistent',"))
edit('packages/client/ui-sidebar-browser/src/types.ts',text=>{
 text=replace(text,"A guest's approved, process-local storage partition.","A guest's main-approved storage partition; persistence is declared separately.")
 text=replace(text,'/** Main-approved request to open',`/** Persistent account selected from the main process's registered namespaces. */
export interface DesktopPersistentBrowserReservation extends DesktopBrowserReservation {
  readonly persistence: 'persistent'
  readonly providerId: string
}

/** Main-approved request to open`)
 return replace(text,'export interface DesktopBrowserBridge {',`export interface DesktopBrowserBridge {
  /** Absent on legacy hosts; persistent storage requires a registered main-process policy. */
  readonly persistence?: {
    readonly protocolVersion: 1
    /** @param request - registered namespace and provider. @returns main-approved persistent guest lease. */
    acquire(request: { readonly namespace: string; readonly providerId: string }): Promise<DesktopPersistentBrowserReservation>
  }`)
})
edit('apps/desktop/src/main.ts',text=>{
 text=replace(text,'  net,\n','')
 text=replace(text,"import { DesktopBrowserGuests } from './browser-guests.ts'","import { DesktopBrowserGuests } from './browser-guests.ts'\nimport { DesktopBrowserPersistence } from './browser-persistence.ts'\nimport { workbenchBrowserPolicy } from './workbench-browser-policy.ts'")
 text=replace(text,"import { connectDesktopWelcome, type DesktopWelcomeBackend } from './welcome-backend.ts'","import { connectDesktopWelcome, type DesktopWelcomeBackend } from './welcome-backend.ts'\nimport { desktopHostFetch } from './host-fetch.ts'")
 text=replace(text,'hostCookie = await authenticateWebHost(ready.url)','const activeCookie = await authenticateWebHost(ready.url)\n        hostCookie = activeCookie')
 text=replace(text,"welcomeBackend = await connectDesktopWelcome(ready.url, (input, init) => net.fetch(input, init), async () => (await session.defaultSession.cookies.get({ url: ready.url })).map(cookie => `${cookie.name}=${cookie.value}`).join('; '))","welcomeBackend = await connectDesktopWelcome(new URL('./', ready.url).href, desktopHostFetch(ready.url, activeCookie), async () => activeCookie)")
 text=replace(text,'new DesktopBrowserGuests(() => hostUrl)','new DesktopBrowserGuests(() => hostUrl, new DesktopBrowserPersistence(paths.profile, [workbenchBrowserPolicy]))')
 text=replace(text,'  ipcMain.handle(DESKTOP_IPC.browserRelease,',`  ipcMain.handle(DESKTOP_IPC.browserAcquirePersistent, (event, request: unknown) => {
    assertProductSender(event)
    return browserGuests.acquirePersistent(event.sender, request)
  })
  ipcMain.handle(DESKTOP_IPC.browserRelease,`)
 text=replace(text,"        shellInstallerOwnsQuit = true","        await browserGuests.flushPersistent()\n        shellInstallerOwnsQuit = true")
 text=replace(text,'backend.close(),\n      // A Platform cleanup',"backend.close(),\n      browserGuests.shutdown().catch((_error: unknown) => { console.error('desktop browser: persistent shutdown did not complete') }),\n      // A Platform cleanup")
 return text
})
edit('tsconfig.client.json',text=>replace(text,'    "apps/desktop/src/browser-guests.ts",','    "apps/desktop/src/browser-guests.ts",\n    "apps/desktop/src/browser-persistence.ts",'))
edit('apps/desktop/src/welcome-backend.ts',text=>replace(text,"throw new Error('desktop welcome: Web authentication failed')","throw new Error(`desktop welcome: Web authentication failed (HTTP ${authenticated.status})`)"))
edit('packages/client/ui-sidebar-browser/README.md',text=>replace(text,'- Desktop shares process-local storage partitions','- Default Desktop Browser tabs share process-local storage partitions').replace('Cookies and Web storage do not survive application restart.','Default Browser cookies and Web storage do not survive application restart. Main-registered consumers can acquire persistent accounts through the optional `browser.persistence` bridge; account storage survives guest release and application restart, while website expiry and logout still apply.'))
edit('packages/client/ui-sidebar-browser/README.zh.md',text=>replace(text,'- Desktop 按规范化的工作区 CWD 共享进程内存储分区','- 默认 Desktop Browser tab 按规范化的工作区 CWD 共享进程内存储分区').replace('Cookie 与 Web storage 不跨应用重启保留。','默认 Browser 的 Cookie 与 Web storage 不跨应用重启保留。由主进程注册的消费者可通过可选 `browser.persistence` 接口申请持久化账号；释放 guest 和重启软件不清理账号存储，官网过期与退出规则仍然有效。'))
const overlay=join(here,'overlay')
const collect=path=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(join(path,entry.name)):[join(path,entry.name)])
for(const file of collect(overlay)){
 const path=file.slice(overlay.length+1),target=join(root,path),updated=readFileSync(file,'utf8')
 if(existsSync(target)&&readFileSync(target,'utf8')!==updated)throw new Error('Refusing existing overlay file '+path)
 pending.push({path,original:null,updated})
}
// Validate all source files before the first write. A partially applied source tree is never silently overwritten.
for(const {path,updated} of pending){const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,updated)}
const manifest={upstream:'deepseek-ai/deepseek-harness',revision:'1f81c047fc48fa190a683e469daa699857e9afe8',version:'0.2.1-rc.3',files:pending.map(({path,updated})=>({path,sha256:createHash('sha256').update(updated).digest('hex')}))}
writeFileSync(join(root,'.workbench-persistence-integration.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify(manifest,null,2))
