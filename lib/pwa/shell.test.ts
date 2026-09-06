import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  DETAIL_TEMPLATES,
  isShellPath,
  offlineDocument,
  SHELL_PATHS,
  shellCacheKey,
  shellUrls,
  TEMPLATE_ID,
  templatePath,
  warmUrlFor,
} from "./shell";

// Every `page.tsx` under the `(app)` group, as the route it answers.
function appRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routes.push(...appRoutes(full, `${prefix}/${entry}`));
    else if (entry === "page.tsx") routes.push(prefix === "" ? "/" : prefix);
  }
  return routes;
}

const ROUTES = appRoutes(join(process.cwd(), "app/[locale]/(app)"));

describe("SHELL_PATHS and DETAIL_TEMPLATES", () => {
  // F-47: three of the nine routes missing from the list were the forms that create an account, a
  // category and a budget — the outbox could queue them and the worker had no document to show.
  it("cover every route of the (app) group, static ones by path and dynamic ones by template", () => {
    const shipped = ROUTES.filter((route) => !route.startsWith("/dev/"));
    const listed = [...SHELL_PATHS, ...DETAIL_TEMPLATES] as readonly string[];
    for (const route of shipped) expect(listed, route).toContain(route);
    for (const path of listed) expect(shipped, path).toContain(path);
  });
});

describe("isShellPath", () => {
  it("covers every (app) route, in both locales", () => {
    for (const path of SHELL_PATHS) {
      expect(isShellPath(path), path).toBe(true);
      expect(isShellPath(`/es${path}`), path).toBe(true);
    }
    expect(isShellPath("/accounts/a1/edit")).toBe(true);
  });

  it("leaves the public routes to the default rules", () => {
    for (const path of ["/", "/es", "/login", "/register", "/privacy", "/es/terms"]) {
      expect(isShellPath(path), path).toBe(false);
    }
  });
});

describe("templatePath", () => {
  const id = "01920000-0000-7000-8000-000000000041";

  it("folds a row's id into its route template, in both locales", () => {
    expect(templatePath(`/transactions/${id}`)).toBe("/transactions/[id]");
    expect(templatePath(`/accounts/${id}/edit`)).toBe("/accounts/[id]/edit");
    expect(templatePath(`/es/budgets/${id}`)).toBe("/es/budgets/[id]");
    expect(templatePath(`/es/categories/${id}/edit`)).toBe("/es/categories/[id]/edit");
  });

  it("leaves every other path alone", () => {
    expect(templatePath("/transactions/new")).toBe("/transactions/new");
    expect(templatePath("/transactions/review")).toBe("/transactions/review");
    expect(templatePath(`/login/${id}`)).toBe(`/login/${id}`);
    expect(templatePath("/es/home")).toBe("/es/home");
  });
});

describe("shellCacheKey", () => {
  // F-06: the filter and Next's own `_rsc` token change the URL and not the answer.
  it("keeps one entry per route, whatever the query string says", () => {
    expect(shellCacheKey("https://app.test/transactions?type=EXPENSE&_rsc=abc")).toBe(
      "https://app.test/transactions",
    );
    expect(shellCacheKey("https://app.test/transactions")).toBe("https://app.test/transactions");
  });

  // F-48: a movement created with no network has an id no cache entry was ever made for.
  it("keeps one entry per detail template, whatever the id says", () => {
    expect(
      shellCacheKey("https://app.test/transactions/01a06443-271f-764c-8c32-99226cc18413"),
    ).toBe("https://app.test/transactions/[id]");
    expect(shellCacheKey(`https://app.test/es/accounts/${TEMPLATE_ID}/edit?_rsc=x`)).toBe(
      "https://app.test/es/accounts/[id]/edit",
    );
  });
});

describe("warmUrlFor", () => {
  it("turns a template key back into a request the server answers", () => {
    expect(warmUrlFor("https://app.test/budgets/[id]")).toBe(
      `https://app.test/budgets/${TEMPLATE_ID}`,
    );
    expect(warmUrlFor("https://app.test/budgets")).toBe("https://app.test/budgets");
    expect(shellCacheKey(warmUrlFor("https://app.test/budgets/[id]/edit"))).toBe(
      "https://app.test/budgets/[id]/edit",
    );
  });
});

describe("offlineDocument", () => {
  it("answers in the locale of the route that could not be reached", () => {
    expect(offlineDocument("/budgets")).toBe("/offline.html");
    expect(offlineDocument("/es/budgets")).toBe("/offline.es.html");
  });
});

describe("shellUrls", () => {
  it("prefixes every route but the default locale's, templates included", () => {
    expect(shellUrls("en", "https://app.test")).toContain("https://app.test/home");
    expect(shellUrls("es", "https://app.test")).toContain("https://app.test/es/home");
    expect(shellUrls("en", "https://app.test")).toContain(
      `https://app.test/transactions/${TEMPLATE_ID}/edit`,
    );
    expect(shellUrls("es", "https://app.test")).toHaveLength(
      SHELL_PATHS.length + DETAIL_TEMPLATES.length,
    );
  });
});
