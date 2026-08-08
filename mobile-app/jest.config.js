module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  // The queue module under test is plain TypeScript; narrow the transform to
  // keep the suite fast and avoid transpiling unrelated vendor code.
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
};
