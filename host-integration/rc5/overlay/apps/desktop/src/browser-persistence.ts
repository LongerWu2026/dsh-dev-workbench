/** Main-owned persistent Browser accounts; renderer requests never choose filesystem paths. */
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import type { Session } from 'electron'

/** Namespace registered by trusted desktop composition. */
export interface PersistentBrowserPolicy {
  readonly namespace: string
  readonly providers: readonly { readonly id: string; readonly origins: readonly string[] }[]
}

/** Internal account metadata; navigation policy never crosses IPC. */
export interface PersistentBrowserAccount {
  readonly partition: string
  readonly providerId: string
  readonly allowsNavigation: (value: string) => boolean
}

/** Stores stable identities and flush ownership independently from guest leases. */
export class DesktopBrowserPersistence {
  private readonly accounts = new Map<string, PersistentBrowserAccount>()
  private readonly sessions = new Map<string, Session>()
  private readonly flushing = new Map<string, Promise<void>>()

  /** @param profile - profile selected by Desktop, never supplied by a renderer. @param policies - trusted registrations. */
  constructor(private readonly profile: string, private readonly policies: readonly PersistentBrowserPolicy[]) {}

  /** @param request - parsed at the IPC boundary. @returns approved persistent identity and navigation policy. */
  resolve(request: unknown): PersistentBrowserAccount {
    if (typeof request !== 'object' || request === null || Array.isArray(request)) throw new Error('desktop browser: invalid persistent request')
    const input = request as Record<string, unknown>
    if (Object.keys(input).sort().join(',') !== 'namespace,providerId'
      || typeof input.namespace !== 'string' || typeof input.providerId !== 'string') throw new Error('desktop browser: invalid persistent fields')
    const policy = this.policies.find(value => value.namespace === input.namespace)
    const provider = policy?.providers.find(value => value.id === input.providerId)
    if (policy === undefined || provider === undefined) throw new Error('desktop browser: unregistered persistent account')
    const identity = JSON.stringify([realpathSync(this.profile), policy.namespace, provider.id, 'v1'])
    let account = this.accounts.get(identity)
    if (account === undefined) {
      const origins = new Set(provider.origins)
      account = {
        partition: `persist:dsh-browser-v1-${createHash('sha256').update(identity).digest('hex')}`,
        providerId: provider.id,
        allowsNavigation(value) {
          if (!URL.canParse(value)) return false
          const url = new URL(value)
          return url.username === '' && url.password === '' && origins.has(url.origin)
        },
      }
      this.accounts.set(identity, account)
    }
    return account
  }

  /** @param partition - approved identity. @param value - Session configured by Browser guest ownership. */
  register(partition: string, value: Session): void { this.sessions.set(partition, value) }

  /** @param partition - approved identity. @returns shared in-flight flush; rejects on storage failure. */
  flush(partition: string): Promise<void> {
    const pending = this.flushing.get(partition)
    if (pending !== undefined) return pending
    const value = this.sessions.get(partition)
    if (value === undefined) return Promise.resolve()
    const operation = Promise.resolve().then(async () => {
      value.flushStorageData()
      await value.cookies.flushStore()
    })
    this.flushing.set(partition, operation)
    // Both branches remove only their own entry and do not create an unhandled rejected promise.
    const settled = (): void => { if (this.flushing.get(partition) === operation) this.flushing.delete(partition) }
    void operation.then(settled, settled)
    return operation
  }

  /** @returns number of failed persistent account flushes; no credential values are exposed. */
  async flushAll(): Promise<number> {
    const results = await Promise.allSettled([...this.sessions.keys()].map(partition => this.flush(partition)))
    return results.filter(value => value.status === 'rejected').length
  }
}
