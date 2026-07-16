/**
 * Dashboard 端到端验证（CDP）
 *
 * 流程：
 *  1. 起 Chrome（--headless=new, --remote-debugging-port=9222）
 *  2. 演示账号直接走 login 接口拿 token（API -> 用作 BFF Bearer）
 *  3. 打开 web、注入 token、跳 /overview/dashboard
 *  4. 断言：
 *     - 4 统计卡 value 文案与 API stats 计算结果一致
 *     - 本周训练强度柱状图 7 个 X 轴标签完整
 *     - 最近训练记录显示 3 条
 *     - 刷新后状态保留
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const WEB = 'http://localhost:5173';
const API = 'http://localhost:3001';
const BFF = 'http://localhost:3000';
const DEMO_PHONE = '13800138000';
const DEMO_PASS = 'Test1234!';

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/chrome-dashboard-verify',
    '--headless=new',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
await sleep(1500);

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
// 过滤掉 extension 的 background_page / service_worker，只保留真正的 page tab
const pageTab = tabs.find((t) => t.type === 'page');
if (!pageTab) throw new Error('no page tab found');
const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id != null && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
});
const send = (method, params = {}) => {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
};
const evalExpr = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};
await new Promise((r) => ws.once('open', r));

// 1. 演示账号登录拿 token
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phonenumber: DEMO_PHONE, password: DEMO_PASS }),
});
const { accessToken, refreshToken } = await loginRes.json();
if (!accessToken) {
  console.error('login failed', loginRes.status, await loginRes.text());
  chrome.kill();
  process.exit(1);
}
console.log('[login] ok');

// 2. 提前拉一次 stats，用于对账
const statsCheck = await (await fetch(`${API}/overview/stats`, {
  headers: { Authorization: `Bearer ${accessToken}` },
})).json();
console.log('[api] stats =', JSON.stringify(statsCheck));

// 3. 打开 web、注入 token、跳 dashboard
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Runtime.enable');

await send('Page.navigate', { url: `${WEB}/login?cb=${Date.now()}` });
await sleep(2500);
await evalExpr(`
  localStorage.setItem('accessToken', ${JSON.stringify(accessToken)});
  localStorage.setItem('refreshToken', ${JSON.stringify(refreshToken)});
  true;
`);
await send('Page.navigate', { url: `${WEB}/overview/dashboard?cb=${Date.now()}` });
await sleep(7000);

// 4. 断言：4 统计卡
const cards = await evalExpr(`
  (() => {
    const titles = ['本周训练', '训练时长', '消耗热量', '达成目标'];
    return titles.map((t) => {
      const el = [...document.querySelectorAll('div')].find(
        (d) => d.textContent.trim() === t,
      );
      if (!el) return { title: t, found: false };
      const card = el.closest('div.relative');
      const value = card?.querySelector('.text-2xl')?.textContent?.trim() ?? null;
      return { title: t, found: true, value };
    });
  })()
`);
console.log('[cards]', JSON.stringify(cards, null, 2));
const expected = [
  { title: '本周训练', value: `${statsCheck.thisWeek.count} 次` },
  { title: '训练时长', value: `${statsCheck.thisWeek.durationMinutes} 分钟` },
  { title: '消耗热量', value: `${statsCheck.thisWeek.caloriesBurned.toLocaleString()} kcal` },
  { title: '达成目标', value: `${statsCheck.total.count} 个` },
];
for (const e of expected) {
  const got = cards.find((c) => c.title === e.title);
  if (!got?.found) throw new Error(`card "${e.title}" not found`);
  if (got.value !== e.value) throw new Error(`card "${e.title}" expected=${e.value} got=${got.value}`);
}
console.log('[assert] 4 cards OK');

// 5. 断言：周强度 7 个 X 轴标签
// recharts 3 + esbuild 打包后，tick-lines 在 `.recharts-xAxis` 下，tick-labels
// 却在 `.recharts-xAxis-tick-labels` 里（与 `.recharts-xAxis` 平级），所以
// `.recharts-xAxis .recharts-cartesian-axis-tick-value` 查不到。直接从
// `.recharts-xAxis-tick-labels` 拉所有 <text>。
const xLabels = await evalExpr(`
  (() => {
    const labels = document.querySelector('.recharts-xAxis-tick-labels');
    if (!labels) return [];
    return [...labels.querySelectorAll('text')]
      .map((t) => t.textContent.trim())
      .filter(Boolean);
  })()
`);
console.log('[intensity x labels]', xLabels);
const expectedLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
for (const lbl of expectedLabels) {
  if (!xLabels.includes(lbl)) throw new Error(`missing weekday label: ${lbl}`);
}
console.log('[assert] 7 weekday labels OK');

// 6. 断言：最近 3 条记录
// SessionRecordItem 渲染结构（packages/ui-components/.../session-record-item.tsx）：
//   <div className="flex items-center justify-between gap-4 rounded-xl bg-white">
//     <div className="min-w-0">              // 名称 + 日期
//     <div className="shrink-0 text-right">  // X 分钟 + Y 个动作
//   </div>
// 注意：recharts X 轴 tick 节点的 textContent 偶尔会跨节点合并，这里只看
// SessionRecordItem 的 leaf：len ≤ 35，恰好 2 个子元素，命中 "X 分钟" 和 "Y 个动作"。
const records = await evalExpr(`
  (() => {
    const candidates = [...document.querySelectorAll('div')].filter((d) => {
      if (d.children.length !== 2) return false;
      const txt = (d.textContent || '').replace(/\\s+/g, '');
      if (txt.length > 35) return false;
      return /\\d+分钟/.test(txt) && /\\d+个动作/.test(txt);
    });
    // 直系父级不再 "也是 leaf record"，避免 ancestor/descendant 同时上榜
    return candidates
      .filter((d) => !candidates.includes(d.parentElement))
      .slice(0, 3)
      .map((d) => d.textContent.replace(/\\s+/g, ' ').trim());
  })()
`);
console.log('[records]', records);
if (records.length !== 3) throw new Error(`expected 3 recent records, got ${records.length}`);
console.log('[assert] 3 records OK');

// 7. 断言：刷新后保留
await send('Page.reload', { ignoreCache: true });
await sleep(5000);
const afterReload = await evalExpr(`
  (() => {
    // 匹配 "数字 个|次|分钟|kcal" 的 text-2xl 元素（统计卡 value），排除 H1/标题
    // 里也有 text-2xl 但 textContent 不含单位的情况。
    const cardValues = [...document.querySelectorAll('.text-2xl')]
      .map((d) => d.textContent.trim())
      .filter((t) => /\\d+\\s*(个|次|分钟|kcal)/.test(t));
    return {
      pathname: location.pathname,
      hasTitle: !!document.querySelector('h1')?.textContent?.includes('训练概览'),
      cardCount: cardValues.length,
    };
  })()
`);
console.log('[reload]', afterReload);
if (afterReload.pathname !== '/overview/dashboard') throw new Error('pathname after reload wrong');
if (!afterReload.hasTitle) throw new Error('title missing after reload');
if (afterReload.cardCount !== 4) throw new Error(`expected 4 cards after reload, got ${afterReload.cardCount}`);

console.log('\nALL ASSERTIONS PASSED');
ws.close();
chrome.kill();
process.exit(0);
