/* ============================================================================
 * dev-workbench host — plugin entry
 *
 * Two registrations, both owned by this plugin fiber:
 *   1. `workbench` service (ctx.provide) + its typert Remote descriptors, so
 *      the Client half can read and mutate state over the shared /api channel;
 *   2. the `workbench_*` Agent tools, so the model can read and write the same
 *      objects the pages show.
 *
 * A profile without `typert` or `tools` still loads the plugin: the service is
 * mounted, the missing capability is simply absent. That keeps state readable
 * (and recoverable) even when a profile composes fewer subsystems.
 * ========================================================================== */

export function apply(ctx, config) {
  workbenchCtx = ctx
  const settings = config && typeof config === 'object' ? config : {}

  ctx.provide('workbench', workbenchApi)

  ctx.inject(['typert'], function (host) {
    return host.typert.register(WORKBENCH_REMOTE)
  })

  ctx.inject(['tools'], function (host) {
    ctx.effect(function () {
      const definitions = workbenchToolDefinitions()
      const disposers = definitions.map(function (definition) {
        return host.tools.register(definition)
      })
      registerWorkbenchToolNames(
        definitions.map(function (definition) {
          return definition.name
        }),
      )
      return function () {
        registerWorkbenchToolNames([])
        disposers.forEach(function (dispose) {
          try {
            dispose()
          } catch (e) {
            /* already withdrawn by the owning context */
          }
        })
      }
    })
  })

  ctx.effect(function () {
    const state = loadWorkbenchState()
    if (ctx.logger && typeof ctx.logger.info === 'function') {
      ctx.logger.info(
        '[dev-workbench] ready: ' +
          workbenchStatePath() +
          ' · ' +
          ensureArray(state.tasks).length +
          ' task(s)' +
          (settings.verbose === true ? ' · verbose' : ''),
      )
    }
    return function () {
      workbenchCtx = null
    }
  })
}
