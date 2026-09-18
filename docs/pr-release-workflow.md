# PR、Merge、Deploy 与验收流程

这份流程适用于 Web 改动和对应的 GraphQL 合同改动。它把“代码通过 CI”和“当前提交已经被 Codex 审查”分成两个独立门禁。

## 1. 提交前快照

在修改前记录：

```text
repository: letletme-web | letletme-graphql
branch:
base:
head:
working tree:
graphql endpoint:
data/redis revision:
```

只把本次功能范围内的改动加入 commit。运行时 mock、截图、日志、`.next` 和 Playwright 采集物不得进入产品代码或提交；E2E fixture 必须留在 `e2e/fixtures` 等测试基础设施目录。

## 2. CI gate

Web PR 至少执行：

```bash
npm ci
npm run lint
npm test
npx tsc --noEmit
npm run build
npm audit --audit-level=moderate
npm run test:e2e
git diff --check
```

真实接口 smoke test 使用本地 GraphQL 服务连接生产 Redis，只读验证；不能用 E2E deterministic fixture 代替真实接口验收。GraphQL PR 另执行 schema/build/typecheck、resolver/repository tests 和 `/health` readiness 检查。

## 3. Codex review gate

CI 全绿后只触发一次 Codex review，并在评论中绑定完整 SHA：

```text
@codex review

Review gate head: `<full-sha>`
```

Codex review 可能需要 10–30 分钟。等待期间不要连续重复触发，也不要把 silence、普通 acknowledgement、绿色 CI 或已 resolve 的旧 thread 当成通过。先检查 review delivery/status，再决定是否继续等待。

收到反馈后逐条判断：

- 与当前代码、合同、数据正确性和发布风险一致，且在范围内：修复，增加回归测试，并在 thread 回报验证结果。
- over-engineering、超出本次范围或收益与成本明显不成比例：可以拒绝，在 PR 中写明范围、风险和拒绝理由。
- 基于旧代码、错误假设或错误合同：用具体代码、schema、测试证据回复并讨论，不盲目修改。
- 安全、权限、数据正确性和生产事故风险：不能仅以“范围外”跳过。

修复后 resolve thread 前先确认问题已经真正处理。任何新 commit 都会使之前的 clean review 失效，必须对新的完整 SHA 重新触发 review。

## 4. Exact-head clean gate

只有以下条件同时满足才允许 merge：

1. PR 当前 head 等于最近一次 review 请求绑定的完整 SHA。
2. Codex 对这个请求给出明确的 `no issues found` 或等价 clean signal。
3. 该请求之后没有新的 Codex finding。
4. 没有未解决的 Codex actionable thread。
5. required checks 全绿，PR 无冲突且 branch up to date。

可用 `gh-codex-review-loop` 的 inspector 核对上述状态。旧 SHA 的 clean 结果不能覆盖新 SHA。

## 5. Merge 顺序

1. GraphQL additive contract Draft PR：CI → Codex review loop → merge。
2. GraphQL 部署并完成健康、schema 和真实只读查询验收。
3. Web Draft PR 关联 GraphQL PR：CI → Codex review loop → Ready → GitHub merge。
4. 独立确认远程 PR 已 merged、main CI 通过，不能只看本地分支。

## 6. 部署与生产 smoke test

GraphQL 先部署：确认 `/health`、PostgreSQL、Redis、active season、picker、Player Detail、Player State、Market 和 Public League。记录 image/tag、schema revision、Redis/Data revision。

Web merge 后核对 Vercel deployment commit SHA 和 deployment ID，并确认：

```text
GRAPHQL_ENDPOINT
GRAPHQL_SERVICE_TOKEN
BACKEND_PROXY_SECRET
BETTER_AUTH_URL
```

生产 smoke test 覆盖：英文/中文首页、Gameweek、Fixtures（20 队、DGW、BGW、FDR）、Market、Public League Trends、Player Stats（搜索、Overall、State、Radar、比较、季前降级）、Live 页面，以及登录后的 `/my-fpl/team`、`/my-fpl/competitions` 和未绑定引导。

浏览器 Network 只能看到真实 API；不能有 mock endpoint、deterministic fixture 日志、hydration/React console error、GraphQL 5xx 或 timeout。保存固定球员、GW、DGW、BGW、Public League 和 My Team 的请求/响应证据。

## 7. 观察与回滚

部署后至少观察 30 分钟：Web/GraphQL 5xx、timeout、p95、Redis/PostgreSQL readiness、auth/session error、Player Stats unavailable/unknown 比例、JS console error 和 Core Web Vitals。

Web 回滚到上一份 Vercel deployment，保留 GraphQL additive contract；GraphQL 回滚前先把 Web 回到旧合同兼容版本，再回滚 image/tag。每次回滚记录：

```text
reason:
current sha / target sha:
web deployment id or graphql image:
schema revision:
redis/data revision:
smoke-test result:
monitoring window:
```

### Vercel promotion 超时后的恢复

`vercel promote` 的 CLI 超时不取消后台 promotion。参见
[Vercel promote 文档](https://vercel.com/docs/cli/promote)。命令失败不证明域名未变化，
EdgeOne 恢复 `all-vercel` 也不等于 Vercel deployment 回滚。

1. 记录本次 release SHA、候选 deployment ID、workflow run/attempt 及已知可回退 deployment。
2. 用相同 project/team 执行 `vercel promote status <project-id> --scope <team>`，观察原操作；
   不重复提交 promotion，不因观察超时创建新的候选。认证或网络错误也属于状态未知。
3. 若观察仍未完成，本次 workflow 保持失败，禁止激活 Tencent 或恢复 split。
   后续继续查询同一项目，并读取公共域名、Vercel origin 的 alias deployment ID 及
   `/healthz` release；这些域名仍可能在 workflow 退出后变化，不能记录为已回滚。
4. 后台已无 pending 操作后，核对候选/实际域名 SHA、当前 main、CI/review 与 Tencent
   实际版本。目标仍为当前 main 时才通过现有精确 SHA 发布入口继续；目标已过期时，
   完成当前 main 的发布门槛后发布当前 main，不盲目重跑旧 SHA。若发生关键业务回归，
   使用已记录的稳定 deployment 执行既有回滚流程，并重新验证域名与实际流量。
5. 只有两端 release、代表 API 和原登录浏览器业务路径都通过，才关闭发布不一致问题。
   在此之前保留失败及后续恢复记录；健康响应或无 pending 操作均不是业务验收。

发布 workflow 在创建候选前观察已有 promotion；本次 promote 返回非零时只观察原操作，
随后仍须通过目标 release header 检查。观察再次失败时不会自动恢复旧 alias，
必须按上述步骤继续核对异步终态，不能把有界等待当作取消或回滚保证。

CLI 52 的 status 命令会忽略三分钟前发起的请求，因此它返回成功后仍须读取
`/v9/projects/<project-id>?rollbackInfo=true` 的原始 `lastAliasRequest.jobStatus`。
workflow 使用 `check-promotion-state.mjs` 校验 project/team，拒绝 pending、in-progress、
未知状态及 rolling release；后置检查只接受 succeeded 的 promote，随后继续核对实际 release。
不以 requestedAt 过旧判定操作已结束。

成功状态必须同时满足 `lastAliasRequest.toDeploymentId` 等于本次 inspect 验证并传递的
候选 deployment ID。同一个 SHA 的配置或 maintenance 重建不能复用旧候选的成功记录。
