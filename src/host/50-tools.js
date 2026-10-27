/* ============================================================================
 * dev-workbench host — Agent tools
 *
 * The workbench is only an "AI workbench" if the model can read and write the
 * same objects the UI shows. These five tools are the write-back path from
 * design report §4.4 (createTask / attachResult) expressed as ordinary DSH
 * tools: they mutate the same host state the pages read, so a result an agent
 * records appears in the task center on the next refresh.
 *
 * Every tool returns plain JSON plus a `text` field, so the model gets an
 * unambiguous result either way.
 * ========================================================================== */

function toolText(text) {
  return [{ type: 'text', text: text }]
}

function toolOutputSchema() {
  return {
    type: 'object',
    properties: {
      text: { type: 'string', description: '人类可读的结果摘要。' },
    },
    required: ['text'],
    additionalProperties: true,
  }
}

function renderToolText(args, value) {
  const text = value && typeof value.text === 'string' ? value.text : JSON.stringify(value)
  return toolText(text)
}

function taskLine(task) {
  const due = task.dueAt ? ' · 截止 ' + task.dueAt.slice(0, 16).replace('T', ' ') : ''
  const project = task.projectId ? ' · 项目 ' + task.projectId : ''
  return '- [' + task.status + '] ' + task.title + ' (id=' + task.id + ')' + due + project
}

function workbenchToolDefinitions() {
  return [
    {
      name: 'workbench_list_tasks',
      description:
        '列出开发者工作台里的待办。用它回答“我今天还有什么没做”“哪些任务逾期”“某项目的待办有哪些”。' +
        '默认只返回未完成（不是 completed/cancelled）的任务，按优先级与截止时间排序。' +
        '返回里的每个任务都带 id，需要修改时把该 id 传给 workbench_update_task。',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: TASK_STATUSES,
            description: '只看某个状态；省略表示所有未完成状态。',
          },
          includeCompleted: {
            type: 'boolean',
            description: '为 true 时连已完成与已取消一起返回（默认 false）。',
          },
          limit: {
            type: 'number',
            description: '最多返回多少条，默认 20，上限 100。',
          },
        },
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute(args) {
        const input = args && typeof args === 'object' ? args : {}
        const state = loadWorkbenchState()
        const limit = Math.max(1, Math.min(100, Number(input.limit) || 20))
        const tasks = ensureArray(state.tasks)
          .filter(function (task) {
            if (input.status) return task.status === input.status
            if (input.includeCompleted === true) return true
            return task.status !== 'completed' && task.status !== 'cancelled'
          })
          .sort(function (a, b) {
            const rank = { urgent: 4, high: 3, normal: 2, low: 1 }
            const priority = (rank[b.priority] || 0) - (rank[a.priority] || 0)
            if (priority !== 0) return priority
            const left = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
            const right = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
            return left - right
          })
          .slice(0, limit)
        if (tasks.length === 0) {
          return { text: '工作台当前没有匹配的待办。', count: 0 }
        }
        const header = '共 ' + tasks.length + ' 条待办：'
        return {
          text: header + '\n' + tasks.map(taskLine).join('\n'),
          count: tasks.length,
        }
      },
    },

    {
      name: 'workbench_create_task',
      description:
        '在开发者工作台新建一条待办。当用户说“记一下”“帮我建个待办”“把这个加进任务中心”时使用。' +
        '标题必填，其余字段可省略。不要把用户没有提到的截止时间或负责人编造出来：' +
        '不确定就留空，让用户在任务中心补。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '一句话说清要做的事。' },
          description: { type: 'string', description: '背景、期望结果、链接；保留原始上下文。' },
          priority: { type: 'string', enum: TASK_PRIORITIES, description: '默认 normal。' },
          dueAt: { type: 'string', description: 'ISO 8601 时间；用户没有明确期限时不要填。' },
          tags: { type: 'array', items: { type: 'string' }, description: '最多 12 个短标签。' },
          projectId: { type: 'string', description: '已存在的项目 id；不确定就省略。' },
        },
        required: ['title'],
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute(args) {
        const input = args && typeof args === 'object' ? args : {}
        if (!asString(input.title, 200)) throw new Error('title 不能为空')
        const state = mutateWorkbenchState(function (current) {
          const task = normalizeTask(input, null)
          current.tasks = ensureArray(current.tasks).concat([task])
          auditEntry(current, 'task.created', task.title + '（来自 Agent 工具）')
          return current
        })
        const created = state.tasks[state.tasks.length - 1]
        return {
          text: '已创建待办：' + created.title + ' (id=' + created.id + '，状态 ' + created.status + ')',
          taskId: created.id,
        }
      },
    },

    {
      name: 'workbench_update_task',
      description:
        '修改开发者工作台里的一条待办：状态、优先级、截止时间、标题或描述。需要 id —— 先用 ' +
        'workbench_list_tasks 拿到。用户说“这个做完了”就把 status 设为 completed。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '待办 id。' },
          status: { type: 'string', enum: TASK_STATUSES },
          priority: { type: 'string', enum: TASK_PRIORITIES },
          dueAt: { type: 'string', description: 'ISO 8601；传空字符串表示清除截止时间。' },
          title: { type: 'string' },
          description: { type: 'string' },
          assignee: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute(args) {
        const input = args && typeof args === 'object' ? args : {}
        if (!asString(input.id, 100)) throw new Error('id 不能为空')
        const patch = Object.assign({}, input)
        delete patch.id
        if (patch.dueAt === '') patch.dueAt = null
        const state = mutateWorkbenchState(function (current) {
          const index = ensureArray(current.tasks).findIndex(function (task) {
            return task.id === input.id
          })
          if (index < 0) throw new Error('找不到该待办：' + input.id)
          const next = normalizeTask(patch, current.tasks[index])
          next.id = current.tasks[index].id
          next.createdAt = current.tasks[index].createdAt
          current.tasks = current.tasks.slice()
          current.tasks[index] = next
          auditEntry(current, 'task.updated', next.title + ' → ' + next.status + '（来自 Agent 工具）')
          return current
        })
        const updated = state.tasks.find(function (task) {
          return task.id === input.id
        })
        return { text: '已更新：' + taskLine(updated), taskId: input.id }
      },
    },

    {
      name: 'workbench_record_run',
      description:
        '把一次 Agent 执行的结果登记到开发者工作台的 Agent 中心，并在任务详情里留下执行记录。' +
        '分析、诊断、代码审查这类工作完成后调用，让用户能在 UI 里回看结论与证据。' +
        'evidence 里每条都要是可以回跳的来源（文件、URL 或报告章节）。',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '关联的待办 id；纯探索可以不填。' },
          status: {
            type: 'string',
            enum: RUN_STATUSES,
            description: '本次执行的最终状态，通常是 completed 或 failed。',
          },
          summary: { type: 'string', description: '一到三句话说明做了什么、结论是什么。' },
          profile: { type: 'string', description: '逻辑 Agent 角色，如 Coding Agent / Research Agent。' },
          sessionId: { type: 'string', description: '关联会话 id，便于回跳。' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, url: { type: 'string' } },
              required: ['label'],
            },
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text'],
            },
          },
        },
        required: ['status', 'summary'],
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute(args, exec) {
        const input = args && typeof args === 'object' ? args : {}
        const payload = Object.assign({}, input)
        if (!payload.sessionId && exec && exec.agent && exec.agent.session && exec.agent.session.id) {
          payload.sessionId = String(exec.agent.session.id)
        }
        const state = mutateWorkbenchState(function (current) {
          const run = normalizeRun(payload, null)
          if (run.taskId && !ensureArray(current.tasks).some(function (task) {
            return task.id === run.taskId
          })) {
            throw new Error('关联的待办不存在：' + run.taskId)
          }
          current.runs = ensureArray(current.runs).concat([run])
          if (run.taskId) {
            current.tasks = ensureArray(current.tasks).map(function (task) {
              if (task.id !== run.taskId) return task
              const next = Object.assign({}, task)
              next.runIds = ensureArray(task.runIds).concat([run.id])
              next.updatedAt = hostNowIso()
              if (run.status === 'failed') next.status = 'failed'
              return next
            })
          }
          auditEntry(current, 'agent.run.created', run.summary || run.id)
          return current
        })
        const run = state.runs[state.runs.length - 1]
        return { text: '已登记执行记录 ' + run.id + '（' + run.status + '）：' + run.summary, runId: run.id }
      },
    },

    {
      name: 'workbench_fetch_radar',
      description:
        '按用户在「连接与设置 → 资讯源」里配置的 RSS/Atom 地址抓取技术雷达增量。' +
        '用户说“抓一下最新的技术资讯”“刷新雷达”，或用户设置了每日提醒让你更新雷达时调用。' +
        '返回每个源的抓取结果（新增/跳过/失败原因）；没有配置资讯源时如实说明，不要编造结果。' +
        '这个工具只采集原始条目和原文摘录，不生成 AI 摘要——如需摘要，读完原文后自己归纳，' +
        '把结论用 workbench_record_run 写回，并附来源链接。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute() {
        const state = await runRadarFetch(workbenchCtx)
        const report = state.lastRadarFetch || {}
        if (!report.perFeed || report.perFeed.length === 0) {
          return { text: '技术雷达：' + (report.note || '没有可用的抓取结果。') }
        }
        const lines = report.perFeed.map(function (row) {
          return (
            '- ' +
            row.label +
            '：' +
            (row.status === 'ok'
              ? '新增 ' + row.added + ' 条，跳过 ' + row.skipped + ' 条'
              : row.status + (row.note ? '（' + row.note + '）' : ''))
          )
        })
        return {
          text:
            '技术雷达抓取完成：新增 ' + (report.added || 0) + ' 条，跳过 ' + (report.skipped || 0) + ' 条。\n' +
            lines.join('\n') +
            '\n可在工作台的「今日简报 → 技术雷达」查看。',
        }
      },
    },

    {
      name: 'workbench_fetch_mentions',
      description:
        '通过云之家 CLI（yzj-cli）拉取 @我 的消息，作为待办来源证据存入工作台。' +
        '用户说“看看有没有人@我”“拉一下@我的消息”时调用。' +
        '只做确定性采集：把消息原文、所在群、时间存为来源（SourceRef），不自动创建待办——' +
        '是否生成待办、标题和截止时间怎么定，由你在会话里分析后决定（可用 workbench_create_task 并带 sourceRef）' +
        '或交回用户。云之家未配置或 token 失效时如实报告，不要编造。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute() {
        const state = await mutateWorkbenchState(function (current) {
          return fetchYunzhijiaMentionsInto(workbenchCtx, current)
        })
        const report = state.lastMentionsFetch || {}
        if (report.status !== 'ok') {
          return { text: '@我 拉取未完成：' + (report.note || report.status) }
        }
        const lines = []
        for (const source of ensureArray(state.sources).slice(-Math.max(report.added, 0))) {
          if (source.provider !== 'yunzhijia') continue
          lines.push('- [' + source.title + '] ' + source.excerpt.slice(0, 80))
        }
        return {
          text:
            '云之家 @我 检索完成：发现 ' + (report.found || 0) + ' 条，新增来源 ' + (report.added || 0) + ' 条。' +
            (report.note ? '\n' + report.note : '') +
            (lines.length > 0 ? '\n新增：\n' + lines.join('\n') : '\n没有新增（此前已采集过）。') +
            '\n要分析这些消息时，用 workbench_task_brief 或直接读来源证据。',
        }
      },
    },

    {
      name: 'workbench_task_brief',
      description:
        '把一条待办连同它的来源证据渲染成可直接用作提示词的任务简报。' +
        '需要上下文（背景、来源、期望产出）时先调用它，再开始分析。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '待办 id。' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: toolOutputSchema(), render: renderToolText },
      async execute(args) {
        const input = args && typeof args === 'object' ? args : {}
        const state = loadWorkbenchState()
        const task = ensureArray(state.tasks).find(function (item) {
          return item.id === input.id
        })
        if (!task) throw new Error('找不到该待办：' + String(input.id))
        const source = task.sourceRefId
          ? ensureArray(state.sources).find(function (item) {
              return item.id === task.sourceRefId
            })
          : null
        return { text: taskBrief(task, source) }
      },
    },
  ]
}
