import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: [
        "**/__tests__/**/*.test.ts",
        "**/*.spec.ts",
    ],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "tsconfig.json",
            },
        ],
    },
    extensionsToTreatAsEsm: [".ts"],
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
        "/src/generated/",
    ],
    coverageReporters: ["text", "lcov", "clover"],
    verbose: true,
    setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
};

export default config;
