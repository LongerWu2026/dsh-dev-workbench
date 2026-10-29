/** Generated from TypeScript modules by scripts/build.mjs. Do not edit. */
window.__ModuleLoader__.load({ id: "dsh-dev-workbench", factory(require) {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  WB: () => WB,
  apply: () => apply2,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);

// src/client/core/runtime.ts
var React3 = __toESM(require("react"), 1);

// src/client/core/theme.ts
var React = __toESM(require("react"), 1);
var h = React.createElement;
var T = {
  bg: "var(--dsw-alias-bg-base)",
  layer1: "var(--dsw-alias-bg-layer-1)",
  layer2: "var(--dsw-alias-bg-layer-2)",
  overlay: "var(--dsw-alias-bg-overlay)",
  border1: "var(--dsw-alias-border-l1)",
  border2: "var(--dsw-alias-border-l2)",
  text: "var(--dsw-alias-label-primary)",
  text2: "var(--dsw-alias-label-secondary)",
  accent: "var(--dsw-alias-brand-primary)",
  ok: "var(--dsw-alias-state-success-primary)",
  warn: "var(--dsw-alias-state-warn-primary)",
  err: "var(--dsw-alias-state-error-primary)",
  idle: "var(--dsw-alias-state-idle-primary)",
  sidebar: "var(--dsw-specific-sidebar-fill)",
  radius: { card: 16, ctl: 10, pill: 999 },
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  font: {
    title: 19,
    h3: 14,
    body: 13,
    small: 12,
    tiny: 11,
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
  }
};

// src/shared/assistant-context.ts
var MAX_ASSISTANT_CONTEXTS = 8;

// src/client/core/format.ts
function parseDate(value) {
  if (!value)
    return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function pad2(value) {
  return value < 10 ? "0" + value : String(value);
}
var fmt = {
  date(value) {
    const date = parseDate(value);
    if (!date)
      return "—";
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  },
  day(value) {
    const date = parseDate(value);
    if (!date)
      return "—";
    return pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  },
  time(value) {
    const date = parseDate(value);
    if (!date)
      return "—";
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  },
  datetime(value) {
    const date = parseDate(value);
    if (!date)
      return "—";
    return fmt.date(value) + " " + fmt.time(value);
  },
  relative(value, now) {
    const date = parseDate(value);
    if (!date)
      return "—";
    const base = now || Date.now();
    const diff = Math.round((base - date.getTime()) / 1e3);
    if (diff < 45)
      return "刚刚";
    if (diff < 3600)
      return Math.max(1, Math.round(diff / 60)) + " 分钟前";
    if (diff < 86400)
      return Math.round(diff / 3600) + " 小时前";
    if (diff < 86400 * 30)
      return Math.round(diff / 86400) + " 天前";
    return fmt.date(value);
  },
  due(value, now) {
    if (!value)
      return { text: "无截止", tone: "idle", overdue: false };
    const date = parseDate(value);
    if (!date)
      return { text: "无截止", tone: "idle", overdue: false };
    const base = now || Date.now();
    const diff = date.getTime() - base;
    const abs = Math.abs(diff);
    const overdue = diff < 0;
    let text;
    if (abs < 3600 * 1e3)
      text = overdue ? "刚刚到期" : Math.round(diff / 6e4) + " 分钟后";
    else if (abs < 86400 * 1e3)
      text = (overdue ? "逾期 " : "") + Math.round(abs / 36e5) + " 小时" + (overdue ? "" : "后");
    else
      text = (overdue ? "逾期 " : "") + Math.round(abs / 864e5) + " 天" + (overdue ? "" : "后");
    return { text, tone: overdue ? "err" : abs < 864e5 ? "warn" : "idle", overdue };
  },
  num(value) {
    const number = Number(value || 0);
    if (Math.abs(number) >= 1e4)
      return (number / 1e3).toFixed(1) + "k";
    return String(number);
  },
  /** ISO → value for <input type="datetime-local"> in local time. */
  toLocalInput(value) {
    const date = parseDate(value);
    if (!date)
      return "";
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  },
  /** <input type="datetime-local"> value → ISO, or null. */
  fromLocalInput(value) {
    if (!value)
      return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  },
  bytes(value) {
    const size = Number(value || 0);
    if (size < 1024)
      return size + " B";
    if (size < 1024 * 1024)
      return (size / 1024).toFixed(1) + " KB";
    return (size / 1024 / 1024).toFixed(1) + " MB";
  }
};
var util = {
  uid(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + random;
  },
  truncate(text, max) {
    const value = String(text === void 0 || text === null ? "" : text);
    return value.length > max ? value.slice(0, max - 1) + "…" : value;
  },
  debounce(fn, wait) {
    let timer = null;
    return function() {
      const args = arguments;
      const self = this;
      if (timer)
        clearTimeout(timer);
      timer = setTimeout(function() {
        timer = null;
        fn.apply(self, args);
      }, wait || 200);
    };
  },
  groupBy(list, keyFn) {
    const out = {};
    (list || []).forEach(function(item) {
      const key2 = keyFn(item);
      if (!out[key2])
        out[key2] = [];
      out[key2].push(item);
    });
    return out;
  },
  sortBy(list, keyFn, desc) {
    return (list || []).slice().sort(function(a, b) {
      const av = keyFn(a);
      const bv = keyFn(b);
      if (av === bv)
        return 0;
      if (av === null || av === void 0)
        return 1;
      if (bv === null || bv === void 0)
        return -1;
      return (av < bv ? -1 : 1) * (desc ? -1 : 1);
    });
  },
  copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function() {
        return Promise.reject(new Error("复制失败"));
      });
    }
    return Promise.reject(new Error("当前环境不支持剪贴板"));
  },
  nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};

// src/client/components/primitives.ts
var React2 = __toESM(require("react"), 1);
var WB_ICON_PATHS = {
  dashboard: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  tasks: ["M9 11l3 3 8-8", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  agent: ["M12 8V5H9", "M5 8h14v12H5z", "M9.5 13h.01", "M14.5 13h.01", "M9 17h6"],
  messages: ["M7 14l-4 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7z", "M17 7h2a2 2 0 0 1 2 2v12l-4-4h-6a2 2 0 0 1-2-2v-1"],
  radar: ["M12 12l5-5", "M12 3a9 9 0 1 1-9 9", "M12 7a5 5 0 1 0 5 5", "M12 12h.01"],
  toolbox: ["M3 8h18v11H3z", "M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M3 13h18"],
  book: ["M12 6c-2-1.4-4.2-2-8-2v14c3.8 0 6 .6 8 2", "M12 6c2-1.4 4.2-2 8-2v14c-3.8 0-6 .6-8 2", "M12 6v14"],
  settings: ["M4 6h9", "M17 6h3", "M4 12h3", "M11 12h9", "M4 18h9", "M17 18h3", "M15 6h.01", "M9 12h.01", "M15 18h.01"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4.2-4.2"],
  plus: ["M12 5v14", "M5 12h14"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  check: ["M20 6L9 17l-5-5"],
  chevronDown: ["M6 9l6 6 6-6"],
  chevronRight: ["M9 6l6 6-6 6"],
  refresh: ["M20.5 12a8.5 8.5 0 1 1-2.8-6.3", "M21 3.5V9h-5.5"],
  external: ["M14 4h6v6", "M20 4l-8.5 8.5", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  play: ["M8 5l11 7-11 7z"],
  trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  edit: ["M4 20h4L20 8l-4-4L4 16z"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7.5V12l3 2"],
  flag: ["M5 21V4h9l-1 3h6l-2 5 2 5h-6l1 3"],
  save: ["M5 3h11l3 3v15H5z", "M8 3v6h8", "M8 14h8v7H8z"],
  copy: ["M9 9h11v11H9z", "M15 5H5v10"],
  sparkles: ["M12 3.5l1.7 4 4 1.7-4 1.7L12 15l-1.7-4.1-4-1.7 4-1.7z", "M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"],
  alert: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 8h.01"],
  folder: ["M3 6h6l2 2h10v11H3z"],
  git: ["M7 4v10", "M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M7 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M17 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M7 10a4 4 0 0 0 4 4h4"],
  docker: ["M4 11h13a4 4 0 0 1-4 4H9a5 5 0 0 1-5-4z", "M7 8h2v2H7z", "M10 8h2v2h-2z", "M13 8h2v2h-2z"],
  link: ["M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.4 6", "M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.2-1.2"],
  filter: ["M3 5h18l-7 8.5V20l-4 1.5v-8z"],
  download: ["M12 3v12", "M7 10.5l5 5 5-5", "M4 20h16"],
  upload: ["M12 16V4", "M7 8.5l5-5 5 5", "M4 20h16"],
  command: ["M9 9h6v6H9z", "M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9", "M15 9V6.5A2.5 2.5 0 1 1 17.5 9H15", "M9 15v2.5A2.5 2.5 0 1 1 6.5 15H9", "M15 15v2.5a2.5 2.5 0 1 0 2.5-2.5H15"],
  layers: ["M12 3l9 5-9 5-9-5z", "M3 13l9 5 9-5"],
  database: ["M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z", "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
  calendar: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  eye: ["M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  more: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
  arrowRight: ["M4 12h15", "M13 6l6 6-6 6"],
  xCircle: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9 9l6 6", "M15 9l-6 6"],
  checkCircle: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M8 12.5l2.5 2.5L16 9.5"],
  zap: ["M13 2L5 13h6l-1 9 8-11h-6z"],
  lock: ["M6 11h12v9H6z", "M9 11V8a3 3 0 0 1 6 0v3"],
  plug: ["M9 3v6", "M15 3v6", "M7 9h10v3a5 5 0 0 1-10 0z", "M12 17v4"]
};
function Icon(props) {
  const name2 = props && props.name;
  const paths = WB_ICON_PATHS[name2] || WB_ICON_PATHS.info;
  const size = props && props.size || 16;
  const children = paths.map(function(d, index) {
    return h("path", { key: index, d });
  });
  return h("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: props && props.strokeWidth ? props.strokeWidth : 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    style: { display: "block", flex: "none" }
  }, children);
}
function Divider() {
  return h("hr", { className: "wb-divider" });
}
function Spinner(props) {
  const size = props && props.size || 15;
  return h("span", { className: "wb-spin", style: { width: size, height: size } });
}
function Btn(props) {
  const kind = props.kind || "ghost";
  const classes = ["wb-btn", "wb-btn--" + kind];
  if (props.size === "sm")
    classes.push("wb-btn--sm");
  if (props.className)
    classes.push(props.className);
  return h("button", {
    type: "button",
    className: classes.join(" "),
    onClick: props.onClick,
    "aria-label": props["aria-label"],
    disabled: props.disabled,
    title: props.title || (typeof props.children === "string" ? props.children : void 0)
  }, props.icon ? h(Icon, { name: props.icon, size: props.size === "sm" ? 13 : 14 }) : null, typeof props.children === "string" ? h("span", null, props.children) : props.children || null);
}
function IconBtn(props) {
  return h("button", {
    type: "button",
    className: "wb-iconbtn" + (props.active ? " is-active" : ""),
    onClick: props.onClick,
    title: props.label,
    "aria-label": props.label,
    disabled: props.disabled
  }, h(Icon, { name: props.name, size: props.size || 15 }));
}
function Badge(props) {
  return h("span", { className: "wb-badge wb-badge--" + (props.tone || "idle") }, props.children);
}
function Chip(props) {
  if (props.onClick) {
    return h("button", {
      type: "button",
      className: "wb-chip" + (props.active ? " is-active" : ""),
      onClick: props.onClick,
      title: props.title
    }, props.icon ? h(Icon, { name: props.icon, size: 12 }) : null, props.children, props.onRemove ? h("span", {
      className: "wb-chip-x",
      role: "button",
      tabIndex: 0,
      onClick: function(event) {
        event.stopPropagation();
        props.onRemove();
      }
    }, h(Icon, { name: "close", size: 10 })) : null);
  }
  return h("span", { className: "wb-chip wb-chip--static" + (props.active ? " is-active" : ""), title: props.title }, props.icon ? h(Icon, { name: props.icon, size: 12 }) : null, props.children, props.onRemove ? h("button", { type: "button", className: "wb-chip-x", "aria-label": "移除上下文：" + (props.title || props.children || ""), onClick: props.onRemove, style: { border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 2 } }, h(Icon, { name: "close", size: 12 })) : null);
}
function Panel(props) {
  const bodyClass = "wb-card-body" + (props.flush ? " wb-card-body--flush" : "");
  const head = props.title || props.sub || props.actions ? h("div", { className: "wb-card-head" }, props.icon ? h("span", { className: "wb-card-icon" }, h(Icon, { name: props.icon, size: 15 })) : null, h("div", { className: "wb-card-titles" }, props.title ? h("h3", { className: "wb-card-title" }, props.title, props.badge || null) : null, props.sub ? h("p", { className: "wb-card-sub" }, props.sub) : null), props.actions ? h("div", { className: "wb-card-actions" }, props.actions) : null) : null;
  return h("section", {
    className: "wb-card" + (props.className ? " " + props.className : ""),
    style: props.style
  }, head, h("div", { className: bodyClass, style: props.bodyStyle }, props.children));
}
function PageHead(props) {
  return h("header", { className: "wb-page-head" }, props.icon ? h("div", { className: "wb-ph-icon" }, h(Icon, { name: props.icon, size: 18 })) : null, h("div", { style: { minWidth: 0 } }, h("h1", null, props.title), props.sub ? h("p", null, props.sub) : null), props.actions ? h("div", { className: "wb-ph-actions" }, props.actions) : null);
}
function Stat(props) {
  const tag = props.onClick ? "button" : "div";
  return h(tag, {
    className: "wb-stat",
    onClick: props.onClick,
    type: props.onClick ? "button" : void 0,
    style: props.style
  }, h("div", { className: "wb-stat-top" }, props.icon ? h(Icon, { name: props.icon, size: 13 }) : null, h("span", null, props.label)), h("div", {
    className: "wb-stat-value",
    style: props.tone ? { color: props.tone === "ok" ? T.ok : props.tone === "warn" ? T.warn : props.tone === "err" ? T.err : props.tone === "accent" ? T.accent : void 0 } : void 0
  }, props.value), props.sub ? h("div", { className: "wb-stat-sub" }, props.sub) : null);
}
function Field(props) {
  return h("label", { className: "wb-field", style: props.style }, props.label ? h("span", { className: "wb-label" }, props.label) : null, props.children, props.hint ? h("span", { className: "wb-hint" }, props.hint) : null);
}
function Input(props) {
  const clean2 = Object.assign({}, props);
  delete clean2.invalid;
  return h("input", Object.assign({ className: "wb-input" + (props.className ? " " + props.className : "") }, clean2));
}
function Textarea(props) {
  return h("textarea", Object.assign({ className: "wb-textarea" }, props));
}
function Select(props) {
  const children = (props.options || []).map(function(option) {
    return h("option", { key: option.value, value: option.value }, option.label);
  });
  return h("span", { className: "wb-select-wrap" }, h("select", {
    className: "wb-select",
    value: props.value,
    onChange: props.onChange,
    disabled: props.disabled,
    title: props.title,
    "aria-label": props["aria-label"]
  }, children));
}
function Toggle(props) {
  return h("div", { className: "wb-row", style: { gap: 8, cursor: props.disabled ? "not-allowed" : "pointer" } }, h("span", {
    className: "wb-switch" + (props.checked ? " is-on" : ""),
    role: "switch",
    tabIndex: props.disabled ? -1 : 0,
    "aria-checked": props.checked ? "true" : "false",
    onClick: function() {
      if (!props.disabled)
        props.onChange(!props.checked);
    },
    onKeyDown: function(event) {
      if (props.disabled)
        return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        props.onChange(!props.checked);
      }
    }
  }, h("i", null)), props.label ? h("span", { className: "wb-tiny" }, props.label) : null);
}
function Segmented(props) {
  return h("div", { className: "wb-tabs" }, (props.items || []).map(function(item) {
    return h("button", {
      key: item.value,
      type: "button",
      className: "wb-tab" + (props.value === item.value ? " is-active" : ""),
      onClick: function() {
        props.onChange(item.value);
      }
    }, item.label);
  }));
}
function Tabs(props) {
  return h("div", { className: "wb-tabs", style: props.style }, (props.items || []).map(function(item) {
    return h("button", {
      key: item.value,
      type: "button",
      className: "wb-tab" + (props.value === item.value ? " is-active" : ""),
      onClick: function() {
        props.onChange(item.value);
      }
    }, item.label, item.count === void 0 || item.count === null ? null : h("span", { className: "wb-tab-count" }, String(item.count)));
  }));
}
function Empty(props) {
  return h("div", { className: "wb-empty" + (props.className ? " " + props.className : ""), style: props.style }, h("div", { className: "wb-empty-icon" }, h(Icon, { name: props.icon || "layers", size: 18 })), h("strong", null, props.title || "暂无内容"), props.hint ? h("p", null, props.hint) : null, props.action || null);
}
function Progress(props) {
  const max = props.max || 100;
  const value = Math.max(0, Math.min(max, props.value || 0));
  return h("div", { className: "wb-progress" }, h("i", { style: { width: value / max * 100 + "%" } }));
}
function Kbd(props) {
  return h("kbd", { className: "wb-kbd" }, props.children);
}
function Modal(props) {
  const maskRef = React2.useRef(null);
  React2.useEffect(function() {
    if (!props.open)
      return void 0;
    function onKey(event) {
      if (event.key === "Escape") {
        const masks = document.querySelectorAll(".wb-modal-mask");
        if (masks[masks.length - 1] !== maskRef.current) return;
        event.stopPropagation();
        props.onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return function() {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [props.open, props.onClose]);
  if (!props.open)
    return null;
  return h("div", {
    ref: maskRef,
    className: "wb-modal-mask",
    onMouseDown: function(event) {
      if (event.target === event.currentTarget)
        props.onClose();
    }
  }, h("div", {
    className: "wb-modal",
    role: "dialog",
    "aria-modal": "true",
    style: props.width ? { width: "min(" + props.width + "px, 100%)" } : void 0
  }, h("div", { className: "wb-modal-head" }, h("div", { style: { flex: "1 1 auto", minWidth: 0 } }, props.title ? h("h2", null, props.title) : null, props.sub ? h("strong", null, props.sub) : null), h(IconBtn, { name: "close", label: "关闭", onClick: props.onClose })), h("div", { className: "wb-modal-body" }, props.children), props.footer ? h("div", { className: "wb-modal-foot" }, props.footer) : null));
}

// src/client/core/styles.ts
var WB_CSS = `
.wb-root {
  --wb-accent: var(--dsw-alias-brand-primary);
  --wb-ok: var(--dsw-alias-state-success-primary);
  --wb-warn: var(--dsw-alias-state-warn-primary);
  --wb-err: var(--dsw-alias-state-error-primary);
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
}
.wb-root *, .wb-root *::before, .wb-root *::after { box-sizing: border-box; }
.wb-nav {
  width: 208px;
  flex: 0 0 208px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 10px;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-specific-sidebar-fill);
  overflow: auto;
}
.wb-nav-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 8px 14px;
  color: var(--dsw-alias-label-primary);
}
.wb-nav-brand strong { font-size: 13.5px; font-weight: 600; letter-spacing: .01em; }
.wb-nav-label {
  padding: 10px 9px 5px;
  font-size: 10.5px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  opacity: .85;
}
.wb-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background .14s ease, color .14s ease;
}
.wb-nav-item:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-nav-item.is-active {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 2px 0 0 var(--wb-accent);
}
.wb-nav-item .wb-nav-count {
  margin-left: auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  font-size: 10.5px;
  line-height: 16px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.wb-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.wb-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.wb-toolbar-search {
  flex: 1 1 auto;
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.wb-toolbar-search:hover { border-color: var(--dsw-alias-border-l2); }
.wb-toolbar-search kbd { margin-left: auto; }
.wb-scroll { flex: 1 1 auto; overflow: auto; scrollbar-width: thin; }
.wb-page { padding: 24px 24px 44px; max-width: 1340px; }
.wb-page-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
.wb-page-head .wb-ph-icon {
  display: grid; place-items: center;
  width: 34px; height: 34px; flex: none;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--wb-accent);
}
.wb-page-head h1 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
.wb-page-head p { margin: 3px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-page-head .wb-ph-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }

.wb-grid { display: grid; gap: 16px; }
.wb-row { display: flex; align-items: center; gap: 8px; }
.wb-row--wrap { flex-wrap: wrap; }
.wb-spacer { flex: 1 1 auto; }
.wb-stack { display: flex; flex-direction: column; gap: 8px; }

.wb-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.wb-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 10px;
  padding: 14px 16px 11px;
}
.wb-card-titles { min-width: 0; flex: 1 1 auto; }
.wb-card-icon { display: inline-flex; margin-top: 2px; color: var(--wb-accent); }
.wb-card-title {
  display: flex; align-items: center; gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.wb-card-sub { margin: 2px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); line-height: 1.45; }
.wb-card-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: none; }
.wb-card-body { padding: 0 16px 15px; min-width: 0; }
.wb-card-body--flush { padding: 0; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.wb-root .wb-panel--separated > .wb-card-head {
  padding: 14px 16px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 7%, var(--dsw-alias-bg-layer-1, #fff));
  border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 18%, var(--dsw-alias-bg-layer-1, #fff));
}
.wb-panel--separated > .wb-card-head .wb-card-title { font-size: 14px; }
.wb-panel--separated > .wb-card-head .wb-card-sub { margin-top: 4px; }
.wb-panel--separated > .wb-card-body { padding-top: 12px; }
.wb-inbox-filters {
  display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
  padding: 14px 16px; margin-bottom: 18px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 3%, var(--dsw-alias-bg-base, #fff));
}
.wb-inbox-search { position: relative; flex: 1 1 260px; min-width: 0; max-width: 520px; }
.wb-inbox-search > svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-secondary); pointer-events: none; }
.wb-inbox-search > .wb-input { padding-left: 34px; }
.wb-inbox-filter { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-filter > .wb-select-wrap { width: 130px; }
.wb-inbox-count { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.wb-inbox > .wb-reply-list { gap: 14px; }
.wb-inbox .wb-inbox-card {
  min-width: 0; padding: 0; overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 14%, var(--dsw-alias-bg-base, #fff));
  border-radius: 12px; background: var(--dsw-alias-bg-base);
}
.wb-inbox-card-head { padding: 14px 18px 12px; background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 5%, var(--dsw-alias-bg-base, #fff)); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wb-inbox-card-head strong { min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
.wb-inbox-meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 7px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-meta > span { min-width: 0; overflow-wrap: anywhere; }
.wb-inbox-message { margin: 0; padding: 16px 18px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.wb-inbox-footer { padding: 12px 18px; border-top: 1px solid var(--dsw-alias-border-l1); }
.wb-reply-draft-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.wb-inbox-stage-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.wb-inbox-stage-actions > span { margin-right: 2px; }
.wb-reply-editor { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); }
.wb-reply-editor > p { margin: 0; }
.wb-reply-editor > textarea { min-height: 100px; resize: vertical; }
.wb-inbox-evidence { margin-top: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wb-inbox-evidence > summary { width: fit-content; cursor: pointer; }
.wb-inbox-evidence > summary:hover { color: var(--dsw-alias-label-primary); }
.wb-inbox-evidence > p { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--dsw-alias-label-primary, #20242b) 4%, var(--dsw-alias-bg-base, #fff)); }
.wb-inbox-card .wb-btn { max-width: 100%; height: auto; min-height: 26px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
.wb-inbox-card .wb-btn > span { min-width: 0; }
.wb-divider { height: 1px; background: var(--dsw-alias-border-l1); margin: 0; border: 0; }

.wb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background .14s ease, border-color .14s ease, opacity .14s ease;
}
.wb-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.wb-btn:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 1px; }
.wb-btn:disabled { opacity: .45; cursor: not-allowed; }
.wb-btn--primary {
  border-color: transparent;
  background: var(--wb-accent);
  color: var(--dsw-alias-bg-base);
  font-weight: 600;
}
.wb-btn--primary:hover { filter: brightness(1.06); background: var(--wb-accent); }
.wb-btn--subtle { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.wb-btn--subtle:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-btn--danger { color: var(--wb-err); border-color: var(--dsw-alias-border-l1); }
.wb-btn--danger:hover { border-color: var(--wb-err); background: var(--dsw-alias-bg-layer-2); }
.wb-btn--sm { height: 25px; padding: 0 8px; font-size: 11.5px; border-radius: 8px; }
.wb-iconbtn {
  display: inline-grid;
  place-items: center;
  width: 28px; height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background .14s ease, color .14s ease;
}
.wb-iconbtn:hover, .wb-iconbtn.is-active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.wb-iconbtn:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 1px; }

.wb-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .01em;
  white-space: nowrap;
}
.wb-badge--accent { color: var(--wb-accent); border-color: color-mix(in srgb, var(--wb-accent) 45%, transparent); background: color-mix(in srgb, var(--wb-accent) 12%, transparent); }
.wb-badge--ok { color: var(--wb-ok); border-color: color-mix(in srgb, var(--wb-ok) 45%, transparent); background: color-mix(in srgb, var(--wb-ok) 12%, transparent); }
.wb-badge--warn { color: var(--wb-warn); border-color: color-mix(in srgb, var(--wb-warn) 45%, transparent); background: color-mix(in srgb, var(--wb-warn) 12%, transparent); }
.wb-badge--err { color: var(--wb-err); border-color: color-mix(in srgb, var(--wb-err) 45%, transparent); background: color-mix(in srgb, var(--wb-err) 12%, transparent); }
.wb-badge--idle { color: var(--dsw-alias-label-secondary); }

.wb-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  white-space: nowrap;
  cursor: pointer;
}
.wb-chip:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.wb-chip.is-active {
  color: var(--wb-accent);
  border-color: color-mix(in srgb, var(--wb-accent) 50%, transparent);
  background: color-mix(in srgb, var(--wb-accent) 12%, transparent);
}
.wb-chip--static { cursor: default; }
.wb-chip-x { display: inline-flex; opacity: .6; }
.wb-chip-x:hover { opacity: 1; }

.wb-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.wb-label { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-secondary); letter-spacing: .01em; }
.wb-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); opacity: .85; }
.wb-input, .wb-select, .wb-textarea {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  outline: none;
  transition: border-color .14s ease, box-shadow .14s ease;
}
.wb-textarea { min-height: 68px; resize: vertical; line-height: 1.55; }
.wb-input:focus, .wb-select:focus, .wb-textarea:focus {
  border-color: var(--wb-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--wb-accent) 18%, transparent);
}
.wb-input::placeholder, .wb-textarea::placeholder { color: var(--dsw-alias-label-secondary); opacity: .7; }
.wb-select { appearance: none; padding-right: 26px; cursor: pointer; }
.wb-select-wrap { position: relative; display: block; }
.wb-select-wrap::after {
  content: '';
  position: absolute; right: 9px; top: 50%;
  width: 6px; height: 6px;
  margin-top: -4px;
  border-right: 1.5px solid var(--dsw-alias-label-secondary);
  border-bottom: 1.5px solid var(--dsw-alias-label-secondary);
  transform: rotate(45deg);
  pointer-events: none;
}

.wb-tabs { display: flex; gap: 3px; padding: 3px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); }
.wb-tab {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 11px;
  border: 0; border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
}
.wb-tab:hover { color: var(--dsw-alias-label-primary); }
.wb-tab.is-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.18); }
.wb-tab .wb-tab-count { font-size: 10.5px; opacity: .75; }

.wb-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-left: 3px solid var(--wb-accent);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.wb-banner--ok { border-left-color: var(--wb-ok); }
.wb-banner--warn { border-left-color: var(--wb-warn); }
.wb-banner--err { border-left-color: var(--wb-err); }
.wb-banner-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.wb-banner-main { flex: 1 1 auto; min-width: 0; }
.wb-banner-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-sub {
  margin-top: 1px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-actions { display: flex; align-items: center; gap: 6px; flex: none; }

.wb-stat {
  display: flex; flex-direction: column; gap: 2px;
  padding: 13px 15px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  min-width: 0;
  text-align: left;
}
button.wb-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-left: 3px solid var(--wb-accent);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.wb-banner--ok { border-left-color: var(--wb-ok); }
.wb-banner--warn { border-left-color: var(--wb-warn); }
.wb-banner--err { border-left-color: var(--wb-err); }
.wb-banner-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.wb-banner-main { flex: 1 1 auto; min-width: 0; }
.wb-banner-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-sub {
  margin-top: 1px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-banner-actions { display: flex; align-items: center; gap: 6px; flex: none; }

.wb-stat { font: inherit; cursor: pointer; }
button.wb-stat:hover { border-color: var(--dsw-alias-border-l2); }
.wb-stat-top { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.wb-stat-value { font-size: 23px; font-weight: 600; letter-spacing: -.02em; line-height: 1.15; font-variant-numeric: tabular-nums; }
.wb-stat-sub {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.wb-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px;
  margin: auto; width: 100%;
  padding: 26px 16px 24px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.wb-empty-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.wb-empty strong { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }
.wb-empty p { margin: 0; font-size: 11.5px; max-width: 380px; line-height: 1.6; }

.wb-list { display: flex; flex-direction: column; }
.wb-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  min-width: 0;
}
.wb-item:last-child { border-bottom: 0; }
.wb-item:hover { background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 55%, transparent); }
.wb-item-main { flex: 1 1 auto; min-width: 0; }
.wb-item-title { font-size: 12.5px; font-weight: 500; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.wb-item-title.is-done { text-decoration: line-through; opacity: .55; }
.wb-item-sub { margin-top: 2px; font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wb-item-actions { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s ease; }
.wb-item:hover .wb-item-actions, .wb-item-actions:focus-within { opacity: 1; }

.wb-check {
  flex: none;
  display: grid; place-items: center;
  width: 16px; height: 16px;
  margin-top: 2px;
  padding: 0;
  border: 1.5px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: transparent;
  cursor: pointer;
}
.wb-check:hover { border-color: var(--wb-accent); }
.wb-check.is-on { background: var(--wb-ok); border-color: var(--wb-ok); color: var(--dsw-alias-bg-base); }

.wb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.wb-table th {
  text-align: left; font-weight: 600; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  white-space: nowrap;
}
.wb-table td { padding: 9px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: middle; }
.wb-table tr:last-child td { border-bottom: 0; }
.wb-table tbody tr:hover { background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 45%, transparent); }

.wb-context-option { display:block; width:100%; padding:8px; border:0; border-radius:6px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; text-align:left; cursor:pointer; }
.wb-context-option:hover, .wb-context-option[aria-pressed=true] { background:var(--dsw-alias-bg-layer-2); }
.wb-context-option:disabled { opacity:.5; cursor:default; }
.wb-assistant-suggest {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  transition: border-color .12s ease, color .12s ease;
}
.wb-assistant-suggest:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
.wb-assistant-suggest span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wb-kbd {
  display: inline-block;
  min-width: 17px;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.wb-modal-mask {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 12vh 16px 16px;
  background: rgba(5, 9, 18, .55);
  backdrop-filter: blur(2px);
  animation: wb-fade .12s ease;
}
.wb-modal {
  width: min(560px, 100%);
  max-height: 76vh;
  display: flex; flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 24px 64px rgba(0,0,0,.42);
  overflow: hidden;
  animation: wb-pop .14s ease;
}
.wb-modal-head { display: flex; align-items: flex-start; gap: 10px; padding: 15px 16px 10px; }
.wb-modal-head h2 { margin: 0; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); font-weight: 600; }
.wb-modal-head strong { display: block; font-size: 14px; font-weight: 600; margin-top: 2px; }
.wb-modal-body { padding: 4px 16px 14px; overflow: auto; }
.wb-modal-foot { display: flex; align-items: center; gap: 8px; padding: 11px 16px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }
@keyframes wb-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes wb-pop { from { opacity: 0; transform: translateY(-6px) scale(.99) } to { opacity: 1; transform: none } }

.wb-toasts {
  position: absolute; right: 16px; bottom: 16px; z-index: 70;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
  pointer-events: none;
}
.wb-toast {
  display: flex; align-items: center; gap: 8px;
  max-width: 380px;
  padding: 9px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-left-width: 3px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 12px 32px rgba(0,0,0,.34);
  font-size: 12px;
  animation: wb-pop .16s ease;
}
.wb-toast--ok { border-left-color: var(--wb-ok); }
.wb-toast--err { border-left-color: var(--wb-err); }
.wb-toast--info { border-left-color: var(--wb-accent); }

.wb-progress { height: 4px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.wb-progress > i { display: block; height: 100%; background: var(--wb-accent); border-radius: 999px; transition: width .2s ease; }

.wb-spin {
  display: inline-block;
  width: 15px; height: 15px;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--wb-accent);
  border-radius: 50%;
  animation: wb-rotate .7s linear infinite;
}
@keyframes wb-rotate { to { transform: rotate(360deg) } }

.wb-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; }
.wb-code {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 340px;
  overflow: auto;
}
.wb-muted { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 74%, var(--dsw-alias-label-primary)); }
.wb-tiny { font-size: 11px; }
.wb-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-clamp2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wb-link { color: var(--wb-accent); text-decoration: none; }
.wb-link:hover { text-decoration: underline; }
.wb-switch {
  position: relative; flex: none;
  width: 34px; height: 19px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
  transition: background .16s ease, border-color .16s ease;
}
.wb-switch > i {
  position: absolute; top: 2px; left: 2px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--dsw-alias-label-secondary);
  transition: transform .16s ease, background .16s ease;
}
.wb-switch.is-on { background: var(--wb-accent); border-color: var(--wb-accent); }
.wb-switch.is-on > i { transform: translateX(15px); background: var(--dsw-alias-bg-base); }
.wb-toolgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
.wb-tool {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .14s ease, background .14s ease;
}
.wb-tool:hover { border-color: var(--wb-accent); background: var(--dsw-alias-bg-layer-2); }
.wb-tool strong { font-size: 12.5px; font-weight: 600; }
.wb-tool span { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wb-tool.is-active { border-color: var(--wb-accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--wb-accent) 40%, transparent); }
.wb-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
.wb-split > .wb-col-span-2 { grid-column: 1 / -1; }
@media (max-width: 1080px) {
  .wb-nav { width: 176px; flex-basis: 176px; }
  .wb-split { grid-template-columns: minmax(0, 1fr) !important; }
  .wb-page { padding: 16px 14px 32px; }
}
@media (max-width: 860px) {
  .wb-nav { display: none; }
}
`;

// src/client/core/runtime.ts
var WB = {
  NS: "dev-workbench",
  PANEL_KEY: "dev-workbench",
  inject: ["slots", "locale", "connection", "layout", "uiWorkspace", "sessions"],
  pages: {},
  T,
  ICONS: {},
  PAGE_META: {},
  ORDER: []
};
var wbStore = /* @__PURE__ */ (function() {
  let state = {
    status: "loading",
    error: null,
    data: null,
    busy: false,
    toasts: [],
    page: "dashboard",
    focusTaskId: null,
    taskForm: null,
    /** Transient hand-off from the dashboard to the task center
     *  ({status?|dueFilter?}); the task page consumes it and clears it. */
    taskPreset: null,
    /** 工作台助手：可移除的上下文引用（task / source / radar / knowledge / search） */
    assistantOpen: false,
    assistantRefs: [],
    /** 命令面板 → 搜索页的交接：{query, groups} */
    searchPreset: null
  };
  const listeners = /* @__PURE__ */ new Set();
  return {
    get() {
      return state;
    },
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = Object.assign({}, state, next);
      listeners.forEach(function(fn) {
        try {
          fn();
        } catch (e) {
        }
      });
    },
    subscribe(fn) {
      listeners.add(fn);
      return function() {
        listeners.delete(fn);
      };
    }
  };
})();
function useStore() {
  return React3.useSyncExternalStore(wbStore.subscribe, wbStore.get);
}
var WB_DICT = {
  zh: {
    "app.title": "智能工作台",
    "app.subtitle": "每天的入口",
    "nav.overview": "概览",
    "nav.work": "工作",
    "nav.tools": "工具",
    "nav.dashboard": "今日简报",
    "nav.tasks": "任务中心",
    "nav.search": "搜索",
    "nav.agents": "Agent 中心",
    "nav.collab": "研发协作",
    "nav.radar": "技术雷达",
    "nav.toolbox": "开发工具箱",
    "nav.knowledge": "知识空间",
    "nav.settings": "连接与设置",
    "common.refresh": "刷新",
    "common.new": "新建",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.close": "关闭",
    "common.search": "搜索待办、知识、资讯或命令",
    "common.loading": "加载中…",
    "common.empty": "暂无内容",
    "common.retry": "重试",
    "common.all": "全部",
    "dash.title": "今日简报",
    "tasks.title": "任务中心",
    "agents.title": "Agent 中心",
    "radar.title": "技术雷达",
    "toolbox.title": "开发工具箱",
    "knowledge.title": "知识空间",
    "settings.title": "连接与设置"
  }
};
WB_DICT.en = WB_DICT.zh;
var wbTranslate = function(key2) {
  return key2;
};
WB.t = function(key2, fallback) {
  let value = key2;
  try {
    value = wbTranslate(key2);
  } catch (e) {
    value = key2;
  }
  if (typeof value === "string" && value.length > 0 && value !== key2)
    return value;
  return fallback === void 0 ? key2 : fallback;
};
var wbConnection = null;
var wbUiWorkspace = null;
var wbNativeSessions = null;
var wbLayout = null;
function pickDirectory() {
  if (!wbUiWorkspace || typeof wbUiWorkspace.pickDirectory !== "function") {
    return Promise.resolve(null);
  }
  return Promise.resolve().then(function() {
    return wbUiWorkspace.pickDirectory();
  }).then(function(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }).catch(function() {
    return null;
  });
}
function wbRpc(endpoint, args, signal) {
  if (!wbConnection || !wbConnection.rpc || typeof wbConnection.rpc.call !== "function") {
    return Promise.reject(new Error("与 Host 的连接尚未就绪"));
  }
  return wbConnection.rpc.call("/api", endpoint, { args: args || {} }, signal).then(function(envelope) {
    if (!envelope || envelope.ok !== true) {
      const error = envelope && envelope.error;
      const message = error === void 0 ? "远端调用失败" : String(error && error.message !== void 0 ? error.message : error);
      throw new Error(message);
    }
    return envelope.value;
  });
}
var wbToastSeq = 0;
function toast(text, kind) {
  const id = ++wbToastSeq;
  wbStore.set(function(state) {
    return { toasts: state.toasts.concat([{ id, kind: kind || "info", text: String(text) }]) };
  });
  setTimeout(function() {
    wbStore.set(function(state) {
      return { toasts: state.toasts.filter(function(item) {
        return item.id !== id;
      }) };
    });
  }, kind === "err" ? 6e3 : 3200);
  return id;
}
WB.WORKBENCH_TOOL_NAMES = [
  "workbench_create_task",
  "workbench_update_task",
  "workbench_list_tasks",
  "workbench_task_brief",
  "workbench_record_run",
  "workbench_fetch_radar",
  "workbench_fetch_mentions",
  "workbench_update_radar",
  "workbench_search",
  "workbench_manage_replies",
  "workbench_manage_knowledge",
  "workbench_analyze_messages",
  "workbench_summarize_radar"
];
var assistant = {
  open() {
    wbStore.set({ assistantOpen: true });
  },
  close() {
    wbStore.set({ assistantOpen: false });
  },
  toggle() {
    wbStore.set(function(state) {
      return { assistantOpen: !state.assistantOpen };
    });
  },
  add(ref) {
    if (!ref || !ref.kind)
      return;
    wbStore.set(function(state) {
      const exists = state.assistantRefs.some(function(item) {
        return item.kind === ref.kind && item.id === ref.id;
      });
      return {
        assistantOpen: true,
        assistantRefs: exists ? state.assistantRefs : state.assistantRefs.length >= MAX_ASSISTANT_CONTEXTS ? state.assistantRefs : state.assistantRefs.concat([ref])
      };
    });
  },
  remove(kind, id) {
    wbStore.set(function(state) {
      return {
        assistantRefs: state.assistantRefs.filter(function(item) {
          return !(item.kind === kind && item.id === id);
        })
      };
    });
  },
  clear() {
    wbStore.set({ assistantRefs: [] });
  }
};
function assistantBrief(refs, instruction) {
  const lines = [];
  lines.push("请基于下面的工作台上下文协助我，并在有结论时用 workbench_* 工具写回（创建/更新待办、登记执行记录、写回资讯摘要）。");
  lines.push("");
  refs.forEach(function(ref, index) {
    lines.push("### 上下文 " + (index + 1) + "：" + (ref.label || ref.kind) + " · " + (ref.title || ref.id));
    if (ref.url)
      lines.push("- 链接：" + ref.url);
    if (ref.meta)
      lines.push("- 信息：" + ref.meta);
    if (ref.body) {
      lines.push("- 内容：");
      lines.push(String(ref.body).slice(0, 1200));
    }
    lines.push("");
  });
  lines.push("### 我的要求");
  lines.push(String(instruction || "").trim() || "（在这里补充要求）");
  return lines.join("\n");
}
var wbPendingRequests = 0;
var wbSyncInFlight = null;
function acceptSnapshot(snapshot) {
  const current = wbStore.get().data;
  if (current && Number(snapshot.revision || 0) < Number(current.revision || 0))
    return false;
  wbStore.set({ status: "ready", error: null, data: snapshot });
  return true;
}
function settle(promise, okText) {
  wbPendingRequests += 1;
  wbStore.set({ busy: true });
  return promise.then(function(snapshot) {
    acceptSnapshot(snapshot);
    if (okText)
      toast(okText, "ok");
    return snapshot;
  }).catch(function(e) {
    const message = String(e && e.message || e);
    wbStore.set({ busy: false, error: message });
    toast(message, "err");
    throw e;
  }).finally(function() {
    wbPendingRequests -= 1;
    wbStore.set({ busy: wbPendingRequests > 0 });
  });
}
var wbActions = {
  knowledgeRetrieve(request) {
    return wbRpc("workbench/knowledgeRetrieve", { request });
  },
  knowledgeRead(request) {
    return wbRpc("workbench/knowledgeRead", { request });
  },
  knowledgeTraces(request) {
    return wbRpc("workbench/knowledgeTraces", { request });
  },
  officeWorkflowStart(kind, input) {
    return settle(wbRpc("workbench/officeWorkflowStart", { kind, input }), "已进入办公执行队列");
  },
  officeWorkflowControl(id, action) {
    return settle(wbRpc("workbench/officeWorkflowControl", { id, action }));
  },
  adoptReplyArtifact(jobId, stepId) {
    return settle(wbRpc("workbench/adoptReplyArtifact", { jobId, stepId }), "草稿已保存，尚未发送");
  },
  reload() {
    return settle(wbRpc("workbench/snapshot", {}));
  },
  saveSettings(patch) {
    return settle(wbRpc("workbench/saveSettings", { patch }), "设置已保存");
  },
  createTask(input) {
    return settle(wbRpc("workbench/createTask", { input }), "待办已创建");
  },
  updateTask(id, patch) {
    return settle(wbRpc("workbench/updateTask", { id, patch }));
  },
  deleteTask(id) {
    return settle(wbRpc("workbench/deleteTask", { id }), "待办已删除");
  },
  addSource(input) {
    return settle(wbRpc("workbench/addSource", { input }));
  },
  createKnowledge(input) {
    const before = wbStore.get().data && wbStore.get().data.knowledge || [];
    return settle(wbRpc("workbench/createKnowledge", { input })).then(function(snapshot) {
      const after = snapshot && snapshot.knowledge || [];
      if (after.length === before.length)
        WB.toast("这条已经收藏过了，未重复添加", "info");
      else
        WB.toast("已收藏", "ok");
      return snapshot;
    });
  },
  updateKnowledge(id, patch) {
    return settle(wbRpc("workbench/updateKnowledge", { id, patch }), "知识条目已更新");
  },
  deleteKnowledge(id) {
    return settle(wbRpc("workbench/deleteKnowledge", { id }), "已删除");
  },
  saveRadarItem(input) {
    return settle(wbRpc("workbench/saveRadarItem", { input }));
  },
  deleteRadarItem(id) {
    return settle(wbRpc("workbench/deleteRadarItem", { id }), "已移除");
  },
  recordRun(input) {
    return settle(wbRpc("workbench/recordRun", { input }), "已登记执行记录");
  },
  updateRun(id, patch) {
    return settle(wbRpc("workbench/updateRun", { id, patch }));
  },
  reset(scope) {
    return settle(wbRpc("workbench/reset", { scope: scope || "all" }), "数据已重置");
  },
  seedDemo() {
    return settle(wbRpc("workbench/seedDemo", {}), "已载入示例数据");
  },
  saveProject(input) {
    return settle(wbRpc("workbench/saveProject", { input }), "项目已保存");
  },
  deleteProject(id) {
    return settle(wbRpc("workbench/deleteProject", { id }), "项目已删除");
  },
  /** Pull @-mention messages through yzj-cli; report lands in data.lastMentionsFetch.
   *  Zero-parameter endpoint: the gateway strictly validates arg fields against
   *  the descriptor, so the payload must be exactly {}. */
  fetchMentions() {
    return settle(wbRpc("workbench/fetchMentions", {}), "@我 消息已拉取");
  },
  /** Fetch the configured RSS/Atom feeds; the report lands in data.lastRadarFetch.
   *  Zero-parameter endpoint — payload must be exactly {} (see fetchMentions). */
  fetchRadar() {
    return settle(wbRpc("workbench/fetchRadar", {}), "抓取完成");
  },
  /** Turn one radar item into a real task with its source evidence attached. */
  createTaskFromRadar(id) {
    return settle(wbRpc("workbench/createTaskFromRadar", { id }), "已生成实践任务");
  },
  addFeed(input) {
    const snapshot = wbStore.get().data;
    const current = snapshot && snapshot.settings && snapshot.settings.feeds || [];
    const url = String(input && input.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      WB.toast("资讯源地址必须是 http(s) URL", "err");
      return Promise.reject(new Error("invalid feed url"));
    }
    const next = current.filter(function(feed) {
      return feed.url !== url;
    }).concat([
      {
        id: WB.util.uid("feed"),
        label: String(input && input.label || "").trim() || url.replace(/^https?:\/\//, "").slice(0, 60),
        url,
        topics: input && input.topics || []
      }
    ]).slice(0, 12);
    return settle(wbRpc("workbench/saveSettings", { patch: { feeds: next } }), "资讯源已添加");
  },
  deleteFeed(id) {
    const snapshot = wbStore.get().data;
    const current = snapshot && snapshot.settings && snapshot.settings.feeds || [];
    const next = current.filter(function(feed) {
      return feed.id !== id;
    });
    return settle(wbRpc("workbench/saveSettings", { patch: { feeds: next } }), "资讯源已移除");
  },
  /** 规则候选：为尚未提取的 @我 来源生成待确认候选（确定性，无模型）。 */
  extractCandidates() {
    return settle(wbRpc("workbench/extractCandidates", {}), "已生成待确认候选");
  },
  acceptCandidate(id, patch) {
    return settle(wbRpc("workbench/acceptCandidate", { id, patch: patch || {} }), "已采纳为待办");
  },
  rejectCandidate(id) {
    return settle(wbRpc("workbench/rejectCandidate", { id }), "已忽略该候选");
  },
  /** Unified search. Returns {query, at, total, groups[]} — NOT a snapshot. */
  search(query, options) {
    return wbRpc("workbench/search", {
      request: { query, includeWeb: !options || options.includeWeb !== false }
    });
  },
  /** Read-only engineering environment: git status per project + docker ps. */
  environment() {
    return wbRpc("workbench/environment", {});
  },
  /** GitHub 只读快照（PR / CI）。 */
  github() {
    return wbRpc("workbench/github", {});
  },
  /**
   * 自动同步：只比对业务修订号，变新才重取快照；正在编辑表单时跳过，
   * 避免后台刷新打断输入（TODO 08）。
   */
  syncCheck() {
    if (wbSyncInFlight) return wbSyncInFlight;
    const store = wbStore.get();
    const current = store.data;
    if (!current)
      return Promise.resolve(false);
    if (store.taskForm)
      return Promise.resolve(false);
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("同步超时，稍后重试"));
      }, 15e3);
    });
    wbSyncInFlight = (async () => {
      const info = await Promise.race([wbRpc("workbench/revision", {}, controller.signal), timeout]);
      if (!info || Number(info.revision) <= Number(current.revision || 0))
        return false;
      const snapshot = await Promise.race([wbRpc("workbench/snapshot", {}, controller.signal), timeout]);
      acceptSnapshot(snapshot);
      return true;
    })().catch(() => false).finally(() => {
      clearTimeout(timer);
      wbSyncInFlight = null;
    });
    return wbSyncInFlight;
  },
  /** 侧栏助手：向原生会话提交一次问答，返回 {status, reply, toolCalls, note}。 */
  assistantAsk(text, refs, sessionId) {
    return wbRpc("workbench/assistantAsk", {
      request: { text, refs: refs || [], sessionId: sessionId || null }
    });
  },
  /** 只提交提示，立即返回 {sessionId, fromSeq}；配合 assistantDelta 渐进渲染。 */
  assistantSend(text, refs, sessionId, steer, knowledgeMode, knowledgeScope) {
    return wbRpc("workbench/assistantSend", {
      request: { text, refs: refs || [], sessionId: sessionId || null, steer: steer === true, knowledgeMode, ...knowledgeScope || {} }
    });
  },
  /** 增量读取：{entries, nextSeq, turnActive}。 */
  assistantDelta(sessionId, fromSeq, retrievalId) {
    return wbRpc("workbench/assistantDelta", {
      request: { sessionId: sessionId || null, fromSeq: fromSeq || 0, retrievalId }
    });
  },
  /** 按消息 id 取助手回复正文（原生聊天内嵌动作）。 */
  assistantMessage(sessionId, messageId) {
    return wbRpc("workbench/assistantMessage", {
      request: { sessionId: sessionId || null, messageId: messageId || null }
    });
  },
  deleteSource(id) {
    return settle(wbRpc("workbench/deleteSource", { id }), "来源已删除");
  },
  deleteRun(id) {
    return settle(wbRpc("workbench/deleteRun", { id }), "执行记录已删除");
  },
  deleteCandidate(id) {
    return settle(wbRpc("workbench/deleteCandidate", { id }), "候选已删除");
  },
  assistantSessions(limit) {
    return wbRpc("workbench/assistantSessions", { request: { limit: limit || 12 } });
  },
  assistantTranscript(sessionId, limit) {
    return wbRpc("workbench/assistantTranscript", {
      request: { sessionId: sessionId || null, limit: limit || 40 }
    });
  },
  assistantHistory() {
    return wbRpc("workbench/assistantHistory", {});
  },
  assistantReset() {
    return wbRpc("workbench/assistantReset", {});
  },
  analysisRetry(entryId) {
    return settle(wbRpc("workbench/analysisRetry", { entryId }), "已加入重试队列");
  },
  analysisCancel(entryId) {
    return settle(wbRpc("workbench/analysisCancel", { entryId }), "已取消分析");
  },
  analysisStatus() {
    return wbRpc("workbench/analysisStatus", {});
  },
  analyzeRun(limit, onlyIds) {
    return wbRpc("workbench/analysisStart", { request: { limit: limit || wbStore.get().data?.settings?.aiExtract?.batchSize || 5, onlyIds: onlyIds || [] } });
  },
  /** TODO 20：对指定资讯批量生成四段摘要（读原文 → 模型 → 写回卡片）。 */
  radarSummarize(onlyIds, retryFailed) {
    return wbRpc("workbench/radarSummaryStart", { request: { onlyIds: onlyIds || [], retryFailed: retryFailed === true } });
  },
  exportMigration() {
    return wbRpc("workbench/exportMigration", {});
  },
  importMigration(payload, mode, dryRun, mapPaths) {
    return wbRpc("workbench/importMigration", { request: { payload, mode, dryRun: dryRun === true, mapPaths: mapPaths || {} } });
  },
  analyzeConfirm(entryId) {
    return settle(wbRpc("workbench/analyzeConfirm", { entryId }), "已按分析登记待办");
  },
  automationRun() {
    return wbRpc("workbench/automationRun", {});
  },
  /** TODO 16：人工推进回复阶段（AI 不得覆盖人工设置）。 */
  setReplyStage(id, stage) {
    return settle(wbRpc("workbench/setReplyStage", { id, stage }), "回复阶段：" + stage);
  },
  taskMarkHuman(id, mark) {
    return settle(wbRpc("workbench/taskMarkHuman", { id, mark: mark || {} }), "已记录人工处置");
  },
  automationStatus() {
    return wbRpc("workbench/automationStatus", {});
  },
  backup() {
    return wbRpc("workbench/backup", {});
  },
  backups() {
    return wbRpc("workbench/backups", {});
  },
  restoreBackup(id) {
    return settle(wbRpc("workbench/restoreBackup", { id }), "已从备份恢复");
  },
  diagnostics() {
    return wbRpc("workbench/diagnostics", {});
  }
};
WB.ICONS = Object.keys(WB_ICON_PATHS);
WB.openTaskForm = function(task, defaults) {
  wbStore.set({ assistantOpen: false, contextHidden: false, taskForm: { open: true, task: task || null, defaults: defaults || null } });
};
WB.focusTask = function(id) {
  wbStore.set({ page: "tasks", focusTaskId: id });
};
WB.TASK_STATUS = {
  draft: { label: "草稿", tone: "idle", order: 0 },
  ready: { label: "待处理", tone: "accent", order: 1 },
  running: { label: "执行中", tone: "warn", order: 2 },
  waiting_approval: { label: "待审批", tone: "warn", order: 3 },
  completed: { label: "已完成", tone: "ok", order: 4 },
  failed: { label: "失败", tone: "err", order: 5 },
  cancelled: { label: "已取消", tone: "idle", order: 6 }
};
WB.TASK_PRIORITY = {
  urgent: { label: "紧急", tone: "err", rank: 4 },
  high: { label: "高", tone: "warn", rank: 3 },
  normal: { label: "普通", tone: "idle", rank: 2 },
  low: { label: "低", tone: "idle", rank: 1 }
};
WB.RUN_STATUS = {
  queued: { label: "排队中", tone: "idle" },
  running: { label: "运行中", tone: "warn" },
  waiting_approval: { label: "待审批", tone: "warn" },
  completed: { label: "已完成", tone: "ok" },
  failed: { label: "失败", tone: "err" },
  cancelled: { label: "已取消", tone: "idle" }
};
WB.connectorState = function(authState) {
  if (WB.CONNECTOR_STATE[authState])
    return WB.CONNECTOR_STATE[authState];
  return { label: String(authState || "未知"), tone: "idle", unknown: true };
};
WB.CONNECTOR_STATE = {
  ok: { label: "已连接", tone: "ok" },
  unconfigured: { label: "未配置", tone: "idle" },
  error: { label: "异常", tone: "err" },
  unauthorized: { label: "待授权", tone: "warn" }
};
WB.openTasks = function(data) {
  if (!data || !Array.isArray(data.tasks))
    return [];
  return data.tasks.filter(function(task) {
    return task.status !== "completed" && task.status !== "cancelled";
  });
};
WB.dueSoon = function(data, hours) {
  const horizon = Date.now() + (hours || 48) * 3600 * 1e3;
  return WB.openTasks(data).filter(function(task) {
    const due = task.dueAt || task.meetingStart ? new Date(task.dueAt || task.meetingStart).getTime() : null;
    return due !== null && !Number.isNaN(due) && due <= horizon;
  });
};
WB.taskCounts = function(data) {
  const counts = { total: 0, open: 0, overdue: 0, today: 0, completed: 0, running: 0 };
  const tasks = data && data.tasks || [];
  const endOfDay = /* @__PURE__ */ new Date();
  endOfDay.setHours(23, 59, 59, 999);
  tasks.forEach(function(task) {
    counts.total += 1;
    if (task.status === "completed")
      counts.completed += 1;
    else if (task.status === "cancelled") {
    } else
      counts.open += 1;
    if (task.status === "running")
      counts.running += 1;
    if ((task.dueAt || task.meetingStart) && task.status !== "completed" && task.status !== "cancelled") {
      const due = new Date(task.dueAt || task.meetingStart).getTime();
      if (!Number.isNaN(due)) {
        if (due < Date.now())
          counts.overdue += 1;
        else if (due <= endOfDay.getTime())
          counts.today += 1;
      }
    }
  });
  return counts;
};
WB.actions = wbActions;
WB.store = wbStore;
WB.useStore = useStore;
WB.useWorkbench = function() {
  return useStore();
};
WB.setSearchPreset = function(preset) {
  wbStore.set({ searchPreset: preset || null });
};
WB.clearSearchPreset = function() {
  wbStore.set({ searchPreset: null });
};
WB.toast = toast;
WB.assistant = assistant;
WB.assistantBrief = assistantBrief;
WB.pickDirectory = pickDirectory;
WB.setUiWorkspace = function(value) {
  wbUiWorkspace = value || null;
};
WB.setLayout = function(value) {
  wbLayout = value || null;
};
WB.setNativeSessions = function(value) {
  wbNativeSessions = value || null;
};
WB.openSessionById = function(sessionId) {
  if (!sessionId) return false;
  try {
    if (typeof wbNativeSessions?.open === "function") wbNativeSessions.open(sessionId);
    else if (typeof wbUiWorkspace?.openSession === "function") wbUiWorkspace.openSession(sessionId);
    else return false;
    return true;
  } catch {
    return false;
  }
};
WB.openConversation = function() {
  if (!wbLayout || typeof wbLayout.selectPanel !== "function")
    return false;
  try {
    wbLayout.selectPanel(null);
    return true;
  } catch (e) {
    return false;
  }
};
WB.rpc = wbRpc;
WB.fmt = fmt;
WB.util = util;
WB.Icon = Icon;
WB.ui = {
  Panel,
  PageHead,
  Stat,
  Btn,
  IconBtn,
  Badge,
  Chip,
  Field,
  Input,
  Textarea,
  Select,
  Toggle,
  Segmented,
  Tabs,
  Empty,
  Spinner,
  Progress,
  Kbd,
  Modal,
  Divider
};
WB.cn = function() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
};
function setShared_wbConnection(value) {
  return wbConnection = value;
}
function setShared_wbTranslate(value) {
  return wbTranslate = value;
}

// src/client/components/KnowledgeSources.tsx
var React4 = __toESM(require("react"), 1);
function KnowledgeSources({ result, audit, provided = false }) {
  const [selected, setSelected] = React4.useState(null), [error, setError] = React4.useState("");
  React4.useEffect(() => {
    setError("");
    setSelected(null);
  }, [result?.id]);
  if (!result || result.status === "off") return null;
  async function read(hit) {
    setError("");
    try {
      const rows = await WB.actions.knowledgeRead({ ids: [hit.id], scope: result.scope });
      setSelected(rows.hits[0]);
    } catch (e) {
      setError(e.message || "原文读取失败，可能已更新或失效");
    }
  }
  return /* @__PURE__ */ React4.createElement("section", { "aria-label": "知识检索依据", style: { margin: "8px 0", padding: 8, border: "1px solid " + WB.T.border1, borderRadius: 8, fontSize: 12, minWidth: 0 } }, /* @__PURE__ */ React4.createElement("details", null, /* @__PURE__ */ React4.createElement("summary", { style: { cursor: "pointer", overflowWrap: "anywhere" } }, "知识依据 · ", result.hits?.length || 0, " 个片段 · ", result.status === "ok" ? provided ? "已提供给模型" : "检索命中" : result.note || "未命中"), /* @__PURE__ */ React4.createElement("p", { className: "wb-muted", style: { overflowWrap: "anywhere" } }, "查询：", result.query, " · ", result.strategy, " · ", result.elapsedMs, "ms"), (result.hits || []).map((h2) => /* @__PURE__ */ React4.createElement("div", { key: h2.id, style: { marginTop: 6, overflowWrap: "anywhere" } }, /* @__PURE__ */ React4.createElement(Btn, { size: "sm", onClick: () => read(h2) }, h2.title, " · 行", h2.lineStart, "–", h2.lineEnd), /* @__PURE__ */ React4.createElement("div", { className: "wb-tiny wb-muted" }, h2.id))), !!audit?.stale?.length && /* @__PURE__ */ React4.createElement("p", { role: "alert" }, "回答期间知识已更新或失效，请重新检索后核对。"), !!audit?.invalid?.length && /* @__PURE__ */ React4.createElement("p", { role: "alert" }, "回答包含无效知识引用，请勿将其作为原文依据。"), audit?.missing && /* @__PURE__ */ React4.createElement("p", { role: "status" }, "已提供知识，但模型未标注知识引用，请核对回答与原文。")), error && /* @__PURE__ */ React4.createElement("p", { role: "alert" }, error), /* @__PURE__ */ React4.createElement(Modal, { open: !!selected, title: selected?.title || "知识原文", onClose: () => setSelected(null) }, selected && /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement("p", { className: "wb-muted wb-tiny" }, "知识版本 ", selected.version, " · 行", selected.lineStart, "–", selected.lineEnd), /* @__PURE__ */ React4.createElement("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" } }, selected.text), selected.url && /* @__PURE__ */ React4.createElement("a", { href: selected.url, target: "_blank", rel: "noreferrer" }, "打开来源"))));
}

// src/client/components/AssistantContextPicker.tsx
var React5 = __toESM(require("react"), 1);
function AssistantContextPicker({ data, refs }) {
  const [open, setOpen] = React5.useState(false), [query, setQuery] = React5.useState("");
  const groups = [["task", "待办", "tasks"], ["source", "消息", "sources"], ["radar", "资讯", "radar"], ["knowledge", "知识", "knowledge"]];
  const candidates = groups.flatMap(([kind, label, key2]) => (data?.[key2] || []).map((row) => ({ kind, id: row.id, title: row.title || row.excerpt || label, body: row.excerpt || row.description || row.content || row.body || JSON.stringify(row.summary || {}), meta: label + " · " + (row.status || row.stage || ""), url: row.url })));
  const selected = (ref) => refs.some((item) => item.kind === ref.kind && item.id === ref.id);
  const matches = candidates.filter((ref) => (ref.title + " " + ref.meta).toLowerCase().includes(query.toLowerCase()));
  return /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("div", { className: "wb-row", style: { gap: 6, flexWrap: "wrap" } }, /* @__PURE__ */ React5.createElement(Btn, { size: "sm", icon: "plus", onClick: () => setOpen(!open), "aria-expanded": open }, open ? "收起上下文" : "添加上下文"), /* @__PURE__ */ React5.createElement("span", { className: "wb-tiny wb-muted" }, "已选 ", refs.length, "/", MAX_ASSISTANT_CONTEXTS), refs.length > 0 && /* @__PURE__ */ React5.createElement(Btn, { size: "sm", onClick: () => WB.assistant.clear() }, "清空上下文")), open && /* @__PURE__ */ React5.createElement("div", { role: "region", "aria-label": "选择上下文", style: { marginTop: 8, padding: 8, border: "1px solid " + T.border1, borderRadius: 8, background: T.layer1 } }, /* @__PURE__ */ React5.createElement(Input, { "aria-label": "搜索上下文", placeholder: "搜索待办、消息、资讯或知识", value: query, onChange: (e) => setQuery(e.target.value) }), /* @__PURE__ */ React5.createElement("div", { style: { maxHeight: 180, overflow: "auto", marginTop: 6 } }, matches.slice(0, 40).map((ref) => /* @__PURE__ */ React5.createElement("button", { type: "button", className: "wb-context-option", key: ref.kind + ":" + ref.id, "aria-pressed": selected(ref), disabled: !selected(ref) && refs.length >= MAX_ASSISTANT_CONTEXTS, onClick: () => selected(ref) ? WB.assistant.remove(ref.kind, ref.id) : WB.assistant.add(ref) }, /* @__PURE__ */ React5.createElement("span", null, selected(ref) ? "✓ " : "+ ", ref.meta, " · ", WB.util.truncate(ref.title, 46)))), !matches.length && /* @__PURE__ */ React5.createElement("p", { className: "wb-tiny wb-muted" }, "没有匹配的内容"), matches.length > 40 && /* @__PURE__ */ React5.createElement("p", { className: "wb-tiny wb-muted" }, "还有 ", matches.length - 40, " 条，请输入关键词缩小范围")), /* @__PURE__ */ React5.createElement("p", { className: "wb-tiny wb-muted" }, "移除仅影响后续发送；已发送的会话历史仍保留。")));
}

// src/client/shell/workbench-shell.ts
var React13 = __toESM(require("react"), 1);

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/visit.js
var BREAK = /* @__PURE__ */ Symbol("break visit");
var SKIP = /* @__PURE__ */ Symbol("skip children");
var REMOVE = /* @__PURE__ */ Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key2, node, visitor, path) {
  const ctrl = callVisitor(key2, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key2, path, ctrl);
    return visit_(key2, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = visit_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = visit_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key2, node, visitor, path) {
  const ctrl = await callVisitor(key2, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key2, path, ctrl);
    return visitAsync_(key2, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = await visitAsync_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key2, node, visitor, path) {
  if (typeof visitor === "function")
    return visitor(key2, node, path);
  if (isMap(node))
    return visitor.Map?.(key2, node, path);
  if (isSeq(node))
    return visitor.Seq?.(key2, node, path);
  if (isPair(node))
    return visitor.Pair?.(key2, node, path);
  if (isScalar(node))
    return visitor.Scalar?.(key2, node, path);
  if (isAlias(node))
    return visitor.Alias?.(key2, node, path);
  return void 0;
}
function replaceNode(key2, path, node) {
  const parent = path[path.length - 1];
  if (isCollection(parent)) {
    parent.items[key2] = node;
  } else if (isPair(parent)) {
    if (key2 === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt} parent`);
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line.trim().split(/[ \t]+/);
    const name2 = parts.shift();
    switch (name2) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version] = parts;
        if (version === "1.1" || version === "1.2") {
          this.yaml.version = version;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version);
          onError(6, `Unsupported YAML version ${version}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name2}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error) {
        onError(String(error));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags[node.tag] = true;
      });
      tagNames = Object.keys(tags);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/anchors.js
function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name2 = `${prefix}${i}`;
    if (!exclude.has(name2))
      return name2;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error = new Error("Failed to resolve repeated object (this should not happen)");
          error.source = source;
          throw error;
        }
      }
    },
    sourceObjects
  };
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/applyReviver.js
function applyReviver(reviver, obj, key2, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v0)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v0)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === void 0)
          val.delete(v0);
        else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v0)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key2, val);
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/toJS.js
function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v, i) => toJS(v, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data);
    ctx.onCreate = (res2) => {
      data.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    if (ctx?.maxAliasCount === 0)
      throw new ReferenceError("Alias resolution is disabled");
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    if (found && ctx) {
      const { anchors, doc: doc2, maxAliasCount } = ctx;
      let data = anchors.get(found);
      if (!data) {
        toJS(found, null, ctx);
        data = anchors.get(found);
      }
      if (data?.res === void 0) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc2, found, anchors);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const source = this.resolve(ctx.doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    return ctx.anchors.get(source).res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count)
        count = c;
    }
    return count;
  } else if (isPair(node)) {
    const kc = getAliasCount(doc, node.key, anchors);
    const vc = getAliasCount(doc, node.value, anchors);
    return Math.max(kc, vc);
  }
  return 1;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter((t) => t.tag === tagName);
    const tagObj = match.find((t) => !t.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map2.items.push(value);
    return map2;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema4, path, value) {
  let v = value;
  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      v = /* @__PURE__ */ new Map([[k, v]]);
    }
  }
  return createNode(v, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path, value) {
    if (isEmptyPath(path))
      this.add(value);
    else {
      const [key2, ...rest] = path;
      const node = this.get(key2, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key2, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    const [key2, ...rest] = path;
    if (rest.length === 0)
      return this.delete(key2);
    const node = this.get(key2, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    const [key2, ...rest] = path;
    const node = this.get(key2, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path) {
    const [key2, ...rest] = path;
    if (rest.length === 0)
      return this.has(key2);
    const node = this.get(key2, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    const [key2, ...rest] = path;
    if (rest.length === 0) {
      this.set(key2, value);
    } else {
      const node = this.get(key2, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key2, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
    }
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyComment.js
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
  if (/^\n+$/.test(comment))
    return comment.substring(1);
  return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep)
    return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text, i, indent.length);
      end = i + indent.length + endStep;
      split = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split = i;
      }
      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text;
  if (onFold)
    onFold();
  let res = text.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text.length;
    if (fold === 0)
      res = `
${indent}${text.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text[fold]}\\`;
      res += `
${indent}${text.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text[++i];
    } else {
      do {
        ch = text[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text[start];
    }
  }
  return end;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code = json.substr(i + 2, 4);
            switch (code) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code.substr(0, 2) === "00")
                  str += "\\x" + code.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs;
  if (singleQuote === false)
    qs = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs = doubleQuotedString;
    else
      qs = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header = (startWithSpace ? indentSize : "") + chomp;
  if (comment) {
    header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags } = ctx.doc.schema;
    if (tags.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t);
    if (res === null)
      throw new Error(`Unsupported default string type ${t}`);
  }
  return res;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trailingComma: false,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags, item) {
  if (item.tag) {
    const match = tags.filter((t) => t.tag === item.tag);
    if (match.length > 0)
      return match.find((t) => t.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags.filter((t) => t.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t) => t.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
  } else {
    obj = item;
    tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
  }
  if (!tagObj) {
    const name2 = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name2} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key: key2, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key2) && key2.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key2) || !isNode(key2) && typeof key2 === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key2 || keyComment && value == null && !ctx.inFlow || isCollection(key2) || (isScalar(key2) ? key2.type === Scalar.BLOCK_FOLDED || key2.type === Scalar.BLOCK_LITERAL : typeof key2 === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key2, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws = " ";
  if (keyComment || vsb || vcb) {
    ws = vsb ? "\n" : "";
    if (vcb) {
      const cs = commentString(vcb);
      ws += `
${indentComment(cs, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws === "\n" && valueComment)
        ws = "\n\n";
    } else {
      ws += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws = "";
  }
  str += ws + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key2) => (merge.identify(key2) || isScalar(key2) && (!key2.type || key2.type === Scalar.PLAIN) && merge.identify(key2.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (isSeq(source))
    for (const it of source.items)
      mergeValue(ctx, map2, it);
  else if (Array.isArray(source))
    for (const it of source)
      mergeValue(ctx, map2, it);
  else
    mergeValue(ctx, map2, source);
}
function mergeValue(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key2, value2] of srcMap) {
    if (map2 instanceof Map) {
      if (!map2.has(key2))
        map2.set(key2, value2);
    } else if (map2 instanceof Set) {
      map2.add(key2);
    } else if (!Object.prototype.hasOwnProperty.call(map2, key2)) {
      Object.defineProperty(map2, key2, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map2;
}
function resolveAliasValue(ctx, value) {
  return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map2, { key: key2, value }) {
  if (isNode(key2) && key2.addToJSMap)
    key2.addToJSMap(ctx, map2, value);
  else if (isMergeKey(ctx, key2))
    addMergeToJSMap(ctx, map2, value);
  else {
    const jsKey = toJS(key2, "", ctx);
    if (map2 instanceof Map) {
      map2.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map2 instanceof Set) {
      map2.add(jsKey);
    } else {
      const stringKey = stringifyKey(key2, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map2)
        Object.defineProperty(map2, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map2[stringKey] = jsValue;
    }
  }
  return map2;
}
function stringifyKey(key2, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key2) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key2.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key2, value, ctx) {
  const k = createNode(key2, void 0, ctx);
  const v = createNode(value, void 0, ctx);
  return new Pair(k, v);
}
var Pair = class _Pair {
  constructor(key2, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key2;
    this.value = value;
  }
  clone(schema4) {
    let { key: key2, value } = this;
    if (isNode(key2))
      key2 = key2.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key2, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
    if (comment2)
      str2 += lineComment(str2, itemIndent, commentString(comment2));
    if (chompKeep && comment2)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      str += line ? `
${indent}${line}` : "\n";
    }
  }
  if (comment) {
    str += "\n" + indentComment(commentString(comment), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment = ik.comment;
      }
    }
    if (comment)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment = null);
    reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
    if (i < items.length - 1) {
      str += ",";
    } else if (ctx.options.trailingComma) {
      if (ctx.options.lineWidth > 0) {
        reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
      }
      if (reqNewline) {
        str += ",";
      }
    }
    if (comment)
      str += lineComment(str, itemIndent, commentString(comment));
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line of lines)
        str += line ? `
${indentStep}${indent}${line}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
  if (comment && chompKeep)
    comment = comment.replace(/^\n+/, "");
  if (comment) {
    const ic = indentComment(commentString(comment), indent);
    lines.push(ic.trimStart());
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key2) {
  const k = isScalar(key2) ? key2.value : key2;
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key2 || it.key === k)
        return it;
      if (isScalar(it.key) && it.key.value === k)
        return it;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map2 = new this(schema4);
    const add = (key2, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key2, value);
      else if (Array.isArray(replacer) && !replacer.includes(key2))
        return;
      if (value !== void 0 || keepUndefined)
        map2.items.push(createPair(key2, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key2, value] of obj)
        add(key2, value);
    } else if (obj && typeof obj === "object") {
      for (const key2 of Object.keys(obj))
        add(key2, obj[key2]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map2.items.sort(schema4.sortMapEntries);
    }
    return map2;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key2) {
    const it = findPair(this.items, key2);
    if (!it)
      return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }
  get(key2, keepScalar) {
    const it = findPair(this.items, key2);
    const node = it?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key2) {
    return !!findPair(this.items, key2);
  }
  set(key2, value) {
    this.add(new Pair(key2, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type) {
    const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const item of this.items)
      addPairToJSMap(ctx, map2, item);
    return map2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/map.js
var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map2, onError) {
    if (!isMap(map2))
      onError("Expected a mapping for this tag");
    return map2;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key2) {
    const idx = asItemIndex(key2);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key2, keepScalar) {
    const idx = asItemIndex(key2);
    if (typeof idx !== "number")
      return void 0;
    const it = this.items[idx];
    return !keepScalar && isScalar(it) ? it.value : it;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key2) {
    const idx = asItemIndex(key2);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key2, value) {
    const idx = asItemIndex(key2);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key2}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it of obj) {
        if (typeof replacer === "function") {
          const key2 = obj instanceof Set ? it : String(i++);
          it = replacer.call(obj, key2, it);
        }
        seq2.items.push(createNode(it, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key2) {
  let idx = isScalar(key2) ? key2.value : key2;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/string.js
var string = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/core/schema.js
var schema = [
  map,
  seq,
  string,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn = pair.value ?? pair.key;
          cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it of iterable) {
      if (typeof replacer === "function")
        it = replacer.call(iterable, String(i++), it);
      let key2, value;
      if (Array.isArray(it)) {
        if (it.length === 2) {
          key2 = it[0];
          value = it[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);
        if (keys.length === 1) {
          key2 = keys[0];
          value = it[key2];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key2 = it;
      }
      pairs2.items.push(createPair(key2, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map2 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const pair of this.items) {
      let key2, value;
      if (isPair(pair)) {
        key2 = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key2, ctx);
      } else {
        key2 = toJS(pair, "", ctx);
      }
      if (map2.has(key2))
        throw new Error("Ordered maps must not include duplicate keys");
      map2.set(key2, value);
    }
    return map2;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key: key2 } of pairs2.items) {
      if (isScalar(key2)) {
        if (seenKeys.includes(key2.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key2.value}`);
        } else {
          seenKeys.push(key2.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key2) {
    let pair;
    if (isPair(key2))
      pair = key2;
    else if (key2 && typeof key2 === "object" && "key" in key2 && "value" in key2 && key2.value === null)
      pair = new Pair(key2.key, null);
    else
      pair = new Pair(key2, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key2, keepPair) {
    const pair = findPair(this.items, key2);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key2, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key2);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key2));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map2, onError) {
    if (isMap(map2)) {
      if (map2.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map2);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map2;
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema3 = [
  map,
  seq,
  string,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags = schemaTags;
  if (!tags) {
    if (Array.isArray(customTags))
      tags = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key2) => key2 !== "yaml11").map((key2) => JSON.stringify(key2)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags = tags.concat(tag);
  } else if (typeof customTags === "function") {
    tags = customTags(tags.slice());
  }
  if (addMergeTag)
    tags = tags.concat(merge);
  return tags.reduce((tags2, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key2) => JSON.stringify(key2)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags2.includes(tagObj))
      tags2.push(tagObj);
    return tags2;
  }, []);
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs = commentString(doc.comment);
      if (cs.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs, ""));
      } else {
        lines.push(`... ${cs}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc = doc.comment;
    if (dc && chompKeep)
      dc = dc.replace(/^\n+/, "");
    if (dc) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc), ""));
    }
  }
  return lines.join("\n") + "\n";
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/doc/Document.js
var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version });
    this.setSchema(version, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name2) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name2 || prev.has(name2) ? findNewAnchor(name2 || "a", prev) : name2;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key2, value, options = {}) {
    const k = this.createNode(key2, null, options);
    const v = this.createNode(value, null, options);
    return new Pair(k, v);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key2) {
    return assertCollection(this.contents) ? this.contents.delete(key2) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key2, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key2, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    if (isEmptyPath(path))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key2) {
    return isCollection(this.contents) ? this.contents.has(key2) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path) {
    if (isEmptyPath(path))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key2, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key2], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key2, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    if (isEmptyPath(path)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version, options = {}) {
    if (typeof version === "number")
      version = String(version);
    let opt;
    switch (version) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version;
        else
          this.directives = new Directives({ version });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
  constructor(name2, pos, code, message) {
    super();
    this.name = name2;
    this.code = code;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLParseError", pos, code, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code, message) {
    super("YAMLWarning", pos, code, message);
  }
};
var prettifyError = (src, lc) => (error) => {
  if (error.pos[0] === -1)
    return;
  error.linePos = error.pos.map((pos) => lc.linePos(pos));
  const { line, col } = error.linePos[0];
  error.message += ` at line ${line}, column ${col}`;
  let ci = col - 1;
  let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
  if (ci >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci - 39, lineStr.length - 79);
    lineStr = "…" + lineStr.substring(trimStart);
    ci -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "…";
  if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
    let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "…\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count = 1;
    const end = error.linePos[1];
    if (end?.line === line && end.col > col) {
      count = Math.max(1, Math.min(end.col - col, 80 - ci));
    }
    const pointer = " ".repeat(ci) + "^".repeat(count);
    error.message += `:

${lineStr}
${pointer}
`;
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment)
          comment = cb;
        else
          comment += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment)
            comment += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      // else fallthrough
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key2) {
  if (!key2)
    return null;
  switch (key2.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key2.source.includes("\n"))
        return true;
      if (key2.end) {
        for (const st of key2.end)
          if (st.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it of key2.items) {
        for (const st of it.start)
          if (st.type === "newline")
            return true;
        if (it.sep) {
          for (const st of it.sep)
            if (st.type === "newline")
              return true;
        }
        if (containsNewline(it.key) || containsNewline(it.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc, onError) {
  if (fc?.type === "flow-collection") {
    const end = fc.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key: key2, sep, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key2 ?? sep?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key2) {
        if (key2.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key2 && key2.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map2.comment)
            map2.comment += "\n" + keyProps.comment;
          else
            map2.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key2)) {
        onError(key2 ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key2 ? composeNode2(ctx, key2, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key2, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map2.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key2 || key2.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map2.range = [bm.offset, offset, commentEnd ?? offset];
  return map2;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs.offset;
  let commentEnd = null;
  for (const { start, value } of bs.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs.offset, offset, commentEnd ?? offset];
  return seq2;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
  let comment = "";
  if (end) {
    let hasSpace = false;
    let sep = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += sep + cb;
          sep = "";
          break;
        }
        case "newline":
          if (comment)
            sep += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment, offset };
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
  const isMap2 = fc.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc.offset + fc.start.source.length;
  for (let i = 0; i < fc.items.length; ++i) {
    const collItem = fc.items[i];
    const { start, key: key2, sep, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key2 ?? sep?.[0],
      offset,
      onError,
      parentIndent: fc.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key2))
        onError(
          key2,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st of start) {
          switch (st.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key2 ? composeNode2(ctx, key2, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key2))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep)
            for (const st of sep) {
              if (st === valueProps.found)
                break;
              if (st.type === "newline") {
                onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map2 = coll;
        if (mapIncludes(ctx, map2.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map2.items.push(pair);
      } else {
        const map2 = new YAMLMap(ctx.schema);
        map2.flow = true;
        map2.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map2.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map2);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce, ...ee] = fc.end;
  let cePos = offset;
  if (ce?.source === expectedEnd)
    cePos = ce.offset + ce.source.length;
  else {
    const name2 = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce && ce.source.length !== 1)
      ee.unshift(ce);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc.offset, cePos, end.offset];
  } else {
    coll.range = [fc.offset, cePos, cePos];
  }
  return coll;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl || nl.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
  if (!tag) {
    const kt = ctx.schema.knownTags[tagName];
    if (kt?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
      tag = kt;
    } else {
      if (kt) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar, onError) {
  const start = scalar.offset;
  const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
  if (!header)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar.source ? splitLines(scalar.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content = lines[i][1];
    if (content === "" || content === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header.length;
    if (scalar.source)
      end2 += scalar.source.length;
    return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar.indent + header.indent;
  let offset = scalar.offset + header.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content] = lines[i];
    if (content === "" || content === "\r") {
      if (header.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content] = lines[i];
    offset += indent.length + content.length + 1;
    const crlf = content[content.length - 1] === "\r";
    if (crlf)
      content = content.slice(0, -1);
    if (content && indent.length < trimIndent) {
      const src = header.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
    } else if (indent.length > trimIndent || content[0] === "	") {
      if (sep === " ")
        sep = "\n";
      else if (!prevMoreIndented && sep === "\n")
        sep = "\n\n";
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
      prevMoreIndented = true;
    } else if (content === "") {
      if (sep === "\n")
        value += "\n";
      else
        sep = "\n";
    } else {
      value += sep + content;
      sep = " ";
      prevMoreIndented = false;
    }
  }
  switch (header.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header.length + scalar.source.length;
  return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error === -1)
        error = offset + i;
    }
  }
  if (error !== -1)
    onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      // fallthrough
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      /* istanbul ignore next should not happen */
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts = token.source;
        if (ts && typeof ts === "string")
          length += ts.length;
      }
    }
  }
  return { mode, indent, chomp, comment, length };
}
function splitLines(source) {
  const split = source.split(/\n( *)/);
  const first = split[0];
  const m = first.match(/^( *)/);
  const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split.length; i += 2)
    lines.push([split[i], split[i + 1]]);
  return lines;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar, strict, onError) {
  const { offset, type, source, end } = scalar;
  let _type;
  let value;
  const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    /* istanbul ignore next should not happen */
    default:
      onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re.comment,
    range: [offset, valueEnd, re.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    /* istanbul ignore next should not happen */
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return unfoldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function unfoldLines(source) {
  const line = /(.*?)\r?\n/sy;
  let match = line.exec(source);
  if (!match)
    return source;
  let trimEnd, trimBoth;
  try {
    trimEnd = new RegExp("(?<![ 	])[ 	]+$");
    trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
  } catch {
    trimEnd = /[ \t]+$/;
    trimBoth = /^[ \t]+|[ \t]+$/g;
  }
  let res = match[1].replace(trimEnd, "");
  let sep = " ";
  let pos = line.lastIndex;
  while (match = line.exec(source)) {
    const lm = match[1].replace(trimBoth, "");
    if (lm === "") {
      if (sep === "\n")
        res += sep;
      else
        sep = "\n";
    } else {
      res += sep + lm;
      sep = " ";
    }
    pos = line.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc = escapeCodes[next];
      if (cc)
        res += cc;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = next === "x" ? 2 : next === "u" ? 4 : 8;
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "",
  // Unicode next line
  _: " ",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc = source.substr(offset, length);
  const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
  const code = ok ? parseInt(cc, 16) : NaN;
  try {
    return String.fromCodePoint(code);
  } catch {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar = isScalar(res) ? res : new Scalar(res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar = new Scalar(value);
  }
  scalar.range = range;
  scalar.source = value;
  if (type)
    scalar.type = type;
  if (tagName)
    scalar.tag = tagName;
  if (tag.format)
    scalar.format = tag.format;
  if (comment)
    scalar.comment = comment;
  return scalar;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt = schema4.knownTags[tagName];
  if (kt && !kt.collection) {
    schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
    return kt;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts = directives.tagString(tag.tag);
      const cs = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts} or ${cs}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st = before[i];
      switch (st.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st.source.length;
          continue;
      }
      st = before[++i];
      while (st?.type === "space") {
        offset += st.source.length;
        st = before[++i];
      }
      break;
    }
  }
  return offset;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-node.js
var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      try {
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError(token, "RESOURCE_EXHAUSTION", message);
      }
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      isSrcToken = false;
    }
  }
  node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment;
    else
      node.commentBefore = comment;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    node.comment = comment;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re.offset];
  if (re.comment)
    alias.comment = re.comment;
  return alias;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re = resolveEnd(end, contentEnd, false, onError);
  if (re.comment)
    doc.comment = re.comment;
  doc.range = [offset, contentEnd, re.offset];
  return doc;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code, message));
      else
        this.errors.push(new YAMLParseError(pos, code, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment) {
      const dc = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
      } else if (afterEmptyLine || doc.directives.docStart || !dc) {
        doc.commentBefore = comment;
      } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
        let it = dc.items[0];
        if (isPair(it))
          it = it.key;
        const cb = it.commentBefore;
        it.commentBefore = cb ? `${comment}
${cb}` : comment;
      } else {
        const cb = dc.commentBefore;
        dc.commentBefore = cb ? `${comment}
${cb}` : comment;
      }
    }
    if (afterDoc) {
      for (let i = 0; i < this.errors.length; ++i)
        doc.errors.push(this.errors[i]);
      for (let i = 0; i < this.warnings.length; ++i)
        doc.warnings.push(this.warnings[i]);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error);
        else
          this.doc.errors.push(error);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc = this.doc.comment;
          this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK2 = /* @__PURE__ */ Symbol("break visit");
var SKIP2 = /* @__PURE__ */ Symbol("skip children");
var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path) => {
  let item = cst;
  for (const [field, index] of path) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path) => {
  const parent = visit2.itemAtPath(cst, path.slice(0, -1));
  const field = path[path.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
  let ctrl = visitor(item, path);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK2)
          return BREAK2;
        else if (ci === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/cst.js
var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt = this.buffer.substr(offset, 3);
      if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line = this.getLine();
    if (line === null)
      return this.setNext("stream");
    if (line[0] === BOM) {
      yield* this.pushCount(1);
      line = line.substring(1);
    }
    if (line[0] === "%") {
      let dirEnd = line.length;
      let cs = line.indexOf("#");
      while (cs !== -1) {
        const ch = line[cs - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs - 1;
          break;
        } else {
          cs = line.indexOf("#", cs + 1);
        }
      }
      while (true) {
        const ch = line[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return "block-start";
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line = this.getLine();
    if (line === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line[n]) {
      case "#":
        yield* this.pushCount(line.length - n);
      // fallthrough
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl, sp;
    let indent = -1;
    do {
      nl = yield* this.pushNewline();
      if (nl > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl + sp > 0);
    const line = this.getLine();
    if (line === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      // fallthrough
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl = qb.indexOf("\n", this.pos);
    if (nl !== -1) {
      while (nl !== -1) {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = qb.indexOf("\n", cs);
      }
      if (nl !== -1) {
        end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        // fallthrough
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = this.buffer.indexOf("\n", cs);
      } while (nl !== -1);
      if (nl === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl = this.buffer.length;
      }
    }
    let i = nl + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs = this.continueScalar(i + 1);
          if (cs === -1)
            break;
          i = Math.max(i, cs - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    let n = 0;
    loop: while (true) {
      switch (this.charAt(0)) {
        case "!":
          n += yield* this.pushTag();
          n += yield* this.pushSpaces(true);
          continue loop;
        case "&":
          n += yield* this.pushUntil(isNotAnchorChar);
          n += yield* this.pushSpaces(true);
          continue loop;
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            continue loop;
          }
        }
      }
      break loop;
    }
    return n;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/line-counter.js
var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list, type) {
  for (let i = 0; i < list.length; ++i)
    if (list[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list) {
  for (let i = 0; i < list.length; ++i) {
    switch (list[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it = parent.items[parent.items.length - 1];
      return it.sep ?? it.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    /* istanbul ignore next should not happen */
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
  if (source.length < 1e5)
    Array.prototype.push.apply(target, source);
  else
    for (let i = 0; i < source.length; ++i)
      target.push(source[i]);
}
function fixFlowSeqItems(fc) {
  if (fc.start.type === "flow-seq-start") {
    for (const it of fc.items) {
      if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
        if (it.key)
          it.value = it.key;
        delete it.key;
        if (isFlowToken(it.value)) {
          if (it.value.end)
            arrayPushArray(it.value.end, it.sep);
          else
            it.value.end = it.sep;
        } else
          arrayPushArray(it.start, it.sep);
        delete it.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error) {
    const token = error ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it = top.items[top.items.length - 1];
          if (it.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it.sep) {
            it.value = token;
          } else {
            Object.assign(it, { key: token, sep: [] });
            this.onKeyLine = !it.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it = top.items[top.items.length - 1];
          if (it.value)
            top.items.push({ start: [], value: token });
          else
            it.value = token;
          break;
        }
        case "flow-collection": {
          const it = top.items[top.items.length - 1];
          if (!it || it.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it.sep)
            it.value = token;
          else
            Object.assign(it, { key: token, sep: [] });
          return;
        }
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep;
      if (scalar.end) {
        sep = scalar.end;
        sep.push(this.sourceToken);
        delete scalar.end;
      } else
        sep = [this.sourceToken];
      const map2 = {
        type: "block-map",
        offset: scalar.offset,
        indent: scalar.indent,
        items: [{ start, key: scalar, sep }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map2;
    } else
      yield* this.lineEnd(scalar);
  }
  *blockScalar(scalar) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        yield* this.pop();
        break;
      /* istanbul ignore next should not happen */
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map2) {
    const it = map2.items[map2.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          it.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it.value) {
          map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it.start, map2.indent)) {
            const prev = map2.items[map2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              map2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map2.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
      const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it.sep && !it.value) {
        const nl = [];
        for (let i = 0; i < it.sep.length; ++i) {
          const st = it.sep[i];
          switch (st.type) {
            case "newline":
              nl.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st.indent > map2.indent)
                nl.length = 0;
              break;
            default:
              nl.length = 0;
          }
        }
        if (nl.length >= 2)
          start = it.sep.splice(nl[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start });
            this.onKeyLine = true;
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it.sep && !it.explicitKey) {
            it.start.push(this.sourceToken);
            it.explicitKey = true;
          } else if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it.explicitKey) {
            if (!it.sep) {
              if (includesToken(it.start, "newline")) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it.value) {
              map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it.start);
              const key2 = it.key;
              const sep = it.sep;
              sep.push(this.sourceToken);
              delete it.key;
              delete it.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key: key2, sep }]
              });
            } else if (start.length > 0) {
              it.sep = it.sep.concat(start, this.sourceToken);
            } else {
              it.sep.push(this.sourceToken);
            }
          } else {
            if (!it.sep) {
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            } else if (it.value || atNextItem) {
              map2.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (atNextItem || it.value) {
            map2.items.push({ start, key: fs, sep: [] });
            this.onKeyLine = true;
          } else if (it.sep) {
            this.stack.push(fs);
          } else {
            Object.assign(it, { key: fs, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map2);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map2.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it.value || this.indent <= seq2.indent)
          break;
        it.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it.value || includesToken(it.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc) {
    const it = fc.items[fc.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it || it.sep)
            fc.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it || it.value)
            fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            Object.assign(it, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it || it.value)
            fc.items.push({ start: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            it.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (!it || it.value)
            fc.items.push({ start: [], key: fs, sep: [] });
          else if (it.sep)
            this.stack.push(fs);
          else
            Object.assign(it, { key: fs, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc);
        const sep = fc.end.splice(1, fc.end.length);
        sep.push(this.sourceToken);
        const map2 = {
          type: "block-map",
          offset: fc.offset,
          indent: fc.indent,
          items: [{ start, key: fc, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else {
        yield* this.lineEnd(fc);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl = this.source.indexOf("\n") + 1;
      while (nl !== 0) {
        this.onNewLine(this.offset + nl);
        nl = this.source.indexOf("\n", nl) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st) => st.type === "newline" || st.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      // fallthrough
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}
function stringify3(value, replacer, options) {
  let _replacer = null;
  if (typeof replacer === "function" || Array.isArray(replacer)) {
    _replacer = replacer;
  } else if (options === void 0 && replacer) {
    options = replacer;
  }
  if (typeof options === "string")
    options = options.length;
  if (typeof options === "number") {
    const indent = Math.round(options);
    options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
  }
  if (value === void 0) {
    const { keepUndefined } = options ?? replacer ?? {};
    if (!keepUndefined)
      return void 0;
  }
  if (isDocument(value) && !_replacer)
    return value.toString(options);
  return new Document(value, _replacer, options).toString(options);
}

// src/client/features/toolbox/shared-controls.ts
function toolErrorBlock(props) {
  if (!props.text)
    return null;
  return h("div", {
    role: "alert",
    className: "wb-tiny",
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 6,
      padding: "7px 9px",
      borderRadius: 8,
      border: "1px solid color-mix(in srgb, " + T.err + " 45%, transparent)",
      background: "color-mix(in srgb, " + T.err + " 10%, transparent)",
      color: T.err,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      lineHeight: 1.6
    }
  }, h(Icon, { name: "alert", size: 13 }), h("span", { style: { minWidth: 0 } }, String(props.text)));
}
function toolOutputBlock(props) {
  if (props.text) {
    return h("pre", { className: "wb-code", style: props.style }, String(props.text));
  }
  return h("div", {
    className: "wb-tiny wb-muted",
    style: {
      padding: "10px 12px",
      border: "1px dashed " + T.border1,
      borderRadius: 10,
      lineHeight: 1.6
    }
  }, props.placeholder || "结果会显示在这里");
}
function toolCopyButton(props) {
  const text = props.text ? String(props.text) : "";
  return h(Btn, {
    size: "sm",
    icon: "copy",
    disabled: !text,
    title: props.title || "复制结果",
    onClick: function() {
      if (!text)
        return;
      WB.util.copy(text).then(function() {
        WB.toast("已复制结果到剪贴板", "ok");
      }).catch(function(error) {
        WB.toast(String(error && error.message || error), "err");
      });
    },
    children: props.label || "复制"
  });
}
function toolLocalNote() {
  return h("div", {
    className: "wb-row wb-tiny wb-muted",
    style: {
      gap: 6,
      alignItems: "center",
      marginBottom: 10,
      paddingBottom: 8,
      borderBottom: "1px solid " + T.border1
    }
  }, h(Icon, { name: "lock", size: 12 }), h("span", null, "本地执行 · 全部计算在浏览器内完成，数据不离开浏览器"));
}
function toolMonoStyle(minHeight) {
  return { minHeight: minHeight || 150, fontFamily: T.font.mono, fontSize: 11.5 };
}

// src/client/features/toolbox/tools/yaml.ts
function yamlParse(text) {
  const source = String(text);
  const document2 = parseDocument(source, { uniqueKeys: true, prettyErrors: true, strict: true });
  if (document2.errors.length) throw new Error(document2.errors[0].message);
  if (document2.warnings.length) throw new Error("不支持的 YAML 语义：" + document2.warnings[0].message);
  return document2.toJS({ maxAliasCount: 0 });
}
function yamlEmit(value) {
  return stringify3(value, { indent: 2, lineWidth: 0, aliasDuplicateObjects: false }).trimEnd();
}
function toolYamlPane(props) {
  const value = props.value || {};
  function toJson() {
    const text = String(value.input || "");
    if (!text.trim()) {
      props.patch({ output: "", error: "请先输入 YAML 文本" });
      return;
    }
    try {
      props.patch({ output: JSON.stringify(yamlParse(text), null, 2), error: "" });
    } catch (error) {
      props.patch({ output: "", error: String(error && error.message || error) });
    }
  }
  function toYaml() {
    const text = String(value.input || "");
    if (!text.trim()) {
      props.patch({ output: "", error: "请先输入 JSON 文本" });
      return;
    }
    try {
      props.patch({ output: yamlEmit(JSON.parse(text)), error: "" });
    } catch (error) {
      props.patch({ output: "", error: "JSON 解析失败：" + String(error && error.message || error) });
    }
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "输入（YAML 或 JSON）" }, h(Textarea, {
    value: value.input || "",
    style: toolMonoStyle(210),
    placeholder: "name: dev-workbench\ntags:\n  - offline\n  - browser",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Btn, { size: "sm", kind: "primary", icon: "arrowRight", onClick: toJson, children: "YAML → JSON" }), h(Btn, { size: "sm", icon: "arrowRight", onClick: toYaml, children: "JSON → YAML" }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: "转换结果" }))), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "支持 YAML 1.2 常用结构、嵌套列表与块文本；转换为 JSON 时拒绝别名及未知标签，重复键会明确报错。"));
}

// src/client/features/toolbox/tools/csv.ts
function csvParse(text) {
  const source = String(text).replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(function(cells) {
    return cells.length > 1 || (cells[0] || "").trim().length > 0;
  });
}
function csvCell(value) {
  const text = value === null || value === void 0 ? "" : String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
function csvInfer(text) {
  const raw = String(text).trim();
  if (/^(true|false)$/i.test(raw))
    return raw.toLowerCase() === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(raw))
    return Number(raw);
  if (raw.length === 0)
    return "";
  return text;
}
function toolCsvPane(props) {
  const value = props.value || {};
  const hasHeader = value.header !== false;
  function toJson() {
    const text = String(value.input || "");
    if (!text.trim()) {
      props.patch({ output: "", error: "请先输入 CSV 文本" });
      return;
    }
    try {
      const rows = csvParse(text);
      if (rows.length === 0) {
        props.patch({ output: "", error: "没有解析到任何数据行" });
        return;
      }
      const width = rows.reduce(function(max, cells) {
        return Math.max(max, cells.length);
      }, 0);
      const start = hasHeader ? 1 : 0;
      const headers = hasHeader ? rows[0].map(function(cell, index) {
        const name2 = String(cell || "").trim();
        return name2 || "c" + (index + 1);
      }) : new Array(width).fill(0).map(function(_, index) {
        return "c" + (index + 1);
      });
      const output = rows.slice(start).map(function(cells) {
        const item = {};
        headers.forEach(function(header, index) {
          item[header] = csvInfer(cells[index] === void 0 ? "" : cells[index]);
        });
        return item;
      });
      props.patch({
        output: JSON.stringify(output, null, 2),
        error: "",
        note: (hasHeader ? "含表头" : "无表头") + " · " + output.length + " 行 × " + headers.length + " 列"
      });
    } catch (error) {
      props.patch({ output: "", error: String(error && error.message || error) });
    }
  }
  function toCsv() {
    const text = String(value.input || "");
    if (!text.trim()) {
      props.patch({ output: "", error: "请先输入 JSON 数组" });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed))
        throw new Error("顶层必须是数组（形如 [{...}, {...}]）");
      const keys = [];
      parsed.forEach(function(item) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          Object.keys(item).forEach(function(key2) {
            if (keys.indexOf(key2) < 0)
              keys.push(key2);
          });
        }
      });
      if (keys.length === 0)
        throw new Error("数组里没有可导出的对象字段");
      const lines = [];
      if (hasHeader)
        lines.push(keys.map(csvCell).join(","));
      parsed.forEach(function(item) {
        lines.push(keys.map(function(key2) {
          const cell = item && typeof item === "object" ? item[key2] : "";
          return csvCell(cell === null || cell === void 0 ? "" : cell);
        }).join(","));
      });
      props.patch({ output: lines.join("\n"), error: "", note: parsed.length + " 行 × " + keys.length + " 列" });
    } catch (error) {
      props.patch({ output: "", error: "JSON 解析失败：" + String(error && error.message || error) });
    }
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "输入（CSV 或 JSON 数组）" }, h(Textarea, {
    value: value.input || "",
    style: toolMonoStyle(210),
    placeholder: "name,qps\n网关,2000\n报表,800",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Btn, { size: "sm", kind: "primary", icon: "arrowRight", onClick: toJson, children: "CSV → JSON" }), h(Btn, { size: "sm", icon: "arrowRight", onClick: toCsv, children: "JSON → CSV" }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(Toggle, {
    checked: hasHeader,
    label: "首行是表头",
    onChange: function(next) {
      props.patch({ header: next });
    }
  }), h(toolErrorBlock, { text: value.error }), value.note ? h("div", { className: "wb-tiny wb-muted" }, value.note) : null, h(toolOutputBlock, { text: value.output, placeholder: "转换结果" }))));
}

// src/client/features/toolbox/tools/markdown.ts
var React6 = __toESM(require("react"), 1);
function mdInline(text, keyPrefix) {
  const nodes = [];
  let rest = String(text);
  let key2 = 0;
  const push = function(node) {
    nodes.push(h(React6.Fragment, { key: keyPrefix + "-" + key2++ }, node));
  };
  while (rest.length > 0) {
    let match = /^\*\*([^*]+)\*\*/.exec(rest);
    if (match) {
      push(h("strong", null, match[1]));
      rest = rest.slice(match[0].length);
      continue;
    }
    match = /^`([^`]+)`/.exec(rest);
    if (match) {
      push(h("code", { style: { background: T.layer2, borderRadius: 4, padding: "1px 4px", fontFamily: T.font.mono, fontSize: 11.5 } }, match[1]));
      rest = rest.slice(match[0].length);
      continue;
    }
    match = /^\*([^*]+)\*/.exec(rest);
    if (match) {
      push(h("em", null, match[1]));
      rest = rest.slice(match[0].length);
      continue;
    }
    match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (match) {
      push(h("a", { href: /^https?:\/\//i.test(match[2]) ? match[2] : "#", target: "_blank", rel: "noreferrer noopener", className: "wb-link" }, match[1]));
      rest = rest.slice(match[0].length);
      continue;
    }
    const nextMark = rest.slice(1).search(/[\*`\[]/);
    const take = nextMark < 0 ? rest.length : nextMark + 1;
    push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  return nodes;
}
function mdParse(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lang: fence[1], text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (index < lines.length && (/^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+\.\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph = [];
    while (index < lines.length && !/^\s*$/.test(lines[index]) && !/^(#{1,6})\s+/.test(lines[index]) && !/^```/.test(lines[index]) && !/^>\s?/.test(lines[index]) && !/^\s*[-*+]\s+/.test(lines[index]) && !/^\s*\d+\.\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}
function toolMarkdownPane(props) {
  const value = props.value || {};
  const blocks = mdParse(String(value.input || ""));
  const headingSize = function(level) {
    return [22, 19, 17, 15, 14, 13.5][Math.min(5, level - 1)];
  };
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "Markdown 输入" }, h(Textarea, {
    value: value.input || "",
    style: toolMonoStyle(240),
    placeholder: "# 标题\n\n**加粗** 与 `代码`\n\n- 列表项",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h(Field, { label: "预览" }, h("div", {
    style: {
      minHeight: 240,
      maxHeight: 420,
      overflow: "auto",
      padding: "12px 14px",
      border: "1px solid " + T.border1,
      borderRadius: 10,
      background: T.bg,
      fontSize: 12.5,
      lineHeight: 1.7
    }
  }, blocks.length === 0 ? h("span", { className: "wb-tiny wb-muted" }, "输入 Markdown 后这里显示渲染结果") : blocks.map(function(block, blockIndex) {
    const key2 = "b" + blockIndex;
    if (block.type === "heading") {
      return h("div", {
        key: key2,
        style: {
          fontSize: headingSize(block.level),
          fontWeight: 600,
          margin: blockIndex === 0 ? "0 0 8px" : "14px 0 6px",
          color: T.text
        }
      }, mdInline(block.text, key2));
    }
    if (block.type === "code") {
      return h("pre", { key: key2, className: "wb-code", style: { margin: "8px 0" } }, block.text);
    }
    if (block.type === "hr") {
      return h("hr", { key: key2, className: "wb-divider", style: { margin: "12px 0" } });
    }
    if (block.type === "quote") {
      return h("blockquote", {
        key: key2,
        style: {
          margin: "8px 0",
          padding: "2px 0 2px 10px",
          borderLeft: "3px solid " + T.border2,
          color: T.text2
        }
      }, mdInline(block.text, key2));
    }
    if (block.type === "list") {
      const listTag = block.ordered ? "ol" : "ul";
      return h(listTag, { key: key2, style: { margin: "8px 0", paddingLeft: 22 } }, block.items.map(function(item, itemIndex) {
        return h("li", { key: key2 + "-" + itemIndex, style: { margin: "2px 0" } }, mdInline(item, key2 + "-" + itemIndex));
      }));
    }
    return h("p", { key: key2, style: { margin: "8px 0" } }, mdInline(block.text, key2));
  })))), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "支持标题、粗体/斜体、行内代码、代码块、列表、引用、链接、分割线。预览用 React 元素构造而非 innerHTML，输入里的 HTML 标签会当作纯文本显示。"));
}

// src/client/features/toolbox/tools/http-status.ts
var httpStatusTable = [
  { code: 100, group: "1xx", title: "Continue", meaning: "服务器已收到请求头，等待请求体", cause: "大请求体的两阶段提交", fix: "客户端继续发送 body" },
  { code: 101, group: "1xx", title: "Switching Protocols", meaning: "协议切换", cause: "WebSocket / h2c 升级", fix: "客户端按 Upgrade 响应切换协议" },
  { code: 200, group: "2xx", title: "OK", meaning: "请求成功", cause: "正常响应", fix: "—" },
  { code: 201, group: "2xx", title: "Created", meaning: "资源创建成功", cause: "POST 创建资源", fix: "检查 Location 头" },
  { code: 204, group: "2xx", title: "No Content", meaning: "成功但无响应体", cause: "删除 / 更新无需回包", fix: "不要尝试解析 body" },
  { code: 206, group: "2xx", title: "Partial Content", meaning: "部分内容", cause: "Range 断点续传", fix: "检查 Content-Range" },
  { code: 301, group: "3xx", title: "Moved Permanently", meaning: "永久重定向", cause: "域名或路径永久变更", fix: "更新客户端地址；注意 POST 会变 GET" },
  { code: 302, group: "3xx", title: "Found", meaning: "临时重定向", cause: "登录跳转、灰度跳转", fix: "确认跳转目标是否正常" },
  { code: 304, group: "3xx", title: "Not Modified", meaning: "缓存仍有效", cause: "命中 If-None-Match / If-Modified-Since", fix: "使用本地缓存，属正常" },
  { code: 307, group: "3xx", title: "Temporary Redirect", meaning: "临时重定向且保持方法", cause: "需要保持 POST 的重定向", fix: "跟随 Location，方法不变" },
  { code: 308, group: "3xx", title: "Permanent Redirect", meaning: "永久重定向且保持方法", cause: "接口永久迁移", fix: "更新调用地址" },
  { code: 400, group: "4xx", title: "Bad Request", meaning: "请求语法或参数不合法", cause: "JSON 解析失败、缺必填参数、类型不符", fix: "校验请求体与 Content-Type" },
  { code: 401, group: "4xx", title: "Unauthorized", meaning: "未认证或凭据无效", cause: "Token 过期、未带 Authorization", fix: "重新登录或刷新 Token" },
  { code: 403, group: "4xx", title: "Forbidden", meaning: "已认证但无权限", cause: "角色/ACL 不足、IP 白名单", fix: "检查授权范围而非重新登录" },
  { code: 404, group: "4xx", title: "Not Found", meaning: "资源不存在", cause: "路径拼错、资源已删、网关路由缺失", fix: "核对路径与资源 ID" },
  { code: 405, group: "4xx", title: "Method Not Allowed", meaning: "方法不允许", cause: "用 GET 调了只支持 POST 的接口", fix: "查看 Allow 响应头" },
  { code: 406, group: "4xx", title: "Not Acceptable", meaning: "无法满足 Accept", cause: "只支持 application/json 却要 XML", fix: "调整 Accept 头" },
  { code: 408, group: "4xx", title: "Request Timeout", meaning: "请求超时", cause: "客户端发送过慢、连接被中断", fix: "排查网络与超时配置" },
  { code: 409, group: "4xx", title: "Conflict", meaning: "资源状态冲突", cause: "并发写、唯一键冲突、版本号不匹配", fix: "加乐观锁或重试" },
  { code: 410, group: "4xx", title: "Gone", meaning: "资源已永久移除", cause: "接口下线", fix: "改用新接口" },
  { code: 413, group: "4xx", title: "Payload Too Large", meaning: "请求体过大", cause: "上传文件超限、网关 body 限制", fix: "调大 limit 或分片上传" },
  { code: 414, group: "4xx", title: "URI Too Long", meaning: "URI 过长", cause: "GET 参数过多", fix: "改 POST 或缩短参数" },
  { code: 415, group: "4xx", title: "Unsupported Media Type", meaning: "媒体类型不支持", cause: "漏了 Content-Type: application/json", fix: "补上正确的 Content-Type" },
  { code: 418, group: "4xx", title: "I'm a teapot", meaning: "彩蛋状态码", cause: "约定俗成的玩笑", fix: "—" },
  { code: 422, group: "4xx", title: "Unprocessable Entity", meaning: "语义校验失败", cause: "字段格式对但业务规则不通过", fix: "读响应里的字段级错误" },
  { code: 429, group: "4xx", title: "Too Many Requests", meaning: "触发限流", cause: "QPS 超限、配额用尽", fix: "退避重试；看 Retry-After" },
  { code: 500, group: "5xx", title: "Internal Server Error", meaning: "服务端未捕获异常", cause: "代码抛错、依赖超时未兜底", fix: "查服务端日志与堆栈" },
  { code: 501, group: "5xx", title: "Not Implemented", meaning: "未实现", cause: "方法不支持", fix: "换方法或升级服务" },
  { code: 502, group: "5xx", title: "Bad Gateway", meaning: "网关收到上游非法响应", cause: "上游崩溃、上游返回非 HTTP、端口不通", fix: "查上游服务健康与网关日志" },
  { code: 503, group: "5xx", title: "Service Unavailable", meaning: "服务暂不可用", cause: "实例全部下线、过载保护、发布中", fix: "检查实例与容量" },
  { code: 504, group: "5xx", title: "Gateway Timeout", meaning: "网关等待上游超时", cause: "上游慢查询、连接池耗尽", fix: "排查上游耗时与超时配置" },
  { code: 505, group: "5xx", title: "HTTP Version Not Supported", meaning: "HTTP 版本不支持", cause: "客户端用了过新/过旧协议", fix: "调整协议版本" },
  { code: 507, group: "5xx", title: "Insufficient Storage", meaning: "存储空间不足", cause: "磁盘写满、配额耗尽", fix: "清理磁盘或扩容" },
  { code: 508, group: "5xx", title: "Loop Detected", meaning: "检测到循环", cause: "重定向或代理配置成环", fix: "检查重写规则" }
];
function toolStatusPane(props) {
  const value = props.value || {};
  const group = value.group || "all";
  const query = String(value.query || "").trim();
  const groups = ["all", "2xx", "3xx", "4xx", "5xx"];
  const rows = httpStatusTable.filter(function(row) {
    if (group !== "all" && row.group !== group)
      return false;
    if (!query)
      return true;
    return String(row.code).indexOf(query) >= 0 || row.title.toLowerCase().indexOf(query.toLowerCase()) >= 0 || row.meaning.indexOf(query) >= 0;
  });
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, groups.map(function(item) {
    return h(Chip, {
      key: item,
      active: group === item,
      onClick: function() {
        props.patch({ group: item });
      },
      children: item === "all" ? "全部" : item
    });
  }), h("div", { className: "wb-spacer" }), h(Input, {
    value: value.query || "",
    placeholder: "按状态码 / 名称 / 含义过滤",
    style: { maxWidth: 240 },
    onChange: function(event) {
      props.patch({ query: event.target.value });
    }
  })), rows.length === 0 ? h(Empty, { icon: "info", title: "没有匹配的状态码", hint: "试试输入 404 或 4xx。" }) : h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "码"), h("th", null, "名称"), h("th", null, "含义"), h("th", null, "常见成因"), h("th", null, "排查方向"))), h("tbody", null, rows.map(function(row) {
    return h("tr", { key: row.code }, h("td", null, h(Badge, { tone: row.group === "2xx" ? "ok" : row.group === "3xx" ? "idle" : row.group === "4xx" ? "warn" : "err" }, String(row.code))), h("td", { className: "wb-mono", style: { whiteSpace: "nowrap" } }, row.title), h("td", null, row.meaning), h("td", { className: "wb-muted" }, row.cause), h("td", { className: "wb-muted" }, row.fix));
  }))), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "内置 " + httpStatusTable.length + " 个常见状态码；这里是离线速查表，不发起任何请求。"));
}

// src/client/features/toolbox/tools/shell.ts
var shellCheatsheet = [
  { group: "Docker", cmd: "docker ps -a", desc: "列出全部容器（含已退出）" },
  { group: "Docker", cmd: "docker logs -f --tail 200 <容器>", desc: "跟踪最近 200 行日志" },
  { group: "Docker", cmd: "docker exec -it <容器> sh", desc: "进入容器交互 shell" },
  { group: "Docker", cmd: "docker stats --no-stream", desc: "一次性查看容器 CPU/内存" },
  { group: "Docker", cmd: "docker system df", desc: "查看镜像/容器/卷占用空间" },
  { group: "Docker", cmd: 'docker inspect <容器> --format "{{.State.Status}}"', desc: "只看容器状态" },
  { group: "Compose", cmd: "docker compose ps", desc: "查看 compose 服务状态" },
  { group: "Compose", cmd: "docker compose logs -f --tail 100 <服务>", desc: "跟踪某个服务日志" },
  { group: "Compose", cmd: "docker compose config", desc: "校验并展开 compose 配置" },
  { group: "Compose", cmd: "docker compose up -d --build <服务>", desc: "重建并后台启动某服务" },
  { group: "Linux", cmd: "ps aux | sort -nrk 3 | head -10", desc: "CPU 占用 Top 10" },
  { group: "Linux", cmd: "lsof -i -P -n -sTCP:LISTEN", desc: "列出本机监听端口" },
  { group: "Linux", cmd: "du -sh * | sort -hr | head -10", desc: "当前目录各子项体积 Top 10" },
  { group: "Linux", cmd: "df -h", desc: "磁盘使用率" },
  { group: "Linux", cmd: "netstat -an | grep ESTABLISHED | wc -l", desc: "统计已建立连接数" },
  { group: "日志", cmd: 'grep -n "ERROR" app.log | tail -50', desc: "定位最近错误行" },
  { group: "日志", cmd: 'tail -f app.log | grep -v "health"', desc: "跟踪日志并过滤健康检查" },
  { group: "日志", cmd: "awk '{print $1}' access.log | sort | uniq -c | sort -nr | head", desc: "统计访问来源 Top" },
  { group: "诊断", cmd: 'curl -o /dev/null -s -w "%{http_code} %{time_total}s\\n" <URL>', desc: "只看状态码与耗时" },
  { group: "诊断", cmd: "dig +short <域名>", desc: "快速解析域名" },
  { group: "诊断", cmd: "traceroute -n <目标>", desc: "查看网络路径" },
  { group: "诊断", cmd: "kill -TERM <PID>", desc: "优雅停止进程（先 TERM 再 KILL）" }
];
function toolShellPane(props) {
  const value = props.value || {};
  const query = String(value.query || "").trim().toLowerCase();
  const groups = ["全部", "Docker", "Compose", "Linux", "日志", "诊断"];
  const active = value.group && value.group !== "全部" ? value.group : "全部";
  const rows = shellCheatsheet.filter(function(row) {
    if (active !== "全部" && row.group !== active)
      return false;
    if (!query)
      return true;
    return row.cmd.toLowerCase().indexOf(query) >= 0 || row.desc.indexOf(query) >= 0;
  });
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, groups.map(function(group) {
    return h(Chip, {
      key: group,
      active: active === group,
      onClick: function() {
        props.patch({ group });
      },
      children: group
    });
  }), h("div", { className: "wb-spacer" }), h(Input, {
    value: value.query || "",
    placeholder: "按命令或说明过滤",
    style: { maxWidth: 260 },
    onChange: function(event) {
      props.patch({ query: event.target.value });
    }
  })), rows.length === 0 ? h(Empty, { icon: "search", title: "没有匹配的命令", hint: "换个关键词，或切到「全部」。" }) : h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "分类"), h("th", null, "命令"), h("th", null, "说明"), h("th", null, ""))), h("tbody", null, rows.map(function(row, index) {
    return h("tr", { key: row.cmd + index }, h("td", null, h(Badge, { tone: "idle" }, row.group)), h("td", { className: "wb-mono", style: { overflowWrap: "anywhere" } }, row.cmd), h("td", { className: "wb-muted" }, row.desc), h("td", null, h(toolCopyButton, { text: row.cmd, label: "复制", title: "复制命令" })));
  }))), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "离线速查表：不会执行任何命令。带 <占位> 的请替换为实际容器名/PID/URL。"));
}

// src/client/features/toolbox/tools/sql-plan.ts
var sqlPlanRules = [
  { re: /Seq Scan|全表扫描|table scan/i, level: "warn", tip: "全表扫描：确认过滤字段是否命中索引；小表可忽略。" },
  { re: /type:\s*ALL/i, level: "warn", tip: "type=ALL：MySQL 全表扫描，优先补索引。" },
  { re: /Using filesort|filesort/i, level: "warn", tip: "filesort：排序无法用索引，考虑给 ORDER BY 字段加索引。" },
  { re: /Using temporary|temporary table/i, level: "warn", tip: "临时表：常见于 GROUP BY / DISTINCT / UNION，评估能否用索引消除。" },
  { re: /Nested Loop|嵌套循环/i, level: "info", tip: "嵌套循环：小驱动表时正常；大表连接关注外层行数。" },
  { re: /Hash Join/i, level: "info", tip: "哈希连接：大表等值连接常见且通常可接受。" },
  { re: /Sort\s+\(cost|Sort Method/i, level: "info", tip: "显式排序：注意 work_mem / sort_buffer 是否触发磁盘排序。" },
  { re: /rows=\d{5,}|cost=[\d.]+\.\.[\d.]+e\+?0?[5-9]/i, level: "warn", tip: "预估行数/代价很大：检查统计信息是否过期（ANALYZE）。" },
  { re: /rows=\d+\s+width=\d+/i, level: "info", tip: "扫描行数：对比实际返回行数，差异大说明选择性差。" },
  { re: /index scan|Index Scan|Using index/i, level: "ok", tip: "命中索引：留意是否回表（Using index condition 表示仍需回表）。" },
  { re: /Using index condition|Using where/i, level: "info", tip: "Using where 说明过滤在服务层完成；尽量让条件走索引。" },
  { re: /Bitmap Heap Scan/i, level: "info", tip: "位图堆扫描：多条件组合时常见，回表次数需关注。" },
  { re: /SubPlan|Subquery|DEPENDENT SUBQUERY/i, level: "warn", tip: "相关子查询：可能被逐行执行，考虑改写为 JOIN。" },
  { re: /Buffers:\s*shared hit=\d+\s+read=\d{4,}/i, level: "warn", tip: "物理读很高：数据可能不在缓存，关注冷启动与索引覆盖。" }
];
function toolSqlExplainPane(props) {
  const value = props.value || {};
  const plan = String(value.input || "");
  const hits = plan ? sqlPlanRules.filter(function(rule) {
    return rule.re.test(plan);
  }) : [];
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "粘贴 EXPLAIN / 执行计划文本" }, h(Textarea, {
    value: value.input || "",
    style: toolMonoStyle(240),
    placeholder: "EXPLAIN SELECT ... 的输出，或 PostgreSQL 的 EXPLAIN (ANALYZE, BUFFERS) 结果",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h(Field, { label: "解读（按关键字匹配，不执行 SQL）" }, hits.length === 0 ? h(toolOutputBlock, {
    text: "",
    placeholder: plan ? "没有识别到常见的性能信号（可能计划很健康，或格式不常见）" : "粘贴执行计划后这里给出提示"
  }) : h("div", { className: "wb-stack", style: { gap: 8 } }, hits.map(function(rule, index) {
    const tone = rule.level === "warn" ? "warn" : rule.level === "ok" ? "ok" : "idle";
    return h("div", {
      key: "p" + index,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        border: "1px solid " + T.border1,
        borderRadius: 10,
        background: T.layer1
      }
    }, h(Badge, { tone }, rule.level === "warn" ? "注意" : rule.level === "ok" ? "良好" : "参考"), h("span", { style: { fontSize: 12, lineHeight: 1.65, color: T.text } }, rule.tip));
  })))), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "这是**关键字规则**解读，不是数据库优化器：插件不连接任何数据库、不执行 SQL。真正调优请结合表结构、数据分布与实际耗时。"));
}

// src/client/components/TopNavigation.tsx
var React7 = __toESM(require("react"), 1);
var primary = ["dashboard", "tasks", "replies", "radar", "knowledge", "web-ai"];
function TopNavigation({ page }) {
  const detailsRef = React7.useRef(null);
  React7.useEffect(() => {
    const closeOutside = (event) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target)) details.open = false;
    };
    document.addEventListener?.("pointerdown", closeOutside);
    return () => document.removeEventListener?.("pointerdown", closeOutside);
  }, []);
  const more = WB.ORDER.filter((id) => !primary.includes(id));
  function item(id) {
    const meta = WB.PAGE_META[id];
    return /* @__PURE__ */ React7.createElement("button", { key: id, type: "button", className: "wb-nav-item" + (page === id ? " is-active" : ""), "aria-current": page === id ? "page" : void 0, onClick: (event) => {
      const details = event?.currentTarget?.closest("details");
      if (details) details.open = false;
      WB.go(id);
      WB.store.set({ assistantOpen: false, contextHidden: true });
    } }, /* @__PURE__ */ React7.createElement(Icon, { name: meta.icon, size: 15 }), /* @__PURE__ */ React7.createElement("span", null, meta.title));
  }
  return /* @__PURE__ */ React7.createElement("nav", { className: "wb-topnav", "aria-label": "工作台导航" }, primary.map(item), /* @__PURE__ */ React7.createElement("details", { ref: detailsRef, className: "wb-more" + (more.includes(page) ? " is-active" : ""), onKeyDown: (event) => {
    if (event.key === "Escape") {
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  } }, /* @__PURE__ */ React7.createElement("summary", null, /* @__PURE__ */ React7.createElement("span", null, more.includes(page) ? WB.PAGE_META[page].title : "更多"), /* @__PURE__ */ React7.createElement(Icon, { name: "chevronDown", size: 12 })), /* @__PURE__ */ React7.createElement("div", { className: "wb-more-menu" }, more.map(item))));
}
var WB_LAYOUT_CSS = `
.wb-root { flex-direction:column; padding-top:var(--dsh-frame-top-clearance,0px); container-type:inline-size; container-name:workbench; }
.wb-head { flex:none; z-index:3; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
.wb-toolbar { min-height:48px; padding:8px 20px; border:0; }
.wb-toolbar-brand { display:flex; align-items:center; gap:8px; font-weight:600; }
.wb-workarea { display:flex; flex:1; min-height:0; min-width:0; }
.wb-main { flex:1; min-width:0; }
.wb-context-pane { display:flex; flex-direction:column; width:400px; flex:0 0 400px; max-width:40%; min-width:300px; min-height:0; border-left:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); container-type:inline-size; container-name:contextpane; }
.wb-context-header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-context-body { padding:14px; overflow:auto; min-height:0; flex:1; }
.wb-context-footer { display:flex; align-items:center; gap:8px; padding:12px 14px; border-top:1px solid var(--dsw-alias-border-l1); }
.wb-task-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@container contextpane (max-width:460px) { .wb-task-form-grid { grid-template-columns:minmax(0,1fr); } }
.wb-topnav { display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 20px 10px; min-width:0; }
/* Top-level tabs must not inherit the retired sidebar's active left stripe. */
.wb-topnav .wb-nav-item, .wb-topnav .wb-more > summary { display:flex; align-items:center; gap:8px; min-height:36px; padding:8px 12px; border:0; border-radius:8px; box-shadow:none; font:inherit; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); background:transparent; cursor:pointer; }
.wb-topnav > .wb-nav-item { width:auto; flex:none; white-space:nowrap; }
.wb-topnav .wb-nav-item:hover, .wb-topnav .wb-more > summary:hover, .wb-topnav .wb-more[open] > summary { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wb-topnav .wb-nav-item.is-active, .wb-topnav .wb-more.is-active > summary { background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 7%,transparent); color:var(--dsw-alias-label-primary); font-weight:600; box-shadow:none; }
.wb-topnav .wb-nav-item:focus-visible, .wb-topnav .wb-more > summary:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-more { position:relative; flex:none; }
.wb-topnav .wb-more > summary { list-style:none; white-space:nowrap; }
.wb-more > summary::-webkit-details-marker { display:none; }
.wb-more > summary svg { transition:transform .14s ease; }
.wb-more[open] > summary svg { transform:rotate(180deg); }
.wb-more-menu { position:absolute; z-index:10; top:calc(100% + 6px); right:0; min-width:188px; padding:6px; border:1px solid var(--dsw-alias-border-l1); border-radius:10px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 6px 24px #0002; }
.wb-scroll { container-type:inline-size; container-name:content; }
.wb-page { max-width:1500px; margin:auto; width:100%; }
.wb-split { align-items:start; }
.wb-page > .wb-page { padding:0; }
.wb-task-table { overflow:auto; }
.wb-task-table:focus-visible { outline:2px solid var(--wb-accent); outline-offset:2px; }
.wb-tabs { flex-wrap:wrap; }
.wb-tab { white-space:nowrap; flex-shrink:0; }
.wb-input, .wb-select-wrap { min-width:0; }
.wb-assistant-composer { min-height:0; max-height:calc(100% - 44px); overflow:auto; }
.wb-assistant-composer > :first-child { min-height:0; overflow:auto; flex:0 1 auto; }
.wb-assistant-composer > .wb-textarea, .wb-assistant-composer > .wb-row { flex:none; }
.wb-assistant-composer > .wb-knowledge-controls { min-height:24px; max-height:120px; overflow:auto; }
.wb-assistant-contexts { max-height:64px; overflow:auto; flex:none; }
.wb-stats-strip { display:flex; flex-direction:row; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:9px; margin-bottom:14px; }
.wb-reply-list { display:flex; flex-direction:column; }
.wb-reply-item { padding:14px 0; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wb-reply-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.wb-news-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr)); gap:16px; align-items:start; }
.wb-news-grid > .wb-card, .wb-radar-panel { overflow:visible; }
.wb-compact-status { padding:10px 12px; margin-bottom:14px; border-radius:8px; background:var(--dsw-alias-bg-layer-1); }
.wb-compact-status summary { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.wb-draft-field { margin:8px 0; }
@container workbench (max-width:1024px) {
 .wb-workarea.is-context-open > .wb-main { display:none; }
 .wb-workarea.is-context-open > .wb-context-pane, .wb-workarea.is-context-open > .wb-assistant { flex:1!important; width:100%!important; max-width:100%!important; min-width:0!important; border-left:0!important; }
}
@container content (max-width:780px) {
 .wb-split, .wb-settings-grid, .wb-toolbox-layout { grid-template-columns:minmax(0,1fr)!important; }
 .wb-toolbox-layout .wb-toolgrid { max-height:220px; overflow:auto; grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important; }
}
@container workbench (max-width:560px) {
 .wb-topnav { padding:4px 12px 8px; gap:4px; }
 .wb-topnav .wb-more { margin-left:auto; }
 .wb-topnav > .wb-nav-item, .wb-topnav .wb-more > summary { padding:7px 9px; font-size:12px; min-height:34px; }
 .wb-topnav > .wb-nav-item svg { display:none; }
 .wb-toolbar { padding:8px 12px; flex-wrap:wrap; gap:6px; }
 .wb-page { padding:16px 12px; }
 .wb-toolbar-brand { font-size:12px; }
 .wb-page-head { flex-wrap:wrap; }
 .wb-page-head .wb-ph-actions { flex-wrap:wrap; }
}
`;

// src/client/components/ContextFormPane.tsx
var React8 = __toESM(require("react"), 1);
function ContextFormPane({ open, title, sub, onClose, footer, children }) {
  if (!open) return null;
  return /* @__PURE__ */ React8.createElement("aside", { className: "wb-context-pane", "aria-label": title, onKeyDown: (e) => {
    if (e.key === "Escape") onClose();
  } }, /* @__PURE__ */ React8.createElement("header", { className: "wb-context-header" }, /* @__PURE__ */ React8.createElement("div", null, /* @__PURE__ */ React8.createElement("strong", null, title), sub && /* @__PURE__ */ React8.createElement("p", { className: "wb-tiny wb-muted" }, sub)), /* @__PURE__ */ React8.createElement("button", { type: "button", className: "wb-chip", "aria-label": "关闭编辑", onClick: onClose }, "关闭")), /* @__PURE__ */ React8.createElement("div", { className: "wb-context-body" }, children), /* @__PURE__ */ React8.createElement("footer", { className: "wb-context-footer" }, footer));
}

// src/client/components/TaskEventFields.tsx
var React9 = __toESM(require("react"), 1);
function TaskEventFields({ value, onChange }) {
  const patch = (key2, next) => onChange({ ...value, [key2]: next });
  return /* @__PURE__ */ React9.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "事项类型", /* @__PURE__ */ React9.createElement("select", { className: "wb-select", "aria-label": "事项类型", value: value.eventType, onChange: (e) => patch("eventType", e.target.value) }, /* @__PURE__ */ React9.createElement("option", { value: "" }, "普通事项"), /* @__PURE__ */ React9.createElement("option", { value: "feature" }, "开发交付"), /* @__PURE__ */ React9.createElement("option", { value: "meeting" }, "会议"), /* @__PURE__ */ React9.createElement("option", { value: "logging" }, "登记填报"), /* @__PURE__ */ React9.createElement("option", { value: "other" }, "其他"))), /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "交付物", /* @__PURE__ */ React9.createElement("input", { className: "wb-input", value: value.deliverable, onChange: (e) => patch("deliverable", e.target.value), placeholder: "未知可留空" })), value.eventType === "meeting" && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "会议开始", /* @__PURE__ */ React9.createElement("input", { className: "wb-input", type: "datetime-local", value: WB.fmt.toLocalInput(value.meetingStart), onChange: (e) => patch("meetingStart", WB.fmt.fromLocalInput(e.target.value) || "") })), /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "会议结束", /* @__PURE__ */ React9.createElement("input", { className: "wb-input", type: "datetime-local", value: WB.fmt.toLocalInput(value.meetingEnd), onChange: (e) => patch("meetingEnd", WB.fmt.fromLocalInput(e.target.value) || "") })), /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "会议地点", /* @__PURE__ */ React9.createElement("input", { className: "wb-input", value: value.meetingLocation, onChange: (e) => patch("meetingLocation", e.target.value) }))), value.eventType === "logging" && /* @__PURE__ */ React9.createElement("label", { className: "wb-label" }, "登记对象", /* @__PURE__ */ React9.createElement("input", { className: "wb-input", value: value.registrationTarget, onChange: (e) => patch("registrationTarget", e.target.value) })));
}

// src/client/features/tasks/TaskReplyPanel.tsx
var React11 = __toESM(require("react"), 1);

// src/shared/message-display.ts
function messageSender(source, contact) {
  const loc = source?.locator || {};
  const ids = [loc.senderId, loc.groupId].filter(Boolean);
  const botId = /^BOT-[0-9a-f]{4,}(?:-[0-9a-f]+)*(?:…|\.{3})?$/i;
  for (const name2 of [source?.sender, contact]) {
    if (typeof name2 === "string" && name2.trim() && !botId.test(name2) && !ids.some((id) => name2 === id || name2 === id.slice(0, 8) + "…" || name2 === id.slice(0, 8) + "...")) return name2;
  }
  if (String(loc.senderId || "").toUpperCase().startsWith("BOT-") || [source?.sender, contact].some((name2) => typeof name2 === "string" && botId.test(name2))) return "机器人";
  return "未知发件人";
}
function messageConversation(groupName, groupId) {
  return groupName && groupName !== groupId && groupName !== "未知会话" ? groupName : "原会话";
}
function messageOrigin(source, reply) {
  const loc = source?.locator || {};
  for (const [name2, id] of [[loc.groupName, loc.groupId || reply?.groupId], [reply?.groupName, reply?.groupId || loc.groupId]]) {
    const label = messageConversation(name2, id);
    if (label !== "原会话") return label;
  }
  return "会话名称未知";
}
function taskSource(task, sources) {
  const ids = [task?.sourceRefId, ...(task?.sourceRefs || []).map((ref) => ref.sourceId)].filter(Boolean);
  for (const id of ids) {
    const source = sources.find((row) => row.id === id);
    if (source) return source;
  }
  return null;
}
var messageTimeFormat = /* @__PURE__ */ new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
function messageSentTime(source) {
  const sentAt = source?.locator?.sentAt;
  if (typeof sentAt !== "string" || !sentAt.trim()) return "未知";
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return "未知";
  const parts = Object.fromEntries(messageTimeFormat.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}（北京时间）`;
}

// src/shared/task-reply.ts
function taskReplyTarget(state, taskId) {
  const task = state.tasks?.find((row) => row.id === taskId && !row.archivedAt);
  if (!task) return null;
  const source = taskSource(task, state.sources || []), loc = source?.locator;
  if (source?.provider !== "yunzhijia" || !loc?.groupId || !loc.msgId || !loc.accountId || loc.direction === "outbound") return null;
  const conversation = state.messageInbox?.accountId === loc?.accountId ? state.messageInbox.conversations?.find((row) => row.groupId === loc?.groupId) : null;
  const type = loc?.groupType || conversation?.groupType || state.syncCursors?.[loc?.accountId + ":" + loc?.groupId]?.groupType;
  return Number(type) === 1 ? { task, source, loc } : null;
}
function taskReplyMatches(state, taskId, reply) {
  const target = taskReplyTarget(state, taskId);
  return !!target && !reply?.archivedAt && reply?.sourceId === target.source.id && reply.msgId === target.loc.msgId && reply.accountId === target.loc.accountId && reply.groupId === target.loc.groupId && (reply.taskIds || []).includes(taskId);
}

// src/client/features/inbox/ReplyDraft.tsx
var React10 = __toESM(require("react"), 1);
function ReplyDraft({ reply, data, actions, taskId, initialOpen = false }) {
  const [text, setText] = React10.useState(data.replyDrafts?.[reply.id]?.text || ""), [busy, setBusy] = React10.useState(false), [error, setError] = React10.useState(""), [open, setOpen] = React10.useState(initialOpen);
  const [preview, setPreview] = React10.useState(null), [blocked, setBlocked] = React10.useState(false);
  const sending = React10.useRef(false);
  const source = (data.sources || []).find((row) => row.id === reply.sourceId), loc = source?.locator;
  const conversation = data.messageInbox?.accountId === loc?.accountId ? data.messageInbox?.conversations?.find((c) => c.groupId === loc?.groupId) : null;
  const privateChat = Number(loc?.groupType || conversation?.groupType || data.syncCursors?.[loc?.accountId + ":" + loc?.groupId]?.groupType) === 1;
  const delivery = data.replyDrafts?.[reply.id]?.delivery;
  const taskAllowed = !!taskId && taskReplyMatches(data, taskId, reply);
  const canSend = source?.provider === "yunzhijia" && loc?.groupId && loc.msgId && loc.accountId && loc.direction !== "outbound" && (!taskId || taskAllowed) && (["待回复", "已确认收到"].includes(reply.stage) || taskAllowed && reply.triage === "task" && reply.stage === "不需回复");
  const deliveryBlocked = blocked || ["sending", "uncertain", "sent"].includes(delivery?.status);
  function review() {
    setError("");
    setPreview({ request: { id: reply.id, text, groupId: loc.groupId, msgId: loc.msgId, accountId: loc.accountId, confirmed: true, ...taskId ? { taskId } : {} }, sender: messageSender(source, reply.contact), conversation: messageOrigin(source, reply), excerpt: source.excerpt, sentTime: messageSentTime(source) });
  }
  async function send() {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const snapshot = await WB.rpc("workbench/sendReply", { request: preview.request });
      setBlocked(true);
      setPreview(null);
      acceptSnapshot(snapshot);
      WB.toast(taskId ? "回复已发送，待办状态保持不变" : "回复已发送，已标记为已回复", "ok");
    } catch (e) {
      const message = String(e.message);
      setError(message);
      setPreview(null);
      if (/未确认|已有发送记录/.test(message)) setBlocked(true);
      void WB.actions.reload().catch(() => {
      });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    setOpen(true);
    try {
      const r = await WB.rpc("workbench/generateReplyDraft", { id: reply.id });
      setText(r.text);
      void WB.actions.reload().catch((e) => setError(e.message));
    } catch (e) {
      setError(String(e.message));
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ React10.createElement("div", { className: "wb-reply-draft" }, taskId && /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, "回复原会话：", messageOrigin(source, reply), " · ", messageSender(source, reply.contact), "。回复与待办完成状态分别维护。"), delivery?.status === "sent" && /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny" }, "已发送：", delivery.text || data.replyDrafts?.[reply.id]?.text, " ", delivery.at && /* @__PURE__ */ React10.createElement("time", { dateTime: delivery.at }, "（", messageSentTime({ locator: { sentAt: delivery.at } }), "）")), /* @__PURE__ */ React10.createElement("div", { className: "wb-reply-draft-toolbar" }, /* @__PURE__ */ React10.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React10.createElement(Btn, { size: "sm", kind: "primary", disabled: busy, onClick: () => setOpen(!open) }, open ? "收起回复" : "回复"), /* @__PURE__ */ React10.createElement(Btn, { size: "sm", disabled: busy, onClick: generate }, "生成回复草稿")), actions), open && /* @__PURE__ */ React10.createElement("div", { className: "wb-reply-editor" }, error && /* @__PURE__ */ React10.createElement("p", { role: "alert" }, error), /* @__PURE__ */ React10.createElement("textarea", { className: "wb-input", "aria-label": "回复草稿", placeholder: "输入要回复的内容", disabled: busy || !!preview, value: text, maxLength: 8e3, rows: 4, onChange: (e) => setText(e.target.value) }), /* @__PURE__ */ React10.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React10.createElement(Btn, { size: "sm", kind: "primary", disabled: busy || !text.trim() || !canSend || deliveryBlocked, onClick: review }, "发送回复"), /* @__PURE__ */ React10.createElement(Btn, { size: "sm", disabled: busy, onClick: () => WB.rpc("workbench/saveReplyDraft", { id: reply.id, text }).then(() => WB.toast("草稿已保存", "ok")).catch((e) => setError(e.message)) }, "保存草稿"), /* @__PURE__ */ React10.createElement(Btn, { size: "sm", disabled: busy || !text, onClick: () => navigator.clipboard.writeText(text).then(() => WB.toast("已复制，请在云之家检查收件人后发送", "ok")).catch((e) => setError(e.message)) }, "复制草稿"), /* @__PURE__ */ React10.createElement(Btn, { size: "sm", disabled: busy, onClick: () => WB.actions.setReplyStage(reply.id, "已回复").catch((e) => setError(e.message)) }, "我已在云之家回复")), !canSend && /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, taskId ? "原消息已回复或关联已变化，请先核实记录；待办内容和状态不受影响。" : "仅未处理且具有原消息定位的云之家消息支持直接回复，其他消息可复制后发送。"), deliveryBlocked && /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, "已有发送记录，请到云之家核实结果，避免重复发送。"), /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, privateChat ? "私聊将直接发送正文，不自动@对方或引用原消息。" : "群聊将以纯文本引用原消息，发送到原会话。", "生成、保存或复制草稿不会发送。")), /* @__PURE__ */ React10.createElement(Modal, { open: !!preview, title: "确认发送回复", onClose: () => {
    if (!sending.current) setPreview(null);
  }, footer: /* @__PURE__ */ React10.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React10.createElement(Btn, { disabled: busy, onClick: () => setPreview(null) }, "取消"), /* @__PURE__ */ React10.createElement(Btn, { kind: "primary", disabled: busy, onClick: send }, busy ? "发送中…" : "确认发送")) }, preview && /* @__PURE__ */ React10.createElement("div", { style: { overflowWrap: "anywhere" } }, /* @__PURE__ */ React10.createElement("p", null, "会话：", preview.conversation), /* @__PURE__ */ React10.createElement("p", null, "发件人：", preview.sender), /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, "原消息发出时间：", preview.sentTime), /* @__PURE__ */ React10.createElement("p", { className: "wb-tiny wb-muted" }, "原消息：", preview.excerpt), /* @__PURE__ */ React10.createElement("p", { style: { whiteSpace: "pre-wrap" } }, preview.request.text), /* @__PURE__ */ React10.createElement("details", null, /* @__PURE__ */ React10.createElement("summary", null, "查看发送定位"), /* @__PURE__ */ React10.createElement("p", null, "会话 ID：", preview.request.groupId, /* @__PURE__ */ React10.createElement("br", null), "原消息 ID：", preview.request.msgId, /* @__PURE__ */ React10.createElement("br", null), "账号：", preview.request.accountId)))));
}

// src/client/features/tasks/TaskReplyPanel.tsx
function TaskReplyPanel({ task, data, initialOpen = false }) {
  const [replyId, setReplyId] = React11.useState(null), [busy, setBusy] = React11.useState(false), [error, setError] = React11.useState("");
  const preparing = React11.useRef(false);
  async function prepare() {
    if (preparing.current) return;
    preparing.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await WB.rpc("workbench/prepareTaskReply", { taskId: task.id });
      acceptSnapshot(result.snapshot);
      setReplyId(result.replyId);
    } catch (e) {
      setError(String(e.message));
    } finally {
      preparing.current = false;
      setBusy(false);
    }
  }
  React11.useEffect(() => {
    if (initialOpen) void prepare();
  }, []);
  if (!taskReplyTarget(data, task.id)) return null;
  const reply = (data.replies || []).find((row) => row.id === replyId);
  return /* @__PURE__ */ React11.createElement("section", { "aria-label": "待办原会话回复 " + task.title, style: { minWidth: 0, overflowWrap: "anywhere" }, onClick: (e) => e.stopPropagation() }, !reply && /* @__PURE__ */ React11.createElement(Btn, { size: "sm", disabled: busy, onClick: prepare }, busy ? "载入回复…" : "回复原会话"), error && /* @__PURE__ */ React11.createElement("p", { role: "alert" }, error), reply && /* @__PURE__ */ React11.createElement(ReplyDraft, { key: reply.id, reply, data, taskId: task.id, initialOpen: true }));
}

// src/client/features/tasks/task-form.ts
var React12 = __toESM(require("react"), 1);
var taskFormToLocalInput = WB.fmt.toLocalInput;
var taskFormFromLocalInput = WB.fmt.fromLocalInput;
function TaskFormHost(props) {
  const state = useStore();
  const request = state.taskForm;
  const task = request && request.task ? request.task : null;
  const defaults = request && request.defaults ? request.defaults : {};
  const data = state.data;
  const [title, setTitle] = React12.useState("");
  const [description, setDescription] = React12.useState("");
  const [priority, setPriority] = React12.useState("normal");
  const [status, setStatus] = React12.useState("ready");
  const [dueInput, setDueInput] = React12.useState("");
  const [projectId, setProjectId] = React12.useState("");
  const [tags, setTags] = React12.useState("");
  const [assignee, setAssignee] = React12.useState("");
  const [needsReply, setNeedsReply] = React12.useState(false);
  const [replyStage, setReplyStage] = React12.useState("待答复");
  const [busy, setBusy] = React12.useState(false);
  const [error, setError] = React12.useState(null);
  const [eventFields, setEventFields] = React12.useState({ eventType: "", deliverable: "", meetingStart: "", meetingEnd: "", meetingLocation: "", registrationTarget: "" });
  React12.useEffect(function() {
    if (!request)
      return;
    setTitle(task ? task.title : defaults.title || "");
    setDescription(task ? task.description || "" : defaults.description || "");
    setPriority(task ? task.priority || "normal" : defaults.priority || "normal");
    setStatus(task ? task.status || "ready" : defaults.status || "ready");
    setDueInput(taskFormToLocalInput(task ? task.dueAt : defaults.dueAt));
    setProjectId(task ? task.projectId || "" : defaults.projectId || "");
    setTags(task ? (task.tags || []).join(", ") : (defaults.tags || []).join(", "));
    setAssignee(task ? task.assignee || "" : defaults.assignee || "");
    setNeedsReply(task ? task.needsReply === true : false);
    setReplyStage(task && task.replyStage ? task.replyStage : "待答复");
    setEventFields(Object.fromEntries(["eventType", "deliverable", "meetingStart", "meetingEnd", "meetingLocation", "registrationTarget"].map((key2) => [key2, task && task[key2] || ""])));
    setError(null);
    setBusy(false);
  }, [request]);
  if (!request)
    return null;
  function close() {
    wbStore.set({ taskForm: null });
  }
  function submit(event) {
    if (event)
      event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("标题不能为空");
      return;
    }
    const payload = {
      title: trimmed,
      description: description.trim(),
      priority,
      status,
      dueAt: task && dueInput === taskFormToLocalInput(task.dueAt) ? task.dueAt || null : taskFormFromLocalInput(dueInput),
      projectId: projectId || null,
      tags: task && tags === (task.tags || []).join(", ") ? [...task.tags || []] : tags.split(/[,，\s]+/).map(function(tag) {
        return tag.trim();
      }).filter(Boolean),
      assignee: assignee.trim() || null,
      needsReply: needsReply === true,
      replyStage: null,
      ...eventFields,
      eventType: eventFields.eventType || null
    };
    setBusy(true);
    setError(null);
    const operation = task ? WB.actions.updateTask(task.id, payload) : WB.actions.createTask(payload);
    operation.then(function() {
      setBusy(false);
      close();
    }).catch(function(e) {
      setBusy(false);
      setError(String(e && e.message || e));
    });
  }
  const projects = data && data.projects || [];
  const projectOptions = [{ value: "", label: "未归属项目" }].concat(projects.map(function(project) {
    return { value: project.id, label: project.name };
  }));
  const statusOptions = Object.keys(WB.TASK_STATUS).map(function(key2) {
    return { value: key2, label: WB.TASK_STATUS[key2].label };
  });
  const priorityOptions = ["urgent", "high", "normal", "low"].map(function(key2) {
    return { value: key2, label: WB.TASK_PRIORITY[key2].label };
  });
  const Container = props?.embedded ? ContextFormPane : Modal;
  return h(Container, {
    open: !props?.embedded || !state.assistantOpen && !state.contextHidden,
    title: task ? "编辑待办" : "新建待办",
    sub: task ? task.title : "明确的事实与推测分开记录",
    onClose: close,
    width: 560,
    footer: h(React12.Fragment, null, h(Btn, {
      kind: "primary",
      icon: "check",
      disabled: busy,
      onClick: submit,
      children: busy ? "保存中…" : task ? "保存修改" : "创建待办"
    }), h(Btn, { onClick: close, children: "取消" }))
  }, h("form", { onSubmit: submit, className: "wb-stack", style: { gap: 12 } }, h(Field, { label: "标题" }, h(Input, {
    value: title,
    autoFocus: true,
    placeholder: "例如：评审 @张三 提到的网关限流方案",
    onChange: function(event) {
      setTitle(event.target.value);
    }
  })), h(Field, { label: "描述", hint: "保留原始上下文，后续 Agent 读取的就是这段内容" }, h(Textarea, {
    value: description,
    placeholder: "背景、期望结果、相关链接…",
    onChange: function(event) {
      setDescription(event.target.value);
    }
  })), h("div", { className: "wb-task-form-grid" }, h(Field, { label: "状态" }, h(Select, {
    options: statusOptions,
    value: status,
    onChange: function(event) {
      setStatus(event.target.value);
    }
  })), h(Field, { label: "优先级" }, h(Select, {
    options: priorityOptions,
    value: priority,
    onChange: function(event) {
      setPriority(event.target.value);
    }
  })), h(Field, { label: "截止时间" }, h(Input, {
    type: "datetime-local",
    value: dueInput,
    onChange: function(event) {
      setDueInput(event.target.value);
    }
  })), h(Field, { label: "项目" }, h(Select, {
    options: projectOptions,
    value: projectId,
    onChange: function(event) {
      setProjectId(event.target.value);
    }
  })), h(Field, { label: "标签", hint: "逗号或空格分隔" }, h(Input, {
    value: tags,
    placeholder: "后端, 限流",
    onChange: function(event) {
      setTags(event.target.value);
    }
  })), h(Field, { label: "负责人", hint: "抽取得到的负责人属于推测，需人工确认" }, h(Input, {
    value: assignee,
    placeholder: "留空表示未指派",
    onChange: function(event) {
      setAssignee(event.target.value);
    }
  })), null, null), h(TaskEventFields, { value: eventFields, onChange: setEventFields }), task && data ? h(TaskReplyPanel, { key: task.id, task, data }) : null, task && task.aiExtracted ? h("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      padding: "8px 10px",
      borderRadius: 10,
      background: "var(--dsw-alias-bg-layer-2)",
      fontSize: 11.5,
      color: T.text2
    }
  }, h(Icon, { name: "sparkles", size: 13 }), h("span", null, "这条待办由 AI 从消息中提取（置信度 " + (task.confidence === null || task.confidence === void 0 ? "未评估" : Math.round(task.confidence * 100) + "%") + "）。保存即确认，字段以你为准。")) : null, error ? h("div", { role: "alert", style: { color: T.err, fontSize: 12 } }, error) : null, h("button", { type: "submit", style: { display: "none" } })));
}
WB.TaskForm = TaskFormHost;
WB.TaskFormHost = TaskFormHost;

// src/client/shell/workbench-shell.ts
WB.PAGE_META = {
  dashboard: { title: "今日简报", icon: "dashboard", hint: "今天要处理的事、资讯与连接状态" },
  tasks: { title: "任务中心", icon: "tasks", hint: "统一任务模型：来源、优先级、截止与执行记录" },
  replies: { title: "待回复", icon: "chat", hint: "独立跟踪需要回复的消息与来源" },
  radar: { title: "资讯", icon: "radar", hint: "联网发现、原文摘要与收藏" },
  search: { title: "搜索", icon: "search", hint: "一个入口搜全部：本地、企业、代码与外网，按分类过滤" },
  agents: { title: "Agent 中心", icon: "agent", hint: "执行队列、审批与结果回写" },
  "web-ai": { title: "多 AI 对话", icon: "messages", hint: "统一提问、连续追问与多家 AI 回答对比" },
  toolbox: { title: "开发工具箱", icon: "toolbox", hint: "本地执行、数据不出浏览器的高频工具" },
  collab: { title: "研发协作", icon: "git", hint: "项目启动、开发软件联动、运行日志与仓库环境" },
  knowledge: { title: "知识空间", icon: "book", hint: "收藏、笔记与排障记录" },
  settings: { title: "连接与设置", icon: "settings", hint: "连接器状态、关注主题与数据管理" }
};
WB.ORDER = ["dashboard", "tasks", "replies", "radar", "knowledge", "web-ai", "search", "agents", "toolbox", "collab", "settings"];
WB.NAV_GROUPS = [
  { label: "工作", items: ["dashboard", "tasks", "search"] },
  { label: "执行", items: ["agents"] },
  { label: "工具", items: ["toolbox", "collab"] },
  { label: "沉淀", items: ["knowledge"] },
  { label: "系统", items: ["settings"] }
];
WB.go = function(page) {
  if (WB.ORDER.indexOf(page) < 0)
    return;
  WB.store.set({ page });
};
function WorkbenchIcon(props) {
  const size = props && typeof props.size === "number" && props.size || 18;
  return h("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
    style: { display: "block" }
  }, h("rect", {
    x: 3.2,
    y: 3.2,
    width: 7.4,
    height: 7.4,
    rx: 2.1,
    fill: "currentColor",
    opacity: props && props.active ? 1 : 0.72
  }), h("rect", {
    x: 13.4,
    y: 3.2,
    width: 7.4,
    height: 7.4,
    rx: 2.1,
    fill: "currentColor",
    opacity: props && props.active ? 0.66 : 0.34
  }), h("rect", {
    x: 3.2,
    y: 13.4,
    width: 7.4,
    height: 7.4,
    rx: 2.1,
    fill: "currentColor",
    opacity: props && props.active ? 0.66 : 0.34
  }), h("path", {
    d: "M13.6 17.1h7.2M17.2 13.5v7.2",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    opacity: props && props.active ? 1 : 0.72
  }));
}
function Toaster() {
  const state = useStore();
  if (!state.toasts.length)
    return null;
  return h("div", { className: "wb-toasts", "aria-live": "polite" }, state.toasts.map(function(item) {
    return h("div", { key: item.id, className: "wb-toast wb-toast--" + (item.kind || "info") }, h(Icon, { name: item.kind === "err" ? "alert" : item.kind === "ok" ? "checkCircle" : "info", size: 14 }), h("span", { style: { minWidth: 0, overflowWrap: "anywhere" } }, item.text));
  }));
}
function AssistantDrawer() {
  const state = useStore();
  const [messages, setMessages] = React13.useState([]);
  const [draft, setDraft] = React13.useState("");
  const [sending, setSending] = React13.useState(false);
  const [error, setError] = React13.useState(null);
  const [sessions, setSessions] = React13.useState([]);
  const [activeId, setActiveId] = React13.useState(null);
  const [loaded, setLoaded] = React13.useState(false);
  const [retrieval, setRetrieval] = React13.useState(null);
  const [citationAudit, setCitationAudit] = React13.useState(null);
  const [knowledgeMode, setKnowledgeMode] = React13.useState("auto");
  const [knowledgeScope, setKnowledgeScope] = React13.useState({});
  const [steerMode, setSteerMode] = React13.useState(false);
  const bodyRef = React13.useRef(null);
  const requestGeneration = React13.useRef(0);
  const transcriptGeneration = React13.useRef(0);
  React13.useEffect(() => () => {
    requestGeneration.current += 1;
    transcriptGeneration.current += 1;
  }, []);
  const open = !!state.assistantOpen;
  const refs = Array.isArray(state.assistantRefs) ? state.assistantRefs : [];
  const settings = state.data && state.data.settings || {};
  const savedWidth = Number(settings.assistantWidth);
  const [width, setWidth] = React13.useState(Number.isFinite(savedWidth) ? savedWidth : 384);
  const widthRef = React13.useRef(width);
  React13.useEffect(function() {
    widthRef.current = width;
  }, [width]);
  function startResize(event) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    function onMove(moveEvent) {
      const next = Math.max(240, Math.min(760, Math.round(startWidth + (startX - moveEvent.clientX))));
      widthRef.current = next;
      setWidth(next);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onUp);
      if (widthRef.current)
        WB.actions.saveSettings({ assistantWidth: widthRef.current }).catch(function() {
        });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseleave", onUp);
  }
  function loadTranscript(sessionId) {
    const generation = ++transcriptGeneration.current;
    return WB.actions.assistantTranscript(sessionId, 40).then(function(result) {
      if (generation !== transcriptGeneration.current) return;
      setMessages(result && result.messages || []);
      if (result && result.sessionId) {
        setActiveId(result.sessionId);
        WB.actions.knowledgeTraces({ sessionId: result.sessionId }).then((history) => {
          if (generation === transcriptGeneration.current) {
            setRetrieval(history?.items?.[0] || null);
            setCitationAudit(null);
          }
        }).catch(() => {
        });
      }
    }).catch(function() {
    });
  }
  React13.useEffect(function() {
    if (!open || loaded)
      return;
    setLoaded(true);
    WB.actions.assistantSessions(12).then(function(result) {
      const list = result && result.sessions || [];
      setSessions(list);
      const preferred = list.find((row) => row.id === result?.assistantSessionId)?.id || list[0]?.id || null;
      if (preferred) {
        setActiveId(preferred);
        return loadTranscript(preferred);
      }
      return null;
    }).catch(function() {
    });
  }, [open, loaded]);
  React13.useEffect(function() {
    const node = bodyRef.current;
    if (node)
      node.scrollTop = node.scrollHeight;
  }, [messages, sending]);
  if (!open)
    return null;
  function switchSession(nextId) {
    requestGeneration.current += 1;
    setSending(false);
    setActiveId(nextId);
    setRetrieval(null);
    setCitationAudit(null);
    setError(null);
    loadTranscript(nextId);
  }
  function send() {
    const text = draft.trim();
    if (!text || sending && !steerMode)
      return;
    setError(null);
    setDraft("");
    setSending(true);
    const generation = ++requestGeneration.current;
    transcriptGeneration.current += 1;
    setMessages(function(previous) {
      return previous.concat([{ role: "user", text }]);
    });
    WB.actions.assistantSend(text, refs, activeId, steerMode, knowledgeMode, knowledgeScope).then(function(result) {
      if (generation !== requestGeneration.current) return;
      setRetrieval(result?.retrieval || null);
      setCitationAudit(null);
      if (!result || result.status !== "ok") {
        setSending(false);
        const note = result && result.note || "状态：" + (result && result.status);
        setError(/resume failed|SessionPersistenceNotFound/i.test(note) ? "助手会话已失效，点右上「新会话」重开一个即可继续。" : note);
        return;
      }
      let cursor = Number(result.fromSeq) || 0;
      const sid = result.sessionId;
      if (sid && String(sid) !== String(activeId)) {
        setActiveId(String(sid));
        if (result.recovered) WB.toast("原助手会话已失效，已自动切换到新会话", "info");
      }
      const startedAt = Date.now();
      function tick() {
        if (generation !== requestGeneration.current) return;
        WB.actions.assistantDelta(sid, cursor, result.retrieval?.id).then(function(delta) {
          if (generation !== requestGeneration.current) return;
          if (delta && delta.status === "ok") {
            if (delta.citationAudit) setCitationAudit(delta.citationAudit);
            cursor = Number(delta.nextSeq) || cursor;
            const fresh = (delta.entries || []).filter(function(entry) {
              return entry.role !== "user";
            });
            if (fresh.length > 0) {
              setMessages(function(previous) {
                return previous.concat(fresh);
              });
            }
            const timeout = Date.now() - startedAt > 18e4;
            if (delta.turnEnded === true || timeout) {
              setSending(false);
              if (timeout)
                setError("本轮超过 3 分钟仍未结束，可稍后在主面板查看。");
              WB.actions.reload().catch(function() {
              });
              WB.actions.assistantSessions(12).then(function(next) {
                setSessions(next && next.sessions || []);
              }).catch(function() {
              });
              return;
            }
            setTimeout(tick, 400);
            return;
          }
          setSending(false);
          setError(delta && delta.note || "读取会话增量失败");
        }).catch(function(failure) {
          if (generation !== requestGeneration.current) return;
          setSending(false);
          setError(String(failure && failure.message || failure));
        });
      }
      setTimeout(tick, 400);
    }).catch(function(failure) {
      if (generation !== requestGeneration.current) return;
      setSending(false);
      setError(String(failure && failure.message || failure));
    });
  }
  function newSession() {
    requestGeneration.current += 1;
    transcriptGeneration.current += 1;
    setSending(false);
    WB.actions.assistantReset().then(function(result) {
      setMessages([]);
      setError(null);
      const nextId = result && result.sessionId;
      if (nextId)
        setActiveId(nextId);
      WB.actions.assistantSessions(12).then(function(next) {
        setSessions(next && next.sessions || []);
      }).catch(function() {
      });
      WB.toast("已开始新的助手会话", "ok");
    }).catch(function() {
    });
  }
  const sessionOptions = (sessions.length > 0 ? sessions : [{ id: activeId || "", title: "当前会话" }]).map(function(item) {
    return { value: item.id, label: (item.isAssistant ? "★ " : "") + WB.util.truncate(item.title || item.id, 22) };
  });
  const hasHistory = messages.length > 0;
  return h(
    "aside",
    {
      className: "wb-assistant",
      style: {
        flex: "0 0 " + width + "px",
        width,
        minWidth: 240,
        maxWidth: "58%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        borderLeft: "1px solid " + T.border1,
        background: T.layer1
      }
    },
    h("div", {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-label": "拖动调整助手宽度",
      title: "拖动调整宽度",
      onMouseDown: startResize,
      style: { position: "absolute", left: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 5 }
    }),
    /* ---- 头部：只保留会话切换与三个操作，不再有标题与说明 ---- */
    h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 8px 7px 10px",
        borderBottom: "1px solid " + T.border1,
        flex: "none"
      }
    }, h("div", { style: { flex: "1 1 auto", minWidth: 0 } }, h(Select, {
      value: activeId || "",
      options: sessionOptions,
      title: "切换原生会话",
      onChange: function(event) {
        switchSession(event.target.value);
      }
    })), h(IconBtn, { name: "plus", label: "新会话", onClick: newSession }), h(IconBtn, {
      name: "external",
      label: "在主面板打开该会话",
      onClick: function() {
        const opened = activeId && WB.openSessionById ? WB.openSessionById(activeId) : WB.openConversation && WB.openConversation();
        if (!opened) WB.toast("当前宿主未提供会话导航，可从左侧会话列表打开该会话", "warn");
      }
    }), h(IconBtn, { name: "close", label: "关闭助手", onClick: function() {
      WB.assistant.close();
    } })),
    /* ---- 消息区 ---- */
    h("div", {
      ref: bodyRef,
      style: { flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 12 }
    }, !hasHistory && !sending ? h("div", {
      style: {
        margin: "auto 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "8px 4px 14px",
        textAlign: "center"
      }
    }, h("div", {
      style: {
        display: "grid",
        placeItems: "center",
        width: 46,
        height: 46,
        borderRadius: 14,
        background: "color-mix(in srgb, " + T.accent + " 14%, transparent)",
        color: T.accent
      }
    }, h(Icon, { name: "sparkles", size: 22 })), h("div", { style: { display: "flex", flexDirection: "column", gap: 3 } }, h("strong", { style: { fontSize: 13.5, color: T.text } }, "想让我做点什么？"), h("span", { className: "wb-tiny wb-muted", style: { lineHeight: 1.6 } }, "我能读写工作台里的待办、资讯与知识")), h("div", { style: { display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 268 } }, ["今天还有哪些没做完？帮我把逾期的排一下", "把这条消息整理成待办，截止放到明天", "这些资讯里哪条和限流有关？"].map(function(prompt) {
      return h("button", {
        key: prompt,
        type: "button",
        className: "wb-assistant-suggest",
        onClick: function() {
          setDraft(prompt);
        }
      }, h(Icon, { name: "arrowRight", size: 11 }), h("span", null, prompt));
    }))) : (function() {
      const groups = [];
      messages.forEach(function(message) {
        const isService = message.role === "tool" || message.role === "toolResult" || message.role === "error";
        const last = groups[groups.length - 1];
        if (isService) {
          if (last && last.kind === "service") {
            last.items.push(message);
          } else {
            groups.push({ kind: "service", items: [message] });
          }
          return;
        }
        groups.push({ kind: "message", item: message });
      });
      return groups.map(function(group, groupIndex) {
        if (group.kind === "service") {
          const toolNames = [];
          group.items.forEach(function(item) {
            if (item.role === "tool" && toolNames.indexOf(item.text) < 0)
              toolNames.push(item.text);
          });
          const failed = group.items.some(function(item) {
            return item.role === "error" || item.role === "toolResult" && item.ok === false;
          });
          const detail = group.items.map(function(item) {
            const label = item.role === "tool" ? item.text : item.role === "toolResult" ? item.text + " → " + (item.ok === false ? "失败" : "完成") : String(item.text || "");
            return label + (item.summary ? "(" + String(item.summary) + ")" : "");
          }).join("\n");
          return h("div", {
            key: "g" + groupIndex,
            title: detail,
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: T.text2,
              padding: "4px 10px",
              border: "1px dashed " + T.border2,
              borderRadius: 9,
              opacity: 0.85
            }
          }, h(Icon, { name: "command", size: 11 }), h("span", null, failed ? "调用了 " + toolNames.length + " 个工具（含失败）" : "调用了 " + toolNames.length + " 个工具"), h("span", { className: "wb-mono wb-ellipsis", style: { opacity: 0.8, flex: "1 1 auto", minWidth: 0 } }, WB.util.truncate(toolNames.join(" · "), 60)));
        }
        const message = group.item;
        const index = messages.indexOf(message);
        const mine = message.role === "user";
        const markdown = !mine;
        return h("div", { key: "m" + index, style: { display: "flex", justifyContent: mine ? "flex-end" : "flex-start" } }, h("div", {
          style: {
            maxWidth: "94%",
            padding: "8px 10px",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.7,
            overflowWrap: "anywhere",
            background: mine ? "color-mix(in srgb, " + T.text + " 6%, " + T.layer1 + ")" : T.layer1,
            color: T.text,
            border: "1px solid " + T.border1
          }
        }, markdown && typeof mdParse === "function" ? h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, mdParse(message.text || "").slice(0, 40).map(function(block, blockIndex) {
          const key2 = "b" + index + "-" + blockIndex;
          if (block.type === "heading") {
            return h("div", { key: key2, style: { fontWeight: 600, margin: "6px 0 2px" } }, mdInline(block.text, key2));
          }
          if (block.type === "code") {
            return h("pre", { key: key2, className: "wb-code", style: { margin: "4px 0" } }, block.text);
          }
          if (block.type === "list") {
            return h(block.ordered ? "ol" : "ul", { key: key2, style: { margin: "2px 0", paddingLeft: 18 } }, block.items.map(function(item, itemIndex) {
              return h("li", { key: key2 + "-" + itemIndex }, mdInline(item, key2 + "-" + itemIndex));
            }));
          }
          if (block.type === "hr")
            return h("hr", { key: key2, className: "wb-divider", style: { margin: "6px 0" } });
          if (block.type === "quote") {
            return h("div", { key: key2, style: { borderLeft: "2px solid " + T.border2, paddingLeft: 8, color: T.text2 } }, mdInline(block.text, key2));
          }
          return h("div", { key: key2, style: { whiteSpace: "pre-wrap" } }, mdInline(block.text || "", key2));
        })) : h("div", { style: { whiteSpace: "pre-wrap" } }, message.text), message.toolCalls && message.toolCalls.length > 0 ? h("div", { style: { marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 } }, message.toolCalls.map(function(tool, toolIndex) {
          const name2 = typeof tool === "string" ? tool : tool.name;
          return h(Chip, { key: "t" + toolIndex, icon: "command", title: tool && tool.summary || name2, children: name2 });
        })) : null));
      });
    })(), h(KnowledgeSources, { result: retrieval, audit: citationAudit, provided: true }), sending ? h("div", { className: "wb-row wb-tiny wb-muted", style: { gap: 6 } }, h(Spinner, { size: 12 }), h("span", null, "思考中…")) : null, error ? h("div", { role: "alert", className: "wb-tiny", style: { color: T.err, lineHeight: 1.6 } }, error) : null),
    /* ---- 输入区 ---- */
    h("div", { className: "wb-assistant-composer", style: { borderTop: "1px solid " + T.border1, padding: "9px 10px 8px", display: "flex", flexDirection: "column", gap: 7, flex: "none" } }, h("details", { className: "wb-knowledge-controls" }, h("summary", { className: "wb-tiny", style: { cursor: "pointer" } }, "知识设置：" + (knowledgeMode === "only" ? "仅知识库" : knowledgeMode === "off" ? "关闭" : "自动检索")), h("div", { className: "wb-row", style: { gap: 6, flexWrap: "wrap", paddingTop: 6 } }, h("label", { className: "wb-tiny" }, "知识模式 ", h("select", { className: "wb-select", style: { maxWidth: 125 }, "aria-label": "知识模式", value: knowledgeMode, onChange: (e) => setKnowledgeMode(e.target.value) }, h("option", { value: "auto" }, "自动检索"), h("option", { value: "only" }, "仅知识库"), h("option", { value: "off" }, "关闭"))), h("select", { className: "wb-select", "aria-label": "聊天知识项目", style: { maxWidth: 145 }, value: knowledgeScope.projectId === void 0 ? "__auto" : knowledgeScope.projectId || "", onChange: (e) => setKnowledgeScope({ ...knowledgeScope, projectId: e.target.value === "__auto" ? void 0 : e.target.value || null }) }, h("option", { value: "__auto" }, "项目：自动"), h("option", { value: "" }, "个人通用"), (state.data && state.data.projects || []).map((p) => h("option", { key: p.id, value: p.id }, p.name))), h("select", { className: "wb-select", "aria-label": "聊天知识账号", style: { maxWidth: 145 }, value: knowledgeScope.accountId === void 0 ? "__auto" : knowledgeScope.accountId || "", onChange: (e) => setKnowledgeScope({ ...knowledgeScope, accountId: e.target.value === "__auto" ? void 0 : e.target.value || null }) }, h("option", { value: "__auto" }, "账号：自动"), h("option", { value: "" }, "通用资料"), [...new Set((state.data && state.data.sources || []).map((s) => s.locator?.accountId).filter(Boolean))].map((id) => h("option", { key: id, value: id }, id))))), h(AssistantContextPicker, { data: state.data, refs }), refs.length > 0 ? h("div", { className: "wb-assistant-contexts", tabIndex: 0, role: "region", "aria-label": "已选择的上下文", style: { display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" } }, h("span", { className: "wb-tiny wb-muted" }, "上下文 " + refs.length + "："), refs.map(function(ref) {
      return h(Chip, {
        key: ref.kind + ":" + ref.id,
        active: true,
        title: ref.title,
        children: WB.util.truncate(ref.title || ref.id, 14),
        onRemove: function() {
          WB.assistant.remove(ref.kind, ref.id);
        }
      });
    })) : null, h(Textarea, {
      value: draft,
      rows: 2,
      placeholder: "输入指令，或让我帮你整理待办…",
      onChange: function(event) {
        setDraft(event.target.value);
      },
      onKeyDown: function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          send();
        }
      }
    }), h("div", { className: "wb-row", style: { gap: 6 } }, h(Chip, {
      active: steerMode,
      onClick: function() {
        setSteerMode(!steerMode);
      },
      title: steerMode ? "打断当前轮并立即处理" : "排队等当前轮结束再处理",
      children: steerMode ? "打断" : "排队"
    }), h("span", { className: "wb-tiny wb-muted", title: "Enter 发送 / Shift+Enter 换行" }, "⏎ 发送"), h(IconBtn, {
      name: "arrowRight",
      label: sending && !steerMode ? "正在执行" : steerMode ? "打断并发送" : "发送",
      disabled: sending && !steerMode || !draft.trim(),
      active: (!sending || steerMode) && !!draft.trim(),
      onClick: send
    })))
  );
}
function LoadingScreen() {
  return h("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: T.text2,
      fontSize: 12
    }
  }, h(Spinner, { size: 18 }), h("span", null, "正在读取工作台数据…"));
}
function ErrorScreen(props) {
  return h("div", { style: { padding: 28, maxWidth: 620 } }, h(Panel, {
    title: "无法读取工作台数据",
    icon: "alert",
    sub: "Host 端的 workbench 服务没有返回数据。",
    actions: h(Btn, { icon: "refresh", onClick: props.onRetry, kind: "primary", size: "sm", children: "重试" })
  }, h("div", { className: "wb-stack" }, h("pre", { className: "wb-code" }, String(props.error || "未知错误")), h("p", { className: "wb-hint", style: { margin: 0 } }, "排查顺序：确认插件已在“设置 → 插件”中启用 → 查看 Host 日志中的 workbench 行 → 重新安装 bundle。"))));
}
function Toolbar(props) {
  const state = useStore();
  const counts = WB.taskCounts(props.data);
  return h("div", { className: "wb-toolbar" }, h("div", { className: "wb-toolbar-brand" }, h(WorkbenchIcon, { size: 18 }), "智能工作台"), h("div", { className: "wb-spacer" }), state.taskForm && state.contextHidden ? h(Btn, { size: "sm", onClick: () => WB.store.set({ contextHidden: false, assistantOpen: false }), children: "继续编辑" }) : null, counts.overdue > 0 ? h("button", {
    type: "button",
    className: "wb-chip",
    onClick: function() {
      WB.go("tasks");
    },
    title: "查看逾期任务",
    style: { color: T.err, borderColor: "color-mix(in srgb, " + T.err + " 45%, transparent)" }
  }, h(Icon, { name: "alert", size: 12 }), counts.overdue + " 项逾期") : null, h(Btn, {
    icon: "plus",
    size: "sm",
    kind: "primary",
    onClick: function() {
      WB.openTaskForm(null);
    },
    children: "新建待办"
  }), h(IconBtn, {
    name: "refresh",
    label: "重新读取 Host 数据",
    onClick: function() {
      WB.actions.reload().catch(function() {
      });
    }
  }), h(IconBtn, {
    name: "sparkles",
    label: "工作台助手（携带上下文进入会话）",
    active: !!props.assistantOpen,
    onClick: function() {
      WB.assistant.toggle();
    }
  }), h(IconBtn, {
    name: "settings",
    label: "连接与设置",
    active: props.page === "settings",
    onClick: function() {
      WB.go("settings");
    }
  }));
}
function MissingPage(props) {
  return h("div", { className: "wb-page" }, h(Empty, {
    icon: "layers",
    title: "页面 “" + props.page + "” 还没有注册",
    hint: "对应模块未随本次构建一起生成；其余页面不受影响。"
  }));
}
function WorkbenchApp() {
  const [webAIVisited, setWebAIVisited] = React13.useState(false);
  const state = useStore();
  const [paletteOpen, setPaletteOpen] = React13.useState(false);
  React13.useEffect(function() {
    if (!WB.store.get().data)
      WB.actions.reload().catch(function() {
      });
  }, []);
  React13.useEffect(function() {
    const sync = () => {
      if (document.visibilityState !== "hidden") WB.actions.syncCheck().catch(function() {
      });
    };
    const timer = setInterval(function() {
      sync();
    }, 12e3);
    const onVisible = () => {
      if (document.visibilityState !== "hidden") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener?.("visibilitychange", onVisible);
    sync();
    return function() {
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener?.("visibilitychange", onVisible);
    };
  }, []);
  React13.useEffect(function() {
    function onKey(event) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta)
        return;
      const key2 = event.key.toLowerCase();
      if (key2 === "k") {
        event.preventDefault();
        setPaletteOpen(function(open) {
          return !open;
        });
        return;
      }
      if (key2 >= "1" && key2 <= String(WB.ORDER.length)) {
        const index = Number(key2) - 1;
        const page2 = WB.ORDER[index];
        if (page2) {
          event.preventDefault();
          WB.go(page2);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return function() {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const page = state.page;
  const Page = WB.pages[page];
  const loading = state.status === "loading" && !state.data;
  const failed = state.status === "error" && !state.data;
  const WebAIPage2 = WB.pages["web-ai"];
  React13.useEffect(() => {
    if (page === "web-ai") setWebAIVisited(true);
  }, [page]);
  return h(
    "div",
    { className: "wb-root" },
    h("style", null, WB_CSS + WB_LAYOUT_CSS),
    h("header", { className: "wb-head" }, h(Toolbar, { data: state.data, page, assistantOpen: state.assistantOpen }), h(TopNavigation, { page, data: state.data })),
    h(
      "div",
      { className: "wb-workarea" + (state.assistantOpen || state.taskForm && !state.contextHidden ? " is-context-open" : "") },
      h("div", { className: "wb-main" }, h(
        "div",
        { className: "wb-scroll" },
        page !== "web-ai" ? h("div", { key: "business-page", className: "wb-page" }, loading ? h(LoadingScreen) : failed ? h(ErrorScreen, { error: state.error, onRetry: () => WB.actions.reload().catch(() => {
        }) }) : Page ? h(Page) : h(MissingPage, { page })) : null,
        (webAIVisited || page === "web-ai") && WebAIPage2 ? h("div", { key: "web-ai-surface", className: "wb-page", hidden: page !== "web-ai" }, h(WebAIPage2)) : null
      )),
      h(AssistantDrawer),
      h(TaskFormHost, { embedded: true })
    ),
    WB.Palette ? h(WB.Palette, { open: paletteOpen, onClose: () => setPaletteOpen(false) }) : null,
    h(Toaster)
  );
}
WB.apply = function apply(ctx) {
  if (ctx.connection)
    setShared_wbConnection(ctx.connection);
  if (typeof WB.setLayout === "function") {
    WB.setLayout(ctx.get ? ctx.get("layout") : ctx.layout);
  }
  WB.setNativeSessions((ctx.get ? ctx.get("sessions") : null) || ctx.sessions);
  if (typeof WB.setUiWorkspace === "function") {
    WB.setUiWorkspace(ctx.get ? ctx.get("uiWorkspace") : ctx.uiWorkspace);
  }
  const locale = ctx.get ? ctx.get("locale") : ctx.locale;
  if (locale && typeof locale.register === "function") {
    ctx.effect(function() {
      const disposers = [];
      ["zh", "en"].forEach(function(language) {
        try {
          disposers.push(locale.register("dev-workbench", language, WB_DICT.zh));
        } catch (e) {
        }
      });
      try {
        setShared_wbTranslate(locale.bind("dev-workbench"));
      } catch (e) {
      }
      return function() {
        disposers.forEach(function(dispose) {
          try {
            dispose();
          } catch (e) {
          }
        });
      };
    });
  }
  ctx.effect(function() {
    const disposers = [];
    disposers.push(ctx.slots.inject("main", function() {
      return ctx.slots.register({ name: "main", key: WB.PANEL_KEY }, WorkbenchApp);
    }));
    if (typeof WB.registerChatEmbed === "function") {
      try {
        disposers.push(WB.registerChatEmbed(ctx));
      } catch (e) {
      }
    }
    disposers.push(ctx.slots.inject("sidebar.panellist", function() {
      return ctx.slots.register({
        name: "sidebar.panellist",
        id: WB.PANEL_KEY,
        order: 30,
        label: function() {
          return WB.t("app.title", "智能工作台");
        }
      }, WorkbenchIcon);
    }));
    return function() {
      disposers.forEach(function(dispose) {
        try {
          dispose();
        } catch (e) {
        }
      });
    };
  });
};

// src/client/components/MessageSelectionBadges.tsx
var React14 = __toESM(require("react"), 1);
function MessageSelectionBadges({ source, inbox }) {
  if (source?.provider === "yunzhijia-calendar") return /* @__PURE__ */ React14.createElement(Badge, { tone: "accent" }, "日历会议");
  const selection = source?.selection;
  if (selection?.policy !== "focused-v1") return null;
  const current = inbox && inbox.accountId === source.locator?.accountId ? inbox.conversations?.find((c) => c.groupId === source.locator?.groupId) : null;
  const count = current ? current.unreadCount : selection.unreadCount;
  return /* @__PURE__ */ React14.createElement("span", { className: "wb-row wb-row--wrap", style: { gap: 5 } }, selection.reasons.includes("mention_me") && /* @__PURE__ */ React14.createElement(Badge, { tone: "accent" }, "@本人"), selection.reasons.includes("mention_all") && /* @__PURE__ */ React14.createElement(Badge, { tone: "warn" }, "@全员"), selection.reasons.includes("followup") && /* @__PURE__ */ React14.createElement(Badge, { tone: "idle" }, "事项跟进"), count == null ? /* @__PURE__ */ React14.createElement(Badge, { tone: "idle" }, "会话未读未知") : /* @__PURE__ */ React14.createElement(Badge, { tone: count > 0 ? "warn" : "idle" }, count > 0 ? "会话未读 " + count : "会话已读"));
}

// src/client/components/Pagination.tsx
var React15 = __toESM(require("react"), 1);
var PAGE_SIZE = 30;
function pageIndex(page, total) {
  return Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
}
function Pagination({ page, total, onChange }) {
  if (total <= PAGE_SIZE)
    return null;
  const index = pageIndex(page, total);
  return /* @__PURE__ */ React15.createElement("nav", { "aria-label": "列表分页", className: "wb-row", style: { margin: "12px 0" } }, /* @__PURE__ */ React15.createElement(Btn, { size: "sm", disabled: index === 0, onClick: () => onChange(index - 1) }, "上一页"), /* @__PURE__ */ React15.createElement("span", null, index + 1, " / ", Math.ceil(total / PAGE_SIZE), " · ", total, " 条"), /* @__PURE__ */ React15.createElement(Btn, { size: "sm", disabled: (index + 1) * PAGE_SIZE >= total, onClick: () => onChange(index + 1) }, "下一页"));
}

// src/client/components/WorkflowJobs.tsx
var React16 = __toESM(require("react"), 1);
function WorkflowJobs({ jobs, kind }) {
  const rows = jobs.filter((job) => job.kind === kind).slice(-5).reverse();
  if (!rows.length) return null;
  const labels = { queued: "已排队", running: "运行中", completed: "已完成", failed: "失败" };
  return /* @__PURE__ */ React16.createElement("details", { className: "wb-compact-status" }, /* @__PURE__ */ React16.createElement("summary", null, "后台", kind === "analysis" ? "识别" : "摘要", "任务 · ", rows[0].result?.status === "partial" ? "部分完成" : labels[rows[0].status] || rows[0].status), rows.map((job) => /* @__PURE__ */ React16.createElement("div", { key: job.id, className: "wb-reply-item" }, /* @__PURE__ */ React16.createElement("strong", null, job.result?.status === "partial" ? "部分完成" : labels[job.status] || job.status), " ", /* @__PURE__ */ React16.createElement("span", { className: "wb-tiny wb-muted" }, job.id), /* @__PURE__ */ React16.createElement("p", { className: "wb-tiny" }, job.error || job.result?.note || "处理 " + (job.result?.processed ?? job.result?.done ?? 0) + " 条，失败 " + (job.result?.failures ?? job.result?.failed ?? 0) + " 条"))));
}

// src/client/components/AnalysisQueuePanel.tsx
var React17 = __toESM(require("react"), 1);
function AnalysisQueuePanel({ entries, sources }) {
  const [page, setPage] = React17.useState(0);
  const [busyId, setBusyId] = React17.useState(null);
  const [visibility, setVisibility] = React17.useState("open");
  const rows = entries.filter((entry) => visibility === "all" || (visibility === "failed" ? entry.status === "failed" : visibility === "done" ? entry.status === "done" : visibility === "skipped" ? ["skipped", "historical"].includes(entry.status) : !["done", "cancelled", "historical", "skipped"].includes(entry.status))).slice().reverse();
  const index = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const labels = { pending: "待识别", running: "分析中", failed: "失败", awaiting_human: "待确认", historical: "已跳过", skipped: "已跳过", done: "已完成", cancelled: "已取消" };
  async function action(entry, kind) {
    if (busyId) return;
    setBusyId(entry.id);
    try {
      if (kind === "confirm") await WB.actions.analyzeConfirm(entry.id);
      else if (kind === "cancel") await WB.actions.analysisCancel(entry.id);
      else {
        if (kind === "retry") await WB.actions.analysisRetry(entry.id);
        const result = await WB.actions.analyzeRun(1, [entry.id]);
        WB.toast("本条识别已入队：" + (result.jobId || ""), "ok");
      }
      await WB.actions.reload();
    } catch (error) {
      WB.toast(error instanceof Error ? error.message : String(error), "err");
    } finally {
      setBusyId(null);
    }
  }
  return /* @__PURE__ */ React17.createElement(Panel, { title: "AI 识别队列", sub: "当前 " + rows.length + " 条；采集、分析和人工确认分别跟踪" }, /* @__PURE__ */ React17.createElement("div", null, /* @__PURE__ */ React17.createElement("label", { className: "wb-label" }, "识别记录 ", /* @__PURE__ */ React17.createElement("select", { className: "wb-select", "aria-label": "识别记录", value: visibility, onChange: (event) => {
    setVisibility(event.target.value);
    setPage(0);
  } }, /* @__PURE__ */ React17.createElement("option", { value: "open" }, "待处理"), /* @__PURE__ */ React17.createElement("option", { value: "failed" }, "识别失败"), /* @__PURE__ */ React17.createElement("option", { value: "done" }, "已完成"), /* @__PURE__ */ React17.createElement("option", { value: "skipped" }, "已跳过（历史消息）"), /* @__PURE__ */ React17.createElement("option", { value: "all" }, "全部"))), rows.slice(index * 20, index * 20 + 20).map((entry) => {
    const source = sources.find((source2) => source2.id === entry.sourceId);
    return /* @__PURE__ */ React17.createElement("article", { key: entry.id, className: "wb-reply-item" }, /* @__PURE__ */ React17.createElement("strong", null, labels[entry.status] || entry.status), /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted", style: { overflowWrap: "anywhere" } }, "发件人：", messageSender(source), " · 来自：", messageOrigin(source)), /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted" }, "发出时间：", messageSentTime(source)), /* @__PURE__ */ React17.createElement("p", null, source?.excerpt || "原消息不可用"), entry.analysis?.summary && /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted" }, entry.analysis.summary), entry.lastError && /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted" }, entry.lastError), entry.reviewReason && /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted" }, entry.reviewReason), !["skipped", "historical"].includes(entry.status) && /* @__PURE__ */ React17.createElement("div", { className: "wb-reply-actions" }, entry.analysis && /* @__PURE__ */ React17.createElement("select", { className: "wb-select", "aria-label": "复核识别结果", value: "", onChange: (event) => {
      const verdict = event.target.value;
      if (verdict) WB.rpc("workbench/reviewAnalysis", { entryId: entry.id, verdict, note: "" }).then(() => WB.toast("已记录质量复核", "ok")).catch((e) => WB.toast(e.message, "err"));
    } }, /* @__PURE__ */ React17.createElement("option", { value: "" }, "复核识别结果"), /* @__PURE__ */ React17.createElement("option", { value: "correct" }, "识别正确"), /* @__PURE__ */ React17.createElement("option", { value: "false_positive" }, "误建事项"), /* @__PURE__ */ React17.createElement("option", { value: "missed_action" }, "遗漏待办"), /* @__PURE__ */ React17.createElement("option", { value: "wrong_date" }, "日期错误"), /* @__PURE__ */ React17.createElement("option", { value: "wrong_completion" }, "完成误判"), /* @__PURE__ */ React17.createElement("option", { value: "wrong_link" }, "关联错误")), entry.status === "pending" && /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "analyze") }, "识别本条"), entry.status === "awaiting_human" && (entry.analysis ? /* @__PURE__ */ React17.createElement(React17.Fragment, null, /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "confirm") }, "确认建档"), /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "retry") }, "重新识别")) : /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "retry") }, "识别本条")), entry.status === "failed" && /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "retry") }, "重试"), ["done", "cancelled"].includes(entry.status) && /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "retry") }, "重新识别"), !["done", "cancelled"].includes(entry.status) && /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: !!busyId, onClick: () => action(entry, "cancel") }, "取消分析")));
  }), !rows.length && /* @__PURE__ */ React17.createElement("p", { className: "wb-tiny wb-muted" }, "没有待处理的识别条目。"), rows.length > 20 && /* @__PURE__ */ React17.createElement("div", { className: "wb-reply-actions" }, /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: index === 0, onClick: () => setPage(index - 1) }, "上一页"), /* @__PURE__ */ React17.createElement("span", null, index + 1, " / ", Math.ceil(rows.length / 20)), /* @__PURE__ */ React17.createElement("button", { type: "button", className: "wb-chip", disabled: (index + 1) * 20 >= rows.length, onClick: () => setPage(index + 1) }, "下一页"))));
}

// src/client/features/inbox/RepliesPage.ts
var React18 = __toESM(require("react"), 1);
function RepliesPage() {
  const state = useStore();
  const data = state.data || {};
  const [filter, setFilter] = React18.useState("open");
  const [page, setPage] = React18.useState(0);
  const [query, setQuery] = React18.useState("");
  const replies = (data.replies || []).filter((row) => !row.archivedAt).map((row) => ({ ...row, groupName: messageOrigin((data.sources || []).find((source) => source.id === row.sourceId), row), contact: messageSender((data.sources || []).find((source) => source.id === row.sourceId) || { locator: { groupId: row.groupId } }, row.contact) })).filter(function(row) {
    return (filter === "all" || filter === "open" ? filter === "all" || row.stage === "待回复" || row.stage === "已确认收到" : row.stage === filter) && (!query || [row.snippet, row.contact, row.groupName].join(" ").toLowerCase().includes(query.toLowerCase()));
  }).sort(function(a, b) {
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  return h(
    "div",
    { className: "wb-inbox" },
    h(PageHead, {
      icon: "chat",
      title: "待回复",
      sub: "私聊未读先待识别；具体事项转入待办，需答复的消息按实际回复更新。",
      actions: h(Btn, { icon: "refresh", onClick: () => WB.actions.fetchMentions().catch(() => {
      }), disabled: state.busy, children: "同步消息" })
    }),
    h(
      "div",
      { className: "wb-inbox-filters" },
      h(
        "div",
        { className: "wb-inbox-search" },
        h(Icon, { name: "search", size: 15 }),
        h(Input, {
          "aria-label": "搜索待回复",
          value: query,
          placeholder: "搜索内容、联系人或会话",
          onChange: (event) => {
            setQuery(event.target.value);
            setPage(0);
          }
        })
      ),
      h("label", { className: "wb-inbox-filter" }, h("span", null, "状态"), h(Select, {
        title: "回复阶段",
        value: filter,
        options: [{ value: "open", label: "待处理" }, { value: "all", label: "全部" }].concat(
          ["待回复", "已确认收到", "已回复", "不需回复"].map((value) => ({ value, label: value }))
        ),
        onChange: (event) => {
          setFilter(event.target.value);
          setPage(0);
        }
      })),
      h("span", { className: "wb-inbox-count" }, "共 " + replies.length + " 条")
    ),
    replies.length ? h(
      "div",
      { className: "wb-reply-list" },
      replies.slice(pageIndex(page, replies.length) * PAGE_SIZE, (pageIndex(page, replies.length) + 1) * PAGE_SIZE).map(function(reply) {
        const source = (data.sources || []).find((row) => row.id === reply.sourceId);
        const statusActions = h(
          "div",
          { className: "wb-inbox-stage-actions", role: "group", "aria-label": "修改回复阶段" },
          h("span", { className: "wb-tiny wb-muted" }, "标记为"),
          ["待回复", "已确认收到", "已回复", "不需回复"].filter((stage) => stage !== reply.stage).map((stage) => h(Btn, { key: stage, size: "sm", disabled: state.busy, onClick: () => WB.actions.setReplyStage(reply.id, stage).catch(() => {
          }), children: stage })),
          h(Btn, { icon: "sparkles", size: "sm", onClick: () => WB.assistant.add({ kind: "source", id: reply.sourceId || reply.id, title: reply.contact || "待回复消息", body: reply.snippet, meta: "回复 ID：" + reply.id + "；阶段：" + reply.stage }), children: "AI 协助" })
        );
        return h(
          "article",
          { key: reply.id, className: "wb-reply-item wb-inbox-card" },
          h(
            "header",
            { className: "wb-inbox-card-head" },
            h(
              "div",
              { className: "wb-row wb-row--wrap" },
              h("strong", null, reply.contact || reply.groupName || "消息"),
              h(Badge, { tone: reply.stage === "已回复" ? "ok" : reply.stage === "不需回复" ? "idle" : "warn" }, reply.stage),
              reply.triage === "pending" && ["待回复", "已确认收到"].includes(reply.stage) ? h(Badge, { tone: "idle" }, "待AI识别") : reply.triage === "task" ? h(Badge, { tone: "idle" }, reply.taskIds?.length ? "已转待办" : "待办待确认") : reply.triage === "noise" ? h(Badge, { tone: "idle" }, "无需处理") : null,
              reply.humanGuard ? h("span", { className: "wb-tiny wb-muted" }, "人工标记已保护") : null
            ),
            h(
              "div",
              { className: "wb-inbox-meta" },
              h(MessageSelectionBadges, { source, inbox: data.messageInbox }),
              h("span", null, "来自：" + messageOrigin(source, reply)),
              h("span", null, "发出时间：" + messageSentTime(source))
            )
          ),
          h("p", { className: "wb-inbox-message" }, reply.snippet || "无文本摘录"),
          h(
            "div",
            { className: "wb-inbox-footer" },
            h(ReplyDraft, { reply, data, actions: statusActions }),
            source ? h(
              "details",
              { className: "wb-inbox-evidence" },
              h("summary", null, "查看原消息依据"),
              h("p", null, source.excerpt),
              h("div", { className: "wb-tiny wb-muted" }, "发出时间：" + messageSentTime(source))
            ) : null,
            (reply.taskIds || []).length ? h("div", { className: "wb-reply-actions" }, (reply.taskIds || []).map(function(id) {
              const task = (data.tasks || []).find((row) => row.id === id);
              return task ? h(Btn, { key: id, size: "sm", onClick: () => WB.openTaskForm(task), children: "待办：" + task.title }) : null;
            })) : null
          )
        );
      })
    ) : h(Empty, { icon: "chat", title: "当前没有需要处理的回复", hint: "同步后私聊未读先显示在这里；AI将具体事项转入待办，其余按回复义务分类。" }),
    h(Pagination, { page, total: replies.length, onChange: setPage }),
    h(WorkflowJobs, { jobs: data.jobs || [], kind: "analysis" }),
    h(AnalysisQueuePanel, { entries: data.analysisQueue || [], sources: data.sources || [] })
  );
}

// src/shared/news.ts
function newsRelevance(item, topics, projects) {
  const text = [item.title, item.excerpt, ...Object.values(item.summary || {})].join(" ").toLowerCase();
  const topicMatches = topics.filter((topic) => (item.topics || []).includes(topic) || text.includes(topic.toLowerCase())).length;
  const projectMatches = projects.filter((project) => project.name && project.name.length > 1 && text.includes(project.name.toLowerCase())).length;
  return topicMatches * 2 + projectMatches * 4;
}
function isUnreadableNewsError(error) {
  return /HTTP (?:404|410|422)|Unable to extract content|原文不可访问|原文内容不足|原文读取失败：HTTP (?:404|410|422)/i.test(String(error));
}
function isIgnoredNews(item) {
  return !!item.archivedAt || item.availability === "ignored" || item.summaryAttempts >= 2 && isUnreadableNewsError(item.summaryError);
}
function newsPriority(item) {
  return (/github\.com\//i.test(item.url || "") ? 4 : 0) + (/AI|LLM|Agent|RAG|大模型|人工智能|模型|智能体|多模态|推理/i.test([item.title, ...item.topics || []].join(" ")) ? 3 : 0);
}

// src/client/features/news/NewsPage.ts
var React20 = __toESM(require("react"), 1);

// src/client/features/news/news-presentation.ts
var React19 = __toESM(require("react"), 1);

// src/client/features/dashboard/selectors.ts
function dashStoreNavigate(preset) {
  WB.store.set({ page: "tasks", taskPreset: preset || null });
}
function dashToneColor(tone) {
  if (tone === "err")
    return T.err;
  if (tone === "warn")
    return T.warn;
  if (tone === "ok")
    return T.ok;
  if (tone === "accent")
    return T.accent;
  return T.text2;
}
function dashPriorityOf(task) {
  return WB.TASK_PRIORITY[task.priority] || WB.TASK_PRIORITY.normal;
}
function dashDueValue(task) {
  const at = task.dueAt || task.meetingStart;
  if (!at)
    return Infinity;
  const value = new Date(at).getTime();
  return Number.isNaN(value) ? Infinity : value;
}
function dashEndOfToday() {
  const end = /* @__PURE__ */ new Date();
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}
function dashActionable(data) {
  const endOfDay = dashEndOfToday();
  return WB.openTasks(data).filter(function(task) {
    if (task.priority === "urgent" || task.priority === "high")
      return true;
    return dashDueValue(task) <= endOfDay;
  }).sort(function(a, b) {
    const ad = dashDueValue(a);
    const bd = dashDueValue(b);
    if (ad !== bd)
      return ad - bd;
    const ar = dashPriorityOf(a).rank || 0;
    const br = dashPriorityOf(b).rank || 0;
    if (ar !== br)
      return br - ar;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}
function dashEarliestOverdue(data) {
  let earliest = null;
  WB.openTasks(data).forEach(function(task) {
    const value = dashDueValue(task);
    if (value === Infinity || value >= Date.now())
      return;
    if (earliest === null || value < earliest)
      earliest = value;
  });
  return earliest === null ? null : new Date(earliest).toISOString();
}
function dashStaleInfo(data) {
  if (!data || !data.updatedAt)
    return null;
  const settings = data.settings || {};
  const raw = Number(settings.staleHours);
  const staleHours = Number.isFinite(raw) && raw > 0 ? raw : 24;
  const updated = new Date(data.updatedAt).getTime();
  if (Number.isNaN(updated))
    return null;
  if (Date.now() - updated <= staleHours * 3600 * 1e3)
    return null;
  return { staleHours, updatedAt: data.updatedAt };
}
function dashProjectName(data, projectId) {
  if (!projectId)
    return "";
  const projects = data && data.projects || [];
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId)
      return projects[index].name || "";
  }
  return "";
}
function dashTagPill(topic, key2) {
  return h("span", {
    key: key2,
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 17,
      padding: "0 6px",
      borderRadius: 999,
      border: "1px solid " + T.border1,
      background: T.layer2,
      color: T.text2,
      fontSize: 10.5,
      lineHeight: 1,
      whiteSpace: "nowrap"
    }
  }, topic);
}

// src/client/features/news/news-presentation.ts
function dashRadarTimeValue(item) {
  const value = item.publishedAt || item.fetchedAt || item.createdAt;
  if (!value)
    return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
function dashSummaryParts(summary) {
  const defs = [
    { key: "change", label: "技术变化" },
    { key: "usage", label: "应用场景" },
    { key: "risk", label: "采用风险" },
    { key: "practice", label: "推荐实践" }
  ];
  if (!summary || typeof summary !== "object")
    return [];
  return defs.map(function(def) {
    const text = typeof summary[def.key] === "string" ? summary[def.key].trim() : "";
    return { key: def.key, label: def.label, text };
  }).filter(function(part) {
    return part.text.length > 0;
  });
}
function DashRadarRow(props) {
  const item = props.item;
  const rawParts = dashSummaryParts(item.summary);
  const summaryParts = rawParts.length > 0 ? rawParts : item.excerpt ? [{ key: "excerpt", label: "原文摘录", text: item.excerpt }] : [];
  const needsDigest = rawParts.length === 0 && !!item.excerpt;
  const published = item.dateKind !== "unknown" ? item.publishedAt : null;
  const topics = Array.isArray(item.topics) ? item.topics : [];
  const [saving, setSaving] = React19.useState(false);
  const [makingTask, setMakingTask] = React19.useState(false);
  const [confirmTask, setConfirmTask] = React19.useState(false);
  function makePracticeTask() {
    if (makingTask)
      return;
    setMakingTask(true);
    WB.actions.createTaskFromRadar(item.id).then(function() {
      setMakingTask(false);
      setConfirmTask(false);
    }).catch(function() {
      setMakingTask(false);
    });
  }
  function saveToKnowledge() {
    if (saving)
      return;
    setSaving(true);
    const body = summaryParts.map(function(part) {
      return part.label + "：" + part.text;
    }).join("\n");
    WB.actions.createKnowledge({
      kind: "bookmark",
      title: item.title,
      url: item.url || null,
      body: body || item.title,
      tags: topics.slice(0, 8)
    }).then(function() {
      setSaving(false);
    }).catch(function() {
      setSaving(false);
    });
  }
  return h("div", {
    className: "wb-item",
    style: { flexDirection: "column", alignItems: "stretch", gap: 2, padding: "10px 4px" }
  }, h(Modal, { open: confirmTask, title: "将资讯添加为我的待办", onClose: () => {
    if (!makingTask) setConfirmTask(false);
  }, footer: h("div", { className: "wb-row", style: { gap: 8 } }, h(Btn, { disabled: makingTask, onClick: () => setConfirmTask(false), children: "取消" }), h(Btn, { kind: "primary", disabled: makingTask, onClick: makePracticeTask, children: makingTask ? "正在添加…" : "确认添加待办" })) }, h("p", null, "将创建「实践：" + item.title + "」并保留原文来源。"), h("p", { className: "wb-tiny wb-muted" }, "仅在你计划实际处理时添加。抓取资讯和生成摘要不会自动创建待办。")), h("div", { className: "wb-row", style: { alignItems: "flex-start", gap: 8 } }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title", style: { display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" } }, item.url ? h("a", {
    className: "wb-link",
    href: item.url,
    target: "_blank",
    rel: "noreferrer noopener",
    style: { fontSize: 12.5, fontWeight: 500 },
    title: "打开原文"
  }, item.title, h(Icon, { name: "external", size: 10 })) : h("span", null, item.title), item.saved ? h(Badge, { tone: "ok" }, "已收藏") : null, item.github ? h("span", { className: "wb-tiny wb-muted" }, item.github.status === "verified" ? "GitHub 已核验 · ★ " + item.github.stars + " · 最近提交 " + WB.fmt.date(item.github.pushedAt) + (item.github.starGrowth == null ? " · 增长待观察" : " · 观察期增长 " + item.github.starGrowth) + (item.github.archived ? " · 已归档" : "") + (item.github.release ? " · " + item.github.release : "") : "GitHub 热度未核验") : null), h("div", { className: "wb-item-sub", style: { gap: 5 } }, h("span", { className: "wb-muted" }, item.source || "未知来源"), h("span", { className: "wb-muted" }, "·"), published ? h("span", { className: "wb-muted" }, WB.fmt.date(published)) : h("span", { className: "wb-muted", title: "原文未注明发布时间；抓取于 " + (item.fetchedAt ? WB.fmt.datetime(item.fetchedAt) : "") + "，不以抓取时间冒充" }, "日期未注明（抓取于 " + (item.fetchedAt ? WB.fmt.relative(item.fetchedAt) : "最近") + "）"), topics.map(function(topic, index) {
    return dashTagPill(topic, "topic:" + topic + ":" + index);
  }))), h("div", { className: "wb-item-actions", style: { opacity: 1 } }, h(DashRadarMenu, {
    item,
    saving,
    makingTask,
    onSave: saveToKnowledge,
    onMakeTask: () => setConfirmTask(true),
    onEdit: props.onEdit
  }), summaryParts.length > 0 ? h(IconBtn, {
    name: props.expanded ? "chevronDown" : "chevronRight",
    label: props.expanded ? "收起摘要" : "展开摘要",
    onClick: props.onToggle
  }) : null)), item.summaryStatus === "failed" ? h("p", { className: "wb-tiny wb-muted" }, "摘要暂不可用") : null, props.expanded && summaryParts.length > 0 ? h("div", {
    style: {
      display: "grid",
      gap: 5,
      marginTop: 4,
      padding: "9px 10px",
      border: "1px solid " + T.border1,
      borderRadius: 10,
      background: T.layer2
    }
  }, summaryParts.map(function(part) {
    return h("div", { key: part.key, style: { display: "flex", alignItems: "flex-start", gap: 8 } }, h("span", { style: { flex: "none", width: 56, fontSize: 11, color: T.text2 } }, part.label), h("span", { style: { fontSize: 11.5, lineHeight: 1.6, color: T.text } }, part.text));
  }), needsDigest ? h("div", { style: { marginTop: 4, fontSize: 11, color: T.text2 } }, "当前为原文摘录；在操作菜单选择「生成四段摘要」，使用宿主模型归纳。") : null) : null);
}
function DashRadarMenu(props) {
  const item = props.item;
  const [open, setOpen] = React19.useState(false);
  const entries = [
    {
      key: "save",
      icon: "book",
      label: props.saving ? "收藏中…" : "收藏到知识空间",
      disabled: props.saving,
      run: props.onSave
    },
    {
      key: "task",
      icon: "play",
      label: props.makingTask ? "生成中…" : "添加为我的待办",
      disabled: props.makingTask,
      run: props.onMakeTask
    },
    {
      key: "summarize",
      icon: "book",
      label: "生成四段摘要",
      run: function() {
        WB.actions.radarSummarize([item.id], item.summaryStatus === "failed").then(function(result) {
          WB.toast(result.jobId ? "摘要已进入后台队列：" + result.jobId : result.failed > 0 ? "摘要：成功 " + result.done + " / 失败 " + result.failed : result.done > 0 ? "已生成四段摘要" : result.note || "无需生成", result.failed > 0 ? "warn" : "ok");
          return WB.actions.reload();
        }).catch(function() {
        });
      }
    },
    { key: "edit", icon: "edit", label: "编辑四段摘要", run: props.onEdit },
    {
      key: "delete",
      icon: "trash",
      label: "删除这条资讯",
      run: function() {
        if (!window.confirm("删除这条资讯？"))
          return;
        WB.actions.deleteRadarItem(item.id).catch(function() {
        });
      }
    },
    {
      key: "ai",
      icon: "sparkles",
      label: "AI 分析（带上下文）",
      run: function() {
        WB.assistant.add({
          kind: "radar",
          id: item.id,
          title: item.title,
          url: item.url || null,
          body: item.excerpt || ""
        });
      }
    }
  ];
  return h("div", { style: { position: "relative", flex: "none", zIndex: open ? 30 : void 0 } }, open ? h("div", {
    style: {
      position: "absolute",
      top: "100%",
      right: 0,
      marginTop: 4,
      display: "flex",
      flexDirection: "column",
      gap: 1,
      minWidth: 152,
      padding: 4,
      border: "1px solid " + T.border1,
      borderRadius: 9,
      background: T.layer1,
      boxShadow: "0 8px 22px rgba(0,0,0,.32)"
    }
  }, entries.map(function(entry) {
    return h("button", {
      key: entry.key,
      type: "button",
      disabled: !!entry.disabled,
      onClick: function() {
        setOpen(false);
        entry.run();
      },
      style: {
        appearance: "none",
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        textAlign: "left",
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: T.text,
        font: "inherit",
        fontSize: 11.5,
        lineHeight: 1.7,
        padding: "3px 7px",
        cursor: entry.disabled ? "default" : "pointer",
        opacity: entry.disabled ? 0.55 : 1
      }
    }, h(Icon, { name: entry.icon, size: 11 }), entry.label);
  })) : null, h(IconBtn, {
    name: "more",
    label: "这条资讯的操作",
    active: open,
    onClick: function() {
      setOpen(!open);
    }
  }));
}
function DashRadarModal(props) {
  const editing = props.item || null;
  const [title, setTitle] = React19.useState("");
  const [source, setSource] = React19.useState("");
  const [url, setUrl] = React19.useState("");
  const [publishedAt, setPublishedAt] = React19.useState("");
  const [topics, setTopics] = React19.useState("");
  const [change, setChange] = React19.useState("");
  const [usage, setUsage] = React19.useState("");
  const [risk, setRisk] = React19.useState("");
  const [practice, setPractice] = React19.useState("");
  const [busy, setBusy] = React19.useState(false);
  const [error, setError] = React19.useState(null);
  React19.useEffect(function() {
    if (!props.open)
      return;
    const item = props.item || null;
    const summary = item && item.summary || {};
    setTitle(item ? item.title || "" : "");
    setSource(item ? item.source || "" : "");
    setUrl(item ? item.url || "" : "");
    setPublishedAt(item && item.publishedAt ? String(item.publishedAt).slice(0, 10) : "");
    setTopics(item && Array.isArray(item.topics) ? item.topics.join(", ") : "");
    setChange(summary.change || "");
    setUsage(summary.usage || "");
    setRisk(summary.risk || "");
    setPractice(summary.practice || "");
    setBusy(false);
    setError(null);
  }, [props.open, props.item]);
  if (!props.open)
    return null;
  function submit(event) {
    if (event)
      event.preventDefault();
    if (busy)
      return;
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle) {
      setError("标题不能为空");
      return;
    }
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setError("链接需以 http:// 或 https:// 开头");
      return;
    }
    let publishedIso = null;
    if (publishedAt) {
      const parsed = /* @__PURE__ */ new Date(publishedAt + "T00:00:00");
      publishedIso = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    setBusy(true);
    setError(null);
    const payload = {
      title: trimmedTitle,
      source: source.trim() || (editing ? editing.source : "manual"),
      url: trimmedUrl || null,
      publishedAt: publishedIso,
      topics: topics.split(/[,，\s]+/).map(function(topic) {
        return topic.trim();
      }).filter(Boolean),
      summary: {
        change: change.trim(),
        usage: usage.trim(),
        risk: risk.trim(),
        practice: practice.trim()
      }
    };
    if (editing)
      payload.id = editing.id;
    WB.actions.saveRadarItem(payload).then(function() {
      setBusy(false);
      WB.toast(editing ? "资讯已更新" : "资讯已添加到技术雷达", "ok");
      props.onClose();
    }).catch(function(e) {
      setBusy(false);
      setError(String(e && e.message || e));
    });
  }
  return h(Modal, {
    open: true,
    title: editing ? "编辑资讯" : "手动添加资讯",
    sub: editing ? "补全四段摘要后，雷达卡片会展示结构化结论；摘要内容仍由你或 Agent 负责事实准确性" : "登记的资讯会和采集来源一起进入技术雷达",
    onClose: props.onClose,
    width: 580,
    footer: h(React19.Fragment, null, h(Btn, { onClick: props.onClose, disabled: busy, children: "取消" }), h("div", { className: "wb-spacer" }), h(Btn, {
      kind: "primary",
      icon: "check",
      disabled: busy,
      onClick: submit,
      children: busy ? "保存中…" : editing ? "保存修改" : "添加资讯"
    }))
  }, h("form", { onSubmit: submit, className: "wb-stack", style: { gap: 11 } }, h(Field, { label: "标题" }, h(Input, {
    value: title,
    autoFocus: true,
    placeholder: "例如：Harness 新增 Slots 整页扩展点",
    onChange: function(event) {
      setTitle(event.target.value);
    }
  })), h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, h(Field, { label: "来源" }, h(Input, {
    value: source,
    placeholder: "官方博客 / GitHub Trending",
    onChange: function(event) {
      setSource(event.target.value);
    }
  })), h(Field, { label: "发布日期" }, h(Input, {
    type: "date",
    value: publishedAt,
    onChange: function(event) {
      setPublishedAt(event.target.value);
    }
  }))), h(Field, { label: "链接" }, h(Input, {
    type: "url",
    value: url,
    placeholder: "https://",
    onChange: function(event) {
      setUrl(event.target.value);
    }
  })), h(Field, { label: "主题", hint: "逗号或空格分隔，会参与关注主题过滤" }, h(Input, {
    value: topics,
    placeholder: "Agent, RAG",
    onChange: function(event) {
      setTopics(event.target.value);
    }
  })), h(Divider), h("div", { className: "wb-label", style: { marginBottom: -2 } }, "四段摘要（可留空；抓取来的资讯只有原文摘录）"), h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, h(Field, { label: "技术变化" }, h(Textarea, {
    value: change,
    rows: 2,
    placeholder: "这次变化的关键事实是什么？",
    onChange: function(event) {
      setChange(event.target.value);
    }
  })), h(Field, { label: "应用场景" }, h(Textarea, {
    value: usage,
    rows: 2,
    placeholder: "适合在什么场景使用？",
    onChange: function(event) {
      setUsage(event.target.value);
    }
  })), h(Field, { label: "采用风险" }, h(Textarea, {
    value: risk,
    rows: 2,
    placeholder: "引入后可能踩什么坑？",
    onChange: function(event) {
      setRisk(event.target.value);
    }
  })), h(Field, { label: "推荐实践" }, h(Textarea, {
    value: practice,
    rows: 2,
    placeholder: "建议怎么落地？",
    onChange: function(event) {
      setPractice(event.target.value);
    }
  }))), error ? h("div", { role: "alert", style: { color: T.err, fontSize: 12 } }, error) : null, h("button", { type: "submit", style: { display: "none" } })));
}

// src/client/features/news/NewsPage.ts
function RadarPage() {
  const state = useStore();
  const data = state.data || {};
  const [page, setPage] = React20.useState(0);
  const [query, setQuery] = React20.useState("");
  const [topic, setTopic] = React20.useState("all");
  const [working, setWorking] = React20.useState(false);
  const [editing, setEditing] = React20.useState(false);
  const [editingItem, setEditingItem] = React20.useState(null);
  const [expandedIds, setExpandedIds] = React20.useState({});
  const rows = (data.radar || []).filter((item) => !item.archivedAt && !isIgnoredNews(item)).filter(function(row) {
    return (topic === "all" || (row.topics || []).includes(topic)) && (!query || [row.title, row.excerpt].join(" ").toLowerCase().includes(query.toLowerCase()));
  }).sort(function(a, b) {
    const relevance = newsRelevance(b, data.settings?.topics || [], data.projects || []) - newsRelevance(a, data.settings?.topics || [], data.projects || []);
    if (relevance) return relevance;
    return new Date(b.publishedAt || b.fetchedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.fetchedAt || a.createdAt).getTime();
  });
  function summarize() {
    setWorking(true);
    WB.actions.radarSummarize([]).then(function(result) {
      if (result.jobId) {
        WB.toast("摘要已进入后台队列：" + result.jobId, "ok");
        return WB.actions.reload();
      }
      WB.toast("摘要成功 " + (result.done || 0) + " 条，失败 " + (result.failed || 0) + " 条" + (result.note ? "：" + result.note : ""), result.status === "ok" ? "ok" : "err");
      return WB.actions.reload();
    }).catch(function(e) {
      WB.toast(String(e.message || e), "err");
    }).finally(function() {
      setWorking(false);
    });
  }
  return h(React20.Fragment, null, h(WorkflowJobs, { jobs: data.jobs || [], kind: "summary" }), h(PageHead, { icon: "radar", title: "资讯", sub: "近期 AI 进展、模型与智能体工具、GitHub 项目发现；失效内容自动退出推荐。", actions: h("div", { className: "wb-row wb-row--wrap" }, h(Btn, { icon: "refresh", disabled: state.busy, onClick: function() {
    WB.actions.fetchRadar().catch(function() {
    });
  }, children: "获取资讯" }), h(Btn, { icon: "sparkles", disabled: working, onClick: summarize, children: working ? "摘要中…" : "生成摘要" }), h(Btn, { icon: "plus", onClick: function() {
    setEditingItem(null);
    setEditing(true);
  }, children: "添加资讯" }), h("a", { className: "wb-btn", href: "https://github.com/search?type=repositories&s=stars&o=desc&q=" + encodeURIComponent("topic:artificial-intelligence stars:>100 created:>" + new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)), target: "_blank", rel: "noopener noreferrer" }, "GitHub 新项目榜")) }), h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 16 } }, h(Input, { "aria-label": "搜索资讯", placeholder: "搜索资讯", value: query, onChange: function(e) {
    setQuery(e.target.value);
  } }), h(Select, { value: topic, options: [{ value: "all", label: "全部主题" }].concat((data.settings && data.settings.topics || []).map(function(value) {
    return { value, label: value };
  })), onChange: function(e) {
    setTopic(e.target.value);
  } })), rows.length ? h("div", { className: "wb-news-grid" }, rows.slice(pageIndex(page, rows.length) * PAGE_SIZE, (pageIndex(page, rows.length) + 1) * PAGE_SIZE).map(function(item) {
    return h(Panel, { key: item.id, bodyStyle: { padding: "10px 14px" } }, h(DashRadarRow, { item, expanded: expandedIds[item.id] === true, onToggle: () => setExpandedIds((previous) => ({ ...previous, [item.id]: !previous[item.id] })), onEdit: () => {
      setEditingItem(item);
      setEditing(true);
    } }));
  })) : h(Empty, { icon: "radar", title: "没有匹配的资讯", hint: "设置关注主题后获取资讯；无需手动填写 RSS。" }), h(Pagination, { page, total: rows.length, onChange: setPage }), h(DashRadarModal, { open: editing, item: editingItem, onClose: function() {
    setEditing(false);
  } }));
}

// src/client/features/inbox/worklists.ts
WB.pages.replies = RepliesPage;
WB.pages.radar = RadarPage;

// src/client/features/inbox/FocusedInbox.tsx
var React21 = __toESM(require("react"), 1);

// src/shared/inbox-triage.ts
function isIrrelevantConversation(data, conversation) {
  const account = data.messageInbox?.accountId, group = conversation.groupId;
  const count = conversation.unreadCount, head = conversation.latestMsgId;
  if (!account || !group || !head || !Number.isInteger(count) || count <= 0) return false;
  const cursor = data.syncCursors?.[account + ":" + group];
  if (!cursor || cursor.accountId !== account || cursor.intakePolicy !== "focused-v1" || cursor.resumeBefore || cursor.lastMsgId !== head || cursor.unreadHeadId !== head || cursor.unreadCount !== count || data.syncCursors?.["__pending:" + account]?.pendingGroups?.some((row) => row.groupId === group)) return false;
  const ids = new Set(Array.isArray(cursor.unreadMsgIds) ? cursor.unreadMsgIds : []);
  if (ids.size !== count || !ids.has(head)) return false;
  const sources = (data.sources || []).filter((source) => source.provider === "yunzhijia" && source.locator?.accountId === account && source.locator?.groupId === group);
  const sourceIds = new Set(sources.map((source) => source.id));
  if ((data.tasks || []).some((task) => !["completed", "cancelled"].includes(task.status) && (sourceIds.has(task.sourceRefId) || task.sourceRefs?.some((ref) => sourceIds.has(ref.sourceId))))) return false;
  if ((data.replies || []).some((reply) => ["待回复", "已确认收到"].includes(reply.stage) && (sourceIds.has(reply.sourceId) || reply.accountId === account && reply.groupId === group))) return false;
  return [...ids].every((msgId) => {
    const matches = sources.filter((source2) => source2.locator.msgId === msgId);
    if (matches.length !== 1) return false;
    const source = matches[0];
    if (source.locator.direction !== "inbound" || String(source.excerpt || "").length >= 4e3 || source.selection?.policy !== "focused-v1" || !source.selection.reasons?.includes("unread")) return false;
    const entries = (data.analysisQueue || []).filter((row) => row.sourceId === source.id);
    return entries.length === 1 && entries.every((row) => row.accountId === account && row.groupId === group && row.msgId === msgId && row.status === "done" && row.analysis?.relevance === "irrelevant" && row.analysis.noise === true && Array.isArray(row.analysis.items) && !row.analysis.items.length && Number.isFinite(Date.parse(source.fetchedAt)) && Date.parse(row.analyzedAt) >= Date.parse(source.fetchedAt));
  });
}

// src/client/features/inbox/FocusedInbox.tsx
function FocusedInbox({ data }) {
  const inbox = data.messageInbox, account = inbox?.accountId, sources = (data.sources || []).filter((s) => account && s.locator?.accountId === account && s.selection?.policy === "focused-v1"), unread = (inbox?.conversations || []).filter((c) => c.unreadCount > 0);
  const ownSources = new Set((data.sources || []).filter((s) => account && s.locator?.accountId === account).map((s) => s.id));
  const [showAll, setShowAll] = React21.useState(false);
  React21.useEffect(() => setShowAll(false), [account]);
  const hidden = new Set(unread.filter((c) => isIrrelevantConversation(data, c)).map((c) => c.groupId));
  const visible = showAll ? unread : unread.filter((c) => !hidden.has(c.groupId));
  const meetings = (data.tasks || []).filter((t) => t.eventType === "meeting" && !t.archivedAt && !["completed", "cancelled"].includes(t.status) && Date.parse(t.meetingEnd || t.meetingStart) > Date.now() && (ownSources.has(t.sourceRefId) || (t.sourceRefs || []).some((r) => ownSources.has(r.sourceId)))).sort((a, b) => Date.parse(a.meetingStart) - Date.parse(b.meetingStart)).slice(0, 3);
  return /* @__PURE__ */ React21.createElement(Panel, { title: "消息与会议", icon: "chat" }, /* @__PURE__ */ React21.createElement("div", { className: "wb-stack", "aria-label": "云之家重点收件箱" }, /* @__PURE__ */ React21.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React21.createElement(Badge, { tone: inbox?.unreadTotal > 0 ? "warn" : "idle" }, "未读总数 ", inbox?.unreadTotal ?? "未知"), /* @__PURE__ */ React21.createElement(Badge, { tone: "idle" }, "收录 @本人 ", sources.filter((s) => s.selection.reasons.includes("mention_me")).length), /* @__PURE__ */ React21.createElement(Badge, { tone: "idle" }, "收录 @全员 ", sources.filter((s) => s.selection.reasons.includes("mention_all")).length), /* @__PURE__ */ React21.createElement(Btn, { size: "sm", onClick: () => WB.go("replies") }, "待回复"), /* @__PURE__ */ React21.createElement(Btn, { size: "sm", onClick: () => WB.go("tasks") }, "待处理与会议")), inbox && /* @__PURE__ */ React21.createElement("p", { className: "wb-tiny wb-muted" }, "消息快照：", inbox.at ? WB.fmt.relative(inbox.at) : "尚未同步", " · 日历：", inbox.calendar?.status === "ok" ? "已同步 " + inbox.calendar.found + " 场" : inbox.calendar?.note || "尚未同步"), !!hidden.size && /* @__PURE__ */ React21.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React21.createElement("span", { className: "wb-tiny wb-muted" }, "AI 判定无关 ", hidden.size, " 个会话", showAll ? "" : "，已在工作台收起", "；云之家仍为未读。"), /* @__PURE__ */ React21.createElement(Btn, { size: "sm", onClick: () => setShowAll(!showAll) }, showAll ? "收起无关会话" : "显示全部")), !!unread.length && /* @__PURE__ */ React21.createElement("details", null, /* @__PURE__ */ React21.createElement("summary", null, "未读会话（", visible.length, "）"), (showAll ? visible : visible.slice(0, 10)).map((c) => /* @__PURE__ */ React21.createElement("div", { className: "wb-row wb-row--wrap", key: c.groupId, style: { gap: 8, padding: "6px 0", overflowWrap: "anywhere" } }, /* @__PURE__ */ React21.createElement("span", { style: { minWidth: 0, flex: 1 } }, c.name), showAll && hidden.has(c.groupId) && /* @__PURE__ */ React21.createElement(Badge, { tone: "idle" }, "AI 判定无关"), /* @__PURE__ */ React21.createElement(Badge, { tone: "warn" }, c.unreadCount))), !visible.length && /* @__PURE__ */ React21.createElement("p", { className: "wb-tiny wb-muted" }, "其余未读会话均已收起，可显示全部查看。"), !showAll && visible.length > 10 && /* @__PURE__ */ React21.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React21.createElement("span", { className: "wb-tiny wb-muted" }, "显示最近10个未读会话。"), /* @__PURE__ */ React21.createElement(Btn, { size: "sm", onClick: () => setShowAll(true) }, "显示全部")), showAll && !hidden.size && unread.length > 10 && /* @__PURE__ */ React21.createElement(Btn, { size: "sm", onClick: () => setShowAll(false) }, "收起列表")), meetings.map((t) => /* @__PURE__ */ React21.createElement("div", { key: t.id, className: "wb-row wb-row--wrap", style: { gap: 8, overflowWrap: "anywhere" } }, /* @__PURE__ */ React21.createElement(Badge, { tone: "accent" }, Date.parse(t.meetingStart) < Date.now() ? "会议进行中" : "即将开会"), /* @__PURE__ */ React21.createElement("span", { style: { minWidth: 0, flex: 1 } }, t.title, " · ", WB.fmt.datetime(t.meetingStart), t.meetingLocation ? " · " + t.meetingLocation : "")))));
}

// src/client/features/dashboard/dashboard.ts
var React28 = __toESM(require("react"), 1);

// src/client/components/SyncStatus.tsx
var React22 = __toESM(require("react"), 1);
function SyncStatus({ report, busy, onRetry }) {
  if (!report) return null;
  return /* @__PURE__ */ React22.createElement("details", { className: "wb-compact-status" }, /* @__PURE__ */ React22.createElement("summary", null, /* @__PURE__ */ React22.createElement("span", null, report.status === "ok" ? "消息同步完成" : "部分消息尚未同步"), /* @__PURE__ */ React22.createElement("span", { className: "wb-tiny wb-muted" }, "新增 ", report.added || 0, " 条"), /* @__PURE__ */ React22.createElement("button", { className: "wb-chip", type: "button", disabled: busy, onClick: (e) => {
    e?.preventDefault();
    onRetry();
  } }, busy ? "同步中…" : "再拉一次"), /* @__PURE__ */ React22.createElement("span", { className: "wb-tiny wb-muted" }, "详情")), /* @__PURE__ */ React22.createElement("p", { style: { overflowWrap: "anywhere", whiteSpace: "pre-wrap" } }, report.note || report.status));
}

// src/client/components/StatsStrip.tsx
var React23 = __toESM(require("react"), 1);
function StatsStrip({ counts, onFilter }) {
  const items = [
    { label: "待处理", value: counts.open, preset: { status: "open" } },
    { label: "今日到期", value: counts.today, preset: { dueFilter: "today" } },
    { label: "已逾期", value: counts.overdue, preset: { dueFilter: "overdue" } },
    { label: "执行中", value: counts.running || 0, preset: { status: "running" } }
  ];
  return /* @__PURE__ */ React23.createElement("div", { className: "wb-stats-strip", "aria-label": "待办统计" }, items.map((item) => /* @__PURE__ */ React23.createElement("button", { type: "button", className: "wb-chip", key: item.label, onClick: () => onFilter(item.preset) }, item.label, " ", /* @__PURE__ */ React23.createElement("strong", null, item.value))), /* @__PURE__ */ React23.createElement("button", { type: "button", className: "wb-chip", onClick: () => WB.go("tasks") }, "查看全部待办 →"));
}

// src/client/components/TaskMessageMetadata.tsx
var React24 = __toESM(require("react"), 1);
function TaskMessageMetadata({ task, data, showTime = true }) {
  const source = taskSource(task, data?.sources || []);
  if (source?.provider !== "yunzhijia") return null;
  return /* @__PURE__ */ React24.createElement("div", { role: "group", "aria-label": "消息来源", className: "wb-tiny wb-muted", style: { overflowWrap: "anywhere", marginTop: 3 } }, /* @__PURE__ */ React24.createElement("div", null, "发件人：", messageSender(source), " · 来自：", messageOrigin(source)), showTime && /* @__PURE__ */ React24.createElement("div", null, "消息发出时间：", messageSentTime(source)));
}

// src/client/features/dashboard/task-preview.ts
function DashTaskRow(props) {
  const task = props.task;
  const data = props.data;
  const due = WB.fmt.due(task.dueAt);
  const priority = dashPriorityOf(task);
  const project = dashProjectName(data, task.projectId);
  function complete() {
    WB.actions.updateTask(task.id, { status: "completed" }).catch(function() {
    });
  }
  return h("div", { className: "wb-item", style: { alignItems: "flex-start" } }, h("button", {
    type: "button",
    className: "wb-check",
    title: "标记完成",
    "aria-label": "标记“" + task.title + "”为完成",
    onClick: complete
  }, h(Icon, { name: "check", size: 11 })), h("div", { className: "wb-item-main" }, h("button", {
    type: "button",
    className: "wb-item-title",
    style: {
      display: "block",
      width: "100%",
      padding: 0,
      border: 0,
      background: "transparent",
      color: T.text,
      font: "inherit",
      fontSize: 12.5,
      fontWeight: 500,
      textAlign: "left",
      cursor: "pointer",
      overflowWrap: "anywhere"
    },
    title: "编辑这条待办",
    onClick: function() {
      WB.openTaskForm(task);
    }
  }, task.title), h("div", { className: "wb-item-sub" }, h(Badge, { tone: priority.tone }, priority.label), task.dueAt ? h("span", { style: { color: dashToneColor(due.tone), fontWeight: 600 } }, due.text) : task.meetingStart ? h("span", { className: "wb-muted" }, "会议 " + WB.fmt.datetime(task.meetingStart) + (task.meetingLocation ? " · " + task.meetingLocation : "")) : h("span", { className: "wb-muted" }, "无截止"), project ? h("span", { className: "wb-muted" }, project) : null, task.aiExtracted ? h(Badge, { tone: "accent" }, "AI 提取") : null), h(MessageSelectionBadges, { source: (data.sources || []).find((s) => s.id === task.sourceRefId), inbox: data.messageInbox }), h(TaskMessageMetadata, { task, data })), h("div", { className: "wb-item-actions" }, h(IconBtn, {
    name: "edit",
    label: "编辑",
    onClick: function() {
      WB.openTaskForm(task);
    }
  }), h(IconBtn, {
    name: "arrowRight",
    label: "在任务中心定位",
    onClick: function() {
      WB.focusTask(task.id);
    }
  }), h(IconBtn, {
    name: "sparkles",
    label: "AI 分析这条待办（带上下文进入会话）",
    onClick: function() {
      WB.assistant.add({
        kind: "task",
        id: task.id,
        title: task.title,
        body: [task.description, "状态：" + task.status + " · 优先级：" + task.priority].filter(Boolean).join("\n")
      });
    }
  })));
}

// src/client/components/CompactEmptyState.tsx
var React25 = __toESM(require("react"), 1);
function CompactEmptyState({ empty, onCreate, onBrowse }) {
  return /* @__PURE__ */ React25.createElement("div", { className: "wb-stack", style: { padding: "16px", gap: 8 } }, /* @__PURE__ */ React25.createElement("strong", null, empty ? "还没有待办" : "今天没有必须处理的待办"), /* @__PURE__ */ React25.createElement("p", { className: "wb-tiny wb-muted", style: { margin: 0 } }, empty ? "同步消息并开启 AI 后，可从待回复页确认识别出的事项。" : "其他事项可在任务中心继续查看。"), /* @__PURE__ */ React25.createElement("div", null, /* @__PURE__ */ React25.createElement(Btn, { size: "sm", kind: "primary", onClick: empty ? onCreate : onBrowse }, empty ? "新建第一条待办" : "查看全部待办")));
}

// src/client/features/dashboard/brief-export.ts
function dashBriefMarkdown(data) {
  const counts = WB.taskCounts(data);
  const lines = [];
  lines.push("# 今日简报 · " + WB.fmt.date((/* @__PURE__ */ new Date()).toISOString()));
  lines.push("");
  lines.push("## 概览");
  lines.push("- 待处理 " + counts.open + " · 今日到期 " + counts.today + " · 已逾期 " + counts.overdue + " · 执行中 " + counts.running);
  const mentions = (data.sources || []).filter(function(row) {
    return String(row.externalId || "").indexOf("yzj:msg:") === 0;
  });
  if (mentions.length > 0) {
    lines.push("");
    lines.push("## 云之家 @我（" + mentions.length + "）");
    mentions.slice(-5).forEach(function(row) {
      lines.push("- " + WB.util.truncate(row.excerpt || row.title, 100) + (row.sender ? " —— " + row.sender : ""));
    });
  }
  const tasks = WB.openTasks(data).slice(0, 8);
  if (tasks.length > 0) {
    lines.push("");
    lines.push("## 待办（" + tasks.length + "）");
    tasks.forEach(function(task) {
      const due = task.dueAt ? "（截止 " + WB.fmt.day(task.dueAt) + "）" : "";
      lines.push("- [" + (WB.TASK_STATUS[task.status] || {}).label + "] " + task.title + due);
    });
  }
  const radar = (data.radar || []).slice(-5).reverse();
  if (radar.length > 0) {
    lines.push("");
    lines.push("## 技术雷达（最近 " + radar.length + " 条）");
    radar.forEach(function(item) {
      lines.push("- " + item.title + (item.url ? " — " + item.url : ""));
    });
  }
  const pending = (data.candidates || []).filter(function(c) {
    return c && c.status === "pending";
  });
  if (pending.length > 0) {
    lines.push("");
    lines.push("## 待确认候选（" + pending.length + "）");
    pending.slice(0, 5).forEach(function(c) {
      lines.push("- " + c.title + "（置信度 " + Math.round((c.confidence || 0) * 100) + "%）");
    });
  }
  return lines.join("\n");
}

// src/client/features/dashboard/pomodoro.ts
var React26 = __toESM(require("react"), 1);
function DashPomodoro() {
  const FOCUS = 25 * 60;
  const [left, setLeft] = React26.useState(FOCUS);
  const [running, setRunning] = React26.useState(false);
  React26.useEffect(function() {
    if (!running)
      return void 0;
    const timer = setInterval(function() {
      setLeft(function(previous) {
        if (previous <= 1) {
          setRunning(false);
          WB.toast("番茄钟结束，休息一下", "ok");
          return FOCUS;
        }
        return previous - 1;
      });
    }, 1e3);
    return function() {
      clearInterval(timer);
    };
  }, [running]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return h("div", { className: "wb-row", style: { gap: 8, padding: "9px 12px", border: "1px solid " + T.border1, borderRadius: 10 } }, h(Icon, { name: "clock", size: 14 }), h("span", { className: "wb-label", style: { margin: 0 } }, "专注"), h("span", { className: "wb-mono", style: { fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" } }, mm + ":" + ss), h("div", { className: "wb-spacer" }), h(Btn, {
    size: "sm",
    kind: running ? "ghost" : "primary",
    icon: running ? "close" : "play",
    onClick: function() {
      setRunning(!running);
    },
    children: running ? "暂停" : "开始"
  }), h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "refresh",
    onClick: function() {
      setRunning(false);
      setLeft(FOCUS);
    },
    children: "重置"
  }));
}

// src/client/features/dashboard/connector-card.ts
function dashConnectorIcon(type) {
  const key2 = String(type || "").toLowerCase();
  if (key2.indexOf("git") >= 0)
    return "git";
  if (key2.indexOf("docker") >= 0)
    return "docker";
  if (key2.indexOf("db") >= 0 || key2.indexOf("sql") >= 0)
    return "database";
  if (key2.indexOf("web") >= 0 || key2.indexOf("rss") >= 0 || key2.indexOf("http") >= 0)
    return "link";
  return "plug";
}
function DashConnectorCard(props) {
  const connector = props.connector;
  const stateMeta = WB.CONNECTOR_STATE[connector.authState] || {
    label: connector.authState || "状态未知",
    tone: "idle"
  };
  const capabilities = Array.isArray(connector.capabilities) ? connector.capabilities : [];
  return h("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
      padding: "11px 12px",
      border: "1px solid " + T.border1,
      borderRadius: 12,
      background: T.layer2
    }
  }, h("div", { className: "wb-row", style: { gap: 7, minWidth: 0 } }, h("span", { style: { display: "inline-flex", color: T.text2 } }, h(Icon, { name: dashConnectorIcon(connector.type), size: 14 })), h("span", { className: "wb-ellipsis", style: { fontSize: 12.5, fontWeight: 600, color: T.text } }, connector.label || connector.type || "未命名连接"), h("span", { className: "wb-spacer" }), h(Badge, { tone: stateMeta.tone }, stateMeta.label)), capabilities.length > 0 ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 4 } }, capabilities.map(function(capability, index) {
    return dashTagPill(capability, "cap:" + capability + ":" + index);
  })) : h("span", { className: "wb-tiny wb-muted" }, "未声明能力"), connector.note ? h("div", { className: "wb-tiny wb-muted", style: { lineHeight: 1.55 } }, connector.note) : null, h("div", { className: "wb-row wb-tiny wb-muted", style: { gap: 6 } }, connector.updatedAt ? h("span", null, "更新于 " + WB.fmt.relative(connector.updatedAt)) : h("span", null, "尚无同步记录"), h("span", { className: "wb-spacer" }), h("span", { className: "wb-mono" }, String(connector.type || "connector"))));
}

// src/client/features/operations/RemindersPanel.tsx
var React27 = __toESM(require("react"), 1);
function downloadText(name2, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name2;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function RemindersPanel({ revision }) {
  const [items, setItems] = React27.useState([]), [error, setError] = React27.useState("");
  React27.useEffect(() => {
    let live = true;
    const read = () => WB.rpc("workbench/operationsStatus", {}).then((r) => {
      if (live)
        setItems(r?.reminders || []);
    }).catch((e) => {
      if (live)
        setError(e.message);
    });
    read();
    const timer = setInterval(read, 6e4);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [revision]);
  if (!items.length && !error)
    return null;
  return /* @__PURE__ */ React27.createElement(Panel, { className: "wb-panel--separated", title: "到期提醒", sub: "会前 30 分钟、24 小时内到期、超过一天待回复；关闭软件期间不弹出提醒" }, error && /* @__PURE__ */ React27.createElement("p", { role: "alert" }, error), items.slice(0, 8).map((row) => /* @__PURE__ */ React27.createElement("div", { className: "wb-reply-item", key: row.id }, /* @__PURE__ */ React27.createElement("strong", null, row.kind === "meeting" ? "会议" : row.kind === "reply" ? "待回复" : "待办", " · ", row.title), /* @__PURE__ */ React27.createElement("p", { className: "wb-tiny wb-muted" }, row.overdue ? "已过期或等待中" : "即将到期", " · ", row.at), /* @__PURE__ */ React27.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React27.createElement(Btn, { size: "sm", onClick: () => {
    if (row.kind === "reply") {
      WB.store.set({ page: "replies" });
    } else {
      const t = WB.store.get().data?.tasks?.find((t2) => t2.id === row.entityId);
      if (t)
        WB.openTaskForm(t);
      else
        WB.store.set({ page: "tasks" });
    }
  } }, "查看"), /* @__PURE__ */ React27.createElement(Btn, { size: "sm", onClick: () => WB.rpc("workbench/snoozeReminder", { id: row.id, minutes: 60 }).then(() => {
    setItems((previous) => previous.filter((item) => item.id !== row.id));
    return WB.actions.reload();
  }).catch((e) => setError(e.message)) }, "稍后 1 小时"), row.kind !== "reply" && /* @__PURE__ */ React27.createElement(Btn, { size: "sm", onClick: () => WB.rpc("workbench/exportCalendar", { id: row.entityId }).then((r) => downloadText(r.filename, r.content, "text/calendar;charset=utf-8")).catch((e) => setError(e.message)) }, "导出到日历")))), items.length > 8 && /* @__PURE__ */ React27.createElement("p", null, "还有 ", items.length - 8, " 条，请到任务中心或待回复查看。"));
}

// src/client/features/dashboard/dashboard.ts
function DashboardPage() {
  const state = WB.useStore();
  const data = state.data;
  const [radarAll, setRadarAll] = React28.useState(false);
  const [radarShowAll, setRadarShowAll] = React28.useState(false);
  const [radarExpanded, setRadarExpanded] = React28.useState(null);
  const [radarFormOpen, setRadarFormOpen] = React28.useState(false);
  const [radarEditItem, setRadarEditItem] = React28.useState(null);
  const [radarFetching, setRadarFetching] = React28.useState(false);
  const [mentionsBusy, setMentionsBusy] = React28.useState(false);
  const [quickMore, setQuickMore] = React28.useState(false);
  const [analysis, setAnalysis] = React28.useState(null);
  React28.useEffect(function() {
    let active = true;
    WB.actions.analysisStatus().then(function(status) {
      if (active) setAnalysis(status);
    }).catch(function() {
    });
    return () => {
      active = false;
    };
  }, [data?.revision]);
  if (!data) {
    return h("div", { className: "wb-page" }, h("div", { className: "wb-row", style: { gap: 9, color: T.text2, padding: "10px 0" } }, h(Spinner, { size: 16 }), h("span", null, "正在读取今日简报…")));
  }
  const counts = WB.taskCounts(data);
  const tasks = Array.isArray(data.tasks) ? data.tasks.filter((row) => !row.archivedAt) : [];
  const actionableAll = dashActionable(data);
  const shownTasks = actionableAll.slice(0, 8);
  const settings = data.settings || {};
  const topics = Array.isArray(settings.topics) ? settings.topics : [];
  const radarItems = Array.isArray(data.radar) ? data.radar : [];
  const connectors = Array.isArray(data.connectors) ? data.connectors : [];
  const stale = dashStaleInfo(data);
  const overdueSince = dashEarliestOverdue(data);
  const topicKeys = topics.map(function(topic) {
    return String(topic).toLowerCase();
  });
  const radarRestricted = !radarAll && topicKeys.length > 0;
  const radarSorted = radarItems.filter((item) => !isIgnoredNews(item) && !/^(what is|introduction to|beginner.{0,10}guide)|入门教程|基础教程/i.test(item.title || "")).filter(function(item) {
    if (!radarRestricted || (item.topics || []).some((topic) => ["AI", "GitHub"].includes(topic)))
      return true;
    const itemTopics = Array.isArray(item.topics) ? item.topics : [];
    return itemTopics.some(function(topic) {
      return topicKeys.indexOf(String(topic).toLowerCase()) >= 0;
    });
  }).slice().sort(function(a, b) {
    const priority = newsPriority(b) - newsPriority(a);
    if (priority) return priority;
    const diff = dashRadarTimeValue(b) - dashRadarTimeValue(a);
    if (diff !== 0)
      return diff;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  const radarVisible = radarSorted.slice(0, 3);
  function goTasks(preset) {
    dashStoreNavigate(preset);
  }
  const lastMentions = data && data.lastMentionsFetch ? data.lastMentionsFetch : null;
  const newMentions = lastMentions && lastMentions.added > 0 ? (data.sources || []).filter(function(row) {
    return row.provider === "yunzhijia";
  }).slice(-lastMentions.added) : [];
  function runMentionsFetch() {
    if (mentionsBusy)
      return;
    setMentionsBusy(true);
    WB.actions.fetchMentions().then(function() {
      setMentionsBusy(false);
    }).catch(function() {
      setMentionsBusy(false);
    });
  }
  const mentionsStrip = h(SyncStatus, { report: lastMentions, busy: mentionsBusy, onRetry: runMentionsFetch });
  const statStrip = h(StatsStrip, { counts, onFilter: goTasks });
  const taskPanel = h(Panel, {
    icon: "checkCircle",
    title: "今日待办",
    // 完全没有任务时隐藏副标题，空态保持干净（与右侧一致）
    sub: tasks.length === 0 ? null : actionableAll.length > 0 ? "逾期、今日到期与高优先级，共 " + actionableAll.length + " 条" : "按逾期、今日到期与高优先级筛选后没有待办",
    badge: actionableAll.length > 0 ? h(Badge, { tone: "accent" }, String(actionableAll.length)) : null,
    actions: h(React28.Fragment, null, h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "tasks",
      style: { border: "1px solid " + T.border1 },
      onClick: function() {
        WB.go("tasks");
      },
      children: "任务中心"
    }), h(Btn, {
      size: "sm",
      icon: "plus",
      onClick: function() {
        WB.openTaskForm(null);
      },
      children: "新建待办"
    })),
    flush: true
  }, shownTasks.length > 0 ? h("div", { className: "wb-list", style: { padding: "0 16px" } }, shownTasks.map(function(task) {
    return h(DashTaskRow, { key: task.id, task, data });
  })) : h(CompactEmptyState, { empty: tasks.length === 0, onCreate: () => WB.openTaskForm(null), onBrowse: () => WB.go("tasks") }), actionableAll.length > shownTasks.length ? h("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "9px 16px",
      borderTop: "1px solid " + T.border1
    }
  }, h("span", { className: "wb-tiny wb-muted" }, "还有 " + (actionableAll.length - shownTasks.length) + " 条紧急待办未展示"), h("div", { className: "wb-spacer" }), h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "arrowRight",
    onClick: function() {
      goTasks({ status: "open" });
    },
    children: "去任务中心"
  })) : null);
  const lastFetch = data && data.lastRadarFetch ? data.lastRadarFetch : null;
  const feeds = data && data.settings && data.settings.feeds || [];
  const staleLimitMs = (data && data.settings && data.settings.staleHours || 24) * 3600 * 1e3;
  const fetchStale = !lastFetch || lastFetch.at && Date.now() - new Date(lastFetch.at).getTime() > staleLimitMs;
  function runRadarFetch() {
    if (radarFetching)
      return;
    setRadarFetching(true);
    WB.actions.fetchRadar().then(function() {
      setRadarFetching(false);
    }).catch(function() {
      setRadarFetching(false);
    });
  }
  const radarEmpty = radarItems.length === 0;
  const radarStatusBase = lastFetch && lastFetch.at ? "上次抓取 " + WB.fmt.relative(lastFetch.at) + " · 新增 " + (lastFetch.added || 0) : "还没有抓取过";
  const lastSum = data && data.lastRadarSummarize ? data.lastRadarSummarize : null;
  const radarStatus = radarStatusBase;
  const radarPanel = h(
    Panel,
    {
      className: "wb-radar-panel",
      icon: "radar",
      title: "AI 动态",
      // 副标题承担全部状态信息（关注主题 + 抓取时间），不再塞进标题旁的徽章
      sub: radarEmpty ? null : "AI 进展与开源项目 · " + radarStatus,
      badge: radarEmpty ? h(Badge, { tone: "idle" }, "尚未抓取") : lastFetch && lastFetch.at && fetchStale ? h(Badge, { tone: "warn" }, "数据可能过期") : null,
      actions: h(React28.Fragment, null, h(Btn, {
        size: "sm",
        kind: "subtle",
        icon: "refresh",
        disabled: radarFetching,
        onClick: runRadarFetch,
        title: feeds.length ? "抓取 " + feeds.length + " 个已配置的 RSS/Atom 资讯源" : "使用宿主联网搜索，按关注主题发现资讯；RSS 为可选来源",
        children: radarFetching ? "抓取中…" : "抓取资讯"
      }), h(Btn, {
        size: "sm",
        kind: "subtle",
        icon: "plus",
        onClick: function() {
          setRadarEditItem(null);
          setRadarFormOpen(true);
        },
        children: "添加资讯"
      })),
      flush: true
    },
    // 「仅看关注主题」筛选从头部移到内容区：过滤属于内容操作，不再占用标题行
    !radarEmpty && topics.length > 0 ? h("div", { className: "wb-row", style: { padding: "0 16px 8px" } }, h(Chip, {
      active: !radarAll,
      onClick: function() {
        setRadarAll(!radarAll);
      },
      title: radarAll ? "只显示关注主题的资讯" : "暂时显示全部资讯",
      children: "仅看关注主题"
    }), h("div", { className: "wb-spacer" }), h("span", { className: "wb-tiny wb-muted" }, radarSorted.length + " 条")) : null,
    radarVisible.length > 0 ? h("div", { className: "wb-list", style: { padding: "0 16px" } }, radarVisible.map(function(item) {
      return h(DashRadarRow, {
        key: item.id,
        item,
        expanded: radarExpanded === item.id,
        onToggle: function() {
          setRadarExpanded(radarExpanded === item.id ? null : item.id);
        },
        onEdit: function() {
          setRadarEditItem(item);
        }
      });
    })) : h(Empty, {
      style: { flex: "1 1 auto", justifyContent: "center" },
      icon: "radar",
      title: radarEmpty ? "暂无 AI 动态" : "关注主题下暂无资讯",
      hint: radarEmpty ? "设置关注主题后点「抓取资讯」，使用宿主联网搜索自动发现；也可手动登记。" : topics.join("、") + " 下暂无资讯。可以查看全部资讯，或在“连接与设置”里调整关注主题。",
      action: h("div", { className: "wb-row", style: { gap: 8, marginTop: 2 } }, radarEmpty ? h(Btn, {
        size: "sm",
        kind: "primary",
        icon: "refresh",
        disabled: radarFetching,
        onClick: runRadarFetch,
        children: radarFetching ? "抓取中…" : "抓取资讯"
      }) : h(Btn, {
        size: "sm",
        icon: "eye",
        onClick: function() {
          setRadarAll(true);
        },
        children: "查看全部资讯"
      }), h(Btn, {
        size: "sm",
        icon: "plus",
        onClick: function() {
          setRadarEditItem(null);
          setRadarFormOpen(true);
        },
        children: "手动添加资讯"
      }))
    }),
    radarSorted.length > 3 ? h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 16px",
        borderTop: "1px solid " + T.border1
      }
    }, h("span", { className: "wb-tiny wb-muted" }, "更多内容在资讯页查看"), h("div", { className: "wb-spacer" }), h(Btn, {
      size: "sm",
      kind: "subtle",
      onClick: function() {
        WB.go("radar");
      },
      children: "全部资讯"
    })) : null
  );
  const replies = data && data.replies || [];
  const replyOpen = replies.filter(function(reply) {
    return reply.stage === "待回复" || reply.stage === "已确认收到";
  }).sort(function(left, right) {
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  });
  const replyDone = replies.filter(function(reply) {
    return reply.stage === "已回复" || reply.stage === "不需回复";
  }).length;
  const replyStageTone2 = function(stage) {
    if (stage === "已回复")
      return "ok";
    return "warn";
  };
  const replyPanel = h(Panel, {
    className: "wb-panel--separated",
    icon: "link",
    title: "待回复",
    sub: replies.length > 0 ? "点击阶段 chip 推进；关联的待办在任务中心跟踪" : null,
    badge: replyOpen.length > 0 ? h(Badge, { tone: "warn" }, String(replyOpen.length)) : replies.length > 0 ? h(Badge, { tone: "ok" }, "已清") : null,
    actions: h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "tasks",
      onClick: function() {
        WB.go("replies");
      },
      children: "查看全部回复"
    })
  }, replies.length === 0 ? h("div", { className: "wb-tiny wb-muted", style: { padding: "4px 0", lineHeight: 1.6 } }, "没有待回复的沟通。AI 识别的回复义务在此跟踪，与待办独立处理。") : h("div", { className: "wb-list" }, replyOpen.slice(0, 6).map(function(reply) {
    const source = (data.sources || []).find((source2) => source2.id === reply.sourceId);
    return h("div", { key: reply.id, className: "wb-item" }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title", style: { display: "flex", gap: 6, alignItems: "center" } }, messageSender(source || { locator: { groupId: reply.groupId } }, reply.contact), h(MessageSelectionBadges, { source, inbox: data.messageInbox }), h(Badge, { tone: replyStageTone2(reply.stage) }, reply.stage), reply.triage === "pending" ? h(Badge, { tone: "idle" }, "待AI识别") : null, reply.taskIds && reply.taskIds.length > 0 ? h(Badge, { tone: "idle" }, "关联待办 " + reply.taskIds.length) : null), h("div", { className: "wb-item-sub", style: { overflowWrap: "anywhere", whiteSpace: "normal" } }, "来自：" + messageOrigin(source, reply)), h("div", { className: "wb-item-sub wb-clamp2" }, reply.snippet || ""), h("div", { className: "wb-tiny wb-muted" }, "发出时间：" + messageSentTime(source))), h("div", { className: "wb-row", style: { gap: 5, flex: "none" } }, [
      { id: "已回复", hint: "已给出答复" },
      { id: "不需回复", hint: "无需回复" }
    ].map(function(chip) {
      return h(Chip, {
        key: chip.id,
        title: chip.hint,
        onClick: function() {
          WB.actions.setReplyStage(reply.id, chip.id).catch(function() {
          });
        },
        children: chip.id
      });
    })));
  }), replyDone > 0 ? h("div", { className: "wb-tiny wb-muted", style: { padding: "2px 4px 0" } }, "另有 " + replyDone + " 条已处理（已回复 / 不需回复）") : null));
  const quickActionsPanel = h(Panel, {
    icon: "zap",
    title: "快捷操作",
    sub: "高频入口；番茄钟与日报都在本地完成，不联网",
    actions: h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "copy",
      onClick: function() {
        WB.util.copy(dashBriefMarkdown(data)).then(function() {
          WB.toast("今日简报已复制为 Markdown", "ok");
        }).catch(function(error) {
          WB.toast(String(error && error.message || error), "err");
        });
      },
      children: "复制今日简报"
    })
  }, h(
    "div",
    { className: "wb-stack", style: { gap: 10 } },
    // 一个图标按钮，菜单向上展开（不并排堆按钮）
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 } }, quickMore ? h("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 1,
        minWidth: 168,
        padding: 4,
        border: "1px solid " + T.border1,
        borderRadius: 10,
        background: T.layer1
      }
    }, [
      { key: "new", icon: "plus", label: "新建待办", run: function() {
        WB.openTaskForm(null);
      } },
      { key: "search", icon: "search", label: "搜索", run: function() {
        WB.go("search");
      } },
      { key: "toolbox", icon: "toolbox", label: "开发工具箱", run: function() {
        WB.go("toolbox");
      } },
      { key: "agents", icon: "agent", label: "Agent 中心", run: function() {
        WB.go("agents");
      } },
      { key: "mentions", icon: "sparkles", label: mentionsBusy ? "拉取 @我…" : "拉取 @我", run: runMentionsFetch, disabled: mentionsBusy },
      { key: "radar", icon: "refresh", label: radarFetching ? "抓取中…" : "抓取资讯", run: runRadarFetch, disabled: radarFetching },
      { key: "aiextract", icon: "sparkles", label: "运行 AI 分析", run: function() {
        WB.actions.analyzeRun();
      } },
      { key: "radarsum", icon: "book", label: "生成资讯摘要", run: function() {
        WB.actions.radarSummarize([]);
      } }
    ].map(function(item) {
      return h("button", {
        key: item.key,
        type: "button",
        disabled: !!item.disabled,
        onClick: function() {
          setQuickMore(false);
          item.run();
        },
        style: {
          appearance: "none",
          display: "flex",
          alignItems: "center",
          gap: 7,
          width: "100%",
          textAlign: "left",
          border: 0,
          borderRadius: 7,
          background: "transparent",
          color: T.text,
          font: "inherit",
          fontSize: 12,
          lineHeight: 1.7,
          padding: "4px 8px",
          cursor: item.disabled ? "default" : "pointer",
          opacity: item.disabled ? 0.55 : 1
        }
      }, h(Icon, { name: item.icon, size: 12 }), item.label);
    })) : null, h(IconBtn, {
      name: "zap",
      label: "快捷操作",
      active: quickMore,
      onClick: function() {
        setQuickMore(!quickMore);
      }
    })),
    h(DashPomodoro, null)
  ));
  const connectorsPanel = h(Panel, {
    icon: "plug",
    title: "连接状态",
    sub: "来自 Host 的连接器快照；未配置不会影响本地待办与工具",
    actions: h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "settings",
      onClick: function() {
        WB.go("settings");
      },
      children: "连接与设置"
    })
  }, connectors.length > 0 ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 } }, connectors.map(function(connector) {
    return h(DashConnectorCard, { key: connector.id, connector });
  })) : h(Empty, {
    icon: "plug",
    title: "还没有连接器",
    hint: "在“连接与设置”里记录云之家 CLI、Git / GitHub、Docker 等接入方式，这里会显示授权状态与能力。",
    action: h(Btn, {
      size: "sm",
      onClick: function() {
        WB.go("settings");
      },
      children: "去配置"
    })
  }));
  return h(
    "div",
    null,
    h(PageHead, {
      icon: "dashboard",
      title: "今日简报",
      sub: "需要处理 " + counts.open + " 项 · 逾期 " + counts.overdue + " 项 · 今日到期 " + counts.today + " 项 · 数据更新于 " + (data.updatedAt ? WB.fmt.relative(data.updatedAt) : "尚未写入"),
      actions: [
        h(Btn, {
          key: "refresh",
          size: "sm",
          icon: "refresh",
          disabled: state.busy || mentionsBusy,
          onClick: runMentionsFetch,
          children: state.busy || mentionsBusy ? "刷新中…" : "刷新"
        })
        // 「新建待办」主按钮只保留全局工具栏一处（用户反馈 #4：同屏三个主按钮互相打架）
      ]
    }),
    h(FocusedInbox, { data }),
    stale ? h("div", { className: "wb-banner wb-banner--warn", style: { marginBottom: 16 } }, h("span", { className: "wb-banner-icon" }, h(Icon, { name: "clock", size: 15 })), h("div", { className: "wb-banner-main" }, h("div", { className: "wb-banner-title" }, "数据可能过期"), h("div", { className: "wb-banner-sub" }, "Host 快照已 " + WB.fmt.relative(stale.updatedAt) + " 未刷新（陈旧阈值 " + stale.staleHours + " 小时），任务与资讯可能不是最新。")), h("div", { className: "wb-banner-actions" }, h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "refresh",
      disabled: state.busy || mentionsBusy,
      onClick: runMentionsFetch,
      children: "立即刷新"
    }))) : null,
    mentionsStrip,
    h(RemindersPanel, { revision: data.revision }),
    /** TODO 22：AI 识别状态面板（与自动化开关共用配置语义，展示即真实） */
    analysis && (analysis.pending || analysis.awaitingHuman || analysis.failed || analysis.done || analysis.skipped || analysis.historical) ? h(Panel, {
      icon: "sparkles",
      title: "AI 识别",
      sub: analysis?.modelHealth?.note || (analysis?.lastBatch ? "最近一批：" + analysis.lastBatch.inputCount + " 条消息 · " + analysis.lastBatch.modelCalls + " 次模型请求 · " + (analysis.lastBatch.reusedBatches ? "复用规则" : "初始化规则") + "；失败逐条保留" : "同账号复用会话、批量识别；失败逐条保留重试"),
      badge: analysis ? h(Badge, { tone: analysis.awaitingHuman > 0 ? "warn" : analysis.failed > 0 ? "err" : "ok" }, "待识别 " + analysis.pending + " · 待确认 " + analysis.awaitingHuman + " · 失败 " + analysis.failed + " · 完成 " + analysis.done + (analysis.skipped || analysis.historical ? " · 已跳过 " + (analysis.skipped || analysis.historical) : "")) : null,
      actions: h(Btn, {
        size: "sm",
        kind: "subtle",
        icon: "play",
        onClick: function() {
          WB.actions.analyzeRun().then(function(result) {
            WB.toast(result.jobId ? "AI 分析已进入后台队列：" + result.jobId : "AI 分析：处理 " + (result.processed || 0) + " / 失败 " + (result.failures || 0), "ok");
            return WB.actions.analysisStatus();
          }).then(function(status) {
            setAnalysis(status);
          }).catch(function() {
          });
        },
        children: "运行分析"
      })
    }, analysis.awaitingHuman > 0 || analysis.failed > 0 ? h("div", { className: "wb-stack", style: { gap: 8 } }, (analysis.entries || []).filter(function(entry) {
      return entry.status === "awaiting_human" || entry.status === "failed";
    }).slice(0, 6).map(function(entry) {
      const sourceRow = (data.sources || []).find(function(row) {
        return row.id === entry.sourceId;
      });
      return h("div", { key: entry.id, className: "wb-item" }, h(Badge, { tone: entry.status === "failed" ? "err" : "warn" }, entry.status === "failed" ? "失败" : "待确认"), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title wb-ellipsis" }, WB.util.truncate(sourceRow && sourceRow.excerpt || entry.msgId || entry.sourceId, 46)), entry.status === "failed" ? h("div", { className: "wb-item-sub" }, "已失败 " + (entry.attempts || 0) + " 次" + ((entry.attempts || 0) >= 3 ? " · 需手动重试" : "") + (entry.lastError ? " · " + entry.lastError : "")) : h("div", { className: "wb-item-sub" }, entry.analysis && entry.analysis.summary || "已识别，待确认建档")), entry.status === "awaiting_human" ? h(Btn, {
        size: "sm",
        kind: "primary",
        icon: "check",
        onClick: function() {
          WB.actions.analyzeConfirm(entry.id).then(function() {
            return WB.actions.analysisStatus();
          }).then(function(status) {
            setAnalysis(status);
            WB.actions.reload().catch(function() {
            });
          }).catch(function() {
          });
        },
        children: "确认建档"
      }) : null);
    })) : h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.6 } }, data.settings?.aiExtract?.enabled ? analysis.pending ? "AI 已开启，待识别消息可运行分析，或在待回复页逐条处理。" : "本轮识别已完成，暂无待确认或失败条目。" : "开启「设置 → 自动化 → AI 识别」后，可处理已采集消息。")) : null,
    statStrip,
    replyPanel,
    h("div", { className: "wb-split", style: { gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", marginBottom: 16 } }, taskPanel, radarPanel),
    h("div", { style: { marginBottom: 16 } }, quickActionsPanel),
    connectorsPanel,
    h(DashRadarModal, {
      open: radarFormOpen,
      item: radarEditItem,
      onClose: function() {
        setRadarFormOpen(false);
        setRadarEditItem(null);
      }
    })
  );
}
WB.pages.dashboard = DashboardPage;

// src/client/features/tasks/message-time.ts
function taskMessageTime(task, sources) {
  const source = taskSource(task, sources);
  if (source?.provider !== "yunzhijia" || typeof source.locator?.sentAt !== "string") return null;
  const time = Date.parse(source.locator.sentAt);
  return Number.isFinite(time) ? time : null;
}
function matchesTaskMessageDates(time, from, to) {
  if (!from && !to) return true;
  if (time === null) return false;
  const day = new Date(time + 8 * 36e5).toISOString().slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}
function sortTasksByMessageTime(tasks, sources, order) {
  if (order !== "message-newest" && order !== "message-oldest") return tasks;
  const times = new Map(tasks.map((task) => [task, taskMessageTime(task, sources)]));
  return tasks.slice().sort((a, b) => {
    const left = times.get(a), right = times.get(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return order === "message-newest" ? right - left : left - right;
  });
}

// src/client/features/tasks/task-center.ts
var React29 = __toESM(require("react"), 1);
function tcToneColor(tone) {
  if (tone === "err")
    return T.err;
  if (tone === "warn")
    return T.warn;
  if (tone === "ok")
    return T.ok;
  if (tone === "accent")
    return T.accent;
  return T.text2;
}
function tcPriorityOf(task) {
  return WB.TASK_PRIORITY[task.priority] || WB.TASK_PRIORITY.normal;
}
function tcDueValue(task) {
  const at = task.dueAt || task.meetingStart;
  if (!at)
    return Infinity;
  const value = new Date(at).getTime();
  return Number.isNaN(value) ? Infinity : value;
}
function tcEndOfToday() {
  const end = /* @__PURE__ */ new Date();
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}
function tcProjectName(data, projectId) {
  if (!projectId)
    return "";
  const projects = data && data.projects || [];
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId)
      return projects[index].name || "";
  }
  return "";
}
function tcProjectColor(data, projectId) {
  if (!projectId)
    return null;
  const projects = data && data.projects || [];
  for (let index = 0; index < projects.length; index += 1) {
    if (projects[index].id === projectId)
      return projects[index].color || null;
  }
  return null;
}
function tcProviderLabel(provider) {
  const key2 = String(provider || "").toLowerCase();
  if (key2 === "yunzhijia-calendar") return "云之家日历";
  if (key2 === "yunzhijia" || key2 === "yzj")
    return "云之家";
  if (key2 === "git" || key2 === "github" || key2 === "gitlab")
    return "Git";
  if (key2 === "web" || key2 === "rss" || key2 === "http")
    return "网页";
  if (key2 === "manual")
    return "手动";
  if (key2 === "docker")
    return "Docker";
  return provider ? String(provider) : "未知来源";
}
function tcFindSource(data, task) {
  return taskSource(task, data?.sources || []);
}
function tcBoardStatuses() {
  return ["ready", "running", "waiting_approval", "completed"];
}
function tcSortTasks(list, order = "default", sources = []) {
  const sorted = (list || []).slice().sort(function(a, b) {
    const aDone = a.status === "completed" || a.status === "cancelled" ? 1 : 0;
    const bDone = b.status === "completed" || b.status === "cancelled" ? 1 : 0;
    if (aDone !== bDone)
      return aDone - bDone;
    if (aDone === 1) {
      return String(b.completedAt || b.updatedAt || "").localeCompare(String(a.completedAt || a.updatedAt || ""));
    }
    const ad = tcDueValue(a);
    const bd = tcDueValue(b);
    if (ad !== bd)
      return ad - bd;
    const ar = tcPriorityOf(a).rank || 0;
    const br = tcPriorityOf(b).rank || 0;
    if (ar !== br)
      return br - ar;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
  return sortTasksByMessageTime(sorted, sources, order);
}
function tcFilterList(list, filters) {
  const opts = filters || {};
  const query = opts.query ? String(opts.query).trim().toLowerCase() : "";
  const status = opts.status || "all";
  const dueFilter = opts.dueFilter || "all";
  const now = Date.now();
  const endOfDay = tcEndOfToday();
  const weekAhead = now + 7 * 864e5;
  return (list || []).filter(function(task) {
    if ((opts.messageFrom || opts.messageTo) && !matchesTaskMessageDates(taskMessageTime(task, opts.sources || []), opts.messageFrom || "", opts.messageTo || "")) return false;
    if (query) {
      const haystack = [task.title || "", task.description || "", (task.tags || []).join(" ")].join(" ").toLowerCase();
      if (haystack.indexOf(query) < 0)
        return false;
    }
    if (opts.priority && opts.priority !== "all" && task.priority !== opts.priority)
      return false;
    if (opts.projectId && opts.projectId !== "all") {
      if (opts.projectId === "none") {
        if (task.projectId)
          return false;
      } else if (task.projectId !== opts.projectId) {
        return false;
      }
    }
    if (opts.tag && (task.tags || []).indexOf(opts.tag) < 0)
      return false;
    if (dueFilter !== "all") {
      if (task.status === "completed" || task.status === "cancelled")
        return false;
      const due = tcDueValue(task);
      if (due === Infinity)
        return false;
      if (dueFilter === "overdue" && due >= now)
        return false;
      if (dueFilter === "today" && (due < now || due > endOfDay))
        return false;
      if (dueFilter === "week" && (due < now || due > weekAhead))
        return false;
    }
    if (status !== "all") {
      if (status === "open") {
        if (task.status === "completed" || task.status === "cancelled")
          return false;
      } else if (task.status !== status) {
        return false;
      }
    }
    return true;
  });
}
function tcTabCounts(list) {
  const counts = { all: 0, open: 0, ready: 0, running: 0, waiting_approval: 0, completed: 0, overdue: 0 };
  const now = Date.now();
  (list || []).forEach(function(task) {
    counts.all += 1;
    if (task.status === "completed")
      counts.completed += 1;
    else if (task.status !== "cancelled")
      counts.open += 1;
    if (task.status === "ready")
      counts.ready += 1;
    if (task.status === "running")
      counts.running += 1;
    if (task.status === "waiting_approval")
      counts.waiting_approval += 1;
    if (task.status !== "completed" && task.status !== "cancelled" && tcDueValue(task) < now)
      counts.overdue += 1;
  });
  return counts;
}
function tcTagCounts(tasks) {
  const counts = {};
  (tasks || []).forEach(function(task) {
    ;
    (task.tags || []).forEach(function(tag) {
      if (!tag)
        return;
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return Object.keys(counts).map(function(tag) {
    return { tag, count: counts[tag] };
  }).sort(function(a, b) {
    if (b.count !== a.count)
      return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}
function TaskCenterEvidence(props) {
  const task = props.task;
  const data = props.data;
  const source = tcFindSource(data, task);
  const confidence = typeof task.confidence === "number" ? Math.round(task.confidence * 100) + "%" : "未评估";
  return h("div", {
    style: {
      border: "1px solid " + T.border1,
      borderRadius: 10,
      background: T.bg,
      padding: "9px 11px"
    }
  }, h("div", { className: "wb-row", style: { gap: 6, marginBottom: 6, flexWrap: "wrap" } }, h("span", { style: { display: "inline-flex", color: T.text2 } }, h(Icon, { name: "layers", size: 12 })), h("span", { className: "wb-tiny", style: { fontWeight: 600, color: T.text } }, "来源证据"), task.aiExtracted ? h(Badge, { tone: "accent" }, "AI 提取 · 置信度 " + confidence) : h(Badge, { tone: "idle" }, "手动创建"), h("div", { className: "wb-spacer" }), h("span", { className: "wb-tiny wb-muted" }, "更新于 " + WB.fmt.relative(task.updatedAt))), source ? h("div", { className: "wb-stack", style: { gap: 5 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 7 } }, h(Badge, { tone: "idle" }, tcProviderLabel(source.provider)), source.title ? h("span", { style: { fontSize: 12, fontWeight: 500, color: T.text } }, source.title) : null, source.url ? h("a", {
    className: "wb-link wb-tiny",
    href: source.url,
    target: "_blank",
    rel: "noreferrer noopener",
    style: { display: "inline-flex", alignItems: "center", gap: 3 }
  }, "打开原文", h(Icon, { name: "external", size: 10 })) : null, h("div", { className: "wb-spacer" }), source.provider === "yunzhijia" ? null : h("span", { className: "wb-tiny wb-muted" }, "同步于 " + WB.fmt.datetime(source.fetchedAt)), h(IconBtn, {
    name: "trash",
    label: "删除这条来源证据",
    onClick: function() {
      if (!window.confirm("删除这条来源证据？引用它的候选会一并移除，待办只解除来源关联。"))
        return;
      WB.actions.deleteSource(source.id).catch(function() {
      });
    }
  })), h(MessageSelectionBadges, { source: (data.sources || []).find((s) => s.id === task.sourceRefId), inbox: data.messageInbox }), h(TaskMessageMetadata, { task, data }), source.excerpt ? h("div", { className: "wb-code" }, source.excerpt) : null, h("div", { className: "wb-row wb-tiny wb-muted wb-row--wrap", style: { gap: 10 } }, h("span", { className: "wb-mono" }, "source " + source.id), source.externalId ? h("span", null, "外部 ID " + source.externalId) : null, source.payloadHash ? h("span", { className: "wb-mono" }, "指纹 " + String(source.payloadHash).slice(0, 12)) : null)) : h("div", { className: "wb-stack", style: { gap: 3 } }, h("span", { className: "wb-tiny", style: { color: T.text } }, "无来源证据"), h("span", { className: "wb-tiny wb-muted", style: { lineHeight: 1.6 } }, task.sourceRefId ? "这条待办引用了来源 " + task.sourceRefId + "，但当前快照中没有对应记录。" : "手动创建的待办不会关联外部来源；接入云之家或网页来源后，原始消息会记录在这里。")));
}
function TaskCenterStatusSelect(props) {
  const task = props.task;
  const meta = WB.TASK_STATUS[task.status] || { label: task.status || "未知状态", tone: "idle" };
  return h("span", { className: "wb-select-wrap", style: { width: 106 } }, h(
    "select",
    {
      className: "wb-select",
      "aria-label": "状态 " + task.title,
      title: "修改待办状态",
      value: task.status,
      disabled: props.busy,
      style: { color: tcToneColor(meta.tone), fontSize: 11.5 },
      onChange: (event) => props.onChange(event.target.value)
    },
    !WB.TASK_STATUS[task.status] ? h("option", { value: task.status }, meta.label) : null,
    Object.keys(WB.TASK_STATUS).map((key2) => h("option", { key: key2, value: key2 }, WB.TASK_STATUS[key2].label))
  ));
}
function TaskCenterRow(props) {
  const task = props.task;
  const data = props.data;
  const expanded = props.expanded;
  const highlighted = props.highlighted;
  const [busy, setBusy] = React29.useState(false);
  const [replyOpen, setReplyOpen] = React29.useState(false);
  const done = task.status === "completed" || task.status === "cancelled";
  const priority = tcPriorityOf(task);
  const due = WB.fmt.due(task.dueAt);
  const projectName = tcProjectName(data, task.projectId);
  const projectColor = tcProjectColor(data, task.projectId);
  const source = tcFindSource(data, task);
  const tags = Array.isArray(task.tags) ? task.tags : [];
  function updateStatus(status) {
    if (busy || status === task.status)
      return;
    setBusy(true);
    WB.actions.updateTask(task.id, { status }).finally(() => setBusy(false)).catch(() => {
    });
  }
  function toggleDone() {
    updateStatus(done ? "ready" : "completed");
  }
  function remove() {
    if (busy)
      return;
    const confirmed = window.confirm("删除待办“" + task.title + "”？该操作不可撤销。");
    if (!confirmed)
      return;
    setBusy(true);
    WB.actions.deleteTask(task.id).catch(function() {
      setBusy(false);
    });
  }
  return h(React29.Fragment, null, h("tr", {
    ref: props.rowRef || void 0,
    style: highlighted ? {
      background: "color-mix(in srgb, " + T.accent + " 7%, transparent)",
      boxShadow: "inset 2px 0 0 " + T.accent
    } : void 0
  }, h("td", { style: { minWidth: 220 } }, h(
    "div",
    { className: "wb-row wb-row--wrap", style: { gap: 6, alignItems: "center" } },
    null,
    // Replies are maintained by Reply ID in the dedicated inbox.
    h("button", {
      type: "button",
      className: "wb-item-title" + (done ? " is-done" : ""),
      style: {
        padding: 0,
        border: 0,
        background: "transparent",
        color: T.text,
        font: "inherit",
        fontSize: 12.5,
        fontWeight: 500,
        textAlign: "left",
        cursor: "pointer",
        overflowWrap: "anywhere"
      },
      title: "编辑这条待办",
      onClick: function() {
        WB.openTaskForm(task);
      }
    }, task.title),
    task.aiExtracted ? h(Badge, { tone: "accent" }, "AI 提取") : null,
    source ? h(Badge, { tone: "idle" }, "来源 · " + tcProviderLabel(source.provider)) : null,
    task.assignee ? h(Badge, { tone: "idle" }, task.assignee) : null
  ), tags.length > 0 ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 4, marginTop: 3 } }, tags.map(function(tag, index) {
    return h("span", {
      key: tag + ":" + index,
      style: {
        display: "inline-flex",
        alignItems: "center",
        height: 17,
        padding: "0 6px",
        borderRadius: 999,
        border: "1px solid " + T.border1,
        background: T.layer2,
        color: T.text2,
        fontSize: 10.5,
        lineHeight: 1,
        whiteSpace: "nowrap"
      }
    }, "#" + tag);
  })) : null, task.description ? h("div", { className: "wb-tiny wb-muted wb-clamp2", style: { marginTop: 2, lineHeight: 1.5 } }, task.description) : null, h(MessageSelectionBadges, { source: (data.sources || []).find((s) => s.id === task.sourceRefId), inbox: data.messageInbox }), h(TaskMessageMetadata, { task, data, showTime: false })), h("td", null, h(Badge, { tone: priority.tone }, priority.label)), h("td", null, h(TaskCenterStatusSelect, { task, busy, onChange: updateStatus })), h("td", { style: { width: 56, textAlign: "center", verticalAlign: "middle" } }, h("button", {
    type: "button",
    className: "wb-check" + (done ? " is-on" : ""),
    style: { margin: "0 auto" },
    title: done ? "重开（标记为待处理）" : "标记完成",
    "aria-label": (done ? "重开 " : "完成 ") + task.title,
    disabled: busy,
    onClick: toggleDone
  }, h(Icon, { name: "check", size: 11 }))), h("td", { className: "wb-tiny", style: { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }, title: taskMessageTime(task, data.sources || []) === null ? "无原消息时间" : messageSentTime(source) }, taskMessageTime(task, data.sources || []) === null ? h("span", { className: "wb-muted" }, "—") : h("time", { dateTime: source.locator.sentAt }, messageSentTime(source).replace("（北京时间）", ""))), h("td", null, task.dueAt ? h("span", { style: { color: tcToneColor(due.tone), fontSize: 11.5, fontWeight: 600 } }, due.text) : task.meetingStart ? h("span", { className: "wb-tiny", title: "会议开始" }, WB.fmt.datetime(task.meetingStart)) : h("span", { className: "wb-tiny wb-muted" }, "—")), h("td", null, projectName ? h("div", { className: "wb-row", style: { gap: 5, minWidth: 0 } }, h("span", {
    style: {
      flex: "none",
      width: 7,
      height: 7,
      borderRadius: 999,
      background: projectColor || T.text2,
      opacity: projectColor ? 1 : 0.55
    }
  }), h("span", { className: "wb-ellipsis", style: { fontSize: 11.5 } }, projectName)) : h("span", { className: "wb-tiny wb-muted" }, "—")), h("td", null, h("div", { className: "wb-row", style: { gap: 2, justifyContent: "flex-end" } }, taskReplyTarget(data, task.id) ? h(IconBtn, { name: "chat", label: "回复原会话 " + task.title, onClick: () => setReplyOpen(!replyOpen) }) : null, h(IconBtn, {
    name: expanded ? "chevronDown" : "chevronRight",
    label: expanded ? "收起来源证据" : "展开来源证据",
    onClick: props.onToggleEvidence
  }), h(IconBtn, {
    name: "edit",
    label: "编辑",
    onClick: function() {
      WB.openTaskForm(task);
    }
  }), h(IconBtn, { name: "trash", label: "删除", onClick: remove, disabled: busy })))), replyOpen ? h("tr", null, h("td", { colSpan: 8, style: { padding: 12 } }, h(TaskReplyPanel, { task, data, initialOpen: true }))) : null, expanded ? h("tr", null, h("td", {
    colSpan: 8,
    style: {
      padding: "0 12px 12px",
      background: "color-mix(in srgb, " + T.accent + " 3%, transparent)"
    }
  }, h(Btn, { size: "sm", icon: "agent", onClick: () => WB.actions.officeWorkflowStart("task_assist", { taskId: task.id }).then(() => WB.store.set({ page: "agents" })).catch(() => {
  }), children: "AI 整理处理方案" }), h(TaskCenterEvidence, { task, data }))) : null);
}
function TaskCenterBoardCard(props) {
  const task = props.task;
  const data = props.data;
  const [busy, setBusy] = React29.useState(false);
  const done = task.status === "completed" || task.status === "cancelled";
  const priority = tcPriorityOf(task);
  const due = WB.fmt.due(task.dueAt);
  const projectName = tcProjectName(data, task.projectId);
  const tags = Array.isArray(task.tags) ? task.tags : [];
  function open() {
    WB.openTaskForm(task);
  }
  function updateStatus(status) {
    if (busy || status === task.status)
      return;
    setBusy(true);
    WB.actions.updateTask(task.id, { status }).finally(() => setBusy(false)).catch(() => {
    });
  }
  function toggleDone() {
    updateStatus(done ? "ready" : "completed");
  }
  return h("div", {
    role: "button",
    tabIndex: 0,
    onClick: open,
    onKeyDown: function(event) {
      if (event.target !== event.currentTarget)
        return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
    title: "编辑“" + task.title + "”",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 5,
      minWidth: 0,
      padding: "8px 9px",
      border: "1px solid " + T.border1,
      borderRadius: 11,
      background: T.layer2,
      cursor: "pointer"
    }
  }, h("div", { className: "wb-row", style: { alignItems: "flex-start", gap: 6 } }, h("span", { className: "wb-item-title" + (done ? " is-done" : ""), style: { fontSize: 12, lineHeight: 1.45 } }, task.title)), h("div", { className: "wb-item-sub", style: { marginTop: 0, gap: 5 } }, h(Badge, { tone: priority.tone }, priority.label), task.dueAt ? h("span", { style: { color: tcToneColor(due.tone), fontWeight: 600 } }, due.text) : null, projectName ? h("span", { className: "wb-ellipsis", style: { maxWidth: 110 } }, projectName) : null), tags.length > 0 ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 3 } }, tags.slice(0, 3).map(function(tag, index) {
    return h("span", { key: tag + ":" + index, className: "wb-tiny wb-muted" }, "#" + tag);
  })) : null, h(MessageSelectionBadges, { source: (data.sources || []).find((s) => s.id === task.sourceRefId), inbox: data.messageInbox }), h(TaskMessageMetadata, { task, data }), h("div", {
    className: "wb-row",
    style: { gap: 8, marginTop: 3 },
    onClick: (event) => event.stopPropagation()
  }, h(TaskCenterStatusSelect, { task, busy, onChange: updateStatus }), h("button", {
    type: "button",
    className: "wb-check" + (done ? " is-on" : ""),
    style: { width: 14, height: 14, marginTop: 2 },
    title: done ? "重开" : "标记完成",
    "aria-label": (done ? "重开 " : "完成 ") + task.title,
    disabled: busy,
    onClick: toggleDone
  }, h(Icon, { name: "check", size: 10 }))), h(TaskReplyPanel, { task, data }));
}
function TaskCenterPage() {
  const state = WB.useStore();
  const data = state.data;
  const [page, setPage] = React29.useState(0);
  const [view, setView] = React29.useState("list");
  const [search, setSearch] = React29.useState("");
  const [status, setStatus] = React29.useState("all");
  const [dueFilter, setDueFilter] = React29.useState("all");
  const [messageFrom, setMessageFrom] = React29.useState("");
  const [messageTo, setMessageTo] = React29.useState("");
  const [sortOrder, setSortOrder] = React29.useState("default");
  const [priority, setPriority] = React29.useState("all");
  const [projectId, setProjectId] = React29.useState("all");
  const [tag, setTag] = React29.useState(null);
  const [expandedId, setExpandedId] = React29.useState(null);
  const [showAllTags, setShowAllTags] = React29.useState(false);
  const [pendingFocusId, setPendingFocusId] = React29.useState(null);
  const [candidateBusy, setCandidateBusy] = React29.useState(false);
  const [dragStatus, setDragStatus] = React29.useState(null);
  const [typeFilter, setTypeFilter] = React29.useState("all");
  React29.useEffect(() => {
    if (!pendingFocusId && !state.focusTaskId) setPage(0);
  }, [search, status, dueFilter, priority, projectId, tag, typeFilter, messageFrom, messageTo, sortOrder]);
  const focusRowRef = React29.useRef(null);
  const preset = state.taskPreset;
  const focusId = state.focusTaskId;
  React29.useEffect(function() {
    if (!preset)
      return;
    WB.store.set({ taskPreset: null });
    if (preset.status)
      setStatus(preset.status);
    if (preset.dueFilter)
      setDueFilter(preset.dueFilter);
    if (preset.priority)
      setPriority(preset.priority);
    if (preset.projectId)
      setProjectId(preset.projectId);
    if (preset.view)
      setView(preset.view);
  }, [preset]);
  React29.useEffect(function() {
    if (!focusId)
      return;
    setView("list");
    setStatus("all");
    setDueFilter("all");
    setMessageFrom("");
    setMessageTo("");
    setSortOrder("default");
    setPriority("all");
    setProjectId("all");
    setTypeFilter("all");
    setTag(null);
    setSearch("");
    setExpandedId(focusId);
    setPendingFocusId(focusId);
    const ordered = tcSortTasks((data?.tasks || []).filter((row) => !row.archivedAt));
    setPage(Math.floor(Math.max(0, ordered.findIndex((row) => row.id === focusId)) / PAGE_SIZE));
    WB.store.set({ focusTaskId: null });
  }, [focusId]);
  React29.useEffect(function() {
    if (!pendingFocusId)
      return void 0;
    const timer = setTimeout(function() {
      const node = focusRowRef.current;
      if (node && typeof node.scrollIntoView === "function") {
        try {
          node.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch (e) {
          node.scrollIntoView();
        }
      }
      setPendingFocusId(null);
    }, 60);
    return function() {
      clearTimeout(timer);
    };
  }, [pendingFocusId, view]);
  if (!data) {
    return h("div", { className: "wb-page" }, h("div", { className: "wb-row", style: { gap: 9, color: T.text2, padding: "10px 0" } }, h(Spinner, { size: 16 }), h("span", null, "正在读取任务…")));
  }
  const tasks = Array.isArray(data.tasks) ? data.tasks.filter((row) => !row.archivedAt) : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const counts = WB.taskCounts(data);
  const filterBase = tcFilterList(tasks, {
    query: search,
    priority,
    projectId,
    tag,
    dueFilter,
    sources: data.sources || [],
    messageFrom,
    messageTo,
    status: "all"
  });
  const dutyTypeFilter = function(task) {
    if (typeFilter !== "all" && task.eventType !== typeFilter)
      return false;
    return true;
  };
  const visible = tcSortTasks(tcFilterList(filterBase, { status }), sortOrder, data.sources || []).filter(dutyTypeFilter);
  const tabCounts = tcTabCounts(filterBase);
  const tagCounts = tcTagCounts(tasks);
  const activeTagCount = tag && !tagCounts.some(function(item) {
    return item.tag === tag;
  }) ? [{ tag, count: 0 }] : [];
  const tagList = activeTagCount.concat(tagCounts);
  const tagsShown = showAllTags ? tagList : tagList.slice(0, 8);
  const filtersActive = search.trim().length > 0 || status !== "all" || dueFilter !== "all" || priority !== "all" || projectId !== "all" || !!tag || typeFilter !== "all" || !!messageFrom || !!messageTo || sortOrder !== "default";
  const projectOptions = [{ value: "all", label: "全部项目" }, { value: "none", label: "未归属项目" }].concat(projects.map(function(project) {
    return { value: project.id, label: project.name };
  }));
  const tabItems = [
    { value: "all", label: "全部", count: tabCounts.all },
    { value: "open", label: "未完成", count: tabCounts.open },
    { value: "ready", label: "待处理", count: tabCounts.ready },
    { value: "running", label: "执行中", count: tabCounts.running },
    { value: "waiting_approval", label: "待审批", count: tabCounts.waiting_approval },
    { value: "completed", label: "已完成", count: tabCounts.completed }
  ];
  const dueOptions = [
    { value: "all", label: "全部时间" },
    { value: "overdue", label: "已逾期" },
    { value: "today", label: "今日到期" },
    { value: "week", label: "7 天内" }
  ];
  const priorityOptions = [
    { value: "all", label: "全部" },
    { value: "urgent", label: "紧急" },
    { value: "high", label: "高" },
    { value: "normal", label: "普通" },
    { value: "low", label: "低" }
  ];
  function resetFilters() {
    setSearch("");
    setStatus("all");
    setDueFilter("all");
    setMessageFrom("");
    setMessageTo("");
    setSortOrder("default");
    setPriority("all");
    setProjectId("all");
    setTypeFilter("all");
    setTag(null);
  }
  function newTask() {
    WB.openTaskForm(null);
  }
  const filterBar = h(Panel, { style: { marginBottom: 14 }, bodyStyle: { padding: "12px 14px 13px" } }, h("div", { className: "wb-stack", style: { gap: 9 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 10 } }, h("div", { style: { position: "relative", flex: "1 1 240px", maxWidth: 340, minWidth: 170 } }, h(Input, {
    value: search,
    placeholder: "搜索标题、描述或标签",
    "aria-label": "搜索待办",
    style: { paddingLeft: 28 },
    onChange: function(event) {
      setSearch(event.target.value);
    }
  }), h("span", { style: { position: "absolute", left: 9, top: 8, display: "inline-flex", color: T.text2, pointerEvents: "none" } }, h(Icon, { name: "search", size: 13 }))), h(Tabs, {
    items: tabItems,
    value: status,
    onChange: function(value) {
      setStatus(value);
    }
  }), h("div", { className: "wb-spacer" }), h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "xCircle",
    disabled: !filtersActive,
    onClick: resetFilters,
    children: "重置筛选"
  })), h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "到期"), dueOptions.map(function(option) {
    return h(Chip, {
      key: "due:" + option.value,
      active: dueFilter === option.value,
      onClick: function() {
        setDueFilter(option.value);
      },
      children: option.label
    });
  }), h("span", {
    style: { width: 1, height: 15, margin: "0 3px", background: T.border1, flex: "none" }
  }), h("span", { className: "wb-tiny wb-muted" }, "优先级"), priorityOptions.map(function(option) {
    return h(Chip, {
      key: "priority:" + option.value,
      active: priority === option.value,
      onClick: function() {
        setPriority(option.value);
      },
      children: option.label
    });
  }), h("span", {
    style: { width: 1, height: 15, margin: "0 3px", background: T.border1, flex: "none" }
  }), h("span", { className: "wb-tiny wb-muted" }, "项目"), h("div", { style: { width: 160 } }, h(Select, {
    options: projectOptions,
    value: projectId,
    onChange: function(event) {
      setProjectId(event.target.value);
    }
  }))), h(
    "div",
    { className: "wb-row wb-row--wrap", style: { gap: 8 } },
    h("span", { className: "wb-tiny wb-muted" }, "消息发出时间（北京时间）"),
    h("label", { className: "wb-row wb-tiny", style: { gap: 5 } }, "从", h(Input, { type: "date", "aria-label": "消息发出日期起始", value: messageFrom, max: messageTo || void 0, style: { width: 148 }, onChange: (event) => setMessageFrom(event.target.value) })),
    h("label", { className: "wb-row wb-tiny", style: { gap: 5 } }, "至", h(Input, { type: "date", "aria-label": "消息发出日期截止", value: messageTo, min: messageFrom || void 0, style: { width: 148 }, onChange: (event) => setMessageTo(event.target.value) })),
    h("div", { style: { width: 180 } }, h(Select, { "aria-label": "待办排序", value: sortOrder, options: [{ value: "default", label: "默认排序" }, { value: "message-newest", label: "消息时间：最新在前" }, { value: "message-oldest", label: "消息时间：最早在前" }], onChange: (event) => setSortOrder(event.target.value) })),
    messageFrom && messageTo && messageFrom > messageTo ? h("span", { role: "alert", className: "wb-tiny", style: { color: T.err } }, "起始日期不能晚于截止日期") : null
  ), true ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 6, marginBottom: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "事项类型："), [
    { id: "all", label: "全部" },
    { id: "meeting", label: "会议" },
    { id: "feature", label: "功能开发" },
    { id: "logging", label: "登记填报" },
    { id: "other", label: "其他" }
  ].map(function(option) {
    return h(Chip, {
      key: "type-" + option.id,
      active: typeFilter === option.id,
      onClick: function() {
        setTypeFilter(option.id);
      },
      children: option.label
    });
  })) : null, tagList.length > 0 ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 5 } }, h("span", { className: "wb-tiny wb-muted" }, "标签"), tagsShown.map(function(item) {
    return h(Chip, {
      key: "tag:" + item.tag,
      active: tag === item.tag,
      onClick: function() {
        setTag(tag === item.tag ? null : item.tag);
      },
      title: item.count + " 条待办",
      children: "#" + item.tag + (item.count > 0 ? " · " + item.count : "")
    });
  }), tagList.length > 8 ? h(Chip, {
    onClick: function() {
      setShowAllTags(!showAllTags);
    },
    children: showAllTags ? "收起标签" : "更多标签 · " + (tagList.length - 8)
  }) : null) : null, h("div", { className: "wb-row wb-tiny wb-muted", style: { gap: 8, flexWrap: "wrap" } }, h("span", null, "共 " + visible.length + " 条结果"), h("span", null, "未完成 " + tabCounts.open), h("span", null, "逾期 " + tabCounts.overdue), h("div", { className: "wb-spacer" }), h("span", { className: "wb-tiny wb-muted" }, "筛选只影响当前视图，不写入 Host"))));
  let content;
  if (tasks.length === 0) {
    content = h(Panel, { flush: true }, h(Empty, {
      icon: "tasks",
      title: "还没有待办",
      hint: "从一条手动待办开始；接入云之家后，@ 你的消息经确认也会进入这里，并保留原始来源。",
      action: h(Btn, {
        size: "sm",
        kind: "primary",
        icon: "plus",
        onClick: newTask,
        children: "新建第一条待办"
      })
    }));
  } else if (visible.length === 0) {
    content = h(Panel, { flush: true }, h(Empty, {
      icon: "search",
      title: "没有匹配的待办",
      hint: "当前搜索与筛选没有命中任何任务；可以清空条件后重试。",
      action: h(Btn, {
        size: "sm",
        icon: "xCircle",
        onClick: resetFilters,
        children: "重置筛选"
      })
    }));
  } else if (view === "board") {
    const boardStatuses = tcBoardStatuses();
    const outside = visible.filter(function(task) {
      return boardStatuses.indexOf(task.status) < 0;
    });
    content = h("div", null, h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 10,
        alignItems: "start"
      }
    }, boardStatuses.map(function(key2) {
      const meta = WB.TASK_STATUS[key2];
      const columnTasks = visible.filter(function(task) {
        return task.status === key2;
      });
      const dropActive = dragStatus === key2;
      return h("div", {
        key: key2,
        className: "wb-card",
        style: dropActive ? { borderColor: T.accent, boxShadow: "inset 0 0 0 1px " + T.accent } : void 0,
        onDragOver: function(event) {
          event.preventDefault();
          if (dragStatus !== key2)
            setDragStatus(key2);
        },
        onDragLeave: function(event) {
          if (event.currentTarget.contains(event.relatedTarget))
            return;
          setDragStatus(function(previous) {
            return previous === key2 ? null : previous;
          });
        },
        onDrop: function(event) {
          event.preventDefault();
          setDragStatus(null);
          const taskId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
          if (!taskId)
            return;
          const target = visible.find(function(item) {
            return item.id === taskId;
          });
          if (!target || target.status === key2)
            return;
          WB.actions.updateTask(taskId, { status: key2 }).then(function() {
            WB.toast("已移动到「" + meta.label + "」", "ok");
          }).catch(function() {
          });
        }
      }, h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 11px",
          borderBottom: "1px solid " + T.border1
        }
      }, h("span", {
        style: {
          width: 7,
          height: 7,
          borderRadius: 999,
          background: tcToneColor(meta.tone),
          flex: "none"
        }
      }), h("span", { style: { fontSize: 12, fontWeight: 600, color: T.text } }, meta.label), h("span", { className: "wb-spacer" }), h("span", { className: "wb-tiny wb-muted" }, String(columnTasks.length))), h("div", { style: { display: "flex", flexDirection: "column", gap: 7, padding: 8, minHeight: 64 } }, columnTasks.length > 0 ? columnTasks.map(function(task) {
        return h("div", {
          key: task.id,
          draggable: true,
          style: { cursor: "grab" },
          title: "拖动到其它列可改状态",
          onDragStart: function(event) {
            if (event.dataTransfer) {
              event.dataTransfer.setData("text/plain", task.id);
              event.dataTransfer.effectAllowed = "move";
            }
            setDragStatus(task.status);
          },
          onDragEnd: function() {
            setDragStatus(null);
          }
        }, h(TaskCenterBoardCard, { task, data }));
      }) : h("div", { className: "wb-tiny wb-muted", style: { textAlign: "center", padding: "12px 0" } }, "暂无任务")));
    })), outside.length > 0 ? h("div", {
      className: "wb-row wb-tiny wb-muted wb-row--wrap",
      style: {
        gap: 8,
        marginTop: 10,
        padding: "8px 10px",
        border: "1px dashed " + T.border1,
        borderRadius: 10
      }
    }, h(Icon, { name: "info", size: 12 }), h("span", null, "另有 " + outside.length + " 条（草稿 / 失败 / 已取消）不在四个看板列中。"), h("div", { className: "wb-spacer" }), h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "tasks",
      onClick: function() {
        setView("list");
      },
      children: "用列表查看"
    })) : null);
  } else {
    content = h("div", { className: "wb-card wb-task-table", role: "region", "aria-label": "任务列表，可横向滚动查看操作", tabIndex: 0 }, h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "任务"), h("th", { style: { width: 84 } }, "优先级"), h("th", { style: { width: 130 } }, "状态"), h("th", { style: { width: 56, textAlign: "center" } }, "完成"), h("th", { scope: "col", "aria-sort": sortOrder === "message-newest" ? "descending" : sortOrder === "message-oldest" ? "ascending" : "none", style: { minWidth: 174 } }, h("button", { type: "button", "aria-label": "按消息发出时间排序", title: "点击切换最新 / 最早在前（北京时间）", onClick: () => setSortOrder(sortOrder === "message-newest" ? "message-oldest" : "message-newest"), style: { display: "inline-flex", alignItems: "center", gap: 5, border: 0, padding: 0, background: "transparent", font: "inherit", color: "inherit", cursor: "pointer" } }, "消息发出时间", h("span", { "aria-hidden": true }, sortOrder === "message-newest" ? "↓" : sortOrder === "message-oldest" ? "↑" : "↕"))), h("th", { style: { width: 130 } }, "截止 / 会议开始"), h("th", { style: { width: 130 } }, "项目"), h("th", { style: { width: 112, textAlign: "right" } }, "操作"))), h("tbody", null, visible.slice(pageIndex(page, visible.length) * PAGE_SIZE, (pageIndex(page, visible.length) + 1) * PAGE_SIZE).map(function(task) {
      const isPending = pendingFocusId === task.id;
      return h(TaskCenterRow, {
        key: task.id,
        task,
        data,
        expanded: expandedId === task.id,
        highlighted: isPending || expandedId === task.id,
        rowRef: isPending ? focusRowRef : null,
        onToggleEvidence: function() {
          setExpandedId(expandedId === task.id ? null : task.id);
        }
      });
    }))));
  }
  const allCandidates = Array.isArray(data && data.candidates) ? data.candidates : [];
  const pendingCandidates = allCandidates.filter(function(candidate) {
    return candidate && candidate.status === "pending";
  });
  const lastExtract = data && data.lastExtract ? data.lastExtract : null;
  function runExtract() {
    if (candidateBusy)
      return;
    setCandidateBusy(true);
    WB.actions.extractCandidates().then(function() {
      setCandidateBusy(false);
    }).catch(function() {
      setCandidateBusy(false);
    });
  }
  function acceptCandidateItem(candidate) {
    if (candidateBusy)
      return;
    setCandidateBusy(true);
    WB.actions.acceptCandidate(candidate.id, {}).then(function() {
      setCandidateBusy(false);
    }).catch(function() {
      setCandidateBusy(false);
    });
  }
  function rejectCandidateItem(candidate) {
    if (candidateBusy)
      return;
    setCandidateBusy(true);
    WB.actions.rejectCandidate(candidate.id).then(function() {
      setCandidateBusy(false);
    }).catch(function() {
      setCandidateBusy(false);
    });
  }
  const candidatesPanel = h(Panel, {
    icon: "sparkles",
    title: "待确认",
    sub: pendingCandidates.length > 0 ? "规则从 @我 消息里提取的候选，共 " + pendingCandidates.length + " 条；采纳后才变成待办" : lastExtract && lastExtract.at ? "上次提取 " + WB.fmt.relative(lastExtract.at) + " · 新增 " + (lastExtract.added || 0) + " 条" : "从未读、@本人、@全员消息里提取候选，人工确认后才建待办",
    badge: pendingCandidates.length > 0 ? h(Badge, { tone: "warn" }, String(pendingCandidates.length)) : null,
    actions: h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "sparkles",
      disabled: candidateBusy,
      onClick: runExtract,
      children: candidateBusy ? "处理中…" : "提取候选"
    })
  }, pendingCandidates.length === 0 ? h(Empty, {
    style: { padding: "16px 12px 14px" },
    icon: "checkCircle",
    title: "没有待确认的候选",
    hint: "先在首页刷新「消息与会议」，再点右上角「提取候选」。规则只做确定性判断（行动词 / 时间线索 / 长度 / 指向性），置信度可解释；采纳前请人工核对。"
  }) : h("div", { className: "wb-list" }, pendingCandidates.slice(0, 8).map(function(candidate) {
    const due = candidate.dueAt ? WB.fmt.due(candidate.dueAt) : null;
    return h("div", { key: candidate.id, className: "wb-item", style: { alignItems: "flex-start" } }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title", style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } }, candidate.title, candidate.confidence !== null && candidate.confidence !== void 0 ? h(Badge, { tone: candidate.confidence >= 0.7 ? "ok" : candidate.confidence >= 0.5 ? "warn" : "idle" }, "置信度 " + Math.round(candidate.confidence * 100) + "%") : null, due ? h(Badge, { tone: due.tone }, due.text) : null), h("div", { className: "wb-item-sub wb-clamp2" }, candidate.excerpt || ""), h("div", { className: "wb-item-sub" }, candidate.sourceTitle ? h("span", null, candidate.sourceTitle) : null, (candidate.reasons || []).slice(0, 2).map(function(reason, index) {
      return h(Chip, { key: "r" + index, children: reason });
    }))), h("div", { className: "wb-item-actions", style: { opacity: 1 } }, h(Btn, {
      size: "sm",
      kind: "primary",
      icon: "check",
      disabled: candidateBusy,
      onClick: function() {
        acceptCandidateItem(candidate);
      },
      children: "采纳"
    }), h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "close",
      disabled: candidateBusy,
      onClick: function() {
        rejectCandidateItem(candidate);
      },
      children: "忽略"
    }), h(IconBtn, {
      name: "trash",
      label: "彻底删除这条候选",
      onClick: function() {
        if (!window.confirm("彻底删除这条候选记录？"))
          return;
        WB.actions.deleteCandidate(candidate.id).catch(function() {
        });
      }
    })));
  })));
  return h("div", null, h(PageHead, {
    icon: "tasks",
    title: "任务中心",
    sub: "共 " + counts.total + " 条 · 未完成 " + counts.open + " · 逾期 " + counts.overdue + " · 执行中 " + counts.running,
    actions: h("div", { className: "wb-row", style: { gap: 8 } }, h(Segmented, {
      items: [
        { value: "list", label: "列表" },
        { value: "board", label: "看板" }
      ],
      value: view,
      onChange: function(value) {
        setView(value);
      }
    }), h(Btn, {
      size: "sm",
      kind: "primary",
      icon: "plus",
      onClick: newTask,
      children: "新建待办"
    }))
  }), tasks.length > 0 ? filterBar : null, content, view === "list" ? h(Pagination, { page, total: visible.length, onChange: setPage }) : null, h("details", { style: { marginTop: 16 } }, h("summary", { className: "wb-tiny wb-muted" }, "规则候选（备用） · " + pendingCandidates.length + " 条"), candidatesPanel));
}
WB.pages.tasks = TaskCenterPage;

// src/client/features/agents/WorkflowPanel.tsx
var React30 = __toESM(require("react"), 1);

// src/shared/office-workflow.ts
var OFFICE_WORKFLOW_LABELS = { reply_batch: "批量回复草稿", work_report: "日报 / 周报", task_assist: "待办处理方案" };
var isOfficeWorkflow = (kind) => Object.hasOwn(OFFICE_WORKFLOW_LABELS, kind);

// src/client/features/agents/WorkflowPanel.tsx
var STATUS = { queued: "排队中", running: "执行中", completed: "已交付", failed: "需处理", cancelled: "已取消", pending: "待处理" };
function WorkflowPanel() {
  const data = WB.useStore().data || {}, [open, setOpen] = React30.useState(false), [kind, setKind] = React30.useState("reply_batch"), [period, setPeriod] = React30.useState("day"), [taskId, setTaskId] = React30.useState(""), [selected, setSelected] = React30.useState([]), [filter, setFilter] = React30.useState("all"), [page, setPage] = React30.useState(0);
  const replies = (data.replies || []).filter((r) => !r.archivedAt && ["待回复", "已确认收到"].includes(r.stage)), tasks = (data.tasks || []).filter((t) => !t.archivedAt && !["completed", "cancelled"].includes(t.status));
  const jobs = (data.jobs || []).slice().reverse(), visible = jobs.filter((j) => filter === "all" || filter === "active" && ["queued", "running"].includes(j.status) || filter === "review" && ["failed", "cancelled"].includes(j.status) || filter === "done" && j.status === "completed");
  const safe = (promise) => promise.catch(() => {
  });
  async function start() {
    try {
      await WB.actions.officeWorkflowStart(kind, kind === "reply_batch" ? { replyIds: selected } : kind === "task_assist" ? { taskId } : { period });
      setOpen(false);
    } catch {
    }
  }
  return /* @__PURE__ */ React30.createElement(Panel, { title: "办公执行", sub: "复用已有模型，按步骤保存产物；回复草稿需采纳后保存，企业消息尚未发送。", actions: /* @__PURE__ */ React30.createElement(Btn, { kind: "primary", icon: "plus", onClick: () => setOpen(true) }, "新建办公流程") }, /* @__PURE__ */ React30.createElement("div", { className: "wb-row wb-row--wrap", role: "group", "aria-label": "工作流状态筛选", style: { gap: 6, marginBottom: 12 } }, [["all", "全部"], ["active", "进行中"], ["review", "需处理"], ["done", "已交付"]].map(([value, label]) => /* @__PURE__ */ React30.createElement(Btn, { key: value, size: "sm", kind: filter === value ? "primary" : void 0, onClick: () => {
    setFilter(value);
    setPage(0);
  } }, label, " ", value === "all" ? jobs.length : jobs.filter((j) => value === "active" ? ["queued", "running"].includes(j.status) : value === "review" ? ["failed", "cancelled"].includes(j.status) : j.status === "completed").length))), !visible.length && /* @__PURE__ */ React30.createElement("p", { className: "wb-muted wb-tiny" }, "当前没有符合筛选条件的后台作业。"), /* @__PURE__ */ React30.createElement("div", { className: "wb-stack" }, visible.slice(pageIndex(page, visible.length) * PAGE_SIZE, (pageIndex(page, visible.length) + 1) * PAGE_SIZE).map((job) => /* @__PURE__ */ React30.createElement("details", { key: job.id, className: "wb-item", style: { display: "block", minWidth: 0 } }, /* @__PURE__ */ React30.createElement("summary", { style: { cursor: "pointer", overflowWrap: "anywhere" } }, job.title || { analysis: "消息识别", summary: "资讯摘要" }[job.kind] || job.kind, " · ", STATUS[job.status] || job.status, " ", job.steps && `· ${job.steps.filter((s) => s.status === "completed").length}/${job.steps.length}`), /* @__PURE__ */ React30.createElement("div", { className: "wb-stack", style: { paddingTop: 12, minWidth: 0 } }, /* @__PURE__ */ React30.createElement("div", { className: "wb-tiny wb-muted" }, "创建：", WB.fmt.datetime(job.createdAt), " · 更新：", WB.fmt.datetime(job.updatedAt)), job.kind === "task_assist" && /* @__PURE__ */ React30.createElement("p", { className: "wb-tiny" }, "产物为处理方案与验收清单；尚未执行项目命令或标记业务完成。"), job.error && /* @__PURE__ */ React30.createElement("p", { role: "status", className: "wb-tiny", style: { overflowWrap: "anywhere" } }, job.error, job.nextRetryAt && ` · 下次尝试 ${WB.fmt.datetime(job.nextRetryAt)}`), job.note && /* @__PURE__ */ React30.createElement("p", { className: "wb-tiny" }, job.note), isOfficeWorkflow(job.kind) && /* @__PURE__ */ React30.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, ["queued", "running"].includes(job.status) && /* @__PURE__ */ React30.createElement(Btn, { size: "sm", onClick: () => safe(WB.actions.officeWorkflowControl(job.id, "cancel")) }, "取消后续步骤"), ["failed", "cancelled"].includes(job.status) && /* @__PURE__ */ React30.createElement(Btn, { size: "sm", onClick: () => safe(WB.actions.officeWorkflowControl(job.id, "retry")) }, "继续未完成步骤")), (job.steps || []).map((step) => /* @__PURE__ */ React30.createElement("section", { key: step.id, "aria-label": step.label, style: { borderTop: "1px solid var(--wb-border)", paddingTop: 10, minWidth: 0 } }, /* @__PURE__ */ React30.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React30.createElement("strong", { style: { overflowWrap: "anywhere" } }, step.label), /* @__PURE__ */ React30.createElement(Badge, null, STATUS[step.status] || step.status)), step.error && /* @__PURE__ */ React30.createElement("p", { role: "status", className: "wb-tiny", style: { overflowWrap: "anywhere" } }, step.error), step.input?.knowledge && /* @__PURE__ */ React30.createElement(KnowledgeSources, { result: step.input.knowledge, provided: step.status === "completed" }), step.artifact && /* @__PURE__ */ React30.createElement(React30.Fragment, null, /* @__PURE__ */ React30.createElement("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 13, maxHeight: 360, overflow: "auto" } }, step.artifact.text), /* @__PURE__ */ React30.createElement("p", { className: "wb-tiny wb-muted", style: { overflowWrap: "anywhere" } }, "依据：", step.artifact.evidenceIds.join("、"), " · ", WB.fmt.datetime(step.artifact.at)), /* @__PURE__ */ React30.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React30.createElement(Btn, { size: "sm", onClick: () => safe(WB.util.copy(step.artifact.text).then(() => WB.toast("产物已复制", "ok"))) }, "复制产物"), /* @__PURE__ */ React30.createElement(Btn, { size: "sm", onClick: () => safe(WB.actions.createKnowledge({ title: job.title + " · " + step.label, body: step.artifact.text, kind: "note", reviewState: "candidate", projectId: step.input?.task?.projectId || null, accountId: step.input?.source?.locator?.accountId || null, sourceLabel: "办公作业 " + job.id })) }, "存为候选知识"), job.kind === "reply_batch" && /* @__PURE__ */ React30.createElement(Btn, { size: "sm", disabled: !!step.adoptedAt, onClick: () => safe(WB.actions.adoptReplyArtifact(job.id, step.id)) }, step.adoptedAt ? "已保存草稿" : "采纳为回复草稿"), job.kind === "task_assist" && /* @__PURE__ */ React30.createElement(Btn, { size: "sm", onClick: () => WB.focusTask(job.input.taskId) }, "查看待办"))))), !job.steps && job.result && /* @__PURE__ */ React30.createElement("pre", { className: "wb-tiny", style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, JSON.stringify(job.result, null, 2)))))), /* @__PURE__ */ React30.createElement(Pagination, { page, total: visible.length, onChange: setPage }), open && /* @__PURE__ */ React30.createElement(Modal, { open, title: "新建办公流程", onClose: () => setOpen(false), footer: /* @__PURE__ */ React30.createElement("div", { className: "wb-row", style: { justifyContent: "flex-end", gap: 8 } }, /* @__PURE__ */ React30.createElement(Btn, { onClick: () => setOpen(false) }, "取消"), /* @__PURE__ */ React30.createElement(Btn, { kind: "primary", disabled: kind === "reply_batch" && !selected.length || kind === "task_assist" && !taskId, onClick: start }, "加入执行队列")) }, /* @__PURE__ */ React30.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React30.createElement(Field, { label: "流程类型" }, /* @__PURE__ */ React30.createElement(Select, { value: kind, options: Object.entries(OFFICE_WORKFLOW_LABELS).map(([value, label]) => ({ value, label })), onChange: (e) => setKind(e.target.value) })), kind === "reply_batch" && /* @__PURE__ */ React30.createElement("fieldset", { style: { border: 0, padding: 0, minWidth: 0 } }, /* @__PURE__ */ React30.createElement("legend", null, "选择待回复（最多20条）"), /* @__PURE__ */ React30.createElement("div", { style: { maxHeight: 280, overflow: "auto" } }, replies.map((r) => /* @__PURE__ */ React30.createElement("label", { key: r.id, style: { display: "flex", gap: 8, padding: 6, overflowWrap: "anywhere" } }, /* @__PURE__ */ React30.createElement("input", { type: "checkbox", checked: selected.includes(r.id), disabled: !selected.includes(r.id) && selected.length >= 20, onChange: (e) => setSelected((old) => e.target.checked ? [...old, r.id] : old.filter((id) => id !== r.id)) }), r.contact || r.groupName || "待回复", "：", r.snippet || r.id))), !replies.length && /* @__PURE__ */ React30.createElement("p", null, "当前没有待回复。")), kind === "task_assist" && /* @__PURE__ */ React30.createElement(React30.Fragment, null, /* @__PURE__ */ React30.createElement(Field, { label: "关联待办" }, /* @__PURE__ */ React30.createElement(Select, { value: taskId, options: [{ value: "", label: "请选择待办" }, ...tasks.map((t) => ({ value: t.id, label: t.title }))], onChange: (e) => setTaskId(e.target.value) })), /* @__PURE__ */ React30.createElement("p", { className: "wb-tiny wb-muted" }, "整理已有消息和任务资料，生成处理步骤及验收清单。")), kind === "work_report" && /* @__PURE__ */ React30.createElement(Field, { label: "报告范围" }, /* @__PURE__ */ React30.createElement(Select, { value: period, options: [{ value: "day", label: "今日 · Asia/Shanghai" }, { value: "week", label: "近七日 · Asia/Shanghai" }], onChange: (e) => setPeriod(e.target.value) })))));
}

// src/client/features/agents/agent-center.ts
var React31 = __toESM(require("react"), 1);
function agentStatusMeta(status) {
  const meta = WB.RUN_STATUS[status];
  if (meta)
    return meta;
  return { label: status ? String(status) : "未知", tone: "idle" };
}
function agentFormatTime(value) {
  return value ? WB.fmt.datetime(value) : "—";
}
function agentDurationMinutes(run) {
  if (!run || !run.startedAt || !run.endedAt)
    return null;
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start)
    return null;
  return (end - start) / 6e4;
}
function agentDurationText(minutes) {
  if (minutes === null || minutes === void 0)
    return "—";
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0)
    return "—";
  if (value < 1)
    return Math.max(1, Math.round(value * 60)) + " 秒";
  if (value < 60) {
    const rounded = Math.round(value * 10) / 10;
    return rounded + " 分钟";
  }
  const hours = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return hours + " 小时" + (rest > 0 ? " " + rest + " 分" : "");
}
function agentSortRuns(runs) {
  return (runs || []).slice().sort(function(a, b) {
    const av = a && a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bv = b && b.startedAt ? new Date(b.startedAt).getTime() : 0;
    const left = Number.isNaN(av) ? 0 : av;
    const right = Number.isNaN(bv) ? 0 : bv;
    return right - left;
  });
}
function agentRunAverage(runs) {
  const durations = [];
  (runs || []).forEach(function(run) {
    const minutes = agentDurationMinutes(run);
    if (minutes !== null)
      durations.push(minutes);
  });
  if (!durations.length)
    return { minutes: null, count: 0 };
  let total = 0;
  durations.forEach(function(value) {
    total += value;
  });
  return { minutes: total / durations.length, count: durations.length };
}
function agentTaskTitle(tasks, taskId) {
  if (!taskId)
    return null;
  const list = tasks || [];
  for (let index = 0; index < list.length; index += 1) {
    const task = list[index];
    if (task && task.id === taskId)
      return task.title || task.id;
  }
  return String(taskId);
}
function agentPriorityRank(priority) {
  const meta = WB.TASK_PRIORITY[priority] || WB.TASK_PRIORITY.normal;
  return meta.rank;
}
function agentBriefMarkdown(data) {
  const open = WB.openTasks(data);
  const counts = WB.taskCounts(data);
  const lines = [];
  lines.push("# 任务简报 · " + WB.fmt.datetime(WB.util.nowIso()));
  lines.push("");
  lines.push("未完成 " + open.length + " 项 · 逾期 " + counts.overdue + " 项 · 今日到期 " + counts.today + " 项");
  lines.push("");
  if (!open.length) {
    lines.push("当前没有未完成的任务。");
    return lines.join("\n");
  }
  const projects = {};
  const projectList = data && Array.isArray(data.projects) ? data.projects : [];
  projectList.forEach(function(project) {
    if (project && project.id)
      projects[project.id] = project.name;
  });
  const ranked = open.slice().sort(function(a, b) {
    const rankDiff = agentPriorityRank(b.priority) - agentPriorityRank(a.priority);
    if (rankDiff !== 0)
      return rankDiff;
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    const left = Number.isNaN(at) ? Infinity : at;
    const right = Number.isNaN(bt) ? Infinity : bt;
    return left - right;
  });
  ranked.forEach(function(task, index) {
    const status = WB.TASK_STATUS[task.status] || { label: task.status || "未知" };
    const priority = WB.TASK_PRIORITY[task.priority] || { label: task.priority || "普通" };
    lines.push("## " + (index + 1) + ". " + (task.title || "(无标题)"));
    lines.push("- 状态：" + status.label + " · 优先级：" + priority.label);
    if (task.projectId && projects[task.projectId])
      lines.push("- 项目：" + projects[task.projectId]);
    if (task.dueAt) {
      const due = WB.fmt.due(task.dueAt);
      lines.push("- 截止：" + WB.fmt.datetime(task.dueAt) + "（" + due.text + "）");
    }
    if (Array.isArray(task.tags) && task.tags.length)
      lines.push("- 标签：" + task.tags.join("、"));
    if (task.description) {
      lines.push("");
      lines.push(String(task.description));
    }
    lines.push("");
  });
  return lines.join("\n");
}
function agentRunRow(props) {
  const run = props.run;
  if (!run)
    return null;
  const meta = agentStatusMeta(run.status);
  const expanded = !!props.expanded;
  const minutes = agentDurationMinutes(run);
  const title = agentTaskTitle(props.tasks, run.taskId) || "未关联任务";
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const evidence = Array.isArray(run.evidence) ? run.evidence : [];
  const toggleLabel = expanded ? "收起执行详情" : "展开执行详情";
  const detail = expanded ? h("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "2px 0 12px 26px",
      minWidth: 0
    }
  }, h("div", {
    className: "wb-tiny",
    style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }
  }, run.summary ? String(run.summary) : "（该记录没有填写摘要）"), h(Divider, null), h("div", { className: "wb-tiny wb-muted", style: { fontWeight: 600 } }, "步骤时间线"), steps.length ? h("div", { className: "wb-stack", style: { gap: 6 } }, steps.map(function(step, index) {
    const at = step && step.at ? WB.fmt.datetime(step.at) : "—";
    return h("div", { key: "step-" + index, style: { display: "flex", gap: 8, alignItems: "flex-start" } }, h("span", { className: "wb-mono wb-muted", style: { flex: "0 0 128px", fontSize: 10.5 } }, at), h("span", {
      style: {
        flex: "0 0 6px",
        width: 6,
        height: 6,
        marginTop: 6,
        borderRadius: "50%",
        background: T.accent
      }
    }), h("span", {
      className: "wb-tiny",
      style: { minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
    }, String(step && step.text || "")));
  })) : h("div", { className: "wb-tiny wb-muted" }, "这条记录没有步骤明细"), h("div", { className: "wb-tiny wb-muted", style: { fontWeight: 600 } }, "证据与链接"), evidence.length ? h("div", { className: "wb-stack", style: { gap: 4 } }, evidence.map(function(item, index) {
    const label = item && item.label || item && item.url || "证据 " + (index + 1);
    if (item && item.url) {
      return h("a", {
        key: "ev-" + index,
        className: "wb-link wb-tiny",
        href: item.url,
        target: "_blank",
        rel: "noreferrer",
        style: { overflowWrap: "anywhere" }
      }, String(label));
    }
    return h("span", { key: "ev-" + index, className: "wb-tiny wb-muted" }, String(label));
  })) : h("div", { className: "wb-tiny wb-muted" }, "这条记录没有关联证据"), h("div", { className: "wb-row wb-tiny wb-muted wb-row--wrap", style: { gap: 12 } }, h("span", null, "session：" + (run.sessionId || "未记录")), h("span", null, "profile：" + (run.profile || "—")), h("span", { className: "wb-mono" }, "run id：" + run.id))) : null;
  return h("div", { className: "wb-item", style: { flexDirection: "column", alignItems: "stretch" } }, h("div", { className: "wb-row", style: { gap: 8, alignItems: "flex-start", width: "100%" } }, h("button", {
    type: "button",
    className: "wb-item-main",
    onClick: props.onToggle,
    "aria-expanded": expanded ? "true" : "false",
    "aria-label": toggleLabel,
    title: toggleLabel,
    style: {
      display: "block",
      minWidth: 0,
      padding: 0,
      border: 0,
      background: "transparent",
      color: "inherit",
      font: "inherit",
      textAlign: "left",
      cursor: "pointer"
    }
  }, h("span", { className: "wb-row", style: { gap: 6, flexWrap: "wrap" } }, h(Icon, { name: expanded ? "chevronDown" : "chevronRight", size: 13 }), h("span", { className: "wb-item-title" }, title), h(Badge, { tone: meta.tone }, meta.label)), h("span", { className: "wb-item-sub" }, h("span", null, "profile " + (run.profile || "—")), h("span", null, "开始 " + agentFormatTime(run.startedAt)), h("span", null, "结束 " + agentFormatTime(run.endedAt)), h("span", null, "耗时 " + agentDurationText(minutes)), h("span", { className: "wb-mono" }, run.sessionId || "无 sessionId"))), h("div", { style: { display: "flex", alignItems: "center", gap: 4, flex: "none" } }, h(Btn, {
    size: "sm",
    icon: "check",
    disabled: run.status === "completed",
    title: "把这条记录标记为已完成",
    onClick: function() {
      props.onMark(run, "completed");
    },
    children: "完成"
  }), h(Btn, {
    size: "sm",
    kind: "danger",
    icon: "xCircle",
    disabled: run.status === "failed",
    title: "把这条记录标记为失败",
    onClick: function() {
      props.onMark(run, "failed");
    },
    children: "失败"
  }), h(IconBtn, {
    name: "edit",
    label: "编辑这条执行记录",
    onClick: function() {
      props.onEdit(run);
    }
  }), h(IconBtn, {
    name: "trash",
    label: "删除这条执行记录",
    onClick: function() {
      if (!window.confirm("删除这条执行记录？任务本身保留，只是解除关联。"))
        return;
      WB.actions.deleteRun(run.id).catch(function() {
      });
    }
  }))), detail);
}
function agentPage() {
  const wbState = WB.useStore();
  const data = wbState && wbState.data ? wbState.data : null;
  const runs = data && Array.isArray(data.runs) ? data.runs : [];
  const tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
  const [filter, setFilter] = React31.useState("all");
  const [expanded, setExpanded] = React31.useState({});
  const [recordOpen, setRecordOpen] = React31.useState(false);
  const [editingRunId, setEditingRunId] = React31.useState(null);
  const [draft, setDraft] = React31.useState(function() {
    return { taskId: "", status: "completed", profile: "", summary: "", sessionId: "", startedAt: "" };
  });
  const counts = { running: 0, waiting: 0, completed: 0, failed: 0, queued: 0, executing: 0 };
  runs.forEach(function(run) {
    if (!run)
      return;
    if (run.status === "running" || run.status === "queued")
      counts.running += 1;
    if (run.status === "queued")
      counts.queued = (counts.queued || 0) + 1;
    if (run.status === "running")
      counts.executing = (counts.executing || 0) + 1;
    else if (run.status === "waiting_approval")
      counts.waiting += 1;
    else if (run.status === "completed")
      counts.completed += 1;
    else if (run.status === "failed")
      counts.failed += 1;
  });
  const waiting = runs.filter(function(run) {
    return run && run.status === "waiting_approval";
  });
  const average = agentRunAverage(runs);
  let visible = agentSortRuns(runs);
  if (filter === "active") {
    visible = visible.filter(function(run) {
      return run.status === "queued" || run.status === "running" || run.status === "waiting_approval";
    });
  } else if (filter !== "all") {
    visible = visible.filter(function(run) {
      return run.status === filter;
    });
  }
  function patchDraft(patch) {
    setDraft(function(previous) {
      return Object.assign({}, previous, patch);
    });
  }
  function toggleRun(runId) {
    setExpanded(function(previous) {
      const next = Object.assign({}, previous);
      if (next[runId])
        delete next[runId];
      else
        next[runId] = true;
      return next;
    });
  }
  function markRun(run, status) {
    if (!run || !run.id)
      return;
    const label = status === "completed" ? "已完成" : "失败";
    WB.actions.updateRun(run.id, { status }).then(function() {
      WB.toast("执行记录已标记为" + label, "ok");
    }).catch(function() {
    });
  }
  function copyBrief() {
    const text = agentBriefMarkdown(data);
    WB.util.copy(text).then(function() {
      WB.toast("任务简报已复制（" + WB.openTasks(data).length + " 项未完成）", "ok");
    }).catch(function(error) {
      WB.toast(String(error && error.message || error), "err");
    });
  }
  function openEditRun(run) {
    if (!run || !run.id)
      return;
    setEditingRunId(run.id);
    setDraft({
      taskId: run.taskId || "",
      status: run.status || "completed",
      profile: run.profile || "",
      summary: run.summary || "",
      sessionId: run.sessionId || "",
      startedAt: WB.fmt.toLocalInput(run.startedAt)
    });
    setRecordOpen(true);
  }
  function closeRecord() {
    setRecordOpen(false);
    setEditingRunId(null);
    setDraft({ taskId: "", status: "completed", profile: "", summary: "", sessionId: "", startedAt: "" });
  }
  function submitRecord() {
    const input = { status: draft.status };
    if (draft.taskId)
      input.taskId = draft.taskId;
    const profile = String(draft.profile || "").trim();
    if (profile)
      input.profile = profile;
    const summary = String(draft.summary || "").trim();
    if (summary)
      input.summary = summary;
    const sessionId = String(draft.sessionId || "").trim();
    if (sessionId)
      input.sessionId = sessionId;
    const startedAt = WB.fmt.fromLocalInput(draft.startedAt);
    if (startedAt)
      input.startedAt = startedAt;
    const action = editingRunId ? WB.actions.updateRun(editingRunId, input) : WB.actions.recordRun(input);
    action.then(function() {
      if (editingRunId)
        WB.toast("执行记录已更新", "ok");
      closeRecord();
    }).catch(function() {
    });
  }
  const taskOptions = [{ value: "", label: "不关联任务（通用记录）" }].concat(tasks.map(function(task) {
    return { value: task.id, label: WB.util.truncate(task.title || task.id, 48) };
  }));
  const statusOptions = Object.keys(WB.RUN_STATUS).map(function(key2) {
    return { value: key2, label: WB.RUN_STATUS[key2].label };
  });
  const approvalBody = waiting.length ? h("div", { className: "wb-list" }, waiting.map(function(run) {
    const title = agentTaskTitle(tasks, run.taskId) || "未关联任务";
    return h("div", { key: run.id, className: "wb-item" }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, title), h("div", { className: "wb-item-sub" }, h("span", null, "profile " + (run.profile || "—")), h("span", null, "开始 " + agentFormatTime(run.startedAt)), h("span", { className: "wb-mono" }, run.sessionId || "无 sessionId"))), h(Badge, { tone: "warn" }, "待审批"), h("div", { style: { display: "flex", gap: 4, flex: "none" } }, h(Btn, {
      size: "sm",
      icon: "check",
      onClick: function() {
        markRun(run, "completed");
      },
      children: "完成"
    }), h(Btn, {
      size: "sm",
      kind: "danger",
      icon: "xCircle",
      onClick: function() {
        markRun(run, "failed");
      },
      children: "失败"
    })));
  }), h("p", { className: "wb-tiny wb-muted", style: { margin: "8px 0 0", lineHeight: 1.7 } }, "这里是历史记录中的待审批标记，不代表宿主当前存在审批命令；实际批准或拒绝请在原会话完成。")) : h(Empty, {
    icon: "checkCircle",
    title: "当前没有待审批操作",
    hint: "审批绑定具体命令：只有会话里正在等待的那条命令会被交给您确认；没有命令执行时不会产生审批，插件也不会替您批准或跳过审批。"
  });
  const approval = h(Panel, {
    title: "会话审批提示",
    sub: waiting.length ? "历史标记，实际审批请回原会话" : "未登记待审批记录",
    icon: "lock",
    badge: waiting.length ? h(Badge, { tone: "warn" }, String(waiting.length)) : null,
    style: { marginBottom: 14 }
  }, approvalBody);
  const queue = h(Panel, {
    title: "历史执行记录",
    sub: runs.length > 0 ? "共 " + runs.length + " 条记录 · 按开始时间倒序 · 点击一行展开详情" : "还没有执行记录",
    icon: "play",
    actions: h(Segmented, {
      items: [
        { value: "all", label: "全部" },
        { value: "active", label: "进行中" },
        { value: "completed", label: "已完成" },
        { value: "failed", label: "失败" }
      ],
      value: filter,
      onChange: setFilter
    })
  }, visible.length ? h("div", { className: "wb-list" }, visible.map(function(run) {
    return h(agentRunRow, {
      key: run.id,
      run,
      tasks,
      expanded: !!expanded[run.id],
      onToggle: function() {
        toggleRun(run.id);
      },
      onMark: markRun,
      onEdit: openEditRun
    });
  })) : h(Empty, {
    icon: runs.length ? "filter" : "play",
    title: runs.length ? "当前筛选下没有执行记录" : "还没有登记过执行记录",
    hint: runs.length ? "切换到“全部”，或者换一个状态筛选。" : "执行发生在会话中；结束后在这里登记一条记录，任务与结果的关联就能被追溯。",
    action: runs.length ? null : h(Btn, {
      kind: "primary",
      size: "sm",
      icon: "plus",
      onClick: function() {
        setRecordOpen(true);
      },
      children: "登记执行记录"
    })
  }));
  const recordModal = h(Modal, {
    open: recordOpen,
    title: editingRunId ? "编辑执行记录" : "登记执行记录",
    sub: editingRunId ? "修改摘要、状态或关联任务（会话里真正的执行过程不变）" : "只登记事实：真正的执行发生在会话里",
    onClose: function() {
      setRecordOpen(false);
    },
    footer: [
      h(Btn, {
        key: "cancel",
        onClick: closeRecord,
        children: "取消"
      }),
      h(Btn, {
        key: "save",
        kind: "primary",
        icon: "save",
        disabled: !!wbState.busy,
        onClick: submitRecord,
        children: editingRunId ? "保存修改" : "保存记录"
      })
    ]
  }, h("div", { className: "wb-stack", style: { gap: 10 } }, h(Field, { label: "关联任务", hint: "不选择表示这是一条通用执行记录" }, h(Select, {
    value: draft.taskId,
    options: taskOptions,
    onChange: function(event) {
      patchDraft({ taskId: event.target.value });
    }
  })), h(Field, { label: "状态" }, h(Select, {
    value: draft.status,
    options: statusOptions,
    onChange: function(event) {
      patchDraft({ status: event.target.value });
    }
  })), h(Field, { label: "Profile", hint: "可选：执行所用 profile，例如 default / reviewer" }, h(Input, {
    value: draft.profile,
    placeholder: "default",
    onChange: function(event) {
      patchDraft({ profile: event.target.value });
    }
  })), h(Field, {
    label: "开始时间",
    hint: "可选：留空则按当前时间登记，耗时约为 0，会拉低平均耗时；填写真实开始时间更有意义"
  }, h(Input, {
    type: "datetime-local",
    value: draft.startedAt,
    onChange: function(event) {
      patchDraft({ startedAt: event.target.value });
    }
  })), h(Field, { label: "Session ID", hint: "可选：关联会话 id，便于回到会话查看上下文" }, h(Input, {
    value: draft.sessionId,
    placeholder: "可选",
    onChange: function(event) {
      patchDraft({ sessionId: event.target.value });
    }
  })), h(Field, { label: "摘要" }, h(Textarea, {
    value: draft.summary,
    rows: 3,
    placeholder: "这次执行做了什么、结论是什么",
    onChange: function(event) {
      patchDraft({ summary: event.target.value });
    }
  })), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.7 } }, "登记后可在执行队列里展开查看，并继续标记完成 / 失败；这里不会触发任何命令执行。")));
  return h("div", { className: "wb-page" }, h(PageHead, {
    icon: "agent",
    title: "Agent 中心",
    sub: "办公流程、真实后台进度、交付产物与执行记录。",
    actions: [
      h(Btn, {
        key: "record",
        kind: "primary",
        icon: "plus",
        onClick: function() {
          setRecordOpen(true);
        },
        children: "登记执行记录"
      }),
      h(Btn, {
        key: "brief",
        icon: "copy",
        onClick: copyBrief,
        children: "复制任务简报"
      })
    ]
  }), h(WorkflowPanel), h("h2", { style: { fontSize: 14, marginTop: 20 } }, "历史记录统计"), h("div", {
    className: "wb-grid",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(156px, 1fr))",
      marginBottom: 12
    }
  }, h(Stat, {
    key: "running",
    label: "执行中",
    value: counts.running,
    sub: (counts.queued || 0) + " 排队 · " + (counts.executing || 0) + " 执行",
    tone: "warn",
    icon: "play",
    onClick: function() {
      setFilter("active");
    }
  }), h(Stat, {
    key: "waiting",
    label: "待审批",
    value: counts.waiting,
    sub: "status waiting_approval",
    tone: "warn",
    icon: "lock"
  }), h(Stat, {
    key: "completed",
    label: "已完成",
    value: counts.completed,
    sub: "status completed",
    tone: "ok",
    icon: "checkCircle"
  }), h(Stat, {
    key: "failed",
    label: "失败",
    value: counts.failed,
    sub: "status failed",
    tone: "err",
    icon: "xCircle"
  })), h("div", {
    className: "wb-grid",
    style: {
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      marginBottom: 14
    }
  }, h(Stat, {
    key: "average",
    label: "平均耗时",
    value: average.minutes === null ? "—" : agentDurationText(average.minutes),
    sub: average.minutes === null ? "暂无带 endedAt 的记录" : "按 " + average.count + " 条已结束记录计算",
    icon: "clock"
  }), h(Stat, {
    key: "measured",
    label: "有效记录",
    value: average.count,
    sub: average.count ? "含 startedAt 与 endedAt 的记录数" : "没有可计算的耗时样本",
    icon: "layers"
  })), approval, queue, h("p", { className: "wb-tiny wb-muted", style: { marginTop: 14, lineHeight: 1.7 } }, "办公执行展示真实后台作业和产物；历史执行记录保留会话结果。业务完成须有交付依据，草稿保存不代表消息已发送。"), recordModal);
}
WB.pages.agents = agentPage;

// src/client/features/toolbox/tools/NetworkDebugger.tsx
var React32 = __toESM(require("react"), 1);
function NetworkDebugger({ value: v, patch, mode }) {
  const [busy, setBusy] = React32.useState(false), [error, setError] = React32.useState("");
  const live = React32.useRef(true), request = React32.useRef(""), connection = React32.useRef(""), pending = React32.useRef(null);
  const rpc = (method, data) => WB.rpc("workbench/" + method, { request: data });
  React32.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void (async () => {
        if (request.current) await rpc("debugCancel", { requestId: request.current }).catch(() => {
        });
        await pending.current?.catch(() => {
        });
        if (connection.current) await rpc("mcpDisconnect", { connectionId: connection.current }).catch(() => {
        });
      })();
    };
  }, []);
  async function send(method, data) {
    if (busy) return;
    const id = "debug-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    request.current = id;
    setBusy(true);
    setError("");
    patch({ result: null });
    try {
      const operation = rpc(method, { ...data, requestId: id, timeoutMs: Number(v.timeoutMs) || 3e4 });
      pending.current = operation;
      const result = await operation;
      if (result.connectionId) {
        connection.current = result.connectionId;
      }
      if (live.current) patch({ result, ...result.connectionId ? { connectionId: result.connectionId, tools: result.tools || [], toolName: result.tools?.[0]?.name || "" } : {} });
    } catch (e) {
      if (live.current) setError(e.message);
    } finally {
      request.current = "";
      pending.current = null;
      if (live.current) setBusy(false);
    }
  }
  const locked = busy || !!connection.current;
  const tools = v.tools || [], selected = tools.find((t) => t.name === v.toolName);
  const formatted = v.result ? JSON.stringify(v.result, null, 2) : "";
  return /* @__PURE__ */ React32.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React32.createElement("p", { className: "wb-tiny wb-muted" }, "请求由宿主发送到你填写的地址。请求头、正文和响应不写入工作台数据文件；刷新会清空页面输入。", mode === "mcp" ? "支持 Streamable HTTP；工具调用会真实执行服务端工具。" : ""), /* @__PURE__ */ React32.createElement(Field, { label: mode === "http" ? "请求地址" : "MCP 服务地址" }, /* @__PURE__ */ React32.createElement(Input, { "aria-label": mode === "http" ? "接口请求地址" : "MCP 服务地址", value: v.url || "", disabled: locked, placeholder: mode === "http" ? "http://localhost:8080/api/health" : "http://localhost:3000/mcp", onChange: (e) => patch({ url: e.target.value }) })), mode === "http" ? /* @__PURE__ */ React32.createElement("label", { className: "wb-label" }, "HTTP 方法 ", /* @__PURE__ */ React32.createElement("select", { className: "wb-select", "aria-label": "HTTP 方法", value: v.method || "GET", disabled: busy, onChange: (e) => patch({ method: e.target.value }) }, ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => /* @__PURE__ */ React32.createElement("option", { key: m }, m)))) : /* @__PURE__ */ React32.createElement("label", { className: "wb-label" }, "MCP 协议版本 ", /* @__PURE__ */ React32.createElement("select", { className: "wb-select", "aria-label": "MCP 协议版本", disabled: locked, value: v.version || "2025-11-25", onChange: (e) => patch({ version: e.target.value }) }, ["2025-11-25", "2025-06-18", "2025-03-26", "2026-07-28"].map((version) => /* @__PURE__ */ React32.createElement("option", { key: version }, version)))), /* @__PURE__ */ React32.createElement(Field, { label: "请求头（JSON）" }, /* @__PURE__ */ React32.createElement(Textarea, { "aria-label": "调试请求头", rows: 3, value: v.headers ?? "{}", disabled: locked, onChange: (e) => patch({ headers: e.target.value }) })), /* @__PURE__ */ React32.createElement("label", { className: "wb-label" }, "超时（毫秒，1000–60000）", /* @__PURE__ */ React32.createElement(Input, { type: "number", "aria-label": "调试超时", min: 1e3, max: 6e4, disabled: busy, value: v.timeoutMs ?? 3e4, onChange: (e) => patch({ timeoutMs: e.target.value }) })), mode === "http" && /* @__PURE__ */ React32.createElement(Field, { label: "请求正文" }, /* @__PURE__ */ React32.createElement(Textarea, { "aria-label": "接口请求正文", rows: 5, disabled: busy, value: v.body || "", onChange: (e) => patch({ body: e.target.value }) })), /* @__PURE__ */ React32.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, mode === "http" ? /* @__PURE__ */ React32.createElement(Btn, { kind: "primary", disabled: busy || !v.url, onClick: () => send("httpDebug", { url: v.url, method: v.method || "GET", headers: v.headers, body: v.body }) }, busy ? "请求中…" : "发送请求") : /* @__PURE__ */ React32.createElement(React32.Fragment, null, /* @__PURE__ */ React32.createElement(Btn, { kind: "primary", disabled: locked || !v.url, onClick: () => send("mcpConnect", { url: v.url, headers: v.headers, version: v.version || "2025-11-25" }) }, busy && !connection.current ? "连接中…" : "连接并发现工具"), /* @__PURE__ */ React32.createElement(Btn, { disabled: busy || !connection.current, onClick: async () => {
    setBusy(true);
    setError("");
    try {
      const r = await rpc("mcpDisconnect", { connectionId: connection.current });
      connection.current = "";
      patch({ connectionId: null, tools: [], toolName: "" });
      if (r.note) setError(r.note);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  } }, "断开连接")), busy && /* @__PURE__ */ React32.createElement(Btn, { onClick: () => rpc("debugCancel", { requestId: request.current }).catch((e) => setError(e.message)) }, "停止请求")), mode === "mcp" && connection.current && /* @__PURE__ */ React32.createElement(React32.Fragment, null, /* @__PURE__ */ React32.createElement("label", { className: "wb-label" }, "服务端工具 ", /* @__PURE__ */ React32.createElement("select", { className: "wb-select", "aria-label": "MCP 工具", value: v.toolName || "", disabled: busy, onChange: (e) => patch({ toolName: e.target.value, arguments: "{}" }) }, !tools.length && /* @__PURE__ */ React32.createElement("option", { value: "" }, "服务端未提供工具"), tools.map((t) => /* @__PURE__ */ React32.createElement("option", { key: t.name, value: t.name }, t.name)))), selected && /* @__PURE__ */ React32.createElement(React32.Fragment, null, /* @__PURE__ */ React32.createElement("p", { className: "wb-tiny" }, selected.description), /* @__PURE__ */ React32.createElement("details", null, /* @__PURE__ */ React32.createElement("summary", null, "工具参数定义"), /* @__PURE__ */ React32.createElement("pre", { className: "wb-code", style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, JSON.stringify(selected.inputSchema, null, 2)))), /* @__PURE__ */ React32.createElement(Field, { label: "工具参数（JSON 对象）" }, /* @__PURE__ */ React32.createElement(Textarea, { "aria-label": "MCP 工具参数", rows: 5, disabled: busy, value: v.arguments ?? "{}", onChange: (e) => patch({ arguments: e.target.value }) })), /* @__PURE__ */ React32.createElement(Btn, { kind: "primary", disabled: busy || !selected, onClick: () => send("mcpCall", { connectionId: connection.current, name: v.toolName, arguments: v.arguments || "{}" }) }, "调用所选工具")), error && /* @__PURE__ */ React32.createElement("p", { className: "wb-tiny", role: "alert", style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, error), v.result && /* @__PURE__ */ React32.createElement(React32.Fragment, null, /* @__PURE__ */ React32.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React32.createElement("strong", { className: "wb-tiny" }, mode === "http" ? "HTTP " + v.result.status : "MCP 返回", " · ", v.result.durationMs, " ms ", v.result.result?.isError ? " · 工具返回错误" : ""), /* @__PURE__ */ React32.createElement(toolCopyButton, { text: formatted })), /* @__PURE__ */ React32.createElement("pre", { className: "wb-code", "aria-label": "调试响应", style: { maxHeight: 480, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, formatted), v.result.truncated && /* @__PURE__ */ React32.createElement("p", { className: "wb-tiny wb-muted" }, "响应超过1MB，展示已截断。")));
}
function HttpDebugger(props) {
  return /* @__PURE__ */ React32.createElement(NetworkDebugger, { ...props, mode: "http" });
}
function McpDebugger(props) {
  return /* @__PURE__ */ React32.createElement(NetworkDebugger, { ...props, mode: "mcp" });
}

// src/client/features/toolbox/toolbox.ts
var React33 = __toESM(require("react"), 1);

// src/client/features/toolbox/tools/json.ts
function toolJsonError(error, text) {
  const source = String(text === void 0 || text === null ? "" : text);
  const message = String(error && error.message || error || "JSON 解析失败");
  const lineCol = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
  const position = /position\s+(\d+)/i.exec(message);
  let line = 0;
  let column = 0;
  if (lineCol) {
    line = Number(lineCol[1]);
    column = Number(lineCol[2]);
  } else if (position) {
    const index = Math.max(0, Math.min(source.length, Number(position[1])));
    const head = source.slice(0, index);
    const parts = head.split("\n");
    line = parts.length;
    column = parts[parts.length - 1].length + 1;
  } else if (/end of json|unexpected end/i.test(message)) {
    const parts = source.split("\n");
    line = parts.length;
    column = parts[parts.length - 1].length + 1;
  }
  if (line > 0) {
    const lines = source.split("\n");
    const raw = lines[line - 1] === void 0 ? "" : lines[line - 1];
    const clipped = raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
    const caret = Math.max(0, Math.min(clipped.length, column - 1));
    const gutter = "  " + line + " | ";
    const pointer = " ".repeat(gutter.length + caret) + "^";
    return "JSON 不合法（第 " + line + " 行，第 " + column + " 列附近）\n" + message + "\n\n" + gutter + clipped + "\n" + pointer;
  }
  return "JSON 不合法\n" + message;
}
function toolJsonSummary(value) {
  if (value === null)
    return "根类型 null（合法）";
  if (Array.isArray(value))
    return "根类型 数组 · " + value.length + " 项";
  if (typeof value === "object")
    return "根类型 对象 · " + Object.keys(value).length + " 个键";
  return "根类型 " + typeof value + "（标量，合法）";
}
function toolJsonPane(props) {
  const value = props.value || {};
  function run(mode) {
    const text = String(value.input || "");
    if (!text.trim()) {
      props.patch({ output: "", error: "请先输入 JSON 文本" });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (mode === "validate") {
        props.patch({
          output: "✓ JSON 合法 · " + toolJsonSummary(parsed) + "\n字符数 " + text.length + " · 行数 " + text.split("\n").length,
          error: ""
        });
      } else {
        props.patch({
          output: mode === "minify" ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2),
          error: ""
        });
      }
    } catch (error) {
      props.patch({ output: "", error: toolJsonError(error, text) });
    }
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "输入 JSON" }, h(Textarea, {
    value: value.input || "",
    rows: 12,
    spellCheck: false,
    style: toolMonoStyle(220),
    placeholder: "粘贴 JSON 文本",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "sparkles",
    onClick: function() {
      run("format");
    },
    children: "格式化"
  }), h(Btn, {
    size: "sm",
    icon: "layers",
    onClick: function() {
      run("minify");
    },
    children: "压缩"
  }), h(Btn, {
    size: "sm",
    icon: "checkCircle",
    onClick: function() {
      run("validate");
    },
    children: "校验"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: "格式化 / 压缩 / 校验的结果" }))));
}

// src/client/features/toolbox/tools/timestamp.ts
function toolTimestampPane(props) {
  const value = props.value || {};
  function parseText(raw) {
    const text = String(raw === void 0 || raw === null ? "" : raw).trim();
    if (!text) {
      return { output: "", error: "请输入时间戳或日期字符串（例如 1730000000 或 2026-10-27 14:00）" };
    }
    let date = null;
    let info = "";
    if (/^-?\d+$/.test(text)) {
      const number = Number(text);
      const millis = Math.abs(number) >= 1e12 ? number : number * 1e3;
      date = new Date(millis);
      info = "输入视为时间戳（" + (Math.abs(number) >= 1e12 ? "毫秒" : "秒") + "）";
    } else {
      date = new Date(text);
      info = "输入视为日期字符串";
    }
    if (!date || Number.isNaN(date.getTime()))
      return { output: "", error: "无法解析：" + text };
    const lines = [
      info,
      "",
      "Unix 秒：" + Math.floor(date.getTime() / 1e3),
      "Unix 毫秒：" + date.getTime(),
      "本地时间：" + WB.fmt.datetime(date.toISOString()),
      "ISO 8601：" + date.toISOString(),
      "相对现在：" + WB.fmt.relative(date.toISOString())
    ];
    return { output: lines.join("\n"), error: "" };
  }
  function run() {
    props.patch(parseText(value.input));
  }
  function fillCurrent(unit) {
    const stamp2 = unit === "ms" ? Date.now() : Math.floor(Date.now() / 1e3);
    const result = parseText(String(stamp2));
    props.patch({ input: String(stamp2), output: result.output, error: result.error });
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, {
    label: "输入时间戳或日期",
    hint: "纯数字按位数自动识别秒 / 毫秒；其它按 Date 解析"
  }, h(Textarea, {
    value: value.input || "",
    rows: 4,
    spellCheck: false,
    style: toolMonoStyle(100),
    placeholder: "1730000000 或 2026-10-27 14:00",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "clock",
    onClick: run,
    children: "转换"
  }), h(Btn, {
    size: "sm",
    onClick: function() {
      fillCurrent("s");
    },
    children: "填入当前秒"
  }), h(Btn, {
    size: "sm",
    onClick: function() {
      fillCurrent("ms");
    },
    children: "填入当前毫秒"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: "两种单位与本地时间会一起显示" }))));
}

// src/client/features/toolbox/tools/encoding.ts
function toolBase64Encode(input) {
  const text = String(input === void 0 || input === null ? "" : input);
  const bytes = new TextEncoder().encode(text);
  let binary2 = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary2 += String.fromCharCode(bytes[index]);
  }
  return btoa(binary2);
}
function toolBase64Decode(input) {
  const compact = String(input === void 0 || input === null ? "" : input).replace(/\s+/g, "");
  if (!compact)
    throw new Error("请输入要解码的 Base64 文本");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
    throw new Error("不是合法的 Base64：包含字母、数字、+ / - _ = 之外的字符");
  }
  let normalized2 = compact.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized2.length % 4;
  if (remainder === 2)
    normalized2 += "==";
  else if (remainder === 3)
    normalized2 += "=";
  else if (remainder === 1)
    throw new Error("不是合法的 Base64：长度不合法");
  let binary2;
  try {
    binary2 = atob(normalized2);
  } catch (error) {
    throw new Error("不是合法的 Base64：" + String(error && error.message || error));
  }
  const bytes = new Uint8Array(binary2.length);
  for (let index = 0; index < binary2.length; index += 1) {
    bytes[index] = binary2.charCodeAt(index);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return new TextDecoder("utf-8").decode(bytes) + "\n\n（提示：这段字节不是合法 UTF-8，已用替换字符显示）";
  }
}
function toolBase64UrlDecode(segment) {
  const text = String(segment === void 0 || segment === null ? "" : segment).replace(/-/g, "+").replace(/_/g, "/");
  const padded = text + "=".repeat((4 - text.length % 4) % 4);
  const binary2 = atob(padded);
  const bytes = new Uint8Array(binary2.length);
  for (let index = 0; index < binary2.length; index += 1) {
    bytes[index] = binary2.charCodeAt(index);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function toolBase64Pane(props) {
  const value = props.value || {};
  function run() {
    const input = String(value.input || "");
    if (!input.trim()) {
      props.patch({ output: "", error: "请输入文本" });
      return;
    }
    try {
      if (value.mode === "decode")
        props.patch({ output: toolBase64Decode(input), error: "" });
      else
        props.patch({ output: toolBase64Encode(input), error: "" });
    } catch (error) {
      props.patch({ output: "", error: String(error && error.message || error) });
    }
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, h(Segmented, {
    items: [
      { value: "encode", label: "编码" },
      { value: "decode", label: "解码" }
    ],
    value: value.mode || "encode",
    onChange: function(mode) {
      props.patch({ mode, output: "", error: "" });
    }
  }), h("span", { className: "wb-tiny wb-muted" }, "编码与解码都按 UTF-8 处理，中文不会乱码")), h("div", { className: "wb-split" }, h(Field, { label: value.mode === "decode" ? "输入 Base64" : "输入原文" }, h(Textarea, {
    value: value.input || "",
    rows: 8,
    spellCheck: false,
    style: toolMonoStyle(150),
    placeholder: value.mode === "decode" ? "粘贴 Base64 字符串" : "输入要编码的文本",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "lock",
    onClick: run,
    children: value.mode === "decode" ? "解码" : "编码"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, {
    text: value.output,
    placeholder: value.mode === "decode" ? "UTF-8 解码后的文本" : "Base64 结果"
  }))));
}

// src/client/features/toolbox/tools/url.ts
function toolSafeDecode(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, " "));
  } catch (error) {
    return String(value);
  }
}
function toolParseQuery(text) {
  const source = String(text === void 0 || text === null ? "" : text);
  const mark = source.indexOf("?");
  let query = mark >= 0 ? source.slice(mark + 1) : source;
  const hash = query.indexOf("#");
  if (hash >= 0)
    query = query.slice(0, hash);
  if (!query)
    return [];
  return query.split("&").filter(function(pair) {
    return pair.length > 0;
  }).map(function(pair, index) {
    const eq = pair.indexOf("=");
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawValue = eq >= 0 ? pair.slice(eq + 1) : "";
    return {
      index,
      key: toolSafeDecode(rawKey),
      value: toolSafeDecode(rawValue),
      raw: pair
    };
  });
}
function toolUrlPane(props) {
  const value = props.value || {};
  function run() {
    const input = String(value.input || "");
    if (!input.trim()) {
      props.patch({ output: "", error: "请输入要编解码的文本", rows: [] });
      return;
    }
    try {
      const output = value.mode === "decode" ? decodeURIComponent(input) : encodeURIComponent(input);
      props.patch({ output, error: "", rows: toolParseQuery(input) });
    } catch (error) {
      props.patch({
        output: "",
        error: "不是合法的 URL 编码：" + String(error && error.message || error),
        rows: []
      });
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : [];
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, h(Segmented, {
    items: [
      { value: "encode", label: "encodeURIComponent" },
      { value: "decode", label: "decodeURIComponent" }
    ],
    value: value.mode || "encode",
    onChange: function(mode) {
      props.patch({ mode, output: "", error: "", rows: [] });
    }
  })), h("div", { className: "wb-split" }, h(Field, { label: "输入 URL 或文本" }, h(Textarea, {
    value: value.input || "",
    rows: 6,
    spellCheck: false,
    style: toolMonoStyle(120),
    placeholder: "https://example.com/search?q=开发 工具&page=2",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "link",
    onClick: run,
    children: value.mode === "decode" ? "解码" : "编码"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: "编码 / 解码结果" }))), rows.length ? h("div", null, h("div", { className: "wb-tiny wb-muted", style: { marginBottom: 4 } }, "Query 参数拆解"), h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "参数"), h("th", null, "解码后的值"), h("th", null, "原始片段"))), h("tbody", null, rows.map(function(row) {
    return h("tr", { key: "query-" + row.index }, h("td", { className: "wb-mono" }, row.key), h("td", { className: "wb-mono", style: { overflowWrap: "anywhere" } }, row.value), h("td", { className: "wb-mono wb-muted" }, row.raw));
  })))) : null);
}

// src/client/features/toolbox/tools/uuid.ts
function toolUuidV4() {
  const cryptoApi = typeof crypto === "undefined" ? null : crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    try {
      return cryptoApi.randomUUID();
    } catch (error) {
    }
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  let hex = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const part = bytes[index].toString(16);
    hex += part.length === 1 ? "0" + part : part;
  }
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}
function toolUuidPane(props) {
  const value = props.value || {};
  function run() {
    const count = Number(String(value.count === void 0 ? "" : value.count).trim());
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      props.patch({ output: "", error: "数量需要是 1–50 之间的整数" });
      return;
    }
    const list = [];
    for (let index = 0; index < count; index += 1) {
      const id = toolUuidV4();
      list.push(value.upper ? id.toUpperCase() : id);
    }
    props.patch({ output: list.join("\n"), error: "" });
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 8, alignItems: "flex-end" } }, h("div", { style: { width: 130 } }, h(Field, { label: "数量" }, h(Input, {
    value: value.count || "",
    inputMode: "numeric",
    onChange: function(event) {
      props.patch({ count: event.target.value });
    }
  }))), h(Field, { label: "大小写" }, h(Segmented, {
    items: [
      { value: "lower", label: "小写" },
      { value: "upper", label: "大写" }
    ],
    value: value.upper ? "upper" : "lower",
    onChange: function(mode) {
      props.patch({ upper: mode === "upper" });
    }
  })), h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "zap",
    onClick: run,
    children: "生成 UUID v4"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, {
    text: value.output,
    placeholder: "点击生成；每行一个 UUID v4",
    style: { maxHeight: 300 }
  }), h("div", { className: "wb-tiny wb-muted" }, "优先使用 crypto.randomUUID；不可用时回退到 crypto.getRandomValues，仍不可用才用 Math.random 兜底。"));
}

// src/client/features/toolbox/tools/jwt.ts
function toolJwtParse(token) {
  const parts = String(token === void 0 || token === null ? "" : token).trim().split(".");
  if (parts.length !== 3) {
    throw new Error("JWT 应由 header.payload.signature 三段组成，当前为 " + parts.length + " 段");
  }
  function decodeSegment(segment, label) {
    try {
      return JSON.parse(toolBase64UrlDecode(segment));
    } catch (error) {
      throw new Error(label + " 段无法解析为 JSON：" + String(error && error.message || error));
    }
  }
  return {
    header: decodeSegment(parts[0], "header"),
    payload: decodeSegment(parts[1], "payload"),
    signatureLength: parts[2].length
  };
}
function toolJwtClaims(payload) {
  const claims = [];
  const now = Date.now();
  function add(name2, value) {
    if (value === void 0 || value === null || value === "")
      return;
    claims.push({ name: name2, value: String(value) });
  }
  add("iss", payload.iss);
  add("sub", payload.sub);
  add("aud", Array.isArray(payload.aud) ? payload.aud.join(", ") : payload.aud);
  add("jti", payload.jti);
  add("scope", Array.isArray(payload.scope) ? payload.scope.join(" ") : payload.scope);
  if (payload.exp !== void 0 && payload.exp !== null) {
    const exp = Number(payload.exp) * 1e3;
    if (Number.isFinite(exp)) {
      claims.push({
        name: "exp",
        value: WB.fmt.datetime(new Date(exp).toISOString()) + (exp < now ? " · 已过期" : " · 未过期")
      });
    } else {
      add("exp", payload.exp);
    }
  }
  if (payload.iat !== void 0 && payload.iat !== null) {
    const iat = Number(payload.iat) * 1e3;
    if (Number.isFinite(iat))
      claims.push({ name: "iat", value: WB.fmt.datetime(new Date(iat).toISOString()) });
    else
      add("iat", payload.iat);
  }
  if (payload.nbf !== void 0 && payload.nbf !== null) {
    const nbf = Number(payload.nbf) * 1e3;
    if (Number.isFinite(nbf))
      claims.push({ name: "nbf", value: WB.fmt.datetime(new Date(nbf).toISOString()) });
    else
      add("nbf", payload.nbf);
  }
  return claims;
}
function toolJwtPane(props) {
  const value = props.value || {};
  function run() {
    const token = String(value.input || "").trim();
    if (!token) {
      props.patch({ error: "请粘贴 JWT", headerText: "", payloadText: "", claims: [], ran: true });
      return;
    }
    try {
      const parsed2 = toolJwtParse(token);
      props.patch({
        error: "",
        headerText: JSON.stringify(parsed2.header, null, 2),
        payloadText: JSON.stringify(parsed2.payload, null, 2),
        claims: toolJwtClaims(parsed2.payload),
        signatureLength: parsed2.signatureLength,
        ran: true
      });
    } catch (error) {
      props.patch({
        error: String(error && error.message || error),
        headerText: "",
        payloadText: "",
        claims: [],
        ran: true
      });
    }
  }
  const claims = Array.isArray(value.claims) ? value.claims : [];
  const parsed = !!(value.headerText || value.payloadText);
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", {
    className: "wb-tiny",
    style: {
      padding: "7px 9px",
      borderRadius: 8,
      border: "1px solid color-mix(in srgb, " + T.warn + " 45%, transparent)",
      background: "color-mix(in srgb, " + T.warn + " 10%, transparent)",
      color: T.warn,
      lineHeight: 1.6
    }
  }, "只解码不校验签名：任何人都能伪造内容，不要把解析结果当作身份或权限依据。"), h(Field, { label: "JWT" }, h(Textarea, {
    value: value.input || "",
    rows: 4,
    spellCheck: false,
    style: toolMonoStyle(100),
    placeholder: "粘贴 header.payload.signature",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "eye",
    onClick: run,
    children: "解析"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, {
    text: parsed ? "HEADER\n" + value.headerText + "\n\nPAYLOAD\n" + value.payloadText : "",
    label: "复制解析结果"
  })), h(toolErrorBlock, { text: value.error }), parsed ? h("div", { className: "wb-split" }, h("div", { className: "wb-stack", style: { gap: 4 } }, h("div", { className: "wb-tiny wb-muted" }, "Header"), h("pre", { className: "wb-code", style: { maxHeight: 220 } }, value.headerText || "")), h("div", { className: "wb-stack", style: { gap: 4 } }, h("div", { className: "wb-tiny wb-muted" }, "Payload"), h("pre", { className: "wb-code", style: { maxHeight: 220 } }, value.payloadText || ""))) : h(toolOutputBlock, { text: "", placeholder: "解析后显示 header 与 payload" }), claims.length ? h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "声明"), h("th", null, "值"))), h("tbody", null, claims.map(function(claim) {
    return h("tr", { key: "claim-" + claim.name }, h("td", { className: "wb-mono" }, claim.name), h("td", { style: { overflowWrap: "anywhere" } }, claim.value));
  }))) : null, value.ran && parsed ? h("div", { className: "wb-tiny wb-muted" }, "签名段长度 " + String(value.signatureLength || 0) + " 字符（未校验）。") : null);
}

// src/client/features/toolbox/tools/regex.ts
function toolRegexMatches(pattern, flags, text) {
  if (!pattern)
    throw new Error("请输入正则表达式");
  const rawFlags = String(flags === void 0 || flags === null ? "" : flags).trim();
  const allowed = "dgimsuvy";
  const invalid = rawFlags.split("").filter(function(flag) {
    return allowed.indexOf(flag) < 0;
  });
  if (invalid.length)
    throw new Error("不支持的 flag：" + invalid.join("、") + "（可用 " + allowed + "）");
  let withGlobal = rawFlags;
  if (withGlobal.indexOf("g") < 0 && withGlobal.indexOf("y") < 0)
    withGlobal += "g";
  let regex;
  try {
    regex = new RegExp(pattern, withGlobal);
  } catch (error) {
    throw new Error("正则不合法：" + String(error && error.message || error));
  }
  const source = String(text === void 0 || text === null ? "" : text);
  const matches = [];
  let current;
  let guard = 0;
  while ((current = regex.exec(source)) !== null) {
    const groups = [];
    for (let index = 1; index < current.length; index += 1) {
      groups.push(current[index] === void 0 ? "" : String(current[index]));
    }
    const named = current.groups ? Object.keys(current.groups).map(function(key2) {
      return { key: key2, value: current.groups[key2] === void 0 ? "" : String(current.groups[key2]) };
    }) : [];
    matches.push({
      index: current.index,
      end: current.index + current[0].length,
      text: current[0],
      groups,
      named
    });
    if (current[0] === "")
      regex.lastIndex += 1;
    guard += 1;
    if (guard >= 500)
      break;
    if (regex.lastIndex > source.length)
      break;
  }
  return matches;
}
function toolRegexPane(props) {
  const value = props.value || {};
  function run() {
    try {
      const matches2 = toolRegexMatches(value.pattern, value.flags, value.text);
      props.patch({ matches: matches2, error: "", ran: true });
    } catch (error) {
      props.patch({ matches: [], error: String(error && error.message || error), ran: true });
    }
  }
  const matches = Array.isArray(value.matches) ? value.matches : [];
  const copyText = matches.map(function(match, index) {
    const groups = match.groups.length ? "  组：" + match.groups.join(" | ") : "";
    return "#" + (index + 1) + " @" + match.index + " " + JSON.stringify(match.text) + groups;
  }).join("\n");
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "模式" }, h(Input, {
    value: value.pattern || "",
    spellCheck: false,
    style: { fontFamily: T.font.mono, fontSize: 12 },
    placeholder: "(\\w+)@(\\w+\\.\\w+)",
    onChange: function(event) {
      props.patch({ pattern: event.target.value });
    }
  })), h(Field, { label: "Flags", hint: "可用 d g i m s u v y；缺少 g 时自动补齐" }, h(Input, {
    value: value.flags || "",
    spellCheck: false,
    style: { fontFamily: T.font.mono, fontSize: 12 },
    placeholder: "gi",
    onChange: function(event) {
      props.patch({ flags: event.target.value });
    }
  }))), h(Field, { label: "测试文本" }, h(Textarea, {
    value: value.text || "",
    rows: 5,
    spellCheck: false,
    style: toolMonoStyle(110),
    placeholder: "粘贴要匹配的文本",
    onChange: function(event) {
      props.patch({ text: event.target.value });
    }
  })), h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "filter",
    onClick: run,
    children: "匹配"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), matches.length ? h("div", { className: "wb-stack", style: { gap: 6 } }, h("div", { className: "wb-tiny wb-muted" }, "共 " + matches.length + " 处匹配"), h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "#"), h("th", null, "位置"), h("th", null, "匹配"), h("th", null, "捕获组"))), h("tbody", null, matches.map(function(match, index) {
    const groups = match.groups.length ? match.groups.map(function(group, groupIndex) {
      return "$" + (groupIndex + 1) + " " + (group === "" ? "（空）" : group);
    }).join("  ") : "—";
    const named = match.named.length ? "  " + match.named.map(function(entry) {
      return entry.key + "=" + entry.value;
    }).join("  ") : "";
    return h("tr", { key: "match-" + index }, h("td", { className: "wb-mono" }, String(index + 1)), h("td", { className: "wb-mono" }, match.index + "–" + match.end), h("td", { className: "wb-mono", style: { overflowWrap: "anywhere" } }, match.text), h("td", { className: "wb-mono wb-muted", style: { overflowWrap: "anywhere" } }, groups + named));
  })))) : value.ran ? h(toolOutputBlock, { text: "", placeholder: "没有匹配（0 处）" }) : h(toolOutputBlock, { text: "", placeholder: "匹配结果会显示在这里" }));
}

// src/client/features/toolbox/tools/diff.ts
function toolDiffLines(leftText, rightText) {
  const left = String(leftText === void 0 || leftText === null ? "" : leftText).split("\n");
  const right = String(rightText === void 0 || rightText === null ? "" : rightText).split("\n");
  if (left.length > 400 || right.length > 400) {
    throw new Error("行数过多（上限 400 行）：当前 " + left.length + " / " + right.length + " 行，请缩小对比范围");
  }
  const rows = [];
  const stats = { added: 0, removed: 0, same: 0 };
  const matrix = [];
  for (let row = 0; row <= left.length; row += 1)
    matrix.push(new Uint16Array(right.length + 1));
  for (let i2 = left.length - 1; i2 >= 0; i2 -= 1) {
    for (let j2 = right.length - 1; j2 >= 0; j2 -= 1) {
      matrix[i2][j2] = left[i2] === right[j2] ? matrix[i2 + 1][j2 + 1] + 1 : Math.max(matrix[i2 + 1][j2], matrix[i2][j2 + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ type: "same", text: left[i] });
      stats.same += 1;
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      rows.push({ type: "del", text: left[i] });
      stats.removed += 1;
      i += 1;
    } else {
      rows.push({ type: "add", text: right[j] });
      stats.added += 1;
      j += 1;
    }
  }
  while (i < left.length) {
    rows.push({ type: "del", text: left[i] });
    stats.removed += 1;
    i += 1;
  }
  while (j < right.length) {
    rows.push({ type: "add", text: right[j] });
    stats.added += 1;
    j += 1;
  }
  return { rows, stats };
}
function toolDiffPane(props) {
  const value = props.value || {};
  function run() {
    try {
      const result = toolDiffLines(value.left, value.right);
      props.patch({ rows: result.rows, stats: result.stats, error: "", ran: true });
    } catch (error) {
      props.patch({ rows: [], stats: null, error: String(error && error.message || error), ran: true });
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : [];
  const stats = value.stats;
  const copyText = rows.map(function(row) {
    return (row.type === "add" ? "+ " : row.type === "del" ? "- " : "  ") + row.text;
  }).join("\n");
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "原始文本" }, h(Textarea, {
    value: value.left || "",
    rows: 7,
    spellCheck: false,
    style: toolMonoStyle(120),
    onChange: function(event) {
      props.patch({ left: event.target.value });
    }
  })), h(Field, { label: "修改后文本" }, h(Textarea, {
    value: value.right || "",
    rows: 7,
    spellCheck: false,
    style: toolMonoStyle(120),
    onChange: function(event) {
      props.patch({ right: event.target.value });
    }
  }))), h("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "git",
    onClick: run,
    children: "对比"
  }), stats ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Badge, { tone: "ok" }, "+" + stats.added), h(Badge, { tone: "err" }, "-" + stats.removed), h(Badge, { tone: "idle" }, "=" + stats.same)) : null, h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), rows.length ? h("div", { className: "wb-code", style: { padding: "4px 0", maxHeight: 360, overflow: "auto" } }, rows.map(function(row, index) {
    const isAdd = row.type === "add";
    const isDel = row.type === "del";
    const color = isAdd ? T.ok : isDel ? T.err : T.text2;
    return h("div", {
      key: "diff-" + index,
      style: {
        display: "flex",
        gap: 8,
        padding: "1px 10px",
        color,
        background: isAdd ? "color-mix(in srgb, " + T.ok + " 12%, transparent)" : isDel ? "color-mix(in srgb, " + T.err + " 12%, transparent)" : "transparent",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere"
      }
    }, h("span", { className: "wb-mono", style: { flex: "0 0 40px", textAlign: "right", opacity: 0.55 } }, String(index + 1)), h("span", { className: "wb-mono", style: { flex: "0 0 10px" } }, isAdd ? "+" : isDel ? "-" : " "), h("span", { className: "wb-mono", style: { minWidth: 0 } }, row.text === "" ? " " : row.text));
  })) : h(toolOutputBlock, {
    text: "",
    placeholder: value.ran ? "两段文本没有差异" : "逐行 LCS 对比结果会显示在这里"
  }));
}

// src/client/features/toolbox/tools/cron.ts
var toolCronFieldDefs = [
  { key: "minute", label: "分钟", min: 0, max: 59, names: null },
  { key: "hour", label: "小时", min: 0, max: 23, names: null },
  { key: "dom", label: "日", min: 1, max: 31, names: null },
  {
    key: "month",
    label: "月",
    min: 1,
    max: 12,
    names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
  },
  {
    key: "dow",
    label: "星期",
    min: 0,
    max: 7,
    names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  }
];
function toolCronWeekday(value) {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[value] === void 0 ? "星期 " + value : names[value];
}
function toolCronValue(token, def) {
  const text = String(token === void 0 || token === null ? "" : token).trim().toLowerCase();
  if (def.names && Object.prototype.hasOwnProperty.call(def.names, text))
    return def.names[text];
  if (!/^\d+$/.test(text)) {
    throw new Error(def.label + "字段无法识别：" + text + "（仅解释，不执行：只支持数字、*、,、-、/ 与标准月份/星期英文缩写）");
  }
  const value = Number(text);
  if (value < def.min || value > def.max) {
    throw new Error(def.label + "字段超出范围 " + def.min + "–" + def.max + "：" + value);
  }
  return value;
}
function toolCronParseField(spec, def) {
  const raw = String(spec === void 0 || spec === null ? "" : spec).trim().toLowerCase();
  if (!raw)
    throw new Error(def.label + "字段为空");
  if (/[lw#]/.test(raw)) {
    throw new Error(def.label + "字段包含扩展语法（L / W / #）：本工具仅解释，不执行，也不会推算下次触发时间");
  }
  const wildcard = raw === "*" || raw === "?";
  const values = {};
  const parts = raw.split(",");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index].trim();
    if (!part)
      throw new Error(def.label + "字段含空片段：" + raw);
    if (part === "*" || part === "?") {
      for (let value = def.min; value <= def.max; value += 1)
        values[value] = true;
      continue;
    }
    let base = part;
    let step = 1;
    const slash = part.indexOf("/");
    if (slash >= 0) {
      base = part.slice(0, slash);
      const stepText = part.slice(slash + 1);
      if (!/^\d+$/.test(stepText) || Number(stepText) <= 0) {
        throw new Error(def.label + "字段步长不合法：" + stepText);
      }
      step = Number(stepText);
    }
    let start;
    let end;
    if (base === "*") {
      start = def.min;
      end = def.max;
    } else if (base.indexOf("-") > 0) {
      const pair = base.split("-");
      if (pair.length !== 2)
        throw new Error(def.label + "字段范围不合法：" + base);
      start = toolCronValue(pair[0], def);
      end = toolCronValue(pair[1], def);
      if (start > end)
        throw new Error(def.label + "字段范围顺序不合法：" + base);
    } else {
      start = toolCronValue(base, def);
      end = step > 1 ? def.max : start;
    }
    for (let value = start; value <= end; value += step)
      values[value] = true;
  }
  if (def.key === "dow" && values[7]) {
    values[0] = true;
    delete values[7];
  }
  const list = Object.keys(values).map(Number).sort(function(a, b) {
    return a - b;
  });
  if (!list.length)
    throw new Error(def.label + "字段没有有效取值：" + raw);
  return {
    key: def.key,
    label: def.label,
    raw,
    wildcard,
    values: list,
    set: values
  };
}
function toolCronParse(expression) {
  const parts = String(expression === void 0 || expression === null ? "" : expression).trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("仅支持标准 5 段表达式（分 时 日 月 周），当前 " + parts.length + " 段");
  }
  const fields = [];
  for (let index = 0; index < toolCronFieldDefs.length; index += 1) {
    fields.push(toolCronParseField(parts[index], toolCronFieldDefs[index]));
  }
  return {
    fields,
    minute: fields[0],
    hour: fields[1],
    dom: fields[2],
    month: fields[3],
    dow: fields[4]
  };
}
function toolCronValueText(field, value) {
  if (field.key === "hour")
    return value + " 点";
  if (field.key === "dom")
    return value + " 日";
  if (field.key === "month")
    return value + " 月";
  if (field.key === "dow")
    return toolCronWeekday(value);
  return String(value);
}
function toolCronDescribeField(field) {
  if (field.wildcard) {
    if (field.key === "minute")
      return "每分钟";
    if (field.key === "hour")
      return "每小时";
    if (field.key === "dom")
      return "每天";
    if (field.key === "month")
      return "每月";
    return "每天（星期不限）";
  }
  const shown = field.values.slice(0, 12);
  let text = shown.map(function(value) {
    return toolCronValueText(field, value);
  }).join("、");
  if (field.values.length > shown.length)
    text += " …（共 " + field.values.length + " 个值）";
  if (field.key === "minute")
    return "第 " + text + " 分钟";
  return text;
}
function toolCronNextTimes(parsed, count) {
  const results = [];
  const cursor = /* @__PURE__ */ new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let step = 0; step < limit && results.length < count; step += 1) {
    const minute = cursor.getMinutes();
    const hour = cursor.getHours();
    const day = cursor.getDate();
    const month = cursor.getMonth() + 1;
    const weekday = cursor.getDay();
    let matched = !!(parsed.minute.set[minute] && parsed.hour.set[hour] && parsed.month.set[month]);
    if (matched) {
      const domMatch = !!parsed.dom.set[day];
      const dowMatch = !!parsed.dow.set[weekday];
      if (parsed.dom.wildcard && parsed.dow.wildcard)
        matched = true;
      else if (parsed.dom.wildcard)
        matched = dowMatch;
      else if (parsed.dow.wildcard)
        matched = domMatch;
      else
        matched = domMatch || dowMatch;
    }
    if (matched)
      results.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return results;
}
function toolCronPane(props) {
  const value = props.value || {};
  function run() {
    const expression = String(value.expr || "").trim();
    if (!expression) {
      props.patch({ error: "请输入 5 段 Cron 表达式（分 时 日 月 周）", rows: [], times: [], ran: true });
      return;
    }
    try {
      const parsed = toolCronParse(expression);
      const rows2 = parsed.fields.map(function(field) {
        return {
          key: field.key,
          label: field.label,
          raw: field.raw,
          description: toolCronDescribeField(field)
        };
      });
      const times2 = toolCronNextTimes(parsed, 3);
      props.patch({ error: "", rows: rows2, times: times2, ran: true });
    } catch (error) {
      props.patch({ error: String(error && error.message || error), rows: [], times: [], ran: true });
    }
  }
  const rows = Array.isArray(value.rows) ? value.rows : [];
  const times = Array.isArray(value.times) ? value.times : [];
  const copyText = rows.map(function(row) {
    return row.label + "  " + row.raw + "  " + row.description;
  }).join("\n");
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Badge, { tone: "warn" }, "仅解释，不执行"), h("span", { className: "wb-tiny wb-muted" }, "标准 5 段（分 时 日 月 周）；秒字段、年份与 L / W / # 扩展不执行")), h(Field, { label: "表达式", hint: "例如 */15 9-18 * * 1-5" }, h(Textarea, {
    value: value.expr || "",
    rows: 2,
    spellCheck: false,
    style: toolMonoStyle(56),
    placeholder: "*/15 9-18 * * 1-5",
    onChange: function(event) {
      props.patch({ expr: event.target.value });
    }
  })), h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "calendar",
    onClick: run,
    children: "解释"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: copyText })), h(toolErrorBlock, { text: value.error }), rows.length ? h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "字段"), h("th", null, "表达式"), h("th", null, "解释"))), h("tbody", null, rows.map(function(row) {
    return h("tr", { key: "cron-" + row.key }, h("td", null, row.label), h("td", { className: "wb-mono" }, row.raw), h("td", null, row.description));
  }))) : null, times.length ? h("div", { className: "wb-stack", style: { gap: 4 } }, h("div", { className: "wb-tiny wb-muted" }, "下次触发估算（本机时区，最多向后推算 366 天）"), times.map(function(time, index) {
    return h("div", { key: "cron-time-" + index, className: "wb-mono wb-tiny" }, "· " + WB.fmt.datetime(time.toISOString()));
  })) : value.ran && !value.error ? h("div", { className: "wb-tiny wb-muted" }, "未来 366 天内没有匹配时间：这个表达式可能永远不会触发。") : null, h("p", { className: "wb-tiny wb-muted", style: { margin: 0, lineHeight: 1.6 } }, "日与星期同时限定时按标准 cron 的「或」语义匹配；本工具只解释与估算，不会注册任何定时任务。"));
}

// src/client/features/toolbox/tools/sql-format.ts
var toolSqlKeywords = {
  select: 1,
  from: 1,
  where: 1,
  and: 1,
  or: 1,
  not: 1,
  insert: 1,
  into: 1,
  values: 1,
  update: 1,
  set: 1,
  delete: 1,
  join: 1,
  left: 1,
  right: 1,
  inner: 1,
  outer: 1,
  full: 1,
  cross: 1,
  on: 1,
  group: 1,
  by: 1,
  order: 1,
  having: 1,
  limit: 1,
  offset: 1,
  union: 1,
  all: 1,
  distinct: 1,
  as: 1,
  case: 1,
  when: 1,
  then: 1,
  else: 1,
  end: 1,
  like: 1,
  in: 1,
  is: 1,
  null: 1,
  create: 1,
  table: 1,
  view: 1,
  index: 1,
  drop: 1,
  alter: 1,
  add: 1,
  column: 1,
  primary: 1,
  key: 1,
  foreign: 1,
  references: 1,
  default: 1,
  constraint: 1,
  unique: 1,
  check: 1,
  returning: 1,
  with: 1,
  asc: 1,
  desc: 1,
  exists: 1,
  between: 1,
  cast: 1,
  using: 1,
  replace: 1,
  truncate: 1,
  explain: 1,
  analyze: 1,
  begin: 1,
  commit: 1,
  rollback: 1,
  transaction: 1,
  grant: 1,
  revoke: 1,
  to: 1,
  if: 1,
  over: 1,
  partition: 1
};
var toolSqlPhrases = [
  ["left", "outer", "join", "LEFT OUTER JOIN"],
  ["right", "outer", "join", "RIGHT OUTER JOIN"],
  ["full", "outer", "join", "FULL OUTER JOIN"],
  ["left", "join", "LEFT JOIN"],
  ["right", "join", "RIGHT JOIN"],
  ["inner", "join", "INNER JOIN"],
  ["full", "join", "FULL JOIN"],
  ["cross", "join", "CROSS JOIN"],
  ["group", "by", "GROUP BY"],
  ["order", "by", "ORDER BY"],
  ["union", "all", "UNION ALL"],
  ["insert", "into", "INSERT INTO"],
  ["delete", "from", "DELETE FROM"],
  ["is", "not", "IS NOT"],
  ["not", "in", "NOT IN"],
  ["not", "like", "NOT LIKE"]
];
var toolSqlClauseWords = {
  select: 1,
  from: 1,
  where: 1,
  "group by": 1,
  "order by": 1,
  having: 1,
  limit: 1,
  offset: 1,
  union: 1,
  "union all": 1,
  "insert into": 1,
  values: 1,
  update: 1,
  set: 1,
  "delete from": 1,
  returning: 1,
  join: 1,
  "left join": 1,
  "right join": 1,
  "inner join": 1,
  "full join": 1,
  "cross join": 1,
  "left outer join": 1,
  "right outer join": 1,
  "full outer join": 1,
  with: 1,
  create: 1,
  alter: 1,
  drop: 1,
  truncate: 1
};
var toolSqlContinuationWords = { and: 1, or: 1, on: 1 };
function toolSqlTokenize(sql) {
  const text = String(sql === void 0 || sql === null ? "" : sql);
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "'" || char === '"' || char === "`") {
      let end = index + 1;
      while (end < text.length) {
        if (text[end] === char) {
          if (text[end + 1] === char) {
            end += 2;
            continue;
          }
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ type: "literal", value: text.slice(index, end) });
      index = end;
      continue;
    }
    if (char === "-" && text[index + 1] === "-") {
      let end = text.indexOf("\n", index);
      if (end < 0)
        end = text.length;
      tokens.push({ type: "comment", value: text.slice(index, end) });
      index = end;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      let end = text.indexOf("*/", index + 2);
      end = end < 0 ? text.length : end + 2;
      tokens.push({ type: "comment", value: text.slice(index, end) });
      index = end;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[A-Za-z_@$\u4e00-\u9fff]/.test(char)) {
      let end = index;
      while (end < text.length && /[A-Za-z0-9_@$#\u4e00-\u9fff]/.test(text[end]))
        end += 1;
      tokens.push({ type: "word", value: text.slice(index, end) });
      index = end;
      continue;
    }
    if (/[0-9]/.test(char)) {
      let end = index;
      while (end < text.length && /[0-9.]/.test(text[end]))
        end += 1;
      tokens.push({ type: "number", value: text.slice(index, end) });
      index = end;
      continue;
    }
    const two = text.slice(index, index + 2);
    if (["<=", ">=", "<>", "!=", "||", "::", "->", "=>"].indexOf(two) >= 0) {
      tokens.push({ type: "punct", value: two });
      index += 2;
      continue;
    }
    tokens.push({ type: "punct", value: char });
    index += 1;
  }
  return tokens;
}
function toolSqlMerge(tokens) {
  const output = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "word") {
      let matched = null;
      for (let phraseIndex = 0; phraseIndex < toolSqlPhrases.length; phraseIndex += 1) {
        const phrase = toolSqlPhrases[phraseIndex];
        const words = phrase.slice(0, phrase.length - 1);
        const value = phrase[phrase.length - 1];
        let ok = true;
        for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
          const candidate = tokens[index + wordIndex];
          if (!candidate || candidate.type !== "word" || candidate.value.toLowerCase() !== words[wordIndex]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          matched = { value, length: words.length };
          break;
        }
      }
      if (matched) {
        output.push({ type: "word", value: matched.value });
        index += matched.length;
        continue;
      }
    }
    output.push(token);
    index += 1;
  }
  return output;
}
function toolSqlKeywordText(token) {
  const value = String(token.value);
  if (token.type !== "word")
    return value;
  if (/^[A-Z][A-Z ]+$/.test(value))
    return value;
  const lower = value.toLowerCase();
  if (toolSqlKeywords[lower] !== void 0)
    return value.toUpperCase();
  return value;
}
function toolSqlFormat(sql) {
  const tokens = toolSqlTokenize(sql);
  if (!tokens.length)
    throw new Error("请输入要美化的 SQL");
  const merged = toolSqlMerge(tokens);
  const lines = [""];
  let depth = 0;
  let inSelect = false;
  function append(text, noSpace) {
    const lineIndex = lines.length - 1;
    const line = lines[lineIndex];
    const trimmed = line.trim();
    let separator = "";
    if (!noSpace && trimmed !== "" && !/[(.[]$/.test(trimmed) && !/^[,.;:)\]]/.test(text))
      separator = " ";
    lines[lineIndex] = line + separator + text;
  }
  function newLine(level) {
    if (lines[lines.length - 1].trim() === "")
      return;
    lines.push("  ".repeat(Math.max(0, level)));
  }
  for (let index = 0; index < merged.length; index += 1) {
    const token = merged[index];
    if (token.type === "comment") {
      newLine(depth);
      append(String(token.value), true);
      if (index < merged.length - 1)
        newLine(depth);
      continue;
    }
    if (token.type === "punct") {
      const value = String(token.value);
      if (value === "(") {
        const lastLine = lines[lines.length - 1];
        const trimmed = lastLine.trim();
        const lastWordMatch = /([A-Za-z_][\w$]*)$/.exec(trimmed);
        const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : "";
        const spaced = toolSqlKeywords[lastWord] !== void 0 || toolSqlContinuationWords[lastWord] !== void 0 || /[=<>+\-*/|]$/.test(trimmed);
        append(value, !spaced);
        depth += 1;
        continue;
      }
      if (value === ")") {
        depth = Math.max(0, depth - 1);
        append(value, true);
        continue;
      }
      if (value === ",") {
        append(value, true);
        if (inSelect && depth === 0)
          newLine(1);
        continue;
      }
      if (value === ";") {
        append(value, true);
        if (index < merged.length - 1)
          newLine(0);
        continue;
      }
      append(value, value === "::");
      continue;
    }
    const lower = String(token.value).toLowerCase();
    if (token.type === "word" && toolSqlClauseWords[lower] !== void 0) {
      const last = lines[lines.length - 1];
      if (last.trim() !== "" && !/\($/.test(last.trim()))
        newLine(depth);
      inSelect = lower === "select";
      append(toolSqlKeywordText(token), false);
      continue;
    }
    if (token.type === "word" && toolSqlContinuationWords[lower] !== void 0) {
      newLine(depth + 1);
      append(toolSqlKeywordText(token), false);
      continue;
    }
    append(toolSqlKeywordText(token), false);
  }
  const result = [];
  lines.forEach(function(line) {
    const text = line.replace(/\s+$/, "");
    if (text === "" && (result.length === 0 || result[result.length - 1] === ""))
      return;
    result.push(text);
  });
  while (result.length && result[result.length - 1] === "")
    result.pop();
  return result.join("\n");
}
function toolSqlPane(props) {
  const value = props.value || {};
  function run() {
    try {
      const output = toolSqlFormat(value.input);
      props.patch({ output, error: "" });
    } catch (error) {
      props.patch({ output: "", error: String(error && error.message || error) });
    }
  }
  return h("div", { className: "wb-stack", style: { gap: 12 } }, h("div", { className: "wb-split" }, h(Field, { label: "输入 SQL", hint: "只做文本美化，不连接数据库、不执行语句" }, h(Textarea, {
    value: value.input || "",
    rows: 12,
    spellCheck: false,
    style: toolMonoStyle(220),
    placeholder: "粘贴 SQL",
    onChange: function(event) {
      props.patch({ input: event.target.value });
    }
  })), h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row", style: { gap: 6 } }, h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "database",
    onClick: run,
    children: "美化"
  }), h("div", { className: "wb-spacer" }), h(toolCopyButton, { text: value.output })), h(toolErrorBlock, { text: value.error }), h(toolOutputBlock, { text: value.output, placeholder: "关键字大写 + 子句换行后的 SQL" }))));
}

// src/client/features/toolbox/catalog.ts
var toolDefs = [
  { id: "http-debug", name: "接口调试", desc: "HTTP 请求、响应与耗时", icon: "plug", network: true },
  { id: "mcp-debug", name: "MCP 调试", desc: "连接、发现工具与参数调用", icon: "agent", network: true },
  { id: "json", name: "JSON", desc: "格式化 / 压缩 / 校验", icon: "layers" },
  { id: "timestamp", name: "时间戳", desc: "Unix 秒毫秒 ↔ 本地时间", icon: "clock" },
  { id: "base64", name: "Base64", desc: "UTF-8 安全编码解码", icon: "lock" },
  { id: "url", name: "URL", desc: "编解码与 query 拆解", icon: "link" },
  { id: "uuid", name: "UUID", desc: "批量生成 v4", icon: "zap" },
  { id: "jwt", name: "JWT", desc: "解析 header / payload", icon: "eye" },
  { id: "regex", name: "正则", desc: "匹配与捕获组", icon: "filter" },
  { id: "diff", name: "文本 Diff", desc: "逐行 LCS 对比", icon: "git" },
  { id: "cron", name: "Cron", desc: "5 段表达式逐段解释", icon: "calendar" },
  { id: "sql", name: "SQL", desc: "关键字大写与缩进", icon: "database" },
  { id: "yaml", name: "YAML", desc: "YAML ↔ JSON", icon: "layers" },
  { id: "csv", name: "CSV", desc: "CSV ↔ JSON，含引号转义", icon: "database" },
  { id: "markdown", name: "Markdown", desc: "基础语法实时预览", icon: "book" },
  { id: "status", name: "HTTP 状态码", desc: "按码查含义与排查方向", icon: "info" },
  { id: "shell", name: "Shell / Docker", desc: "命令行速查（离线）", icon: "command" },
  { id: "sqlexplain", name: "SQL 计划解读", desc: "按关键字给调优提示", icon: "database" }
];
function toolInitialState() {
  return {
    selected: "json",
    "http-debug": { url: "", method: "GET", headers: "{}", body: "", timeoutMs: 3e4 },
    "mcp-debug": { url: "", version: "2025-11-25", headers: "{}", arguments: "{}", timeoutMs: 3e4 },
    json: {
      input: '{\n  "name": "dev-workbench",\n  "local": true,\n  "tags": ["offline", "browser"]\n}',
      output: "",
      error: ""
    },
    timestamp: { input: String(Date.now()), output: "", error: "" },
    base64: { mode: "encode", input: "智能工作台 · local only", output: "", error: "" },
    url: {
      mode: "encode",
      input: "https://example.com/search?q=开发 工具&page=2",
      output: "",
      error: "",
      rows: []
    },
    uuid: { count: "5", upper: false, output: "", error: "" },
    jwt: {
      input: "",
      headerText: "",
      payloadText: "",
      claims: [],
      signatureLength: 0,
      error: "",
      ran: false
    },
    regex: {
      pattern: "(\\w+)@(\\w+\\.\\w+)",
      flags: "gi",
      text: "联系 dev@example.com 或 ops@example.org",
      matches: [],
      error: "",
      ran: false
    },
    diff: {
      left: "alpha\nbeta\ngamma\ndelta",
      right: "alpha\nbeta changed\ngamma\ndelta\nepsilon",
      rows: [],
      stats: null,
      error: "",
      ran: false
    },
    cron: { expr: "*/15 9-18 * * 1-5", rows: [], times: [], error: "", ran: false },
    yaml: {
      input: "name: dev-workbench\ntags:\n  - offline\n  - browser\nlocal: true",
      output: "",
      error: ""
    },
    csv: {
      input: "name,qps\n网关,2000\n报表,800",
      output: "",
      error: "",
      note: "",
      header: true
    },
    markdown: {
      input: "# 标题\n\n**加粗**、*斜体* 与 `行内代码`\n\n- 列表项一\n- 列表项二\n\n> 引用\n\n```js\nconst a = 1\n```",
      output: "",
      error: ""
    },
    status: {
      group: "all",
      query: ""
    },
    shell: {
      group: "全部",
      query: ""
    },
    sqlexplain: {
      input: "EXPLAIN SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC;\n->  Seq Scan on orders  (cost=0.00..1834.00 rows=1 width=64)\n   Filter: (user_id = 1)\n   Sort  (cost=1834.01..1834.02 rows=1 width=64)\n   Sort Method: quicksort  Memory: 25kB",
      output: "",
      error: ""
    },
    sql: {
      input: "select id, name, count(*) as total from users left join orders on orders.user_id = users.id where users.active = 1 and orders.total > 100 group by id, name order by total desc limit 20",
      output: "",
      error: ""
    }
  };
}

// src/client/features/toolbox/toolbox.ts
var toolPanes = {
  "http-debug": HttpDebugger,
  "mcp-debug": McpDebugger,
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
  shell: toolShellPane,
  sqlexplain: toolSqlExplainPane
};
function toolPage() {
  const [state, setState] = React33.useState(toolInitialState);
  const selected = state.selected || "json";
  const def = toolDefs.filter(function(item) {
    return item.id === selected;
  })[0] || toolDefs[0];
  const Pane = toolPanes[selected] || toolJsonPane;
  function patchFor(key2) {
    return function(patch) {
      setState(function(previous) {
        const next = Object.assign({}, previous);
        next[key2] = Object.assign({}, previous[key2], patch);
        return next;
      });
    };
  }
  function selectTool(toolId) {
    setState(function(previous) {
      return Object.assign({}, previous, { selected: toolId });
    });
  }
  return h("div", { className: "wb-page" }, h(PageHead, {
    icon: "toolbox",
    title: "开发工具箱",
    sub: toolDefs.length + " 项开发工具：离线处理与显式联网调试分开标注。"
  }), h("div", {
    className: "wb-toolbox-layout",
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(190px, 236px) minmax(0, 1fr)",
      gap: 14,
      alignItems: "start"
    }
  }, h(Panel, { title: "工具", sub: "切换工具会保留各自输入", icon: "toolbox", flush: true }, h("div", { style: { padding: "0 12px 12px" } }, h("div", { className: "wb-toolgrid", style: { gridTemplateColumns: "minmax(0, 1fr)" } }, toolDefs.map(function(item) {
    const active = selected === item.id;
    return h("button", {
      key: item.id,
      type: "button",
      className: "wb-tool" + (active ? " is-active" : ""),
      "aria-pressed": active ? "true" : "false",
      onClick: function() {
        selectTool(item.id);
      }
    }, h("span", {
      className: "wb-row",
      style: {
        gap: 6,
        alignItems: "center",
        color: active ? T.accent : T.text2,
        fontSize: 12.5,
        fontWeight: 600
      }
    }, h(Icon, { name: item.icon, size: 14 }), h("span", null, item.name)), h("span", null, item.desc));
  })))), h(Panel, {
    title: def.name,
    sub: def.desc,
    icon: def.icon,
    actions: h(Badge, { tone: "ok" }, def.network ? "宿主联网调试" : "本地执行")
  }, !def.network && h(toolLocalNote, null), h(Pane, { value: state[selected] || {}, patch: patchFor(selected) }))), h("p", { className: "wb-tiny wb-muted", style: { marginTop: 14, lineHeight: 1.7 } }, "离线工具箱不读取 Host 数据或发起网络请求；接口和 MCP 调试仅在点击发送后访问目标。输入不写入工作台，刷新后清空。"));
}
WB.pages.toolbox = toolPage;

// src/client/features/knowledge/RetrievalPanel.tsx
var React34 = __toESM(require("react"), 1);
function RetrievalPanel({ data, onReview }) {
  const [query, setQuery] = React34.useState(""), [projectId, setProject] = React34.useState(data?.settings?.defaultProjectId || ""), [accountId, setAccount] = React34.useState(""), [result, setResult] = React34.useState(null), [error, setError] = React34.useState(""), [busy, setBusy] = React34.useState(false), [importTitle, setTitle] = React34.useState(""), [importBody, setBody] = React34.useState(""), [showImport, setImport] = React34.useState(false), [traces, setTraces] = React34.useState([]);
  const accounts = [...new Set((data?.sources || []).map((s) => s.locator?.accountId).filter(Boolean))];
  const pending = (data?.knowledge || []).filter((k) => !k.archivedAt && k.reviewState !== "confirmed" && k.reviewState !== "obsolete");
  async function test() {
    setBusy(true);
    setError("");
    try {
      setResult(await WB.actions.knowledgeRetrieve({ query, scope: { projectId: projectId || null, accountId: accountId || null } }));
      const history = await WB.actions.knowledgeTraces({});
      setTraces(history.items || []);
    } catch (e) {
      setError(e.message || "检索失败");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError("");
    if (!importTitle.trim() || !importBody.trim()) {
      setError("请填写标题及正文");
      return;
    }
    if (importBody.length > 2e4) {
      setError("正文超过20000字符，请按章节拆分后导入");
      return;
    }
    try {
      await WB.actions.createKnowledge({ title: importTitle, body: importBody, kind: "note", reviewState: "candidate", projectId: projectId || null, accountId: accountId || null, sourceLabel: "手动导入正文" });
      setBody("");
      setTitle("");
      setImport(false);
    } catch (e) {
      setError(e.message);
    }
  }
  return /* @__PURE__ */ React34.createElement(Panel, { title: "知识检索与审核", sub: "只有已确认、未归档且有效的正文参与自动检索；模型生成与历史未审核条目先作为候选。", style: { marginBottom: 14 } }, /* @__PURE__ */ React34.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React34.createElement(Btn, { size: "sm", onClick: () => setImport(!showImport) }, "导入文本资料"), pending.length > 0 && /* @__PURE__ */ React34.createElement(Btn, { size: "sm", onClick: () => onReview(pending[0]) }, "审核待确认知识（", pending.length, "）")), /* @__PURE__ */ React34.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8, marginTop: 10 } }, /* @__PURE__ */ React34.createElement(Field, { label: "检索项目" }, /* @__PURE__ */ React34.createElement(Select, { value: projectId, options: [{ value: "", label: "个人通用知识" }, ...(data?.projects || []).map((p) => ({ value: p.id, label: p.name }))], onChange: (e) => {
    setProject(e.target.value);
    setResult(null);
  } })), /* @__PURE__ */ React34.createElement(Field, { label: "账号范围" }, /* @__PURE__ */ React34.createElement(Select, { value: accountId, options: [{ value: "", label: "通用资料（不含账号专属）" }, ...accounts.map((id) => ({ value: id, label: id }))], onChange: (e) => {
    setAccount(e.target.value);
    setResult(null);
  } }))), /* @__PURE__ */ React34.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8, marginTop: 8 } }, /* @__PURE__ */ React34.createElement(Input, { "aria-label": "知识检索测试问题", placeholder: "例如：以前接口超时怎么处理？", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => {
    if (e.key === "Enter" && query.trim() && !busy) test();
  }, style: { flex: 1, minWidth: 160 } }), /* @__PURE__ */ React34.createElement(Btn, { disabled: busy || !query.trim(), onClick: test }, busy ? "检索中…" : "测试检索")), /* @__PURE__ */ React34.createElement(KnowledgeSources, { result }), !!traces.length && /* @__PURE__ */ React34.createElement("details", { style: { fontSize: 12, marginTop: 8 } }, /* @__PURE__ */ React34.createElement("summary", null, "最近检索记录（", traces.length, "）"), traces.slice(0, 10).map((t) => /* @__PURE__ */ React34.createElement("div", { key: t.id, style: { padding: 5, overflowWrap: "anywhere" } }, t.query, " · ", t.status, " · ", t.hits?.length || 0, "个片段 · ", t.elapsedMs, "ms"))), showImport && /* @__PURE__ */ React34.createElement("div", { className: "wb-stack", style: { marginTop: 12 } }, /* @__PURE__ */ React34.createElement(Field, { label: "资料标题" }, /* @__PURE__ */ React34.createElement(Input, { value: importTitle, onChange: (e) => setTitle(e.target.value) })), /* @__PURE__ */ React34.createElement(Field, { label: "文本文件（Markdown / TXT）" }, /* @__PURE__ */ React34.createElement("input", { type: "file", accept: ".md,.txt", "aria-label": "导入知识文本文件", onChange: async (e) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8e4) {
      setError("文件过大，请按章节拆分");
      return;
    }
    const text = await file.text();
    if (text.length > 2e4) {
      setError("正文超过20000字符，请按章节拆分");
      return;
    }
    setBody(text);
    if (!importTitle) setTitle(file.name);
  } })), /* @__PURE__ */ React34.createElement(Field, { label: "资料正文" }, /* @__PURE__ */ React34.createElement(Textarea, { rows: 6, value: importBody, onChange: (e) => setBody(e.target.value) })), /* @__PURE__ */ React34.createElement(Btn, { onClick: save }, "保存为待审核资料")), error && /* @__PURE__ */ React34.createElement("p", { role: "alert" }, error));
}

// src/shared/knowledge.ts
var KNOWLEDGE_REVIEW_OPTIONS = [{ value: "candidate", label: "待审核" }, { value: "confirmed", label: "已确认" }, { value: "obsolete", label: "已失效" }];

// src/client/features/knowledge/knowledge-space.ts
var React35 = __toESM(require("react"), 1);
var knowKindMeta = {
  bookmark: { label: "收藏", tone: "accent", icon: "link" },
  note: { label: "笔记", tone: "ok", icon: "book" },
  snippet: { label: "片段", tone: "warn", icon: "command" }
};
function knowKindOf(kind) {
  return knowKindMeta[kind] || { label: kind ? String(kind) : "未知类型", tone: "idle", icon: "layers" };
}
function knowSearchBlob(item) {
  if (!item)
    return "";
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  return [item.title, item.body, item.url, tags].filter(function(part) {
    return !!part;
  }).join("\n").toLowerCase();
}
function knowTagList(items) {
  const counts = {};
  (items || []).forEach(function(item) {
    const tags = item && Array.isArray(item.tags) ? item.tags : [];
    tags.forEach(function(tag) {
      const key2 = String(tag).trim();
      if (!key2)
        return;
      counts[key2] = (counts[key2] || 0) + 1;
    });
  });
  return Object.keys(counts).map(function(tag) {
    return { tag, count: counts[tag] };
  }).sort(function(a, b) {
    if (a.count !== b.count)
      return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}
function knowCopyText(item) {
  const lines = [];
  if (item.title)
    lines.push(item.title);
  if (item.url)
    lines.push(item.url);
  if (item.body) {
    lines.push("");
    lines.push(String(item.body));
  }
  if (Array.isArray(item.tags) && item.tags.length) {
    lines.push("");
    lines.push(item.tags.map(function(tag) {
      return "#" + tag;
    }).join(" "));
  }
  return lines.join("\n");
}
function knowSortItems(items) {
  return (items || []).slice().sort(function(a, b) {
    const av = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bv = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const left = Number.isNaN(av) ? 0 : av;
    const right = Number.isNaN(bv) ? 0 : bv;
    return right - left;
  });
}
function knowPage() {
  const wbState = WB.useStore();
  const data = wbState && wbState.data ? wbState.data : null;
  const items = data && Array.isArray(data.knowledge) ? data.knowledge.filter((row) => !row.archivedAt) : [];
  const [page, setPage] = React35.useState(0);
  const [kind, setKind] = React35.useState("all");
  const [query, setQuery] = React35.useState("");
  const [tag, setTag] = React35.useState("");
  React35.useEffect(() => setPage(0), [kind, query, tag]);
  const [createOpen, setCreateOpen] = React35.useState(false);
  const [formError, setFormError] = React35.useState("");
  const [form, setForm] = React35.useState(function() {
    return { kind: "note", title: "", url: "", body: "", tags: "" };
  });
  const [confirmItem, setConfirmItem] = React35.useState(null);
  const [editItem, setEditItem] = React35.useState(null);
  const counts = { all: items.length, bookmark: 0, note: 0, snippet: 0 };
  items.forEach(function(item) {
    if (item && counts[item.kind] !== void 0)
      counts[item.kind] += 1;
  });
  const tabs = [
    { value: "all", label: "全部", count: counts.all },
    { value: "bookmark", label: knowKindMeta.bookmark.label, count: counts.bookmark },
    { value: "note", label: knowKindMeta.note.label, count: counts.note },
    { value: "snippet", label: knowKindMeta.snippet.label, count: counts.snippet }
  ];
  const needle = query.trim().toLowerCase();
  const filtered = knowSortItems(items.filter(function(item) {
    if (!item)
      return false;
    if (kind !== "all" && item.kind !== kind)
      return false;
    if (tag && !(Array.isArray(item.tags) && item.tags.indexOf(tag) >= 0))
      return false;
    if (needle && knowSearchBlob(item).indexOf(needle) < 0)
      return false;
    return true;
  }));
  const allTags = knowTagList(items);
  function patchForm(patch) {
    setForm(function(previous) {
      return Object.assign({}, previous, patch);
    });
  }
  function openCreate() {
    setEditItem(null);
    setForm({ kind: "note", title: "", url: "", body: "", tags: "" });
    setFormError("");
    setCreateOpen(true);
  }
  function openEdit(item) {
    if (!item)
      return;
    setEditItem(item);
    setForm({
      kind: item.kind || "note",
      title: item.title || "",
      url: item.url || "",
      body: item.body || "",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
      reviewState: item.reviewState || "candidate",
      projectId: item.projectId || "",
      accountId: item.accountId || "",
      validUntil: item.validUntil || "",
      sourceLabel: item.sourceLabel || ""
    });
    setFormError("");
    setCreateOpen(true);
  }
  function closeCreate() {
    setCreateOpen(false);
    setEditItem(null);
    setFormError("");
  }
  function copyItem(item) {
    WB.util.copy(knowCopyText(item)).then(function() {
      WB.toast("条目内容已复制", "ok");
    }).catch(function(error) {
      WB.toast(String(error && error.message || error), "err");
    });
  }
  function submitCreate() {
    const title = String(form.title || "").trim();
    if (!title) {
      setFormError("标题必填：一条知识至少要有可检索的标题");
      return;
    }
    const input = {
      kind: form.kind,
      reviewState: form.reviewState || "confirmed",
      projectId: form.projectId || null,
      accountId: form.accountId || null,
      validUntil: form.validUntil || null,
      sourceLabel: form.sourceLabel || "",
      title,
      body: String(form.body || "").trim(),
      tags: String(form.tags || "").split(/[,，]/).map(function(part) {
        return part.trim();
      }).filter(function(part) {
        return part.length > 0;
      })
    };
    const url = String(form.url || "").trim();
    if (url)
      input.url = url;
    const operation = editItem && editItem.id ? WB.actions.updateKnowledge(editItem.id, input) : WB.actions.createKnowledge(input);
    operation.then(function() {
      setCreateOpen(false);
      setEditItem(null);
      setFormError("");
      setForm({ kind: "note", title: "", url: "", body: "", tags: "" });
    }).catch(function(error) {
      setFormError(String(error && error.message || error));
    });
  }
  function removeItem() {
    const item = confirmItem;
    if (!item || !item.id)
      return;
    WB.actions.deleteKnowledge(item.id).then(function() {
      setConfirmItem(null);
    }).catch(function() {
    });
  }
  const summary = items.length ? "共 " + items.length + " 条 · 收藏 " + counts.bookmark + " · 笔记 " + counts.note + " · 片段 " + counts.snippet : "知识审核、自动检索与原文引用；收藏、笔记和排障经验可供聊天及办公流程复用。";
  const typeOptions = Object.keys(knowKindMeta).map(function(key2) {
    return { value: key2, label: knowKindMeta[key2].label };
  });
  const cards = filtered.slice(pageIndex(page, filtered.length) * PAGE_SIZE, (pageIndex(page, filtered.length) + 1) * PAGE_SIZE).map(function(item) {
    const meta = knowKindOf(item.kind);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return h("article", {
      key: item.id,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
        padding: "13px 14px",
        border: "1px solid " + T.border1,
        borderRadius: 16,
        background: T.layer1
      }
    }, h("div", { className: "wb-row", style: { gap: 6, minWidth: 0 } }, h("span", { className: "wb-row", style: { gap: 5, color: T.text2 } }, h(Icon, { name: meta.icon, size: 13 }), h(Badge, { tone: meta.tone }, meta.label)), h("span", { className: "wb-spacer" }), h("span", {
      className: "wb-tiny wb-muted",
      title: item.createdAt ? WB.fmt.datetime(item.createdAt) : "创建时间未记录"
    }, item.createdAt ? WB.fmt.relative(item.createdAt) : "—"), h(IconBtn, {
      name: "edit",
      label: "编辑条目",
      onClick: function() {
        openEdit(item);
      }
    }), h(IconBtn, {
      name: "sparkles",
      label: "AI 分析这条知识（带上下文进入会话）",
      onClick: function() {
        WB.assistant.add({
          kind: "knowledge",
          id: item.id,
          title: item.title,
          url: item.url || null,
          body: String(item.body || "").slice(0, 800)
        });
      }
    }), h(IconBtn, {
      name: "copy",
      label: "复制条目",
      onClick: function() {
        copyItem(item);
      }
    }), h(IconBtn, {
      name: "trash",
      label: "删除条目",
      onClick: function() {
        setConfirmItem(item);
      }
    })), h("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.45,
        overflowWrap: "anywhere"
      }
    }, item.title || "（未命名条目）"), h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Badge, { tone: item.reviewState === "confirmed" ? "ok" : item.reviewState === "obsolete" ? "idle" : "warn" }, item.reviewState === "confirmed" ? "已确认" : item.reviewState === "obsolete" ? "已失效" : "待审核"), h("span", { className: "wb-tiny wb-muted" }, item.projectId ? (data && data.projects || []).find((p) => p.id === item.projectId)?.name || item.projectId : "个人通用"), item.validUntil ? h("span", { className: "wb-tiny wb-muted" }, "有效至 " + WB.fmt.datetime(item.validUntil)) : null), item.url ? h("a", {
      className: "wb-link wb-tiny wb-ellipsis",
      href: item.url,
      target: "_blank",
      rel: "noreferrer",
      title: item.url
    }, item.url) : null, item.body ? h("div", {
      className: "wb-clamp2 wb-tiny wb-muted",
      style: { lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
    }, String(item.body)) : null, tags.length ? h("div", { className: "wb-row wb-row--wrap", style: { gap: 4 } }, tags.map(function(itemTag) {
      return h(Chip, {
        key: itemTag,
        active: tag === itemTag,
        onClick: function() {
          setTag(tag === itemTag ? "" : itemTag);
        }
      }, itemTag);
    })) : null);
  });
  const emptyState = !items.length ? h(Empty, {
    icon: "book",
    title: "知识空间还是空的",
    hint: "可以从技术雷达收藏条目，或直接在对话里让 Agent 记录一条笔记 / 片段；本页展示 Host 持久化的全部知识条目。",
    action: h(Btn, {
      kind: "primary",
      size: "sm",
      icon: "plus",
      onClick: openCreate,
      children: "新建第一条"
    })
  }) : h(Empty, {
    icon: "search",
    title: "没有匹配的条目",
    hint: "试试清空搜索、切换类型，或取消标签筛选。",
    action: h(Btn, {
      size: "sm",
      icon: "refresh",
      onClick: function() {
        setQuery("");
        setTag("");
        setKind("all");
      },
      children: "清空筛选"
    })
  });
  const createModal = h(Modal, {
    open: createOpen,
    title: editItem ? "编辑知识条目" : "新建知识条目",
    sub: editItem ? "修改后立即写回 Host 持久化" : "标题必填；其余字段可选",
    onClose: closeCreate,
    footer: [
      h(Btn, { key: "cancel", onClick: closeCreate, children: "取消" }),
      h(Btn, {
        key: "create",
        kind: "primary",
        icon: "save",
        disabled: !!wbState.busy,
        onClick: submitCreate,
        children: editItem ? "保存修改" : "保存"
      })
    ]
  }, h("div", { className: "wb-stack", style: { gap: 10 } }, h(Field, { label: "类型" }, h(Select, {
    value: form.kind,
    options: typeOptions,
    onChange: function(event) {
      patchForm({ kind: event.target.value });
    }
  })), h(Field, { label: "知识状态" }, h(Select, { value: form.reviewState || "confirmed", options: KNOWLEDGE_REVIEW_OPTIONS, onChange: (e) => patchForm({ reviewState: e.target.value }) })), h(Field, { label: "所属项目" }, h(Select, { value: form.projectId || "", options: [{ value: "", label: "个人通用" }, ...(data && data.projects || []).map((p) => ({ value: p.id, label: p.name }))], onChange: (e) => patchForm({ projectId: e.target.value }) })), h(Field, { label: "账号范围标识", hint: "留空为个人通用；专属资料填写来源账号标识" }, h(Input, { value: form.accountId || "", onChange: (e) => patchForm({ accountId: e.target.value }) })), h(Field, { label: "有效期", hint: "留空长期有效；使用ISO日期时间，例如2026-12-31T23:59:59+08:00" }, h(Input, { value: form.validUntil || "", onChange: (e) => patchForm({ validUntil: e.target.value }) })), h(Field, { label: "标题" }, h(Input, {
    value: form.title,
    placeholder: "例如：Harness 插件热更新排查记录",
    onChange: function(event) {
      patchForm({ title: event.target.value });
    }
  })), h(Field, { label: "链接", hint: "可选：收藏的来源地址" }, h(Input, {
    value: form.url,
    placeholder: "https://…",
    onChange: function(event) {
      patchForm({ url: event.target.value });
    }
  })), h(Field, { label: "正文" }, h(Textarea, {
    value: form.body,
    rows: 6,
    placeholder: "笔记正文、命令片段或排障结论",
    onChange: function(event) {
      patchForm({ body: event.target.value });
    }
  })), h(Field, { label: "标签", hint: "逗号分隔，例如：harness, plugin, 排障" }, h(Input, {
    value: form.tags,
    placeholder: "harness, plugin",
    onChange: function(event) {
      patchForm({ tags: event.target.value });
    }
  })), formError ? h("div", {
    role: "alert",
    className: "wb-tiny",
    style: {
      color: T.err,
      padding: "7px 9px",
      borderRadius: 8,
      border: "1px solid color-mix(in srgb, " + T.err + " 45%, transparent)",
      background: "color-mix(in srgb, " + T.err + " 10%, transparent)",
      overflowWrap: "anywhere"
    }
  }, formError) : null));
  const deleteModal = h(Modal, {
    open: !!confirmItem,
    title: "删除知识条目",
    sub: confirmItem ? confirmItem.title || "（未命名条目）" : "",
    onClose: function() {
      setConfirmItem(null);
    },
    footer: [
      h(Btn, {
        key: "cancel",
        onClick: function() {
          setConfirmItem(null);
        },
        children: "取消"
      }),
      h(Btn, {
        key: "delete",
        kind: "danger",
        icon: "trash",
        disabled: !!wbState.busy,
        onClick: removeItem,
        children: "确认删除"
      })
    ]
  }, h("p", { className: "wb-tiny", style: { margin: 0, lineHeight: 1.7 } }, "删除后不可恢复：Host 会把这条记录从持久化数据中移除。"));
  return h("div", { className: "wb-page" }, h(PageHead, {
    icon: "book",
    title: "知识空间",
    sub: summary,
    actions: h(Btn, {
      kind: "primary",
      icon: "plus",
      onClick: openCreate,
      children: "新建条目"
    })
  }), h(RetrievalPanel, { data, onReview: openEdit }), h("div", {
    className: "wb-row wb-row--wrap",
    style: { gap: 10, marginBottom: 12, alignItems: "center" }
  }, h(Tabs, {
    items: tabs,
    value: kind,
    onChange: function(next) {
      setKind(next);
    }
  }), h("div", { className: "wb-spacer" }), h("div", { className: "wb-row", style: { gap: 4 } }, h(Input, {
    value: query,
    placeholder: "搜索标题、正文、标签或链接",
    style: { width: 260 },
    onChange: function(event) {
      setQuery(event.target.value);
    }
  }), query ? h(IconBtn, {
    name: "close",
    label: "清空搜索",
    onClick: function() {
      setQuery("");
    }
  }) : null)), allTags.length ? h("div", {
    className: "wb-row wb-row--wrap",
    style: { gap: 6, marginBottom: 14, alignItems: "center" }
  }, h("span", { className: "wb-tiny wb-muted" }, "标签"), allTags.map(function(entry) {
    return h(Chip, {
      key: entry.tag,
      active: tag === entry.tag,
      onClick: function() {
        setTag(tag === entry.tag ? "" : entry.tag);
      },
      title: "按标签筛选"
    }, entry.tag + " · " + entry.count);
  }), tag ? h("button", {
    type: "button",
    className: "wb-chip",
    onClick: function() {
      setTag("");
    }
  }, h(Icon, { name: "close", size: 11 }), "清除标签") : null) : null, cards.length ? h("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 14
    }
  }, cards) : emptyState, h(Pagination, { page, total: filtered.length, onChange: setPage }), h("p", { className: "wb-tiny wb-muted", style: { marginTop: 14, lineHeight: 1.7 } }, "知识按审核状态和当前范围参与回答；更新或失效后，旧引用会提示重新检索。"), createModal, deleteModal);
}
WB.pages.knowledge = knowPage;

// src/client/features/collaboration/ProjectLauncher.tsx
var React36 = __toESM(require("react"), 1);
function ProjectLauncher() {
  const store = useStore(), projects = store.data?.projects || [];
  const [projectId, setProjectId] = React36.useState(""), [runtime, setRuntime] = React36.useState(null), [error, setError] = React36.useState(""), [busy, setBusy] = React36.useState(false), [config, setConfig] = React36.useState("[]"), [editing, setEditing] = React36.useState(false);
  const selected = projects.find((p) => p.id === projectId);
  const rpc = (name2, request) => WB.rpc("workbench/" + name2, { request });
  React36.useEffect(() => {
    if (!projects.some((p) => p.id === projectId)) setProjectId(projects[0]?.id || "");
  }, [projects, projectId]);
  React36.useEffect(() => {
    let live = true;
    setRuntime(null);
    setError("");
    setEditing(false);
    setConfig(JSON.stringify(selected?.launchCommands || [], null, 2));
    const refresh = async () => {
      if (!projectId) return;
      try {
        const value = await rpc("projectRuntime", { projectId });
        if (live) {
          setRuntime(value);
          setError("");
        }
      } catch (e) {
        if (live) setError(String(e.message));
      }
    };
    void refresh();
    return () => {
      live = false;
    };
  }, [projectId, selected?.repoPath]);
  async function action(method, request) {
    setBusy(true);
    setError("");
    try {
      const result = await rpc(method, request);
      if (method === "projectOpen") WB.toast("已请求打开应用", "ok");
      else setRuntime(method === "projectRuntime" ? result : await rpc("projectRuntime", { projectId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const active = runtime?.runs?.some((r) => ["running", "stopping"].includes(r.status));
  React36.useEffect(() => {
    if (!active) return;
    let live = true, timer;
    const poll = async () => {
      try {
        const value = await rpc("projectRuntime", { projectId });
        if (live) setRuntime(value);
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) timer = setTimeout(poll, 1500);
      }
    };
    timer = setTimeout(poll, 1500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, projectId]);
  return /* @__PURE__ */ React36.createElement(Panel, { title: "项目启动与运行", icon: "play", sub: "按项目打开开发软件、执行启动配置并查看运行日志。" }, /* @__PURE__ */ React36.createElement("div", { className: "wb-stack" }, !projects.length ? /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-muted" }, "先用“添加仓库目录”登记项目。") : /* @__PURE__ */ React36.createElement(React36.Fragment, null, /* @__PURE__ */ React36.createElement("label", { className: "wb-label" }, "运行项目 ", /* @__PURE__ */ React36.createElement("select", { className: "wb-select", "aria-label": "运行项目", value: projectId, disabled: busy, onChange: (e) => setProjectId(e.target.value) }, projects.map((p) => /* @__PURE__ */ React36.createElement("option", { key: p.id, value: p.id }, p.name)))), /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-muted", style: { overflowWrap: "anywhere" } }, runtime?.cwd || selected?.repoPath), /* @__PURE__ */ React36.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, [["vscode", "打开 VS Code"], ["idea", "打开 IDEA"], ["terminal", "打开终端"]].map(([target, title]) => /* @__PURE__ */ React36.createElement(Btn, { key: target, disabled: busy || !projectId, onClick: () => action("projectOpen", { projectId, target }) }, title)), /* @__PURE__ */ React36.createElement(Btn, { disabled: busy, onClick: () => setEditing(!editing) }, "启动配置"), /* @__PURE__ */ React36.createElement(Btn, { disabled: busy, onClick: () => action("projectRuntime", { projectId }) }, "刷新运行状态")), editing && /* @__PURE__ */ React36.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-muted" }, "自动发现 package.json scripts、Maven 和 Gradle。额外命令使用 JSON 数组，例如 ", JSON.stringify([{ id: "backend", name: "后端服务", argv: ["./mvnw", "spring-boot:run"] }]), "。命令在项目目录执行。"), /* @__PURE__ */ React36.createElement(Textarea, { "aria-label": "项目启动配置", rows: 6, value: config, onChange: (e) => setConfig(e.target.value) }), /* @__PURE__ */ React36.createElement(Btn, { disabled: busy, onClick: async () => {
    setBusy(true);
    setError("");
    try {
      await WB.actions.saveProject({ ...selected, launchCommands: JSON.parse(config) });
      setRuntime(await rpc("projectRuntime", { projectId }));
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  } }, "保存启动配置")), /* @__PURE__ */ React36.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, (runtime?.commands || []).map((command) => /* @__PURE__ */ React36.createElement(Btn, { key: command.id, disabled: busy || runtime?.runs?.some((r) => ["running", "stopping"].includes(r.status) && JSON.stringify(r.argv) === JSON.stringify(command.argv)), title: JSON.stringify(command.argv), onClick: () => action("projectStart", { projectId, commandId: command.id }) }, "启动 ", command.name))), runtime && !(runtime.commands || []).length && /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-muted" }, "未发现可用脚本，可在“启动配置”中添加。"), (runtime?.runs || []).map((run) => /* @__PURE__ */ React36.createElement("details", { key: run.id, open: ["running", "stopping", "failed"].includes(run.status), className: "wb-reply-item" }, /* @__PURE__ */ React36.createElement("summary", null, run.name, " · ", { running: "运行中", stopping: "停止中", completed: "已完成", failed: "失败", stopped: "已停止" }[run.status] || run.status, run.exitCode !== void 0 ? " · 退出码 " + run.exitCode : ""), /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-mono", style: { overflowWrap: "anywhere" } }, JSON.stringify(run.argv), " · ", run.startedAt), run.status === "running" && /* @__PURE__ */ React36.createElement(Btn, { disabled: busy, onClick: () => action("projectStop", { runId: run.id }) }, "停止本次运行"), run.error && /* @__PURE__ */ React36.createElement("p", { role: "alert" }, run.error), /* @__PURE__ */ React36.createElement("strong", { className: "wb-tiny" }, "标准输出"), /* @__PURE__ */ React36.createElement("pre", { className: "wb-code", style: { maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, run.stdout || "暂无输出"), run.stderr && /* @__PURE__ */ React36.createElement(React36.Fragment, null, /* @__PURE__ */ React36.createElement("strong", { className: "wb-tiny" }, "标准错误"), /* @__PURE__ */ React36.createElement("pre", { className: "wb-code", style: { maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, run.stderr)), run.truncated && /* @__PURE__ */ React36.createElement("p", { className: "wb-tiny wb-muted" }, "日志缓冲已截断，仅展示保留的部分。")))), error && /* @__PURE__ */ React36.createElement("p", { role: "alert", className: "wb-tiny" }, error)));
}

// src/client/features/collaboration/collaboration.ts
var React37 = __toESM(require("react"), 1);
function collabGitTone(repo) {
  if (repo.status === "ok")
    return repo.changed > 0 ? "warn" : "ok";
  if (repo.status === "unavailable")
    return "idle";
  return "err";
}
function collabNormalizePath(value) {
  return String(value || "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
}
function collabRepoCard(repo, index, projects) {
  const projectList = Array.isArray(projects) ? projects : [];
  const repoDir = collabNormalizePath(repo.dir);
  const matchedProject = projectList.find(function(row) {
    return collabNormalizePath(row.repoPath) === repoDir && repoDir;
  }) || projectList.find(function(row) {
    return row.name && row.name === repo.label;
  }) || null;
  const tone = collabGitTone(repo);
  const changes = repo.changed || 0;
  return h(Panel, {
    key: (repo.dir || "repo") + index,
    icon: "git",
    title: repo.label || "仓库",
    sub: repo.dir || "",
    badge: h(Badge, { tone }, repo.status === "ok" ? changes > 0 ? changes + " 处改动" : "干净" : repo.status === "unavailable" ? "不可用" : "异常"),
    actions: h(
      "div",
      { className: "wb-row", style: { gap: 6 } },
      repo.status === "ok" ? h(Chip, { icon: "git", children: repo.branch || "(detached)" }) : null,
      // 只有来自「项目」的仓库才可移除；Host 工作目录不是项目记录，不显示删除按钮
      matchedProject ? h(IconBtn, {
        name: "trash",
        label: "从工作台移除这个仓库目录",
        onClick: function() {
          if (!window.confirm("从工作台移除仓库「" + (repo.label || repo.dir) + "」？只解绑项目记录，不会删除磁盘上的目录。"))
            return;
          WB.actions.deleteProject(matchedProject.id).catch(function() {
          });
        }
      }) : h("span", {
        className: "wb-tiny wb-muted",
        title: "该条目来自 Host 工作目录，不是项目记录；到「连接与设置 → 项目」添加/删除项目"
      }, "工作目录")
    )
  }, repo.status !== "ok" ? h(Empty, {
    icon: "alert",
    title: repo.status === "unavailable" ? "这一路没有可用工具" : "读取失败",
    hint: repo.reason || "没有拿到仓库状态。"
  }) : h("div", { className: "wb-stack", style: { gap: 8 } }, h("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, h(Badge, { tone: repo.staged > 0 ? "warn" : "idle" }, "已暂存 " + repo.staged), h(Badge, { tone: repo.unstaged > 0 ? "warn" : "idle" }, "未暂存 " + repo.unstaged), h(Badge, { tone: repo.untracked > 0 ? "warn" : "idle" }, "未跟踪 " + repo.untracked), repo.track && repo.track !== "in-sync" ? h(Badge, { tone: "idle" }, repo.track) : null), repo.lastCommit ? h("div", { className: "wb-item", style: { borderBottom: 0, paddingLeft: 0, paddingRight: 0 } }, h(Icon, { name: "clock", size: 13 }), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, repo.lastCommit.subject || "(无提交信息)"), h("div", { className: "wb-item-sub" }, h("span", { className: "wb-mono" }, repo.lastCommit.hash), h("span", null, repo.lastCommit.when)))) : null, repo.files && repo.files.length ? h("div", { className: "wb-stack", style: { gap: 2 } }, h("div", { className: "wb-label" }, "改动文件（最多 12 条）"), repo.files.map(function(line, lineIndex) {
    return h("div", { key: lineIndex, className: "wb-mono wb-ellipsis", style: { color: T.text2 } }, line);
  })) : h("span", { className: "wb-tiny wb-muted" }, "工作区没有未提交改动。"), changes > 12 ? h("span", { className: "wb-tiny wb-muted" }, "还有 " + (changes - 12) + " 条改动未显示。") : null));
}
function CollabPage() {
  const state = useStore();
  const [env, setEnv] = React37.useState(null);
  const [github, setGithub] = React37.useState(null);
  const [busy, setBusy] = React37.useState(false);
  const [error, setError] = React37.useState(null);
  function load() {
    setBusy(true);
    setError(null);
    WB.actions.environment().then(function(value) {
      setEnv(value);
      setBusy(false);
    }).catch(function(e) {
      setError(String(e && e.message || e));
      setBusy(false);
    });
  }
  React37.useEffect(function() {
    load();
    WB.actions.github().then(function(value) {
      setGithub(value);
    }).catch(function() {
      setGithub({ status: "error", note: "读取 GitHub 快照失败", prs: { items: [] }, runs: { items: [] } });
    });
  }, []);
  function addRepoDir() {
    WB.pickDirectory().then(function(dir) {
      if (!dir) {
        WB.toast("没有选择目录（或当前环境不提供目录选择器）", "info");
        return;
      }
      const parts = String(dir).split(/[\\/]/).filter(Boolean);
      const name2 = parts.length > 0 ? parts[parts.length - 1] : "项目";
      WB.actions.saveProject({ name: name2, repoPath: dir }).then(function() {
        load();
      }).catch(function() {
      });
    });
  }
  const repos = env && env.git || [];
  const docker = env && env.docker || null;
  const projects = state.data && state.data.projects || [];
  const dirty = repos.filter(function(repo) {
    return repo.status === "ok" && repo.changed > 0;
  }).length;
  const running = docker && docker.status === "ok" ? docker.containers.length : 0;
  return h("div", null, h(PageHead, {
    icon: "git",
    title: WB.t("nav.collab", "研发协作"),
    sub: "项目启动、开发软件联动与运行日志；仓库、容器和端口保留只读探测。",
    actions: h(Btn, {
      icon: "refresh",
      size: "sm",
      kind: "primary",
      disabled: busy,
      onClick: load,
      children: busy ? "探测中…" : "重新探测"
    })
  }), h("div", { className: "wb-grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 14 } }, h(Stat, { label: "仓库", value: repos.filter(function(r) {
    return r.status === "ok";
  }).length, sub: "已探测 " + repos.length + " 个目录", icon: "git" }), h(Stat, { label: "有未提交改动", value: dirty, tone: dirty ? "warn" : "ok", sub: dirty ? "先看一眼再动手" : "工作区干净", icon: "edit" }), h(Stat, { label: "运行中的容器", value: docker && docker.status === "ok" ? running : "—", sub: docker && docker.status === "ok" ? "来自 docker ps" : docker && docker.reason || "未探测", icon: "docker" }), h(Stat, { label: "项目", value: projects.length, sub: projects.length ? "来自 Host 数据" : "还没有配置项目", icon: "folder" })), h(ProjectLauncher), busy && !env ? h("div", { className: "wb-row", style: { padding: "30px 0", justifyContent: "center", gap: 8 } }, h(Spinner, { size: 17 }), h("span", { className: "wb-tiny wb-muted" }, "正在读取 git / docker 状态…")) : null, error ? h(Panel, { title: "探测失败", icon: "alert" }, h("div", { role: "alert", className: "wb-code" }, error), h("p", { className: "wb-hint", style: { marginTop: 8 } }, "如果刚刚更新过插件，说明 Host 还没有加载新的 Remote 端点：重启 DSH 后再试。")) : null, env ? h("div", { className: "wb-stack", style: { gap: 14 } }, h(Panel, {
    title: "Git 仓库",
    icon: "git",
    sub: env.cwd ? "默认探测 Host 的当前工作目录，以及已配置 repoPath 的项目" : void 0,
    actions: h("div", { className: "wb-row", style: { gap: 8 } }, env.at ? h("span", { className: "wb-tiny wb-muted" }, "探测于 " + WB.fmt.relative(env.at)) : null, h(Btn, {
      size: "sm",
      icon: "plus",
      onClick: addRepoDir,
      children: "添加仓库目录"
    }))
  }, repos.length === 0 ? h(Empty, {
    icon: "git",
    title: "没有可探测的仓库目录",
    hint: "为项目配置 repoPath 后这里会出现分支与改动；当前只探测 Host 的默认工作目录。",
    action: h(Btn, { size: "sm", icon: "folder", children: "选择仓库目录", onClick: addRepoDir })
  }) : h("div", { className: "wb-stack", style: { gap: 10 } }, repos.map(function(repo, index) {
    return collabRepoCard(repo, index, projects);
  }))), h(Panel, {
    title: "PR 与 CI",
    icon: "git",
    sub: github && github.dir ? github.dir : "通过 gh CLI 只读读取",
    badge: github ? h(Badge, { tone: github.status === "ok" ? "ok" : github.status === "unavailable" ? "idle" : "err" }, github.status === "ok" ? github.prs.items.length + github.runs.items.length + " 条" : github.status === "unavailable" ? "不可用" : "失败") : null
  }, !github ? h("span", { className: "wb-tiny wb-muted" }, "读取中…") : github.status !== "ok" ? h(Empty, {
    icon: "git",
    title: github.status === "unavailable" ? "gh CLI 不可用" : "读取失败",
    hint: github.note || "安装 GitHub CLI 并 gh auth login 后可读取 PR 与 CI。"
  }) : h("div", { className: "wb-stack", style: { gap: 10 } }, h("div", { className: "wb-label" }, "PR（" + github.prs.items.length + "）"), github.prs.items.length === 0 ? h("span", { className: "wb-tiny wb-muted" }, "当前仓库没有打开的 PR。") : h("div", null, github.prs.items.slice(0, 6).map(function(pr) {
    return h("div", { key: "pr" + pr.number, className: "wb-item" }, h(Badge, { tone: pr.state === "OPEN" ? "ok" : "idle" }, "#" + pr.number), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, pr.url ? h("a", { className: "wb-link", href: pr.url, target: "_blank", rel: "noreferrer" }, pr.title) : pr.title, pr.draft ? h(Badge, { tone: "idle" }, "草稿") : null), h("div", { className: "wb-item-sub" }, [pr.author, pr.updatedAt ? WB.fmt.relative(pr.updatedAt) : ""].filter(Boolean).join(" · "))));
  })), h(Divider, null), h("div", { className: "wb-label" }, "CI（" + github.runs.items.length + "）"), github.runs.items.length === 0 ? h("span", { className: "wb-tiny wb-muted" }, "没有 CI 运行记录（仓库未配置 Actions 或近期限无运行）。") : h("div", null, github.runs.items.slice(0, 6).map(function(run) {
    const ok = run.conclusion === "success";
    const bad = run.conclusion === "failure" || run.conclusion === "cancelled";
    return h("div", { key: "run" + run.id, className: "wb-item" }, h(Badge, { tone: ok ? "ok" : bad ? "err" : "warn" }, run.conclusion || run.status || "?"), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, run.url ? h("a", { className: "wb-link", href: run.url, target: "_blank", rel: "noreferrer" }, run.workflow || "CI") : run.workflow || "CI"), h("div", { className: "wb-item-sub" }, [run.branch, run.createdAt ? WB.fmt.relative(run.createdAt) : ""].filter(Boolean).join(" · "))));
  })), h("p", { className: "wb-tiny wb-muted", style: { margin: 0, marginTop: 4 } }, github.note || "只读：gh pr list / gh run list。"))), h(Panel, {
    title: "端口占用",
    icon: "plug",
    sub: "lsof -i 的只读快照：本机正在监听的 TCP 端口",
    badge: env.ports ? h(Badge, { tone: env.ports.status === "ok" ? env.ports.ports.length ? "warn" : "idle" : env.ports.status === "unavailable" ? "idle" : "err" }, env.ports.status === "ok" ? env.ports.ports.length + " 个" : env.ports.status === "unavailable" ? "不可用" : "失败") : null
  }, !env.ports ? h("span", { className: "wb-tiny wb-muted" }, "未探测") : env.ports.status !== "ok" ? h(Empty, {
    icon: "plug",
    title: env.ports.status === "unavailable" ? "lsof 不可用" : "读取失败",
    hint: env.ports.reason || "没有拿到端口列表。"
  }) : env.ports.ports.length === 0 ? h(Empty, { icon: "plug", title: "没有监听中的端口", hint: "lsof 返回了空列表。" }) : h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "进程"), h("th", null, "PID"), h("th", null, "地址"), h("th", null, "端口"))), h("tbody", null, env.ports.ports.map(function(row) {
    return h("tr", { key: row.command + ":" + row.address + ":" + row.port }, h("td", { className: "wb-mono" }, row.command), h("td", { className: "wb-mono" }, row.pid), h("td", { className: "wb-mono" }, row.address), h("td", null, h(Badge, { tone: row.port < 1024 ? "warn" : "idle" }, String(row.port))));
  })))), h(Panel, {
    title: "Docker 容器",
    icon: "docker",
    sub: "docker ps 的只读快照，不含 compose 与镜像",
    badge: docker ? h(Badge, { tone: docker.status === "ok" ? "ok" : docker.status === "unavailable" ? "idle" : "err" }, docker.status === "ok" ? running + " 个" : docker.status === "unavailable" ? "不可用" : "异常") : null
  }, !docker ? h("span", { className: "wb-tiny wb-muted" }, "未探测") : docker.status !== "ok" ? h(Empty, {
    icon: "docker",
    title: docker.status === "unavailable" ? "Docker 不可用" : "读取失败",
    hint: docker.reason || "没有拿到容器列表。"
  }) : docker.containers.length === 0 ? h(Empty, { icon: "docker", title: "没有运行中的容器", hint: "docker ps 返回了空列表。" }) : h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "名称"), h("th", null, "镜像"), h("th", null, "状态"))), h("tbody", null, docker.containers.map(function(container) {
    return h("tr", { key: container.name }, h("td", { className: "wb-mono" }, container.name), h("td", { className: "wb-mono wb-ellipsis", style: { maxWidth: 220 } }, container.image), h("td", null, h(Badge, { tone: /Up/i.test(container.state) ? "ok" : "idle" }, container.state)));
  })))), h(Panel, {
    title: "进程 CPU / 内存",
    icon: "zap",
    sub: "ps aux 的只读 Top 12（按 CPU 排序）",
    badge: env.processes ? h(Badge, { tone: env.processes.status === "ok" ? "idle" : "err" }, env.processes.status === "ok" ? env.processes.items.length + " 个" : "不可用") : null
  }, !env.processes ? h("span", { className: "wb-tiny wb-muted" }, "未探测") : env.processes.status !== "ok" ? h(Empty, { icon: "zap", title: "读取失败", hint: env.processes.reason || "ps 不可用。" }) : h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "PID"), h("th", null, "CPU"), h("th", null, "MEM"), h("th", null, "命令"))), h("tbody", null, env.processes.items.map(function(row) {
    return h("tr", { key: row.pid + row.command }, h("td", { className: "wb-mono" }, row.pid), h("td", null, h(Badge, { tone: row.cpu >= 50 ? "warn" : "idle" }, row.cpu.toFixed(1) + "%")), h("td", null, h(Badge, { tone: "idle" }, row.mem.toFixed(1) + "%")), h("td", { className: "wb-mono wb-ellipsis", style: { maxWidth: 260 } }, row.command));
  })))), h(Panel, { title: "运行范围", icon: "info" }, h("p", { className: "wb-tiny wb-muted" }, "项目启动只执行已配置目录中的启动项，日志在本次宿主运行期间保留；停用插件会停止由本插件启动的进程。Git、PR/CI、容器与端口仍为只读探测。"))) : null);
}
WB.pages.collab = CollabPage;

// src/client/features/operations/BackgroundHistoryPanel.tsx
var React38 = __toESM(require("react"), 1);
function BackgroundHistoryPanel() {
  const [archived, setArchived] = React38.useState(false), [offset, setOffset] = React38.useState(0);
  const [page, setPage] = React38.useState(null), [selected, setSelected] = React38.useState([]);
  const [busy, setBusy] = React38.useState(false), [error, setError] = React38.useState(""), [result, setResult] = React38.useState("");
  const requestSeq = React38.useRef(0);
  async function read(showArchived = archived, from = offset) {
    const seq2 = ++requestSeq.current;
    setError("");
    try {
      const value = await WB.rpc("workbench/backgroundHistory", { request: { archived: showArchived, offset: from } });
      if (!value || !Array.isArray(value.items) || typeof value.supported !== "boolean") throw new Error("宿主返回的会话列表格式不正确");
      if (seq2 === requestSeq.current) {
        setPage(value);
        setSelected([]);
      }
    } catch (e) {
      if (seq2 === requestSeq.current) setError(e.message);
    }
  }
  React38.useEffect(() => {
    void read();
    return () => {
      requestSeq.current++;
    };
  }, [archived, offset]);
  async function archive() {
    if (busy || !selected.length) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const value = await WB.rpc("workbench/archiveBackgroundHistory", { ids: selected }, AbortSignal.timeout(12e4));
      setResult(`已归档 ${value.archived}，跳过 ${value.skipped}，失败 ${value.failed}`);
      const failures = value.results.filter((row) => row.status === "failed");
      if (failures.length) setError(failures.map((row) => row.reason).join("；"));
      const reasons = [...new Set(value.results.filter((row) => row.status === "skipped" && row.reason).map((row) => row.reason))];
      if (reasons.length) setResult((previous) => previous + "；" + reasons.join("；"));
      await read();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const rows = Array.isArray(page?.items) ? page.items : [];
  return /* @__PURE__ */ React38.createElement("details", null, /* @__PURE__ */ React38.createElement("summary", null, "管理后台会话历史"), /* @__PURE__ */ React38.createElement(Panel, { title: "后台会话历史", sub: "保留当前复用会话，收起已停用的旧批次记录" }, /* @__PURE__ */ React38.createElement("p", { className: "wb-tiny wb-muted" }, page?.note), /* @__PURE__ */ React38.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React38.createElement(Btn, { disabled: busy, onClick: () => {
    setArchived(!archived);
    setOffset(0);
    setSelected([]);
  } }, archived ? "查看未归档会话" : "查看已归档会话"), /* @__PURE__ */ React38.createElement(Btn, { disabled: busy, onClick: () => read() }, "刷新会话历史"), !archived && /* @__PURE__ */ React38.createElement(Btn, { disabled: busy || !page?.supported || !rows.some((row) => !row.active && !row.protected), onClick: () => setSelected(rows.filter((row) => !row.active && !row.protected && !row.archived).map((row) => row.id)) }, "选择本页旧会话"), !archived && /* @__PURE__ */ React38.createElement(Btn, { disabled: busy || !page?.supported || !selected.length, onClick: archive }, busy ? "正在归档…" : `归档选中会话（${selected.length}）`)), error && /* @__PURE__ */ React38.createElement("p", { role: "alert" }, error), result && /* @__PURE__ */ React38.createElement("p", { role: "status" }, result), rows.map((row) => /* @__PURE__ */ React38.createElement("article", { className: "wb-reply-item", key: row.id }, /* @__PURE__ */ React38.createElement("label", { className: "wb-row" }, !archived && /* @__PURE__ */ React38.createElement("input", { type: "checkbox", "aria-label": `选择后台会话 ${row.id.replace(/^session-/, "").slice(0, 8)}`, disabled: busy || !page?.supported || row.active || row.protected, checked: selected.includes(row.id), onChange: (e) => setSelected((previous) => e.target.checked ? [...previous, row.id] : previous.filter((id) => id !== row.id)) }), /* @__PURE__ */ React38.createElement("span", null, "后台会话 · ", row.id.replace(/^session-/, "").slice(0, 8), " · ", row.active ? "正在复用" : row.protected ? "人工会话保护" : row.archived ? "已归档" : "旧记录")), /* @__PURE__ */ React38.createElement(Btn, { size: "sm", onClick: () => {
    if (!WB.openSessionById(row.id)) setError("当前宿主无法打开会话，请使用原生历史入口");
  } }, "打开原生日志"))), page && /* @__PURE__ */ React38.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React38.createElement(Btn, { disabled: busy || offset === 0, onClick: () => setOffset(Math.max(0, offset - 20)) }, "上一页会话"), /* @__PURE__ */ React38.createElement("span", null, page.total, " 个 · 可归档 ", page.eligible, " 个"), /* @__PURE__ */ React38.createElement(Btn, { disabled: busy || offset + 20 >= page.total, onClick: () => setOffset(offset + 20) }, "下一页会话"))));
}

// src/client/features/operations/OperationsPanel.tsx
var React39 = __toESM(require("react"), 1);
function OperationsPanel({ revision }) {
  const [evaluating, setEvaluating] = React39.useState(false);
  const [status, setStatus] = React39.useState(null), [error, setError] = React39.useState(""), [calls, setCalls] = React39.useState(""), [tokens, setTokens] = React39.useState(""), [history, setHistory] = React39.useState(null), [offset, setOffset] = React39.useState(0), [selected, setSelected] = React39.useState(null), [busy, setBusy] = React39.useState(false);
  const readGeneration = React39.useRef(0), draftGeneration = React39.useRef(0);
  const read = () => {
    const generation = ++readGeneration.current;
    return WB.rpc("workbench/operationsStatus", {}, AbortSignal.timeout(15e3)).then((value) => {
      if (generation !== readGeneration.current) return;
      setStatus(value);
      if (draftGeneration.current === 0) {
        setCalls(String(value?.policy?.dailyCallLimit || 0));
        setTokens(String(value?.policy?.dailyTokenLimit || 0));
      }
    }).catch((e) => {
      if (generation === readGeneration.current) setError(e.message);
    });
  };
  React39.useEffect(() => {
    void read();
    return () => {
      readGeneration.current += 1;
    };
  }, [revision]);
  async function saveBudget() {
    const draft = draftGeneration.current;
    try {
      await WB.actions.saveSettings({ aiPolicy: { dailyCallLimit: Number(calls), dailyTokenLimit: Number(tokens) } });
      if (draftGeneration.current === draft) draftGeneration.current = 0;
      await read();
    } catch (e) {
      setError(String(e.message));
    }
  }
  const loadHistory = (from = 0) => WB.rpc("workbench/changesPage", { request: { offset: from, limit: 10 } }).then((value) => {
    setHistory(value);
    setOffset(from);
  }).catch((e) => setError(e.message));
  async function undo() {
    if (!selected || busy)
      return;
    setBusy(true);
    try {
      await WB.rpc("workbench/undoChange", { id: selected.id });
      setSelected(null);
      await loadHistory(offset);
      await WB.actions.reload();
    } catch (e) {
      setError(String(e.message));
    } finally {
      setBusy(false);
    }
  }
  const reviews = status?.qualityReviews || [], counts = reviews.reduce((acc, row) => ({ ...acc, [row.verdict]: (acc[row.verdict] || 0) + 1 }), {});
  return /* @__PURE__ */ React39.createElement(Panel, { title: "运行与质量", sub: "后台用量、积压和业务变更；不把执行成功当作识别正确" }, error && /* @__PURE__ */ React39.createElement("p", { role: "alert" }, error), /* @__PURE__ */ React39.createElement(Btn, { size: "sm", onClick: read }, "读取最新状态"), status && /* @__PURE__ */ React39.createElement("p", null, "待分析 ", status.queue?.pending || 0, " · 失败 ", status.queue?.failed || 0, " · 最老待分析 ", status.queue?.oldestPendingMinutes || 0, " 分钟 · 数据 ", (status.storageBytes / 1048576).toFixed(1), " MB"), /* @__PURE__ */ React39.createElement("p", null, "今日后台调用 ", status?.usage?.calls || 0, " 次；收到用量的步骤 ", status?.usage?.reportedSteps || 0, " 个"), /* @__PURE__ */ React39.createElement("p", { className: "wb-tiny wb-muted" }, status?.usage?.reportedSteps ? `非缓存输入 ${status.usage.inputTokens} · 输出 ${status.usage.outputTokens} · 缓存读取 ${status.usage.cacheReadTokens} · 缓存写入 ${status.usage.cacheWriteTokens}` : "模型尚未回传 Token 用量，不能按 0 用量计算费用。", " 同一会话历史仍可能计费。"), /* @__PURE__ */ React39.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React39.createElement("label", null, "每日后台调用上限", /* @__PURE__ */ React39.createElement(Input, { type: "number", min: "0", value: calls, onChange: (e) => {
    draftGeneration.current += 1;
    setCalls(e.target.value);
  } })), /* @__PURE__ */ React39.createElement("label", null, "每日已知 Token 上限", /* @__PURE__ */ React39.createElement(Input, { type: "number", min: "0", value: tokens, onChange: (e) => {
    draftGeneration.current += 1;
    setTokens(e.target.value);
  } })), /* @__PURE__ */ React39.createElement(Btn, { onClick: saveBudget }, "保存预算")), /* @__PURE__ */ React39.createElement("p", { className: "wb-tiny wb-muted" }, "0 表示不限。达到上限后暂停新的后台请求；Token 上限按已回传值判断，单次请求可能越过阈值。用量缺失时请使用调用次数上限。"), /* @__PURE__ */ React39.createElement("p", null, "人工复核 ", reviews.length, " 条 · 正确 ", counts.correct || 0, " · 误建 ", counts.false_positive || 0, " · 漏办 ", counts.missed_action || 0, " · 日期错误 ", counts.wrong_date || 0, " · 完成误判 ", counts.wrong_completion || 0, " · 关联错误 ", counts.wrong_link || 0), /* @__PURE__ */ React39.createElement(Btn, { size: "sm", disabled: evaluating, onClick: async () => {
    setEvaluating(true);
    setError("");
    try {
      const r = await WB.rpc("workbench/evaluateRecognition", {}, AbortSignal.timeout(24e4));
      setStatus((previous) => ({ ...previous, qualityEvaluation: r }));
    } catch (e) {
      setError(String(e.message));
    } finally {
      setEvaluating(false);
    }
  } }, evaluating ? "正在运行标注样本…" : "运行 10 条识别质量样本"), /* @__PURE__ */ React39.createElement("p", { className: "wb-tiny wb-muted" }, "使用已有模型，仅分析合成样本，不创建业务事项。不是实际业务总体准确率。"), status?.qualityEvaluation && /* @__PURE__ */ React39.createElement("p", null, "最近样本：返回 ", status.qualityEvaluation.report.returned, "/", status.qualityEvaluation.report.samples, " · 完全符合标签 ", status.qualityEvaluation.report.exact, " · 日期错误 ", status.qualityEvaluation.report.wrongDate, " · 完成误判 ", status.qualityEvaluation.report.wrongCompletion), /* @__PURE__ */ React39.createElement(Btn, { size: "sm", onClick: () => loadHistory(0) }, "查看变更记录"), history && /* @__PURE__ */ React39.createElement("div", null, (history.items || []).map((row) => /* @__PURE__ */ React39.createElement("article", { className: "wb-reply-item", key: row.id }, /* @__PURE__ */ React39.createElement("strong", null, row.title), /* @__PURE__ */ React39.createElement("p", { className: "wb-tiny wb-muted" }, row.actor === "ai" ? "AI" : "人工/工具", " · ", row.at, " · ", row.reason), /* @__PURE__ */ React39.createElement(Btn, { size: "sm", onClick: () => setSelected(row) }, "查看前后变化"))), /* @__PURE__ */ React39.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React39.createElement(Btn, { disabled: offset === 0, onClick: () => loadHistory(Math.max(0, offset - 10)) }, "上一页"), /* @__PURE__ */ React39.createElement("span", null, history.total, " 条"), /* @__PURE__ */ React39.createElement(Btn, { disabled: offset + 10 >= history.total, onClick: () => loadHistory(offset + 10) }, "下一页"))), /* @__PURE__ */ React39.createElement(Modal, { open: !!selected, title: "业务变更", onClose: () => setSelected(null), footer: /* @__PURE__ */ React39.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React39.createElement(Btn, { onClick: () => setSelected(null) }, "关闭"), /* @__PURE__ */ React39.createElement(Btn, { disabled: busy || !!selected?.revertedAt || !selected?.after, onClick: undo }, "撤销这次变更")) }, /* @__PURE__ */ React39.createElement("p", null, "撤销前会检查是否有后续修改。撤销新建待办会取消该事项并保留证据。"), /* @__PURE__ */ React39.createElement("details", { open: true }, /* @__PURE__ */ React39.createElement("summary", null, "修改前"), /* @__PURE__ */ React39.createElement("pre", { className: "wb-code" }, JSON.stringify(selected?.before, null, 2))), /* @__PURE__ */ React39.createElement("details", { open: true }, /* @__PURE__ */ React39.createElement("summary", null, "修改后"), /* @__PURE__ */ React39.createElement("pre", { className: "wb-code" }, JSON.stringify(selected?.after, null, 2)))));
}

// src/client/features/operations/ArchiveBrowser.tsx
var React40 = __toESM(require("react"), 1);
function ArchiveBrowser() {
  const [collection, setCollection] = React40.useState("tasks"), [archived, setArchived] = React40.useState(false), [result, setResult] = React40.useState(null), [offset, setOffset] = React40.useState(0), [error, setError] = React40.useState("");
  const load = (nextCollection = collection, nextArchived = archived, from = 0) => {
    setCollection(nextCollection);
    setArchived(nextArchived);
    setOffset(from);
    WB.rpc("workbench/dataPage", { request: { collection: nextCollection, archived: nextArchived, offset: from, limit: 10 } }).then(setResult).catch((e) => setError(e.message));
  };
  return /* @__PURE__ */ React40.createElement(Panel, { title: "记录归档", sub: "归档仅隐藏已处理记录，保留 ID 和关联，可随时恢复" }, /* @__PURE__ */ React40.createElement("select", { className: "wb-select", "aria-label": "归档集合", value: collection, onChange: (e) => load(e.target.value) }, [["tasks", "待办"], ["replies", "回复"], ["radar", "资讯"], ["knowledge", "知识"]].map(([value, label]) => /* @__PURE__ */ React40.createElement("option", { key: value, value }, label))), /* @__PURE__ */ React40.createElement(Btn, { onClick: () => load(collection, !archived) }, archived ? "查看未归档" : "查看已归档"), /* @__PURE__ */ React40.createElement(Btn, { onClick: () => load() }, "加载"), error && /* @__PURE__ */ React40.createElement("p", { role: "alert" }, error), (result?.items || []).map((row) => /* @__PURE__ */ React40.createElement("div", { className: "wb-reply-item", key: row.id }, /* @__PURE__ */ React40.createElement("span", null, row.title || row.snippet || row.id), /* @__PURE__ */ React40.createElement(Btn, { size: "sm", onClick: () => WB.rpc("workbench/archiveRecord", { collection, id: row.id, archived: !archived }).then(() => {
    load(collection, archived, offset);
    return WB.actions.reload();
  }).catch((e) => setError(e.message)) }, archived ? "恢复显示" : "归档"))), result && /* @__PURE__ */ React40.createElement("div", { className: "wb-row" }, /* @__PURE__ */ React40.createElement(Btn, { disabled: !offset, onClick: () => load(collection, archived, Math.max(0, offset - 10)) }, "上一页"), /* @__PURE__ */ React40.createElement("span", null, result.total, " 条"), /* @__PURE__ */ React40.createElement(Btn, { disabled: offset + 10 >= result.total, onClick: () => load(collection, archived, offset + 10) }, "下一页")));
}

// src/client/components/MigrationImportPanel.tsx
var React41 = __toESM(require("react"), 1);
function MigrationImportPanel() {
  const [validated, setValidated] = React41.useState(false);
  const [json, setJson] = React41.useState("");
  const [mode, setMode] = React41.useState("merge");
  const [paths, setPaths] = React41.useState({});
  const [preview, setPreview] = React41.useState(null);
  const [error, setError] = React41.useState("");
  const [busy, setBusy] = React41.useState(false);
  async function inspect() {
    setBusy(true);
    setError("");
    try {
      const payload = JSON.parse(json);
      setPreview(await WB.actions.importMigration(payload, mode, true, paths));
      setValidated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  async function apply3() {
    if (!preview || !validated) return;
    if (mode === "replace" && !window.confirm("替换当前业务数据？提交前会先备份，原生会话和凭据不变。")) return;
    setBusy(true);
    setError("");
    try {
      const result = await WB.actions.importMigration(JSON.parse(json), mode, false, paths);
      await WB.actions.reload();
      WB.toast("导入完成：" + result.applied + " 条", "ok");
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ React41.createElement("section", { className: "wb-stack", "aria-label": "迁移导入" }, /* @__PURE__ */ React41.createElement("label", { className: "wb-label" }, "导入迁移包", /* @__PURE__ */ React41.createElement("textarea", { className: "wb-textarea", rows: 5, value: json, placeholder: "在这里粘贴导出的迁移包 JSON", onChange: (e) => {
    setJson(e.target.value);
    setPreview(null);
    setPaths({});
  } })), /* @__PURE__ */ React41.createElement("label", { className: "wb-label" }, "或选择迁移文件", /* @__PURE__ */ React41.createElement("input", { type: "file", accept: "application/json,.json", onChange: async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("文件超过10MB");
      return;
    }
    setJson(await file.text());
    setPreview(null);
    setPaths({});
  } })), /* @__PURE__ */ React41.createElement("div", { className: "wb-reply-actions" }, /* @__PURE__ */ React41.createElement("label", null, "导入方式 ", /* @__PURE__ */ React41.createElement("select", { className: "wb-select", value: mode, onChange: (e) => {
    setMode(e.target.value);
    setPreview(null);
  } }, /* @__PURE__ */ React41.createElement("option", { value: "merge" }, "合并：同 ID 保留当前数据"), /* @__PURE__ */ React41.createElement("option", { value: "replace" }, "替换包内业务集合"))), /* @__PURE__ */ React41.createElement("button", { type: "button", className: "wb-chip", disabled: busy || !json.trim(), onClick: inspect }, busy ? "处理中…" : "预检迁移包"), /* @__PURE__ */ React41.createElement("button", { type: "button", className: "wb-chip", disabled: busy || !preview || !validated, onClick: apply3 }, "执行导入")), error && /* @__PURE__ */ React41.createElement("p", { role: "alert" }, error), preview && /* @__PURE__ */ React41.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React41.createElement("strong", null, validated ? "预检通过" : "目录已修改，请重新预检", " · ", preview.incomingTotal, " 条 · 尚未写入"), /* @__PURE__ */ React41.createElement("div", null, Object.entries(preview.countsByColumn).map(([key2, count]) => /* @__PURE__ */ React41.createElement("span", { key: key2, style: { display: "inline-block", marginRight: 12 } }, key2, "：", count, "（同 ID ", preview.conflictsByColumn[key2] || 0, "）"))), preview.warnings?.map((w) => /* @__PURE__ */ React41.createElement("p", { key: w }, w)), preview.mappedProjects.filter((p) => p.from).map((project) => /* @__PURE__ */ React41.createElement("label", { className: "wb-label", key: project.id }, project.name, " · ", project.from, /* @__PURE__ */ React41.createElement("input", { className: "wb-input", "aria-label": "目标目录 " + project.name, value: paths[project.from] ?? project.to, onChange: (e) => {
    setPaths({ ...paths, [project.from]: e.target.value });
    setValidated(false);
  } })))), /* @__PURE__ */ React41.createElement("p", { className: "wb-tiny wb-muted" }, "修改目录映射后重新预检；迁移包含待办、待回复、消息证据和队列。原生会话与凭据单独管理。"));
}

// src/client/features/settings/settings.ts
var React42 = __toESM(require("react"), 1);
function SettingsRow(props) {
  return h("div", {
    className: "wb-item",
    style: { alignItems: props.alignTop ? "flex-start" : "center" }
  }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, props.title, props.badge || null), props.hint ? h("div", { className: "wb-item-sub" }, props.hint) : null), props.control ? h("div", { style: { flex: "none" } }, props.control) : null);
}
function SettingsPage() {
  const state = useStore();
  const data = state.data;
  const [diag, setDiag] = React42.useState(null);
  const [diagError, setDiagError] = React42.useState(null);
  const [diagBusy, setDiagBusy] = React42.useState(false);
  const [topicDraft, setTopicDraft] = React42.useState("");
  const [confirmReset, setConfirmReset] = React42.useState(null);
  const [projectName, setProjectName] = React42.useState("");
  const [projectPath, setProjectPath] = React42.useState("");
  const [picking, setPicking] = React42.useState(false);
  const [projectEdit, setProjectEdit] = React42.useState(null);
  const [backups, setBackups] = React42.useState([]);
  const [migrationJson, setMigrationJson] = React42.useState("");
  const [migrationMode, setMigrationMode] = React42.useState("replace");
  const [automation, setAutomation] = React42.useState(null);
  const [automationRunning, setAutomationRunning] = React42.useState(false);
  const [mentionDraft, setMentionDraft] = React42.useState("");
  const [feedLabel, setFeedLabel] = React42.useState("");
  const [feedUrl, setFeedUrl] = React42.useState("");
  const [feedTopics, setFeedTopics] = React42.useState("");
  const settings = data && data.settings || { topics: [], staleHours: 24, showCompleted: false, defaultProjectId: null };
  const connectors = data && data.connectors || [];
  const projects = data && data.projects || [];
  const feeds = settings && settings.feeds || [];
  function runDiagnostics() {
    setDiagBusy(true);
    setDiagError(null);
    WB.actions.diagnostics().then(function(value) {
      setDiag(value);
      setDiagBusy(false);
    }).catch(function(e) {
      setDiagError(String(e && e.message || e));
      setDiagBusy(false);
    });
  }
  React42.useEffect(function() {
    runDiagnostics();
    WB.actions.backups().then(function(result) {
      setBackups(result.backups || []);
    }).catch(function() {
    });
    WB.actions.automationStatus().then(function(status) {
      setAutomation(status);
    }).catch(function() {
    });
  }, []);
  React42.useEffect(() => {
    if (data?.lastAutomation) setAutomation((current) => current ? { ...current, lastAutomation: data.lastAutomation } : current);
  }, [data?.lastAutomation]);
  function patchSettings(patch) {
    WB.actions.saveSettings(patch).catch(function() {
    });
  }
  function addTopic() {
    const value = topicDraft.trim();
    if (!value)
      return;
    if (settings.topics.indexOf(value) >= 0) {
      setTopicDraft("");
      return;
    }
    patchSettings({ topics: settings.topics.concat([value]) });
    setTopicDraft("");
  }
  function removeTopic(topic) {
    patchSettings({
      topics: settings.topics.filter(function(item) {
        return item !== topic;
      })
    });
  }
  function pickProjectPath() {
    setPicking(true);
    WB.pickDirectory().then(function(dir) {
      setPicking(false);
      if (!dir) {
        WB.toast("没有选择目录（或当前环境不提供目录选择器）", "info");
        return;
      }
      setProjectPath(dir);
      setProjectName(function(previous) {
        if (previous.trim())
          return previous;
        const parts = String(dir).split(/[\\/]/).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "项目";
      });
    });
  }
  function addProject() {
    const name2 = projectName.trim();
    const repoPath = projectPath.trim();
    if (!repoPath) {
      WB.toast("请先选择或填写仓库目录", "err");
      return;
    }
    WB.actions.saveProject({ name: name2 || repoPath, repoPath }).then(function() {
      setProjectName("");
      setProjectPath("");
    }).catch(function() {
    });
  }
  function addFeed() {
    WB.actions.addFeed({
      label: feedLabel,
      url: feedUrl,
      topics: feedTopics.split(/[,，\s]+/).map(function(topic) {
        return topic.trim();
      }).filter(Boolean)
    }).then(function() {
      setFeedLabel("");
      setFeedUrl("");
      setFeedTopics("");
    }).catch(function() {
    });
  }
  function exportJson() {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "dev-workbench-" + WB.fmt.date((/* @__PURE__ */ new Date()).toISOString()) + ".json";
      anchor.click();
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 2e3);
      WB.toast("已导出快照 JSON", "ok");
    } catch (e) {
      WB.toast("导出失败：" + String(e && e.message || e), "err");
    }
  }
  return h("div", null, h(PageHead, {
    icon: "plug",
    title: WB.t("settings.title", "连接与设置"),
    sub: "连接器状态、关注主题与数据落盘位置；改动的都是 Host 侧持久化配置。",
    actions: h(Btn, {
      icon: "refresh",
      size: "sm",
      onClick: function() {
        WB.actions.reload().catch(function() {
        });
        runDiagnostics();
      },
      children: "重新读取"
    })
  }), h(BackgroundHistoryPanel), h(OperationsPanel, { revision: data?.revision }), h(ArchiveBrowser), h("div", { className: "wb-grid wb-settings-grid", style: { gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)" } }, h("div", { className: "wb-stack", style: { gap: 14 } }, h(Panel, {
    title: "连接器",
    sub: "一个 Provider 一种能力；未接入的能力保持“未配置”而不是假装可用",
    icon: "plug"
  }, connectors.length === 0 ? h(Empty, {
    icon: "plug",
    title: "还没有连接器",
    hint: "首版只登记真实存在的能力：本地数据、Host 运行时与命令探测。企业系统（云之家、Git、Docker）需要先完成能力发现再显示为“已连接”。"
  }) : h("div", null, connectors.map(function(connector) {
    const meta = WB.connectorState(connector.authState);
    return h("div", { key: connector.id, className: "wb-item", style: { alignItems: "flex-start" } }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, connector.label || connector.type, h(Badge, { tone: meta.tone }, meta.label)), h("div", { className: "wb-item-sub" }, (connector.capabilities || []).length > 0 ? connector.capabilities.map(function(capability) {
      return h(Chip, { key: capability, children: capability });
    }) : h("span", null, "无已声明能力")), connector.note ? h("div", { className: "wb-item-sub" }, connector.note) : null), h("div", { className: "wb-tiny wb-muted", style: { flex: "none" } }, connector.updatedAt ? WB.fmt.relative(connector.updatedAt) : "—"));
  }))), h(Panel, {
    title: "权限分级",
    sub: "插件按 L0–L3 决定一个动作在本地执行、只读、还是要人工审批",
    icon: "lock"
  }, h("table", { className: "wb-table" }, h("thead", null, h("tr", null, h("th", null, "等级"), h("th", null, "操作"), h("th", null, "策略"))), h("tbody", null, [
    ["L0 本地计算", "JSON/正则/Cron/编解码", "浏览器内完成，不发模型、不出网"],
    ["L1 授权只读", "读文件、查消息、看仓库", "连接器授权 + 最小作用域"],
    ["L2 受控修改", "建待办、写本地文件、跑测试", "展示具体操作，必要时审批"],
    ["L3 高风险", "推送代码、发消息、写数据库", "逐次审批 + 命令绑定 + 审计"]
  ].map(function(row) {
    return h("tr", { key: row[0] }, h("td", { style: { whiteSpace: "nowrap", fontWeight: 600 } }, row[0]), h("td", null, row[1]), h("td", { className: "wb-muted" }, row[2]));
  })))), h(Panel, {
    title: "运行时诊断",
    sub: "来自 Host 的真实读数，不是前端估算",
    icon: "database",
    actions: h(Btn, {
      size: "sm",
      icon: "refresh",
      disabled: diagBusy,
      onClick: runDiagnostics,
      children: diagBusy ? "读取中…" : "刷新"
    })
  }, diagError ? h("div", { role: "alert", style: { color: T.err, fontSize: 12 } }, diagError) : !diag ? h("div", { className: "wb-row", style: { padding: "10px 0" } }, h(Spinner, null), h("span", { className: "wb-tiny wb-muted" }, "读取中…")) : h("div", { className: "wb-stack", style: { gap: 6 } }, [
    ["数据文件", diag.dataPath],
    ["文件大小", WB.fmt.bytes(diag.dataBytes)],
    ["平台 / Node", diag.platform + " / " + diag.nodeVersion],
    [
      "记录数",
      "待办 " + diag.counts.tasks + " · 执行 " + diag.counts.runs + " · 知识 " + diag.counts.knowledge + " · 雷达 " + diag.counts.radar + " · 来源 " + diag.counts.sources
    ],
    ["Host 时间", WB.fmt.datetime(diag.hostTime)]
  ].map(function(row) {
    return h("div", { key: row[0], className: "wb-row", style: { alignItems: "flex-start", gap: 10 } }, h("span", { className: "wb-tiny wb-muted", style: { width: 86, flex: "none" } }, row[0]), h("span", {
      className: "wb-mono",
      style: { overflowWrap: "anywhere", minWidth: 0 }
    }, String(row[1])));
  }), diag.toolNames && diag.toolNames.length > 0 ? h("div", { style: { marginTop: 6 } }, h("div", { className: "wb-label", style: { marginBottom: 4 } }, "已注册的 Agent 工具"), h("div", { className: "wb-row wb-row--wrap" }, diag.toolNames.map(function(name2) {
    return h(Chip, { key: name2, icon: "command", children: name2 });
  }))) : null))), h("div", { className: "wb-stack", style: { gap: 14 } }, h(Panel, {
    title: "项目",
    sub: "仓库目录决定「研发协作」探测哪些 Git 仓库",
    icon: "folder",
    badge: projects.length ? h(Badge, { tone: "idle" }, projects.length + " 个") : null
  }, projects.length === 0 ? h(Empty, {
    icon: "folder",
    title: "还没有项目",
    hint: "添加一个仓库目录后，研发协作会自动显示它的分支与改动；不添加则只探测 Host 的默认工作目录。"
  }) : h("div", null, projects.map(function(project) {
    const count = (data && data.tasks || []).filter(function(task) {
      return task.projectId === project.id;
    }).length;
    return h("div", { key: project.id, className: "wb-item", style: { alignItems: "flex-start" } }, h(Icon, { name: "folder", size: 14 }), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, project.name), h("div", { className: "wb-item-sub wb-mono wb-ellipsis" }, project.repoPath || "未配置仓库目录"), h("div", { className: "wb-item-sub" }, count + " 项待办")), h(IconBtn, {
      name: "edit",
      label: "编辑项目名称与目录",
      onClick: function() {
        setProjectEdit({ id: project.id, name: project.name, repoPath: project.repoPath || "" });
      }
    }), h(IconBtn, {
      name: "trash",
      label: "删除项目",
      onClick: function() {
        if (!window.confirm("删除项目「" + project.name + "」？关联任务会解除项目归属，任务本身保留。"))
          return;
        WB.actions.deleteProject(project.id).catch(function() {
        });
      }
    }));
  })), h("div", { className: "wb-stack", style: { gap: 8, marginTop: projects.length ? 10 : 0 } }, h("div", { className: "wb-row" }, h(Input, {
    value: projectName,
    placeholder: "项目名称",
    onChange: function(event) {
      setProjectName(event.target.value);
    }
  }), h(Btn, {
    size: "sm",
    icon: "folder",
    disabled: picking,
    onClick: pickProjectPath,
    children: picking ? "选择中…" : "选择目录"
  })), h(Input, {
    value: projectPath,
    placeholder: "仓库绝对路径，如 /Users/me/code/gateway",
    onChange: function(event) {
      setProjectPath(event.target.value);
    }
  }), h("div", { className: "wb-row" }, h("div", { className: "wb-spacer" }), h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "plus",
    disabled: !projectPath.trim(),
    onClick: addProject,
    children: "添加项目"
  })))), h(Panel, {
    title: "资讯源",
    sub: "可选 RSS / Atom 来源；留空时使用宿主联网搜索按主题发现资讯",
    icon: "radar",
    badge: feeds.length ? h(Badge, { tone: "idle" }, feeds.length + " 个") : null
  }, feeds.length === 0 ? h(Empty, {
    icon: "radar",
    title: "还没有配置资讯源",
    hint: "无需填写地址。在关注主题中设置内容，点「抓取资讯」或让助手获取资讯即可；RSS / Atom 可按需添加。"
  }) : h("div", null, feeds.map(function(feed) {
    return h("div", { key: feed.id, className: "wb-item", style: { alignItems: "flex-start" } }, h(Icon, { name: "radar", size: 14 }), h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, feed.label), h("div", { className: "wb-item-sub wb-mono wb-ellipsis" }, feed.url), feed.topics && feed.topics.length ? h("div", { className: "wb-item-sub" }, feed.topics.map(function(topic) {
      return h(Chip, { key: topic, children: topic });
    })) : null), h(IconBtn, {
      name: "trash",
      label: "移除资讯源",
      onClick: function() {
        WB.actions.deleteFeed(feed.id).catch(function() {
        });
      }
    }));
  })), h("div", { className: "wb-stack", style: { gap: 8, marginTop: feeds.length ? 10 : 0 } }, h(Input, {
    value: feedLabel,
    placeholder: "名称，如 Hacker News · LLM（可留空，默认取域名）",
    onChange: function(event) {
      setFeedLabel(event.target.value);
    }
  }), h(Input, {
    value: feedUrl,
    placeholder: "RSS/Atom 地址，如 https://hnrss.org/newest?q=LLM",
    onChange: function(event) {
      setFeedUrl(event.target.value);
    }
  }), h(Input, {
    value: feedTopics,
    placeholder: "归入主题，逗号分隔，如 LLM, Agent",
    onChange: function(event) {
      setFeedTopics(event.target.value);
    }
  }), h("div", { className: "wb-row" }, h("div", { className: "wb-spacer" }), h(Btn, {
    size: "sm",
    kind: "primary",
    icon: "plus",
    disabled: !feedUrl.trim(),
    onClick: addFeed,
    children: "添加资讯源"
  })))), h(Panel, { title: "关注主题", sub: "技术雷达按这些主题过滤与推荐", icon: "radar" }, h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 10 } }, settings.topics.length === 0 ? h("span", { className: "wb-tiny wb-muted" }, "还没有关注主题") : settings.topics.map(function(topic) {
    return h(Chip, {
      key: topic,
      active: true,
      children: topic,
      onRemove: function() {
        removeTopic(topic);
      }
    });
  })), h("div", { className: "wb-row" }, h(Input, {
    value: topicDraft,
    placeholder: "新增主题，如 RAG / 数据库",
    onChange: function(event) {
      setTopicDraft(event.target.value);
    },
    onKeyDown: function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addTopic();
      }
    }
  }), h(Btn, {
    icon: "plus",
    size: "sm",
    onClick: addTopic,
    disabled: !topicDraft.trim(),
    children: "添加"
  }))), h(Panel, {
    title: "自动化",
    sub: "按配置采集消息、联网发现资讯；开启 AI 后进行识别和摘要",
    icon: "zap",
    badge: automation ? h(Badge, { tone: automation.enabled ? "ok" : "idle" }, automation.enabled ? "已开启" : "已关闭") : null,
    actions: h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "play",
      disabled: !automation || !automation.enabled || automationRunning,
      onClick: function() {
        setAutomationRunning(true);
        WB.actions.automationRun().then(function(result) {
          WB.toast(result.ran ? (result.status === "ok" ? "本轮完成：" : "本轮部分失败：") + (result.note || "") : result.note || "未执行", result.ran && result.status === "ok" ? "ok" : "info");
          return WB.actions.reload();
        }).then(function() {
          return WB.actions.automationStatus();
        }).then(function(status) {
          setAutomation(status);
        }).catch(function(error) {
          WB.toast("自动化失败：" + String(error?.message || error), "err");
        }).finally(() => setAutomationRunning(false));
      },
      children: automationRunning ? "正在执行…" : "立即执行"
    })
  }, h("div", null, h(SettingsRow, {
    title: "开启后台自动化",
    hint: automation && automation.lastAutomation ? "上次运行 " + WB.fmt.relative(automation.lastAutomation.at) + "（" + automation.lastAutomation.status + "）：" + (automation.lastAutomation.note || "") : "仅在 DSH 进程运行期间生效；退出/休眠后恢复会按到期补跑一次",
    control: h(Toggle, {
      checked: !!(automation && automation.enabled),
      onChange: function(next) {
        patchSettings({ automation: { enabled: next } });
        setAutomation(Object.assign({}, automation, { enabled: next }));
      }
    })
  }), h(SettingsRow, {
    title: "资讯等自动化间隔",
    hint: "用于资讯等完整采集；云之家独立按北京时间09:00–21:00每5分钟同步，页面每12秒读取本地状态。",
    control: h(Select, {
      value: String(automation && automation.intervalMinutes || 60),
      options: [
        { value: "5", label: "5 分钟" },
        { value: "15", label: "15 分钟" },
        { value: "30", label: "30 分钟" },
        { value: "60", label: "1 小时" },
        { value: "180", label: "3 小时" },
        { value: "720", label: "12 小时" }
      ],
      onChange: function(event) {
        patchSettings({ automation: { intervalMinutes: Number(event.target.value) } });
        setAutomation(Object.assign({}, automation, { intervalMinutes: Number(event.target.value) }));
      }
    })
  }), h(SettingsRow, {
    title: "资讯采集",
    hint: "未配置 RSS 时按关注主题联网发现",
    control: h(Toggle, {
      checked: !(automation && automation.radar === false),
      onChange: function(next) {
        patchSettings({ automation: { radar: next } });
        setAutomation(Object.assign({}, automation, { radar: next }));
      }
    })
  }), h(SettingsRow, {
    title: "AI 识别新消息（结构化提炼）",
    hint: "同账号复用后台会话，多条消息一次识别；固定规则首次发送，后续发送增量，仍消耗宿主模型用量。",
    control: h(Toggle, {
      checked: !!(settings.aiExtract && settings.aiExtract.enabled),
      onChange: function(next) {
        patchSettings({ aiExtract: { enabled: next } });
      }
    })
  }), h(SettingsRow, {
    title: "每批识别消息数",
    hint: "同账号消息合并调用模型；不同聊天按来源隔离。超长内容会分批，异常结果逐条保留重试。",
    control: h(Select, { value: String(settings.aiExtract?.batchSize || 5), options: [{ value: "5", label: "5 条" }, { value: "10", label: "10 条" }, { value: "20", label: "20 条" }], onChange: (event) => patchSettings({ aiExtract: { batchSize: Number(event.target.value) } }) })
  }), h(SettingsRow, {
    title: "识别后自动登记待办",
    hint: "开启后安装日期起的明确交办直接建档；关闭则待确认。安装日期之前的消息和历史暂存不再识别。",
    control: h(Toggle, {
      checked: !!(settings.aiExtract && settings.aiExtract.autoRegister),
      onChange: function(next) {
        patchSettings({ aiExtract: { autoRegister: next } });
      }
    })
  }), h(SettingsRow, {
    title: "消息处理起始日期",
    hint: "按插件安装日期（北京时间）固定；更早消息不再采集或识别，已有历史暂存标记为已跳过。",
    control: h("span", { className: "wb-tiny" }, data?.installedAt ? new Date(data.installedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) + " 起" : "首次启用时记录")
  }), h(SettingsRow, {
    title: "同步私聊与 @我 消息",
    hint: "每天北京时间09:00–21:00，每5分钟同步一次，21:00最后一轮；其余时段仅手动同步。限流时保留进度并退避。",
    control: h(Toggle, {
      checked: !(automation && automation.mentions === false),
      onChange: function(next) {
        patchSettings({ automation: { mentions: next } });
        setAutomation(Object.assign({}, automation, { mentions: next }));
      }
    })
  }))), h(Panel, {
    title: "补充 @ 关键词",
    sub: "增量游标不可用时，用这些关键词兜底检索昵称/别名 @",
    icon: "search"
  }, h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 10 } }, (settings.mentionKeywords || []).length === 0 ? h("span", { className: "wb-tiny wb-muted" }, "还没有补充关键词（默认用当前账号显示名检索）") : (settings.mentionKeywords || []).map(function(word) {
    return h(Chip, {
      key: word,
      active: true,
      children: word,
      onRemove: function() {
        patchSettings({
          mentionKeywords: (settings.mentionKeywords || []).filter(function(item) {
            return item !== word;
          })
        });
      }
    });
  })), h("div", { className: "wb-row" }, h(Input, {
    value: mentionDraft,
    placeholder: "如：小龙 / 珑珑",
    onChange: function(event) {
      setMentionDraft(event.target.value);
    },
    onKeyDown: function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const word = mentionDraft.trim();
        if (!word)
          return;
        patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) });
        setMentionDraft("");
      }
    }
  }), h(Btn, {
    size: "sm",
    icon: "plus",
    disabled: !mentionDraft.trim(),
    onClick: function() {
      const word = mentionDraft.trim();
      if (!word)
        return;
      patchSettings({ mentionKeywords: (settings.mentionKeywords || []).concat([word]).slice(0, 6) });
      setMentionDraft("");
    },
    children: "添加"
  }))), h(Panel, { title: "偏好", sub: "仅影响本工作台的展示", icon: "settings" }, h("div", null, h(SettingsRow, {
    title: "显示已完成任务",
    hint: "关闭时任务中心默认只看未完成",
    control: h(Toggle, {
      checked: !!settings.showCompleted,
      onChange: function(next) {
        patchSettings({ showCompleted: next });
      }
    })
  }), h(SettingsRow, {
    title: "数据陈旧阈值",
    hint: "超过这个时长未写入时，首页提示数据可能过期",
    control: h(Select, {
      value: String(settings.staleHours || 24),
      options: [
        { value: "6", label: "6 小时" },
        { value: "12", label: "12 小时" },
        { value: "24", label: "24 小时" },
        { value: "72", label: "3 天" }
      ],
      onChange: function(event) {
        patchSettings({ staleHours: Number(event.target.value) });
      }
    })
  }), h(SettingsRow, { title: "资讯时效", hint: "联网搜索限制已知发布时间，未知日期单独标注", control: h(Select, { value: String(settings.newsDays || 7), options: [1, 3, 7, 14, 30].map((value) => ({ value: String(value), label: "最近 " + value + " 天" })), onChange: (event) => patchSettings({ newsDays: Number(event.target.value) }) }) }), h(SettingsRow, {
    title: "默认项目",
    hint: "新建待办时预选的项目",
    control: h(Select, {
      value: settings.defaultProjectId || "",
      options: [{ value: "", label: "未设置" }].concat(projects.map(function(project) {
        return { value: project.id, label: project.name };
      })),
      onChange: function(event) {
        patchSettings({ defaultProjectId: event.target.value || null });
      }
    })
  }))), h(Panel, { title: "数据管理", sub: "状态由 Host 持有；前端不作为权威数据源", icon: "save" }, h("div", { className: "wb-stack", style: { gap: 9 } }, h("div", { className: "wb-row wb-row--wrap" }, h(Btn, { icon: "download", size: "sm", onClick: exportJson, children: "导出 JSON" }), h(Btn, {
    icon: "save",
    size: "sm",
    onClick: function() {
      WB.actions.backup().then(function(result) {
        setBackups(result.backups || []);
        WB.toast("已创建备份", "ok");
      }).catch(function(error) {
        WB.toast(String(error.message || error), "err");
      });
    },
    children: "立即备份"
  }), h(Btn, {
    icon: "share",
    size: "sm",
    onClick: function() {
      WB.actions.exportMigration().then(function(pack) {
        WB.util.copy(JSON.stringify(pack, null, 2)).then(function() {
          WB.toast("迁移包已复制（含校验），粘贴到目标端即可导入", "ok");
        });
      }).catch(function() {
      });
    },
    children: "导出迁移包"
  }), h(Btn, {
    icon: "sparkles",
    size: "sm",
    onClick: function() {
      WB.actions.seedDemo().catch(function() {
      });
    },
    children: "载入示例数据"
  })), h("p", { className: "wb-hint", style: { margin: "2px 0 0" } }, "“载入示例数据”会写入若干标注为示例的待办与资讯，用来快速看清布局；随时可重置清空。"), h(MigrationImportPanel, null), backups.length > 0 ? h("div", { className: "wb-stack", style: { gap: 4 } }, h("div", { className: "wb-label" }, "可用备份（每天首次写入自动留一份，保留 5 份）"), backups.slice(0, 5).map(function(item) {
    return h("div", { key: item.id, className: "wb-row", style: { gap: 8 } }, h("span", { className: "wb-mono wb-tiny wb-ellipsis", style: { flex: "1 1 auto" } }, item.id), h("span", { className: "wb-tiny wb-muted" }, WB.fmt.bytes(item.bytes)), h(Btn, {
      size: "sm",
      kind: "subtle",
      icon: "refresh",
      onClick: function() {
        if (!window.confirm("用这份备份覆盖当前数据？当前文件会先自动备份。"))
          return;
        WB.actions.restoreBackup(item.id).then(function() {
          WB.toast("已从备份恢复", "ok");
          WB.actions.reload().catch(function() {
          });
        }).catch(function() {
        });
      },
      children: "恢复"
    }));
  })) : null, h(Divider, null), h("div", { className: "wb-row" }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title" }, "重置数据"), h("div", { className: "wb-item-sub" }, "清空任务、执行记录、知识与雷达，保留设置")), h(Btn, {
    kind: "danger",
    size: "sm",
    icon: "trash",
    onClick: function() {
      setConfirmReset(true);
    },
    children: "重置"
  })))), h(Panel, { title: "关于", sub: "智能工作台 0.2.0（dsh-dev-workbench）", icon: "info" }, h("div", { className: "wb-stack wb-tiny wb-muted", style: { gap: 5 } }, h("span", null, "Cordis Host + Client 双半插件：Host 持有状态并通过 workbench/* Remote 暴露，Client 通过 main 与 sidebar.panellist 插槽渲染页面。"), h("span", null, "工具箱中的计算全部在浏览器内完成；企业消息摘录保存在宿主本地，凭据由 CLI / 宿主管理。"), h("span", null, "数据文件位于 ", h("code", { className: "wb-mono" }, diag ? diag.dataPath : "~/.dsh/storages/dev-workbench/state.json")))))), h(Modal, {
    open: !!projectEdit,
    title: "编辑项目",
    sub: projectEdit ? projectEdit.name : "",
    onClose: function() {
      setProjectEdit(null);
    },
    footer: h(React42.Fragment, null, h(Btn, {
      onClick: function() {
        setProjectEdit(null);
      },
      children: "取消"
    }), h("div", { className: "wb-spacer" }), h(Btn, {
      kind: "primary",
      icon: "save",
      disabled: !projectEdit || !String(projectEdit.name || "").trim(),
      onClick: function() {
        if (!projectEdit)
          return;
        const name2 = String(projectEdit.name || "").trim();
        if (!name2)
          return;
        WB.actions.saveProject({ id: projectEdit.id, name: name2, repoPath: String(projectEdit.repoPath || "").trim() }).then(function() {
          setProjectEdit(null);
        }).catch(function() {
        });
      },
      children: "保存"
    }))
  }, projectEdit ? h("div", { className: "wb-stack", style: { gap: 10 } }, h(Field, { label: "项目名称" }, h(Input, {
    value: projectEdit.name,
    autoFocus: true,
    onChange: function(event) {
      setProjectEdit(Object.assign({}, projectEdit, { name: event.target.value }));
    }
  })), h(Field, { label: "仓库目录", hint: "留空表示不关联仓库；改动后研发协作会重新探测" }, h(Input, {
    value: projectEdit.repoPath,
    placeholder: "/Users/me/code/项目",
    onChange: function(event) {
      setProjectEdit(Object.assign({}, projectEdit, { repoPath: event.target.value }));
    }
  }))) : null), h(Modal, {
    open: !!confirmReset,
    title: "重置确认",
    sub: "此操作不可撤销",
    onClose: function() {
      setConfirmReset(null);
    },
    footer: h(React42.Fragment, null, h(Btn, {
      onClick: function() {
        setConfirmReset(null);
      },
      children: "取消"
    }), h("div", { className: "wb-spacer" }), h(Btn, {
      kind: "danger",
      icon: "trash",
      onClick: function() {
        setConfirmReset(null);
        WB.actions.reset("all").catch(function() {
        });
      },
      children: "确认重置"
    }))
  }, h("p", { style: { margin: 0, fontSize: 12.5 } }, "将清空所有待办、执行记录、知识与雷达条目，并保留关注主题与偏好设置。")));
}
WB.pages.settings = SettingsPage;

// src/client/assistant/chat-actions.ts
var React43 = __toESM(require("react"), 1);
var CHAT_EMBED_ACTIONS = [
  {
    id: "workbench-task",
    label: "生成待办",
    icon: "plus",
    run: function(text, meta) {
      return WB.actions.createTask({
        title: chatEmbedTitle(text),
        description: text.slice(0, 2e3),
        priority: "normal",
        tags: ["来自会话"]
      }).then(function() {
        WB.toast("已生成待办（可在工作台查看）", "ok");
      });
    }
  },
  {
    id: "workbench-knowledge",
    label: "存为知识",
    icon: "book",
    run: function(text) {
      return WB.actions.createKnowledge({
        title: chatEmbedTitle(text),
        body: text.slice(0, 4e3),
        tags: ["来自会话"],
        url: null
      }).then(function() {
        WB.toast("已存入知识库", "ok");
      });
    }
  },
  {
    id: "workbench-run",
    label: "记执行记录",
    icon: "agent",
    run: function(text) {
      return WB.actions.recordRun({
        status: "completed",
        summary: text.slice(0, 300),
        steps: [{ text: "来源：原生会话中的助手回复" }]
      }).then(function() {
        WB.toast("已登记执行记录", "ok");
      });
    }
  }
];
function chatEmbedTitle(text) {
  const line = String(text || "").replace(/^#+\s*/gm, "").replace(/[*_`>]/g, "").split("\n").map(function(part) {
    return part.trim();
  }).filter(Boolean)[0];
  const title = (line || "会话记录").slice(0, 60);
  return title || "会话记录";
}
var WB_CHAT_ACTIONS_CSS = `
.wb-chat-actions { position:relative; display:inline-flex; align-items:center; gap:6px; font:inherit; color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions *, .wb-chat-actions *::before, .wb-chat-actions *::after { box-sizing:border-box; }
.wb-chat-actions.is-open { z-index:71; }
.wb-chat-actions__trigger { appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:3px; min-width:32px; height:26px; padding:4px; border:1px solid transparent; border-radius:6px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
.wb-chat-actions__trigger:hover:not(:disabled), .wb-chat-actions__trigger[aria-expanded="true"] { color:var(--dsw-alias-label-primary,#20242b); background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 6%,transparent); }
.wb-chat-actions__chevron { display:flex; transform:rotate(180deg); }
.wb-chat-actions.is-open .wb-chat-actions__chevron { transform:none; }
.wb-chat-actions__menu { position:absolute; bottom:calc(100% + 8px); left:0; z-index:1; display:flex; flex-direction:column; gap:2px; width:176px; max-width:calc(100vw - 24px); max-height:220px; overflow-y:auto; padding:6px; border:1px solid var(--dsw-alias-border-l1,#e4e7ed); border-radius:10px; background:var(--dsw-alias-bg-layer-1,#fff); color:var(--dsw-alias-label-primary,#20242b); box-shadow:0 6px 24px rgba(0,0,0,.14); }
.wb-chat-actions__item { appearance:none; display:flex; align-items:center; gap:10px; flex:none; width:100%; min-height:36px; padding:8px 10px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-size:13px; line-height:20px; text-align:left; white-space:nowrap; cursor:pointer; }
.wb-chat-actions__item svg { color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions__item:hover:not(:disabled), .wb-chat-actions__item:focus-visible { background:color-mix(in srgb,var(--dsw-alias-label-primary,#20242b) 6%,transparent); }
.wb-chat-actions__trigger:focus-visible, .wb-chat-actions__item:focus-visible { outline:2px solid var(--dsw-alias-brand-primary,#687386); outline-offset:2px; }
.wb-chat-actions button:disabled { opacity:.45; cursor:default; }
.wb-chat-actions__status { font-size:12px; color:var(--dsw-alias-label-secondary,#6b7280); }
.wb-chat-actions__error { font-size:12px; color:var(--dsw-alias-state-error-primary,#d14343); }
@media (prefers-color-scheme:dark) {
 .wb-chat-actions__menu { background:var(--dsw-alias-bg-layer-1,#242528); color:var(--dsw-alias-label-primary,#f0f0f2); border-color:var(--dsw-alias-border-l1,#414247); }
 .wb-chat-actions__trigger:hover:not(:disabled), .wb-chat-actions__trigger[aria-expanded="true"], .wb-chat-actions__item:hover:not(:disabled), .wb-chat-actions__item:focus-visible { background:color-mix(in srgb,var(--dsw-alias-label-primary,#f0f0f2) 6%,transparent); color:var(--dsw-alias-label-primary,#f0f0f2); }
}
`;
function ChatAssistantActions(props) {
  const [busy, setBusy] = React43.useState(false);
  const [error, setError] = React43.useState(null);
  const [open, setOpen] = React43.useState(false);
  const rootRef = React43.useRef(null);
  const menuRef = React43.useRef(null);
  const triggerRef = React43.useRef(null);
  const returnFocusRef = React43.useRef(false);
  const messageId = props && props.messageId ? String(props.messageId) : "";
  const sessionId = props && props.sessionId ? String(props.sessionId) : null;
  function closeMenu() {
    returnFocusRef.current = true;
    setOpen(false);
    triggerRef.current?.focus();
  }
  React43.useEffect(() => {
    if (!open && !busy && returnFocusRef.current) {
      returnFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open, busy]);
  React43.useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector("button:not(:disabled)")?.focus();
    const outside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };
    document.addEventListener?.("pointerdown", outside);
    document.addEventListener?.("keydown", escape);
    return () => {
      document.removeEventListener?.("pointerdown", outside);
      document.removeEventListener?.("keydown", escape);
    };
  }, [open]);
  if (!messageId) return null;
  function trigger(action) {
    if (busy) return;
    setBusy(true);
    setError(null);
    WB.actions.assistantMessage(sessionId, messageId).then((result) => {
      if (!result || result.status !== "ok" || !result.text) throw new Error(result && (result.detail || result.note) || "没有取到该条回复的内容");
      return action.run(result.text, result);
    }).then(() => {
      setBusy(false);
      if (document.activeElement === document.body || rootRef.current?.contains(document.activeElement)) closeMenu();
      else setOpen(false);
    }).catch((failure) => {
      setError({ text: "操作没成功，请重试", detail: String(failure?.message || failure) });
      setBusy(false);
    });
  }
  function onMenuKey(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key === "Tab" && open) {
      closeMenu();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!open) {
      if (!busy && event.key.startsWith("Arrow")) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll("button:not(:disabled)") || []);
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    const current = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : current < 0 ? event.key === "ArrowUp" ? items.length - 1 : 0 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }
  return h(
    "div",
    { ref: rootRef, className: "wb-chat-actions" + (open ? " is-open" : ""), onKeyDown: onMenuKey },
    open ? h("div", { ref: menuRef, className: "wb-chat-actions__menu", role: "menu", "aria-label": "工作台操作" }, CHAT_EMBED_ACTIONS.map((action) => h("button", {
      key: action.id,
      type: "button",
      role: "menuitem",
      className: "wb-chat-actions__item",
      disabled: busy,
      onClick: () => trigger(action)
    }, h(Icon, { name: action.icon || "plus", size: 15 }), h("span", null, action.label)))) : null,
    h("button", { ref: triggerRef, type: "button", className: "wb-chat-actions__trigger", disabled: busy, title: "工作台操作（生成待办 / 存为知识 / 记执行记录）", "aria-label": "工作台操作", "aria-haspopup": "menu", "aria-expanded": open ? "true" : "false", onClick: () => setOpen(!open) }, h(Icon, { name: "sparkles", size: 14 }), h("span", { className: "wb-chat-actions__chevron" }, h(Icon, { name: "chevronDown", size: 10 }))),
    busy ? h("span", { className: "wb-chat-actions__status", role: "status" }, "处理中…") : null,
    error ? h("span", { className: "wb-chat-actions__error", role: "alert", title: error.detail }, error.text) : null
  );
}
function chatEmbedBlockSummary(block) {
  if (!block || typeof block !== "object")
    return "";
  const candidates = [block.args, block.arguments, block.input, block.result, block.output, block.content, block.text];
  for (const value of candidates) {
    if (value === void 0 || value === null)
      continue;
    if (typeof value === "string")
      return value.slice(0, 200);
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch (e) {
    }
  }
  return "";
}
function WorkbenchToolView(props) {
  const toolName = String(props && props.toolName || "workbench");
  const phase = props && props.phase ? String(props.phase) : "start";
  const summary = chatEmbedBlockSummary(props && props.block);
  const failed = !!(props && props.block && (props.block.isError === true || props.block.error));
  return h("div", {
    style: {
      border: "1px solid currentColor",
      borderRadius: 8,
      padding: "6px 9px",
      fontSize: 11.5,
      lineHeight: 1.6,
      opacity: 0.92,
      maxWidth: 620
    }
  }, h("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, h("span", { style: { fontWeight: 600 } }, "工作台"), h("span", { style: { opacity: 0.75 } }, toolName.replace(/^workbench_/, "")), h("span", { style: { marginLeft: "auto", opacity: 0.6 } }, failed ? "失败" : phase === "result" ? "完成" : phase === "start" ? "执行中" : "准备中")), summary ? h("div", { style: { marginTop: 3, opacity: 0.8, overflowWrap: "anywhere" } }, summary) : null);
}
WB.registerChatEmbed = function(ctx) {
  if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function")
    return function() {
    };
  const disposers = [];
  if (document.head?.appendChild) {
    const style = document.createElement("style");
    style.dataset.workbenchChatActions = "";
    style.textContent = WB_CHAT_ACTIONS_CSS;
    document.head.appendChild(style);
    disposers.push(() => style.remove());
  }
  try {
    disposers.push(
      // 只注册**一个**单元格：三个动作收在同一个图标下拉里。
      // 之前按动作注册了三个单元格，于是同一排出现三个图标按钮。
      ctx.slots.inject("conversation.chat.assistant-actions", function() {
        return ctx.slots.register({
          name: "conversation.chat.assistant-actions",
          id: "workbench-actions",
          order: 30,
          label: "工作台"
        }, ChatAssistantActions);
      })
    );
  } catch (e) {
  }
  try {
    disposers.push(ctx.slots.inject("tool.call.toolview", function() {
      return WB.WORKBENCH_TOOL_NAMES.map(function(name2) {
        return ctx.slots.register({ name: "tool.call.toolview", key: name2 }, WorkbenchToolView);
      });
    }));
  } catch (e) {
  }
  return function() {
    disposers.forEach(function(dispose) {
      try {
        dispose();
      } catch (e) {
      }
    });
  };
};

// src/client/shell/command-palette.ts
var React44 = __toESM(require("react"), 1);
function paletteCommands(context) {
  const commands = [];
  WB.ORDER.forEach(function(id, index) {
    const meta = WB.PAGE_META[id];
    if (!meta)
      return;
    commands.push({
      id: "nav:" + id,
      label: "转到 " + meta.title,
      hint: meta.hint,
      icon: meta.icon,
      keys: "⌘" + (index + 1),
      group: "导航",
      run: function() {
        WB.go(id);
      }
    });
  });
  commands.push({
    id: "task:new",
    label: "新建待办",
    hint: "打开任务表单，记录标题、优先级与截止时间",
    icon: "plus",
    group: "操作",
    run: function() {
      WB.openTaskForm(null);
    }
  });
  commands.push({
    id: "data:refresh",
    label: "重新读取 Host 数据",
    hint: "重新拉取 workbench 快照",
    icon: "refresh",
    group: "操作",
    run: function() {
      WB.actions.reload().catch(function() {
      });
    }
  });
  if (context && context.counts && context.counts.overdue > 0) {
    commands.push({
      id: "task:overdue",
      label: "查看 " + context.counts.overdue + " 项逾期任务",
      hint: "跳到任务中心",
      icon: "alert",
      group: "操作",
      run: function() {
        WB.go("tasks");
      }
    });
  }
  if (context && context.runs && context.runs.length > 0) {
    commands.push({
      id: "nav:agents",
      label: "查看执行记录（" + context.runs.length + "）",
      hint: "Agent 中心：队列、审批与结果",
      icon: "agent",
      group: "操作",
      run: function() {
        WB.go("agents");
      }
    });
  }
  const searchGroups = context && context.searchResults && context.searchResults.groups || [];
  const SEARCH_ICON = {
    tasks: "tasks",
    knowledge: "book",
    radar: "sparkles",
    sources: "layers",
    files: "folder",
    enterprise: "building",
    contacts: "users",
    rooms: "users",
    attendance: "clock",
    events: "calendar",
    github: "git",
    web: "globe"
  };
  searchGroups.forEach(function(group) {
    if (group.status !== "ok")
      return;
    group.items.slice(0, 5).forEach(function(item, index) {
      commands.push({
        id: "search:" + group.id + ":" + (item.id || index) + ":" + index,
        label: item.title,
        hint: group.label + (item.snippet ? " · " + WB.util.truncate(String(item.snippet), 56) : ""),
        icon: SEARCH_ICON[group.id] || "search",
        group: "搜索 · " + group.label,
        run: function() {
          WB.setSearchPreset({ query: context.searchQuery, groups: [group.id] });
          WB.go("search");
        }
      });
    });
  });
  const tasks = context && context.tasks || [];
  tasks.slice(0, 40).forEach(function(task) {
    commands.push({
      id: "task:" + task.id,
      label: task.title,
      hint: "待办 · " + (WB.TASK_STATUS[task.status] || {}).label + (task.dueAt ? " · 截止 " + WB.fmt.day(task.dueAt) : ""),
      icon: "tasks",
      group: "待办",
      run: function() {
        WB.openTaskForm(task);
      }
    });
  });
  return commands;
}
function paletteMatch(command, query) {
  if (!query)
    return true;
  const haystack = (command.label + " " + (command.hint || "") + " " + (command.group || "")).toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle)
    return true;
  let index = 0;
  for (let i = 0; i < haystack.length && index < needle.length; i += 1) {
    if (haystack[i] === needle[index])
      index += 1;
  }
  return index === needle.length;
}
function Palette(props) {
  const state = useStore();
  const [query, setQuery] = React44.useState("");
  const [active, setActive] = React44.useState(0);
  const [searchResults, setSearchResults] = React44.useState(null);
  const inputRef = React44.useRef(null);
  const data = state.data || {};
  React44.useEffect(function() {
    if (!props.open)
      return void 0;
    const text = query.trim();
    if (text.length < 2) {
      setSearchResults(null);
      return void 0;
    }
    const timer = setTimeout(function() {
      WB.actions.search(text, { includeWeb: false }).then(function(result) {
        setSearchResults(result);
      }).catch(function() {
        setSearchResults(null);
      });
    }, 260);
    return function() {
      clearTimeout(timer);
    };
  }, [query, props.open]);
  const commands = paletteCommands({
    tasks: data.tasks,
    runs: data.runs,
    counts: WB.taskCounts(data),
    searchResults,
    searchQuery: query.trim()
  });
  const results = commands.filter(function(command) {
    return paletteMatch(command, query);
  });
  const shown = results.slice(0, 40);
  React44.useEffect(function() {
    if (!props.open)
      return;
    setQuery("");
    setActive(0);
    const timer = setTimeout(function() {
      if (inputRef.current && inputRef.current.focus)
        inputRef.current.focus();
    }, 10);
    return function() {
      clearTimeout(timer);
    };
  }, [props.open]);
  React44.useEffect(function() {
    setActive(0);
  }, [query]);
  if (!props.open)
    return null;
  function runAt(index) {
    const command = shown[index];
    if (!command)
      return;
    props.onClose();
    command.run();
  }
  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(function(index) {
        return Math.min(shown.length - 1, index + 1);
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(function(index) {
        return Math.max(0, index - 1);
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
    }
  }
  let lastGroup = null;
  return h("div", {
    className: "wb-modal-mask",
    style: { paddingTop: "14vh" },
    onMouseDown: function(event) {
      if (event.target === event.currentTarget)
        props.onClose();
    }
  }, h("div", {
    className: "wb-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "命令面板",
    style: { width: "min(600px, 100%)", maxHeight: "62vh" }
  }, h("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "11px 14px",
      borderBottom: "1px solid " + T.border1
    }
  }, h(Icon, { name: "search", size: 15 }), h("input", {
    ref: inputRef,
    value: query,
    placeholder: "搜索待办、知识、资讯，或输入命令…",
    onChange: function(event) {
      setQuery(event.target.value);
    },
    onKeyDown,
    style: {
      flex: "1 1 auto",
      minWidth: 0,
      border: 0,
      outline: "none",
      background: "transparent",
      color: T.text,
      font: "inherit",
      fontSize: 13
    }
  }), h(Kbd, null, "esc")), h("div", { style: { overflow: "auto", padding: "5px 6px 7px" } }, shown.length === 0 ? h(Empty, {
    icon: "search",
    title: "没有匹配的命令或待办",
    hint: "试试页面名称，或直接新建一条待办。"
  }) : shown.map(function(command, index) {
    const header = command.group !== lastGroup ? (lastGroup = command.group, h("div", {
      key: "group:" + command.group,
      style: {
        padding: "7px 9px 3px",
        fontSize: 10,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: T.text2
      }
    }, command.group)) : null;
    return h(React44.Fragment, { key: command.id }, header, h("button", {
      type: "button",
      onMouseEnter: function() {
        setActive(index);
      },
      onClick: function() {
        runAt(index);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 9px",
        border: 0,
        borderRadius: 9,
        background: index === active ? T.layer2 : "transparent",
        color: T.text,
        font: "inherit",
        textAlign: "left",
        cursor: "pointer"
      }
    }, h("span", { style: { display: "inline-flex", color: index === active ? T.accent : T.text2 } }, h(Icon, { name: command.icon, size: 14 })), h("span", { style: { flex: "1 1 auto", minWidth: 0 } }, h("span", { className: "wb-ellipsis", style: { display: "block", fontSize: 12.5 } }, command.label), command.hint ? h("span", { className: "wb-ellipsis wb-tiny wb-muted", style: { display: "block" } }, command.hint) : null), command.keys ? h(Kbd, null, command.keys) : null));
  })), h("div", {
    className: "wb-row wb-tiny wb-muted",
    style: { padding: "7px 14px", borderTop: "1px solid " + T.border1, gap: 12 }
  }, h("span", { className: "wb-row", style: { gap: 4 } }, h(Kbd, null, "↑"), h(Kbd, null, "↓"), "选择"), h("span", { className: "wb-row", style: { gap: 4 } }, h(Kbd, null, "↵"), "执行"), query.trim().length >= 2 ? h("span", { className: "wb-muted" }, "本地检索 · 不联网") : null, h("span", { className: "wb-spacer" }), h("span", null, shown.length + " 项结果"))));
}
WB.Palette = Palette;

// src/client/features/search/search-page.ts
var React45 = __toESM(require("react"), 1);
function searchKindMeta(kind) {
  if (kind === "task")
    return { label: "待办", icon: "tasks", tone: "accent" };
  if (kind === "knowledge")
    return { label: "知识", icon: "book", tone: "ok" };
  if (kind === "radar")
    return { label: "雷达", icon: "radar", tone: "idle" };
  if (kind === "source")
    return { label: "来源", icon: "link", tone: "idle" };
  if (kind === "web")
    return { label: "外网", icon: "external", tone: "warn" };
  if (kind === "contact")
    return { label: "联系人", icon: "agent", tone: "accent" };
  if (kind === "room")
    return { label: "会议室", icon: "calendar", tone: "ok" };
  if (kind === "attendance")
    return { label: "考勤", icon: "clock", tone: "idle" };
  return { label: kind, icon: "layers", tone: "idle" };
}
function searchStatusMeta(status) {
  if (status === "ok")
    return { label: "已返回", tone: "ok" };
  if (status === "empty")
    return { label: "无命中", tone: "idle" };
  if (status === "unavailable")
    return { label: "不可用", tone: "warn" };
  if (status === "error")
    return { label: "失败", tone: "err" };
  return { label: status, tone: "idle" };
}
function SearchResultRow(props) {
  const item = props.item;
  const meta = searchKindMeta(item.kind);
  const extra = item.extra || {};
  function collect() {
    WB.actions.createKnowledge({
      kind: "bookmark",
      title: item.title,
      url: item.url || null,
      body: item.snippet || "",
      tags: ["搜索", meta.label]
    }).catch(function() {
    });
  }
  return h("div", { className: "wb-item", style: { alignItems: "flex-start" } }, h("div", { className: "wb-item-main" }, h("div", { className: "wb-item-title", style: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" } }, h(Badge, { tone: meta.tone }, meta.label), item.url ? h("a", {
    href: item.url,
    target: "_blank",
    rel: "noreferrer",
    className: "wb-link",
    style: { fontWeight: 500 }
  }, item.title) : h("span", null, item.title)), item.snippet ? h("div", { className: "wb-item-sub wb-clamp2" }, item.snippet) : null, h("div", { className: "wb-item-sub" }, item.kind === "task" && extra.status ? h("span", null, (WB.TASK_STATUS[extra.status] || {}).label || extra.status) : null, item.kind === "task" && extra.dueAt ? h("span", null, "截止 " + WB.fmt.day(extra.dueAt)) : null, item.kind === "source" && extra.provider ? h("span", null, extra.provider) : null, item.kind === "radar" && extra.source ? h("span", null, extra.source) : null, item.kind === "web" && extra.publishedAt ? h("span", null, WB.fmt.date(extra.publishedAt)) : null, item.kind === "knowledge" && extra.tags && extra.tags.length ? extra.tags.map(function(tag) {
    return h(Chip, { key: tag, children: tag });
  }) : null)), h("div", { className: "wb-item-actions", style: { opacity: 1 } }, item.kind === "task" ? h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "arrowRight",
    children: "定位",
    onClick: function() {
      WB.focusTask(item.id);
    }
  }) : null, item.kind === "radar" || item.kind === "knowledge" ? h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "copy",
    children: "复制",
    onClick: function() {
      WB.util.copy([item.title, item.snippet, item.url].filter(Boolean).join("\n")).then(function() {
        WB.toast("已复制", "ok");
      }).catch(function(e) {
        WB.toast(String(e && e.message || e), "err");
      });
    }
  }) : null, h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "book",
    children: "收藏",
    onClick: collect
  }), h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "plus",
    children: "建待办",
    onClick: function() {
      WB.openTaskForm({
        title: WB.util.truncate(item.title || "来自检索结果", 80),
        description: String((item.snippet || "") + (item.url ? "\n来源：" + item.url : "")).slice(0, 2e3),
        projectId: null,
        taskId: null
      });
    }
  }), h(Btn, {
    size: "sm",
    kind: "subtle",
    icon: "sparkles",
    children: "AI 分析",
    onClick: function() {
      WB.assistant.add({
        kind: "source",
        id: item.id,
        title: item.title,
        url: item.url || null,
        body: item.snippet || "",
        meta: "来源分组：" + props.groupLabel
      });
    }
  })));
}
function SearchPage() {
  const state = useStore();
  const data = state.data;
  const [draft, setDraft] = React45.useState("");
  const [query, setQuery] = React45.useState("");
  const [includeWeb, setIncludeWeb] = React45.useState(false);
  const [busy, setBusy] = React45.useState(false);
  const [error, setError] = React45.useState(null);
  const [result, setResult] = React45.useState(null);
  const [hidden, setHidden] = React45.useState([]);
  const [history, setHistory] = React45.useState([]);
  const [dateFilter, setDateFilter] = React45.useState("all");
  const [projectFilter, setProjectFilter] = React45.useState("");
  const [category, setCategory] = React45.useState("all");
  const preset = state.searchPreset;
  const presetConsumed = React45.useRef(null);
  React45.useEffect(function() {
    if (!preset || presetConsumed.current === preset)
      return;
    presetConsumed.current = preset;
    const text = String(preset.query || "").trim();
    if (text) {
      setDraft(text);
      run(text);
    }
    if (preset.groups && preset.groups.length > 0) {
      const groupId = preset.groups[0];
      const matched = SEARCH_CATEGORIES.find(function(item) {
        return item.groups && item.groups.indexOf(groupId) >= 0;
      });
      if (matched)
        setCategory(matched.id);
    } else if (preset.category) {
      setCategory(preset.category);
    }
    WB.clearSearchPreset();
  }, [preset]);
  const SEARCH_DATE_WINDOWS = { all: 0, day: 24 * 3600 * 1e3, week: 7 * 24 * 3600 * 1e3, month: 30 * 24 * 3600 * 1e3 };
  function itemPasses(item) {
    const extra = item.extra || {};
    if (projectFilter && item.kind === "task" && (extra.projectId || null) !== projectFilter)
      return false;
    if (dateFilter !== "all") {
      const at = extra.at;
      if (at) {
        const stamp2 = new Date(at).getTime();
        if (!Number.isNaN(stamp2) && Date.now() - stamp2 > SEARCH_DATE_WINDOWS[dateFilter])
          return false;
      }
    }
    return true;
  }
  function run(nextQuery) {
    const text = String(nextQuery === void 0 ? draft : nextQuery).trim();
    if (!text)
      return;
    setDraft(text);
    setQuery(text);
    setBusy(true);
    setError(null);
    WB.actions.search(text, { includeWeb }).then(function(value) {
      setResult(value);
      setBusy(false);
      setHistory(function(previous) {
        return [text].concat(previous.filter(function(item) {
          return item !== text;
        })).slice(0, 6);
      });
    }).catch(function(e) {
      setBusy(false);
      setError(String(e && e.message || e));
      setResult(null);
    });
  }
  const SEARCH_CATEGORIES = [
    { id: "all", label: "全部", groups: null },
    { id: "local", label: "本地", groups: ["tasks", "knowledge", "radar", "sources", "files"] },
    { id: "enterprise", label: "企业", groups: ["enterprise", "contacts", "rooms", "attendance", "events"] },
    { id: "code", label: "代码", groups: ["github", "files"] },
    { id: "web", label: "互联网", groups: ["web"] }
  ];
  const activeCategory = preset && preset.category && SEARCH_CATEGORIES.some(function(item) {
    return item.id === preset.category;
  }) ? preset.category : category;
  const categoryGroups = (function() {
    const found = SEARCH_CATEGORIES.find(function(item) {
      return item.id === activeCategory;
    });
    return found && found.groups ? found.groups : null;
  })();
  const groups = result && result.groups || [];
  const visible = groups.filter(function(group) {
    if (hidden.indexOf(group.id) >= 0)
      return false;
    if (!categoryGroups)
      return true;
    return categoryGroups.indexOf(group.id) >= 0;
  }).map(function(group) {
    if (group.status !== "ok" && group.items.length === 0)
      return group;
    return Object.assign({}, group, { items: group.items.filter(itemPasses) });
  });
  const totalVisible = visible.reduce(function(sum, group) {
    return sum + group.items.length;
  }, 0);
  return h("div", null, h(PageHead, {
    icon: "search",
    title: WB.t("nav.search", "搜索"),
    sub: "一个入口搜全部：本地、企业、代码与外网各算一路，某一路失败不影响其它来源。",
    actions: h(React45.Fragment, null, h(Toggle, {
      checked: includeWeb,
      onChange: setIncludeWeb,
      label: "含互联网"
    }), h(Btn, {
      icon: "search",
      size: "sm",
      kind: "primary",
      disabled: busy || !draft.trim(),
      onClick: function() {
        run();
      },
      children: busy ? "检索中…" : "搜索"
    }))
  }), h(Panel, { title: "关键词", icon: "filter", sub: "本地三路立即返回；互联网一路可能较慢" }, h("div", { className: "wb-row" }, h(Icon, { name: "search", size: 15 }), h(Input, {
    value: draft,
    autoFocus: true,
    placeholder: "搜索待办、知识、技术雷达，或输入一串外部问题…",
    onChange: function(event) {
      setDraft(event.target.value);
    },
    onKeyDown: function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        run();
      }
    }
  }), h(Btn, {
    icon: "arrowRight",
    kind: "primary",
    disabled: busy || !draft.trim(),
    onClick: function() {
      run();
    },
    children: "检索"
  })), history.length === 0 ? null : h("div", { className: "wb-row wb-row--wrap", style: { marginTop: 10, gap: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "最近："), history.map(function(item) {
    return h(Chip, {
      key: item,
      children: item,
      onClick: function() {
        run(item);
      }
    });
  }))), h("div", { style: { height: 14 } }), busy ? h("div", { className: "wb-row", style: { padding: "26px 0", justifyContent: "center", gap: 8 } }, h(Spinner, { size: 17 }), h("span", { className: "wb-tiny wb-muted" }, "正在按来源分组检索「" + query + "」…")) : null, error ? h(Panel, { title: "检索失败", icon: "alert", sub: "Host 没有完成这次检索" }, h("div", { role: "alert", className: "wb-code" }, error), h("p", { className: "wb-hint", style: { marginTop: 8 } }, "如果刚刚更新过插件，说明 Host 还没有加载新的 Remote 端点：重启 DSH 后再试。")) : null, !busy && !error && !result ? h("div", { className: "wb-grid", style: { gridTemplateColumns: "minmax(0, 1fr) 260px" } }, h(Panel, { title: "怎么查", icon: "info" }, h("div", { className: "wb-stack", style: { gap: 7 } }, h("span", { className: "wb-tiny" }, "· 待办：标题、描述、标签"), h("span", { className: "wb-tiny" }, "· 知识空间：收藏与笔记正文"), h("span", { className: "wb-tiny" }, "· 技术雷达：标题与四段摘要"), h("span", { className: "wb-tiny" }, "· 来源证据：消息与文件摘录"), h("span", { className: "wb-tiny" }, "· 企业（云之家）：经 Host 调 yzj-cli 消息与文档搜索（需已认证）"), h("span", { className: "wb-tiny" }, "· 互联网：经 Host 的 web 服务，结果带 URL 与时间"), h(Divider, null), h("span", { className: "wb-tiny wb-muted" }, "本页不会把多路结果合并成一段没有引用的结论。要看归纳，请把任务简报交给会话里的 Agent。"))), h(Panel, { title: "当前可检索范围", icon: "database", sub: "来自 Host 快照" }, h("div", { className: "wb-stack", style: { gap: 6 } }, h("span", { className: "wb-tiny" }, "待办 " + (data && data.tasks || []).length + " 条"), h("span", { className: "wb-tiny" }, "知识 " + (data && data.knowledge || []).length + " 条"), h("span", { className: "wb-tiny" }, "雷达 " + (data && data.radar || []).length + " 条"), h("span", { className: "wb-tiny" }, "来源 " + (data && data.sources || []).length + " 条")))) : null, result ? h("div", null, h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 6, gap: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "日期："), [
    { value: "all", label: "全部" },
    { value: "day", label: "24 小时" },
    { value: "week", label: "7 天" },
    { value: "month", label: "30 天" }
  ].map(function(option) {
    return h(Chip, {
      key: option.value,
      active: dateFilter === option.value,
      onClick: function() {
        setDateFilter(option.value);
      },
      children: option.label
    });
  }), h("span", { className: "wb-tiny wb-muted", style: { marginLeft: 12 } }, "项目："), h(Select, {
    value: projectFilter,
    options: [{ value: "", label: "全部项目" }].concat((data && data.projects || []).map(function(project) {
      return { value: project.id, label: project.name };
    })),
    onChange: function(event) {
      setProjectFilter(event.target.value);
    }
  }), h("span", { className: "wb-tiny wb-muted" }, "仅作用于「我的待办」一路")), h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 8, gap: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "分类："), SEARCH_CATEGORIES.map(function(option) {
    return h(Chip, {
      key: option.id,
      active: activeCategory === option.id,
      onClick: function() {
        setCategory(option.id);
      },
      children: option.label,
      title: option.groups ? "只看：" + option.groups.join(" / ") : "显示所有来源分组"
    });
  }), h("span", { className: "wb-tiny wb-muted", style: { marginLeft: 8 } }, "分类叠加来源筛选")), h("div", { className: "wb-row wb-row--wrap", style: { marginBottom: 12, gap: 6 } }, h("span", { className: "wb-tiny wb-muted" }, "来源筛选："), groups.map(function(group) {
    const meta = searchStatusMeta(group.status);
    const active = hidden.indexOf(group.id) < 0;
    return h(Chip, {
      key: group.id,
      active,
      onClick: function() {
        setHidden(function(previous) {
          return active ? previous.concat([group.id]) : previous.filter(function(id) {
            return id !== group.id;
          });
        });
      },
      children: group.label + " " + group.items.length,
      title: meta.label
    });
  }), h("div", { className: "wb-spacer" }), h("span", { className: "wb-tiny wb-muted" }, "共 " + totalVisible + " 条 · " + WB.fmt.relative(result.at, Date.now()))), totalVisible === 0 ? h(Empty, {
    icon: "search",
    title: "「" + result.query + "」在已启用的来源里没有命中",
    hint: "本页不会为了凑结果而编造企业事实。可以换一个关键词、扩大时间范围，或到知识空间先补充资料。",
    action: h(Btn, {
      size: "sm",
      icon: "refresh",
      children: "再查一次",
      onClick: function() {
        run();
      }
    })
  }) : null, visible.map(function(group) {
    const meta = searchStatusMeta(group.status);
    const bad = group.status === "error" || group.status === "unavailable";
    return h("div", { key: group.id, style: { marginBottom: 14 } }, h(Panel, {
      title: group.label,
      icon: group.id === "web" ? "external" : group.id === "enterprise" ? "lock" : group.id === "contacts" ? "agent" : group.id === "rooms" ? "calendar" : group.id === "attendance" ? "clock" : group.id === "tasks" ? "tasks" : group.id === "knowledge" ? "book" : group.id === "radar" ? "radar" : "link",
      badge: h(Badge, { tone: meta.tone }, meta.label),
      sub: group.note || void 0,
      actions: h("span", { className: "wb-tiny wb-muted" }, group.items.length + " 条")
    }, bad && group.items.length === 0 ? h(Empty, {
      icon: "alert",
      title: group.status === "unavailable" ? "这一路当前不可用" : "这一路检索失败",
      hint: group.note || "没有拿到结果。其余来源不受影响。"
    }) : group.items.length === 0 ? h(Empty, { icon: "search", title: "这一路没有命中", hint: "换个关键词可能更好。" }) : h("div", null, group.items.map(function(item) {
      return h(SearchResultRow, { key: item.id, item });
    }))));
  })) : null);
}
WB.pages.search = SearchPage;

// src/client/features/web-ai/HistoryManager.tsx
var React46 = __toESM(require("react"), 1);

// src/shared/web-ai-attachments.ts
var WEB_AI_FILE_LIMITS = { count: 5, single: 10 * 1024 * 1024, total: 20 * 1024 * 1024 };
var WEB_AI_FILE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
function normalizeWebAIAttachments(raw) {
  if (!Array.isArray(raw) || raw.length > WEB_AI_FILE_LIMITS.count) throw new Error("每次最多添加5个附件");
  const names = /* @__PURE__ */ new Set();
  let total = 0;
  return raw.map((a) => {
    if (!a || typeof a.id !== "string" || !/^[\w-]{1,120}$/.test(a.id) || typeof a.name !== "string" || !a.name.trim() || a.name.length > 180 || /[\x00-\x1f/\\]/.test(a.name) || names.has(a.name)) throw new Error("附件名称无效或重复，请使用不同文件名");
    if (!Number.isInteger(a.size) || a.size <= 0 || a.size > WEB_AI_FILE_LIMITS.single) throw new Error("附件不能为空，单个最大10MB");
    if (!WEB_AI_FILE_ACCEPT.split(",").some((ext) => a.name.toLowerCase().endsWith(ext))) throw new Error("暂不支持此附件格式");
    if (typeof a.type !== "string" || a.type.length > 120 || a.type && !/^[\w.+-]+\/[\w.+-]+$/.test(a.type)) throw new Error("附件类型无效");
    names.add(a.name);
    total += a.size;
    if (total > WEB_AI_FILE_LIMITS.total) throw new Error("附件总大小不能超过20MB");
    return { id: a.id, name: a.name, size: a.size, type: a.type };
  });
}

// src/shared/web-ai.ts
var WEB_AI_PROVIDERS = [
  { id: "kimi", name: "Kimi", url: "https://www.kimi.com/", hosts: ["www.kimi.com", "kimi.com"] },
  { id: "glm", name: "智谱清言", url: "https://chatglm.cn/", hosts: ["chatglm.cn"] },
  { id: "doubao", name: "豆包", url: "https://www.doubao.com/chat/", hosts: ["www.doubao.com"] },
  { id: "yuanbao", name: "元宝", url: "https://yuanbao.tencent.com/", hosts: ["yuanbao.tencent.com"] },
  { id: "qianwen", name: "千问", url: "https://www.qianwen.com/", hosts: ["www.qianwen.com", "qianwen.com"] },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", hosts: ["chatgpt.com"] }
];
var WEB_AI_ACTIVE = /* @__PURE__ */ new Set(["queued", "preparing", "generating"]);
function webAIProvider(id) {
  const p = WEB_AI_PROVIDERS.find((p2) => p2.id === id);
  if (!p) throw new Error("不支持的网页 AI 厂商");
  return p;
}
function webAIConversationUrl(id, value) {
  try {
    const p = webAIProvider(id), u = new URL(String(value));
    if (u.protocol !== "https:" || u.username || u.password || u.port || !p.hosts.some((h2) => h2 === u.hostname) || /login|oauth|callback|authorize|sign[-_]?in/i.test(u.pathname)) return null;
    const query = new URLSearchParams();
    for (const key2 of ["chatId", "conversationId", "conversation_id", "sessionId", "dialogueId", "cid"]) {
      const v = u.searchParams.get(key2);
      if (v && /^[\w-]{1,160}$/.test(v)) query.set(key2, v);
    }
    const hash = /^#\/(chat|conversation|c)\/[\w/-]{1,200}$/.test(u.hash) ? u.hash : "";
    return u.origin + u.pathname + (query.size ? "?" + query : "") + hash;
  } catch {
    return null;
  }
}
var clean = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
var stamp = (v) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
function normalizeWebAICapture(raw) {
  if (!Number.isInteger(raw?.answerCount) || raw.answerCount < 0 || raw.answerCount > 1e6) return void 0;
  return { answerCount: raw.answerCount, userCount: Number.isInteger(raw.userCount) && raw.userCount >= 0 ? raw.userCount : null, ...typeof raw.lastAnswerId === "string" && /^[\w-]{1,100}$/.test(raw.lastAnswerId) ? { lastAnswerId: raw.lastAnswerId } : {}, ...typeof raw.lastAnswerHash === "string" && /^[a-f0-9]{8}$/.test(raw.lastAnswerHash) ? { lastAnswerHash: raw.lastAnswerHash } : {}, ...typeof raw.conversationKey === "string" && /^[a-f0-9]{8}$/.test(raw.conversationKey) ? { conversationKey: raw.conversationKey } : {} };
}
function normalizeWebAI(raw, recover = false) {
  const topics = (Array.isArray(raw?.topics) ? raw.topics : []).slice(-100).filter((t) => typeof t?.id === "string" && t.id.length <= 120).map((t) => ({ id: t.id, title: clean(t.title, 120) || "未命名问题", createdAt: stamp(t.createdAt), version: Number.isSafeInteger(t.version) && t.version >= 0 ? t.version : 0, ...t.updatedAt ? { updatedAt: stamp(t.updatedAt) } : {}, ...t.deletedAt ? { deletedAt: stamp(t.deletedAt) } : {}, conversations: Object.fromEntries(WEB_AI_PROVIDERS.flatMap((p) => {
    const u = webAIConversationUrl(p.id, t.conversations?.[p.id]);
    return u ? [[p.id, u]] : [];
  })) }));
  const ids = new Set(topics.map((t) => t.id)), roundIds = /* @__PURE__ */ new Set();
  const rounds = (Array.isArray(raw?.rounds) ? raw.rounds : []).slice(-300).filter((r) => typeof r?.id === "string" && r.id.length <= 120 && ids.has(r.topicId) && !roundIds.has(r.id) && !!roundIds.add(r.id)).map((r) => ({ id: r.id, requestId: clean(r.requestId, 120), topicId: r.topicId, question: clean(r.question, 12e3), ...typeof r.displayQuestion === "string" && r.displayQuestion.trim() ? { displayQuestion: clean(r.displayQuestion, 12e3) } : {}, ...Array.isArray(r.attachments) && r.attachments.length ? { attachments: (() => {
    try {
      return normalizeWebAIAttachments(r.attachments);
    } catch {
      return [];
    }
  })() } : {}, createdAt: stamp(r.createdAt), answers: WEB_AI_PROVIDERS.flatMap((p) => {
    const a = (Array.isArray(r.answers) ? r.answers : []).find((a2) => a2?.providerId === p.id);
    if (!a) return [];
    let status = ["queued", "preparing", "prepared", "generating", "completed", "needs_login", "unsupported", "uncertain", "cancelled"].includes(a.status) ? a.status : "uncertain";
    const draftNeedsReview = recover && status === "prepared", interrupted = recover && WEB_AI_ACTIVE.has(status);
    if (interrupted || draftNeedsReview) status = "uncertain";
    return [{ providerId: p.id, status, text: clean(a.text, 6e4), url: webAIConversationUrl(p.id, a.url), ...normalizeWebAICapture(a.capture) ? { capture: normalizeWebAICapture(a.capture) } : {}, note: draftNeedsReview ? "应用已重启，请核对官网草稿和发送状态；不会自动重新填入或发送。" : interrupted ? "运行曾中断，请在官网核对；不会自动重复发送。" : clean(a.note, 300), updatedAt: stamp(a.updatedAt) }];
  }) }));
  return { topics, rounds, chatgptEnabled: raw?.chatgptEnabled === true };
}

// src/client/features/web-ai/history.ts
var localQuestion = (round) => round.displayQuestion || round.question;
function searchWebAIHistory(state, query, deleted = false) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return state.topics.filter((t) => !!t.deletedAt === deleted).flatMap((topic) => {
    const rounds = state.rounds.filter((r) => r.topicId === topic.id);
    const segments = [topic.title, ...rounds.flatMap((r) => [localQuestion(r), r.question, ...(r.attachments || []).map((f) => f.name), ...r.answers.flatMap((a) => [webAIProvider(a.providerId).name, a.text])])];
    const text = segments.join("\n").toLocaleLowerCase();
    if (!terms.every((term) => text.includes(term))) return [];
    const match = segments.find((s) => terms.length && terms.some((term) => s.toLocaleLowerCase().includes(term))) || rounds.at(-1)?.displayQuestion || rounds.at(-1)?.question || "暂无问题";
    const start = terms.length ? Math.max(0, match.toLocaleLowerCase().indexOf(terms[0]) - 24) : 0;
    const updatedAt = [topic.updatedAt || topic.createdAt, ...rounds.flatMap((r) => [r.createdAt, ...r.answers.map((a) => a.updatedAt)])].sort().at(-1);
    return [{ topic, count: rounds.length, updatedAt, preview: (start ? "…" : "") + match.slice(start, start + 130) }];
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.topic.id.localeCompare(b.topic.id));
}

// src/client/features/web-ai/HistoryManager.tsx
var SIZE = 10;
function HistoryManager({ state, selected, disabled, onSelect, onManage, onClose }) {
  const [query, setQuery] = React46.useState(""), [trash, setTrash] = React46.useState(false), [page, setPage] = React46.useState(0), [action, setAction] = React46.useState(null), [title, setTitle] = React46.useState(""), [pending, setPending] = React46.useState(false), [error, setError] = React46.useState("");
  const rows = React46.useMemo(() => searchWebAIHistory(state, query, trash), [state, query, trash]), index = Math.min(page, Math.max(0, Math.ceil(rows.length / SIZE) - 1));
  const change = (next) => {
    setTrash(next);
    setPage(0);
    setError("");
  };
  const perform = async (request) => {
    setPending(true);
    setError("");
    try {
      await onManage(request);
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "历史操作失败");
    } finally {
      setPending(false);
    }
  };
  const begin = (topic, kind) => {
    setAction({ topic, kind });
    setTitle(topic.title);
    setError("");
  };
  const count = state.rounds.filter((r) => r.topicId === action?.topic.id).length;
  return /* @__PURE__ */ React46.createElement("section", { className: "wb-web-history", "aria-label": "本地问答历史" }, /* @__PURE__ */ React46.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React46.createElement("strong", null, "本地问答历史"), /* @__PURE__ */ React46.createElement(Btn, { kind: !trash ? "primary" : "ghost", disabled: pending, onClick: () => change(false) }, "历史（", state.topics.filter((t) => !t.deletedAt).length, "）"), /* @__PURE__ */ React46.createElement(Btn, { kind: trash ? "primary" : "ghost", disabled: pending, onClick: () => change(true) }, "回收站（", state.topics.filter((t) => t.deletedAt).length, "）"), /* @__PURE__ */ React46.createElement(Btn, { onClick: onClose }, "收起历史")), /* @__PURE__ */ React46.createElement(Input, { "aria-label": "搜索历史问答", placeholder: "搜索标题、问题、回答、附件名或厂商", value: query, onChange: (e) => {
    setQuery(e.target.value);
    setPage(0);
  } }), /* @__PURE__ */ React46.createElement("p", { className: "wb-tiny wb-muted" }, "共", rows.length, "组 · 本地搜索，不调用模型。", trash ? "永久删除后无法恢复。" : "删除后可从回收站恢复，不影响官网对话。"), error && !action && /* @__PURE__ */ React46.createElement("p", { role: "alert", className: "wb-web-error" }, error), !rows.length && /* @__PURE__ */ React46.createElement("p", { className: "wb-tiny wb-muted" }, query ? "没有匹配的问答" : trash ? "回收站为空" : "暂无历史问答"), rows.slice(index * SIZE, (index + 1) * SIZE).map(({ topic, count: count2, updatedAt, preview }) => /* @__PURE__ */ React46.createElement("article", { key: topic.id, "aria-label": topic.title, className: "wb-web-history-item" + (selected === topic.id ? " is-selected" : "") }, /* @__PURE__ */ React46.createElement("div", { className: "wb-web-history-content" }, /* @__PURE__ */ React46.createElement("strong", null, topic.title), /* @__PURE__ */ React46.createElement("p", { className: "wb-tiny wb-muted" }, count2, "轮 · ", new Date(updatedAt).toLocaleString()), /* @__PURE__ */ React46.createElement("p", { className: "wb-tiny" }, preview)), /* @__PURE__ */ React46.createElement("div", { className: "wb-row wb-row--wrap wb-web-history-actions" }, trash ? /* @__PURE__ */ React46.createElement(React46.Fragment, null, /* @__PURE__ */ React46.createElement(Btn, { disabled: disabled || pending, onClick: () => void perform({ topicId: topic.id, expectedVersion: topic.version || 0, action: "restore" }) }, "恢复问答"), /* @__PURE__ */ React46.createElement(Btn, { disabled: disabled || pending, onClick: () => begin(topic, "purge") }, "永久删除")) : /* @__PURE__ */ React46.createElement(React46.Fragment, null, /* @__PURE__ */ React46.createElement(Btn, { "aria-label": "打开问答 " + topic.title, disabled: disabled || pending, onClick: () => onSelect(topic.id) }, "打开"), /* @__PURE__ */ React46.createElement(Btn, { "aria-label": "重命名问答 " + topic.title, disabled: disabled || pending, onClick: () => begin(topic, "rename") }, "重命名"), /* @__PURE__ */ React46.createElement(Btn, { "aria-label": "删除问答 " + topic.title, disabled: disabled || pending, onClick: () => begin(topic, "trash") }, "删除"))))), rows.length > SIZE && /* @__PURE__ */ React46.createElement("nav", { className: "wb-row", "aria-label": "历史分页", style: { gap: 8 } }, /* @__PURE__ */ React46.createElement(Btn, { disabled: !index, onClick: () => setPage(index - 1) }, "历史上一页"), /* @__PURE__ */ React46.createElement("span", { className: "wb-tiny" }, index + 1, " / ", Math.ceil(rows.length / SIZE)), /* @__PURE__ */ React46.createElement(Btn, { disabled: (index + 1) * SIZE >= rows.length, onClick: () => setPage(index + 1) }, "历史下一页")), /* @__PURE__ */ React46.createElement(Modal, { open: !!action, title: action?.kind === "rename" ? "重命名本地问答" : action?.kind === "purge" ? "永久删除本地问答" : "删除本地问答", width: 480, onClose: () => {
    if (!pending) {
      setAction(null);
      setError("");
    }
  } }, action?.kind === "rename" ? /* @__PURE__ */ React46.createElement(Field, { label: "问答名称" }, /* @__PURE__ */ React46.createElement(Input, { "aria-label": "问答名称", value: title, onChange: (e) => setTitle(e.target.value) })) : /* @__PURE__ */ React46.createElement("p", null, action?.kind === "purge" ? "将永久删除" : "将移入回收站：", "「", action?.topic.title, "」及其", count, "轮本地问答。", action?.kind === "purge" ? "此操作无法恢复。" : "可在回收站恢复。", "不会删除厂商官网对话、登录信息或已存为知识的内容。"), error && action && /* @__PURE__ */ React46.createElement("p", { role: "alert", className: "wb-web-error" }, error), /* @__PURE__ */ React46.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React46.createElement(Btn, { disabled: pending, onClick: () => {
    setAction(null);
    setError("");
  } }, "取消"), /* @__PURE__ */ React46.createElement(Btn, { kind: "primary", disabled: pending || disabled || action?.kind === "rename" && (!title.trim() || title.trim().length > 120), onClick: () => {
    if (action) void perform({ topicId: action.topic.id, expectedVersion: action.topic.version || 0, action: action.kind, title, confirm: true });
  } }, pending ? "处理中…" : action?.kind === "rename" ? "保存名称" : action?.kind === "purge" ? "确认永久删除" : "确认移入回收站"))));
}

// src/client/features/web-ai/QuestionEditor.tsx
var React47 = __toESM(require("react"), 1);
function QuestionEditor({ round, onSave, onClose }) {
  const [text, setText] = React47.useState(localQuestion(round)), [busy, setBusy] = React47.useState(false), [error, setError] = React47.useState("");
  return /* @__PURE__ */ React47.createElement(Modal, { open: true, title: "编辑本地问题", width: 600, onClose: () => {
    if (!busy) onClose();
  } }, /* @__PURE__ */ React47.createElement("p", { className: "wb-tiny wb-muted" }, "只修改本地显示。官网原提问和回答采集依据保留，追问仍使用原官网会话。"), /* @__PURE__ */ React47.createElement(Textarea, { "aria-label": "本地问题正文", rows: 6, value: text, onChange: (e) => setText(e.target.value) }), error && /* @__PURE__ */ React47.createElement("p", { role: "alert", className: "wb-web-error" }, error), /* @__PURE__ */ React47.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React47.createElement(Btn, { disabled: busy, onClick: () => setText(round.question) }, "恢复原问题"), /* @__PURE__ */ React47.createElement(Btn, { disabled: busy, onClick: onClose }, "取消"), /* @__PURE__ */ React47.createElement(Btn, { kind: "primary", disabled: busy || !text.trim() || text.length > 12e3, onClick: async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(text);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  } }, "保存本地问题")));
}

// src/client/features/web-ai/WebAIPage.tsx
var React50 = __toESM(require("react"), 1);

// src/client/features/web-ai/NativeWebsite.tsx
var React48 = __toESM(require("react"), 1);

// src/shared/web-ai-adapters.ts
var WEB_AI_ADAPTERS = {
  kimi: { composer: ".chat-editor", uploadInputs: ['.chat-editor input[type="file"]'], done: [".segment-assistant-actions-content:has(svg)"], ready: [".chat-editor .send-button-container .send-icon"], roots: [".segment-assistant", '[data-message-author-role="assistant"]'], inputs: ['.chat-input-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', "textarea"], send: [".chat-editor .send-button-container", ".send-button", 'button[aria-label="Send"]'], answers: [".segment-assistant .markdown", ".segment-assistant .markdown-container", '[data-message-author-role="assistant"]'], users: [".segment-user .user-content__text", ".segment-user", '[data-message-author-role="user"]'], busy: [".stop-button", '[data-testid="stop-button"]'] },
  glm: { composer: ".search-box-wrapper", uploadInputs: [".upload-popover .el-upload__input"], done: [".export-icon"], roots: [".answer", ".answer-content-wrap", ".message-assistant", '[data-role="assistant"]', '[data-message-author-role="assistant"]'], inputs: ["#search-input-box textarea", "textarea", '[contenteditable="true"][role="textbox"]'], send: ["#search-input-box .enter-icon-container:not(.empty) .enter_icon", "#search-input-box .enter-icon-container:not(.empty)", 'button[aria-label="发送"]', '[data-testid="send-button"]'], answers: [".answer-content-wrap .markdown-body", ".message-assistant .markdown-body", '[data-role="assistant"]', '[data-message-author-role="assistant"]'], users: ['[data-role="user"]', '[data-message-author-role="user"]'], busy: ['[data-testid="stop-button"]', '[aria-label="停止对话"]', '[title="停止对话"]'] },
  doubao: { uploadDirect: 'button[data-testid="upload_file_button"]', composer: ".guidance-input-surface", roots: ['[data-testid="receive_message"]', '[data-message-author-role="assistant"]'], inputs: ["#input-engine-container textarea", "textarea"], send: ["#flow-end-msg-send", '[data-testid="chat_input_send_button"]'], answers: ['[data-testid="receive_message"] [data-testid="message_text_content"]', '[data-testid="receive_message"] .md-box-root', '[data-message-author-role="assistant"]'], users: ['[data-testid="send_message"] [data-testid="message_text_content"]', '[data-testid="send_message"]', '[data-message-author-role="user"]'], busy: ['[data-testid="chat_input_stop_button"]'] },
  yuanbao: { uploadLaunch: { trigger: 'button[aria-label="Add"]', imageLabels: ["Upload Image", "上传图片", "图片"], fileLabels: ["Local Files", "本地文件", "上传文件"] }, uploadMethod: "drop", composer: ".app-search-bar", done: ['.agent-chat__conv--ai__toolbar [aria-label="重新生成"]', '.agent-chat__conv--ai__toolbar [title="重新生成"]'], roots: [".agent-chat__bubble--ai", '[data-message-author-role="assistant"]'], inputs: ['.ql-editor[contenteditable="true"]', "textarea", '[contenteditable="true"][role="textbox"]'], send: ["#yuanbao-send-btn", 'button[aria-label="发送"]', 'button[aria-label="Send"]'], answers: [".agent-chat__bubble--ai .hyc-content-md", ".agent-chat__bubble--ai .markdown", '[data-message-author-role="assistant"]'], users: [".agent-chat__bubble--human .hyc-content-text", ".agent-chat__bubble--human", '[data-message-author-role="user"]'], busy: ['[data-testid="stop-button"]'] },
  qianwen: { composer: ".bg-capsule", uploadMethod: "drop", roots: ['[class*="message-select-wrapper-answer-"]', ".message-assistant", ".chat-message-assistant", '[data-message-author-role="assistant"]'], inputs: ['[contenteditable="true"][data-slate-editor="true"]', "textarea"], send: ['button[aria-label="发送消息"]', 'button[title="发送消息"]', 'button[aria-label="发送"]'], answers: ['[class*="message-select-wrapper-answer-"] .qk-markdown', ".message-assistant .markdown", ".chat-message-assistant .markdown", '[data-message-author-role="assistant"]'], users: [".message-card-wrap.question", ".message-user", '[data-message-author-role="user"]'], busy: ['button[aria-label="停止生成"]', '[data-testid="stop-button"]'], finished: [".qk-markdown-complete"] },
  chatgpt: { uploadInputs: ['input[type="file"][aria-label="Attach files"]'], composer: 'form,[class*="ComposerLayoutRoot-"]', done: ['.turn-action-controls button[aria-label="Read aloud"]', '.turn-action-controls button[title="Read aloud"]', '.turn-action-controls button[aria-label="Regenerate response"]', '.turn-action-controls button[title="Regenerate response"]', '.turn-action-controls button[aria-label="重新生成"]'], roots: ['[data-message-author-role="assistant"]', '[class~="group/assistant-message"]', '.group:has(> .turn-action-controls button[aria-label="Read aloud"])', '.group:has(> .turn-action-controls button[title="Read aloud"])', '.group:has(> .turn-action-controls button[aria-label="Regenerate response"])', '.group:has(> .turn-action-controls button[title="Regenerate response"])', '.group:has(> .turn-action-controls button[aria-label="重新生成"])'], inputs: ["#prompt-textarea", '.ProseMirror[contenteditable]:not([contenteditable="false"])', '[contenteditable][role="textbox"][aria-label="Ask ChatGPT"]:not([contenteditable="false"])'], send: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send"]', 'button[aria-label="发送"]'], answers: ['[data-message-author-role="assistant"] .markdown', '[data-message-author-role="assistant"]', '[class~="group/assistant-message"] .markdown', '[class~="group/assistant-message"] .prose', "[data-chatgpt-selection-message-id] [data-markdown-text-style]"], fallbackAnswers: ['.group:has(> .turn-action-controls button[aria-label="Read aloud"])', '.group:has(> .turn-action-controls button[title="Read aloud"])', '.group:has(> .turn-action-controls button[aria-label="Regenerate response"])', '.group:has(> .turn-action-controls button[title="Regenerate response"])', '.group:has(> .turn-action-controls button[aria-label="重新生成"])'], users: ['[data-message-author-role="user"]', ".bg-user-message", '[class~="group/user-message"]'], busy: ['button[data-testid="stop-button"]', 'button[aria-label="Stop streaming"]'] }
};

// src/shared/web-ai-observation.ts
function observeWebAIPage(req) {
  const visible = (el) => {
    if (!el.getClientRects().length && getComputedStyle(el).display !== "contents" || el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || s.opacity === "0") return false;
      if (node.matches(".sr-only,.visually-hidden,.screen-reader-only")) return false;
      if (s.display !== "contents") {
        const r = node.getBoundingClientRect();
        if (/hidden|clip/.test(s.overflowY) && r.height === 0 || /hidden|clip/.test(s.overflowX) && r.width === 0) return false;
      }
    }
    return true;
  };
  const text = (el) => (el.innerText || el.textContent || "").trim();
  const order = (a, b) => a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  const find = (selectors, root = document) => [...new Set(selectors.flatMap((s) => [...root.querySelectorAll(s)]))].filter(visible).sort(order);
  const innermost = (elements) => elements.filter((el) => !elements.some((other) => other !== el && el.contains(other)));
  const outermost = (elements) => elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
  const enabled = (el) => !el.matches(":disabled") && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true" && ![...el.classList].some((t) => /^(?:is-|btn-|button-|send-button-)?disabled$/.test(t));
  const buttons = find(["button", '[role="button"]']);
  const label = (el) => [el.getAttribute("aria-label"), el.getAttribute("title"), text(el)].filter(Boolean).join(" ").trim();
  const stopping = find(req.adapter.busy).length > 0 || buttons.some((el) => /停止生成|停止回答|停止输出|停止对话|stop generating|stop response|stop streaming|^停止$|^Stop$/i.test(label(el)));
  const dialogs = find(['[role="dialog"]', "dialog", '[class*="login-modal"]', '[class*="loginModal"]']);
  const verification = find(["#aliyunCaptcha-window-popup", "#aliyunCaptcha-popup", ".baxia-dialog", 'iframe[src*="baxia"]', 'iframe[src*="captcha"]', 'iframe[src*="/_____tmd_____"]', '[class*="geetest_panel"]', '[class*="captcha-modal"]']).at(0);
  const login = verification || dialogs.find((el) => /登录|sign in|log in/i.test(text(el)) && !!el.querySelector('input[type="tel"],input[type="password"],input[autocomplete="one-time-code"],input[autocomplete="username"],iframe[src*="login"],[class*="qrcode"],[class*="qr-code"]'));
  const blockedDialog = dialogs.find((el) => el !== login);
  const usable = (el) => !el.closest('[role="dialog"]') && !el.hasAttribute("disabled") && !(req.providerId === "chatgpt" && el.id === "pending-home-input");
  const preferred = find(req.adapter.inputs).filter(usable);
  const editors = (preferred.length ? preferred : find(["textarea:not([disabled])", '[contenteditable="true"]'])).filter(usable);
  const editor = editors.length === 1 ? editors[0] : null;
  let draft = editor ? "value" in editor ? String(editor.value) : text(editor).replace(/[\u200b\ufeff]/g, "") : "";
  if (editor && !("value" in editor)) {
    for (const p of editor.querySelectorAll("[data-slate-placeholder],[data-lexical-placeholder]")) draft = draft.replace(text(p), "");
    draft = draft.trim();
  }
  const composerScopes = [];
  if (editor) for (let node = editor.parentElement; node && node !== document.body && composerScopes.length < 9; node = node.parentElement) {
    if (req.adapter.answers.some((selector) => node.querySelector(selector))) break;
    composerScopes.push(node);
    if (req.adapter.send.some((selector) => node.querySelector(selector))) break;
  }
  const explicitComposer = req.adapter.composer ? editor?.closest(req.adapter.composer) : null;
  const composer = explicitComposer || composerScopes.at(-1) || editor?.parentElement || null;
  const attachmentNodes = composer ? find(["*"], composer).filter((el) => !el.contains(editor) && !editor?.contains(el) && !el.closest("nav,aside") && !el.matches("input,textarea,script,style")) : [];
  const qianwenFileImage = (el) => req.providerId === "qianwen" && el.matches("img") && !!el.closest('[class*="imageThumbWrapper-"]') && !!el.closest('[class*="fileWrap-"]');
  const previewImages = attachmentNodes.filter((el) => qianwenFileImage(el) || (el.matches("img") || /url\(/.test(getComputedStyle(el).backgroundImage)) && !/icon|avatar|头像|profile/i.test([el.getAttribute("class"), el.getAttribute("alt"), el.getAttribute("aria-label"), el.getAttribute("title")].filter(Boolean).join(" ")) && !/^(?:txt|pdf|docx?|xlsx?|pptx?)$/i.test(el.getAttribute("alt") || "") && !/\/(?:txt|pdf|docx?|xlsx?|pptx?)[_-](?:normal|icon)/i.test(el.getAttribute("src") || ""));
  const filePreviewNodes = attachmentNodes.filter((el) => previewImages.includes(el) || /file|attach/i.test(el.getAttribute("class") || el.getAttribute("data-testid") || "") && /\.(?:png|jpe?g|webp|gif|txt|md|csv|json|log|pdf|docx?|xlsx?|pptx?)(?:$|[\s）)])/i.test(text(el)));
  const documentPreviews = attachmentNodes.filter((el) => /\b(?:TXT|PDF|MD|CSV|JSON|DOCX?|XLSX?|PPTX?)\s+\d+(?:\.\d+)?\s*(?:Bytes|B|KB|MB|GB)\b/i.test(text(el)));
  const attachmentPreviews = outermost([.../* @__PURE__ */ new Set([...filePreviewNodes, ...documentPreviews])]);
  const hasAttachmentDraft = attachmentPreviews.length > 0;
  const ignored = 'script,style,button,[role="button"],svg,nav,aside,[hidden],[aria-hidden="true"],.thinking-content,.reasoning-content,.think-content,[data-role="reasoning"],[data-testid="thinking"]';
  const render = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof Element) || node.matches(ignored) || !visible(node)) return "";
    if (node.matches(".cm-content")) return "\n\n```\n" + [...node.children].filter((el) => el.classList.contains("cm-line")).map((el) => el.textContent || "").join("\n").replace(/\u00a0/g, " ") + "\n```\n\n";
    if (node.tagName === "PRE") {
      const code = node.querySelector("code"), language = code?.className.match(/language-([\w+-]+)/)?.[1] || "";
      const source = code || node, copy = source.cloneNode(true);
      for (const el of copy.querySelectorAll("*")) if (el.matches('button,svg,[role="button"],[aria-hidden="true"]') || /line[-_]?numbers?|linenumber|lineno/i.test(el.getAttribute("class") || "")) el.remove();
      return "\n\n```" + language + "\n" + (copy.textContent || "").replace(/\u00a0/g, " ").trimEnd() + "\n```\n\n";
    }
    if (node.tagName === "BR") return "\n";
    const content = [...node.childNodes].map(render).join("");
    if (node.tagName === "A") {
      try {
        const url = new URL(node.getAttribute("href") || "", location.href);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && content.trim()) return "[" + content.trim() + "](" + url.href + ")";
      } catch {
      }
    }
    if (/^H[1-6]$/.test(node.tagName)) return "\n\n" + "#".repeat(Number(node.tagName[1])) + " " + content.trim() + "\n\n";
    if (node.tagName === "LI") {
      const list = node.parentElement;
      if (list?.tagName === "OL") {
        const items = [...list.children].filter((el) => el.tagName === "LI"), step = list.hasAttribute("reversed") ? -1 : 1;
        let number = Number(list.getAttribute("start") || (step < 0 ? items.length : 1));
        for (const item of items) {
          if (item.hasAttribute("value")) number = Number(item.getAttribute("value"));
          if (item === node) break;
          number += step;
        }
        return "\n" + number + ". " + content.trim();
      }
      return "\n- " + content.trim();
    }
    if (node.tagName === "TR") return "\n" + [...node.children].map((el) => render(el).trim()).join(" | ");
    if (node.tagName === "CODE") return "`" + content + "`";
    return /^(P|DIV|SECTION|UL|OL|TABLE|BLOCKQUOTE)$/.test(node.tagName) ? "\n" + content + "\n" : content;
  };
  const bodyText = (el) => render(el).trim();
  const users = innermost(find(req.adapter.users).filter((el) => !el.closest("nav,aside")));
  const primary2 = find(req.adapter.answers);
  const bodies = [...primary2, ...find(req.adapter.fallbackAnswers || []).filter((root) => !primary2.some((body) => root.contains(body)))].sort(order).filter((el) => !el.closest('nav,aside,.thinking-content,.reasoning-content,.think-content,[data-role="reasoning"]'));
  const groups = /* @__PURE__ */ new Map();
  for (const body of bodies) {
    const root = (req.adapter.roots || []).map((s) => body.closest(s)).find(Boolean) || body;
    groups.set(root, [...groups.get(root) || [], body]);
  }
  const roots = [...groups.keys()].sort(order);
  const fingerprint = (value) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const observations = window.__workbenchWebAIObservations || (window.__workbenchWebAIObservations = { nodes: /* @__PURE__ */ new WeakMap(), next: 0, prefix: Math.round(performance.timeOrigin).toString(36) });
  const identity = (el) => {
    const key2 = el.getAttribute("data-message-id") || el.closest("[data-turn-key]")?.getAttribute("data-turn-key") || el.closest("[data-content-search-turn-key]")?.getAttribute("data-content-search-turn-key");
    if (key2 && key2.length <= 300) {
      const value = req.providerId + "|" + location.pathname + "|" + key2;
      return "site-" + fingerprint(value) + fingerprint(value.split("").reverse().join(""));
    }
    let id = observations.nodes.get(el);
    if (!id) {
      id = observations.prefix + "-" + ++observations.next;
      observations.nodes.set(el, id);
    }
    return id;
  };
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  const finishedSelector = ['[data-streaming="false"]', '[data-is-streaming="false"]', '[data-status="completed"]', '[data-status="finished"]', ...req.adapter.finished || []].join(",");
  const turns = roots.map((root, ordinal) => {
    const user = users.filter((el) => root.contains(el) || !!(el.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
    const question = user ? text(user) : null, userIndex = user ? users.indexOf(user) : null;
    const selected = ordinal >= roots.length - 8 || !!req.question && !!question && normalize(question) === normalize(req.question);
    if (!selected) return null;
    const content = outermost(groups.get(root)).map(bodyText).filter(Boolean).join("\n\n");
    const scopedFinish = (el) => {
      for (let node = el; node && node !== root.parentElement; node = node.parentElement) if (node.matches(finishedSelector)) return true;
      return false;
    };
    const parts = groups.get(root), attribute = scopedFinish(root) || outermost(parts).every(scopedFinish);
    const scope = (req.adapter.endScope ? root.closest(req.adapter.endScope) : null) || root;
    const composerReady = !req.adapter.ready?.length || find(req.adapter.ready).length > 0;
    const endControl = composerReady && (req.adapter.done || []).some((selector) => find([selector], scope).some(enabled));
    const completionEvidence = attribute ? "attribute" : endControl ? "turn-control" : null;
    return { id: identity(root), ordinal, question, userIndex, text: content.slice(0, 6e4), truncated: content.length > 6e4, complete: !stopping && !!completionEvidence, completionEvidence };
  }).filter((t) => t !== null);
  const last = turns.at(-1);
  const attachmentSignature = hasAttachmentDraft ? fingerprint(attachmentPreviews.map((el) => text(el) + "|" + (el.getAttribute("src") || "") + "|" + getComputedStyle(el).backgroundImage).join("||") + "|images|" + previewImages.map((el) => (el.getAttribute("src") || "") + "|" + getComputedStyle(el).backgroundImage).join("||")) : "";
  const attachmentsOwned = !!attachmentSignature && (window.__workbenchOwnedAttachments === attachmentSignature || req.ownedAttachmentSignature === attachmentSignature);
  const state = { status: login ? "needs_login" : blockedDialog ? "unsupported" : stopping ? "generating" : editor ? "ready" : "unsupported", note: login ? verification ? "官网需要本人完成安全验证，请在原页面处理；本轮不会自动重发。" : "请在官网完成登录。" : blockedDialog ? "官网有弹窗，请先在原页面处理后再试。" : !editor ? req.providerId === "chatgpt" && document.querySelector("#pending-home-input") ? "官网编辑器仍在初始化，请稍后重试。" : "尚未识别唯一的官网输入框，可直接在网页聊天。" : "", url: location.href, answers: turns.slice(-8).map((t) => t.text), answerCount: roots.length, userCount: users.length, lastQuestion: users.length ? text(users.at(-1)).slice(0, 12e3) : null, complete: last?.complete === true, completionEvidence: last?.completionEvidence || null, busy: stopping, hasDraft: !!draft, draftMatchesQuestion: !!editor && draft === req.question, answerSupported: roots.length > 0, editorCount: editors.length, hasAttachmentDraft, attachmentSignature, attachmentsOwned, turns };
  state.conversationKey = fingerprint(location.pathname + "?" + [...new URLSearchParams(location.search)].filter(([key2]) => ["chatId", "conversationId", "conversation_id", "sessionId", "dialogueId", "cid"].includes(key2)).map(([k, v]) => k + "=" + v).join("&"));
  state.lastAnswerId = last?.id || null;
  state.lastAnswerHash = last ? fingerprint(last.text) : null;
  if (req.action === "inspect") {
    const describe = (el) => ({ tag: el.tagName.toLowerCase(), class: (el.getAttribute("class") || "").slice(0, 160), id: el.id.slice(0, 80), testId: el.getAttribute("data-testid") || "", role: el.getAttribute("role") || "", label: (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "").slice(0, 80), icon: (el.getAttribute("src") || "").match(/([^/?#]+\.(?:svg|png|webp))(?:[?#].*)?$/i)?.[1]?.slice(0, 80) || el.getAttribute("href")?.match(/^#[\w-]+$/)?.[0] || "", disabled: !enabled(el) });
    const ancestry = (el) => {
      const out = [];
      for (let p = el.parentElement; p && out.length < 6; p = p.parentElement) out.push({ tag: p.tagName.toLowerCase(), class: (p.getAttribute("class") || "").slice(0, 90), role: p.getAttribute("role") || "" });
      return out;
    };
    const parents = [];
    for (let p = editor?.parentElement; p && parents.length < 6; p = p.parentElement) parents.push(p);
    const area = composer || parents.at(-1);
    const controls = area ? find(["button", '[role="button"]', '[class*="send"]', '[class*="Send"]', "img"], area).slice(0, 30).map(describe) : [];
    const samples = roots.length ? roots.slice(-2) : outermost(find(['[class*="markdown"]', '[class*="assistant-message"]'])).slice(-2);
    const messages = samples.map((el) => ({ ...describe(el), parents: ancestry(el) }));
    const finalControls = find(["button", '[role="button"]', "[title]", "[aria-label]", ".simple-button"]).filter((el) => !el.closest("nav,aside") && /复制|赞|重试|重新生成|copy|regenerate|good response|bad response|read aloud/i.test(label(el))).slice(-25).map((el) => ({ ...describe(el), parents: ancestry(el) }));
    const answerWidgets = samples.flatMap((root) => find(["button", '[role="button"]', "img", "svg", "use", "[aria-label]", "[title]", ".simple-button", '[class*="action"]', '[class*="toolbar"]'], (req.adapter.endScope ? root.closest(req.adapter.endScope) : null) || root).slice(-30).map(describe));
    const contentFrames = find(["article", '[data-testid*="conversation-turn"]', '[class*="assistant"]', '[class*="thread-turn"]', '[class*="prose"]', '[class*="message-content"]']).filter((el) => !el.contains(editor) && !el.closest("nav,aside")).slice(-12).map((el) => ({ ...describe(el), children: [...el.children].slice(0, 4).map((child) => ({ tag: child.tagName.toLowerCase(), class: (child.getAttribute("class") || "").slice(0, 90) })) }));
    const bodyParts = samples.flatMap((root) => (groups.get(root) || []).map((el) => ({ ...describe(el), length: text(el).length, parents: ancestry(el) })));
    const codeShapes = samples.flatMap((root) => find(["pre", ".cm-content"], root).slice(-2).flatMap((pre) => [pre, ...pre.querySelectorAll("*")].slice(0, 25).map(describe)));
    const terminal = buttons.filter((el) => /regenerate response|重新生成|regenerate|read aloud/i.test(label(el))).at(-1);
    const endAncestors = [];
    for (let node = terminal?.parentElement; node && endAncestors.length < 8; node = node.parentElement) endAncestors.push({ ...describe(node), rawLength: text(node).length, attributes: [...node.attributes].map((a) => a.name).filter((n) => n.startsWith("data-")), children: [...node.children].slice(0, 5).map((el) => ({ tag: el.tagName.toLowerCase(), class: (el.getAttribute("class") || "").slice(0, 80), length: text(el).length, display: getComputedStyle(el).display })) });
    const userStructure = users.at(-1) ? [users.at(-1), ...users.at(-1).querySelectorAll("*")].slice(0, 12).map(describe) : [];
    const inputVariants = find(["textarea", "[contenteditable]"]).slice(0, 8).map((el) => ({ ...describe(el), editable: el.getAttribute("contenteditable") }));
    const fileInputs = [...document.querySelectorAll('input[type="file"]')].map((el) => ({ ...describe(el), accept: el.getAttribute("accept") || "", multiple: el.hasAttribute("multiple"), parents: ancestry(el) }));
    const uploadControls = (composer ? find(["button", '[role="button"]', "[title]", "[aria-label]"], composer) : []).filter((el) => /上传|附件|文件|图片|attach|upload|add files/i.test(label(el))).slice(-12).map((el) => ({ ...describe(el), parents: ancestry(el) }));
    const attachmentShapes = [...document.querySelectorAll('img,canvas,[role="img"],[style*="background-image"]')].filter((el) => visible(el) && !el.closest("nav,aside")).slice(-16).map((el) => ({ ...describe(el), insideComposer: !!composer?.contains(el), parents: ancestry(el), backgroundImage: /url\(/.test(getComputedStyle(el).backgroundImage) }));
    const uploadLabels = [...req.adapter.uploadLaunch?.imageLabels || [], ...req.adapter.uploadLaunch?.fileLabels || []];
    const uploadMenuItems = [...document.querySelectorAll('[role^="menuitem"],[role="menu"] *')].filter((el) => uploadLabels.some((value) => text(el).startsWith(value))).slice(-10).map((el) => ({ ...describe(el), visible: visible(el), label: text(el).slice(0, 80) }));
    state.diagnostics = { composer: composer ? describe(composer) : null, filePreviews: filePreviewNodes.slice(0, 12).map(describe), fileInputs, uploadControls, uploadMenuItems, attachmentShapes, editorCount: editors.length, editor: editor ? describe(editor) : null, parents: parents.map(describe), controls, messages, userStructure, inputVariants, finalControls, answerWidgets, contentFrames, endAncestors, bodyParts, codeShapes, turnSummary: turns.slice(-3).map(({ text: text2, question, ...t }) => ({ ...t, bodyLength: text2.length, questionIdentified: !!question })) };
  }
  return { state, editor, draft, buttons, find, innermost, text, login, blockedDialog, stopping, composer, attachmentNodes, previewImages };
}

// src/shared/web-ai-upload.ts
function webAIUploadScript(providerId, action, files, question, requestId, ownedAttachmentSignature = "") {
  normalizeWebAIAttachments(files);
  const p = webAIProvider(providerId);
  const payload = { providerId, hosts: p.hosts, adapter: WEB_AI_ADAPTERS[p.id], action, files, question, requestId, ownedAttachmentSignature: /^[a-f0-9]{8}$/.test(ownedAttachmentSignature) ? ownedAttachmentSignature : "" };
  return "(" + uploadOnWebsite.toString() + ")(" + JSON.stringify(payload) + "," + observeWebAIPage.toString() + ")";
}
function uploadOnWebsite(req, observe) {
  if (location.protocol !== "https:" || !req.hosts.includes(location.hostname)) return { status: "unsupported", note: "当前不是所选官网，未上传附件" };
  const { state, editor, find, text, stopping, login, blockedDialog, innermost, composer, attachmentNodes, previewImages } = observe(req);
  if (login || blockedDialog || stopping || !editor) return { status: "unsupported", note: state.note || "请先在官网结束当前操作" };
  const key2 = "__workbenchWebAIUpload", all = window[key2] || (window[key2] = {}), record = all[req.requestId];
  const scope = composer || editor.parentElement || editor;
  const busy = find(['[role="progressbar"]', '[aria-busy="true"]', '[class*="uploading"]', '[class*="Uploading"]'], scope).length > 0 || /上传中|解析中|uploading|processing file/i.test(text(scope));
  const errors = find(['[role="alert"]', '[class*="toast"]', '[class*="Toast"]']).some((el) => /上传.{0,4}失败|解析失败|不支持.{0,12}格式|格式.{0,8}不支持|文件.{0,8}过大|upload failed|unsupported file|file too large|couldn.t upload/i.test(text(el)));
  const names = req.files.map((f) => f.name);
  const matching = req.files.filter((file) => attachmentNodes.some((el) => {
    const values = [text(el), el.getAttribute("title") || "", el.getAttribute("aria-label") || "", el.getAttribute("alt") || ""];
    const dot = file.name.lastIndexOf("."), escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const renamed = dot > 0 ? new RegExp(escape(file.name.slice(0, dot)) + "\\s*\\(\\d{1,4}\\)" + escape(file.name.slice(dot)) + '(?=$|[\\s）)»”"\\]])') : null;
    if (values.some((value) => value.includes(file.name) || !!renamed?.test(value))) return true;
    const display = (file.name.replace(/\.[^.]+$/, "") + " " + file.name.split(".").at(-1)).toLowerCase().replace(/\s+/g, " ");
    return values.some((value) => {
      const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
      return compact.startsWith(display + " ") && /\b\d+(?:\.\d+)?\s*(?:bytes|b|kb|mb|gb)\b/i.test(compact);
    });
  })).map((file) => file.name);
  const thumbs = previewImages.length;
  const send = innermost(find(req.adapter.send));
  const enabled = send.length === 1 && !send[0].matches(":disabled") && send[0].getAttribute("aria-disabled") !== "true" && ![...send[0].classList].some((c) => /^(?:is-|btn-|button-|send-button-)?disabled$|(?:^|_)disabled(?:_|$)/.test(c));
  const imageOnly = req.files.every((f) => f.type.startsWith("image/"));
  if (req.action === "attachment-verify") {
    const records = req.files.map((file) => all[req.requestId + ":" + file.id]);
    if (records.some((record2) => !record2)) return { status: "unsupported", note: "部分附件没有本轮上传记录，问题未发送" };
    const missingImages = req.files.filter((file) => file.type.startsWith("image/") && !matching.includes(file.name)).length;
    const docs = req.files.filter((file) => !file.type.startsWith("image/"));
    const received = docs.every((file) => matching.includes(file.name)) && (!missingImages || thumbs >= Math.min(...records.map((record2) => record2.thumbs)) + missingImages);
    return { status: !errors && received && !busy && enabled ? "attached" : "unsupported", signature: state.attachmentSignature, note: errors ? "官网提示附件上传失败，请检查原对话" : busy ? "附件仍在处理，问题未发送" : !received ? "官网未保留全部附件，问题未发送，请检查原对话" : !enabled ? "官网发送按钮未就绪，问题未发送" : "附件已全部就绪" };
  }
  if (req.action === "attachment-status") {
    if (!record) return { status: "unsupported", note: "网页已变化，无法确认附件；请在原对话核对，不自动重传" };
    const received = matching.length === names.length || imageOnly && thumbs >= record.thumbs + names.length;
    if (!errors && received && !busy && enabled) record.signature = state.attachmentSignature;
    return { status: errors ? "unsupported" : received && !busy && enabled ? "attached" : "uploading", note: errors ? "官网提示附件上传失败，请在原对话处理" : received ? "附件已出现在官网，等待就绪" : "等待官网显示附件", received, busy, matched: matching.length, thumbs, signature: state.attachmentSignature };
  }
  if (record) return { status: "uploading", note: "此轮已尝试上传，不重复传输" };
  const prefix = req.requestId.slice(0, req.requestId.lastIndexOf(":") + 1), ownsFiles = Object.keys(all).some((id) => id.startsWith(prefix));
  if ((state.hasAttachmentDraft || thumbs) && !ownsFiles && !state.attachmentsOwned || matching.length > 0 && !ownsFiles) return { status: "unsupported", note: "官网已有附件草稿或同名文件，未覆盖或重复上传，请在原对话处理" };
  if (state.hasDraft && !state.draftMatchesQuestion) return { status: "unsupported", note: "官网有其他草稿，未上传附件" };
  const candidates = (req.adapter.uploadInputs || []).flatMap((s) => [...document.querySelectorAll(s)]).filter((el) => !el.disabled);
  const accepts = (input) => req.files.every((f) => !input.accept || input.accept.split(",").some((raw) => {
    const a = raw.trim().toLowerCase();
    return a === "*" || a === "*/*" ? true : a.startsWith(".") ? f.name.toLowerCase().endsWith(a) : a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a;
  }));
  let eligible = [...new Set(candidates)].filter(accepts);
  const specific = eligible.filter((input) => !!input.accept.trim());
  if (specific.length === 1) eligible = specific;
  if (eligible.length > 1) return { status: "unsupported", note: "官网附件入口不唯一，未上传；请在原对话处理" };
  if (candidates.length && !eligible.length) return { status: "unsupported", note: "当前官网入口不支持这些附件格式，请在原对话选择合适模式" };
  let files;
  try {
    files = req.files.map((f) => {
      const data = f.base64;
      if (typeof data !== "string" || data.length > 14e6 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw Error();
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      if (bytes.length !== f.size) throw Error();
      return new File([bytes], f.name, { type: f.type });
    });
  } catch {
    return { status: "unsupported", note: "附件数据无效，未上传" };
  }
  if (eligible.length === 1 && !eligible[0].multiple && files.length > 1) return { status: "unsupported", note: "官网当前仅支持单个附件，请拆分处理" };
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  const forward = (input) => {
    if (input && !accepts(input)) return { status: "unsupported", note: "官网当前入口不支持此附件格式" };
    if (input && !input.multiple && files.length > 1) return { status: "unsupported", note: "官网当前只接受单个文件" };
    for (const old of Object.keys(all).slice(0, -50)) delete all[old];
    all[req.requestId] = { thumbs, names };
    if (input) {
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      editor.focus();
      if (imageOnly && req.adapter.uploadMethod !== "drop") editor.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
      else for (const action of ["dragenter", "dragover", "drop"]) editor.dispatchEvent(new DragEvent(action, { bubbles: true, cancelable: true, composed: true, dataTransfer: transfer }));
    }
    return { status: "uploading", note: "已交给官网上传；确认就绪前不会发送问题" };
  };
  const captureInput = async (target) => {
    const proto = HTMLInputElement.prototype, click = proto.click, clickOwn = Object.getOwnPropertyDescriptor(proto, "click"), pickerOwn = Object.getOwnPropertyDescriptor(proto, "showPicker"), captured = [];
    const capture = function() {
      if (this.type === "file") {
        captured.push(this);
        return;
      }
      return click.call(this);
    };
    try {
      Object.defineProperty(proto, "click", { configurable: true, writable: true, value: capture });
      if (pickerOwn) Object.defineProperty(proto, "showPicker", { configurable: true, writable: true, value: capture });
      target.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      if (clickOwn) Object.defineProperty(proto, "click", clickOwn);
      else delete proto.click;
      if (pickerOwn) Object.defineProperty(proto, "showPicker", pickerOwn);
    }
    const inputs = [...new Set(captured)].filter(accepts);
    if (inputs.length !== 1) return { status: "unsupported", note: "官网未提供唯一附件输入，未传输文件，请在原对话操作" };
    return forward(inputs[0]);
  };
  if (!eligible.length && req.adapter.uploadDirect) {
    const target = find([req.adapter.uploadDirect]);
    return target.length === 1 ? captureInput(target[0]) : { status: "unsupported", note: "未识别唯一官网文件上传按钮，问题未发送" };
  }
  if (!eligible.length && req.adapter.uploadLaunch) return (async () => {
    const launch = req.adapter.uploadLaunch, labels = imageOnly ? launch.imageLabels : launch.fileLabels;
    const menu = () => innermost(find(['[role^="menuitem"]', '[role="menu"] *', "[data-radix-popper-content-wrapper] *", '[role="option"]']).filter((el) => labels.some((label) => {
      const value = text(el).replace(/[\u200b-\u200f\ufeff]/g, "").trim();
      return value === label || value.startsWith(label + "\n");
    })))[0];
    if (!menu()) {
      const trigger = find([launch.trigger]);
      if (trigger.length !== 1) return { status: "unsupported", note: "未识别官网附件菜单，问题未发送" };
      const target = trigger[0];
      for (const name2 of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
        const options = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: name2.endsWith("down") ? 1 : 0, view: window, pointerId: 1, pointerType: "mouse", isPrimary: true };
        target.dispatchEvent(name2.startsWith("pointer") && typeof PointerEvent === "function" ? new PointerEvent(name2, options) : new MouseEvent(name2, options));
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
      const created = [...document.querySelectorAll('[role="menu"]')].some((el) => labels.some((label) => text(el).includes(label)));
      if (!created) target.click();
    }
    const menuUntil = Date.now() + 1800;
    while (!menu() && Date.now() < menuUntil) await new Promise((resolve) => setTimeout(resolve, 50));
    const item = menu();
    if (!item) return { status: "unsupported", note: "官网附件菜单暂不支持此类型，问题未发送，请在原对话操作" };
    return captureInput(item);
  })();
  return forward(eligible[0]);
}

// src/shared/web-ai-page.ts
function webAIPageScript(providerId, action, question = "", requestId = "", ownedAttachmentSignature = "") {
  const p = webAIProvider(providerId);
  return "(" + pageAction.toString() + ")(" + JSON.stringify({ providerId, hosts: p.hosts, adapter: WEB_AI_ADAPTERS[p.id], action, question, requestId, ownedAttachmentSignature: /^[a-f0-9]{8}$/.test(ownedAttachmentSignature) ? ownedAttachmentSignature : "" }) + "," + observeWebAIPage.toString() + ")";
}
function pageAction(req, observe) {
  if (location.protocol !== "https:" || !req.hosts.includes(location.hostname)) return { status: "unsupported", note: "当前页面不是所选厂商的聊天官网，可能正在登录。" };
  const { state, editor, draft, buttons, find, innermost, text, login, blockedDialog, stopping } = observe(req);
  if (req.action === "observe" || req.action === "inspect") return state;
  if (login || blockedDialog || stopping) return { ...state, status: login ? "needs_login" : "unsupported", note: login || blockedDialog ? state.note : "官网正在生成，请等待本轮结束。" };
  if (!editor) return state;
  const key2 = "__workbenchWebAIRequest";
  const previous = window[key2];
  if (req.action === "prepare") {
    if (draft && draft !== req.question) return { ...state, status: "unsupported", note: "官网已有未发送的草稿，本次未覆盖。" };
    if (previous?.id === req.requestId && previous.sent) return { ...state, status: "uncertain", note: "此问题曾提交过，请在官网核对，不会重复发送。" };
    if (draft === req.question) {
      window[key2] = { id: req.requestId, sent: false };
      return { ...state, status: "prepared", note: "官网已包含相同问题，未重复填入。" };
    }
    ;
    editor.focus();
    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      const proto = editor.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(editor, req.question);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: req.question }));
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      let pasted = false;
      if (req.providerId === "qianwen" && typeof DataTransfer === "function" && typeof ClipboardEvent === "function") {
        const data = new DataTransfer();
        data.setData("text/plain", req.question);
        const paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
        editor.dispatchEvent(paste);
        pasted = paste.defaultPrevented || text(editor) === req.question;
      }
      if (!pasted && !document.execCommand("insertText", false, req.question)) return { ...state, status: "unsupported", note: "官网编辑器未接受自动填入，请直接在网页输入。" };
    }
    ;
    window[key2] = { id: req.requestId, sent: false };
    return { ...state, status: "prepared", note: "已填入官网输入框；可在官网检查。" };
  }
  if (req.action === "submit") {
    if (previous?.id !== req.requestId || previous.sent || draft !== req.question) return { ...state, status: "uncertain", note: "问题或页面状态已变化，请在官网核对。" };
    const enabled = (el) => !el.matches(":disabled") && !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true" && ![...el.classList].some((token) => /^(?:is-|btn-|button-|send-button-)?disabled$/.test(token));
    const matched = innermost(find(req.adapter.send)), known = matched.filter(enabled);
    const send = known.length ? known : buttons.filter((el) => editor?.parentElement?.contains(el) && [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-testid"), text(el)].some((v) => v && /^(发送|发送消息|send|send message|send prompt|send-button|chat-input-send-button)$/i.test(v.trim()))).filter(enabled);
    if (send.length !== 1) return { ...state, status: "prepared", retryableBeforeSend: matched.length === 1 && !enabled(matched[0]), note: matched.length === 1 && !enabled(matched[0]) ? "官网发送按钮尚未启用，请在原页面核对草稿。" : "尚未识别唯一发送按钮，请在官网发送后采集回答。" };
    const uploads = Object.entries(window.__workbenchWebAIUpload || {}).filter(([id]) => id.startsWith(req.requestId + ":")).map(([, value]) => value);
    const owned = !!state.attachmentSignature && uploads.some((file) => file.signature === state.attachmentSignature);
    if (state.hasAttachmentDraft && !state.attachmentsOwned && !owned) return { ...state, status: "unsupported", note: "官网附件已变化或未经确认，未点击发送，请核对原对话" };
    if (owned) window.__workbenchOwnedAttachments = state.attachmentSignature;
    window[key2] = { id: req.requestId, sent: true };
    const target = send[0];
    if (req.providerId === "glm") {
      const stillPrepared = () => target.isConnected && editor.isConnected && ("value" in editor ? String(editor.value) : text(editor)) === req.question;
      for (const [name2, pressed] of [["pointerdown", true], ["mousedown", true], ["pointerup", false], ["mouseup", false]]) {
        if (!stillPrepared()) break;
        const options = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: pressed ? 1 : 0, detail: 1 };
        target.dispatchEvent(name2.startsWith("pointer") && typeof PointerEvent === "function" ? new PointerEvent(name2, { ...options, pointerId: 1, pointerType: "mouse", isPrimary: true }) : new MouseEvent(name2, options));
      }
      if (stillPrepared()) target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window, button: 0, detail: 1 }));
    } else target.click();
    return { ...state, status: "generating", note: "已点击官网发送，等待新回答。" };
  }
  return { status: "unsupported", note: "不支持的网页操作。" };
}

// src/client/features/web-ai/browser-session.ts
var WEB_AI_BROWSER_NAMESPACE = "dsh-dev-workbench.web-ai";
function nativeWebAIBridge() {
  const desktop = globalThis.dshDesktop, b = desktop?.protocolVersion === 1 ? desktop.browser : null;
  return b && typeof b.acquire === "function" && typeof b.release === "function" && typeof b.onOpenRequested === "function" ? b : null;
}
function browserSessionMode(bridge) {
  if (!bridge) return "unavailable";
  return bridge.persistence?.protocolVersion === 1 && typeof bridge.persistence.acquire === "function" ? "persistent" : "memory";
}
function browserSessionMessage(mode, acquired = false) {
  if (mode === "unavailable") return "当前环境不支持内嵌官网。请在支持内嵌网页的 Harness 桌面端使用。";
  if (mode === "memory") return "当前宿主仅在本次运行保留登录；完整退出后需要重新登录。跨重启保留需宿主提供持久化分区。";
  return acquired ? "已使用内嵌持久化分区；登录是否有效由官网确认，过期时请在此重新登录。" : "宿主提供持久化分区，打开官网后使用；实际登录恢复仍需官网验证。";
}
async function acquireWebsiteSession(bridge, scope, providerId) {
  webAIProvider(providerId);
  if (!/^[\w:-]{1,160}$/.test(scope)) throw new Error("内嵌网页存储范围无效");
  const persistent = browserSessionMode(bridge) === "persistent";
  const reservation = persistent ? await bridge.persistence.acquire({ namespace: WEB_AI_BROWSER_NAMESPACE, providerId }) : await bridge.acquire(scope + ":" + providerId);
  const valid = reservation && typeof reservation.lease === "string" && reservation.lease.length > 0 && reservation.lease.length <= 200 && typeof reservation.partition === "string" && reservation.partition.length > 0 && reservation.partition.length <= 200;
  const matching = persistent ? reservation && "persistence" in reservation && reservation.persistence === "persistent" && "providerId" in reservation && reservation.providerId === providerId && /^persist:[\w-]+$/.test(reservation.partition) : valid && !reservation.partition.startsWith("persist:");
  if (!valid || !matching) {
    if (reservation && typeof reservation.lease === "string" && reservation.lease) await bridge.release(reservation.lease).catch(() => {
    });
    throw new Error("宿主返回的内嵌存储能力不匹配，未创建官网页面");
  }
  return { ...reservation, mode: persistent ? "persistent" : "memory" };
}

// src/client/features/web-ai/NativeWebsite.tsx
function NativeWebsite({ providerId, scope, url, visible, onController, onNavigate }) {
  const bridge = nativeWebAIBridge(), [lease, setLease] = React48.useState(null), [error, setError] = React48.useState(""), [loading, setLoading] = React48.useState(true), [retry, setRetry] = React48.useState(0);
  const guest = React48.useRef(null), ready = React48.useRef(false), documentVersion = React48.useRef(0), mounted = React48.useRef(true), target = React48.useRef(url);
  const ownedAttachmentSignature = React48.useRef("");
  const navigation = React48.useRef(onNavigate);
  navigation.current = onNavigate;
  target.current = url;
  const controller = React48.useMemo(() => ({
    async execute(action, question = "", requestId = "") {
      const until = Date.now() + 15e3;
      while (!ready.current && mounted.current && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
      const node = guest.current;
      if (!mounted.current || !node || !ready.current) throw new Error("官网仍在加载，请稍后重试");
      if (!webAIConversationUrl(providerId, node.getURL())) throw new Error("请先在官网完成登录并返回聊天页面");
      if (providerId === "glm" && (action === "prepare" || action === "submit")) {
        const deadline = Date.now() + 1500;
        while (node.closest("[inert]") && mounted.current && Date.now() < deadline) await new Promise((r) => setTimeout(r, 30));
        if (node.closest("[inert]")) throw new Error("智谱提交需要内嵌页面处于可操作状态，请展开官网后再试");
        node.focus({ preventScroll: true });
        await new Promise((r) => setTimeout(r, 30));
      }
      const version = documentVersion.current;
      let timer;
      try {
        const result = await Promise.race([node.executeJavaScript(webAIPageScript(providerId, action, question, requestId, ownedAttachmentSignature.current), action === "prepare" || action === "submit"), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("官网操作超时，请核对页面；不会自动重发")), 1e4);
        })]);
        if (!mounted.current || version !== documentVersion.current && !(action === "submit" && result?.status === "generating")) throw new Error("官网页面已变化，请核对本轮是否已发送");
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
    async attach(files, question, requestId, signal) {
      if (signal.aborted) throw new Error("附件处理已停止；请在官网核对，不会自动重传");
      if (providerId === "qianwen" && files.some((file) => file.type.startsWith("image/")) && files.some((file) => !file.type.startsWith("image/"))) return { status: "unsupported", note: "千问当前网页会用文档覆盖图片，暂不支持混合上传；本轮附件未传输，请将图片与文档分开提问" };
      await controller.execute("observe", question);
      const node = guest.current;
      if (!node || !ready.current) throw new Error("官网尚未就绪");
      const visibleUntil = Date.now() + 1500;
      while (node.closest("[inert]") && Date.now() < visibleUntil) await new Promise((resolve) => setTimeout(resolve, 30));
      if (node.closest("[inert]")) throw new Error("上传附件需要展开工作台内嵌官网");
      node.scrollIntoView?.({ block: "nearest" });
      node.focus({ preventScroll: true });
      for (const file of files) {
        if (signal.aborted) throw new Error("附件处理已停止；请在官网核对，不会自动重传");
        const id = requestId + ":" + file.id, version = documentVersion.current;
        const execute = async (action) => {
          if (signal.aborted || !mounted.current || version !== documentVersion.current) throw new Error("附件处理已停止或页面变化，请在官网核对");
          let timer2;
          try {
            return await Promise.race([node.executeJavaScript(webAIUploadScript(providerId, action, action === "upload" ? [file] : [{ id: file.id, name: file.name, size: file.size, type: file.type }], question, id, ownedAttachmentSignature.current), action === "upload"), new Promise((_, reject) => {
              timer2 = setTimeout(() => reject(new Error("官网附件操作超时，请核对页面；不会重传")), 1e4);
            })]);
          } finally {
            clearTimeout(timer2);
          }
        };
        let result = await execute("upload");
        if (result.status !== "uploading") return result;
        const deadline = Date.now() + 9e4;
        let stable = 0;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          result = await execute("attachment-status");
          if (result.status === "unsupported") return result;
          if (result.status === "attached") {
            if (++stable >= 2) break;
          } else stable = 0;
        }
        if (stable < 2) return { status: "unsupported", note: "90秒内未确认附件就绪；问题未发送，请在官网核对，不自动重传" };
      }
      if (signal.aborted || !mounted.current) throw new Error("附件处理已停止；不会发送问题");
      let timer;
      try {
        const result = await Promise.race([node.executeJavaScript(webAIUploadScript(providerId, "attachment-verify", files.map(({ base64, ...metadata }) => metadata), question, requestId, ownedAttachmentSignature.current), false), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("附件核对超时，请检查官网")), 1e4);
        })]);
        if (signal.aborted) throw new Error("附件处理已停止；不会发送问题");
        if (result.status === "attached" && /^[a-f0-9]{8}$/.test(result.signature || "")) ownedAttachmentSignature.current = result.signature;
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
    async navigate(next) {
      ownedAttachmentSignature.current = "";
      if (!webAIConversationUrl(providerId, next)) throw new Error("官网地址无效");
      const node = guest.current;
      if (!node) throw new Error("官网尚未准备好");
      ready.current = false;
      await node.loadURL(next);
    },
    releaseInputFocus() {
      guest.current?.blur();
    }
  }), [providerId]);
  React48.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ready.current = false;
    };
  }, []);
  React48.useEffect(() => {
    if (!bridge) return;
    let disposed = false, held = null;
    setError("");
    setLoading(true);
    setLease(null);
    ownedAttachmentSignature.current = "";
    acquireWebsiteSession(bridge, scope, providerId).then((value) => {
      if (disposed) {
        void bridge.release(value.lease).catch(() => {
        });
        return;
      }
      held = value;
      setLease(value);
    }).catch(() => {
      if (!disposed) {
        setLoading(false);
        setError(browserSessionMode(bridge) === "persistent" ? "持久化官网分区暂不可用，请重试；为保留登录隔离，没有改用临时分区。" : "宿主未能创建内嵌网页，请重试。");
      }
    });
    return () => {
      disposed = true;
      ready.current = false;
      if (held) void bridge.release(held.lease).catch(() => {
      });
    };
  }, [scope, providerId, retry]);
  React48.useEffect(() => {
    const node = guest.current;
    if (!node || !lease || !bridge) return;
    let disposed = false, initial = true;
    const loading2 = () => {
      ready.current = false;
      documentVersion.current++;
      setLoading(true);
    };
    const navigationStarted = (event) => {
      if (event.isMainFrame !== false && !event.isInPlace) loading2();
    };
    const reportNavigation = () => {
      if (disposed) return;
      const url2 = webAIConversationUrl(providerId, node.getURL());
      if (url2) navigation.current?.(url2);
    };
    const domReady = () => {
      if (disposed) return;
      if (initial) {
        initial = false;
        void node.loadURL(target.current).catch(() => {
          if (!disposed) {
            setLoading(false);
            setError("官网加载失败，请重试。");
          }
        });
        return;
      }
      ready.current = true;
      setLoading(false);
      setError("");
      onController(controller);
      reportNavigation();
    };
    const failed = (event) => {
      if (event.errorCode === -3 || event.isMainFrame === false) return;
      ready.current = false;
      setLoading(false);
      setError("官网暂时无法加载，请检查网络或稍后重试。");
    };
    node.addEventListener("did-start-navigation", navigationStarted);
    node.addEventListener("dom-ready", domReady);
    node.addEventListener("did-fail-load", failed);
    node.addEventListener("did-navigate-in-page", reportNavigation);
    const off = bridge.onOpenRequested(lease.lease, (next) => {
      if (webAIConversationUrl(providerId, next)) void node.loadURL(next).catch(() => {
      });
      else WB.toast("该登录跳转尚未适配内嵌，请保留当前页面；不会另开浏览器窗口", "warn");
    });
    return () => {
      disposed = true;
      onController(null);
      node.removeEventListener("did-start-navigation", navigationStarted);
      node.removeEventListener("dom-ready", domReady);
      node.removeEventListener("did-fail-load", failed);
      node.removeEventListener("did-navigate-in-page", reportNavigation);
      off();
    };
  }, [lease, controller]);
  return /* @__PURE__ */ React48.createElement("div", { className: "wb-website" + (!visible ? " is-background-guest" : ""), "aria-hidden": !visible, ...!visible ? { inert: "" } : {} }, !bridge && /* @__PURE__ */ React48.createElement("div", { className: "wb-web-status", role: "status" }, browserSessionMessage("unavailable")), lease?.mode === "persistent" && /* @__PURE__ */ React48.createElement("div", { className: "wb-tiny wb-muted", role: "status" }, browserSessionMessage("persistent", true)), lease && React48.createElement("webview", { key: lease.lease, ref: (el) => {
    guest.current = el;
  }, name: lease.lease, partition: lease.partition, src: "about:blank#" + lease.lease, allowpopups: "", "data-sidebar-browser-frame": "webview", "aria-label": webAIProvider(providerId).name + " 官网聊天", style: { flex: 1, width: "100%", minHeight: 300, border: 0 } }), (loading && bridge || error) && /* @__PURE__ */ React48.createElement("div", { className: "wb-web-status", role: error ? "alert" : "status" }, error || "正在加载官网…", " ", error && /* @__PURE__ */ React48.createElement(Btn, { size: "sm", onClick: () => setRetry((n) => n + 1) }, "重试网页")));
}

// src/client/features/web-ai/capture.ts
var normalized = (value) => value.replace(/\s+/g, " ").trim();
function selectCapturedTurn(snapshot, question, before) {
  const turns = (Array.isArray(snapshot.turns) ? snapshot.turns : []).filter((t) => Number.isInteger(t?.ordinal) && typeof t?.text === "string");
  const count = Number.isFinite(before.answerCount) ? before.answerCount : before.answers?.length || 0;
  const anchor = before.lastAnswerId ? turns.find((t) => t.id === before.lastAnswerId) : null;
  const target = normalized(question);
  const after = (t) => anchor ? t.ordinal > anchor.ordinal : t.ordinal >= count;
  const relevant = turns.filter(after);
  let turn = relevant.find((t) => t.question !== null && normalized(t.question) === target) || null;
  if (!turn) turn = relevant.find((t) => t.question === null && t.ordinal === (anchor ? anchor.ordinal + 1 : count)) || null;
  if (!turn && Number.isFinite(before.userCount)) turn = turns.find((t) => t.question !== null && normalized(t.question) === target && t.userIndex !== null && t.userIndex >= before.userCount) || null;
  if (!turn && !anchor && before.conversationKey && snapshot.conversationKey && before.conversationKey !== snapshot.conversationKey) turn = turns.find((t) => t.id !== before.lastAnswerId && t.question !== null && normalized(t.question) === target) || null;
  const newUser = Number.isFinite(snapshot.userCount) && Number.isFinite(before.userCount) && snapshot.userCount > before.userCount;
  const foreign = !turn && (relevant.some((t) => !!t.question && normalized(t.question) !== target) || newUser && !!snapshot.lastQuestion && normalized(snapshot.lastQuestion) !== target);
  const ambiguous = !turn && !foreign && count > 0 && snapshot.answerCount < count && !anchor;
  return { turn, foreign, ambiguous };
}

// src/client/features/web-ai/runner.ts
async function runWebsiteQuestion(controller, question, requestId, update, signal, prepareOnly = false, clock = () => Date.now(), pause = (ms) => new Promise((r) => setTimeout(r, ms)), attachments = []) {
  const check = () => {
    if (signal.aborted) throw new Error("已停止采集；请在官网核对已发送的内容");
  };
  check();
  let before = await controller.execute("observe", question);
  check();
  const readyUntil = clock() + 15e3;
  while (before.status === "unsupported" && before.editorCount === 0 && !/弹窗/.test(before.note || "") && clock() < readyUntil) {
    await pause(500);
    check();
    before = await controller.execute("observe", question);
    check();
  }
  await update({ status: "preparing", capture: { answerCount: Number.isFinite(before.answerCount) ? before.answerCount : (before.answers || []).length, userCount: Number.isFinite(before.userCount) ? before.userCount : null, ...before.lastAnswerId ? { lastAnswerId: before.lastAnswerId } : {}, ...before.lastAnswerHash ? { lastAnswerHash: before.lastAnswerHash } : {}, ...before.conversationKey ? { conversationKey: before.conversationKey } : {} } });
  if (before.status === "needs_login" || before.status === "unsupported" || before.busy || before.hasAttachmentDraft && !before.attachmentsOwned) {
    await update({ status: before.status === "needs_login" ? "needs_login" : "unsupported", note: before.hasAttachmentDraft ? "官网已有附件草稿，请先在原对话处理；本轮未发送" : before.note || "请先在官网结束当前操作", url: before.url });
    return;
  }
  const prepared = await controller.execute("prepare", question, requestId);
  check();
  if (prepared.status !== "prepared") {
    await update({ status: prepared.status === "needs_login" ? "needs_login" : prepared.status === "uncertain" ? "uncertain" : "unsupported", note: prepared.note, url: prepared.url });
    return;
  }
  if (attachments.length) {
    if (!controller.attach) {
      await update({ status: "unsupported", note: "当前环境未提供官网附件能力，问题未发送" });
      return;
    }
    await update({ status: "preparing", note: "正在上传附件，就绪后才发送问题", url: prepared.url });
    const uploaded = await controller.attach(attachments, question, requestId, signal);
    check();
    if (uploaded.status !== "attached") {
      await update({ status: "unsupported", note: uploaded.note || "附件未就绪，问题未发送", url: prepared.url });
      return;
    }
    before = await controller.execute("observe", question);
    check();
    if (before.busy || before.status === "needs_login") {
      await update({ status: "unsupported", note: "附件处理期间官网状态已变化，问题未发送，请核对原对话" });
      return;
    }
    await update({ status: "preparing", capture: { answerCount: before.answerCount || 0, userCount: before.userCount ?? null, ...before.lastAnswerId ? { lastAnswerId: before.lastAnswerId } : {}, ...before.lastAnswerHash ? { lastAnswerHash: before.lastAnswerHash } : {}, ...before.conversationKey ? { conversationKey: before.conversationKey } : {} } });
  }
  await update({ status: "prepared", note: prepared.note, url: prepared.url });
  if (prepareOnly) return;
  await pause(150);
  check();
  let sent = await controller.execute("submit", question, requestId);
  check();
  for (let attempt = 0; sent.status === "prepared" && sent.retryableBeforeSend === true && attempt < 4; attempt++) {
    await pause(300);
    check();
    sent = await controller.execute("submit", question, requestId);
    check();
  }
  if (sent.status !== "generating") {
    await update({ status: sent.status === "prepared" ? "prepared" : sent.status === "needs_login" ? "needs_login" : "uncertain", note: sent.note, url: sent.url });
    return;
  }
  await update({ status: "generating", note: sent.note, url: sent.url });
  await collectWebsiteAnswer(controller, question, before, update, signal, clock, pause);
}
async function collectWebsiteAnswer(controller, question, before, update, signal, clock = () => Date.now(), pause = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const check = () => {
    if (signal.aborted) throw new Error("已停止采集；不会发送问题");
  };
  const baseline = Array.isArray(before.answers) ? before.answers : null, baselineCount = Number.isFinite(before.answerCount) ? before.answerCount : baseline?.length || 0;
  const started = clock();
  let previousTime = started, last = "", stable = 0, sawBusy = false, accepted = false, lastIdentity = "";
  while (clock() - started < 3e5) {
    await pause(1500);
    check();
    const now = clock();
    if (now - previousTime > 45e3) throw new Error("检测到休眠或运行暂停，请核对官网；不会重新发送");
    previousTime = now;
    const next = await controller.execute("observe", question);
    check();
    if (next.status === "needs_login") {
      await update({ status: "needs_login", note: next.note, url: next.url });
      return;
    }
    if (next.status === "unsupported" && /弹窗/.test(next.note || "")) {
      await update({ status: "uncertain", note: next.note, url: next.url });
      return;
    }
    sawBusy ||= !!next.busy;
    if (Array.isArray(next.turns)) {
      const selected = selectCapturedTurn(next, question, before);
      if (selected.ambiguous && (next.busy || clock() - started < 15e3)) continue;
      if (selected.foreign || selected.ambiguous) {
        await update({ status: "uncertain", note: selected.foreign ? "官网已出现其他提问，本轮停止采集以免混入其他回答。" : "官网可见历史范围已变化，无法确认本轮回答；请核对后恢复采集。", url: next.url });
        return;
      }
      const turn = selected.turn;
      accepted ||= !!next.busy || !!turn || Number.isFinite(next.userCount) && Number.isFinite(before.userCount) && next.userCount > before.userCount;
      if (turn?.text) {
        const same = turn.id === lastIdentity && turn.text === last;
        stable = same ? stable + 1 : 0;
        lastIdentity = turn.id;
        last = turn.text;
        if (turn.truncated) {
          await update({ status: "uncertain", text: last, note: "回答超过60000字符，已保留前段，请在官网查看完整内容。", url: next.url });
          return;
        }
        await update({ status: "generating", text: last, note: "正在采集官网本轮完整回答", url: next.url });
        if (!next.busy && turn.complete && stable >= 1) {
          await update({ status: "completed", text: last, note: "已采集官网完整回答", url: next.url });
          return;
        }
      }
      if (!accepted && clock() - started > 15e3) {
        await update({ status: "prepared", note: "官网尚未确认接收问题，请在原对话核对；不会重复点击发送。", url: next.url });
        return;
      }
      continue;
    }
    const newUser = Number.isFinite(next.userCount) && Number.isFinite(before.userCount) && next.userCount > before.userCount;
    if (newUser && next.lastQuestion && String(next.lastQuestion).replace(/\s+/g, " ").trim() !== question.replace(/\s+/g, " ").trim()) {
      await update({ status: "uncertain", note: "官网已出现其他提问，本轮停止采集以免混入其他回答。", url: next.url });
      return;
    }
    const answers = Array.isArray(next.answers) ? next.answers : [], tail = answers.at(-1) || "";
    const count = Number.isFinite(next.answerCount) ? next.answerCount : answers.length;
    const changed = tail && (count > baselineCount || baseline !== null && tail !== baseline.at(-1));
    accepted ||= !!next.busy || newUser || !!changed;
    if (!accepted && clock() - started > 12e3) {
      await update({ status: "prepared", note: "官网尚未确认接收问题，请登录或在原对话核对；不会重复点击发送。", url: next.url });
      return;
    }
    if (changed) {
      stable = tail === last ? stable + 1 : 0;
      last = tail;
      await update({ status: "generating", text: tail, url: next.url, note: "正在采集官网本轮回答" });
      if (!next.busy && (sawBusy || next.complete === true) && stable >= 1) {
        await update({ status: "completed", text: tail, url: next.url, note: "已采集官网回答" });
        return;
      }
      if (!next.busy && !sawBusy && next.complete !== true && stable >= 3) {
        await update({ status: "uncertain", text: tail, url: next.url, note: "已采集新内容，但未识别官网结束状态，请核对后保存。" });
        return;
      }
    }
  }
  await update({ status: "uncertain", text: last, note: "五分钟内未能确认新回答完成，可在官网核对后粘贴保存。" });
}

// src/client/features/web-ai/batch.ts
async function runWebsiteBatch(rounds, providers, dependencies, signal, prepareOnly = false) {
  const process = async (providerId) => {
    let blocked = false;
    for (const round of rounds) {
      if (signal.aborted) return;
      const claim = await dependencies.claim(round, providerId);
      if (!claim.executionId) continue;
      const executionId = claim.executionId;
      const update = async (patch) => {
        if (patch.status && ["prepared", "needs_login", "unsupported", "uncertain"].includes(patch.status)) blocked = true;
        if (patch.status === "completed" || patch.status === "generating") blocked = false;
        await dependencies.update(round, providerId, executionId, patch);
      };
      if (blocked) {
        await update({ status: "unsupported", note: "前一个问题需要在官网处理，本条未发送。" });
        continue;
      }
      try {
        const website = await dependencies.open(round, providerId);
        await (dependencies.run || runWebsiteQuestion)(website, round.question, round.id + ":" + providerId, update, signal, prepareOnly, void 0, void 0, round.id === rounds[0]?.id ? dependencies.attachments : []);
      } catch (error) {
        blocked = true;
        if (!signal.aborted) await update({ status: "uncertain", note: error instanceof Error ? error.message : "官网处理失败，请核对页面。" });
      }
    }
  };
  const queue = [...providers];
  const workers = await Promise.allSettled(Array.from({ length: Math.min(dependencies.attachments?.length ? 1 : 2, queue.length) }, async () => {
    while (queue.length && !signal.aborted) {
      const provider = queue.shift();
      if (provider) await process(provider);
    }
  }));
  const failed = workers.find((value) => value.status === "rejected");
  if (failed) throw failed.reason;
}
async function persistWebAIState(write, signal, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new Error("已停止采集；不会发送问题");
    try {
      return await write();
    } catch (error) {
      if (attempt >= 2 || signal?.aborted || !/Failed to fetch|NetworkError|network request failed|fetch failed|ERR_NETWORK|ERR_CONNECTION/i.test(error instanceof Error ? error.message : String(error))) throw error;
      await pause(300 * (attempt + 1));
    }
  }
}

// src/client/features/web-ai/preferences.ts
var key = (scope) => "dsh-workbench:web-ai:last-topic:" + scope;
function restoreWebAITopic(scope, topics, storage) {
  try {
    const value = (storage || window.localStorage).getItem(key(scope));
    if (value === "" || topics.some((t) => t.id === value && !t.deletedAt)) return value || "";
  } catch {
  }
  return topics.filter((t) => !t.deletedAt).at(-1)?.id || "";
}
function rememberWebAITopic(scope, id, storage) {
  if (!scope) return;
  try {
    (storage || window.localStorage).setItem(key(scope), id);
  } catch {
  }
}

// src/client/features/web-ai/styles.ts
var WEB_AI_CSS = `
.wb-web-ai{min-width:0;display:flex;flex-direction:column;gap:14px;position:relative}
.wb-web-ai [hidden]{display:none!important}
.wb-web-toolbar,.wb-web-tabs{gap:8px;min-width:0}
.wb-web-compose>summary{font-size:13px;cursor:pointer;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow-wrap:anywhere}
.wb-web-compose[open]>summary{margin-bottom:10px}
.wb-web-topic{display:flex;gap:8px;align-items:center;min-width:0;flex:1 1 240px;max-width:500px}
.wb-web-topic>.wb-btn{max-width:100%;min-width:0;white-space:normal;text-align:left;overflow-wrap:anywhere}
.wb-web-history{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;display:flex;flex-direction:column;gap:10px;min-width:0}
.wb-web-history-item{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-width:0}
.wb-web-history-item.is-selected{border-color:var(--dsw-alias-label-secondary)}
.wb-web-history-content{flex:1;min-width:0;overflow-wrap:anywhere}
.wb-web-history-content p{margin:5px 0}
.wb-web-history-actions{gap:6px;flex-shrink:0}
@media(max-width:650px){.wb-web-history-item{flex-direction:column;align-items:stretch}.wb-web-history-actions{justify-content:flex-end}.wb-web-topic{max-width:100%}}
.wb-web-providers{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:12px}
.wb-web-providers legend{font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:8px}
.wb-web-providers label{display:inline-flex;gap:5px;align-items:center;font-size:13px}
.wb-web-status{padding:22px 14px;font-size:13px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.wb-web-native-region{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;min-width:0}
.wb-web-notice{padding:9px 12px;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-website{display:flex;height:65vh;min-height:340px;flex-direction:column;position:relative;min-width:0;background:var(--dsw-alias-bg-base)}
.wb-web-native-region.is-background{position:absolute;left:0;top:0;width:100%;height:700px;opacity:0;pointer-events:none;z-index:-1}
.wb-website.is-background-guest{position:absolute;left:0;top:0;width:100%;opacity:0;pointer-events:none;z-index:-1}
.wb-web-connection{padding:8px 12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-web-connection>summary{cursor:pointer}
.wb-web-diagnostics p{overflow-wrap:anywhere;font-family:monospace;font-size:11px}
.wb-web-empty{padding:28px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.wb-website webview{min-width:0;display:flex}
.wb-website .wb-web-status{position:absolute;left:0;right:0;top:0;background:var(--dsw-alias-bg-layer-1);z-index:1;max-height:100%;overflow:auto}
.wb-web-round{border:1px solid var(--dsw-alias-border-l1);padding:12px;border-radius:9px;margin-bottom:12px;min-width:0}
.wb-web-round>summary{cursor:pointer;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:12px;font-weight:600}
.wb-comparison-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}
.wb-web-answer{min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.wb-web-answer pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:13px;line-height:1.7;max-height:480px;overflow:auto}
.wb-web-error{color:var(--dsw-alias-state-error-primary);font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
`;

// src/client/features/web-ai/attachments.tsx
var React49 = __toESM(require("react"), 1);
function selectWebAIFiles(existing, files, clipboard = false) {
  const names = new Set(existing.map((item) => item.name));
  const next = [...existing, ...files.map((original, i) => {
    let file = original;
    if (clipboard && file.type.startsWith("image/") && names.has(file.name)) {
      const dot = file.name.lastIndexOf("."), base = dot > 0 ? file.name.slice(0, dot) : file.name, ext = dot > 0 ? file.name.slice(dot) : "";
      let n = 2, name2 = base + " (" + n + ")" + ext;
      while (names.has(name2)) name2 = base + " (" + ++n + ")" + ext;
      file = new File([file], name2, { type: file.type, lastModified: file.lastModified });
    }
    names.add(file.name);
    return { id: "file-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + i, name: file.name, size: file.size, type: file.type, file };
  })];
  normalizeWebAIAttachments(next);
  return next;
}
async function readWebAIFiles(files) {
  normalizeWebAIAttachments(files);
  return Promise.all(files.map(async ({ file, ...meta }) => ({ ...meta, base64: await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取附件：" + meta.name));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  }) })));
}
function FilePreview({ item }) {
  const [url, setUrl] = React49.useState("");
  React49.useEffect(() => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(item.type) || !URL.createObjectURL) return;
    const value = URL.createObjectURL(item.file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [item]);
  return /* @__PURE__ */ React49.createElement(React49.Fragment, null, url && /* @__PURE__ */ React49.createElement("img", { src: url, alt: item.name, style: { width: 48, height: 48, objectFit: "contain", borderRadius: 6 } }), /* @__PURE__ */ React49.createElement("span", { style: { minWidth: 0, overflowWrap: "anywhere" } }, item.name, /* @__PURE__ */ React49.createElement("small", { className: "wb-muted", style: { display: "block" } }, Math.ceil(item.size / 1024), " KB")));
}
function WebAIAttachments({ files, disabled, onAdd, onRemove }) {
  const chooser = React49.useRef(null);
  return /* @__PURE__ */ React49.createElement("div", { className: "wb-stack", "aria-label": "问题附件" }, /* @__PURE__ */ React49.createElement("input", { ref: chooser, "aria-label": "选择问题附件", type: "file", multiple: true, accept: WEB_AI_FILE_ACCEPT, disabled, style: { display: "none" }, onChange: (event) => {
    onAdd(Array.from(event.target.files || []));
    event.target.value = "";
  } }), /* @__PURE__ */ React49.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React49.createElement(Btn, { disabled, onClick: () => chooser.current?.click() }, "添加图片 / 文件"), /* @__PURE__ */ React49.createElement("span", { className: "wb-tiny wb-muted" }, "可粘贴截图或拖入文件；最多5个，单个10MB，总计20MB。格式以官网为准。")), !!files.length && /* @__PURE__ */ React49.createElement(React49.Fragment, null, /* @__PURE__ */ React49.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, files.map((item) => /* @__PURE__ */ React49.createElement("div", { key: item.id, className: "wb-row", style: { gap: 8, maxWidth: "100%", padding: 8, border: "1px solid var(--dsw-alias-border-l1)", borderRadius: 8 } }, /* @__PURE__ */ React49.createElement(FilePreview, { item }), /* @__PURE__ */ React49.createElement(Btn, { size: "sm", disabled, "aria-label": "移除附件 " + item.name, onClick: () => onRemove(item.id) }, "移除")))), /* @__PURE__ */ React49.createElement("p", { className: "wb-tiny wb-muted" }, "附件将发送至勾选官网；批量仅附在第一问，后续复用会话。内容临时保留，历史仅保存附件信息；刷新后需重新选择。")));
}

// src/client/features/web-ai/WebAIPage.tsx
var LABEL = { queued: "待处理", preparing: "准备中", prepared: "已填入官网", generating: "生成中", completed: "已保存", needs_login: "需要登录", unsupported: "需官网操作", uncertain: "需要核对", cancelled: "已停止" };
function WebAIPage() {
  const store = useStore(), [state, setState] = React50.useState(() => normalizeWebAI(store.data?.webAI)), [topicId, setTopicId] = React50.useState(""), [active, setActive] = React50.useState("kimi"), [selected, setSelected] = React50.useState(["kimi", "glm"]), [drafts, setDrafts] = React50.useState({}), [batch, setBatch] = React50.useState(false), [busy, setBusy] = React50.useState(false), [error, setError] = React50.useState(""), [caps, setCaps] = React50.useState(null), [showWeb, setShowWeb] = React50.useState(false), [answerFilter, setAnswerFilter] = React50.useState("all"), [page, setPage] = React50.useState(0);
  const [opened, setOpened] = React50.useState({}), [editing, setEditing] = React50.useState(null);
  const [showHistory, setShowHistory] = React50.useState(false), [questionEdit, setQuestionEdit] = React50.useState(null);
  const [fileDrafts, setFileDrafts] = React50.useState({});
  const [compatibility, setCompatibility] = React50.useState("");
  const [diagnostics, setDiagnostics] = React50.useState(null);
  const ownedRequest = React50.useRef(null), processing = React50.useRef(false);
  const selection = React50.useRef({ touched: false, id: "" });
  function chooseTopic(id) {
    selection.current = { touched: true, id };
    setTopicId(id);
    rememberWebAITopic(caps?.storageScope, id);
  }
  const openRef = React50.useRef(opened), controllers = React50.useRef(/* @__PURE__ */ new Map()), abort = React50.useRef(null), alive = React50.useRef(true);
  function acceptState(next) {
    setState((old) => Number(next.revision || 0) < Number(old.revision || 0) ? old : next);
  }
  function saveNavigation(providerId, url) {
    const current = openRef.current[providerId];
    if (!current || current.url === url) return;
    openRef.current = { ...openRef.current, [providerId]: { ...current, url } };
    if (!current.topicId) return;
    void rpc("webAISaveConversation", { topicId: current.topicId, providerId, url }).then((next) => {
      if (alive.current) acceptState(next);
    }).catch(() => {
    });
  }
  const rpc = React50.useCallback((method, request) => WB.rpc("workbench/" + method, request === void 0 ? {} : { request }), []);
  function cancelRequest(request) {
    return persistWebAIState(() => rpc("webAICancel", request));
  }
  React50.useEffect(() => {
    alive.current = true;
    rpc("webAIState").then((r) => {
      if (!alive.current) return;
      if (!r?.state || !Array.isArray(r.state.topics)) throw new Error("Host 多 AI 对话接口版本不匹配，请完整重启 Harness");
      acceptState(r.state);
      setCaps(r.capabilities);
      if (selection.current.touched) rememberWebAITopic(r.capabilities.storageScope, selection.current.id);
      else setTopicId(restoreWebAITopic(r.capabilities.storageScope, r.state.topics));
    }).catch((e) => {
      if (alive.current) setError(/404/.test(e.message) ? "Host 尚未加载多 AI 对话接口，请完整退出并重开 Harness。" : e.message);
    });
    return () => {
      alive.current = false;
      abort.current?.abort();
      if (ownedRequest.current) void cancelRequest({ requestId: ownedRequest.current }).catch(() => {
      });
    };
  }, [rpc]);
  React50.useEffect(() => {
    if (store.data?.webAI) acceptState({ ...store.data.webAI, revision: store.data.revision });
  }, [store.data?.webAI]);
  React50.useEffect(() => {
    if (topicId && !state.topics.some((t) => t.id === topicId && !t.deletedAt)) {
      chooseTopic("");
      setShowWeb(false);
      setPage(0);
      setEditing(null);
      setQuestionEdit(null);
    }
  }, [state.topics, topicId]);
  const safe = (fn) => {
    setError("");
    void fn().catch((e) => {
      if (alive.current) setError(e.message);
    });
  };
  const topic = state.topics.find((t) => t.id === topicId && !t.deletedAt), draft = drafts[topicId] || "", providers = WEB_AI_PROVIDERS.filter((p) => p.id !== "chatgpt" || state.chatgptEnabled), files = fileDrafts[topicId] || [], rows = state.rounds.filter((r) => r.topicId === topicId).slice().reverse();
  function newConversation() {
    chooseTopic("");
    setPage(0);
    setShowWeb(false);
    setAnswerFilter("all");
  }
  async function getController(providerId) {
    const until = Date.now() + 16e3;
    while (alive.current && Date.now() < until) {
      const c = controllers.current.get(providerId);
      if (c) return c;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("内嵌官网未就绪，请在网页检查加载或登录状态");
  }
  async function openProvider(providerId, id = topicId, workspace = state, reveal = true, question = "") {
    const t = workspace.topics.find((t2) => t2.id === id);
    if (id && (!t || t.deletedAt)) throw new Error("历史问答不存在");
    if (!nativeWebAIBridge()) throw new Error("当前环境无法内嵌官网，请在 Harness 桌面端使用或粘贴官网回答");
    const old = openRef.current[providerId], url = t?.conversations[webAIProvider(providerId).id] || webAIProvider(providerId).url;
    if (reveal) {
      setActive(providerId);
      setShowWeb(true);
    }
    setCompatibility("");
    setDiagnostics(null);
    if (old?.topicId === id) return getController(providerId);
    let existing, adoptUrl;
    if (old) {
      existing = await getController(providerId);
      const status = await existing.execute("observe", question);
      const adopt = !!id && !old.topicId && !!question && (!status.hasDraft || status.draftMatchesQuestion === true);
      if (status.busy || status.hasAttachmentDraft && !status.attachmentsOwned || status.hasDraft && !adopt) throw new Error(webAIProvider(providerId).name + " 的另一主题仍有草稿或正在生成，请先在官网处理");
      if (adopt) adoptUrl = status.url || old.url;
    }
    const next = { ...openRef.current, [providerId]: { topicId: id, url: adoptUrl || url } };
    openRef.current = next;
    setOpened(next);
    if (existing && !adoptUrl) await existing.navigate(url);
    if (adoptUrl) void rpc("webAISaveConversation", { topicId: id, providerId, url: adoptUrl }).then(acceptState).catch(() => {
    });
    return getController(providerId);
  }
  async function start(prepareOnly = false) {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController(), requestId = WB.util.uid("web-request");
    abort.current = controller;
    ownedRequest.current = requestId;
    try {
      if (files.length && caps?.attachmentsProtocol !== 1) throw new Error("附件后端尚未加载，请在插件管理中重载智能工作台后再发送；本轮未传输文件");
      const prompt = draft.trim() || (files.length ? "请分析所附附件，并说明关键内容。" : "");
      const questions = batch ? prompt.split(/\n---\s*\n/).map((t) => t.trim()).filter(Boolean) : [prompt];
      const payloads = await readWebAIFiles(files);
      if (controller.signal.aborted || !alive.current) return;
      const create = { topicId, questions, providers: selected, requestId, attachments: files.map(({ file, ...metadata }) => metadata) };
      const next = await persistWebAIState(() => rpc("webAIStart", create), controller.signal);
      acceptState(next);
      if (controller.signal.aborted || !alive.current) {
        await cancelRequest({ requestId });
        return;
      }
      const effectiveTopic = next.rounds.find((r) => r.requestId === requestId)?.topicId;
      if (!effectiveTopic) throw new Error("本轮问答未能创建");
      setFileDrafts((old) => ({ ...old, [effectiveTopic]: files, ...!topicId ? { "": [] } : {} }));
      chooseTopic(effectiveTopic);
      setDrafts((old) => ({ ...old, [effectiveTopic]: draft, ...!topicId ? { "": "" } : {} }));
      setShowWeb(false);
      setAnswerFilter("all");
      setPage(0);
      const rounds = next.rounds.filter((r) => r.requestId === requestId);
      let latestState = next;
      await runWebsiteBatch(rounds, selected, {
        attachments: payloads,
        claim: (round, providerId) => rpc("webAIClaim", { roundId: round.id, providerId }),
        update: async (round, providerId, executionId, patch) => {
          const saved = await persistWebAIState(() => rpc("webAIUpdate", { roundId: round.id, providerId, executionId, ...patch }), controller.signal);
          if (Number(saved.revision || 0) >= Number(latestState.revision || 0)) latestState = saved;
          if (alive.current) acceptState(saved);
        },
        open: async (round, providerId) => {
          const foreground = providerId === "glm" || payloads.length > 0 && round.id === rounds[0]?.id;
          const website = await openProvider(providerId, effectiveTopic, next, foreground, round.question);
          if (!foreground) return website;
          let waiting = false, baseline = null;
          return { ...website, execute: async (action, question, request) => {
            const result = await website.execute(action, question, request);
            if (action === "observe" && !waiting) baseline = result;
            if (action === "submit" && result.status === "generating") waiting = true;
            if (action === "observe" && waiting && (result.busy || result.answerCount > (baseline?.answerCount || 0) || result.userCount > (baseline?.userCount || 0) || baseline?.url && result.url !== baseline.url)) {
              waiting = false;
              website.releaseInputFocus?.();
              if (alive.current) setShowWeb(false);
            }
            return result;
          } };
        }
      }, controller.signal, prepareOnly);
      const first = latestState.rounds.find((r) => r.id === rounds[0]?.id);
      if (files.length && first?.answers.every((a) => a.status === "completed")) setFileDrafts((old) => ({ ...old, [effectiveTopic]: [] }));
    } catch (e) {
      await cancelRequest({ requestId }).catch(() => {
      });
      throw e;
    } finally {
      if (alive.current) setBusy(false);
      abort.current = null;
      ownedRequest.current = null;
      processing.current = false;
    }
  }
  async function resumeCapture(round, answer) {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    ownedRequest.current = round.requestId;
    let executionId = null;
    try {
      const claim = await rpc("webAIResumeCapture", { roundId: round.id, providerId: answer.providerId });
      executionId = claim.executionId;
      if (controller.signal.aborted || !alive.current) {
        await cancelRequest({ requestId: round.requestId });
        return;
      }
      const update = async (patch) => {
        const next = await persistWebAIState(() => rpc("webAIUpdate", { roundId: round.id, providerId: answer.providerId, executionId, ...patch }), controller.signal);
        if (alive.current) acceptState(next);
      };
      try {
        const website = await openProvider(answer.providerId, round.topicId, state, false);
        await collectWebsiteAnswer(website, round.question, { ...answer.capture }, update, controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) await update({ status: "uncertain", note: e instanceof Error ? e.message : "采集未成功，请核对官网" });
      }
    } finally {
      if (alive.current) setBusy(false);
      abort.current = null;
      ownedRequest.current = null;
      processing.current = false;
    }
  }
  function addFiles(picked, clipboard = false) {
    if (busy || !picked.length) return;
    try {
      const next = selectWebAIFiles(files, picked, clipboard);
      setFileDrafts((old) => ({ ...old, [topicId]: next }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "附件添加失败");
    }
  }
  function exportComparison() {
    const content = ["# " + (topic?.title || "多 AI 对话"), ...rows.slice().reverse().flatMap((r) => ["\n## " + localQuestion(r), ...r.answers.map((a) => "\n### " + webAIProvider(a.providerId).name + " · " + LABEL[a.status] + "\n" + (a.text || a.note) + (a.url ? "\n\n来源：" + a.url : ""))])].join("\n");
    WB.util.copy(content).then(() => WB.toast("对比内容已复制，可保存为 Markdown", "ok")).catch((e) => setError(e.message));
  }
  const hasActive = state.rounds.some((r) => r.topicId === topicId && r.answers.some((a) => WEB_AI_ACTIVE.has(a.status) || a.status === "prepared"));
  return /* @__PURE__ */ React50.createElement("div", { className: "wb-web-ai" }, /* @__PURE__ */ React50.createElement("style", null, WEB_AI_CSS), /* @__PURE__ */ React50.createElement(PageHead, { icon: "messages", title: "多 AI 对话", hint: "使用厂商官网账号；追问沿用各站会话，切换厂商不会重新提问。" }), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap wb-web-toolbar" }, /* @__PURE__ */ React50.createElement("div", { className: "wb-web-topic" }, /* @__PURE__ */ React50.createElement(Btn, { "aria-label": "历史问答", disabled: busy, onClick: () => setShowHistory(!showHistory) }, "历史问答：", /* @__PURE__ */ React50.createElement("span", null, topic?.title || "新问题"))), /* @__PURE__ */ React50.createElement(Btn, { disabled: busy, onClick: newConversation }, "新对话"), /* @__PURE__ */ React50.createElement(Btn, { disabled: !rows.length, onClick: exportComparison }, "复制对比报告"), /* @__PURE__ */ React50.createElement("label", { className: "wb-tiny" }, /* @__PURE__ */ React50.createElement("input", { type: "checkbox", checked: state.chatgptEnabled, disabled: busy, onChange: (e) => safe(async () => {
    const enabled = e.target.checked;
    acceptState(await rpc("webAIConfigure", { chatgptEnabled: enabled }));
    if (!enabled) setSelected((old) => old.filter((id) => id !== "chatgpt"));
  }) }), " 启用 ChatGPT（可选）")), showHistory && /* @__PURE__ */ React50.createElement(HistoryManager, { state, selected: topicId, disabled: busy || caps?.historyProtocol !== 1, onClose: () => setShowHistory(false), onSelect: (id) => {
    chooseTopic(id);
    setPage(0);
    setShowWeb(false);
    setAnswerFilter("all");
    setShowHistory(false);
  }, onManage: async (request) => {
    const next = await rpc("webAIManageTopic", request);
    acceptState(next);
    if (request.topicId === topicId && ["trash", "purge"].includes(request.action)) {
      newConversation();
      setEditing(null);
      setQuestionEdit(null);
    }
  } }), showHistory && caps && caps.historyProtocol !== 1 && /* @__PURE__ */ React50.createElement("p", { className: "wb-web-error", role: "status" }, "历史管理后端尚未加载，请在插件管理中重新启用智能工作台组件。"), error && /* @__PURE__ */ React50.createElement("p", { role: "alert", className: "wb-web-error" }, error), /* @__PURE__ */ React50.createElement(Panel, { title: "提问", icon: "messages" }, /* @__PURE__ */ React50.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React50.createElement("fieldset", { className: "wb-web-providers" }, /* @__PURE__ */ React50.createElement("legend", null, "发送范围"), providers.map((p) => /* @__PURE__ */ React50.createElement("label", { key: p.id }, /* @__PURE__ */ React50.createElement("input", { type: "checkbox", checked: selected.includes(p.id), disabled: busy, onChange: (e) => setSelected((old) => e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id)) }), p.name))), /* @__PURE__ */ React50.createElement("div", { onDragOver: (e) => {
    if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
  }, onDrop: (e) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, onPaste: (e) => {
    const picked = Array.from(e.clipboardData.files);
    if (picked.length) {
      e.preventDefault();
      addFiles(picked, true);
    }
  } }, /* @__PURE__ */ React50.createElement(Textarea, { disabled: busy, "aria-label": "多 AI 对话问题", placeholder: "输入问题，可粘贴图片或添加文件，发送给勾选厂商。", value: draft, onChange: (e) => setDrafts((old) => ({ ...old, [topicId]: e.target.value })), rows: 3 }), !!files.length && !draft.trim() && /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny wb-muted" }, "未填写问题时，将提问：请分析所附附件，并说明关键内容。"), /* @__PURE__ */ React50.createElement(WebAIAttachments, { files, disabled: busy, onAdd: addFiles, onRemove: (id) => setFileDrafts((old) => ({ ...old, [topicId]: files.filter((f) => f.id !== id) })) })), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React50.createElement("label", { className: "wb-tiny" }, /* @__PURE__ */ React50.createElement("input", { type: "checkbox", checked: batch, disabled: busy, onChange: (e) => setBatch(e.target.checked) }), " 批量问题（最多5个，用单独一行 --- 分隔）"), /* @__PURE__ */ React50.createElement(Btn, { kind: "primary", disabled: busy || !draft.trim() && !files.length || !selected.length, onClick: () => safe(() => start(false)) }, busy ? /* @__PURE__ */ React50.createElement(React50.Fragment, null, /* @__PURE__ */ React50.createElement(Spinner, { size: 12 }), "处理中…") : "发送到勾选厂商"), /* @__PURE__ */ React50.createElement(Btn, { disabled: busy || !draft.trim() && !files.length || !selected.length, onClick: () => safe(() => start(true)) }, files.length ? "上传附件并填入" : "仅填入官网"), (busy || hasActive) && /* @__PURE__ */ React50.createElement(Btn, { onClick: () => safe(async () => {
    abort.current?.abort();
    acceptState(await cancelRequest({ topicId }));
  }) }, "停止采集")), /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny wb-muted" }, "首次请在各官网完成登录。自动发送与采集取决于网页兼容性；无法识别时保留官网操作，不重复发送。未发送草稿会保留在输入框。", selected.includes("glm") ? " 智谱提交时会短暂显示内嵌页面。" : ""))), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap wb-web-tabs", role: "group", "aria-label": "回答显示范围" }, /* @__PURE__ */ React50.createElement(Btn, { kind: answerFilter === "all" ? "primary" : "ghost", onClick: () => setAnswerFilter("all") }, "全部回答（", rows.length, "轮）"), providers.map((p) => /* @__PURE__ */ React50.createElement(Btn, { key: p.id, kind: answerFilter === p.id ? "primary" : "ghost", onClick: () => setAnswerFilter(p.id) }, p.name)), /* @__PURE__ */ React50.createElement(Btn, { onClick: () => {
    if (showWeb) setShowWeb(false);
    else safe(() => openProvider(selected[0] || "kimi"));
  } }, showWeb ? "收起官网" : "登录 / 查看原对话")), /* @__PURE__ */ React50.createElement("section", { "aria-label": "登录与原对话", "aria-hidden": !showWeb, ...!showWeb ? { inert: "" } : {}, className: "wb-web-native-region" + (!showWeb ? " is-background" : "") }, /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap wb-web-notice" }, /* @__PURE__ */ React50.createElement("strong", null, webAIProvider(active).name, " 官网"), /* @__PURE__ */ React50.createElement("span", { className: "wb-tiny wb-muted" }, "登录和验证码在官网完成，关闭后继续在工作台看回答。"), /* @__PURE__ */ React50.createElement(Btn, { size: "sm", onClick: () => setShowWeb(false) }, "收起官网"), providers.map((p) => /* @__PURE__ */ React50.createElement(Btn, { key: p.id, size: "sm", kind: active === p.id ? "primary" : "ghost", onClick: () => safe(() => openProvider(p.id)) }, p.name))), /* @__PURE__ */ React50.createElement("details", { className: "wb-web-connection" }, /* @__PURE__ */ React50.createElement("summary", null, "登录保留与兼容性"), /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny wb-muted", role: "status", "aria-label": "登录保留状态" }, browserSessionMessage(browserSessionMode(nativeWebAIBridge()))), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8 } }, /* @__PURE__ */ React50.createElement(Btn, { size: "sm", disabled: !opened[active], onClick: () => safe(async () => {
    const result = await (await getController(active)).execute("inspect");
    setDiagnostics(result.diagnostics);
    setCompatibility(webAIProvider(active).name + "：" + (result.status === "needs_login" ? "请先登录" : result.status === "ready" ? "输入框已识别" : result.status === "generating" ? "正在生成" : "需官网操作") + (result.note ? " · " + result.note : "") + "；" + (result.answerSupported ? "回答容器已识别" : "暂无可识别的回答"));
  }) }, "检查网页兼容")), compatibility && /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny", role: "status" }, compatibility), diagnostics && /* @__PURE__ */ React50.createElement("details", null, /* @__PURE__ */ React50.createElement("summary", null, "兼容性诊断详情"), /* @__PURE__ */ React50.createElement("div", { className: "wb-web-diagnostics" }, /* @__PURE__ */ React50.createElement("p", null, "输入框数量：", diagnostics.editorCount), /* @__PURE__ */ React50.createElement("p", null, "输入框：", JSON.stringify(diagnostics.editor)), /* @__PURE__ */ React50.createElement("p", null, "附件范围：", JSON.stringify(diagnostics.composer)), (diagnostics.filePreviews || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "preview" + i }, "附件预览 ", i + 1, "：", JSON.stringify(item))), (diagnostics.fileInputs || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "file" + i }, "上传输入 ", i + 1, "：", JSON.stringify(item))), (diagnostics.uploadControls || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "upload" + i }, "上传控件 ", i + 1, "：", JSON.stringify(item))), (diagnostics.uploadMenuItems || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "uploadMenu" + i }, "附件菜单 ", i + 1, "：", JSON.stringify(item))), (diagnostics.attachmentShapes || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "attachmentShape" + i }, "图片结构 ", i + 1, "：", JSON.stringify(item))), (diagnostics.parents || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "parent" + i }, "容器 ", i + 1, "：", JSON.stringify(item))), (diagnostics.controls || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "control" + i }, "控件 ", i + 1, "：", JSON.stringify(item))), (diagnostics.messages || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "message" + i }, "消息结构 ", i + 1, "：", JSON.stringify(item))), (diagnostics.userStructure || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "user" + i }, "提问结构 ", i + 1, "：", JSON.stringify(item))), (diagnostics.inputVariants || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "input" + i }, "编辑器候选 ", i + 1, "：", JSON.stringify(item))), (diagnostics.finalControls || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "final" + i }, "完成控件 ", i + 1, "：", JSON.stringify(item))), (diagnostics.turnSummary || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "turn" + i }, "轮次 ", i + 1, "：", JSON.stringify(item))), (diagnostics.answerWidgets || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "widget" + i }, "回答控件 ", i + 1, "：", JSON.stringify(item))), (diagnostics.contentFrames || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "frame" + i }, "正文结构 ", i + 1, "：", JSON.stringify(item))), (diagnostics.endAncestors || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "end" + i }, "结束容器 ", i + 1, "：", JSON.stringify(item))), (diagnostics.bodyParts || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "part" + i }, "正文片段 ", i + 1, "：", JSON.stringify(item))), (diagnostics.codeShapes || []).map((item, i) => /* @__PURE__ */ React50.createElement("p", { key: "code" + i }, "代码结构 ", i + 1, "：", JSON.stringify(item)))))), Object.entries(opened).map(([id, tab]) => /* @__PURE__ */ React50.createElement(NativeWebsite, { key: id, providerId: id, scope: caps?.storageScope || "workbench-web-ai", url: tab.url, visible: active === id, onNavigate: (url) => saveNavigation(id, url), onController: (c) => {
    if (c) controllers.current.set(id, c);
    else controllers.current.delete(id);
  } })), opened[active] && opened[active].topicId !== topicId && /* @__PURE__ */ React50.createElement("p", { className: "wb-web-error" }, "原页面有草稿或正在生成时会保留，请先在官网处理后再切换问答。")), /* @__PURE__ */ React50.createElement("section", { "aria-label": "回答对比" }, !rows.length && /* @__PURE__ */ React50.createElement("div", { className: "wb-web-empty" }, /* @__PURE__ */ React50.createElement("strong", null, "一个问题，对比多家回答"), /* @__PURE__ */ React50.createElement("p", null, "输入问题并勾选厂商即可开始，无需创建主题。官网按需在工作台内展开。")), rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((round) => /* @__PURE__ */ React50.createElement("details", { key: round.id, open: true, className: "wb-web-round" }, /* @__PURE__ */ React50.createElement("summary", null, localQuestion(round)), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React50.createElement(Btn, { size: "sm", disabled: busy || caps?.historyProtocol !== 1 || round.answers.some((a) => WEB_AI_ACTIVE.has(a.status) || a.status === "prepared"), onClick: () => setQuestionEdit(round) }, "编辑本地问题"), round.displayQuestion && /* @__PURE__ */ React50.createElement("span", { className: "wb-tiny wb-muted" }, "已作本地编辑，官网原问题保留")), !!round.attachments?.length && /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny wb-muted" }, "附件：", round.attachments.map((f) => f.name + "（" + Math.ceil(f.size / 1024) + " KB）").join("、")), /* @__PURE__ */ React50.createElement("div", { className: "wb-comparison-grid" }, round.answers.filter((a) => answerFilter === "all" || a.providerId === answerFilter).map((a) => /* @__PURE__ */ React50.createElement("article", { key: a.providerId, className: "wb-web-answer" }, /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap" }, /* @__PURE__ */ React50.createElement("strong", null, webAIProvider(a.providerId).name), /* @__PURE__ */ React50.createElement("span", { className: "wb-tiny" }, LABEL[a.status])), /* @__PURE__ */ React50.createElement("pre", null, a.text || a.note || "等待处理"), a.text && a.note && /* @__PURE__ */ React50.createElement("p", { className: "wb-tiny wb-muted" }, a.note), /* @__PURE__ */ React50.createElement("div", { className: "wb-row wb-row--wrap", style: { gap: 6 } }, /* @__PURE__ */ React50.createElement(Btn, { size: "sm", onClick: () => safe(() => openProvider(a.providerId, round.topicId)) }, "登录 / 查看原对话"), a.capture && /* @__PURE__ */ React50.createElement(Btn, { size: "sm", disabled: busy || WEB_AI_ACTIVE.has(a.status), onClick: () => safe(() => resumeCapture(round, a)) }, a.status === "completed" ? "重新采集本轮" : "采集本轮回答"), /* @__PURE__ */ React50.createElement(Btn, { size: "sm", disabled: WEB_AI_ACTIVE.has(a.status), onClick: () => setEditing({ round, answer: a, text: a.text, url: a.url || "" }) }, "粘贴 / 编辑回答"), a.text && /* @__PURE__ */ React50.createElement(Btn, { size: "sm", onClick: () => safe(() => WB.actions.createKnowledge({ title: round.question.slice(0, 160) + " · " + webAIProvider(a.providerId).name, body: a.text, url: a.url, kind: "note", reviewState: "candidate", sourceLabel: "多 AI 对话" })) }, "存为候选知识"))))))), /* @__PURE__ */ React50.createElement(Pagination, { page, total: rows.length, onChange: setPage })), questionEdit && topic && /* @__PURE__ */ React50.createElement(QuestionEditor, { key: questionEdit.id, round: questionEdit, onClose: () => setQuestionEdit(null), onSave: async (text) => {
    acceptState(await rpc("webAIEditQuestion", { topicId: topic.id, roundId: questionEdit.id, text, expectedVersion: topic.version || 0 }));
  } }), editing && /* @__PURE__ */ React50.createElement(Panel, { title: "保存 " + webAIProvider(editing.answer.providerId).name + " 官网回答", icon: "edit" }, /* @__PURE__ */ React50.createElement("div", { className: "wb-stack" }, /* @__PURE__ */ React50.createElement(Field, { label: "回答正文" }, /* @__PURE__ */ React50.createElement(Textarea, { "aria-label": "粘贴官网回答", rows: 8, value: editing.text, onChange: (e) => setEditing({ ...editing, text: e.target.value }) })), /* @__PURE__ */ React50.createElement(Field, { label: "官网会话链接（可选）" }, /* @__PURE__ */ React50.createElement(Input, { "aria-label": "官网回答来源链接", value: editing.url, onChange: (e) => setEditing({ ...editing, url: e.target.value }) })), /* @__PURE__ */ React50.createElement("div", { className: "wb-row", style: { gap: 8 } }, /* @__PURE__ */ React50.createElement(Btn, { kind: "primary", disabled: !editing.text.trim(), onClick: () => safe(async () => {
    acceptState(await rpc("webAIRecord", { roundId: editing.round.id, providerId: editing.answer.providerId, text: editing.text, url: editing.url, expectedUpdatedAt: editing.answer.updatedAt }));
    setEditing(null);
  }) }, "保存官网回答"), /* @__PURE__ */ React50.createElement(Btn, { onClick: () => setEditing(null) }, "取消编辑")))));
}
WB.pages["web-ai"] = WebAIPage;

// src/client.ts
var name = "dsh-dev-workbench";
var inject = WB.inject;
var apply2 = WB.apply;

return module.exports;
} });
