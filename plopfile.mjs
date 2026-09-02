export default function (plop) {
  plop.setGenerator("feature", {
    description: "Create features/<name> with api, keys, hooks, schemas, components and tests",
    prompts: [{ type: "input", name: "name", message: "Feature name (kebab-case):" }],
    actions: [
      {
        type: "add",
        path: "features/{{kebabCase name}}/api.ts",
        templateFile: "plop-templates/feature/api.ts.hbs",
      },
      {
        type: "add",
        path: "features/{{kebabCase name}}/keys.ts",
        templateFile: "plop-templates/feature/keys.ts.hbs",
      },
      {
        type: "add",
        path: "features/{{kebabCase name}}/hooks.ts",
        templateFile: "plop-templates/feature/hooks.ts.hbs",
      },
      {
        type: "add",
        path: "features/{{kebabCase name}}/hooks.test.ts",
        templateFile: "plop-templates/feature/hooks.test.ts.hbs",
      },
      {
        type: "add",
        path: "features/{{kebabCase name}}/schemas.ts",
        templateFile: "plop-templates/feature/schemas.ts.hbs",
      },
      {
        type: "add",
        path: "features/{{kebabCase name}}/README.md",
        templateFile: "plop-templates/feature/README.md.hbs",
      },
      { type: "add", path: "features/{{kebabCase name}}/components/.gitkeep", template: "" },
    ],
  });
}
