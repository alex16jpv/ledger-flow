// Builds design/preview/*.html. The HTML pages are the deliverable; this file is the tool that writes them.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("./preview/", import.meta.url);
const TOKENS = "../../tokens";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
// Python's round() breaks ties to even; the pages were generated with it.
const round = (v) => {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};
const range = (start, stop, step = 1) => {
  const out = [];
  for (let i = start; i < stop; i += step) out.push(i);
  return out;
};
const titleCase = (s) => s[0] + s.slice(1).toLowerCase();
const pad2 = (n) => String(n).padStart(2, "0");

const iconSvg = (name, cls = "") =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const docHead = (title) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Ledger Flow diseño</title>
<link rel="stylesheet" href="${TOKENS}/palette.tinta.css"><link rel="stylesheet" href="${TOKENS}/palette.brisa.css">
<link rel="stylesheet" href="${TOKENS}/semantic.css"><link rel="stylesheet" href="${TOKENS}/base.css">
<link rel="stylesheet" href="assets/ui.css"><link rel="stylesheet" href="assets/shell.css">
<script defer src="assets/icons.js"></script><script defer src="assets/shell.js"></script></head><body>`;

const DOC_FOOT = "</body></html>";

const money = (v, sign = "") => `${sign}<span class="cur">$</span>${nf.format(Math.abs(v))}`;

const amount = (v, kind = "expense", cls = "") => {
  const sign = { expense: "−", income: "+", transfer: "", adjustment: "±" }[kind];
  return `<span class="amount ${kind} ${cls}">${sign}${money(v)}</span>`;
};

const tile = (icon, color, size = "") =>
  `<span class="tile ${size} color-${color}">${iconSvg(icon)}</span>`;

const tab = (icon, label, active = false, dot = false) =>
  `<a class="tab${active ? " active" : ""}" href="#">${iconSvg(icon)}<span>${label}</span>${dot ? "<i class=dot></i>" : ""}</a>`;

const tabbar = (active) => `<nav class="tabbar" aria-label="Navegación">
${tab("house", "Home", active == "inicio")}${tab("list", "Transactions", active == "mov", true)}
<div class="fab-slot"><button class="fab" aria-label="Add expense">${iconSvg("plus")}</button></div>
${tab("chart-pie", "Budgets", active == "pres")}${tab("wallet", "Accounts", active == "cuentas")}</nav>`;

const navlink = (icon, label, active = false, count = null) => {
  const c = count ? `<span class="count">${count}</span>` : "";
  return `<a class="navlink${active ? " active" : ""}" href="#">${iconSvg(icon)}<span>${label}</span>${c}</a>`;
};

const sidebar = (active) => `<aside class="sidebar">
<div class="brand"><span class="logo">${iconSvg("layers", "sm")}</span>Ledger Flow</div>
<button class="btn primary block cta">${iconSvg("plus", "sm")} Add</button>
${navlink("house", "Home", active == "inicio")}${navlink("list", "Transactions", active == "mov", 3)}
${navlink("chart-pie", "Budgets", active == "pres")}${navlink("wallet", "Accounts", active == "cuentas")}
${navlink("chart-column", "Stats", active == "stats")}${navlink("tags", "Categories", active == "cat")}
<div class="footer">${navlink("settings", "Settings", active == "ajustes")}
<a class="navlink" href="#"><span class="avatar" style="width:28px;height:28px;font-size:11px">AV</span><span class="truncate">Andrés Valencia</span></a></div></aside>`;

const device = (inner, label = null, extraCls = "") => {
  const lab = label ? `<div class="pv-title">${label}</div>` : "";
  return `<div class="pv-item">${lab}<div class="device ${extraCls}"><div class="app">${inner}</div></div></div>`;
};

const row = (icon, color, title, meta, amt, kind = "expense", o = {}) => {
  const subh = o.sub ? `<span class="sub">${o.sub}</span>` : "";
  return `<a class="row${o.pending ? " pending" : ""}" href="#">${tile(icon, color)}
<span class="body"><span class="title"><span class="truncate">${title}</span>${o.badges ?? ""}</span><span class="meta">${meta}</span></span>
<span class="right">${amount(amt, kind)}${subh}</span></a>`;
};

const CATS = {
  Food: ["utensils", "ORANGE"],
  Transport: ["car", "BLUE"],
  Housing: ["house", "BROWN"],
  Bills: ["zap", "AMBER"],
  Lifestyle: ["shopping-bag", "PINK"],
  Coffee: ["coffee", "BROWN"],
  Health: ["stethoscope", "RED"],
  Pets: ["dog", "YELLOW"],
  Salary: ["briefcase", "GREEN"],
  Business: ["coins", "TEAL"],
  "Other income": ["circle-plus", "LIME"],
  Transfer: ["repeat", "GRAY"],
  "Card payment": ["credit-card", "INDIGO"],
  Uncategorized: ["hash", "NONE"],
};

const catChip = (name, selected = false) => {
  const [ic, col] = CATS[name];
  return `<button class="chip cat color-${col}${selected ? " selected" : ""}"><span class="dot">${iconSvg(ic)}</span>${name}</button>`;
};

const home = ({ withSheet = false, unnamed = false, notice = false } = {}) => {
  const bars = [
    [30, ""],
    [55, ""],
    [20, ""],
    [65, ""],
    [40, ""],
    [15, "nil"],
    [70, ""],
    [45, ""],
    [90, "hi"],
    [35, ""],
    [25, ""],
    [50, ""],
    [60, ""],
    [15, "nil"],
    [30, ""],
    [75, ""],
    [40, ""],
    [55, ""],
    [20, ""],
    [45, ""],
    [85, "hi"],
    [30, ""],
    [40, ""],
    [60, ""],
    [35, ""],
    [50, ""],
    [25, ""],
    [65, ""],
    [45, ""],
    [38, "today"],
    [0, "nil"],
  ]
    .map(([h, c]) => `<i style="height:${h}%" class="${c}"></i>`)
    .join("");
  const hero = `<section class="card">
<div class="card-head"><span class="eyebrow">September spending</span><span class="badge outline">${iconSvg("calendar")}Day 22 of 30</span></div>
<div class="amount-hero">${money(1284300)}</div>
<p class="small muted" style="margin:6px 0 14px">Daily average <b class="amount">${money(42800)}</b> · <span class="faint">Yesterday you spent $38,500</span></p>
<div class="bars" aria-label="Spending per day">${bars}</div>
<div class="hstack" style="margin-top:14px;gap:12px">
<div class="progress color-INDIGO" style="flex:1"><span class="fill" style="width:64%"></span>${paceMark()}</div>
<span class="small muted" style="white-space:nowrap">64% of monthly budget</span></div>
</section>`;
  const pend = `<a class="alert warning" href="#" style="align-items:center">${iconSvg("inbox")}<span style="flex:1"><b>3 quick expenses to review</b> · $47,900 in total</span>${iconSvg("chevron-right", "sm")}</a>`;
  const installCard = notice
    ? `<section class="card hstack" style="gap:12px;align-items:flex-start">${tile("monitor-smartphone", "AMBER")}
<span class="body" style="flex:1;display:flex;flex-direction:column;gap:6px">
<span class="h3">Keep your data on this phone</span>
<span class="small muted">This browser can delete what you record offline after a few days without opening the site. Installing the app stops that.</span>
<span class="hstack" style="gap:8px;margin-top:4px"><button class="btn primary sm">${iconSvg("download", "sm")}Install</button><button class="btn secondary sm">How</button><button class="btn ghost sm">Not now</button></span>
</span></section>`
    : "";
  const stats = `<section class="stats">
<div class="card stat"><span class="k">Total balance</span><span class="v amount">${money(11258600)}</span><span class="d faint">4 accounts</span></div>
<div class="card stat"><span class="k">Income this month</span><span class="v amount income">${money(4200000, "+")}</span><span class="d up">${iconSvg("trending-up", "sm")}Same as August</span></div>
<div class="card stat desktop-only"><span class="k">Estimated savings</span><span class="v amount">${money(2915700)}</span><span class="d faint">Income − spending</span></div>
</section>`;
  const bud = (name, spent, limit, note, warn = "") => {
    const [ic, col] = CATS[name];
    const pct = Math.min(100, round((spent / limit) * 100));
    return `<div class="stack-sm" style="padding:10px 0">
<div class="hstack">${tile(ic, col, "sm")}<span style="font-weight:500;flex:1">${name}</span><span class="small muted amount">${money(spent)} <span class="faint">/ ${money(limit)}</span></span></div>
<div class="progress thin color-${col} ${warn}"><span class="fill" style="width:${pct}%"></span></div>
<span class="xs faint">${note}</span></div>`;
  };
  const budgetsSection = `<section class="card">
<div class="card-head"><h3 class="h3">Budgets</h3><a class="link small" href="#" style="color:var(--brand-text);font-weight:500">See all</a></div>
${bud("Food", 412000, 600000, "$188,000 left · on track")}${bud("Transport", 185500, 200000, "At 93% with 8 days left", "warn")}${bud("Lifestyle", 356000, 300000, "Over by $56,000", "over")}
</section>`;
  const acct = (name, typ, color, bal, isDefault = false, neg = false) => {
    const d = isDefault ? `<span class="badge brand">${iconSvg("star")}Main</span>` : "";
    return `<a class="account-card color-${color}" href="#"><div class="top"><span class="dot"></span><span class="name truncate">${name}</span>${d}</div>
<div><div class="amount-lg amount">${neg ? "−" : ""}${money(bal)}</div><div class="type">${typ}</div></div></a>`;
  };
  const accountsSection = `<section class="stack-sm"><div class="section-head"><h3 class="h3">Accounts</h3><a class="link" href="#">See all</a></div>
<div class="hscroll">${acct("Bancolombia", "Bank account", "BLUE", 3420500, true)}${acct("Cash", "Cash", "GRAY", 184000)}${acct("Visa Gold", "Credit card", "PURPLE", 1245900, false, true)}${acct("Savings", "Savings", "GREEN", 8900000)}</div></section>`;
  const recent = `<section class="stack-sm"><div class="section-head"><h3 class="h3">Recent transactions</h3><a class="link" href="#">See all</a></div>
<div class="list card flush">
${row("hash", "NONE", "Quick expense", "Today 8:42 · Bancolombia", 12500, "expense", { pending: true, badges: '<span class="badge warning">To review</span>' })}
${row("coffee", "BROWN", "Pergamino Coffee", "Today 7:55 · Cash", 9800, "expense", { sub: "#coffee" })}
${row("briefcase", "GREEN", "August salary", "Yesterday · Bancolombia", 4200000, "income")}
${row("repeat", "GRAY", "Bancolombia → Savings", "Yesterday · Transfer", 1000000, "transfer")}
${row("car", "BLUE", "Uber to work", "Yesterday 18:10 · Visa Gold", 18400)}
</div></section>`;
  const greet = unnamed ? "Hi" : "Hi, Andrés";
  const av = unnamed
    ? `<a class="avatar" href="#" aria-label="Settings">${iconSvg("user", "sm")}</a>`
    : '<a class="avatar" href="#" aria-label="Settings">AV</a>';
  const header = `<header class="page-header"><div class="title"><span class="eyebrow">Tuesday, September 22</span><h1 class="h1">${greet}</h1></div>
<div class="actions"><button class="btn ghost icon-only round desktop-only" aria-label="Search">${iconSvg("search")}</button>${av}</div></header>`;
  const mobile = `${header}${pend}${installCard}${hero}${stats}${budgetsSection}${accountsSection}${recent}`;
  const desk = `${header}${pend}${installCard}<div class="grid-main"><div class="stack" style="gap:20px">${hero}${stats}${recent}</div><div class="stack" style="gap:20px">${budgetsSection}${accountsSection}</div></div>`;
  const sheet = withSheet ? quickSheet() : "";
  return `<div class="shell">${sidebar("inicio")}<main class="main">
<div class="page mobile-only">${mobile}</div><div class="page desktop-only">${desk}</div>
</main>${tabbar("inicio")}</div>${sheet}`;
};

const quickSheet =
  () => `<div class="scrim"><div class="sheet" role="dialog" aria-label="Add expense">
<div class="handle"></div>
<div class="sheet-head"><span class="h3">Add expense</span><button class="btn ghost icon-only sm round" aria-label="Close">${iconSvg("x", "sm")}</button></div>
<div class="amount-input"><span class="cur">$</span><span class="num">12,500</span><span class="caret"></span></div>
<div class="stack-sm"><span class="label">Category <span class="opt">optional · you can add it later</span></span>
<div class="chips">${catChip("Food", true)}${catChip("Coffee")}${catChip("Transport")}${catChip("Lifestyle")}${catChip("Bills")}<button class="chip">${iconSvg("ellipsis", "sm")}More</button></div></div>
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">From your main account</span><span class="val">Bancolombia · $3,420,500</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="input"><span class="placeholder" style="flex:1">Quick note (optional)</span>${iconSvg("notebook-pen", "sm")}</div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">More details</button><button class="btn primary lg" style="flex:1.4">Save</button></div>
</div></div>`;

const transactionForm = (kind = "EXPENSE") => {
  const seg = [
    ["EXPENSE", "Expense", ""],
    ["INCOME", "Income", "income"],
    ["TRANSFER", "Transfer", "transfer"],
    ["ADJUSTMENT", "Adjustment", ""],
  ]
    .map(([k, t, c]) => `<button aria-pressed="${String(k == kind)}" class="${c}">${t}</button>`)
    .join("");
  let accounts;
  let cat;
  if (kind == "TRANSFER") {
    accounts = `<div class="stack-sm">
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">From</span><span class="val">Bancolombia · $3,420,500</span></span>${iconSvg("chevron-down", "sm")}</button>
<div style="display:flex;justify-content:center;margin:-4px 0"><button class="btn secondary icon-only sm round" aria-label="Swap">${iconSvg("arrow-left-right", "sm")}</button></div>
<button class="picker">${tile("piggy-bank", "GREEN", "sm")}<span class="body"><span class="lbl">To</span><span class="val">Savings · $8,900,000</span></span>${iconSvg("chevron-down", "sm")}</button></div>`;
    cat = "";
  } else {
    accounts = `<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">Account</span><span class="val">Bancolombia · $3,420,500</span></span>${iconSvg("chevron-down", "sm")}</button>`;
    cat = `<div class="stack-sm"><span class="label">Category</span>
<div class="chips">${catChip("Food")}${catChip("Coffee")}${catChip("Transport", true)}${catChip("Bills")}${catChip("Health")}<button class="chip">${iconSvg("search", "sm")}Search</button></div></div>`;
  }
  return `<div class="shell">${sidebar("")}<main class="main"><div class="page" style="max-width:640px">
<header class="page-header"><button class="btn ghost icon-only round" aria-label="Back">${iconSvg("arrow-left")}</button><h1 class="h2" style="flex:1;text-align:center">New transaction</h1><span style="width:40px"></span></header>
<div class="segment">${seg}</div>
<div class="amount-input" style="padding-top:8px"><span class="cur">$</span><span class="num">18,400</span></div>
${cat}
${accounts}
<div class="input-group">
<div class="field"><span class="label">Date</span><div class="input">${iconSvg("calendar", "sm")}<span class="value">Today</span></div></div>
<div class="field"><span class="label">Time</span><div class="input">${iconSvg("clock", "sm")}<span class="value">18:10</span></div></div></div>
<div class="field"><span class="label">Description <span class="opt">optional</span></span><div class="input focus"><span class="value">Uber to work</span></div></div>
<div class="field"><span class="label">Tags <span class="opt">optional</span></span><div class="input" style="height:auto;min-height:48px;padding:8px 12px;flex-wrap:wrap"><span class="tag">work</span><span class="placeholder">Add…</span></div>
<div class="chips" style="margin-top:2px"><button class="chip" style="height:28px">#travel</button><button class="chip" style="height:28px">#monthly</button><button class="chip" style="height:28px">#latte</button></div></div>
<div class="field"><span class="label">Note <span class="opt">optional</span></span><div class="input textarea"><span class="placeholder">Anything you want to remember about this one</span></div></div>
<div class="hstack" style="gap:10px;padding:8px 0 12px"><button class="btn primary lg block">Save transaction</button></div>
</div></main></div>`;
};

const budgets = () => {
  const card = (name, spent, limit, period, note, o = {}) => {
    const [ic, col] = o.icon ? [o.icon, o.color] : CATS[name];
    const pct = limit ? Math.min(100, round((spent / limit) * 100)) : 0;
    const rem = limit - spent;
    const remTxt =
      rem >= 0
        ? `<b>${money(rem)}</b> left`
        : `<b style="color:var(--danger)">Over by ${money(-rem)}</b>`;
    return `<a class="card stack-sm color-${col}" href="#" style="gap:10px;${o.expired ? "opacity:.72" : ""}">
<div class="hstack" style="gap:12px">${tile(ic, col)}<span class="body" style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-weight:500" class="truncate">${name}</span><span class="small faint">${period}</span></span>${o.badges ?? ""}</div>
<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="amount-lg amount">${money(spent)}</span><span class="small muted amount">of ${money(limit)}</span></div>
<div class="progress color-${col} ${o.warn ?? ""}"><span class="fill" style="width:${pct}%"></span></div>
<span class="small muted amount">${remTxt} <span class="faint">· ${note}</span></span></a>`;
  };
  const glob = `<section class="card color-INDIGO" style="background:linear-gradient(135deg,var(--brand-soft),var(--surface) 70%)">
<div class="card-head"><span class="eyebrow">Total monthly budget</span><span class="badge brand">${iconSvg("sparkles")}Global</span></div>
<div class="hstack" style="justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px"><span class="amount-hero" style="font-size:34px">${money(1284300)}</span><span class="muted amount">of ${money(2000000)}</span></div>
<div class="progress" style="margin:12px 0 8px;height:8px"><span class="fill" style="width:64%;background:var(--brand)"></span>${paceMark()}</div>
<div class="hstack small muted" style="justify-content:space-between"><span><b class="amount">${money(715700)}</b> left for 8 days</span><span class="amount">≈ ${money(89400)}/day</span></div>
</section>`;
  const cards = [
    card("Food", 412000, 600000, "Monthly · Sep 1–30", "8 days left"),
    card("Transport", 185500, 200000, "Monthly · Sep 1–30", "fast pace", { warn: "warn" }),
    card("Lifestyle", 356000, 300000, "Monthly · Sep 1–30", "this month", {
      warn: "over",
      badges: `<span class="badge">${iconSvg("pencil")}Adjusted</span>`,
    }),
    card("Coffee", 38000, 80000, "Weekly · Sep 21–27", "5 more days"),
    card("Bills", 0, 350000, "Biweekly · Sep 14–27", "nothing spent yet"),
    card("Vacation", 1850000, 2500000, "Custom · Sep 15 – Oct 15", "ends in 23 days", {
      icon: "plane",
      color: "CYAN",
      badges: `<span class="badge warning">${iconSvg("archive")}Archived category</span>`,
    }),
  ].join("");
  const header = `<header class="page-header"><div class="title"><h1 class="h1">Budgets</h1></div>
<div class="actions"><button class="btn ghost icon-only round" aria-label="Past budgets">${iconSvg("archive")}</button><button class="btn primary desktop-only">${iconSvg("plus", "sm")}New budget</button><button class="btn secondary icon-only round mobile-only" aria-label="New">${iconSvg("plus")}</button></div></header>`;
  const period = `<div class="period-nav"><button class="btn ghost icon-only round" aria-label="Previous month">${iconSvg("chevron-left")}</button><span class="label">September 2026</span><button class="btn ghost icon-only round" aria-label="Next month" disabled>${iconSvg("chevron-right")}</button></div>
<div class="chips"><button class="chip selected">All</button><button class="chip">Monthly</button><button class="chip">Weekly</button><button class="chip">Biweekly</button><button class="chip">Quarterly</button><button class="chip">Yearly</button><button class="chip">Custom</button></div>`;
  return `<div class="shell">${sidebar("pres")}<main class="main"><div class="page">
${header}${period}${glob}
<div class="grid-2">${cards}</div>
<div class="empty" style="padding:24px 16px 8px"><span class="small faint">Balance adjustments and transfers never count toward a budget.</span></div>
</div></main>${tabbar("pres")}</div>`;
};

const COLOR_NAMES = [
  "RED",
  "ORANGE",
  "AMBER",
  "YELLOW",
  "LIME",
  "GREEN",
  "TEAL",
  "CYAN",
  "BLUE",
  "INDIGO",
  "PURPLE",
  "PINK",
  "ROSE",
  "GRAY",
  "BROWN",
  "BLACK",
];

const foundations = () => {
  const names = COLOR_NAMES;
  const sw = (
    n,
  ) => `<div class="color-${n}" style="display:flex;flex-direction:column;gap:6px;align-items:center">
<span class="tile lg">${iconSvg("utensils")}</span><span class="dot" style="width:14px;height:14px"></span>
<span class="badge" style="background:var(--f-soft);color:var(--f-text)">${titleCase(n)}</span></div>`;
  const block = (
    scheme,
  ) => `<div class="app" style="color-scheme:${scheme};padding:20px;border-radius:14px;display:flex;flex-direction:column;gap:20px">
<div class="hstack" style="justify-content:space-between"><span class="eyebrow">${scheme == "light" ? "Light" : "Dark"} mode · derived from the same seeds</span></div>
<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:14px">${names.map(sw).join("")}</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
${["bg", "surface", "surface-2", "surface-3"].map((v) => `<div style="border-radius:10px;padding:10px;background:var(--${v});border:1px solid var(--border)"><span class="xs" style="color:var(--text-2)">${v}</span></div>`).join("")}
</div>
<div class="hstack" style="gap:10px;flex-wrap:wrap"><button class="btn primary">Primary</button><button class="btn secondary">Secondary</button><button class="btn soft">Soft</button><button class="btn ghost">Ghost</button><button class="btn danger">Danger</button><button class="btn ink">Ink</button></div>
<div class="hstack" style="gap:16px;flex-wrap:wrap">${amount(48200)}${amount(4200000, "income")}${amount(1000000, "transfer")}${amount(1500, "adjustment")}
<span class="badge warning">${iconSvg("inbox")}To review</span><span class="badge success">${iconSvg("check")}On track</span><span class="badge danger">Over budget</span><span class="badge info">Transfer</span><span class="badge">Archived</span><span class="badge brand">${iconSvg("star")}Main</span></div>
<div class="list card flush" style="max-width:520px">${row("coffee", "BROWN", "Pergamino Coffee", "Today 7:55 · Cash", 9800, "expense", { sub: "#coffee" })}${row("briefcase", "GREEN", "August salary", "Yesterday · Bancolombia", 4200000, "income")}</div>
<div class="card" style="max-width:520px;display:flex;flex-direction:column;gap:12px"><div class="field"><span class="label">Field</span><div class="input"><span class="value">Value</span></div></div><div class="field"><span class="label">Focused</span><div class="input focus"><span class="value">Uber to work</span></div></div><div class="field"><span class="label">With error</span><div class="input error"><span class="value">1000.50</span></div><span class="help error">${iconSvg("circle-alert", "sm")}Your currency (COP) has no decimals</span></div>
<div class="segment"><button aria-pressed="true">Expense</button><button class="income">Income</button><button class="transfer">Transfer</button><button>Adjustment</button></div>
<div class="progress color-ORANGE"><span class="fill" style="width:68%"></span></div><div class="progress warn"><span class="fill" style="width:93%"></span></div><div class="progress over"><span class="fill" style="width:100%"></span></div>
<div class="alert warning">${iconSvg("triangle-alert")}<span><b>Bancolombia becomes your main account.</b> Cash no longer is; quick expenses will go to Bancolombia.</span></div>
<div class="toast" style="position:static;transform:none;width:fit-content">${iconSvg("check")}Transaction saved<button class="action">Undo</button></div>
<div class="alert success">${iconSvg("circle-check")}<span><b>Nothing left to resolve.</b> This change is no longer waiting to sync.</span></div>
<div class="hstack" style="gap:20px;flex-wrap:wrap;align-items:flex-end;padding-top:14px"><span class="projected"><span class="amount-lg amount">${money(1284300)}</span><span class="tooltip show">${iconSvg("cloud-off")}<span class="tip">Includes changes not yet synced</span></span></span><span class="badge warning">${iconSvg("cloud-off")}Pending sync</span><span class="badge danger">${iconSvg("cloud-off")}Needs attention</span><span class="badge danger">Account archived</span><span class="step-dots"><i class="on"></i><i></i></span><span class="tooltip show">${iconSvg("info")}<span class="tip">Tooltip · hover or focus</span></span></div>
<div class="banner error" role="alert" style="position:static;border-radius:10px">${iconSvg("circle-alert")}<span class="txt"><b>Some changes need your attention.</b><span class="sub">2 changes could not sync</span></span><span class="actions"><button class="action">Review</button><button class="action">See all</button></span></div>
<div class="hstack"><span class="skeleton" style="width:40px;height:40px;border-radius:12px"></span><span class="stack-sm" style="flex:1"><span class="skeleton" style="height:12px;width:60%"></span><span class="skeleton" style="height:10px;width:35%"></span></span></div></div>
</div>`;
  const iconsCat = [
    "house",
    "utensils",
    "car",
    "zap",
    "shopping-bag",
    "briefcase",
    "coins",
    "circle-plus",
    "repeat",
    "credit-card",
    "coffee",
    "stethoscope",
    "dog",
    "cat",
    "pizza",
    "shopping-cart",
    "bus",
    "fuel",
    "plane",
    "train-front",
    "bike",
    "pill",
    "dumbbell",
    "graduation-cap",
    "book-open",
    "gamepad-2",
    "music",
    "film",
    "tv",
    "wifi",
    "phone",
    "droplets",
    "flame",
    "lightbulb",
    "shirt",
    "scissors",
    "baby",
    "wrench",
    "hammer",
    "paint-bucket",
    "sofa",
    "bed",
    "key",
    "shield",
    "umbrella",
    "hand-coins",
    "percent",
    "gift",
    "heart",
    "star",
    "trophy",
    "sprout",
    "leaf",
    "beer",
    "wine",
    "cake",
    "ice-cream-cone",
    "apple",
    "carrot",
    "croissant",
    "sandwich",
    "ticket",
    "popcorn",
    "headphones",
    "camera",
    "laptop",
    "bath",
    "washing-machine",
    "trees",
    "mountain",
    "tent",
    "ship",
    "glasses",
    "watch",
    "gem",
    "crown",
    "medal",
    "paintbrush",
    "footprints",
    "cookie",
    "martini",
    "church",
    "store",
    "shopping-basket",
    "package",
    "truck",
    "plug",
    "battery",
    "radio",
    "speaker",
    "piggy-bank",
    "landmark",
    "banknote",
    "wallet",
    "receipt",
    "calculator",
    "scale",
    "target",
    "layers",
    "building-2",
    "trending-up",
    "trending-down",
    "arrow-left-right",
    "tag",
    "hash",
  ];
  const typeScale = [
    ["h1 / 24 semibold", "h1", "Hi, Andrés"],
    ["h2 / 17 semibold", "h2", "New transaction"],
    ["h3 / 15 semibold", "h3", "Budgets"],
    ["base / 14 regular", "", "Body copy and list rows."],
    ["small / 12", "small muted", "Metadata, dates, source account."],
    ["eyebrow / 11 caps", "eyebrow", "September spending"],
  ];
  const inner = `<div class="pv-stage">
<div class="pv-note"><b>Fundamentos.</b> Cada color de la interfaz sale de 18 semillas OKLCH (neutro, marca y los 16 tokens del backend). Claro y oscuro se derivan con las mismas reglas: la paleta no decide colores por modo. Cambia la paleta arriba para ver cómo todo se repinta sin tocar componentes.</div>
<div class="pv-grid" style="grid-template-columns:1fr">${block("light")}${block("dark")}</div>
<div class="pv-note"><b>Tipografía.</b> Geist (variable) para toda la interfaz; cifras tabulares en cualquier importe. Geist Mono solo para claves técnicas (códigos, períodos, user-agents).</div>
<div class="app" style="padding:20px;border-radius:14px;display:grid;grid-template-columns:200px 1fr;gap:14px 24px;align-items:baseline;width:100%;max-width:1280px">
${typeScale.map(([l, c, t]) => `<span class="xs faint mono">${l}</span><span class="${c}">${t}</span>`).join("")}
<span class="xs faint mono">amount-hero / 40</span><span class="amount-hero">${money(1284300)}</span>
<span class="xs faint mono">amount-lg / 24</span><span class="amount-lg amount">${money(3420500)}</span>
<span class="xs faint mono">mono / 12</span><span class="mono muted">2026-09 · America/Bogota · COP</span></div>
<div class="pv-note"><b>Iconografía.</b> Lucide (ISC), trazo 1.75. Set curado de ${iconsCat.length} iconos para categorías; se guarda la clave (p. ej. <code>utensils</code>) en <code>Category.icon</code>. Se tiñen con el color del token: el mismo icono funciona en claro y oscuro y en cualquier paleta.</div>
<div class="app" style="padding:20px;border-radius:14px;width:100%;max-width:1280px;display:flex;flex-wrap:wrap;gap:10px">
${iconsCat.map((n, i) => `<span class="tile color-${names[i % 16]}" title="${n}">${iconSvg(n)}</span>`).join("")}</div>
</div>`;
  return docHead("Fundamentos") + inner + DOC_FOOT;
};

const page = (title, body, note = null, extra = "") => {
  const n = note ? `<div class="pv-note">${note}</div>` : "";
  return docHead(title) + `<div class="pv-stage">${n}${body}${extra}</div>` + DOC_FOOT;
};

const indexPage = () => {
  const lis = PAGES.map(
    ([h, t, d]) =>
      `<a href="${h}" style="display:block;padding:14px 16px;border:1px solid #2a2a2e;border-radius:10px;color:#e6e6e8;text-decoration:none;background:#111113"><b>${t}</b><br><span style="color:#9a9aa3">${d}</span></a>`,
  ).join("");
  return (
    docHead("Índice") +
    `<div class="pv-stage"><div class="pv-note" style="max-width:720px"><b>Ledger Flow · rediseño UI/UX — entrega completa (punto de revisión 2)</b><br>
Fundamentos y todas las pantallas del mapa (DESIGN.md §5). Usa la barra superior para cambiar paleta, modo y dispositivo; todo el contenido se repinta desde los tokens. Abre estos archivos directamente desde el disco, no necesitan servidor ni conexión.<br><br>
La especificación completa está en <code>../DESIGN.md</code>; los tokens listos para Tailwind en <code>../tokens/</code>.</div>
<div style="display:grid;gap:12px;width:100%;max-width:720px">${lis}</div></div>` +
    DOC_FOOT
  );
};

const PAGES = [
  [
    "00-fundamentos.html",
    "Fundamentos",
    "Paleta, derivación claro/oscuro, tipografía, iconografía, componentes.",
  ],
  ["01-inicio.html", "Inicio", "Gasto del mes, pendientes, presupuestos, cuentas, movimientos."],
  ["02-registrar.html", "Registrar", "Captura rápida y formulario completo con los cuatro tipos."],
  [
    "03-presupuestos.html",
    "Presupuestos",
    "Listado por período con global, avisos, override y personalizado.",
  ],
  [
    "04-acceso.html",
    "Acceso",
    "Login, registro con moneda y zona horaria, onboarding en dos pasos.",
  ],
  [
    "05-movimientos.html",
    "Movimientos",
    "Lista, hoja de filtros, detalle (con conflicto de sync), bandeja de pendientes (Save all, categoría descartada), lista sin conexión.",
  ],
  [
    "06-cuentas.html",
    "Cuentas",
    "Lista, detalle, nueva/editar, ajuste de saldo y restaurar con otro nombre.",
  ],
  [
    "07-categorias.html",
    "Categorías",
    "Rejilla por tipo, nueva/editar con icono y color, tipo bloqueado, restaurar predeterminadas sin conexión.",
  ],
  [
    "08-presupuesto-detalle.html",
    "Presupuesto",
    "Detalle con override por período, nuevo/editar, pasados, archivado con restaurar y su conflicto.",
  ],
  [
    "09-estadisticas.html",
    "Estadísticas",
    "Por categoría (con tooltip por tramo), por día y por etiqueta con drill-down.",
  ],
  [
    "10-ajustes.html",
    "Ajustes",
    "Perfil, idioma, preferencias, apariencia, sesiones, eliminar cuenta, Sync status, instalar, salir con cambios pendientes, sin conexión.",
  ],
  [
    "11-estados.html",
    "Estados",
    "Vacío, carga, error, sesión expirada, confirmación, offline, franjas de sync, conflicto (I), bandeja «Needs your attention», modo local, documento offline, cifras proyectadas.",
  ],
  ["12-publico.html", "Público", "Landing indexable, política de privacidad, 404."],
  [
    "13-variaciones.html",
    "Variaciones",
    "Alternativas de un mismo componente para que el dueño elija: tipo de cuenta (F-03), contador de la franja verde (F-62), marcador de ritmo (F-08).",
  ],
];

const screen = (body, o = {}) => {
  const {
    tab: tabName = "",
    side = "",
    back = null,
    title = null,
    actions = "",
    narrow = false,
    sheet = "",
    banner = "",
  } = o;
  let header;
  if (back !== null) {
    header = `<header class="page-header"><button class="btn ghost icon-only round" aria-label="Back">${iconSvg("arrow-left")}</button><h1 class="h2" style="flex:1;text-align:center">${title}</h1><div class="actions" style="min-width:40px;justify-content:flex-end">${actions}</div></header>`;
  } else if (title) {
    header = `<header class="page-header"><div class="title"><h1 class="h1">${title}</h1></div><div class="actions">${actions}</div></header>`;
  } else {
    header = "";
  }
  const mw = narrow ? ' style="max-width:640px"' : "";
  return `<div class="shell">${sidebar(side)}<main class="main">${banner}<div class="page"${mw}>${header}${body}</div></main>${tabbar(tabName)}</div>${sheet}`;
};

const field = (label, value = null, placeholder = null, o = {}) => {
  const lab = `<span class="label">${label}${o.opt ? " <span class=opt>optional</span>" : ""}</span>`;
  const ic = o.icon ? iconSvg(o.icon, "sm") : "";
  const inner = value
    ? `<span class="value">${value}</span>`
    : `<span class="placeholder" style="flex:1">${placeholder ?? ""}</span>`;
  const h = o.help ? `<span class="help">${o.help}</span>` : "";
  const e = o.error
    ? `<span class="help error">${iconSvg("circle-alert", "sm")}${o.error}</span>`
    : "";
  return `<div class="field">${lab}<div class="input ${o.cls ?? ""}${o.error ? " error" : ""}">${ic}${inner}</div>${h}${e}</div>`;
};

const paceMark = (left = 73, txt = "Day 22 of 30 · 73% expected", show = false) =>
  `<button class="mark tooltip${show ? " show" : ""}" style="left:${left}%" aria-label="${txt}"><span class="tip">${txt}</span></button>`;

const swatches = (selected = "BLUE") =>
  '<div class="hstack" style="flex-wrap:wrap;gap:12px 14px;padding:4px 2px">' +
  COLOR_NAMES.map(
    (n) =>
      `<button class="swatch color-${n}" aria-label="${titleCase(n)}" aria-pressed="${String(n == selected)}"></button>`,
  ).join("") +
  "</div>";

// P-32: the three-exits sheet is the only one in the app that cannot be dismissed without choosing.
const sheetWrap = (inner, title, closable = true) => {
  const close = closable
    ? `<button class="btn ghost icon-only sm round" aria-label="Close">${iconSvg("x", "sm")}</button>`
    : "";
  return `<div class="scrim"><div class="sheet" role="dialog" aria-label="${title}"><div class="handle"></div><div class="sheet-head"><span class="h3">${title}</span>${close}</div>${inner}</div></div>`;
};

const ACCT_TYPE_ICON = {
  CASH: "banknote",
  ACCOUNT: "landmark",
  CARD: "credit-card",
  DEBIT_CARD: "wallet-cards",
  SAVINGS: "piggy-bank",
  INVESTMENT: "trending-up",
  OVERDRAFT: "circle-alert",
  LOAN: "hand-coins",
  OTHER: "wallet",
};
const ACCT_TYPE_LABEL = {
  CASH: "Cash",
  ACCOUNT: "Bank account",
  CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  OVERDRAFT: "Overdraft",
  LOAN: "Loan",
  OTHER: "Other",
};
const TYPE_HELP = {
  CASH: "Notes and coins you carry",
  ACCOUNT: "A checking or current account",
  CARD: "Spending you pay back later",
  DEBIT_CARD: "Tied to a bank account",
  SAVINGS: "Money you keep aside",
  INVESTMENT: "Funds, stocks, crypto",
  OVERDRAFT: "A negative balance you can use",
  LOAN: "Money you owe",
  OTHER: "Anything else",
};

const accountTypePicker = (k = "CASH", color = "GRAY") =>
  `<button class="picker">${tile(ACCT_TYPE_ICON[k], color, "sm")}<span class="body"><span class="lbl">Type</span>` +
  `<span class="val">${ACCT_TYPE_LABEL[k]} · ${TYPE_HELP[k].toLowerCase()}</span></span>${iconSvg("chevron-down", "sm")}</button>`;

const accountTypeSheet = (sel = "CASH") => {
  const rows = Object.keys(ACCT_TYPE_ICON)
    .map(
      (k) =>
        `<button class="row" style="border-top:1px solid var(--border)">${tile(ACCT_TYPE_ICON[k], k == sel ? "GRAY" : "NONE", "sm")}<span class="body"><span class="title">${ACCT_TYPE_LABEL[k]}</span><span class="meta">${TYPE_HELP[k]}</span></span><span class="right" style="flex-direction:row">${k == sel ? iconSvg("circle-check", "sm") : ""}</span></button>`,
    )
    .join("");
  return sheetWrap(
    `<div class="list" style="margin:0 -16px;max-height:400px;overflow:auto">${rows}</div>`,
    "Account type",
  );
};

const authFrame = (
  inner,
  lang = "EN",
) => `<div class="shell" style="grid-template-columns:1fr;grid-template-rows:1fr"><main class="main" style="display:flex;flex-direction:column"><div class="page" style="max-width:440px;flex:1;justify-content:center;padding-top:32px;padding-bottom:32px">
<div class="hstack" style="justify-content:space-between;padding-bottom:8px"><span style="width:64px"></span><span class="brand" style="padding:0"><span class="logo">${iconSvg("layers", "sm")}</span>Ledger Flow</span><button class="chip" style="height:32px;width:64px;justify-content:center" aria-label="Language">${iconSvg("globe", "sm")}${lang}</button></div>${inner}</div></main></div>`;

const login = (state = "") => {
  let err = "";
  if (state == "error")
    err = `<div class="alert danger">${iconSvg("circle-alert")}<span>Wrong email or password.</span></div>`;
  if (state == "429")
    err = `<div class="alert warning">${iconSvg("clock")}<span><b>Too many attempts.</b> You can try again in 12:40.</span></div>`;
  return authFrame(`<div class="stack" style="gap:20px">
<div class="stack-sm" style="text-align:center"><h1 class="h1">Welcome back</h1><p class="muted" style="margin:0">Sign in to keep tracking your spending.</p></div>${err}
<div class="stack">${field("Email", "andres@correo.com", null, { icon: "user" })}${field("Password", "••••••••••", null, { icon: "lock", cls: "focus" })}</div>
<a class="small" href="#" style="color:var(--brand-text);font-weight:500;align-self:flex-end;opacity:.6" aria-disabled="true">Forgot your password? <span class="faint">(soon)</span></a>
<button class="btn primary lg block">Sign in</button>
<p class="small muted" style="text-align:center;margin:0">New here? <a href="#" style="color:var(--brand-text);font-weight:500">Create account</a></p></div>`);
};

const register = (state = "") => {
  const react =
    state == "reactivated"
      ? `<div class="alert info">${iconSvg("info")}<span><b>Welcome back.</b> We restored your previous account with its full history; the currency is kept.</span></div>`
      : "";
  return authFrame(`<div class="stack" style="gap:20px">
<div class="stack-sm" style="text-align:center"><h1 class="h1">Create account</h1><p class="muted" style="margin:0">Under a minute. No card needed.</p></div>${react}
<div class="stack">${field("Name", "Andrés Valencia", null, { icon: "user" })}${field("Email", "andres@correo.com", null, { icon: "user" })}${field("Password", null, "At least 8 characters", { icon: "lock", help: "Between 8 and 128 characters." })}
<div class="field"><span class="label">Language</span><button class="picker">${tile("globe", "TEAL", "sm")}<span class="body"><span class="lbl">Detected from your device</span><span class="val">English</span></span>${iconSvg("chevron-down", "sm")}</button><span class="help">The language of your account. You can change it any time in Settings.</span></div>
<div class="field"><span class="label">Currency</span><button class="picker">${tile("coins", "GREEN", "sm")}<span class="body"><span class="lbl">Detected from your region</span><span class="val">COP · Colombian peso</span></span>${iconSvg("chevron-down", "sm")}</button><span class="help">Used for all your accounts. It locks once you create your first account.</span></div>
<div class="field"><span class="label">Time zone</span><button class="picker">${tile("globe", "BLUE", "sm")}<span class="body"><span class="lbl">Detected from your device</span><span class="val">America/Bogota · GMT−5</span></span>${iconSvg("chevron-down", "sm")}</button></div></div>
<label class="check"><span class="box on">${iconSvg("check", "sm")}</span><span>I agree to the <a href="#">Privacy policy</a> and to the processing of my personal data (Ley 1581).</span></label>
<button class="btn primary lg block">Create account</button>
<p class="small muted" style="text-align:center;margin:0">Already have an account? <a href="#" style="color:var(--brand-text);font-weight:500">Sign in</a></p></div>`);
};

const registerLanguage = () => {
  const opt = (name, sub, sel) =>
    `<button class="row" style="border-top:1px solid var(--border)"><span class="body"><span class="title">${name}</span><span class="meta">${sub}</span></span><span class="right" style="flex-direction:row">${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  const inner = `<div class="list" style="margin:0 -16px">${opt("English", "Detected from your device", true)}${opt("Español", "Español", false)}</div>
<p class="small muted" style="margin:0">The whole screen changes right away. Dates and amounts follow this language, your currency and your time zone.</p>`;
  return (
    authFrame(
      '<div class="stack" style="gap:20px"><div class="stack-sm" style="text-align:center"><h1 class="h1">Create account</h1></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:120px"></div></div>',
    ) + sheetWrap(inner, "Language")
  );
};

const onboarding = (step) => {
  const dots = [1, 2].map((i) => `<i class="${i == step ? "on" : ""}"></i>`).join("");
  let body;
  if (step == 1) {
    body = `<div class="stack-sm" style="text-align:center"><span class="eyebrow">Step 1 of 2</span><h1 class="h1">Your first account</h1><p class="muted" style="margin:0">Quick expenses will come out of it. It becomes your main account; you can change that later.</p></div>
<div class="stack">${field("Name", "Bancolombia", null, { icon: "landmark" })}
<div class="field"><span class="label">Type</span>${accountTypePicker("ACCOUNT", "BLUE")}</div>
<div class="field"><span class="label">Current balance <span class="opt">optional</span></span><div class="card" style="padding:0"><div class="amount-input" style="padding:14px"><span class="cur">$</span><span class="num" style="font-size:40px">3,420,500</span></div></div><span class="help">Saved as the opening balance so you can reconcile the account later.</span></div>
<div class="field"><span class="label">Color</span>${swatches("BLUE")}</div></div>
<button class="btn primary lg block">Continue</button>`;
  } else {
    body = `<div class="stack-sm" style="text-align:center"><span class="eyebrow">Step 2 of 2</span><h1 class="h1">A ceiling for the month</h1><p class="muted" style="margin:0">A total monthly budget: it counts everything you spend, including what you log without a category.</p></div>
<div class="card color-INDIGO" style="background:linear-gradient(135deg,var(--brand-soft),var(--surface) 70%)"><div class="amount-input" style="padding:12px 0"><span class="cur">$</span><span class="num">2,000,000</span><span class="caret"></span></div>
<div class="chips" style="justify-content:center">${["$1,500,000", "$2,000,000", "$3,000,000"].map((v) => `<button class="chip">${v}</button>`).join("")}</div></div>
<div class="alert neutral">${iconSvg("sparkles")}<span>You can adjust it any month without touching the base amount, and add per-category budgets whenever you like.</span></div>
<button class="btn primary lg block">Create budget</button><button class="btn ghost block">Not now</button>`;
  }
  return authFrame(
    `<div class="stack" style="gap:20px"><div class="step-dots" role="img" aria-label="Step ${step} of 2">${dots}</div>${body}</div>`,
  );
};

const transactions = () => {
  const body = `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search description, note or tag</span></div>
<div class="chips"><button class="chip">${iconSvg("sliders-horizontal", "sm")}Filters <span class="badge brand" style="height:16px;padding:0 5px">2</span></button><button class="chip selected">September</button><button class="chip">Expenses</button><button class="chip">Income</button><button class="chip">Transfers</button><button class="chip">${iconSvg("inbox", "sm")}To review · 3</button><button class="chip">Uncategorized</button><button class="chip">#latte</button></div>
<div class="card stat" style="flex-direction:row;justify-content:space-between;align-items:center;padding:12px 16px"><div><span class="k">Spent in September</span><div class="v amount" style="font-size:20px">${money(1284300)}</div></div><div style="text-align:right"><span class="k">Income</span><div class="amount income" style="font-size:15px">${money(4200000, "+")}</div></div><div style="text-align:right"><span class="k">Transactions</span><div style="font-weight:600;font-size:15px">48</div></div></div>
<div class="list card flush">
<div class="day-head"><span>Today · Tuesday 22</span><span class="amount">${money(22300, "−")}</span></div>
${row("hash", "NONE", "Quick expense", "8:42 · Bancolombia", 12500, "expense", { pending: true, badges: '<span class="badge warning">To review</span>' })}
${row("coffee", "BROWN", "Pergamino Coffee", "7:55 · Cash", 9800, "expense", { sub: "#coffee #latte" })}
<div class="day-head"><span>Yesterday · Monday 21</span><span class="amount">${money(4200000, "+")}</span></div>
${row("briefcase", "GREEN", "August salary", "Bancolombia", 4200000, "income")}
${row("repeat", "GRAY", "Bancolombia → Savings", "Transfer", 1000000, "transfer")}
${row("car", "BLUE", "Uber to work", "18:10 · Visa Gold", 18400)}
<div class="day-head"><span>Sunday 20</span><span class="amount">${money(272600, "−")}</span></div>
${row("utensils", "ORANGE", "Carulla groceries", "Bancolombia", 78900, "expense", { sub: "#groceries" })}
${row("scale", "NONE", "Balance adjustment · Cash", "Reconciliation", 7500, "adjustment", { badges: '<span class="badge">Adjustment</span>' })}
${row("zap", "AMBER", "EPM electricity", "Bancolombia", 186200)}
</div>
<div class="hstack" style="justify-content:center;padding:4px 0"><span class="skeleton" style="width:120px;height:12px"></span></div>`;
  return screen(body, {
    tab: "mov",
    side: "mov",
    title: "Transactions",
    actions: `<button class="btn ghost icon-only round" aria-label="Export" disabled>${iconSvg("download")}</button><button class="btn primary desktop-only">${iconSvg("plus", "sm")}Add</button>`,
  });
};

const transactionDetail = ({ pending = false, conflict = false } = {}) => {
  let pend = pending
    ? `<div class="alert warning" style="align-items:center">${iconSvg("inbox")}<span style="flex:1"><b>Quick expense to review.</b> Add a category and description so it counts where it should.</span><button class="btn sm ink">Complete</button></div>`
    : "";
  if (conflict) {
    pend = `<div class="alert danger" style="align-items:center">${iconSvg("circle-alert")}<span style="flex:1"><b>Some changes need your attention.</b> This transaction has a change the server hasn’t taken.</span><button class="btn sm danger solid">Review</button></div>`;
  }
  const info = [
    ["Category", `<span class="hstack">${tile("car", "BLUE", "sm")}Transport</span>`],
    ["Account", `<span class="hstack">${tile("credit-card", "PURPLE", "sm")}Visa Gold</span>`],
    ["Date", "Monday, September 21 · 18:10"],
    [
      "Tags",
      '<span class="hstack"><span class="tag">work</span><span class="tag">latte</span></span>',
    ],
    ["Note", "Rain, missed the bus."],
    ["Source", '<span class="badge">Manual</span>'],
    ["Currency", '<span class="mono muted">COP</span>'],
  ];
  const rows = info
    .map(
      ([k, v]) =>
        `<div class="hstack" style="justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);gap:16px"><span class="small muted">${k}</span><span style="text-align:right;font-weight:500;font-size:14px">${v}</span></div>`,
    )
    .join("");
  const body = `${pend}<div class="card stack-sm color-BLUE" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${tile("car", "BLUE", "lg")}<span class="amount-hero" style="font-size:36px">${money(18400, "−")}</span><span class="h3">Uber to work</span><span class="small muted">Expense · Visa Gold</span></div>
<div class="card" style="padding:4px 16px">${rows}</div>
<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">${iconSvg("pencil", "sm")}Edit</button><button class="btn danger lg" style="flex:1">${iconSvg("trash-2", "sm")}Delete</button></div>
<p class="xs faint" style="text-align:center;margin:0">Created Sep 21 18:12 · edited Sep 21 18:15</p>`;
  return screen(body, {
    tab: "mov",
    side: "mov",
    back: true,
    title: "Transaction",
    narrow: true,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
  });
};

const reviewInbox = ({ dropped = false, confirm = false } = {}) => {
  const item = (
    amt,
    when,
    acct,
    done = false,
    note = "",
  ) => `<div class="card stack" style="gap:12px">
<div class="hstack" style="gap:12px">${tile("hash", "NONE")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span class="amount-lg amount">${money(amt, "−")}</span><span class="small faint">${when} · ${acct}</span></span><span class="badge warning">${iconSvg("inbox")}To review</span></div>${note}
<div class="chips">${catChip("Food", done)}${catChip("Coffee")}${catChip("Transport")}${catChip("Lifestyle")}<button class="chip">${iconSvg("search", "sm")}Other</button></div>
<div class="input" style="height:40px"><span class="${done ? "value" : "placeholder"}" style="flex:1">${done ? "Lunch with Laura" : "Description (optional)"}</span></div>
<div class="hstack" style="gap:8px;justify-content:flex-end"><button class="btn ghost sm">Open full form</button><button class="btn ${done ? "primary" : "secondary"} sm">${iconSvg("check", "sm")}Done</button></div></div>`;
  const body = `<div class="alert neutral">${iconSvg("info")}<span>Quick expenses already reduced your balance and already count toward your total budget. Here you just name and categorize them.</span></div>
${item(12500, "Today 8:42", "Bancolombia", true)}${item(15400, "Yesterday 13:05", "Bancolombia", dropped, dropped ? `<div class="alert warning">${iconSvg("archive")}<span>Its category had been archived, so the server saved it without one. Pick another.</span></div>` : "")}${item(20000, "Sat 19 · 21:40", "Cash")}
<button class="btn primary lg block" style="position:sticky;bottom:8px">${iconSvg("check", "sm")}Save all · ${dropped ? 2 : 1}</button>`;
  const sh = confirm
    ? sheetWrap(
        `<div class="alert warning">${iconSvg("info")}<span><b>Each one keeps the category and description it has right now.</b><br>1 stays pending because it has no category yet.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Save 2</button></div>`,
        "Save 2 expenses?",
      )
    : "";
  return screen(body, {
    tab: "mov",
    side: "mov",
    back: true,
    title: "To review · 3",
    narrow: true,
    actions: `<span class="small muted amount">${money(47900)}</span>`,
    sheet: sh,
  });
};

const ACCOUNTS = [
  ["Bancolombia", "ACCOUNT", "BLUE", 3420500, true, false],
  ["Cash", "CASH", "GRAY", 184000, false, false],
  ["Visa Gold", "CARD", "PURPLE", 1245900, false, true],
  ["Savings", "SAVINGS", "GREEN", 8900000, false, false],
];

const accountCard = (name, typ, color, bal, isDefault = false, neg = false, archived = false) => {
  const d = isDefault
    ? `<span class="badge brand">${iconSvg("star")}Main</span>`
    : archived
      ? "<span class='badge'>Archived</span>"
      : "";
  return `<a class="account-card color-${color}" href="#" style="${archived ? "opacity:.6" : ""}"><div class="top">${tile(ACCT_TYPE_ICON[typ], color, "sm")}<span class="name truncate">${name}</span>${d}</div>
<div><div class="amount-lg amount">${neg ? "−" : ""}${money(bal)}</div><div class="type">${ACCT_TYPE_LABEL[typ]}</div></div></a>`;
};

const accounts = () => {
  const body = `<div class="card" style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap"><div class="stat"><span class="k">Total balance</span><span class="amount-hero" style="font-size:32px">${money(11258600)}</span><span class="small faint">4 accounts activas · 1 archivada</span></div><div class="stat" style="text-align:right;align-items:flex-end"><span class="k">Deuda en tarjetas</span><span class="amount-lg amount">${money(1245900, "−")}</span></div></div>
<div class="acct-grid">${ACCOUNTS.map((a) => accountCard(...a)).join("")}</div>
<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("archive")}<span style="font-weight:500">Archived</span><span class="badge">1</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="acct-grid">${accountCard("Nequi", "OTHER", "PINK", 0, false, false, true)}</div>`;
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    title: "Accounts",
    actions: `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New account</button><button class="btn secondary icon-only round mobile-only" aria-label="New account">${iconSvg("plus")}</button>`,
  });
};

const accountDetail = ({ sheet = false } = {}) => {
  const body = `<div class="card color-BLUE stack-sm" style="gap:6px;position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--f)"></span>
<div class="hstack" style="justify-content:space-between">${tile("landmark", "BLUE")}<span class="badge brand">${iconSvg("star")}Main</span></div>
<span class="eyebrow" style="margin-top:6px">Bank account</span><span class="h2">Bancolombia</span>
<span class="amount-hero" style="font-size:36px">${money(3420500)}</span>
<span class="small muted">Opening balance <b class="amount">${money(2500000)}</b> · created Mar 12, 2026 · COP</span></div>
<div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px"><button class="btn secondary">${iconSvg("scale", "sm")}Adjust balance</button><button class="btn secondary">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary" disabled>${iconSvg("star", "sm")}Main account</button><button class="btn secondary">${iconSvg("archive", "sm")}Archive</button></div>
<div class="alert neutral">${iconSvg("info")}<span>To archive this account, make another one your main account first: quick expenses need a destination.</span></div>
<div class="section-head"><h3 class="h3">Transactions</h3><a class="link" href="#">Open with filters</a></div>
<div class="list card flush">
<div class="day-head"><span>Today</span><span class="amount">${money(12500, "−")}</span></div>
${row("hash", "NONE", "Quick expense", "8:42", 12500, "expense", { pending: true, badges: '<span class="badge warning">To review</span>' })}
<div class="day-head"><span>Yesterday</span><span class="amount">${money(3200000, "+")}</span></div>
${row("briefcase", "GREEN", "August salary", "", 4200000, "income")}${row("repeat", "GRAY", "→ Savings", "Transfer", 1000000, "transfer")}
${row("utensils", "ORANGE", "Carulla groceries", "Sun 20", 78900)}</div>`;
  const sh = sheet
    ? sheetWrap(
        `<div class="stack-sm"><span class="label">Actual balance in Bancolombia</span><div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">3,408,200</span><span class="caret"></span></div><p class="small muted" style="text-align:center;margin:0">Recorded balance: <b class="amount">${money(3420500)}</b></p></div>
<div class="alert neutral" style="align-items:center">${iconSvg("scale")}<span>An <b>adjustment of ${money(12300, "−")}</b> will be created to reconcile the account. It does not count as spending or in budgets.</span></div>
${field("Note", null, "August bank fee", { opt: true })}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Save adjustment</button></div>`,
        "Adjust balance",
      )
    : "";
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: "Bancolombia",
    narrow: true,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
    sheet: sh,
  });
};

const accountForm = ({ edit = false, sheet = false } = {}) => {
  const saldo = edit
    ? ""
    : `<div class="field"><span class="label">Current balance <span class="opt">optional</span></span><div class="card" style="padding:0"><div class="amount-input" style="padding:12px"><span class="cur">$</span><span class="num" style="font-size:36px">184,000</span></div></div><span class="help">Afterwards the balance only changes through transactions or “Adjust balance”.</span></div>`;
  const body = `${field("Name", "Cash", null, { error: "You already have an active account named “cash”. Names are case-insensitive." })}
<div class="field"><span class="label">Type</span>${accountTypePicker()}</div>
<div class="field"><span class="label">Color</span>${swatches("GRAY")}</div>${saldo}
<div class="card hstack color-GRAY" style="gap:12px">${tile("banknote", "GRAY")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span style="font-weight:500">Cash</span><span class="small faint">Cash · preview</span></span><span class="amount-lg amount">${money(184000)}</span></div>
<button class="btn primary lg block">${edit ? "Save changes" : "Create account"}</button>`;
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: edit ? "Edit account" : "New account",
    narrow: true,
    sheet: sheet ? accountTypeSheet() : "",
  });
};

const categories = ({ offline = false } = {}) => {
  const gtile = (name, count, archived = false) => {
    const [ic, col] = CATS[name];
    return `<a class="card stack-sm color-${col}" href="#" style="align-items:center;text-align:center;gap:8px;padding:16px 8px;${archived ? "opacity:.6" : ""}">${tile(ic, col, "lg")}<span style="font-weight:500;font-size:13px" class="truncate">${name}</span><span class="xs faint">${count}</span></a>`;
  };
  const grid = (items) =>
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
    items.map(([n, c]) => gtile(n, c)).join("") +
    "</div>";
  const body = `<div class="segment"><button aria-pressed="true">Expense · 8</button><button class="income">Income · 3</button><button class="transfer">Transfer · 2</button></div>
${grid([
  ["Food", "24 txns"],
  ["Transport", "18 txns"],
  ["Housing", "3 txns"],
  ["Bills", "6 txns"],
  ["Lifestyle", "11 txns"],
  ["Coffee", "31 txns"],
  ["Health", "2 txns"],
  ["Pets", "unused"],
])}
<a class="card hstack" href="#" style="justify-content:center;gap:8px;border-style:dashed;box-shadow:none;color:var(--text-2)">${iconSvg("plus", "sm")}<span style="font-weight:500">New category</span></a>
<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("archive")}<span style="font-weight:500">Archived</span><span class="badge">1</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert neutral" style="align-items:center">${iconSvg("rotate-ccw")}<span style="flex:1">Missing one of the default categories? Recreate them without duplicating the ones you renamed.${offline ? "<br><span class=xs>Needs a connection: the server creates these categories.</span>" : ""}</span>${offline ? "" : '<button class="btn sm secondary">Restore</button>'}</div>`;
  return screen(body, {
    tab: "",
    side: "cat",
    title: "Categories",
    banner: offline
      ? `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.</span></div>`
      : "",
    actions: `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New category</button><button class="btn secondary icon-only round mobile-only" aria-label="New">${iconSvg("plus")}</button>`,
  });
};

const categoryForm = (locked = true) => {
  const icons = [
    "utensils",
    "coffee",
    "pizza",
    "shopping-cart",
    "croissant",
    "sandwich",
    "cookie",
    "beer",
    "wine",
    "martini",
    "cake",
    "apple",
    "carrot",
    "ice-cream-cone",
    "popcorn",
    "store",
    "shopping-basket",
    "gift",
    "ticket",
    "heart",
    "car",
    "bus",
    "fuel",
    "plane",
    "bike",
    "train-front",
    "house",
    "zap",
    "droplets",
    "wifi",
    "phone",
    "lightbulb",
    "stethoscope",
    "pill",
    "dumbbell",
    "dog",
    "cat",
    "baby",
    "graduation-cap",
    "book-open",
  ];
  const grid = icons
    .map(
      (n) =>
        `<button class="tile${n == "utensils" ? " color-ORANGE" : ""}" aria-label="${n}" aria-pressed="${String(n == "utensils")}" style="${n == "utensils" ? "outline:2px solid var(--f);outline-offset:2px" : "background:var(--surface-2);color:var(--text-2)"}">${iconSvg(n)}</button>`,
    )
    .join("");
  const lock = locked
    ? `<div class="alert neutral">${iconSvg("lock")}<span><b>The type can’t be changed:</b> this category already has 24 transactions and changing it would rewrite your stats. If you need another type, <a href="#" style="color:var(--brand-text);font-weight:500">create a new category</a>.</span></div>`
    : "";
  const body = `<div class="card hstack color-ORANGE" style="gap:12px">${tile("utensils", "ORANGE", "lg")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">Comida</span><span class="small faint">Expense · preview</span></span></div>
${field("Name", "Food")}
<div class="field"><span class="label">Type</span><div class="segment" style="${locked ? "opacity:.6;pointer-events:none" : ""}"><button aria-pressed="true">Expense</button><button class="income">Income</button><button class="transfer">Transfer</button></div></div>${lock}
<div class="field"><span class="label">Icon</span><div class="input" style="height:40px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search icons (food, travel, home…)</span></div><div class="hstack" style="flex-wrap:wrap;gap:8px;padding-top:6px">${grid}</div></div>
<div class="field"><span class="label">Color</span>${swatches("ORANGE")}</div>
<button class="btn primary lg block">Save changes</button>
<button class="btn ghost block" style="color:var(--text-2)">${iconSvg("archive", "sm")}Archive category</button>`;
  return screen(body, { tab: "", side: "cat", back: true, title: "Edit category", narrow: true });
};

const budgetDetail = ({ archived = false, conflict = false } = {}) => {
  const arch = archived
    ? `<div class="alert neutral" style="align-items:center">${iconSvg("archive")}<span style="flex:1">This budget is archived and no longer tracks spending. Restore it to bring it back exactly as it was.</span><button class="btn sm secondary">${iconSvg("archive-restore", "sm")}Restore</button></div>`
    : "";
  const sh = conflict
    ? sheetWrap(
        `<div class="alert danger">${iconSvg("triangle-alert")}<span>“Lifestyle 2026” is active for the same monthly period and covers the same spending, so this one can’t come back as it was. Create a new budget instead.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Close</button><button class="btn secondary lg" style="flex:1.2">Open Lifestyle 2026</button></div>`,
        "Another budget is in the way",
      )
    : "";
  const body =
    arch +
    `<div class="period-nav"><button class="btn ghost icon-only round">${iconSvg("chevron-left")}</button><span class="label">September 2026</span><button class="btn ghost icon-only round" disabled>${iconSvg("chevron-right")}</button></div>
<div class="card color-PINK stack-sm" style="gap:10px"><div class="hstack" style="gap:12px">${tile("shopping-bag", "PINK", "lg")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h2">Lifestyle</span><span class="small faint">Monthly · Sep 1–30 · since Mar 2026</span></span><span class="badge">${iconSvg("pencil")}Adjusted</span></div>
<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="amount-hero" style="font-size:34px">${money(356000)}</span><span class="muted amount">of ${money(300000)}</span></div>
<div class="progress over" style="height:8px"><span class="fill" style="width:100%"></span>${paceMark()}</div>
<p class="xs faint" style="margin:0">The mark is today’s pace: 73% of the period has passed (day 22 of 30).</p>
<div class="stats" style="grid-template-columns:repeat(3,1fr);gap:8px"><div class="stat"><span class="k">Remaining</span><span class="v amount" style="font-size:16px;color:var(--danger)">${money(56000, "−")}</span></div><div class="stat"><span class="k">Pace</span><span class="v amount" style="font-size:16px">${money(16200)}<span class="xs faint">/day</span></span></div><div class="stat"><span class="k">Left</span><span class="v" style="font-size:16px">8 days</span></div></div></div>
<div class="card stack-sm"><div class="card-head" style="margin:0"><h3 class="h3">This period’s amount</h3><span class="small muted amount">base ${money(250000)}</span></div>
<p class="small muted" style="margin:0">September is adjusted to <b class="amount">${money(300000)}</b>. Other months keep the base amount.</p>
<div class="hstack" style="gap:8px;flex-wrap:wrap"><button class="btn secondary sm">${iconSvg("pencil", "sm")}Change adjustment</button><button class="btn secondary sm">Skip this month</button><button class="btn ghost sm">Remove adjustment</button></div></div>
<div class="card stack-sm"><h3 class="h3">Categories</h3><div class="chips" style="flex-wrap:wrap">${catChip("Lifestyle")}<button class="chip cat color-CYAN" style="opacity:.7"><span class="dot">${iconSvg("plane")}</span>Vacation <span class="badge warning" style="height:16px">${iconSvg("archive")}archived</span></button></div></div>
<div class="card stack-sm"><h3 class="h3">Note</h3><p class="small muted" style="margin:0">Clothes, going out and treats. Review in December.</p></div>
<div class="section-head"><h3 class="h3">Transactions this period</h3><a class="link" href="#">See all</a></div>
<div class="list card flush">${row("shopping-bag", "PINK", "Zara", "Sat 19 · Visa Gold", 189000)}${row("shopping-bag", "PINK", "Cine Colombia", "Fri 18 · Cash", 42000)}${row("shopping-bag", "PINK", "Spotify", "Tue 15 · Visa Gold", 16900, "expense", { sub: "#monthly" })}</div>
<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">${iconSvg("pencil", "sm")}Edit</button><button class="btn danger lg" style="flex:1">${iconSvg("archive", "sm")}Archive</button></div>
<p class="xs faint" style="text-align:center;margin:0">You can restore it later from Past budgets.</p>`;
  return screen(body, {
    tab: "pres",
    side: "pres",
    back: true,
    title: "Budget",
    narrow: true,
    sheet: sh,
  });
};

const budgetForm = (edit = false) => {
  const periods = [
    ["Weekly", "WEEKLY"],
    ["Biweekly", "BIWEEKLY"],
    ["Monthly", "MONTHLY"],
    ["Quarterly", "QUARTERLY"],
    ["Yearly", "YEARLY"],
    ["Custom", "CUSTOM"],
  ];
  const warn = edit
    ? `<div class="alert warning">${iconSvg("triangle-alert")}<span>Changing the period type clears any per-period adjustments you made.</span></div>`
    : "";
  const body = `${field("Name", "Food & groceries")}
<div class="field"><span class="label">Scope</span><div class="segment"><button>All spending</button><button aria-pressed="true">By category</button></div><span class="help">“All spending” creates a global budget: it includes anything logged without a category. Only one per period type.</span></div>
<div class="field"><span class="label">Categories <span class="opt">up to 20</span></span><div class="chips" style="flex-wrap:wrap">${catChip("Food", true)}${catChip("Coffee", true)}${catChip("Transport")}${catChip("Bills")}${catChip("Lifestyle")}${catChip("Health")}<button class="chip">${iconSvg("search", "sm")}Search</button></div><span class="help">Expense categories only. Transfer categories can’t have a budget.</span></div>
<div class="field"><span class="label">Period</span><div class="hstack" style="flex-wrap:wrap;gap:8px">${periods.map(([t, k]) => `<button class="chip${k == "MONTHLY" ? " selected" : ""}">${t}</button>`).join("")}</div></div>${warn}
<div class="field"><span class="label">Amount</span><div class="card" style="padding:0"><div class="amount-input" style="padding:12px"><span class="cur">$</span><span class="num" style="font-size:36px">650,000</span></div></div></div>
<div class="field"><span class="label">Color</span>${swatches("ORANGE")}</div>
<details class="card" style="padding:12px 16px" open><summary style="cursor:pointer;font-weight:500;display:flex;justify-content:space-between;align-items:center;list-style:none">Advanced options ${iconSvg("chevron-down", "sm")}</summary><div class="stack" style="padding-top:12px">${field("Effective from", "September 1, 2026", null, { icon: "calendar", help: "The budget won’t show up when browsing months before this date." })}${field("Note", null, "What this budget is for", { opt: true })}</div></details>
<button class="btn primary lg block">${edit ? "Save changes" : "Create budget"}</button>`;
  return screen(body, {
    tab: "pres",
    side: "pres",
    back: true,
    title: edit ? "Edit budget" : "New budget",
    narrow: true,
  });
};

const pastBudgets = () => {
  const card = (
    name,
    icon,
    col,
    spent,
    limit,
    period,
    tag,
    arch = false,
  ) => `<div class="card stack-sm color-${col}" style="gap:10px;opacity:.85"><div class="hstack" style="gap:12px">${tile(icon, col)}<span class="body" style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-weight:500" class="truncate">${name}</span><span class="small faint">${period}</span></span><span class="badge${arch ? "" : " outline"}">${tag}</span></div>
<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="amount-lg amount">${money(spent)}</span><span class="small muted amount">of ${money(limit)}</span></div>
<div class="progress color-${col}${spent > limit ? " over" : ""}"><span class="fill" style="width:${Math.min(100, round((spent / limit) * 100))}%"></span></div>
<div class="hstack" style="justify-content:flex-end"><button class="btn secondary sm">${iconSvg("copy", "sm")}Create again</button></div></div>`;
  const body = `<div class="segment"><button aria-pressed="true">Ended · 2</button><button>Archived · 1</button></div>
<div class="grid-2">${card("August vacation", "plane", "CYAN", 2310000, 2500000, "Custom · Aug 1–31", "Ended")}${card("December gifts", "gift", "ROSE", 640000, 500000, "Custom · Dec 1–24, 2025", "Ended")}</div>
<div class="empty" style="padding:24px 16px 8px"><span class="small faint">Recurring budgets never end: to see a past month, change the period in the list.</span></div>`;
  return screen(body, {
    tab: "pres",
    side: "pres",
    back: true,
    title: "Past budgets",
    narrow: false,
  });
};

const stats = (view = "cat") => {
  const cats = [
    ["Food", "ORANGE", 412000, 24],
    ["Lifestyle", "PINK", 356000, 11],
    ["Transport", "BLUE", 185500, 18],
    ["Bills", "AMBER", 186200, 6],
    ["Coffee", "BROWN", 98400, 31],
    ["Uncategorized", "NONE", 47900, 3],
  ];
  const total = cats.reduce((a, [, , v]) => a + v, 0);
  const seg = `<div class="segment"><button aria-pressed="${String(view == "cat")}">Categories</button><button aria-pressed="${String(view == "day")}">Days</button><button aria-pressed="${String(view == "tag")}">Tags</button></div>`;
  const intro = `<div class="period-nav"><button class="btn ghost icon-only round">${iconSvg("chevron-left")}</button><span class="label">September 2026</span><button class="btn ghost icon-only round" disabled>${iconSvg("chevron-right")}</button></div>
<div class="chips"><button class="chip selected">Expenses</button><button class="chip">Income</button><button class="chip">Transfers</button><button class="chip">${iconSvg("scale", "sm")}Adjustments</button></div>${seg}
<div class="card"><span class="eyebrow">Total spent</span><div class="amount-hero" style="font-size:34px">${money(total)}</div><span class="small muted">48 transactions · average <b class="amount">${money(round(total / 48))}</b></span></div>`;
  let content;
  if (view == "cat") {
    const bar = cats.map(([, c, v]) => `<i class="color-${c}" style="flex:${v}"></i>`).join("");
    const lis = cats
      .map(
        ([n, c, v, k]) =>
          `<a class="row" href="#">${tile(CATS[n][0], c)}<span class="body"><span class="title"><span class="truncate">${n}</span></span><span class="meta"><span class="progress thin color-${c}" style="width:120px"><span class="fill" style="width:${round((v / total) * 100)}%"></span></span>${round((v / total) * 100)} %</span></span><span class="right">${amount(v)}<span class="sub">${k} txns</span></span></a>`,
      )
      .join("");
    const tip =
      '<span class="tooltip show" style="position:absolute;left:14%;top:-4px"><span class="tip">Food</span></span>';
    content = `<div class="card stack-sm" style="position:relative;overflow:visible">${tip}<div class="stackbar" style="height:12px">${bar}</div></div><div class="list card flush">${lis}</div>`;
  } else if (view == "day") {
    const hs = [
      30, 55, 20, 65, 40, 0, 70, 45, 90, 35, 25, 50, 60, 0, 30, 75, 40, 55, 20, 45, 85, 30, 40, 60,
      35, 50, 25, 65, 45, 38,
    ];
    const bars = hs
      .map(
        (h, i) =>
          `<i style="height:${Math.max(h, 3)}%" class="${h == 0 ? "nil" : h > 80 ? "hi" : ""}${i == 29 ? " today" : ""}"></i>`,
      )
      .join("");
    content = `<div class="card stack-sm"><div class="bars" style="height:140px">${bars}</div><div class="hstack small faint" style="justify-content:space-between"><span>Sep 1</span><span>15</span><span>30</span></div></div>
<div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="card stat"><span class="k">Priciest day</span><span class="v amount" style="font-size:16px">${money(214000)}</span><span class="d faint">Sat 9</span></div><div class="card stat"><span class="k">Daily average</span><span class="v amount" style="font-size:16px">${money(42800)}</span></div><div class="card stat"><span class="k">No-spend days</span><span class="v" style="font-size:16px">2</span></div></div>
<div class="list card flush"><div class="day-head"><span>Sat 9 · highest</span><span class="amount">${money(214000, "−")}</span></div>${row("shopping-bag", "PINK", "Zara", "Visa Gold", 189000)}${row("coffee", "BROWN", "Pergamino Coffee", "Cash", 9800)}${row("car", "BLUE", "Uber", "Visa Gold", 15200)}</div>`;
  } else {
    const tags = [
      ["latte", 286400, 41],
      ["groceries", 312000, 4],
      ["monthly", 165900, 6],
      ["work", 88200, 9],
    ];
    const lis = tags
      .map(
        ([t, v, n]) =>
          `<a class="row" href="#"><span class="tile"><span style="font-weight:600;color:var(--text-2)">#</span></span><span class="body"><span class="title">#${t}</span><span class="meta">${n} transactions</span></span><span class="right">${amount(v)}</span></a>`,
      )
      .join("");
    content = `<div class="alert neutral">${iconSvg("info")}<span>A transaction with several tags counts in each of them, so tag totals can add up to more than the total. <b class="amount">${money(1162300)}</b> of spending has no tags.</span></div><div class="list card flush">${lis}</div>`;
  }
  return screen(intro + content, {
    tab: "",
    side: "stats",
    title: "Stats",
    actions: `<button class="btn ghost icon-only round" aria-label="Export" disabled>${iconSvg("download")}</button>`,
  });
};

const settingsRow = (icon, title, meta, right = "", color = "NONE") => {
  const m = meta ? `<span class="meta">${meta}</span>` : "";
  return `<a class="row" href="#">${tile(icon, color, "sm")}<span class="body"><span class="title">${title}</span>${m}</span><span class="right" style="flex-direction:row;align-items:center;gap:8px">${right}${iconSvg("chevron-right", "sm")}</span></a>`;
};

const settings = ({ offline = false } = {}) => {
  const signout = offline
    ? `<button class="btn secondary block" disabled>${iconSvg("log-out", "sm")}Sign out</button><p class="xs muted" role="status" style="text-align:center;margin:0">Signing out needs a connection: your session lives on the server.</p>`
    : `<button class="btn secondary block">${iconSvg("log-out", "sm")}Sign out</button>`;
  const banner = offline
    ? `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.<span class="sub">2 changes waiting</span></span></div>`
    : "";
  const body = `<div class="card hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:17px">AV</span><span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">Andrés Valencia</span><span class="small muted">andres@correo.com</span><span class="xs faint">Last sign-in today 8:40</span></span>${iconSvg("chevron-right", "sm")}</div>
<span class="eyebrow">Preferences</span>
<div class="list card flush">${settingsRow("globe", "Language", "App language", '<span class="small muted">English</span>', "TEAL")}${settingsRow("coins", "Currency", "Locked: you already have accounts", '<span class="badge">COP</span>', "GREEN")}${settingsRow("clock", "Time zone", "Defines your days and periods", '<span class="small muted">Bogotá</span>', "BLUE")}${settingsRow("palette", "Appearance", "Palette and mode", '<span class="small muted">Tinta · System</span>', "PURPLE")}${settingsRow("tags", "Categories", "13 active · 1 archived", "", "ORANGE")}</div>
<span class="eyebrow">Security</span>
<div class="list card flush">${settingsRow("lock", "Password & email", "Requires your current password", "", "GRAY")}${settingsRow("smartphone", "Active sessions", "Sign out devices you don’t recognize", '<span class="badge">3</span>', "GRAY")}</div>
<span class="eyebrow">Data</span>
<div class="list card flush">${settingsRow("refresh-cw", "Sync status", "What this device has, and what it still owes the server", '<span class="badge warning">2</span>', "TEAL")}${settingsRow("download", "Export transactions", "Coming soon", '<span class="badge outline">soon</span>')}${settingsRow("upload", "Import from your bank", "Coming soon", '<span class="badge outline">soon</span>')}</div>
<span class="eyebrow">About</span>
<div class="list card flush">${settingsRow("monitor-smartphone", "Install app", "Add Ledger Flow to your home screen so the browser doesn’t delete what you record offline", "", "INDIGO")}${settingsRow("info", "Version", "Ledger Flow v0.2", "", "GRAY")}</div>
<div class="stack-sm">${signout}<button class="btn ghost block" style="color:var(--danger)">Delete my account</button></div>
<p class="xs faint" style="text-align:center;margin:0">Ledger Flow · v0.2 · <span class="mono">America/Bogota</span></p>`;
  return screen(body, { tab: "", side: "ajustes", title: "Settings", narrow: true, banner });
};

const appearance = () => {
  const pal = (name, key, seeds, sel) => {
    const dots = seeds
      .map((c) => `<span style="width:14px;height:14px;border-radius:50%;background:${c}"></span>`)
      .join("");
    return `<button class="card stack-sm" style="text-align:left;cursor:pointer;gap:8px;${sel ? "outline:2px solid var(--brand);outline-offset:-1px" : ""}" aria-pressed="${String(sel)}"><div class="hstack" style="justify-content:space-between"><span style="font-weight:500">${name}</span>${sel ? iconSvg("circle-check", "sm") : ""}</div><div class="hstack" style="gap:4px">${dots}</div><span class="xs faint">${key}</span></button>`;
  };
  const body = `<div class="field"><span class="label">Mode</span><div class="segment"><button>${iconSvg("sun", "sm")}Light</button><button>${iconSvg("moon", "sm")}Dark</button><button aria-pressed="true">${iconSvg("monitor", "sm")}System</button></div></div>
<div class="field"><span class="label">Palette</span><div class="grid-2" style="grid-template-columns:1fr 1fr">${pal("Tinta", "Warm grays · indigo", ["oklch(0.46 0.16 278)", "oklch(0.6 0.2 25)", "oklch(0.64 0.17 150)", "oklch(0.6 0.18 250)", "oklch(0.74 0.16 75)"], true)}${pal("Brisa", "Cool grays · teal", ["oklch(0.48 0.12 190)", "oklch(0.62 0.19 20)", "oklch(0.66 0.15 155)", "oklch(0.62 0.17 255)", "oklch(0.76 0.15 80)"], false)}</div><span class="help">Your account, category and budget colors adapt to the palette: a “red” always looks red.</span></div>
<div class="card stack-sm"><span class="eyebrow">Preview</span><div class="list" style="margin:0 -16px">${row("coffee", "BROWN", "Pergamino Coffee", "Today · Cash", 9800)}${row("briefcase", "GREEN", "Salary", "Yesterday · Bancolombia", 4200000, "income")}</div><div class="hstack" style="gap:8px"><button class="btn primary sm">Primary</button><button class="btn secondary sm">Secondary</button><span class="badge warning">To review</span><span class="badge success">On track</span></div></div>`;
  return screen(body, { tab: "", side: "ajustes", back: true, title: "Appearance", narrow: true });
};

const sessions = () => {
  const sess = (icon, name, meta, current = false) => {
    const r = current
      ? '<span class="badge success">This device</span>'
      : '<button class="btn ghost sm" style="color:var(--danger)">Sign out</button>';
    return `<div class="row" style="cursor:default">${tile(icon, "NONE")}<span class="body"><span class="title">${name}</span><span class="meta">${meta}</span></span><span class="right" style="flex-direction:row">${r}</span></div>`;
  };
  const body = `<div class="alert neutral">${iconSvg("info")}<span>Each sign-in opens a session of up to 30 days. Signing out a session forces that device to sign in again.</span></div>
<div class="list card flush">${sess("smartphone", "Android · Chrome", "Active now · since Mar 12", true)}${sess("laptop", "Windows · Edge", "2 hours ago · since Sep 18")}${sess("smartphone", "iPhone · Safari", "12 days ago · expires Sep 30")}</div>
<button class="btn danger block">${iconSvg("log-out", "sm")}Sign out all other sessions</button>`;
  return screen(body, {
    tab: "",
    side: "ajustes",
    back: true,
    title: "Active sessions",
    narrow: true,
  });
};

const profileSecurity = () => {
  const body = `${field("Name", "Andrés Valencia", null, { icon: "user" })}${field("Email", "andres@correo.com", null, { icon: "user", help: "Changing it signs out your other sessions." })}
<div class="divider"></div><span class="eyebrow">Change password</span>${field("New password", null, "At least 8 characters", { icon: "lock" })}
<div class="alert warning">${iconSvg("lock")}<span>To change your email or password, confirm your <b>current password</b>. For safety, your other devices will need to sign in again.</span></div>
${field("Current password", "••••••••••", null, { icon: "lock", cls: "focus" })}
<button class="btn primary lg block">Save changes</button>`;
  return screen(body, {
    tab: "",
    side: "ajustes",
    back: true,
    title: "Profile & security",
    narrow: true,
  });
};

const settingsBodyDim = () =>
  '<div class="card hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:17px">AV</span><span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">Andrés Valencia</span><span class="small muted">andres@correo.com</span></span></div><div class="skeleton" style="height:180px"></div><div class="skeleton" style="height:120px"></div>';

const deleteAccountScreen = () => {
  const inner = `<div class="alert danger">${iconSvg("triangle-alert")}<span><b>Your account will no longer be available.</b> Your data is kept: if you sign up again with <b>andres@correo.com</b> you get your full history back.</span></div>
${field("Type DELETE to confirm", null, "DELETE")}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.2">Delete account</button></div>`;
  return screen(settingsBodyDim(), {
    tab: "",
    side: "ajustes",
    title: "Settings",
    narrow: true,
    sheet: sheetWrap(inner, "Delete my account"),
  });
};

const state = (kind) => {
  if (kind == "vacio") {
    const body = `<div class="empty" style="padding-top:64px">${tile("list", "NONE", "lg")}<span class="h3">No transactions yet</span><p class="small muted" style="margin:0;max-width:260px">Log your first expense with the center button. All you need is the amount.</p><button class="btn primary" style="margin-top:8px">${iconSvg("plus", "sm")}Add an expense</button></div>`;
    return screen(body, { tab: "mov", side: "mov", title: "Transactions" });
  }
  if (kind == "carga") {
    const sk = range(0, 6)
      .map(
        () =>
          '<div class="row" style="cursor:default"><span class="skeleton" style="width:40px;height:40px;border-radius:12px"></span><span class="body" style="gap:6px"><span class="skeleton" style="height:12px;width:55%"></span><span class="skeleton" style="height:10px;width:35%"></span></span><span class="skeleton" style="height:12px;width:64px"></span></div>',
      )
      .join("");
    const chips = [72, 90, 80, 110]
      .map(
        (w) =>
          `<span class="skeleton" style="height:32px;width:${w}px;border-radius:999px"></span>`,
      )
      .join("");
    const body = `<div class="skeleton" style="height:44px;border-radius:10px"></div><div class="hstack" style="gap:8px">${chips}</div><div class="skeleton" style="height:72px;border-radius:14px"></div><div class="list card flush">${sk}</div>`;
    return screen(body, { tab: "mov", side: "mov", title: "Transactions" });
  }
  if (kind == "error") {
    const body = `<div class="empty" style="padding-top:64px">${tile("circle-alert", "RED", "lg")}<span class="h3">We couldn’t load your transactions</span><p class="small muted" style="margin:0;max-width:280px">The server didn’t respond (503). Your data is safe; try again in a few seconds.</p><button class="btn secondary" style="margin-top:8px">${iconSvg("refresh-cw", "sm")}Retry</button><span class="xs faint mono">Reference: 8c1f4e2a-…-3b7d</span></div>`;
    return screen(body, { tab: "mov", side: "mov", title: "Transactions" });
  }
  if (kind == "sesion") {
    const inner = `<div class="empty" style="padding:8px 0 4px">${tile("lock", "NONE", "lg")}<span class="h3">Your session ended</span><p class="small muted" style="margin:0">It was signed out from another device, or it’s been more than 30 days. Sign in again to continue.</p></div><button class="btn primary lg block">Sign in</button>`;
    return screen(settingsBodyDim(), {
      tab: "inicio",
      side: "inicio",
      title: "Home",
      sheet: sheetWrap(inner, "Session"),
    });
  }
  if (kind == "confirmar") {
    const inner = `<div class="alert warning">${iconSvg("archive")}<span><b>Archive “Lifestyle”.</b> Its 11 transactions are kept and the linked budget will show it as archived. You can restore it from Categories.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Archive</button></div>`;
    return screen(settingsBodyDim(), {
      tab: "",
      side: "cat",
      title: "Categories",
      sheet: sheetWrap(inner, "Archive category?"),
    });
  }
  if (
    [
      "offline",
      "online",
      "online-plain",
      "syncfail",
      "pendiente",
      "signedout",
      "blocked",
      "ready",
      "localonly",
    ].includes(kind)
  ) {
    const pend = `<span class="badge warning">${iconSvg("cloud-off")}Pending sync</span>`;
    const attn = `<span class="badge danger">${iconSvg("cloud-off")}Needs attention</span>`;
    const online = kind.startsWith("online");
    const rows =
      `<div class="day-head"><span>Today · Tuesday 22</span><span class="amount">${money(22300, "−")}</span></div>` +
      row(
        "coffee",
        "BROWN",
        "Pergamino Coffee",
        "7:55 · Cash · Saved on this device",
        9800,
        "expense",
        { badges: online ? "" : pend },
      ) +
      row(
        "utensils",
        "ORANGE",
        "Lunch",
        "13:05 · Bancolombia · Saved on this device",
        12500,
        "expense",
        { badges: online ? "" : kind == "syncfail" ? attn : pend },
      ) +
      `<div class="day-head"><span>Yesterday · Monday 21</span><span class="amount">${money(4200000, "+")}</span></div>` +
      row("briefcase", "GREEN", "August salary", "Bancolombia", 4200000, "income");
    let banner = "";
    let toast = "";
    if (kind == "offline") {
      banner = `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.<span class="sub">2 changes waiting</span></span></div>`;
      toast = `<div class="toast">${iconSvg("cloud-off")}Saved on this device · syncs when online<button class="action">Undo</button></div>`;
    } else if (kind == "online") {
      // F-62 · with the counter (the owner's pick, 2026-09-06); no line when nothing drained.
      banner = `<div class="banner online" role="status">${iconSvg("cloud-check")}<span class="txt"><b>Back online.</b><span class="sub">2 changes synced</span></span></div>`;
    } else if (kind == "online-plain") {
      banner = `<div class="banner online" role="status">${iconSvg("cloud-check")}<span class="txt"><b>Back online.</b></span></div>`;
    } else if (kind == "signedout") {
      banner = `<div class="banner offline" role="status">${iconSvg("log-in")}<span class="txt"><b>You’re signed out. Nothing is syncing.</b><span class="sub">2 changes are saved on this device</span></span><span class="actions"><button class="action">Sign in to sync</button></span></div>`;
    } else if (kind == "blocked") {
      banner = `<div class="banner error" role="alert">${iconSvg("cloud-off")}<span class="txt"><b>An app update stopped 2 changes from being sent.</b><span class="sub">They are still saved on this device.</span></span><span class="actions"><button class="action">See them</button></span></div>`;
    } else if (kind == "localonly") {
      banner = `<div class="banner offline" role="status">${iconSvg("cloud-off")}<span class="txt"><b>You’re working on this device only.</b><span class="sub">2 changes are saved here</span></span><span class="actions"><button class="action">Sign in to sync</button></span></div>`;
    } else if (kind == "ready") {
      toast = `<div class="toast">${iconSvg("cloud-check")}Ready to use offline<button class="action">What this means</button></div>`;
    } else if (kind == "pendiente") {
      banner = `<div class="banner offline" role="status">${iconSvg("cloud-off")}<span class="txt"><b>Changes waiting to sync.</b> They are saved on this device.<span class="sub">2 changes waiting</span></span></div>`;
    } else {
      banner = `<div class="banner error" role="alert">${iconSvg("circle-alert")}<span class="txt"><b>Some changes need your attention.</b><span class="sub">1 change could not sync</span></span><span class="actions"><button class="action">Review</button><button class="action">See all</button></span></div>`;
    }
    const body = `<div class="list card flush">${rows}</div>` + toast;
    return screen(body, { tab: "mov", side: "mov", title: "Transactions", banner });
  }
  if (kind == "local") {
    const inner = `<div class="alert warning">${iconSvg("cloud-off")}<span>Your session ended, so nothing is syncing. The app keeps working on this device and your changes are saved here — sign in again to send them.</span></div><button class="btn primary lg block">${iconSvg("log-in", "sm")}Sign in to sync</button>`;
    return screen(settingsBodyDim(), {
      tab: "inicio",
      side: "inicio",
      title: "Home",
      sheet: sheetWrap(inner, "Sign in to sync"),
    });
  }
  if (kind == "offline-doc") {
    return '<div class="offline-doc"><div><h1>You’re offline.</h1><p>This screen has not been opened on this device yet, so there is nothing saved to show.</p><a href="#">Try again</a></div></div>';
  }
  if (kind == "sw-update") {
    const toast = `<div class="toast">${iconSvg("cloud-download")}New version available<button class="action">Reload</button></div>`;
    return screen(settingsBodyDim() + toast, { tab: "inicio", side: "inicio", title: "Home" });
  }
  if (kind == "mov-offline") {
    const body = `<div class="empty" style="padding-top:64px">${tile("wifi-off", "NONE", "lg")}<span class="h3">You’re offline</span><p class="small muted" style="margin:0;max-width:260px">The list will load when you’re back online.</p></div>`;
    const banner = `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.</span></div>`;
    return screen(body, { tab: "mov", side: "mov", title: "Transactions", banner });
  }
  return undefined;
};

const languageSheet = ({ offline = false } = {}) => {
  const opt = (name, sub, sel) =>
    `<button class="row" style="border-top:1px solid var(--border)"><span class="body"><span class="title">${name}</span><span class="meta">${sub}</span></span><span class="right" style="flex-direction:row">${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  const notice = offline
    ? `<div class="alert warning">${iconSvg("wifi-off")}<span>Changing this needs a connection: it is saved on the server.</span></div>`
    : "";
  const inner = `${notice}<div class="list" style="margin:0 -16px;${offline ? "opacity:.5;pointer-events:none" : ""}">${opt("Follow device", "Uses your phone or browser language", false)}${opt("English", "Default", true)}${opt("Español", "Spanish", false)}</div>
<p class="small muted" style="margin:0">Dates and amounts follow your language, your currency (COP) and your time zone.</p>`;
  return screen(settingsBodyDim(), {
    tab: "",
    side: "ajustes",
    title: "Settings",
    narrow: true,
    sheet: sheetWrap(inner, "Language"),
  });
};

const filtersSheet = () => {
  const acc = (icon, col, label, sel = false) =>
    `<button class="chip cat color-${col}${sel ? " selected" : ""}"><span class="dot">${iconSvg(icon)}</span>${label}</button>`;
  const periods = ["This week", "This month", "Last month", "This year", "Custom…"]
    .map((v) => `<button class="chip${v == "This month" ? " selected" : ""}">${v}</button>`)
    .join("");
  const inner = `<div class="stack" style="gap:16px">
<div class="field"><span class="label">Period</span><div class="chips">${periods}</div>
<div class="input-group" style="margin-top:6px"><div class="input">${iconSvg("calendar", "sm")}<span class="value">Sep 1</span></div><div class="input">${iconSvg("calendar", "sm")}<span class="value">Sep 30</span></div></div></div>
<div class="field"><span class="label">Type</span><div class="chips"><button class="chip selected">All</button><button class="chip">Expenses</button><button class="chip">Income</button><button class="chip">Transfers</button><button class="chip">${iconSvg("scale", "sm")}Adjustments</button></div></div>
<div class="field"><span class="label">Account</span><div class="chips">${acc("landmark", "BLUE", "Bancolombia", true)}${acc("banknote", "GRAY", "Cash")}${acc("credit-card", "PURPLE", "Visa Gold")}${acc("piggy-bank", "GREEN", "Savings")}</div></div>
<div class="field"><span class="label">Category</span><div class="chips">${catChip("Food")}${catChip("Transport", true)}${catChip("Coffee")}${catChip("Lifestyle")}<button class="chip">${iconSvg("search", "sm")}More</button><button class="chip">${iconSvg("hash", "sm")}Uncategorized</button></div></div>
<div class="field"><span class="label">Tag</span><div class="input" style="height:40px">${iconSvg("tag", "sm")}<span class="placeholder" style="flex:1">#latte, #groceries…</span></div></div>
<div class="hstack" style="gap:10px"><button class="switch" aria-checked="true" aria-label="Only quick expenses to review"></button><span class="small">Only quick expenses to review</span></div>
<div class="hstack" style="gap:10px"><button class="switch" aria-checked="false" aria-label="Only quick entries"></button><span class="small">Only quick entries (source QUICK)</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Clear</button><button class="btn primary lg" style="flex:1.4">Show 12 transactions</button></div></div>`;
  return screen(settingsBodyDim(), {
    tab: "mov",
    side: "mov",
    title: "Transactions",
    sheet: sheetWrap(inner, "Filters"),
  });
};

const transactionFormBodyDim = () =>
  '<div class="segment"><button aria-pressed="true">Expense</button><button class="income">Income</button><button class="transfer">Transfer</button><button>Adjustment</button></div><div class="amount-input" style="padding-top:8px"><span class="cur">$</span><span class="num">18,400</span></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:120px"></div>';

// F-05 · own calendar and clock: the browser's follow neither the tokens nor the app's language.
const dateSheet = () => {
  const weeks = [
    [
      ["31", "out"],
      ["1", ""],
      ["2", ""],
      ["3", ""],
      ["4", ""],
      ["5", ""],
      ["6", ""],
    ],
    [
      ["7", ""],
      ["8", ""],
      ["9", ""],
      ["10", ""],
      ["11", ""],
      ["12", ""],
      ["13", ""],
    ],
    [
      ["14", ""],
      ["15", ""],
      ["16", ""],
      ["17", ""],
      ["18", ""],
      ["19", ""],
      ["20", ""],
    ],
    [
      ["21", "sel"],
      ["22", "today"],
      ["23", ""],
      ["24", "off"],
      ["25", "off"],
      ["26", "off"],
      ["27", "off"],
    ],
    [
      ["28", "off"],
      ["29", "off"],
      ["30", "off"],
      ["1", "out off"],
      ["2", "out off"],
      ["3", "out off"],
      ["4", "out off"],
    ],
  ];
  const d = (n, st) => {
    const dis = st.includes("off") ? " disabled" : "";
    const cls = st
      .split(" ")
      .filter((c) => c != "off")
      .join(" ");
    return `<button class="d ${cls}"${dis} aria-pressed="${String(st.includes("sel"))}" aria-label="September ${n}">${n}</button>`;
  };
  const days = weeks
    .flat()
    .map(([n, st]) => d(n, st))
    .join("");
  const inner = `<div class="chips"><button class="chip">Today</button><button class="chip selected">Yesterday</button></div>
<div class="cal">
<div class="cal-head"><button class="btn ghost icon-only sm round" aria-label="Previous month">${iconSvg("chevron-left", "sm")}</button><span class="label">September 2026</span><button class="btn ghost icon-only sm round" aria-label="Next month" disabled>${iconSvg("chevron-right", "sm")}</button></div>
<div class="dow">${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((x) => `<span>${x}</span>`).join("")}</div>
<div class="days">${days}</div></div>
<p class="xs faint" style="margin:0">Days after tomorrow are not available: the server refuses dates more than 24 hours ahead.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Done</button></div>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: sheetWrap(inner, "Date"),
  });
};

const timeSheet = () => {
  const hh = range(15, 22)
    .map((h) => `<button class="${h == 18 ? "sel" : ""}">${pad2(h)}</button>`)
    .join("");
  const mm = range(0, 60, 5)
    .map((m) => `<button class="${m == 10 ? "sel" : ""}">${pad2(m)}</button>`)
    .join("");
  const inner = `<div class="wheel"><div class="col" aria-label="Hour">${hh}</div><div class="col" aria-label="Minute">${mm}</div></div>
<div class="hstack" style="justify-content:center"><button class="btn secondary sm">${iconSvg("clock", "sm")}Now</button></div>
<p class="xs faint" style="margin:0;text-align:center">Saved in your time zone, America/Bogota.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Done</button></div>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: sheetWrap(inner, "Time"),
  });
};

const categoryPicker = () => {
  const r = (name, sel = false, meta = "Expense") => {
    const [ic, col] = CATS[name];
    return `<button class="row" style="border-top:1px solid var(--border)">${tile(ic, col)}<span class="body"><span class="title">${name}</span><span class="meta">${meta}</span></span><span class="right" style="flex-direction:row">${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  };
  const rows =
    r("Food") +
    r("Transport", true) +
    r("Housing") +
    r("Bills") +
    r("Lifestyle") +
    r("Coffee") +
    r("Health") +
    r("Pets");
  const inner = `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search categories</span></div>
<div class="stack-sm"><span class="eyebrow">Recent</span><div class="chips">${catChip("Coffee")}${catChip("Food")}${catChip("Transport")}</div></div>
<div class="list" style="margin:0 -16px;max-height:340px;overflow:auto">${rows}
<button class="row" style="border-top:1px solid var(--border)">${tile("plus", "NONE")}<span class="body"><span class="title" style="color:var(--brand-text)">New category</span><span class="meta">Create it without leaving this form</span></span></button></div>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: sheetWrap(inner, "Category"),
  });
};

const accountPicker = () => {
  const r = (name, typ, col, bal, sel = false, neg = false, main = false) => {
    const badge = main ? '<span class="badge brand">Main</span>' : "";
    const amt = `<span class="amount">${neg ? "−" : ""}${money(bal)}</span>`;
    return `<button class="row" style="border-top:1px solid var(--border)">${tile(ACCT_TYPE_ICON[typ], col)}<span class="body"><span class="title"><span>${name}</span>${badge}</span><span class="meta">${ACCT_TYPE_LABEL[typ]}</span></span><span class="right">${amt}${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  };
  const rows =
    r("Bancolombia", "ACCOUNT", "BLUE", 3420500, true, false, true) +
    r("Cash", "CASH", "GRAY", 184000) +
    r("Visa Gold", "CARD", "PURPLE", 1245900, false, true) +
    r("Savings", "SAVINGS", "GREEN", 8900000);
  const inner = `<div class="list" style="margin:0 -16px">${rows}</div>
<p class="xs faint" style="margin:0">Archived accounts are not listed. Balances update as you save.</p>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: sheetWrap(inner, "Account"),
  });
};

const publicShell = (inner) => {
  const logo = '<span class="logo">' + iconSvg("layers", "sm") + "</span>";
  const nav = `<header class="public-nav"><a class="brand" href="#" style="padding:0">${logo}Ledger Flow</a>
<nav class="links"><a href="#">Features</a><a href="#">How it works</a><a href="#">Privacy</a></nav>
<div class="hstack"><button class="chip" style="height:32px">${iconSvg("globe", "sm")}EN</button><a class="btn ghost" href="#">Sign in</a><a class="btn primary" href="#">Get started</a></div></header>`;
  const foot = `<footer class="public-footer"><div class="inner"><span>&copy; 2026 Ledger Flow</span><span class="hstack" style="gap:16px"><a href="#">Privacy policy</a><a href="#">Terms</a><a href="#">Data processing (Ley 1581)</a><a href="#">Contact</a></span><span class="hstack" style="gap:8px">${iconSvg("globe", "sm")}English &middot; <a href="#">Espa&ntilde;ol</a></span></div></footer>`;
  return `<div class="public">${nav}<main class="public-main">${inner}</main>${foot}</div>`;
};

const landing = () => {
  const hero = `<section class="hero"><div class="stack" style="gap:20px"><span class="badge brand" style="align-self:flex-start">${iconSvg("sparkles")}Free &middot; no card needed</span>
<h1>See where your money actually goes.</h1>
<p>Log an expense in three seconds, put a ceiling on the month and catch the small daily spending that adds up before it does.</p>
<div class="cta"><a class="btn primary lg" href="#">Create your free account</a><a class="btn secondary lg" href="#">Sign in</a></div>
<span class="small faint">Works offline &middot; English &amp; Espa&ntilde;ol &middot; Your data stays yours</span></div>
<div class="phone"><div class="app">${home()}</div></div></section>`;
  const feats = `<section class="stack" style="gap:24px"><div class="stack-sm" style="text-align:center"><span class="eyebrow">Why Ledger Flow</span><h2 class="h1" style="font-size:28px">Built for the small stuff</h2></div>
<div class="feature-grid">
<div class="card feature">${tile("zap", "AMBER", "lg")}<span class="h3">Three-second capture</span><p>Tap, type the amount, done. Add the category later from your review inbox: the expense already counts.</p></div>
<div class="card feature">${tile("chart-pie", "INDIGO", "lg")}<span class="h3">Budgets that talk back</span><p>A ceiling for the month plus per-category limits, with pace and days left in plain language, not just a bar.</p></div>
<div class="card feature">${tile("wifi-off", "TEAL", "lg")}<span class="h3">Works without signal</span><p>Log on the bus or abroad. Everything syncs when you are back online, and nothing gets duplicated.</p></div></div></section>`;
  const steps = `<section class="stack" style="gap:24px"><div class="stack-sm" style="text-align:center"><span class="eyebrow">How it works</span><h2 class="h1" style="font-size:28px">Up and running in a minute</h2></div>
<div class="steps"><div class="step"><span class="n">1</span><div><span class="h3">Create your account</span><p class="small muted" style="margin:4px 0 0">Pick your currency once. Email and password, nothing else.</p></div></div>
<div class="step"><span class="n">2</span><div><span class="h3">Add your first account</span><p class="small muted" style="margin:4px 0 0">Cash, bank or card, with today&rsquo;s balance.</p></div></div>
<div class="step"><span class="n">3</span><div><span class="h3">Set a monthly ceiling</span><p class="small muted" style="margin:4px 0 0">Then log expenses as they happen. That is the whole habit.</p></div></div></div>
<div class="hstack" style="justify-content:center"><a class="btn primary lg" href="#">Start now &mdash; it&rsquo;s free</a></div></section>`;
  return publicShell(hero + feats + steps);
};

const notFound = () => {
  const inner = `<div class="empty" style="padding-top:96px">${tile("search", "NONE", "lg")}<span class="h1">Page not found</span><p class="muted" style="margin:0;max-width:360px">The address may be wrong or the page may have moved. Your money is where you left it.</p><div class="hstack" style="gap:10px;margin-top:8px"><a class="btn primary" href="#">Go to Home</a><a class="btn ghost" href="#">Back</a></div></div>`;
  return publicShell(inner);
};

const legal = () => {
  const inner = `<article class="legal"><span class="eyebrow">Legal &middot; updated Sep 1, 2026</span><h1 class="h1">Privacy policy</h1>
<p>Ledger Flow stores the financial records you enter so you can see them on any device. This page explains what we keep, why, and how you control it. It also serves as our data processing policy under Colombia&rsquo;s Ley 1581 de 2012.</p>
<h2>What we store</h2><ul><li>Your name, email, language, time zone and currency.</li><li>Accounts, categories, transactions and budgets you create, including notes and tags.</li><li>Device sessions (browser type, time of sign-in) so you can review and revoke them.</li></ul>
<h2>Why</h2><p>Only to run the service: showing your data back to you, keeping balances right and securing your account. We do not sell data and we do not use it for advertising.</p>
<h2>Your rights</h2><p>You can read, correct and delete your data from Settings at any time. Deleting your account keeps the records so you can reactivate later; ask us for permanent removal and we will do it within 15 business days.</p>
<h2>Contact</h2><p>ledgerflow@alexpiral.com</p></article>`;
  return publicShell(inner);
};

const compareCard = (title, side) => {
  const fields = [
    ["Amount", side == "mine" ? "$18,400" : "$16,900", true],
    ["Description", "Uber to work", false],
    ["Date", "Sep 21 · 18:10", false],
    ["Account", "Visa Gold", false],
    ["Category", "Transport", false],
  ];
  const kvs = fields
    .map(([k, v, d]) => `<div class="kv${d ? " disputed" : ""}"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
  return `<section class="compare"><h4>${title}</h4><dl style="margin:0;display:flex;flex-direction:column;gap:4px">${kvs}</dl></section>`;
};

const compareRows = (title, fields) => {
  const kvs = fields
    .map(([k, v, d]) => `<div class="kv${d ? " disputed" : ""}"><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
  return `<section class="compare"><h4>${title}</h4><dl style="margin:0;display:flex;flex-direction:column;gap:4px">${kvs}</dl></section>`;
};

const conflict = (kind = "stale") => {
  const what = "transaction";
  let inner;
  if (kind == "stale") {
    inner = `<div class="alert danger">${iconSvg("circle-alert")}<span><b>Changed in two places.</b> This ${what} changed somewhere else while this device was offline. Choose the version to keep.</span></div>
<div class="grid-2" style="gap:10px">${compareCard("On the server", "theirs")}${compareCard("On this device", "mine")}</div>
<button class="btn primary lg block">Keep this device’s version</button><button class="btn ghost block">Use the server’s version</button>`;
  } else if (kind == "failed") {
    inner = `<div class="alert danger">${iconSvg("circle-x")}<span><b>The server refused this change.</b> It was never applied, here or there. Reason: <span class="mono">FUTURE_DATE</span>. Discarding it puts this ${what} back to what the server has.</span></div>
${compareCard("On this device", "mine")}
<button class="btn primary lg block">Discard this change</button><button class="btn ghost block">Try again</button>`;
  } else if (kind == "archived") {
    inner = `<div class="alert danger">${iconSvg("archive")}<span><b>The account was archived somewhere else.</b> This ${what} uses an account that was archived on another device, so the server will not take it. Restore the account and it goes through in the same batch, or edit the ${what} to use another account.</span></div>
<div class="hstack" style="gap:10px">${tile("credit-card", "PURPLE", "sm")}<span class="small muted">Visa Gold · archived</span></div>
${compareCard("On this device", "mine")}
<button class="btn primary lg block">${iconSvg("archive-restore", "sm")}Restore the account</button><button class="btn ghost block">Discard this change</button>`;
  } else if (kind == "noserver") {
    inner = `<div class="alert danger">${iconSvg("circle-alert")}<span><b>Changed in two places.</b> This ${what} changed somewhere else while this device was offline. Choose the version to keep.</span></div>
<div class="alert warning">${iconSvg("triangle-alert")}<span>The server didn’t say what it has. Keeping this device’s version will overwrite it.</span></div>
${compareCard("On this device", "mine")}
<button class="btn primary lg block">Keep this device’s version</button><button class="btn ghost block">Use the server’s version</button>`;
  } else if (kind == "dup") {
    // F-60 · a restore refused as DUPLICATE: the way out is another name.
    inner = `<div class="alert danger">${iconSvg("circle-x")}<span><b>The name is taken.</b> An active account is already named “Cash”, so the server won’t take this one back. Restore it with another name, or discard the change.</span></div>
<div class="grid-2" style="gap:10px">${compareRows("On the server · has the name", [
      ["Name", "Cash", true],
      ["Type", "Cash", false],
      ["Status", "Active", false],
    ])}${compareRows("On this device · being restored", [
      ["Name", "Cash", true],
      ["Type", "Cash", false],
      ["Status", "Archived", false],
    ])}</div>
${field("New name", "Cash (old)", null, { cls: "focus", help: "Names are case-insensitive." })}
<button class="btn primary lg block">${iconSvg("archive-restore", "sm")}Restore as “Cash (old)”</button><button class="btn ghost block">Discard this change</button>
<p class="xs faint" style="margin:0;text-align:center">“Try again” is not offered here: the same name would be refused again.</p>`;
  } else if (kind == "future") {
    // F-66 · FUTURE_DATE: the date is fixed here, not only discarded.
    inner = `<div class="alert danger">${iconSvg("circle-x")}<span><b>The server refused this date.</b> <b>Sep 25 · 18:10</b> is more than 24 hours ahead of the server’s time (<b>Sep 22 · 18:12</b>). This device’s clock is 3 days ahead.</span></div>
<div class="input-group">
<div class="field"><span class="label">Date</span><div class="input focus">${iconSvg("calendar", "sm")}<span class="value">Today · Sep 22</span></div><span class="help">Was Sep 25</span></div>
<div class="field"><span class="label">Time</span><div class="input">${iconSvg("clock", "sm")}<span class="value">18:10</span></div></div></div>
<div class="card hstack color-NONE" style="gap:12px;padding:12px">${tile("hash", "NONE", "sm")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span style="font-weight:500">Dinner</span><span class="small faint">Expense · Cash</span></span><span class="amount">${money(48200, "−")}</span></div>
<button class="btn primary lg block">${iconSvg("check", "sm")}Save and try again</button><button class="btn ghost block">Discard this change</button>
<p class="xs faint" style="margin:0;text-align:center">1 more change is waiting behind this one.</p>`;
    return screen(settingsBodyDim(), {
      tab: "mov",
      side: "mov",
      title: "Transactions",
      banner: `<div class="banner error" role="alert">${iconSvg("circle-alert")}<span class="txt"><b>Some changes need your attention.</b><span class="sub">1 change could not sync</span></span><span class="actions"><button class="action">Review</button><button class="action">See all</button></span></div>`,
      sheet: sheetWrap(inner, "Fix the date"),
    });
  } else {
    inner = `<div class="alert success">${iconSvg("circle-check")}<span><b>Nothing left to resolve.</b> This change is no longer waiting to sync.</span></div><button class="btn secondary lg block">Close</button>`;
  }
  const banner = `<div class="banner error" role="alert">${iconSvg("circle-alert")}<span class="txt"><b>Some changes need your attention.</b><span class="sub">1 change could not sync</span></span><span class="actions"><button class="action">Review</button><button class="action">See all</button></span></div>`;
  return screen(settingsBodyDim(), {
    tab: "mov",
    side: "mov",
    title: "Transactions",
    banner,
    sheet: sheetWrap(inner, "Resolve sync conflict"),
  });
};

const attentionCard = (
  icon,
  color,
  name,
  kind,
  asked,
  reason,
  buttons,
) => `<div class="card stack" style="gap:12px"><div class="hstack" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="hstack" style="gap:10px">${tile(icon, color, "sm")}<span class="h3">${name}</span></span><span class="badge danger">${kind}</span></div>
<p class="small muted" style="margin:0">${asked}</p><p class="small muted" style="margin:0">${reason}</p>
<div class="hstack" style="gap:8px;flex-wrap:wrap">${buttons}</div></div>`;

const syncInbox = (kind = "list") => {
  const b = (label, v = "secondary", ic = "") =>
    `<button class="btn ${v} sm">${ic}${label}</button>`;
  let cards =
    attentionCard(
      "car",
      "BLUE",
      "Uber to work",
      "Changed in two places",
      "This device asked to edit this transaction.",
      "This transaction changed somewhere else while this device was offline. Choose the version to keep.",
      b("Keep this device’s version", "primary") +
        b("Use the server’s version", "ghost") +
        b("Compare versions", "secondary"),
    ) +
    attentionCard(
      "utensils",
      "ORANGE",
      "Lunch",
      "Account archived",
      "This device asked to create this transaction.",
      "This transaction uses an account that was archived on another device, so the server will not take it. Restore the account and it goes through in the same batch, or edit the transaction to use another account.",
      b("Restore the account", "primary", iconSvg("archive-restore", "sm")) +
        b("Discard this change", "ghost"),
    ) +
    attentionCard(
      "hash",
      "NONE",
      "Dinner",
      "Refused by the server",
      "This device asked to capture this transaction.",
      "Its date, Sep 25 · 18:10, is more than 24 hours ahead of the server’s time. This device’s clock is 3 days ahead.",
      b("Fix the date", "primary", iconSvg("calendar", "sm")) +
        b("Discard this change", "ghost") +
        b("Try again", "secondary", iconSvg("refresh-cw", "sm")),
    );
  if (kind == "dup") {
    // F-60 · a restore the server refused because the name is taken.
    cards =
      attentionCard(
        "banknote",
        "GRAY",
        "Cash",
        "Name taken",
        "This device asked to restore this account.",
        "An active account is already named “Cash”, so the server won’t take this one back. Restore it with another name, or discard the change.",
        b("Restore with another name", "primary", iconSvg("archive-restore", "sm")) +
          b("Compare versions", "secondary") +
          b("Discard this change", "ghost"),
      ) +
      attentionCard(
        "utensils",
        "ORANGE",
        "Food",
        "Name taken",
        "This device asked to restore this category.",
        "An active category is already named “Food”. The same applies: restore it with another name, or discard the change.",
        b("Restore with another name", "primary", iconSvg("archive-restore", "sm")) +
          b("Discard this change", "ghost"),
      );
    const body = `<p class="small muted" style="margin:0">These changes are saved on this device and the server has not taken them. Nothing else in the queue is waiting for them.</p>
<div class="hstack" style="gap:8px"><button class="btn secondary sm">${iconSvg("trash-2", "sm")}Discard all</button><button class="btn secondary sm">${iconSvg("refresh-cw", "sm")}Try all again</button></div>${cards}`;
    return screen(body, {
      tab: "",
      side: "",
      back: true,
      title: "2 changes need you",
      narrow: true,
    });
  }
  if (kind == "blocked") {
    // F-65 · the old queue cannot be migrated: it is seen and decided here.
    cards =
      attentionCard(
        "coffee",
        "BROWN",
        "Pergamino Coffee",
        "Blocked by an app update",
        "This device asked to capture this transaction.",
        "It was recorded with an older version of the app and this version can’t send it. It will never reach the server on its own.",
        b("Discard this change", "primary", iconSvg("trash-2", "sm")) + b("Keep it here", "ghost"),
      ) +
      attentionCard(
        "car",
        "BLUE",
        "Uber to work",
        "Blocked by an app update",
        "This device asked to edit this transaction.",
        "Same reason. The edit stays on this device; the server keeps the version it already had.",
        b("Discard this change", "primary", iconSvg("trash-2", "sm")) + b("Keep it here", "ghost"),
      );
    const body = `<div class="alert danger">${iconSvg("cloud-alert")}<span><b>2 changes can’t be sent after an app update.</b> Everything you record from now on syncs normally; these two were recorded with an older version and stayed behind. Discarding them frees the queue.</span></div>
<div class="hstack" style="gap:8px"><button class="btn secondary sm">${iconSvg("trash-2", "sm")}Discard the 2 changes</button></div>${cards}
<p class="xs faint" style="margin:0;text-align:center">Nothing you record now waits behind these.</p>`;
    return screen(body, {
      tab: "",
      side: "",
      back: true,
      title: "2 changes need you",
      narrow: true,
    });
  }
  if (kind == "empty") {
    const body = `<div class="empty" style="padding-top:64px">${tile("cloud-check", "GREEN", "lg")}<span class="h3">Nothing needs you</span><p class="small muted" style="margin:0;max-width:280px">Every change on this device either synced or is still on its way.</p><button class="btn secondary" style="margin-top:8px">Go home</button></div>`;
    return screen(body, {
      tab: "",
      side: "",
      back: true,
      title: "Needs your attention",
      narrow: true,
    });
  }
  const body = `<p class="small muted" style="margin:0">These changes are saved on this device and the server has not taken them. Nothing else in the queue is waiting for them.</p>
<div class="hstack" style="gap:8px"><button class="btn secondary sm">${iconSvg("trash-2", "sm")}Discard all</button><button class="btn secondary sm">${iconSvg("refresh-cw", "sm")}Try all again</button></div>${cards}`;
  const sh =
    kind == "confirm"
      ? sheetWrap(
          `<div class="alert warning">${iconSvg("triangle-alert")}<span><b>They will never reach the server, and this device goes back to what the server has.</b><br>1 of them was made on top of something created here and goes with it.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.2">Discard</button></div>`,
          "Discard 3 changes?",
        )
      : "";
  const toast =
    kind == "toast"
      ? `<div class="toast">${iconSvg("check")}3 changes back in the queue</div>`
      : "";
  return screen(body + toast, {
    tab: "",
    side: "",
    back: true,
    title: "3 changes need you",
    narrow: true,
    sheet: sh,
  });
};

const statusRow = (icon, title, help, value, color = "GRAY", action = "", tone = "") => {
  const m = help ? `<span class="meta">${help}</span>` : "";
  const v = value ? `<span class="small ${tone}" style="font-weight:500">${value}</span>` : "";
  return `<div class="row" style="cursor:default">${tile(icon, color, "sm")}<span class="body"><span class="title">${title}</span>${m}</span><span class="right" style="flex-direction:row;align-items:center;gap:8px">${v}${action}</span></div>`;
};

const syncStatus = (kind = "tab") => {
  const warn = !["installed", "preparing", "blocked", "signedout"].includes(kind)
    ? `<div class="alert warning">${iconSvg("monitor-smartphone")}<span>You’re in a browser tab. Install the app to keep what you record offline — a browser can delete it after a few days without opening the site.</span></div>`
    : "";
  const transport =
    kind == "routes"
      ? statusRow(
          "split",
          "Sending mode",
          "This server takes changes one at a time, not in one batch",
          "One at a time",
        )
      : "";
  // F-41 · the session is the first row: without it nothing below reaches the server.
  let session;
  if (kind == "signedout") {
    session = statusRow(
      "log-in",
      "Session",
      "Signed out on this device, so nothing is syncing",
      "Signed out",
      "AMBER",
      '<button class="btn sm primary">Sign in to sync</button>',
      "muted",
    );
  } else if (kind == "localonly") {
    // P-32 · the user chose it, so the value says so without scolding.
    session = statusRow(
      "cloud-off",
      "Session",
      "You chose to keep working here. Nothing is syncing.",
      "This device only",
      "AMBER",
      '<button class="btn sm primary">Sign in to sync</button>',
      "muted",
    );
  } else {
    session = statusRow("log-in", "Session", "Your session on the server", "Active", "GREEN");
  }
  // F-54 · "you can use the app without a connection", with what is missing while it prepares.
  let ready =
    {
      preparing: statusRow(
        "cloud-check",
        "Offline ready",
        "Copying your data and the app’s screens · 18 of 25 screens",
        "Preparing…",
        "TEAL",
        "",
        "muted",
      ),
      offline: statusRow(
        "cloud-check",
        "Offline ready",
        "Paused: it needs a connection to finish",
        "Incomplete",
        "AMBER",
        '<button class="btn sm secondary" disabled>Retry</button>',
        "muted",
      ),
    }[kind] ??
    statusRow(
      "cloud-check",
      "Offline ready",
      "Your data and the app’s screens are on this device",
      "Ready",
      "GREEN",
    );
  const waiting =
    kind == "blocked"
      ? statusRow(
          "cloud-off",
          "Waiting to send",
          "Blocked by an app update",
          "2 · blocked",
          "RED",
          "",
          "muted",
        )
      : statusRow("cloud-off", "Waiting to send", "Last error: NETWORK", "2");
  // F-85 · until the mirror and the cache answer, the row shows a skeleton and not a false "Never".
  const sk = '<span class="skeleton" style="height:12px;width:64px;display:inline-block"></span>';
  let cursor;
  let last;
  if (kind == "loading") {
    cursor = statusRow("database", "Sync cursor", "Where the next pull starts from", sk);
    last = statusRow("refresh-cw", "Last full sync", "", sk);
    ready = statusRow(
      "cloud-check",
      "Offline ready",
      "Your data and the app’s screens are on this device",
      sk,
    );
  } else {
    cursor = statusRow("database", "Sync cursor", "Where the next pull starts from", "Set");
    last = statusRow("refresh-cw", "Last full sync", "", "Today 8:40");
  }
  if (kind == "nosw") {
    // F-85 · the app runs without a service worker on purpose (development).
    ready = statusRow(
      "cloud-check",
      "Offline ready",
      "The app’s screens are only saved in the installed app",
      "Not available",
      "GRAY",
      "",
      "muted",
    );
  }
  // F-86 · the value does not change; what changes is that the row explains and leads to the install sheet.
  const persist =
    kind == "installed"
      ? statusRow(
          "shield-check",
          "Persistent storage",
          "Your offline data is safe from the browser’s cleanup",
          "Granted",
          "GREEN",
        )
      : statusRow(
          "shield-check",
          "Persistent storage",
          "Only installed apps get it. This browser said no.",
          "Not granted",
          "AMBER",
          '<button class="btn sm secondary">How to get it</button>',
          "muted",
        );
  const rows =
    session +
    cursor +
    last +
    ready +
    waiting +
    transport +
    statusRow("hard-drive", "Storage used", "", "12.4 MB") +
    persist +
    statusRow(
      "monitor-smartphone",
      "Running as",
      "",
      ["installed", "blocked", "preparing"].includes(kind) ? "Installed app" : "Browser tab",
    );
  const offline = kind == "offline";
  // F-65 · an update left changes that cannot be migrated: said here and in the tray.
  const blocked =
    kind == "blocked"
      ? `<div class="alert danger">${iconSvg("cloud-alert")}<span><b>2 changes can’t be sent after an app update.</b> They were recorded with an older version of the app and this one can’t send them. Everything you record from now on syncs normally.</span></div>` +
        `<div class="hstack" style="gap:8px"><button class="btn secondary sm">${iconSvg("inbox", "sm")}See the 2 changes</button></div>`
      : "";
  const resync = `<div class="stack-sm"><button class="btn secondary block"${offline ? " disabled" : ""}>${iconSvg("rotate-ccw", "sm")}Force full resync</button><p class="xs muted" style="margin:0;text-align:center">${offline ? "Needs a connection: it downloads the copy again." : "Throws away the local copy and downloads it again. Anything waiting to send is kept."}</p></div>`;
  const body = `<p class="small muted" style="margin:0">What this device has, and what it still owes the server</p>${warn}${blocked}
<div class="list card flush">${rows}</div>
<div class="list card flush">${settingsRow("cloud-off", "Changes that need you", "2 changes are stuck", "", "ORANGE")}</div>${resync}`;
  const sh =
    kind == "resync"
      ? sheetWrap(
          `<div class="alert warning">${iconSvg("rotate-ccw")}<span>The local copy is deleted and downloaded again. 2 changes waiting to send are kept.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Resync now</button></div>`,
          "Download everything again?",
        )
      : "";
  const banners = {
    offline: `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.<span class="sub">2 changes waiting</span></span></div>`,
    signedout: `<div class="banner offline" role="status">${iconSvg("log-in")}<span class="txt"><b>You’re signed out. Nothing is syncing.</b><span class="sub">2 changes are saved on this device</span></span><span class="actions"><button class="action">Sign in to sync</button></span></div>`,
    blocked: `<div class="banner error" role="alert">${iconSvg("cloud-off")}<span class="txt"><b>An app update stopped 2 changes from being sent.</b><span class="sub">They are still saved on this device.</span></span><span class="actions"><button class="action">See them</button></span></div>`,
    localonly: `<div class="banner offline" role="status">${iconSvg("cloud-off")}<span class="txt"><b>You’re working on this device only.</b><span class="sub">2 changes are saved here</span></span><span class="actions"><button class="action">Sign in to sync</button></span></div>`,
  };
  return screen(body, {
    tab: "",
    side: "ajustes",
    back: true,
    title: "Sync status",
    narrow: true,
    sheet: sh,
    banner: banners[kind] ?? "",
  });
};

const signOutSheet = () => {
  const inner = `<div class="alert warning">${iconSvg("cloud-off")}<span>2 changes haven’t reached the server yet. Keeping them means they go out next time you sign in on this device.</span></div>
<button class="btn primary lg block">Sign out and keep them</button><button class="btn danger lg block">Discard and sign out</button>`;
  return screen(settingsBodyDim(), {
    tab: "",
    side: "ajustes",
    title: "Settings",
    narrow: true,
    sheet: sheetWrap(inner, "You have unsent changes"),
  });
};

// P-32 (2026-09-08) · coming back without a session: three exits, its confirmation and the chosen mode.
const threeExits = () => {
  const exitRow = (cls, icon, label, line) =>
    `<button class="btn ${cls} lg block">${iconSvg(icon, "sm")}${label}</button>` +
    `<p class="xs muted" style="margin:-6px 0 4px">${line}</p>`;
  const inner =
    `<div class="alert warning">${iconSvg("cloud-off")}<span>Your session ended. The app keeps working here and your ` +
    `<b>2 changes</b> are saved on this device — they just aren’t going anywhere.</span></div>` +
    exitRow(
      "primary",
      "log-in",
      "Sign in to sync",
      "Sign in and everything saved here goes to the server.",
    ) +
    exitRow(
      "secondary",
      "cloud-off",
      "Continue on this device only",
      "The app works the same and nothing leaves this device. <b>If you change browser or clear the site’s data, this can’t be recovered.</b>",
    ) +
    `<button class="btn ghost lg block" style="color:var(--danger)">${iconSvg("trash-2", "sm")}Delete everything on this device</button>` +
    '<p class="xs muted" style="margin:-6px 0 0">Deletes the local copy and its 2 unsent changes. Your account on the server is not touched.</p>';
  return screen(settingsBodyDim(), {
    tab: "inicio",
    side: "inicio",
    title: "Home",
    sheet: sheetWrap(inner, "This device has your data, but no session", false),
  });
};

const deleteLocalCopy = () => {
  const inner =
    `<div class="alert danger">${iconSvg("trash-2")}<span>This deletes the copy of your data on this device and ` +
    `<b>2 changes that only exist here</b>. It does not delete your account: signing in again downloads ` +
    `everything the server has.</span></div>` +
    '<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button>' +
    '<button class="btn danger lg" style="flex:1.4">Delete everything</button></div>';
  return screen(settingsBodyDim(), {
    tab: "inicio",
    side: "inicio",
    title: "Home",
    sheet: sheetWrap(inner, "Delete everything on this device?"),
  });
};

const installSheet = (prompt = true) => {
  let inner;
  if (prompt) {
    inner =
      `<div class="alert info">${iconSvg("monitor-smartphone")}<span>Installing keeps your offline data safe: the ` +
      `browser stops treating it as something it can delete.</span></div>` +
      `<p class="small muted" style="margin:0">The app already asked this browser to keep your data, and it ` +
      `said no — browsers don’t ask you, they decide, and installing is what changes their mind.</p>` +
      `<button class="btn primary lg block">${iconSvg("download", "sm")}Install</button>`;
  } else {
    const steps = [
      `Tap Share ${iconSvg("share", "sm")}`,
      "Choose “Add to Home Screen”",
      "Confirm with “Add”",
    ]
      .map((t) => `<li>${t}</li>`)
      .join("");
    inner =
      `<div class="alert info">${iconSvg("monitor-smartphone")}<span>Installing keeps your offline data safe: the ` +
      `browser stops treating it as something it can delete.</span></div>` +
      `<ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${steps}</ol>` +
      `<p class="xs muted" style="margin:0">The app already asked this browser to keep your data and it said no; ` +
      "installing is what changes that. Some browsers don’t offer installing at all — if yours doesn’t, keep a " +
      "connection when you record and nothing will be waiting here.</p>";
  }
  return screen(settingsBodyDim(), {
    tab: "",
    side: "ajustes",
    title: "Settings",
    narrow: true,
    sheet: sheetWrap(inner, "Install this app"),
  });
};

const accountsBodyDim = () =>
  '<div class="skeleton" style="height:96px"></div><div class="acct-grid">' +
  ACCOUNTS.slice(0, 2)
    .map(([n, t, c, bal, d, ng]) => accountCard(n, t, c, bal, d, ng))
    .join("") +
  '</div><div class="skeleton" style="height:120px"></div>';

const accountRestoreSheet = () => {
  const inner = `<div class="alert warning">${iconSvg("triangle-alert")}<span>An active account is already named “Cash”. Choose another name to restore this one.</span></div>
${field("New name", "Cash (old)", null, { cls: "focus" })}
<button class="btn primary lg block">${iconSvg("archive-restore", "sm")}Restore as “Cash (old)”</button>`;
  return screen(accountsBodyDim(), {
    tab: "cuentas",
    side: "cuentas",
    title: "Accounts",
    sheet: sheetWrap(inner, "That name is taken"),
  });
};

const projected = () => {
  const tip =
    '<span class="tooltip show">' +
    iconSvg("cloud-off") +
    '<span class="tip">Includes changes not yet synced</span></span>';
  const mark = '<span class="tooltip">' + iconSvg("cloud-off") + "</span>";
  const body = `<div class="card color-INDIGO stack-sm" style="background:linear-gradient(135deg,var(--brand-soft),var(--surface) 70%)"><span class="eyebrow">September spending</span>
<span class="projected"><span class="amount-hero">${money(1296800)}</span>${tip}</span>
<span class="small muted">of ${money(2000000)} · <span class="projected center">${money(703200)} left${mark}</span></span>
<span class="projected center" style="display:flex"><span class="progress warn" style="flex:1"><span class="fill" style="width:65%"></span>${paceMark()}</span>${mark}</span></div>
<div class="stats" style="grid-template-columns:1fr 1fr;gap:10px"><div class="card stat"><span class="k">Total balance</span><span class="projected"><span class="v amount">${money(13738000)}</span>${mark}</span></div><div class="card stat"><span class="k">Income</span><span class="v amount income">${money(4200000, "+")}</span></div></div>
<div class="list card flush">${row("coffee", "BROWN", "Pergamino Coffee", "7:55 · Cash · Saved on this device", 9800, "expense", { badges: '<span class="badge warning">' + iconSvg("cloud-off") + "Pending sync</span>" })}${row("briefcase", "GREEN", "August salary", "Yesterday · Bancolombia", 4200000, "income")}</div>
<p class="xs faint" style="margin:0">Every amount or bar that already includes a write the server has not confirmed carries the amber mark; hover or focus it to read why. The row badge says the same for a single movement.</p>`;
  const banner = `<div class="banner offline" role="status">${iconSvg("cloud-off")}<span class="txt"><b>Changes waiting to sync.</b> They are saved on this device.<span class="sub">1 change waiting</span></span></div>`;
  return screen(body, { tab: "inicio", side: "inicio", title: "Home", banner });
};

// F-03 · the three ways of choosing among the 9 account types, inside the real form.
const accountTypeVariant = (v, sheet = false) => {
  const chip = (k, sel = false) =>
    `<button class="chip${sel ? " selected" : ""}">${iconSvg(ACCT_TYPE_ICON[k], "sm")}${ACCT_TYPE_LABEL[k]}</button>`;
  let selector;
  if (v === 1) {
    selector =
      `<div style="position:relative"><div class="chips">${Object.keys(ACCT_TYPE_ICON)
        .map((k) => chip(k, k == "CASH"))
        .join("")}</div>` +
      `<span aria-hidden="true" style="position:absolute;right:0;top:0;bottom:2px;width:36px;background:linear-gradient(90deg,transparent,var(--bg))"></span></div>` +
      `<span class="help">Swipe to see the other types.</span>`;
  } else if (v === 2) {
    selector =
      `<div class="chips">${["CASH", "ACCOUNT", "DEBIT_CARD", "CARD", "SAVINGS"].map((k) => chip(k, k == "CASH")).join("")}` +
      `<button class="chip">${iconSvg("ellipsis", "sm")}More</button></div>`;
  } else {
    selector = accountTypePicker();
  }
  const body = `${field("Name", "Cash")}
<div class="field"><span class="label">Type</span>${selector}</div>
<div class="field"><span class="label">Color</span>${swatches("GRAY")}</div>
<div class="card hstack color-GRAY" style="gap:12px">${tile("banknote", "GRAY")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span style="font-weight:500">Cash</span><span class="small faint">Cash · preview</span></span><span class="amount-lg amount">${money(184000)}</span></div>
<button class="btn primary lg block">Create account</button>`;
  const sh = sheet ? accountTypeSheet() : "";
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: "New account",
    narrow: true,
    sheet: sh,
  });
};

// F-08 · the mark with only a tooltip, or with a legend line underneath.
const paceVariant = (legend = false) => {
  const leg = legend
    ? '<p class="xs faint" style="margin:0">The mark is today’s pace: 73% of the period has passed (day 22 of 30).</p>'
    : "";
  return `<div class="app" style="padding:20px;border-radius:14px;display:flex;flex-direction:column;gap:14px;width:100%">
<div class="card color-PINK stack-sm" style="gap:10px"><div class="hstack" style="gap:12px">${tile("shopping-bag", "PINK")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span style="font-weight:500">Lifestyle</span><span class="small faint">Monthly · Sep 1–30</span></span></div>
<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="amount-lg amount">${money(216000)}</span><span class="small muted amount">of ${money(300000)}</span></div>
<div class="progress color-PINK" style="height:8px"><span class="fill" style="width:72%"></span>${paceMark(73, "Day 22 of 30 · 73% expected", true)}</div>${leg}
<span class="small muted amount"><b>${money(84000)}</b> left <span class="faint">· 8 days</span></span></div></div>`;
};

const variants = () => {
  const grid = (items) =>
    `<div class="pv-grid">${items.map(([f, l]) => device(f, l)).join("")}</div>`;
  const plain = (items) =>
    `<div class="pv-grid">${items.map(([f, l]) => `<div class=pv-item><div class=pv-title>${l}</div>${f}</div>`).join("")}</div>`;
  const inner = `<div class="pv-stage">
<div class="pv-note"><b>Variaciones para decisión.</b> Alternativas de un mismo componente puestas una al lado de otra para que el dueño elija.
Lo elegido pasa a <code>DESIGN.md</code> y solo entonces se implementa; lo descartado se queda aquí, que para eso existe la pestaña:
dentro de tres meses explica por qué la app es como es. Esta pestaña se reutiliza cada vez que haya que decidir entre dos formas de hacer lo mismo.<br><br>
<b>Las tres de esta tanda están decididas (dueño, 2026-09-06): C, B y B.</b> Marcadas con ✓ abajo, y ya escritas en <code>DESIGN.md</code>.</div>

<div class="pv-note"><b>F-03 · Selector de tipo de cuenta (9 tipos).</b> La versión construida rompe los 9 chips en varias líneas
y ocupa media pantalla. Las tres alternativas ocupan <b>una sola línea</b>.<br>
<b>A · una línea con desplazamiento:</b> los 9 chips en una fila que se arrastra; se ven los primeros y el degradado avisa de que hay más.
Sin capas, pero en escritorio arrastrar con ratón es incómodo y los últimos tipos casi no se descubren.<br>
<b>B · cinco esenciales + «More»:</b> lo que ya hace el onboarding. Todo visible sin desplazar, pero los cuatro tipos raros quedan escondidos tras un botón y aparecen en una hoja distinta a la del resto del formulario.<br>
<b>C · fila que abre una hoja (ELEGIDA):</b> el mismo componente <i>picker</i> que ya usan cuenta y categoría en Registrar. Una línea siempre,
enseña el tipo elegido con su descripción, y la hoja tiene sitio para explicar los 9 («Overdraft: a negative balance you can use»),
que es justo lo que hoy nadie entiende. Escala si algún día hay 12 tipos. <b>Se usa igual en el formulario de cuenta y en el onboarding</b>, para no tener dos maneras de elegir lo mismo.</div>
${grid([
  [accountTypeVariant(1), "A · Una línea, desplazable"],
  [accountTypeVariant(2), "B · Cinco + «More»"],
  [accountTypeVariant(3), "✓ C · Fila con hoja (elegida)"],
  [accountTypeVariant(3, true), "✓ C · La hoja de los 9 tipos"],
])}

<div class="pv-note"><b>F-62 · El contador de la franja verde.</b> El texto <code>states.backOnline.synced</code> ya existe en los mensajes y hoy no se pinta.
<b>A</b> deja la franja como está: un «Back online.» de tres segundos.
<b>B</b> añade la segunda línea con lo que acaba de salir, que cierra el círculo de la franja ámbar («2 changes waiting» → «2 changes synced»)
y es la única confirmación de que la cola se vació. Regla que viaja con la decisión: con cero cambios drenados <b>no</b> se pinta la línea (nunca «0 changes synced»).
<b>ELEGIDA: B.</b></div>
${grid([
  [state("online-plain"), "A · Sin contador (lo construido)"],
  [state("online"), "✓ B · Con contador (elegida)"],
])}

<div class="pv-note"><b>F-08 · Qué marca la línea vertical de las barras.</b> En las dos, la marca se puede enfocar con el teclado y dice
«Day 22 of 30 · 73% expected» al pasar el ratón o al enfocarla. <b>A</b> se queda solo con eso. <b>B</b> añade una línea fija debajo en las
pantallas que tienen sitio (detalle de presupuesto), porque el tooltip no existe cuando se lee la pantalla con el dedo.
<b>ELEGIDA: B</b> — tooltip en todas partes, leyenda solo en el detalle; en Inicio y en la lista de presupuestos la línea no cabe sin ruido.</div>
${plain([
  [paceVariant(false), "A · Solo tooltip"],
  [paceVariant(true), "✓ B · Tooltip + leyenda en el detalle (elegida)"],
])}
</div>`;
  return docHead("Variaciones") + inner + DOC_FOOT;
};

const multi = (frames, note) =>
  page("", `<div class="pv-grid">${frames.map(([f, l]) => device(f, l)).join("")}</div>`, note);

const write = (name, html) => writeFileSync(new URL(name, OUT), html);

mkdirSync(OUT, { recursive: true });
write("index.html", indexPage());
write("00-fundamentos.html", foundations());
write(
  "01-inicio.html",
  multi(
    [
      [home(), "A · Inicio"],
      [home({ notice: true }), "B · Con el aviso de instalar y durabilidad (P-34)"],
    ],
    "<b>Inicio.</b> <b>Añadido el 2026-09-08 (P-34):</b> la lámina B lleva el aviso de instalar, que es el mismo aviso del almacenamiento persistente — aparece cuando el dispositivo ya tiene algo que perder y corre en pestaña de navegador, con «Install» donde el navegador lo ofrece y «How» donde no (iOS). El número protagonista es el gasto del mes (la app existe para ver el gasto hormiga), con barras por día y avance contra el presupuesto global. La franja ámbar es la bandeja de gastos rápidos sin detallar. En escritorio el mismo contenido se reparte en dos columnas.",
  ),
);
write(
  "02-registrar.html",
  page(
    "Registrar",
    `<div class="pv-grid">${device(home({ withSheet: true }), "A · Captura rápida (botón central)")}${device(transactionForm("EXPENSE"), "B · Formulario completo · gasto")}${device(transactionForm("TRANSFER"), "C · Formulario completo · transferencia")}${device(categoryPicker(), "D · Selector de categoría")}${device(accountPicker(), "E · Selector de cuenta")}${device(dateSheet(), "F · Fecha · calendario propio (F-05)")}${device(timeSheet(), "G · Hora · rueda propia (F-05)")}</div>`,
    "<b>Registrar.</b> El botón central abre la hoja de captura rápida: importe primero, categoría opcional en una fila de chips recientes, cuenta principal preseleccionada. <i>Guardar</i> crea el movimiento (rápido si falta categoría, marcado como pendiente de detallar). <i>Más detalles</i> lleva al formulario completo, que cubre gasto, ingreso, transferencia y ajuste con el mismo esqueleto. D y E son las hojas que abren los pickers de categoría (búsqueda, recientes y «nueva categoría» en línea) y de cuenta. Añadido el 2026-09-06 (F-05): la fecha y la hora dejan de abrir el calendario del navegador y usan hojas propias (F, G) con los tokens y el idioma de la app; el calendario deshabilita lo que el servidor rechazaría (más de 24 h en el futuro).",
  ),
);
write(
  "03-presupuestos.html",
  page(
    "Presupuestos",
    device(budgets()),
    "<b>Presupuestos.</b> Navegación por período de referencia (mes anterior/siguiente), filtro por tipo de período, el presupuesto global como tarjeta destacada y una tarjeta por presupuesto con avance, estado en lenguaje natural y avisos: monto ajustado este período, categoría archivada, ventana personalizada con fecha de fin.",
  ),
);
write(
  "04-acceso.html",
  multi(
    [
      [login(), "A · Login"],
      [login("429"), "B · Login · límite de intentos"],
      [register(), "C · Registro con moneda y zona horaria"],
      [register("reactivated"), "D · Registro · cuenta reactivada"],
      [onboarding(1), "E · Onboarding 1 · primera cuenta"],
      [onboarding(2), "F · Onboarding 2 · presupuesto mensual total"],
      [registerLanguage(), "G · Registro · elegir idioma (F-02)"],
    ],
    "<b>Acceso.</b> Login y registro centrados y cortos. El registro sugiere moneda y zona horaria detectadas y explica que la moneda se bloquea con la primera cuenta. Tras registrarse, dos pasos de onboarding: primera cuenta (será la principal) y presupuesto mensual total (global). El estado D aparece cuando el backend responde <code>reactivated: true</code>. Añadido el 2026-09-06 (F-02): el idioma se elige antes de tener cuenta —chip en la cabecera del marco y fila «Language» en el formulario, que son el mismo valor— y se envía como <code>locale</code> (G).",
  ),
);
write(
  "05-movimientos.html",
  multi(
    [
      [transactions(), "A · Lista con búsqueda y filtros"],
      [transactionDetail(), "B · Detalle de movimiento"],
      [reviewInbox(), "C · Bandeja de pendientes · Save all"],
      [filtersSheet(), "D · Hoja de filtros"],
      [
        transactionDetail({ conflict: true }),
        "E · Detalle con un cambio que el servidor no tomó (F-29)",
      ],
      [reviewInbox({ dropped: true }), "F · Bandeja · categoría descartada por el servidor (F-57)"],
      [reviewInbox({ confirm: true }), "G · Bandeja · confirmar Save all"],
      [state("mov-offline"), "H · Lista sin conexión y sin copia local"],
    ],
    "<b>Movimientos.</b> Ampliado el 2026-09-06: el detalle avisa cuando su fila tiene un cambio que el servidor no tomó y abre la hoja de conflicto (E); la bandeja «To review» guarda en lote con Save all (C, G) y explica cuando el servidor guardó un gasto sin su categoría (F); la lista sin conexión y sin copia local enseña un vacío honesto (H). Lista agrupada por día con total diario; chips de filtro (los filtros del API: tipo, cuenta, categoría, sin categoría, etiqueta, rango, pendientes) y un resumen del período. El detalle muestra todo lo que guarda el backend, incluido el origen. La bandeja permite detallar un gasto rápido en línea: categoría por chips, descripción y «Listo» (PUT con <code>pendingDetails:false</code>). D es la hoja de filtros: período con presets y rango, tipo, cuenta, categoría, etiqueta, solo pendientes, solo entradas rápidas; el botón principal anticipa el número de resultados.",
  ),
);
write(
  "06-cuentas.html",
  multi(
    [
      [accounts(), "A · Lista"],
      [accountDetail(), "B · Detalle"],
      [accountDetail({ sheet: true }), "C · Ajustar saldo"],
      [accountForm(), "D · Nueva cuenta · nombre duplicado"],
      [accountRestoreSheet(), "E · Restaurar con otro nombre (409 al restaurar)"],
      [accountForm({ sheet: true }), "F · Tipo de cuenta · hoja con los 9 tipos (F-03)"],
    ],
    "<b>Cuentas.</b> Añadido el 2026-09-06: restaurar una cuenta cuyo nombre tomó otra pide un nombre nuevo en una hoja (E; el mismo componente sirve a categorías). Lista con balance total y deuda en tarjetas, archivadas plegadas. El detalle concentra las acciones: ajustar saldo (crea un ADJUSTMENT con el delta calculado), editar, hacer principal, archivar (bloqueado si es la principal, con explicación). El formulario muestra el error de nombre duplicado en línea (409) y el saldo inicial solo al crear. Añadido el 2026-09-06 (F-03, variante C elegida por el dueño): el tipo deja de ser una parrilla de 9 chips y pasa a una fila que abre una hoja donde cada tipo lleva una línea que lo explica (D, F); el onboarding usa el mismo selector.",
  ),
);
write(
  "07-categorias.html",
  multi(
    [
      [categories(), "A · Rejilla por tipo"],
      [categoryForm(), "B · Editar · tipo bloqueado con historial"],
      [categories({ offline: true }), "C · Sin conexión · restaurar predeterminadas necesita red"],
    ],
    "<b>Categorías.</b> Añadido el 2026-09-06: sin red, «restaurar predeterminadas» no se ofrece —el botón se oculta— y la alerta dice por qué (C, decisión del dueño). Rejilla por tipo con icono y color; archivadas plegadas; restaurar predeterminadas sin duplicar. El formulario tiene búsqueda de icono sobre el set curado, selector de color y vista previa. Con historial, el tipo queda bloqueado y se ofrece crear otra (CATEGORY_TYPE_LOCKED).",
  ),
);
write(
  "08-presupuesto-detalle.html",
  multi(
    [
      [budgetDetail(), "A · Detalle con ajuste de período"],
      [budgetForm(), "B · Nuevo presupuesto"],
      [pastBudgets(), "C · Terminados y archivados"],
      [budgetDetail({ archived: true }), "D · Presupuesto archivado · Restore"],
      [
        budgetDetail({ archived: true, conflict: true }),
        "E · Restaurar · otro presupuesto ocupa el período",
      ],
    ],
    "<b>Presupuesto.</b> Corregido el 2026-09-06: archivar ya no es definitivo — un presupuesto archivado se restaura desde su detalle o desde Past budgets (D), y si otro presupuesto activo ocupa el mismo período la hoja lo nombra y lleva a él (E). El detalle navega períodos con <code>?reference=</code>, muestra restante, ritmo y días, y separa el monto base del ajuste del período (fijar, «no aplica este mes» = 0, quitar). El formulario decide alcance (global o por categorías), período (los seis tipos, fechas solo en personalizado), monto, color y opciones avanzadas (vigencia, nota). Los presupuestos terminados o archivados no se restauran: se crean de nuevo.",
  ),
);
write(
  "09-estadisticas.html",
  multi(
    [
      [stats("cat"), "A · Por categoría"],
      [stats("day"), "B · Por día"],
      [stats("tag"), "C · Por etiqueta"],
    ],
    "<b>Estadísticas.</b> Añadido el 2026-09-06: cada tramo de la barra apilada nombra su categoría al pasar el ratón o enfocarlo (tooltip, A). Período navegable, tipo de flujo por chips (ajustes solo si se piden), tres agrupaciones del API. Por categoría: barra apilada + lista con porcentaje y drill-down a movimientos filtrados. Por día: serie con huecos rellenados a cero y el día más alto. Por etiqueta: aviso de doble conteo y gasto sin etiquetar.",
  ),
);
write(
  "10-ajustes.html",
  multi(
    [
      [settings(), "A · Ajustes"],
      [appearance(), "B · Apariencia"],
      [sessions(), "C · Sesiones activas"],
      [profileSecurity(), "D · Perfil y seguridad"],
      [deleteAccountScreen(), "E · Eliminar cuenta"],
      [languageSheet(), "F · Idioma"],
      [syncStatus(), "G · Sync status · en pestaña del navegador"],
      [syncStatus("installed"), "H · Sync status · app instalada"],
      [syncStatus("routes"), "I · Sync status · servidor sin lote (Sending mode)"],
      [syncStatus("resync"), "J · Sync status · confirmar Force full resync"],
      [syncStatus("offline"), "K · Sync status sin conexión"],
      [signOutSheet(), "L · Cerrar sesión con cambios sin enviar"],
      [settings({ offline: true }), "M · Ajustes sin conexión · Sign out deshabilitado"],
      [
        languageSheet({ offline: true }),
        "N · Hoja de idioma sin conexión (igual moneda, zona, perfil, eliminar cuenta)",
      ],
      [syncStatus("signedout"), "O · Sync status · sesión cerrada con red (F-41)"],
      [syncStatus("preparing"), "P · Sync status · preparando el dispositivo (F-54)"],
      [syncStatus("blocked"), "Q · Sync status · cola bloqueada por una actualización (F-65)"],
      [
        syncStatus("loading"),
        "R · Sync status · las tres filas mientras el espejo contesta (F-85)",
      ],
      [
        syncStatus("nosw"),
        "S · Sync status · sin service worker, «Offline ready · Not available» (F-85)",
      ],
      [syncStatus("localonly"), "T · Sync status · modo «solo este dispositivo» (P-32)"],
      [installSheet(true), "U · Hoja «Install this app» · el navegador ofrece instalar (F-87)"],
      [
        installSheet(false),
        "V · Hoja «Install this app» · pasos donde no lo ofrece, p. ej. iOS (F-87)",
      ],
    ],
    "<b>Ajustes.</b> <b>Añadido el 2026-09-08:</b> Sync status deja de enseñar valores falsos mientras no los sabe (R, F-85: esqueleto en «Sync cursor», «Last full sync» y «Offline ready» hasta que el espejo y la caché contesten) y dice <b>«Not available»</b> donde la app corre a propósito sin service worker (S); la fila <b>Persistent storage</b> explica por qué dice «Not granted» y lleva a la hoja de instalación en vez de ofrecer un botón que el navegador ignora (F-86, visible en todas las láminas); el modo <b>«solo este dispositivo»</b> de P-32 se ve en la fila Session (T); y la hoja <b>«Install this app»</b> tiene sus dos formas, el botón donde el navegador ofrece instalar (U) y los pasos donde no, como iOS (V, F-87). Ampliado el 2026-09-06: fila Sync status en Datos (con el conteo de la cola), Instalar app en About, Sign out deshabilitado sin red, la hoja «You have unsent changes» al salir con cola, y el aviso «Changing this needs a connection» en las hojas que escriben en el servidor (idioma, moneda, zona horaria, perfil, eliminar cuenta). G–K y O–Q es la pantalla Sync status; el 2026-09-06 gana tres filas fijas: <b>Session</b> (F-41: si la sesión murió, aquí se ve y se vuelve a entrar), <b>Offline ready</b> (F-54: si el dispositivo ya se puede usar sin red) y <b>Waiting to send</b> en su variante bloqueada por una actualización (F-65). Hub con perfil, preferencias (idioma con inglés por defecto y español, moneda bloqueada con motivo, zona horaria, apariencia, categorías), seguridad (credenciales con contraseña actual, sesiones por dispositivo) y datos (exportar/importar reservados). Eliminar cuenta explica que es reversible registrándose con el mismo correo.",
  ),
);
write(
  "11-estados.html",
  multi(
    [
      [state("vacio"), "A · Vacío"],
      [state("carga"), "B · Carga"],
      [state("error"), "C · Error del servidor · con referencia"],
      [state("sesion"), "D · Sesión expirada (bloqueante)"],
      [state("confirmar"), "E · Confirmación de archivo"],
      [state("offline"), "F · Sin conexión · franja fija + badge por movimiento + toast"],
      [state("online"), "G · Reconexión · Back online"],
      [
        state("syncfail"),
        "H · Cambios que necesitan al usuario · franja roja con Review y See all",
      ],
      [conflict("stale"), "I · Resolve sync conflict · cambiado en dos sitios"],
      [conflict("failed"), "I2 · Resolve sync conflict · rechazado por el servidor"],
      [conflict("archived"), "I3 · Resolve sync conflict · cuenta archivada en otro sitio (F-58)"],
      [conflict("noserver"), "I4 · Resolve sync conflict · el servidor no dijo qué tiene"],
      [conflict("empty"), "I5 · Resolve sync conflict · nada que resolver"],
      [syncInbox(), "J · Bandeja «Needs your attention» (/sync)"],
      [syncInbox("confirm"), "J2 · Bandeja · confirmar Discard all con cascada"],
      [syncInbox("empty"), "J3 · Bandeja vacía"],
      [state("pendiente"), "K · Con red y cambios esperando · franja ámbar"],
      [state("local"), "L · Modo local · sesión muerta con vault (hoja descartable)"],
      [projected(), "M · Cifras proyectadas · marca ámbar y tooltip"],
      [state("offline-doc"), "N · Documento offline de reserva (ruta nunca abierta)"],
      [state("sw-update"), "O · Nueva versión disponible"],
      [conflict("dup"), "I6 · Resolve sync conflict · el nombre está tomado (F-60)"],
      [conflict("future"), "I7 · Fix the date · fecha rechazada por el servidor (F-66)"],
      [syncInbox("dup"), "J4 · Bandeja · restaurar con otro nombre (F-60)"],
      [syncInbox("blocked"), "J5 · Bandeja · cambios bloqueados por una actualización (F-65)"],
      [state("signedout"), "P · Franja · sesión cerrada con red (F-41)"],
      [state("ready"), "Q · Aviso único «Ready to use offline» (F-54)"],
      [state("blocked"), "R · Franja · una actualización dejó la cola sin enviar (F-65)"],
      [threeExits(), "S · Volver sin sesión · las tres salidas (P-32)"],
      [deleteLocalCopy(), "S2 · Confirmar el borrado de la copia local (P-32)"],
      [state("localonly"), "S3 · Franja · «solo este dispositivo», el modo elegido (P-32)"],
      [home({ unnamed: true }), "T · Inicio sin nombre en la sesión ni en el espejo (F-82)"],
    ],
    "<b>Estados de sistema.</b> <b>Añadido el 2026-09-08:</b> las tres salidas de <b>P-32</b> cuando se vuelve sin sesión (S), la confirmación del borrado local (S2) y el séptimo estado de la franja, «solo este dispositivo» (S3), en tono neutro porque es una decisión del usuario y no un fallo; y el saludo cuando no hay nombre ni en la sesión ni en el espejo (T, F-82), que pierde la coma en vez de enseñarla vacía. Ampliado el 2026-09-06 con lo que la fase offline llevó al front (I–O): las cuatro franjas (ámbar sin red, ámbar con red y cola, verde al volver, roja con Review y See all), la hoja «Resolve sync conflict» en sus variantes, la bandeja «Needs your attention» (<code>/sync</code>), el modo local con sesión muerta, la marca ámbar de cifra proyectada con su tooltip, el documento offline de reserva y el aviso de nueva versión. Ampliado otra vez el 2026-09-06 con las fichas que esperaban diseño: la franja de <b>sesión cerrada con red</b> (P, F-41), el aviso único de <b>dispositivo listo para usar sin red</b> (Q, F-54), la franja de <b>cola bloqueada por una actualización</b> (R, F-65) con su sección en la bandeja (J5), <b>restaurar con otro nombre</b> cuando el servidor rechaza un restore por nombre duplicado (I6, J4, F-60) y <b>corregir la fecha</b> de un movimiento rechazado por <code>FUTURE_DATE</code> (I7, F-66), que antes solo se podía descartar. Cada lista tiene vacío con CTA, esqueleto de carga y error con reintento. La sesión expirada (REFRESH_REVOKED) se anuncia en una hoja que lleva al login. Archivar siempre confirma explicando qué se conserva. Sin conexión: franja ámbar pegada al borde superior de la columna de contenido, encima del encabezado y sin cubrir la barra lateral (el ámbar ya significa «incompleto» en la app), badge «Pending sync» en cada movimiento guardado localmente y toast «Saved on this device». Al reconectar la franja pasa a verde un instante; el rojo se reserva para cuando una sincronización falla de verdad.",
  ),
);
write(
  "12-publico.html",
  multi(
    [
      [landing(), "A · Landing (pública, indexable)"],
      [legal(), "B · Política de privacidad / Ley 1581"],
      [notFound(), "C · 404"],
    ],
    "<b>Superficie pública.</b> Lo único que los buscadores deben indexar: landing con propuesta de valor, tres beneficios, tres pasos y CTA; páginas legales (privacidad = política de tratamiento de datos, términos); 404 amable. Navegación pública sin barra lateral ni pestañas, selector de idioma visible y enlaces legales en el pie. La app autenticada lleva <code>noindex</code>.",
  ),
);
write("13-variaciones.html", variants());
console.log("preview generado:", PAGES.length, "páginas");
