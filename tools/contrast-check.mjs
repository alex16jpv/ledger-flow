import { readdirSync, readFileSync } from "node:fs";

const FEATURE_TOKENS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "rose",
  "gray",
  "brown",
  "black",
];

function parseSeeds(css) {
  const seeds = {};
  for (const m of css.matchAll(/--seed-([a-z]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) {
    seeds[m[1]] = { l: +m[2], c: +m[3], h: +m[4] };
  }
  for (const m of css.matchAll(/--seed-([a-z]+):\s*var\(--seed-([a-z]+)\)/g))
    seeds[m[1]] = seeds[m[2]];
  return seeds;
}

function oklchToLinearRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const ratio = (fg, bg) => {
  const lf = luminance(oklchToLinearRgb(fg));
  const lb = luminance(oklchToLinearRgb(bg));
  return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
};
const derive = (seed, l, chromaFactor = 1) => ({ l, c: seed.c * chromaFactor, h: seed.h });

function modesFor(seeds) {
  const N = seeds.neutral;
  const B = seeds.brand;
  return {
    light: {
      bg: derive(N, 0.975),
      surface: derive(N, 0.998, 0.4),
      surface2: derive(N, 0.955),
      border: derive(N, 0.905),
      borderStrong: derive(N, 0.8),
      text: derive(N, 0.21),
      text2: derive(N, 0.45),
      text3: derive(N, 0.49),
      ink: derive(N, 0.18),
      onInk: derive(N, 0.985),
      brand: B,
      onBrand: { l: 1, c: 0, h: 0 },
      brandSoft: derive(B, 0.94, 0.35),
      brandText: derive(B, 0.4),
      heat: [derive(B, 0.94, 0.35), derive(B, 0.88, 0.55), derive(B, 0.8, 0.75), B],
      feature: (s) => ({ solid: s, soft: derive(s, 0.95, 0.3), text: derive(s, 0.42, 0.9) }),
    },
    dark: {
      bg: derive(N, 0.135),
      surface: derive(N, 0.18),
      surface2: derive(N, 0.215),
      border: derive(N, 0.27),
      borderStrong: derive(N, 0.36),
      text: derive(N, 0.95, 0.5),
      text2: derive(N, 0.74),
      text3: derive(N, 0.62),
      ink: derive(N, 0.96, 0.5),
      onInk: derive(N, 0.16),
      brand: derive(B, 0.7),
      onBrand: derive(B, 0.16, 0.3),
      brandSoft: derive(B, 0.26, 0.4),
      brandText: derive(B, 0.84, 0.7),
      heat: [derive(B, 0.26, 0.4), derive(B, 0.36, 0.55), derive(B, 0.48, 0.75), derive(B, 0.7)],
      feature: (s) => ({
        solid: { ...s, l: Math.max(s.l + 0.08, 0.52) },
        soft: derive(s, 0.26, 0.35),
        text: derive(s, 0.82, 0.7),
      }),
    },
  };
}

// Feature solids are decorative by design (DESIGN.md §2.3): reported, never enforced.
function checkPalette(file) {
  const seeds = parseSeeds(readFileSync(file, "utf8"));
  let failures = 0;
  const check = (mode, name, fg, bg, min, decorative = false) => {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok && !decorative) failures++;
    const label = ok ? "  ok " : decorative ? " info" : "FAIL ";
    console.log(`${label}${mode.padEnd(6)}${name.padEnd(36)}${r.toFixed(2)}:1 (min ${min})`);
  };
  for (const [mode, t] of Object.entries(modesFor(seeds))) {
    for (const surface of ["bg", "surface", "surface2"]) {
      check(mode, `text / ${surface}`, t.text, t[surface], 4.5);
      check(mode, `text-2 / ${surface}`, t.text2, t[surface], 4.5);
    }
    check(mode, "text-3 / surface", t.text3, t.surface, 4.5);
    check(mode, "text-3 / bg", t.text3, t.bg, 4.5);
    check(mode, "on-brand / brand", t.onBrand, t.brand, 4.5);
    t.heat.slice(0, 3).forEach((step, i) => {
      check(mode, `text / heat-${i + 1}`, t.text, step, 4.5);
    });
    check(mode, "on-brand / heat-4", t.onBrand, t.heat[3], 4.5);
    check(mode, "brand-text / brand-soft", t.brandText, t.brandSoft, 4.5);
    check(mode, "brand / surface (ui)", t.brand, t.surface, 3);
    check(mode, "on-ink / ink", t.onInk, t.ink, 4.5);
    for (const name of FEATURE_TOKENS) {
      const f = t.feature(seeds[name]);
      check(mode, `${name}-text / ${name}-soft`, f.text, f.soft, 4.5);
      check(mode, `${name}-text / surface`, f.text, t.surface, 4.5);
      check(mode, `${name} solid / surface (decorative)`, f.solid, t.surface, 3, true);
    }
  }
  return failures;
}

const EMAIL_ROLES = {
  bg: "bg",
  surface: "surface",
  "surface-2": "surface2",
  border: "border",
  "border-strong": "borderStrong",
  text: "text",
  "text-2": "text2",
  "text-3": "text3",
  brand: "brand",
  "on-brand": "onBrand",
  "brand-text": "brandText",
};

const toHex = (colour) =>
  "#" +
  oklchToLinearRgb(colour)
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

const channelGap = (a, b) =>
  Math.max(
    ...[1, 3, 5].map((i) =>
      Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)),
    ),
  );

// Emails cannot read tokens, so ui.css and the email spec write Tinta out in hex; they must still be Tinta.
function checkEmailColours() {
  const modes = modesFor(parseSeeds(readFileSync("tokens/palette.tinta.css", "utf8")));
  const sources = {
    "design/preview/assets/ui.css": [
      ...readFileSync("design/preview/assets/ui.css", "utf8").matchAll(
        /--mail-([a-z0-9-]+): light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/g,
      ),
    ],
    "design/spec/screens/emails.md": [
      ...readFileSync("design/spec/screens/emails.md", "utf8").matchAll(
        /\| `--([a-z0-9-]+)`\s*\| `(#[0-9a-f]{6})`\s*\| `(#[0-9a-f]{6})`/g,
      ),
    ],
  };
  let failures = 0;
  console.log("\nemail colours (Tinta, in hex)");
  for (const [file, rows] of Object.entries(sources)) {
    const seen = new Set(rows.map((m) => m[1]));
    for (const role of Object.keys(EMAIL_ROLES)) {
      if (!seen.has(role)) {
        failures++;
        console.log(`FAIL ${file}: --${role} is missing`);
      }
    }
    for (const [, role, light, dark] of rows) {
      const key = EMAIL_ROLES[role];
      if (!key) {
        failures++;
        console.log(`FAIL ${file}: --${role} is not an email colour`);
        continue;
      }
      for (const [mode, written] of [
        ["light", light],
        ["dark", dark],
      ]) {
        const expected = toHex(modes[mode][key]);
        const ok = channelGap(written, expected) <= 2;
        if (!ok) failures++;
        console.log(
          `${ok ? "  ok " : "FAIL "}${mode.padEnd(6)}${role.padEnd(16)}${written} (tokens: ${expected}) · ${file}`,
        );
      }
    }
  }
  return failures;
}

const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync("tokens")
        .filter((name) => /^palette\..+\.css$/.test(name))
        .map((name) => `tokens/${name}`);

let total = 0;
for (const file of files) {
  console.log(`\n${file}`);
  total += checkPalette(file);
}
const emailFailures = process.argv.length > 2 ? 0 : checkEmailColours();
console.log(total ? `\n${total} pairs below the minimum` : "\nAll pairs meet WCAG AA");
if (emailFailures) console.log(`${emailFailures} email colours no longer match the tokens`);
process.exit(total || emailFailures ? 1 : 0);
