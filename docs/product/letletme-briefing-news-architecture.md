# LetLetMe Briefing → 新闻（News）— 详细产品与跨仓设计

- **状态：** News 次级菜单的产品与实现权威设计
- **记录日期：** 2026-08-18
- **上位设计：** [LetLetMe Briefing — 全链路架构与落地计划](letletme-briefing-content-architecture.md)
- **范围：** News 的来源名单、X/Grok 获取、证据规则、事件聚类、编辑、Data、PostgreSQL、Redis、GraphQL、Web、后台、缓存、纠错、成本与验收
- **不改变的全局边界：** 无个性化、无用户关注/订阅、无 LetLetMe 主动选人推荐、不购买 X API、全站同一 active revision、`en`/`zh-CN` 同 Story 集合与顺序

本文只细化 `Briefing → 新闻`。通用 Source、Evidence、Story、Publication 和未来通知合同以上位设计为准；本文冲突时，News 专属语义以本文为准，通用基础设施仍以上位设计为准。

| 组件 | News 中承担什么 | 明确不承担什么 |
| --- | --- | --- |
| Grok + versioned skill | 对 Data 提供的名单和窗口执行真实 X 搜索，返回可校验 receipt/candidate hints | 不直连数据库、不维护隐藏名单、不发布 |
| Data | 获取、证据、聚类、编辑状态、Story、edition、PostgreSQL/Redis publication 的唯一写入者 | 不向用户提供随请求变化的个性化结果 |
| GraphQL | 校验并读取一个固定 publication revision，提供 bounded public contract 和同 revision fallback | 不抓 X、不运行 LLM、不从原始表现场拼内容 |
| Web | 展示公共 News/Story，承载受保护编辑后台并经 server route 调 Data commands | 不直连内容数据库、不持有 Grok/source secrets、不重新排名 |

## 1. 产品结论

### 1.1 新闻页解决什么问题

新闻页回答：

> 俱乐部和球员最近真正发生了什么？这件事现在发展到哪一步？

它不是 X 时间线，不是链接聚合器，也不是按发帖数量制造出的“热度榜”。公开单位是现实世界中的一个事件，例如：

- 某球员与某俱乐部的转会进展；
- 某球员的一次伤停或复出过程；
- 某俱乐部确认换帅、续约、处罚或赛程变化；
- 某位具名记者发布了一条可明确归因的重要报道。

一个事件只对应一个 canonical Story。新的转载、补充、否认和官方确认都回到这个 Story；只有事件身份确实不同才创建新 Story。

### 1.2 News 与另外三个菜单的边界

| 内容 | canonical Story | News surface | Week surface | Views surface | Features surface |
| --- | --- | --- | --- | --- | --- |
| 转会报价、谈判、体检、官宣 | `NEWS` | 是 | 仅当影响本轮判断时可引用 | 否 | 深度背景稿可另建 Feature |
| 多场伤停、复出、停赛 | `NEWS` | 是 | 当前轮相关时引用同一 Story | 否 | 否 |
| 例行赛前发布会一句话、训练照、单轮首发消息 | `NEWS` | 只有具备更持久意义时 | 主要归属 Week | 否 | 否 |
| KOL 认为某球员值得买、卖或担任队长 | `OPINION` | 否 | 当前轮相关时可引用 | 是 | 否 |
| 战术长文、球队分析、播客或视频重组摘要 | `FEATURE` | 否 | 值得本周阅读时可引用 | 只有其中的具名判断才是 View | 是 |
| LetLetMe 的 FPL 数据榜单 | 非 Briefing Story | 否 | 否 | 否 | 否；保留在 Explore |

关键规则：

1. `Story kind` 与 `surface inclusion` 分开。一个 `NEWS` Story 可以同时出现在 News 和 Week，但不会复制 Story、证据或详情页。
2. News 只陈述事实、被报道的事实以及仍然未知的部分；LetLetMe 不把报道改写成自己的判断。
3. 赛前噪音默认只进 Week。只有伤停、停赛、俱乐部决策等在单轮之外仍有意义的事件才进入 News。
4. 文章如果只是报道一个新事实，该事实可进入 News；文章的分析、解释和论证进入 Features。

### 1.3 V1 公共分类

内部采用足够精确的 taxonomy，公共 UI 先保持简单。

| 内部 `newsKind` | 含义 | 初始公共筛选 |
| --- | --- | --- |
| `TRANSFER` | 转会、租借、续约、离队、报价、谈判、体检、官宣 | 转会 |
| `AVAILABILITY` | 伤病、缺席、复出、停赛、可出场状态 | 阵容与伤停 |
| `TEAM_NEWS` | 训练、名单、阵容、具有持续价值的赛前球队消息 | 阵容与伤停 |
| `CLUB` | 俱乐部公告、治理、所有权、纪律及其他重要变化 | 俱乐部动态 |
| `MANAGER_AND_STAFF` | 主帅、教练和关键工作人员变动 | 俱乐部动态 |
| `FIXTURE_AND_DISCIPLINE` | 赛程调整、延期、处罚、停赛决定 | 俱乐部动态 |

首发筛选为：`全部`、`转会`、`阵容与伤停`、`俱乐部动态`，另提供一个无状态的俱乐部筛选器。筛选只是当前请求参数，不保存为用户偏好，也不改变其他用户看到的 active revision。

### 1.4 公开页面不是无限流

News 是一个不断换版的全站统一 rolling edition：

- Data 明确决定每一版包含哪些 Story 及顺序；Web 不按用户点击重新排名。
- 一个 Story 在同一版最多出现一次，即使它命中多个类别、俱乐部或展示区域。
- 只有 material update 才能把 Story 推回靠前位置；转载、点赞增加和同稿改写不算更新。
- V1 使用有界集合和 cursor，不做无限滚动诱导停留。
- Story 离开 News 活跃窗口后，canonical detail 仍然可通过稳定 URL 读取。

## 2. 证据与公开措辞

### 2.1 证据等级与生命周期必须分离

`evidenceClass` 表示“现在用什么性质的证据支持这段公开表述”；`lifecycleState` 表示“现实事件发展到哪一步”。两者不能混成一个可信度分数。

初始公开 `evidenceClass`：

| 值 | 条件 | 公共措辞 |
| --- | --- | --- |
| `OFFICIAL` | 俱乐部、联赛、赛事、球员本人或其他明确首方 receipt 直接确认 | “俱乐部已确认……” |
| `ATTRIBUTED_REPORT` | 找到具名原始记者/出版方的真实 receipt，报道内容可准确归因 | “记者 X 报道……” |
| `UNVERIFIED_RUMOUR` | 只有匿名、聚合或无法追到原始来源的说法 | V1 仅后台可见，不公开 |

规则：

1. `OFFICIAL` 只描述来源身份，不表示这条声明永不变化。
2. 一名具名原始记者的一手报道可以公开为 `ATTRIBUTED_REPORT`，不强求“两家来源”后才发布；但不能写成 LetLetMe 已确认的事实。
3. 同一记者、同一编辑部、同一 syndication 或同一聚合链属于同一个 `reportingFamily`，不能伪装成独立 corroboration。
4. 聚合账号和转帖可以触发 origin tracing，但不能单独建立公开 Story。
5. 粉丝量、蓝标、互动数、模型信心和内部 `sourceTier` 都不能作为公开可信度分数。
6. 矛盾 receipt 与支持 receipt 保留在同一 Story，不为了“看起来一致”而删除反方材料。

### 2.2 生命周期

News 专属 `lifecycleState`：

| 值 | 语义 |
| --- | --- |
| `DEVELOPING` | 事件仍在发展，已有可归因的新信息，但结果未确定 |
| `CONFIRMED` | 决定性结果已被适当的首方证据确认 |
| `DENIED` | 关键主张被具名首方明确否认；不等于历史报道从未存在 |
| `CLOSED` | 事件已过时、窗口关闭或不再继续，但既不适合写成 confirmed 也不适合写成 denied |

`CORRECTED` 不属于生命周期。更正通过 `story_changes`、`hasCorrection` 和新的 Story revision 表达；被更正后的事件仍可能处于 `DEVELOPING` 或 `CONFIRMED`。

### 2.3 转会阶段

`TRANSFER` Story 可以携带结构化 `reportedStage`：

```text
INTEREST
→ BID
→ TALKS
→ PERSONAL_TERMS
→ AGREEMENT
→ MEDICAL
→ CONFIRMED
```

另有 `DENIED`，但它不是默认终点。阶段只在 receipt 明确支持时更新；不能根据措辞强弱、记者等级或互动量推断概率。不同路径可以跳级、回退或并行，公开时间线保留实际变化而不伪造线性过程。

### 2.4 可出场状态

`AVAILABILITY` Story 的结构化 `availabilityStatus`：

- `DOUBT`
- `RULED_OUT`
- `AVAILABLE`
- `RETURNED`
- `SUSPENDED`
- `UNKNOWN`

只有真实来源明确说出的状态才能进入结构化字段。预计复出时间保留为有归因的文本和 source item 引用；LetLetMe 不根据症状猜诊断，也不把 “hopeful” 自动换算成日期。

### 2.5 最小公开写法

每次 Story revision 至少包含：

1. **标题：** 只写当前被支持的事实或“谁报道了什么”。
2. **摘要：** 1–2 句说明发生了什么、由谁说、仍不确定什么。
3. **最近重要更新：** 如果不是首次发布，明确说明相较上一版改变了什么。
4. **来源：** 具名身份、原发布时间和原始链接。
5. **时间：** 分开显示来源发布时间、LetLetMe 首次发布时间和最近 material update 时间。

可以增加一句客观的“与本轮有关之处”，但不能写“因此应该买入/卖出/首发/担任队长”。

## 3. X/Grok 获取：名单驱动，不购买 X API

### 3.1 复用同一个生产 skill

News 不新建第二个 X skill。继续使用上位设计中的：

```text
.grok/skills/monitor-fpl-x-sources/
```

新增版本化的 `profile: "news"`，由 Data 在输入中指定。Skill 仍有 `poll`、`enrich`、`compose` 三种模式，运行时来源名单仍来自 PostgreSQL source snapshot，不写死在 skill。

News profile 只增加：

- News taxonomy 与 materiality 规则；
- transfer/availability 的 claim hints；
- origin、same-report、contradiction 的输出要求；
- News source group 的 query patterns；
- News 专属 fixture 和失败案例。

它不获得数据库连接、不修改来源名单、不发布 Story，也不自行调用 `transfer-radar` 或 `whathappened`。旧 skill 只作为设计素材，新合同必须自包含且固定 SHA。

### 3.2 News 来源组

| 组 | 例子 | 主要价值 | 可否单独建立公开证据 |
| --- | --- | --- | --- |
| `NEWS_OFFICIAL` | 俱乐部、联赛、赛事、官方球队账号 | 官宣、名单、伤停、赛程、纪律 | 可以，`OFFICIAL` |
| `NEWS_BEAT` | 跟队记者、当地可信记者 | 训练、伤停、俱乐部动态 | 可以，必须具名归因 |
| `NEWS_TRANSFER` | 有原创转会报道的记者/媒体 | 转会阶段变化 | 可以，必须找到原始 receipt |
| `NEWS_TEAM` | 阵容、可用性和训练专门来源 | 球队与出场状态 | 可以，按 policy 归因 |
| `NEWS_AGGREGATOR` | 汇总、转帖、翻译账号 | 发现线索、找 origin、观察传播 | 不可以单独建立 Story |

一个来源可以属于多个组，但一个 run 的 source snapshot 必须去重。编辑维护 `reportingFamily`，不能只靠 handle 文本判断独立性。

### 3.3 Poll 输入扩展

News run 在通用输入合同上增加 profile 和目的：

```json
{
  "schemaVersion": 1,
  "runId": "uuid",
  "mode": "poll",
  "profile": "news",
  "windowStart": "2026-08-18T08:00:00.000Z",
  "windowEnd": "2026-08-18T08:30:00.000Z",
  "sourceSnapshot": {
    "revision": 43,
    "groupId": "news-transfer-a",
    "sources": []
  },
  "newsContext": {
    "transferWindowOpen": true,
    "activeSeasonCode": "2026"
  },
  "callBudget": {
    "maxXCalls": 2
  }
}
```

`newsContext` 只帮助选择已配置的 policy，不允许 skill 根据模型记忆判断转会窗日期。转会窗、赛程和 deadline 都由 Data 的权威配置传入。

### 3.4 Routine poll

每次 routine poll：

1. Data 按 source group、query length 和 call budget 做确定性 partition。
2. 每个 partition 运行 `Latest` handle query，例如 `(from:a OR from:b ...) since:YYYY-MM-DD`。
3. X 日期过滤只作为粗筛；Data 使用返回的真实 `postedAt` 再按精确 UTC window 过滤。
4. Data 校验 tool trace、post ID、URL、handle、时间和来源 snapshot。
5. `(source_id, external_id)` 幂等写入 receipt，重叠窗口不会重复建内容。
6. 确定性规则先剔除纯 repost、广告、比赛闲聊和已知重复。
7. LLM 只给出 candidate/claim hints；Data 再按 root relation、reporting family、实体和时间形成候选。
8. 只有达到 material gate 的候选进入 enrich。

Routine poll 不运行 Top 搜索、不逐帖展开 thread、不对所有内容做 semantic search。达到 X 结果上限的 partition 标记 `PARTIAL/SATURATED` 并缩小重跑；不能将它计为完整 coverage。

### 3.5 Enrich

Enrich 只回答一个已知 candidate 的缺口：

- 原始报道是谁、哪条 receipt 最早直接陈述主张；
- 是否有官方确认或否认；
- 是否存在真正独立的 corroboration；
- quote/reply/thread 是否改变原文含义；
- 是否与现有 Story 相同；
- 是否出现会改变公开表述的矛盾。

默认最多 4 次 X tool call。无法找到 origin 时，candidate 留在后台，不因“很多账号都在说”而公开。

### 3.6 Compose

Compose 不调用 X。输入只能是 Data 已验证的 claim、receipt、实体、rights projection 和上一版公开文案；输出必须引用传入 ID。

News compose 需要同时产出：

- `en` 与 `zh-CN` 的标题和摘要草稿；
- 相对上一版的 material change 摘要；
- 仍未知事项；
- 建议 evidence class、lifecycle、expiry；
- 每句话对应的 claim/source item ID。

编辑必须确认事实、归因、双语语义和边界后才能 publish。模型不能创建新 claim、猜转会费、猜复出日期或把记者报道写成官方确认。

### 3.7 初始 cadence 与优先级

所有值存 `content.poll_policies`，以下只是上线初值：

| 来源组 | 普通期 | 临近比赛/deadline | 特殊条件 |
| --- | ---: | ---: | --- |
| 官方俱乐部/联赛 | 15 分钟 | 5–10 分钟 | 官宣高发期可临时加速 |
| 跟队/球队消息 | 20–30 分钟 | 10 分钟 | 只为有值守窗口加速 |
| 转会记者 | 转会窗内 20–30 分钟；窗外 60 分钟 | 重大候选 enrich，不全组加速 | 转会窗由 Data 配置 |
| 聚合账号 | 60 分钟 | 30 分钟 | 只做线索，不抢占首方采集 |

当 Week 进入 `FINAL_90`：

1. Week 的官方、伤停和首发任务优先；
2. News 的官方和 availability 任务保留；
3. News 普通 transfer 与 aggregator poll 可延后合并；
4. Grok worker 初始全局 concurrency 仍为 1。

调度延迟恢复后只执行一个受 backfill cap 限制的 catch-up window，不补跑一串已经失去时效的 cron。

### 3.8 成本控制

- 多个 handle 合并一次 Latest query；不要一账号一 Grok session。
- receipt 去重和确定性过滤先于 LLM enrich。
- 聚合线索只有能追到 origin 才继续花调用。
- 同一 candidate 的并发 enrich 使用唯一 job key，合并为一个 in-flight job。
- Story 已有相同 claim/source hash 时不 compose。
- 记录 `X calls → receipts → material candidates → published changes` 的漏斗，按实际采用率调 cadence。
- 不按“发帖多”分配更多预算；按官方覆盖、编辑采用率、漏报复盘和时效 SLA 调整。

### 3.9 X 帖子链接文章、播客或视频

- 如果 X 帖子本身明确陈述了主张，该帖子可以作为这句归因报道的 receipt；链接内容只是补充 context。
- 如果帖子只有“我的最新报道”之类 teaser，而关键事实只存在于文章中，不能从标题或模型记忆补全；必须另建 `WEB` source item，并按该来源的 rights policy 获取。
- Paywall 默认 `LINK_ONLY/METADATA`。私人订阅可在受限 Data 环境中作为编辑背景，但凭据不出生产 secret，公开内容必须是政策允许的变换性摘要、具名归因和原链接。
- 播客/视频只有在候选已通过 material gate 且节目确实首发关键事实时才产生选择性转写成本；否则节目摘要属于 Features，不由 News 全量转写。
- 文章、字幕或转写中的文字同样是不可信输入；compose 只能引用已经验证并持久化的 claim/source item ID。

## 4. 事件聚类与重要更新

### 4.1 聚类不是按文字相似度决定

LLM 可以提议 cluster，最终键由 Data 的稳定实体、事件角色和时间边界辅助决定。

| News kind | 默认事件身份 |
| --- | --- |
| `TRANSFER` | player + from club（可空）+ to club + season/window + move type |
| `AVAILABILITY` | player + club + absence episode |
| `TEAM_NEWS` | club + event/period + subject |
| `MANAGER_AND_STAFF` | club + person/role + appointment/departure episode |
| `FIXTURE_AND_DISCIPLINE` | competition + fixture/decision + subject |
| `CLUB` | club + named subject + bounded episode |

规则：

- 同一球员被报道去不同目的地，默认是不同 transfer Story；不能合成一个“转会传闻大包”。
- 同一目的地从兴趣到报价、谈判、体检和官宣，是同一个 Story。
- 球员已经复出后发生新的伤病，是新的 availability episode 和新 Story。
- 不确定身份时必须进入人工 review；同名球员不能自动合并。
- 错合并可 split，错拆分可 merge；操作记录原候选和操作者，不重写 receipt 历史。

### 4.2 什么算 material update

以下至少一种成立才创建 `STORY_MATERIALLY_UPDATED`：

- 官方确认、否认、撤回或纠正；
- transfer 的明确阶段变化；
- 球员 availability 状态发生明确变化；
- 新来源给出会改变公开标题/摘要的关键事实；
- 事件主体、俱乐部、时间、费用或处罚等关键字段被纠正；
- 现实事件达成结论或被关闭。

以下不算 material：

- 同一原稿的转载、翻译、截图或聚合改写；
- 同一 reporting family 的重复发布；
- 点赞、转发或浏览数增加；
- 只增加情绪、形容词或未被证据支持的概率；
- 没有改变公开表述的 thread 补充。

非 material receipt 仍可保存为审计/关系数据，但不生成新 Story revision、不触发 News reorder，也不产生未来通知事件。

### 4.3 公开时间线

Story detail 的时间线只展示 material changes：

```text
首次具名报道
→ 报价/状态发生变化
→ 官方确认或否认
→ 后续纠正（如有）
```

每一项固定引用对应 Story revision 和公开 source projection。它不是原帖清单；用户不需要阅读十条相同转帖才能理解一件事。

## 5. Data：具体落地

### 5.1 Data 是唯一写入者

News 的以下工作全部属于 `letletme_data`：

- source/group/policy/checkpoint 管理；
- Grok job 调度、真实 tool trace 验证和 receipt 持久化；
- origin/same-report/contradiction 关系；
- candidate 聚类、merge/split 和 materiality gate；
- News typed claims、Story/version/change；
- rolling News edition 编译、双语一致性和 publication activation；
- PostgreSQL 权威 payload、Redis payload/pointer 和 repair；
- 编辑后台所需的 internal command/query API。

GraphQL 不调用 Grok、不运行 LLM、不从原始表现场拼新闻；Web 不直连 Data DB。

### 5.2 在通用 schema 上增加 News typed extension

上位设计已经定义 `content.sources`、`source_items`、`candidate_clusters`、`stories`、`story_claims`、`story_versions`、`editions` 和 `publications`。News 不复制这些表，只增加强类型扩展。

#### `content.news_story_profiles`

一条 `NEWS` Story 恰好一条 profile：

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| `story_id` | PK + FK `content.stories` | 一对一扩展 |
| `story_kind` | constant `NEWS` | 与 Story 做 `(story_id, story_kind) → (id, kind)` composite FK |
| `news_kind` | constrained text/enum | 六种内部 News 类型 |
| `lifecycle_state` | constrained text/enum | `DEVELOPING/CONFIRMED/DENIED/CLOSED` |
| `evidence_class` | constrained text/enum | 当前公开证据性质 |
| `first_reported_at` | `timestamptz` | 最早可验证的重要 receipt 时间 |
| `latest_material_at` | `timestamptz` | 最近 material change 时间 |
| `closed_at` | nullable `timestamptz` | 关闭时间 |
| `surface_eligible` | boolean | 是否具备进入 News surface 的持久价值 |
| `review_priority` | constrained internal enum | 后台队列优先级，不公开 |

PostgreSQL `CHECK` 不能跨表验证 `stories.kind`。因此 migration 在 `content.stories` 建立 `(id, kind)` unique key，profile 用 constant `story_kind = NEWS` 的 composite FK；不能只依赖应用层判断。表内 constraint 另保证 `closed_at` 与 lifecycle 一致。`review_priority` 不能进入 GraphQL 公共 payload。

#### `content.transfer_claims`

它是 `content.story_claims` 的一对一 typed extension：

| 字段 | 用途 |
| --- | --- |
| `claim_id` | PK + FK；必须属于 `TRANSFER` Story |
| `claim_kind` | constant `TRANSFER`；与通用 claim 做 composite FK |
| `player_identity_id` | 稳定球员 identity，不用当季 element ID |
| `from_club_identity_id` | 可空；真实来源未说明时不猜 |
| `to_club_identity_id` | 目的俱乐部；未知目的地的泛离队消息可空 |
| `move_type` | `PERMANENT/LOAN/LOAN_RETURN/CONTRACT/UNKNOWN` |
| `reported_stage` | 明确的转会阶段 |
| `fee_text` | 可空的归因文本，不做货币推算 |
| `fee_source_item_id` | `fee_text` 非空时必填 |

通用 `story_claims` 同样提供 `(id, claim_kind)` unique key，typed extension 以 constant kind 的 composite FK 强制类型。若最终通用 claim taxonomy 不保留 `claim_kind`，则必须用数据库 constraint trigger 实现等价约束，不能只写在 TypeScript。结构化值变更不原地覆盖；创建新的 claim/version，并由 `story_changes` 记录被替代关系。

#### `content.availability_claims`

| 字段 | 用途 |
| --- | --- |
| `claim_id` | PK + FK；必须属于 `AVAILABILITY` Story |
| `claim_kind` | constant `AVAILABILITY`；与通用 claim 做 composite FK |
| `player_identity_id` | 稳定球员 identity |
| `club_identity_id` | 当时所属俱乐部 |
| `season_code/event_id` | 可空；只有明确绑定单轮时填写 |
| `availability_status` | 六种状态之一 |
| `expected_return_text` | 可空；保留有归因的自然语言范围 |
| `status_source_item_id` | 支持状态的 receipt |
| `expected_return_source_item_id` | 有返回时间文本时必填 |

不要增加未经来源支持的 `expected_return_date` 或医学诊断字段。

### 5.3 不新增“News 更新表”

Material update、correction、removal 和 close 继续使用通用 `content.story_changes`。News 用版本化 `change_kind`：

- `INITIAL_REPORT`
- `CLAIM_ADVANCED`
- `OFFICIAL_CONFIRMATION`
- `OFFICIAL_DENIAL`
- `AVAILABILITY_CHANGED`
- `KEY_FACT_CORRECTED`
- `STORY_CLOSED`

它们驱动 Story publication、News surface 重编译和 outbox。避免再造一套与通用纠错链路竞争的更新历史。

### 5.4 Data 服务模块

建议按现有 feature/role 命名落地：

```text
src/services/content/news-candidate.service.ts
src/services/content/news-story.service.ts
src/services/content/news-edition.service.ts
src/services/content/content-acquisition.service.ts
src/services/content/content-publication.service.ts
src/repositories/content/news-story.repository.ts
src/repositories/content/content-publication.repository.ts
src/jobs/content-x-poll.job.ts
src/jobs/content-candidate-enrich.job.ts
src/jobs/content-publication-repair.job.ts
src/api/internal/content-admin.api.ts
```

目录可以结合仓库真实结构微调，但职责不能合并进 Web 或 GraphQL。所有 command 带 `commandId/idempotencyKey`，重复点击 publish、merge 或 correction 不产生重复 revision。

### 5.5 后台 command

Data internal API 至少提供：

- `reviewNewsCandidate`
- `mergeCandidateIntoStory`
- `splitCandidateCluster`
- `createNewsStory`
- `appendNewsMaterialUpdate`
- `setNewsLifecycle`
- `correctStory`
- `closeStory`
- `publishStoryRevision`
- `compileAndActivateNewsEdition`
- `removeStoryProjection`

每个 command 校验操作者、当前 aggregate revision 和合法状态转换。使用 optimistic version guard，防止两名编辑从旧页面互相覆盖。

### 5.6 Edition inclusion

News edition 编译器只选择：

1. `stories.kind = NEWS`；
2. active Story publication 完整且 `en/zh-CN` 同 version group；
3. `surface_eligible = true`；
4. rights/source 状态允许公开；
5. lifecycle 尚在发展，或最近 material update 位于活跃窗口；
6. 未被编辑明确排除。

V1 默认窗口建议：

- 所有 `DEVELOPING` Story；
- 最近 14 天 material update 的 `CONFIRMED/DENIED/CLOSED` Story；
- hard cap 200 个 Story；
- 第一页 20 个，后续页仍通过同一 revision cursor 获取。

hard cap 到达时按明确的 edition sort order 截断并告警，不让 Redis payload 无界增长。窗口和 cap 存数据库配置，运行 2–4 周后按真实密度调整。

### 5.7 排序

Data 产生唯一、稳定的 `sort_order`，推荐初始确定性输入：

1. 编辑 placement：`LEAD` 优先；
2. lifecycle 和 public materiality，而不是来源粉丝量；
3. `latest_material_at DESC`；
4. `story_id` 作为稳定 tie-breaker。

最终排序随 publication 固化。GraphQL 和 Web 不重新打分；不同筛选只在同一 ordered collection 上做稳定过滤。

## 6. Publication 与缓存

### 6.1 Rolling edition 仍是不可变 revision

`SURFACE:news` 永远只有一个 active publication。每次 material change、纠正、撤稿、rights 变化或编辑调整，都编译一个完整的新 revision，然后原子切换。

它不是“每天新建一个新闻页”，也不是逐卡 Redis mutation：

```text
PostgreSQL active News publication
  → immutable ordered en payload
  → immutable ordered zh-CN payload
  → Redis stage + checksum read-back
  → PostgreSQL activate/retire + active/servable metadata + outbox
  → GraphQL PostgreSQL metadata guard
  → Redis active pointer CAS
```

一次 revision 必须固定所有 Story ID、Story revision、顺序、分类和两个 locale。任何一项不一致都不能激活。

### 6.2 V1 Redis key

News 初始保持单个有界 collection payload，避免过早引入 page shard：

```text
llm:content:briefing:news:active
llm:content:briefing:news:<revision>:en
llm:content:briefing:news:<revision>:zh-CN
```

单个 payload 存完整有界 card collection、available filters 和 manifest 元数据。GraphQL pin revision 后在该 immutable payload 上执行筛选和 cursor slice。

只有监控证明 payload 超过约定 byte/latency 阈值后，才在不改变 GraphQL schema 的前提下升级为 manifest + page shards；V1 不为理论规模先承担 shard 一致性和 fallback 复杂度。

### 6.3 TTL 与旧 cursor

- active pointer 不设依赖性 TTL；PostgreSQL 是永久权威。
- active immutable payload 不过期。
- retired revision 保留 Redis TTL，初始建议 15 分钟；PostgreSQL compiled payload 保留期由内容/rights policy 决定。
- cursor 包含 `publicationRevision + offset + filterHash + locale + issuedAt` 并签名。
- 后续页必须读取 cursor 指定 revision，绝不能把旧第一页与新第二页混合。
- cursor 最大年龄初始为 15 分钟；超过年龄、revision 不可读或 filter/locale 不匹配时返回 `RESTART_REQUIRED`，Web 从新版第一页重新开始。

### 6.4 Web/GraphQL 短缓存

- GraphQL 每次先读取 PostgreSQL active/servable metadata，再接受完全匹配的 Redis payload。
- Web GraphQL proxy、RSC 和 browser 对 News 初始 `no-store`；短 TTL 不能代替撤稿/撤权失效。
- 签名 outbox → Web revalidation webhook 通过 correction/removal/rights revoke E2E 后，才可用 flag
  开启 READY 30–60 秒 tagged RSC cache；具体值以 publication 时效监控调整。
- `UNAVAILABLE` 不缓存；`EMPTY` 和 `STALE` 即使未来启用 cache 也使用更短且不同的 TTL。
- correction/removal 必须先使受影响旧 payload fail closed，再重编译；不能继续从 PostgreSQL fallback 泄漏旧正文。

## 7. GraphQL 公共合同

### 7.1 Query

News 有明确入口，但底层复用未来 Views/Features 的 bounded collection loader 和 connection 类型：

```graphql
query BriefingNews(
  $locale: BriefingLocale!
  $filter: BriefingNewsFilter
  $first: Int = 20
  $after: String
) {
  briefingNews(
    locale: $locale
    filter: $filter
    first: $first
    after: $after
  ) {
    state
    revision
    publicationId
    publishedAt
    sourceCheckedAt
    staleAt
    availableFilters {
      categories { value label count }
      clubs { id name count }
    }
    lead { ...BriefingNewsCard }
    edges {
      cursor
      node { ...BriefingNewsCard }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

`first` 设服务端上限，建议最大 50。没有 `userId`、team preference、follow list 或 session 参与参数/排序。

Payload 保存唯一 ordered collection 和可空 `leadStoryId`。无筛选的第一页可以把 lead 单独返回，并从 `edges` 排除；任何带 category/club filter 的请求令 `lead = null`，原 lead 如果匹配则按原始顺序进入 edges。这样筛选不会展示不相关 lead，也不会在同一响应重复 Story。

### 7.2 Filter

```graphql
input BriefingNewsFilter {
  categories: [BriefingNewsCategory!]
  clubId: ID
}

enum BriefingNewsCategory {
  TRANSFERS
  AVAILABILITY_AND_TEAM
  CLUB_UPDATES
}
```

多个筛选组合在同一 publication revision 内执行。`availableFilters.count` 也是该 revision 的静态结果，不能实时查询原始 Story 表造成页面内不一致。

### 7.3 Card 字段

News card 在共享 `BriefingStoryCard` 上增加 News 投影：

- `storyId`、`slug`、`storyRevision`、`kind = NEWS`；
- `newsKind`、`publicCategory`；
- `evidenceClass`、`lifecycleState`、`hasCorrection`；
- locale 对应的 `title`、`dek`、`latestMaterialSummary`；
- 已审核的 player/club identities；
- `firstReportedAt`、`latestMaterialAt`；
- `materialUpdateCount`；
- primary source 和少量公开 supporting source；
- transfer stage 或 availability status（适用时）；
- expiry/closed metadata（适用时）。

不返回 raw X body、全部 receipts、内部 source tier、reporting family、模型信心、编辑优先级、private article/transcript 或 Grok session 信息。

### 7.4 状态

| 状态 | 含义 |
| --- | --- |
| `READY` | active News publication 可一致读取 |
| `EMPTY` | 已有成功采集和编辑确认，但当前 edition 没有可公开 Story |
| `STALE` | active publication 超过 News freshness 门槛，或关键 source groups coverage 落后 |
| `UNAVAILABLE` | Redis 与 PostgreSQL 一致读取均失败，或 payload 无法验证 |
| `RESTART_REQUIRED` | cursor revision 已过期/不可读，客户端必须从 active revision 第一页开始 |

一个筛选结果为空时，顶层 publication 仍是 `READY`，connection edges 为空，并返回 `emptyReason = FILTER_NO_MATCH`；不能误报为整个 News `EMPTY`。

### 7.5 Reader 行为

GraphQL：

1. 首次请求从 PostgreSQL 窄 view 读取 active/servable metadata 并 pin revision；
2. 只接受 publication ID/revision/state/locale manifest 完全匹配的 Redis pointer/payload；
3. 校验 scope、revision、locale、bytes、checksum 和 exact payload shape；
4. Redis 不可用或不匹配时读取 PostgreSQL 同一 active compiled publication；
5. 验证 filter 后进行稳定 slice；
6. 生成绑定 revision/filter/locale 的签名 cursor；
7. detail 继续通过 `briefingStory(slug, locale)` 获取独立 active Story publication。

GraphQL 不从 candidate、claim、receipt 表现场重建 News，不把数据库错误变成 `EMPTY`，也不因登录用户不同返回不同顺序。

## 8. Web 整体布局

### 8.1 路由与导航

```text
/<locale>/briefing/news
/<locale>/briefing/story/<slug>
```

News 使用公共 Briefing shell，顶级 `资讯 / Briefing` 和次级 `新闻 / News` 保持激活。只有 GraphQL 合同和状态 UI 完整后才开放导航链接。

### 8.2 Desktop

保持 12-column editorial grid：

- 顶部：页面标题、最近来源检查时间、最近 material update 时间；
- 主区约 8 列：可选 lead、固定筛选条、按 Data 顺序排列的 rolling Story list；
- 右 rail 约 4 列：俱乐部筛选、证据标签说明和页面 freshness/状态，不建立另一份重复新闻榜；
- 有 lead 时，该 Story 不再出现在主列表或 rail。

Web 只做响应式布局，不根据点击量、本地状态或登录身份改变 Data 的顺序。

### 8.3 Mobile

- Briefing submenu 和 News filters 允许 sticky，但不能占据过多首屏；
- lead、filters、Story list 顺序单列展示；
- 俱乐部筛选进入轻量 sheet；选择只改变 URL/query state，不写 localStorage；
- “加载更多”继续当前 revision；收到 `RESTART_REQUIRED` 时清除旧 cursor，并明确提示新闻已更新后回到第一批。

### 8.4 Card 信息层级

整体只规定必须看懂的层级，不锁定像素：

1. `官方` 或 `X 报道` 标签；
2. 标题与 1–2 句摘要；
3. 关联俱乐部/球员；
4. 来源身份和来源发布时间；
5. LetLetMe 最近重要更新时间；
6. transfer/availability 状态（适用时）；
7. 更正、否认或关闭标识。

“来源发帖时间”和“LetLetMe 更新时间”必须用不同文案，避免把旧报道的编辑更新时间伪装成刚发生的新闻。

### 8.5 Story detail

详情页包含：

- 当前标题、摘要、状态和归因；
- material update 时间线；
- 当前已知/仍未知；
- 经过 rights projection 的来源链接；
- correction/denial 说明；
- canonical locale URL 与 slug alias redirect。

详情页不列出所有转载，不嵌入任意 provider HTML，不把 paywall 内容或完整 X thread 搬运到站内。

### 8.6 显式状态 UI

- `EMPTY`：说明当前没有经编辑确认可公开的新闻，并展示最近完成检查时间。
- `STALE`：保留安全的 active edition，但标明来源检查延迟；超过 rights/freshness 安全线则不展示旧正文。
- `UNAVAILABLE`：服务错误，不写成“没有新闻”。
- `FILTER_NO_MATCH`：保留页面与筛选，提示清除筛选。
- `RESTART_REQUIRED`：提示“新闻已更新”，回到新 revision 第一页。

## 9. 编辑后台与维护

`/admin/briefing/news` 是受保护的 Web 管理页面，浏览器经 Web server route 调 Data internal API。它至少包括：

### 9.1 News Inbox

- candidate 的 concise claim 和 source receipts；
- origin、转载链、reporting family、独立 corroboration 和 contradiction；
- 已存在的相似 Story；
- saturation/coverage gap；
- LLM 提议与 Data 校验不一致的 review flags。

### 9.2 Story editor

- create、merge、split、append update；
- `newsKind/evidenceClass/lifecycleState`；
- typed transfer/availability claim；
- 双语标题、摘要和 material change；
- 来源 projection、rights preview、entity confirmation；
- correction、close、remove；
- 两 locale 和 News/Week surface preview。

### 9.3 Edition builder

- active window 内的 eligible Story；
- lead、sort order 和显式排除；
- Story ID 去重和双语 parity gate；
- publication diff：新增、移除、移动、更新和纠正；
- publish、rollback 和 repair 状态。

所有公开操作必须记录 operator、reason、base revision 和 result revision。浏览器不取得 Grok、私人账号或 Data service credential。

### 9.4 来源维护

News source owner 每周至少处理：

- suggested source 身份与价值；
- handle drift、被盗号、持续失败；
- reporting family 合并/拆分；
- aggregator 是否能持续追到 origin；
- adoption rate、漏报、误报、rights policy 与调用成本。

LLM 不自动启用新来源，不自动提升 source tier，也不因为一个账号爆出一次新闻就永久提高 cadence。

## 10. 可观测性、SLA 与故障

### 10.1 News 指标

获取与编辑：

- source group coverage、checkpoint lag、saturation、连续失败；
- receipt 去重率、origin 找回率、aggregator dead-end rate；
- candidate → enrich → accepted → published 漏斗；
- 首个 receipt 到 inbox、到 Story draft、到 publish 的 p50/p95；
- material update 采用率、错误 merge/split、更正和撤稿率；
- 每个 published update 的 Grok session/X call 成本。

发布与读取：

- News publication age、compile/activate/repair latency；
- payload bytes、Story count、filter count、cursor restart rate；
- Redis hit、PostgreSQL fallback、checksum/shape rejection；
- GraphQL READY/EMPTY/STALE/UNAVAILABLE 分布；
- Web publication revision、Story open、source open 和 filter use。

这些分析事件可以匿名聚合，但不成为个人已读/偏好状态，也不参与排序。

### 10.2 故障行为

| 故障 | 正确行为 |
| --- | --- |
| Grok/X 不可用 | run `FAILED`、checkpoint 不推进；News 根据 freshness 转 `STALE`，不制造 EMPTY |
| 一个 partition 饱和 | `PARTIAL/SATURATED`，缩小分区补扫，不宣称完整 coverage |
| 聚合贴找不到 origin | candidate 留后台或拒绝，不公开 |
| LLM 错聚类 | receipt 不丢；人工 merge/split，不污染已发布 Story |
| 两名编辑并发保存 | version guard 拒绝旧 base revision，要求重新 review diff |
| Story correction | 新 Story revision + 新 News publication；旧不安全正文 fail closed |
| Redis 损坏 | 同 revision PostgreSQL compiled payload fallback + repair |
| cursor revision 过期 | `RESTART_REQUIRED`，不混合新旧页 |
| 一个 locale 缺失 | 整个 revision 不激活，不让两个 locale 展示不同事件集 |
| rights/source emergency disable | 停采、撤出公开投影、重编译受影响 scope、保留最小审计 |

## 11. 分仓实施顺序

### Phase N0 — News 决策与 fixtures

- 确认首批 News 来源、reporting family、rights mode 和 source owner。
- 固化 News taxonomy、evidence/lifecycle/typed claim enum。
- 建立 official、original report、aggregator-only、contradiction、transfer stage、availability 和 saturation fixtures。

### Phase N1 — Data 获取与 Story

- 新 migration：News typed extensions、constraint 和 indexes。
- `monitor-fpl-x-sources profile=news` input/output schema 和 fixtures。
- source group policy、News poll/enrich jobs 和 trace validation。
- candidate signature、origin tracing、merge/split 和 materiality gate。
- Story typed commands、双语 versions 和 correction history。

### Phase N2 — Data publication

- rolling News edition compiler、active window、hard cap 和 deterministic sort。
- `SURFACE:news` PostgreSQL/Redis publication、CAS、repair、rollback。
- revision-bound filter/cursor fixtures 和 outbox dependency recompile。

### Phase N3 — GraphQL

- `briefingNews`、shared connection/card types、filter 和 explicit states。
- exact payload validation、PostgreSQL fallback 和 signed cursor。
- PostgreSQL active metadata guard；Briefing proxy 保持 `no-store`，并证明 cookie/session 不改变结果。

### Phase N4 — Web public + admin

- 开放 News route、Briefing submenu、desktop/mobile editorial layout。
- filters、load more、Story timeline 和五种状态 UI。
- News Inbox、typed Story editor、edition diff/preview/publish。
- `en/zh-CN`、accessibility、external link、canonical/alias 和 cache E2E。

### Phase N5 — 受控上线

- 首周只接 official + 少量具名原创来源，全部人工发布。
- 连续观察 2–4 周 coverage、采用率、时延、更正和 Grok 调用。
- 再逐组开启 beat/transfer/team sources；aggregator 始终只做 discovery。
- 在数据证明有必要前，不开放 rumor、不自动发布、不提高并发、不引入 payload sharding。

## 12. 验收矩阵

### Data

- 相同 source item 在重叠窗口和重复 run 下只保存一次。
- X trace 未真实执行时，即使 JSON 合法也不能产生 candidate。
- aggregator-only candidate 不能进入 READY Story。
- 原始报道加十个转载仍是一个 Story、一个 reporting family 证据。
- 同球员不同目的俱乐部默认形成不同 transfer Story。
- 同目的地从 interest 到 official confirmation 保持同一 Story 并新增 material timeline。
- 球员复出后的新伤病形成新 availability episode。
- fee/return text 没有对应 source item 时 publication gate 失败。
- contradiction、denial 和 correction 更新同一 Story，不静默覆盖历史。
- 非 material repost 不生成 Story revision、不 reorder News。
- News edition 同 Story 唯一、同 revision 两 locale Story/顺序一致。
- Redis stage/CAS/repair/rollback 和 PostgreSQL fallback 可重复验证。

### GraphQL

- 首次页和后续页始终 pin 同一 publication revision。
- 旧 cursor 不可读时返回 `RESTART_REQUIRED`，不混合 revision。
- 同 revision 的 filter count、edges、排序确定且可复现。
- filter 无结果与整个 surface `EMPTY` 可区分。
- Redis corruption 回退的是同一 PostgreSQL compiled payload。
- 不返回 raw receipts、private body、source tier、model confidence 或 review priority。
- 匿名、登录、不同 cookie/session 得到相同 revision、Story 和顺序。

### Web

- News 是顶级 Briefing 下可直接发现的次级菜单。
- Desktop 主列表与 mobile 单列保持 Data 顺序且不重复 Story。
- 官方、具名报道、来源时间、最近重要更新时间和更正状态可区分。
- filters 进入 URL/request state，不写个人偏好或已读状态。
- `EMPTY/STALE/UNAVAILABLE/FILTER_NO_MATCH/RESTART_REQUIRED` 文案互不伪装。
- Story detail 只展示 material timeline，不复制全部转帖或付费内容。
- correction/removal 后浏览器和 CDN 不继续显示旧不安全正文。

### End-to-end

```text
名单中具名来源发布 transfer report
→ Grok Latest query 有真实 trace
→ receipt + origin/reporting family 验证
→ candidate 形成 typed transfer claim
→ 编辑发布双语 Story
→ News edition revision 激活
→ GraphQL/Web 两 locale 同 Story 与顺序
→ 官方随后确认
→ 同一 Story evidence/lifecycle/stage 更新
→ 新 Story + News revision 激活
→ 旧 cursor 保持旧 revision 或明确 RESTART_REQUIRED
→ Web detail 显示 material timeline，不出现重复 Story
```

另需分别跑 denial、correction、rights removal、Redis corruption、filter-empty 和 aggregator-only 路径。

## 13. 明确不做

- X API、开放式全网 trending 或 firehose
- 把每条 X 帖子当成一条 News card
- 聚合账号单独支撑公开 rumor
- 用户关注俱乐部/记者、个性化排序、已读状态或通知投递
- LetLetMe 自己判断转会真假概率或给选人建议
- 根据症状推断伤病、根据模糊措辞猜复出日期
- 绕过 paywall、公开完整付费文章、完整 thread 或 private transcript
- LLM 自动 publish、自动启用来源或自动提升信任等级
- Web/GraphQL 直接抓 X、直接读私有 receipt 表或现场生成摘要
- 无界 Redis feed、按卡片原地 mutation 或跨 revision pagination

## 14. 仍需产品/运营确认

| 问题 | 建议默认值 | 影响 |
| --- | --- | --- |
| **未来是否公开 aggregator-only/unknown rumor？** | V1 不公开；只有找到具名 origin 后才进入 News | 影响 public evidence enum 和审核负担；不阻塞内部采集 |
| **公共筛选是否采用四项：全部、转会、阵容与伤停、俱乐部动态？** | 是；内部保留六类，避免首发 UI 过碎 | 影响 URL/GraphQL enum 和 Web copy |
| **News 活跃窗口与容量？** | 所有 developing + 最近 14 天 closed/confirmed；hard cap 200；20/页 | 影响 payload、cursor retention 和运营密度 |
| **转会阶段是否直接显示在 card？** | 只在 receipt 明确支持时显示，并始终附 attribution；否则只写摘要 | 影响 typed projection 和 UI 标签 |
| **是否允许任何官方来源自动发布？** | V1 不允许；全部人工 publish，积累数周数据后另评估 | 影响时效和误发风险，不阻塞基础设施 |
| **News 编辑值守时间和 publish SLA？** | 先明确有人值守的窗口；候选到 inbox 可自动，公开必须有 owner | 阻塞“实时”运营承诺，不阻塞开发 |
| **短报道和分析文章的边界？** | 新事实进入 News；论证、战术解释和长摘要进入 Features；可互相引用但不复制正文 | 影响编辑手册和 Story kind |
| **首批 source owner 与 reporting family 谁维护？** | 指定一个明确 owner，从少量 official/原创来源开始 | 阻塞真实生产采集 |

在上述问题没有另行决定前，工程可以按建议默认值实现 fixture、schema、publication 和公共合同；真实来源上线与公开运营仍必须先确认 source owner、rights policy 和 publish owner。
