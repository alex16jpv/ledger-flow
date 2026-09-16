// Builds design/preview/*.html. The HTML pages are the deliverable; this file is the tool that writes them.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = process.env.DESIGN_OUT
  ? pathToFileURL(`${resolve(process.env.DESIGN_OUT)}/`)
  : new URL("./preview/", import.meta.url);
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
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Ledger Flow design</title>
<link rel="stylesheet" href="${TOKENS}/palette.tinta.css"><link rel="stylesheet" href="${TOKENS}/palette.brisa.css">
<link rel="stylesheet" href="${TOKENS}/semantic.css"><link rel="stylesheet" href="${TOKENS}/base.css">
<link rel="stylesheet" href="assets/ui.css"><link rel="stylesheet" href="assets/shell.css">
<script defer src="assets/icons.js"></script><script defer src="assets/plates.js"></script><script defer src="assets/shell.js"></script></head><body>`;

const DOC_FOOT = "</body></html>";

const money = (v, sign = "") => `${sign}<span class="cur">$</span>${nf.format(Math.abs(v))}`;
const moneyText = (v, sign = "") => `${sign}$${nf.format(Math.abs(v))}`;

const amount = (v, kind = "expense", cls = "") => {
  const sign = { expense: "−", income: "+", transfer: "", adjustment: "±" }[kind];
  return `<span class="amount ${kind} ${cls}">${sign}${money(v)}</span>`;
};

const tile = (icon, color, size = "") =>
  `<span class="tile ${size} color-${color}">${iconSvg(icon)}</span>`;

const TAB_FOR = {
  inicio: ["house", "Home"],
  mov: ["list", "Transactions"],
  pres: ["chart-pie", "Budgets"],
  cuentas: ["wallet", "Accounts"],
  mas: ["ellipsis", "More"],
};

const tab = (key, active = false) => {
  const [icon, label] = TAB_FOR[key];
  const dot = key == "mov" ? "<i class=dot></i>" : "";
  return `<a class="tab${active ? " active" : ""}" href="#">${iconSvg(icon)}<span>${label}</span>${dot}</a>`;
};

const navBar = (keys, active) =>
  `<nav class="tabbar" aria-label="Navegación"${keys.length === 5 ? "" : ` style="grid-template-columns:repeat(${keys.length},1fr)"`}>
${keys
  .map((k) =>
    k === null
      ? `<div class="fab-slot"><button class="fab" aria-label="Add">${iconSvg("plus")}</button></div>`
      : tab(k, k === active),
  )
  .join("")}</nav>`;

// T-72 · the phone's bar ends in More; Accounts moved into the sheet it opens.
const tabbar = (active) => navBar(["inicio", "mov", null, "pres", "mas"], active);
const barBeforeMore = (active) => navBar(["inicio", "mov", null, "pres", "cuentas"], active);

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
<a class="navlink" href="#"><span class="avatar" style="width:28px;height:28px;font-size:11px">JD</span><span class="truncate">John Doe</span></a></div></aside>`;

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

// ── Charts ──────────────────────────────────────────────────────────────────
// One September 2026 for every chart, so a tooltip, a tile and a total on the same screen never disagree.
const SEP_SHAPE = [
  30, 55, 20, 65, 40, 0, 70, 45, 90, 35, 25, 50, 60, 0, 30, 75, 40, 55, 20, 45, 85, 38,
];
const SEP_DAYS = 30;
const TODAY = 22;
const scaleTo = (shape, total) => {
  const sum = shape.reduce((a, b) => a + b, 0);
  const out = shape.map((h) => Math.round((h * total) / sum / 100) * 100);
  const peak = out.indexOf(Math.max(...out));
  out[peak] -= out.reduce((a, b) => a + b, 0) - total;
  return out;
};
const SEP_SPEND = [...scaleTo(SEP_SHAPE, 1284300), ...range(TODAY, SEP_DAYS).map(() => 0)];
const SEP_TOTAL = SEP_SPEND.reduce((a, b) => a + b, 0);
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WD_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// 2026-09-01 falls on a Tuesday: index 1 of a week that starts on Monday.
const SEP_FIRST_WD = 1;
const sepWeekday = (day) => (SEP_FIRST_WD + day - 1) % 7;
const dayTip = (day, value) => `${WD[sepWeekday(day)]} ${day} Sep · ${moneyText(value)}`;

const readout = (left, right = "") =>
  `<div class="readout"><span>${left}</span>${right ? `<span class="v">${right}</span>` : ""}</div>`;

const axis = (...marks) =>
  `<div class="axis">${marks.map((m) => `<span>${m}</span>`).join("")}</div>`;

// F-90 · one slot is one control: it names what it is and what it cost, and opens it.
const pct = (value, top) => (top > 0 ? round((value / top) * 100) : 0);

// The bubble's width is unknown until it paints, so a slot this near an end aligns to it instead.
const EDGE = 0.15;
const tipAlign = (index, total) => {
  const place = index / Math.max(total - 1, 1);
  return place < EDGE ? " tip-start" : place > 1 - EDGE ? " tip-end" : "";
};

const chartSlot = (cls, label, inner, o = {}) =>
  o.interactive === false
    ? `<span class="${cls} tooltip${o.align ?? ""}${o.active ? " show" : ""}" aria-hidden="true">${inner}<span class="tip">${label}</span></span>`
    : `<button class="${cls} tooltip${o.align ?? ""}${o.active ? " show sel" : ""}" aria-label="${label}">${inner}<span class="tip">${label}</span></button>`;

const chartCard = (eyebrow, body, o = {}) =>
  `<div class="card chart"><div class="card-head" style="margin:0"><span class="eyebrow">${eyebrow}</span>${o.right ?? ""}</div>${body}</div>`;

const plot = (kind, height, label, inner, interactive = true) =>
  `<div class="plot ${kind}" style="height:${height}px" role="${interactive ? "group" : "img"}" aria-label="${label}">${inner}</div>`;

const barsChart = (values, o = {}) => {
  const {
    height = 140,
    today = -1,
    active = -1,
    label = "Spending per day",
    tip = dayTip,
    interactive = true,
  } = o;
  const until = o.until ?? values.length;
  const top = Math.max(0, ...values);
  const items = values
    .map((v, i) => {
      const day = i + 1;
      if (day > until)
        return `<span class="slot future" aria-hidden="true"><i style="height:1px"></i></span>`;
      const cls = [
        v === 0 ? "nil" : "",
        day === today ? "today" : "",
        v === top && top > 0 ? "hi" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const bar = `<i class="${cls}" style="height:${Math.max(pct(v, top), 2)}%"></i>`;
      return chartSlot("slot", tip(day, v), bar, {
        active: i === active,
        interactive,
        align: tipAlign(i, values.length),
      });
    })
    .join("");
  return plot("bars", height, label, items, interactive);
};

const gbars = (rows, o = {}) => {
  const { height = 120, active = -1, label = "Income and spending per month" } = o;
  const top = Math.max(0, ...rows.flatMap(([, inc, exp]) => [inc, exp]));
  const slots = rows
    .map(([name, inc, exp, partial], i) => {
      const txt = `${name} · ${moneyText(inc, "+")} in, ${moneyText(exp, "−")} out${partial ? ", in progress" : ""}`;
      const bars = `<i class="inc" style="height:${pct(inc, top)}%"></i><i class="exp" style="height:${pct(exp, top)}%"></i>`;
      return chartSlot(`slot${partial ? " partial" : ""}`, txt, bars, { active: i === active });
    })
    .join("");
  return plot("gbars", height, label, slots);
};

// One column chart: stacked segments, or a single bar with the limit as a dashed cap.
const stackCols = (cols, o = {}) => {
  const { height = 130, active = -1, label = "Spending per month" } = o;
  const totals = cols.map(([, parts]) => parts.reduce((a, [, v]) => a + v, 0));
  const caps = cols.map(([, , opts = {}]) => opts.cap ?? 0);
  const top = Math.max(0, ...totals, ...caps);
  const tip =
    o.tip ??
    ((name, total, i) =>
      `${name} · ${moneyText(total)}${cols[i][2]?.partial ? ", in progress" : ""}`);
  const items = cols
    .map(([name, parts, opts = {}], i) => {
      const cap = opts.cap ? `<span class="cap" style="bottom:${pct(opts.cap, top)}%"></span>` : "";
      const seg = parts
        .map(
          ([token, v]) =>
            `<i class="${token === "over" ? "over" : `color-${token}`}" style="height:${pct(v, top)}%"></i>`,
        )
        .join("");
      return chartSlot(`col${opts.partial ? " partial" : ""}`, tip(name, totals[i], i), cap + seg, {
        active: i === active,
      });
    })
    .join("");
  return plot("colbars", height, label, items);
};

const trend = (series, o = {}) => {
  const { height = 120, max: mx, marks = [], label = "Trend", active = -1, tip = "" } = o;
  const W = 300;
  const H = 100;
  const span = o.span ?? Math.max(...series.map((s) => s.points.length));
  const values = series.flatMap((s) => s.points).filter((v) => v !== null);
  const top = mx ?? Math.max(0, ...values, ...marks.map((m) => m.at));
  const at = (v, i) => [
    span > 1 ? round((i / (span - 1)) * W * 10) / 10 : W / 2,
    round((H - pct(v, top)) * 10) / 10,
  ];
  const path = (pts) => {
    let d = "";
    let drawing = false;
    pts.forEach((v, i) => {
      if (v === null) {
        drawing = false;
        return;
      }
      const [x, y] = at(v, i);
      d += `${drawing ? "L" : "M"}${x} ${y} `;
      drawing = true;
    });
    return d.trim();
  };
  const lines = series
    .map((s) => `<path class="line ${s.cls ?? ""}" d="${path(s.points)}"/>`)
    .join("");
  const dots = series
    .filter((s) => s.dot)
    .map((s) => {
      const last = s.points.reduce((acc, v, i) => (v === null ? acc : i), 0);
      const [x, y] = at(s.points[last], last);
      return `<circle class="dot ${s.cls ?? ""}" cx="${x}" cy="${y}" r="3.5"/>`;
    })
    .join("");
  const rules = marks
    .map(
      (m) =>
        `<path class="line ${m.cls ?? "limit"}" d="M0 ${round(H - pct(m.at, top))} L${W} ${round(H - pct(m.at, top))}"/>`,
    )
    .join("");
  const marker =
    active < 0
      ? ""
      : `<path class="line guide" d="M${at(0, active)[0]} 0 L${at(0, active)[0]} ${H}"/>` +
        series
          .filter((s) => s.points[active] !== null && s.points[active] !== undefined)
          .map((s) => {
            const [x, y] = at(s.points[active], active);
            return `<circle class="dot ${s.cls ?? ""}" cx="${x}" cy="${y}" r="3.5"/>`;
          })
          .join("");
  const svg = `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${height}px" role="img" aria-label="${label}">${rules}${lines}${marker}${dots}</svg>`;
  const bubble = active < 0 ? "" : `<span class="trend-tip" aria-hidden="true">${tip}</span>`;
  return `<span class="trend-wrap" style="height:${height}px">${bubble}${svg}<span class="reading" aria-hidden="true"></span></span>`;
};

const heatCal = (values, o = {}) => {
  const { today = TODAY, active = -1, label = "Spending calendar" } = o;
  const until = o.until ?? today;
  const top = Math.max(0, ...values);
  const level = (v) => {
    if (v === 0 || top === 0) return "";
    const share = v / top;
    if (share > 0.75) return " l4";
    if (share > 0.5) return " l3";
    if (share > 0.25) return " l2";
    return " l1";
  };
  const head = WD.map((d) => `<span>${d}</span>`).join("");
  const lead = range(0, SEP_FIRST_WD)
    .map(() => '<span class="d out"></span>')
    .join("");
  const cells = values
    .map((v, i) => {
      const day = i + 1;
      if (day > until) return `<span class="d future" aria-hidden="true">${day}</span>`;
      return chartSlot(
        `d${level(v)}${day === today ? " today" : ""}`,
        dayTip(day, v),
        String(day),
        {
          active: i === active,
        },
      );
    })
    .join("");
  return `<div class="heat-head" aria-hidden="true">${head}</div><div class="plot heat" role="group" aria-label="${label}">${lead}${cells}</div>`;
};

const heatScale = () =>
  `<div class="heat-scale" aria-hidden="true"><span>Less</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>More</span></div>`;

const weekdayAverages = () => {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  SEP_SPEND.slice(0, TODAY).forEach((v, i) => {
    const weekday = sepWeekday(i + 1);
    sums[weekday] += v;
    counts[weekday] += 1;
  });
  return sums.map((sum, i) => (counts[i] > 0 ? round(sum / counts[i]) : 0));
};

const home = ({
  unnamed = false,
  notice = "",
  chart = false,
  nav = null,
  sheet = "",
  statsLink = false,
} = {}) => {
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
  const heroPace = chart
    ? `<p class="small muted" style="margin:6px 0 14px">Daily average <b class="amount">${money(round(SEP_TOTAL / TODAY))}</b> · <span class="faint">Yesterday you spent ${money(SEP_SPEND[TODAY - 2])}</span></p>`
    : `<p class="small muted" style="margin:6px 0 14px">Daily average <b class="amount">${money(42800)}</b> · <span class="faint">Yesterday you spent $38,500</span></p>`;
  const heroChart = chart
    ? `<div class="chart">${barsChart(SEP_SPEND, { height: 56, today: TODAY, until: TODAY, active: 8 })}${readout(`${WD_LONG[sepWeekday(9)]} 9 September`, money(SEP_SPEND[8]))}</div>`
    : `<div class="bars" aria-label="Spending per day">${bars}</div>`;
  const hero = `<section class="card">
<div class="card-head"><span class="eyebrow">September spending</span><span class="badge outline">${iconSvg("calendar")}Day 22 of 30</span></div>
<div class="amount-hero">${money(1284300)}</div>
${heroPace}
${heroChart}
<div class="hstack" style="margin-top:14px;gap:12px">
<div class="progress color-INDIGO" style="flex:1"><span class="fill" style="width:64%"></span>${paceMark()}</div>
<span class="small muted" style="white-space:nowrap">64% of monthly budget</span></div>
</section>`;
  const pend = `<a class="alert warning" href="#" style="align-items:center">${iconSvg("inbox")}<span style="flex:1"><b>3 quick expenses to review</b> · $47,900 in total</span>${iconSvg("chevron-right", "sm")}</a>`;
  const installRisk =
    notice === "risk"
      ? `<span class="small muted">This browser can also delete what you record offline after a few days without opening the site. Installing the app stops that.</span>`
      : "";
  const installCard = notice
    ? `<section class="card hstack" style="gap:12px;align-items:flex-start">${tile("monitor-smartphone", "AMBER")}
<span class="body" style="flex:1;display:flex;flex-direction:column;gap:6px">
<span class="h3">For when there's no connection</span>
<span class="small muted">Ledger Flow already keeps a copy on this device, so it works with no signal. Installed, it opens on its own, outside the browser.</span>
${installRisk}
<span class="hstack" style="gap:8px;margin-top:4px"><button class="btn primary sm">${iconSvg("download", "sm")}Install</button><button class="btn secondary sm">How</button><button class="btn ghost sm">Not now</button></span>
</span></section>`
    : "";
  const statsHead = statsLink
    ? '<div class="section-head mobile-only"><h3 class="h3">Stats</h3><a class="link" href="#">See all</a></div>'
    : "";
  const stats = `${statsHead}<section class="stats">
<div class="card stat"><span class="k">Total balance</span><span class="v amount">${money(11258600)}</span><span class="d faint">4 accounts</span></div>
<div class="card stat"><span class="k">Income this month</span><span class="v amount income">${money(4200000, "+")}</span><span class="d up">${iconSvg("trending-up", "sm")}Same as August</span></div>
<div class="card stat wide-only"><span class="k">Estimated savings</span><span class="v amount">${money(2915700)}</span><span class="d faint">Income − spending</span></div>
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
  const greet = unnamed ? "Hi" : "Hi, John";
  const av = unnamed
    ? `<a class="avatar" href="#" aria-label="Settings">${iconSvg("user", "sm")}</a>`
    : '<a class="avatar" href="#" aria-label="Settings">JD</a>';
  const header = `<header class="page-header"><div class="title"><span class="eyebrow">Tuesday, September 22</span><h1 class="h1">${greet}</h1></div>
<div class="actions"><button class="btn ghost icon-only round desktop-only" aria-label="Search">${iconSvg("search")}</button>${av}</div></header>`;
  const mobile = `${header}${pend}${installCard}${hero}${stats}${budgetsSection}${accountsSection}${recent}`;
  const desk = `${header}${pend}${installCard}<div class="grid-main"><div class="stack" style="gap:20px">${hero}${stats}${recent}</div><div class="stack" style="gap:20px">${budgetsSection}${accountsSection}</div></div>`;
  return `<div class="shell">${sidebar("inicio")}<main class="main">
<div class="page mobile-only">${mobile}</div><div class="page desktop-only">${desk}</div>
</main>${nav ?? tabbar("inicio")}</div>${sheet}`;
};

const quickPicker = (label, value, icon, color) =>
  `<button class="picker">${tile(icon, color, "sm")}<span class="body"><span class="lbl">${label}</span><span class="val">${value}</span></span>${iconSvg("chevron-down", "sm")}</button>`;

const QUICK_NOTE = `<div class="input"><span class="placeholder" style="flex:1">Quick note (optional)</span>${iconSvg("notebook-pen", "sm")}</div>`;
const QUICK_BUTTONS = `<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">More details</button><button class="btn primary lg" style="flex:1.4">Save</button></div>`;

// The one quick sheet every quick-add plate is drawn from: T-73 adds `type`, T-75 changes `handle`.
const quickSheet = ({ handle = "plain", type = null, head = null, extra = "", over = "" } = {}) => {
  const title = "Add";
  const bar = {
    plain: '<div class="handle"></div>',
    none: "",
    wide: '<button class="handle" aria-label="Open the full form" style="border:0;cursor:grab;display:block;width:44px"></button>',
    grab: '<button class="handle" aria-label="Close" style="border:0;cursor:grab;display:block"></button>',
  }[handle];
  const seg =
    type === null
      ? ""
      : `<div class="segment">${[
          ["expense", "Expense", ""],
          ["income", "Income", "income"],
          ["transfer", "Transfer", "transfer"],
        ]
          .map(
            ([k, label, cls]) =>
              `<button aria-pressed="${String(k === type)}" class="${cls}">${label}</button>`,
          )
          .join("")}</div>`;
  const tint = { income: " amount income", transfer: " amount transfer" }[type] ?? "";
  const amount = `<div class="amount-input"><span class="cur">$</span><span class="num${tint}">12,500</span><span class="caret"></span></div>`;
  const chips =
    type === "income"
      ? `${catChip("Salary", true)}${catChip("Business")}${catChip("Other income")}`
      : `${catChip("Food", true)}${catChip("Coffee")}${catChip("Transport")}${catChip("Lifestyle")}${catChip("Bills")}`;
  const cats =
    type === "transfer"
      ? ""
      : `<div class="stack-sm"><span class="label">Category <span class="opt">optional · you can add it later</span></span>
<div class="chips">${chips}<button class="chip">${iconSvg("ellipsis", "sm")}More</button></div></div>`;
  const accounts =
    type === "transfer"
      ? `<div class="stack-sm">${quickPicker("From", "Bancolombia · $3,420,500", "landmark", "BLUE")}
<div style="display:flex;justify-content:center;margin:-4px 0"><button class="btn secondary icon-only sm round" aria-label="Swap">${iconSvg("arrow-left-right", "sm")}</button></div>
${quickPicker("To", "Savings · $8,900,000", "piggy-bank", "GREEN")}</div>`
      : quickPicker(
          type === "income" ? "Into your main account" : "From your main account",
          "Bancolombia · $3,420,500",
          "landmark",
          "BLUE",
        );
  const sheetHead =
    head ??
    `<div class="sheet-head"><span class="h3">${title}</span><button class="btn ghost icon-only sm round" aria-label="Close">${iconSvg("x", "sm")}</button></div>`;
  return `<div class="scrim"><div class="sheet" role="dialog" aria-label="${title}">
${bar}${sheetHead}${seg}${amount}${cats}${accounts}${QUICK_NOTE}${extra}${QUICK_BUTTONS}
</div>${over}</div>`;
};

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

const budgets = (v = {}) => {
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
  const period = (
    sel = "All",
  ) => `<div class="period-nav"><button class="btn ghost icon-only round" aria-label="Previous month">${iconSvg("chevron-left")}</button><span class="label">September 2026</span><button class="btn ghost icon-only round" aria-label="Next month" disabled>${iconSvg("chevron-right")}</button></div>
<div class="chips">${["All", "Weekly", "Biweekly", "Monthly", "Quarterly", "Yearly", "Custom"].map((c) => `<button class="chip${c === sel ? " selected" : ""}">${c}</button>`).join("")}</div>`;
  const footnote = `<div class="empty" style="padding:24px 16px 8px"><span class="small faint">Balance adjustments and transfers never count toward a budget.</span></div>`;
  const shell = (body, sheet = "") =>
    `<div class="shell">${sidebar("pres")}<main class="main"><div class="page">
${body}
</div></main>${tabbar("pres")}</div>${sheet}`;
  const cta = (kind) =>
    `<${kind === "link" ? 'a class="btn primary" href="#"' : 'button class="btn primary"'} style="margin-top:8px">Create a ${v.filter.toLowerCase()} budget</${kind === "link" ? "a" : "button"}>`;
  if (v.empty)
    return shell(
      `${header}${period(v.filter)}
<div class="empty" style="padding-top:56px">${tile("chart-pie", "NONE", "lg")}<span class="h3">Put a ceiling on your small spending</span><p class="small muted" style="margin:0;max-width:280px">${v.filter === "Custom" ? "A custom budget runs between the two dates you pick." : `A total ${v.filter.toLowerCase()} budget shows how much is left before the ${v.span} ends.`}</p>${cta(v.filter === "Custom" ? "link" : "button")}</div>`,
      v.sheet
        ? sheetWrap(
            `<div class="card color-INDIGO" style="background:linear-gradient(135deg,var(--brand-soft),var(--surface) 70%)"><div class="amount-input" style="padding:12px 0"><span class="cur">$</span><span class="num">450,000</span><span class="caret"></span></div>
<span class="xs faint" style="text-align:center">Scaled from last month’s spending</span>
<div class="chips" style="justify-content:center">${["$350,000", "$450,000", "$700,000"].map((v) => `<button class="chip">${v}</button>`).join("")}</div></div>
<div class="alert neutral">${iconSvg("sparkles")}<span>You can adjust it in any period without touching the base amount, and add per-category budgets whenever you like.</span></div>
<button class="btn primary lg block">Create budget</button><button class="btn ghost block">Cancel</button>`,
            `A ceiling for the ${v.span}`,
          )
        : "",
    );
  if (v.noneFor)
    return shell(
      `${header}${period(v.filter)}
<div class="empty" style="padding:32px 16px 8px"><span class="small faint">No ${v.filter.toLowerCase()} budgets this month</span>${cta("button")}</div>${footnote}`,
    );
  return shell(`${header}${period()}${glob}
<div class="grid-2">${cards}</div>
${footnote}`);
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

const ICONS_CAT = [
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

const foundationColors = () => {
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
  return `<div class="pv-grid" style="grid-template-columns:1fr">${block("light")}${block("dark")}</div>`;
};

const foundationTypography = () => {
  const typeScale = [
    ["h1 / 24 semibold", "h1", "Hi, John"],
    ["h2 / 17 semibold", "h2", "New transaction"],
    ["h3 / 15 semibold", "h3", "Budgets"],
    ["base / 14 regular", "", "Body copy and list rows."],
    ["small / 12", "small muted", "Metadata, dates, source account."],
    ["eyebrow / 11 caps", "eyebrow", "September spending"],
  ];
  return `<div class="app" style="padding:20px;border-radius:14px;display:grid;grid-template-columns:200px 1fr;gap:14px 24px;align-items:baseline;width:100%;max-width:1280px">
${typeScale.map(([l, c, t]) => `<span class="xs faint mono">${l}</span><span class="${c}">${t}</span>`).join("")}
<span class="xs faint mono">amount-hero / 40</span><span class="amount-hero">${money(1284300)}</span>
<span class="xs faint mono">amount-lg / 24</span><span class="amount-lg amount">${money(3420500)}</span>
<span class="xs faint mono">mono / 12</span><span class="mono muted">2026-09 · America/Bogota · COP</span></div>`;
};

const foundationIcons = () =>
  `<div class="app" style="padding:20px;border-radius:14px;width:100%;max-width:1280px;display:grid;grid-template-columns:repeat(auto-fill,40px);justify-content:space-between;gap:10px">
${ICONS_CAT.map((n, i) => `<span class="tile color-${COLOR_NAMES[i % 16]}" title="${n}">${iconSvg(n)}</span>`).join("")}</div>`;

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
    nav = null,
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
  return `<div class="shell">${sidebar(side)}<main class="main">${banner}<div class="page"${mw}>${header}${body}</div></main>${nav ?? tabbar(tabName)}</div>${sheet}`;
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
<div class="stack">${field("Email", "john@example.com", null, { icon: "user" })}${field("Password", "••••••••••", null, { icon: "lock", cls: "focus" })}</div>
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
<div class="stack">${field("Name", "John Doe", null, { icon: "user" })}${field("Email", "john@example.com", null, { icon: "user" })}${field("Password", null, "At least 8 characters", { icon: "lock", help: "Between 8 and 128 characters." })}
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
<div class="alert neutral">${iconSvg("sparkles")}<span>You can adjust it in any period without touching the base amount, and add per-category budgets whenever you like.</span></div>
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
  return `<a class="account-card color-${color}${archived ? " archived" : ""}" href="#"><div class="top">${tile(ACCT_TYPE_ICON[typ], color, "sm")}<span class="name truncate">${name}</span>${d}</div>
<div><div class="amount-lg amount">${neg ? "−" : ""}${money(bal)}</div><div class="type">${ACCT_TYPE_LABEL[typ]}</div></div></a>`;
};

const accounts = ({ actions = null, sheet = "", nav = null } = {}) => {
  const body = `<div class="card" style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap"><div class="stat"><span class="k">Total balance</span><span class="amount-hero" style="font-size:32px">${money(11258600)}</span><span class="small faint">4 active accounts · 1 archived</span></div><div class="stat" style="text-align:right;align-items:flex-end"><span class="k">Card debt</span><span class="amount-lg amount">${money(1245900, "−")}</span></div></div>
<div class="acct-grid">${ACCOUNTS.map((a) => accountCard(...a)).join("")}</div>
<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("archive")}<span style="font-weight:500">Archived</span><span class="badge">1</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="acct-grid">${accountCard("Nequi", "OTHER", "PINK", 0, false, false, true)}</div>`;
  return screen(body, {
    nav,
    tab: "cuentas",
    side: "cuentas",
    title: "Accounts",
    actions:
      actions ??
      `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New account</button><button class="btn secondary icon-only round mobile-only" aria-label="New account">${iconSvg("plus")}</button>`,
    sheet,
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

const BUD_LIMIT = 300000;
const BUD_BASE = 250000;
const BUD_SPENT = 356000;
const BUD_SPEND = [
  0,
  18000,
  0,
  19100,
  22000,
  0,
  26400,
  0,
  98000,
  0,
  12600,
  0,
  15000,
  0,
  16900,
  0,
  0,
  42000,
  0,
  0,
  48000,
  38000,
  ...range(TODAY, SEP_DAYS).map(() => 0),
];
const BUD_HISTORY = [
  ["April", 268000, BUD_BASE],
  ["May", 212000, BUD_BASE],
  ["June", 241000, BUD_BASE],
  ["July", 305000, BUD_BASE],
  ["August", 276000, BUD_BASE],
  ["September", BUD_SPENT, BUD_LIMIT, true],
];
const BUD_BIGGEST = [
  ["Zara", "shopping-bag", "PINK", "We 9 · Visa Gold", 98000],
  ["Falabella", "shopping-bag", "PINK", "Mo 21 · Visa Gold", 48000],
  ["Cine Colombia", "film", "PINK", "Fr 18 · Cash", 42000],
  ["Vinos y Licores", "wine", "PINK", "Tu 22 · Visa Gold", 38000],
  ["Spotify", "music", "PINK", "Tu 15 · Visa Gold", 16900],
];

const budgetDayCard = () =>
  chartCard(
    "Spending per day",
    `${barsChart(BUD_SPEND, { height: 120, today: TODAY, until: TODAY, active: 8, label: "Budget spending per day" })}
${axis("Sep 1", "15", "30")}
${readout(`${WD_LONG[sepWeekday(9)]} 9 September · 1 transaction`, money(BUD_SPEND[8]))}`,
  );

const budgetPaceCard = () => {
  let running = 0;
  const spent = [0, ...BUD_SPEND.slice(0, TODAY).map((v) => (running += v))];
  const cum = [...spent, ...range(TODAY + 1, SEP_DAYS + 1).map(() => null)];
  const pace = range(0, SEP_DAYS + 1).map((d) => round((BUD_LIMIT * d) / SEP_DAYS));
  const endsAt = round((BUD_SPENT / TODAY) * SEP_DAYS * 0.01) * 100;
  const projection = range(0, SEP_DAYS + 1).map((d) =>
    d < TODAY
      ? null
      : d === TODAY
        ? BUD_SPENT
        : round(((endsAt - BUD_SPENT) * (d - TODAY)) / (SEP_DAYS - TODAY)) + BUD_SPENT,
  );
  return chartCard(
    "Against the pace",
    `${trend(
      [
        { points: pace, cls: "pace" },
        { points: projection, cls: "projection" },
        { points: cum, cls: "over", dot: true },
      ],
      {
        height: 128,
        span: SEP_DAYS + 1,
        marks: [{ at: BUD_LIMIT }],
        label: "Spent so far against the period's pace, and where it ends at this rate",
        active: 12,
        tip: `Day 12 \u00b7 Spent ${money(cum[12])} \u00b7 Expected ${money(pace[12])}`,
        span: SEP_DAYS + 1,
      },
    )}
<div class="axis marked"><span style="left:0;transform:none">Sep 1</span><span style="left:${round((TODAY / SEP_DAYS) * 100)}%">today</span><span style="left:100%;transform:translateX(-100%)">Sep 30</span></div>
${readout(`Day 12 \u00b7 Spent ${money(cum[12])} \u00b7 Expected ${money(pace[12])}`)}
<p class="small muted" style="margin:0">At this rate you finish the period at <b class="amount">${money(endsAt)}</b> — <b class="amount" style="color:var(--danger)">${money(endsAt - BUD_LIMIT)}</b> over the limit.</p>
<span class="legend row"><span class="li"><i class="dot" style="background:var(--danger)"></i>Spent</span><span class="li"><i class="dot line"></i>Pace</span><span class="li"><i class="dot line" style="background:var(--danger);opacity:.55"></i>Where it ends</span><span class="li"><i class="dot line" style="background:var(--danger)"></i>Limit</span></span>`,
    { right: `<span class="badge danger">${iconSvg("trending-up")}Over</span>` },
  );
};

const budgetHistoryCard = () => {
  const complete = BUD_HISTORY.filter(([, , , partial]) => !partial);
  const over = complete.filter(([, v, lim]) => v > lim).length;
  return chartCard(
    "Last six periods",
    `${stackCols(
      BUD_HISTORY.map(([name, v, lim, partial]) => [
        name,
        [[v > lim ? "over" : "PINK", v]],
        { cap: lim, partial },
      ]),
      {
        height: 110,
        active: 5,
        label: "Spent against the limit, period by period",
        tip: (name, total, i) =>
          `${name} · ${moneyText(total)} of ${moneyText(BUD_HISTORY[i][2])}${BUD_HISTORY[i][3] ? ", in progress" : ""}`,
      },
    )}
${axis(...BUD_HISTORY.map(([n]) => n.slice(0, 3)))}
${readout(`${over} of the ${complete.length} finished periods went over. September already has.`)}`,
  );
};

// Only for a budget of several categories: its own spend is the whole of each one over the period.
const budgetCategoryCard = () => {
  const parts = [
    ["Lifestyle", "PINK", "shopping-bag", 356000, 6],
    ["Coffee", "BROWN", "coffee", 96700, 11],
  ];
  const total = parts.reduce((sum, [, , , v]) => sum + v, 0);
  const bar = parts.map(([, c, , v]) => `<i class="color-${c}" style="flex:${v}"></i>`).join("");
  const lis = parts
    .map(
      ([n, c, ic, v, k]) =>
        `<a class="row" href="#">${tile(ic, c)}<span class="body"><span class="title">${n}</span><span class="meta">${round((v / total) * 100)} % of the budget</span></span><span class="right">${amount(v)}<span class="sub">${k} txns</span></span></a>`,
    )
    .join("");
  return `<div class="app" style="padding:20px;border-radius:14px;display:flex;flex-direction:column;gap:14px;width:100%">
<div class="card stack-sm"><div class="card-head" style="margin:0"><h3 class="h3">Where it went</h3><span class="small muted amount">${money(total)} of ${money(500000)}</span></div><div class="stackbar" style="height:10px">${bar}</div></div>
<div class="list card flush">${lis}</div></div>`;
};

const budgetBiggestCard = () =>
  `<div class="section-head"><h3 class="h3">Biggest this period</h3><a class="link" href="#">See all</a></div>
<div class="list card flush">${BUD_BIGGEST.map(([n, ic, c, meta, v]) => row(ic, c, n, meta, v)).join("")}</div>`;

const chartEmptyBlock = (line) =>
  `<div class="empty" style="padding:18px 12px">${tile("chart-column", "NONE", "lg")}<span class="h3">Nothing spent yet this period</span><p class="small muted" style="margin:0;max-width:280px">${line}</p></div>`;

const budgetChartsEmpty = () =>
  `${chartCard("Spending per day", chartEmptyBlock("The days fill in as the money moves; a period with nothing in it is not thirty days of zero."))}
${chartCard("Against the pace", chartEmptyBlock("There is no curve until there is something to add up, and no end to project from."))}
${budgetHistoryCard()}
<div class="section-head"><h3 class="h3">Biggest this period</h3></div>
<div class="card">${chartEmptyBlock("Nothing has been spent against this budget yet.")}</div>`;

const budgetChartsLoading = () =>
  `<div class="card chart">${skel("height:10px;width:120px")}${skel("height:120px;margin-top:22px")}${skel("height:12px;width:60%")}</div>
<div class="card chart">${skel("height:10px;width:110px")}${skel("height:128px;margin-top:22px")}${skel("height:12px;width:70%")}${skel("height:12px;width:45%")}</div>
<div class="card chart">${skel("height:10px;width:118px")}${skel("height:110px;margin-top:22px")}${skel("height:12px;width:52%")}</div>
<div class="section-head"><h3 class="h3">Biggest this period</h3></div>
<div class="list card flush">${skelRows(3)}</div>`;

const budgetChartsError = () =>
  `${budgetDayCard()}
${budgetPaceCard()}
${chartCard("Last six periods", statsError("the previous periods"))}
${budgetBiggestCard()}`;

// Day 1 of the first period: no six columns to compare against, and one elapsed day projects nothing.
const budgetFirstPeriodCards = () => {
  const pace = range(0, SEP_DAYS + 1).map((d) => round((BUD_LIMIT * d) / SEP_DAYS));
  const spend = [0, 12400, ...range(2, SEP_DAYS).map(() => 0)];
  return `${chartCard(
    "Spending per day",
    `${barsChart(spend, { height: 120, today: 1, until: 1, active: 0, label: "Budget spending per day" })}
${axis("Sep 1", "15", "30")}
${readout(`${WD_LONG[sepWeekday(1)]} 1 September \u00b7 1 transaction`, money(12400))}`,
  )}
${chartCard(
  "Against the pace",
  `${trend(
    [
      { points: pace, cls: "pace" },
      { points: [0, 12400, ...range(2, SEP_DAYS + 1).map(() => null)], dot: true },
    ],
    {
      height: 128,
      span: SEP_DAYS + 1,
      marks: [{ at: BUD_LIMIT }],
      label: "Spent so far against the period's pace",
    },
  )}
<div class="axis marked"><span style="left:0;transform:none">Sep 1</span><span style="left:100%;transform:translateX(-100%)">Sep 30</span></div>
${readout(`Day 1 \u00b7 Spent ${money(12400)} \u00b7 Expected ${money(round(BUD_LIMIT / SEP_DAYS))}`)}
<p class="small muted" style="margin:0">It is day 1 of the period: one day of spending says nothing about where it ends.</p>
<span class="legend row"><span class="li"><i class="dot" style="background:var(--brand)"></i>Spent</span><span class="li"><i class="dot line"></i>Pace</span><span class="li"><i class="dot line" style="background:var(--danger)"></i>Limit</span></span>`,
)}
${budgetBiggestCard()}`;
};

const budgetDetail = ({ archived = false, conflict = false, charts = false, state = "" } = {}) => {
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
${chartsBlock(charts, state)}
<div class="section-head"><h3 class="h3">Transactions this period</h3><a class="link" href="#">See all</a></div>
<div class="list card flush">${row("wine", "PINK", "Vinos y Licores", "Tu 22 · Visa Gold", 38000)}${row("shopping-bag", "PINK", "Falabella", "Mo 21 · Visa Gold", 48000)}${row("film", "PINK", "Cine Colombia", "Fr 18 · Cash", 42000)}</div>
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

const chartsBlock = (charts, state) => {
  if (!charts) return "";
  if (state == "loading") return budgetChartsLoading();
  if (state == "empty") return budgetChartsEmpty();
  if (state == "cardError") return budgetChartsError();
  if (state == "first") return budgetFirstPeriodCards();
  return budgetDayCard() + budgetPaceCard() + budgetHistoryCard() + budgetBiggestCard();
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

const STATS_CATS = [
  ["Food", "ORANGE", 412000, 14],
  ["Lifestyle", "PINK", 356000, 6],
  ["Bills", "AMBER", 186200, 5],
  ["Transport", "BLUE", 185500, 9],
  ["Coffee", "BROWN", 96700, 11],
  ["Uncategorized", "NONE", 47900, 3],
];
const STATS_ACCOUNTS = [
  ["Visa Gold", "PURPLE", "credit-card", 612400, 27],
  ["Bancolombia", "BLUE", "landmark", 487900, 14],
  ["Cash", "GRAY", "banknote", 172100, 6],
  ["Nu (old card)", "GRAY", "credit-card", 8400, 1, { badge: "archived" }],
  ["No account", "NONE", "wallet", 3500, 1, { flat: true }],
];
const BIGGEST = [
  ["Zara", "shopping-bag", "PINK", "We 9 · Visa Gold", 98000],
  ["Falabella", "shopping-bag", "PINK", "Mo 21 · Visa Gold", 48000],
  ["Éxito", "shopping-cart", "ORANGE", "Mo 21 · Bancolombia", 44000],
  ["Cine Colombia", "film", "PINK", "Fr 18 · Cash", 42000],
  ["Vinos y Licores", "wine", "PINK", "Tu 22 · Visa Gold", 38000],
];
const MONTHS6 = [
  ["April", 4200000, 1980000],
  ["May", 4200000, 2240000],
  ["June", 4600000, 1680000],
  ["July", 4200000, 2110000],
  ["August", 4200000, 1855000],
  ["September", 4200000, SEP_TOTAL, true],
];
const CAT_MIX = [
  ["Food", "ORANGE", [34, 30, 32, 31, 33, 32]],
  ["Lifestyle", "PINK", [22, 28, 20, 26, 24, 28]],
  ["Bills", "AMBER", [16, 15, 18, 15, 16, 14]],
  ["Transport", "BLUE", [14, 13, 16, 14, 13, 14]],
  ["Coffee", "BROWN", [8, 8, 8, 8, 8, 8]],
  ["Other", "GRAY", [6, 6, 6, 6, 6, 4]],
];

const statTile = (k, v, d = "") =>
  `<div class="card stat"><span class="k">${k}</span><span class="v amount" style="font-size:16px">${v}</span>${d ? `<span class="d faint">${d}</span>` : ""}</div>`;

const weekdayCard = () => {
  const wk = weekdayAverages();
  const peak = wk.indexOf(Math.max(...wk));
  return `<div class="card chart"><span class="eyebrow">Average by weekday</span>
${barsChart(wk, { height: 64, active: peak, interactive: false, label: `Average spending per weekday: ${wk.map((v, i) => `${WD_LONG[i]} ${moneyText(v)}`).join(", ")}.`, tip: (i, v) => `${WD_LONG[i - 1]} · ${moneyText(v)} on average` })}
${axis(...WD)}
${readout(`${WD_LONG[peak]} is your most expensive day`, money(wk[peak]))}</div>`;
};

const biggestCard = (failed = false) =>
  `<div class="section-head"><h3 class="h3">Biggest this period</h3><a class="link" href="#">See all</a></div>
<div class="card${failed ? "" : " list flush"}">${failed ? statsError("the biggest movements") : BIGGEST.map(([n, ic, c, meta, v]) => row(ic, c, n, meta, v)).join("")}</div>`;

const trendsLink = () =>
  `<a class="card hstack" href="#" style="gap:12px;align-items:center;text-decoration:none;color:inherit">${tile("chart-line", "INDIGO")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span style="font-weight:500">Trends over time</span><span class="small faint">Income, savings and categories month by month</span></span>${iconSvg("chevron-right", "sm")}</a>`;

const skel = (style) => `<span class="skeleton" style="display:block;${style}"></span>`;

const skelRows = (n) =>
  range(0, n)
    .map(
      () =>
        '<div class="row" style="cursor:default"><span class="skeleton" style="width:40px;height:40px;border-radius:12px"></span><span class="body" style="gap:6px"><span class="skeleton" style="height:12px;width:55%"></span><span class="skeleton" style="height:10px;width:35%"></span></span><span class="skeleton" style="height:12px;width:64px"></span></div>',
    )
    .join("");

const skelTotal = () =>
  `<div class="card stack-sm">${skel("height:10px;width:96px")}${skel("height:34px;width:190px")}${skel("height:12px;width:220px")}</div>`;

const statsEmpty = (extra = "") =>
  `<div class="empty">${tile("chart-pie", "NONE", "lg")}<span class="h3">Nothing recorded in this period</span><p class="small muted" style="margin:0;max-width:280px">Try another month or another type of movement.</p>${extra}</div>`;

const statsError = (what = "this") =>
  `<div class="empty">${tile("circle-alert", "RED", "lg")}<span class="h3">We couldn’t load ${what}</span><p class="small muted" style="margin:0;max-width:280px">The server didn’t respond (503). Your data is safe; try again in a few seconds.</p><button class="btn secondary" style="margin-top:8px">${iconSvg("refresh-cw", "sm")}Retry</button><span class="xs faint mono">Reference: 8c1f4e2a-…-3b7d</span></div>`;

const statsControls = (view, o = {}) => {
  const selected = view === "cal" ? "day" : view;
  const seg = `<div class="segment">${[
    ["Categories", "cat"],
    ["Days", "day"],
    ["Accounts", "acct"],
    ["Tags", "tag"],
  ]
    .map(([t, k]) => `<button aria-pressed="${String(selected == k)}">${t}</button>`)
    .join("")}</div>`;
  const month = o.range
    ? `<button class="btn ghost" style="gap:6px"><span class="label">September 2026</span>${iconSvg("chevron-down", "sm")}</button>`
    : `<span class="label">September 2026</span>`;
  return `<div class="period-nav"><button class="btn ghost icon-only round">${iconSvg("chevron-left")}</button>${month}<button class="btn ghost icon-only round" disabled>${iconSvg("chevron-right")}</button></div>
<div class="chips"><button class="chip selected">Expenses</button><button class="chip">Income</button><button class="chip">Transfers</button><button class="chip">${iconSvg("scale", "sm")}Adjustments</button></div>${seg}`;
};

const statsTotalCard = (footer = "") =>
  `<div class="card"><span class="eyebrow">Total spent</span><div class="amount-hero" style="font-size:34px">${money(SEP_TOTAL)}</div><span class="small muted">48 transactions · average <b class="amount">${money(round(SEP_TOTAL / 48))}</b></span>${footer}</div>`;

const statsDayChartCard = (view) => {
  const toggle = `<div class="segment" style="flex:none;width:96px">${[
    ["chart-column", "day"],
    ["calendar-days", "cal"],
  ]
    .map(
      ([ic, k]) =>
        `<button aria-pressed="${String(view == k)}" aria-label="${k == "day" ? "Bars" : "Calendar"}">${iconSvg(ic, "sm")}</button>`,
    )
    .join("")}</div>`;
  const head = `<div class="card-head" style="margin:0"><span class="eyebrow">Per day</span>${toggle}</div>`;
  const body =
    view == "day"
      ? `${barsChart(SEP_SPEND, { height: 140, today: TODAY, until: TODAY, active: 8, label: "Per day" })}${axis("Sep 1", "15", "30")}`
      : `${heatCal(SEP_SPEND, { active: 8, label: "Per day" })}${heatScale()}`;
  return `<div class="card chart">${head}${body}
${readout(`${WD_LONG[sepWeekday(9)]} 9 September · 3 transactions`, money(SEP_SPEND[8]))}</div>`;
};

const statsDayTiles = () =>
  `<div class="stats" style="grid-template-columns:repeat(3,1fr)">${statTile("Priciest day", money(SEP_SPEND[8]), `${WD_LONG[sepWeekday(9)]} 9`)}${statTile("Daily average", money(round(SEP_TOTAL / TODAY)))}${statTile("No-spend days", "2", "of 22 so far")}</div>`;

const statsHighestDayCard = () =>
  `<div class="list card flush"><div class="day-head"><span>We 9 · highest</span><span class="amount">${money(SEP_SPEND[8], "−")}</span></div>${row("shopping-bag", "PINK", "Zara", "Visa Gold", 98000)}${row("car", "BLUE", "Uber", "Visa Gold", 11000)}${row("coffee", "BROWN", "Pergamino Coffee", "Cash", SEP_SPEND[8] - 109000)}</div>`;

const statsCategoryCards = () => {
  const bar = STATS_CATS.map(([, c, v]) => `<i class="color-${c}" style="flex:${v}"></i>`).join("");
  const lis = STATS_CATS.map(
    ([n, c, v, k]) =>
      `<a class="row" href="#">${tile(CATS[n][0], c)}<span class="body"><span class="title"><span class="truncate">${n}</span></span><span class="meta"><span class="progress thin color-${c}" style="width:120px"><span class="fill" style="width:${round((v / SEP_TOTAL) * 100)}%"></span></span>${round((v / SEP_TOTAL) * 100)} %</span></span><span class="right">${amount(v)}<span class="sub">${k} txns</span></span></a>`,
  ).join("");
  const tip =
    '<span class="tooltip show" style="position:absolute;left:14%;top:-4px"><span class="tip">Food</span></span>';
  return `<div class="card stack-sm" style="position:relative;overflow:visible">${tip}<div class="stackbar" style="height:12px">${bar}</div></div><div class="list card flush">${lis}</div>`;
};

const statsAccountCards = () => {
  const bar = STATS_ACCOUNTS.map(
    ([, c, , v]) => `<i class="color-${c}" style="flex:${v}"></i>`,
  ).join("");
  const lis = STATS_ACCOUNTS.map(([n, c, ic, v, k, o = {}]) => {
    const badge = o.badge ? `<span class="badge warning">${o.badge}</span>` : "";
    const body = `${tile(ic, c)}<span class="body"><span class="title"><span class="truncate">${n}</span>${badge}</span><span class="meta"><span class="progress thin color-${c}" style="width:120px"><span class="fill" style="width:${round((v / SEP_TOTAL) * 100)}%"></span></span>${round((v / SEP_TOTAL) * 100)} %</span></span><span class="right">${amount(v)}<span class="sub">${k} txns</span></span>`;
    // No filter can narrow "no account", so that row is a figure and not a way in.
    return o.flat
      ? `<div class="row" style="cursor:default">${body}</div>`
      : `<a class="row" href="#">${body}</a>`;
  }).join("");
  return `<div class="card stack-sm" style="position:relative;overflow:visible"><span class="tooltip show" style="position:absolute;left:22%;top:-4px"><span class="tip">Visa Gold</span></span><div class="stackbar" style="height:12px">${bar}</div></div>
<div class="list card flush">${lis}</div>
<p class="xs faint" style="margin:0">Transfers between your own accounts are not spending: they are counted under Transfers, never here.</p>`;
};

const STATS_TAGS = [
  ["groceries", 268000, 9],
  ["latte", 61300, 7],
  ["monthly", 55900, 4],
  ["work", 42400, 5],
];

const statsTagCards = () => {
  const lis = STATS_TAGS.map(
    ([t, v, n]) =>
      `<a class="row" href="#"><span class="tile"><span style="font-weight:600;color:var(--text-2)">#</span></span><span class="body"><span class="title">#${t}</span><span class="meta">${n} transactions</span></span><span class="right">${amount(v)}</span></a>`,
  ).join("");
  return `<div class="alert neutral">${iconSvg("info")}<span>A transaction with several tags counts in each of them, so tag totals can add up to more than the total. <b class="amount">${money(SEP_TOTAL - 361400)}</b> of spending has no tags.</span></div><div class="list card flush">${lis}</div>`;
};

const statsShell = (mobileBody, deskBody) =>
  `<div class="shell">${sidebar("stats")}<main class="main">
<div class="page mobile-only">${statsPageBody(mobileBody, statsHeaderActions(true))}</div><div class="page desktop-only">${statsPageBody(deskBody, statsHeaderActions(true))}</div>
</main>${tabbar("")}</div>`;

const stats = (view = "cat", { state = "" } = {}) => {
  const controls = statsControls(view);
  if (state == "loading") {
    const chart =
      view == "acct"
        ? `<div class="card" style="padding:12px">${skel("height:10px;border-radius:999px")}</div><div class="list card flush">${skelRows(3)}</div>`
        : `<div class="card chart">${skel("height:10px;width:120px")}${skel("height:140px;margin-top:22px")}${skel("height:12px;width:60%")}</div>
<div class="stats" style="grid-template-columns:repeat(3,1fr)">${skel("height:68px;border-radius:14px")}${skel("height:68px;border-radius:14px")}${skel("height:68px;border-radius:14px")}</div>`;
    const rest =
      view == "acct"
        ? ""
        : `<div class="card chart">${skel("height:10px;width:140px")}${skel("height:64px;margin-top:22px")}${skel("height:12px;width:55%")}</div>
<div class="list card flush">${skelRows(3)}</div>`;
    return statsShell(
      `${controls}
${skelTotal()}
${chart}${rest ? `\n${rest}` : ""}`,
      `${controls}
${skelTotal()}
${chart}${rest ? `\n${rest}` : ""}`,
    );
  }
  if (state == "empty") {
    const note =
      view == "acct"
        ? '<p class="xs faint" style="margin:6px 0 0;max-width:280px">Transfers between your own accounts are not spending, so a month of only transfers looks like this.</p>'
        : "";
    const body = `${controls}
<div class="card">${statsEmpty(note)}</div>
${statsOtherMonths()}`;
    return statsShell(body, body);
  }
  if (state == "error") {
    const body = `${controls}
<div class="card">${statsError()}</div>`;
    return statsShell(body, body);
  }
  const answer = statsAnswer(view);
  const followUps = statsFollowUps(view, state == "cardError");
  return statsShell(
    `${controls}
${statsTotalCard()}
${answer}
${followUps}
${statsOtherMonths()}`,
    `${controls}
<div class="grid-main"><div class="stack" style="gap:16px">${statsTotalCard()}
${answer}</div><div class="stack" style="gap:16px">${followUps}
${statsOtherMonths()}</div></div>`,
  );
};

const zoneHead = (label) =>
  `<div class="hstack" style="gap:10px;margin-top:6px"><h2 class="eyebrow" style="margin:0">${label}</h2><span class="divider" style="flex:1"></span></div>`;

const COMPLETE_MONTHS = MONTHS6.filter(([, , , partial]) => !partial);
const MONTH_AVG = round(
  COMPLETE_MONTHS.reduce((sum, [, , exp]) => sum + exp, 0) / COMPLETE_MONTHS.length,
);

const compareStrip = () => {
  const usual = round((MONTH_AVG * TODAY) / SEP_DAYS);
  const diff = round(((SEP_TOTAL - usual) / usual) * 100);
  const spark = stackCols(
    MONTHS6.map(([name, , exp, partial]) => [name, [["BLUE", exp]], { partial }]),
    { height: 30, label: "" },
  );
  return `<a href="#" class="hstack" style="gap:12px;margin-top:12px;padding:12px 0 2px;min-height:44px;border-top:1px solid var(--border);text-decoration:none;color:inherit">
<span aria-hidden="true" style="flex:none;width:72px">${spark}</span>
<span class="small" style="flex:1;color:var(--text-2)">Day ${TODAY} · <b>${Math.abs(diff)} % ${diff < 0 ? "below" : "above"}</b> your usual by now</span>
${iconSvg("chevron-right", "sm")}</a>`;
};

const statsAnswer = (view) => {
  if (view == "day" || view == "cal")
    return `${statsDayChartCard(view)}
${statsDayTiles()}`;
  if (view == "acct") return statsAccountCards();
  if (view == "tag") return statsTagCards();
  return statsCategoryCards();
};

const statsFollowUps = (view, failed = false) =>
  `${zoneHead("More about this month")}
${biggestCard(failed)}${view == "day" || view == "cal" ? `\n${weekdayCard()}\n${statsHighestDayCard()}` : ""}`;

const statsOtherMonths = () => `${zoneHead("Other months")}
${trendsLink()}`;

const statsHeaderActions = (trendsButton) =>
  `${trendsButton ? `<a class="btn ghost" href="#">${iconSvg("chart-line", "sm")}Trends</a>` : ""}<button class="btn ghost icon-only round" aria-label="Export" disabled>${iconSvg("download")}</button>`;

const statsPageBody = (body, actions) =>
  `<header class="page-header"><div class="title"><h1 class="h1">Stats</h1></div><div class="actions">${actions}</div></header>${body}`;

const rangeSheet = () => {
  const opt = (name, sub, sel) =>
    `<button class="row" style="border-top:1px solid var(--border)"><span class="body"><span class="title">${name}</span><span class="meta">${sub}</span></span><span class="right" style="flex-direction:row">${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  const inner = `<div class="list" style="margin:0 -16px">${opt("September 2026", "One month, the screen you are on", true)}${opt("Last 6 months", "Opens Trends", false)}${opt("Last 12 months", "Opens Trends", false)}</div>
<p class="small muted" style="margin:0">A range wider than a month is a different screen, and this is the door to it: the two are never mixed under one navigator.</p>`;
  return sheetWrap(inner, "Period");
};

const statsOrder = (kind, view = "day") => {
  const actions = statsHeaderActions(kind == "top");
  const otherMonths = statsOtherMonths();
  const body = [
    statsControls(view, { range: kind.startsWith("range") }),
    statsTotalCard(kind == "inline" ? compareStrip() : ""),
    statsAnswer(view),
    kind == "middle" ? otherMonths : "",
    statsFollowUps(view),
    kind == "inline" || kind == "middle" ? "" : otherMonths,
  ]
    .filter(Boolean)
    .join("\n");
  if (kind != "columns")
    return screen(body, {
      tab: "",
      side: "stats",
      title: "Stats",
      actions,
      sheet: kind == "range-open" ? rangeSheet() : "",
    });
  const desk = `${statsControls(view)}
<div class="grid-main"><div class="stack" style="gap:16px">${statsTotalCard()}
${statsAnswer(view)}</div><div class="stack" style="gap:16px">${statsFollowUps(view)}
${otherMonths}</div></div>`;
  return `<div class="shell">${sidebar("stats")}<main class="main">
<div class="page mobile-only">${statsPageBody(body, actions)}</div><div class="page desktop-only">${statsPageBody(desk, actions)}</div>
</main>${tabbar("")}</div>`;
};

const trends = ({ months = 6, state = "" } = {}) => {
  const MONTHS = MONTHS6.slice(-months);
  const complete = MONTHS.filter(([, , , partial]) => !partial);
  const saved = complete.reduce((a, [, inc, exp]) => a + inc - exp, 0);
  const earned = complete.reduce((a, [, inc]) => a + inc, 0);
  const rate = round((saved / earned) * 100);
  const rows = MONTHS.map(([n, inc, exp, partial]) => [n, inc, exp, partial]);
  const augShape = [
    22, 40, 15, 0, 58, 30, 12, 66, 25, 18, 44, 0, 35, 52, 20, 28, 61, 14, 0, 38, 47, 26,
  ];
  let running = 0;
  const sepCum = SEP_SPEND.slice(0, TODAY).map((v) => (running += v));
  let augRunning = 0;
  const augCum = scaleTo(augShape, round((1855000 * TODAY) / 31)).map((v) => (augRunning += v));
  const diff = round(((sepCum[TODAY - 1] - augCum[TODAY - 1]) / augCum[TODAY - 1]) * 100);
  // Both curves start at the origin, like the app's: index n is the end of day n.
  const sepLine = [0, ...sepCum];
  const augLine = [0, ...augCum];
  const comparisonTip = (day, month = "Sep", previous = "Aug") => {
    const here = sepCum[day - 1];
    const there = augCum[day - 1];
    const change = there > 0 ? Math.round(((here - there) / there) * 100) : 0;
    const sign = change === 0 ? "" : ` \u00b7 ${change < 0 ? "\u2212" : "+"}${Math.abs(change)} %`;
    return `Day ${day} \u00b7 ${month} ${money(here)} \u00b7 ${previous} ${money(there)}${sign}`;
  };
  const offset = MONTHS6.length - MONTHS.length;
  const last = MONTHS.length - 1;
  const mix = MONTHS.map(([n, , exp, partial], i) => [
    n,
    CAT_MIX.map(([, c, pcts]) => [c, round((exp * pcts[i + offset]) / 100)]),
    { partial },
  ]);
  const short = months < 6;
  const frame = (body) =>
    screen(body, { tab: "", side: "stats", back: true, title: "Trends", narrow: true });
  if (state == "loading") {
    return frame(`<div class="segment"><button aria-pressed="true">Last 6 months</button><button>Last 12 months</button></div>
<div class="card chart">${skel("height:10px;width:150px")}${skel("height:128px;margin-top:22px")}${skel("height:12px;width:60%")}</div>
<div class="stats" style="grid-template-columns:repeat(2,1fr)">${skel("height:68px;border-radius:14px")}${skel("height:68px;border-radius:14px")}</div>
<div class="card chart">${skel("height:10px;width:170px")}${skel("height:120px;margin-top:22px")}${skel("height:12px;width:75%")}${skel("height:12px;width:45%")}</div>
<div class="card chart">${skel("height:10px;width:110px")}${skel("height:132px;margin-top:22px")}${skel("height:12px;width:85%")}</div>`);
  }
  if (state == "firstMonth") {
    return frame(`<div class="segment"><button aria-pressed="true">Last 6 months</button><button>Last 12 months</button></div>
<div class="alert neutral">${iconSvg("info")}<span>Only 1 month of this range has anything in it, so the chart starts where the data starts. No month in it has finished yet.</span></div>
<div class="card chart"><span class="eyebrow">Income and spending</span>
${gbars([["September", 4200000, 0, true]], { height: 128, active: 0 })}
${axis("Sep")}
${readout(`September · ${moneyText(4200000, "+")} in, ${moneyText(0, "−")} out, in progress`)}
<span class="legend row"><span class="li"><i class="dot inc"></i>Income</span><span class="li"><i class="dot exp"></i>Spending</span></span></div>
<div class="stats" style="grid-template-columns:repeat(2,1fr)">${statTile("Saved", "Not yet", "No month in this range has finished")}${statTile("Savings rate", "Not yet", "No month in this range has finished")}</div>
<div class="card chart"><span class="eyebrow">This month against last</span>
<div class="empty">${tile("chart-line", "NONE", "lg")}<span class="h3">Nothing spent in September</span><p class="small muted" style="margin:0;max-width:280px">There is nothing to compare until something is spent.</p></div></div>
<p class="xs faint" style="margin:0">A month is counted in your time zone, the same way every other figure in the app is.</p>`);
  }
  if (state == "empty") {
    return frame(
      `<div class="segment"><button aria-pressed="true">Last 6 months</button><button>Last 12 months</button></div>
<div class="card"><div class="empty">${tile("trending-up", "NONE", "lg")}<span class="h3">Not enough history yet</span><p class="small muted" style="margin:0;max-width:280px">Come back when you have a full month and this page will compare it with the ones before.</p></div></div>`,
    );
  }
  const body = `<div class="segment"><button aria-pressed="true">Last 6 months</button><button>Last 12 months</button></div>
${
  short
    ? `<div class="alert neutral">${iconSvg("info")}<span>Only ${months} months of this range has anything in it, so the chart starts where the data starts. Saved and Savings rate count the ${complete.length} that finished.</span></div>`
    : ""
}
<div class="card chart"><span class="eyebrow">Income and spending</span>
${gbars(rows, { height: 128, active: last })}
${axis(...MONTHS.map(([n]) => n.slice(0, 3)))}
${readout(`September · ${moneyText(4200000, "+")} in, ${moneyText(SEP_TOTAL, "−")} out, in progress`)}
<span class="legend row"><span class="li"><i class="dot inc"></i>Income</span><span class="li"><i class="dot exp"></i>Spending</span></span></div>
<div class="stats" style="grid-template-columns:repeat(2,1fr)">${statTile("Saved", money(saved), `${complete.length} complete months`)}${statTile("Savings rate", `${rate} %`, "of what came in")}</div>
${
  state == "finished"
    ? `<div class="card chart"><span class="eyebrow">August against July</span>
${trend(
  [
    { points: augLine, cls: "ghost" },
    { points: sepLine, dot: true },
  ],
  { height: 120, label: "Spending in August against the same days of July" },
)}
${axis("Day 1", "Day 31")}
${readout(comparisonTip(TODAY, "Aug", "Jul"))}
<p class="small muted" style="margin:0">You spent <b class="amount">${money(1855000)}</b> in August — <b>12 % less</b> than in July.</p>
<span class="legend row"><span class="li"><i class="dot exp"></i>August</span><span class="li"><i class="dot line"></i>July, same days</span></span></div>`
    : `<div class="card chart"><span class="eyebrow">This month against last</span>
${trend(
  [
    { points: augLine, cls: "ghost" },
    { points: sepLine, dot: true },
  ],
  {
    height: 120,
    label: "Spending in September against the same days of August",
    active: 12,
    tip: comparisonTip(12),
  },
)}
${axis("Day 1", "Day 22")}
${readout(comparisonTip(12))}
<p class="small muted" style="margin:0">You have spent <b class="amount">${money(sepCum[TODAY - 1])}</b> so far — <b>${Math.abs(diff)} % ${diff < 0 ? "less" : "more"}</b> than at this point in August.</p>
<span class="legend row"><span class="li"><i class="dot exp"></i>September</span><span class="li"><i class="dot line"></i>August, same days</span></span></div>`
}
${
  state == "cardError"
    ? `<div class="card">${statsError("where your money went")}</div>`
    : `<div class="card chart"><span class="eyebrow">Where it goes</span>
${stackCols(mix, { height: 132, active: last })}
${axis(...MONTHS.map(([n]) => n.slice(0, 3)))}
${readout("Food is the biggest of these months", money(round(SEP_TOTAL * 0.32 * MONTHS.length)))}
<span class="legend row">${CAT_MIX.map(([n, c]) => `<span class="li"><i class="dot color-${c}" style="background:var(--f)"></i>${n}</span>`).join("")}</span></div>`
}
<p class="xs faint" style="margin:0">A month is counted in your time zone, the same way every other figure in the app is.</p>`;
  return frame(body);
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
  const body = `<div class="card hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:17px">JD</span><span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">John Doe</span><span class="small muted">john@example.com</span><span class="xs faint">Last sign-in today 8:40</span></span>${iconSvg("chevron-right", "sm")}</div>
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
  const sess = (icon, name, activity, since, expires, current = false) => {
    const r = current
      ? '<span class="badge success">This device</span>'
      : `<button class="btn ghost sm icon-sm" style="color:var(--danger)">${iconSvg("log-out", "sm")}<span class="label">Sign out</span></button>`;
    const meta = `<span class="meta stack"><span>${activity}</span><span class="sep"></span><span class="meta">since ${since}<span class="sep"></span>expires ${expires}</span></span>`;
    return `<div class="row" style="cursor:default">${tile(icon, "NONE")}<span class="body"><span class="title">${name}</span>${meta}</span><span class="right" style="flex-direction:row">${r}</span></div>`;
  };
  const body = `<div class="alert neutral">${iconSvg("info")}<span>Each sign-in opens a session of up to 30 days. Signing out a session forces that device to sign in again.</span></div>
<div class="list card flush">${sess("smartphone", "Android · Chrome", "Active now", "Mar 12", "Oct 12", true)}${sess("laptop", "Windows · Edge", "2 hours ago", "Sep 18", "Oct 18", false)}${sess("smartphone", "iPhone · Safari", "12 days ago", "Aug 31", "Sep 30", false)}</div>
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
  const body = `${field("Name", "John Doe", null, { icon: "user" })}${field("Email", "john@example.com", null, { icon: "user", help: "Changing it signs out your other sessions." })}
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
  '<div class="card hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:17px">JD</span><span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">John Doe</span><span class="small muted">john@example.com</span></span></div><div class="skeleton" style="height:180px"></div><div class="skeleton" style="height:120px"></div>';

const deleteAccountScreen = () => {
  const inner = `<div class="alert danger">${iconSvg("triangle-alert")}<span><b>Your account will no longer be available.</b> Your data is kept: if you sign up again with <b>john@example.com</b> you get your full history back.</span></div>
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
  if (kind == "sin-guardar") {
    const inner = `${field("Amount", "$ 12,500")}
<div class="alert warning">${iconSvg("triangle-alert")}<span><b>Are you sure you want to leave?</b> What you have typed will be lost.</span></div>
<div class="hstack" style="gap:10px"><button class="btn primary lg" style="flex:1.2">Keep editing</button><button class="btn ghost lg" style="flex:1;color:var(--danger)">Leave</button></div>`;
    return screen(settingsBodyDim(), {
      tab: "",
      side: "cuentas",
      title: "Accounts",
      sheet: sheetWrap(inner, "Adjust balance"),
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
  const feats = `<section class="stack" style="gap:24px"><div class="stack-sm" style="text-align:center"><span class="eyebrow">Why Ledger Flow</span><h2 class="h1" style="font-size:28px">Built for the small stuff</h2>
<p class="muted" style="max-width:62ch;margin:8px auto 0">Ledger Flow is a free expense tracker and budget app for everyday personal finance. You log what you spend, it keeps your account balances right, and it shows you where your money goes &mdash; by category, by month, and against the ceiling you set.</p></div>
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
  const inner = `<div class="empty" style="padding-top:96px">${tile("search", "NONE", "lg")}<h1 class="h1">Page not found</h1><p class="muted" style="margin:0;max-width:360px">The address may be wrong or the page may have moved. Your money is where you left it.</p><div class="hstack" style="gap:10px;margin-top:8px"><a class="btn primary" href="#">Go to Home</a><a class="btn ghost" href="#">Back</a></div></div>`;
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
    last = statusRow(
      "refresh-cw",
      "Last updated",
      "The last time this copy caught up with the server",
      sk,
    );
    ready = statusRow(
      "cloud-check",
      "Offline ready",
      "Your data and the app’s screens are on this device",
      sk,
    );
  } else {
    cursor = statusRow("database", "Sync cursor", "Where the next pull starts from", "Set");
    last = statusRow(
      "refresh-cw",
      "Last updated",
      "The last time this copy caught up with the server",
      "Today 8:40",
    );
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
      `Tap Share ${iconSvg("upload", "sm")}`,
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

// F-91 · the day under the pointer: only a bubble, or a bubble and a line that a finger can read too.
const dayReadoutVariant = (line = false) => {
  const chart = `${barsChart(SEP_SPEND, { height: 96, today: TODAY, until: TODAY, active: 8 })}${axis("Sep 1", "15", "30")}`;
  const foot = line
    ? readout(`${WD_LONG[sepWeekday(9)]} 9 September · 3 transactions`, money(SEP_SPEND[8]))
    : "";
  return `<div class="app" style="padding:20px;border-radius:14px;display:flex;flex-direction:column;gap:14px;width:100%">
<div class="card chart"><div class="card-head" style="margin:0"><span class="eyebrow">September spending</span><span class="badge outline">${iconSvg("calendar")}Day 22 of 30</span></div>
<div class="amount-hero" style="font-size:30px">${money(SEP_TOTAL)}</div>${chart}${foot}</div></div>`;
};

// F-92 · three routes for a recurring expense, awaiting the owner's choice.
const recurringVariant = (kind) => {
  const detected = `<div class="card chart"><div class="card-head" style="margin:0"><span class="eyebrow">Looks like it repeats</span><span class="badge">${iconSvg("sparkles")}Found by the app</span></div>
<p class="small muted" style="margin:0">Seven charges came back every month for the last three months. Together they are <b class="amount">${money(486700)}</b> a month.</p>
<div class="list" style="margin:0 -16px">${row("music", "PINK", "Spotify", "Every month · around the 15th", 16900, "expense", { sub: "3 months" })}${row("zap", "AMBER", "Claro", "Every month · around the 3rd", 89000, "expense", { sub: "6 months" })}${row("house", "BROWN", "Rent share", "Every month · around the 16th", 74000, "expense", { sub: "9 months" })}</div>
<div class="alert warning" style="align-items:center">${iconSvg("triangle-alert")}<span style="flex:1"><b>Netflix has not arrived this month.</b> It usually lands around the 8th.</span></div></div>`;
  const declared = `<div class="card stack-sm"><div class="card-head" style="margin:0"><h3 class="h3">Recurring</h3><button class="btn secondary sm">${iconSvg("plus", "sm")}New</button></div>
<p class="small muted" style="margin:0">Four you set up yourself. Ledger Flow writes them on their day and marks them to review.</p>
<div class="list" style="margin:0 -16px">${row("music", "PINK", "Spotify", "Monthly · next on 15 Oct", 16900, "expense", { badges: '<span class="badge success">On</span>' })}${row("zap", "AMBER", "Claro", "Monthly · next on 3 Oct", 89000, "expense", { badges: '<span class="badge success">On</span>' })}${row("house", "BROWN", "Rent share", "Monthly · paused", 74000, "expense", { badges: '<span class="badge">Paused</span>' })}</div></div>`;
  const both = `<div class="card stack-sm"><div class="card-head" style="margin:0"><h3 class="h3">Recurring</h3><button class="btn secondary sm">${iconSvg("plus", "sm")}New</button></div>
<div class="list" style="margin:0 -16px">${row("music", "PINK", "Spotify", "Monthly · next on 15 Oct", 16900, "expense", { badges: '<span class="badge success">On</span>' })}${row("zap", "AMBER", "Claro", "Monthly · next on 3 Oct", 89000, "expense", { badges: '<span class="badge success">On</span>' })}</div>
<div class="alert neutral" style="align-items:center">${iconSvg("sparkles")}<span style="flex:1"><b>Rent share</b> has repeated for nine months and is not set up.</span><button class="btn sm ink">Set it up</button></div></div>`;
  const body = { detected, declared, both }[kind];
  return `<div class="app" style="padding:20px;border-radius:14px;display:flex;flex-direction:column;gap:14px;width:100%">${body}</div>`;
};

// Everything below is the preview itself — navigation, search, dates — not the app's design.

// T-72 · what the More tab opens; `withAccounts` false is the discarded avatar variant.
const navMenuSheet = (withAccounts) => {
  const acc = withAccounts ? settingsRow("wallet", "Accounts", "4 accounts", "", "BLUE") : "";
  return sheetWrap(
    `<div class="list card flush">${acc}${settingsRow("chart-column", "Stats", "Where the money went", "", "TEAL")}${settingsRow("tags", "Categories", "13 active · 1 archived", "", "ORANGE")}${settingsRow("settings", "Settings", "Profile, currency, appearance", "", "GRAY")}</div>
<div class="list card flush"><a class="row" href="#"><span class="avatar" style="width:32px;height:32px;font-size:12px">JD</span><span class="body"><span class="title">John Doe</span><span class="meta">john@example.com</span></span>${iconSvg("chevron-right", "sm")}</a></div>`,
    "More",
  );
};

const mobileNavVariant = (kind) => {
  if (kind === "see-all") return home({ statsLink: true, nav: barBeforeMore("inicio") });
  if (kind === "more-tab")
    return home({ nav: navBar(["inicio", "mov", null, "pres", "mas"], "inicio") });
  if (kind === "more-sheet")
    return home({
      nav: navBar(["inicio", "mov", null, "pres", "mas"], "mas"),
      sheet: navMenuSheet(true),
    });
  if (kind === "six")
    return home({ nav: navBar(["inicio", "mov", null, "pres", "cuentas", "mas"], "inicio") });
  return accounts({
    nav: barBeforeMore("cuentas"),
    actions: `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New account</button><button class="btn secondary icon-only round mobile-only" aria-label="New account">${iconSvg("plus")}</button><a class="avatar" href="#" aria-label="More">JD</a>`,
    sheet: kind === "avatar-open" ? navMenuSheet(false) : "",
  });
};

// T-73 · the quick sheet learns the three types; the body is the same one `quickSheet` draws today.
const quickTypeVariant = (kind) => {
  if (kind !== "title") return home({ sheet: quickSheet({ type: kind }) });
  const head = `<div class="sheet-head"><button class="btn ghost sm" aria-expanded="true" style="gap:6px;padding-left:0"><span class="h3">Add expense</span>${iconSvg("chevron-down", "sm")}</button><button class="btn ghost icon-only sm round" aria-label="Close">${iconSvg("x", "sm")}</button></div>`;
  const menu = sheetWrap(
    `<div class="list card flush">${settingsRow("arrow-down-left", "Expense", "Money leaving an account", `<span class="badge brand">${iconSvg("check")}</span>`, "RED")}${settingsRow("arrow-up-right", "Income", "Money arriving", "", "GREEN")}${settingsRow("arrow-left-right", "Transfer", "Between two of your accounts", "", "GRAY")}</div>`,
    "What are you adding?",
  );
  return home({ sheet: quickSheet({ head, over: menu }) });
};

// T-75 · the 36×4 bar on top of every mobile sheet: gone, or made to mean something.
const sheetHandleVariant = (kind) => {
  if (kind === "none") return home({ sheet: quickSheet({ type: "expense", handle: "none" }) });
  if (kind === "dismiss")
    return home({
      sheet: quickSheet({ type: "expense", handle: "grab" })
        .replace(
          '<div class="scrim">',
          '<div class="scrim" style="background:color-mix(in oklab, var(--overlay) 55%, transparent)">',
        )
        .replace(
          '<div class="sheet" role="dialog"',
          '<div class="sheet" role="dialog" style="transform:translateY(96px)"',
        ),
    });
  const extra = `${field("Date", "Today · 18:10", null, { icon: "calendar" })}${field("Description", "Uber to work", null, { icon: "pencil" })}`;
  return home({ sheet: quickSheet({ type: "expense", handle: "wide", extra }) });
};

const plate = (id, title, note, html, o = {}) => ({ id, title, note, html, ...o });
const plateDay = (p) => p.updated ?? p.added;

const PAGES = [
  {
    file: "foundations.html",
    title: "Foundations",
    group: "Foundations",
    note: "Every colour in the interface comes from 18 OKLCH seeds: one neutral, one brand and the 16 tokens the backend stores. Light and dark are derived from the same seeds with the same rules, so a palette never decides a colour per mode. Switch the palette in the top bar and everything repaints without a component changing.",
    plates: [
      plate(
        "colour-system",
        "Colour system",
        "The same seeds in light and dark: surfaces, buttons, amounts, badges, alerts and skeletons.",
        foundationColors(),
        { frame: false, wide: true, added: "2026-09-01" },
      ),
      plate(
        "typography",
        "Typography",
        "Geist for the interface, tabular figures in every amount, Geist Mono only for technical keys.",
        foundationTypography(),
        { frame: false, wide: true, added: "2026-09-01" },
      ),
      plate(
        "iconography",
        "Iconography",
        `Lucide, 1.75 stroke. A curated set of ${ICONS_CAT.length} icons for categories; the key is what the backend stores.`,
        foundationIcons(),
        { frame: false, wide: true, added: "2026-09-01" },
      ),
    ],
  },
  {
    file: "home.html",
    title: "Home",
    group: "Screens",
    note: "The month's spending is the lead figure — the app exists to show the small daily spending — with a bar per day and progress against the global budget. The amber strip is the inbox of quick expenses still to detail. On desktop the same content splits into two columns.",
    plates: [
      plate(
        "home",
        "Home",
        "Spending, review inbox, budgets, accounts and recent transactions.",
        home(),
        { added: "2026-09-01" },
      ),
      plate(
        "install-card",
        "Install card · data at risk",
        "On a phone or tablet whose browser has not protected the offline copy — every iPhone, and any Android Chrome that said no. Install where the browser offers it, How where it does not. Never on a desktop.",
        home({ notice: "risk" }),
        { added: "2026-09-08" },
      ),
      plate(
        "install-card-safe",
        "Install card · data already safe",
        "Same card on an Android whose browser already granted durable storage: the deletion sentence is gone, because it would not be true, and what is left is the reason that still holds.",
        home({ notice: "safe" }),
        { added: "2026-09-11" },
      ),
      plate(
        "hero-day-tooltip",
        "Hero chart · the day under the pointer",
        "Every bar is a control: it says its day and its amount on hover, on focus and in the line underneath, and it opens that day where the pointer can hover. The month's figures are now the sum of the bars.",
        home({ chart: true }),
        { added: "2026-09-11" },
      ),
      plate(
        "more-sheet",
        "More",
        "What the last slot of the phone's bar opens: Accounts, Stats, Categories, Settings and the user, each with what it holds. It is the sidebar's list minus what the bar already has, so below 900px nothing is out of reach. Trends is deliberately absent — it is reached from a Stats view and its back arrow points at Stats.",
        home({ nav: tabbar("mas"), sheet: navMenuSheet(true) }),
        { added: "2026-09-15" },
      ),
      plate(
        "home-without-a-name",
        "Home without a name",
        "Neither the session nor the local mirror knows the name: the greeting loses the comma instead of showing an empty one.",
        home({ unnamed: true }),
        { added: "2026-09-08" },
      ),
    ],
  },
  {
    file: "add.html",
    title: "Add",
    group: "Screens",
    note: "The centre button opens quick capture: amount first, category optional as a row of recent chips, main account preselected. Save creates the transaction — quick, marked as still to detail, if the category is missing. More details opens the full form, which covers expense, income, transfer and adjustment with one skeleton.",
    plates: [
      plate(
        "quick-capture",
        "Quick capture",
        "The sheet behind the centre button. The three-way segment on top records all three types (T-73) and the bar above it opens the full form (T-75).",
        home({ sheet: quickSheet({ type: "expense", handle: "wide" }) }),
        { added: "2026-09-01", updated: "2026-09-15" },
      ),
      plate(
        "quick-capture-income",
        "Quick capture · income",
        "The type tints the amount and reconfigures the body: the income categories, and the account row reads “Into your main account”. The amount survives the switch.",
        home({ sheet: quickSheet({ type: "income", handle: "wide" }) }),
        { added: "2026-09-15" },
      ),
      plate(
        "quick-capture-transfer",
        "Quick capture · transfer",
        "A transfer has no category and two accounts, so the chips give way to From and To with the swap button between them. The two have to differ.",
        home({ sheet: quickSheet({ type: "transfer", handle: "wide" }) }),
        { added: "2026-09-15" },
      ),
      plate("full-form-expense", "Full form · expense", "", transactionForm("EXPENSE"), {
        added: "2026-09-01",
      }),
      plate(
        "full-form-transfer",
        "Full form · transfer",
        "Two accounts and no category.",
        transactionForm("TRANSFER"),
        { added: "2026-09-01" },
      ),
      plate(
        "category-picker",
        "Category picker",
        "Search, recents and a way to create one without leaving the form.",
        categoryPicker(),
        { added: "2026-09-01" },
      ),
      plate("account-picker", "Account picker", "", accountPicker(), { added: "2026-09-01" }),
      plate(
        "date-sheet",
        "Date",
        "The app's own calendar, not the browser's: it follows the tokens and the language, and disables what the server would refuse (more than 24 hours ahead).",
        dateSheet(),
        { added: "2026-09-06" },
      ),
      plate(
        "time-sheet",
        "Time",
        "The app's own wheel, saved in the user's time zone.",
        timeSheet(),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "access.html",
    title: "Access",
    group: "Screens",
    note: "Sign in and sign up, centred and short. Registration suggests the detected currency and time zone and says the currency locks with the first account. After signing up, two onboarding steps: the first account, which becomes the main one, and a total monthly budget.",
    plates: [
      plate("sign-in", "Sign in", "", login(), { added: "2026-09-01" }),
      plate("sign-in-rate-limited", "Sign in · too many attempts", "", login("429"), {
        added: "2026-09-01",
      }),
      plate("create-account", "Create account", "With currency and time zone.", register(), {
        added: "2026-09-01",
      }),
      plate(
        "account-reactivated",
        "Create account · reactivated",
        "The server answers that the account existed: the history comes back and the currency is kept.",
        register("reactivated"),
        { added: "2026-09-01" },
      ),
      plate("onboarding-first-account", "Onboarding 1 · first account", "", onboarding(1), {
        added: "2026-09-01",
      }),
      plate(
        "onboarding-monthly-ceiling",
        "Onboarding 2 · a ceiling for the month",
        "",
        onboarding(2),
        { added: "2026-09-01" },
      ),
      plate(
        "language-before-signing-up",
        "Language before signing up",
        "The chip in the frame's header and the Language row in the form are the same value, sent as the account's locale.",
        registerLanguage(),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "transactions.html",
    title: "Transactions",
    group: "Screens",
    note: "Grouped by day with a daily total; filter chips mirror the API's filters and a summary heads the period. The detail shows everything the backend keeps, including the source. The review inbox completes a quick expense inline: category chips, description and Done.",
    plates: [
      plate("list", "List", "Search, filters and infinite scroll.", transactions(), {
        added: "2026-09-01",
      }),
      plate("detail", "Detail", "", transactionDetail(), { added: "2026-09-01" }),
      plate(
        "review-inbox",
        "Review inbox",
        "Quick expenses to name and categorise, saved in one batch.",
        reviewInbox(),
        { added: "2026-09-01" },
      ),
      plate(
        "filters",
        "Filters",
        "Period with presets and a range, type, account, category, tag, only quick expenses to review, only quick entries. The main button says how many results are waiting.",
        filtersSheet(),
        { added: "2026-09-01" },
      ),
      plate(
        "detail-with-unsynced-change",
        "Detail with a change the server did not take",
        "The row carries a change that never landed, and the detail opens the conflict sheet.",
        transactionDetail({ conflict: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "dropped-category",
        "Review inbox · category dropped by the server",
        "Its category had been archived elsewhere, so the server saved the expense without one.",
        reviewInbox({ dropped: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "save-all-confirmation",
        "Review inbox · confirm Save all",
        "",
        reviewInbox({ confirm: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "offline-without-a-copy",
        "Offline with no local copy",
        "An honest empty state instead of a lie.",
        state("mov-offline"),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "accounts.html",
    title: "Accounts",
    group: "Screens",
    note: "Total balance and card debt on top, archived accounts folded away. The detail gathers the actions: adjust balance — which creates an adjustment with the computed delta — edit, make main, and archive, blocked with an explanation while it is the main one.",
    plates: [
      plate("list", "List", "", accounts(), { added: "2026-09-01" }),
      plate("detail", "Detail", "", accountDetail(), { added: "2026-09-01" }),
      plate(
        "adjust-balance",
        "Adjust balance",
        "The difference becomes an adjustment that counts neither as spending nor in budgets.",
        accountDetail({ sheet: true }),
        { added: "2026-09-01" },
      ),
      plate(
        "duplicate-name",
        "New account · duplicate name",
        "The server's 409 shown inline, on the field.",
        accountForm(),
        { added: "2026-09-01" },
      ),
      plate(
        "restore-with-another-name",
        "Restore with another name",
        "An active account already holds the name, so restoring asks for a new one. The same component serves categories.",
        accountRestoreSheet(),
        { added: "2026-09-06" },
      ),
      plate(
        "account-type-sheet",
        "Account type",
        "One row that opens a sheet with the nine types, each with a line that explains it. The onboarding uses the same picker.",
        accountForm({ sheet: true }),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "categories.html",
    title: "Categories",
    group: "Screens",
    note: "A grid per type with icon and colour, archived ones folded, and a way to recreate the defaults without duplicating the ones that were renamed. With history behind it the type locks, and the screen offers creating another category instead.",
    plates: [
      plate("grid", "Grid by type", "", categories(), { added: "2026-09-01" }),
      plate("edit-with-locked-type", "Edit · type locked by history", "", categoryForm(), {
        added: "2026-09-01",
      }),
      plate(
        "offline",
        "Offline · restoring defaults needs a connection",
        "The button is hidden rather than disabled, and the alert says why: the server creates those categories.",
        categories({ offline: true }),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "budgets.html",
    title: "Budgets",
    group: "Screens",
    note: "Navigation by reference period, a filter by period type, the global budget as the featured card, and one card per budget with progress, plain-language status and its warnings: an adjusted amount this period, an archived category, a custom window with an end date.",
    plates: [
      plate("list", "List", "", budgets(), { added: "2026-09-01" }),
      plate(
        "empty-follows-filter",
        "Empty · the filter names what gets created",
        'Under "Weekly" the line and the call to action are weekly; under "All" they are monthly, as they were.',
        budgets({ empty: true, filter: "Weekly", span: "week" }),
        { added: "2026-09-10" },
      ),
      plate(
        "empty-sheet-for-the-period",
        "Empty · the one-amount sheet of that period",
        "Titled after the period, and the suggested amounts are last month's spending scaled to it.",
        budgets({ empty: true, sheet: true, filter: "Weekly", span: "week" }),
        { added: "2026-09-10" },
      ),
      plate(
        "none-for-the-filter",
        "None for the filter, others in the month",
        'The sentence gains the same call to action. Under "All" and "Monthly" the dashed card above already is it, so there the sentence stays alone.',
        budgets({ noneFor: true, filter: "Weekly" }),
        { added: "2026-09-10" },
      ),
      plate(
        "empty-custom",
        'Empty · "Custom" goes to the full form',
        "A custom window is two dates the user picks, so there is no one-amount sheet: the call to action is a link to New budget.",
        budgets({ empty: true, filter: "Custom" }),
        { added: "2026-09-10" },
      ),
    ],
  },
  {
    file: "budget-detail.html",
    title: "Budget detail",
    group: "Screens",
    note: "The detail walks periods, shows what is left, the pace and the days remaining, and keeps the base amount separate from this period's adjustment. Archiving is not final: an archived budget comes back from its own detail or from Past budgets.",
    plates: [
      plate(
        "detail",
        "Detail with a period adjustment",
        "The sample movements now fit inside the days they belong to, so the list and the new charts cannot disagree.",
        budgetDetail(),
        { added: "2026-09-01", updated: "2026-09-11" },
      ),
      plate(
        "new-budget",
        "New budget",
        "Scope, the six period types, amount, colour and the advanced options.",
        budgetForm(),
        { added: "2026-09-01" },
      ),
      plate(
        "past-budgets",
        "Ended and archived",
        "Recurring budgets never end: to see a past month, change the period in the list.",
        pastBudgets(),
        { added: "2026-09-01" },
      ),
      plate(
        "detail-with-charts",
        "Detail · what the period is doing",
        "The same chart Home has, over the budget's own period, plus the curve against the pace with where it ends at this rate, the last six periods against their limit, and the biggest movements.",
        budgetDetail({ charts: true }),
        { added: "2026-09-11" },
      ),
      plate(
        "budget-by-category",
        "Where it went · a budget of several categories",
        "One more card, and only when the budget covers more than one: which of them is eating it. A budget over Lifestyle and Coffee holds the whole of both for the period, so the figures are Stats' own.",
        budgetCategoryCard(),
        { frame: false, added: "2026-09-11" },
      ),
      plate(
        "detail-charts-loading",
        "What the period is doing · loading",
        "Each card holds the height it will have with figures in it — the day chart, the pace curve, the six columns and the list — so nothing jumps when they land.",
        budgetDetail({ charts: true, state: "loading" }),
        { added: "2026-09-13" },
      ),
      plate(
        "detail-charts-empty",
        "What the period is doing · nothing spent yet",
        "A period with no spending is not a row of zeros: the day chart and the pace curve say so in words. The six previous periods did happen, so that card keeps its figures.",
        budgetDetail({ charts: true, state: "empty" }),
        { added: "2026-09-13" },
      ),
      plate(
        "detail-charts-error",
        "What the period is doing · one card failed",
        "The previous periods are their own reading, so their failure takes that card, keeps its reference and its Retry, and leaves the rest of the period standing. The day chart and the pace curve are one reading and fall together.",
        budgetDetail({ charts: true, state: "cardError" }),
        { added: "2026-09-13" },
      ),
      plate(
        "detail-first-period",
        "First period, day one",
        "The two cases that break these charts, in the one situation where they happen together: a budget in its first period has no six periods to compare against, so that card is absent rather than a single lonely column; and one elapsed day projects nothing, so there is no dashed end and the sentence says why.",
        budgetDetail({ charts: true, state: "first" }),
        { added: "2026-09-13" },
      ),
      plate("archived", "Archived · Restore", "", budgetDetail({ archived: true, charts: true }), {
        added: "2026-09-06",
        updated: "2026-09-13",
      }),
      plate(
        "restore-blocked",
        "Restore blocked by another budget",
        "Another active budget covers the same period and the same spending: the sheet names it and leads to it.",
        budgetDetail({ archived: true, conflict: true }),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "stats.html",
    title: "Stats",
    group: "Screens",
    note: "A navigable period, flow type as chips, and the API's three groupings, each with its own drill-down into the filtered list.",
    plates: [
      plate(
        "by-category",
        "By category",
        "A stacked bar whose segments name themselves on hover or focus, plus a list with percentages. It gains the way into Trends, and its sample figures now add up: the six rows are the 48 transactions the card above counts, and the month Home shows.",
        stats("cat"),
        { added: "2026-09-01", updated: "2026-09-11" },
      ),
      plate(
        "by-day",
        "By day",
        "Every bar says its day and its amount on hover, on focus and in the line underneath. Underneath: the average by weekday, the biggest movements of the period, and the way into Trends.",
        stats("day"),
        { added: "2026-09-01", updated: "2026-09-11" },
      ),
      plate(
        "spending-calendar",
        "By day · as a calendar",
        "The same days read as a month instead of a series: the shape of a week shows up where a row of bars hides it. One toggle switches between the two.",
        stats("cal"),
        { added: "2026-09-11" },
      ),
      plate(
        "by-account",
        "By account",
        "Which card or account the spending leaves from, with the same stacked bar and list as categories. Transfers between your own accounts are never counted here.",
        stats("acct"),
        { added: "2026-09-11" },
      ),
      plate(
        "by-tag",
        "By tag",
        "Warns about double counting and says how much spending carries no tag; it also carries the way into Trends.",
        stats("tag"),
        { added: "2026-09-01", updated: "2026-09-11" },
      ),
      plate(
        "days-loading",
        "By day · loading",
        "Every card keeps the height it will have with figures in it — the chart, the three tiles, the weekday strip and the list — so nothing jumps when they land.",
        stats("day", { state: "loading" }),
        { added: "2026-09-12" },
      ),
      plate(
        "days-empty",
        "By day · nothing in the period",
        "A month before the account existed is empty, not thirty no-spend days: neither the bars nor the calendar are drawn as a grid of zeros.",
        stats("day", { state: "empty" }),
        { added: "2026-09-12" },
      ),
      plate(
        "days-card-error",
        "By day · one card failed",
        "The biggest movements are their own request, so their failure is their own: it takes the card, keeps its reference and its Retry, and leaves the rest of the screen standing.",
        stats("day", { state: "cardError" }),
        { added: "2026-09-12" },
      ),
      plate(
        "accounts-loading",
        "By account · loading",
        "The same silhouette the view will have: the stacked bar and one row per account.",
        stats("acct", { state: "loading" }),
        { added: "2026-09-12" },
      ),
      plate(
        "accounts-empty",
        "By account · nothing in the period",
        "A month where the only movements were transfers between your own accounts lands here, and the sentence says why.",
        stats("acct", { state: "empty" }),
        { added: "2026-09-12" },
      ),
      plate(
        "accounts-error",
        "By account · the request failed",
        "This view is one request, so its failure replaces the view and not the screen: the period, the flow chips and the segmented control stay usable.",
        stats("acct", { state: "error" }),
        { added: "2026-09-12" },
      ),
    ],
  },
  {
    file: "trends.html",
    title: "Trends",
    group: "Screens",
    note: "Stats answers where this month's money went; Trends answers whether this month is better than the last ones. They are two screens because one period navigator cannot walk a month at a time and span six at once. Everything here counts complete months only, and says so where a month is still running.",
    plates: [
      plate(
        "trends-short-history",
        "Trends · not enough history yet",
        "The common case for a new account, and the one that breaks charts: three months where the range asks for six. The axis starts where the data starts, the range control stays above the notice — a range the history cannot fill is still one the reader may want to leave — and the notice says over how many finished months the tiles counted; nothing is padded with zeros.",
        trends({ months: 3 }),
        { added: "2026-09-11" },
      ),
      plate(
        "trends",
        "Trends over time",
        "Income against spending month by month, what was saved and at what rate, this month against the same days of the last one, and where the money went as the months pass.",
        trends(),
        { added: "2026-09-11" },
      ),
      plate(
        "trends-empty",
        "Trends · nothing in the range",
        "An account with nothing to compare yet. One Empty for the whole screen, because every card here answers the same question over the same range: a chart with no data is never drawn as flat zeros.",
        trends({ state: "empty" }),
        { added: "2026-09-13" },
      ),
      plate(
        "trends-loading",
        "Trends · loading",
        "One Skeleton per card, each at its own card's height, so nothing jumps when the figures arrive. The range control is already usable.",
        trends({ state: "loading" }),
        { added: "2026-09-13" },
      ),
      plate(
        "trends-finished-month",
        "Trends · a month that already ended",
        "Arriving from a past month in Stats. Nothing is so far in a finished month and there is no this point in it, so the middle card is named after the two months and says what was spent, not what has been spent.",
        trends({ state: "finished" }),
        { added: "2026-09-13" },
      ),
      plate(
        "trends-first-month",
        "Trends · the account's first month",
        "One month, still running: no month has finished, so Saved and Savings rate say so instead of painting a zero, and with nothing spent yet the middle card has nothing to compare.",
        trends({ months: 1, state: "firstMonth" }),
        { added: "2026-09-13" },
      ),
      plate(
        "trends-error",
        "Trends · one card failed",
        "One failure replaces the card that needed the read and not the screen. Here the category ranking fell: Where it goes cannot rank its five, and the two cards above it — which do not need it — keep their figures.",
        trends({ state: "cardError" }),
        { added: "2026-09-13" },
      ),
    ],
  },
  {
    file: "settings.html",
    title: "Settings",
    group: "Screens",
    note: "A hub with profile, preferences, security and data. Anything written on the server says so when there is no connection. Sync status is the page that answers what this device has and what it still owes the server.",
    plates: [
      plate("settings-hub", "Settings", "", settings(), { added: "2026-09-01" }),
      plate("appearance", "Appearance", "Mode and palette, with a live preview.", appearance(), {
        added: "2026-09-01",
      }),
      plate("active-sessions", "Active sessions", "", sessions(), { added: "2026-09-01" }),
      plate(
        "profile-and-security",
        "Profile & security",
        "Changing email or password asks for the current one.",
        profileSecurity(),
        { added: "2026-09-01" },
      ),
      plate(
        "delete-account",
        "Delete my account",
        "Reversible by signing up again with the same email.",
        deleteAccountScreen(),
        { added: "2026-09-01" },
      ),
      plate("language", "Language", "", languageSheet(), { added: "2026-09-01" }),
      plate(
        "sync-status",
        "Sync status",
        "In a browser tab: what is on the device, what is waiting, and how much room it takes.",
        syncStatus(),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-installed",
        "Sync status · installed app",
        "Persistent storage is granted, so the browser stops treating the data as disposable.",
        syncStatus("installed"),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-one-at-a-time",
        "Sync status · server without batching",
        "",
        syncStatus("routes"),
        { added: "2026-09-06" },
      ),
      plate("sync-status-resync", "Sync status · confirm a full resync", "", syncStatus("resync"), {
        added: "2026-09-06",
      }),
      plate("sync-status-offline", "Sync status · offline", "", syncStatus("offline"), {
        added: "2026-09-06",
      }),
      plate(
        "sign-out-with-unsent-changes",
        "Sign out with unsent changes",
        "Keep them and they go out next time, or discard them and sign out.",
        signOutSheet(),
        { added: "2026-09-06" },
      ),
      plate(
        "settings-offline",
        "Settings · offline",
        "Sign out is disabled: the session lives on the server.",
        settings({ offline: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "language-offline",
        "Language · offline",
        "The same notice covers currency, time zone, profile and deleting the account.",
        languageSheet({ offline: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-signed-out",
        "Sync status · signed out with a connection",
        "The session is the first row: without it nothing below reaches the server.",
        syncStatus("signedout"),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-preparing",
        "Sync status · preparing the device",
        "How much is still missing before the app works without a connection.",
        syncStatus("preparing"),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-blocked-queue",
        "Sync status · queue blocked by an update",
        "",
        syncStatus("blocked"),
        { added: "2026-09-06" },
      ),
      plate(
        "sync-status-loading",
        "Sync status · while the mirror answers",
        "Three rows show a skeleton instead of a false Never until the mirror and the cache answer.",
        syncStatus("loading"),
        { added: "2026-09-08" },
      ),
      plate(
        "sync-status-no-service-worker",
        "Sync status · without a service worker",
        "Where the app runs without one on purpose the row says Not available, not Ready.",
        syncStatus("nosw"),
        { added: "2026-09-08" },
      ),
      plate(
        "sync-status-this-device-only",
        "Sync status · this device only",
        "The mode the user chose, said in the Session row without scolding.",
        syncStatus("localonly"),
        { added: "2026-09-08" },
      ),
      plate(
        "install-sheet",
        "Install this app",
        "Where the browser offers to install.",
        installSheet(true),
        { added: "2026-09-08" },
      ),
      plate(
        "install-sheet-steps",
        "Install this app · by hand",
        "Where the browser does not offer it, iOS among them: the steps, and what happens if it is never installed.",
        installSheet(false),
        { added: "2026-09-08" },
      ),
    ],
  },
  {
    file: "public.html",
    title: "Public",
    group: "Screens",
    note: "The only surface search engines should index: the landing, the legal pages and a kind 404. No sidebar and no tab bar, a visible language switch, and legal links in the footer. The signed-in app carries noindex.",
    plates: [
      plate(
        "landing",
        "Landing",
        "Value proposition, three benefits, three steps and a call to action.",
        landing(),
        { added: "2026-09-01" },
      ),
      plate(
        "privacy-policy",
        "Privacy policy",
        "Doubles as the data processing policy under Ley 1581.",
        legal(),
        { added: "2026-09-01" },
      ),
      plate("not-found", "404", "", notFound(), { added: "2026-09-01" }),
    ],
  },
  {
    file: "states.html",
    title: "Screen states",
    group: "States",
    note: "What every list and every screen does when there is nothing, when it is still loading, when the server fails, and when something has to be confirmed. Every list has an empty state with a call to action, a loading skeleton and an error with a retry.",
    plates: [
      plate("empty-list", "Empty", "", state("vacio"), { added: "2026-09-01" }),
      plate("loading-list", "Loading", "", state("carga"), { added: "2026-09-01" }),
      plate(
        "server-error",
        "Server error",
        "With a reference the user can quote.",
        state("error"),
        { added: "2026-09-01" },
      ),
      plate(
        "session-expired",
        "Session expired",
        "Blocking, and it leads to the sign-in screen.",
        state("sesion"),
        { added: "2026-09-01" },
      ),
      plate(
        "unsaved-before-leaving",
        "Leaving a form with something typed",
        "A tap outside a sheet closes it, so a half-written form would go with it. When there is something to lose, the tap does not close: the sheet asks, in place, and “Keep editing” is the primary action. The close button is the deliberate exit and does not ask. A sheet with nothing typed closes on the first tap, as it should.",
        state("sin-guardar"),
        { added: "2026-09-15" },
      ),
      plate(
        "archive-confirmation",
        "Archive confirmation",
        "Archiving always confirms, saying what is kept.",
        state("confirmar"),
        { added: "2026-09-01" },
      ),
      plate("new-version", "New version available", "", state("sw-update"), {
        added: "2026-09-06",
      }),
    ],
  },
  {
    file: "sync-stripes.html",
    title: "Sync stripes",
    group: "States",
    note: "The strip sits at the top of the content column, above the header and without covering the sidebar. Amber means incomplete, green is the moment the queue drains, red is kept for a sync that really failed, and neutral for a state the user chose.",
    plates: [
      plate(
        "offline",
        "Offline",
        "Fixed strip, a badge per transaction saved locally, and a toast.",
        state("offline"),
        { added: "2026-09-01" },
      ),
      plate(
        "back-online",
        "Back online",
        "Green for a moment, with what just went out — never zero changes synced.",
        state("online"),
        { added: "2026-09-01" },
      ),
      plate(
        "needs-attention",
        "Changes that need the user",
        "Red, with Review and See all.",
        state("syncfail"),
        { added: "2026-09-01" },
      ),
      plate(
        "waiting-with-a-connection",
        "Waiting with a connection",
        "Amber: there is network and the queue has not drained yet.",
        state("pendiente"),
        { added: "2026-09-06" },
      ),
      plate(
        "signed-out",
        "Signed out with a connection",
        "Nothing is syncing, and the strip offers the way back in.",
        state("signedout"),
        { added: "2026-09-06" },
      ),
      plate(
        "ready-for-offline",
        "Ready to use offline",
        "Said once, when the device can work without a connection.",
        state("ready"),
        { added: "2026-09-06" },
      ),
      plate("blocked-by-an-update", "An update left the queue unsent", "", state("blocked"), {
        added: "2026-09-06",
      }),
      plate(
        "this-device-only",
        "This device only",
        "Neutral, because it is a decision the user made and not a failure.",
        state("localonly"),
        { added: "2026-09-08" },
      ),
    ],
  },
  {
    file: "conflicts.html",
    title: "Sync conflicts",
    group: "States",
    note: "One sheet, Resolve sync conflict, in every shape a rejected or duplicated change can take. Each one says what happened, what the server has, what the device has, and what the two ways out are.",
    plates: [
      plate(
        "changed-in-two-places",
        "Changed in two places",
        "The version to keep, side by side.",
        conflict("stale"),
        { added: "2026-09-06" },
      ),
      plate(
        "refused-by-the-server",
        "Refused by the server",
        "It was never applied, here or there.",
        conflict("failed"),
        { added: "2026-09-06" },
      ),
      plate(
        "account-archived-elsewhere",
        "Account archived elsewhere",
        "Restore the account and it goes through in the same batch.",
        conflict("archived"),
        { added: "2026-09-06" },
      ),
      plate(
        "server-did-not-say",
        "The server did not say what it has",
        "Keeping this device's version will overwrite it, and the sheet says so.",
        conflict("noserver"),
        { added: "2026-09-06" },
      ),
      plate("nothing-to-resolve", "Nothing left to resolve", "", conflict("empty"), {
        added: "2026-09-06",
      }),
      plate(
        "name-taken",
        "The name is taken",
        "A restore the server refused: the way out is another name, not trying again.",
        conflict("dup"),
        { added: "2026-09-06" },
      ),
      plate(
        "fix-the-date",
        "Fix the date",
        "The date is corrected here instead of only being discarded, because the device's clock is what is wrong.",
        conflict("future"),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "attention-tray.html",
    title: "Attention tray",
    group: "States",
    note: "The tray at /sync: one card per change the server would not take, each saying who asked for what and why it stopped. Nothing else in the queue is waiting behind them.",
    plates: [
      plate("tray", "Needs your attention", "", syncInbox(), { added: "2026-09-06" }),
      plate(
        "discard-all",
        "Confirm Discard all",
        "Says what goes with it: a change made on top of something created here.",
        syncInbox("confirm"),
        { added: "2026-09-06" },
      ),
      plate("empty-tray", "Nothing needs you", "", syncInbox("empty"), { added: "2026-09-06" }),
      plate(
        "restore-with-another-name",
        "Restore with another name",
        "The same 409 as in accounts and categories, resolved from the tray.",
        syncInbox("dup"),
        { added: "2026-09-06" },
      ),
      plate(
        "blocked-by-an-update",
        "Blocked by an app update",
        "Recorded with an older version and unsendable: discarding them frees the queue.",
        syncInbox("blocked"),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "local-mode.html",
    title: "Local mode",
    group: "States",
    note: "What the app does when the session dies but the device still holds a copy of the data: it keeps working, says nothing is leaving, and marks every figure that already includes an unsent change.",
    plates: [
      plate(
        "sign-in-to-sync",
        "Session gone, copy still here",
        "The sheet can be dismissed: the app works, it just is not syncing.",
        state("local"),
        { added: "2026-09-06" },
      ),
      plate(
        "three-exits",
        "Three exits",
        "Sign in, keep working on this device only, or delete everything here. The only sheet in the app that cannot be dismissed without choosing.",
        threeExits(),
        { added: "2026-09-08" },
      ),
      plate(
        "delete-local-copy",
        "Delete everything on this device",
        "The confirmation: it deletes the local copy and its unsent changes, not the account.",
        deleteLocalCopy(),
        { added: "2026-09-08" },
      ),
      plate(
        "projected-figures",
        "Projected figures",
        "Every amount or bar that already includes an unconfirmed write carries the amber mark and explains itself on hover or focus.",
        projected(),
        { added: "2026-09-06" },
      ),
      plate(
        "offline-document",
        "Offline fallback document",
        "A route that was never opened on this device, with no connection.",
        state("offline-doc"),
        { added: "2026-09-06" },
      ),
    ],
  },
  {
    file: "variants.html",
    title: "Decided variants",
    group: "Decisions",
    note: "Alternatives for one component, put side by side so the owner can choose. What he chooses goes into the specification and only then gets built; what he discards stays here, because in three months this page is what explains why the app is the way it is. A plate marked “Waiting on you” is a question still open — nothing about it has been built.",
    plates: [
      plate(
        "account-type-scrolling-row",
        "Account type · one scrolling row",
        "The nine chips in a row that drags, with a gradient hinting there is more. No extra layer, but on a desktop dragging with a mouse is awkward and the last types are never discovered.",
        accountTypeVariant(1),
        { added: "2026-09-06", verdict: "discarded" },
      ),
      plate(
        "account-type-five-plus-more",
        "Account type · five essentials plus More",
        "Everything visible without scrolling, but the four rare types hide behind a button and open in a different sheet from the rest of the form.",
        accountTypeVariant(2),
        { added: "2026-09-06", verdict: "discarded" },
      ),
      plate(
        "account-type-picker-row",
        "Account type · a row that opens a sheet",
        "The same picker account and category already use. Always one line, it shows the chosen type with its description, and the sheet has room to explain all nine — which is what nobody understands today. It scales if there is ever a tenth.",
        accountTypeVariant(3),
        { added: "2026-09-06", verdict: "chosen" },
      ),
      plate(
        "account-type-sheet",
        "Account type · the sheet of nine",
        "",
        accountTypeVariant(3, true),
        { added: "2026-09-06", verdict: "chosen" },
      ),
      plate(
        "back-online-without-counter",
        "Back online · without a counter",
        "A three-second Back online and nothing else.",
        state("online-plain"),
        { added: "2026-09-06", verdict: "discarded" },
      ),
      plate(
        "back-online-with-counter",
        "Back online · with a counter",
        "The second line closes the circle the amber strip opened — 2 changes waiting becomes 2 changes synced — and is the only confirmation that the queue emptied. With nothing drained the line is not painted.",
        state("online"),
        { added: "2026-09-06", verdict: "chosen" },
      ),
      plate(
        "day-readout-tooltip-only",
        "The day under the pointer · bubble only",
        "The bubble says the day and the amount on hover and on keyboard focus. On a phone there is no pointer: the only way left to read a day is to open it.",
        dayReadoutVariant(false),
        { frame: false, added: "2026-09-11", verdict: "discarded" },
      ),
      plate(
        "day-readout-with-a-line",
        "The day under the pointer · bubble and a line",
        "The same bubble, plus a fixed line under the chart that a finger can read. It is the pace mark's answer applied again: a tooltip does not exist for a finger.",
        dayReadoutVariant(true),
        { frame: false, added: "2026-09-11", verdict: "chosen" },
      ),
      plate(
        "recurring-found-by-the-app",
        "Recurring · found by the app",
        "Nothing new to fill in: the app reads the history, groups what repeats and warns when something that always arrives has not. It can be wrong, and it can only see what has already happened at least twice.",
        recurringVariant("detected"),
        { frame: false, added: "2026-09-11" },
      ),
      plate(
        "recurring-set-up-by-you",
        "Recurring · set up by you",
        "A recurring transaction is a thing you create, with its own schedule, and the app writes it on its day. It is exact, and it is a feature of its own: a new entity in the backend, occurrences that can be skipped or edited, and money written without anybody pressing save.",
        recurringVariant("declared"),
        { frame: false, added: "2026-09-11" },
      ),
      plate(
        "recurring-both",
        "Recurring · both, in this order",
        "What you set up is the truth; what the app finds and you never set up is an offer, never a figure. Detection ships first because it changes no data; declaring comes after, with its own design.",
        recurringVariant("both"),
        { frame: false, added: "2026-09-11", verdict: "chosen" },
      ),
      plate(
        "mobile-nav-stats-from-home",
        "No new chrome · Home links to Stats",
        "The cheapest option, and the one the specification has been claiming for months: Home's three-figure block — the one home.md already calls Stats — gets a section head with the same “See all” that Budgets and Accounts already have, and it goes to Stats. Below 900px only: at 900px the sidebar already has Stats. The bar keeps its five slots, nothing is demoted and no sheet is added; Categories stays where it is, one row inside Settings. Stats is then one tap from Home and two from anywhere else, which is the cost. Every plate below should be priced against this one.",
        mobileNavVariant("see-all"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "mobile-nav-more-tab",
        "Bottom bar · a More tab where Accounts is",
        "Five slots, the shape the bar already has. Accounts gives up its tab and everything the phone cannot reach today — Stats, Categories, Settings — lives behind one door that is always in the same place. The price is real: Accounts stops being one tap from anywhere.",
        mobileNavVariant("more-tab"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "mobile-nav-more-sheet",
        "Bottom bar · what the More tab opens",
        "The sheet behind More. It covers the bar completely — a sheet is a modal dialog, so the bar underneath it is not visible in the app either; the plate above is where the bar is judged. Its rows are the sidebar's lower half — Stats, Categories, Settings, the user — plus the Accounts row this variant takes out of the bar. Trends is deliberately absent: it is reached from a Stats view (app-map.md) and its back arrow points at Stats, so a door straight into it would land the user somewhere they never came from. The same sheet serves the variant below, without the Accounts row.",
        mobileNavVariant("more-sheet"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "mobile-nav-avatar-closed",
        "The avatar opens it · the bar untouched",
        "Nothing about the bar changes — Home, Transactions, the Add button, Budgets and Accounts, with the four labels they have today — and the avatar, which today sits in Home's header alone and goes straight to Settings, appears in every page header instead. Drawn here on Accounts, a screen with no way to Stats at all today.",
        mobileNavVariant("avatar"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "mobile-nav-avatar-menu",
        "The avatar opens it · the sheet",
        "The same sheet as the More tab, without the Accounts row, because Accounts keeps its tab here. Nothing is demoted and the bar stays at five slots; the cost is that the way in is a 36px circle in a corner instead of a labelled tab — under the same 44px minimum the six-slot bar is judged by, and a habit to learn rather than one to read.",
        mobileNavVariant("avatar-open"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "mobile-nav-six-slots",
        "Bottom bar · six slots",
        "Everything stays visible and More is added on the end. Measured in this frame, and the cost is not clipping — it is the size of what you tap. <b>At 390px</b> the columns are already uneven: “Transactions” holds 65px and the other five get 62px, against 75px each in the five-slot bar above. <b>At 360px</b> they are 65 and 56, against 69. <b>At 320px</b> three columns are down to 46px — two above the 44px minimum the rest of the product uses for a control, where the five-slot bar still has 60px. <b>In Spanish</b> it breaks the rule: “Movimientos” and “Presupuestos” hold 66 and 69px, and at 320px three columns fall to 37, 37 and 43px. Nothing actually clips until about 281px in English and 296px in Spanish, below any phone.",
        mobileNavVariant("six"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "quick-add-type-segment-expense",
        "Quick add · a type segment, expense",
        "The same three-way control the full form already has, minus Adjustment, at the top of the sheet. The title stops saying “Add expense” because the sheet is no longer only that; the amount stays unsigned, as it is today, and only its colour says which type is selected. The server needs nothing: `POST /transactions/quick` accepts `type` (INCOME, EXPENSE, TRANSFER) and both account ids today, and the offline queue already applies the same per-type rules (`lib/local/outbox/transactions.ts`), so this is a UI change with no sync work behind it.",
        quickTypeVariant("expense"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "quick-add-type-segment-income",
        "Quick add · the same sheet on income",
        "Income reconfigures what is underneath: the amount turns green, the chips are the income categories — three, because that is all the demo data has; the app offers the five most used — and the account row reads “Into your main account”. Same height, same number of taps.",
        quickTypeVariant("income"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "quick-add-type-segment-transfer",
        "Quick add · the same sheet on transfer",
        "A transfer has no category and two accounts, so the chips give way to From/To with the swap button — the full form's arrangement, in the sheet. This is the type that decides whether quick add can hold all three: if the body has to change this much, the segment belongs at the top, where a change of type is expected.",
        quickTypeVariant("transfer"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "quick-add-type-in-title",
        "Quick add · the title is the switch",
        "No segment: the title becomes a menu, drawn here open. It costs no vertical space, which on a phone with the keyboard up is the scarce thing, and the sheet keeps its height and its body — only the title gains a chevron. Its real price is drawn too: the app has no menu primitive — every overlay is a native dialog through `Sheet` — so choosing one of three types is a second sheet on top of the first, which is two taps to do what the segment does in one. And the obvious shortcut is already taken: holding the FAB means “keep the sheet open for another one” (`HOLD_TO_CHAIN_MS`), so a long-press cannot pick the type.",
        quickTypeVariant("title"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "sheet-handle-removed",
        "Sheet · no bar at all",
        "The 36×4 bar goes from every mobile sheet — 38 of them across the app, not only this one. Nothing is promised, so nothing is broken: the rounded top and the close button carry the sheet on their own, and the app stops drawing a control that does nothing. It is the cheapest honest answer, and it also removes a gesture people will keep trying.",
        sheetHandleVariant("none"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "sheet-handle-drag-to-dismiss",
        "Sheet · the bar closes the sheet",
        "The bar becomes what it looks like everywhere else: drag down and the sheet goes — drawn here 96px into the gesture, with the scrim already fading. One behaviour for all 38 sheets, the affordance people expect, and the bar gets a real accessible name (“Close”) so a keyboard and a screen reader get the same exit the finger does. Two costs to weigh: at 36×4 the bar is a 4px-tall target, so the close button has to stay whatever happens, and the drag needs the zero-motion branch the rest of the product honours for `prefers-reduced-motion`.",
        sheetHandleVariant("dismiss"),
        { added: "2026-09-15", verdict: "discarded" },
      ),
      plate(
        "sheet-handle-drag-to-expand",
        "Quick add · the bar opens the full form",
        "His choice, 2026-09-15: «me parece bien la opcion de si se arrastra o se clickea se expande el formulario a su version completa». Drag the bar up — or just tap it — and quick add grows into the full transaction form — the date and the description arrive here, tags and the note come with a taller sheet — carrying the amount, the category and the note already typed. It is the same jump the “More details” button already makes, so the gesture is a shortcut and never the only way. What it costs: the bar means something in quick add and nothing in the other 37 sheets, and at 4px tall it cannot be the only way in, so “More details” stays. It is drawn wider here — 44×4 instead of 36×4 — because a bar you can tap has to look like one.",
        sheetHandleVariant("expand"),
        { added: "2026-09-15", verdict: "chosen" },
      ),
      plate(
        "pace-mark-tooltip-only",
        "Pace mark · tooltip only",
        "The mark can be focused with the keyboard and says the pace on hover or focus.",
        paceVariant(false),
        { frame: false, added: "2026-09-06", verdict: "discarded" },
      ),
      plate(
        "pace-mark-with-legend",
        "Pace mark · tooltip and a legend",
        "A fixed line underneath on the screens with room for it, because a tooltip does not exist for a finger. Legend in the budget detail, tooltip everywhere.",
        paceVariant(true),
        { frame: false, added: "2026-09-06", verdict: "chosen" },
      ),
      plate(
        "stats-three-zones",
        "Stats \u00b7 the baseline, zones and nothing moved",
        "Not one of the answers \u2014 the floor the four below are priced against. Measured on the phone frame, the way into Trends sits 1,701px down on Days, 1,815px on the calendar, 1,248px under Accounts, 865px under Categories and 766px under Tags: a 2.4\u00d7 spread, so there is nowhere to learn where it is. This plate only gives the page the structure it never had \u2014 <b>the answer</b> (the total, the chart, and the tiles that summarise it), <b>More about this month</b> and <b>Other months</b>, under real headings with a rule \u2014 and puts <b>Biggest this period in all four views</b> instead of two. It does not answer the ask: Trends still ends the page, and in fact moves <b>down</b>, to 1,785px on Days and from 865 to 1,345px on Categories. What it buys is legibility and a stable shape. The four below all keep this backbone and differ only in where the way in goes.",
        statsOrder("zones"),
        { added: "2026-09-16", verdict: "discarded" },
      ),
      plate(
        "stats-other-months-in-the-middle",
        "Stats \u00b7 Other months between the answer and the rest",
        "The middle position, and the most literal reading of what was asked: not at the end, not at the start. The <b>Other months</b> zone moves up to sit immediately after the answer \u2014 the total, the chart and its three tiles \u2014 and the follow-ups come after it. Trends lands at <b>872px</b> on Days \u2014 roughly one screen down instead of three \u2014 and because all that precedes it is the scope controls, the total and the answer, it lands at about the same place on every tab: the 2.4\u00d7 spread was all tail, and the tail is now below it. It reads as an order too: this month, then the months around it, then the detail of this one. Nothing new is added \u2014 no second entry point, no extra request, no new control \u2014 and the cost is that the follow-up cards are pushed below a card that is not about this month.",
        statsOrder("middle"),
        { added: "2026-09-16", verdict: "discarded" },
      ),
      plate(
        "stats-three-zones-and-a-way-in",
        "Stats \u00b7 a Trends button in the page header",
        "The backbone, plus a <b>Trends</b> button in the page header beside Export: measured at <b>16px from the top</b> on a phone and 28px on a desktop, on all four tabs and in every state, and it never moves. Trends is not a card of this month\u2019s data \u2014 it is a sibling screen, and the header is where a sibling screen belongs; it costs one control and no vertical space at all. The closing card stays at the end, at 1,785px: someone who reaches the bottom has just run out of this month, and that is exactly when the next question is whether another one was better. The cost to weigh: a second entry point is a second thing to keep true, and the header of Stats stops being only Export.",
        statsOrder("top"),
        { added: "2026-09-16", verdict: "chosen" },
      ),
      plate(
        "stats-the-month-opens-a-range",
        "Stats \u00b7 the month itself opens the range",
        "The way in goes where the thing it changes already lives. Trends is the only part of this page that widens the <b>range</b>, and the range is what the period navigator owns \u2014 so the month becomes a button, and it opens a sheet with <i>September 2026</i>, <i>Last 6 months</i> and <i>Last 12 months</i>. It adds no card and no header control, it is the first thing under the title, and it uses the picker sheet the product already has. Two costs, and they are real. trends.md says the two screens exist because one navigator cannot walk a month at a time and span six at once \u2014 this keeps them two screens and makes the navigator a <b>door</b>, not a range control, and the sheet has to say so or it promises something the screen will not do. And the navigator stops being three plain controls: the month, which today is a label, becomes the busiest target in the row.",
        statsOrder("range"),
        { added: "2026-09-16", verdict: "discarded" },
      ),
      plate(
        "stats-the-month-opens-a-range-sheet",
        "Stats \u00b7 what the month opens",
        "The sheet behind the variant above, drawn on its own because a sheet is a modal dialog and covers the screen it belongs to. Three rows: the month you are on, and the two ranges Trends offers. Each range row says it opens Trends, so the sheet never promises that this screen will widen.",
        statsOrder("range-open"),
        { added: "2026-09-16", verdict: "discarded" },
      ),
      plate(
        "stats-a-line-instead-of-a-card",
        "Stats \u00b7 the comparison answered in one line",
        "The other reading of the problem: Trends is rarely opened not because it is hard to find but because it costs a screen change to answer one question \u2014 <i>is this month worse than usual</i>. Here that question is answered <b>on the total card</b>, in one line with the last six months beside it, and the strip itself is the way in \u2014 measured at <b>355px</b>, on the first screenful, without taking a card\u2019s worth of room. The running month is <b>hatched</b> and the sentence compares like with like, both as trends.md requires. The closing card goes away, so the page is 1,780px instead of 1,874 \u2014 <b>except on an empty period</b>, which has no total card to hang the line from (`stats.md` requires an empty month to keep its way into Trends, and it is the reader most likely to want it), so there the closing card stays. Three costs. It is <b>one more request per Stats load</b> (`groupBy=month` over six months, the same one Trends already makes, served since T-24), which house rule 24 makes you justify. The figure is a ratio of two totals the API returned, scaled to the same day of the month \u2014 what `stats.md`\u2019s \u201cWho computes what\u201d already allows the client to do \u2014 but it is one more figure to keep honest, and a partial month against whole ones is the lie trends.md refuses. And offline it needs six months in the mirror: on a device that only holds the recent window the strip is not drawn at all.",
        statsOrder("inline"),
        { added: "2026-09-16", verdict: "discarded" },
      ),
      plate(
        "stats-two-columns-on-a-desktop",
        "Stats \u00b7 two columns on a desktop",
        "A <b>separate question</b> that applies to whichever of the four wins, and it settled a disagreement: the app used to cap Stats at <b>640px at every width</b> while this preview drew it at the shared content cap of 1,120px, and `layout.md` mentioned neither. It takes the content cap now. Either way it is one column: measured in this frame the Days view is <b>1,744px of scroll</b> on a desktop, and narrower than that it is taller. Here Stats takes the same 1.6fr / 1fr split `layout.md` gives Home alone: the answer on the left, the follow-ups and then Trends on the right. The page drops from 1,910px to <b>1,302px</b> and the way into Trends from 1,836 to <b>1,213px</b> \u2014 one screen instead of two. The rail keeps the order of whichever variant wins, so under <i>Other months in the middle</i> Trends would sit at the top of it instead. The costs: the left column runs out first and leaves a tall gap beside the rail, and the rail puts cards about this month next to the answer rather than under it. <b>Switch the preview to Desktop to see it</b> \u2014 below 900px this plate is the baseline, unchanged.",
        statsOrder("columns"),
        { added: "2026-09-16", verdict: "chosen" },
      ),
    ],
  },
];

const ALL_PLATES = PAGES.flatMap((page) => (page.plates ?? []).map((p) => ({ ...p, page })));
const IN_REVIEW = ALL_PLATES.filter((p) => p.review);
const OPEN = ALL_PLATES.filter((p) => p.verdict === "open");
const LATEST = [...ALL_PLATES].map(plateDay).sort().at(-1);

const GROUPS = ["Foundations", "Screens", "States", "Decisions"];

const topBar = () => `<header class="pv-top">
<a class="pv-brand" href="index.html"><span class="pv-logo">${iconSvg("layers", "sm")}</span>Ledger Flow · Design</a>
<label class="pv-field">Palette <select id="pv-palette"><option value="tinta">Tinta</option><option value="brisa">Brisa (demo)</option></select></label>
<div class="pv-seg">${[
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "System"],
]
  .map(([v, t]) => `<button data-pv="mode" data-value="${v}">${t}</button>`)
  .join("")}</div>
<div class="pv-seg">${[
  ["mobile", "Mobile 390"],
  ["tablet", "Tablet 820"],
  ["desktop", "Desktop 1280"],
]
  .map(([v, t]) => `<button data-pv="device" data-value="${v}">${t}</button>`)
  .join("")}</div>
</header>`;

const sideNav = (current) => {
  const link = (file, title, count, extra = "") =>
    `<a class="pv-link${file === current ? " on" : ""}${extra}" href="${file}">${title}${count === undefined ? "" : `<span class="pv-count">${count}</span>`}</a>`;
  const groups = GROUPS.map((group) => {
    const pages = PAGES.filter((p) => p.group === group);
    if (pages.length === 0) return "";
    return `<div class="pv-group"><span class="pv-group-name">${group}</span>${pages.map((p) => link(p.file, p.title, (p.plates ?? []).filter((x) => !x.review).length)).join("")}</div>`;
  }).join("");
  return `<aside class="pv-side">
<div class="pv-search"><input id="pv-q" type="search" placeholder="Search a screen or a state" autocomplete="off" aria-label="Search"><div id="pv-results" class="pv-results" hidden></div></div>
<nav class="pv-nav">
<div class="pv-group">${link("index.html", "Start here")}${link("in-review.html", "Waiting on you", IN_REVIEW.length + OPEN.length, IN_REVIEW.length + OPEN.length > 0 ? " waiting" : "")}${link("changes.html", "What changed")}</div>
${groups}
</nav></aside>`;
};

const plateArticle = (p) => {
  const badges =
    (plateDay(p) === LATEST
      ? `<span class="pv-badge new">${p.updated ? "Updated" : "New"}</span>`
      : "") +
    (p.review ? '<span class="pv-badge review">In review</span>' : "") +
    (p.verdict === "chosen" ? '<span class="pv-badge chosen">Chosen</span>' : "") +
    (p.verdict === "discarded" ? '<span class="pv-badge">Not chosen</span>' : "") +
    (p.verdict === "open" ? '<span class="pv-badge open">Waiting on you</span>' : "");
  const body =
    p.frame === false ? p.html : `<div class="device"><div class="app">${p.html}</div></div>`;
  const cls = `pv-item${p.frame === false ? " plain" : ""}${p.wide ? " wide" : ""}`;
  return `<article class="${cls}" id="${p.id}">
<header class="pv-head"><a class="pv-name" href="#${p.id}">${p.title}</a>${badges}<span class="pv-date">${p.added}</span></header>
${p.note ? `<p class="pv-sub">${p.note}</p>` : ""}
${body}
</article>`;
};

const shellPage = (title, main, current) =>
  docHead(title) +
  `<div class="pv-app">${topBar()}${sideNav(current)}<main class="pv-main">${main}</main></div>` +
  DOC_FOOT;

const renderPage = (page) => {
  const plates = (page.plates ?? []).filter((p) => !p.review);
  const waiting = (page.plates ?? []).length - plates.length;
  const body =
    plates.length > 0
      ? `<div class="pv-grid">${plates.map(plateArticle).join("")}</div>`
      : `<div class="pv-empty">${iconSvg("inbox")}<span class="pv-h2">This whole screen is being changed</span><p>Its ${waiting} plates are in <a href="in-review.html">In review</a> until you decide. Approving one brings it back here.</p></div>`;
  const note =
    waiting > 0 && plates.length > 0
      ? `<p class="pv-note">${waiting} more ${waiting === 1 ? "plate is" : "plates are"} waiting for you in <a href="in-review.html">In review</a>.</p>`
      : "";
  const main = `<h1 class="pv-h1">${page.title}</h1>
${page.note ? `<p class="pv-note">${page.note}</p>` : ""}${note}
${body}`;
  return shellPage(page.title, main, page.file);
};

const startHere = () => {
  const fresh = ALL_PLATES.filter((p) => plateDay(p) === LATEST);
  const total = ALL_PLATES.length;
  const main = `<h1 class="pv-h1">Ledger Flow · Design</h1>
<p class="pv-note">Every screen of the app, drawn from the same tokens as the code: ${total} plates across ${PAGES.length} pages. Use the top bar to switch palette, mode and device — everything repaints without a component changing. The sidebar is the map, and its search box finds a plate by name: type “sync” or “budget”, or press / from anywhere.</p>
<div class="pv-cards">
<section class="pv-card wide"><h2 class="pv-h2">Where to start</h2>
<ul class="pv-list">
<li><a href="in-review.html">Waiting on you</a> — the drafts being worked on and the questions drawn more than one way. Choose, and the answer goes into the specification while the rest stays on <a href="variants.html">Decided variants</a>.</li>
<li><a href="changes.html">What changed</a> — every plate by the day it arrived, newest first.</li>
<li><a href="foundations.html">Foundations</a> — the colour system, the type scale and the icons everything else is built from.</li>
</ul></section>
<section class="pv-card wide"><h2 class="pv-h2">Newest · ${LATEST}</h2><ul class="pv-list">${fresh
    .map(
      (p) =>
        `<li><a href="${p.page.file}#${p.id}">${p.title}</a> <span class="pv-where">${p.page.title}</span></li>`,
    )
    .join("")}</ul></section>
</div>`;
  return shellPage("Start here", main, "index.html");
};

const inReview = () => {
  const asked = [...new Set(OPEN.map((q) => q.asks))];
  const questions =
    OPEN.length === 0
      ? ""
      : `<section class="pv-card wide"><h2 class="pv-h2">${asked.length} ${asked.length === 1 ? "question" : "questions"} with more than one answer</h2>
<p>Each of these is drawn two or more ways on <a href="variants.html">Decided variants</a>, side by side, so they can be compared. Pick one and it goes into the specification; the others stay there as the record of why.</p>
${asked
  .map((q) => {
    const answers = OPEN.filter((o) => o.asks === q);
    return `<p class="pv-note"><b>${q}</b> — ${answers.length} ${answers.length === 1 ? "answer" : "answers"}:</p>
<ul class="pv-list">${answers.map((a) => `<li><a href="variants.html#${a.id}">${a.title}</a></li>`).join("")}</ul>`;
  })
  .join("")}</section>`;
  const drafts =
    IN_REVIEW.length === 0
      ? ""
      : `<h2 class="pv-h2">Being worked on</h2><div class="pv-grid">${IN_REVIEW.map(plateArticle).join("")}</div>`;
  const nothing =
    IN_REVIEW.length === 0 && OPEN.length === 0
      ? `<div class="pv-empty">${iconSvg("check")}<span class="pv-h2">Nothing is waiting on you</span><p>Every design has been decided and lives on its own page. The last one landed on ${LATEST}.</p></div>`
      : "";
  const main = `<h1 class="pv-h1">Waiting on you</h1>
<p class="pv-note">Two kinds of thing land here: a draft being worked on, which moves to the screen it belongs to once it is right, and a question drawn several ways, which waits for you to choose one. Nothing on this page has been built.</p>
${questions}${drafts}${nothing}`;
  return shellPage("Waiting on you", main, "in-review.html");
};

const whatChanged = () => {
  const dates = [...new Set(ALL_PLATES.flatMap((p) => [p.added, p.updated].filter(Boolean)))]
    .sort()
    .reverse();
  const main = `<h1 class="pv-h1">What changed</h1>
<p class="pv-note">Every plate by the day it arrived, newest first. Use it to see what is new since the last time you looked.</p>
<div class="pv-changes">${dates
    .map((date) => {
      const items = ALL_PLATES.filter((p) => p.added === date || p.updated === date).map((p) => ({
        ...p,
        changed: p.updated === date && p.added !== date,
      }));
      return `<section class="pv-card wide"><h2 class="pv-h2">${date}${date === LATEST ? ' <span class="pv-badge new">New</span>' : ""}</h2>
<ul class="pv-list">${items.map((p) => `<li><a href="${p.page.file}#${p.id}">${p.title}</a> <span class="pv-where">${p.page.title}${p.changed ? " · updated" : ""}</span></li>`).join("")}</ul></section>`;
    })
    .join("")}</div>`;
  return shellPage("What changed", main, "changes.html");
};

const searchIndex = () =>
  "window.LF_PLATES=" +
  JSON.stringify(
    ALL_PLATES.map((p) => ({
      t: p.title,
      i: p.id,
      p: p.review ? "in-review.html" : p.page.file,
      g: p.page.title,
      d: p.added,
    })),
  ) +
  ";";

const write = (name, html) => writeFileSync(new URL(name, OUT), html);

mkdirSync(new URL("assets/", OUT), { recursive: true });
write("assets/plates.js", searchIndex());
write("index.html", startHere());
write("in-review.html", inReview());
write("changes.html", whatChanged());
for (const page of PAGES) write(page.file, renderPage(page));
console.log(`preview: ${PAGES.length + 3} pages, ${ALL_PLATES.length} plates`);
