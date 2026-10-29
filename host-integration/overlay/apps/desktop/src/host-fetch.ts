/** Authority-scoped native HTTP transport; never uses Chromium's unrelated localhost cookies. */

/**
 * @param url - owned Host launch URL whose cookie was validated by authenticateWebHost.
 * @param cookie - that Host's single authority-bound cookie header.
 * @param send - Node fetch implementation; omitted uses the process HTTP client without a browser cookie jar.
 * @param requestTimeoutMs - per-request deadline; omitted uses fifteen seconds for native metadata operations.
 * @returns transport refusing credentials in URLs, cross-origin requests and redirects.
 */
export function desktopHostFetch(url: string, cookie: string, send: typeof fetch = fetch, requestTimeoutMs = 15000): (input: string, init?: RequestInit) => Promise<Response> {
  const origin = new URL(url).origin
  return async (input, init) => {
    const target = new URL(input)
    if (target.origin !== origin || target.username !== '' || target.password !== '') throw new Error('desktop host: cross-origin request refused')
    const headers = new Headers(init?.headers)
    headers.set('cookie', cookie)
    headers.set('origin', origin)
    const deadline = AbortSignal.timeout(requestTimeoutMs)
    return send(target.href, { ...init, headers, redirect: 'error', signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline })
  }
}
