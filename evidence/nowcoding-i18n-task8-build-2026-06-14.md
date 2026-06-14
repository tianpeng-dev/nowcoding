# NowCoding i18n Task 8 构建验证与提交准备记录

## 前置说明
- 记录时间：2026-06-14，时区 Asia/Shanghai。
- 输入来源：用户提供的 Task 8 范围、本地仓库 `/Users/peng/Documents/Project/NowCoding`、本地 `pnpm`/Next.js/Vitest/TypeScript/Biome/Git 输出。
- 数据时效：仅代表本地工作区在本次任务执行时的状态；未联网验证远端仓库、部署环境或包发布状态。
- 不确定性：Task 1-7 相关变更已存在且未提交，本次仅执行最终质量门禁、修复已知 build 导入解析问题并记录提交前审计结果；未暂存、未提交、未推送。

## 变更结论
- `packages/core/src/cost.ts`：将 `./model-prices.js` 源码导入改为 extensionless `./model-prices`，与同文件现有 `./schemas` 导入风格一致，使 Next webpack 构建可解析 TypeScript 源文件。
- 未修改 `packages/core/src/model-prices.ts` 的价格数据、匹配规则或导出含义。

## 验证结果
- `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过；Vitest 输出 Vite CJS API deprecated 提示，不影响结果。
- `pnpm --filter @nowcoding/web test:i18n:routing`：通过，1 个测试文件、23 个测试通过；Vitest 输出 Vite CJS API deprecated 提示，不影响结果。
- `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。
- `pnpm --filter @nowcoding/web lint`：通过，Biome 检查 81 个文件，无修复。
- `pnpm --filter @nowcoding/web build`：首次失败于 `packages/core/src/cost.ts` 无法解析 `./model-prices.js`；修复后通过，Next.js 16.2.5 webpack 生产构建成功，生成 16 个静态页面。

## 提交前审计
- `git status --short`：存在 Task 1-8 工作区变更与未跟踪 evidence 文件；未发现 staged 标记。
- `git diff --cached --name-only`：无输出，确认没有暂存文件。
- `git status --short docs/superpowers/plans`：无输出，确认计划目录未被暂存。

## 风险与后续
- 无迁移，直接替换。
- 本次 build 修复仅调整源码导入路径，不改变运行时计价逻辑。
- 当前工作区仍包含 Task 1-7 已有变更与本次新增 evidence 记录，最终提交由主线程完成。

## 最终质量审查收尾修复：2026-06-14
- 修复范围：
  - `apps/web/app/[locale]/page.tsx`、`apps/web/app/[locale]/setup/page.tsx`、`apps/web/app/[locale]/usage/page.tsx` 补充 `dynamic = 'force-dynamic'` 与 `revalidate = 0`，避免 locale profile/setup/usage 生产构建预渲染冻结环境状态或公开数据。
  - `apps/web/app/setup/page.tsx` 补充 `revalidate = 0`，与同类动态页面保持一致。
  - `apps/web/app/layout.tsx` 改用 `next-intl/server` 的 `getLocale()` 设置根 `<html lang>`，不在根布局固定声明所有页面为 `en`；未在嵌套 locale layout 输出 `<html>`。
  - `SparklineChart`、`ModelPie`、`SourceBars` 增加可选 `emptyLabel` 与 `valueLabel`，默认英文兼容；profile/usage 页面从 messages 传入本地化标签，模型 ID、source ID 与数值保持原样。
  - `apps/web/messages/en.json` 与 `apps/web/messages/zh-CN.json` 增加对称 chart key；新增 `chart-localization` 测试并扩展 build boundary 测试。
- 最新验证：
  - `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过。
  - `pnpm --filter @nowcoding/web test:i18n:routing`：通过，1 个测试文件、23 个测试通过。
  - `pnpm test -- apps/web/tests/chart-localization.test.ts apps/web/tests/vercel-build-boundaries.test.ts apps/web/tests/usage-dashboard.test.ts apps/web/tests/public-surface.test.ts`：通过，4 个测试文件、21 个测试通过。
  - `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。
  - `pnpm --filter @nowcoding/web lint`：通过，Biome 检查 82 个文件，无修复。
  - `pnpm --filter @nowcoding/web build`：通过，Next.js 16.2.5 webpack 生产构建成功；路由表显示 `/[locale]`、`/[locale]/setup`、`/[locale]/usage` 均为动态渲染。
  - `pnpm --dir apps/web exec next start -p 3017` 后通过 `curl` 验证：`/zh-CN` 输出 `<html lang="zh-CN"`，默认 `/` 输出 `<html lang="en"`。
- 审计说明：本次未暂存、未提交、未推送；新增与更新的 evidence 仅包含本地命令结果摘要，不包含密钥。
