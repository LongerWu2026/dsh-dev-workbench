

/* ============================================================================
 * dev-workbench host — unified search orchestration
 *
 * Design report §3.3: several providers, each with its own capability and its
 * own failure mode; a single source failing must return partial results, and an
 * answer without sources must not be presented as fact.
 *
 * This module therefore returns GROUPS, not a flat list: every group carries
 * its own `status` (`ok` / `empty` / `unavailable` / `error`) and the reason, so
 * the UI can say "互联网这一路没查成" instead of silently showing fewer rows.
 * The plugin never summarises with a model here — that stays an Agent job, so
 * no search result is ever turned into an unsourced claim.
 * ========================================================================== */
const SEARCH_GROUP_LIMIT = 20;
export { SEARCH_GROUP_LIMIT }
