/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/src/tests/setup.ts"],
  moduleNameMapper: {
    "^obsidian$": "<rootDir>/src/tests/__mocks__/obsidian.ts",
  },
  globals: {
    "ts-jest": {
      tsconfig: {
        module: "commonjs",
        moduleResolution: "node",
      },
    },
  },
};
