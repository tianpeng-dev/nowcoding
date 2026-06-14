# NowCoding i18n Task 7 路由回归测试记录

## 前置说明
- 记录时间：2026-06-14，时区 Asia/Shanghai。
- 输入来源：用户提供的 Task 7 范围、本地仓库 `/Users/peng/Documents/Project/NowCoding`、Serena 项目配置与符号概览、本地 Vitest/TypeScript 输出。
- 数据时效：仅代表本地工作区在本次任务执行时的状态；未联网验证远端仓库、部署环境或包发布状态。
- 不确定性：Task 3-6 变更已存在且未提交，本次仅新增路由 matcher 回归测试、脚本与 Next 静态提取修复；未暂存、未提交、未推送。

## 变更结论
- `apps/web/proxy.ts`：`config.matcher` 使用内联字符串字面量，避免 Next 静态分析忽略 matcher；未改变 matcher 正则语义。
- `apps/web/tests/i18n-routing.test.ts`：新增 Vitest 回归测试，从 `config.matcher` 派生正则，使用 `getPageStaticInfo` 验证 Next 静态提取 `middleware.matchers`，并使用 `unstable_doesMiddlewareMatch` 验证 Next matcher 语义。
- `apps/web/package.json`：新增 `test:i18n:routing` 脚本，保留既有 scripts。

## 覆盖路径
- 不匹配 i18n proxy：`/api/heatmap`、`/_next/static/chunk.js`、`/_vercel/insights`、`/badge/live.svg`、`/og/summary`、`/card.svg`、`/card`、`/card/foo`。
- 匹配 i18n proxy：`/usage`、`/zh-CN/usage`、`/setup`。

## 验证结果
- `pnpm --filter @nowcoding/web test:i18n:routing`：通过，1 个测试文件、23 个测试通过。
- `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过。
- `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。

## 风险与后续
- 无迁移，直接替换。
- Vitest 运行时直接导入 `proxy.ts` 会触发 `next-intl/middleware` 的 Node ESM 解析边界；测试中 mock 该 middleware，仅隔离 middleware 副作用，不 mock matcher 常量。
- `next/experimental/testing/server` 顶层入口在本地 Node v24.14.0 环境会同时加载 config testing utils 并触发 AsyncLocalStorage invariant；测试改用同一 Next API 所在的 `next/dist/experimental/testing/server/middleware-testing-utils` 子模块，避免无关副作用。
- 直接调用 `getPageStaticInfo` 前需 `loadBindings()` 加载 Next SWC bindings，否则 `parseModule` 会返回空 AST 并导致静态提取结果为空。
- Serena 已用于项目上下文确认与 `proxy.ts` 符号概览；文件内容读取使用 `rg`/`nl` 辅助完成。

## 复核修复：lint 格式与导入排序
- 复核问题：Task 7 新增测试及同轮 i18n 相关已改文件存在 Biome 格式/导入排序差异。
- 修复方式：先运行 `pnpm --filter @nowcoding/web lint` 收集 Biome 输出，再仅对输出命中的 13 个具体 web 文件执行 `pnpm --filter @nowcoding/web exec biome check --write <文件列表>`。
- 修复范围：仅格式化与导入排序；未调整业务逻辑、matcher 语义或测试断言语义。
- 最新验证：
  - `pnpm --filter @nowcoding/web lint`：通过，81 个文件检查通过。
  - `pnpm --filter @nowcoding/web test:i18n:routing`：通过，1 个测试文件、23 个测试通过。
  - `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过。
  - `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。
