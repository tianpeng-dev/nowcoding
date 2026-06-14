# NowCoding i18n Task 6 记录

## 前置说明
- 记录时间：2026-06-14，时区 Asia/Shanghai。
- 输入来源：用户指定计划 `docs/superpowers/plans/2026-06-14-nowcoding-readme-web-i18n.md`、本地仓库 `/Users/peng/Documents/Project/NowCoding`、Serena 符号检索、本地测试输出。
- 数据时效：仅代表本地工作区在本次任务执行时的状态；未联网验证远端仓库、Vercel 或包发布状态。
- 不确定性：Task 3/4/5 变更已存在且未提交，本次仅复核并修改 Task 6 指定的 lib、messages 与相关测试文件，不回退他人变更。

## 变更结论
- `apps/web/lib/social-positioning.ts`：新增默认英文 copy 与 locale-aware 工厂，保留既有常量导出。
- `apps/web/lib/public-surface.ts`：为 profile summary、live presence、cost、token 溢出与 fallback 文案增加可选本地化 copy；model/source id 仍保持原始值。
- `apps/web/lib/setup-status.ts`：为 setup 状态卡、隐私行和主操作文案增加可选 messages；CLI command、API token、环境变量名与 URL 不翻译。
- `apps/web/lib/usage-dashboard.ts`：为 usage card label、detail 模板、空值与 cost label 增加可选 messages 和 locale；模型 id 不翻译。
- `apps/web/lib/model-pricing.ts`：仅抽出每百万 token 展示后缀，保留 model id 与价格数字。
- `apps/web/messages/en.json` 与 `apps/web/messages/zh-CN.json`：新增对称 key，覆盖 lib 展示文案。
- 相关 Vitest 已补充默认英文兼容与简中 copy 分支断言。

## 验证结果
- `pnpm test -- apps/web/tests/public-surface.test.ts apps/web/tests/setup-status.test.ts apps/web/tests/usage-dashboard.test.ts apps/web/tests/model-pricing.test.ts apps/web/tests/social-positioning.test.ts`：通过，5 个测试文件、35 个测试通过。
- `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过。
- `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。

## 风险与后续
- 无迁移，直接替换；默认英文 API 兼容保留。
- 页面组件已接入 lib 的 locale-aware copy/messages；公开 API、SVG、model id、source id、CLI command 与环境变量名保持不翻译。

## 复核修复：2026-06-14
- 复核问题：lib 已具备 locale-aware copy/messages，但页面组件未传入 messages，导致 `zh-CN` 页面仍显示 lib 默认英文派生文案。
- 修复结论：
  - `profile-page-content.tsx` 从 `messages.publicSurface` 构造 `PublicSurfaceCopy`，传入 `buildProfileSummary`、`buildLivePresenceLabel` 与 `formatSafeTokens`。
  - `usage-dashboard.ts` 为 usage cards 增加稳定 `key`，避免页面依赖翻译后的 label 查找卡片。
  - `usage-page-content.tsx` 从 `messages.usageDashboard` 构造 `UsageDashboardMessages`，传入 `buildUsageDashboardView`，并改用稳定 card key 读取 cost/token/active/model 卡片。
  - `models-page-content.tsx` 从 `messages.modelPricing.perMillionTokens` 传入价格行构造函数；model id 与价格数字保持不翻译。
- 最新验证：
  - `pnpm test -- apps/web/tests/public-surface.test.ts apps/web/tests/setup-status.test.ts apps/web/tests/usage-dashboard.test.ts apps/web/tests/model-pricing.test.ts apps/web/tests/social-positioning.test.ts`：通过，5 个测试文件、35 个测试通过。
  - `pnpm --filter @nowcoding/web test:i18n`：通过，1 个测试文件、1 个测试通过。
  - `pnpm --filter @nowcoding/web typecheck`：通过，`tsc -p tsconfig.json --noEmit` 无错误。

## 复核修复补充：2026-06-14
- `usage-page-content.tsx` 的 `metricCards` 已保留稳定 card key，并在渲染 `MetricCard` 时使用 `key={card.key}`，不再使用翻译文案 label 作为 React key。
