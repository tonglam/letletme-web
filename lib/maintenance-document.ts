interface MaintenanceCopy {
	lang: 'en' | 'zh-CN'
	title: string
	description: string
	eyebrow: string
	status: string
	accountTitle: string
	accountDescription: string
	retryTitle: string
	retryDescription: (minutes: number) => string
	checkAgain: string
	noActionNeeded: string
}

const ENGLISH_COPY: MaintenanceCopy = {
	lang: 'en',
	title: 'The data room is between seasons.',
	description:
		'We have paused live, player, market and tournament data while the new platform is activated. This prevents an old-season snapshot from being shown as current.',
	eyebrow: 'Data platform changeover',
	status: 'Temporarily paused',
	accountTitle: 'Your account stays intact',
	accountDescription:
		'Profiles, sign-in details and verified FPL bindings are not being migrated by this data changeover.',
	retryTitle: 'Check back shortly',
	retryDescription: minutes =>
		`The suggested retry window is about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
	checkAgain: 'Check again',
	noActionNeeded: 'You do not need to change or resubmit anything.'
}

const CHINESE_COPY: MaintenanceCopy = {
	lang: 'zh-CN',
	title: '新赛季数据正在就位。',
	description:
		'新数据平台启用期间，实时数据、球员、市场和锦标赛功能暂时停用，以免把旧赛季快照显示成当前数据。',
	eyebrow: '数据平台切换',
	status: '暂时停用',
	accountTitle: '账户数据保持不变',
	accountDescription:
		'本次数据平台切换不会迁移个人资料、登录信息或已验证的 FPL 绑定。',
	retryTitle: '请稍后再试',
	retryDescription: minutes => `建议约 ${minutes} 分钟后重试。`,
	checkAgain: '重新检查',
	noActionNeeded: '无需修改或重新提交任何信息。'
}

// The <style> block below is a mirror of app/globals.css tokens — keep in sync.
export function renderMaintenanceDocument(
	locale: string,
	retryAfterSeconds: number
): string {
	const copy = locale === 'zh-CN' ? CHINESE_COPY : ENGLISH_COPY
	const retryMinutes = Math.ceil(retryAfterSeconds / 60)

	return `<!doctype html>
<html lang="${copy.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="hsl(288 56% 8%)">
  <title>${copy.title} | LetLetMe</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: hsl(288 56% 8%); color: hsl(48 33% 96%); }
    .page { position: relative; display: grid; min-height: 100svh; place-items: center; overflow: hidden; padding: 32px 16px; }
    .glow { position: absolute; inset: -35%; background: radial-gradient(circle at 50% 45%, hsl(152 100% 50% / .2), transparent 42%); pointer-events: none; }
    .pitch { position: absolute; inset: 0; opacity: .13; pointer-events: none; }
    .pitch::before { content: ""; position: absolute; inset: 5%; border: 1px solid hsl(152 100% 50%); border-radius: 18px; }
    .pitch::after { content: ""; position: absolute; left: 50%; top: 5%; bottom: 5%; border-left: 1px solid hsl(152 100% 50%); }
    .card { position: relative; width: min(100%, 960px); overflow: hidden; border: 1px solid hsl(152 100% 50% / .26); border-radius: 20px; background: hsl(288 52% 10% / .94); box-shadow: 0 30px 90px rgba(0, 0, 0, .48); }
    .topline { height: 4px; background: linear-gradient(90deg, hsl(152 100% 50%), hsl(330 100% 58%) 50%, hsl(152 100% 50%)); }
    .inner { padding: clamp(24px, 5vw, 52px); }
    .masthead { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-bottom: 20px; border-bottom: 1px solid hsl(48 33% 96% / .14); }
    .brand { display: flex; align-items: center; gap: 12px; }
    .mark { display: grid; width: 48px; height: 36px; place-items: center; border: 1px solid hsl(152 100% 50% / .42); border-radius: 8px; color: hsl(152 100% 50%); font: 800 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }
    .eyebrow { margin: 0; color: hsl(152 100% 50%); font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; }
    .status { display: inline-flex; align-items: center; gap: 9px; margin: 0; padding: 8px 12px; border: 1px solid hsl(152 100% 50% / .34); border-radius: 999px; background: hsl(152 100% 50% / .08); color: hsl(152 100% 50%); font-size: 12px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: hsl(152 100% 50%); box-shadow: 0 0 0 4px hsl(152 100% 50% / .12); }
    .content { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(260px, .7fr); gap: clamp(30px, 6vw, 64px); align-items: end; padding: clamp(34px, 6vw, 64px) 0 36px; }
    h1 { max-width: 680px; margin: 0; font-size: clamp(40px, 7vw, 72px); line-height: .98; letter-spacing: -.045em; }
    .lede { max-width: 680px; margin: 24px 0 0; color: hsl(48 33% 96% / .72); font-size: clamp(16px, 2vw, 19px); line-height: 1.65; }
    .facts { display: grid; gap: 12px; }
    .fact { padding: 18px; border: 1px solid hsl(48 33% 96% / .14); border-radius: 12px; background: hsl(48 33% 96% / .035); }
    .fact-label { margin: 0; color: hsl(48 33% 96%); font-size: 15px; font-weight: 750; }
    .fact-copy { margin: 8px 0 0; color: hsl(48 33% 96% / .62); font-size: 14px; line-height: 1.55; }
    .footer { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; padding-top: 24px; border-top: 1px solid hsl(48 33% 96% / .14); }
    .button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 0 20px; border-radius: 9px; background: hsl(152 100% 50%); color: hsl(288 100% 11%); font-weight: 800; text-decoration: none; }
    .button:hover { background: hsl(152 100% 62%); }
    .button:focus-visible { outline: 3px solid hsl(330 100% 58%); outline-offset: 3px; }
    .note { margin: 0; color: hsl(48 33% 96% / .6); font-size: 14px; }
    @media (max-width: 720px) {
      .page { align-items: start; padding-top: 18px; }
      .masthead { align-items: flex-start; flex-direction: column; }
      .content { grid-template-columns: 1fr; padding-top: 40px; }
      .inner { padding: 22px; }
      h1 { font-size: clamp(38px, 13vw, 56px); }
    }
    @media (prefers-reduced-motion: no-preference) {
      .dot { animation: pulse 2.4s ease-in-out infinite; }
      @keyframes pulse { 50% { opacity: .55; transform: scale(.82); } }
    }
  </style>
</head>
<body>
  <main class="page" data-maintenance-page="true" aria-labelledby="maintenance-title">
    <div class="glow" aria-hidden="true"></div>
    <div class="pitch" aria-hidden="true"></div>
    <section class="card">
      <div class="topline" aria-hidden="true"></div>
      <div class="inner">
        <header class="masthead">
          <div class="brand"><span class="mark" aria-hidden="true">LLM</span><p class="eyebrow">${copy.eyebrow}</p></div>
          <p class="status" role="status"><span class="dot" aria-hidden="true"></span>${copy.status}</p>
        </header>
        <div class="content">
          <div>
            <h1 id="maintenance-title">${copy.title}</h1>
            <p class="lede">${copy.description}</p>
          </div>
          <div class="facts">
            <div class="fact"><p class="fact-label">${copy.accountTitle}</p><p class="fact-copy">${copy.accountDescription}</p></div>
            <div class="fact"><p class="fact-label">${copy.retryTitle}</p><p class="fact-copy">${copy.retryDescription(retryMinutes)}</p></div>
          </div>
        </div>
        <footer class="footer">
          <a class="button" href="">${copy.checkAgain}</a>
          <p class="note">${copy.noActionNeeded}</p>
        </footer>
      </div>
    </section>
  </main>
</body>
</html>`
}
