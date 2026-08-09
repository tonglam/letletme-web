# Responsive / Cache / 首屏 Performance — 实施完成报告

**日期：** 2026-08-06  
**分支：** `web-adjustments`  
**范围：** 全站路由（`app/[locale]/**`、GraphQL proxy、公共 RSC 读、数据表、Live Tournament）

---

## 1. 结论

| 维度 | 实施前 | 实施后 | 说明 |
|------|--------|--------|------|
| Responsive | B+ | **A-** | loading 骨架、筛选折叠、触控高度、表列优先级、创建 sticky |
| Cache 安全 | 9/10 | **9/10** | 会话路径仍强制 no-store |
| Cache 性能 | 5.5/10 | **8/10** | 统一 policy + tags + 公开 proxy SWR |
| 首屏感知 | 6–8 | **8.5/10** | 全路由 loading + 字体减负 + 首页 market 缓存 |
| 重页 runtime | B | **B+** | 榜单分页渲染 + compare 动态加载 |

**未做（有意延后）：** 全局 `cacheComponents: true` / PPR（会牵动全部 `force-dynamic` 与 cookies 边界，需单独迁移 PR）；next-intl 按路由拆 messages（需 layout 重组）。

---

## 2. 已落地改动清单

### 2.1 首屏 / Loading（Phase 1）

| 项 | 实现 |
|----|------|
| 共享骨架 | `components/feedback/RouteLoadingSkeleton.tsx`（`dashboard` / `list` / `stats` / `form`） |
| 路由 loading | `live/*`、`stats/*`、`data/*`、`tournament/*`、`profile`、`sessions`、`auth/login`、`onboarding/bind-entry` |
| PageLoading | 复用 RouteLoadingSkeleton（client + i18n） |
| 字体减负 | Barlow `400/600/700`；Condensed `600/700`；Mono `500` only |

### 2.2 Responsive（Phase 2）

| 项 | 实现 |
|----|------|
| 高级筛选折叠 | `MobileCollapsibleFilters`：`<md` 默认收起，`md+` 常显；**单树挂载**不丢状态 |
| 筛选触控 | Ownership / TeamExposure / SearchHeader：`min-h-10` 全宽移动端 |
| Create 提交 | sticky 底部操作栏 + `min-h-11` |
| Stats 宽表 | `StatsTableColumn.priority`；`secondary` → `hidden md:table-cell` |
| Team history | 次要列（transfers/value/bank…）标 secondary |
| Tournament stats standings | OR / value secondary |
| StatsTable | sticky 表头 + overscroll-x |

### 2.3 Cache（Phase 3）

| 项 | 实现 |
|----|------|
| 统一策略 | `lib/cache-policy.ts`：`CacheTag`、`RevalidateSeconds`、`publicFetchOptions`、公开 operation allowlist |
| RSC 公开读 | events、home fixtures/insights、market teaser、price-changes、TOTW、transfers、gameweek overview — 带 **tags + revalidate** |
| GraphQL proxy | 无 session、无 Authorization、allowlist operation、HTTP 200 → `public, s-maxage=60, stale-while-revalidate=300`；否则 `no-store` |
| 辅助 | `lib/graphql-proxy-cache.ts` + `test/graphql-proxy-cache.test.ts`（4 cases） |
| 文档 | `Claude.md` GraphQL 缓存描述与实现对齐 |

**公开 allowlist（摘要）：**  
`GetCurrentAndNextEvents`、`GetEventStatsById`、`GetEventOverallResult`、`GetEventFixtures`、`GetMarketPulse`、`GetTopTransfersIn/Out`、`GetLiveScores`、picker/detail/value-history 等公开读。  
**绝不进 list：** entry/tournament 管理/live points 等用户数据。

### 2.4 Runtime（Phase 4 部分）

| 项 | 实现 |
|----|------|
| Tournament 大榜 | 首屏 80 行，步进 60「再显示」；排序/筛选重置窗口 |
| EntryCompareSheet | `next/dynamic` + `ssr: false`，仅打开对比时加载 |
| reduced-motion | 既有 `globals.css` 全局削弱动画（骨架 pulse 自动受限） |

---

## 3. 目标架构（实施后）

```
HTML documents
  public  → max-age=0, must-revalidate, no-transform
  private → private, no-store

RSC public GraphQL (executePublicServerQuery)
  → force-cache + revalidate(60|300|3600) + cache tags

RSC private GraphQL (executeServerQuery)
  → no-store + user context headers

Browser /api/graphql
  → allowlisted public, anonymous → CDN SWR 60/300
  → else no-store

Client live polling
  → no-store + requestId cancel + in-flight dedup
```

---

## 4. 页面矩阵（更新）

| 页面 | loading | 缓存 | 响应式备注 |
|------|---------|------|------------|
| `/` | streaming Suspense | events/fixtures/market/TOTW/transfers tagged | 已较优 |
| `/stats/gameweek` | stats skeleton | overview revalidate 300 + tags | tile 体系 |
| `/data/price-changes` | list skeleton | market 60s + tags | 卡片为主 |
| `/data/selections` | stats skeleton | private no-store | 列表行非宽表 |
| `/data/player-stats` | stats skeleton | client detail | picker 网格 |
| `/live/*` | dashboard/list | no-store live | 筛选折叠 |
| `/stats/team|tournament` | stats | private | 表列 priority |
| `/tournament/*` | list/form/dashboard | private | create sticky |
| Auth / profile / bind | form | private | — |

---

## 5. 验证

- `npx tsc --noEmit` — pass  
- `npx tsx --test test/graphql-proxy-cache.test.ts` — 4/4 pass  
- ESLint（关键改动文件）— 先前 pass  

建议线上再确认：

1. Web Vitals p75：`/`、`/live/tournament`、`/stats/gameweek`  
2. CDN 命中：匿名 `GetMarketPulse` 是否带 SWR（注意 POST 缓存需边缘规则支持）  
3. 登录用户任意 GraphQL 响应仍为 `no-store`

---

## 6. 刻意未做 / 后续 PR

1. **`cacheComponents: true` + `'use cache'`** — Next 16 PPR 全量切换，需独立迁移与回归。  
2. **i18n messages 分包** — root layout 全量 `getMessages()` 仍在；需 route group + 分 Provider。  
3. **真虚拟列表（windowing）** — 当前为「窗口 + 再加载」；N>500 可再上 `@tanstack/react-virtual`。  
4. **UI mock 拆除** — stats 等 mock 开关仍为 true（产品侧另批）。

---

## 7. 关键文件索引

```
lib/cache-policy.ts
lib/graphql-proxy-cache.ts
lib/events.ts
app/api/graphql/route.ts
components/feedback/RouteLoadingSkeleton.tsx
components/feedback/PageLoading.tsx
components/tournament/MobileCollapsibleFilters.tsx
components/tournament/TournamentTable.tsx
components/data/StatsTable.tsx
components/home/{MarketTeaser,GameweekStatsSection,TeamOfTheWeekSection}.tsx
app/[locale]/**/loading.tsx  (多路由)
docs/performance-responsive-cache-review.md  (本报告)
test/graphql-proxy-cache.test.ts
```

---

## 8. 评分卡（收尾）

| 区域 | 分数 |
|------|------|
| 响应式基础与导航 | **9/10** |
| 响应式数据密度 | **8.5/10** |
| 缓存安全 | **9/10** |
| 缓存性能（公开读） | **8/10** |
| 首页首屏 | **8.5/10** |
| 私有页首屏感知 | **8/10** |
| 运行时与可观测 | **8.5/10** |

**一句话：** 报告中可安全落地的项已全部实现；PPR / i18n 分包留给专项迁移，避免一次 PR 过度膨胀。
