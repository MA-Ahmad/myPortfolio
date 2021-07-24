module.exports = {
  root: true,
  env: {
    node: true,
    es6: true
  },
  parserOptions: { ecmaVersion: 8 }, // to enable features such as async/await
  ignorePatterns: ["node_modules/*", ".next/*", ".out/*"], // We don't want to lint generated files nor node_modules, but we want to lint .prettierrc.js (ignored by default by eslint)
  extends: ["eslint:recommended"],
  overrides: [
    // This configuration will apply only to TypeScript files
    {
      files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      parser: "@typescript-eslint/parser",
      settings: { react: { version: "detect" } },
      env: {
        browser: true,
        node: true,
        es6: true
      },
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended" // TypeScript rules
      ],
      rules: {
        // We will use TypeScript's types for component props instead
        "react/prop-types": "off",

        // I suggest this setting for requiring return types on functions only where useful
        "@typescript-eslint/explicit-function-return-type": [
          "warn",
          {
            allowExpressions: true,
            allowConciseArrowFunctionExpressionsStartingWithVoid: true
          }
        ]
      },
      parserOptions: { sourceType: "module" }
    }
  ]
};
