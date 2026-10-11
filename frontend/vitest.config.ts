import { defineConfig } from 'vitest/config'

// 独立于 vite.config.ts：规则引擎测试是纯 TS，无需 React/Tailwind 插件，
// 也避免 vite 8 (rolldown) 与 vitest 内置 vite 7 的类型冲突
export default defineConfig({
  esbuild: { jsx: "automatic" },
  define: { __APP_VERSION__: JSON.stringify("test"), __BUILD_TIME__: JSON.stringify("test") },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
  },
})
