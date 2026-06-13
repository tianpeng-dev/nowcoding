# 项目状态记录：2026-06-13

## 前置说明
- 记录时间：2026-06-13，时区 Asia/Shanghai。
- 输入来源：本地仓库 `/Users/peng/Documents/Project/NowCoding`、Git 状态、README、package 配置、docs 目录、Serena 记忆与本地质量命令输出。
- 数据时效：仅代表本次本地工作区盘点结果；远端服务、npm 发布状态、Vercel 部署状态未联网验证。
- 不确定性：未跟踪的 `* 2.ts` / `* 2.tsx` 文件疑似本地副本或同步产物，除文件内容对比外未追溯来源。

## 当前结论
- 项目是 NowCoding：通过 CLI 采集本地 AI 编码工具用量，经核心包聚合后同步到 Next.js Web 端，展示公开 Profile、SVG Card、Badge、OG 图与统计接口。
- 仓库为 pnpm/turbo monorepo，主要包包括 `apps/cli`、`apps/web`、`packages/core`、`packages/db`、`packages/parsers`、`packages/badge`、`packages/cloud-db`。
- 当前分支为 `docs/remove-stale-generic-parser-note`，HEAD 为 `6de3e7e docs: remove stale generic-parsers note from local-dev.md`。
- CLI 包版本为 `0.1.0-alpha.3`，根 README 的完备度快照显示 v1 核心链路基本完成，Multi-device storage 仍为 Partial UI。

## 工作区状态
- 已修改：`packages/core/src/cost.ts`，主要是把模型价格表移出该文件，并从 `./model-prices.js` 导入。
- 未跟踪：`packages/core/src/model-prices.ts`，包含被拆出的 `MODEL_PRICES`、`ModelPrice` 与 `TOKENS_PER_MILLION`。
- 未跟踪：多份带空格后缀的副本文件，例如 `apps/web/lib/model-pricing 2.ts`、`apps/web/app/models/page 2.tsx` 等；除 `apps/cli/tests/version.test 2.ts` 外，抽样对比均与原文件相同。
- 风险：`apps/cli/tests/version.test 2.ts` 与正式 `version.test.ts` 不一致，副本仍断言 `0.1.0-alpha.1`，而当前正式测试断言 `0.1.0-alpha.3`。
- 注意：`docs/superpowers/plans/2026-05-18-main-chain-release-readiness.md` 当前已被 Git 跟踪，和全局“不提交 docs/superpowers/plans/”规则存在历史不一致。

## 验证结果
- `pnpm typecheck`：通过，10 个 turbo 任务成功。
- `pnpm test`：通过，70 个测试文件、356 个测试全部通过。
- `pnpm lint`：失败，原因有两项：
  - `.claude/settings.local.json` 需要格式化。
  - `packages/core/src/cost.ts` import 顺序不符合 Biome organizeImports。

## 建议下一步
1. 删除或忽略所有确认无用的 `* 2.ts` / `* 2.tsx` 副本，尤其不要合入旧版 `apps/cli/tests/version.test 2.ts`。
2. 将 `packages/core/src/model-prices.ts` 与 `packages/core/src/cost.ts` 作为同一拆分变更处理，并修正 import 顺序后重新跑 `pnpm lint`。
3. 单独处理 `.claude/settings.local.json` 的格式问题；若该文件属于本地配置，应确认是否应加入忽略规则。
4. 复核已跟踪的 `docs/superpowers/plans/2026-05-18-main-chain-release-readiness.md` 是否需要从版本控制中移除，避免后续推送违反全局规则。

## 清理跟进：2026-06-13
- 已删除本地未跟踪的 `* 2.ts` / `* 2.tsx` 重复副本，其中包含旧版 `apps/cli/tests/version.test 2.ts`。
- 已修正 `packages/core/src/cost.ts` 的 import 顺序。
- 已格式化本地 `.claude/settings.local.json`；该文件未出现在 Git 状态中，判断为未跟踪或忽略的本地配置。
- 最新验证：`pnpm lint`、`pnpm typecheck`、`pnpm test` 均通过。
- 最新 Git 状态仅剩有效待审查变更：`packages/core/src/cost.ts`、`packages/core/src/model-prices.ts`、`evidence/project-status-2026-06-13.md`。
