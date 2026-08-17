# LetLetMe Briefing → 观点（Views）— 详细产品与跨仓设计

- **状态：** Views 次级菜单的产品与实现权威设计
- **记录日期：** 2026-08-18
- **上位设计：** [LetLetMe Briefing — 全链路架构与落地计划](letletme-briefing-content-architecture.md)
- **相邻菜单：** [新闻 / News](letletme-briefing-news-architecture.md)
- **范围：** KOL/分析者来源、X/Grok 获取、文章/YouTube/播客证据、归因、时效、Data、PostgreSQL、Redis、GraphQL、Web、后台、转写成本、纠错与验收
- **不改变的全局边界：** 无个性化、无用户关注/订阅、无 LetLetMe 主动推荐、不购买 X API、全站同一 active revision、`en`/`zh-CN` 同 Story 集合与顺序

本文只细化 `Briefing → 观点`。公开单位是某个具名来源在明确时间和适用范围内表达的一组判断，不是 LetLetMe 生成的建议，也不是对 X 舆情做多数表决。

| 组件 | Views 中承担什么 | 明确不承担什么 |
| --- | --- | --- |
| Grok + versioned skill | 从 Data 提供的来源名单与时间窗获取真实 X receipt、原始 thread 和媒体线索 | 不维护隐藏 KOL 名单、不判断谁“最准”、不发布 |
| Media pipeline | 获取许可 metadata/transcript，对被选中的节目做有预算的转写和 speaker review | 不默认转写所有节目、不把完整 transcript 公开 |
| Data | 归因、target/validity、观点 claim/artifact、Story、edition、PostgreSQL/Redis publication 的唯一写入者 | 不产生 LetLetMe 自己的买卖、队长或模板结论 |
| GraphQL | 校验并读取一个固定 publication revision，提供 bounded public contract | 不抓 X/媒体、不运行 LLM、不计算 KOL 共识 |
| Web | 展示“谁、何时、针对什么说了什么”，承载受保护编辑后台 | 不按用户身份重新排名、不直连内容库或持有来源 secret |

## 1. 产品结论

### 1.1 观点页解决什么问题

观点页回答：

> 值得关注的 FPL KOL、记者和分析者现在分别怎么判断？他们的判断适用于哪一轮，依据是什么，后来有没有改变？

Views 的价值不是把更多帖子搬进站内，而是降低用户跨 X、YouTube 和播客追踪具名观点的成本：

- 一眼看到观点属于谁，而不是被 LetLetMe 冒领；
- 明确它针对本轮、未来几轮还是长期策略；
- 同一来源改口时看到变化，不把新旧两版并列成两个人；
- 不被转载、切片和聚合账号重复轰炸；
- 可以回到原帖、原视频时间点或原节目。

### 1.2 Views 不是什么

- 不是 LetLetMe 的选人、转会、队长、chip 或模板推荐；
- 不是“全网都在买谁”的热度榜；
- 不是按粉丝数、互动数或历史命中率给 KOL 排名；
- 不是把十位 KOL 的意见合成一个没有出处的“社区共识”；
- 不是完整复制付费文章、视频或播客；
- 不是用户关注流，所有用户看到同一 active edition 和顺序。

### 1.3 与 Week、News、Features 的边界

| 内容 | canonical Story | 主要 surface | 其他 surface 如何使用 |
| --- | --- | --- | --- |
| KOL 明确买入、卖出、持有、队长、差异化选择 | `OPINION` | Views | 与当前 deadline 相关时 Week 引用同一 Story |
| KOL 发布自己的 squad/template/ranking | `OPINION` | Views | Week 可引用；LetLetMe 计算的 Top 1k 模板仍在 Explore |
| 记者报道球员受伤或转会 | `NEWS` | News | Week 可引用；不能因记者有观点就改成 Opinion |
| 分析者解释战术、长期趋势的完整文章/节目 | `FEATURE` | Features | 其中清晰、具名、可独立理解的判断可建立关联 Opinion Story |
| 赛前 90 分钟临时 captain/pick 更新 | `OPINION` | Week + Views | 仍是同一 Story；Views 到 deadline 后自动退出活跃版 |

`Story kind` 和 `surface inclusion` 分开。同一个 OPINION Story 可以被 Week 引用；不会复制归因、媒体片段或详情页。

### 1.4 一个 Views Story 的身份

一个 Story 表示：

```text
attribution subject
+ bounded topic/decision
+ target scope
+ source publication episode/thread
```

默认规则：

- 不同来源对同一球员的相同建议是不同 Story；绝不合并成一个无主语的观点。
- 同一来源、同一轮、同一主题在 deadline 前改口，是同一个 Story 的 material revision。
- 同一来源每轮重复发布 captain/template，是每个 event 一个新 Story。
- 同一节目中互相冲突的两位主持人是两个具名 claim；无法确认 speaker 时只能归因给节目，不能猜人名。
- 一个 thread、视频或播客中围绕同一决策的一组相关观点可以形成一个 Story；互不相关的十个 picks 不强塞进一条散乱摘要，可用 structured artifact 表达。

### 1.5 V1 内部类型与公共筛选

内部 `opinionKind`：

| 值 | 含义 | 初始公共筛选 |
| --- | --- | --- |
| `PLAYER_PICK` | 值得考虑、差异化、首发/替补判断 | 选人与队长 |
| `CAPTAINCY` | captain/vice-captain 判断 | 选人与队长 |
| `TRANSFER_CALL` | 买入、卖出、持有、回避、观察 | 转会与阵容 |
| `SQUAD_OR_TEMPLATE` | 自己发布的 squad、template、draft | 转会与阵容 |
| `RANKING_OR_SHORTLIST` | 排名、tier、候选清单 | 转会与阵容 |
| `CHIP_STRATEGY` | wildcard、free hit、bench boost、triple captain | 策略 |
| `MULTI_WEEK_STRATEGY` | 多轮规划、滚转、风险与结构 | 策略 |
| `PREDICTION` | 对出场、角色或比赛发展的具名判断 | 选人与队长或策略 |

首发 UI 使用：`全部`、`选人与队长`、`转会与阵容`、`策略`。V1 不提供“只看某 KOL”的持久筛选，也不保存任何来源偏好。

## 2. 归因与公开语义

### 2.1 attribution subject

归因主体可以是：

- `PERSON`：能够从真实 receipt/verified transcript 确认的个人；
- `SHOW`：节目整体表达，但无法可靠区分具体 speaker；
- `PUBLICATION`：文章或编辑部以机构身份表达的观点；
- `ACCOUNT`：多人运营账号且来源政策只允许账号级归因。

公共文案必须使用对应粒度。例如只能证明是节目观点时写“节目 X 认为……”，不能用模型声纹或上下文猜成某位主持人。

### 2.2 attribution class

| 值 | 条件 | 能否公开 |
| --- | --- | --- |
| `DIRECT_POST` | 归因主体自己的原始 X/网页文字直接表达 | 可以 |
| `VERIFIED_MEDIA_SEGMENT` | 官方 caption/transcript 或审核过的转写片段，speaker/节目归因可验证 | 可以 |
| `PUBLISHER_SUMMARY` | 节目/作者自己的 show notes、标题或官方摘要明确表达 | 可以，按 publisher/show 归因 |
| `SECONDARY_QUOTE` | 聚合、剪辑号或第三方转述，未找到 origin | V1 仅后台 |

归因等级说明“我们如何知道该来源表达过这个观点”，不说明观点是否正确。内部 source tier、模型信心、粉丝数和历史预测表现不进入公共 payload。

### 2.3 结构化 action 只记录明确表达

可选 `recommendationAction`：

```text
BUY | SELL | HOLD | AVOID | WATCHLIST
START | BENCH | CAPTAIN | VICE_CAPTAIN
DIFFERENTIAL | NONE
```

约束：

1. 只有来源明确用等价措辞、把球员放进明确角色，或发布可验证 squad 时才设置 action。
2. “我喜欢他的赛程”不能自动映射为 `BUY`；“可能会考虑”不能自动提升为强推荐。
3. `NONE` 表示这是可摘要的判断，但没有明确行动词。
4. 自然语言 title/dek 是公共语义，action 只用于一致展示和筛选，不能替代归因上下文。
5. LetLetMe 不根据 action 数量计算 BUY/SELL 共识或概率。

### 2.4 target scope 与过期

每个公开 Opinion 必须有：

- `EVENT`：明确针对一个 FPL event，`validUntil` 不晚于 deadline；
- `EVENT_RANGE`：针对连续多个 event，带 start/end；
- `DATE_RANGE`：来源给出明确有效期；
- `SEASON`：赛季长期观点；
- `OPEN`：无法合理限定，但必须有编辑复查日。

如果来源没有说目标范围，编辑只能使用保守的最短合理范围，不能用模型扩大为长期建议。过期后 Story detail 仍可访问并显示“已过期/针对 GWx”，但从 active Views edition 移除。

### 2.5 来源改口、更正与删除

- 同一来源在同一 target scope 内改变明确 action，产生 `OPINION_REVISED` 和新 Story revision；旧版本保留在 material timeline。
- 来源只是补充理由而结论不变，可以 material update，但不创建第二张卡。
- 来源纠正被错误引用的文字，走 `STORY_CORRECTED`，不是普通 revision。
- 来源明确撤回观点，状态变 `WITHDRAWN`；不能继续把旧结论显示为 active。
- X/媒体删除只能 best effort 检测。重要 Story 在 correction、expiry、举报或来源政策要求时复核；rights 收紧时 fail closed。

## 3. X/Grok 获取

### 3.1 复用统一 skill

继续使用：

```text
.grok/skills/monitor-fpl-x-sources/
```

新增 `profile: "views"`，仍复用 `poll/enrich/compose`。运行时名单由 Data source snapshot 提供；skill 只保留稳定 taxonomy、query pattern、output schema 和 fixtures。

Views profile 不调用 News profile，也不串行调用旧 `whathappened`。它借鉴 Latest-first、thread enrichment 和中立重组，但不做舆论阵营比例、开放式趋势发现或“最热门 KOL”。

### 3.2 来源组

| 组 | 内容 | Routine 用途 |
| --- | --- | --- |
| `VIEWS_FPL_KOL` | 具名 FPL creator/analyst | 原始 picks、captain、transfer、chip、template |
| `VIEWS_ANALYST` | 足球/FPL 数据与战术分析者 | 有明确决策含义的具名判断 |
| `VIEWS_SHOWS` | 播客、YouTube、节目账号 | 新节目 metadata、show notes、时间点线索 |
| `VIEWS_PUBLICATIONS` | 专栏、newsletter、媒体账号 | 文章入口和作者观点 |
| `VIEWS_AGGREGATOR` | 剪辑、翻译、汇总账号 | 只发现 origin，不建立公开 attribution |

来源继续保存平台身份；`content.attribution_subject_sources` 负责把 X、YouTube、播客等 source 映射到同一 person/show/publication/account。Speaker aliases、主要语言和 media rights policy 都是可审计的关系/政策数据，不塞进 skill 隐藏配置。

### 3.3 Poll 输入

```json
{
  "schemaVersion": 1,
  "runId": "uuid",
  "mode": "poll",
  "profile": "views",
  "windowStart": "2026-08-18T08:00:00.000Z",
  "windowEnd": "2026-08-18T09:00:00.000Z",
  "sourceSnapshot": {
    "revision": 44,
    "groupId": "views-kol-a",
    "sources": []
  },
  "targetEvent": {
    "seasonCode": "2026",
    "eventId": 1,
    "deadlineTime": "2026-08-21T17:30:00.000Z"
  },
  "callBudget": { "maxXCalls": 2 }
}
```

Data 传入 event/deadline；skill 不根据模型记忆判断当前轮。X query 仍按 handle partition + Latest 执行，最终按真实 `postedAt` 精确过滤并验证 tool trace。

### 3.4 Poll material gate

Routine poll 优先识别：

- 第一人称明确判断或公开 squad/list；
- 来源自己链接的新文章/节目及明确 teaser；
- 同一来源对已发布 Opinion 的更新、撤回或改口；
- thread 中会改变主帖含义的上下文；
- aggregator 指向的潜在 origin。

以下默认不进 enrich：闲聊、赛后情绪、纯新闻转发、没有立场的链接、抽奖/广告、旧内容回顾、相同观点的重复宣传、只有互动数变化的帖子。

### 3.5 Enrich

Enrich 只为已知候选补齐：

- origin post/thread、作者与归因主体；
- 被 quote 的原始上下文；
- linked article/show/video 的 canonical identity；
- 是否针对当前 event、未来几轮或长期；
- 是否修订了同一来源的既有 Story；
- media 中可能需要转写的 segment/章节；
- 第三方剪辑是否准确、是否能回到 original。

默认最多 4 次 X tool call。找不到 origin 的 `SECONDARY_QUOTE` 留后台，不因转发量高而公开。

### 3.6 Compose

Compose 不调用 X 或媒体 provider。输入只有经 Data 验证的 receipt、claim、artifact、target、attribution 和 rights projection，并要求句子级 source/segment ID。

输出包括：

- `en/zh-CN` 具名标题与摘要；
- target scope、validity 与明确 action 候选；
- “该来源后来改变了什么”的 revision summary；
- 仍需人工确认的 speaker、球员映射、隐含 action 或 media rights；
- 不带 LetLetMe 建议的 Week relevance 描述。

模型不能把多位来源合成统一建议，不能用 source tier 改写语气，不能把隐含倾向升级为 buy/sell/captain。

### 3.7 Cadence 与成本优先级

值全部存 `content.poll_policies`：

| 来源组 | NORMAL | APPROACHING | FINAL_90 |
| --- | ---: | ---: | ---: |
| FPL KOL | 60 分钟 | 15 分钟 | 5–10 分钟 |
| 分析者/出版方 | 60–120 分钟 | 30–60 分钟 | 30 分钟 |
| 播客/YouTube 发布账号 | 2 小时 | 30–60 分钟 | 30 分钟 |
| 聚合/剪辑 | 2 小时 | 60 分钟 | 30 分钟；最低优先级 |

FINAL_90 的队列优先级仍是 Week 官方/伤停/首发高于 Views。只有存在编辑值守时才开启 Views 高频 poll；无人能 publish 时不为“实时”空耗订阅额度。

成本规则：

- 多 handle 合并 Latest query；先 receipt 去重，再 enrich；
- 同一 thread/节目只建一个 media identity 和 content hash；
- 只有被编辑选中的候选才 compose 或转写；
- 记录每个来源的 calls、candidate、采用、publish 和 correction 漏斗，但不公开为 KOL 排名；
- Grok 初始全局 concurrency 仍为 1，Week jobs 可以抢占普通 Views poll。

## 4. 文章、YouTube 与播客

### 4.1 媒体处理漏斗

```text
X/RSS/channel metadata
→ 是否有明确 material teaser
→ 是否进入编辑候选
→ 官方 transcript/caption 是否可用且允许使用
→ 是否值得支付选择性转写成本
→ speaker/segment 人工确认
→ 具名 Opinion claim/artifact
→ 变换性摘要 + 原链接/时间点
```

节目发布不等于必须转写。没有进入候选的节目只保存 metadata；未设置预算和 rights policy 时不自动下载或转写。

### 4.2 获取优先级

1. 公开 X 帖子或 show notes 已明确表达观点：直接用该 receipt，媒体只作原链接。
2. 官方 transcript/caption：验证 media ID、语言、时间轴和 policy 后使用。
3. 来源提供的 RSS transcript/章节：按 canonical media identity 去重。
4. 后台 ASR：仅在编辑批准、预算允许且来源 policy 支持时运行。
5. 私人订阅内容：只在受限 Data 环境作背景研究；默认 `LINK_ONLY/METADATA`，不复制完整内容。

### 4.3 转写、speaker 与时间点

- media 以 provider ID + content hash 去重，重复引用不重复付费转写。
- 保存 provider/model/language/minutes/cost/transcript version/retention/policy revision。
- Speaker diarization 只生成 candidate label；映射到真实 person identity 必须由官方 transcript、节目 metadata 或编辑确认。
- 公开来源链接优先带 start time；公开摘要引用经过核验的 segment，不返回完整 transcript。
- 同一 segment 可以支持多个结构化 claim，但每个 claim 必须保留 segment ID。
- 音频被替换或 transcript 版本变化时不覆盖旧审计版本；受影响 Story 进入 review。

### 4.4 费用闸门

转写 job 创建前计算预计分钟数和成本，并校验：

- source/media policy 允许；
- candidate 已通过 material gate；
- 当前月/日预算仍有余额；
- 同 content hash 没有可复用 transcript；
- 有明确的 editor/request reason；
- 长节目超过单任务上限时先使用章节/时间点缩小范围，或再次审批。

预算耗尽返回 `DEFERRED_BUDGET`，不是失败，也不能让模型根据标题补完节目内容。

## 5. Data：具体落地

### 5.1 通用表继续复用

Views 复用上位设计的：

- sources、source aliases/groups/policies/checkpoints；
- acquisition runs/partitions/source items/X posts/bodies/relations；
- candidates、stories、claims、sources、versions、entities、changes；
- editions/items/publications/payloads/dependencies/outbox。

不建立独立 KOL 数据库、文件名单或 Web-side media cache。跨平台同一人物/节目使用稳定 content identity，平台 source item 仍保留原始 provenance。

### 5.2 attribution identity

Views 需要一个独立于平台账号的稳定归因身份：

| Relation | 职责 |
| --- | --- |
| `content.attribution_subjects` | person/show/publication/account 的稳定 ID、类型、canonical display identity、状态 |
| `content.attribution_subject_aliases` | 历史名字、speaker label、handle/display alias；不覆盖旧 attribution |
| `content.attribution_subject_sources` | subject 与 platform source 的多对多映射、角色、valid time、verification state |

一个 creator 的 X、YouTube 和播客 guest appearance 可以映射到同一 person；一个多人 show 仍有自己的 show subject。映射由编辑验证并保留历史，LLM 只提 candidate。删除/合并 subject 必须重编译依赖 publication，不能仅修改展示名。

### 5.3 `content.opinion_story_profiles`

一条 `OPINION` Story 恰好一条 profile：

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| `story_id` | PK | 一对一扩展 |
| `story_kind` | constant `OPINION` | `(story_id, story_kind) → stories(id, kind)` composite FK |
| `opinion_kind` | constrained enum | 八种内部类型 |
| `attribution_subject_type` | constrained enum | person/show/publication/account |
| `attribution_subject_id` | FK 到稳定 content identity | 不直接用 display name |
| `attribution_class` | constrained enum | 直接帖子、验证片段等 |
| `target_scope` | constrained enum | event/range/date/season/open |
| `target_season_code` | nullable | event/season scope 必填 |
| `target_event_start_id/end_id` | nullable | event/range scope 约束 |
| `target_deadline_at` | nullable `timestamptz` | EVENT 用对应 deadline，RANGE 用 end event deadline |
| `valid_from/valid_until` | `timestamptz` | 公共有效期 |
| `review_at` | nullable `timestamptz` | open scope 必填 |
| `opinion_state` | constrained enum | `ACTIVE/EXPIRED/WITHDRAWN/CLOSED` |
| `first_expressed_at` | `timestamptz` | 真实来源时间 |
| `latest_revised_at` | nullable | 来源最近改口时间 |
| `surface_eligible` | boolean | 是否进入 Views surface |

PostgreSQL 使用与 News 相同的 constant-kind composite FK，不能只靠 TypeScript 保证 Story kind。Data 在创建 target 时从权威 FPL event 写入 deadline snapshot；检查约束保证 target 字段组合、`valid_until > valid_from`、EVENT/RANGE 的 `valid_until <= target_deadline_at`、OPEN 必有 `review_at`。Event identity 仍用真实 FK/season+event contract，deadline snapshot 不是新的赛程权威。

### 5.4 `content.opinion_claims`

`story_claims` 的 typed extension：

| 字段 | 用途 |
| --- | --- |
| `claim_id` | PK |
| `claim_kind` | constant `OPINION`，composite FK 到 `(story_claims.id, claim_kind)` |
| `subject_type` | `PLAYER/CLUB/FIXTURE/CHIP/STRATEGY/TOPIC` |
| 对应 subject identity | exactly-one 约束；球员/俱乐部使用稳定 identity |
| `recommendation_action` | 可空；只记录明确表达 |
| `stance` | `POSITIVE/NEGATIVE/NEUTRAL/MIXED`；不能代替自然语言 |
| `explicitness` | `EXPLICIT/EDITORIAL_SUMMARY` |
| `source_item_id` | 支持 claim 的 receipt |
| `source_item_segment_id` | media claim 必填 |
| `supersedes_claim_id` | 来源改口时指向上一 claim |

同一 action 改变时追加 claim，不原地覆盖。数据库约束保证 source item/segment 属于 Story 可使用的来源投影。

### 5.5 `content.opinion_artifacts` 与 items

一个 Views Story 可带一个或多个结构化 artifact，避免把 template/ranking 塞进无类型 JSON：

| Relation | 关键字段与约束 |
| --- | --- |
| `content.opinion_artifacts` | `artifact_id`、`story_id`、`story_version_id`、`artifact_kind`、target、source item/segment、rights projection |
| `content.opinion_artifact_items` | artifact FK、subject identity、ordinal、action、squad role、captain role、tier label、claim FK |

`artifact_kind` 初始为：

- `PLAYER_LIST`
- `RANKING`
- `SQUAD_TEMPLATE`
- `CHIP_PLAN`

约束：

- ordinal 在 artifact 内唯一；
- item exactly-one subject；
- captain/vice 只能用于 player item；
- `SQUAD_TEMPLATE` 只有 policy 允许 `STRUCTURED_SQUAD` 时公开完整结构；否则 publication 只投影摘要和原链接；
- 如果公开完整 FPL squad，compiler 校验人数、位置/slot 唯一和 captain/vice；源未提供的价格、预算、formation 不能补算；
- KOL 声称的 “Top 1k template” 保留 source/basis 文案；不得与 LetLetMe 自己的数据结果混合。

### 5.6 `content.source_item_segments`

这是 Views 与 Features 共用的 generic media relation：

| 字段 | 用途 |
| --- | --- |
| `segment_id` | 稳定 ID |
| `source_item_id/body_id` | 绑定具体 immutable media/transcript body row |
| `start_ms/end_ms` | 有时间轴时必填且合法 |
| `speaker_label` | 原始 transcript/diarization label |
| `speaker_identity_id` | 可空；人工/官方验证后填写 |
| `verification_state` | `UNVERIFIED/EDITOR_VERIFIED/OFFICIAL` |
| `text_hash` | 审计与去重；原文是否保留取决于 rights policy |
| `retained_until/policy_revision` | retention 与权利 |

GraphQL 永远不直接读取 private segment text；publication compiler 只输出允许的摘要、短 excerpt、时间点和 source URL。

### 5.7 material change

Views 使用通用 `story_changes`：

- `OPINION_FIRST_EXPRESSED`
- `OPINION_REVISED`
- `ACTION_CHANGED`
- `TARGET_CHANGED`
- `ARTIFACT_UPDATED`
- `ATTRIBUTION_CORRECTED`
- `OPINION_WITHDRAWN`
- `OPINION_EXPIRED`

同一观点的重复宣传、转载和互动量变化不产生 Story revision 或 reorder。

### 5.8 Data service 与 commands

建议模块：

```text
src/services/content/views-candidate.service.ts
src/services/content/opinion-story.service.ts
src/services/content/views-edition.service.ts
src/services/content/media-transcription.service.ts
src/repositories/content/opinion-story.repository.ts
src/repositories/content/media-segment.repository.ts
src/jobs/content-media-transcribe.job.ts
src/jobs/content-views-expiry.job.ts
```

Internal commands 至少包括：

- `reviewViewsCandidate`
- `requestMediaTranscription`
- `verifyMediaSegmentSpeaker`
- `createOpinionStory`
- `appendOpinionRevision`
- `replaceOpinionArtifact`
- `correctOpinionAttribution`
- `withdrawOpinion`
- `expireOpinion`
- `publishStoryRevision`
- `compileAndActivateViewsEdition`

所有 command 带 idempotency key、operator、reason 和 optimistic base revision。转写批准与公开 publish 是两个权限，不因 editor 支付了转写成本就自动公开。

## 6. Views edition 与缓存

### 6.1 inclusion

`SURFACE:views` 是全站唯一 rolling publication。编译器只选择：

1. active `OPINION` Story publication；
2. attribution 可公开且有直接 receipt/verified segment/publisher summary；
3. target/validity 未过期；
4. rights policy 允许当前投影；
5. `surface_eligible = true`；
6. `en/zh-CN` 同 version group、同 Story 集合与顺序。

V1 建议：

- 当前 event 的有效 Opinion 全部可选；
- EVENT_RANGE/DATE_RANGE/SEASON/OPEN 按 `validUntil/reviewAt`；
- hard cap 120 个 Story；
- 20 个/页；
- 默认每个 attribution subject 最多 3 张 active card，publisher 可显式 override；这只是版面多样性，不是来源质量排名。

超过 deadline 的 EVENT Story 在下一次 expiry job 中退出 surface；详情页保留 target 和 expired 标签。不能把 GW1 的 pick 用 GW2 标题继续展示。

### 6.2 排序与“不同观点”

Data 固化唯一 sort order：

1. 编辑 placement；
2. target relevance（当前 event 优先）；
3. latest material expression/revision time；
4. story ID tie-breaker。

可以用 edition section 把不同来源对同一 topic 的 Story 放在相邻位置，Web 显示“不同观点”；但必须逐条保留归因。V1 不计算投票、百分比、赢家、综合分或“X/10 KOL 推荐”。

### 6.3 Redis 与 cursor

Views 采用与 News 相同的有界 immutable collection：

```text
llm:content:briefing:views:active
llm:content:briefing:views:<revision>:en
llm:content:briefing:views:<revision>:zh-CN
```

- active pointer/payload 不依赖 TTL；retired revision 初始保留 15 分钟；
- cursor 绑定 publication revision、offset、filter hash、locale、issuedAt 并签名；
- max cursor age 初始 15 分钟；不可读时 `RESTART_REQUIRED`；
- PostgreSQL 保存同一 compiled publication，Redis 损坏时严格同 revision fallback；
- active payload 超过真实 byte/latency threshold 后才考虑 page shards，不提前增加一致性复杂度。

## 7. GraphQL 公共合同

### 7.1 Query

```graphql
query BriefingViews(
  $locale: BriefingLocale!
  $filter: BriefingViewsFilter
  $first: Int = 20
  $after: String
) {
  briefingViews(
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
    targetEvent { seasonCode eventId name deadlineTime }
    availableFilters { categories { value label count } }
    lead { ...BriefingOpinionCard }
    edges { cursor node { ...BriefingOpinionCard } }
    pageInfo { hasNextPage endCursor }
  }
}
```

`first` 最大 50。无筛选第一页可返回 payload 指定 lead 并从 edges 排除；带 filter 时 `lead = null`，原 lead 如匹配按固定顺序进入 edges，避免重复或不相关 lead。

### 7.2 Filter

```graphql
input BriefingViewsFilter {
  categories: [BriefingViewsCategory!]
  target: BriefingViewsTarget
}

enum BriefingViewsCategory {
  PICKS_AND_CAPTAINCY
  TRANSFERS_AND_SQUADS
  STRATEGY
}
```

V1 不暴露 `sourceId` 持久筛选，不接用户 follow list。所有 count 都由同 publication revision 预编译，不实时查询 Story 表。

### 7.3 Card/detail 字段

公共 Opinion card：

- story ID/slug/revision、opinion kind/category；
- attribution subject 的稳定 ID、display name、avatar/logo policy projection；
- attribution class、source platform/type、原链接和原发布时间；
- locale title/dek、latest revision summary；
- target scope/event、validUntil、expired/revised/withdrawn/corrected 标识；
- typed claims：subject、明确 action、stance；
- 受 policy 允许的 artifact preview；
- media URL + start time（适用时）；
- related player/club identities。

Detail 通过共享 `briefingStory` 返回完整 material timeline、当前 active claim/artifact、被替代 action、来源与时间点。它不返回 private transcript、raw media、全部 receipts、speaker model score、source tier、历史命中率或编辑评分。

### 7.4 状态

| 状态 | 含义 |
| --- | --- |
| `READY` | active Views publication 可一致读取 |
| `EMPTY` | 成功采集/编辑后确认没有有效可公开观点 |
| `STALE` | 关键 Views source group 或 publication 超过 freshness 门槛 |
| `OFFSEASON` | 当前没有适用 FPL target，且 edition policy 不展示长期观点 |
| `UNAVAILABLE` | Redis/PostgreSQL 一致读取均失败 |
| `RESTART_REQUIRED` | cursor revision 不可继续 |

Filter 无匹配仍是 `READY + FILTER_NO_MATCH`，不是整个 Views EMPTY。数据库/转写/Grok 失败不能伪装成“没人发表观点”。

## 8. Web 整体布局

### 8.1 路由

```text
/<locale>/briefing/views
/<locale>/briefing/story/<slug>
```

Views 复用 Briefing shell；只有 read contract、target/expiry 和状态 UI 完整后才开放次级导航。

### 8.2 Desktop

12-column editorial grid：

- 顶部：`观点 / Views`、当前 target、deadline、最近来源检查；
- 左侧约 8 列：可选具名 lead、三类 filters、固定顺序的 Opinion cards/sections；
- 右 rail 约 4 列：target/有效期解释、归因标签说明、当前 edition 中的具名 voices 索引；
- voices 索引不按准确率/粉丝数排名，也不复制 Story card；
- “不同观点”模块并排展示各自 attribution，不生成 LetLetMe 结论。

### 8.3 Mobile

- submenu 和 category filter 可 sticky；target/deadline 保持可见但不过度占首屏；
- lead、sections、cards 单列并保持 Data 顺序；
- artifact preview 可折叠，默认先显示来源、action、target 和摘要；
- load more 必须继续同 revision；`RESTART_REQUIRED` 时提示观点列表已更新并回到新版首页；
- 不用 localStorage 记录已读、喜欢、关注或来源偏好。

### 8.4 Card 信息层级

卡片第一眼必须先看到“谁的观点”，再看到观点内容：

1. 人/节目/出版方 + 平台/内容形式；
2. 明确的 target（如 GW3、GW3–5、赛季）；
3. title/dek；
4. 明确 action 与 player/chip（有证据时）；
5. 来源发布时间和 LetLetMe 最近 revision 时间；
6. 原链接或 media timecode；
7. revised/expired/withdrawn/corrected 标签。

“某 KOL 推荐 X”和“LetLetMe 推荐 X”在视觉和语言上不能混淆。卡片 CTA 使用“查看原观点/查看详情”，不用“立即买入”。

### 8.5 Squad/list artifact

- Rights 允许时可显示紧凑、结构化的 squad/list，而不是截图复制；
- 明确写“Source X published this squad/template”；
- 显示 source target/captured time，过 deadline 后标 expired；
- 不用当前 FPL price/availability 回填旧模板；若需要显示新状态，作为独立 News/Week link，而不是篡改原 artifact；
- policy 只允许 summary/link 时不展示完整 15 人结构。

### 8.6 状态 UI

- `EMPTY`：当前 target 没有经编辑确认可公开观点，显示完成检查时间。
- `STALE`：明确来源抓取/发布延迟；不能把旧轮建议伪装成当前轮。
- `OFFSEASON`：展示产品说明或有效长期观点，取决于 edition policy。
- `UNAVAILABLE`：服务故障，不显示“没有 KOL 发言”。
- `FILTER_NO_MATCH`：保留 filter 并允许清除。
- withdrawn/rights-revoked Story 使用安全 tombstone，不继续显示旧 action/artifact。

## 9. 编辑后台与日常运营

`/admin/briefing/views` 经 Web server route 调 Data internal API。

### 9.1 Views Inbox

- 原帖/thread、origin 和第三方转载链；
- attribution subject/person/show candidate；
- target、action、player/chip mapping candidate；
- linked article/video/podcast metadata；
- 可复用 transcript、预计转写分钟和费用；
- source 是否改口、是否与既有 Story 相同；
- injection、rights、speaker 和 entity review flags。

### 9.2 Media review

- 批准/拒绝转写及理由；
- transcript version、segment、start/end、speaker label；
- person/show attribution verification；
- 允许公开的 excerpt/summary/timecode preview；
- cost、policy、retention 和删除动作。

### 9.3 Opinion editor

- Story kind/opinion kind/category；
- attribution/target/validity/state；
- typed claims、explicit action 和 supersedes；
- artifact items、order、captain/vice/squad role；
- 双语文案和句子级 source/segment；
- Week/Views inclusion、expiry、correction、withdrawal；
- 两 locale、desktop/mobile、rights preview。

### 9.4 Edition builder

- eligible Opinion、source cap、多样性与显式 override；
- lead、section、sort order；
- 相同 Story 去重和 target mismatch gate；
- publication diff：新增、移除、改口、过期、artifact 变化；
- publish/rollback/repair。

所有变更记录 operator、base revision、reason 和 result revision。Web 浏览器不持有 Grok token、私人订阅、media provider secret 或 Data service credential。

## 10. 可观测性与故障

### 10.1 指标

获取：

- source group coverage/checkpoint lag/saturation/failure；
- original vs secondary-only 比例、thread origin rate；
- poll → candidate → enrich → accepted → published；
- 当前 event 高价值来源覆盖与 deadline 前时延。

媒体：

- metadata candidates、transcription approval/reuse/deferral/failure；
- minutes、provider/model、cost、language、speaker review time；
- transcript → published adoption rate；
- 每个 published media Opinion 的平均成本。

编辑/发布：

- attribution correction、wrong speaker、wrong entity、action correction；
- opinion revision/withdrawal/expiry lag；
- edition Story/source count、payload bytes、compile/activate/repair；
- Redis hit/fallback/corruption、GraphQL state、cursor restart。

产品：

- Views page/section/card open、artifact expand、source open、media start；
- Week → Opinion detail 和 Views → source 的聚合转化；
- 按 publication revision/placement 记录，不建立个人 profile 或用于个性化排序。

### 10.2 故障行为

| 故障 | 正确行为 |
| --- | --- |
| Grok/X 失败 | checkpoint 不推进，Views 进入 STALE，不制造 EMPTY |
| Secondary quote 找不到 origin | candidate 留后台，不公开 |
| Caption/transcript 缺失 | 保留 metadata；未转写不补写观点 |
| 预算不足 | `DEFERRED_BUDGET`，不算 FAILED、不自动缩成幻觉摘要 |
| Speaker 不确定 | 按 show/publication 归因或不公开，不猜 person |
| 同来源改口 | 同 Story 新 revision + superseded claim；不显示两张互相矛盾 active card |
| target 已过 deadline | expiry job 重编译 Views/Week，详情显示 expired |
| rights/source disable | fail closed、撤出 artifact/body、保留安全 tombstone和审计 |
| Redis payload 损坏 | PostgreSQL 同 revision fallback + repair |
| locale/Story 顺序不一致 | 整个 publication 不激活 |

## 11. 分仓实施顺序

### Phase V0 — Taxonomy、来源与 policy

- 确认首批 KOL/节目/出版方、跨平台 identity、rights/retention、source owner。
- 固化 opinion kind、attribution、target、action、artifact enum。
- 建立 direct post、thread、change-of-mind、template、ranking、unknown speaker、secondary-only fixtures。

### Phase V1 — Data X pipeline

- `profile=views` schema/query/trace validation。
- source groups、deadline cadence、candidate/materiality/origin matching。
- Opinion profile/claim/artifact migration、repositories、state transitions。
- expiry/withdrawal/correction、双语 Story publication。

### Phase V2 — Media pipeline

- canonical media identity、metadata 和 official transcript adapter。
- source item segments、speaker verification、content hash reuse。
- budget ledger、transcription queue、retention/deletion 和 failure states。
- 只用 fixture 验证时也不得跳过 rights/cost gate。

### Phase V3 — Views publication + GraphQL

- rolling edition、source cap、target expiry、immutable payload/pointer。
- `briefingViews`、filters、artifact projection、explicit states、signed cursor。
- Redis/PostgreSQL same-revision fallback 和 public cache allowlist。

### Phase V4 — Web public + admin

- Views route、layout、card/artifact、different-views grouping 和状态 UI。
- Views Inbox、media review、Opinion editor、edition diff/preview/publish。
- `en/zh-CN` parity、a11y、canonical links、timecode、cache E2E。

### Phase V5 — 受控上线

- 首批只接少量 X-first KOL，全部人工 publish；
- 媒体先 metadata/official transcript，后台 ASR 有明确小预算；
- 观察 2–4 周采用率、deadline 时延、改口/纠错和转写 ROI；
- 数据证明价值后再扩大来源、artifact richness 和 media budget；不自动构建 KOL 排名或共识。

## 12. 验收矩阵

### Data

- 同一 X post/thread 重复 run 不重复建 source item/Story。
- 第三方剪辑/聚合找不到 origin 不能 READY。
- 不同 KOL 对同一球员的相同 action 保持不同 Story 和 attribution。
- 同 KOL 同 event 从 BUY 改为 HOLD 是同 Story 新 claim/revision，旧 claim 被 supersede。
- 同 KOL 下一 event 的 captain 是新 Story。
- target EVENT 的 validUntil 不晚于 deadline；过期退出 active edition。
- action 只有明确 receipt/segment 支持时可设置。
- unknown speaker 不能映射到 person；show-level attribution 可单独审核。
- transcript content hash 复用；预算不足不创建 ASR 调用。
- squad artifact 权利不足时 compiler 只输出 summary/link。
- Top 1k template 保留来源 basis，不与 Explore 计算结果混合。
- 两 locale 同 revision Story/artifact identity 和顺序一致。

### GraphQL

- Cookie/session/user 不改变 revision、Story、section 或 order。
- target/filter count/edge 全部来自同 publication revision。
- 无筛选 lead 不在 edges 重复；筛选时 lead 规则稳定。
- cursor 不跨 revision；过期返回 RESTART_REQUIRED。
- filter 无匹配与 surface EMPTY 区分。
- 不暴露 transcript、raw body、speaker score、source tier、历史命中率或编辑权重。
- Redis corruption 严格回退同一 PostgreSQL compiled payload。

### Web

- attribution subject 比观点正文更先被用户识别。
- target、deadline/validity、source time、LetLetMe revision time 不混淆。
- 所有 buy/sell/captain/template 语言明确属于来源，不属于 LetLetMe。
- different-views 并列不生成综合推荐或百分比。
- artifact 按 rights projection 展示，过期后不以当前数据回填。
- mobile/desktop 保持 Data 顺序，无个人状态/localStorage。
- EMPTY/STALE/OFFSEASON/UNAVAILABLE/FILTER_NO_MATCH/RESTART_REQUIRED 可区分。
- withdrawal/correction/rights revoke 后旧 action/artifact 不从 CDN 继续显示。

### End-to-end

```text
名单中的 KOL 发出当前 event captain thread
→ Grok Latest 有真实 tool trace
→ origin/thread/author/target 验证
→ typed CAPTAIN claim + 双语 Opinion Story
→ Views 与 Week 引用同 Story revision
→ Redis/PostgreSQL/GraphQL/Web 一致
→ KOL deadline 前改口
→ 同 Story 新 claim supersede 旧 claim
→ 新 Story publication + Views/Week revision
→ Web 显示 revised timeline，不出现两张 active card
→ deadline 到达后自动退出 active surfaces，detail 标 expired
```

另需分别验收 unknown speaker、media budget exhausted、secondary-only、squad rights downgrade、Redis corruption 和 source withdrawal。

## 13. 明确不做

- LetLetMe 自己的买卖、队长、chip、squad 或 template 推荐
- KOL 准确率排行榜、粉丝榜、互动热榜或付费 placement 混入编辑排序
- 多来源无归因合成、投票百分比或“社区共识”
- 用户关注 KOL、个人 feed、已读/喜欢状态或通知投递
- 开放式全 X discovery 或购买 X API
- 对所有 YouTube/播客自动全量转写
- 用标题、thumbnail、剪辑或模型记忆补完未获取的观点
- 猜 speaker、猜 action 强度、猜 target horizon
- 绕过 paywall 或公开完整文章、视频、音频、thread、caption/transcript
- Web/GraphQL 直接抓来源、运行 LLM/ASR 或读取 private media body
- 跨 publication revision pagination 或无界 feed

## 14. 仍需产品/运营确认

| 问题 | 建议默认值 | 影响 |
| --- | --- | --- |
| **公共筛选是否采用全部、选人与队长、转会与阵容、策略？** | 是；内部八类，公共先三类 | 影响 GraphQL enum、URL 和 Web copy |
| **Views V1 是否只做 FPL 决策观点？** | 是；纯俱乐部/战术论证进入 Features | 影响来源名单和 News/Features 边界 |
| **完整 15 人 squad/template 是否可以结构化展示？** | 仅 source policy 明确允许 `STRUCTURED_SQUAD`；否则摘要 + link | 影响 artifact compiler 与权利审核 |
| **是否需要每个来源的 active card cap？** | 初始 3 张/target，可由 publisher override | 影响 edition 多样性，不影响 Story 可读性 |
| **是否做“观点差异”模块？** | 可以并列具名 Story；不做投票、百分比或合成结论 | 影响 edition sections 与 Web layout |
| **转写 provider、单任务/每日/月度预算？** | 先 official transcript；后台 ASR 使用小额 hard cap，超额 DEFERRED | 阻塞付费转写，不阻塞 X-first Views |
| **Speaker verification 谁负责？** | content editor 可标 show-level；person-level 必须由明确证据并可复核 | 影响播客/多人视频发布 SLA |
| **来源改口是否保留公开历史？** | 保留 material timeline，并把旧 action 标 superseded | 影响 detail copy；建议默认实施 |
| **首批 KOL/show source owner 与 publish owner？** | 从少量高价值、公开 X-first 来源开始，明确一名 owner | 阻塞真实生产上线 |

在没有另行决定前，工程可以按建议默认值实现 schema、fixtures、X-first publication 和 Web 合同；付费转写与真实公开运营仍需先确认 rights、budget、source owner 和 publisher。
