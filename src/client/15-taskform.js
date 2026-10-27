/* ============================================================================
 * dev-workbench shared task form
 *
 * One form for every entry point (toolbar quick-add, task center, dashboard,
 * focus view). The open state lives in the store as `taskForm`, so any module
 * can call `WB.openTaskForm(task)` without owning the dialog.
 *
 * Field rules come from the design report §3.2: a task keeps its source
 * evidence, and a due date / assignee produced by extraction is labelled as a
 * guess rather than presented as fact.
 * ========================================================================== */

const taskFormToLocalInput = WB.fmt.toLocalInput
const taskFormFromLocalInput = WB.fmt.fromLocalInput

function TaskFormHost() {
  const state = useStore()
  const request = state.taskForm
  const task = request && request.task ? request.task : null
  const defaults = request && request.defaults ? request.defaults : {}
  const data = state.data

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priority, setPriority] = React.useState('normal')
  const [status, setStatus] = React.useState('ready')
  const [dueInput, setDueInput] = React.useState('')
  const [projectId, setProjectId] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [assignee, setAssignee] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(
    function () {
      if (!request) return
      setTitle(task ? task.title : defaults.title || '')
      setDescription(task ? task.description || '' : defaults.description || '')
      setPriority(task ? task.priority || 'normal' : defaults.priority || 'normal')
      setStatus(task ? task.status || 'ready' : defaults.status || 'ready')
      setDueInput(taskFormToLocalInput(task ? task.dueAt : defaults.dueAt))
      setProjectId(task ? task.projectId || '' : defaults.projectId || '')
      setTags(task ? (task.tags || []).join(', ') : (defaults.tags || []).join(', '))
      setAssignee(task ? task.assignee || '' : defaults.assignee || '')
      setError(null)
      setBusy(false)
    },
    [request],
  )

  if (!request) return null

  function close() {
    wbStore.set({ taskForm: null })
  }

  function submit(event) {
    if (event) event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('标题不能为空')
      return
    }
    const payload = {
      title: trimmed,
      description: description.trim(),
      priority: priority,
      status: status,
      dueAt: taskFormFromLocalInput(dueInput),
      projectId: projectId || null,
      tags: tags
        .split(/[,，\s]+/)
        .map(function (tag) {
          return tag.trim()
        })
        .filter(Boolean),
      assignee: assignee.trim() || null,
    }
    setBusy(true)
    setError(null)
    const operation = task ? WB.actions.updateTask(task.id, payload) : WB.actions.createTask(payload)
    operation
      .then(function () {
        setBusy(false)
        close()
      })
      .catch(function (e) {
        setBusy(false)
        setError(String((e && e.message) || e))
      })
  }

  const projects = (data && data.projects) || []
  const projectOptions = [{ value: '', label: '未归属项目' }].concat(
    projects.map(function (project) {
      return { value: project.id, label: project.name }
    }),
  )

  const statusOptions = Object.keys(WB.TASK_STATUS).map(function (key) {
    return { value: key, label: WB.TASK_STATUS[key].label }
  })
  const priorityOptions = ['urgent', 'high', 'normal', 'low'].map(function (key) {
    return { value: key, label: WB.TASK_PRIORITY[key].label }
  })

  return h(
    Modal,
    {
      open: true,
      title: task ? '编辑待办' : '新建待办',
      sub: task ? task.title : '明确的事实与推测分开记录',
      onClose: close,
      width: 560,
      footer: h(
        React.Fragment,
        null,
        h(Btn, { onClick: close, children: '取消' }),
        h('div', { className: 'wb-spacer' }),
        h(Btn, {
          kind: 'primary',
          icon: 'check',
          disabled: busy,
          onClick: submit,
          children: busy ? '保存中…' : task ? '保存修改' : '创建待办',
        }),
      ),
    },
    h(
      'form',
      { onSubmit: submit, className: 'wb-stack', style: { gap: 12 } },
      h(Field, { label: '标题' }, h(Input, {
        value: title,
        autoFocus: true,
        placeholder: '例如：评审 @张三 提到的网关限流方案',
        onChange: function (event) {
          setTitle(event.target.value)
        },
      })),
      h(Field, { label: '描述', hint: '保留原始上下文，后续 Agent 读取的就是这段内容' }, h(Textarea, {
        value: description,
        placeholder: '背景、期望结果、相关链接…',
        onChange: function (event) {
          setDescription(event.target.value)
        },
      })),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        h(Field, { label: '状态' }, h(Select, {
          options: statusOptions,
          value: status,
          onChange: function (event) {
            setStatus(event.target.value)
          },
        })),
        h(Field, { label: '优先级' }, h(Select, {
          options: priorityOptions,
          value: priority,
          onChange: function (event) {
            setPriority(event.target.value)
          },
        })),
        h(Field, { label: '截止时间' }, h(Input, {
          type: 'datetime-local',
          value: dueInput,
          onChange: function (event) {
            setDueInput(event.target.value)
          },
        })),
        h(Field, { label: '项目' }, h(Select, {
          options: projectOptions,
          value: projectId,
          onChange: function (event) {
            setProjectId(event.target.value)
          },
        })),
        h(Field, { label: '标签', hint: '逗号或空格分隔' }, h(Input, {
          value: tags,
          placeholder: '后端, 限流',
          onChange: function (event) {
            setTags(event.target.value)
          },
        })),
        h(Field, { label: '负责人', hint: '抽取得到的负责人属于推测，需人工确认' }, h(Input, {
          value: assignee,
          placeholder: '留空表示未指派',
          onChange: function (event) {
            setAssignee(event.target.value)
          },
        })),
      ),
      task && task.aiExtracted
        ? h(
            'div',
            {
              style: {
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--dsw-alias-bg-layer-2)',
                fontSize: 11.5,
                color: T.text2,
              },
            },
            h(Icon, { name: 'sparkles', size: 13 }),
            h(
              'span',
              null,
              '这条待办由 AI 从消息中提取（置信度 ' +
                (task.confidence === null || task.confidence === undefined
                  ? '未评估'
                  : Math.round(task.confidence * 100) + '%') +
                '）。保存即确认，字段以你为准。',
            ),
          )
        : null,
      error ? h('div', { role: 'alert', style: { color: T.err, fontSize: 12 } }, error) : null,
      h('button', { type: 'submit', style: { display: 'none' } }),
    ),
  )
}

WB.TaskForm = TaskFormHost
WB.TaskFormHost = TaskFormHost
