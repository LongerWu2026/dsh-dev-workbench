#!/usr/bin/env node

// src/cli/harness-linky.ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync as existsSync2, readFileSync as readFileSync2, realpathSync } from "node:fs";
import { relative, isAbsolute as isAbsolute3, join as join3 } from "node:path";
import { randomUUID as randomUUID2 } from "node:crypto";

// src/host/storage/development-store.ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync as readdirSync2 } from "node:fs";
import { join as join2, resolve, isAbsolute as isAbsolute2 } from "node:path";
import { homedir as homedir2 } from "node:os";
import { randomUUID } from "node:crypto";

// src/shared/development.ts
function checkedArgv(value) {
  if (!Array.isArray(value) || !value.length || value.length > 80 || value.some((item) => typeof item !== "string" || !item || item.includes("\0") || item.length > 4096)) throw new Error("命令必须是非空的 JSON 参数数组");
  return value.slice();
}

// src/host/storage/development-environment.ts
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute, delimiter } from "node:path";
function discoverLinky(options = {}) {
  const home = options.home ?? homedir(), platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
  const name = platform === "win32" ? "linky.exe" : "linky", apps = options.applications ?? ["/Applications", join(home, "Applications")];
  const candidates = [
    join(home, ".local", "bin", name),
    join(home, ".linky", "bin", name),
    ...(options.path ?? process.env.PATH ?? "").split(delimiter).filter(isAbsolute).map((dir) => join(dir, name)),
    ...platform === "darwin" ? apps.map((dir) => join(dir, "Linky.app", "Contents", "Resources", "bin", "darwin", arch === "arm64" ? "arm64" : "amd64", "linky")) : [],
    ...platform === "win32" ? [join(home, "AppData", "Local", "Linky", "cli", "bin", name)] : []
  ];
  const cliPaths = [...new Set(candidates)].filter(executable);
  let profiles = [];
  try {
    profiles = readdirSync(join(home, ".linky", "profiles"), { withFileTypes: true }).filter((d) => d.isDirectory() && /^[\w.-]{1,120}$/.test(d.name)).map((d) => d.name);
  } catch {
  }
  const profile = profiles.includes("desktop-linky.kingdee.com") ? "desktop-linky.kingdee.com" : profiles.length === 1 ? profiles[0] : "default";
  return { cliPaths, profiles, profile };
}
function executable(path) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// src/host/storage/development-store.ts
function developmentDir() {
  return join2(process.env.DSH_HOME || join2(homedir2(), ".dsh"), "storages", "dev-workbench", "development");
}
function developmentConfigPath() {
  return join2(developmentDir(), "config.json");
}
function installedHarnessCommand() {
  const base = join2(homedir2(), ".nvm", "versions", "node");
  if (existsSync(base)) for (const version of readdirSync2(base).sort((a, b) => b.localeCompare(a, void 0, { numeric: true })).slice(0, 20)) {
    const node = join2(base, version, "bin", "node"), cli = join2(base, version, "lib", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
    if (existsSync(node) && existsSync(cli)) return [node, "--expose-internals", cli, "--profile", "acp"];
  }
  return ["dsh", "--profile", "acp"];
}
function writeDevelopmentFile(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 448 });
  const tmp = path + "." + randomUUID() + ".tmp";
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 384 });
  renameSync(tmp, path);
}
function readDevelopmentConfig() {
  const found = discoverLinky();
  const defaults = {
    cliPath: found.cliPaths[0] || join2(homedir2(), ".local", "bin", "linky"),
    profile: found.profile,
    workspaceId: "",
    worktreeRoot: join2(homedir2(), "HarnessWorkspaces"),
    harnessCommand: installedHarnessCommand(),
    model: "deepseek-v4-flash",
    adapterRoots: [],
    checks: {},
    adapterPermissionMode: "read-only",
    agentId: ""
  };
  if (!existsSync(developmentConfigPath())) return defaults;
  return { ...defaults, ...JSON.parse(readFileSync(developmentConfigPath(), "utf8")) };
}

// src/cli/harness-linky.ts
var config = process.env.HARNESS_LINKY_CONFIG ? JSON.parse(readFileSync2(process.env.HARNESS_LINKY_CONFIG, "utf8")) : readDevelopmentConfig();
var model = String(config.model || "deepseek-v4-flash");
var modelRow = { id: model, slug: model, model, name: "Harness · " + model, display_name: "Harness · " + model, displayName: "Harness · " + model, is_default: true, isDefault: true, hide: false, hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }], defaultReasoningEffort: "high" };
var send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
var event = (method, params) => send({ method, params });
var threads = /* @__PURE__ */ new Map();
var turns = /* @__PURE__ */ new Map();
var acp;
var initializing;
var counter = 0;
var closing = false;
var pending = /* @__PURE__ */ new Map();
var runId = /^[\w-]{1,120}$/.test(process.env.LINKY_TASK_ID || "") ? process.env.LINKY_TASK_ID : randomUUID2();
var record = { id: runId, issueId: process.env.LINKY_ISSUE_ID || "", issueCode: process.env.LINKY_ISSUE_CODE || "", workspaceId: process.env.LINKY_WORKSPACE_ID || "", profile: config.profile || "", taskId: process.env.LINKY_TASK_ID || "", engine: "Harness", status: "starting", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
function persist() {
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  writeDevelopmentFile(join3(developmentDir(), "native-runs", runId + ".json"), record);
}
function write(value) {
  if (!acp?.stdin.writable) throw new Error("Harness ACP disconnected");
  acp.stdin.write(JSON.stringify(value) + "\n");
}
function call(method, params, timeout = 3e4) {
  const id = ++counter;
  return new Promise((resolve2, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Harness ACP timeout: " + method));
    }, timeout);
    pending.set(id, { resolve: resolve2, reject, timer });
    try {
      write({ jsonrpc: "2.0", id, method, params });
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}
function rejectAll() {
  for (const waiter of pending.values()) {
    clearTimeout(waiter.timer);
    waiter.reject(new Error("Harness ACP disconnected"));
  }
  pending.clear();
}
function update(params) {
  const sid = params.sessionId, row = turns.get(sid);
  if (!row) return;
  const u = params.update || {}, kind = u.sessionUpdate;
  if (kind === "agent_message_chunk" && u.content?.type === "text") {
    row.text += u.content.text || "";
    if (row.text.length > 512 * 1024) {
      row.text = row.text.slice(0, 512 * 1024);
      void shutdown("输出超出512KB上限");
    }
  }
  if (kind === "tool_call") row.tools.set(u.toolCallId, u);
  if (kind === "tool_call" || kind === "tool_call_update") {
    const original = row.tools.get(u.toolCallId), bash = original?.title === "bash";
    if (bash && (kind === "tool_call" || ["completed", "failed"].includes(u.status))) {
      const item = { id: u.toolCallId, type: "commandExecution", command: original.rawInput?.command || "", status: kind === "tool_call" ? "inProgress" : u.status, aggregatedOutput: (u.content || []).filter((c) => c.type === "content").map((c) => c.content?.text || "").join("\n").slice(-64e3) };
      event(kind === "tool_call" ? "item/started" : "item/completed", { threadId: sid, turnId: row.id, item });
    }
  }
}
async function ensureACP() {
  if (initializing) return initializing;
  initializing = (async () => {
    const argv = checkedArgv(config.harnessCommand), env = { ...process.env, DSH_PERMISSION_MODE: config.adapterPermissionMode === "workspace-write" ? "workspace-write" : "read-only" };
    acp = spawn(argv[0], argv.slice(1), { stdio: ["pipe", "pipe", "pipe"], env, detached: process.platform !== "win32" });
    acp.on("error", rejectAll);
    acp.on("exit", rejectAll);
    acp.stderr.resume();
    const reader = createInterface({ input: acp.stdout });
    reader.on("line", (line) => {
      let packet;
      try {
        packet = JSON.parse(line);
      } catch {
        return;
      }
      if (packet.id != null && !packet.method) {
        const waiter = pending.get(packet.id);
        if (waiter) {
          clearTimeout(waiter.timer);
          pending.delete(packet.id);
          packet.error ? waiter.reject(new Error("Harness ACP request failed")) : waiter.resolve(packet.result);
        }
      } else if (packet.method === "session/update") update(packet.params || {});
      else if (packet.id != null) {
        const reject = packet.params?.options?.find((o) => o.kind === "reject_once");
        if (packet.method === "session/request_permission" && reject) write({ jsonrpc: "2.0", id: packet.id, result: { outcome: { outcome: "selected", optionId: reject.optionId } } });
        else write({ jsonrpc: "2.0", id: packet.id, error: { code: -32601, message: "Unsupported ACP client action" } });
      }
    });
    await call("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "harness-linky", version: "0.1.0" } });
  })();
  return initializing;
}
function allowedCwd(value) {
  if (typeof value !== "string" || !isAbsolute3(value) || !existsSync2(value)) throw new Error("An existing absolute cwd is required");
  const cwd = realpathSync(value), roots = [config.worktreeRoot, ...config.adapterRoots || []].filter((p) => typeof p === "string" && existsSync2(p)).map((p) => realpathSync(p));
  if (!roots.some((root) => {
    const rel = relative(root, cwd);
    return root !== "/" && !rel.startsWith("..") && !isAbsolute3(rel);
  })) throw new Error("cwd is outside configured Harness workspace roots");
  return cwd;
}
async function selectModel(sid, options) {
  const option = options?.find((o) => o.category === "model" || o.id === "model");
  if (!option) throw new Error("Harness did not expose verifiable model configuration; update Harness ACP");
  const route = (value) => {
    try {
      const r = JSON.parse(value);
      return Array.isArray(r) && r.length === 2 ? r : null;
    } catch {
      return null;
    }
  };
  const current = route(option.currentValue);
  if (current?.[1] === model) {
    record.model = current[1];
    record.provider = current[0];
    return;
  }
  const choices = (option.options || []).flatMap((o) => o.options || [o]).filter((o) => route(o.value)?.[1] === model);
  const target = choices.find((o) => route(o.value)?.[0] === current?.[0]) || (choices.length === 1 ? choices[0] : null);
  if (!target) throw new Error("Configured Harness model is unavailable or ambiguous: " + model);
  const result = await call("session/set_config_option", { sessionId: sid, configId: option.id, value: target.value });
  const applied = result.configOptions?.find((o) => o.id === option.id);
  if (applied?.currentValue !== target.value) throw new Error("Harness did not confirm the requested model");
  const selected = route(target.value);
  record.model = selected[1];
  record.provider = selected[0];
}
async function turn(sid, id, text) {
  let status = "completed", failure = null;
  try {
    const thread = threads.get(sid), resources = process.env.CODEX_HOME ? join3(process.env.CODEX_HOME, "skills") : "";
    const body = [thread.instructions, resources ? "Linky 已准备的技能目录（需要时读取 SKILL.md 与引用文件）：" + resources : "", text].filter(Boolean).join("\n\n");
    const result = await call("session/prompt", { sessionId: sid, prompt: [{ type: "text", text: body }] }, 30 * 60 * 1e3);
    if (result.stopReason === "cancelled") status = "interrupted";
    else if (result.stopReason !== "end_turn") throw new Error("Harness stopped without end_turn");
    const answer = turns.get(sid)?.text || "";
    if (status === "completed" && !answer.trim()) throw new Error("Harness returned an empty answer");
    record.status = status;
    record.output = answer;
    record.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    persist();
    if (answer) event("item/completed", { threadId: sid, turnId: id, item: { id: randomUUID2(), type: "agentMessage", text: answer, phase: "final_answer" } });
  } catch (error) {
    status = "failed";
    failure = { message: String(error.message || error) };
    record.status = status;
    record.error = failure.message;
    persist();
    if (acp) void shutdown(failure.message);
  } finally {
    event("turn/completed", { threadId: sid, turn: { id, status, error: failure, items: [] } });
    turns.delete(sid);
  }
}
async function handle(packet) {
  if (packet.id == null) return;
  const p = packet.params || {}, method = packet.method;
  try {
    let result;
    if (method === "initialize") result = { userAgent: "harness-linky/0.1.0", platformFamily: process.platform === "win32" ? "windows" : "unix", platformOs: process.platform };
    else if (method === "model/list") result = { data: [modelRow], nextCursor: null };
    else if (method === "thread/start" || method === "thread/resume") {
      if (p.model && p.model !== model) throw new Error("Unsupported model; select " + model);
      const cwd = allowedCwd(p.cwd);
      await ensureACP();
      let sid, session;
      if (method === "thread/resume") {
        sid = String(p.threadId || "");
        if (!sid) throw new Error("threadId required");
        session = await call("session/resume", { sessionId: sid, cwd, mcpServers: [] });
      } else {
        session = await call("session/new", { cwd, mcpServers: [] });
        sid = session.sessionId;
      }
      if (!sid) throw new Error("Harness returned no session id");
      await selectModel(sid, session.configOptions);
      threads.set(sid, { cwd, instructions: String(p.developerInstructions || "") });
      Object.assign(record, { sessionId: sid, cwd, status: "ready" });
      persist();
      result = { thread: { id: sid, cwd, turns: [] }, model, modelProvider: "harness", cwd };
    } else if (method === "turn/start") {
      const sid = String(p.threadId || "");
      if (!threads.has(sid) || turns.size) throw new Error("Unknown thread or adapter busy");
      if (!Array.isArray(p.input) || !p.input.length || p.input.some((b) => b.type !== "text" || typeof b.text !== "string")) throw new Error("Only text input is supported");
      const text = p.input.map((b) => b.text).join("\n");
      if (text.length > 512 * 1024) throw new Error("Input too large");
      const id = randomUUID2();
      turns.set(sid, { id, text: "", tools: /* @__PURE__ */ new Map() });
      record.status = "running";
      record.turnId = id;
      persist();
      result = { turn: { id, status: "inProgress", items: [], error: null } };
      send({ id: packet.id, result });
      event("turn/started", { threadId: sid, turn: result.turn });
      void turn(sid, id, text);
      return;
    } else if (method === "turn/interrupt") {
      const sid = String(p.threadId || ""), current = turns.get(sid);
      if (!current || p.turnId && p.turnId !== current.id) throw new Error("Unknown turn");
      write({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId: sid } });
      result = {};
    } else {
      send({ id: packet.id, error: { code: -32601, message: "Unsupported method: " + method } });
      return;
    }
    send({ id: packet.id, result });
  } catch (error) {
    send({ id: packet.id, error: { code: -32e3, message: String(error.message || error) } });
  }
}
async function shutdown(reason = "") {
  if (closing) return;
  closing = true;
  if (turns.size && record.status === "running") {
    record.status = "interrupted";
    record.error = reason || "Linky connection closed";
    persist();
  }
  if (acp) {
    acp.stdin.end();
    const child = acp;
    const kill = (signal) => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
      }
    };
    kill("SIGTERM");
    const timer = setTimeout(() => kill("SIGKILL"), 1500);
    timer.unref();
    child.once("exit", () => clearTimeout(timer));
    rejectAll();
  }
}
var args = process.argv.slice(2);
if (args[0] === "--version") console.log("codex-cli 0.151.0-compatible (harness-linky 0.1.0; backend=Harness ACP)");
else if (args[0] === "debug" && args[1] === "models") console.log(JSON.stringify({ models: [modelRow] }));
else if (args[0] === "app-server" && args.slice(1).join(" ") === "--listen stdio://") {
  let queue = Promise.resolve();
  const input = createInterface({ input: process.stdin });
  input.on("line", (line) => {
    if (line.length > 1024 * 1024) {
      send({ id: null, error: { code: -32700, message: "Input too large" } });
      return;
    }
    queue = queue.then(async () => {
      try {
        await handle(JSON.parse(line));
      } catch {
        send({ id: null, error: { code: -32700, message: "Invalid JSON" } });
      }
    });
  });
  input.once("close", () => void queue.finally(() => shutdown()));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    input.close();
    void shutdown();
  });
} else {
  console.error("Use app-server --listen stdio://; this is a Harness adapter, no Codex installation required.");
  process.exitCode = 2;
}
