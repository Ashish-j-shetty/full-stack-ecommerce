/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  setupFiles: ["./jest.setup.js"],
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      statements: 60,
      branches: 40,
    },
  },
};
