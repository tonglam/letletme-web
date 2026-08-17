# LetLetMe Briefing → 深度（Features）— 详细产品与跨仓设计

- **状态：** Features 次级菜单的产品与实现权威设计
- **记录日期：** 2026-08-18
- **上位设计：** [LetLetMe Briefing — 全链路架构与落地计划](letletme-briefing-content-architecture.md)
- **相邻菜单：** [新闻 / News](letletme-briefing-news-architecture.md)、[观点 / Views](letletme-briefing-views-architecture.md)
- **范围：** 文章、paywall、私人访问背景、RSS、X/Grok 发现、YouTube/播客、选择性转写、变换性摘要、Data、PostgreSQL、Redis、GraphQL、Web、后台、缓存、权利撤回、成本与验收
- **不改变的全局边界：** 无个性化、无用户关注/订阅、无 LetLetMe 主动选人推荐、不购买 X API、全站同一 active revision、`en`/`zh-CN` 同 Story 集合与顺序

本文只细化 `Briefing → 深度`。产品可以编辑性地选择“值得读、听、看”的内容，但不能把付费文章、播客或视频改造成替代原作的站内副本。这里的 rewrite 明确定义为可追溯、变换性的编辑摘要，不是近句改写或洗稿。

| 组件 | Features 中承担什么 | 明确不承担什么 |
| --- | --- | --- |
| Grok + `monitor-fpl-x-sources` | 从名单内 X 账号发现新文章、节目、thread 和原始链接 | 不绕过 paywall、不获取私人凭据、不编写无来源长文 |
| Data source/media adapters | RSS、canonical URL、metadata、许可正文、caption/transcript、选择性 ASR 与成本控制 | 不因技术可访问就默认允许存储/摘要/展示 |
| Data editorial/publication | 权利投影、source brief/synthesis、双语 sections/citations、Story/edition/Redis | 不从 FPL 数据推导现实世界论点，不输出主动选人建议 |
| GraphQL | 读取完整、固定 revision 的 card/detail/section/source guide | 不读 private body/transcript、不现场总结或拼接 revision |
| Web | 展示 editorial page、source attribution、时间点、状态与受保护后台 | 不嵌任意 provider HTML、不复制全文、不按用户身份重排 |

## 1. 产品结论

### 1.1 深度页解决什么问题

深度页回答：

> 最近有哪些球队分析、专题文章、播客或视频真正值得花时间？它们的核心论点、证据和限制是什么？

用户不需要先在多个平台打开一小时内容才知道是否相关。LetLetMe 提供：

- 来源、作者/节目、发布日期、媒体类型和预计时间成本；
- 可追溯的核心论点与结构化摘要；
- 对当前 FPL/足球语境的客观连接，但不替用户做决定；
- 原文章、原节目和准确 timecode；
- 内容更新、纠正、过期或权利变化的明确状态。

### 1.2 Features 不是什么

- 不是新闻快讯或转会流；新事实回到 News；
- 不是 KOL picks/captain/template 流；明确判断回到 Views；
- 不是 LetLetMe 的战术真理、球员推荐或 AI 原创专栏；
- 不是完整 transcript、视频切片站或 paywall 镜像；
- 不是按点击量或用户画像生成的内容 feed；
- 不是为了停留时长制造无界滚动。

### 1.3 Story 与其他 surface 的关系

| 来源内容 | canonical Story | Features 如何处理 | 其他菜单 |
| --- | --- | --- | --- |
| 文章报道一个新伤停/转会事实 | `NEWS` | 可链接作背景，不复制 News Story | News/Week 展示事实 |
| 文章/节目完整解释球队结构或球员角色 | `FEATURE` | Source brief 或专题 | Week 可引用同 Story |
| 节目中 KOL 明确建议买入/队长 | `OPINION` | Feature 可引用该观点并关联 Opinion Story | Views/Week 展示具名判断 |
| 多个来源围绕同一主题提供互补分析 | `FEATURE` | Multi-source synthesis，逐段归因 | 相关 News/Views 作为 dependencies |
| LetLetMe 自己的 FPL 图表/趋势 | 非 Briefing Feature | 不伪装为现实来源摘要 | 保留 Explore |

一个 Feature 可以引用已发布 News/Opinion Story，但不能把它们复制成新的事实或观点身份。跨 Story 引用固定具体 revision，并随 dependency correction 重编译。

### 1.4 Feature format 与 topic 分开

`featureFormat`：

| 值 | 含义 |
| --- | --- |
| `ARTICLE_BRIEF` | 单篇文章的变换性摘要 |
| `PODCAST_BRIEF` | 单集播客的编辑摘要与时间点 |
| `VIDEO_BRIEF` | 单个视频的编辑摘要与时间点 |
| `INTERVIEW_BRIEF` | 采访的主题式摘要，区分采访者/受访者 |
| `MULTI_SOURCE_SYNTHESIS` | 多个来源围绕一个明确问题的编辑性综合 |

`featureTopic`：

- `CLUB_ANALYSIS`
- `PLAYER_ROLE`
- `TACTICS`
- `DATA_ANALYSIS`
- `FPL_STRATEGY`
- `INTERVIEW`
- `TRANSFER_CONTEXT`
- `FOOTBALL_BUSINESS`

公共 V1 先按 format 筛选：`全部`、`文章`、`播客`、`视频`、`专题`。内部 topic 用于 edition section、相关内容和后台，不一开始把 UI 切得太碎。

### 1.5 Source brief 与 synthesis

#### Source brief

- 一个主要 source item 对应一个 Feature Story；
- 忠实呈现作者/节目的结构、论点和限制；
- 不加入来源没有说过的结论；
- 允许少量编辑背景，但必须标记为 LetLetMe context 并有独立 source。

#### Multi-source synthesis

- 围绕一个编辑先定义的问题，而不是把相似链接自动拼起来；
- 每个关键段落/论点都有一个或多个明确 source/segment；
- 保留来源之间的差异与不确定性，不生成假共识；
- V1 建议在单来源 brief 流程稳定后再开放公开 synthesis。

### 1.6 内容长度与防替代原则

建议初值：

- card dek：约 50–90 个中文字符或相当英文长度；
- 单来源 detail：约 300–600 中文字或相当英文长度；
- synthesis：约 600–1,000 中文字或相当英文长度；
- 关键点通常 3–6 个；长节目使用 source guide/timecodes，而不是把每一分钟复述一遍。

字数不是唯一权利判断。即使低于上限，如果摘要沿用原作结构、表达或覆盖程度足以替代原作，也必须缩减为 link/metadata/更高层摘要。来源级 rights policy 永远优先。

## 2. 来源、访问与权利

### 2.1 来源名单

Features 继续使用 Data PostgreSQL 的统一 source list，初始来源组：

| 组 | 主要来源 | 发现方式 |
| --- | --- | --- |
| `FEATURES_WRITERS` | 专栏作者、球队分析者、数据作者 | X、作者 RSS、publication feed |
| `FEATURES_PUBLICATIONS` | 体育/FPL 媒体、newsletter | RSS、canonical URL、X |
| `FEATURES_PODCASTS` | 著名播客与节目 | RSS、X、show feed |
| `FEATURES_VIDEO` | YouTube/视频作者 | channel metadata、X |
| `FEATURES_CLUB_MEDIA` | 俱乐部采访、官方长内容 | 官方 feed、X |
| `FEATURES_AGGREGATOR` | 链接汇总/剪辑 | 只发现 original，不支撑公开摘要 |

每个 source 维护 acquisition/display/summary/excerpt/transcript/retention policy 和版本。新来源仍只生成 suggested source，需人工确认身份、价值、rights 和成本 policy 后启用。

### 2.2 获取优先顺序

```text
公开 canonical metadata/link
→ RSS/官方 feed/公开正文
→ 是否达到 material/editorial gate
→ 是否有许可 transcript/caption
→ 是否值得使用认证背景访问或付费转写
→ chunk/segment + citation coverage
→ 编辑审核
→ rights-safe public projection
```

X 是主要发现入口，但不是所有正文的获取器。Grok 找到 source announcement/original URL 后，Data 使用 source-specific adapter 获取 RSS、metadata、许可正文或 media transcript。

### 2.3 rights modes

| 模式 | Data 可保存 | 公开投影 |
| --- | --- | --- |
| `LINK_ONLY` | canonical URL、最少审计 metadata | 来源名、时间、链接 |
| `METADATA` | 标题、作者、节目名、时长、封面等许可 metadata | metadata card + 原链接 |
| `SUMMARY` | policy 允许的正文/transcript 或 segment notes | 变换性摘要、归因、链接 |
| `EXCERPT` | 加受限原文片段与明确字符/时长上限 | policy 限制内短 excerpt |
| `TRANSCRIPT` | private transcript、segments、hash、retention | 只公开摘要/极短 excerpt/timecode |

`SUMMARY` 不等于允许长期保存完整正文；acquisition、private storage、public summary 和 excerpt 是四个可独立配置的权限。

### 2.4 Paywall 与私人访问背景

1. 不绕过 paywall、robots、CAPTCHA 或服务技术限制。
2. 私人账号/订阅只能由受限 Data adapter 使用，凭据存在生产 secret store；数据库只保存不可逆 secret reference key，不保存 cookie/token/password。
3. 使用私人订阅作为编辑背景前，必须为该 source 明确记录服务条款/再利用政策和审核时间。
4. 默认付费来源为 `LINK_ONLY/METADATA`。只有 source-specific policy 明确允许时才保存正文或生成公开摘要。
5. 日志、Grok input/output、GraphQL、Web、错误消息和截图都不能出现凭据或完整付费正文。
6. 账号失效、条款变化或来源投诉可立即 disable adapter，并通过 publication dependencies 撤出受影响内容。

原作中的图片、图表、截图和数据表也分别受 policy 管理。默认不复制视觉资产；允许的 thumbnail 只作 metadata。没有明确重用权时，Feature 可以用文字概括来源论点并链接原图，但不能截图、OCR 后重绘成近似替代品。

“我能用私人账号读到”不是公开 rewrite 的充分条件；这是一个明确的待确认来源清单和权利决定。

### 2.5 Canonical identity 与去重

同一内容可能由 X announcement、RSS、网页和媒体平台重复发现。Data 建立一个 canonical source item：

- 网页优先 canonical URL + normalized provider identity；
- YouTube/播客使用 provider media/episode ID；
- 正文/transcript 用 content hash 识别相同版本；
- X announcement 通过 `ANNOUNCES/LINKS_TO` relation 指向原内容，不另建 Feature；
- syndicated/reprinted article 记录 original/reprint relation，不把同稿算多源 synthesis；
- URL tracking 参数、短链和 locale aliases 在审计保留原值后归一化。

### 2.6 来源更新、删除与权利变化

- 正文/media 变化产生 append-only body revision，不覆盖旧 hash；
- material source correction 使依赖 Feature 进入 review；
- 链接失效不自动删除 Story，但公开标记并安排 source check；
- source 删除或 rights downgrade 默认 fail closed：先阻止旧正文/摘要继续服务，再生成 link-only/tombstone revision；
- 已退役 publication 也不能通过 PostgreSQL fallback 泄漏被撤权 body。

## 3. X/Grok 发现与编辑 gate

### 3.1 统一 skill 的 Features profile

继续使用：

```text
.grok/skills/monitor-fpl-x-sources/
```

新增 `profile: "features"`。`poll/enrich` 只负责 X receipt、origin URL、thread context、source identity 和 candidate hints；文章正文、音视频和私有内容由 Data adapters 获取。

`compose` 使用同一个 versioned skill 的 `profile=features`，但禁止任何网络/X tool。它读取 Data 生成的 bounded input manifest、chunk/segment notes、citation IDs 和 rights projection，输出结构化双语 draft。若长内容处理后来需要拆分专用 compose skill，可以在不改变 Data/publication contract 的前提下演进；V1 不先增加第二套运行时名单或发布路径。

### 3.2 Poll 输入与 cadence

```json
{
  "schemaVersion": 1,
  "runId": "uuid",
  "mode": "poll",
  "profile": "features",
  "windowStart": "2026-08-18T06:00:00.000Z",
  "windowEnd": "2026-08-18T08:00:00.000Z",
  "sourceSnapshot": {
    "revision": 45,
    "groupId": "features-writers-a",
    "sources": []
  },
  "callBudget": { "maxXCalls": 2 }
}
```

初始 policy：

| 来源组 | 普通 | 临近 deadline | 说明 |
| --- | ---: | ---: | --- |
| Writers/publications | 60–120 分钟 | 30–60 分钟 | RSS 成功时 X 可降频 |
| Podcasts/video | 2 小时 | 30–60 分钟 | 先抓 metadata/announcement |
| Club media | 60 分钟 | 30 分钟 | News/Week 官方任务优先 |
| Aggregator | 2–4 小时 | 2 小时 | 只找 origin，最低优先级 |

Features 不进入 FINAL_90 高频竞速；Week/News/Views 的 deadline jobs 可以抢占。worker 落后时合并 catch-up window，不逐条补跑旧 cron。

### 3.3 Candidate gate

进入正文/媒体获取前，候选至少满足：

- 来源已启用且 identity/rights policy 有效；
- 找到 canonical original，不是只有聚合截图；
- 内容与 Premier League/FPL 产品范围相关；
- 相比已有 Feature 有新的论点、证据、采访或角度；
- 预计用户价值足以支付编辑/转写成本；
- 不只是短 News fact 或单一 KOL action；
- access mode、retention 和 public projection 已知。

LLM 可以建议 relevance/originality，最终 gate 由确定性 policy + 编辑决定。不公开内部质量分，也不因粉丝数自动采用。

### 3.4 Enrich

Enrich 只补齐：

- original URL/media ID 与 author/show attribution；
- X thread 是否包含必要上下文；
- syndication/reprint 与同稿关系；
- 相关官方/News/Opinion Story；
- source 是否提供 transcript/caption/show notes；
- rights/access gap 和预计处理成本。

Grok enrich 不读取 paywall body。无法确认 original 或 policy 时 candidate 留后台，不生成看似完整的 AI Feature。

## 4. 正文、转写与 LLM 重组

### 4.1 Ingest 不等于 publish

正文或 transcript 进入 private Evidence 层后，还要经过：

1. content hash/version/rights/retention 校验；
2. deterministic normalization 与 chunk/segment；
3. 来源结构、speaker 和时间轴验证；
4. segment-level proposition/outline notes；
5. citation coverage 与 contradiction/limitation 检查；
6. 双语 compose；
7. 人工对照原作和 rights preview；
8. Story + Surface publication。

原始 body/transcript 不进入 GraphQL。Compose 只能读取 Data 传入的 bounded manifest，不能自行搜索或补全缺失章节。

### 4.2 文章 chunking

- 先移除导航、广告、评论等非正文元素，但保留标题、作者、发布日期和 heading structure。
- Chunk 按 heading/paragraph 边界，不用任意字符切割破坏语义；每块有 ordinal、字符/token 数、text hash。
- 对每个 chunk 生成只含 source-supported proposition、evidence、limitation 和 entity hints 的结构化 note。
- 引言/结论不自动代表全文；coverage manifest 记录哪些章节被处理、缺失和跳过原因。
- 内容超过单任务上限时分批处理，最终 compose 只读取完整的 note manifest；如果关键章节缺失，状态是 `PARTIAL_REVIEW_REQUIRED`，不能自动 READY。

### 4.3 音视频处理

获取顺序：官方 caption/transcript → RSS transcript/章节 → 已许可的选择性 ASR。

- media provider ID + content hash 去重；
- ASR job 记录 provider、model、language、minutes、estimated/actual cost、status、policy revision；
- diarization 只生成 speaker candidate；person-level identity 需要官方 metadata 或人工验证；
- source item segments 带 start/end、speaker、verification、hash 和 retention；
- 长节目优先按官方 chapter/show notes 缩小目标范围；需要全局结构时才批准完整转写；
- 公开 source guide 可以给 timecodes，但不发布完整 transcript。

### 4.4 Compose input/output

Features compose input 至少包含：

```text
run/story draft identity
feature format/topic/target locale pair
source item + exact body/transcript revisions
rights projection and excerpt limits
ordered chunk/segment notes with citation IDs
coverage/gaps/contradictions
related published News/Opinion revisions
previous Feature revision when updating
```

输出为严格 JSON：

- locale-independent section plan；
- `en` 与 `zh-CN` title/dek/section drafts；
- 每个 section 的 source item/segment citations；
- source guide/timecodes；
- limitations/unknowns；
- suggested validUntil/reviewAt；
- direct quote/excerpt byte/character accounting；
- review flags。

输出不能创造新 source、claim、quote、speaker、数据或链接。Data 重新验证所有 citation ID、locale section parity、excerpt limit 和 dependency revision。

### 4.5 变换性摘要 gate

编辑 publish 前逐项确认：

- 摘要是否用新的结构和表达解释核心，而不是逐段近义改写；
- 是否保留作者/节目的主要结论与限制，而非只挑符合 LetLetMe 叙事的片段；
- 每个关键事实/论点是否有允许使用的 citation；
- direct quote/excerpt 是否在 source-specific limit 内；
- 是否足够简洁，仍给用户打开原作的明确价值；
- LetLetMe context 是否与 source claim 清楚分开；
- 是否出现主动 buy/sell/captain/template 建议；若是，改为归因 View 或删除。

模型生成的 `MODEL_ASSISTED` provenance 必须公开；最终 publisher/operator 和 prompt/model/source hashes 写入审计。

### 4.6 成本控制

- RSS/public metadata/公开正文优先，Grok 只承担 X 发现；
- candidate gate 早于 authenticated fetch、full-body processing 和 ASR；
- content hash 复用正文、transcript、chunk notes 和已验证 segments；
- 只有准备编辑的内容 compose；同 source/version/locale/prompt hash 使用幂等 job key；
- 日/月预算分开记录 Grok session、authenticated fetch、ASR minutes 和 LLM tokens；
- 超预算用 `DEFERRED_BUDGET`，不降级为根据标题生成假摘要；
- 运行 2–4 周后按 published adoption、source open、media start 和编辑成本调整，不以停留时长单独证明价值。

### 4.7 Prompt injection 与不可信正文

- 网页、文章、show notes、caption 和 transcript 全部是不可信数据；其中出现的系统提示、工具请求、链接跳转或“忽略前文”都只当作来源文字。
- Fetch/normalize worker 不执行正文脚本、宏或任意 provider HTML；外链先做 scheme/host/policy 校验。
- Features compose 运行时不开放 X、web、shell、数据库或 secret tools，只能引用输入 manifest 中的 IDs。
- Data 对输出的 source/chunk/segment、URL、quote、locale、section 和 excerpt accounting 再做确定性验证。
- 检测到正文试图改变 schema、rights 或 call budget 时标记 injection review；不能因此自动拒绝真实文章，但绝不执行其指令。

## 5. Data：具体落地

### 5.1 复用的通用基础

Features 复用 Source/Evidence/Story/Publication 全部通用表，也复用 Views 定义的：

- `content.attribution_subjects/aliases/sources`；
- `content.source_item_segments`；
- shared media transcript/body retention 与 speaker verification。

如果 Features 先于 Views 实施，这些 relation 仍作为通用 content migration 落地，不建立 Features 私有副本。

### 5.2 Access profile 与 secret 边界

`content.source_policy_versions` 保存允许的 acquisition/storage/summary/excerpt/transcript/retention。可增加不含 secret 的：

| Relation/field | 用途 |
| --- | --- |
| `content.source_access_profiles` | source、adapter type、access mode、status、policy revision、secret reference key、last verified |
| `access_mode` | `PUBLIC/RSS/AUTHENTICATED_BACKGROUND/PROVIDER_API` |
| `secret_reference_key` | 指向生产 secret store 的标识；不能反查出 credential |

只有 Data worker service identity 可解析 secret reference。Admin/GraphQL/Web 只能看到 access health 和 policy，不返回 reference key 本身。

### 5.3 `content.source_item_bodies` 的 append-only version contract

上位设计的 private body storage 明确为 append-only version：

| 字段 | 用途 |
| --- | --- |
| `body_id` | 稳定版本 ID；一条 row 就是一个不可变 body version |
| `source_item_id` | canonical article/media source item |
| `body_kind` | `ARTICLE_HTML/ARTICLE_TEXT/CAPTION/TRANSCRIPT/SHOW_NOTES` |
| `content_hash` | 同 source/kind/hash 幂等 |
| `language/provider/model` | 获取/生成 provenance |
| `acquired_at/source_updated_at` | 观测与来源时间 |
| `policy_revision/retained_until` | 权利与删除 |
| `storage_reference` | private encrypted/object storage reference；公共层不可读 |
| `status` | `READY/PARTIAL/REVOKED/DELETED` |

正文不必长期放 PostgreSQL 大字段；PostgreSQL 保存 authority metadata/hash/reference，private object store 保存 policy 允许的 body。删除 body 时保留最小 hash/audit，但 reference 不再可读。

### 5.4 Chunks、transcription jobs 与 budgets

| Relation | 职责 |
| --- | --- |
| `content.source_item_chunks` | body ID、ordinal、heading path、text hash、token/char counts、private storage slice reference |
| `content.source_item_segments` | media body ID、time range、speaker/verification/hash/retention |
| `content.transcription_jobs` | source/body、provider/model、minutes、estimate/actual cost、status、policy、idempotency |
| `content.content_cost_ledger` | cost type、run/job/source、quantity/currency、occurred_at；不含 private body |
| `content.content_budget_policies` | daily/monthly cap、per-job cap、alert/circuit-breaker；可运营调整 |

Budget check 与 job creation 同事务/锁保护，避免并发任务同时穿透上限。失败/取消任务记录实际已耗成本；`DEFERRED_BUDGET` 不重复排队消耗。

### 5.5 `content.feature_story_profiles`

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| `story_id` | PK | 一对一扩展 |
| `story_kind` | constant `FEATURE` | `(story_id, story_kind) → stories(id, kind)` composite FK |
| `feature_format` | constrained enum | 五种 format |
| `feature_topic` | constrained enum | 八种 topic |
| `primary_media_type` | `ARTICLE/AUDIO/VIDEO/MIXED` | 公共卡片和 filter |
| `primary_source_item_id` | FK | source brief 必填；synthesis 可空 |
| `is_evergreen` | boolean | 是否按 reviewAt 复查 |
| `valid_from/valid_until/review_at` | timestamps | freshness/expiry |
| `source_consumption_minutes` | positive integer | 原文章估计阅读时间或原媒体时长 |
| `feature_read_minutes` | positive integer | LetLetMe detail 的估计阅读时间 |
| `feature_state` | `ACTIVE/STALE/EXPIRED/WITHDRAWN/CLOSED` | 内容生命周期 |
| `surface_eligible` | boolean | 是否进入 Features edition |

同样使用数据库 composite FK 约束 Story kind。Source brief 必须且只能有一个 primary source；synthesis 至少两个独立 source families，且不能把 syndication 算多源。

### 5.6 Source dependencies

| Relation | 职责 |
| --- | --- |
| `content.feature_source_dependencies` | version group、source item/body ID、source role、rights projection、citation coverage state |
| source role | `PRIMARY/SUPPORTING/COUNTERPOINT/CONTEXT` |

每个公开 Feature revision 固定具体 body/transcript revision，不读取“最新 body”漂移。Source correction、revocation 或 body deletion 通过 publication dependencies 找到所有 Story/surface 并 review/recompile。

### 5.7 Typed sections 与 citations

避免把详情正文塞进无约束 JSON：

| Relation | 职责 |
| --- | --- |
| `content.feature_sections` | stable section ID、version group、section kind、sort order |
| `content.feature_section_localizations` | section + locale、heading、body、provenance；同 section/locale 唯一 |
| `content.feature_section_citations` | section、source dependency、可空 chunk/segment、citation role、sort order |

`sectionKind` 初始为：

- `OVERVIEW`
- `KEY_IDEA`
- `EVIDENCE`
- `TACTICAL_POINT`
- `FPL_CONTEXT`
- `LIMITATION`
- `SOURCE_GUIDE`

Publication gate 保证两个 locale 拥有相同 section ID/kind/order 和 citation dependency；文字可以不同，但不能一边新增无来源论点。`FPL_CONTEXT` 只能说明关系，不产生 LetLetMe action recommendation。

### 5.8 Material changes 与 commands

Feature change kinds：

- `FEATURE_FIRST_PUBLISHED`
- `SOURCE_MATERIALLY_UPDATED`
- `SUMMARY_REVISED`
- `CITATION_CORRECTED`
- `SOURCE_ADDED_OR_REMOVED`
- `RIGHTS_PROJECTION_CHANGED`
- `FEATURE_EXPIRED`
- `FEATURE_WITHDRAWN`

Internal commands 至少包括：

- `reviewFeatureCandidate`
- `acquireFeatureSourceBody`
- `requestMediaTranscription`
- `approveFeatureSourceDependencies`
- `createFeatureStory`
- `replaceFeatureSections`
- `correctFeatureCitation`
- `changeFeatureRightsProjection`
- `expireFeature/withdrawFeature`
- `publishStoryRevision`
- `compileAndActivateFeaturesEdition`

所有 command 带 idempotency key、operator/reason、base revision 和权限校验。Authenticated fetch、转写、编辑和 publish 是不同能力，不因拿到正文就自动生成公开摘要。

## 6. Features edition 与缓存

### 6.1 Inclusion 与 active window

`SURFACE:features` 是全站唯一 rolling publication。编译器只选：

1. active `FEATURE` Story publication；
2. source/body/segment dependencies 可读且 rights projection 有效；
3. citation coverage 完整、两个 locale section parity 通过；
4. 未过 validUntil，evergreen 未超过 reviewAt；
5. `surface_eligible = true`。

V1 默认：

- 最近 30 天 active Features；
- evergreen 只在 reviewAt 未过期时保留；
- hard cap 80；
- 20 个/页；
- source brief 和 synthesis 各自受 edition policy 控制，不让单一 publication 占满页面。

过期 Story 退出 surface，但 detail 仍可按 rights policy显示 archived/expired 内容。`STALE` evergreen 不继续以“当前分析”展示。

### 6.2 排序与 section

Data 固化顺序：

1. `LEAD/SECONDARY/MAIN/RAIL` placement；
2. 编辑 freshness/relevance；
3. source published/material update time；
4. Story ID tie-breaker。

公共 section 可为 `FEATURED`、`LATEST`、`LISTEN_AND_WATCH`、`EVERGREEN`。同一个 Story 在 edition 只出现一次；Web 不按 dwell time 或用户点击重排。

### 6.3 Redis 与 cursor

```text
llm:content:briefing:features:active
llm:content:briefing:features:<revision>:en
llm:content:briefing:features:<revision>:zh-CN
```

- 有界 immutable collection + active pointer；
- retired revision 初始 TTL 30 分钟，cursor max age 30 分钟；
- cursor 绑定 revision/offset/filterHash/locale/issuedAt 并签名；
- Redis 缺失/损坏回退 PostgreSQL 同 compiled revision；
- active pointer/payload 不依赖 TTL；
- READY Web proxy/CDN TTL 可比 Week/News 更长，初始 5 分钟；correction/rights outbox 可精确 revalidate。

只有实际 payload 指标超过阈值后再做 shards，不在 V1 提前分片。

## 7. GraphQL 公共合同

### 7.1 Query

```graphql
query BriefingFeatures(
  $locale: BriefingLocale!
  $filter: BriefingFeaturesFilter
  $first: Int = 20
  $after: String
) {
  briefingFeatures(
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
      formats { value label count }
      topics { value label count }
    }
    lead { ...BriefingFeatureCard }
    edges { cursor node { ...BriefingFeatureCard } }
    pageInfo { hasNextPage endCursor }
  }
}
```

`first` 最大 50。无筛选首页按 payload 的 `leadStoryId` 返回 lead 并从 edges 排除；带 filter 时 lead 为 null，匹配的原 lead 按固定顺序进入 edges。

### 7.2 Filter

```graphql
input BriefingFeaturesFilter {
  formats: [BriefingFeatureFormat!]
  topics: [BriefingFeatureTopic!]
}

enum BriefingFeatureFormat {
  ARTICLES
  PODCASTS
  VIDEOS
  SYNTHESES
}
```

公共 UI 首发只展示 format；topic 参数可以同时进入稳定合同，但 Web 在内容量不足时不露出空筛选。Counts 全部来自同 publication revision。

### 7.3 Card

公共 Feature card 包含：

- Story ID/slug/revision、format/topic/media type；
- locale title/dek；
- author/show/publication attribution；
- primary source platform、canonical URL、source publishedAt；
- feature publishedAt/latest materialAt；
- original source consumption minutes、Feature read minutes（允许时）；
- 2–3 个高层 key ideas（每项来自已编译 section）；
- evergreen/stale/expired/corrected 标识；
- cover/thumbnail 仅在 metadata rights 允许时；
- summary provenance `EDITORIAL/MODEL_ASSISTED`。

Link-only/metadata-only item 不伪装为完整 Feature detail。V1 可以在 card 直接外链，或 GraphQL 明确 `detailAvailability = LINK_ONLY`；Web 不建立含幻觉摘要的空详情页。

### 7.4 Detail sections 与 source guide

共享 `briefingStory(slug, locale)` 对 FEATURE 返回：

- 当前 title/dek/format/topic/provenance；
- ordered typed sections；
- 每个 section 的公开 citation markers；
- source guide：author/show、source title、canonical URL、publishedAt、media timecodes；
- related published News/Opinion Story revisions；
- limitations、coverage/update/correction/rights-safe status；
- estimated consumption time 和原作 CTA。

不返回 private body、full transcript、chunk text/reference、authenticated access profile、secret reference、LLM intermediate notes、speaker score、cost ledger 或 source policy internals。

### 7.5 状态

| 状态 | 含义 |
| --- | --- |
| `READY` | active Features publication 可一致读取 |
| `EMPTY` | 成功发现/编辑确认后当前没有可公开 Feature |
| `STALE` | edition 超 freshness 门槛或关键 source dependencies 待复核 |
| `UNAVAILABLE` | Redis/PostgreSQL 同 revision 均不可验证读取 |
| `RESTART_REQUIRED` | cursor revision 已过期/不可继续 |

Filter 无匹配使用 `READY + FILTER_NO_MATCH`。正文获取、转写、预算或 LLM 失败不能变成 EMPTY。

## 8. Web 整体布局

### 8.1 路由

```text
/<locale>/briefing/features
/<locale>/briefing/story/<slug>
```

Features 复用 Briefing shell，公开路由只在至少一种 rights-safe card/detail path、状态 UI 和 source CTA 可用后开放。

### 8.2 Desktop

12-column editorial layout：

- 顶部：`深度 / Features`、最近更新、format filters；
- 左约 8 列：lead、Latest、按 Data 顺序的 article/source briefs；
- 右约 4 列：Listen & Watch、时间成本、rights/provenance 说明；
- rail 与 main 不重复 Story ID；
- evergreen 可作为较低 section，不与新内容混成伪时间流。

页面强调编辑选择和来源，不做按点击量自动变化的“最热门”。

### 8.3 Mobile

- submenu + format filters 可 sticky，主要内容保持单列；
- media type、source、duration/reading time 和 CTA 在展开前可见；
- key ideas 先显示，详细 sections 按正常文档阅读；
- source guide/timecodes 易于触达；
- load more pin revision，过期 cursor 显式 restart；
- 不写个人已读、收藏、关注或媒体偏好到 localStorage。

### 8.4 Card 与 detail 信息层级

Card：

1. Article/Podcast/Video/Synthesis；
2. 标题和 editor dek；
3. 作者/节目/出版方；
4. source published time + LetLetMe feature updated time；
5. 阅读/收听/观看时间；
6. 2–3 个 key ideas；
7. “阅读摘要 / 打开原作 / 从时间点播放”。

Detail：

- 开头再次明确原作和 provenance；
- sections 短而有结构，不模仿原作完整排版；
- citation marker 可展开到 source/timecode；
- limitation 和来源差异不能藏在末尾；
- 原作 CTA 至少在开头和 source guide 可达；
- 不渲染任意 article HTML、未清理 markdown 或 provider embed。

### 8.5 SEO 与 link-only

- Transformative Feature detail 使用自己的 canonical locale URL，并明确链接原作；
- slug aliases permanent redirect 到 canonical Story；
- `LINK_ONLY/METADATA` 如果没有独立编辑价值，默认不建可索引空详情页；
- removed/rights-revoked detail 返回安全 tombstone 并阻止旧 CDN body；
- structured data 只描述 LetLetMe 的摘要页，不声称自己是原文章/节目作者。

### 8.6 状态 UI

- `EMPTY`：说明当前无经编辑确认、权利允许的深度内容，并展示检查时间。
- `STALE`：明确内容/来源正在复核；过 reviewAt 的 evergreen 不标“最新”。
- `UNAVAILABLE`：服务错误，不写成没有文章/节目。
- `FILTER_NO_MATCH`：保留并允许清除筛选。
- `RESTART_REQUIRED`：提示内容版次已更新，回到新 revision。
- `LINK_ONLY`：明确只提供来源入口，不显示伪摘要 skeleton。

## 9. 编辑后台与运营

`/admin/briefing/features` 经受保护的 Web server route 调 Data internal API。

### 9.1 Features Inbox

- X/RSS/feed 来源与 canonical URL/media ID；
- original/reprint/syndication/announcement relations；
- author/show attribution、format/topic/relevance candidate；
- rights/access mode、policy version、body/transcript availability；
- 预计 authenticated fetch、ASR、LLM 成本；
- 与现有 News/Opinion/Feature 的相似和 dependency candidate；
- coverage、injection、paywall、speaker、entity 和 source gap flags。

### 9.2 Source/body/media review

- adapter/access health，不显示 credential/secret reference；
- body/transcript versions、content hash、retention、revocation；
- chunk/segment coverage、章节、speaker verification、timecodes；
- transcript/fetch job cost、reuse、budget state；
- source policy 决定的 summary/excerpt/public projection preview。

### 9.3 Feature editor

- source brief/synthesis、format/topic、validity/reviewAt；
- version-pinned dependencies 与 source roles；
- locale-independent section plan；
- `en/zh-CN` section localizations；
- 每个 section 的 chunk/segment citation；
- excerpt counter、provenance、limitations；
- related News/Opinion revisions；
- rights preview、correction、withdrawal、expiry；
- desktop/mobile/public payload preview。

### 9.4 Publication gate

Publish 按钮前必须显示并验证：

- source/body version 与 policy 未变化；
- complete/accepted coverage；
- 所有公开 section 有合格 citation；
- synthesis 有足够独立 source families；
- 两 locale section/citation parity；
- excerpt limit 与 replacement-risk review；
- Story dependency revision 和 current rights state；
- operator 有 publisher 权限且 base revision 未过时。

## 10. 可观测性、成本与故障

### 10.1 指标

Discovery/ingest：

- X/RSS/feed coverage、checkpoint lag、canonicalization/duplicate/syndication rate；
- candidate → body fetch → processed → draft → published；
- paywall/access/policy failure 与 source health。

Media/LLM：

- body bytes/chunks、transcript minutes/segments、reuse rate；
- provider/model/tokens/minutes/estimated vs actual cost；
- `DEFERRED_BUDGET/PARTIAL_REVIEW_REQUIRED` 数量；
- compose citation rejection、locale parity failure、editor rewrite rate。

Editorial/publication：

- time-to-brief、time-to-publish、source correction/rights withdrawal lag；
- Features count/source mix/payload bytes/compile/activate/repair；
- Redis hit/PostgreSQL fallback/checksum rejection/GraphQL states。

Product：

- card/detail/key-idea/source-guide/source-open/media-start；
- 按 format/topic/publication revision/placement 聚合；
- 不用个人画像排序，也不以无限滚动或纯 dwell time 作为唯一成功指标。

### 10.2 故障行为

| 故障 | 正确行为 |
| --- | --- |
| X/Grok 失败但 RSS 成功 | 保存可验证 RSS items；run coverage 明确分开，不谎称 X 完整 |
| Original/canonical 不明 | 留 inbox，不对聚合截图做 Feature |
| Paywall/body 不可访问 | LINK_ONLY/METADATA；不能根据标题生成摘要 |
| Credential/adapter 失效 | disable authenticated fetch、告警、既有 dependencies 按 policy review |
| ASR/LLM 预算不足 | DEFERRED_BUDGET，不用低证据替代 |
| 关键 chunk/segment 缺失 | PARTIAL_REVIEW_REQUIRED，不自动 READY |
| Citation/locale parity 失败 | publication gate 拒绝整个 revision |
| Source correction | 固定旧审计，review/new Feature revision，重编译 surfaces |
| Rights downgrade/delete | fail closed，撤出正文/excerpt，发布 link-only/tombstone，旧 fallback 不泄漏 |
| Redis 损坏 | PostgreSQL 同 revision fallback + repair |
| Cursor 过期 | RESTART_REQUIRED，不混合版本 |

## 11. 分仓实施顺序

### Phase F0 — Source/rights/editorial policy

- 确认首批 publications/writers/shows、source owner、rights/access/retention。
- 固化 format/topic/section/source-role/body/job/budget enums。
- 确认摘要长度、excerpt limit、replacement-risk checklist 和 publish owner。

### Phase F1 — Public discovery + metadata

- `profile=features` X schema/fixtures/trace validation。
- RSS/feed/canonical URL adapters、dedup、announcement/syndication relations。
- 先上线 LINK_ONLY/METADATA Inbox，不依赖私有账号或 ASR。

### Phase F2 — Body/media processing

- append-only body versions、private storage、chunks/segments。
- official captions/transcripts、selective ASR、speaker review。
- access profiles、secret boundary、cost ledger/budget circuit breaker、retention deletion。

### Phase F3 — Feature editorial + publication

- profile/source dependencies/typed sections/localizations/citations。
- `profile=features compose` strict schema、coverage/citation/rights gates。
- Story publication、rolling Features edition、Redis CAS/repair/rollback。

### Phase F4 — GraphQL + Web + admin

- `briefingFeatures`、filters、cards、typed detail/source guide/states/cursor。
- public magazine layout、link-only path、timecodes、SEO/removed state。
- Inbox、body/media review、Feature editor、rights/publication preview。

### Phase F5 — 受控上线

- 先公开少量 public-article source briefs；
- 再启用 official transcript/caption 的 podcast/video；
- authenticated paywall 和付费 ASR 必须逐 source/policy/budget 开启；
- 单来源 brief 稳定 2–4 周后才开放 multi-source synthesis；
- 依据采用率、source open、media start、纠错和成本扩充，不按内容数量追求规模。

## 12. 验收矩阵

### Data

- 同一文章经 X + RSS + canonical URL 只产生一个 source item/Feature candidate。
- Syndicated same-report 不计为 multi-source synthesis 的独立来源。
- Body/transcript 更新 append revision，不覆盖旧 hash/审计。
- LINK_ONLY/METADATA 没有正文时不能生成 summary sections。
- 私人账号 credential/cookie/token 不进入 DB body、log、Grok、GraphQL 或 Web。
- Authenticated access policy 未明确时 fetch job 被拒绝。
- 同 content hash 不重复 ASR/chunk/compose 成本。
- Budget 并发不会穿透 daily/monthly cap；deferred job 不循环消费。
- 关键 chunk/segment gap 阻止自动 READY。
- 每个公开 section 至少一个合格 citation；citation body revision 精确固定。
- `en/zh-CN` section ID/kind/order/citation dependencies 一致。
- Synthesis 至少两个独立 source families，并保留 counterpoint/limitation。
- Rights revoke 会使 active/retired payload body 均不可通过 fallback 服务。

### GraphQL

- 匿名、登录和不同 cookie/session 返回同 revision/Story/order。
- Filter/count/lead/edges 来自同 immutable publication。
- Cursor 不跨 revision；过期返回 RESTART_REQUIRED。
- LINK_ONLY 与 READY detail 明确区分。
- 不返回 private body/transcript/chunk/storage/secret/cost/intermediate notes。
- Redis corruption 严格回退 PostgreSQL 同 compiled revision。
- Source correction/rights change 后不返回被撤权旧 section/excerpt。

### Web

- Features 在顶级 Briefing 下可直接发现，format filters 清楚。
- 用户先看到来源、媒体类型和时间成本，再决定阅读/打开原作。
- Detail 是短、结构化、可追溯摘要，不复制全文/完整 transcript。
- Source/timecode CTA 可用，external links 安全。
- News fact、KOL View 与 LetLetMe editorial context 视觉/语言区分。
- Mobile/desktop 保持 Data 顺序，同 Story 不重复。
- EMPTY/STALE/UNAVAILABLE/FILTER_NO_MATCH/RESTART_REQUIRED/LINK_ONLY 可区分。
- Rights removal/correction 后浏览器/CDN 不继续显示旧正文。

### End-to-end

```text
名单内作者在 X 发布新文章
→ Grok 有真实 Latest trace并找到 canonical URL
→ RSS/public adapter 获取许可正文 + body hash
→ chunks/coverage/citation notes
→ profile=features compose 严格双语 draft
→ 编辑核对 source、rights、sections、citations
→ Story + Features publication
→ PostgreSQL/Redis/GraphQL/Web 同 revision
→ 人为破坏 Redis 后同 revision fallback
→ 来源更新关键段落
→ dependency review + 新 Story/Surface revision
→ rights downgrade 后 link-only/tombstone，旧 body 不可服务
```

另需验收 paywall metadata-only、ASR budget exhausted、unknown speaker、partial transcript、multi-source same-family、locale citation mismatch 和 source deletion。

## 13. 明确不做

- 绕过 paywall、robots、CAPTCHA 或服务限制
- 把私人账号 cookie/password/token 放入数据库、skill、日志或 Web
- 近句改写、洗稿、完整文章/节目/transcript 替代品
- 仅根据标题、thumbnail、show notes 或模型记忆生成完整摘要
- 所有来源/节目无差别抓全文或转写
- LLM 无 citation 原创事实、论点、quote、speaker 或选人建议
- 将 News/Views 复制成另一个 Feature 身份
- 用户个性化、关注/收藏/已读状态或通知投递
- 点击量自动排序、内容农场式无限流
- Web/GraphQL 直接 fetch paywall、运行 LLM/ASR 或读 private storage
- 跨 publication revision pagination 或从 raw tables 现场拼 detail

## 14. 仍需产品/运营确认

| 问题 | 建议默认值 | 影响 |
| --- | --- | --- |
| **公共筛选是否采用全部、文章、播客、视频、专题？** | 是；topic 先保留内部/合同能力 | 影响 GraphQL enum、URL 和 Web copy |
| **单来源与 synthesis 何时上线？** | 先 source brief；稳定 2–4 周后再开 multi-source synthesis | 影响编辑复杂度与 citation gate |
| **公开摘要长度/结构？** | card 50–90 字；source brief 300–600 字；synthesis 600–1,000 字；3–6 key ideas | 影响 Web layout、成本和替代风险 |
| **哪些付费来源/私人账号允许 authenticated background 与公开摘要？** | 逐 source 明确；未确认一律 LINK_ONLY/METADATA | 阻塞对应 richer Feature，不阻塞 public content |
| **每个 source 的 excerpt 字符/秒数上限？** | 写入版本化 rights policy；无明确许可默认不 excerpt | 影响 compiler 和 editor counter |
| **转写/LLM provider 与日/月/单任务预算？** | official transcript 优先；付费处理使用 hard cap + DEFERRED_BUDGET | 阻塞付费媒体处理，不阻塞 metadata |
| **Features active window/cap？** | 最近 30 天 + 未过 reviewAt evergreen；hard cap 80；20/页 | 影响 payload 和编辑密度 |
| **是否展示 cover/thumbnail？** | 仅 source metadata policy 明确允许；否则用产品图形/纯文本 | 影响 Web 视觉资产与 rights |
| **source owner、rights reviewer、publisher 分别是谁？** | 至少明确 owner 与 publisher；authenticated sources 另需 rights reviewer | 阻塞真实公开运营 |

在没有另行决定前，工程可以按建议默认值实现 public/RSS metadata、schema、fixtures、link-only 与少量公开 source brief；authenticated paywall、付费转写、excerpt 和 multi-source synthesis 必须等待逐项确认。
