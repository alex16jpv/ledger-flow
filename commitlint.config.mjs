export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100],
    "references-empty": [2, "never"],
  },
  parserPreset: {
    parserOpts: {
      // W-nn is the Fase 2 redesign backlog; O-Fn and O-Bn are the offline plan's items.
      issuePrefixes: ["W-", "O-F", "O-B"],
    },
  },
};
