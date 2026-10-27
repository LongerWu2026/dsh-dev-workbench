/* ============================================================================
 * dev-workbench page: Developer toolbox
 *
 * Every tool is pure browser-side computation: no RPC, no network, no Host
 * round-trip. Each tool keeps its own input/output/error state so switching
 * tools never discards what was typed. Registers `WB.pages.toolbox`.
 * ========================================================================== */

/* ---------------------------------------------------------------- tool catalog */
const toolDefs = [
  { id: 'json', name: 'JSON', desc: '格式化 / 压缩 / 校验', icon: 'layers' },
  { id: 'timestamp', name: '时间戳', desc: 'Unix 秒毫秒 ↔ 本地时间', icon: 'clock' },
  { id: 'base64', name: 'Base64', desc: 'UTF-8 安全编码解码', icon: 'lock' },
  { id: 'url', name: 'URL', desc: '编解码与 query 拆解', icon: 'link' },
  { id: 'uuid', name: 'UUID', desc: '批量生成 v4', icon: 'zap' },
  { id: 'jwt', name: 'JWT', desc: '解析 header / payload', icon: 'eye' },
  { id: 'regex', name: '正则', desc: '匹配与捕获组', icon: 'filter' },
  { id: 'diff', name: '文本 Diff', desc: '逐行 LCS 对比', icon: 'git' },
  { id: 'cron', name: 'Cron', desc: '5 段表达式逐段解释', icon: 'calendar' },
  { id: 'sql', name: 'SQL', desc: '关键字大写与缩进', icon: 'database' },
  { id: 'yaml', name: 'YAML', desc: 'YAML ↔ JSON（常用子集）', icon: 'layers' },
  { id: 'csv', name: 'CSV', desc: 'CSV ↔ JSON，含引号转义', icon: 'database' },
  { id: 'markdown', name: 'Markdown', desc: '基础语法实时预览', icon: 'book' },
  { id: 'status', name: 'HTTP 状态码', desc: '按码查含义与排查方向', icon: 'info' },
]

/* Initial input is example-shaped only; it is never presented as page data. */
function toolInitialState() {
  return {
    selected: 'json',
    json: {
      input: '{\n  "name": "dev-workbench",\n  "local": true,\n  "tags": ["offline", "browser"]\n}',
      output: '',
      error: '',
    },
    timestamp: { input: String(Date.now()), output: '', error: '' },
    base64: { mode: 'encode', input: '智能工作台 · local only', output: '', error: '' },
    url: {
      mode: 'encode',
      input: 'https://example.com/search?q=开发 工具&page=2',
      output: '',
      error: '',
      rows: [],
    },
    uuid: { count: '5', upper: false, output: '', error: '' },
    jwt: {
      input: '',
      headerText: '',
      payloadText: '',
      claims: [],
      signatureLength: 0,
      error: '',
      ran: false,
    },
    regex: {
      pattern: '(\\w+)@(\\w+\\.\\w+)',
      flags: 'gi',
      text: '联系 dev@example.com 或 ops@example.org',
      matches: [],
      error: '',
      ran: false,
    },
    diff: {
      left: 'alpha\nbeta\ngamma\ndelta',
      right: 'alpha\nbeta changed\ngamma\ndelta\nepsilon',
      rows: [],
      stats: null,
      error: '',
      ran: false,
    },
    cron: { expr: '*/15 9-18 * * 1-5', rows: [], times: [], error: '', ran: false },
    yaml: {
      input: 'name: dev-workbench\ntags:\n  - offline\n  - browser\nlocal: true',
      output: '',
      error: '',
    },
    csv: {
      input: 'name,qps\n网关,2000\n报表,800',
      output: '',
      error: '',
      note: '',
      header: true,
    },
    markdown: {
      input: '# 标题\n\n**加粗**、*斜体* 与 `行内代码`\n\n- 列表项一\n- 列表项二\n\n> 引用\n\n```js\nconst a = 1\n```',
      output: '',
      error: '',
    },
    status: {
      group: 'all',
      query: '',
    },
    sql: {
      input:
        'select id, name, count(*) as total from users left join orders on orders.user_id = users.id where users.active = 1 and orders.total > 100 group by id, name order by total desc limit 20',
      output: '',
      error: '',
    },
  }
}

/* ------------------------------------------------------------------- JSON */
function toolJsonError(error, text) {
  const source = String(text === undefined || text === null ? '' : text)
  const message = String((error && error.message) || error || 'JSON 解析失败')
  const lineCol = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message)
  const position = /position\s+(\d+)/i.exec(message)
  let line = 0
  let column = 0
  if (lineCol) {
    line = Number(lineCol[1])
    column = Number(lineCol[2])
  } else if (position) {
    const index = Math.max(0, Math.min(source.length, Number(position[1])))
    const head = source.slice(0, index)
    const parts = head.split('\n')
    line = parts.length
    column = parts[parts.length - 1].length + 1
  } else if (/end of json|unexpected end/i.test(message)) {
    const parts = source.split('\n')
    line = parts.length
    column = parts[parts.length - 1].length + 1
  }
  if (line > 0) {
    const lines = source.split('\n')
    const raw = lines[line - 1] === undefined ? '' : lines[line - 1]
    const clipped = raw.length > 120 ? raw.slice(0, 120) + '…' : raw
    const caret = Math.max(0, Math.min(clipped.length, column - 1))
    const gutter = '  ' + line + ' | '
    const pointer = ' '.repeat(gutter.length + caret) + '^'
    return (
      'JSON 不合法（第 ' + line + ' 行，第 ' + column + ' 列附近）\n' +
      message +
      '\n\n' +
      gutter +
      clipped +
      '\n' +
      pointer
    )
  }
  return 'JSON 不合法\n' + message
}

function toolJsonSummary(value) {
  if (value === null) return '根类型 null（合法）'
  if (Array.isArray(value)) return '根类型 数组 · ' + value.length + ' 项'
  if (typeof value === 'object') return '根类型 对象 · ' + Object.keys(value).length + ' 个键'
  return '根类型 ' + typeof value + '（标量，合法）'
}

/* ----------------------------------------------------------------- Base64 */
function toolBase64Encode(input) {
  const text = String(input === undefined || input === null ? '' : input)
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

function toolBase64Decode(input) {
  const compact = String(input === undefined || input === null ? '' : input).replace(/\s+/g, '')
  if (!compact) throw new Error('请输入要解码的 Base64 文本')
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
    throw new Error('不是合法的 Base64：包含字母、数字、+ / - _ = 之外的字符')
  }
  let normalized = compact.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = normalized.length % 4
  if (remainder === 2) normalized += '=='
  else if (remainder === 3) normalized += '='
  else if (remainder === 1) throw new Error('不是合法的 Base64：长度不合法')
  let binary
  try {
    binary = atob(normalized)
  } catch (error) {
    throw new Error('不是合法的 Base64：' + String((error && error.message) || error))
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    return new TextDecoder('utf-8').decode(bytes) + '\n\n（提示：这段字节不是合法 UTF-8，已用替换字符显示）'
  }
}

function toolBase64UrlDecode(segment) {
  const text = String(segment === undefined || segment === null ? '' : segment)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = text + '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/* --------------------------------------------------------------------- URL */
function toolSafeDecode(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' '))
  } catch (error) {
    return String(value)
  }
}

function toolParseQuery(text) {
  const source = String(text === undefined || text === null ? '' : text)
  const mark = source.indexOf('?')
  let query = mark >= 0 ? source.slice(mark + 1) : source
  const hash = query.indexOf('#')
  if (hash >= 0) query = query.slice(0, hash)
  if (!query) return []
  return query
    .split('&')
    .filter(function (pair) {
      return pair.length > 0
    })
    .map(function (pair, index) {
      const eq = pair.indexOf('=')
      const rawKey = eq >= 0 ? pair.slice(0, eq) : pair
      const rawValue = eq >= 0 ? pair.slice(eq + 1) : ''
      return {
        index: index,
        key: toolSafeDecode(rawKey),
        value: toolSafeDecode(rawValue),
        raw: pair,
      }
    })
}

/* -------------------------------------------------------------------- UUID */
function toolUuidV4() {
  const cryptoApi = typeof crypto === 'undefined' ? null : crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID()
    } catch (error) {
      /* fall through to getRandomValues */
    }
  }
  const bytes = new Uint8Array(16)
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  let hex = ''
  for (let index = 0; index < bytes.length; index += 1) {
    const part = bytes[index].toString(16)
    hex += part.length === 1 ? '0' + part : part
  }
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  )
}

/* --------------------------------------------------------------------- JWT */
function toolJwtParse(token) {
  const parts = String(token === undefined || token === null ? '' : token).trim().split('.')
  if (parts.length !== 3) {
    throw new Error('JWT 应由 header.payload.signature 三段组成，当前为 ' + parts.length + ' 段')
  }
  function decodeSegment(segment, label) {
    try {
      return JSON.parse(toolBase64UrlDecode(segment))
    } catch (error) {
      throw new Error(label + ' 段无法解析为 JSON：' + String((error && error.message) || error))
    }
  }
  return {
    header: decodeSegment(parts[0], 'header'),
    payload: decodeSegment(parts[1], 'payload'),
    signatureLength: parts[2].length,
  }
}

function toolJwtClaims(payload) {
  const claims = []
  const now = Date.now()
  function add(name, value) {
    if (value === undefined || value === null || value === '') return
    claims.push({ name: name, value: String(value) })
  }
  add('iss', payload.iss)
  add('sub', payload.sub)
  add('aud', Array.isArray(payload.aud) ? payload.aud.join(', ') : payload.aud)
  add('jti', payload.jti)
  add('scope', Array.isArray(payload.scope) ? payload.scope.join(' ') : payload.scope)
  if (payload.exp !== undefined && payload.exp !== null) {
    const exp = Number(payload.exp) * 1000
    if (Number.isFinite(exp)) {
      claims.push({
        name: 'exp',
        value: WB.fmt.datetime(new Date(exp).toISOString()) + (exp < now ? ' · 已过期' : ' · 未过期'),
      })
    } else {
      add('exp', payload.exp)
    }
  }
  if (payload.iat !== undefined && payload.iat !== null) {
    const iat = Number(payload.iat) * 1000
    if (Number.isFinite(iat)) claims.push({ name: 'iat', value: WB.fmt.datetime(new Date(iat).toISOString()) })
    else add('iat', payload.iat)
  }
  if (payload.nbf !== undefined && payload.nbf !== null) {
    const nbf = Number(payload.nbf) * 1000
    if (Number.isFinite(nbf)) claims.push({ name: 'nbf', value: WB.fmt.datetime(new Date(nbf).toISOString()) })
    else add('nbf', payload.nbf)
  }
  return claims
}

/* ------------------------------------------------------------------- regex */
function toolRegexMatches(pattern, flags, text) {
  if (!pattern) throw new Error('请输入正则表达式')
  const rawFlags = String(flags === undefined || flags === null ? '' : flags).trim()
  const allowed = 'dgimsuvy'
  const invalid = rawFlags.split('').filter(function (flag) {
    return allowed.indexOf(flag) < 0
  })
  if (invalid.length) throw new Error('不支持的 flag：' + invalid.join('、') + '（可用 ' + allowed + '）')
  let withGlobal = rawFlags
  if (withGlobal.indexOf('g') < 0 && withGlobal.indexOf('y') < 0) withGlobal += 'g'
  let regex
  try {
    regex = new RegExp(pattern, withGlobal)
  } catch (error) {
    throw new Error('正则不合法：' + String((error && error.message) || error))
  }
  const source = String(text === undefined || text === null ? '' : text)
  const matches = []
  let current
  let guard = 0
  while ((current = regex.exec(source)) !== null) {
    const groups = []
    for (let index = 1; index < current.length; index += 1) {
      groups.push(current[index] === undefined ? '' : String(current[index]))
    }
    const named = current.groups
      ? Object.keys(current.groups).map(function (key) {
          return { key: key, value: current.groups[key] === undefined ? '' : String(current.groups[key]) }
        })
      : []
    matches.push({
      index: current.index,
      end: current.index + current[0].length,
      text: current[0],
      groups: groups,
      named: named,
    })
    if (current[0] === '') regex.lastIndex += 1
    guard += 1
    if (guard >= 500) break
    if (regex.lastIndex > source.length) break
  }
  return matches
}

/* -------------------------------------------------------------------- diff */
function toolDiffLines(leftText, rightText) {
  const left = String(leftText === undefined || leftText === null ? '' : leftText).split('\n')
  const right = String(rightText === undefined || rightText === null ? '' : rightText).split('\n')
  if (left.length > 400 || right.length > 400) {
    throw new Error(
      '行数过多（上限 400 行）：当前 ' + left.length + ' / ' + right.length + ' 行，请缩小对比范围',
    )
  }
  const rows = []
  const stats = { added: 0, removed: 0, same: 0 }
  const matrix = []
  for (let row = 0; row <= left.length; row += 1) matrix.push(new Uint16Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      matrix[i][j] =
        left[i] === right[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ type: 'same', text: left[i] })
      stats.same += 1
      i += 1
      j += 1
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      rows.push({ type: 'del', text: left[i] })
      stats.removed += 1
      i += 1
    } else {
      rows.push({ type: 'add', text: right[j] })
      stats.added += 1
      j += 1
    }
  }
  while (i < left.length) {
    rows.push({ type: 'del', text: left[i] })
    stats.removed += 1
    i += 1
  }
  while (j < right.length) {
    rows.push({ type: 'add', text: right[j] })
    stats.added += 1
    j += 1
  }
  return { rows: rows, stats: stats }
}

/* -------------------------------------------------------------------- cron */
const toolCronFieldDefs = [
  { key: 'minute', label: '分钟', min: 0, max: 59, names: null },
  { key: 'hour', label: '小时', min: 0, max: 23, names: null },
  { key: 'dom', label: '日', min: 1, max: 31, names: null },
  {
    key: 'month',
    label: '月',
    min: 1,
    max: 12,
    names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },
  },
  {
    key: 'dow',
    label: '星期',
    min: 0,
    max: 7,
    names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
  },
]

function toolCronWeekday(value) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[value] === undefined ? '星期 ' + value : names[value]
}

function toolCronValue(token, def) {
  const text = String(token === undefined || token === null ? '' : token).trim().toLowerCase()
  if (def.names && Object.prototype.hasOwnProperty.call(def.names, text)) return def.names[text]
  if (!/^\d+$/.test(text)) {
    throw new Error(
      def.label +
        '字段无法识别：' +
        text +
        '（仅解释，不执行：只支持数字、*、,、-、/ 与标准月份/星期英文缩写）',
    )
  }
  const value = Number(text)
  if (value < def.min || value > def.max) {
    throw new Error(def.label + '字段超出范围 ' + def.min + '–' + def.max + '：' + value)
  }
  return value
}

function toolCronParseField(spec, def) {
  const raw = String(spec === undefined || spec === null ? '' : spec).trim().toLowerCase()
  if (!raw) throw new Error(def.label + '字段为空')
  if (/[lw#]/.test(raw)) {
    throw new Error(
      def.label + '字段包含扩展语法（L / W / #）：本工具仅解释，不执行，也不会推算下次触发时间',
    )
  }
  const wildcard = raw === '*' || raw === '?'
  const values = {}
  const parts = raw.split(',')
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index].trim()
    if (!part) throw new Error(def.label + '字段含空片段：' + raw)
    if (part === '*' || part === '?') {
      for (let value = def.min; value <= def.max; value += 1) values[value] = true
      continue
    }
    let base = part
    let step = 1
    const slash = part.indexOf('/')
    if (slash >= 0) {
      base = part.slice(0, slash)
      const stepText = part.slice(slash + 1)
      if (!/^\d+$/.test(stepText) || Number(stepText) <= 0) {
        throw new Error(def.label + '字段步长不合法：' + stepText)
      }
      step = Number(stepText)
    }
    let start
    let end
    if (base === '*') {
      start = def.min
      end = def.max
    } else if (base.indexOf('-') > 0) {
      const pair = base.split('-')
      if (pair.length !== 2) throw new Error(def.label + '字段范围不合法：' + base)
      start = toolCronValue(pair[0], def)
      end = toolCronValue(pair[1], def)
      if (start > end) throw new Error(def.label + '字段范围顺序不合法：' + base)
    } else {
      start = toolCronValue(base, def)
      end = step > 1 ? def.max : start
    }
    for (let value = start; value <= end; value += step) values[value] = true
  }
  if (def.key === 'dow' && values[7]) {
    values[0] = true
    delete values[7]
  }
  const list = Object.keys(values)
    .map(Number)
    .sort(function (a, b) {
      return a - b
    })
  if (!list.length) throw new Error(def.label + '字段没有有效取值：' + raw)
  return {
    key: def.key,
    label: def.label,
    raw: raw,
    wildcard: wildcard,
    values: list,
    set: values,
  }
}

function toolCronParse(expression) {
  const parts = String(expression === undefined || expression === null ? '' : expression)
    .trim()
    .split(/\s+/)
  if (parts.length !== 5) {
    throw new Error('仅支持标准 5 段表达式（分 时 日 月 周），当前 ' + parts.length + ' 段')
  }
  const fields = []
  for (let index = 0; index < toolCronFieldDefs.length; index += 1) {
    fields.push(toolCronParseField(parts[index], toolCronFieldDefs[index]))
  }
  return {
    fields: fields,
    minute: fields[0],
    hour: fields[1],
    dom: fields[2],
    month: fields[3],
    dow: fields[4],
  }
}

function toolCronValueText(field, value) {
  if (field.key === 'hour') return value + ' 点'
  if (field.key === 'dom') return value + ' 日'
  if (field.key === 'month') return value + ' 月'
  if (field.key === 'dow') return toolCronWeekday(value)
  return String(value)
}

function toolCronDescribeField(field) {
  if (field.wildcard) {
    if (field.key === 'minute') return '每分钟'
    if (field.key === 'hour') return '每小时'
    if (field.key === 'dom') return '每天'
    if (field.key === 'month') return '每月'
    return '每天（星期不限）'
  }
  const shown = field.values.slice(0, 12)
  let text = shown
    .map(function (value) {
      return toolCronValueText(field, value)
    })
    .join('、')
  if (field.values.length > shown.length) text += ' …（共 ' + field.values.length + ' 个值）'
  if (field.key === 'minute') return '第 ' + text + ' 分钟'
  return text
}

/* Next trigger instants in local time; returns at most `count` dates. */
function toolCronNextTimes(parsed, count) {
  const results = []
  const cursor = new Date()
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  const limit = 366 * 24 * 60
  for (let step = 0; step < limit && results.length < count; step += 1) {
    const minute = cursor.getMinutes()
    const hour = cursor.getHours()
    const day = cursor.getDate()
    const month = cursor.getMonth() + 1
    const weekday = cursor.getDay()
    let matched = !!(parsed.minute.set[minute] && parsed.hour.set[hour] && parsed.month.set[month])
    if (matched) {
      const domMatch = !!parsed.dom.set[day]
      const dowMatch = !!parsed.dow.set[weekday]
      if (parsed.dom.wildcard && parsed.dow.wildcard) matched = true
      else if (parsed.dom.wildcard) matched = dowMatch
      else if (parsed.dow.wildcard) matched = domMatch
      else matched = domMatch || dowMatch
    }
    if (matched) results.push(new Date(cursor.getTime()))
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return results
}

/* --------------------------------------------------------------------- SQL */
const toolSqlKeywords = {
  select: 1, from: 1, where: 1, and: 1, or: 1, not: 1, insert: 1, into: 1, values: 1,
  update: 1, set: 1, delete: 1, join: 1, left: 1, right: 1, inner: 1, outer: 1, full: 1,
  cross: 1, on: 1, group: 1, by: 1, order: 1, having: 1, limit: 1, offset: 1, union: 1,
  all: 1, distinct: 1, as: 1, case: 1, when: 1, then: 1, else: 1, end: 1, like: 1, in: 1,
  is: 1, null: 1, create: 1, table: 1, view: 1, index: 1, drop: 1, alter: 1, add: 1,
  column: 1, primary: 1, key: 1, foreign: 1, references: 1, default: 1, constraint: 1,
  unique: 1, check: 1, returning: 1, with: 1, asc: 1, desc: 1, exists: 1, between: 1,
  cast: 1, using: 1, replace: 1, truncate: 1, explain: 1, analyze: 1, begin: 1, commit: 1,
  rollback: 1, transaction: 1, grant: 1, revoke: 1, to: 1, if: 1, over: 1, partition: 1,
}

const toolSqlPhrases = [
  ['left', 'outer', 'join', 'LEFT OUTER JOIN'],
  ['right', 'outer', 'join', 'RIGHT OUTER JOIN'],
  ['full', 'outer', 'join', 'FULL OUTER JOIN'],
  ['left', 'join', 'LEFT JOIN'],
  ['right', 'join', 'RIGHT JOIN'],
  ['inner', 'join', 'INNER JOIN'],
  ['full', 'join', 'FULL JOIN'],
  ['cross', 'join', 'CROSS JOIN'],
  ['group', 'by', 'GROUP BY'],
  ['order', 'by', 'ORDER BY'],
  ['union', 'all', 'UNION ALL'],
  ['insert', 'into', 'INSERT INTO'],
  ['delete', 'from', 'DELETE FROM'],
  ['is', 'not', 'IS NOT'],
  ['not', 'in', 'NOT IN'],
  ['not', 'like', 'NOT LIKE'],
]

const toolSqlClauseWords = {
  select: 1, from: 1, where: 1, 'group by': 1, 'order by': 1, having: 1, limit: 1, offset: 1,
  union: 1, 'union all': 1, 'insert into': 1, values: 1, update: 1, set: 1, 'delete from': 1,
  returning: 1, join: 1, 'left join': 1, 'right join': 1, 'inner join': 1, 'full join': 1,
  'cross join': 1, 'left outer join': 1, 'right outer join': 1, 'full outer join': 1,
  with: 1, create: 1, alter: 1, drop: 1, truncate: 1,
}

const toolSqlContinuationWords = { and: 1, or: 1, on: 1 }

function toolSqlTokenize(sql) {
  const text = String(sql === undefined || sql === null ? '' : sql)
  const tokens = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === "'" || char === '"' || char === '`') {
      let end = index + 1
      while (end < text.length) {
        if (text[end] === char) {
          if (text[end + 1] === char) {
            end += 2
            continue
          }
          end += 1
          break
        }
        end += 1
      }
      tokens.push({ type: 'literal', value: text.slice(index, end) })
      index = end
      continue
    }
    if (char === '-' && text[index + 1] === '-') {
      let end = text.indexOf('\n', index)
      if (end < 0) end = text.length
      tokens.push({ type: 'comment', value: text.slice(index, end) })
      index = end
      continue
    }
    if (char === '/' && text[index + 1] === '*') {
      let end = text.indexOf('*/', index + 2)
      end = end < 0 ? text.length : end + 2
      tokens.push({ type: 'comment', value: text.slice(index, end) })
      index = end
      continue
    }
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (/[A-Za-z_@$\u4e00-\u9fff]/.test(char)) {
      let end = index
      while (end < text.length && /[A-Za-z0-9_@$#\u4e00-\u9fff]/.test(text[end])) end += 1
      tokens.push({ type: 'word', value: text.slice(index, end) })
      index = end
      continue
    }
    if (/[0-9]/.test(char)) {
      let end = index
      while (end < text.length && /[0-9.]/.test(text[end])) end += 1
      tokens.push({ type: 'number', value: text.slice(index, end) })
      index = end
      continue
    }
    const two = text.slice(index, index + 2)
    if (['<=', '>=', '<>', '!=', '||', '::', '->', '=>'].indexOf(two) >= 0) {
      tokens.push({ type: 'punct', value: two })
      index += 2
      continue
    }
    tokens.push({ type: 'punct', value: char })
    index += 1
  }
  return tokens
}

function toolSqlMerge(tokens) {
  const output = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (token.type === 'word') {
      let matched = null
      for (let phraseIndex = 0; phraseIndex < toolSqlPhrases.length; phraseIndex += 1) {
        const phrase = toolSqlPhrases[phraseIndex]
        const words = phrase.slice(0, phrase.length - 1)
        const value = phrase[phrase.length - 1]
        let ok = true
        for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
          const candidate = tokens[index + wordIndex]
          if (!candidate || candidate.type !== 'word' || candidate.value.toLowerCase() !== words[wordIndex]) {
            ok = false
            break
          }
        }
        if (ok) {
          matched = { value: value, length: words.length }
          break
        }
      }
      if (matched) {
        output.push({ type: 'word', value: matched.value })
        index += matched.length
        continue
      }
    }
    output.push(token)
    index += 1
  }
  return output
}

function toolSqlKeywordText(token) {
  const value = String(token.value)
  if (token.type !== 'word') return value
  if (/^[A-Z][A-Z ]+$/.test(value)) return value
  const lower = value.toLowerCase()
  if (toolSqlKeywords[lower] !== undefined) return value.toUpperCase()
  return value
}

function toolSqlFormat(sql) {
  const tokens = toolSqlTokenize(sql)
  if (!tokens.length) throw new Error('请输入要美化的 SQL')
  const merged = toolSqlMerge(tokens)
  const lines = ['']
  let depth = 0
  let inSelect = false

  function append(text, noSpace) {
    const lineIndex = lines.length - 1
    const line = lines[lineIndex]
    const trimmed = line.trim()
    let separator = ''
    if (!noSpace && trimmed !== '' && !/[(.[]$/.test(trimmed) && !/^[,.;:)\]]/.test(text)) separator = ' '
    lines[lineIndex] = line + separator + text
  }

  function newLine(level) {
    if (lines[lines.length - 1].trim() === '') return
    lines.push('  '.repeat(Math.max(0, level)))
  }

  for (let index = 0; index < merged.length; index += 1) {
    const token = merged[index]
    if (token.type === 'comment') {
      newLine(depth)
      append(String(token.value), true)
      if (index < merged.length - 1) newLine(depth)
      continue
    }
    if (token.type === 'punct') {
      const value = String(token.value)
      if (value === '(') {
        const lastLine = lines[lines.length - 1]
        const trimmed = lastLine.trim()
        const lastWordMatch = /([A-Za-z_][\w$]*)$/.exec(trimmed)
        const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : ''
        const spaced =
          toolSqlKeywords[lastWord] !== undefined ||
          toolSqlContinuationWords[lastWord] !== undefined ||
          /[=<>+\-*/|]$/.test(trimmed)
        append(value, !spaced)
        depth += 1
        continue
      }
      if (value === ')') {
        depth = Math.max(0, depth - 1)
        append(value, true)
        continue
      }
      if (value === ',') {
        append(value, true)
        if (inSelect && depth === 0) newLine(1)
        continue
      }
      if (value === ';') {
        append(value, true)
        if (index < merged.length - 1) newLine(0)
        continue
      }
      append(value, value === '::')
      continue
    }
    const lower = String(token.value).toLowerCase()
    if (token.type === 'word' && toolSqlClauseWords[lower] !== undefined) {
      const last = lines[lines.length - 1]
      if (last.trim() !== '' && !/\($/.test(last.trim())) newLine(depth)
      inSelect = lower === 'select'
      append(toolSqlKeywordText(token), false)
      continue
    }
    if (token.type === 'word' && toolSqlContinuationWords[lower] !== undefined) {
      newLine(depth + 1)
      append(toolSqlKeywordText(token), false)
      continue
    }
    append(toolSqlKeywordText(token), false)
  }

  const result = []
  lines.forEach(function (line) {
    const text = line.replace(/\s+$/, '')
    if (text === '' && (result.length === 0 || result[result.length - 1] === '')) return
    result.push(text)
  })
  while (result.length && result[result.length - 1] === '') result.pop()
  return result.join('\n')
}

/* ------------------------------------------------------------ shared pieces */
function toolErrorBlock(props) {
  if (!props.text) return null
  return h(
    'div',
    {
      role: 'alert',
      className: 'wb-tiny',
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '7px 9px',
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, ' + T.err + ' 45%, transparent)',
        background: 'color-mix(in srgb, ' + T.err + ' 10%, transparent)',
        color: T.err,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        lineHeight: 1.6,
      },
    },
    h(Icon, { name: 'alert', size: 13 }),
    h('span', { style: { minWidth: 0 } }, String(props.text)),
  )
}

function toolOutputBlock(props) {
  if (props.text) {
    return h('pre', { className: 'wb-code', style: props.style }, String(props.text))
  }
  return h(
    'div',
    {
      className: 'wb-tiny wb-muted',
      style: {
        padding: '10px 12px',
        border: '1px dashed ' + T.border1,
        borderRadius: 10,
        lineHeight: 1.6,
      },
    },
    props.placeholder || '结果会显示在这里',
  )
}

function toolCopyButton(props) {
  const text = props.text ? String(props.text) : ''
  return h(Btn, {
    size: 'sm',
    icon: 'copy',
    disabled: !text,
    title: props.title || '复制结果',
    onClick: function () {
      if (!text) return
      WB.util.copy(text)
        .then(function () {
          WB.toast('已复制结果到剪贴板', 'ok')
        })
        .catch(function (error) {
          WB.toast(String((error && error.message) || error), 'err')
        })
    },
    children: props.label || '复制',
  })
}

function toolLocalNote() {
  return h(
    'div',
    {
      className: 'wb-row wb-tiny wb-muted',
      style: {
        gap: 6,
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: '1px solid ' + T.border1,
      },
    },
    h(Icon, { name: 'lock', size: 12 }),
    h('span', null, '本地执行 · 全部计算在浏览器内完成，数据不离开浏览器'),
  )
}

function toolMonoStyle(minHeight) {
  return { minHeight: minHeight || 150, fontFamily: T.font.mono, fontSize: 11.5 }
}

/* ------------------------------------------------------------------- panes */
function toolJsonPane(props) {
  const value = props.value || {}
  function run(mode) {
    const text = String(value.input || '')
    if (!text.trim()) {
      props.patch({ output: '', error: '请先输入 JSON 文本' })
      return
    }
    try {
      const parsed = JSON.parse(text)
      if (mode === 'validate') {
        props.patch({
          output:
            '✓ JSON 合法 · ' +
            toolJsonSummary(parsed) +
            '\n字符数 ' +
            text.length +
            ' · 行数 ' +
            text.split('\n').length,
          error: '',
        })
      } else {
        props.patch({
          output: mode === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2),
          error: '',
        })
      }
    } catch (error) {
      props.patch({ output: '', error: toolJsonError(error, text) })
    }
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: '输入 JSON' },
        h(Textarea, {
          value: value.input || '',
          rows: 12,
          spellCheck: false,
          style: toolMonoStyle(220),
          placeholder: '粘贴 JSON 文本',
          onChange: function (event) {
            props.patch({ input: event.target.value })
          },
        }),
      ),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
          h(Btn, {
            size: 'sm',
            kind: 'primary',
            icon: 'sparkles',
            onClick: function () {
              run('format')
            },
            children: '格式化',
          }),
          h(Btn, {
            size: 'sm',
            icon: 'layers',
            onClick: function () {
              run('minify')
            },
            children: '压缩',
          }),
          h(Btn, {
            size: 'sm',
            icon: 'checkCircle',
            onClick: function () {
              run('validate')
            },
            children: '校验',
          }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, { text: value.output, placeholder: '格式化 / 压缩 / 校验的结果' }),
      ),
    ),
  )
}

function toolTimestampPane(props) {
  const value = props.value || {}
  function parseText(raw) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim()
    if (!text) {
      return { output: '', error: '请输入时间戳或日期字符串（例如 1730000000 或 2026-10-27 14:00）' }
    }
    let date = null
    let info = ''
    if (/^-?\d+$/.test(text)) {
      const number = Number(text)
      const millis = Math.abs(number) >= 1e12 ? number : number * 1000
      date = new Date(millis)
      info = '输入视为时间戳（' + (Math.abs(number) >= 1e12 ? '毫秒' : '秒') + '）'
    } else {
      date = new Date(text)
      info = '输入视为日期字符串'
    }
    if (!date || Number.isNaN(date.getTime())) return { output: '', error: '无法解析：' + text }
    const lines = [
      info,
      '',
      'Unix 秒：' + Math.floor(date.getTime() / 1000),
      'Unix 毫秒：' + date.getTime(),
      '本地时间：' + WB.fmt.datetime(date.toISOString()),
      'ISO 8601：' + date.toISOString(),
      '相对现在：' + WB.fmt.relative(date.toISOString()),
    ]
    return { output: lines.join('\n'), error: '' }
  }
  function run() {
    props.patch(parseText(value.input))
  }
  function fillCurrent(unit) {
    const stamp = unit === 'ms' ? Date.now() : Math.floor(Date.now() / 1000)
    const result = parseText(String(stamp))
    props.patch({ input: String(stamp), output: result.output, error: result.error })
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        {
          label: '输入时间戳或日期',
          hint: '纯数字按位数自动识别秒 / 毫秒；其它按 Date 解析',
        },
        h(Textarea, {
          value: value.input || '',
          rows: 4,
          spellCheck: false,
          style: toolMonoStyle(100),
          placeholder: '1730000000 或 2026-10-27 14:00',
          onChange: function (event) {
            props.patch({ input: event.target.value })
          },
        }),
      ),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
          h(Btn, {
            size: 'sm',
            kind: 'primary',
            icon: 'clock',
            onClick: run,
            children: '转换',
          }),
          h(Btn, {
            size: 'sm',
            onClick: function () {
              fillCurrent('s')
            },
            children: '填入当前秒',
          }),
          h(Btn, {
            size: 'sm',
            onClick: function () {
              fillCurrent('ms')
            },
            children: '填入当前毫秒',
          }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, { text: value.output, placeholder: '两种单位与本地时间会一起显示' }),
      ),
    ),
  )
}

function toolBase64Pane(props) {
  const value = props.value || {}
  function run() {
    const input = String(value.input || '')
    if (!input.trim()) {
      props.patch({ output: '', error: '请输入文本' })
      return
    }
    try {
      if (value.mode === 'decode') props.patch({ output: toolBase64Decode(input), error: '' })
      else props.patch({ output: toolBase64Encode(input), error: '' })
    } catch (error) {
      props.patch({ output: '', error: String((error && error.message) || error) })
    }
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 8 } },
      h(Segmented, {
        items: [
          { value: 'encode', label: '编码' },
          { value: 'decode', label: '解码' },
        ],
        value: value.mode || 'encode',
        onChange: function (mode) {
          props.patch({ mode: mode, output: '', error: '' })
        },
      }),
      h('span', { className: 'wb-tiny wb-muted' }, '编码与解码都按 UTF-8 处理，中文不会乱码'),
    ),
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: value.mode === 'decode' ? '输入 Base64' : '输入原文' },
        h(Textarea, {
          value: value.input || '',
          rows: 8,
          spellCheck: false,
          style: toolMonoStyle(150),
          placeholder: value.mode === 'decode' ? '粘贴 Base64 字符串' : '输入要编码的文本',
          onChange: function (event) {
            props.patch({ input: event.target.value })
          },
        }),
      ),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row', style: { gap: 6 } },
          h(Btn, {
            size: 'sm',
            kind: 'primary',
            icon: 'lock',
            onClick: run,
            children: value.mode === 'decode' ? '解码' : '编码',
          }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, {
          text: value.output,
          placeholder: value.mode === 'decode' ? 'UTF-8 解码后的文本' : 'Base64 结果',
        }),
      ),
    ),
  )
}

function toolUrlPane(props) {
  const value = props.value || {}
  function run() {
    const input = String(value.input || '')
    if (!input.trim()) {
      props.patch({ output: '', error: '请输入要编解码的文本', rows: [] })
      return
    }
    try {
      const output = value.mode === 'decode' ? decodeURIComponent(input) : encodeURIComponent(input)
      props.patch({ output: output, error: '', rows: toolParseQuery(input) })
    } catch (error) {
      props.patch({
        output: '',
        error: '不是合法的 URL 编码：' + String((error && error.message) || error),
        rows: [],
      })
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : []
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 8 } },
      h(Segmented, {
        items: [
          { value: 'encode', label: 'encodeURIComponent' },
          { value: 'decode', label: 'decodeURIComponent' },
        ],
        value: value.mode || 'encode',
        onChange: function (mode) {
          props.patch({ mode: mode, output: '', error: '', rows: [] })
        },
      }),
    ),
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: '输入 URL 或文本' },
        h(Textarea, {
          value: value.input || '',
          rows: 6,
          spellCheck: false,
          style: toolMonoStyle(120),
          placeholder: 'https://example.com/search?q=开发 工具&page=2',
          onChange: function (event) {
            props.patch({ input: event.target.value })
          },
        }),
      ),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row', style: { gap: 6 } },
          h(Btn, {
            size: 'sm',
            kind: 'primary',
            icon: 'link',
            onClick: run,
            children: value.mode === 'decode' ? '解码' : '编码',
          }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, { text: value.output, placeholder: '编码 / 解码结果' }),
      ),
    ),
    rows.length
      ? h(
          'div',
          null,
          h('div', { className: 'wb-tiny wb-muted', style: { marginBottom: 4 } }, 'Query 参数拆解'),
          h(
            'table',
            { className: 'wb-table' },
            h(
              'thead',
              null,
              h('tr', null, h('th', null, '参数'), h('th', null, '解码后的值'), h('th', null, '原始片段')),
            ),
            h(
              'tbody',
              null,
              rows.map(function (row) {
                return h(
                  'tr',
                  { key: 'query-' + row.index },
                  h('td', { className: 'wb-mono' }, row.key),
                  h('td', { className: 'wb-mono', style: { overflowWrap: 'anywhere' } }, row.value),
                  h('td', { className: 'wb-mono wb-muted' }, row.raw),
                )
              }),
            ),
          ),
        )
      : null,
  )
}

function toolUuidPane(props) {
  const value = props.value || {}
  function run() {
    const count = Number(String(value.count === undefined ? '' : value.count).trim())
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      props.patch({ output: '', error: '数量需要是 1–50 之间的整数' })
      return
    }
    const list = []
    for (let index = 0; index < count; index += 1) {
      const id = toolUuidV4()
      list.push(value.upper ? id.toUpperCase() : id)
    }
    props.patch({ output: list.join('\n'), error: '' })
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 8, alignItems: 'flex-end' } },
      h(
        'div',
        { style: { width: 130 } },
        h(
          Field,
          { label: '数量' },
          h(Input, {
            value: value.count || '',
            inputMode: 'numeric',
            onChange: function (event) {
              props.patch({ count: event.target.value })
            },
          }),
        ),
      ),
      h(
        Field,
        { label: '大小写' },
        h(Segmented, {
          items: [
            { value: 'lower', label: '小写' },
            { value: 'upper', label: '大写' },
          ],
          value: value.upper ? 'upper' : 'lower',
          onChange: function (mode) {
            props.patch({ upper: mode === 'upper' })
          },
        }),
      ),
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'zap',
        onClick: run,
        children: '生成 UUID v4',
      }),
      h('div', { className: 'wb-spacer' }),
      h(toolCopyButton, { text: value.output }),
    ),
    h(toolErrorBlock, { text: value.error }),
    h(toolOutputBlock, {
      text: value.output,
      placeholder: '点击生成；每行一个 UUID v4',
      style: { maxHeight: 300 },
    }),
    h(
      'div',
      { className: 'wb-tiny wb-muted' },
      '优先使用 crypto.randomUUID；不可用时回退到 crypto.getRandomValues，仍不可用才用 Math.random 兜底。',
    ),
  )
}

function toolJwtPane(props) {
  const value = props.value || {}
  function run() {
    const token = String(value.input || '').trim()
    if (!token) {
      props.patch({ error: '请粘贴 JWT', headerText: '', payloadText: '', claims: [], ran: true })
      return
    }
    try {
      const parsed = toolJwtParse(token)
      props.patch({
        error: '',
        headerText: JSON.stringify(parsed.header, null, 2),
        payloadText: JSON.stringify(parsed.payload, null, 2),
        claims: toolJwtClaims(parsed.payload),
        signatureLength: parsed.signatureLength,
        ran: true,
      })
    } catch (error) {
      props.patch({
        error: String((error && error.message) || error),
        headerText: '',
        payloadText: '',
        claims: [],
        ran: true,
      })
    }
  }
  const claims = Array.isArray(value.claims) ? value.claims : []
  const parsed = !!(value.headerText || value.payloadText)
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      {
        className: 'wb-tiny',
        style: {
          padding: '7px 9px',
          borderRadius: 8,
          border: '1px solid color-mix(in srgb, ' + T.warn + ' 45%, transparent)',
          background: 'color-mix(in srgb, ' + T.warn + ' 10%, transparent)',
          color: T.warn,
          lineHeight: 1.6,
        },
      },
      '只解码不校验签名：任何人都能伪造内容，不要把解析结果当作身份或权限依据。',
    ),
    h(
      Field,
      { label: 'JWT' },
      h(Textarea, {
        value: value.input || '',
        rows: 4,
        spellCheck: false,
        style: toolMonoStyle(100),
        placeholder: '粘贴 header.payload.signature',
        onChange: function (event) {
          props.patch({ input: event.target.value })
        },
      }),
    ),
    h(
      'div',
      { className: 'wb-row', style: { gap: 6 } },
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'eye',
        onClick: run,
        children: '解析',
      }),
      h('div', { className: 'wb-spacer' }),
      h(toolCopyButton, {
        text: parsed ? 'HEADER\n' + value.headerText + '\n\nPAYLOAD\n' + value.payloadText : '',
        label: '复制解析结果',
      }),
    ),
    h(toolErrorBlock, { text: value.error }),
    parsed
      ? h(
          'div',
          { className: 'wb-split' },
          h(
            'div',
            { className: 'wb-stack', style: { gap: 4 } },
            h('div', { className: 'wb-tiny wb-muted' }, 'Header'),
            h('pre', { className: 'wb-code', style: { maxHeight: 220 } }, value.headerText || ''),
          ),
          h(
            'div',
            { className: 'wb-stack', style: { gap: 4 } },
            h('div', { className: 'wb-tiny wb-muted' }, 'Payload'),
            h('pre', { className: 'wb-code', style: { maxHeight: 220 } }, value.payloadText || ''),
          ),
        )
      : h(toolOutputBlock, { text: '', placeholder: '解析后显示 header 与 payload' }),
    claims.length
      ? h(
          'table',
          { className: 'wb-table' },
          h('thead', null, h('tr', null, h('th', null, '声明'), h('th', null, '值'))),
          h(
            'tbody',
            null,
            claims.map(function (claim) {
              return h(
                'tr',
                { key: 'claim-' + claim.name },
                h('td', { className: 'wb-mono' }, claim.name),
                h('td', { style: { overflowWrap: 'anywhere' } }, claim.value),
              )
            }),
          ),
        )
      : null,
    value.ran && parsed
      ? h(
          'div',
          { className: 'wb-tiny wb-muted' },
          '签名段长度 ' + String(value.signatureLength || 0) + ' 字符（未校验）。',
        )
      : null,
  )
}

function toolRegexPane(props) {
  const value = props.value || {}
  function run() {
    try {
      const matches = toolRegexMatches(value.pattern, value.flags, value.text)
      props.patch({ matches: matches, error: '', ran: true })
    } catch (error) {
      props.patch({ matches: [], error: String((error && error.message) || error), ran: true })
    }
  }
  const matches = Array.isArray(value.matches) ? value.matches : []
  const copyText = matches
    .map(function (match, index) {
      const groups = match.groups.length ? '  组：' + match.groups.join(' | ') : ''
      return '#' + (index + 1) + ' @' + match.index + ' ' + JSON.stringify(match.text) + groups
    })
    .join('\n')
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: '模式' },
        h(Input, {
          value: value.pattern || '',
          spellCheck: false,
          style: { fontFamily: T.font.mono, fontSize: 12 },
          placeholder: '(\\w+)@(\\w+\\.\\w+)',
          onChange: function (event) {
            props.patch({ pattern: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: 'Flags', hint: '可用 d g i m s u v y；缺少 g 时自动补齐' },
        h(Input, {
          value: value.flags || '',
          spellCheck: false,
          style: { fontFamily: T.font.mono, fontSize: 12 },
          placeholder: 'gi',
          onChange: function (event) {
            props.patch({ flags: event.target.value })
          },
        }),
      ),
    ),
    h(
      Field,
      { label: '测试文本' },
      h(Textarea, {
        value: value.text || '',
        rows: 5,
        spellCheck: false,
        style: toolMonoStyle(110),
        placeholder: '粘贴要匹配的文本',
        onChange: function (event) {
          props.patch({ text: event.target.value })
        },
      }),
    ),
    h(
      'div',
      { className: 'wb-row', style: { gap: 6 } },
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'filter',
        onClick: run,
        children: '匹配',
      }),
      h('div', { className: 'wb-spacer' }),
      h(toolCopyButton, { text: copyText }),
    ),
    h(toolErrorBlock, { text: value.error }),
    matches.length
      ? h(
          'div',
          { className: 'wb-stack', style: { gap: 6 } },
          h('div', { className: 'wb-tiny wb-muted' }, '共 ' + matches.length + ' 处匹配'),
          h(
            'table',
            { className: 'wb-table' },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                h('th', null, '#'),
                h('th', null, '位置'),
                h('th', null, '匹配'),
                h('th', null, '捕获组'),
              ),
            ),
            h(
              'tbody',
              null,
              matches.map(function (match, index) {
                const groups = match.groups.length
                  ? match.groups
                      .map(function (group, groupIndex) {
                        return '$' + (groupIndex + 1) + ' ' + (group === '' ? '（空）' : group)
                      })
                      .join('  ')
                  : '—'
                const named = match.named.length
                  ? '  ' +
                    match.named
                      .map(function (entry) {
                        return entry.key + '=' + entry.value
                      })
                      .join('  ')
                  : ''
                return h(
                  'tr',
                  { key: 'match-' + index },
                  h('td', { className: 'wb-mono' }, String(index + 1)),
                  h('td', { className: 'wb-mono' }, match.index + '–' + match.end),
                  h('td', { className: 'wb-mono', style: { overflowWrap: 'anywhere' } }, match.text),
                  h(
                    'td',
                    { className: 'wb-mono wb-muted', style: { overflowWrap: 'anywhere' } },
                    groups + named,
                  ),
                )
              }),
            ),
          ),
        )
      : value.ran
        ? h(toolOutputBlock, { text: '', placeholder: '没有匹配（0 处）' })
        : h(toolOutputBlock, { text: '', placeholder: '匹配结果会显示在这里' }),
  )
}

function toolDiffPane(props) {
  const value = props.value || {}
  function run() {
    try {
      const result = toolDiffLines(value.left, value.right)
      props.patch({ rows: result.rows, stats: result.stats, error: '', ran: true })
    } catch (error) {
      props.patch({ rows: [], stats: null, error: String((error && error.message) || error), ran: true })
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : []
  const stats = value.stats
  const copyText = rows
    .map(function (row) {
      return (row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  ') + row.text
    })
    .join('\n')
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: '原始文本' },
        h(Textarea, {
          value: value.left || '',
          rows: 7,
          spellCheck: false,
          style: toolMonoStyle(120),
          onChange: function (event) {
            props.patch({ left: event.target.value })
          },
        }),
      ),
      h(
        Field,
        { label: '修改后文本' },
        h(Textarea, {
          value: value.right || '',
          rows: 7,
          spellCheck: false,
          style: toolMonoStyle(120),
          onChange: function (event) {
            props.patch({ right: event.target.value })
          },
        }),
      ),
    ),
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 8 } },
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'git',
        onClick: run,
        children: '对比',
      }),
      stats
        ? h(
            'div',
            { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
            h(Badge, { tone: 'ok' }, '+' + stats.added),
            h(Badge, { tone: 'err' }, '-' + stats.removed),
            h(Badge, { tone: 'idle' }, '=' + stats.same),
          )
        : null,
      h('div', { className: 'wb-spacer' }),
      h(toolCopyButton, { text: copyText }),
    ),
    h(toolErrorBlock, { text: value.error }),
    rows.length
      ? h(
          'div',
          { className: 'wb-code', style: { padding: '4px 0', maxHeight: 360, overflow: 'auto' } },
          rows.map(function (row, index) {
            const isAdd = row.type === 'add'
            const isDel = row.type === 'del'
            const color = isAdd ? T.ok : isDel ? T.err : T.text2
            return h(
              'div',
              {
                key: 'diff-' + index,
                style: {
                  display: 'flex',
                  gap: 8,
                  padding: '1px 10px',
                  color: color,
                  background: isAdd
                    ? 'color-mix(in srgb, ' + T.ok + ' 12%, transparent)'
                    : isDel
                      ? 'color-mix(in srgb, ' + T.err + ' 12%, transparent)'
                      : 'transparent',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                },
              },
              h(
                'span',
                { className: 'wb-mono', style: { flex: '0 0 40px', textAlign: 'right', opacity: 0.55 } },
                String(index + 1),
              ),
              h(
                'span',
                { className: 'wb-mono', style: { flex: '0 0 10px' } },
                isAdd ? '+' : isDel ? '-' : ' ',
              ),
              h('span', { className: 'wb-mono', style: { minWidth: 0 } }, row.text === '' ? ' ' : row.text),
            )
          }),
        )
      : h(toolOutputBlock, {
          text: '',
          placeholder: value.ran ? '两段文本没有差异' : '逐行 LCS 对比结果会显示在这里',
        }),
  )
}

function toolCronPane(props) {
  const value = props.value || {}
  function run() {
    const expression = String(value.expr || '').trim()
    if (!expression) {
      props.patch({ error: '请输入 5 段 Cron 表达式（分 时 日 月 周）', rows: [], times: [], ran: true })
      return
    }
    try {
      const parsed = toolCronParse(expression)
      const rows = parsed.fields.map(function (field) {
        return {
          key: field.key,
          label: field.label,
          raw: field.raw,
          description: toolCronDescribeField(field),
        }
      })
      const times = toolCronNextTimes(parsed, 3)
      props.patch({ error: '', rows: rows, times: times, ran: true })
    } catch (error) {
      props.patch({ error: String((error && error.message) || error), rows: [], times: [], ran: true })
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : []
  const times = Array.isArray(value.times) ? value.times : []
  const copyText = rows
    .map(function (row) {
      return row.label + '  ' + row.raw + '  ' + row.description
    })
    .join('\n')
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
      h(Badge, { tone: 'warn' }, '仅解释，不执行'),
      h(
        'span',
        { className: 'wb-tiny wb-muted' },
        '标准 5 段（分 时 日 月 周）；秒字段、年份与 L / W / # 扩展不执行',
      ),
    ),
    h(
      Field,
      { label: '表达式', hint: '例如 */15 9-18 * * 1-5' },
      h(Textarea, {
        value: value.expr || '',
        rows: 2,
        spellCheck: false,
        style: toolMonoStyle(56),
        placeholder: '*/15 9-18 * * 1-5',
        onChange: function (event) {
          props.patch({ expr: event.target.value })
        },
      }),
    ),
    h(
      'div',
      { className: 'wb-row', style: { gap: 6 } },
      h(Btn, {
        size: 'sm',
        kind: 'primary',
        icon: 'calendar',
        onClick: run,
        children: '解释',
      }),
      h('div', { className: 'wb-spacer' }),
      h(toolCopyButton, { text: copyText }),
    ),
    h(toolErrorBlock, { text: value.error }),
    rows.length
      ? h(
          'table',
          { className: 'wb-table' },
          h(
            'thead',
            null,
            h('tr', null, h('th', null, '字段'), h('th', null, '表达式'), h('th', null, '解释')),
          ),
          h(
            'tbody',
            null,
            rows.map(function (row) {
              return h(
                'tr',
                { key: 'cron-' + row.key },
                h('td', null, row.label),
                h('td', { className: 'wb-mono' }, row.raw),
                h('td', null, row.description),
              )
            }),
          ),
        )
      : null,
    times.length
      ? h(
          'div',
          { className: 'wb-stack', style: { gap: 4 } },
          h(
            'div',
            { className: 'wb-tiny wb-muted' },
            '下次触发估算（本机时区，最多向后推算 366 天）',
          ),
          times.map(function (time, index) {
            return h(
              'div',
              { key: 'cron-time-' + index, className: 'wb-mono wb-tiny' },
              '· ' + WB.fmt.datetime(time.toISOString()),
            )
          }),
        )
      : value.ran && !value.error
        ? h(
            'div',
            { className: 'wb-tiny wb-muted' },
            '未来 366 天内没有匹配时间：这个表达式可能永远不会触发。',
          )
        : null,
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.6 } },
      '日与星期同时限定时按标准 cron 的「或」语义匹配；本工具只解释与估算，不会注册任何定时任务。',
    ),
  )
}

function toolSqlPane(props) {
  const value = props.value || {}
  function run() {
    try {
      const output = toolSqlFormat(value.input)
      props.patch({ output: output, error: '' })
    } catch (error) {
      props.patch({ output: '', error: String((error && error.message) || error) })
    }
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(
        Field,
        { label: '输入 SQL', hint: '只做文本美化，不连接数据库、不执行语句' },
        h(Textarea, {
          value: value.input || '',
          rows: 12,
          spellCheck: false,
          style: toolMonoStyle(220),
          placeholder: '粘贴 SQL',
          onChange: function (event) {
            props.patch({ input: event.target.value })
          },
        }),
      ),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row', style: { gap: 6 } },
          h(Btn, {
            size: 'sm',
            kind: 'primary',
            icon: 'database',
            onClick: run,
            children: '美化',
          }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, { text: value.output, placeholder: '关键字大写 + 子句换行后的 SQL' }),
      ),
    ),
  )
}

const toolPanes = {
  json: toolJsonPane,
  timestamp: toolTimestampPane,
  base64: toolBase64Pane,
  url: toolUrlPane,
  uuid: toolUuidPane,
  jwt: toolJwtPane,
  regex: toolRegexPane,
  diff: toolDiffPane,
  cron: toolCronPane,
  sql: toolSqlPane,
  yaml: toolYamlPane,
  csv: toolCsvPane,
  markdown: toolMarkdownPane,
  status: toolStatusPane,
}

/* --------------------------------------------------------------------- page */
function toolPage() {
  const [state, setState] = React.useState(toolInitialState)
  const selected = state.selected || 'json'
  const def =
    toolDefs.filter(function (item) {
      return item.id === selected
    })[0] || toolDefs[0]
  const Pane = toolPanes[selected] || toolJsonPane

  function patchFor(key) {
    return function (patch) {
      setState(function (previous) {
        const next = Object.assign({}, previous)
        next[key] = Object.assign({}, previous[key], patch)
        return next
      })
    }
  }

  function selectTool(toolId) {
    setState(function (previous) {
      return Object.assign({}, previous, { selected: toolId })
    })
  }

  return h(
    'div',
    { className: 'wb-page' },
    h(PageHead, {
      icon: 'toolbox',
      title: '开发工具箱',
      sub: '14 个高频小工具：全部在浏览器内计算，输入不会发送到 Host 或任何远端。',
    }),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(190px, 236px) minmax(0, 1fr)',
          gap: 14,
          alignItems: 'start',
        },
      },
      h(
        Panel,
        { title: '工具', sub: '切换工具会保留各自输入', icon: 'toolbox', flush: true },
        h(
          'div',
          { style: { padding: '0 12px 12px' } },
          h(
            'div',
            { className: 'wb-toolgrid', style: { gridTemplateColumns: 'minmax(0, 1fr)' } },
            toolDefs.map(function (item) {
              const active = selected === item.id
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'wb-tool' + (active ? ' is-active' : ''),
                  'aria-pressed': active ? 'true' : 'false',
                  onClick: function () {
                    selectTool(item.id)
                  },
                },
                h(
                  'span',
                  {
                    className: 'wb-row',
                    style: {
                      gap: 6,
                      alignItems: 'center',
                      color: active ? T.accent : T.text2,
                      fontSize: 12.5,
                      fontWeight: 600,
                    },
                  },
                  h(Icon, { name: item.icon, size: 14 }),
                  h('span', null, item.name),
                ),
                h('span', null, item.desc),
              )
            }),
          ),
        ),
      ),
      h(
        Panel,
        {
          title: def.name,
          sub: def.desc,
          icon: def.icon,
          actions: h(Badge, { tone: 'ok' }, '本地执行'),
        },
        h(toolLocalNote, null),
        h(Pane, { value: state[selected] || {}, patch: patchFor(selected) }),
      ),
    ),
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { marginTop: 14, lineHeight: 1.7 } },
      '工具箱不读取 Host 数据、不发起网络请求，也不会把输入写回工作台；刷新页面后输入即丢弃。',
    ),
  )
}

WB.pages.toolbox = toolPage
