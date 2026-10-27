/* ============================================================================
 * dev-workbench toolbox — 追加工具：YAML / CSV / Markdown / HTTP 状态码
 *
 * 与 40-toolbox.js 同一套约定：纯浏览器计算，状态切片由 toolInitialState()
 * 提供，pane 收到 { value, patch }。函数声明会被提升，因此 40 里的 toolPanes
 * 可以直接引用本文件的函数。
 *
 * 诚实边界：
 *  - YAML 只解析**常用子集**（缩进映射 / 列表 / 标量 / 行内集合 / 注释）；
 *    锚点、别名、自定义标签、块标量一律明确报错，不静默产出错误结构。
 *  - Markdown 预览不使用 innerHTML，全部用 React 元素构造，原始 HTML 当纯文本。
 * ========================================================================== */

/* ------------------------------------------------------------------ YAML */

const yamlScalarRe = /^(?:[^#\s][^#]*|)$/

function yamlUnquote(text) {
  const value = String(text)
  if (/^".*"$/.test(value)) {
    return value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'")
  return value
}

function yamlScalar(text) {
  const raw = String(text).trim()
  if (raw.length === 0) return null
  if (/^(null|Null|NULL|~)$/.test(raw)) return null
  if (/^(true|True|TRUE)$/.test(raw)) return true
  if (/^(false|False|FALSE)$/.test(raw)) return false
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw)
  if (/^\[.*\]$/.test(raw)) {
    const inner = raw.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map(function (part) {
      return yamlScalar(part)
    })
  }
  if (/^\{.*\}$/.test(raw)) {
    const inner = raw.slice(1, -1).trim()
    const out = {}
    if (!inner) return out
    inner.split(',').forEach(function (pair) {
      const index = pair.indexOf(':')
      if (index < 0) throw new Error('行内对象缺少 ":" 分隔：' + pair.trim())
      out[yamlUnquote(pair.slice(0, index).trim())] = yamlScalar(pair.slice(index + 1))
    })
    return out
  }
  return yamlUnquote(raw)
}

/** YAML 子集 → JS 值。失败时抛带行号的错误。 */
function yamlParse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n')
  const root = {}
  const stack = [{ indent: -1, container: root, kind: 'map' }]

  function top() {
    return stack[stack.length - 1]
  }

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    if (/^\s*$/.test(rawLine)) continue
    if (/^\s*#/.test(rawLine)) continue
    if (/^\s*(---|\.\.\.)\s*$/.test(rawLine)) continue
    if (/^\t/.test(rawLine)) throw new Error('第 ' + (i + 1) + ' 行：不允许用 Tab 缩进，请改用空格')
    if (/^\s*(&|\*)[A-Za-z]/.test(rawLine)) {
      throw new Error('第 ' + (i + 1) + ' 行：暂不支持锚点/别名（&、*）')
    }
    if (/:\s*[|>][-+]?\s*$/.test(rawLine)) {
      throw new Error('第 ' + (i + 1) + ' 行：暂不支持块标量（| / >），请改用单行字符串')
    }

    const indent = rawLine.length - rawLine.replace(/^\s+/, '').length
    let content = rawLine.slice(indent)

    while (stack.length > 1 && indent <= top().indent) stack.pop()
    const parent = top()

    if (/^- /.test(content) || content === '-') {
      if (parent.kind !== 'list') {
        const created = []
        if (parent.container && typeof parent.container === 'object') {
          const keys = Object.keys(parent.container)
          const lastKey = keys[keys.length - 1]
          if (lastKey !== undefined && parent.container[lastKey] === null) {
            parent.container[lastKey] = created
            stack.push({ indent: indent, container: created, kind: 'list', owner: parent.container, key: lastKey })
          } else {
            throw new Error('第 ' + (i + 1) + ' 行：列表项缺少所属的键')
          }
        }
      }
      const list = top().container
      const itemText = content.replace(/^-\s*/, '')
      if (!itemText) {
        const created = {}
        list.push(created)
        stack.push({ indent: indent, container: created, kind: 'map' })
        continue
      }
      const keyMatch = /^([^:]+):\s*(.*)$/.exec(itemText)
      if (keyMatch) {
        const created = {}
        created[yamlUnquote(keyMatch[1].trim())] = keyMatch[2].trim() === '' ? null : yamlScalar(keyMatch[2])
        list.push(created)
        stack.push({ indent: indent, container: created, kind: 'map' })
        continue
      }
      list.push(yamlScalar(itemText))
      continue
    }

    const pairMatch = /^([^:]+):\s*(.*)$/.exec(content)
    if (!pairMatch) throw new Error('第 ' + (i + 1) + ' 行：既不是 "key: value" 也不是列表项：' + content.trim())
    const key = yamlUnquote(pairMatch[1].trim())
    const rest = pairMatch[2].trim()
    const container = top().container
    if (Array.isArray(container)) throw new Error('第 ' + (i + 1) + ' 行：列表里直接写键值对，请改用 "- key: value"')
    container[key] = rest === '' ? null : yamlScalar(rest)
  }
  return root
}

function yamlQuoteIfNeeded(text) {
  const value = String(text)
  if (value === '') return '""'
  if (/^[\s]|[\s]$/.test(value)) return JSON.stringify(value)
  if (/^(true|false|null|~|-?\d+(?:\.\d+)?)$/i.test(value)) return JSON.stringify(value)
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value)) return JSON.stringify(value)
  return value
}

/** JS 值 → YAML 文本。 */
function yamlEmit(value, indent) {
  const pad = new Array((indent || 0) + 1).join('  ')
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return yamlQuoteIfNeeded(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value
      .map(function (item) {
        if (item && typeof item === 'object') {
          const nested = yamlEmit(item, (indent || 0) + 1)
          return pad + '- ' + nested.replace(/^\s+/, '')
        }
        return pad + '- ' + yamlEmit(item, 0)
      })
      .join('\n')
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    return keys
      .map(function (key) {
        const item = value[key]
        if (item && typeof item === 'object') {
          return pad + yamlQuoteIfNeeded(key) + ':\n' + yamlEmit(item, (indent || 0) + 1)
        }
        return pad + yamlQuoteIfNeeded(key) + ': ' + yamlEmit(item, 0)
      })
      .join('\n')
  }
  return String(value)
}

function toolYamlPane(props) {
  const value = props.value || {}
  function toJson() {
    const text = String(value.input || '')
    if (!text.trim()) {
      props.patch({ output: '', error: '请先输入 YAML 文本' })
      return
    }
    try {
      props.patch({ output: JSON.stringify(yamlParse(text), null, 2), error: '' })
    } catch (error) {
      props.patch({ output: '', error: String((error && error.message) || error) })
    }
  }
  function toYaml() {
    const text = String(value.input || '')
    if (!text.trim()) {
      props.patch({ output: '', error: '请先输入 JSON 文本' })
      return
    }
    try {
      props.patch({ output: yamlEmit(JSON.parse(text), 0), error: '' })
    } catch (error) {
      props.patch({ output: '', error: 'JSON 解析失败：' + String((error && error.message) || error) })
    }
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(Field, { label: '输入（YAML 或 JSON）' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(210),
        placeholder: 'name: dev-workbench\ntags:\n  - offline\n  - browser',
        onChange: function (event) {
          props.patch({ input: event.target.value })
        },
      })),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
          h(Btn, { size: 'sm', kind: 'primary', icon: 'arrowRight', onClick: toJson, children: 'YAML → JSON' }),
          h(Btn, { size: 'sm', icon: 'arrowRight', onClick: toYaml, children: 'JSON → YAML' }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(toolErrorBlock, { text: value.error }),
        h(toolOutputBlock, { text: value.output, placeholder: '转换结果（YAML 仅支持常用子集）' }),
      ),
    ),
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } },
      '仅支持常用子集：缩进映射、"- " 列表、标量、注释、行内 [..] / {..}。' +
        '锚点（&/*）、别名、自定义标签、块标量（| / >）会明确报错而不是猜。',
    ),
  )
}

/* ------------------------------------------------------------------- CSV */

function csvParse(text) {
  const source = String(text).replace(/\r\n?/g, '\n')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(function (cells) {
    return cells.length > 1 || (cells[0] || '').trim().length > 0
  })
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function csvInfer(text) {
  const raw = String(text).trim()
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true'
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw)
  if (raw.length === 0) return ''
  return text
}

function toolCsvPane(props) {
  const value = props.value || {}
  const hasHeader = value.header !== false

  function toJson() {
    const text = String(value.input || '')
    if (!text.trim()) {
      props.patch({ output: '', error: '请先输入 CSV 文本' })
      return
    }
    try {
      const rows = csvParse(text)
      if (rows.length === 0) {
        props.patch({ output: '', error: '没有解析到任何数据行' })
        return
      }
      const width = rows.reduce(function (max, cells) {
        return Math.max(max, cells.length)
      }, 0)
      const start = hasHeader ? 1 : 0
      const headers = hasHeader
        ? rows[0].map(function (cell, index) {
            const name = String(cell || '').trim()
            return name || 'c' + (index + 1)
          })
        : new Array(width).fill(0).map(function (_, index) {
            return 'c' + (index + 1)
          })
      const output = rows.slice(start).map(function (cells) {
        const item = {}
        headers.forEach(function (header, index) {
          item[header] = csvInfer(cells[index] === undefined ? '' : cells[index])
        })
        return item
      })
      props.patch({
        output: JSON.stringify(output, null, 2),
        error: '',
        note: (hasHeader ? '含表头' : '无表头') + ' · ' + output.length + ' 行 × ' + headers.length + ' 列',
      })
    } catch (error) {
      props.patch({ output: '', error: String((error && error.message) || error) })
    }
  }

  function toCsv() {
    const text = String(value.input || '')
    if (!text.trim()) {
      props.patch({ output: '', error: '请先输入 JSON 数组' })
      return
    }
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('顶层必须是数组（形如 [{...}, {...}]）')
      const keys = []
      parsed.forEach(function (item) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          Object.keys(item).forEach(function (key) {
            if (keys.indexOf(key) < 0) keys.push(key)
          })
        }
      })
      if (keys.length === 0) throw new Error('数组里没有可导出的对象字段')
      const lines = []
      if (hasHeader) lines.push(keys.map(csvCell).join(','))
      parsed.forEach(function (item) {
        lines.push(
          keys
            .map(function (key) {
              const cell = item && typeof item === 'object' ? item[key] : ''
              return csvCell(cell === null || cell === undefined ? '' : cell)
            })
            .join(','),
        )
      })
      props.patch({ output: lines.join('\n'), error: '', note: parsed.length + ' 行 × ' + keys.length + ' 列' })
    } catch (error) {
      props.patch({ output: '', error: 'JSON 解析失败：' + String((error && error.message) || error) })
    }
  }

  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(Field, { label: '输入（CSV 或 JSON 数组）' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(210),
        placeholder: 'name,qps\n网关,2000\n报表,800',
        onChange: function (event) {
          props.patch({ input: event.target.value })
        },
      })),
      h(
        'div',
        { className: 'wb-stack', style: { gap: 8 } },
        h(
          'div',
          { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
          h(Btn, { size: 'sm', kind: 'primary', icon: 'arrowRight', onClick: toJson, children: 'CSV → JSON' }),
          h(Btn, { size: 'sm', icon: 'arrowRight', onClick: toCsv, children: 'JSON → CSV' }),
          h('div', { className: 'wb-spacer' }),
          h(toolCopyButton, { text: value.output }),
        ),
        h(Toggle, {
          checked: hasHeader,
          label: '首行是表头',
          onChange: function (next) {
            props.patch({ header: next })
          },
        }),
        h(toolErrorBlock, { text: value.error }),
        value.note ? h('div', { className: 'wb-tiny wb-muted' }, value.note) : null,
        h(toolOutputBlock, { text: value.output, placeholder: '转换结果' }),
      ),
    ),
  )
}

/* -------------------------------------------------------------- Markdown */

function mdInline(text, keyPrefix) {
  const nodes = []
  let rest = String(text)
  let key = 0
  const push = function (node) {
    nodes.push(h(React.Fragment, { key: keyPrefix + '-' + key++ }, node))
  }
  while (rest.length > 0) {
    let match = /^\*\*([^*]+)\*\*/.exec(rest)
    if (match) {
      push(h('strong', null, match[1]))
      rest = rest.slice(match[0].length)
      continue
    }
    match = /^`([^`]+)`/.exec(rest)
    if (match) {
      push(h('code', { style: { background: T.layer2, borderRadius: 4, padding: '1px 4px', fontFamily: T.font.mono, fontSize: 11.5 } }, match[1]))
      rest = rest.slice(match[0].length)
      continue
    }
    match = /^\*([^*]+)\*/.exec(rest)
    if (match) {
      push(h('em', null, match[1]))
      rest = rest.slice(match[0].length)
      continue
    }
    match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)
    if (match) {
      push(
        h(
          'a',
          { href: /^https?:\/\//i.test(match[2]) ? match[2] : '#', target: '_blank', rel: 'noreferrer noopener', className: 'wb-link' },
          match[1],
        ),
      )
      rest = rest.slice(match[0].length)
      continue
    }
    // 普通字符：吃到下一个可能的标记
    const nextMark = rest.slice(1).search(/[\*`\[]/)
    const take = nextMark < 0 ? rest.length : nextMark + 1
    push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  return nodes
}

function mdParse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (/^\s*$/.test(line)) {
      index += 1
      continue
    }
    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      const code = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', lang: fence[1], text: code.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: quote.join(' ') })
      continue
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items = []
      while (index < lines.length && (/^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+\.\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered: ordered, items: items })
      continue
    }
    const paragraph = []
    while (
      index < lines.length &&
      !/^\s*$/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

function toolMarkdownPane(props) {
  const value = props.value || {}
  const blocks = mdParse(String(value.input || ''))
  const headingSize = function (level) {
    return [22, 19, 17, 15, 14, 13.5][Math.min(5, level - 1)]
  }
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-split' },
      h(Field, { label: 'Markdown 输入' }, h(Textarea, {
        value: value.input || '',
        style: toolMonoStyle(240),
        placeholder: '# 标题\n\n**加粗** 与 `代码`\n\n- 列表项',
        onChange: function (event) {
          props.patch({ input: event.target.value })
        },
      })),
      h(
        Field,
        { label: '预览' },
        h(
          'div',
          {
            style: {
              minHeight: 240,
              maxHeight: 420,
              overflow: 'auto',
              padding: '12px 14px',
              border: '1px solid ' + T.border1,
              borderRadius: 10,
              background: T.bg,
              fontSize: 12.5,
              lineHeight: 1.7,
            },
          },
          blocks.length === 0
            ? h('span', { className: 'wb-tiny wb-muted' }, '输入 Markdown 后这里显示渲染结果')
            : blocks.map(function (block, blockIndex) {
                const key = 'b' + blockIndex
                if (block.type === 'heading') {
                  return h(
                    'div',
                    {
                      key: key,
                      style: {
                        fontSize: headingSize(block.level),
                        fontWeight: 600,
                        margin: blockIndex === 0 ? '0 0 8px' : '14px 0 6px',
                        color: T.text,
                      },
                    },
                    mdInline(block.text, key),
                  )
                }
                if (block.type === 'code') {
                  return h('pre', { key: key, className: 'wb-code', style: { margin: '8px 0' } }, block.text)
                }
                if (block.type === 'hr') {
                  return h('hr', { key: key, className: 'wb-divider', style: { margin: '12px 0' } })
                }
                if (block.type === 'quote') {
                  return h(
                    'blockquote',
                    {
                      key: key,
                      style: {
                        margin: '8px 0',
                        padding: '2px 0 2px 10px',
                        borderLeft: '3px solid ' + T.border2,
                        color: T.text2,
                      },
                    },
                    mdInline(block.text, key),
                  )
                }
                if (block.type === 'list') {
                  const listTag = block.ordered ? 'ol' : 'ul'
                  return h(
                    listTag,
                    { key: key, style: { margin: '8px 0', paddingLeft: 22 } },
                    block.items.map(function (item, itemIndex) {
                      return h('li', { key: key + '-' + itemIndex, style: { margin: '2px 0' } }, mdInline(item, key + '-' + itemIndex))
                    }),
                  )
                }
                return h('p', { key: key, style: { margin: '8px 0' } }, mdInline(block.text, key))
              }),
        ),
      ),
    ),
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } },
      '支持标题、粗体/斜体、行内代码、代码块、列表、引用、链接、分割线。' +
        '预览用 React 元素构造而非 innerHTML，输入里的 HTML 标签会当作纯文本显示。',
    ),
  )
}

/* ------------------------------------------------------------ HTTP 状态码 */

const httpStatusTable = [
  { code: 100, group: '1xx', title: 'Continue', meaning: '服务器已收到请求头，等待请求体', cause: '大请求体的两阶段提交', fix: '客户端继续发送 body' },
  { code: 101, group: '1xx', title: 'Switching Protocols', meaning: '协议切换', cause: 'WebSocket / h2c 升级', fix: '客户端按 Upgrade 响应切换协议' },
  { code: 200, group: '2xx', title: 'OK', meaning: '请求成功', cause: '正常响应', fix: '—' },
  { code: 201, group: '2xx', title: 'Created', meaning: '资源创建成功', cause: 'POST 创建资源', fix: '检查 Location 头' },
  { code: 204, group: '2xx', title: 'No Content', meaning: '成功但无响应体', cause: '删除 / 更新无需回包', fix: '不要尝试解析 body' },
  { code: 206, group: '2xx', title: 'Partial Content', meaning: '部分内容', cause: 'Range 断点续传', fix: '检查 Content-Range' },
  { code: 301, group: '3xx', title: 'Moved Permanently', meaning: '永久重定向', cause: '域名或路径永久变更', fix: '更新客户端地址；注意 POST 会变 GET' },
  { code: 302, group: '3xx', title: 'Found', meaning: '临时重定向', cause: '登录跳转、灰度跳转', fix: '确认跳转目标是否正常' },
  { code: 304, group: '3xx', title: 'Not Modified', meaning: '缓存仍有效', cause: '命中 If-None-Match / If-Modified-Since', fix: '使用本地缓存，属正常' },
  { code: 307, group: '3xx', title: 'Temporary Redirect', meaning: '临时重定向且保持方法', cause: '需要保持 POST 的重定向', fix: '跟随 Location，方法不变' },
  { code: 308, group: '3xx', title: 'Permanent Redirect', meaning: '永久重定向且保持方法', cause: '接口永久迁移', fix: '更新调用地址' },
  { code: 400, group: '4xx', title: 'Bad Request', meaning: '请求语法或参数不合法', cause: 'JSON 解析失败、缺必填参数、类型不符', fix: '校验请求体与 Content-Type' },
  { code: 401, group: '4xx', title: 'Unauthorized', meaning: '未认证或凭据无效', cause: 'Token 过期、未带 Authorization', fix: '重新登录或刷新 Token' },
  { code: 403, group: '4xx', title: 'Forbidden', meaning: '已认证但无权限', cause: '角色/ACL 不足、IP 白名单', fix: '检查授权范围而非重新登录' },
  { code: 404, group: '4xx', title: 'Not Found', meaning: '资源不存在', cause: '路径拼错、资源已删、网关路由缺失', fix: '核对路径与资源 ID' },
  { code: 405, group: '4xx', title: 'Method Not Allowed', meaning: '方法不允许', cause: '用 GET 调了只支持 POST 的接口', fix: '查看 Allow 响应头' },
  { code: 406, group: '4xx', title: 'Not Acceptable', meaning: '无法满足 Accept', cause: '只支持 application/json 却要 XML', fix: '调整 Accept 头' },
  { code: 408, group: '4xx', title: 'Request Timeout', meaning: '请求超时', cause: '客户端发送过慢、连接被中断', fix: '排查网络与超时配置' },
  { code: 409, group: '4xx', title: 'Conflict', meaning: '资源状态冲突', cause: '并发写、唯一键冲突、版本号不匹配', fix: '加乐观锁或重试' },
  { code: 410, group: '4xx', title: 'Gone', meaning: '资源已永久移除', cause: '接口下线', fix: '改用新接口' },
  { code: 413, group: '4xx', title: 'Payload Too Large', meaning: '请求体过大', cause: '上传文件超限、网关 body 限制', fix: '调大 limit 或分片上传' },
  { code: 414, group: '4xx', title: 'URI Too Long', meaning: 'URI 过长', cause: 'GET 参数过多', fix: '改 POST 或缩短参数' },
  { code: 415, group: '4xx', title: 'Unsupported Media Type', meaning: '媒体类型不支持', cause: '漏了 Content-Type: application/json', fix: '补上正确的 Content-Type' },
  { code: 418, group: '4xx', title: "I'm a teapot", meaning: '彩蛋状态码', cause: '约定俗成的玩笑', fix: '—' },
  { code: 422, group: '4xx', title: 'Unprocessable Entity', meaning: '语义校验失败', cause: '字段格式对但业务规则不通过', fix: '读响应里的字段级错误' },
  { code: 429, group: '4xx', title: 'Too Many Requests', meaning: '触发限流', cause: 'QPS 超限、配额用尽', fix: '退避重试；看 Retry-After' },
  { code: 500, group: '5xx', title: 'Internal Server Error', meaning: '服务端未捕获异常', cause: '代码抛错、依赖超时未兜底', fix: '查服务端日志与堆栈' },
  { code: 501, group: '5xx', title: 'Not Implemented', meaning: '未实现', cause: '方法不支持', fix: '换方法或升级服务' },
  { code: 502, group: '5xx', title: 'Bad Gateway', meaning: '网关收到上游非法响应', cause: '上游崩溃、上游返回非 HTTP、端口不通', fix: '查上游服务健康与网关日志' },
  { code: 503, group: '5xx', title: 'Service Unavailable', meaning: '服务暂不可用', cause: '实例全部下线、过载保护、发布中', fix: '检查实例与容量' },
  { code: 504, group: '5xx', title: 'Gateway Timeout', meaning: '网关等待上游超时', cause: '上游慢查询、连接池耗尽', fix: '排查上游耗时与超时配置' },
  { code: 505, group: '5xx', title: 'HTTP Version Not Supported', meaning: 'HTTP 版本不支持', cause: '客户端用了过新/过旧协议', fix: '调整协议版本' },
  { code: 507, group: '5xx', title: 'Insufficient Storage', meaning: '存储空间不足', cause: '磁盘写满、配额耗尽', fix: '清理磁盘或扩容' },
  { code: 508, group: '5xx', title: 'Loop Detected', meaning: '检测到循环', cause: '重定向或代理配置成环', fix: '检查重写规则' },
]

function toolStatusPane(props) {
  const value = props.value || {}
  const group = value.group || 'all'
  const query = String(value.query || '').trim()
  const groups = ['all', '2xx', '3xx', '4xx', '5xx']
  const rows = httpStatusTable.filter(function (row) {
    if (group !== 'all' && row.group !== group) return false
    if (!query) return true
    return (
      String(row.code).indexOf(query) >= 0 ||
      row.title.toLowerCase().indexOf(query.toLowerCase()) >= 0 ||
      row.meaning.indexOf(query) >= 0
    )
  })
  return h(
    'div',
    { className: 'wb-stack', style: { gap: 12 } },
    h(
      'div',
      { className: 'wb-row wb-row--wrap', style: { gap: 6 } },
      groups.map(function (item) {
        return h(Chip, {
          key: item,
          active: group === item,
          onClick: function () {
            props.patch({ group: item })
          },
          children: item === 'all' ? '全部' : item,
        })
      }),
      h('div', { className: 'wb-spacer' }),
      h(Input, {
        value: value.query || '',
        placeholder: '按状态码 / 名称 / 含义过滤',
        style: { maxWidth: 240 },
        onChange: function (event) {
          props.patch({ query: event.target.value })
        },
      }),
    ),
    rows.length === 0
      ? h(Empty, { icon: 'info', title: '没有匹配的状态码', hint: '试试输入 404 或 4xx。' })
      : h(
          'table',
          { className: 'wb-table' },
          h(
            'thead',
            null,
            h('tr', null, h('th', null, '码'), h('th', null, '名称'), h('th', null, '含义'), h('th', null, '常见成因'), h('th', null, '排查方向')),
          ),
          h(
            'tbody',
            null,
            rows.map(function (row) {
              return h(
                'tr',
                { key: row.code },
                h('td', null, h(Badge, { tone: row.group === '2xx' ? 'ok' : row.group === '3xx' ? 'idle' : row.group === '4xx' ? 'warn' : 'err' }, String(row.code))),
                h('td', { className: 'wb-mono', style: { whiteSpace: 'nowrap' } }, row.title),
                h('td', null, row.meaning),
                h('td', { className: 'wb-muted' }, row.cause),
                h('td', { className: 'wb-muted' }, row.fix),
              )
            }),
          ),
        ),
    h(
      'p',
      { className: 'wb-tiny wb-muted', style: { margin: 0, lineHeight: 1.7 } },
      '内置 ' + httpStatusTable.length + ' 个常见状态码；这里是离线速查表，不发起任何请求。',
    ),
  )
}
