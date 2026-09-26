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
  const sign = {
    expense: "−",
    income: "+",
    transfer: "",
    adjustment: "±",
    settlement: "+",
    settlementOut: "−",
  }[kind];
  return `<span class="amount ${kind} ${cls}">${sign}${money(v)}</span>`;
};

const tile = (icon, color, size = "") =>
  `<span class="tile ${size} color-${color}">${iconSvg(icon)}</span>`;

const bell = (news = 0) =>
  `<a class="btn ghost icon-only round bell" href="#" aria-label="${news ? `Notifications, ${news} new` : "Notifications"}">${iconSvg("bell")}${news ? `<span class="news-count" aria-hidden="true">${news > 9 ? "9+" : news}</span>` : ""}</a>`;

const TAB_FOR = {
  inicio: ["house", "Home"],
  mov: ["list", "Transactions"],
  pres: ["chart-pie", "Budgets"],
  cuentas: ["wallet", "Accounts"],
  mas: ["ellipsis", "More"],
};

const tab = (key, active = false, news = false, invites = 0) => {
  const [icon, label] = TAB_FOR[key];
  const dot =
    key == "mov"
      ? "<i class=dot></i>"
      : key == "mas" && (news || invites)
        ? '<i class="dot news"></i>'
        : "";
  const name =
    key != "mas"
      ? ""
      : news
        ? ` aria-label="More, new notifications"`
        : invites
          ? ` aria-label="More, ${invites} invitation${invites > 1 ? "s" : ""} waiting"`
          : "";
  return `<a class="tab${active ? " active" : ""}" href="#"${name}>${iconSvg(icon)}<span>${label}</span>${dot}</a>`;
};

const navBar = (keys, active, news = false, invites = 0) =>
  `<nav class="tabbar" aria-label="Navegación"${keys.length === 5 ? "" : ` style="grid-template-columns:repeat(${keys.length},1fr)"`}>
${keys
  .map((k) =>
    k === null
      ? `<div class="fab-slot"><button class="fab" aria-label="Add">${iconSvg("plus")}</button></div>`
      : tab(k, k === active, news, invites),
  )
  .join("")}</nav>`;

// T-72 · the phone's bar ends in More; Accounts moved into the sheet it opens.
const tabbar = (active, news = false, invites = 0) =>
  navBar(["inicio", "mov", null, "pres", "mas"], active, news, invites);
const barBeforeMore = (active) => navBar(["inicio", "mov", null, "pres", "cuentas"], active);

const navlink = (icon, label, active = false, count = null, kind = "") => {
  const c = count
    ? `<span class="count${kind ? " news" : ""}">${count}${kind == "news" ? '<span class="sr-only"> new</span>' : kind == "waiting" ? '<span class="sr-only"> waiting</span>' : ""}</span>`
    : "";
  return `<a class="navlink${active ? " active" : ""}" href="#">${iconSvg(icon)}<span>${label}</span>${c}</a>`;
};

const sidebar = (active, news = 0, invites = 0) => `<aside class="sidebar">
<div class="brand"><span class="logo">${iconSvg("layers", "sm")}</span>Ledger Flow</div>
<button class="btn primary block cta">${iconSvg("plus", "sm")} Add</button>
${navlink("house", "Home", active == "inicio")}${navlink("list", "Transactions", active == "mov", 3)}
${navlink("bell", "Notifications", active == "notif", news, "news")}
${navlink("chart-pie", "Budgets", active == "pres")}${navlink("wallet", "Accounts", active == "cuentas")}
${navlink("users", "Shared", active == "shared", invites, "waiting")}
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
  "Home groceries": ["shopping-cart", "GREEN"],
  "Monthly subscriptions for the whole family, streaming and cloud storage": ["repeat", "PURPLE"],
};

const catChip = (name, selected = false) => {
  const [ic, col] = CATS[name];
  return `<button class="chip cat color-${col}${selected ? " selected" : ""}"><span class="dot">${iconSvg(ic)}</span><span class="name">${name}</span></button>`;
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

const OWED_TO_YOU = 552600;
const YOU_OWE = 60000;

const home = ({
  unnamed = false,
  notice = "",
  chart = false,
  nav = null,
  sheet = "",
  statsLink = false,
  debt = "two-cards",
  news = 0,
  invites = 0,
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
  const pend = `<a class="alert warning" href="#" style="align-items:center">${iconSvg("inbox")}<span style="flex:1"><b>3 quick entries to review</b> · <span class="amount expense" style="color:var(--text)">−${moneyText(27900)}</span> · <span class="amount income">+${moneyText(1200000)}</span></span>${iconSvg("chevron-right", "sm")}</a>`;
  const installRisk =
    notice === "risk"
      ? `<span class="small muted">This browser can also delete what you record offline after a few days without opening the site. Installing the app stops that.</span>`
      : "";
  // T-197 · one action per path: the browser's prompt, the steps, or Chrome where Samsung Internet runs.
  const installActions = {
    risk: `<button class="btn primary sm">How</button>`,
    safe: `<button class="btn primary sm">${iconSvg("download", "sm")}Install</button>`,
    samsung: `<a class="btn primary sm" href="#">${iconSvg("external-link", "sm")}Install with Chrome</a>`,
  };
  const samsungLine =
    notice === "samsung"
      ? `<span class="xs muted">No Chrome, or it didn’t open? <a href="#" style="color:var(--brand-text);font-weight:500;text-decoration:underline;text-underline-offset:2px">Install it here</a>. If Android warns that it may be dangerous, tap “More details”, then “Install anyway”.</span>`
      : "";
  const installCard = notice
    ? `<section class="card hstack" style="gap:12px;align-items:flex-start">${tile("monitor-smartphone", "AMBER")}
<span class="body" style="flex:1;display:flex;flex-direction:column;gap:6px">
<span class="h3">For when there's no connection</span>
<span class="small muted">Ledger Flow already keeps a copy on this device, so it works with no signal. Installed, it opens on its own, outside the browser.</span>
${installRisk}
<span class="hstack" style="gap:8px;margin-top:4px;flex-wrap:wrap">${installActions[notice]}<button class="btn ghost sm">Not now</button></span>
${samsungLine}
</span></section>`
    : "";
  const statsHead = statsLink
    ? '<div class="section-head mobile-only"><h3 class="h3">Stats</h3><a class="link" href="#">See all</a></div>'
    : "";
  const income = `<div class="card stat"><span class="k">Income this month</span><span class="v amount income">${money(4200000, "+")}</span><span class="d up">${iconSvg("trending-up", "sm")}Same as August</span></div>`;
  const savings = `<div class="card stat wide-only"><span class="k">Estimated savings</span><span class="v amount">${money(2915700)}</span><span class="d faint">Income − spending</span></div>`;
  const totalCard =
    debt === null
      ? `<div class="card stat"><span class="k">Total balance</span><span class="v amount">${money(11258600)}</span><span class="d faint">4 accounts</span></div>`
      : debt === "two-cards"
        ? `<div class="card stat"><span class="k">What you have</span><span class="v amount">${money(YOURS)}</span><span class="d faint">3 accounts</span></div>
<div class="card stat"><span class="k">What you owe</span><span class="v amount">${money(OWED)}</span><span class="d faint">A card and a loan</span></div>`
        : `<div class="card stat"><span class="k">Total balance</span><span class="v amount">${money(NET)}</span><span class="d faint">${debt === "unchanged" ? "5 accounts" : `${moneyText(YOURS)} yours − ${moneyText(OWED)} owed`}</span></div>`;
  const owedLine =
    debt === "two-cards"
      ? `<a class="card hstack" href="#" style="padding:10px 14px;gap:10px">${iconSvg("users")}<span class="small" style="flex:1"><b class="amount">${moneyText(OWED_TO_YOU)}</b> owed to you · <span class="muted">you owe <b class="amount">${moneyText(YOU_OWE)}</b></span></span>${iconSvg("chevron-right", "sm")}</a>`
      : "";
  const stats = `${statsHead}<section class="stats${debt === "two-cards" ? " pairs" : ""}">
${totalCard}
${income}
${savings}
</section>${owedLine}`;
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
  const carousel =
    debt === null
      ? `${acct("Bancolombia", "Bank account", "BLUE", 3420500, true)}${acct("Cash", "Cash", "GRAY", 184000)}${acct("Visa Gold", "Credit card", "PURPLE", 1245900, false, true)}${acct("Savings", "Savings", "GREEN", 8900000)}`
      : `${acct("Bancolombia", "Bank account", "BLUE", 3420500, true)}${acct("Cash", "Cash", "GRAY", 184000)}${debtCard(DEBT_LEAD, VISA, true)}${debtCard(DEBT_LEAD, CARLOAN, true)}${acct("Savings", "Savings", "GREEN", 8900000)}`;
  const accountsSection = `<section class="stack-sm"><div class="section-head"><h3 class="h3">Accounts</h3><a class="link" href="#">See all</a></div>
<div class="hscroll">${carousel}</div></section>`;
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
<div class="actions"><button class="btn ghost icon-only round desktop-only" aria-label="Search">${iconSvg("search")}</button>${bell(news)}${av}</div></header>`;
  const mobile = `${header}${pend}${installCard}${hero}${stats}${budgetsSection}${accountsSection}${recent}`;
  const desk = `${header}${pend}${installCard}<div class="grid-main"><div class="stack" style="gap:20px">${hero}${stats}${recent}</div><div class="stack" style="gap:20px">${budgetsSection}${accountsSection}</div></div>`;
  return `<div class="shell">${sidebar("inicio", news, invites)}<main class="main">
<div class="page mobile-only">${mobile}</div><div class="page desktop-only">${desk}</div>
</main>${nav ?? tabbar("inicio", news > 0, invites)}</div>${sheet}`;
};

const quickPicker = (label, value, icon, color) =>
  `<button class="picker">${tile(icon, color, "sm")}<span class="body"><span class="lbl">${label}</span><span class="val">${value}</span></span>${iconSvg("chevron-down", "sm")}</button>`;

const QUICK_NOTE = `<div class="input"><span class="placeholder" style="flex:1">Quick note (optional)</span>${iconSvg("notebook-pen", "sm")}</div>`;
const QUICK_BUTTONS = `<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">More details</button><button class="btn primary lg" style="flex:1.4">Save</button></div>`;

// The one quick sheet every quick-add plate is drawn from: T-73 adds `type`, T-75 changes `handle`.
const quickSheet = ({
  handle = "plain",
  type = null,
  head = null,
  extra = "",
  over = "",
  hint = "",
  full = false,
  keyboard: kb = null,
  chips: chipsOverride = null,
  note = null,
  again = "",
} = {}) => {
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
  const chips = {
    income: `${catChip("Salary", true)}${catChip("Business")}${catChip("Other income")}`,
    transfer: `${catChip("Card payment")}${catChip("Transfer")}`,
    expense: `${catChip("Food", true)}${catChip("Coffee")}${catChip("Transport")}${catChip("Lifestyle")}`,
  }[type ?? "expense"];
  const cats =
    type === null
      ? `<div class="stack-sm"><span class="label">Category <span class="opt">optional · you can add it later</span></span>
<div class="chips fit">${catChip("Food", true)}${catChip("Coffee")}${catChip("Transport")}${catChip("Lifestyle")}<button class="chip">${iconSvg("ellipsis", "sm")}More</button></div></div>`
      : `<div class="stack-sm"><span class="label">Category <span class="opt">optional · you can add it later</span></span>
<div class="chips fit">${chipsOverride ?? chips}<button class="chip">${iconSvg("ellipsis", "sm")}More</button></div></div>`;
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
  if (full)
    return fullScreen({
      title,
      body: `${seg}${hint}${amount}${again}${cats}${accounts}${note ?? QUICK_NOTE}${extra}`,
      action: "Save",
      secondary: '<button class="btn ghost lg block">More details</button>',
      footer: QUICK_BUTTONS,
      keyboard: kb,
      over,
    });
  return `<div class="scrim"><div class="sheet" role="dialog" aria-label="${title}">
${bar}${sheetHead}${seg}${hint}${amount}${again}${cats}${accounts}${note ?? QUICK_NOTE}${extra}${QUICK_BUTTONS}
</div>${over}</div>`;
};

const NOTE_FIELD = `<div class="field"><span class="label">Note <span class="opt">optional</span></span><div class="input textarea"><span class="placeholder">Anything you want to remember about this one</span></div></div>`;

const transactionForm = (
  kind = "EXPENSE",
  {
    adjustment = false,
    transfer = null,
    amount = "18,400",
    readback = "",
    description = null,
    hint = "",
    intents = "",
    cat: catSlot = null,
    sheet = "",
    swap = true,
    notice = "",
    segment = true,
    save = "Save transaction",
    details = null,
  } = {},
) => {
  const seg = [
    ["EXPENSE", "Expense", ""],
    ["INCOME", "Income", "income"],
    ["TRANSFER", "Transfer", "transfer"],
    ["ADJUSTMENT", "Adjustment", ""],
  ]
    .filter(([k]) => adjustment || k !== "ADJUSTMENT")
    .map(([k, t, c]) => `<button aria-pressed="${String(k == kind)}" class="${c}">${t}</button>`)
    .join("");
  let accounts;
  let cat;
  if (kind == "TRANSFER") {
    const [fromIcon, fromColor, fromValue] = transfer?.from ?? [
      "landmark",
      "BLUE",
      "Bancolombia · $3,420,500",
    ];
    const [toIcon, toColor, toValue] = transfer?.to ?? [
      "piggy-bank",
      "GREEN",
      "Savings · $8,900,000",
    ];
    accounts = `${intents}<div class="stack-sm">
<button class="picker">${tile(fromIcon, fromColor, "sm")}<span class="body"><span class="lbl">From</span><span class="val">${fromValue}</span></span>${iconSvg("chevron-down", "sm")}</button>
<div style="display:flex;justify-content:center;margin:-4px 0"><button class="btn secondary icon-only sm round" aria-label="Swap"${swap ? "" : " disabled"}>${iconSvg("arrow-left-right", "sm")}</button></div>
<button class="picker">${tile(toIcon, toColor, "sm")}<span class="body"><span class="lbl">To</span><span class="val">${toValue}</span></span>${iconSvg("chevron-down", "sm")}</button></div>`;
    cat = "";
  } else {
    accounts = `<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">Account</span><span class="val">Bancolombia · $3,420,500</span></span>${iconSvg("chevron-down", "sm")}</button>`;
    cat = `<div class="stack-sm"><span class="label">Category</span>
<div class="chips">${catChip("Food")}${catChip("Coffee")}${catChip("Transport", true)}${catChip("Bills")}${catChip("Health")}<button class="chip">${iconSvg("search", "sm")}Search</button></div></div>`;
  }
  return `<div class="shell">${sidebar("")}<main class="main"><div class="page" style="max-width:640px">
<header class="page-header"><button class="btn ghost icon-only round" aria-label="Back">${iconSvg("arrow-left")}</button><h1 class="h2" style="flex:1;text-align:center">New transaction</h1><span style="width:40px"></span></header>
${notice}${segment ? `<div class="segment">${seg}</div>` : ""}${hint}
<div class="amount-input" style="padding-top:8px"><span class="cur">$</span><span class="num">${amount}</span></div>
${catSlot ?? cat}
${accounts}${readback}
<div class="input-group">
<div class="field"><span class="label">Date</span><div class="input">${iconSvg("calendar", "sm")}<span class="value">Today</span></div></div>
<div class="field"><span class="label">Time</span><div class="input">${iconSvg("clock", "sm")}<span class="value">18:10</span></div></div></div>
${
  details ??
  `<div class="field"><span class="label">Description <span class="opt">optional</span></span><div class="input${description === null ? " focus" : ""}"><span class="value">${description ?? (kind == "TRANSFER" ? "Visa Gold payment" : "Uber to work")}</span></div></div>
<div class="field"><span class="label">Tags <span class="opt">optional</span></span><div class="input" style="height:auto;min-height:48px;padding:8px 12px;flex-wrap:wrap"><span class="tag">work</span><span class="placeholder">Add…</span></div>
<div class="chips" style="margin-top:2px"><button class="chip" style="height:28px">#travel</button><button class="chip" style="height:28px">#monthly</button><button class="chip" style="height:28px">#latte</button></div></div>
${NOTE_FIELD}`
}
<div class="hstack" style="gap:10px;padding:8px 0 12px"><button class="btn primary lg block">${save}</button></div>
</div></main></div>${sheet}`;
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
    news = 0,
    invites = 0,
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
  return `<div class="shell">${sidebar(side, news, invites)}<main class="main">${banner}<div class="page"${mw}>${header}${body}</div></main>${nav ?? tabbar(tabName, news > 0, invites)}</div>${sheet}`;
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
  return `<div class="scrim center"><div class="sheet" role="dialog" aria-label="${title}"><div class="handle"></div><div class="sheet-head"><span class="h3">${title}</span>${close}</div>${inner}</div></div>`;
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
  return fullWrap(
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
<div class="stack">${field("Name", "John Doe", null, { icon: "user" })}${field("Email", "john@example.com", null, state == "taken" ? { icon: "user", error: '<span>This email already has an account. If you deleted it, sign up with the password it had to bring it back. <a href="#" style="font-weight:500;text-decoration:underline">Sign in</a></span>' } : { icon: "user" })}${field("Password", null, "At least 8 characters", { icon: "lock", help: "Between 8 and 128 characters." })}
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

const transactions = ({ settlement = false, toast = "", sheet = "" } = {}) => {
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
<div class="day-head"><span>Sunday 20</span><span class="amount">${settlement ? money(132600, "−") : money(272600, "−")}</span></div>
${settlement ? row("hand-coins", "GRAY", "Beto Cano", "10:15 · Bancolombia", 300000, "settlement", { badges: `<span class="badge">${iconSvg("hand-coins")}Payment</span>`, sub: "Cartagena trip" }) : ""}
${settlement ? row("hand-coins", "GRAY", "Ana Ruiz", "10:20 · Bancolombia", 160000, "settlementOut", { badges: `<span class="badge">${iconSvg("hand-coins")}Payment</span>`, sub: "Cartagena trip · money back to her" }) : ""}
${row("utensils", "ORANGE", "Carulla groceries", "Bancolombia", 78900, "expense", { badges: `<span class="badge">${iconSvg("users")}Shared</span>`, sub: "Your share $26,300" })}
${row("scale", "NONE", "Balance adjustment · Cash", "Reconciliation", 7500, "adjustment", { badges: '<span class="badge">Adjustment</span>' })}
${row("zap", "AMBER", "EPM electricity", "Bancolombia", 186200)}
</div>
<div class="hstack" style="justify-content:center;padding:4px 0"><span class="skeleton" style="width:120px;height:12px"></span></div>${toast}`;
  return screen(body, {
    tab: "mov",
    side: "mov",
    title: "Transactions",
    actions: `<button class="btn ghost icon-only round" aria-label="Download transactions">${iconSvg("download")}</button><button class="btn primary desktop-only">${iconSvg("plus", "sm")}Add</button>`,
    sheet,
  });
};

const SHARE_HISTORY = [
  ["Aug 29", "Recorded · paid from Bancolombia", 1200000, false],
  ["Sep 12", "Split 4 ways in Cartagena trip", 1200000, true],
  ["Sep 18", "Ana Ruiz paid $300,000", 900000, false],
  ["Sep 20", "Beto Cano paid $300,000", 600000, false],
  ["Sep 21", "Lucía Mesa written off", 600000, true],
];

const transactionDetail = ({
  payment = false,
  pending = false,
  conflict = false,
  shared = false,
  splitting = false,
  guestPayments = false,
  sharedPending = false,
  sheet = "",
} = {}) => {
  let pend = pending
    ? `<div class="alert warning" style="align-items:center">${iconSvg("inbox")}<span style="flex:1"><b>Quick expense to review.</b> Add a category and description so it counts where it should.</span><button class="btn sm ink">Complete</button></div>`
    : "";
  if (conflict) {
    pend = `<div class="alert danger" style="align-items:center">${iconSvg("circle-alert")}<span style="flex:1"><b>Some changes need your attention.</b> This transaction has a change the server hasn’t taken.</span><button class="btn sm danger solid">Review</button></div>`;
  }
  const info = shared
    ? [
        ["Category", `<span class="hstack">${tile("plane", "CYAN", "sm")}Travel</span>`],
        ["Account", `<span class="hstack">${tile("landmark", "BLUE", "sm")}Bancolombia</span>`],
        ["Date", "Saturday, August 29 · 09:20"],
        ["Shared group", '<a class="link" href="#">Cartagena trip</a>'],
        ["Source", '<span class="badge">Manual</span>'],
        ["Currency", '<span class="mono muted">COP</span>'],
      ]
    : splitting
      ? [
          ["Category", `<span class="hstack">${tile("utensils", "ORANGE", "sm")}Food</span>`],
          ["Account", `<span class="hstack">${tile("landmark", "BLUE", "sm")}Bancolombia</span>`],
          ["Date", "Friday, August 28 · 19:05"],
          ["Source", '<span class="badge">Manual</span>'],
          ["Currency", '<span class="mono muted">COP</span>'],
        ]
      : [
          ["Category", `<span class="hstack">${tile("car", "BLUE", "sm")}Transport</span>`],
          [
            "Account",
            `<span class="hstack">${tile("credit-card", "PURPLE", "sm")}Visa Gold</span>`,
          ],
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
  const hero = payment
    ? `<div class="card stack-sm color-GRAY" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${tile("hand-coins", "GRAY", "lg")}<span class="amount-hero" style="font-size:36px">${money(300000, "+")}</span><span class="h3">Beto Cano</span><span class="small muted">Payment · Bancolombia</span><span class="badge">${iconSvg("hand-coins")}Cartagena trip</span></div>`
    : shared
      ? `<div class="card stack-sm color-CYAN" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${tile("plane", "CYAN", "lg")}<span class="amount-hero" style="font-size:36px">${money(1200000, "−")}</span><span class="h3">Flights</span><span class="small muted">Expense · Bancolombia</span><span class="badge">${iconSvg("users")}Shared · Cartagena trip</span></div>`
      : splitting
        ? `<div class="card stack-sm color-ORANGE" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${tile("utensils", "ORANGE", "lg")}<span class="amount-hero" style="font-size:36px">${money(100000, "−")}</span><span class="h3">Groceries for the trip</span><span class="small muted">Expense · Bancolombia</span></div>`
        : `<div class="card stack-sm color-BLUE" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${tile("car", "BLUE", "lg")}<span class="amount-hero" style="font-size:36px">${money(18400, "−")}</span><span class="h3">Uber to work</span><span class="small muted">Expense · Visa Gold</span></div>`;
  const sharedCard = shared
    ? `<section class="card color-TEAL stack-sm">
<div class="card-head"><h3 class="h3">${tile("users", "TEAL", "sm")}Cartagena trip</h3><a class="link" href="#">Open group</a></div>
${pendingFigure(`<span class="amount-lg amount">${money(600000)}</span>`, sharedPending)}
<span class="small muted">counts as yours, and it is what Stats and your budgets use. Your share is ${moneyText(300000)}; Lucía’s ${moneyText(300000)} was written off, so it stays yours.</span>
<div class="list" style="margin:0 -16px 0">
${personRow("You", "Your share · Travel, August", 300000, "yours")}
${personRow("Ana Ruiz", "Paid Sep 18", 300000, "of $300,000", STATE_BADGE.paid)}
${personRow("Beto Cano", "Paid Sep 20 · oldest expense first", 300000, "of $300,000", STATE_BADGE.paid, sharedPending)}
${personRow("Lucía Mesa", "Written off Sep 21", 300000, "never paid", STATE_BADGE.off)}
</div>
${
  guestPayments
    ? `<h4 class="h3" style="font-size:14px;padding:4px 0 0">Paid by the guests</h4>
<div class="list" style="margin:0 -16px 0">
<a class="row" href="#">${tile("hand-coins", "GRAY")}<span class="body"><span class="title"><span class="truncate">Paid you ${moneyText(120000)}</span></span><span class="meta">Sep 21</span></span><span class="right"><span class="amount">${money(120000)}</span></span></a>
<a class="row" href="#">${tile("hand-coins", "GRAY")}<span class="body"><span class="title"><span class="truncate">Paid you ${moneyText(80000)}</span></span><span class="meta">Sep 20 · in cash, outside the app</span></span><span class="right"><span class="amount">${money(80000)}</span></span></a>
</div>`
    : ""
}
<div class="hstack" style="gap:10px"><button class="btn secondary" style="flex:1">${iconSvg("split", "sm")}Edit split</button><button class="btn secondary" style="flex:1">${iconSvg("hand-coins", "sm")}Settle up</button></div></section>
<section class="card">
<div class="card-head"><h3 class="h3">What has counted as yours</h3><span class="small faint">5 entries</span></div>
${SHARE_HISTORY.map(
  ([when, why, figure, same]) =>
    `<div class="hstack" style="justify-content:space-between;padding:10px 0;border-top:1px solid var(--border);gap:16px"><span class="small" style="display:flex;gap:8px"><b class="mono faint" style="font-size:11px;white-space:nowrap;padding-top:2px">${when}</b><span>${why}</span></span><span style="display:inline-flex;flex-direction:column;align-items:flex-end;white-space:nowrap"><span class="amount" style="font-weight:600">${money(figure)}</span>${same ? '<span class="sub">no change</span>' : ""}</span></div>`,
).join("")}
<p class="xs faint" style="margin:10px 0 0">Splitting an expense and writing one off never move the figure: the money had already left your account. Only a payment does, and it moves the month the expense happened in.</p></section>`
    : "";
  const actions = payment
    ? `<div class="alert neutral">${iconSvg("info")}<span>This movement belongs to a payment between people, so it is not edited or deleted on its own.</span></div>
<button class="btn danger lg block">${iconSvg("undo-2", "sm")}Undo the payment</button>`
    : splitting
      ? `<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">${iconSvg("split", "sm")}Split this</button><button class="btn secondary lg" style="flex:1">${iconSvg("pencil", "sm")}Edit</button><button class="btn danger lg" style="flex:1">${iconSvg("trash-2", "sm")}Delete</button></div>`
      : `<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">${iconSvg("pencil", "sm")}Edit</button><button class="btn danger lg" style="flex:1">${iconSvg("trash-2", "sm")}Delete</button></div>`;
  const body = `${pend}${hero}
${sharedCard}
<div class="card" style="padding:4px 16px">${rows}</div>
${actions}
<p class="xs faint" style="text-align:center;margin:0">${shared ? "Created Aug 29 09:22 · edited Sep 12 18:40" : "Created Sep 21 18:12 · edited Sep 21 18:15"}</p>`;
  return screen(body, {
    tab: "mov",
    side: "mov",
    back: true,
    title: "Transaction",
    narrow: true,
    sheet,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
  });
};

const deleteSharedSheet = () =>
  transactionDetail({
    shared: true,
    sheet: sheetWrap(
      `<div class="alert danger">${iconSvg("triangle-alert")}<span><b>This changes what everybody owes.</b> Without the flights, Cartagena trip costs ${moneyText(2000000)} and every share falls to ${moneyText(500000)} — and Ana has already paid you ${moneyText(800000)}, so she would be ${moneyText(300000)} ahead.</span></div>
<div class="alert neutral">${iconSvg("info")}<span><b>No payment is deleted.</b> A payment belongs to the person, not to this expense: the ${moneyText(1100000)} that has arrived stays, and it moves to the four expenses that are left. Each of them will say so in its history.</span></div>
<div class="list card flush">
<div class="row" style="cursor:default">${tile("hand-coins", "GRAY")}<span class="body"><span class="title">Ana Ruiz</span><span class="meta">paid $800,000 · would owe $500,000</span></span><span class="right"><span class="amount">${money(300000)}</span><span class="sub">ahead</span></span></div>
<div class="row" style="cursor:default">${tile("hand-coins", "GRAY")}<span class="body"><span class="title">Beto Cano</span><span class="meta">paid $300,000 · would owe $500,000</span></span><span class="right"><span class="amount">${money(200000)}</span><span class="sub">still owed</span></span></div>
</div>
<p class="small muted" style="margin:0">Bancolombia goes back up by ${moneyText(1200000)}, and nothing else moves. If what you meant is that you are not getting the rest back, <b>write it off</b> instead: that keeps the expense and its history.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.4">Delete anyway</button></div>`,
      "Delete Flights?",
    ),
  });
const REVIEW_CHIPS = {
  expense: ["Food", "Coffee", "Transport", "Lifestyle"],
  income: ["Salary", "Business", "Other income"],
};

const reviewInbox = ({ dropped = false, confirm = false } = {}) => {
  const item = (
    amt,
    when,
    acct,
    done = false,
    note = "",
    kind = "expense",
  ) => `<div class="card stack" style="gap:12px">
<div class="hstack" style="gap:12px">${tile("hash", "NONE")}<span class="body" style="flex:1;display:flex;flex-direction:column"><span class="amount-lg">${amount(amt, kind)}</span><span class="small faint">${when} · ${acct}</span></span><span class="badge warning">${iconSvg("inbox")}To review</span></div>${note}
<div class="chips">${REVIEW_CHIPS[kind].map((name, i) => catChip(name, done && i === 0)).join("")}<button class="chip">${iconSvg("search", "sm")}Other</button></div>
<div class="input" style="height:40px"><span class="${done ? "value" : "placeholder"}" style="flex:1">${done ? "Lunch with Laura" : "Description (optional)"}</span></div>
<div class="hstack" style="gap:8px;justify-content:flex-end"><button class="btn ghost sm">Open full form</button><button class="btn ${done ? "primary" : "secondary"} sm">${iconSvg("check", "sm")}Done</button></div></div>`;
  const body = `<div class="alert neutral">${iconSvg("info")}<span>Your quick entries already moved your balance, and the expenses among them already count toward your total budget. Here you just name and categorize them.</span></div>
${item(12500, "Today 8:42", "Bancolombia", true)}${item(15400, "Yesterday 13:05", "Bancolombia", dropped, dropped ? `<div class="alert warning">${iconSvg("archive")}<span>Its category had been archived, so the server saved it without one. Pick another.</span></div>` : "")}${item(1200000, "Sat 19 · 21:40", "Bancolombia", false, "", "income")}
<button class="btn primary lg block" style="position:sticky;bottom:8px">${iconSvg("check", "sm")}Save all · ${dropped ? 2 : 1}</button>`;
  const sh = confirm
    ? sheetWrap(
        `<div class="alert warning">${iconSvg("info")}<span><b>Each one keeps the category and description it has right now.</b><br>1 stays pending because it has no category yet.</span></div><div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Save 2</button></div>`,
        "Save 2 entries?",
      )
    : "";
  return screen(body, {
    tab: "mov",
    side: "mov",
    back: true,
    title: "To review · 3",
    narrow: true,
    actions: `<span class="small hstack" style="gap:8px">${amount(27900)}${amount(1200000, "income")}</span>`,
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
  const body = `${debtSummary()}
<div class="acct-grid">${withDebt(debtCard(DEBT_LEAD, VISA), debtCard(DEBT_LEAD, CARLOAN))}</div>
${ARCHIVED_FOLD}`;
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
    ? fullWrap(
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

// T-85 · one sample set for every debt variant: the baseline four accounts plus a loan.
const CARD_LIMIT = 4000000;
const CARD_OWED = 1245900;
const LOAN_TAKEN = 12000000;
const LOAN_OWED = 8400000;
const YOURS = 3420500 + 184000 + 8900000;
const OWED = CARD_OWED + LOAN_OWED;
const NET = YOURS - OWED;

const VISA = {
  name: "Visa Gold",
  typ: "CARD",
  color: "PURPLE",
  owed: CARD_OWED,
  limit: CARD_LIMIT,
};
const CARLOAN = {
  name: "Car loan",
  typ: "LOAN",
  color: "INDIGO",
  owed: LOAN_OWED,
  taken: LOAN_TAKEN,
};

const meter = (value) =>
  `<div class="progress thin"><span class="fill" style="width:${value}%"></span></div>`;

// A card's bar is the limit in use and moves both ways; a loan's is what is paid and only grows.
const DEBT_LEAD = "available";

const debtFace = (kind, a) => {
  const label = ACCT_TYPE_LABEL[a.typ];
  const used = a.limit
    ? round((a.owed / a.limit) * 100)
    : round(((a.taken - a.owed) / a.taken) * 100);
  // The line under the bar describes what the bar itself fills with, never its complement.
  const gauge = a.limit
    ? `${moneyText(a.owed)} of ${moneyText(a.limit)} used · ${moneyText(a.limit - a.owed)} left`
    : `${moneyText(a.taken - a.owed)} paid of ${moneyText(a.taken)}`;
  // T-101 · past zero a card keeps its availability and adds what is its owner's, and a loan is simply paid.
  if (a.owed < 0) {
    if (a.taken)
      return {
        lead: money(0),
        type: `owed · ${label}`,
        foot: `${moneyText(a.taken)} paid of ${moneyText(a.taken)}`,
        used: 100,
      };
    if (a.limit)
      return {
        lead: money(a.limit - a.owed),
        type: `available · ${label}`,
        foot: `${moneyText(0)} owed of ${moneyText(a.limit)} · ${moneyText(-a.owed)} of your own money on it`,
        used: 0,
      };
    return {
      lead: money(0),
      type: `owed · ${label}`,
      foot: a.typ === "LOAN" ? null : `${moneyText(-a.owed)} of your own money sitting on it`,
      used: 0,
      bare: true,
    };
  }
  if (kind === "available" && a.limit)
    return {
      lead: money(a.limit - a.owed),
      type: `available · ${label}`,
      foot: `${moneyText(a.owed)} owed of ${moneyText(a.limit)}`,
      used,
    };
  if (kind === "signed") return { lead: money(a.owed, "−"), type: label, foot: gauge, used };
  return { lead: money(a.owed), type: `owed · ${label}`, foot: gauge, used };
};

const acctCardFace = (a, { dot = false, badge = "", face = null, extra = "" } = {}) => {
  const mark = dot ? '<span class="dot"></span>' : tile(ACCT_TYPE_ICON[a.typ], a.color, "sm");
  const gauge = face?.foot
    ? `\n<div class="stack-sm" style="gap:5px">${face.bare ? "" : meter(face.used)}<span class="xs faint">${face.foot}</span></div>`
    : "";
  const body = face
    ? `<div><div class="amount-lg amount">${face.lead}</div><div class="type">${face.type}</div></div>${gauge}`
    : `<div><div class="amount-lg amount">${money(a.balance)}</div><div class="type">${ACCT_TYPE_LABEL[a.typ]}</div></div>`;
  const head = `<div class="top">${mark}<span class="name truncate">${a.name}</span>${badge}</div>`;
  if (extra === "") return `<a class="account-card color-${a.color}" href="#">${head}${body}</a>`;
  return `<div class="account-card color-${a.color}"><a href="#" class="stretch" aria-label="${a.name}"></a>${head}${body}${extra}</div>`;
};

const debtCard = (kind, a, dot = false) => acctCardFace(a, { dot, face: debtFace(kind, a) });

const MAIN_BADGE = `<span class="badge brand">${iconSvg("star")}Main</span>`;

const holdCard = (name, typ, color, balance, isDefault = false) =>
  acctCardFace({ name, typ, color, balance }, { badge: isDefault ? MAIN_BADGE : "" });

const SYNC_MARK = `<span class="tooltip">${iconSvg("cloud-off")}<span class="tip">Includes changes not yet synced</span></span>`;
const PENDING_SYNC = `<span class="badge warning">${iconSvg("cloud-off")}Pending sync</span>`;
const pendingFigure = (html, on = true, align = "") =>
  on ? `<span class="projected${align ? ` ${align}` : ""}">${html}${SYNC_MARK}</span>` : html;

const twoFigureCard = (leftLabel, leftValue, leftMeta, rightLabel, rightValue, pending = false) =>
  `<div class="card" style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap"><div class="stat"><span class="k">${leftLabel}</span>${pendingFigure(`<span class="amount-hero" style="font-size:32px">${money(leftValue)}</span>`, pending)}<span class="small faint">${leftMeta}</span></div>
<div class="stat" style="text-align:right;align-items:flex-end"><span class="k">${rightLabel}</span>${pendingFigure(`<span class="amount-lg amount">${money(rightValue)}</span>`, pending)}</div></div>`;

const debtSummary = (yours = YOURS, owed = OWED, active = 5) =>
  twoFigureCard(
    "What you have",
    yours,
    `${active} active accounts · 1 archived`,
    "What you owe",
    owed,
  );

const ARCHIVED_FOLD = `<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("archive")}<span style="font-weight:500">Archived</span><span class="badge">1</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="acct-grid">${accountCard("Nequi", "OTHER", "PINK", 0, false, false, true)}</div>`;

const accountsScreen = (cards, summary = debtSummary()) =>
  screen(`${summary}\n<div class="acct-grid">${cards}</div>\n${ARCHIVED_FOLD}`, {
    tab: "cuentas",
    side: "cuentas",
    title: "Accounts",
    actions: `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New account</button><button class="btn secondary icon-only round mobile-only" aria-label="New account">${iconSvg("plus")}</button>`,
  });

const withDebt = (visa, loan) =>
  `${holdCard("Bancolombia", "ACCOUNT", "BLUE", 3420500, true)}${holdCard("Cash", "CASH", "GRAY", 184000)}${visa}${loan}${holdCard("Savings", "SAVINGS", "GREEN", 8900000)}`;

const accountsDebt = (kind) =>
  accountsScreen(withDebt(debtCard(kind, VISA), debtCard(kind, CARLOAN)));

const setField = (label) =>
  `<button class="btn secondary sm" style="align-self:flex-start;position:relative">${iconSvg("target", "sm")}${label}</button>`;

const noLimitYet = (kind) => {
  const bare = (a, label) =>
    acctCardFace(a, {
      face: { lead: money(a.owed), type: `owed · ${ACCT_TYPE_LABEL[a.typ]}`, foot: null, used: 0 },
      extra: kind === "prompt" ? setField(label) : "",
    });
  return accountsScreen(
    withDebt(bare(VISA, "Set a credit limit"), bare(CARLOAN, "Set the amount borrowed")),
  );
};

const debtInCredit = () => {
  // Day one: the limit was typed in as a balance and no field is filled, so the card asks for one.
  const overpaid = { ...VISA, owed: -CARD_LIMIT, limit: undefined };
  const overdraft = {
    name: "Overdraft",
    typ: "OVERDRAFT",
    color: "TEAL",
    owed: -320000,
    limit: 2000000,
  };
  return accountsScreen(
    `${holdCard("Bancolombia", "ACCOUNT", "BLUE", 3420500, true)}${acctCardFace(overpaid, {
      face: debtFace(DEBT_LEAD, overpaid),
      extra: setField("Set a credit limit"),
    })}${debtCard(DEBT_LEAD, overdraft)}${holdCard("Savings", "SAVINGS", "GREEN", 8900000)}`,
    debtSummary(3420500 + CARD_LIMIT + 320000 + 8900000, 0, 4),
  );
};

const amountField = (label, value, help, o = {}) =>
  `<div class="field"><span class="label">${label}${o.required ? "" : ' <span class="opt">optional</span>'}</span><div class="input"><span class="cur">$</span><span class="value" style="flex:1">${nf.format(value)}</span></div><span class="help">${help}</span></div>`;

const accountFields = (kind) => {
  const card = kind === "limit";
  const name = card ? "Visa Gold" : "Car loan";
  const typ = card ? "CARD" : "LOAN";
  const color = card ? "PURPLE" : "INDIGO";
  const owed = card ? CARD_OWED : LOAN_OWED;
  let extra;
  if (card)
    extra = amountField(
      "Credit limit",
      CARD_LIMIT,
      "Only so the app can tell you how much you have left. Nothing is blocked if you go over it.",
    );
  else if (kind === "borrowed")
    extra = amountField(
      "Amount borrowed",
      LOAN_TAKEN,
      "So the app can show how much of it you have paid off.",
    );
  else
    extra =
      amountField(
        "Amount borrowed",
        LOAN_TAKEN,
        "So the app can show how much of it you have paid off.",
      ) +
      `<div class="field"><span class="label">Interest rate <span class="opt">optional</span></span><div class="input"><span class="value" style="flex:1">1.8</span><span class="small faint">% per month</span></div></div>` +
      amountField("Monthly payment", 420000, "Used to split a payment into capital and interest.") +
      `<div class="field"><span class="label">Payment day <span class="opt">optional</span></span><div class="input"><span class="value" style="flex:1">5</span>${iconSvg("calendar", "sm")}</div><span class="help">The day of the month the payment is due.</span></div>`;
  const body = `${field("Name", name)}
<div class="field"><span class="label">Type</span>${accountTypePicker(typ, color)}</div>
${extra}
<div class="field"><span class="label">Color</span>${swatches(color)}</div>
${acctCardFace({ name, typ, color }, { face: { lead: money(owed), type: "owed · preview", foot: null } })}
<button class="btn primary lg block">Save changes</button>`;
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: "Edit account",
    narrow: true,
  });
};

const createDebtAccount = () => {
  const body = `${field("Name", "Visa Gold")}
<div class="field"><span class="label">Type</span>${accountTypePicker("CARD", "PURPLE")}</div>
${amountField("How much do you owe on it right now?", CARD_OWED, "What you still have to pay back, not your credit limit. Nothing owed yet? Leave it at zero.", { required: true })}
${amountField("Credit limit", CARD_LIMIT, "Only so the app can tell you how much you have left.")}
<div class="field"><span class="label">Color</span>${swatches("PURPLE")}</div>
${acctCardFace({ name: "Visa Gold", typ: "CARD", color: "PURPLE" }, { face: debtFace(DEBT_LEAD, VISA) })}
<button class="btn primary lg block">Create account</button>`;
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: "New account",
    narrow: true,
  });
};

const heroCard = (o) => {
  const gauge = o.gauge
    ? `<div class="stack-sm" style="gap:5px;margin-top:6px">${meter(o.gauge.used)}<span class="small faint">${o.gauge.foot}</span></div>`
    : "";
  const under = o.under ? `<span class="small muted">${o.under}</span>` : "";
  return `<div class="card color-${o.color} stack-sm" style="gap:6px;position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--f)"></span>
<div class="hstack" style="justify-content:space-between">${tile(o.icon, o.color)}${o.badge ?? ""}</div>
<span class="eyebrow" style="margin-top:6px">${o.eyebrow}</span><span class="h2">${o.name}</span>
<span class="amount-hero" style="font-size:36px">${o.lead}</span>${under}${gauge}
<span class="small muted">${o.meta}</span></div>`;
};

const debtHero = (a, opened, since) => {
  const face = debtFace(DEBT_LEAD, a);
  return heroCard({
    color: a.color,
    icon: ACCT_TYPE_ICON[a.typ],
    eyebrow: ACCT_TYPE_LABEL[a.typ],
    name: a.name,
    lead: face.lead,
    under: face.type.split(" · ")[0],
    gauge: { used: face.used, foot: face.foot },
    meta: `Opening balance <b class="amount">${money(opened, opened > 0 ? "−" : "")}</b> · created ${since} · COP`,
  });
};

const debtActions = (what) =>
  `${what === null ? "" : `<button class="btn primary lg block">${iconSvg("arrow-left-right", "sm")}Pay this ${what}</button>`}
<div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px"><button class="btn secondary">${iconSvg("scale", "sm")}Adjust balance</button><button class="btn secondary">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary">${iconSvg("star", "sm")}Make main</button><button class="btn secondary">${iconSvg("archive", "sm")}Archive</button></div>`;

const cardMovements = () =>
  `<div class="section-head"><h3 class="h3">Transactions</h3><a class="link" href="#">Open with filters</a></div>
<div class="list card flush">
<div class="day-head"><span>Yesterday</span><span class="amount">${money(18400, "−")}</span></div>
${row("car", "BLUE", "Uber to work", "18:10", 18400)}
<div class="day-head"><span>Sep 5</span><span class="amount">${money(600000, "+")}</span></div>
${row("repeat", "GRAY", "Bancolombia → Visa Gold", "Payment", 600000, "transfer")}</div>`;

const loanMovements = () =>
  `<div class="section-head"><h3 class="h3">Transactions</h3><a class="link" href="#">Open with filters</a></div>
<div class="list card flush">
<div class="day-head"><span>Sep 5</span><span class="amount">${money(420000, "+")}</span></div>
${row("repeat", "GRAY", "Bancolombia → Car loan", "Payment", 420000, "transfer")}
<div class="day-head"><span>Aug 5</span><span class="amount">${money(420000, "+")}</span></div>
${row("repeat", "GRAY", "Bancolombia → Car loan", "Payment", 420000, "transfer")}</div>`;

const paySheet = (a, title, o = {}) => {
  const empty = o.empty === true;
  const amt = o.amount ?? a.owed;
  const num = empty
    ? `<span class="num" style="color:var(--text-disabled)">0</span>`
    : `<span class="num"${o.error ? ' style="color:var(--danger)"' : ""}>${nf.format(amt)}</span>`;
  const chip = `<button class="chip${!empty && amt === a.owed ? " selected" : ""}">Everything owed \u00b7 ${moneyText(a.owed)}</button>`;
  const read =
    o.read ??
    (empty
      ? ""
      : `\n<div class="alert neutral">${iconSvg("arrow-left-right")}<span>Bancolombia <b class="amount">${money(amt, "\u2212")}</b> \u00b7 ${a.name} <b class="amount">${money(amt)}</b> less owed.</span></div>`);
  const stopped = empty || Boolean(o.error);
  return fullWrap(
    `<div class="stack-sm"><div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span>${num}<span class="caret"></span></div>
<div class="chips" style="justify-content:center">${chip}</div>${o.error ? `<span class="help error">${iconSvg("circle-alert", "sm")}${o.error}</span>` : ""}</div>
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">From</span><span class="val">Bancolombia \u00b7 $3,420,500</span></span>${iconSvg("chevron-down", "sm")}</button>${o.cat ?? ""}${o.extra ?? ""}${read}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4"${stopped ? " disabled" : ""}>${o.action ?? "Pay"}</button></div>`,
    title,
  );
};

const debtDetail = (a, o = {}) =>
  screen(`${debtHero(a, o.opened, o.since)}${debtActions(o.what)}${o.movements}`, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: a.name,
    narrow: true,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
    sheet: o.sheet ?? "",
  });

const adjustDebtSheet = (name, typed, o) =>
  fullWrap(
    `<div class="stack-sm"><span class="label">${o.owed ? `How much do you owe on ${name} right now?` : `How much of your own money is on ${name} right now?`}</span><div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">${nf.format(typed)}</span><span class="caret"></span></div>
${o.loan ? "" : `<div class="segment" style="margin:0 auto"><button${o.owed ? ' aria-pressed="true"' : ""}>Owed</button><button${o.owed ? "" : ' aria-pressed="true"'}>Your own money</button></div>`}
<p class="small muted" style="text-align:center;margin:0">Recorded: <b class="amount">${money(o.recorded)}</b> ${o.owed ? "owed" : "of your own money on it"}</p></div>
<div class="alert neutral" style="align-items:center">${iconSvg("scale")}<span>${o.line} It does not count as spending or in budgets.</span></div>
${field("Note", null, o.note, { opt: true })}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Save adjustment</button></div>`,
    "Adjust balance",
  );

const VISA_DETAIL = { opened: 0, since: "Mar 12, 2026", what: "card", movements: cardMovements() };
const LOAN_DETAIL = {
  opened: LOAN_TAKEN,
  since: "Jan 8, 2026",
  what: "loan",
  movements: loanMovements(),
};

const payFlow = (kind) => {
  if (kind === "form") return decidedTransferForm({ amount: nf.format(CARD_OWED) });
  return debtDetail(VISA, {
    ...VISA_DETAIL,
    sheet: paySheet(VISA, "Pay Visa Gold", {
      cat: transferCatRow(null),
    }),
  });
};

const barStep = (caption, card) =>
  `<div class="stack-sm" style="gap:8px;min-width:0"><span class="xs faint">${caption}</span>${card}</div>`;

const barHowItMoves = () => {
  const card = (owed) => debtCard("available", { ...VISA, owed });
  const loan = (owed) => debtCard("owed", { ...CARLOAN, owed });
  return `<div class="app" style="padding:20px;border-radius:14px;width:100%;max-width:1280px;display:grid;gap:20px">
<div class="stack-sm" style="gap:10px"><span class="eyebrow">A credit card · the bar is the limit in use, and it moves both ways</span>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
${barStep("Today", card(CARD_OWED))}
${barStep("You buy something for $500,000 with it", card(CARD_OWED + 500000))}
${barStep("You pay $1,000,000 towards it", card(CARD_OWED + 500000 - 1000000))}
</div></div>
<div class="stack-sm" style="gap:10px"><span class="eyebrow">A loan · the bar is what you have paid off, and it only grows</span>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
${barStep("Today", loan(LOAN_OWED))}
${barStep("You pay one instalment of $420,000", loan(LOAN_OWED - 420000))}
${barStep("A year of instalments later", loan(LOAN_OWED - 420000 * 12))}
</div></div></div>`;
};

const outsideSheet = (kind) => {
  const lines =
    kind === "income"
      ? `<div class="alert warning">${iconSvg("triangle-alert")}<span>Visa Gold <b class="amount">${money(CARD_OWED)}</b> less owed — and this month’s <b>Income</b> goes up by ${moneyText(CARD_OWED)}, which is not money you earned.</span></div>`
      : `<div class="alert neutral">${iconSvg("scale")}<span>Visa Gold <b class="amount">${money(CARD_OWED)}</b> less owed. It does not count as income or as spending, because the money never was in Ledger Flow.</span></div>`;
  return fullWrap(
    `<div class="stack-sm"><div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">${nf.format(CARD_OWED)}</span><span class="caret"></span></div>
<div class="chips" style="justify-content:center"><button class="chip selected">Everything owed</button><button class="chip">Another amount</button></div></div>
<button class="picker">${tile("circle-dollar-sign", "NONE", "sm")}<span class="body"><span class="lbl">From</span><span class="val">Somewhere else · not an account here</span></span>${iconSvg("chevron-down", "sm")}</button>
${lines}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Pay</button></div>`,
    "Pay Visa Gold",
  );
};

const payFromOutside = (kind) => debtDetail(VISA, { ...VISA_DETAIL, sheet: outsideSheet(kind) });

const adjustmentEdit = (kind) => {
  if (kind === "form") {
    const body = `<div class="segment"><button disabled>Expense</button><button class="income" disabled>Income</button><button class="transfer" disabled>Transfer</button><button aria-pressed="true">Adjustment</button></div>
<span class="help">An adjustment cannot become another kind of transaction. Delete it and record the right one.</span>
<div class="card" style="padding:0"><div class="amount-input"><span class="cur">$</span><span class="num">12,300</span></div></div>
<div class="segment"><button>Increase</button><button aria-pressed="true">Decrease</button></div>
${field("Account", "Bancolombia · Main", null, { icon: "landmark" })}
${field("Date", "Sep 21 · 09:00", null, { icon: "calendar" })}
${field("Note", "August bank fee", null, { icon: "notebook-pen", opt: true })}
<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">Delete</button><button class="btn primary lg" style="flex:1.4">Save changes</button></div>`;
    return screen(body, {
      tab: "mov",
      side: "mov",
      back: true,
      title: "Edit transaction",
      narrow: true,
    });
  }
  const sheet = fullWrap(
    `<div class="stack-sm"><div class="segment"><button>Increase balance</button><button aria-pressed="true">Decrease balance</button></div>
<div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">12,300</span><span class="caret"></span></div></div>
<div class="alert neutral" style="align-items:center">${iconSvg("scale")}<span>Recorded on <b>Sep 21</b>, it took <b class="amount">${money(12300, "−")}</b> off Bancolombia. Changing the amount rewrites that difference, not today's balance.</span></div>
${field("Note", "August bank fee", null, { opt: true })}
<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">Delete</button><button class="btn primary lg" style="flex:1.4">Save changes</button></div>`,
    "Edit adjustment",
  );
  const body = `${heroCard({
    color: "BLUE",
    icon: "landmark",
    eyebrow: "Bank account",
    name: "Bancolombia",
    lead: money(3408200),
    badge: MAIN_BADGE,
    meta: `Opening balance <b class="amount">${money(2500000)}</b> · created Mar 12, 2026 · COP`,
  })}
<div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px"><button class="btn secondary">${iconSvg("scale", "sm")}Adjust balance</button><button class="btn secondary">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary" disabled>${iconSvg("star", "sm")}Main account</button><button class="btn secondary">${iconSvg("archive", "sm")}Archive</button></div>
<div class="section-head"><h3 class="h3">Transactions</h3><a class="link" href="#">Open with filters</a></div>
<div class="list card flush">
<div class="day-head"><span>Sep 21</span><span class="amount">${money(12300, "−")}</span></div>
${row("scale", "GRAY", "Balance adjustment", "09:00 · August bank fee", 12300, "adjustment")}
<div class="day-head"><span>Sep 20</span><span class="amount">${money(78900, "−")}</span></div>
${row("utensils", "ORANGE", "Carulla groceries", "", 78900)}</div>`;
  return screen(body, {
    tab: "cuentas",
    side: "cuentas",
    back: true,
    title: "Bancolombia",
    narrow: true,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
    sheet,
  });
};

const categories = ({ offline = false, transferTab = true } = {}) => {
  const gtile = (name, count, archived = false) => {
    const [ic, col] = CATS[name];
    return `<a class="card stack-sm color-${col}" href="#" style="align-items:center;text-align:center;gap:8px;padding:16px 8px;${archived ? "opacity:.6" : ""}">${tile(ic, col, "lg")}<span style="font-weight:500;font-size:13px" class="truncate">${name}</span><span class="xs faint">${count}</span></a>`;
  };
  const grid = (items) =>
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
    items.map(([n, c]) => gtile(n, c)).join("") +
    "</div>";
  const transferSeg = transferTab ? '<button class="transfer">Transfer · 2</button>' : "";
  const body = `<div class="segment"><button aria-pressed="true">Expense · 8</button><button class="income">Income · 3</button>${transferSeg}</div>
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

const settings = ({
  offline = false,
  update = false,
  scrolled = false,
  installed = false,
} = {}) => {
  const signout = offline
    ? `<button class="btn secondary block" disabled>${iconSvg("log-out", "sm")}Sign out</button><p class="xs muted" role="status" style="text-align:center;margin:0">Signing out needs a connection: your session lives on the server.</p>`
    : `<button class="btn secondary block">${iconSvg("log-out", "sm")}Sign out</button>`;
  const banner = offline
    ? `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> Changes are saved on this device and will sync when you’re back online.<span class="sub">2 changes waiting</span></span></div>`
    : "";
  const top = `<div class="card hstack" style="gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:17px">JD</span><span class="body" style="flex:1;display:flex;flex-direction:column"><span class="h3">John Doe</span><span class="small muted">john@example.com</span><span class="xs faint">Last sign-in today 8:40</span></span>${iconSvg("chevron-right", "sm")}</div>
<span class="eyebrow">Preferences</span>
<div class="list card flush">${settingsRow("globe", "Language", "App language", '<span class="small muted">English</span>', "TEAL")}${settingsRow("coins", "Currency", "Locked: you already have accounts", '<span class="badge">COP</span>', "GREEN")}${settingsRow("clock", "Time zone", "Defines your days and periods", '<span class="small muted">Bogotá</span>', "BLUE")}${settingsRow("palette", "Appearance", "Palette and mode", '<span class="small muted">Tinta · System</span>', "PURPLE")}${settingsRow("bell", "Notifications", "What reaches you, and where", "", "INDIGO")}${settingsRow("tags", "Categories", "13 active · 1 archived", "", "ORANGE")}</div>
<span class="eyebrow">Security</span>
<div class="list card flush">${settingsRow("lock", "Password & email", "Requires your current password", "", "GRAY")}${settingsRow("smartphone", "Active sessions", "Sign out devices you don’t recognize", '<span class="badge">3</span>', "GRAY")}</div>`;
  const body = `${scrolled ? "" : top}
<span class="eyebrow">Data</span>
<div class="list card flush">${settingsRow("refresh-cw", "Sync status", "What this device has, and what it still owes the server", '<span class="badge warning">2</span>', "TEAL")}${settingsRow("download", "Export transactions", "Coming soon", '<span class="badge outline">soon</span>')}${settingsRow("upload", "Import from your bank", "Coming soon", '<span class="badge outline">soon</span>')}</div>
<span class="eyebrow">About</span>
<div class="list card flush">${installed ? `<div class="row" style="cursor:default">${tile("monitor-smartphone", "INDIGO", "sm")}<span class="body"><span class="title">Install app</span><span class="meta">Installed</span></span></div>` : settingsRow("monitor-smartphone", "Install app", `<span class="mobile-only">Add Ledger Flow to your home screen so the browser doesn’t delete what you record offline</span><span class="desktop-only">Install Ledger Flow so the browser doesn’t delete what you record offline</span>`, "", "INDIGO")}${update ? `<div class="row" style="cursor:default">${tile("info", "GRAY", "sm")}<span class="body"><span class="title">Version</span><span class="meta">Ledger Flow v0.2 · a new version is ready</span></span><span class="right" style="flex-direction:row"><button class="btn primary sm">Reload</button></span></div>` : settingsRow("info", "Version", "Ledger Flow v0.2", "", "GRAY")}</div>
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

const deleteAccountScreen = (state = "") => {
  const inner = `<div class="alert danger">${iconSvg("circle-alert")}<span>Your account and your financial history are kept for a while so you can come back: signing up again with the same email and this password brings everything back. You’ll be signed out now.</span></div>
${field("Current password", "••••••••••", null, { help: "So nobody else can delete your account.", ...(state == "wrong" ? { error: "Your current password is wrong." } : {}) })}
<div class="stack-sm"><button class="btn danger solid lg block">Delete account</button><button class="btn ghost lg block">Cancel</button></div>`;
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
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Save adjustment</button></div>`;
    return screen(settingsBodyDim(), {
      tab: "",
      side: "cuentas",
      title: "Accounts",
      sheet: fullWrap(inner, "Adjust balance", { over: UNSAVED_DIALOG }),
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
  if (kind == "switched") {
    return home({
      sheet: `<div class="toast">${iconSvg("check")}Another account signed in on this browser</div>`,
    });
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

const exportSheet = ({ state = "ready", format = "xlsx" } = {}) => {
  const preparing = state == "preparing";
  const noCopy = state.startsWith("no-copy");
  const emptyView = state == "empty-view";
  const counting = state == "counting";
  const radio = (sel) =>
    `<span aria-hidden="true" style="flex:none;width:20px;height:20px;border-radius:50%;box-sizing:border-box;border:${sel ? "6px solid var(--brand)" : "2px solid var(--border-strong)"}"></span>`;
  const scope = (title, meta, sel, off = false) =>
    `<button class="row" role="radio" aria-checked="${sel}"${off ? ' aria-disabled="true"' : ""} style="border-top:1px solid var(--border)${off ? ";opacity:.5" : ""}">${radio(sel)}<span class="body"><span class="title">${title}</span><span class="meta">${meta}</span></span></button>`;
  const viewMeta = emptyView
    ? "Nothing matches these filters"
    : counting
      ? '<span class="skeleton" style="display:inline-block;width:150px;height:10px"></span>'
      : "142 transactions · September · Bancolombia";
  const help =
    format == "xlsx"
      ? "Opens in Excel, Google Sheets and Numbers, with real dates and numbers."
      : "Plain text, comma-separated (UTF-8), for other apps. Excel in Spanish opens it from Data › From Text.";
  const NO_COPY = {
    "no-copy": [
      "cloud-download",
      "This device is still getting your transactions. You can download them as soon as it finishes.",
    ],
    "no-copy-offline": [
      "wifi-off",
      "Needs a connection first: this device doesn’t have your transactions yet.",
    ],
    "no-copy-failing": [
      "cloud-alert",
      "This device couldn’t get your transactions from the server, so there is nothing to download from yet.",
      "Try again",
    ],
    "no-copy-broken": [
      "circle-alert",
      "This device couldn’t open its copy of your data. Reloading the app usually fixes it.",
      "Reload",
    ],
    "no-copy-unsupported": [
      "circle-alert",
      "This browser can’t keep a copy of your data, and the download is made from that copy. Try another browser, or leave private browsing.",
    ],
  };
  const notice = noCopy
    ? `<div class="alert warning">${iconSvg(NO_COPY[state][0])}<span>${NO_COPY[state][1]}${NO_COPY[state][2] ? ` <a href="#" style="color:inherit;font-weight:600">${NO_COPY[state][2]}</a>` : ""}</span></div>`
    : "";
  const dim = noCopy || preparing ? ";opacity:.5;pointer-events:none" : "";
  const footnote = preparing
    ? `<div class="stack-sm" role="status"><div class="progress"><span class="fill" style="width:25%"></span></div><span class="small muted">12,000 of 48,000 transactions</span></div>`
    : `<p class="small muted" style="margin:0">Made on this device from your copy, so it works offline. Anything still waiting to sync is included and marked in the file.</p>`;
  const primary = preparing
    ? `<button class="btn primary lg loading" style="flex:1.4" aria-disabled="true">Preparing file…</button>`
    : `<button class="btn primary lg" style="flex:1.4"${noCopy || counting ? " disabled" : ""}>${iconSvg("download", "sm")}Download</button>`;
  const inner = `${notice}<div class="stack" style="gap:16px${dim}">
<div class="field"><span class="label">What</span><div class="list" role="radiogroup" aria-label="What" style="margin:0 -16px">${scope("What you’re viewing", viewMeta, !emptyView, emptyView)}${scope("All transactions", "48,000 transactions · since March 2016", emptyView)}</div></div>
<div class="field"><span class="label">Format</span><div class="segment" role="group" aria-label="Format"><button aria-pressed="${format == "xlsx"}">${iconSvg("layout-grid", "sm")}Excel (.xlsx)</button><button aria-pressed="${format == "csv"}">${iconSvg("file-text", "sm")}CSV</button></div><span class="help">${help}</span></div></div>
${footnote}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button>${primary}</div>`;
  return transactions({ sheet: sheetWrap(inner, "Download transactions") });
};

const EXPORT_COLUMNS = [
  ["date", "in"],
  ["time", "in"],
  ["type", "in"],
  ["amount", "in"],
  ["currency", "in"],
  ["account", "in"],
  ["to_account", "in"],
  ["category", "in"],
  ["description", "in"],
  ["note", "in"],
  ["tags", "in"],
  ["instant", "app"],
  ["id", "app"],
  ["account_id", "app"],
  ["to_account_id", "app"],
  ["category_id", "app"],
  ["your_share", "out"],
  ["to_review", "out"],
  ["source", "out"],
  ["sync", "out"],
];
// prettier-ignore
const EXPORT_ROWS = [
  ["2026-09-20", "11:05", "EXPENSE", "-78900", "COP", "Bancolombia", "", "Food", "Carulla groceries", "", "", "2026-09-20T16:05:00Z", "3f2a9c1e-…", "a61c…", "", "c902…", "-26300", "false", "MANUAL", ""],
  ["2026-09-21", "09:00", "INCOME", "4200000", "COP", "Bancolombia", "", "Salary", "August salary", "", "", "2026-09-21T14:00:00Z", "8b41d0f7-…", "a61c…", "", "c1f7…", "", "false", "MANUAL", ""],
  ["2026-09-21", "12:30", "TRANSFER", "1000000", "COP", "Bancolombia", "Savings", "", "", "", "", "2026-09-21T17:30:00Z", "c07e5a92-…", "a61c…", "b3d0…", "", "", "false", "MANUAL", ""],
  ["2026-09-21", "18:10", "EXPENSE", "-18400", "COP", "Visa Gold", "", "Transport", "Uber to work", "", "", "2026-09-21T23:10:00Z", "1d9f3b68-…", "e72b…", "", "c4a8…", "", "false", "MANUAL", ""],
  ["2026-09-22", "07:55", "EXPENSE", "-9800", "COP", "Cash", "", "Coffee", "Pergamino Coffee", "Oat milk", "coffee, latte", "2026-09-22T12:55:00Z", "e5a2c4d0-…", "f09d…", "", "c7e3…", "", "false", "MANUAL", ""],
  ["2026-09-22", "08:42", "EXPENSE", "-12500", "COP", "Bancolombia", "", "", "", "", "", "2026-09-22T13:42:00Z", "7c3b81fa-…", "a61c…", "", "", "", "true", "QUICK", "PENDING"],
];

const exportFile = () => {
  const cell =
    "padding:6px 10px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);white-space:nowrap";
  const shade = (kind) =>
    kind == "out" ? ";color:var(--text-3)" : kind == "app" ? ";color:var(--text-2)" : "";
  const group = (n, label, kind) =>
    `<th colspan="${n}" style="${cell};text-align:left;font-weight:500;background:var(--surface-2)${shade(kind)}">${label}</th>`;
  const groups = `<tr>${group(11, "What you write · a template needs only these", "in")}${group(5, "Written by the app · an import uses them when present", "app")}${group(4, "Written for you · ignored by an import", "out")}</tr>`;
  const head = EXPORT_COLUMNS.map(
    ([c, kind]) =>
      `<th class="mono" style="${cell};text-align:left;font-weight:600${shade(kind)}">${c}</th>`,
  ).join("");
  const rows = EXPORT_ROWS.map(
    (r) =>
      `<tr>${r.map((v, i) => `<td class="${i == 3 || i == 16 ? "amount" : ""}" style="${cell}${i == 3 || i == 16 ? ";text-align:right" : ""}${shade(EXPORT_COLUMNS[i][1])}">${v}</td>`).join("")}</tr>`,
  ).join("");
  const body = `<div class="card flush" style="overflow:auto"><table class="small" style="border-collapse:collapse;min-width:100%"><thead>${groups}<tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
<div class="list card flush">
<div class="row"><span class="body"><span class="title">ledger-flow-transactions-2026-09.xlsx</span><span class="meta">Sheet “Transactions”: these columns, header frozen, filters on, a list to pick the type from in the whole column. Sheet “About”, in your language: what every column means, which ones an import reads, the filters and search in force, the time zone and when.</span></span></div>
<div class="row"><span class="body"><span class="title">ledger-flow-transactions-2026-09.csv</span><span class="meta">The same columns. UTF-8 with BOM, comma-separated, quoted where needed, CRLF; a dot for decimals and no thousands separator.</span></span></div>
<div class="row"><span class="body"><span class="title">Use it as a template</span><span class="meta">Delete the rows, keep the header, write your own in the first eleven columns: a row with no id is a new transaction. A download is not a backup: a shared expense comes back as a plain expense, and payments between people are not imported.</span></span></div>
</div>`;
  return `<div class="page" style="padding:16px;display:flex;flex-direction:column;gap:12px">${body}</div>`;
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
<div class="field"><span class="label">Type</span><div class="chips"><button class="chip selected">All</button><button class="chip">Expenses</button><button class="chip">Income</button><button class="chip">Transfers</button><button class="chip">${iconSvg("scale", "sm")}Adjustments</button><button class="chip">${iconSvg("hand-coins", "sm")}Payments between people</button></div></div>
<div class="field"><span class="label">Account</span><div class="chips">${acc("landmark", "BLUE", "Bancolombia", true)}${acc("banknote", "GRAY", "Cash")}${acc("credit-card", "PURPLE", "Visa Gold")}${acc("piggy-bank", "GREEN", "Savings")}</div></div>
<div class="field"><span class="label">Category</span><div class="chips">${catChip("Food")}${catChip("Transport", true)}${catChip("Coffee")}${catChip("Lifestyle")}<button class="chip">${iconSvg("search", "sm")}More</button><button class="chip">${iconSvg("hash", "sm")}Uncategorized</button></div></div>
<div class="field"><span class="label">Tag</span><div class="input" style="height:40px">${iconSvg("tag", "sm")}<span class="placeholder" style="flex:1">#latte, #groceries…</span></div></div>
<div class="hstack" style="gap:10px"><button class="switch" aria-checked="true" aria-label="Only what is still to review"></button><span class="small">Only what is still to review</span></div>
<div class="hstack" style="gap:10px"><button class="switch" aria-checked="false" aria-label="Only quick entries"></button><span class="small">Only quick entries (source QUICK)</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Clear</button><button class="btn primary lg" style="flex:1.4">Show 12 transactions</button></div></div>`;
  return screen(settingsBodyDim(), {
    tab: "mov",
    side: "mov",
    title: "Transactions",
    sheet: fullWrap(inner, "Filters"),
  });
};

const transactionFormBodyDim = () =>
  '<div class="segment"><button aria-pressed="true">Expense</button><button class="income">Income</button><button class="transfer">Transfer</button></div><div class="amount-input" style="padding-top:8px"><span class="cur">$</span><span class="num">18,400</span></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:120px"></div>';

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
    sheet: fullWrap(inner, "Category"),
  });
};

const accountPicker = (kind = "all") => {
  const r = (name, typ, col, bal, sel = false, neg = false, main = false) => {
    const badge = main ? '<span class="badge brand">Main</span>' : "";
    const amt = `<span class="amount">${neg ? "−" : ""}${money(bal)}</span>`;
    return `<button class="row" style="border-top:1px solid var(--border)">${tile(ACCT_TYPE_ICON[typ], col)}<span class="body"><span class="title"><span>${name}</span>${badge}</span><span class="meta">${ACCT_TYPE_LABEL[typ]}</span></span><span class="right">${amt}${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  };
  const debtRow = (a) => {
    const face = debtFace(DEBT_LEAD, a);
    return `<button class="row" style="border-top:1px solid var(--border)">${tile(ACCT_TYPE_ICON[a.typ], a.color)}<span class="body"><span class="title"><span>${a.name}</span></span><span class="meta">${face.type}</span></span><span class="right"><span class="amount">${face.lead}</span></span></button>`;
  };
  const outside = `<button class="row" style="border-top:1px solid var(--border)">${tile("circle-dollar-sign", "NONE")}<span class="body"><span class="title"><span>Somewhere else</span></span><span class="meta">Not an account here</span></span><span class="right"></span></button>`;
  const income = kind === "income";
  const offersOutside = kind === "outside";
  const rows =
    r("Bancolombia", "ACCOUNT", "BLUE", 3420500, true, false, true) +
    r("Cash", "CASH", "GRAY", 184000) +
    (income ? "" : (offersOutside ? "" : debtRow(VISA)) + debtRow(CARLOAN)) +
    r("Savings", "SAVINGS", "GREEN", 8900000) +
    (offersOutside ? outside : "");
  const note = income
    ? "Archived accounts are not listed. Balances update as you save. Money arriving at a card or a loan is a <b>payment</b>, not income: record it as a transfer from wherever it came from."
    : offersOutside
      ? "Archived accounts are not listed. Balances update as you save. <b>Somewhere else</b> is not an account and creates nothing: it records a payment made with money Ledger Flow does not track."
      : "Archived accounts are not listed. Balances update as you save.";
  const inner = `<div class="list" style="margin:0 -16px">${rows}</div>
<p class="xs faint" style="margin:0">${note}</p>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: fullWrap(inner, "Account"),
  });
};

const publicShell = (inner) => {
  const logo = '<span class="logo">' + iconSvg("layers", "sm") + "</span>";
  const nav = `<header class="public-nav"><a class="brand" href="#" style="padding:0">${logo}<span class="brand-name">Ledger Flow</span></a>
<nav class="links"><a href="#">Features</a><a href="#">How it works</a><a href="#">Privacy</a></nav>
<div class="hstack"><button class="chip" style="height:32px">${iconSvg("globe", "sm")}EN</button><a class="btn ghost" href="#">Sign in</a><a class="btn primary" href="#">Get started</a></div></header>`;
  const foot = `<footer class="public-footer"><div class="inner"><span>&copy; 2026 Ledger Flow</span><span class="hstack" style="gap:16px"><a href="#">Privacy policy</a><a href="#">Terms</a><a href="#">Data processing (Ley 1581)</a><a href="#">Contact</a></span><span class="hstack" style="gap:8px">${iconSvg("globe", "sm")}English &middot; <a href="#">Espa&ntilde;ol</a></span></div></footer>`;
  return `<div class="public">${nav}<main class="public-main">${inner}</main>${foot}</div>`;
};

const landing = () => {
  const hero = `<section class="hero"><div class="stack" style="gap:20px"><span class="badge brand" style="align-self:flex-start">${iconSvg("sparkles")}Free &middot; no card needed</span>
<h1>See where your money actually goes.</h1>
<p>Log an expense in three seconds, put a ceiling on the month, and split the bills you share with friends, family or roommates &mdash; then see exactly where your money went.</p>
<div class="cta"><a class="btn primary lg" href="#">Create your free account</a><a class="btn secondary lg" href="#">Sign in</a></div>
<span class="small faint">Works offline &middot; Installs like an app &middot; English &amp; Espa&ntilde;ol &middot; Your data stays yours</span></div>
<div class="phone"><div class="app">${home()}</div></div></section>`;
  const head = (eyebrow, title) =>
    `<div class="stack-sm" style="text-align:center"><span class="eyebrow">${eyebrow}</span><h2 class="h1" style="font-size:28px">${title}</h2>`;
  const feature = (icon, color, title, body) =>
    `<div class="card feature">${tile(icon, color, "lg")}<span class="h3">${title}</span><p>${body}</p></div>`;
  const feats = `<section class="stack" style="gap:24px">${head("Why Ledger Flow", "All your money, in one app")}
<p class="muted" style="max-width:62ch;margin:8px auto 0">Ledger Flow is a free expense tracker and budget app for everyday personal finance. You log what you spend, it keeps every account balance right, it splits the bills you share with other people, and it shows you where your money goes &mdash; by category, by month, and against the budgets you set.</p></div>
<div class="feature-grid">
${feature("zap", "AMBER", "Three-second capture", "Tap, type the amount, done. It suggests what you wrote before, and the category can wait in your review inbox: the expense already counts.")}
${feature("chart-pie", "INDIGO", "Budgets that talk back", "Weekly, monthly, yearly or your own dates, for everything or per category, with pace and days left in plain language &mdash; not just a bar.")}
${feature("users", "TEAL", "Shared expenses", "Trips, rent, dinners out: split each bill your way and always know who owes you and how much, across every group.")}
${feature("chart-column", "GREEN", "Stats and trends", "Where the money went by category, day, tag or account, and up to a year of income against spending with your savings rate.")}
${feature("wallet", "BLUE", "Every account you have", "Cash, bank accounts, credit and debit cards, savings, investments and loans. Every movement keeps the balance right.")}
${feature("wifi-off", "PURPLE", "Works without signal", "Log on the bus or abroad, and install it on your phone or computer. Everything syncs when you are back online, with nothing duplicated.")}</div></section>`;
  const check = (text) => `<li>${iconSvg("circle-check", "sm")}<span>${text}</span></li>`;
  const sharedCard = `<div class="spotlight-mock stack" style="gap:12px">${sharedSeg("people")}${sharedSummary()}
<div class="list card flush">
${personRow("Beto Cano", "Cartagena trip · Night out", 526300, "owes you")}
${personRow("Ana Ruiz", "Cartagena trip · Night out", 26300, "owes you")}
${personRow("Diego Pardo", "Rent · September", 60000, "you owe")}
</div></div>`;
  const shared = `<section class="spotlight"><div class="stack" style="gap:16px"><span class="eyebrow">Shared expenses</span><h2 class="h1" style="font-size:28px;margin:0">Split bills with friends, family and roommates</h2>
<p class="muted" style="margin:0">A trip, the rent, a night out: put the bill in a shared group, say how it splits, and Ledger Flow keeps the tally for everyone &mdash; what each person owes, what they have paid and what is left.</p>
<ul class="checks">${check("Split equally, by percent, by exact amounts, or a fixed part and the rest.")}${check("See what each person owes you across every group, and what you owe them.")}${check("Get paid in parts or in cash: money paid back is not counted as income.")}${check("Add anyone by name: nobody needs an account. If they use Ledger Flow too, invite them with their email and they can see the group.")}</ul></div>
${sharedCard}</section>`;
  const steps = `<section class="stack" style="gap:24px">${head("How it works", "Up and running in a minute")}</div>
<div class="steps"><div class="step"><span class="n">1</span><div><span class="h3">Create your account</span><p class="small muted" style="margin:4px 0 0">Pick your currency once. Email and password, nothing else.</p></div></div>
<div class="step"><span class="n">2</span><div><span class="h3">Add your first account</span><p class="small muted" style="margin:4px 0 0">Cash, bank or card, with today&rsquo;s balance.</p></div></div>
<div class="step"><span class="n">3</span><div><span class="h3">Set a monthly ceiling</span><p class="small muted" style="margin:4px 0 0">Then log expenses as they happen. That is the whole habit.</p></div></div></div>
<div class="hstack" style="justify-content:center"><a class="btn primary lg" href="#">Start now &mdash; it&rsquo;s free</a></div></section>`;
  const qa = (q, a) => `<div class="qa"><h3 class="h3">${q}</h3><p>${a}</p></div>`;
  const faq = `<section class="faq">${head("Questions", "Frequently asked questions")}</div>
${qa("Is Ledger Flow free?", "Yes. Creating an account costs nothing and asks for no card.")}
${qa("Does it connect to my bank?", "No. You record your own movements, so Ledger Flow never asks for your bank details or passwords.")}
${qa("Does it work without internet?", "Yes. What you record offline is saved on your device and syncs when the connection comes back. Installing the app keeps that copy safe from the browser&rsquo;s clean-ups.")}
${qa("Do the people I split with need an account?", "No. Add anyone to a shared group by name. If they also use Ledger Flow, invite them with the email of their account: the group appears in their Shared, and once you mark their part paid they can add it to their own ledger. Nothing is emailed, so let them know.")}
${qa("Can I use it on my phone and my computer?", "Yes. It runs in the browser of any phone, tablet or computer, installs like an app on Android, iPhone and desktop, and keeps your data in sync across all of them.")}
${qa("Who can see my data?", "Only you, and the people you invite to see a shared group. We don&rsquo;t sell data or use it for advertising, and you can delete your account from Settings.")}</section>`;
  return publicShell(hero + feats + shared + steps + faq);
};

const notFound = () => {
  const inner = `<div class="empty" style="padding-top:96px">${tile("search", "NONE", "lg")}<h1 class="h1">Page not found</h1><p class="muted" style="margin:0;max-width:360px">The address may be wrong or the page may have moved. Your money is where you left it.</p><div class="hstack" style="gap:10px;margin-top:8px"><a class="btn primary" href="#">Go to Home</a><a class="btn ghost" href="#">Back</a></div></div>`;
  return publicShell(inner);
};

const legal = () => {
  const inner = `<article class="legal"><span class="eyebrow">Legal &middot; updated Sep 25, 2026</span><h1 class="h1">Privacy policy</h1>
<p>Ledger Flow stores the financial records you enter so you can see them on any device. This page explains what we keep, why, and how you control it. It also serves as our data processing policy under Colombia&rsquo;s Ley 1581 de 2012.</p>
<h2>What we store</h2><ul><li>Your name, email, language, time zone and currency.</li><li>Accounts, categories, transactions and budgets you create, including notes and tags.</li><li>Device sessions (browser type, time of sign-in) so you can review and revoke them.</li><li>People you add (a name, a colour and, if you give one, an email) and the shared groups you create, with their expenses and payments.</li><li>If you join a group someone shares with you, its owner and the others in it see the name on your profile.</li></ul>
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
      sheet: fullWrap(inner, "Fix the date"),
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
    sheet: fullWrap(inner, "Resolve sync conflict"),
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

const deleteLocalCopy = ({ elsewhere = 0 } = {}) => {
  const others = elsewhere
    ? ` It also deletes <b>${elsewhere} unsent changes from another account</b> that signed in on this browser.`
    : "";
  const inner =
    `<div class="alert danger">${iconSvg("trash-2")}<span>This deletes the copy of your data on this device and ` +
    `<b>2 changes that only exist here</b>. It does not delete your account: signing in again downloads ` +
    `everything the server has.${others}</span></div>` +
    '<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button>' +
    '<button class="btn danger lg" style="flex:1.4">Delete everything</button></div>';
  return screen(settingsBodyDim(), {
    tab: "inicio",
    side: "inicio",
    title: "Home",
    sheet: sheetWrap(inner, "Delete everything on this device?"),
  });
};

const INSTALL_STEPS = {
  "ios-safari": [
    `Tap Share ${iconSvg("share", "sm")}`,
    "Choose “Add to Home Screen”",
    "Confirm with “Add”",
  ],
  "ios-other": [
    `Tap Share, in the address bar or in the browser menu ${iconSvg("share", "sm")}`,
    "Choose “Add to Home Screen”",
    "Confirm with “Add”",
  ],
  android: ["Open the browser menu", "Choose “Install app” or “Add to Home screen”"],
  desktop: [
    "Look for the install icon in the address bar",
    "Or open the browser menu and choose “Install Ledger Flow”",
  ],
  "mac-safari": [`Open the File menu, or Share ${iconSvg("share", "sm")}`, "Choose “Add to Dock”"],
  samsung: [
    "Tap the install icon in the address bar",
    "Or open the menu and choose “Add page to”, then “Home screen”",
  ],
};

const installLink = (text) =>
  `<a href="#" style="color:var(--brand-text);font-weight:500;text-decoration:underline;text-underline-offset:2px">${text}</a>`;

// T-197 · the sheet follows the browser in use: its prompt where it offers one, its own steps where not.
const installSheet = (kind = "prompt", { granted = false } = {}) => {
  const list = (steps) =>
    `<ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${steps.map((t) => `<li>${t}</li>`).join("")}</ol>`;
  const intro =
    `<div class="alert info">${iconSvg("monitor-smartphone")}<span>Installing keeps your offline data safe: the ` +
    `browser stops treating it as something it can delete.</span></div>`;
  const asked = granted
    ? ""
    : `<p class="small muted" style="margin:0">The app already asked this browser to keep your data and it said ` +
      `no — browsers don’t ask you, they decide, and installing is what changes that.</p>`;
  const warning =
    "If Android warns that it may be dangerous, tap “More details”, then “Install anyway”.";
  let tail;
  if (kind === "prompt") {
    tail = `<button class="btn primary lg block">${iconSvg("download", "sm")}Install</button>`;
  } else if (kind === "samsung" || kind === "samsung-steps") {
    tail =
      `<p class="small muted" style="margin:0">From Samsung Internet, Android flags the app as dangerous: it objects ` +
      `to the way Samsung packages it, not to the app. Chrome installs it with no warning.</p>` +
      `<a class="btn primary lg block" href="#">${iconSvg("external-link", "sm")}Install with Chrome</a>` +
      (kind === "samsung"
        ? `<p class="xs muted" style="margin:0">No Chrome, or it didn’t open? ${installLink("Install it here")}. ${warning}</p>`
        : `<p class="xs muted" style="margin:0">No Chrome, or it didn’t open? Install it from Samsung Internet:</p>` +
          list(INSTALL_STEPS.samsung) +
          `<p class="xs muted" style="margin:0">${warning}</p>`);
  } else {
    const closing =
      kind === "ios-other"
        ? "If your browser doesn’t offer it, open this page in Safari and add it from there."
        : "Some browsers don’t offer this at all. If yours doesn’t, keep a connection when you record and nothing will be waiting here.";
    tail = list(INSTALL_STEPS[kind]) + `<p class="xs muted" style="margin:0">${closing}</p>`;
  }
  return screen(settingsBodyDim(), {
    tab: "",
    side: "ajustes",
    title: "Settings",
    narrow: true,
    sheet: sheetWrap(intro + asked + tail, "Install this app"),
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
<div class="stats" style="grid-template-columns:1fr 1fr;gap:10px"><div class="card stat"><span class="k">What you have</span><span class="projected"><span class="v amount">${money(13738000)}</span>${mark}</span></div><div class="card stat"><span class="k">Income</span><span class="v amount income">${money(4200000, "+")}</span></div></div>
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

const TYPE_LINE = {
  EXPENSE: "Money leaving one of your accounts and not coming back.",
  INCOME: "Money arriving into one of your accounts.",
  TRANSFER:
    "Moves money between two of your own accounts: paying a card, a loan instalment, putting money aside. Nothing is spent and nothing is earned.",
};

const PAY_AMOUNT = 500000;
const BANCO_BAL = 3420500;
const CARD_AVAILABLE = CARD_LIMIT - CARD_OWED;
const INSTALMENT = 420000;
const INSTALMENT_INTEREST = 126000;
const INSTALMENT_PRINCIPAL = INSTALMENT - INSTALMENT_INTEREST;

const PAY_SIDES = {
  from: ["landmark", "BLUE", `Bancolombia · ${moneyText(BANCO_BAL)}`],
  to: ["credit-card", "PURPLE", `Visa Gold · ${moneyText(CARD_AVAILABLE)} available`],
};

const HELP_BUTTON = `<button class="btn secondary icon-only sm round" aria-label="What the three types mean" style="flex:none">${iconSvg("circle-help", "sm")}</button>`;

const typeLine = (kind, help = true) =>
  `<div class="hstack" style="gap:8px;align-items:flex-start"><span class="help" style="flex:1">${TYPE_LINE[kind]}</span>${help ? HELP_BUTTON : ""}</div>`;

const readbackLine = (inner, foot = "") =>
  `\n<div class="alert neutral">${iconSvg("arrow-left-right")}<span>${inner}</span></div>${foot}`;

const TWO_SIDES = readbackLine(
  `Bancolombia <b class="amount">${money(PAY_AMOUNT, "−")}</b> · Visa Gold <b class="amount">${money(PAY_AMOUNT)}</b> less owed.`,
);

const SAVINGS_AMOUNT = 300000;
const SAVINGS_BAL = 8900000;

const OUTSIDE_SIDES = {
  from: ["circle-dollar-sign", "NONE", "Somewhere else \u00b7 not an account here"],
  to: ["credit-card", "PURPLE", `Visa Gold \u00b7 ${moneyText(CARD_AVAILABLE)} available`],
};

const OUTSIDE_ONE_SIDE = `\n<div class="alert neutral">${iconSvg("scale")}<span>Visa Gold <b class="amount">${money(PAY_AMOUNT)}</b> less owed. It does not count as income or as spending, because the money never was in Ledger Flow.</span></div>`;

const PLAIN_SIDES = {
  from: ["landmark", "BLUE", `Bancolombia · ${moneyText(BANCO_BAL)}`],
  to: ["piggy-bank", "GREEN", `Savings · ${moneyText(SAVINGS_BAL)}`],
};

const PLAIN_TWO_SIDES = readbackLine(
  `Bancolombia <b class="amount">${money(SAVINGS_AMOUNT, "−")}</b> · Savings <b class="amount">${money(SAVINGS_AMOUNT, "+")}</b>.`,
);

const projectedFigure = (inner) =>
  `<span class="projected"><b class="amount">${inner}</b><span class="tooltip">${iconSvg("cloud-off")}<span class="tip">Includes changes not yet synced</span></span></span>`;

const NEW_BALANCES = readbackLine(
  `Bancolombia ${moneyText(BANCO_BAL)} → ${projectedFigure(money(BANCO_BAL - PAY_AMOUNT))}<br>Visa Gold ${moneyText(CARD_AVAILABLE)} available → ${projectedFigure(money(CARD_AVAILABLE + PAY_AMOUNT))} available`,
  `\n<span class="help">Worked out on this device from the balances it holds, not sent by the server.</span>`,
);

const intentChip = (icon, label, selected) =>
  `<button class="chip${selected ? " selected" : ""}">${iconSvg(icon, "sm")}${label}</button>`;

const intentChips = (only, taken = "card") =>
  `<div class="stack-sm"><span class="label">What are you doing? <span class="opt">optional</span></span>
<div class="chips">${
    only
      ? intentChip("credit-card", "Pay a card or a loan", true)
      : intentChip("credit-card", "Pay a card", taken === "card") +
        intentChip("hand-coins", "Pay a loan", taken === "loan") +
        intentChip("piggy-bank", "Move to savings", taken === "savings")
  }</div></div>`;

const SEED_CAT_ICON = {
  Transfer: "repeat",
  "Credit Card Payment": "credit-card",
  "Loan payment": "car",
};

const seedChip = (name, selected = false) =>
  `<button class="chip cat color-GRAY${selected ? " selected" : ""}"><span class="dot">${iconSvg(SEED_CAT_ICON[name])}</span>${name}</button>`;

const transferCatRow = (selected, help = false) =>
  `<div class="stack-sm"><span class="label">Category <span class="opt">optional</span></span>
<div class="chips">${seedChip("Credit Card Payment", selected === "Credit Card Payment")}${seedChip("Transfer", selected === "Transfer")}<button class="chip">${iconSvg("search", "sm")}Search</button></div>${help ? '<span class="help">Only the categories you marked as Transfer are offered here.</span>' : ""}</div>`;

const TRANSFER_CAT = transferCatRow("Credit Card Payment", true);

const typeRow = (icon, color, name, line) =>
  `<div class="row">${tile(icon, color, "sm")}<span class="body"><span class="title">${name}</span><span class="meta">${line}</span></span></div>`;

const TYPES_SHEET = sheetWrap(
  `<div class="list card flush">${typeRow("trending-down", "RED", "Expense", TYPE_LINE.EXPENSE)}${typeRow("trending-up", "GREEN", "Income", TYPE_LINE.INCOME)}${typeRow("repeat", "GRAY", "Transfer", TYPE_LINE.TRANSFER)}</div>`,
  "What the three types mean",
);

const INTEREST_FIELD = field("Of which interest", moneyText(INSTALMENT_INTEREST), null, {
  icon: "percent",
  opt: true,
  help: "What the lender charged you this month. The rest lowers what you owe.",
});

const instalmentSheet = (kind) => {
  const splitRead = `Bancolombia <b class="amount">${money(INSTALMENT, "−")}</b> · Car loan <b class="amount">${money(INSTALMENT_PRINCIPAL)}</b> less owed.<br><b class="amount">${money(INSTALMENT_INTEREST)}</b> of it is <b>spending</b>: it shows in Stats under <i>Interest</i>.`;
  const parts = {
    one: {
      extra: "",
      read: readbackLine(
        `Bancolombia <b class="amount">${money(INSTALMENT, "−")}</b> · Car loan <b class="amount">${money(INSTALMENT)}</b> less owed.`,
      ),
    },
    two: {
      extra: INTEREST_FIELD,
      read:
        readbackLine(splitRead) +
        `\n<div class="list card flush" style="margin:0">${row("repeat", "GRAY", "Bancolombia → Car loan", "Transfer · pays the loan down", INSTALMENT_PRINCIPAL, "transfer")}${row("percent", "RED", "Car loan interest", "Expense · Interest", INSTALMENT_INTEREST)}</div>
<span class="help">Two movements, written together by this sheet.</span>`,
    },
    field: {
      extra: INTEREST_FIELD,
      read:
        readbackLine(splitRead) +
        `\n<span class="help">One movement. The server keeps the interest inside it and Stats reads it from there.</span>`,
    },
    broken: {
      extra: INTEREST_FIELD,
      read: `\n<div class="alert warning">${iconSvg("triangle-alert")}<span><b>Only half of this arrived.</b> The payment of <b class="amount">${money(INSTALMENT_PRINCIPAL)}</b> is on the server; the interest of <b class="amount">${money(INSTALMENT_INTEREST)}</b> was refused. Send it again, or delete the payment and start over.</span></div>
<div class="list card flush" style="margin:0">${row("repeat", "GRAY", "Bancolombia → Car loan", "Transfer · pays the loan down", INSTALMENT_PRINCIPAL, "transfer", { badges: '<span class="badge success">Saved</span>' })}${row("percent", "RED", "Car loan interest", "Expense · Interest", INSTALMENT_INTEREST, "expense", { badges: '<span class="badge danger">Refused</span>' })}</div>`,
    },
  }[kind];
  return paySheet(CARLOAN, "Pay Car loan", {
    amount: INSTALMENT,
    cat: transferCatRow(null),
    extra: parts.extra,
    read: parts.read,
    action: kind === "broken" ? "Send it again" : "Pay",
  });
};

const transferRow = (icon, title, meta, amt) => row(icon, "GRAY", title, meta, amt, "transfer");

const transferList = () =>
  screen(
    `<div class="list card flush">
<div class="day-head"><span>September</span></div>
${transferRow("credit-card", "Bancolombia → Visa Gold", "Credit Card Payment", 500000)}
${transferRow("car", "Bancolombia → Car loan", "Loan payment", INSTALMENT)}
${transferRow("piggy-bank", "Bancolombia → Savings", "Transfer", 300000)}
<div class="day-head"><span>August</span></div>
${transferRow("credit-card", "Bancolombia → Visa Gold", "Credit Card Payment", 740000)}
${transferRow("car", "Bancolombia → Car loan", "Loan payment", INSTALMENT)}
${transferRow("piggy-bank", "Bancolombia → Savings", "Transfer", 300000)}</div>
<p class="xs faint">Today the second line of each of these rows is the word “Payment” or “Transfer”, typed by hand into the description or left blank — nothing groups them and nothing counts them.</p>`,
    { tab: "mov", side: "mov", title: "Transfers", narrow: true },
  );

const decidedTransferForm = (o = {}) =>
  transactionForm("TRANSFER", {
    hint: typeLine("TRANSFER"),
    transfer: PAY_SIDES,
    amount: nf.format(PAY_AMOUNT),
    intents: intentChips(false),
    cat: TRANSFER_CAT,
    readback: TWO_SIDES,
    ...o,
  });

const addMovement = (kind) =>
  ({
    "line-every-type": () => transactionForm("EXPENSE", { hint: typeLine("EXPENSE") }),
    "line-transfer": () =>
      transactionForm("TRANSFER", { hint: typeLine("TRANSFER"), transfer: PAY_SIDES }),
    "line-quick": () =>
      home({ sheet: quickSheet({ type: "transfer", handle: "wide", hint: typeLine("TRANSFER") }) }),
    "line-in-a-sheet": () => decidedTransferForm({ sheet: TYPES_SHEET }),
    "readback-two-sides": () =>
      transactionForm("TRANSFER", {
        transfer: PAY_SIDES,
        amount: nf.format(PAY_AMOUNT),
        readback: TWO_SIDES,
      }),
    "readback-balances": () =>
      transactionForm("TRANSFER", {
        transfer: PAY_SIDES,
        amount: nf.format(PAY_AMOUNT),
        readback: NEW_BALANCES,
      }),
    "readback-none": () =>
      transactionForm("TRANSFER", { transfer: PAY_SIDES, amount: nf.format(PAY_AMOUNT) }),
    "intent-three": () =>
      transactionForm("TRANSFER", {
        transfer: PAY_SIDES,
        amount: nf.format(PAY_AMOUNT),
        intents: intentChips(false),
        readback: TWO_SIDES,
      }),
    "intent-one": () =>
      transactionForm("TRANSFER", {
        transfer: PAY_SIDES,
        amount: nf.format(PAY_AMOUNT),
        intents: intentChips(true),
        readback: TWO_SIDES,
      }),
    "intent-none": () =>
      debtDetail(VISA, {
        ...VISA_DETAIL,
        sheet: paySheet(VISA, "Pay Visa Gold", {
          cat: transferCatRow(null),
        }),
      }),
    "transfer-category": () =>
      transactionForm("TRANSFER", {
        transfer: PAY_SIDES,
        amount: nf.format(PAY_AMOUNT),
        readback: TWO_SIDES,
        cat: TRANSFER_CAT,
      }),
    "transfer-categories-gone": () => categories({ transferTab: false }),
    "transfer-list": () => transferList(),
    one: () => debtDetail(CARLOAN, { ...LOAN_DETAIL, sheet: instalmentSheet("one") }),
    two: () => debtDetail(CARLOAN, { ...LOAN_DETAIL, sheet: instalmentSheet("two") }),
    field: () => debtDetail(CARLOAN, { ...LOAN_DETAIL, sheet: instalmentSheet("field") }),
    broken: () => debtDetail(CARLOAN, { ...LOAN_DETAIL, sheet: instalmentSheet("broken") }),
  })[kind]();

// Everything below is the preview itself — navigation, search, dates — not the app's design.

// T-72 · what the More tab opens; `withAccounts` false is the discarded avatar variant.
const navMenuSheet = (withAccounts, news = 0, invites = 0) => {
  const acc = withAccounts ? settingsRow("wallet", "Accounts", "4 accounts", "", "BLUE") : "";
  const notif = settingsRow(
    "bell",
    "Notifications",
    news ? `${news} new` : "Nothing new",
    "",
    "INDIGO",
  );
  return fullWrap(
    `<div class="list card flush">${acc}${settingsRow("users", "Shared", invites ? `${invites} invitation${invites > 1 ? "s" : ""} waiting for you` : `${moneyText(OWED_TO_YOU)} owed to you`, invites ? `<span class="badge brand">${invites}<span class="sr-only"> waiting</span></span>` : "", "PURPLE")}${notif}${settingsRow("chart-column", "Stats", "Where the money went", "", "TEAL")}${settingsRow("tags", "Categories", "13 active · 1 archived", "", "ORANGE")}${settingsRow("settings", "Settings", "Profile, currency, appearance", "", "GRAY")}</div>
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

// T-150 · on a phone a sheet is a full-screen dialog or a centred one; from 600px up, the modal it was.
const KEYBOARD_H = { numeric: 232, text: 232 };

const keyboard = (kind) => {
  const key = (label, o = {}) =>
    `<span class="key${o.fn ? " fn" : ""}"${o.span ? ` style="grid-column:span ${o.span}"` : ""}>${label}</span>`;
  const keys = (cols, row) =>
    `<div class="keys" style="grid-template-columns:repeat(${cols},1fr)">${row.join("")}</div>`;
  const rows =
    kind === "numeric"
      ? [
          keys(
            4,
            ["1", "2", "3", "\u2212"].map((k, i) => key(k, { fn: i === 3 })),
          ),
          keys(
            4,
            ["4", "5", "6", "\u2423"].map((k, i) => key(k, { fn: i === 3 })),
          ),
          keys(
            4,
            ["7", "8", "9", "\u232b"].map((k, i) => key(k, { fn: i === 3 })),
          ),
          keys(
            4,
            [",", "0", ".", "\u21b5"].map((k, i) => key(k, { fn: i !== 1 })),
          ),
        ]
      : [
          keys(
            10,
            [..."qwertyuiop"].map((k) => key(k)),
          ),
          keys(
            20,
            [..."asdfghjkl"].map((k) => key(k, { span: 2 })),
          ),
          keys(10, [
            key("\u21e7", { fn: true, span: 2 }),
            ...[..."zxcvbn"].map((k) => key(k)),
            key("\u232b", { fn: true, span: 2 }),
          ]),
          keys(10, [
            key("?123", { fn: true, span: 2 }),
            key(","),
            key("", { span: 4 }),
            key("."),
            key("\u21b5", { fn: true, span: 2 }),
          ]),
        ];
  return `<div class="kbd" aria-hidden="true" style="height:${KEYBOARD_H[kind]}px">${rows.join("")}</div>`;
};

const keyboardUnder = (html, kind, scrimClass) => {
  const style = kind ? ` style="bottom:${KEYBOARD_H[kind]}px"` : "";
  return html.replace(
    '<div class="scrim">',
    `${kind ? keyboard(kind) : ""}<div class="scrim ${scrimClass}"${style}>`,
  );
};

const fullScreen = ({
  title,
  body,
  action = null,
  lead = "",
  secondary = "",
  footer = "",
  keyboard: kind = null,
  over = "",
}) => {
  const close = `<button class="btn ghost icon-only sm round" aria-label="Close">${iconSvg("x", "sm")}</button>`;
  const act = action ? `<button class="btn primary">${action}</button>` : "<span></span>";
  const sheet = `<div class="scrim"><div class="sheet" role="dialog" aria-label="${title}">
<div class="fs-bar">${close}<span class="h3">${title}</span>${act}</div>
<div class="sheet-head modal-only"><span class="h3">${title}</span>${close}</div>
${lead ? `<div class="fs-lead">${lead}</div>` : ""}<div class="fs-body">${body}${secondary ? `<div class="fs-only">${secondary}</div>` : ""}</div>
${footer ? `<div class="modal-only">${footer}</div>` : ""}</div>${over}</div>`;
  return keyboardUnder(sheet, kind, "full");
};

const FOOTER_START = '<div class="hstack" style="gap:10px">';
const BUTTON = /<button class="btn ([^"]*)"([^>]*)>([\s\S]*?)<\/button>/g;

// A form's footer on a phone: the primary goes up to the bar, Cancel is the close button, the rest ends the body.
const fullWrap = (inner, title, o = {}) => {
  const at = inner.lastIndexOf(FOOTER_START);
  if (at < 0) {
    const block = inner.match(/<button class="btn primary lg block">([\s\S]*?)<\/button>/);
    if (!block) return fullScreen({ title, body: inner, ...o });
    return fullScreen({
      title,
      body: inner.replace(block[0], `<span class="modal-only">${block[0]}</span>`),
      action: block[1].replace(/<svg[\s\S]*?<\/svg>/g, ""),
      ...o,
    });
  }
  const end = inner.indexOf("</div>", at) + "</div>".length;
  const footer = inner.slice(at, end);
  const buttons = [...footer.matchAll(BUTTON)];
  const primary = buttons.findLast(([, cls]) => /primary|danger solid/.test(cls));
  const secondary = buttons
    .filter((b) => b !== primary && b[3].trim() !== "Cancel")
    .map(
      ([, cls, attrs, label]) =>
        `<button class="btn ${cls.replace(/ block/, "")} block"${attrs.replace(/ style="[^"]*"/, "")}>${label}</button>`,
    )
    .join("");
  return fullScreen({
    title,
    body: inner.slice(0, at) + inner.slice(end),
    action: primary?.[3],
    secondary: secondary ? `<div class="stack-sm">${secondary}</div>` : "",
    footer,
    ...o,
  });
};

const centred = (html, kind) =>
  html.replace(
    '<div class="scrim center">',
    `${keyboard(kind)}<div class="scrim center" style="bottom:${KEYBOARD_H[kind]}px">`,
  );

const UNSAVED_DIALOG = `<div class="scrim center" style="z-index:calc(var(--z-sheet) + 2)"><div class="sheet" role="alertdialog" aria-label="Are you sure you want to leave?">
<div class="alert warning">${iconSvg("triangle-alert")}<span><b>Are you sure you want to leave?</b> What you have typed will be lost.</span></div>
<div class="hstack" style="gap:10px"><button class="btn primary lg" style="flex:1.2">Keep editing</button><button class="btn ghost lg" style="flex:1;color:var(--danger)">Leave</button></div></div></div>`;

const quickFullScreen = (o = {}) =>
  home({
    sheet: quickSheet({ type: "expense", hint: typeLine("EXPENSE"), full: true, ...o }),
  });

const pickerFullScreen = () => {
  const r = (name, sel = false) => {
    const [ic, col] = CATS[name];
    return `<button class="row" style="border-top:1px solid var(--border)">${tile(ic, col)}<span class="body"><span class="title">${name}</span><span class="meta">Expense</span></span><span class="right" style="flex-direction:row">${sel ? iconSvg("circle-check", "sm") : ""}</span></button>`;
  };
  const lead = `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span style="flex:1">Search categories</span><span class="caret"></span></div>`;
  const body = `<div class="stack-sm"><span class="eyebrow">Recent</span><div class="chips">${catChip("Coffee")}${catChip("Food")}${catChip("Transport")}</div></div>
<div class="list" style="margin:0 -16px">${r("Coffee")}${r("Food", true)}${r("Transport")}${r("Housing")}${r("Bills")}${r("Lifestyle")}${r("Health")}${r("Pets")}
<button class="row" style="border-top:1px solid var(--border)">${tile("plus", "NONE")}<span class="body"><span class="title" style="color:var(--brand-text)">New category</span><span class="meta">Create it without leaving this form</span></span></button></div>`;
  return screen(transactionFormBodyDim(), {
    tab: "",
    side: "",
    back: true,
    title: "New transaction",
    narrow: true,
    sheet: fullScreen({ title: "Category", lead, body, keyboard: "text" }),
  });
};

// What a field shows while you type (T-193): the list (component 36), the greyed rest, or chips.
const typedText = (text) =>
  `<span class="value" style="flex:none">${text}</span><span class="caret"></span>`;
const acceptHint = (label) =>
  `<span class="accept key-hint" aria-hidden="true">→</span><button class="btn ghost icon-only round accept" aria-label="${label}">${iconSvg("check", "sm")}</button>`;
const suggestRow = (title, { meta = "", count = "", tile: t = "", active = false } = {}) =>
  `<button class="row" role="option" aria-selected="${String(active)}">${t}<span class="body"><span class="title"><span>${title}</span></span>${meta ? `<span class="meta">${meta}</span>` : ""}</span>${count ? `<span class="count">${count}</span>` : ""}</button>`;
const suggestList = (rows, label = "Suggestions") =>
  `<div class="suggest" role="listbox" aria-label="${label}">${rows.join("")}</div>`;
const hashChips = (tags, fit = true) =>
  `<div class="chips${fit ? " fit" : ""}" style="margin-top:2px">${tags.map((tag) => `<button class="chip" style="height:28px">#${tag}</button>`).join("")}</div>`;
const descriptionField = ({ typed = "Ub", after = "", below = "", focus = true } = {}) =>
  `<div class="field"><span class="label">Description <span class="opt">optional</span></span><div class="input${focus ? " focus" : ""}">${focus ? typedText(typed) : `<span class="value">${typed}</span>`}${after}</div>${below}</div>`;
const tagsField = ({ tags = ["work"], typed = null, after = "", below = "" } = {}) =>
  `<div class="field"><span class="label">Tags <span class="opt">optional</span></span><div class="input${typed === null ? "" : " focus"}" style="height:auto;min-height:48px;padding:8px 12px;flex-wrap:wrap">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}${typed === null ? '<span class="placeholder">Add…</span>' : `${typedText(typed)}${after}`}</div>${below}</div>`;
const UBER_ROWS = [
  [
    "<b>Ub</b>er to work",
    { meta: "Transport · $18,400 · #work · Tuesday", count: "41×", cat: "Transport" },
  ],
  [
    "<b>Ub</b>er to the airport",
    { meta: "Transport · $64,000 · #travel · Sep 2", count: "6×", cat: "Transport" },
  ],
  ["<b>Ub</b>er Eats · lunch", { meta: "Food · $32,500 · Aug 28", count: "12×", cat: "Food" }],
  [
    "<b>Ub</b>er home",
    { meta: "Transport · $21,000 · #work · Aug 20", count: "9×", cat: "Transport" },
  ],
];
const uberList = (rich) =>
  suggestList(
    UBER_ROWS.map(([title, o], i) => {
      if (!rich) return suggestRow(title, { active: i === 0 });
      const [ic, col] = CATS[o.cat];
      return suggestRow(title, {
        meta: o.meta,
        count: o.count,
        tile: tile(ic, col, "sm"),
        active: i === 0,
      });
    }),
  );
const quickNoteField = (inner, below = "") =>
  `<div class="field"><div class="input focus">${iconSvg("notebook-pen", "sm")}${inner}</div>${below}</div>`;
const quickWithNote = (inner, below = "", o = {}) =>
  quickFullScreen({ keyboard: "text", note: quickNoteField(inner, below), ...o });
const TAG_ROWS = [
  ["<b>co</b>mmute", "23× · usually with Transport"],
  ["<b>co</b>ffee", "9×"],
  ["<b>co</b>nference", "2×"],
];
const suggestionsForm = (details, cat = null, { keyboard: kind = null } = {}) => {
  const form = transactionForm("EXPENSE", {
    amount: "18,400",
    details,
    cat:
      cat ??
      `<div class="stack-sm"><span class="label">Category</span>
<div class="chips">${catChip("Food")}${catChip("Coffee")}${catChip("Transport")}${catChip("Bills")}${catChip("Health")}<button class="chip">${iconSvg("search", "sm")}Search</button></div></div>`,
  });
  if (!kind) return form;
  return (
    form.replace(
      '<div class="page" style="max-width:640px">',
      '<div class="page under-keyboard" style="max-width:640px">',
    ) + keyboard(kind)
  );
};
const FILLED_LINE = `<span class="help">Category and tags from the last one</span>`;
const TRANSPORT_CHOSEN = `<div class="stack-sm"><span class="label">Category</span>
<div class="chips">${catChip("Food")}${catChip("Coffee")}${catChip("Transport", true)}${catChip("Bills")}${catChip("Health")}<button class="chip">${iconSvg("search", "sm")}Search</button></div></div>`;
const SUGGEST = {
  "quick-list": () => quickWithNote(typedText("Ub"), uberList(false)),
  "quick-ghost": () =>
    quickWithNote(
      `${typedText("Ub")}<span class="ghost">er to work</span>${acceptHint("Use “Uber to work”")}`,
    ),
  "quick-chips": () =>
    quickWithNote(
      typedText("Ub"),
      `<div class="chips fit"><button class="chip">Uber to work</button><button class="chip">Uber Eats · lunch</button></div>`,
    ),
  "form-text": () =>
    suggestionsForm(`${descriptionField({ below: uberList(false) })}${tagsField()}${NOTE_FIELD}`),
  "form-entry": () =>
    suggestionsForm(
      `${descriptionField({ below: uberList(true) })}${tagsField({ tags: [] })}${NOTE_FIELD}`,
    ),
  "form-entry-keyboard": () =>
    suggestionsForm(
      `${descriptionField({ below: uberList(true) })}${tagsField({ tags: [] })}${NOTE_FIELD}`,
      null,
      { keyboard: "text" },
    ),
  "form-after-pick": () =>
    suggestionsForm(
      `${descriptionField({ typed: "Uber to work", focus: false, below: FILLED_LINE })}${tagsField({ tags: ["work"] })}${NOTE_FIELD}`,
      TRANSPORT_CHOSEN,
    ),
  "tags-chips": () =>
    suggestionsForm(
      `${descriptionField({ typed: "Uber to work", focus: false })}${tagsField({ tags: [], typed: "", below: hashChips(["work", "commute", "monthly", "travel"]) })}${NOTE_FIELD}`,
      TRANSPORT_CHOSEN,
    ),
  "tags-list": () =>
    suggestionsForm(
      `${descriptionField({ typed: "Uber to work", focus: false })}${tagsField({ typed: "co", below: suggestList(TAG_ROWS.map(([t, meta], i) => suggestRow(`#${t}`, { meta, active: i === 0 }))) })}${NOTE_FIELD}`,
      TRANSPORT_CHOSEN,
    ),
  "tags-ghost": () =>
    suggestionsForm(
      `${descriptionField({ typed: "Uber to work", focus: false })}${tagsField({ typed: "co", after: `<span class="ghost">mmute</span>${acceptHint("Add #commute")}`, below: hashChips(["commute", "coffee", "conference"]) })}${NOTE_FIELD}`,
      TRANSPORT_CHOSEN,
    ),
  "quick-plain": () => quickFullScreen({ keyboard: "numeric" }),
  "quick-again": () =>
    quickFullScreen({
      keyboard: "numeric",
      again: `<div class="stack-sm"><span class="label">Again <span class="opt">what you record most</span></span>
<div class="chips fit">${[
        ["Transport", "Uber to work · $18,400"],
        ["Coffee", "Pergamino · $9,800"],
        ["Food", "Lunch · $24,000"],
      ]
        .map(([cat, label]) => {
          const [ic, col] = CATS[cat];
          return `<button class="chip cat color-${col}"><span class="dot">${iconSvg(ic)}</span><span class="name">${label}</span></button>`;
        })
        .join("")}</div></div>`,
    }),
};
const suggestVariant = (kind) => SUGGEST[kind]();

// T-196 · the new-version notice, drawn over the Transactions list so what it covers is visible.
const newVersionVariant = (kind) => {
  if (kind === "about") return settings({ update: true, scrolled: true });
  const close = `<button class="btn ghost icon-only sm round" aria-label="Close" style="color:inherit">${iconSvg("x", "sm")}</button>`;
  const closable = kind !== "stripe-fixed";
  const banner = kind.startsWith("stripe")
    ? `<div class="banner info" role="status">${iconSvg("cloud-download")}<span class="txt"><b>A new version of Ledger Flow is ready.</b><span class="sub">Reloading takes a second. Nothing you saved is lost.</span></span><span class="actions"><button class="action">Reload</button>${closable ? close : ""}</span></div>`
    : "";
  const toast =
    kind === "toast"
      ? `<div class="toast">${iconSvg("cloud-download")}New version available<button class="action">Reload</button>${close}</div>`
      : "";
  const body = `<div class="list card flush"><div class="day-head"><span>Today · Tuesday 22</span><span class="amount">${money(40700, "−")}</span></div>
${row("coffee", "BROWN", "Pergamino Coffee", "7:55 · Cash", 9800)}
${row("utensils", "ORANGE", "Lunch", "13:05 · Bancolombia", 12500)}
${row("car", "BLUE", "Uber to work", "18:10 · Visa Gold", 18400)}
<div class="day-head"><span>Yesterday · Monday 21</span><span class="amount">${money(4200000, "+")}</span></div>
${row("briefcase", "GREEN", "August salary", "Bancolombia", 4200000, "income")}
${row("repeat", "GRAY", "Bancolombia → Savings", "Transfer", 1000000, "transfer")}
<div class="day-head"><span>Sunday 20</span><span class="amount">${money(475000, "−")}</span></div>
${row("utensils", "ORANGE", "Carulla groceries", "Bancolombia", 78900)}
${row("zap", "AMBER", "EPM electricity", "Bancolombia", 186200)}
${row("fuel", "GRAY", "Terpel gas station", "Visa Gold", 120000)}
${row("shopping-bag", "PINK", "Falabella", "Visa Gold", 89900)}
</div>${toast}`;
  return screen(body, { tab: "mov", side: "mov", title: "Transactions", banner });
};

// ── Shared expenses · T-110 and T-111 ───────────────────────────────────────
const PEOPLE = {
  You: ["JD", "GRAY"],
  "Ana Ruiz": ["AR", "PINK"],
  "Beto Cano": ["BC", "TEAL"],
  "Lucía Mesa": ["LM", "AMBER"],
  "Diego Pardo": ["DP", "INDIGO"],
  "Marta Ríos": ["MR", "PURPLE"],
  Carlitos: ["CA", "ORANGE"],
};

const face = (name, size = "") => {
  const [initials, color] = PEOPLE[name];
  return `<span class="avatar person ${size} color-${color}" aria-hidden="true">${initials}</span>`;
};

const personRow = (name, meta, amt, note, badge = "", pending = false) =>
  `<a class="row" href="#">${face(name)}
<span class="body"><span class="title"><span class="truncate">${name}</span>${badge}</span><span class="meta">${meta}</span></span>
<span class="right">${pendingFigure(`<span class="amount">${money(amt)}</span>`, pending)}<span class="sub">${note}</span></span></a>`;

const STATE_BADGE = {
  paid: '<span class="badge success">Paid</span>',
  partial: '<span class="badge warning">Partially paid</span>',
  unpaid: '<span class="badge">Not paid</span>',
  off: `<span class="badge">${iconSvg("circle-x")}Written off</span>`,
};

const sharedSummary = (pending = false) =>
  twoFigureCard(
    "Owed to you",
    OWED_TO_YOU - (pending ? PENDING_PAYMENT : 0),
    "3 people with something open · 23 contacts",
    "You owe",
    YOU_OWE,
    pending,
  );

const sharedSeg = (on) =>
  `<div class="segment"><button aria-pressed="${String(on === "people")}">${iconSvg("user", "sm")}People</button><button aria-pressed="${String(on === "groups")}">${iconSvg("users", "sm")}Shared groups</button></div>`;

const sharedScreen = (body, o = {}) =>
  screen(body, {
    tab: "mas",
    side: "shared",
    title: "Shared",
    actions: `<button class="btn primary desktop-only">${iconSvg("plus", "sm")}New shared group</button><button class="btn secondary icon-only round mobile-only" aria-label="New shared group">${iconSvg("plus")}</button>`,
    ...o,
  });

const sharedPeopleBody = (pending = false) => `${sharedSeg("people")}
${sharedSummary(pending)}
<section class="stack-sm"><div class="section-head"><h3 class="h3">Owes you</h3>${pendingFigure(`<span class="small muted amount">${money(OWED_TO_YOU - (pending ? PENDING_PAYMENT : 0))}</span>`, pending)}</div>
<div class="list card flush">
${personRow("Beto Cano", "Cartagena trip · Night out", 526300 - (pending ? PENDING_PAYMENT : 0), "owes you", "", pending)}
${personRow("Ana Ruiz", "Cartagena trip · Night out", 26300, "owes you")}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">You owe</h3>${pendingFigure(`<span class="small muted amount">${money(YOU_OWE)}</span>`, pending)}</div>
<div class="list card flush">
${personRow("Diego Pardo", "Diego’s birthday gift", 60000, "you owe")}
</div></section>
<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("circle-check")}<span style="font-weight:500">Settled</span><span class="badge">2</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="hstack" style="justify-content:space-between;padding:0 2px"><span class="xs faint">Showing 3 of 3 with something open · 23 contacts in all</span><button class="btn ghost sm">${iconSvg("plus", "sm")}Add a person</button></div>`;

const sharedPeople = () => sharedScreen(sharedPeopleBody());

const PENDING_PAYMENT = 200000;
const WAITING_BANNER = `<div class="banner offline" role="status">${iconSvg("cloud-off")}<span class="txt"><b>Changes waiting to sync.</b> They are saved on this device.<span class="sub">1 change waiting</span></span></div>`;

const sharedPeoplePending = () => sharedScreen(sharedPeopleBody(true), { banner: WAITING_BANNER });

const groupRow = (
  name,
  color,
  when,
  people,
  total,
  yours,
  pct,
  gauge,
  badge = "",
  pending = false,
  saved = false,
) =>
  `<a class="row color-${color}" href="#">${tile("users", color)}
<span class="body"><span class="title"><span class="truncate">${name}</span>${badge}</span><span class="meta">${when} · ${people} people${saved ? " · Saved on this device" : ""}</span>
${gauge === null ? "" : `<span style="display:flex;flex-direction:column;gap:3px;padding-top:6px">${pendingFigure(`<div class="progress thin" style="flex:1"><span class="fill" style="width:${pct}%"></span></div>`, pending, "center")}<span class="xs faint">${gauge}</span></span>`}</span>
<span class="right">${pendingFigure(`<span class="amount">${money(total)}</span>`, pending)}<span class="sub">Your share ${moneyText(yours)}</span></span></a>`;

const sharedGroups = () =>
  sharedScreen(`${sharedSeg("groups")}
${sharedSummary()}
<div class="list card flush">
${groupRow("Cartagena trip", "TEAL", "Aug 29 – Sep 12", 4, 3200000, 800000, 46, "$1,100,000 paid of $2,400,000")}
${groupRow("Night out", "PURPLE", "Sep 20", 3, 228900, 86300, 0, "$0 paid of $52,600")}
${groupRow("Diego’s birthday gift", "PINK", "Sep 8", 3, 180000, 60000, 0, null, '<span class="badge">You owe $60,000</span>')}
</div>
<button class="card hstack" style="justify-content:space-between;cursor:pointer;text-align:left;padding:12px 16px"><span class="hstack">${iconSvg("circle-check")}<span style="font-weight:500">Settled</span><span class="badge">1</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="list card flush">
${groupRow("Office lunch", "AMBER", "Aug 27", 5, 240000, 48000, 100, "$192,000 paid of $192,000", '<span class="badge success">Settled</span>')}
</div>`);

const sharedGroupsPending = () =>
  sharedScreen(
    `${sharedSeg("groups")}
${sharedSummary(true)}
<div class="list card flush">
${groupRow("Coffee farm tour", "GREEN", "Sep 23", 3, 150000, 50000, 0, "$0 paid of $100,000", PENDING_SYNC, true, true)}
${groupRow("Cartagena trip", "TEAL", "Aug 29 – Sep 12", 4, 3200000, 800000, 54, "$1,300,000 paid of $2,400,000", "", true)}
${groupRow("Night out", "PURPLE", "Sep 20", 3, 228900, 86300, 0, "$0 paid of $52,600", "", true)}
${groupRow("Diego’s birthday gift", "PINK", "Sep 8", 3, 180000, 60000, 0, null, '<span class="badge">You owe $60,000</span>')}
</div>`,
    { banner: WAITING_BANNER.replace("1 change waiting", "2 changes waiting") },
  );

const sharedEmpty = () =>
  sharedScreen(`<div class="empty"><span class="tile lg outline">${iconSvg("users")}</span>
<span class="h3">Nothing shared yet</span>
<p class="small muted" style="max-width:34ch;margin:0">A shared group is one outing or one trip: you add the expenses, say who was in, and Ledger Flow keeps track of who has paid you back.</p>
<div class="hstack" style="gap:8px;padding-top:8px"><button class="btn primary">${iconSvg("plus", "sm")}New shared group</button><button class="btn secondary">Add a person</button></div></div>`);

const sharedLoading = () => {
  const rows = range(0, 4)
    .map(
      () =>
        '<div class="row" style="cursor:default"><span class="skeleton" style="width:36px;height:36px;border-radius:999px"></span><span class="body" style="gap:6px"><span class="skeleton" style="height:12px;width:40%"></span><span class="skeleton" style="height:10px;width:60%"></span></span><span class="skeleton" style="height:12px;width:72px"></span></div>',
    )
    .join("");
  return sharedScreen(
    `<div class="skeleton" style="height:40px;border-radius:10px"></div>
<div class="skeleton" style="height:96px;border-radius:14px"></div>
<div class="list card flush">${rows}</div>`,
  );
};

const sharedError = () =>
  sharedScreen(`<div class="empty" style="padding-top:64px">${tile("circle-alert", "RED", "lg")}
<span class="h3">We couldn\u2019t load Shared</span>
<p class="small muted" style="margin:0;max-width:280px">The server didn\u2019t respond (503). Nothing is lost; try again in a few seconds.</p>
<button class="btn secondary" style="margin-top:8px">${iconSvg("refresh-cw", "sm")}Retry</button>
<span class="xs faint mono">Reference: 8c1f4e2a-\u2026-3b7d</span></div>`);

const GROUP_LINES = [
  ["Flights", "plane", "CYAN", "Aug 29", 1200000, 300000],
  ["Hotel", "bed", "BROWN", "Aug 30", 1400000, 350000],
  ["Dinner at La Cevichería", "utensils", "ORANGE", "Sep 2", 360000, 90000],
  ["Boat to Barú", "ship", "BLUE", "Sep 8", 160000, 40000],
  ["Taxi to the airport", "car", "BLUE", "Sep 12", 80000, 20000],
];

const groupDetail = ({ sheet = "", archived = false, pending = false } = {}) => {
  const lines = GROUP_LINES.map(([name, icon, color, when, total, yours], index) => {
    const queued = pending && index === GROUP_LINES.length - 1;
    return `<a class="row" href="#">${tile(icon, color)}<span class="body"><span class="title"><span class="truncate">${name}</span>${queued ? PENDING_SYNC : ""}</span><span class="meta">${when} · you paid${queued ? " · Saved on this device" : ""}</span></span><span class="right">${amount(total, "expense")}<span class="sub">Your share ${moneyText(yours)}</span></span></a>`;
  }).join("");
  const body = `<section class="card color-TEAL stack-sm" style="gap:6px;position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--f)"></span>
<div class="hstack" style="justify-content:space-between">${tile("users", "TEAL")}<span class="badge outline">${iconSvg("calendar")}Aug 29 – Sep 12</span></div>
<span class="eyebrow" style="margin-top:6px">4 people · ${archived ? "archived" : "open"}</span><span class="h2">Cartagena trip</span>
${pendingFigure(`<span class="amount-hero" style="font-size:32px">${money(2100000)}</span>`, pending)}
<span class="small muted">counts as yours · total <b class="amount">${money(3200000)}</b> · your share <b class="amount">${money(800000)}</b></span>
<div style="display:flex;flex-direction:column;gap:4px;padding-top:10px">${pendingFigure(`<div class="progress thin" style="flex:1"><span class="fill" style="width:46%"></span></div>`, pending, "center")}<span class="xs faint">$1,100,000 paid of $2,400,000</span></div>
<span class="small muted" style="padding-top:2px">${moneyText(500000)} is still owed to you, and ${moneyText(800000)} was written off — that part stays counted as yours.</span></section>
${
  archived
    ? `<div class="alert warning">${iconSvg("triangle-alert")}<span>This shared group is archived. What was owed here was written off, and nothing is deleted.</span></div>
<button class="btn secondary lg block">${iconSvg("archive-restore", "sm")}Restore</button>`
    : `<button class="btn primary block">${iconSvg("hand-coins", "sm")}Settle up</button>
<div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px"><button class="btn secondary">${iconSvg("plus", "sm")}Add expense</button><button class="btn secondary">${iconSvg("user", "sm")}Add people</button><button class="btn secondary">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary">${iconSvg("archive", "sm")}Archive</button></div>`
}
<section class="stack-sm"><div class="section-head"><h3 class="h3">People</h3><a class="link" href="#">Equal split by default</a></div>
<div class="list card flush">
${personRow("You", "Nothing to collect from yourself", 800000, "share", "", pending)}
${personRow("Ana Ruiz", "Paid in full on Sep 18 · into Bancolombia", 800000, "share", STATE_BADGE.paid, pending)}
${personRow("Beto Cano", "Paid $300,000 · $500,000 still owed", 800000, "share", STATE_BADGE.partial, pending)}
${personRow("Lucía Mesa", "Written off Sep 21 · the $800,000 stays yours", 800000, "share", STATE_BADGE.off, pending)}
${archived ? "" : inviteDoor()}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Expenses · 5</h3><a class="link" href="#">Add expense</a></div>
<div class="list card flush">${lines}</div></section>`;
  return screen(body, {
    tab: "mas",
    side: "shared",
    back: true,
    title: "Shared group",
    sheet,
    ...(pending ? { banner: WAITING_BANNER } : {}),
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
  });
};

const personDetail = ({ sheet = "", pending = false } = {}) =>
  screen(
    `<div class="card color-TEAL stack-sm" style="align-items:center;text-align:center;gap:8px;padding:24px 16px">${face("Beto Cano", "lg")}
<span class="h2">Beto Cano</span><span class="small muted">beto@example.com</span>
${pendingFigure(`<span class="amount-hero" style="font-size:36px">${money(526300 - (pending ? PENDING_PAYMENT : 0))}</span>`, pending)}
<span class="small muted">owes you, across 2 shared groups</span>
<button class="btn primary lg" style="margin-top:6px">${iconSvg("hand-coins", "sm")}Settle up</button></div>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Shared groups</h3></div>
<div class="list card flush">
<a class="row" href="#">${tile("users", "TEAL")}<span class="body"><span class="title"><span class="truncate">Cartagena trip</span>${STATE_BADGE.partial}</span><span class="meta">Aug 29 – Sep 12 · paid ${pending ? "$500,000" : "$300,000"} of $800,000</span></span><span class="right">${pendingFigure(`<span class="amount">${money(500000 - (pending ? PENDING_PAYMENT : 0))}</span>`, pending)}<span class="sub">owes you</span></span></a>
<a class="row" href="#">${tile("users", "PURPLE")}<span class="body"><span class="title"><span class="truncate">Night out</span>${STATE_BADGE.unpaid}</span><span class="meta">Sep 20 · nothing paid yet</span></span><span class="right">${pendingFigure(`<span class="amount">${money(26300)}</span>`, pending)}<span class="sub">owes you</span></span></a>
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Payments</h3></div>
<div class="list card flush">${pending ? `<a class="row" href="#">${tile("hand-coins", "GRAY")}<span class="body"><span class="title"><span class="truncate">Paid you ${moneyText(PENDING_PAYMENT)}</span>${PENDING_SYNC}</span><span class="meta">Sep 23 · Saved on this device</span></span><span class="right"><span class="amount">${money(PENDING_PAYMENT)}</span></span></a>` : ""}
<a class="row" href="#">${tile("hand-coins", "GRAY")}<span class="body"><span class="title"><span class="truncate">Paid you $300,000</span></span><span class="meta">Sep 20</span></span><span class="right"><span class="amount">${money(300000)}</span></span></a>
<a class="row" href="#">${tile("hand-coins", "GRAY")}<span class="body"><span class="title"><span class="truncate">Paid you $26,300</span></span><span class="meta">Sep 12 · in cash, outside the app</span></span><span class="right"><span class="amount">${money(26300)}</span></span></a>
</div></section>
<div class="hstack" style="gap:10px"><button class="btn secondary lg" style="flex:1">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary lg" style="flex:1">${iconSvg("archive", "sm")}Archive</button></div>
<p class="xs faint" style="text-align:center;margin:0">A person is not an account: Beto has no balance of his own and never appears among your accounts, in a transfer, or in Stats by account. The money moves in your accounts, as it always has.</p>`,
    {
      tab: "mas",
      side: "shared",
      back: true,
      title: "Person",
      sheet,
      ...(pending ? { banner: WAITING_BANNER } : {}),
    },
  );

const undoPayment = () =>
  personDetail({
    sheet: sheetWrap(
      `<div class="alert warning">${iconSvg("triangle-alert")}<span><b>${moneyText(300000)} goes back to being owed.</b> Undoing a payment is not a refund: what was recorded stops having happened, and no new movement is written.</span></div>
<p class="small muted" style="margin:0">The movement it wrote goes with it, because that money is the payment's. What counts as yours goes <b>back up</b> on the expenses it had lowered, each in the month that expense happened, and each one keeps the change in its history.</p>
<p class="small muted" style="margin:0">Nothing else is undone: no expense leaves its group, and what was written off stays written off. Everything else Beto Cano has paid is imputed again over what is still open, oldest first.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.4">Undo the ${moneyText(300000)}</button></div>`,
      "Undo this payment?",
    ),
  });

const newContact = () =>
  sharedScreen(sharedPeopleBody(), {
    sheet: fullWrap(
      `<div class="stack">${field("Name", "Beto Cano", null, { icon: "user" })}
<div class="field"><span class="label">Colour</span>${swatches("TEAL")}</div>
${field("Email", null, "beto@example.com", { icon: "globe", opt: true, help: "So you can invite them to a shared group. Nothing is emailed: the invitation waits in their Shared." })}
<div class="alert neutral">${iconSvg("info")}<span>Up to <b>200 people</b> in all.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Add person</button></div></div>`,
      "New person",
    ),
  });

const contactChip = (name, on = true) =>
  `<button class="chip${on ? " selected" : ""}"${name === "You" ? " disabled" : ""}>${face(name, "sm")}${name}${on && name !== "You" ? iconSvg("x", "sm") : ""}</button>`;

const newGroup = ({ sheet = "" } = {}) =>
  screen(
    `<div class="stack">
${field("Name", "Cartagena trip", null, { icon: "users" })}
<div class="field"><span class="label">Colour</span>${swatches("TEAL")}</div>
<div class="field"><span class="label">Who was in</span>
<div class="chips" style="flex-wrap:wrap;overflow:visible">${contactChip("You")}${contactChip("Ana Ruiz")}${contactChip("Beto Cano")}${contactChip("Lucía Mesa")}<button class="chip">${iconSvg("plus", "sm")}Add a person</button></div>
<span class="help">You are in the group like everyone else, with a share of your own.</span></div>
<div class="field"><span class="label">Split by default</span>
<div class="segment"><button aria-pressed="true">Equal</button><button aria-pressed="false">Percent</button></div>
<span class="help">Every expense you add takes this without asking, and any of them can then go its own way — by exact amounts too, which only an expense can have, because only an expense has a total. Changing this later never goes back over what is already recorded.</span></div>
<div class="field"><span class="label">Expenses</span>
<button class="picker">${tile("list", "GRAY", "sm")}<span class="body"><span class="lbl">Pick from my transactions</span><span class="val">3 selected · $2,960,000</span></span>${iconSvg("chevron-right", "sm")}</button></div>
<div class="alert neutral">${iconSvg("info")}<span>Splitting changes nothing today: an expense keeps counting in full until someone pays you back.</span></div>
<button class="btn primary lg block">Create shared group</button></div>`,
    { tab: "mas", side: "shared", back: true, title: "New shared group", narrow: true, sheet },
  );

const pickRow = (icon, color, title, meta, amt, on) =>
  `<label class="row" style="cursor:pointer"><span class="box${on ? " on" : ""}">${on ? iconSvg("check", "sm") : ""}</span>${tile(icon, color)}
<span class="body"><span class="title"><span class="truncate">${title}</span></span><span class="meta">${meta}</span></span>
<span class="right">${amount(amt, "expense")}</span></label>`;

const pickTransactions = () =>
  newGroup({
    sheet: fullWrap(
      `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search description, note or tag</span></div>
<div class="chips"><button class="chip selected">August – September</button><button class="chip">${iconSvg("wallet", "sm")}Any account</button><button class="chip">Expenses</button></div>
<div class="list" style="margin:0 -16px;max-height:320px;overflow:auto">
${pickRow("plane", "CYAN", "Flights", "Aug 29 · Bancolombia", 1200000, true)}
${pickRow("bed", "BROWN", "Hotel", "Aug 30 · Visa Gold", 1400000, true)}
${pickRow("utensils", "ORANGE", "Dinner at La Cevichería", "Sep 2 · Visa Gold", 360000, true)}
${pickRow("coffee", "BROWN", "Pergamino Coffee", "Sep 3 · Cash", 9800, false)}
</div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add 3 · ${moneyText(2960000)}</button></div>`,
      "Pick from my transactions",
    ),
  });

const recordNewExpense = () =>
  groupDetail({
    sheet: fullWrap(
      `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search description, note or tag</span></div>
<div class="list" style="margin:0 -16px;max-height:260px;overflow:auto">
${pickRow("coffee", "BROWN", "Pergamino Coffee", "Sep 3 \u00b7 Cash", 9800, true)}
${pickRow("bus", "BLUE", "Bus to the old town", "Sep 4 \u00b7 Cash", 12000, false)}
</div>
<div class="hstack" style="gap:14px;padding-top:2px"><button class="btn ghost sm" style="padding-left:0">${iconSvg("plus", "sm")}Record a new expense</button><button class="btn ghost sm" style="padding-left:0">${iconSvg("users", "sm")}Somebody else paid</button></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add 1 \u00b7 ${moneyText(9800)}</button></div>`,
      "Add expense",
    ),
  });

const expenseSomebodyElsePaid = () =>
  nightOut({
    sheet: fullWrap(
      `<div class="stack">
${field("What was it", "Concert tickets", null, { icon: "receipt" })}
${field("Date", "September 20, 2026", null, { icon: "calendar" })}
<div class="field"><span class="label">Amount</span>
<div class="card" style="padding:26px 16px;display:flex;justify-content:center;align-items:baseline;gap:4px"><span class="muted">$</span><span class="amount" style="font-size:28px">90,000</span></div></div>
<div class="field"><button class="picker">${face("Ana Ruiz")}<span class="body"><span class="lbl">Who paid</span><span class="val">Ana Ruiz</span></span>${iconSvg("chevron-right", "sm")}</button>
<span class="help">One of the other people in this shared group. An expense you paid goes in by the other two ways.</span></div>
<div class="alert neutral">${iconSvg("users")}<span>Split <b>equally between 3 people</b>, the group's default, like every other expense here \u2014 your share is <b>${moneyText(30000)}</b>.</span></div>
<div class="alert info">${iconSvg("info")}<span><b>Nothing of yours is recorded.</b> No money of yours moved, so there is no account, no category and no budget to ask about. It becomes your expense the day you settle with Ana \u2014 dated September 20, in a category you choose then.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add expense</button></div></div>`,
      "Somebody else paid",
    ),
  });

const whoPaidPicker = () => {
  const row = (name, on) =>
    `<button class="row" style="width:100%">${face(name)}<span class="body"><span class="title"><span class="truncate">${name}</span></span></span>${on ? iconSvg("check", "sm") : ""}</button>`;
  return nightOut({
    sheet: fullWrap(
      `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search</span></div>
<div class="list" style="margin:0 -16px">${row("Ana Ruiz", true)}${row("Beto Cano", false)}</div>`,
      "Who paid it, in Night out?",
    ),
  });
};

const GROUP_NOTICE = `<div class="alert neutral">${iconSvg("users")}<span><b>This goes into Cartagena trip</b>, split equally between 4 people. Splitting changes nothing today: it keeps counting in full until somebody pays you back.</span></div>`;

const expenseForGroup = () =>
  transactionForm("EXPENSE", {
    notice: GROUP_NOTICE,
    segment: false,
    hint: typeLine("EXPENSE"),
    amount: "360,000",
    description: "Dinner at La Cevicher\u00eda",
    save: "Save and add to the group",
  });

const halfSaved = () =>
  screen(
    `<div class="alert danger">${iconSvg("triangle-alert")}<span><b>The movement is saved. The group did not take it.</b> Cartagena trip answered that it could not be read, so this is an ordinary expense of yours for now.</span></div>
<div class="list card flush">
<div class="row" style="cursor:default">${tile("utensils", "ORANGE")}<span class="body"><span class="title"><span class="truncate">Dinner at La Cevicher\u00eda</span></span><span class="meta">Today \u00b7 Visa Gold \u00b7 Food</span></span><span class="right">${amount(360000, "expense")}</span></div>
</div>
<div class="stack-sm" style="padding-top:4px"><button class="btn primary lg block">Add it to the group again</button><button class="btn secondary lg block">Open Cartagena trip</button></div>
<p class="xs faint" style="margin:0">Nothing is lost either way: a movement that stays out of the group is listed again by its own <b>Add expense</b>, like any other.</p>`,
    { tab: "mas", side: "shared", back: true, title: "New transaction", narrow: true },
  );

const groupCannotTakeIt = () =>
  screen(
    `<div class="empty" style="padding-top:56px">${tile("archive", "GRAY", "lg")}
<span class="h3">Cartagena trip is archived</span>
<p class="small muted" style="margin:0;max-width:320px">An archived group is read, not worked: nothing is added to it until it is restored. What you record here would have nowhere to go.</p>
<div class="hstack" style="gap:8px;padding-top:8px"><button class="btn secondary">Open the group</button><button class="btn ghost">Back to Shared</button></div></div>`,
    { tab: "mas", side: "shared", back: true, title: "New transaction", narrow: true },
  );

const budgetsNotice = () =>
  newGroup({
    sheet: sheetWrap(
      `<div class="alert info">${iconSvg("info")}<span><b>Nothing changes in your budgets today.</b> All three keep counting in full — ${moneyText(2960000)} across Travel, Lodging and Food — because the money left your accounts and nobody has paid you back yet.</span></div>
<div class="list card flush">
<div class="row" style="cursor:default">${tile("plane", "CYAN")}<span class="body"><span class="title">Flights</span><span class="meta">Aug 29 · Travel</span></span><span class="right">${amount(1200000, "expense")}<span class="sub">yours until paid</span></span></div>
<div class="row" style="cursor:default">${tile("bed", "BROWN")}<span class="body"><span class="title">Hotel</span><span class="meta">Aug 30 · Lodging</span></span><span class="right">${amount(1400000, "expense")}<span class="sub">yours until paid</span></span></div>
<div class="row" style="cursor:default">${tile("utensils", "ORANGE")}<span class="body"><span class="title">Dinner at La Cevichería</span><span class="meta">Sep 2 · Food</span></span><span class="right">${amount(360000, "expense")}<span class="sub">yours until paid</span></span></div>
</div>
<p class="small muted" style="margin:0">When someone pays you back, the expense falls <b>in the month it happened</b> — August for the flights, September for the dinner — so a month you had already closed can change. Every change is kept in the expense’s history.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add 3 expenses</button></div>`,
      "Add 3 transactions to Cartagena trip?",
    ),
  });

const splitRow = (name, value, o = {}) =>
  `<div class="hstack" style="gap:12px">${face(name)}<span class="truncate" style="flex:1;min-width:0;font-weight:500">${name}</span>
${o.lock === undefined ? "" : `<button class="btn ghost icon-only sm round" aria-label="${o.lock ? "Fixed for this person" : "Takes a share of the rest"}" aria-pressed="${String(o.lock)}">${iconSvg(o.lock ? "lock" : "split", "sm")}</button>`}
<span class="input" style="width:132px;height:40px;justify-content:flex-end${o.lock ? ";border-color:var(--brand)" : ""}"><span class="value amount">${value}</span></span></div>`;

const splitSheet = (mode = "equal", loose = false) => {
  const seg = `<div class="segment"><button aria-pressed="${String(mode === "equal")}">Equal</button><button aria-pressed="${String(mode === "percent")}">Percent</button><button aria-pressed="false">Exact</button><button aria-pressed="${String(mode === "fixed")}">Fixed + rest</button></div>`;
  const rows =
    mode === "equal"
      ? `${splitRow("You", "$33,334")}${splitRow("Ana Ruiz", "$33,333")}${splitRow("Beto Cano", "$33,333")}`
      : mode === "percent"
        ? `${splitRow("You", "50%")}${splitRow("Ana Ruiz", "30%")}${splitRow("Beto Cano", "20%")}`
        : `${splitRow("You", "$40,000", { lock: false })}${splitRow("Ana Ruiz", "$40,000", { lock: false })}${splitRow("Beto Cano", "$20,000", { lock: true })}`;
  const note =
    mode === "equal"
      ? `<div class="alert neutral">${iconSvg("info")}<span>$100,000 does not divide by three, so the odd $1 goes to <b>you</b>, the one who paid. The shares always add up to the expense.</span></div>`
      : mode === "percent"
        ? `<div class="alert neutral">${iconSvg("info")}<span>The same sheet with a different unit: you type percentages and it shows the money \u2014 ${moneyText(50000)}, ${moneyText(30000)} and ${moneyText(20000)}. They have to add up to 100.</span></div>`
        : `<div class="alert neutral">${iconSvg("info")}<span>Beto is fixed at $20,000. The other $80,000 is split between the two of you, and it moves on its own when his figure changes.</span></div>`;
  const who = loose
    ? `<div class="field"><span class="label">Who was in</span>
<div class="chips" style="flex-wrap:wrap;overflow:visible">${contactChip("You")}${contactChip("Ana Ruiz")}${contactChip("Beto Cano")}<button class="chip">${iconSvg("plus", "sm")}Add a person</button></div></div>`
    : "";
  const creates = loose
    ? `<p class="xs faint" style="margin:0">It creates a shared group called <b>Groceries for the trip</b> with these three people, so this expense lives where every other shared one does. You can rename it or add more expenses to it later.</p>`
    : "";
  return fullWrap(
    `${who}${seg}
<div class="stack-sm" style="gap:10px;padding-top:4px">${rows}</div>
${ADD_GUESTS}
<div class="hstack" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:12px"><span class="small muted">Left to assign</span><span class="amount" style="font-weight:600">$0</span></div>
${note}${creates}
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">${loose ? "Split it" : "Save split"}</button></div>`,
    loose
      ? "Split this · Groceries for the trip"
      : `Split ${moneyText(100000)} · Groceries for the trip`,
  );
};

const settleUp = (kind = "full") => {
  if (kind === "owe") {
    return fullWrap(
      `<div class="inset hstack" style="justify-content:space-between"><span class="small muted">You owe Diego</span><span class="amount">${money(60000)}</span></div>
<div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">60,000</span><span class="caret"></span></div>
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">Where it comes from</span><span class="val">Bancolombia</span></span>${iconSvg("chevron-down", "sm")}</button>
<button class="picker">${tile("gift", "PINK", "sm")}<span class="body"><span class="lbl">Category</span><span class="val">Lifestyle</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert neutral">${iconSvg("info")}<span><b>This one is an expense of yours.</b> It records ${moneyText(60000)} dated September 8, the day of the gift, because that is when the money was spent \u2014 so it counts in Stats and in that month\u2019s budget, like any other expense. <b>The category is yours to choose</b>: a shared group carries none, and Diego\u2019s categories are his.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Pay ${moneyText(60000)}</button></div>`,
      "Pay Diego",
    );
  }
  if (kind === "both") {
    return fullWrap(
      `<div class="inset stack-sm" style="gap:8px">
<div class="hstack" style="justify-content:space-between"><span class="small muted">Ana owes you</span><span class="amount">${money(56300)}</span></div>
<div class="hstack" style="justify-content:space-between"><span class="small muted">You owe Ana</span><span class="amount">${money(30000)}</span></div>
<div class="hstack" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:8px"><span class="small" style="font-weight:600">She sends you</span><span class="amount" style="font-weight:600">${money(26300)}</span></div></div>
<div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">26,300</span><span class="caret"></span></div>
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">Where it arrives</span><span class="val">Bancolombia</span></span>${iconSvg("chevron-down", "sm")}</button>
<button class="picker">${tile("ticket", "PINK", "sm")}<span class="body"><span class="lbl">Category for your $30,000 of Concert tickets</span><span class="val">Lifestyle</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert neutral">${iconSvg("info")}<span><b>This records two things.</b> ${moneyText(56300)} arriving in Bancolombia, which is not income, and your ${moneyText(30000)} share of <b>Concert tickets</b> as an expense dated September 20, the day of the tickets. Your balance moves by ${moneyText(26300)}, which is what she sends. <b>The category is yours to choose</b> — a shared group does not carry one.</span></div>
<p class="xs faint" style="margin:0">Send less than ${moneyText(26300)} and it covers what she owes you first, oldest expense first; what you owe her is recorded only once that is square.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Record payment</button></div>`,
      "Settle up with Ana",
    );
  }
  if (kind === "partial") {
    return fullWrap(
      `<div class="inset hstack" style="justify-content:space-between"><span class="small muted">Beto owes you</span><span class="amount">${money(526300)}</span></div>
<div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">200,000</span><span class="caret"></span></div>
<button class="picker">${tile("banknote", "GRAY", "sm")}<span class="body"><span class="lbl">Where it lands</span><span class="val">Nowhere here · cash in hand</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert warning">${iconSvg("triangle-alert")}<span><b>No movement, and no balance changes.</b> You told us the cash never reached an account you keep here. The expenses still fall by ${moneyText(200000)}, because that money did come back to you.</span></div>
<div class="stack-sm" style="gap:6px"><span class="small muted">It covers, oldest expense first — Flights is already paid:</span>
<div class="hstack" style="justify-content:space-between"><span class="small">Cartagena trip · Hotel <span class="faint">Aug 30</span></span><span class="amount small">${money(200000)}</span></div>
<span class="xs faint">Beto stays <b>Partially paid</b>, with ${moneyText(326300)} left.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Record payment</button></div>`,
      "Record a payment from Beto",
    );
  }
  return fullWrap(
    `<div class="inset hstack" style="justify-content:space-between"><span class="small muted">Beto owes you</span><span class="amount">${money(526300)}</span></div>
<div class="amount-input" style="padding:8px 0 4px"><span class="cur">$</span><span class="num">526,300</span><span class="caret"></span></div>
<button class="picker">${tile("landmark", "BLUE", "sm")}<span class="body"><span class="lbl">Where it arrives</span><span class="val">Bancolombia</span></span>${iconSvg("chevron-down", "sm")}</button>
<button class="picker">${tile("calendar", "GRAY", "sm")}<span class="body"><span class="lbl">Date</span><span class="val">Today · September 22</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert neutral">${iconSvg("info")}<span><b>This is not income.</b> It lowers each expense in the month it happened: ${moneyText(500000)} in Cartagena trip, over August and September, and ${moneyText(26300)} in Night out.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Mark as paid</button></div>`,
    "Settle up with Beto",
  );
};

const settleUpWho = () =>
  fullWrap(
    `<p class="small muted" style="margin:0">This group has more than one person with something open, so it asks before it settles.</p>
<div class="list card flush">
${personRow("Ana Ruiz", "Cartagena trip", 26300, "owes you")}
${personRow("Beto Cano", "Cartagena trip", 526300, "owes you")}
${personRow("Diego Pardo", "Cartagena trip", 60000, "you owe")}
</div>
<p class="xs faint" style="margin:0">A row that reaches exactly one person opens the sheet straight away: a list of one is a question with one answer.</p>`,
    "Who are you settling with?",
  );

const undoWriteOffSheet = () =>
  sheetWrap(
    `<p class="small muted" style="margin:0">Beto owes the ${moneyText(500000)} again, and the history says so. <b>No figure of yours moves either way</b> — it counted as yours the day it left your account, and it still does.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Owe the ${moneyText(500000)} again</button></div>`,
    "Take back the write-off for Beto Cano?",
  );

const writeOffSheet = () =>
  sheetWrap(
    `<div class="alert neutral">${iconSvg("info")}<span><b>No figure changes.</b> You paid it, and it has counted as yours since the day of each expense. Writing off only says you have stopped expecting it back.</span></div>
<p class="small muted" style="margin:0">Beto keeps the ${moneyText(300000)} he did pay; the rest of his row reads <b>Written off</b>. With Ana paid and Lucía already written off, Cartagena trip becomes <b>Settled</b>. You can undo this until the group is archived.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.2">Write off ${moneyText(500000)}</button></div>`,
    "Write off the $500,000 Beto still owes?",
  );

const archiveGroupSheet = () =>
  sheetWrap(
    `<div class="alert warning">${iconSvg("triangle-alert")}<span><b>${moneyText(500000)} is still owed to you.</b> Archiving writes it off: Beto’s row will read Written off and the amount stays counted as yours, exactly as it is today.</span></div>
<p class="small muted" style="margin:0">Nothing is deleted and no figure moves. An archived group stays readable, and you can restore it.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.6">Archive and write off ${moneyText(500000)}</button></div>`,
    "Archive Cartagena trip?",
  );

const nightOut = ({ sheet = "" } = {}) => {
  const mine = (name, icon, color, total, yours, custom = false) =>
    `<a class="row" href="#">${tile(icon, color)}<span class="body"><span class="title"><span class="truncate">${name}</span>${custom ? `<span class="badge">${iconSvg("split")}Custom split</span>` : ""}</span><span class="meta">Sep 20 · you paid</span></span><span class="right">${amount(total, "expense")}<span class="sub">Your share ${moneyText(yours)}</span></span></a>`;
  const body = `<section class="card color-PURPLE stack-sm" style="gap:6px;position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--f)"></span>
<div class="hstack" style="justify-content:space-between">${tile("users", "PURPLE")}<span class="badge outline">${iconSvg("calendar")}Sep 20</span></div>
<span class="eyebrow" style="margin-top:6px">3 people · open</span><span class="h2">Night out</span>
<span class="amount-hero" style="font-size:32px">${money(138900)}</span>
<span class="small muted">counts as yours · total <b class="amount">${money(228900)}</b> · your share <b class="amount">${money(86300)}</b></span>
<div style="display:flex;flex-direction:column;gap:4px;padding-top:10px"><div class="progress thin"><span class="fill" style="width:0%"></span></div><span class="xs faint">$0 paid of $52,600</span></div>
<span class="small muted" style="padding-top:2px">Ana paid for the tickets, so she owes you ${moneyText(56300)} and you owe her ${moneyText(30000)} — she sends ${moneyText(26300)}. Beto owes you ${moneyText(26300)}.</span></section>
<button class="btn primary block">${iconSvg("hand-coins", "sm")}Settle up</button>
<div class="grid-2" style="grid-template-columns:1fr 1fr;gap:10px"><button class="btn secondary">${iconSvg("plus", "sm")}Add expense</button><button class="btn secondary">${iconSvg("user", "sm")}Add people</button><button class="btn secondary">${iconSvg("pencil", "sm")}Edit</button><button class="btn secondary">${iconSvg("archive", "sm")}Archive</button></div>
<section class="stack-sm"><div class="section-head"><h3 class="h3">People</h3><a class="link" href="#">Equal split by default</a></div>
<div class="list card flush">
${personRow("You", "You put in $138,900 of the $228,900", 86300, "share")}
${personRow("Ana Ruiz", "Paid the $90,000 tickets · she sends you $26,300", 86300, "share", STATE_BADGE.unpaid)}
${personRow("Beto Cano", "Did not ride, so no fuel · owes you $26,300", 56300, "share", STATE_BADGE.unpaid)}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Expenses · 3</h3><a class="link" href="#">Add expense</a></div>
<div class="list card flush">
${mine("Carulla groceries", "utensils", "ORANGE", 78900, 26300)}
<a class="row" href="#">${tile("ticket", "PINK")}<span class="body"><span class="title"><span class="truncate">Concert tickets</span><span class="badge">Ana paid</span></span><span class="meta">Sep 20 · not in your ledger</span></span><span class="right"><span class="amount">${money(90000)}</span><span class="sub">Your share $30,000</span></span></a>
${mine("Fuel", "fuel", "AMBER", 60000, 30000, true)}
</div></section>
<p class="xs faint" style="text-align:center;margin:0">The tickets are not an expense of yours until you pay Ana. When you do, they become your expense, in a category you choose, dated September 20. The fuel carries its own split because Beto did not ride: every expense can, and the shares above add up to the $228,900 either way.</p>`;
  return screen(body, {
    tab: "mas",
    side: "shared",
    back: true,
    title: "Shared group",
    sheet,
    actions: `<button class="btn ghost icon-only round" aria-label="More">${iconSvg("ellipsis")}</button>`,
  });
};

const pickPeople = () => {
  const person = (name, meta, on) =>
    `<label class="row" style="cursor:pointer"><span class="box${on ? " on" : ""}">${on ? iconSvg("check", "sm") : ""}</span>${face(name)}
<span class="body"><span class="title"><span class="truncate">${name}</span></span><span class="meta">${meta}</span></span></label>`;
  return newGroup({
    sheet: fullWrap(
      `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search a name or an email</span></div>
<div class="list" style="margin:0 -16px;max-height:300px;overflow:auto">
${person("Ana Ruiz", "Owes you $26,300", true)}${person("Beto Cano", "Owes you $526,300", true)}${person("Lucía Mesa", "Nothing open", true)}${person("Diego Pardo", "You owe $60,000", false)}
</div>
<div class="hstack" style="justify-content:space-between;padding:0 2px"><span class="xs faint">Showing 4 of 23 contacts</span><button class="btn ghost sm">Load more</button></div>
<div class="alert neutral">${iconSvg("info")}<span>Up to <b>20 people</b> in one shared group, and up to <b>200 contacts</b>. You have 4 in this group.</span></div>
<div class="hstack" style="gap:10px"><button class="btn ghost sm" style="flex:1">${iconSvg("plus", "sm")}New person</button><button class="btn primary lg" style="flex:1.4">Add 3</button></div>`,
      "Who was in",
    ),
  });
};

const blockRow = (label, value) =>
  `<div class="hstack" style="gap:12px"><span class="avatar person color-GRAY" aria-hidden="true">${iconSvg("users", "sm")}</span>
<span class="truncate" style="flex:1;min-width:0;font-weight:500">${label}</span>
<span class="input" style="width:132px;height:40px;justify-content:flex-end"><span class="value amount">${value}</span></span></div>`;

const guestCount = (count, people, shares) =>
  `<div class="field"><span class="label">Guests on this expense</span>
<div class="hstack" style="gap:10px"><span class="input" style="width:84px;height:44px;justify-content:center"><span class="value amount">${count}</span></span>
<span class="small muted" style="flex:1">${people} people + ${count} guests = <b>${shares} shares</b></span></div>
<span class="help">People you are not going to name. Each one weighs a share, and you collect from all of them as a single row.</span></div>`;

const ADD_GUESTS = `<button class="btn ghost sm" style="align-self:flex-start;padding-left:0">${iconSvg("plus", "sm")}Add guests</button>`;

const splitOneExpense = () =>
  groupDetail({
    sheet: fullWrap(
      `<div class="segment"><button aria-pressed="false">Equal</button><button aria-pressed="false">Percent</button><button aria-pressed="true">Exact</button><button aria-pressed="false">Fixed + rest</button></div>
<div class="stack-sm" style="gap:10px;padding-top:4px">${splitRow("You", "$60,000")}${splitRow("Ana Ruiz", "$120,000")}${splitRow("Beto Cano", "$90,000")}${splitRow("Lucía Mesa", "$90,000")}</div>
${ADD_GUESTS}
<div class="hstack" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:12px"><span class="small muted">Left to assign</span><span class="amount" style="font-weight:600">$0</span></div>
<div class="alert neutral">${iconSvg("info")}<span><b>This expense only.</b> Your share of the dinner goes from ${moneyText(90000)} to ${moneyText(60000)}, so your share of the trip goes from ${moneyText(800000)} to ${moneyText(770000)}. Cartagena trip keeps its equal split and so does every other expense in it; this one will read <b>Custom split</b> in the list.</span></div>
<button class="btn ghost sm" style="align-self:flex-start;padding-left:0">${iconSvg("undo-2", "sm")}Use the group’s split</button>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Save split</button></div>`,
      `Split ${moneyText(360000)} · Dinner at La Cevichería`,
    ),
  });

const splitWithGuests = () =>
  nightOut({
    sheet: fullWrap(
      `<div class="segment"><button aria-pressed="true">Equal</button><button aria-pressed="false">Percent</button><button aria-pressed="false">Exact</button><button aria-pressed="false">Fixed + rest</button></div>
${guestCount(20, 3, 23)}
<div class="stack-sm" style="gap:10px;padding-top:4px">${splitRow("You", "$10,000")}${splitRow("Ana Ruiz", "$10,000")}${splitRow("Beto Cano", "$10,000")}${blockRow("Guests · 20", "$200,000")}</div>
<div class="hstack" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:12px"><span class="small muted">Left to assign</span><span class="amount" style="font-weight:600">$0</span></div>
<div class="alert neutral">${iconSvg("info")}<span><b>23 shares, not 4.</b> The twenty guests count as twenty, so every share is ${moneyText(10000)}: ${moneyText(30000)} between the three of you and ${moneyText(200000)} for them. They are <b>one row</b> to collect from \u2014 you can record what they pay, not who paid what.</span></div>
<p class="xs faint" style="margin:0">This is the split step of <b>Add expense</b>, so the beach club is not in the list behind yet. Guests live in this expense alone: Night out stays a group of three, they never reach People, and they are not contacts.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.2">Save expense</button></div>`,
      `Split ${moneyText(230000)} · Beach club`,
    ),
  });

const previewRow = (name, meta, badge = "") =>
  `<div class="row" style="cursor:default">${face(name)}<span class="body"><span class="title"><span class="truncate">${name}</span>${badge}</span><span class="meta">${meta}</span></span><span class="right"><span class="amount">${money(640000)}</span><span class="sub">share</span></span></div>`;

const addPeopleSheet = () =>
  groupDetail({
    sheet: fullWrap(
      `<div class="input" style="height:44px">${iconSvg("search", "sm")}<span class="placeholder" style="flex:1">Search a name or an email</span></div>
<div class="list" style="margin:0 -16px;max-height:160px;overflow:auto">
<label class="row" style="cursor:pointer"><span class="box on">${iconSvg("check", "sm")}</span>${face("Diego Pardo")}<span class="body"><span class="title">Diego Pardo</span><span class="meta">You owe $60,000 · Diego’s birthday gift</span></span></label>
<div class="row" style="cursor:default">${face("Ana Ruiz")}<span class="body"><span class="title">Ana Ruiz</span><span class="meta">ana@example.com</span></span><span class="right"><span class="badge">Already in</span></span></div>
</div>
<div class="hstack" style="justify-content:space-between;padding:0 2px"><span class="xs faint">Showing 2 of 23 contacts</span><span class="hstack" style="gap:4px"><button class="btn ghost sm">Load more</button><button class="btn ghost sm">${iconSvg("plus", "sm")}New person</button></span></div>
<div class="alert neutral">${iconSvg("info")}<span>Up to <b>20 people</b> in one shared group, and up to <b>200 contacts</b>. This group would have 5.</span></div>
<p class="xs faint" style="margin:0">A group that splits by percentage asks for the new percentages here, in the same small control its <b>Edit</b> uses: the old ones no longer cover everybody.</p>
<div class="hstack" style="gap:10px"><button class="switch" role="switch" aria-checked="true" aria-label="Put Diego into the 5 expenses already here"></button><span class="small">Put Diego into the 5 expenses already here</span></div>
<p class="xs faint" style="margin:-4px 0 0">With no connection this is off and says so: the re-split is the server’s, and only it can answer what it would do.</p>
<div class="stack-sm" style="gap:6px"><span class="eyebrow">How Cartagena trip would end up</span>
<div class="list card flush">
${previewRow("You", "Your share of the $3,200,000")}
${previewRow("Ana Ruiz", "Paid $800,000 · now $160,000 ahead", STATE_BADGE.paid)}
${previewRow("Beto Cano", "Paid $300,000 · $340,000 still owed", STATE_BADGE.partial)}
${previewRow("Lucía Mesa", "Written off · $800,000 becomes $640,000", STATE_BADGE.off)}
${previewRow("Diego Pardo", "Nothing paid yet", STATE_BADGE.unpaid)}
</div></div>
<p class="small muted" style="margin:0"><b>What counts as yours does not move</b>: ${moneyText(2100000)}, exactly as it is now. Only the shares do — including what was written off, because Lucía never owed the part that is no longer hers. Nothing anybody paid is undone, and Ana being ahead is money you now owe <i>her</i>.</p>
<p class="xs faint" style="margin:0">Left off, Diego is in the expenses you add from now on and in none of the five already here. It is the whole group or none of it; to leave him out of one, set that expense’s own split afterwards.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add Diego</button></div>`,
      "Add people",
    ),
  });

// ── Shared invitations · T-129 ──────────────────────────────────────────────
const inviteDoor = (meta = "Ana Ruiz joined · Beto Cano and Lucía Mesa have not been invited") =>
  `<a class="row" href="#">${tile("user", "GRAY", "sm")}<span class="body"><span class="title">Invite them to see this group</span><span class="meta">${meta}</span></span>${iconSvg("chevron-right", "sm")}</a>`;

const VILLA = "<b>Ana Ruiz</b> invited you to <b>Villa de Leyva weekend</b>";
const VILLA_META = "ana@example.com · Sep 21 · open until Oct 21";

const invitationBlock = (rows, o = {}) => {
  const count = o.count ?? 1;
  const foot =
    o.foot ??
    "Joining lets you see the group — its expenses, who paid and how each one is split. Nothing of your own ledger reaches anybody: your accounts, categories and budgets stay yours.";
  return `<section class="stack-sm"><div class="section-head"><h3 class="h3">Invitations</h3>${count ? `<span class="badge brand">${count}<span class="sr-only"> waiting</span></span>` : ""}</div>
<div class="list card flush">${rows}</div>
${o.status ?? ""}<p class="xs faint" style="margin:0">${foot}</p></section>`;
};

const invitationRow = (o = {}) =>
  notifRow("users", o.color ?? "TEAL", o.text ?? VILLA, o.meta ?? VILLA_META, {
    link: false,
    actions: o.actions ?? ANSWER,
    badge: o.badge,
  });

const sharedInvitations = () =>
  sharedScreen(
    `${invitationBlock(invitationRow())}
${sharedPeopleBody()}`,
    { invites: 1 },
  );

const sharedInvitationFirst = () =>
  sharedScreen(
    `${invitationBlock(invitationRow())}
<div class="empty" style="padding-top:16px"><span class="tile lg outline">${iconSvg("users")}</span>
<span class="h3">Nothing shared yet</span>
<p class="small muted" style="max-width:34ch;margin:0">A shared group is one outing or one trip: you add the expenses, say who was in, and Ledger Flow keeps track of who has paid you back.</p>
<div class="hstack" style="gap:8px;padding-top:8px"><button class="btn primary">${iconSvg("plus", "sm")}New shared group</button><button class="btn secondary">Add a person</button></div></div>`,
    { invites: 1 },
  );

const sharedInvitationOtherCurrency = () =>
  sharedScreen(
    `${invitationBlock(
      invitationRow({
        text: "<b>Tom Baker</b> invited you to <b>Lisbon, October</b>",
        color: "BLUE",
        meta: "tom@example.com · Sep 22 · this group is in EUR and your Ledger Flow is in COP, so it can’t be joined",
        actions: `<button class="btn ghost sm">Decline</button>`,
      }),
    )}
${sharedPeopleBody()}`,
    { invites: 1 },
  );

const sharedInvitationAnswered = () =>
  sharedScreen(`${invitationBlock(
    `${invitationRow({ meta: "ana@example.com · Joined just now", actions: "", badge: '<span class="badge success">Joined</span>' })}
${invitationRow({ text: "<b>Marta Ríos</b> invited you to <b>Book club dinner</b>", color: "PINK", meta: "marta@example.com · Declined just now", actions: "", badge: '<span class="badge">Declined</span>' })}`,
    {
      count: 0,
      foot: "Answered here or on any other device. The two rows leave the next time Shared opens; Villa de Leyva weekend is already among your shared groups.",
    },
  )}
${sharedPeopleBody()}`);

const sharedInvitationsOffline = () =>
  sharedScreen(
    `${invitationBlock(
      invitationRow({
        actions: `<button class="btn ghost sm" disabled>Decline</button><button class="btn primary sm" disabled>Accept</button>`,
      }),
      {
        status:
          '<p class="xs muted" role="status" style="margin:0">Answering needs a connection: Ana is told your answer, and only the server can check the invitation still stands.</p>',
      },
    )}
${sharedPeopleBody()}`,
    {
      invites: 1,
      banner: `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> What you see is what this device already has.</span></div>`,
    },
  );

const sharedInvitationsInMore = () =>
  home({ invites: 1, nav: tabbar("mas", false, 1), sheet: navMenuSheet(true, 0, 1) });

const inviteRow = (name, meta, right, badge = "") =>
  `<div class="row" style="cursor:default">${face(name)}<span class="body"><span class="title"><span class="truncate">${name}</span>${badge}</span><span class="meta">${meta}</span></span><span class="right" style="flex-direction:row;align-items:center;gap:8px">${right}</span></div>`;

const inviteSheet = (beto = "none") => {
  const betoRow =
    beto === "left"
      ? inviteRow(
          "Beto Cano",
          "beto@example.com · left Sep 23",
          `<button class="btn secondary sm">Invite again</button>`,
        )
      : beto === "waiting"
        ? inviteRow(
            "Beto Cano",
            "beto@example.com · invited just now · open until Oct 22",
            `<button class="btn ghost sm">Withdraw</button>`,
          )
        : inviteRow(
            "Beto Cano",
            "beto@example.com · not invited",
            `<button class="btn secondary sm">Invite</button>`,
          );
  const said =
    beto === "waiting"
      ? `<p class="small muted" role="status" style="margin:0"><b>Beto sees it in Shared</b> the next time he opens Ledger Flow with beto@example.com. If that address has no account yet, the invitation waits for it all the same — and you are not told which: it reads <i>waiting</i> either way until he answers.</p>`
      : "";
  return fullWrap(
    `<p class="small muted" style="margin:0">Somebody who joins sees <b>Cartagena trip</b> — its expenses, who paid and how each one is split — and never your accounts, categories or notes. Nothing is emailed: the invitation waits in their Shared.</p>
<div class="list card flush">
${inviteRow("Ana Ruiz", "ana@example.com · joined Sep 19", `<button class="btn ghost sm">Stop sharing</button>`, '<span class="badge success">Joined</span>')}
${betoRow}
${inviteRow("Lucía Mesa", "No email yet", `<button class="btn secondary sm">Add email</button>`)}
</div>
${said}
<div class="alert neutral">${iconSvg("info")}<span>An invitation waits <b>30 days</b>, and up to <b>50</b> of yours can be waiting at once.</span></div>`,
    "Invite to Cartagena trip",
  );
};

const stopSharingSheet = () =>
  sheetWrap(
    `<div class="alert warning">${iconSvg("triangle-alert")}<span><b>Ana Ruiz stops seeing Cartagena trip.</b> She stays in it as a person you split with.</span></div>
<p class="small muted" style="margin:0">Nothing about the money changes: her share, what she has paid and what she still owes stay exactly as they are, and so does what counts as yours. What she already put into her own ledger is hers and stays there.</p>
<p class="xs faint" style="margin:0">To let her see it again, invite her again.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.4">Stop sharing</button></div>`,
    "Stop sharing with Ana?",
  );

// ── Somebody else's group · T-130 ───────────────────────────────────────────
const JOINED_OWED = 80000;

const joinedSummary = () =>
  twoFigureCard(
    "Owed to you",
    OWED_TO_YOU,
    "3 people with something open · 23 contacts",
    "You owe",
    YOU_OWE + JOINED_OWED,
  );

const joinedGroupRow = (badge = STATE_BADGE.partial) =>
  groupRow(
    "Villa de Leyva weekend",
    "TEAL",
    "Shared by Ana Ruiz · Sep 19 – 21",
    4,
    1660000,
    415000,
    0,
    null,
    badge,
  );

const sharedWithYou = () =>
  sharedScreen(`${sharedSeg("groups")}
${joinedSummary()}
<div class="list card flush">
${groupRow("Cartagena trip", "TEAL", "Aug 29 – Sep 12", 4, 3200000, 800000, 46, "$1,100,000 paid of $2,400,000")}
${groupRow("Night out", "PURPLE", "Sep 20", 3, 228900, 86300, 0, "$0 paid of $52,600")}
${groupRow("Diego’s birthday gift", "PINK", "Sep 8", 3, 180000, 60000, 0, null, '<span class="badge">You owe $60,000</span>')}
</div>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Shared with you</h3></div>
<div class="list card flush">${joinedGroupRow()}</div>
<p class="xs faint" style="margin:0">Only the person who shared a group can change it. Its badge says where you stand with her: you have paid Ana part of what you owe her there.</p></section>`);

const sharedPeopleWithJoined = () =>
  sharedScreen(`${sharedSeg("people")}
${joinedSummary()}
<section class="stack-sm"><div class="section-head"><h3 class="h3">Owes you</h3><span class="small muted amount">${money(OWED_TO_YOU)}</span></div>
<div class="list card flush">
${personRow("Beto Cano", "Cartagena trip · Night out", 526300, "owes you")}
${personRow("Ana Ruiz", "Cartagena trip · Night out", 26300, "owes you")}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">You owe</h3><span class="small muted amount">${money(YOU_OWE + JOINED_OWED)}</span></div>
<div class="list card flush">
${personRow("Diego Pardo", "Diego’s birthday gift", 60000, "you owe")}
</div>
<p class="xs faint" style="margin:0">${moneyText(JOINED_OWED)} more to Ana Ruiz, in 1 group shared with you.</p></section>`);

const IN_LEDGER = `<span class="badge success">${iconSvg("circle-check")}In your ledger</span>`;

const JOINED_LINES = (archived) => [
  ["Cabin", "bed", "BROWN", "Sep 19 · Ana paid · Lodging · Nequi", 900000, 225000, IN_LEDGER],
  [
    "Groceries at the market",
    "shopping-basket",
    "GREEN",
    "Sep 19 · Ana paid · ready for your ledger",
    240000,
    60000,
    STATE_BADGE.paid,
  ],
  [
    "Dinner at Casa Quintero",
    "utensils",
    "ORANGE",
    archived
      ? "Sep 20 · Ana paid · no money of yours moved"
      : "Sep 20 · Ana paid · yours to add once Ana marks it paid",
    320000,
    80000,
    archived ? STATE_BADGE.off : STATE_BADGE.unpaid,
  ],
  ["Horse ride", "trees", "TEAL", "Sep 21 · Marta paid · between you and Marta", 200000, 50000, ""],
];

const joinedGroup = ({ sheet = "", archived = false } = {}) => {
  const lines = JOINED_LINES(archived)
    .map(
      ([name, icon, color, meta, total, yours, badge]) =>
        `<a class="row" href="#">${tile(icon, color)}<span class="body"><span class="title"><span class="truncate">${name}</span>${badge}</span><span class="meta">${meta}</span></span><span class="right"><span class="amount">${money(total)}</span><span class="sub">Your share ${moneyText(yours)}</span></span></a>`,
    )
    .join("");
  const stand = archived
    ? `<span class="eyebrow" style="margin-top:6px">Square with Ana</span><span class="amount-hero" style="font-size:32px">${money(0)}</span>`
    : `<span class="eyebrow" style="margin-top:6px">You owe Ana</span><span class="amount-hero" style="font-size:32px">${money(JOINED_OWED)}</span>`;
  const gap = archived
    ? `Ana archived this group and wrote off the ${moneyText(JOINED_OWED)} that was still open. No money of yours moved.`
    : `Shared by Ana Ruiz · only she can change it. You see it as she keeps it.`;
  const body = `<section class="card color-TEAL stack-sm" style="gap:6px;position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--f)"></span>
<div class="hstack" style="justify-content:space-between">${tile("users", "TEAL")}<span class="badge outline">${iconSvg("calendar")}Sep 19 – 21</span></div>
<span class="h2">Villa de Leyva weekend</span>
${stand}
<span class="small muted">total <b class="amount">${money(1660000)}</b> · your share <b class="amount">${money(415000)}</b></span>
<div style="display:flex;flex-direction:column;gap:4px;padding-top:10px"><div class="progress thin"><span class="fill" style="width:78%"></span></div><span class="xs faint">$285,000 paid of $365,000 · what you owe Ana</span></div>
<span class="small muted" style="padding-top:2px">${gap}</span></section>
${archived ? `<div class="alert neutral">${iconSvg("archive")}<span><b>Ana archived this group.</b> It stays here to read, and what you already added to your ledger stays yours.</span></div>` : ""}
<button class="btn primary block">${iconSvg("circle-plus", "sm")}Add to my ledger · 1 ready</button>
<section class="stack-sm"><div class="section-head"><h3 class="h3">People</h3><span class="small muted">Equal split by default</span></div>
<div class="list card flush">
${personRow("Ana Ruiz", "Shared this group · paid for 3 expenses", 415000, "share")}
${personRow("You", archived ? "Paid $285,000 · the rest written off" : "Paid $285,000 · $80,000 still owed to Ana", 415000, "share", archived ? STATE_BADGE.off : STATE_BADGE.partial)}
${personRow("Marta Ríos", "Paid Ana in full", 415000, "share", STATE_BADGE.paid)}
${personRow("Carlitos", "Has not joined · the name Ana gave him", 415000, "share", archived ? STATE_BADGE.off : STATE_BADGE.unpaid)}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Expenses · 4</h3></div>
<div class="list card flush">${lines}</div></section>
<p class="xs faint" style="text-align:center;margin:0">Nothing of Ana’s ledger reaches you — her accounts, categories and notes stay hers — and nothing of yours reaches her.</p>
<button class="btn ghost" style="align-self:center">${iconSvg("log-out", "sm")}Leave this group</button>`;
  return screen(body, {
    tab: "mas",
    side: "shared",
    back: true,
    title: "Shared with you",
    sheet,
  });
};

const addToLedgerSheet = () =>
  fullWrap(
    `<div class="inset hstack" style="justify-content:space-between"><span class="small muted">Your share of Groceries at the market · Sep 19</span><span class="amount">${money(60000)}</span></div>
<button class="picker">${tile("wallet", "PURPLE", "sm")}<span class="body"><span class="lbl">Where it came from</span><span class="val">Nequi</span></span>${iconSvg("chevron-down", "sm")}</button>
<button class="picker">${tile("shopping-basket", "GREEN", "sm")}<span class="body"><span class="lbl">Category</span><span class="val">Groceries</span></span>${iconSvg("chevron-down", "sm")}</button>
<div class="alert neutral">${iconSvg("info")}<span><b>This is an expense of yours.</b> It records ${moneyText(60000)} dated September 19, the day of the groceries, so it counts in Stats and in that month’s budget, even if that month is already closed. <b>The category is yours to choose</b>: the group carries none, and Ana’s categories are hers.</span></div>
<p class="xs faint" style="margin:0">Ana marked your part paid, so the money has already left you: this is that payment seen from your ledger. It can be added once, on any of your devices, and deleting the expense later makes it ready again.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn primary lg" style="flex:1.4">Add ${moneyText(60000)}</button></div>`,
    "Add to my ledger",
  );

const leaveGroupSheet = () =>
  sheetWrap(
    `<div class="alert warning">${iconSvg("triangle-alert")}<span><b>You stop seeing Villa de Leyva weekend.</b> You stay in it as somebody Ana splits with.</span></div>
<p class="small muted" style="margin:0">Nothing about the money changes: your share, what you have paid and the ${moneyText(JOINED_OWED)} you still owe Ana stay exactly as they are. What you added to your ledger is yours and stays there.</p>
<p class="xs faint" style="margin:0">Ana sees that you left. To see it again, she invites you again.</p>
<div class="hstack" style="gap:10px"><button class="btn ghost lg" style="flex:1">Cancel</button><button class="btn danger solid lg" style="flex:1.4">Leave</button></div>`,
    "Leave Villa de Leyva weekend?",
  );

const NEWS = 2;

const notifRow = (icon, color, text, when, o = {}) => {
  const acts = o.actions ? `<span class="acts">${o.actions}</span>` : "";
  const badge = o.badge ? `<span class="acts">${o.badge}</span>` : "";
  const mark = o.unread ? '<span class="unread-dot" aria-hidden="true"></span>' : "";
  const hidden = o.unread ? '<span class="sr-only">Unread: </span>' : "";
  const sentence =
    o.link === false
      ? `<span class="text">${text}</span>`
      : `<a class="text" href="#">${hidden}${text}</a>`;
  return `<article class="row notif${o.unread ? " unread" : ""}">${tile(icon, color)}<span class="body">${sentence}<span class="meta">${when}</span>${acts}${badge}</span>${mark}</article>`;
};

const ANSWER = `<button class="btn ghost sm">Decline</button><button class="btn primary sm">Accept</button>`;

const notificationsScreen = (body, o = {}) =>
  screen(body, {
    tab: "mas",
    side: "notif",
    title: "Notifications",
    narrow: true,
    ...o,
  });

const MARK_ALL = `<button class="btn ghost sm">Mark all as read</button>`;

const notifSettingsLink = `<a class="row card" href="#" style="min-height:52px">${tile("settings", "GRAY", "sm")}<span class="body"><span class="title">Notification settings</span></span>${iconSvg("chevron-right", "sm")}</a>`;

const inboxRows =
  () => `<section class="stack-sm"><div class="section-head"><h3 class="h3">New</h3></div>
<div class="list card flush">
${notifRow("users", "TEAL", "<b>Ana Ruiz</b> invited you to <b>Villa de Leyva weekend</b>", "2 hours ago · Shared group", { unread: true, actions: ANSWER })}
${notifRow("users", "PURPLE", "3 changes in <b>Night out</b>", `Latest: Beto Cano recorded a payment · Yesterday 21:40`, { unread: true })}
</div></section>
<section class="stack-sm"><div class="section-head"><h3 class="h3">Earlier</h3></div>
<div class="list card flush">
${notifRow("circle-check", "GREEN", "<b>Diego Pardo</b> accepted your invitation to <b>Diego’s birthday gift</b>", "Sep 19")}
${notifRow("users", "AMBER", "<b>Carla Gómez</b> invited you to <b>Office lunch</b>", "Aug 27", { badge: '<span class="badge success">Accepted</span>' })}
${notifRow("x", "GRAY", "<b>Julián Mora</b> declined your invitation to <b>Cartagena trip</b>", "Aug 26", { link: false })}
${notifRow("users", "PINK", "<b>Marta Ríos</b> invited you to <b>Book club dinner</b>", "Aug 21", { link: false, badge: '<span class="badge">Declined</span>' })}
${notifRow("users", "BLUE", "<b>Pablo Díaz</b> invited you to <b>Ski weekend</b>", "Aug 12", { link: false, badge: '<span class="badge">No longer available</span>' })}
</div></section>
${notifSettingsLink}`;

const notificationsInbox = () => notificationsScreen(inboxRows(), { actions: MARK_ALL, news: 0 });

const notificationsArriving = () => home({ news: NEWS });

const notificationsMoreSheet = () =>
  home({ news: NEWS, nav: tabbar("mas", true), sheet: navMenuSheet(true, NEWS) });

const notificationsFolded = () =>
  notificationsScreen(
    `<div class="list card flush">
${notifRow("users", "PURPLE", "<b>Beto Cano</b> added an expense to <b>Night out</b>", "Yesterday 19:05", { unread: true })}
</div>
<div class="list card flush">
${notifRow("users", "PURPLE", "3 changes in <b>Night out</b>", "Latest: Beto Cano recorded a payment · Yesterday 21:40", { unread: true })}
</div>`,
    { actions: MARK_ALL },
  );

const notificationsEmpty = () =>
  notificationsScreen(`<div class="empty" style="padding-top:64px"><span class="tile lg outline">${iconSvg("bell")}</span>
<span class="h3">You’re all caught up</span>
<p class="small muted" style="max-width:34ch;margin:0">When someone invites you to a shared group, or changes one you’re in, it shows up here.</p>
<button class="btn secondary" style="margin-top:8px">${iconSvg("settings", "sm")}Notification settings</button></div>`);

const notificationsLoading = () => {
  const rows = range(0, 4)
    .map(
      () =>
        '<div class="row" style="cursor:default"><span class="skeleton" style="width:36px;height:36px;border-radius:999px"></span><span class="body" style="gap:6px"><span class="skeleton" style="height:12px;width:70%"></span><span class="skeleton" style="height:10px;width:40%"></span></span></div>',
    )
    .join("");
  return notificationsScreen(`<div class="list card flush">${rows}</div>`, {
    actions: `<span class="skeleton" style="height:32px;width:120px;border-radius:999px"></span>`,
  });
};

const notificationsError = () =>
  notificationsScreen(`<div class="empty" style="padding-top:64px">${tile("circle-alert", "RED", "lg")}
<span class="h3">We couldn’t load your notifications</span>
<p class="small muted" style="margin:0;max-width:280px">The server didn’t respond (503). Nothing is lost; try again in a few seconds.</p>
<button class="btn secondary" style="margin-top:8px">${iconSvg("refresh-cw", "sm")}Retry</button>
<span class="xs faint mono">Reference: 8c1f4e2a-…-3b7d</span></div>`);

const notificationsOffline = () =>
  notificationsScreen(inboxRows(), {
    actions: MARK_ALL,
    banner: `<div class="banner offline" role="status">${iconSvg("wifi-off")}<span class="txt"><b>You’re offline.</b> These are the notifications this device already has. New ones arrive when you’re back online.</span></div>`,
  });

const notificationsLocalOnly = () =>
  notificationsScreen(`<div class="empty" style="padding-top:64px"><span class="tile lg outline">${iconSvg("cloud-off")}</span>
<span class="h3">Notifications need your account</span>
<p class="small muted" style="max-width:36ch;margin:0">You’re working on this device only, so nothing from other people can reach you here.</p>
<button class="btn primary" style="margin-top:8px">Sign in to sync</button></div>`);

const notifSwitchRow = (title, help, on, o = {}) => {
  const lock = o.locked
    ? `<span class="help hstack" style="gap:4px;padding-top:4px">${iconSvg("lock", "sm")}${o.locked}</span>`
    : "";
  const control = o.locked
    ? '<span class="small muted">Always on</span>'
    : `<button class="switch" role="switch" aria-checked="${String(on)}" aria-label="${title} in the app"${o.disabled ? " disabled" : ""}></button>`;
  return `<div class="row" style="cursor:default;align-items:flex-start"><span class="body"><span class="title">${title}</span><span class="meta">${help}</span>${lock}</span>${control}</div>`;
};

const notificationSettings = ({ offline = false } = {}) => {
  const alert = offline
    ? `<div class="alert warning">${iconSvg("wifi-off")}<span>Changing this needs a connection: it is saved on the server.</span></div>`
    : "";
  const body = `${alert}<p class="small muted" style="margin:0">Choose what reaches you. Switching something off stops what comes next; what already arrived stays.</p>
<section class="stack-sm"><div class="section-head"><span class="eyebrow">Shared groups</span><span class="xs faint">In the app</span></div>
<div class="list card flush">
${notifSwitchRow("Invitations", "When someone invites you to a shared group.", true, { locked: "An invitation you never see can’t be answered." })}
${notifSwitchRow("Activity", "Answers to your invitations, and expenses and payments other people record in groups you’re in.", true, { disabled: offline })}
</div></section>`;
  return screen(body, {
    tab: "",
    side: "ajustes",
    back: true,
    title: "Notifications",
    narrow: true,
  });
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
    note: "The month's spending is the lead figure — the app exists to show the small daily spending — with a bar per day and progress against the global budget. The amber strip is the inbox of quick entries still to detail. On desktop the same content splits into two columns.",
    plates: [
      plate(
        "home",
        "Home",
        "Spending, review inbox, budgets, accounts and recent transactions. Under the four figures, one line for what people owe you and what you owe them \u2014 never added to <i>What you have</i>, because it is not money you have.",
        home(),
        { added: "2026-09-01", updated: "2026-09-22" },
      ),
      plate(
        "install-card",
        "Install card · data at risk",
        "On an iPhone or iPad, and on any Android whose browser has not protected the offline copy. Where the browser never offers to install — every iPhone — the one action is How, which opens the steps. The wide frame is a tablet held sideways: the card follows the device, not the width, and never appears on a computer.",
        home({ notice: "risk" }),
        { added: "2026-09-08", updated: "2026-09-25" },
      ),
      plate(
        "install-card-safe",
        "Install card · data already safe",
        "Android Chrome, which offers to install and already granted durable storage: the deletion sentence is gone, because it would not be true, and Install fires the browser’s own prompt.",
        home({ notice: "safe" }),
        { added: "2026-09-11", updated: "2026-09-25" },
      ),
      plate(
        "install-card-samsung",
        "Install card · Samsung Internet",
        "Installed from Samsung Internet, Android now blocks the app as dangerous: the package Samsung builds for it targets an old Android, and the first button only closes. So here the card sends you to Chrome, which installs it without a warning, and keeps Samsung’s own install one tap away — with the way past the warning — for whoever has no Chrome. The deletion sentence follows the same rule as everywhere else.",
        home({ notice: "samsung" }),
        { added: "2026-09-25" },
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
        "What the last slot of the phone's bar opens: Accounts, Shared, Notifications, Stats, Categories, Settings and the user, each with what it holds. It is the sidebar's list minus what the bar already has, so below 900px nothing is out of reach. Trends is deliberately absent — it is reached from a Stats view and its back arrow points at Stats.",
        home({ nav: tabbar("mas"), sheet: navMenuSheet(true) }),
        { added: "2026-09-15", updated: "2026-09-22" },
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
    note: "The centre button opens quick capture: amount first, category optional as a row of recent chips, main account preselected. Save creates the transaction — quick, marked as still to detail, if the category is missing. More details opens the full form, which covers expense, income and transfer with one skeleton, and a balance adjustment is made in the account rather than here.",
    plates: [
      plate(
        "quick-capture",
        "Quick capture",
        "What the centre button opens. The three-way segment on top records all three types (T-73). On a phone it fills the screen with Save in the bar on top, and More details, at the end, opens the full form (T-150); from 600px up it is the centred modal with both buttons in its footer.",
        home({ sheet: quickSheet({ type: "expense", hint: typeLine("EXPENSE"), full: true }) }),
        { added: "2026-09-01", updated: "2026-09-23" },
      ),
      plate(
        "quick-capture-typing-a-note",
        "Quick capture · typing a note",
        "T-193, his choice of 2026-09-24. From the first letter of the note, up to five of your own descriptions of this type under the field, the typed letters in bold, the most repeated first and then the most recent; a tap or Enter writes the text and nothing else. Nothing appears before you type, and nothing is highlighted until ↓ (drawn here after it). On a phone the list is in the flow between the note and the keyboard; from 600px up it floats over what is under the field.",
        suggestVariant("quick-list"),
        { added: "2026-09-24" },
      ),
      plate(
        "quick-capture-income",
        "Quick capture · income",
        "The type tints the amount and reconfigures the body: the income categories, and the account row reads “Into your main account”. The amount survives the switch.",
        home({ sheet: quickSheet({ type: "income", hint: typeLine("INCOME"), full: true }) }),
        { added: "2026-09-15" },
      ),
      plate(
        "quick-capture-transfer",
        "Quick capture · transfer",
        "Two accounts instead of one, with the swap button between them, and the two have to differ. Since T-86 it keeps a category row like the other two types — the ones marked Transfer — because the sheet hands its state to the full form, where that field exists.",
        home({
          sheet: quickSheet({ type: "transfer", hint: typeLine("TRANSFER"), full: true }),
        }),
        { added: "2026-09-15" },
      ),
      plate(
        "quick-capture-long-names",
        "Quick capture · long category names",
        "T-151. The chips take at most two lines and never scroll, and <b>More is always drawn, last</b>: a row that scrolled sideways hid it past the edge, and on a desktop nothing says a row of chips can be scrolled. The chips are the four most used and only those that fit whole in the two lines with More, measured on each name at the current text size. Here the second most used is \u201cMonthly subscriptions for the whole family, streaming and cloud storage\u201d, longer than a line: it is not drawn, and Coffee and Transport take its place in the ranking\u2019s order. Two lines rather than one is his choice of 2026-09-23.",
        home({
          sheet: quickSheet({
            type: "expense",
            hint: typeLine("EXPENSE"),
            full: true,
            chips: `${catChip("Home groceries", true)}${catChip("Coffee")}${catChip("Transport")}`,
          }),
        }),
        { added: "2026-09-23" },
      ),
      plate(
        "quick-capture-name-longer-than-row",
        "Quick capture · a chosen name longer than the row",
        "T-151. The chosen category is always drawn, and it is the only chip that can be cut: when its name alone is longer than a line, it fills the first one with an ellipsis and More goes to the second.",
        home({
          sheet: quickSheet({
            type: "expense",
            hint: typeLine("EXPENSE"),
            full: true,
            chips: `${catChip(
              "Monthly subscriptions for the whole family, streaming and cloud storage",
              true,
            )}`,
          }),
        }),
        { added: "2026-09-23" },
      ),
      plate(
        "full-screen-quick-add",
        "A phone sheet with a form fills the screen",
        "T-150. His decision of 2026-09-23 that no phone sheet keeps rising from the bottom, and his correction the same day: \u00abno es ponerlo arriba literalmente. el modal debe cambiar su estructura para que no sea abajo no simplemente subirlo. debe de existir algun estandar para modales en movil\u00bb. This is the standard both platforms share \u2014 Material 3\u2019s full-screen dialog, iOS\u2019s sheet with a navigation bar \u2014 and the first of the two forms every phone sheet now takes. <b>The rule: a form (more than one field) or a list that scrolls is a full-screen dialog; a question, a short choice, or one field with its button is a centred dialog.</b> Full screen means a 56px bar on top \u2014 close on the left, the title, the sheet\u2019s one primary action on the right \u2014 and the body scrolling under it, so the keyboard can cover part of the body but never the action. In quick add, Save moves up to the bar and More details goes to the end of the body. <b>The bar that opened the full form goes</b>: there is no sheet edge left to pull (his gesture of 2026-09-15), and More details stays as the way in. Drawn with the numeric keyboard up. From 600px up nothing changes: the same sheet is the centred 520px modal with its footer \u2014 switch the device to see it.",
        quickFullScreen({ keyboard: "numeric" }),
        { added: "2026-09-23" },
      ),
      plate(
        "full-screen-picker",
        "A phone sheet with a list fills the screen",
        "The list half of the rule. The picker fills the screen with its search pinned under the bar, and the list scrolls between the search and the keyboard, so every row can be reached while typing. There is no action on the right: choosing a row is the answer and closes it, as today. The account, contact, transaction and account-type pickers, Filters, and every sheet that creates or edits something \u2014 an account, a category, a contact, a group, a split, settle up, pay, adjust balance, invite \u2014 take this same form.",
        pickerFullScreen(),
        { added: "2026-09-23" },
      ),
      plate(
        "full-form-expense",
        "Full form · expense",
        "Under the segment, the line that says what the selected type is, and the <b>?</b> that opens the three explained side by side (T-86).",
        transactionForm("EXPENSE", { hint: typeLine("EXPENSE") }),
        { added: "2026-09-01", updated: "2026-09-17" },
      ),
      plate(
        "full-form-typing-a-description",
        "Full form · typing a description",
        "T-193. The same list under Description, from your movements of the selected type — an expense form suggests from expenses — with the movement being edited left out. Choosing a row writes only the description: the category, the amount and the tags stay as they are.",
        suggestVariant("form-text"),
        { added: "2026-09-24" },
      ),
      plate(
        "full-form-typing-a-tag",
        "Full form · typing a tag",
        "T-193. Tags take the same list once you type, instead of the eight alphabetical chips: each row is the tag, how often you used it and the category it usually goes with, the ones that go with this description and the chosen category first, then the most used, then the most recent; a tag matches at its start or after a hyphen. Enter with nothing highlighted still adds exactly what you typed.",
        suggestVariant("tags-list"),
        { added: "2026-09-24" },
      ),
      plate(
        "full-form-transfer",
        "Full form · transfer",
        "Everything T-86 settled, on one screen: the line and the <b>?</b>, the three intent chips that fill <i>From</i> and <i>To</i> in the right direction, the optional category — only the ones marked Transfer — and the sentence that reads the movement back as a difference.",
        decidedTransferForm(),
        { added: "2026-09-01", updated: "2026-09-17" },
      ),
      plate(
        "full-form-transfer-plain",
        "Full form · a transfer that is not a debt",
        "The same sentence, in the grammar of the accounts it names: an ordinary account takes a sign, a debt takes <i>more owed</i> or <i>less owed</i>. Putting money aside is the case that shows the plain half, and a cash advance — out of the card, into the bank — is the case the fourth cell of the table in <code>spec/screens/add.md</code> exists for. The intent chips sit above <i>From</i> with <b>Move to savings</b> taken.",
        transactionForm("TRANSFER", {
          hint: typeLine("TRANSFER"),
          transfer: PLAIN_SIDES,
          amount: nf.format(SAVINGS_AMOUNT),
          intents: intentChips(false, "savings"),
          cat: transferCatRow(null),
          readback: PLAIN_TWO_SIDES,
          description: "Monthly saving",
        }),
        { added: "2026-09-17" },
      ),
      plate(
        "category-picker",
        "Category picker",
        "Search, recents and a way to create one without leaving the form.",
        categoryPicker(),
        { added: "2026-09-01" },
      ),
      plate(
        "account-picker",
        "Account picker",
        "The ordinary one: every account the user has, the debt ones read in their own vocabulary. The two rows that come and go are drawn beside it \u2014 a card and a loan leave under <b>Income</b>, and <b>Somewhere else</b> only arrives in the <i>From</i> of a transfer into an account that owes money.",
        accountPicker(),
        { added: "2026-09-01", updated: "2026-09-18" },
      ),
      plate(
        "income-picks-only-money-accounts",
        "Account picker \u00b7 on an income",
        "The form's half of T-93, whose rule lives in the server. An income cannot land on a card or a loan \u2014 money arriving there is a <b>payment</b>, and counted as income it would inflate <i>Income this month</i>, <i>Estimated savings</i> and every income budget with money nobody earned. So under <b>Income</b> the picker leaves those two out, and the note says why rather than leaving someone hunting for their Visa. <b>An overdraft stays</b>, and it is the one debt type that does: his decision of 2026-09-18, because a positive balance is an overdraft's ordinary state and a salary landing there is income. <b>Somewhere else</b> goes with them: money from outside landing on an account that holds money <i>is</i> income, so that row has nothing to offer here. Expense and Transfer are untouched \u2014 spending with a card, paying one and a cash advance out of one are all real. ",
        accountPicker("income"),
        { added: "2026-09-18" },
      ),
      plate(
        "transfer-from-somewhere-else",
        "Full form \u00b7 transfer paid from somewhere else",
        "T-100, his words of 2026-09-17. The Pay sheet's row is now in the full form too, in the <i>From</i> of a transfer: a debt can be paid with money the app does not track \u2014 cash, someone else's transfer, an account never registered \u2014 and nothing here loses that money, so it cannot be a transfer. What it writes is the Pay sheet's movement, a one-sided <b>ADJUSTMENT</b> raising the card, so the rest of the form follows it: <b>no category</b> (an adjustment carries none), the <b>one-sided sentence</b> instead of the two-sided one, and the <b>swap button disabled</b>, because one of the two sides is not an account and the <i>To</i> never takes this row. The loan ceiling of T-93 still applies on the amount. Saved, it can no longer be edited <i>here</i> \u2014 an adjustment left this form with T-85 \u2014 and <code>/transactions/&lt;id&gt;/edit</code> sends it on to the detail, whose <b>Edit</b> opens the adjustment sheet (T-89).",
        transactionForm("TRANSFER", {
          hint: typeLine("TRANSFER"),
          transfer: OUTSIDE_SIDES,
          amount: nf.format(PAY_AMOUNT),
          intents: intentChips(false),
          readback: OUTSIDE_ONE_SIDE,
          swap: false,
        }),
        { added: "2026-09-18" },
      ),
      plate(
        "transfer-from-only-when-it-applies",
        "Account picker \u00b7 the From of a transfer into a card",
        "The condition he asked to be defined, and it is <b>the Pay sheet's own</b>: paying a debt is offered on an account only while it is a debt account <b>and its balance is below zero</b>, so the row that pays it from outside appears on the same terms \u2014 one sentence for both screens. Everywhere else money from outside <b>is income</b>: an ordinary account, a savings account, a card whose owner has money sitting on it, a loan already settled. <b>An overdraft in the red takes it</b>, which does not reopen his decision of 2026-09-18 that an income may land on an overdraft \u2014 a positive overdraft is its ordinary state, one below zero owes money like any other debt. It is <b>not offered in the To</b> (his decision, 2026-09-18): money leaving towards something the app does not track is an <b>Expense</b>, and a second way to record it that is not spending would keep the same act out of Stats and out of every budget. Visa Gold is missing from this list because it is already the <i>To</i>.",
        accountPicker("outside"),
        { added: "2026-09-18" },
      ),
      plate(
        "expense-for-a-shared-group",
        "Full form \u00b7 an expense that belongs to a shared group",
        "T-137. Reached from a group's <code>Add expense</code> (<code>shared.html#record-a-new-expense</code>), so the form knows the group before it is drawn and says so at the top, with the split it will inherit and the sentence the section never lets anyone miss \u2014 splitting changes nothing today. <b>The type segment is not drawn</b>: sharing an income or a transfer is out of v1, so the control has one answer, and a control nobody can use is not drawn. The button says what it does, because it writes <b>two</b> things: the movement in your ledger and the group's expense on top of it. Back and save both return to the group.",
        expenseForGroup(),
        { added: "2026-09-21" },
      ),
      plate(
        "shared-expense-only-half-saved",
        "When only the movement lands",
        "The two writes are not atomic \u2014 <code>POST /sync</code> applies one operation at a time and online they are two requests \u2014 so the movement is written <b>first</b>: it is the money, and it is true whatever the group does. When the group refuses, the form is <b>replaced</b> by what actually happened, because there is nothing left to type; leaving the fields would offer to change an amount already recorded. <code>Add it to the group again</code> retries only the half that is missing. With no network this state does not appear: both writes queue, the expense waits for its movement, and a refusal surfaces in the attention tray.",
        halfSaved(),
        { added: "2026-09-21" },
      ),
      plate(
        "shared-group-cannot-take-it",
        "A group that cannot take it \u00b7 archived",
        "The group is read before the form is drawn, and the three cases that make it unusable are said rather than worked around. Drawn here is the archived one \u2014 read, not worked; the other two are the screen's own error with its reference (<code>states.html</code>) and the <i>doesn't exist</i> empty the group detail already draws, each with the way out that applies. None of them quietly falls back to recording a loose movement, which would be a form doing something other than what it announced.",
        groupCannotTakeIt(),
        { added: "2026-09-21" },
      ),
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
        "create-account-email-taken",
        "Create account · email taken",
        "EMAIL_TAKEN: a live account, or a deleted one signed up with a password it did not have.",
        register("taken"),
        { added: "2026-09-23" },
      ),
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
    note: "Grouped by day with a daily total; filter chips mirror the API's filters and a summary heads the period. The detail shows everything the backend keeps, including the source. The review inbox completes a quick entry inline — an expense or an income, each with the categories of its own type: category chips, description and Done.",
    plates: [
      plate(
        "list",
        "List",
        "Search, filters and infinite scroll. A shared expense keeps the full amount on the right \u2014 that is what left the account \u2014 and says your share underneath. The download button in the header is live (T-188).",
        transactions(),
        { added: "2026-09-01", updated: "2026-09-24" },
      ),
      plate("detail", "Detail", "", transactionDetail(), { added: "2026-09-01" }),
      plate(
        "review-inbox",
        "Review inbox",
        "Quick entries to name and categorise, saved in one batch. An income reads as an income and is offered income categories (T-98).",
        reviewInbox(),
        { added: "2026-09-01" },
      ),
      plate(
        "filters",
        "Filters",
        "Period with presets and a range, type \u2014 now including payments between people \u2014 account, category, tag, only what is still to review, only quick entries. The main button says how many results are waiting.",
        filtersSheet(),
        { added: "2026-09-01", updated: "2026-09-20" },
      ),
      plate(
        "export",
        "Download",
        "T-188. The header’s download button opens this sheet. <b>What</b> defaults to what the list is showing — period, filters and search, every page — and offers everything; <b>Format</b> is Excel or CSV. The count lives in each choice, so the button is only <i>Download</i> and fits any width and language. The file is built on this device from its copy and never asks the server.",
        exportSheet(),
        { added: "2026-09-24", updated: "2026-09-24" },
      ),
      plate(
        "export-csv",
        "Download · CSV",
        "The same sheet with CSV chosen: the line under the control says what CSV is for, and how Excel in Spanish opens it.",
        exportSheet({ format: "csv" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-counting",
        "Download · counting a search",
        "The list’s count ignores the search, so with a search in force the device counts the matches first: the line waits and the button is disabled for that moment.",
        exportSheet({ state: "counting" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-empty-view",
        "Download · nothing matches the filters",
        "When the list is empty, <i>What you’re viewing</i> is off and <i>All transactions</i> is chosen. With no transactions at all the header button is disabled: the list’s own empty state already says why.",
        exportSheet({ state: "empty-view" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-no-copy",
        "Download · the copy is still arriving",
        "The download is made from the device’s copy, never page by page from the server. While the account’s first download runs, the sheet says so and the button wakes up by itself when the copy can answer.",
        exportSheet({ state: "no-copy" }),
        { added: "2026-09-24", updated: "2026-09-24" },
      ),
      plate(
        "export-no-copy-offline",
        "Download · no copy and no connection",
        "The first download could not even start: it needs the network first.",
        exportSheet({ state: "no-copy-offline" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-no-copy-failing",
        "Download · the first download keeps failing",
        "Online, but the copy never arrived — a server error or a session that died. “Still arriving” would be untrue, so it says what happened and offers to try again.",
        exportSheet({ state: "no-copy-failing" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-no-copy-broken",
        "Download · the copy could not be opened",
        "Storage exists but refused to open (a blocked upgrade, a full disk). Changing browsers is the wrong advice here; reloading is the right one.",
        exportSheet({ state: "no-copy-broken" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-no-copy-unsupported",
        "Download · a browser that cannot keep a copy",
        "Rare — storage blocked or refused — and it says so plainly instead of hammering the server with hundreds of requests.",
        exportSheet({ state: "no-copy-unsupported" }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-preparing",
        "Download · preparing the file",
        "The file is written away from the screen, in batches, so the app never freezes however long the history is. The button spins in place (its name stays “Preparing file…”), a bar and a count say how far it is, and Cancel and the close button stay live and stop it.",
        exportSheet({ state: "preparing" }),
        { added: "2026-09-24", updated: "2026-09-24" },
      ),
      plate(
        "export-done",
        "Download · handed to the browser",
        "The sheet closes, focus goes back to the download button and a toast names the file. It says <i>Downloading</i>, not <i>Saved</i>: the browser can still ask, block or cancel, and the app cannot know. If building it fails, a <code>danger</code> toast says so with its reference and a Retry, and nothing is handed over.",
        transactions({
          toast: `<div class="toast">${iconSvg("download")}Downloading ledger-flow-transactions-2026-09.xlsx</div>`,
        }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-done-share",
        "Download · on an iPhone’s installed app",
        "There a download opens a viewer, so the file goes to the share sheet — and the share sheet needs a tap of its own, which a long build has long since used up. The toast offers it instead of opening it.",
        transactions({
          toast: `<div class="toast">${iconSvg("check")}Your file is ready<button class="action">Share file</button></div>`,
        }),
        { added: "2026-09-24" },
      ),
      plate(
        "export-file",
        "The file, and the template for an import",
        "One format for every language, so the file you download is the file a future import reads: fixed column names, types as codes, dates as <code>2026-09-22</code>, amounts with a dot. The first eleven are what a person writes, and all a template needs; the next five are written by the app and let an import rebuild a download exactly; the last four are for reading and an import ignores them. Oldest first. <b>amount</b> is negative when money left an account and positive when it arrived — a transfer carries no sign — and a shared expense keeps its full amount there with <b>your_share</b> beside it.",
        exportFile(),
        { added: "2026-09-24", updated: "2026-09-24" },
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
        "Its category had been archived elsewhere, so the server saved the entry without one.",
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
        "payment-detail",
        "A payment\u2019s own detail",
        "Its money belongs to the payment, and the server refuses to move it on its own, so the screen offers no Edit and no Delete and says why in one line rather than two buttons that always fail. Under that line is the door that <b>does</b> exist: <code>Undo the payment</code> takes the payment and this movement together (<code>shared.html#undo-a-payment</code>).",
        transactionDetail({ payment: true }),
        { added: "2026-09-21", updated: "2026-09-21" },
      ),
      plate(
        "a-payment-between-people",
        "A payment between people in the list",
        "The fifth kind of movement. It is money arriving, so the day\u2019s total moves with it \u2014 but it is <b>not income</b>: it is drawn neutral with a <code>hand-coins</code> tile and a <i>Payment</i> badge, it carries no category, and Stats and the budgets leave it out, exactly as they leave out an adjustment. The type filter gains it; the Add form does not, because a payment is recorded from <i>Settle up</i> and nowhere else.",
        transactions({ settlement: true }),
        { added: "2026-09-20" },
      ),
      plate(
        "shared-expense",
        "A shared expense, and its history",
        "The figure that counts is neither the total nor your share: it is the $600,000 in between, and it moves every time somebody pays. The history is the record of how it got there, and it says plainly that splitting and writing off changed nothing \u2014 the money had already left the account. Beto reads <i>Paid</i> here and <i>Partially paid</i> in the group, because a payment covers the oldest expense first.",
        transactionDetail({ shared: true }),
        { added: "2026-09-20" },
      ),
      plate(
        "shared-expense-pending",
        "A shared expense · a payment not synced yet",
        "Beto’s payment is still on this device. The card follows its group: the lead figure is marked, and so is Beto’s row, because his figure here includes it. Everybody else’s row carries nothing, and the history is never marked — every line of it is one the server wrote.",
        transactionDetail({ shared: true, sharedPending: true }),
        { added: "2026-09-23" },
      ),
      plate(
        "shared-expense-guest-payments",
        "A shared expense · what the guests have paid",
        "A block of guests lives in <b>this expense alone</b>: it is not a person, it never reaches the <code>People</code> face, and it has no page of its own. So its payments are listed here and nowhere else, and each one undoes itself like any other (<code>shared.html#undo-a-payment</code>). Without this list a payment to a block could not be taken back \u2014 and the expense could not be deleted either, because the server refuses to lose a block that has paid.",
        transactionDetail({ shared: true, guestPayments: true }),
        { added: "2026-09-21" },
      ),
      plate(
        "delete-a-shared-expense",
        "Deleting one people have paid for",
        "The confirmation names what it drags, and the surprising half is what it does <b>not</b> do: <b>no payment is deleted</b>. A payment belongs to the person, not to one expense, so the $1,100,000 that has arrived stays and re-imputes over the four expenses left. What does change is what everybody owes — Ana would be $300,000 ahead of a smaller share — and the sheet says so, and offers writing it off instead.",
        deleteSharedSheet(),
        { added: "2026-09-20" },
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
    note: "What you have and what you owe on top, archived accounts folded away. The detail gathers the actions: adjust balance — which creates an adjustment with the computed delta — edit, make main, and archive, blocked with an explanation while it is the main one.",
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
        "centred-dialog-with-the-keyboard",
        "A centred dialog, with the keyboard up",
        "One field and its button stay a centred dialog. With the keyboard up it centres on the space above it rather than on the whole screen, so the field and the button are never behind the keyboard. Drawn on restoring an account whose name is taken; renaming, the ceiling of a budget and every one-figure sheet work the same.",
        centred(accountRestoreSheet(), "text"),
        { added: "2026-09-23" },
      ),
      plate(
        "account-type-sheet",
        "Account type",
        "One row that opens a sheet with the nine types, each with a line that explains it. The onboarding uses the same picker.",
        accountForm({ sheet: true }),
        { added: "2026-09-06" },
      ),
      plate(
        "account-detail-as-debt",
        "Account detail \u00b7 a card read as debt",
        "The card\u2019s own screen with the whole reading in place: what is still available as the headline, the bar of the limit under it, and <b>Pay this card</b> as the one primary action above the four that were already there. It is drawn on its own because the pay sheet’s veil covers exactly this.",
        debtDetail(VISA, VISA_DETAIL),
        { added: "2026-09-17" },
      ),
      plate(
        "loan-detail-and-pay",
        "Loan detail \u00b7 and paying it",
        "The other half of his sentence \u2014 <i>un bot\u00f3n para pagar la tarjeta <b>o el pr\u00e9stamo</b></i> \u2014 drawn because a loan is not a card. It has no limit, so the bar is what is <b>still owed</b> of what was borrowed and the line under it says how much is paid; its opening balance is the loan itself, so the hero\u2019s last line carries it. <b>Pay this loan</b> opens the same sheet as the card. <b>Two things are true here and not on the card.</b> Paying a loan in full is the rare case, not the common one \u2014 the ordinary payment is the monthly instalment \u2014 which is why the sheet opening with the whole debt read wrong on this screen; <b>T-99 fixed that for both</b> (`#pay-opens-empty`), and a <i>This month\u2019s payment</i> preset would still need a field the account does not have: the two it gains are the credit limit and the amount borrowed, and neither is an instalment. And the instalment is the place T-86\u2019s capital-and-interest split lands: under that split one payment is two movements, and this sheet writes one. ",
        debtDetail(CARLOAN, LOAN_DETAIL),
        { added: "2026-09-17" },
      ),
      plate(
        "debt-in-credit",
        "A debt account that owes nothing",
        "<b>This is where your cards are right now</b>, and it is not T-90. A CARD or an OVERDRAFT whose balance is zero or above owes nothing, and <b>past zero it keeps leading with what it has available</b> (T-101): the money on it is its owner’s, so it is credit to spend on top of the limit. Two accounts are drawn: a card carrying your own $4,000,000 — a limit typed in as a balance, exactly what you described — and an overdraft at $320,000, which is the <b>ordinary</b> state of an overdraft and not a mistake at all. The overdraft has its field, so it reads <b>$2,320,000 available</b> with <i>$0 owed of $2,000,000 · $320,000 of your own money on it</i> under an empty bar: the sentence it already had at exactly zero, with one clause added. The rule has to exist either way: a card can be overpaid, an overdraft normally sits positive, and until T-90 runs every card in the product looks like the first one. Without it the screen would say “$4,000,000 owed” about money you have, and until T-101 it said nothing at all about what was still available. <b>The card is drawn with no limit yet, because that is the whole state on day one:</b> no account carries the field until someone fills it, so it reads $0 owed with the money named, <b>no bar at all</b> — there is no scale to fill — and the prompt still asks for the limit. <b>It is also the honest answer to “why did my total drop”:</b> once this ships, that card stops counting $4,000,000 towards what you have. ",
        debtInCredit(),
        { added: "2026-09-17" },
      ),
      plate(
        "adjust-balance-on-a-debt",
        "Adjust balance \u00b7 on a card",
        "The same sheet, asking what he decided on 2026-09-17 when he asked whether adjusting a card meant the available credit or the debt: <b>the debt</b>. So <i>Actual balance</i> and its Positive / Negative pair give way to the question the account form already asks \u2014 <b>How much do you owe on it right now?</b> \u2014 and the line under it reads the recorded state in the product\u2019s own words. <b>The pair does not disappear, it changes what it means:</b> <i>Owed</i> or <i>Your own money</i>, because an overdraft sitting positive is its ordinary state, a card can be overpaid, and until T-90 runs every card is in exactly that state; without it those balances could not be said on the one screen whose job is to say them. The question follows the choice, so the label cannot contradict the answer, and the difference is read as the grammar the rest of the product uses: <b>less owed</b>, not \u201can adjustment of \u2212$12,300\u201d. Nothing changes in what reaches the server. ",
        debtDetail(VISA, {
          ...VISA_DETAIL,
          sheet: adjustDebtSheet("Visa Gold", 1233600, {
            owed: true,
            recorded: CARD_OWED,
            line: `<b>${money(12300)} less owed</b> will be recorded as an adjustment.`,
            note: "Statement says less",
          }),
        }),
        { added: "2026-09-17" },
      ),
      plate(
        "adjust-balance-owes-nothing",
        "Adjust balance \u00b7 a card that owes nothing",
        "The other half of the same sheet, and <b>the state every card in the product is in until T-90 runs</b>: the balance is money of its owner, so it opens on <i>Your own money</i> and the question follows it. The alert is the plain one here, on purpose. \u201c$8,000,000 more owed\u201d about a debt that went from nothing to $4,000,000 would be a figure nobody owes, so the debt grammar is kept for movements that are debt at both ends \u2014 the same rule the transfer readback follows \u2014 and everything else falls back to <i>An adjustment of \u2212$8,000,000 will be created</i>, which is true on either side of zero. ",
        debtDetail(VISA, {
          ...VISA_DETAIL,
          sheet: adjustDebtSheet("Visa Gold", CARD_LIMIT, {
            owed: false,
            recorded: CARD_LIMIT,
            line: `<b>An adjustment of ${money(8000000, "\u2212")}</b> will be created to reconcile the account.`,
            note: "Moving it to what I owe",
          }),
        }),
        { added: "2026-09-17" },
      ),
      plate(
        "debt-past-zero-on-a-loan",
        "A loan that is paid off \u00b7 and one paid past the end",
        "The other half of T-101, and the one that read backwards: on a loan the bar is <b>what you have paid</b>, so the day the last instalment clears the debt the bar was falling from 90% to <b>0%</b> \u2014 exactly the day it should be full. Drawn here with the loan $200,000 past the end, which is the state a card is allowed to reach and a loan is not: it reads <b>$0 owed</b> with the bar <b>full</b> and <i>$12,000,000 paid of $12,000,000</i>, and money of its owner is <b>not</b> named, because there is no such thing on a loan \u2014 what there is, is a loan that is finished. <b>And Pay this loan is not on the screen</b>: the primary action only exists while the account is below zero, which is what the detail already does for every debt account. ",
        debtDetail({ ...CARLOAN, owed: -200000 }, { ...LOAN_DETAIL, what: null }),
        { added: "2026-09-18" },
      ),
      plate(
        "adjust-balance-on-a-loan",
        "Adjust balance \u00b7 on a loan",
        "The same sheet T-95 drew for a card, minus the one thing that means nothing here (T-101): a loan cannot hold money of its owner, so the <i>Owed / Your own money</i> pair is <b>not offered</b> and the question is the only one there is \u2014 <b>How much do you owe on Car loan right now?</b>. The line under it still reads the recorded state as it really is, so a loan that landed in credit by another route says so and the adjustment that puts it back is one figure away. Nothing changes in what reaches the server. ",
        debtDetail(CARLOAN, {
          ...LOAN_DETAIL,
          sheet: adjustDebtSheet("Car loan", LOAN_OWED - 150000, {
            owed: true,
            loan: true,
            recorded: LOAN_OWED,
            line: `<b>${money(150000)} less owed</b> will be recorded as an adjustment.`,
            note: "Statement says less",
          }),
        }),
        { added: "2026-09-18" },
      ),
      plate(
        "pay-opens-empty",
        "Pay this card \u00b7 as the sheet opens",
        "T-99, his words of 2026-09-17: <i>el valor por defecto no puede ser el pagar el valor total. el valor total debe ser la segunda opcion y el usuario debe decider cuanto es lo que paga</i>. The field used to open <b>holding the whole debt</b>, so the sheet had already decided what you were paying and the only way out was a chip that emptied it again. Now it opens <b>empty, with the keyboard up</b> \u2014 what the Quick add does, and what he approved there \u2014 and the total is <b>one chip that fills it</b>, carrying its own figure so nothing is hidden by the change. The chip reads as selected while the typed amount is exactly that, so it also answers <i>have I typed all of it?</i>, and it is a <b>switch</b>: pressing it again empties the field, which is the way back <i>Another amount</i> used to be \u2014 one tap instead of deleting a seven-figure number by hand. <b>Pay stays disabled and no sentence is read back</b> until there is an amount: there is no movement yet to describe. <b>The second chip goes:</b> <i>Another amount</i> existed only to clear a field that arrived full, and beside an empty focused field it is a control with nothing to do. <b>This is also what `#loan-detail-and-pay` flagged</b> \u2014 on a loan the ordinary payment is the instalment, not the whole debt \u2014 and the sheet no longer assumes either; what a <i>This month\u2019s payment</i> preset would need is still a figure the account does not carry, which is T-94.",
        debtDetail(VISA, {
          ...VISA_DETAIL,
          sheet: paySheet(VISA, "Pay Visa Gold", { empty: true, cat: transferCatRow(null) }),
        }),
        { added: "2026-09-18" },
      ),
      plate(
        "pay-a-loan-not-more-than-owed",
        "Pay this loan \u00b7 not more than it owes",
        "His sentence, 2026-09-17: <i>supongo que se debe de limitar que no se pague de mas</i> \u2014 and on a loan it is a limit, not a warning. Anything above what is still owed is refused on the field, with the figure in the message, and the button stays disabled; the read-back does not appear either, because there is no movement to read back. A CARD and an OVERDRAFT are the opposite case and keep taking it: overpaying a card is real and the bank shows it as money in your favour. ",
        debtDetail(CARLOAN, {
          ...LOAN_DETAIL,
          sheet: paySheet(CARLOAN, "Pay Car loan", {
            amount: 9000000,
            error: `A loan cannot be paid more than the ${moneyText(LOAN_OWED)} it still owes.`,
            cat: transferCatRow(null),
            read: "",
          }),
        }),
        { added: "2026-09-18" },
      ),
      plate(
        "account-create-a-debt",
        "Creating a card \u00b7 the field that asks for the debt",
        "The form that starts the habit. Today <i>Current balance</i> is a plain amount box, so \u201cmy card has a limit of 100\u201d becomes a balance of 100 \u2014 which is how the cards got into the state T-90 has to repair. On a CARD, an OVERDRAFT or a LOAN the field asks the question instead: <b>How much do you owe on it right now?</b>, entered as a plain positive figure and stored as the debt, with the credit limit beside it and a preview card that reads back what the account will look like. Every other type keeps the field it has. <b>The alternative was drawn and dropped:</b> keeping \u201cCurrent balance\u201d with an increase/decrease control beside it, which puts a sign decision in front of someone on the one screen where the whole confusion starts. ",
        createDebtAccount(),
        { added: "2026-09-17" },
      ),
    ],
  },
  {
    file: "shared.html",
    title: "Shared",
    group: "Screens",
    note: "Expenses split with other people, and who has paid you back. A shared group is one outing or one trip, so it has a date range and never a month. The lead figure everywhere is what still counts as yours: an expense is born entirely yours and only falls when somebody actually pays, which is why nothing here can be read as money you already have.",
    plates: [
      plate(
        "people",
        "People",
        "The face the section opens on: the net per person across every group, split into who owes you and who you owe, with the settled ones folded away. The amounts are neutral and unsigned — a debt between people is neither income nor spending, and the word says the direction.",
        sharedPeople(),
        { added: "2026-09-20" },
      ),
      plate(
        "groups",
        "Shared groups",
        "The other face. Each group carries its date range — Cartagena trip runs from August into September — the number of people, what it cost in total, your share of it, and a bar of what has come back to you.",
        sharedGroups(),
        { added: "2026-09-20" },
      ),
      plate(
        "group",
        "A shared group",
        "The detail. It leads with the $2,100,000 that still counts as yours, not with the $3,200,000 the trip cost nor with the $800,000 that is fairly yours: that middle figure is the one Stats and the budgets use. Four people, four states, and the writing-off of Lucía’s share is why the figure will never reach $800,000. The last row of People is the way to let them see it (<code>#invite</code>), and it says who already does.",
        groupDetail(),
        { added: "2026-09-20", updated: "2026-09-22" },
      ),
      plate(
        "group-with-another-payer",
        "A shared group somebody else also paid for",
        "The owner’s own example, and the case a one-payer group cannot show: Ana paid for the tickets. That line is <b>not an expense of yours</b> — no movement of yours exists for it — so it is drawn neutral and says so, and it becomes your expense only when you pay her. What you can collect is the <b>net</b> between each pair: Ana owes you $56,300 and you owe her $30,000, so she sends $26,300. The fuel carries its own split, because Beto did not ride.",
        nightOut(),
        { added: "2026-09-20" },
      ),
      plate(
        "person",
        "A person",
        "One contact across every group, with what they have already paid and how. A contact is an entity of its own, never an account: nothing here reaches balances, Stats, Budgets or Categories.",
        personDetail(),
        { added: "2026-09-20" },
      ),
      plate(
        "undo-a-payment",
        "Undoing a payment",
        "A payment recorded by mistake is <b>undone, never balanced with a second one</b>: a payment the other way is a real event, and using it to fix a typo leaves two movements that never happened. The sheet says what reaches further than the row it was opened from \u2014 the movement goes with it, what counts as yours goes <b>back up</b> in the month each expense happened, and everything else that person has paid is imputed again over what is still open. What it does <b>not</b> touch: no expense leaves the group and a write-off stays a write-off. Reached from here and from the movement's own detail (<code>transactions.html#payment-detail</code>).",
        undoPayment(),
        { added: "2026-09-21" },
      ),
      plate(
        "invitations",
        "An invitation waiting for you",
        "Somebody invited you to one of their groups. It sits above both faces, so it is the first thing Shared says, and it shows the only two things an invitation may reveal: the name of the group and who sent it. The two answers are right there; the count beside the heading is the one More and the sidebar carry.",
        sharedInvitations(),
        { added: "2026-09-22" },
      ),
      plate(
        "invitation-first",
        "An invitation to somebody new",
        "The commonest way anybody meets Shared: a friend invited them, and they have nothing of their own yet. The invitation sits above the empty state, which still offers the two ways in.",
        sharedInvitationFirst(),
        { added: "2026-09-22" },
      ),
      plate(
        "invitation-other-currency",
        "An invitation in another currency",
        "Each person keeps one currency, and a group in euros cannot land in a ledger in pesos. So the row says why and offers only <b>Decline</b>. The person who invited is never told why: to them it reads <i>waiting</i> until it is declined or runs out.",
        sharedInvitationOtherCurrency(),
        { added: "2026-09-22" },
      ),
      plate(
        "invitation-answered",
        "Answered",
        "The row answers in place — <b>Joined</b> or <b>Declined</b> — rather than vanishing under the finger, and leaves the next time Shared opens. The same happens when it was answered on another device.",
        sharedInvitationAnswered(),
        { added: "2026-09-22" },
      ),
      plate(
        "invitations-offline",
        "Offline",
        "The invitation still shows — it came down with everything else — but answering waits for a connection: the answer goes to somebody else, and only the server can tell whether the invitation still stands.",
        sharedInvitationsOffline(),
        { added: "2026-09-22" },
      ),
      plate(
        "pending-people",
        "Not synced yet · People",
        "A payment from Beto was recorded with no connection. It marks what it touches and nothing else (owner’s decision, 2026-09-23): Beto’s net, and the two figures on top, which add up everybody and move together. Ana and Diego are untouched, so their figures carry nothing.",
        sharedPeoplePending(),
        { added: "2026-09-23" },
      ),
      plate(
        "pending-groups",
        "Not synced yet · Shared groups",
        "The same payment on the other face: a payment covers the oldest line first across every group shared with that person, so <b>both</b> of Beto’s groups are marked, and Diego’s gift is not. Coffee farm tour was created here, so the row itself is the write and says <i>Pending sync</i>, like a Transactions row.",
        sharedGroupsPending(),
        { added: "2026-09-23" },
      ),
      plate(
        "pending-group",
        "Not synced yet · a group",
        "An expense recorded here with no connection. The row that <b>is</b> the write carries <i>Pending sync</i> and <i>Saved on this device</i>; an expense changes everybody’s share, so the lead figure, the bar and every person’s figure carry the projection mark — and so do Ana, Beto and Lucía wherever else they appear, because their payments are spread over their lines again. When the operation is refused, the badge turns <i>Needs attention</i>.",
        groupDetail({ pending: true }),
        { added: "2026-09-23" },
      ),
      plate(
        "pending-person",
        "Not synced yet · a person",
        "Beto’s side of the same payment. The payment row is the write; his net and his figure in each group include it. Undoing a payment with no connection marks exactly the same figures.",
        personDetail({ pending: true }),
        { added: "2026-09-23" },
      ),
      plate(
        "invitations-in-more",
        "How an invitation is found",
        "Not by chance: a brand dot on More, the count on the Shared row inside the sheet, and the same count beside Shared in the sidebar from 900px. It is the count of invitations that can still be answered, and it goes the moment the last one is.",
        sharedInvitationsInMore(),
        { added: "2026-09-22" },
      ),
      plate(
        "invite",
        "Inviting them to see the group",
        "One row per person in the group, with where each one stands: <b>Joined</b>, <b>not invited</b>, or no email to invite with. The sheet says what joining shows and what it never shows, and that nothing is emailed.",
        groupDetail({ sheet: inviteSheet() }),
        { added: "2026-09-22" },
      ),
      plate(
        "invite-waiting",
        "Invited, and waiting",
        "Right after <b>Invite</b>. The row reads <i>waiting</i> and offers <b>Withdraw</b>, and the sheet says the part that protects the other person: you are not told whether that address has an account. It reads the same either way until they answer.",
        groupDetail({ sheet: inviteSheet("waiting") }),
        { added: "2026-09-22" },
      ),
      plate(
        "stop-sharing",
        "Stop sharing",
        "The way back from <b>Joined</b>. She stops seeing the group and stays in it as a person you split with: nothing about the money moves, on either side.",
        groupDetail({ sheet: stopSharingSheet() }),
        { added: "2026-09-22" },
      ),
      plate(
        "invite-left",
        "They left",
        "The person who joined can leave by themselves, and the row says so: <b>left</b>, and when. Nothing about the money moved: they are still somebody you split with. <b>Invite again</b> is how they come back.",
        groupDetail({ sheet: inviteSheet("left") }),
        { added: "2026-09-22" },
      ),
      plate(
        "shared-with-you",
        "Groups shared with you",
        "Your own groups first, then <b>Shared with you</b>: who shared each one, its range, what it cost and your share. The badge says where you stand with the person who shared it, because that is the only debt the group keeps. It has no bar, because a bar that fills the other way is worse than none. What you owe there is real, so it counts in <b>You owe</b>.",
        sharedWithYou(),
        { added: "2026-09-22" },
      ),
      plate(
        "people-with-a-group-shared-with-you",
        "People, when you owe in a group shared with you",
        "People lists your contacts, and Ana is not one of them. So one line closes the arithmetic, the same way guest blocks do: the $140,000 in <b>You owe</b> is Diego’s $60,000 plus $80,000 to Ana in the group she shared.",
        sharedPeopleWithJoined(),
        { added: "2026-09-22" },
      ),
      plate(
        "joined-group",
        "A group shared with you",
        "Read, not worked: only Ana writes in it. It leads with <b>where you stand with her</b>, neutral with a word for the direction. <code>Counts as yours</code> does not lead, because nothing here is in your ledger until you add it. Ana and Marta joined, so they go by the names on their own profiles. Carlitos has not, so he goes by the name Ana gave him. Each line Ana paid says where your part stands: <b>In your ledger</b>, <b>Paid</b> and ready to add, or <b>Not paid</b>. A line Marta paid is between you and Marta.",
        joinedGroup(),
        { added: "2026-09-22" },
      ),
      plate(
        "add-to-my-ledger",
        "Add to my ledger",
        "Offered only on a line Ana has marked paid for you. She recorded the money arriving in her account, and this records it leaving yours: two sides of one payment, so nothing lands before your money moved and nothing lands twice. It asks for your account and your category, dates the expense on the day of the line, and needs a connection. Several ready lines share one sheet, with one category picker that can be changed per line, like paying somebody back.",
        joinedGroup({ sheet: addToLedgerSheet() }),
        { added: "2026-09-22" },
      ),
      plate(
        "joined-archived",
        "Archived by the person who shared it",
        "It stays with you, read-only, and folds away with the settled ones. Archiving wrote off what was still open on Ana’s side, so you are square and the dinner reads <b>Written off</b>. No money of yours moved, so there is nothing to add for it. The groceries were paid, so they can still go into your ledger: that writes nothing in the group.",
        joinedGroup({ archived: true }),
        { added: "2026-09-22" },
      ),
      plate(
        "leave-group",
        "Leaving",
        "From the foot of the group, under the expenses: <code>Stop sharing</code> seen from your side. You stop seeing the group and stay in it as somebody Ana splits with. Your share, what you paid and what you owe do not move, and what you added to your ledger stays yours. It needs a connection, like every invitation write.",
        joinedGroup({ sheet: leaveGroupSheet() }),
        { added: "2026-09-22" },
      ),
      plate(
        "empty",
        "Nothing shared yet",
        "The first thing anyone sees. It explains what a shared group is in one sentence and offers the two ways in.",
        sharedEmpty(),
        { added: "2026-09-20" },
      ),
      plate(
        "loading",
        "Loading",
        "The silhouette of the section: the control, the two figures and the rows. The two figures are skeletons too \u2014 they are the part somebody came to read.",
        sharedLoading(),
        { added: "2026-09-21" },
      ),
      plate(
        "error",
        "The section cannot be read",
        "The screen\u2019s error with its reference. Offline with no copy on the device it is the honest empty state instead, the one Transactions uses.",
        sharedError(),
        { added: "2026-09-21" },
      ),
      plate(
        "new-person",
        "New person",
        "Name, colour and an optional email. The email is what an invitation is addressed to — nothing is emailed, and the sheet says so rather than leaving the field to be guessed at. The limit is said here too, never discovered by a save that fails.",
        newContact(),
        { added: "2026-09-20", updated: "2026-09-22" },
      ),
      plate(
        "pick-people",
        "Choosing who was in",
        "Where decision 12 is kept: the contact list <b>pages</b> — it says how many it is showing of how many, and offers <code>Load more</code> — and the two limits are <b>said in the sheet</b>, before a save can fail on them. A list that silently stops is T-38, and this section was not allowed to repeat it.",
        pickPeople(),
        { added: "2026-09-20" },
      ),
      plate(
        "new-group",
        "New shared group",
        "Built around the real habit: the expenses already exist, recorded with the Quick add during the night, and the group is assembled the next day. The default split is chosen once here and every expense inherits it without asking.",
        newGroup(),
        { added: "2026-09-20" },
      ),
      plate(
        "pick-transactions",
        "Picking expenses that already exist",
        "The same list as Transactions with a checkbox, over any range and any account, reached from the group being created. This form does not record a new one: it assembles a group out of what is already in your ledger, and recording one that is not there yet is offered from the group itself \u2014 <code>#record-a-new-expense</code>.",
        pickTransactions(),
        { added: "2026-09-20", updated: "2026-09-21" },
      ),
      plate(
        "record-a-new-expense",
        "Add expense, from inside the group",
        "The other ways in, and they are the same sheet: the movements not in a group yet, and under them <code>Record a new expense</code> and <code>Somebody else paid</code> \u2014 where the contact sheet puts <code>New person</code>, because a picker whose answer is not there yet offers to create it rather than sending you off to find it. The first leaves for the transaction form <b>knowing the group</b> (<code>add.html#expense-for-a-shared-group</code>) and what it records comes back here, split by the group's default without asking; the second is <code>#expense-somebody-else-paid</code>.",
        recordNewExpense(),
        { added: "2026-09-21", updated: "2026-09-22" },
      ),
      plate(
        "expense-somebody-else-paid",
        "A line somebody else paid",
        "T-139, and the third way into <code>Add expense</code>. A line another participant paid is <b>not a movement of yours</b>, so this is deliberately not the transaction form: there is no account, no category and no budget to ask about, and a form that asked for them would be asking about a movement that does not exist. It asks for the four things such a line <i>is</i> \u2014 what it was, when, how much, and <b>who paid it</b> \u2014 and inherits the group's split without asking, exactly like the other two doors. It writes <b>one</b> thing and not two, and the sheet says so, and says when that stops being true: the day you settle with Ana it becomes your expense, dated that line and in a category you choose then. <b>Who paid is never you</b> \u2014 that is what the other two doors are \u2014 so a group of one does not draw the door at all. A description is <b>required</b> here, where the transaction form lets it go: this line has no category to borrow a name from, and neither will the expense it turns into.",
        expenseSomebodyElsePaid(),
        { added: "2026-09-22" },
      ),
      plate(
        "who-paid",
        "Who paid it",
        "The one question the sheet above cannot answer by itself, and the section's ordinary picker answering it: the <b>other</b> people in the group, never you. It is <b>all of them or none</b> \u2014 a device that has not got every participant's name yet does not open a list missing somebody, because the name that is missing is the one you would have chosen.",
        whoPaidPicker(),
        { added: "2026-09-22" },
      ),
      plate(
        "what-changes-in-budgets",
        "What adding them changes",
        "The warning that has to come before saving, and the surprising part is that <b>nothing moves today</b>. The money left the account, so the three expenses keep counting in full until somebody pays; when they do, the figure falls in the month the expense happened, which is how a closed month can change.",
        budgetsNotice(),
        { added: "2026-09-20" },
      ),
      plate(
        "split-equal",
        "Splitting · equal, and the odd peso",
        "<code>Split this</code> on a loose expense, which is the whole of decision 4: there is no second concept, it creates a shared group of one expense — so the sheet asks <b>who was in</b> and says what it will create. And the case the Colombian peso forces: $100,000 does not divide by three, the remainder goes to whoever paid, and the shares always add up to the expense, which is the arithmetic the server and the offline projection have to reproduce to the peso.",
        transactionDetail({ splitting: true, sheet: splitSheet("equal", true) }),
        { added: "2026-09-20" },
      ),
      plate(
        "split-fixed",
        "Splitting · one person fixed, the rest shared",
        "“Pepito only pays 50”, in the owner’s words. Beto is pinned at $20,000 and the remaining $80,000 keeps splitting itself between the other two; percent and exact are the same sheet with a different unit.",
        transactionDetail({ splitting: true, sheet: splitSheet("fixed", true) }),
        { added: "2026-09-20" },
      ),
      plate(
        "split-percent",
        "Splitting · by percentage",
        "The same sheet with a different unit, which is all <code>Percent</code> and <code>Exact</code> are: you type a percentage each and the sheet shows the money. They have to add up to 100, and what is left to assign says so until they do.",
        transactionDetail({ splitting: true, sheet: splitSheet("percent", true) }),
        { added: "2026-09-21" },
      ),
      plate(
        "split-one-expense",
        "One expense splitting its own way",
        "The group's split is a <b>default</b>, not a rule: any expense can carry its own, in any of the four modes. Here the dinner goes by exact amounts inside a trip that splits equally, and the sheet says what it does and does not touch. The expense then reads <b>Custom split</b> in the group's list, so the ones that went their own way are visible without opening them — <code>#group-with-another-payer</code> has one.",
        splitOneExpense(),
        { added: "2026-09-20" },
      ),
      plate(
        "split-with-guests",
        "One expense with guests",
        "The owner's case, in his own arithmetic: three friends, and on this one night twenty other people. The group stays a group of three; <b>this expense alone</b> carries the guests. The count sits <b>above</b> the rows because it governs every one of them — $230,000 over 23 heads is $10,000 each, $30,000 between the three and $200,000 for the block — and the block is one ordinary row, so percent and exact stay unambiguous. One guest is the same control with a count of one. You lose who owes what inside the twenty and you keep the trail of the block, which is the trade he asked for.",
        splitWithGuests(),
        { added: "2026-09-20" },
      ),
      plate(
        "add-people",
        "Adding people after the group exists",
        "A group is not closed when it is created. The question that comes with it is what happens to the expenses already recorded, and the sheet asks it rather than deciding. <b>Off</b> — the default — the new person is in what you add from now on. <b>On</b>, the sheet shows <b>the whole result before it happens</b>: every new share, who has paid what, who is now <b>ahead of what they owe</b>, and what the written-off amount becomes. Nothing collected is undone and what counts as yours does not move — $2,100,000 before and after — because nobody was ever owed the part that is no longer theirs.",
        addPeopleSheet(),
        { added: "2026-09-20" },
      ),
      plate(
        "settle-up",
        "Settle up",
        "The money coming back. It is not income: it arrives in an account, it carries no category, and it lowers each expense in the month that expense happened rather than today.",
        groupDetail({ sheet: settleUp("full") }),
        { added: "2026-09-20" },
      ),
      plate(
        "settle-up-both-ways",
        "Settle up when you owe them too",
        "Ana paid for the tickets, so the two of you owe each other. One payment settles everything between the two people and writes both halves: the $56,300 coming in, and your $30,000 share of the tickets as an expense dated the day of the tickets, in a category you pick. The balance moves by the $26,300 she actually sends.",
        sharedScreen(sharedPeopleBody(), { sheet: settleUp("both") }),
        { added: "2026-09-20" },
      ),
      plate(
        "pay-somebody-back",
        "Paying somebody back",
        "The other direction, and it is not a payment at all from your ledger\u2019s point of view: it is <b>your expense</b>, created with the category of the line you are paying for and <b>dated that line</b>, so it lands in the month the money was spent. Where the payment covers lines of several categories it writes one expense per category, each with its own date, which is what keeps Stats exact.",
        sharedScreen(sharedPeopleBody(), { sheet: settleUp("owe") }),
        { added: "2026-09-20" },
      ),
      plate(
        "record-a-payment",
        "A partial payment, and cash outside the app",
        "Part of it, in cash that never reached an account kept here. No movement and no balance change — and the sheet says that plainly — but the expenses still fall, because the money did come back. What it covers is imputed oldest expense first, which is why Beto can be Partially paid in the group and fully paid on its first expense.",
        groupDetail({ sheet: settleUp("partial") }),
        { added: "2026-09-20" },
      ),
      plate(
        "settle-up-who",
        "Settle up · who first",
        "A door that can reach more than one counterparty asks before it settles: the group's own <b>Settle up</b> and a shared expense's list everybody with something open, with the net and the word for its direction, and open the sheet on the one that is picked.",
        groupDetail({ sheet: settleUpWho() }),
        { added: "2026-09-21" },
      ),
      plate(
        "undo-write-off",
        "Taking a write-off back",
        "The row of somebody who reads <b>Written off</b> is the way back: it says what they owe again and that no figure of yours moves either way, which is true in both directions. It stops being possible once the group is archived.",
        groupDetail({ sheet: undoWriteOffSheet() }),
        { added: "2026-09-21" },
      ),
      plate(
        "write-off",
        "Writing off what is not coming back",
        "The answer to the owner’s worry, and it is that there is nothing to do: no figure changes, because the money was counted as his from the day he paid it. It is a decision and a line in the history, and it can be undone until the group is archived. Beto keeps the $300,000 he did pay; with Ana paid and Lucía written off, the group becomes Settled.",
        groupDetail({ sheet: writeOffSheet() }),
        { added: "2026-09-20" },
      ),
      plate(
        "archived",
        "An archived group",
        "It stays readable, and the way back is here: what was owed was written off when it was archived, and the amount stays counted as yours. Restoring does not take the write-offs back — each one is undone on its own, once the group is open again.",
        groupDetail({ archived: true }),
        { added: "2026-09-21" },
      ),
      plate(
        "archive-with-people-owing",
        "Archiving with people still owing",
        "Archiving is the one action that writes off on your behalf, so it says exactly what it will do and what it will not: the amount stays counted as yours, and nothing is deleted.",
        groupDetail({ sheet: archiveGroupSheet() }),
        { added: "2026-09-20" },
      ),
    ],
  },
  {
    file: "notifications.html",
    title: "Notifications",
    group: "Screens",
    note: "What you would otherwise not see: an invitation to a shared group, an answer to yours, changes in a group you are in. Nothing interrupts — arriving is a count on the bell and a dot on More, and the inbox is where you read it. Budget alerts will be new rows of the same inbox, not a second one.",
    plates: [
      plate(
        "arriving",
        "How it arrives",
        "The only sign: a count on the bell in Home's header, a brand dot on More below 900px, and the count beside Notifications in the sidebar. The amber dot on Transactions stays what it was — your own entries waiting for review — so the two never share a colour.",
        notificationsArriving(),
        { added: "2026-09-22" },
      ),
      plate(
        "more-sheet-with-news",
        "More, with news",
        "The dot on More is answered inside the sheet: Notifications carries the same count as the bell.",
        notificationsMoreSheet(),
        { added: "2026-09-22" },
      ),
      plate(
        "inbox",
        "The inbox",
        "Newest first. What was new when you opened it keeps its heading for this visit; opening the page is what clears the bell. An unread row is bold and carries a dot; an invitation keeps its two answers until it is answered, from here or any other device, and then says how it ended.",
        notificationsInbox(),
        { added: "2026-09-22" },
      ),
      plate(
        "folded",
        "Folded",
        "Before and after: changes to the same group fold into one row while it is unread — the row counts them, names the latest, and rises to the top. Once read, the next change starts a new row.",
        notificationsFolded(),
        { added: "2026-09-22" },
      ),
      plate(
        "inbox-empty",
        "All caught up",
        "No row, and no invented one: the sentence says what would show up here.",
        notificationsEmpty(),
        { added: "2026-09-22" },
      ),
      plate("inbox-loading", "Loading", "", notificationsLoading(), { added: "2026-09-22" }),
      plate(
        "inbox-error",
        "Could not load",
        "Only a device that holds no copy yet asks the server for this list; once the copy is there, the inbox reads from it.",
        notificationsError(),
        { added: "2026-09-22" },
      ),
      plate(
        "inbox-offline",
        "Offline",
        "The inbox reads what the device already has, and marking as read still works: it waits in the queue like any other change.",
        notificationsOffline(),
        { added: "2026-09-22" },
      ),
      plate(
        "inbox-this-device-only",
        "This device only",
        "Working without the account, nothing from other people can arrive — the screen says so instead of looking empty.",
        notificationsLocalOnly(),
        { added: "2026-09-22" },
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
      plate(
        "settings-hub",
        "Settings",
        "The Install app row says home screen on a phone or tablet and install on a desktop, which has no home screen.",
        settings(),
        { added: "2026-09-01", updated: "2026-09-25" },
      ),
      plate(
        "settings-installed",
        "Settings · in the installed app",
        "Once installed, the row says Installed and opens nothing: there is nothing left to do. Drawn scrolled to the end, where the row is.",
        settings({ scrolled: true, installed: true }),
        { added: "2026-09-25" },
      ),
      plate(
        "settings-with-a-new-version",
        "Settings · a new version is waiting",
        "While a new version is waiting, the Version row says so and carries its own Reload, so a notice closed with ✕ is never the only way to it (T-196). Drawn scrolled to the end, where the row is.",
        newVersionVariant("about"),
        { added: "2026-09-25" },
      ),
      plate(
        "notification-settings",
        "Notifications",
        "One switch per topic and per channel that exists — only In the app until email and push are built. Invitations have no switch in the app: one you never see can never be answered, and a control with one answer is not drawn.",
        notificationSettings(),
        { added: "2026-09-22" },
      ),
      plate(
        "notification-settings-offline",
        "Notifications, offline",
        "Saved on the server, like the rest of the profile: readable offline, not changeable.",
        notificationSettings({ offline: true }),
        { added: "2026-09-22" },
      ),
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
        "Reversible by signing up again with the same email and password. The password is the confirmation.",
        deleteAccountScreen(),
        { added: "2026-09-01" },
      ),
      plate(
        "delete-account-wrong-password",
        "Delete my account · wrong password",
        "CURRENT_PASSWORD_INVALID: the error goes under the field and nothing is deleted.",
        deleteAccountScreen("wrong"),
        { added: "2026-09-23" },
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
        "Where the browser offers to install — Chrome and Edge, on Android and on a desktop. The line about the browser saying no is there only when it did: where it already granted durable storage the sheet does not claim otherwise.",
        installSheet("prompt"),
        { added: "2026-09-08", updated: "2026-09-25" },
      ),
      plate(
        "install-sheet-samsung",
        "Install this app · Samsung Internet",
        "The same sheet in Samsung Internet, where installing from Samsung ends in Android’s dangerous-app block. The call to action opens this page in Chrome; below it, Samsung’s own install and how to get past the warning.",
        installSheet("samsung"),
        { added: "2026-09-25" },
      ),
      plate(
        "install-sheet-samsung-steps",
        "Install this app · Samsung Internet, no prompt",
        "Where Samsung Internet has not offered its prompt, the fallback gives Samsung’s own steps instead of a link that could do nothing.",
        installSheet("samsung-steps"),
        { added: "2026-09-25" },
      ),
      plate(
        "install-sheet-steps",
        "Install this app · iPhone and iPad, Safari",
        "iOS never offers a prompt, so the sheet gives the steps, with the real name of each thing, and what happens if it is never installed.",
        installSheet("ios-safari"),
        { added: "2026-09-08", updated: "2026-09-25" },
      ),
      plate(
        "install-sheet-steps-ios-other",
        "Install this app · iPhone and iPad, another browser",
        "Chrome, Firefox and Edge on iOS add to the home screen through the same Share sheet, but keep Share in the address bar or in their menu. And an in-app browser may have none, so the last line sends you to Safari.",
        installSheet("ios-other"),
        { added: "2026-09-25" },
      ),
      plate(
        "install-sheet-steps-android",
        "Install this app · Android, no prompt",
        "An Android browser that never fires the install event — Firefox among them — or Chrome before it does.",
        installSheet("android"),
        { added: "2026-09-25" },
      ),
      plate(
        "install-sheet-steps-desktop",
        "Install this app · desktop, no prompt",
        "A desktop browser without the event: Firefox on Windows keeps its own button in the address bar, and a browser with none is what the last line is for.",
        installSheet("desktop"),
        { added: "2026-09-25" },
      ),
      plate(
        "install-sheet-steps-mac-safari",
        "Install this app · Safari on a Mac",
        "Safari on a Mac installs with Add to Dock, from the File menu or Share: the steps an address-bar icon would get wrong.",
        installSheet("mac-safari"),
        { added: "2026-09-25" },
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
        "Value proposition, six benefits, shared expenses, three steps, a call to action and the questions a visitor asks.",
        landing(),
        { added: "2026-09-01", updated: "2026-09-25" },
      ),
      plate(
        "privacy-policy",
        "Privacy policy",
        "Doubles as the data processing policy under Ley 1581.",
        legal(),
        { added: "2026-09-01", updated: "2026-09-25" },
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
        "Closing a form with something typed does not close it, on any of its four exits: a tap outside, ESC, the close button and Cancel (T-78, T-104, his decision of 2026-09-18). It asks, with the same words, in a centred dialog over the form \u2014 Keep editing first and focused, Leave the quiet one, ESC keeps editing. Since T-150 the question is that dialog on every width: a full-screen form has no footer to swap for it, and at the end of the body it could land under the keyboard. A form with nothing typed closes on the first tap, as it should.",
        state("sin-guardar"),
        { added: "2026-09-15", updated: "2026-09-18" },
      ),
      plate(
        "archive-confirmation",
        "Archive confirmation",
        "Archiving always confirms, saying what is kept.",
        state("confirmar"),
        { added: "2026-09-01" },
      ),
      plate(
        "new-version",
        "New version available",
        "The stripe at the top of the content column, in blue, with Reload and ✕ (T-196, his choice of 2026-09-25). It shares the one slot of the sync stripes, after the ones you have to act on. The ✕ puts it away until you next open the app or come back to it; Settings › Version keeps saying it meanwhile. It never reloads on its own.",
        newVersionVariant("stripe"),
        { added: "2026-09-06", updated: "2026-09-25" },
      ),
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
        "delete-local-copy-another-account",
        "Delete everything · with another account's changes",
        "Another account's unsent changes wait hidden on this device after someone else signed in. The deletion takes them too, so the sheet counts them and says whose they are.",
        deleteLocalCopy({ elsewhere: 3 }),
        { added: "2026-09-26" },
      ),
      plate(
        "another-account-signed-in",
        "Another account signed in",
        "A tab still open on the previous account moves to the one that signed in, on Home, and says why. Nothing of the previous account stays on screen, and its unsent changes wait on this device for its next sign-in.",
        state("switched"),
        { added: "2026-09-26" },
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
      plate(
        "debt-owed-first",
        "A debt account · what you owe, first",
        "Every plate of this question adds a <b>Car loan</b> to the four accounts the preview has always drawn, because a card and a loan are not read the same way and one screen has to hold both. The figures: <b>$12,504,500</b> across the three accounts that hold money, <b>$9,645,900</b> owed between the card and the loan, so the total is <b>$2,858,600</b> — that gap is the complaint. Here the card leads with <b>what you owe</b>, as a plain positive figure with the word beside it, and the bar under it says how much of the limit is gone (31% of $4,000,000). The loan has no limit, so the same bar says how much of it is <b>paid</b>. A debt is drawn in the ordinary amount colour, never in red: owing on a card is normal, and this product keeps red for what is wrong. The two bars do not fill for the same reason, and that is settled on purpose: see <a href='#debt-bar-how-it-moves'>how the bar moves</a>. <b>What it costs, and there are three.</b> The figure on screen is the opposite sign of the one the server stores, so every surface that paints a balance now has to know the account’s type, offline projections included, and a balance read here no longer matches the same field read from the API. <b>Inside the account the signs still invert</b> — open the card’s own screen and “Uber to work −$18,400” sits under a headline that reads <i>$1,245,900 owed</i>, and that expense <i>raises</i> what you owe: the movements keep the account’s point of view while the headline takes yours. And the summary card at the top of this page changes in all three answers, from the <i>Card debt</i> stat it carries today to <i>yours / owed</i> — that is not one of the six questions and it follows whatever <i>How Home says what you have and what you owe</i> settles. <b>Not chosen.</b> The session recommended it — the first thing you read is the thing you asked for — and he picked availability first instead: in a shop the question is how much room is left. It stays drawn as the record, and as the reading a <b>LOAN keeps</b>, since a loan has nothing available.",
        accountsDebt("owed"),
        { added: "2026-09-17", verdict: "discarded", asks: "What a card or a loan leads with" },
      ),
      plate(
        "debt-available-first",
        "A debt account · what you have left, first",
        "<b>Chosen, 2026-09-17.</b> Leading with <b>what is still available</b> — $2,754,100 of the $4,000,000 limit — and the debt on the line under the bar. His words: «me gustaría ver cuál es el cupo que tengo disponible en el momento». It is the convention card and bank apps follow, and it answers the question you actually have in a shop; personal-finance apps lead with the debt instead, which is what the plate beside this one draws. <b>The rule it settles is per type, and that is deliberate.</b> A <b>loan has nothing available</b>, so the Car loan here leads with what is owed and says how much is paid — each type leads with the figure it actually has. A card with no limit yet has no availability line either, which is what the next question is about. <b>What it still costs:</b> the lead figure is a large number that is not money you have, so the word beside it is doing all the work, and the second line has to carry the debt for the reading to be honest.",
        accountsDebt("available"),
        { added: "2026-09-17", verdict: "chosen", asks: "What a card or a loan leads with" },
      ),
      plate(
        "debt-signed-balance",
        "A debt account · the balance as the server stores it",
        "<b>Not chosen — by your own sentence, not by anyone’s taste.</b> You asked to see <i>cuánto debes y cuánto te queda</i>, and a minus sign says neither. It stays drawn because it is the baseline the other two are read against, and because if you disagree the answer is one word. Today’s reading kept — <b>−$1,245,900</b>, the signed balance — with the limit line and the bar added under it. <b>What it gains:</b> one rule for every account, nothing on screen has to know the type to paint a figure, and a balance shown here is the same number the API returns, which keeps the offline projection and the parity fixtures reading exactly as they do now. <b>What it costs:</b> a minus sign is the weakest thing a screen can say, and this is already what the app shows — the Accounts page has drawn Visa Gold at −$1,245,900 and summed a “Card debt” since the design was written. If it were enough, this task would not exist. Drawn so the cheap answer is on the table with the other two.",
        accountsDebt("signed"),
        { added: "2026-09-17", verdict: "discarded", asks: "What a card or a loan leads with" },
      ),
      plate(
        "debt-no-limit-quiet",
        "No limit yet · the card says only what you owe",
        "<b>This is the state every existing account is in the day this ships</b>, and for anyone who never fills the field it is the state forever: an <code>Account</code> has no limit today, so there is nothing to draw a bar from. Here the card simply says <b>$1,245,900 owed</b> and stops — no bar, no empty gauge, no prompt. The limit is offered where it belongs, in the account’s own Edit form, and the list stays a list. <b>Not chosen.</b> The session recommended the quiet card, for the reason the install card already follows: a screen does not ask for something it does not need to work. He chose the prompt — and the cost the session was weighing cuts the other way too: a limit nobody knows about is a limit nobody sets.",
        noLimitYet("quiet"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What a debt account shows before you give it a limit",
        },
      ),
      plate(
        "debt-no-limit-prompt",
        "No limit yet · the card asks for it",
        "<b>Chosen, 2026-09-17.</b> The card with <b>Set a credit limit</b> on it, so the field is discovered where the gap is visible. <b>What it costs.</b> It is a call to action on a list you open every day, on every debt account that has no limit, and it does not go away until you deal with it — on a phone it is the largest thing in the card. It also turns the card from a single link into a container with two targets — the whole card stays openable through a stretched link, and the button sits on top of it — which is <b>a second tab stop per card</b>: the same defect T-68 is open about for the sync icon, added on purpose this time. And it appears on the loan too, where a credit limit means nothing, unless the prompt learns the type.",
        noLimitYet("prompt"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "What a debt account shows before you give it a limit",
        },
      ),
      plate(
        "account-fields-a-credit-limit",
        "Fields · a credit limit, and nothing else",
        "<b>One new field in the whole product.</b> <i>Credit limit</i>, optional, offered on CARD and OVERDRAFT and on nothing else; every other type’s form is exactly what it is today. A loan gets no new field because the app already stores what it needs: <code>openingBalance</code> is written once when the account is created and never changes, so what has been paid off is today’s balance minus that figure (both are negative on a debt, so the newer, smaller debt gives the positive difference), and no field, no validation and no sync work is added for it. <b>What it costs, and it is real.</b> For a loan someone starts tracking halfway through, <code>openingBalance</code> is the balance the day they created the account, <b>not what they borrowed</b> — so under this answer the loan’s line has to read <i>paid since you added it</i> rather than <i>paid of $12,000,000</i>, which is what the plates of the first question draw. <b>Not chosen.</b> The session recommended it as the smallest thing that answers the complaint; he asked for both fields, both optional, which buys the loan a figure `openingBalance` cannot give and costs one more optional field. Two is still stopping: the set of terms per type stays rejected. <b>A coupling worth knowing:</b> the preview card at the bottom of this plate is drawn on the first question’s recommended reading, and the loan drawn in <i>What a debt account shows before you give it a limit</i> is on the <i>second</i> answer of this one — it says <i>paid of $12,000,000</i>, which only the amount borrowed can give.",
        accountFields("limit"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What an account gains besides its balance",
        },
      ),
      plate(
        "account-fields-the-amount-borrowed",
        "Fields · a credit limit and, on a loan, the amount borrowed",
        "<b>Chosen, 2026-09-17.</b> Both fields, and <b>both optional</b>, as he asked: the credit limit on CARD and OVERDRAFT, plus <i>Amount borrowed</i> on a LOAN — drawn here, because that is the only form the two answers differ on. It is what lets a loan added halfway through say <b>$3,600,000 paid of $12,000,000</b> instead of only what has moved since you started tracking it, and it is the one thing <code>openingBalance</code> genuinely cannot answer. <b>What it costs:</b> a second optional field that the server, the OpenAPI, the local mirror, the outbox and the sync all have to learn and keep, for a figure that only one line of one card reads. If most loans are created with their full balance, it buys nothing the first answer does not already have.",
        accountFields("borrowed"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "What an account gains besides its balance",
        },
      ),
      plate(
        "account-fields-per-type",
        "Fields · a set of terms per type",
        "<b>Not chosen — the task itself closed this one</b> («decidir cuáles y parar ahí»). It stays drawn so the door is visible rather than imagined, and so the interest rate has a place to be pointed at when T-86 asks for it. The door the task warns about, drawn open so it can be shut on sight: <i>Amount borrowed</i>, <i>Interest rate</i>, <i>Monthly payment</i> and <i>Payment day</i> on a loan, and the same idea on a card would bring a statement day and a due day. <b>What it costs.</b> Three of these four are read by <b>nothing</b> until the instalment split of T-86 exists, and a field nobody reads is a field that goes stale without anyone noticing. Each one is a form row, a validation, an OpenAPI change the front regenerates from, a column in the mirror, a field the outbox has to classify for conflicts and a case in the sync — multiplied by the type it belongs to. The form goes from four rows to eight for the type most people will never create. <b>Not recommended</b>, and the interest rate in particular belongs to whatever T-86 decides about the instalment, not here.",
        accountFields("terms"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What an account gains besides its balance",
        },
      ),
      plate(
        "home-total-with-a-line",
        "Home · the total, with the split under it",
        "<b>Total balance $2,858,600</b>, and the line under it reads <b>$12,504,500 yours − $9,645,900 owed</b>. The figure itself does not change meaning — the app has always summed signed balances, so a debt already subtracted — it just stops being a number with no explanation. <b>What it costs, measured in this frame at 460px:</b> the line takes the slot that today counts the accounts (“4 accounts”), so that count moves to the Accounts summary card, which already carries it, and because it wraps to two lines the stats row grows from <b>104px to 120px</b>. No new card, the row stays two wide on a phone. <b>A cost the three answers share:</b> the accounts carousel is as tall as its tallest card, so the debt cards make it grow <b>37px</b> whichever reading wins — the page goes from 1,415px to <b>1,468px</b> here, of which only 16 belong to this answer. <b>Not chosen.</b> The session recommended it as the cheapest honest answer; he chose the two cards, because a net figure with a car loan in it reads negative for years. It stays drawn as the record.",
        home({ debt: "net-line" }),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "How Home says what you have and what you owe",
        },
      ),
      plate(
        "home-have-and-owe",
        "Home · two cards, what you have and what you owe",
        "<b>Chosen, 2026-09-17.</b> Two stat cards, and <b>no net figure anywhere on Home</b>. <b>His reason, and it is right:</b> a car loan is tens of millions against a few in the bank, so a net total would read <i>negative for years</i> — until the car is paid — and that is a true figure nobody wants on the screen they open to record a coffee. Net worth is a real number; it is not this screen’s number. <b>Income this month and Estimated savings both stay</b>, which he asked for after a first draft dropped the savings card: the row is four cards in two pairs, and <i>Estimated savings</i> keeps the 600px floor it has today, so a phone still shows three and nothing is lost against now. <b>What it costs, measured at 460px:</b> the stats row goes from <b>104px to 221px</b> and the page ends at <b>1,568px</b> against 1,415 — budgets, accounts and recent transactions all move down. Switch the preview to Desktop to see the two pairs.",
        home({ debt: "two-cards" }),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "How Home says what you have and what you owe",
        },
      ),
      plate(
        "home-total-unchanged",
        "Home · the total exactly as it is today",
        "<b>Not chosen — by your own sentence.</b> «<i>hace que la matematica del total balance este inflada con dinero que realmente no es mio</i>» is exactly this card. It stays drawn as the baseline the other two are measured against. Today’s card, with the loan’s balance included in the sum: <b>Total balance $2,858,600</b> over <b>5 accounts</b>. The arithmetic is already right and always was — which is the point of drawing it — and it is the cheapest of the three: the stats row stays at <b>104px</b>, so the only growth on the page is the <b>37px</b> the taller account cards add to the carousel, which every answer pays. <b>What it costs:</b> a figure that is correct and unexplained. Nothing on this screen says that two of those five accounts are money you owe, so the only reading available is “this is what I have”, and the number moves for reasons the screen never gives. This is the plate to choose if the split belongs only on Accounts and Home should stay a spending screen.",
        home({ debt: "unchanged" }),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "How Home says what you have and what you owe",
        },
      ),
      plate(
        "pay-a-sheet-on-the-account",
        "Pay · a sheet on the account itself",
        "<b>Chosen, 2026-09-17.</b> His words: once the accounts work is finished, the pay button is the modal on the account. The card’s own screen, with <b>Pay this card</b> as the one primary action above the four that were already there. It opens a sheet that is the payment and nothing else: the amount, one chip that fills it with everything owed, one <i>From</i> picker on the main account, and a line that reads the result back. <b>The amount is drawn here already typed</b> \u2014 since T-99 the field opens empty and the total is the chip, which is `#pay-opens-empty`. <b>That line changed with T-86</b> («la diferencia»): it now reads <i>Bancolombia −$1,245,900 · Visa Gold $1,245,900 less owed.</i> — the difference, not the resulting balance, and since T-96 it ends there — and the sheet carries the optional Transfer category the form gained at the same time. It is a TRANSFER underneath, with the direction filled in for you, which is the point: paying a debt means sending money <b>towards</b> the card, and that is the step people get backwards. <b>What it costs:</b> a second way to record a transfer, so the rule about doing it the way it is already done has to be paid — the sheet has to reuse the same pickers, the same idempotency key and the same offline queue, not a private copy. Two decisions instead of six, and you never leave the account — and, as the question below shows, a sheet can offer the right thing where the full form hands you a type picker and lets you choose the wrong one.",
        payFlow("sheet"),
        { added: "2026-09-17", verdict: "chosen", asks: "What the Pay button opens" },
      ),
      plate(
        "pay-the-full-transfer-form",
        "Pay · the transfer form, filled in",
        "<b>Not chosen.</b> <b>Pay this card</b> opens the New transaction screen already set to Transfer, with From, To and the full amount filled in and the same sentence reading the result back. <b>What it gains:</b> one way to record a transfer instead of two, nothing new to build in the account, and the direction is <b>shown</b> rather than hidden — which is half of what T-86 is about, so the two tasks would reinforce each other. <b>What it costs:</b> it leaves the account for a screen with seven fields — From, To, Date, Time, Description, Tags and Note — when the three that matter are already right, the way back is the browser’s, and the shortcut stops feeling like an action on this card and starts feeling like a form.",
        payFlow("form"),
        { added: "2026-09-17", verdict: "discarded", asks: "What the Pay button opens" },
      ),
      plate(
        "debt-bar-how-it-moves",
        "How the bar moves on each kind of debt",
        "His question of 2026-09-17: on a card, unlike a loan, paying gives the room back \u2014 so what does the bar do? <b>They fill for opposite reasons, and each is the natural one for its type.</b> On a <b>credit card</b> the bar is <b>the limit in use</b>: a purchase pushes it up, a payment pulls it back down, and at $0 owed it is empty with the whole limit available again. On a <b>loan</b> the bar is <b>what you have paid off</b>: it only ever grows, because you cannot re-borrow what you repaid \u2014 his own words \u2014 and it is full the day the loan is finished. The line under each says which it is, so the bar is never read alone. <b>What it costs, and it is why this is drawn rather than described:</b> two bars on the same list fill for opposite reasons, so a card at 31% and a loan at 30% mean different things. The alternative \u2014 one rule for both, the bar always being the debt that is left \u2014 was what the first draft did, and it made the loan start full and empty as you paid, which reads backwards.",
        barHowItMoves(),
        { added: "2026-09-17", frame: false, wide: true },
      ),
      plate(
        "pay-from-outside-quiet",
        "Paid from somewhere else \u00b7 written as a repair",
        "<b>Chosen, 2026-09-17.</b> The card gets paid from money that is in no account of Ledger Flow \u2014 someone else\u2019s transfer, cash he does not track, an account he never registered. Nothing here loses that money, so it cannot be a transfer. The <i>From</i> picker gains one row under the accounts, <b>Somewhere else \u00b7 not an account here</b>, and the sheet writes an <b>ADJUSTMENT</b> that raises the card. <b>It is not an account and nothing is created:</b> it never appears in Accounts, it has no balance, it counts in no total and the user registers nothing \u2014 which is his whole point: the money comes from something he has chosen not to track. It is a row in a picker that writes a one-sided movement, a shape the product already has. <b>Why this and not an income:</b> `deriveSpending` hides ADJUSTMENT from every figure unless the query names it (`lib/local/derive/spending.ts:107`), which is exactly right \u2014 the money is not income and it is not spending, it simply never was inside the app. <b>What it costs:</b> an adjustment means \u201creconcile a balance\u201d everywhere else in the product, and here it is carrying a payment; the row in the history reads <i>Balance adjustment</i>, so the sheet has to write the description for you. <b>And the honest alternative is neither plate:</b> register that money as an account \u2014 even a CASH one called \u201cOther money\u201d \u2014 and the payment is an ordinary transfer that is right everywhere. That is bookkeeping, and he rejected it for the reason the row exists at all: the point is that the money comes from something he has chosen not to register.",
        payFromOutside("adjustment"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "Paying a debt with money that is in no account here",
        },
      ),
      plate(
        "pay-from-outside-as-income",
        "Paid from somewhere else \u00b7 written as an income",
        '<b>Not chosen, and it goes further than not being chosen:</b> he ruled that if an income on a card is wrong then the product should not allow it at all, and that sweep is now T-93. The same row writing an <b>INCOME</b> into the card. The balance comes out right \u2014 an income with only a destination raises the card exactly as much as the payment did. <b>But it lies three times, and they are all measured.</b> Home\u2019s <i>Income this month</i> is literally `fetchSpending({type: "INCOME"})` over the month (`features/home/hooks.ts:111`), so paying ${moneyText(CARD_OWED)} off the card reads as ${moneyText(CARD_OWED)} earned. <b>Estimated savings</b> is income minus spending, so it inflates by the same amount. And an income budget \u2014 the product has them \u2014 would count it. The plate draws the warning the sheet would have to carry, which is the tell: a form that has to apologise for what it writes is writing the wrong thing. Drawn because it is the obvious answer and it deserves to be rejected for a reason rather than a taste.',
        payFromOutside("income"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "Paying a debt with money that is in no account here",
        },
      ),
      plate(
        "adjustment-edited-in-the-account",
        "Adjustment · edited where it was made",
        "<b>Chosen, 2026-09-17.</b> His reason: since it is not going to live in the transaction form, the other answer does not make sense. Adjustment leaves Add, so a balance adjustment is created in one place only — <b>Adjust balance</b>, inside the account — and it is <b>edited</b> there too — tapping the row in the account’s own list reopens that sheet on that adjustment, with Delete beside Save. <b>What it costs, and it is not small.</b> The sheet that creates one asks a different question from the sheet that edits one: creating asks <i>what is the real balance now</i> and computes the difference, while editing has to work on the adjustment’s own amount, because recomputing a past adjustment from today’s balance would silently change what it meant. So the sheet becomes two modes — drawn here in its editing mode, with the increase/decrease segment and the amount it actually holds. The row is also reachable from the global Transactions list, which has no account context, so that route has to open this same sheet.",
        adjustmentEdit("sheet"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "Where a balance adjustment is edited, once Adjustment leaves Add",
        },
      ),
      plate(
        "adjustment-edit-keeps-the-fourth-type",
        "Adjustment · Add loses it, Edit keeps it",
        "<b>Not chosen.</b> The other reading: <b>Add</b> offers three kinds, and the <b>Edit transaction</b> form keeps the fourth for the one case it is needed — an adjustment that already exists. The segment shows it pressed with the other three disabled, because an adjustment cannot become an expense; the line under it says so. <b>What it gains:</b> one screen edits every kind of transaction, so nothing new is built and the route from the global Transactions list works unchanged. <b>What it costs:</b> the segment is four wide here and three wide in Add, which is the sort of difference nobody can explain in a sentence, and it leaves Adjustment visible in the place the task wanted it out of — just one screen further in.",
        adjustmentEdit("form"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "Where a balance adjustment is edited, once Adjustment leaves Add",
        },
      ),
      plate(
        "transfer-said-for-every-type",
        "Each type · said in one line, as you asked",
        "<b>Chosen, 2026-09-17: «la línea para los tres».</b> A line under the segment for whichever type is selected — drawn here on <b>Expense</b>, the one that has to pay for it — <b>and the ? beside it</b> that opens the three explained side by side, which he asked for in the same breath: «adicional me gustaría el botón de ? para que se abra el modal con la información más detallada de qué hace cada tipo de transacción». The two answers under this question were not exclusive and he took both. <b>Measured on the built plates, per type, with the ? in place.</b> On a phone: <b>Income 17px</b> (one line), <b>Expense 35px</b> (two), <b>Transfer 52px</b> (three, because it is the only one carrying the three cases). On a desktop: 17, 17 and 35. So the cost of taking the line for all three rather than for Transfer alone is <b>35px on Expense and 17px on Income</b>, and nothing on the screen moves otherwise. Six message keys instead of two, and in Spanish the lines run about 20% longer (`spec/README.md` §6), so Transfer can reach four lines on a narrow phone.",
        addMovement("line-every-type"),
        { added: "2026-09-17", verdict: "chosen", asks: "How the form says what each type is" },
      ),
      plate(
        "transfer-said-in-a-sheet",
        "Each type · what the ? opens",
        "<b>Chosen, 2026-09-17</b>, as the second half of the answer above rather than instead of it. The <b>?</b> next to the line — `circle-help`, added to the curated set for this, because every other icon-only button in this system holds an icon and not a character — opens a sheet with the three types side by side, the only place in the product where they are ever compared. It is a `secondary` button, so it reads as a control rather than as punctuation at the end of a paragraph, and its accessible name is the sheet's own title. The rows are rows, not links: they explain and lead nowhere, so they carry no chevron, and each takes the icon `icons.md` already fixes for its type. <b>What the pairing buys:</b> the line teaches the person who was not going to tap anything, and the sheet is there for the one who wants the comparison — which is the half a link alone would have missed, because the person who does not know what a transfer is is not the person who taps a link about it.",
        addMovement("line-in-a-sheet"),
        { added: "2026-09-17", verdict: "chosen", asks: "How the form says what each type is" },
      ),
      plate(
        "transfer-said-in-a-line-on-the-quick-sheet",
        "The same line, and the same ?, on the quick sheet",
        "<b>Chosen by the same answer</b>, because it was never a separate one: the rule binds <b>both</b> places a movement is written. The quick sheet is where a transfer is most likely to be recorded in a hurry, and a rule that lands on one screen and not the other is how the same thing ends up reading two ways a tap apart — T-85 spent a whole review pass on exactly that. On Transfer the sheet carries the same category row as the other two types, filtered to the ones marked Transfer, so the line is the one thing the type adds here.",
        addMovement("line-quick"),
        { added: "2026-09-17", verdict: "chosen", asks: "How the form says what each type is" },
      ),
      plate(
        "transfer-said-in-a-line",
        "A transfer · the line only where it is needed",
        "<b>Not chosen</b> — the cheaper half, kept as the record and as the measurement the decision rests on. The task came from this: <b>across the whole product not one sentence says what a transfer is for</b>. Four do mention it and all four are negations — “Transfers between your own accounts are not spending” (`stats.transfersNote`), the same thing again on an empty month (`stats.emptyTransfers`), “Balance adjustments and transfers never count toward a budget” (`budgets.list.footnote`) and “Transfer categories can’t have a budget” (`budgets.form.categoriesHelp`) — plus six labels. And the asymmetry ran backwards: <b>Adjustment, the rarest of the four, was the only type with an explanatory line</b> (`transactions.form.adjustmentHint`, `messages/en.json:1238`). Here the line appears only when Transfer is selected: 52px there, nothing anywhere else, two message keys instead of six.",
        addMovement("line-transfer"),
        { added: "2026-09-17", verdict: "discarded", asks: "How the form says what each type is" },
      ),
      plate(
        "readback-the-two-sides",
        "Before you save · the two sides, as a difference",
        "<b>Chosen, 2026-09-17: «la diferencia».</b> The form asks <b>geometry</b> — <i>From</i> and <i>To</i> — when the person has an <b>intention</b> (“I paid the card”), on the one operation where the direction is counter-intuitive, because paying a debt means sending money <b>towards</b> the card. So once both accounts are chosen it reads the consequence back as a difference: <i>Bancolombia −$500,000 · Visa Gold $500,000 less owed.</i> The debt side is said in the T-85 vocabulary, never as “+$500,000”, because on a card more is not better. <b>What it costs: nothing but the sentence.</b> It repeats the amount just typed and the two names just picked — <b>no arithmetic on any balance</b> — so house rule 4 is untouched and it reads identically offline, on a device that has never seen those balances. <b>And it reaches further than this form:</b> the Pay sheet approved in T-85 read back the resulting balance («Visa Gold goes to $0 owed»), so it now says <i>$1,245,900 less owed</i> instead. One grammar, every surface.",
        addMovement("readback-two-sides"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "What the form reads back before you save",
        },
      ),
      plate(
        "readback-with-the-new-balances",
        "Before you save · what each account will read afterwards",
        "<b>Not chosen.</b> The stronger version: not the movement but <b>the result</b> — Bancolombia $3,420,500 → $2,920,500, Visa Gold $2,754,100 available → $3,254,100 available. <b>What it would have gained:</b> the question behind the question (“will I be short?”) answered without leaving the form, and a direction taken backwards made obvious, because the wrong way round makes the card’s availability <i>fall</i>. <b>What it costs, and it is a rule:</b> this is the client doing money arithmetic on a balance. House rule 4 and the front’s `CLAUDE.md` allow exactly one place for that — `lib/local/derive` — and require anything painted from it to carry the <b>projection mark</b> of `components.md` 24, the `cloud-off` badge drawn here. Offline the balances it starts from are already projections, so this is a projection of a projection; and a device that has not synced that account shows the sentence without its figures. Kept drawn because it is the shape to return to if “will I be short?” ever becomes the question worth paying for.",
        addMovement("readback-balances"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What the form reads back before you save",
        },
      ),
      plate(
        "readback-nothing",
        "Before you save · exactly as it was",
        "<b>Not chosen</b>, and drawn so the cheap answer was on the table: two pickers labelled <i>From</i> and <i>To</i>, and nothing saying what will happen. It is the state that produced this task — the one case where getting the direction backwards costs real money is the case the form said least about. <b>It also carried the catch this question had to settle.</b> The product was already inconsistent: the Pay sheet chosen in T-85 <i>did</i> read back, in the <b>resulting-balance</b> grammar of the plate above. Choosing the difference means that sheet’s sentence changes with it, which is what has been done.",
        addMovement("readback-none"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What the form reads back before you save",
        },
      ),
      plate(
        "transfer-by-intention-three-chips",
        "Shortcuts · three intentions above the two accounts",
        "<b>Chosen, 2026-09-17.</b> He asked for the shortcut inside the form and picked this shape. <b>Pay a card · Pay a loan · Move to savings</b>, above <i>From</i> and <i>To</i>. <b>What a chip does, exactly, because he asked:</b> it saves nothing and adds no field — it <b>fills the two sides in the right direction</b>. <i>Pay a card</i> puts the main account in <i>From</i> and the card in <i>To</i>; with more than one card it opens the picker already filtered to cards. <i>Move to savings</i> does the same towards the savings account. Everything stays editable afterwards, and with a single card of each kind it is one tap. <b>It does not touch the category</b>: preselecting one would be the chip setting a field, which is not what it was described as, and on a loan there is no seeded category to preselect. <b>What it costs:</b> it is a second way to pay a debt beside T-85’s Pay sheet — that sheet does not go away, it stays the way in from the account — and each chip is a rule about which accounts it picks, so with several cards it is a picker in disguise. The row scrolls horizontally on a phone, which is what every chip row in the product does.",
        addMovement("intent-three"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "Whether Add gets shortcuts too, now that paying lives in the account",
        },
      ),
      plate(
        "transfer-by-intention-one-chip",
        "Shortcuts · one chip, for the case that is got backwards",
        "<b>Not chosen.</b> A single chip, <b>Pay a card or a loan</b>, opening the account picker filtered to the debt accounts and then filling the direction. <b>What it gained:</b> it covers the mistake that costs money and says nothing about the two nobody gets wrong, so the form grows by one control instead of three; and it does not pretend to know which card. <b>Why not:</b> it leaves <i>Move to savings</i> — the one intention T-85’s Pay sheet does not cover — without a home, which is precisely the chip the chosen answer adds.",
        addMovement("intent-one"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "Whether Add gets shortcuts too, now that paying lives in the account",
        },
      ),
      plate(
        "transfer-by-intention-none",
        "Shortcuts · only the one T-85 already built",
        "<b>Not chosen as the whole answer, and it is not going away.</b> Most of this question was already settled by him on 2026-09-17, in T-85: «el botón de pagar debería de ser el modal sobre la cuenta». Drawn here as it stands — you open the card and press <b>Pay this card</b>, amount preloaded, direction filled in — and it <b>stays exactly like this</b>. What the answer above adds is a second way in for someone who starts at the ＋ instead of at the account, plus the one intention this sheet has never covered, <i>Move to savings</i>. The cost of having both is the cost he accepted: two ways to record the same transfer, which is why they must share the pickers, the idempotency key and the offline queue rather than each growing its own.",
        addMovement("intent-none"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "Whether Add gets shortcuts too, now that paying lives in the account",
        },
      ),
      plate(
        "instalment-one-movement",
        "A loan instalment · one movement, as it works today",
        "<b>Chosen on 2026-09-17 and superseded on 2026-09-18 by `#instalment-two-movements`</b>, which is what he decided when he came back to it. His words then: «por ahora prefiero sin el campo de inter\u00e9s. tengo que pensarlo m\u00e1s a futuro c\u00f3mo hacerlo». The Car loan: <b>$12,000,000</b> taken, <b>$8,400,000</b> still owed, an instalment of <b>$420,000</b>. This is the sheet with no interest field \u2014 one movement, nothing new on the server \u2014 and it is what every instalment recorded before T-94 looks like. <b>Why it could not stay:</b> about <b>$126,000</b> of that instalment is interest, so the loan fell by the whole $420,000 when only <b>$294,000</b> paid it down; the bar that says <i>what is paid</i> ran ahead by the interest every month for the life of the loan, and the $126,000 actually spent never appeared in Stats, because a transfer is not spending. <b>And no instalment preset either</b>, which has not changed: T-85 worked out that a <i>This month\u2019s payment</i> preset needs a figure the account does not carry (`#loan-detail-and-pay`), and T-94 did not add one \u2014 the interest is asked on the sheet, once, rather than stored as a rate the account would have to keep true.",
        addMovement("one"),
        {
          added: "2026-09-17",
          updated: "2026-09-18",
          verdict: "discarded",
          asks: "How a loan instalment records its interest",
        },
      ),
      plate(
        "instalment-two-movements",
        "A loan instalment · the sheet writes the transfer and the interest",
        "<b>Chosen, 2026-09-18</b>, with both answers priced in front of him \u2014 he had deferred the question on 2026-09-17 («por ahora prefiero sin el campo de inter\u00e9s. tengo que pensarlo m\u00e1s a futuro c\u00f3mo hacerlo») and came back to the pair. The sheet on a <b>loan</b> gains one optional field, <b>Of which interest</b>, and saves <b>two movements</b> in one action: a TRANSFER of $294,000 that lowers the loan and an EXPENSE of $126,000 against <i>Interest</i>, both named on screen before Pay is pressed. Left empty it behaves exactly as before. <b>What it fixes:</b> the loan falls by what was actually paid off, so the bar that says <i>what is paid</i> stops running ahead by the interest for the life of the loan, and the $126,000 reaches Stats as the spending it is \u2014 on a car loan the largest expense of the month, invisible until now. <b>The ceiling of T-93 now applies to the principal</b>, which is a fix and not a side effect: a loan owing $300,000 takes a $420,000 instalment when $126,000 of it is interest. <b>What it needed from the server:</b> one seeded category, <i>Interest</i>, the eleventh; the app finds it by its <code>seedKey</code>, never by name. <b>What it costs, and he was told before choosing:</b> the two are not atomic (next plate), and nothing links them afterwards \u2014 deleting or editing one leaves the other, which is the bill of the answer he did not take.",
        addMovement("two"),
        {
          added: "2026-09-17",
          updated: "2026-09-18",
          verdict: "chosen",
          asks: "How a loan instalment records its interest",
        },
      ),
      plate(
        "instalment-only-half-arrived",
        "A loan instalment · when only half of the pair lands",
        "<b>The state the answer above pays for</b> (T-94, chosen 2026-09-18). <code>POST /sync</code> applies its operations one at a time (<code>SyncBatchService.applyOne</code>) and online they are two requests, so the pair cannot be made atomic. The <b>transfer goes first</b> \u2014 it is the payment, the thing the user came to do \u2014 and if the interest is refused the sheet <b>stays open</b>, says which half is saved and which is not, and its button becomes <b>Send it again</b>, which retries only what is missing. Between the two the figures are right and the story is incomplete: the loan has already fallen by $294,000 and the interest is nowhere. <b>With no network this does not happen here:</b> both are queued and the sheet closes, and a later refusal surfaces where every refused change does, in the attention tray \u2014 one place per situation, not two.",
        addMovement("broken"),
        {
          added: "2026-09-17",
          updated: "2026-09-18",
          verdict: "chosen",
          asks: "How a loan instalment records its interest",
        },
      ),
      plate(
        "instalment-interest-inside-the-movement",
        "A loan instalment · one movement that carries its interest",
        "<b>Not chosen, 2026-09-18.</b> One movement carrying the interest inside it, split by the server: the loan falls by the principal and Stats counts the interest by reading that field. <b>What it gains:</b> the pairing problem disappears \u2014 one write, one row, one thing to edit or delete, and offline it either lands or it does not. An instalment <i>is</i> one event. <b>Why it was not taken:</b> a transaction that is partly a transfer and partly spending is <b>a new shape in the domain</b>, not a new field. <code>Transaction</code> gains it, the OpenAPI gains it and the front regenerates from that; every figure answering \u201chow much was spent\u201d has to learn to add it \u2014 <code>/stats/spending</code>, the offline <code>lib/local/derive/spending.ts</code> and the <b>parity fixtures</b> that prove the two agree; budgets have to decide whether it counts; and the list, the detail and the review inbox must show a movement whose amount is not the amount that left the account. Each of those is a place the two sides can drift apart, which is what house rule 4 exists to prevent.",
        addMovement("field"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "How a loan instalment records its interest",
        },
      ),
      plate(
        "transfer-categories-used",
        "Categories of type Transfer · finally choosable",
        "<b>Chosen, 2026-09-17: «usarlas».</b> Measured, and it was worse than the task assumed: <b>every user is seeded with two Transfer categories</b> — <i>Transfer</i> and <i>Credit Card Payment</i> (`src/shared/defaultCategories.ts:74-88`) — the Categories screen counts them in a tab of their own, and <b>no form could ever attach one to anything</b>: `categoryAllowed()` is true only for Expense and Income (`features/transactions/form.ts:65`), the mappers null the category on every other type (`form.ts:120` and `:164`) and the form clears and hides the field when you switch (`TransactionForm.tsx:133` and `:178`). They were <b>two of the ten</b> categories a new account starts with, and they were furniture. Now the transfer form carries an <b>optional</b> category in the same slot expense and income use, filtered to that type, and so does the Pay sheet. <b>What it costs: nothing on the server.</b> It already accepts it — a category is refused only when its type and the transaction’s differ (`TransactionService.ts:408`) — and `/stats/spending` already groups transfers by category.",
        addMovement("transfer-category"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "What happens to the categories of type Transfer",
        },
      ),
      plate(
        "transfer-categories-in-the-list",
        "Categories of type Transfer · what they buy, a year from now",
        "<b>What the choice above buys, drawn instead of asserted.</b> Two months of transfers with their category on the second line and its tile on the left, the row shape `transactions.md` specifies: card payments, loan payments and money put aside tell themselves apart at a glance, and each is a row Stats can group. The loan rows carry the whole instalment, <b>$420,000</b>, because that is what the chosen answer to the instalment question writes. <b>The same list under the rejected answer is the line at the bottom of this one</b> — every row reading “Bancolombia → …” and nothing else, which is what a year of transfers looks like today. Nothing here is new machinery: the row already draws a second line, and two of the three names — <i>Credit Card Payment</i> and <i>Transfer</i> — are ones the user was given on the day they signed up; <i>Loan payment</i> is one they would make themselves, which is the only way a loan payment gets a name of its own.",
        addMovement("transfer-list"),
        {
          added: "2026-09-17",
          verdict: "chosen",
          asks: "What happens to the categories of type Transfer",
        },
      ),
      plate(
        "transfer-categories-dropped",
        "Categories of type Transfer · taken off the screen",
        "<b>Not chosen.</b> The other way to stop the contradiction: the Transfer tab leaves Categories — drawn here, two tabs instead of three — the two seeded ones stop being created for new users, and the type stays in the contract only so that anything already stored keeps working. <b>What it gained:</b> the product stops offering something it cannot use, which is a defect either way, and it is cheaper — no new field on two surfaces. <b>What it costs, and why not:</b> it throws away the information the plate above draws; it is a <b>data decision, not a UI one</b>, because existing users already have the two categories, possibly renamed, and a tab that disappears takes them out of sight without deleting them; and it leaves a live sentence pointing at something invisible — <i>“Transfer categories can’t have a budget”</i> (`budgets.form.categoriesHelp`, in both languages) would explain a type the user can no longer see, so that string would have to go too.",
        addMovement("transfer-categories-gone"),
        {
          added: "2026-09-17",
          verdict: "discarded",
          asks: "What happens to the categories of type Transfer",
        },
      ),
      plate(
        "suggest-quick-a-list-under-the-note",
        "Suggestions · a list under the field",
        "<b>Chosen, 2026-09-24: «para la descripcion lista bajo el campo».</b> Nothing until you type; from the first letter, <b>up to five rows under the field</b>, the letters you typed in bold, the most repeated first and then the most recent — what a search engine does. Tap a row and the field takes it; keep typing and the list narrows or disappears; Escape, tapping elsewhere or finishing the word without picking anything leaves exactly what you typed. On a phone the list sits <b>between the field and the keyboard</b>, never over the field, and the sheet scrolls to keep both in sight; from 600px up it floats over what is under the field. On a keyboard ↓ and ↑ walk it — nothing is highlighted until ↓, and the plate shows the list after it — Enter takes the highlighted row, and Enter with nothing highlighted does what it does today. Drawn on Quick add, the surface with the least room; the full form gets the same list under Description (<i>Full form · typing a description</i> on add.html). Built as component 36.",
        suggestVariant("quick-list"),
        {
          added: "2026-09-24",
          verdict: "chosen",
          asks: "How a description is suggested while you type",
        },
      ),
      plate(
        "suggest-quick-the-rest-of-the-word-greyed",
        "Suggestions · the rest of the text, greyed, inside the field",
        "<b>Not chosen.</b> The best match completed <b>inside the field</b> in the placeholder colour, the way a browser completes an address: type <i>Ub</i> and <i>er to work</i> appears after the caret. Accepting it is → on a keyboard (Tab keeps moving the focus, as everywhere) and <b>the check button</b> on a phone, 44px, the product’s tap size; anything else you type replaces it. <b>The least visible help there is</b> — nothing opens, nothing moves. <b>What it would have cost:</b> it can only ever offer <b>one</b> answer, so <i>Uber to the airport</i> is unreachable while <i>Uber to work</i> is more frequent; a screen reader cannot tell the grey text from the typed one without extra work; on a phone accepting means leaving the keys for a button at the other end of the field; and it can carry nothing but the text.",
        suggestVariant("quick-ghost"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "How a description is suggested while you type",
        },
      ),
      plate(
        "suggest-quick-chips-under-the-note",
        "Suggestions · chips under the field, like the tags",
        "<b>Not chosen.</b> The shape Tags already has: <b>chips under the field</b>, filtered as you type, one tap adds. Nothing new to learn — the category row above it is the same control. <b>What it would have cost:</b> a chip holds a word or two, and a description is a sentence — <i>Uber Eats · lunch</i> already fills half a line, so two lines hold three or four and the rest are not offered; a chip cannot carry the category, the amount or the tags a row can; and a row of chips that appears the moment the field is focused is the most visible of the three, on a sheet the category chips already fill.",
        suggestVariant("quick-chips"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "How a description is suggested while you type",
        },
      ),
      plate(
        "suggest-a-row-carries-only-the-text",
        "A suggestion · only the text",
        "<b>Chosen, 2026-09-24: «rellena solo el texto».</b> Each row is the description and nothing else, and choosing it writes <b>only the description</b>. The category, the amount and the tags stay as they are, empty or not, on both surfaces. <b>What it buys:</b> nothing is ever filled that you did not type or tap yourself. <b>What it costs, which he accepted:</b> for the same purchase every day it saves the sentence and leaves the category and the tags to be picked again — the entry is three taps shorter, not one.",
        suggestVariant("form-text"),
        {
          added: "2026-09-24",
          verdict: "chosen",
          asks: "What choosing a suggested description fills in",
        },
      ),
      plate(
        "suggest-a-row-carries-the-last-entry",
        "A suggestion · the whole entry, filling only what is empty",
        "<b>Not chosen</b> — the session’s recommendation, kept as the record. Each row is <b>the last time you recorded it</b>: the category’s tile, the description, and under it the category, the amount, the tags and when — <i>Transport · $18,400 · #work · Tuesday</i> — with how many times on the right. Choosing it writes the description and <b>fills only what is still empty</b>: a category not chosen, tags not added, and the amount only if it is still zero. Anything already typed or picked is never touched, so in Quick add — where the amount comes first — the amount is yours and the row’s figure is just there to compare. Under the field, one quiet line says what it filled — <i>Category and tags from the last one</i> — until you touch anything (drawn in <i>After choosing a suggested description</i>, below). <b>In Quick add it fills the description and the category, never tags</b>: the sheet has no field to show them, and nothing is written without a word. <b>What it costs:</b> a row is two lines tall, so five rows are ~280px, and from 600px up the list floats over what is under the field rather than pushing it; and the sentence under the field is one more thing on the form, there so nothing is filled without a word.",
        suggestVariant("form-entry"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "What choosing a suggested description fills in",
        },
      ),
      plate(
        "suggest-the-whole-entry-with-the-keyboard-up",
        "A suggestion · the whole entry, on a phone with the keyboard up",
        "<b>Not chosen.</b> The same answer where it is hardest: a phone, the text keyboard open, five two-line rows. The form scrolls so the field sits at the top and the list ends above the keyboard — 48px of field and ~280px of rows in the ~610px a keyboard leaves on an 844px screen — and Tags, Note and Save wait under it, exactly as they wait under the keyboard today. Not an answer of its own: the proof that the answer above would have fit, and it went with it.",
        suggestVariant("form-entry-keyboard"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "What choosing a suggested description fills in",
        },
      ),
      plate(
        "suggest-tags-the-chips-ranked",
        "Tags · the chips it has today, ranked and capped",
        "<b>Not chosen</b> — the session’s recommendation, kept as the record. Tags already show chips under the field, from your own tags, filtered as you type — this keeps the shape and fixes what it shows. <b>Ranked</b>: the tags that usually go with this description and with the chosen category first (after <i>Uber to work</i>, #work and #commute before #latte), then the most used, then the most recent, instead of the alphabetical first eight. <b>Capped to what fits in two lines</b>, the rule Quick add’s category chips already follow (T-151), so the row never scrolls and never pushes the note away. One tap adds a tag; typing narrows the chips to the tags that start with what you typed (today any part of the tag matches, and that goes), and Enter still adds exactly what you typed. <b>Why this one:</b> a tag is a word, which is what a chip holds; you often add two or three, and chips are one tap each with no typing; and it is the component the field already has, so nothing new is learned or built. <b>What it costs:</b> the chips appear on focus, before you type — the one place this design shows help unasked — because a tag you have not thought of is the one you need reminding of.",
        suggestVariant("tags-chips"),
        { added: "2026-09-24", verdict: "discarded", asks: "How a tag is suggested" },
      ),
      plate(
        "suggest-tags-a-list-like-the-description",
        "Tags · a list under the field, like the description",
        "<b>Chosen, 2026-09-24: «la lista».</b> The same list Description opens, under the tags field: nothing before you type, then the matching tags with how often and with which category they usually go, ↓ ↑ Enter on a keyboard, a tap on a phone; Enter with nothing highlighted adds exactly what you typed, and the eight alphabetical chips the field had go. A tag matches at its start or after a hyphen. <b>What it buys:</b> one shape for both fields, one component. <b>What it costs, which he accepted:</b> a list needs a letter before it offers anything, so the tag you forgot is never suggested; adding three tags is type-pick three times where chips were tap-tap-tap; and the list under a field that wraps its chips moves down as tags are added.",
        suggestVariant("tags-list"),
        { added: "2026-09-24", verdict: "chosen", asks: "How a tag is suggested" },
      ),
      plate(
        "suggest-tags-the-rest-greyed-plus-chips",
        "Tags · the rest of the tag greyed, chips before you type",
        "<b>Not chosen.</b> Both at once: the ranked chips while the field is empty, and once you type, the best match completed in grey inside the field — <i>co</i> → <i>mmute</i> — accepted with Enter, → or the check, while the chips narrow to the matches. <b>What it buys:</b> the fastest keyboard path there is — type two letters, Enter. <b>What it would have cost:</b> it is two mechanisms on one field, with the same answer in two places (#commute in grey and as the first chip); Enter has to mean <i>accept the grey</i> and <i>add what I typed</i> at the same time, which is only unambiguous while the grey is on screen; and a screen reader gets the chips and not the grey.",
        suggestVariant("tags-ghost"),
        { added: "2026-09-24", verdict: "discarded", asks: "How a tag is suggested" },
      ),
      plate(
        "suggest-quick-nothing-until-you-type",
        "Quick add · nothing until you type",
        "<b>Chosen, 2026-09-24: «nada».</b> The sheet opens exactly as it does today — the amount with the keyboard, the chips, the account, the empty note — and help exists only inside the note, once you type, as the list above. Nothing is added to the sheet, so a person who never uses it never sees it. <b>What it costs:</b> the fastest possible repeat is still amount → note → pick, three actions; the row on the right would make it one, and that door stays T-32’s.",
        suggestVariant("quick-plain"),
        { added: "2026-09-24", verdict: "chosen", asks: "What Quick add offers before you type" },
      ),
      plate(
        "suggest-quick-a-row-of-what-you-repeat",
        "Quick add · a row of what you repeat, before typing",
        "<b>Not chosen.</b> Under the amount, a row named <b>Again</b> with the three entries you record most — <i>Uber to work · $18,400</i> — each with its category’s tile. One tap fills the amount, the category and the note, and Save is next: the whole daily coffee in two taps. <b>What it buys:</b> the shortest path this task could have. <b>What it would have cost:</b> it is a row on every opening of the sheet, for everyone, whether or not they repeat anything — the opposite of help that stays out of the way; it fills an amount, which is the one field this design otherwise never touches; the sheet gets ~70px taller on a phone where the category chips already take two lines; and it is what <b>T-32 (Recurring)</b> is for — detecting what repeats and offering it — which would then have two doors. If you want it, it belongs to that task, not to this one.",
        suggestVariant("quick-again"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "What Quick add offers before you type",
        },
      ),
      plate(
        "suggest-after-choosing-the-whole-entry",
        "After choosing a suggested description · the whole entry",
        "<b>Not chosen with the answer it belonged to.</b> Drawn for <i>the whole entry, filling only what is empty</i>: <i>Uber to work</i> was chosen from the list, Transport was selected because no category had been chosen, #work was added because no tag had been, the amount stayed the 18,400 typed before, and one quiet line under the field said what was filled. With <i>only the text</i> chosen, the form after a pick is the ordinary form with the description written and nothing else moved.",
        suggestVariant("form-after-pick"),
        {
          added: "2026-09-24",
          verdict: "discarded",
          asks: "What choosing a suggested description fills in",
        },
      ),
      plate(
        "new-version-a-toast-that-stays",
        "New version · the toast it has today, staying",
        "<b>Not chosen.</b> The shape the notice had until T-196 — “New version available · Reload” at the bottom, over the tab bar — with the one thing that makes it disappear taken away: <b>it no longer closes on its own after five seconds</b>. A <b>Saved</b> or any other toast still gets its five seconds, and the notice comes back when it goes, so neither is lost. <b>What it buys:</b> nothing new to learn or build. <b>What it costs:</b> for as long as you do not reload it sits over the last row of every list on a phone, and it takes turns with every confirmation — a toast is meant to say something and leave, and this one has to stay.",
        newVersionVariant("toast"),
        {
          added: "2026-09-25",
          verdict: "discarded",
          asks: "How the app says there is a new version",
        },
      ),
      plate(
        "new-version-a-stripe-at-the-top",
        "New version · a stripe at the top, like the sync stripes",
        "<b>Chosen, 2026-09-25</b>, the session’s recommendation. The same place and shape as the sync stripes — the top of the content column, pushing the page down instead of covering it — in <b>blue</b>, the colour that is neither a warning nor a failure, because a new version is good news: “<b>A new version of Ledger Flow is ready.</b> Reloading takes a second. Nothing you saved is lost.” with <b>Reload</b>. <b>What it buys:</b> it covers nothing, never takes turns with a toast, and it lives where you already look for what the app has to tell you. <b>What it costs:</b> the stripe is one slot, so while you are offline, signed out or have changes that need you, those win and this one waits its turn behind them — they are what you have to act on first; it does come before a plain “Changes waiting to sync” and “Back online”, and before “You’re working on this device only”, a mode that never goes away on its own.",
        newVersionVariant("stripe"),
        {
          added: "2026-09-25",
          verdict: "chosen",
          asks: "How the app says there is a new version",
        },
      ),
      plate(
        "new-version-stays-until-you-reload",
        "New version · it stays until you reload",
        "<b>Not chosen.</b> No close button: the notice is on screen until you press Reload, on every screen and every visit. <b>What it buys:</b> nobody stays on an old version by accident. <b>What it costs:</b> a person in the middle of something — a month of reconciling, a form — cannot put it away, and it keeps pushing every page down until they give in. Drawn on the stripe; on the toast it is the same without the ✕.",
        newVersionVariant("stripe-fixed"),
        {
          added: "2026-09-25",
          verdict: "discarded",
          asks: "Whether the new-version notice can be closed, and when it comes back",
        },
      ),
      plate(
        "new-version-closes-and-comes-back",
        "New version · you can close it, and it comes back",
        "<b>Chosen, 2026-09-25</b>, the session’s recommendation. The ✕ puts it away <b>for now</b>: it comes back the next time you open the app or come back to it — from another app, another tab, the phone’s lock screen — for as long as that screen is still on the older version. Meanwhile <b>Settings › Version</b>, at the end of Settings as drawn here, says so and has its own Reload, so it is never hidden with no way back. <b>What it buys:</b> you choose the moment, and the notice cannot be lost, which is today’s fault. <b>What it costs:</b> someone who closes it every time stays on the old version until the phone closes the app, which also brings the new one.",
        newVersionVariant("about"),
        {
          added: "2026-09-25",
          verdict: "chosen",
          asks: "Whether the new-version notice can be closed, and when it comes back",
        },
      ),
    ],
  },
];

const ALL_PLATES = PAGES.flatMap((page) => (page.plates ?? []).map((p) => ({ ...p, page })));
const IN_REVIEW = ALL_PLATES.filter((p) => p.review);
const OPEN = ALL_PLATES.filter((p) => p.verdict === "open");
const WAITING = IN_REVIEW.length + new Set(OPEN.map((p) => p.asks)).size;
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
<div class="pv-group">${link("index.html", "Start here")}${link("in-review.html", "Waiting on you", WAITING, WAITING > 0 ? " waiting" : "")}${link("changes.html", "What changed")}</div>
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
