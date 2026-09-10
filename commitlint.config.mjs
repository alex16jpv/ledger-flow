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
      // T-nn is the current task list the owner keeps for the project. The rest are historical and
      // stay accepted so old commits keep parsing: W-nn was the Fase 2 redesign backlog, O-Fn and
      // O-Bn the offline plan's items, F-nn the findings register, P-nn the owner's requests, and
      // G-nn the organisation items that spanned both repositories.
      issuePrefixes: ["T-", "W-", "O-F", "O-B", "F-", "P-", "G-"],
    },
  },
};
