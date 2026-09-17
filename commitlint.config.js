export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "infra",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
    "scope-enum": [2, "always", ["agent", "web", "shared", "ci", "repo"]],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};
