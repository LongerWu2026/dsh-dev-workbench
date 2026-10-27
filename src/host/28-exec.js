/* ============================================================================
 * dev-workbench host — bounded read-only command runner
 *
 * Design report §7.2 requires parameterised calls against an explicit
 * allowlist, and forbids splicing natural language into a shell. This module is
 * the only place the plugin ever starts a process:
 *
 *   - argv arrays only, never a shell string;
 *   - a fixed whitelist of read-only subcommands (git status/log/rev-parse,
 *     docker ps, lsof -i) checked BEFORE spawn;
 *   - an explicit cwd, a wall-clock timeout, and a byte cap per stream;
 *   - no stdin, so nothing can be driven interactively.
 *
 * Every failure is reported as data ({status:'unavailable'|'error'}), never as
 * a thrown error, because a missing git must degrade the panel, not break it.
 * ========================================================================== */

const EXEC_TIMEOUT_MS = 5000
const EXEC_MAX_BYTES = 128 * 1024

/** 子命令必须按完整前缀收紧的工具（gh 的写操作如 pr merge 绝不可放行）。 */
const READ_ONLY_ARGV_PREFIXES = [
  'gh pr list',
  'gh pr view',
  'gh pr status',
  'gh run list',
  'gh run view',
  'gh repo view',
  'gh search repos',
  'ps aux',
  'ps -axo',
]

/** Read-only subcommands this plugin is allowed to run. */
const READ_ONLY_ALLOWLIST = {
  git: new Set(['status', 'log', 'rev-parse', 'branch']),
  docker: new Set(['ps', 'version', 'info']),
  lsof: new Set(['-i']),
}

function execAllowed(argv) {
  if (!Array.isArray(argv) || argv.length < 2) return false
  const binary = String(argv[0]).split('/').pop()
  // 候选串包含二进制 basename，白名单前缀才能写成 'gh pr list' / 'ps aux'
  const candidate = [binary]
    .concat(
      argv.slice(1).map(function (token) {
        return String(token)
      }),
    )
    .join(' ')
  // 1) 多段前缀精确匹配（gh / ps）
  const prefixHit = READ_ONLY_ARGV_PREFIXES.some(function (prefix) {
    return candidate === prefix || candidate.startsWith(prefix + ' ')
  })
  if (prefixHit) return true
  // 2) 单命令白名单（git / docker / lsof）
  const allowed = READ_ONLY_ALLOWLIST[binary]
  if (!allowed) return false
  return argv.slice(1).some(function (token) {
    return allowed.has(String(token))
  })
}

function execUnavailable(reason) {
  return { status: 'unavailable', exitCode: null, stdout: '', stderr: '', reason: reason }
}

async function runReadOnlyCommand(ctx, argv, cwd) {
  if (!execAllowed(argv)) {
    return execUnavailable('命令不在只读 allowlist 内：' + argv.join(' '))
  }
  const subprocess = ctx && ctx.get ? ctx.get('subprocess') : null
  if (!subprocess || typeof subprocess.spawn !== 'function') {
    return execUnavailable('当前 profile 未组合 subprocess 服务')
  }
  let signal
  try {
    signal = AbortSignal.timeout(EXEC_TIMEOUT_MS)
  } catch (e) {
    signal = undefined
  }
  let handle
  try {
    handle = subprocess.spawn({
      argv: argv.map(String),
      cwd: cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: EXEC_MAX_BYTES },
        stderr: { maxBytes: 16 * 1024 },
      },
      graceMs: 1200,
      signal: signal,
    })
  } catch (e) {
    return execUnavailable('无法启动进程：' + String((e && e.message) || e))
  }
  try {
    const outcome = await handle.done
    const read = function (reader) {
      if (!reader || typeof reader.readFrom !== 'function') return ''
      try {
        return String(reader.readFrom(0).text || '')
      } catch (e) {
        return ''
      }
    }
    const stdout = read(handle.collected && handle.collected.stdout)
    const stderr = read(handle.collected && handle.collected.stderr)
    return {
      status: outcome && outcome.exitCode === 0 ? 'ok' : 'error',
      exitCode: outcome ? outcome.exitCode : null,
      stdout: stdout,
      stderr: stderr.slice(0, 2000),
      reason: outcome && outcome.exitCode === 0 ? null : '退出码 ' + (outcome ? outcome.exitCode : 'unknown'),
    }
  } catch (e) {
    return {
      status: 'error',
      exitCode: null,
      stdout: '',
      stderr: '',
      reason: String((e && e.message) || e),
    }
  }
}
