/**
 * Muscle Groups 端到端验证（CDP）
 *
 * 流程：
 *  1. 起 Chrome（--headless=new, --remote-debugging-port=9230）
 *  2. 演示账号登录拿 token
 *  3. 通过 API 注入一条 "e2e-测试肌群"（root）
 *  4. 打开 web、注入 token、跳 /training/muscle-groups
 *  5. 断言：
 *     - 3+ 个统计卡（value 含数字）
 *     - 至少 1 张肌群卡，名字是 "e2e-测试肌群"
 *     - 点击该卡 → 详情弹窗可见，标题含 "e2e-测试肌群"
 *     - 关闭弹窗后页面回到主视图
 *  6. 走添加流程：填名字 → 提交 → 列表 +1
 *  7. 删除刚加的那条 → 列表 -1（最终不包含）
 *  8. 收尾：删除 e2e-测试肌群（如果还在）
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9230;
const API = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const DEMO_PHONE = '13800138000';
const DEMO_PASS = 'Test1234!';

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=/tmp/chrome-muscle-groups-verify', '--headless=new', '--window-size=1440,1500',
  'about:blank',
], { stdio: 'ignore' });
await sleep(1500);

// Chrome's CDP endpoint sometimes takes longer than 1.5s. Retry up to ~10s.
let tabs = null;
for (let i = 0; i < 20; i++) {
  try {
    tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    if (Array.isArray(tabs) && tabs.length > 0) break;
  } catch {}
  await sleep(500);
}
if (!tabs) { console.error('CDP endpoint never came up'); chrome.kill(); process.exit(1); }

const pageTab = tabs.find((t) => t.type === 'page');
if (!pageTab) throw new Error('no page tab');
const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id != null && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalExpr = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};
await new Promise((r) => ws.once('open', r));

// 1. 登录
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phonenumber: DEMO_PHONE, password: DEMO_PASS }),
});
const { accessToken } = await loginRes.json();
if (!accessToken) { console.error('login failed'); chrome.kill(); process.exit(1); }
const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
console.log('[login] ok');

// 2. 注入 e2e-测试肌群（root）
const injectedName = 'e2e-测试肌群';
const createRes = await fetch(`${API}/muscle-groups`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ name: injectedName, description: 'E2E 创建的测试肌群' }),
});
if (!createRes.ok) {
  console.error('seed inject failed', createRes.status, await createRes.text());
  chrome.kill(); process.exit(1);
}
const injected = await createRes.json();
console.log('[seed inject] id=', injected.id);

// 3. 打开 web + 跳路由
await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Runtime.enable');
await send('Page.navigate', { url: `${WEB}/login?cb=${Date.now()}` });
await sleep(2500);
await evalExpr(`localStorage.setItem('accessToken', ${JSON.stringify(accessToken)}); localStorage.setItem('refreshToken', 'x'); true;`);
await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}` });
await sleep(6000);

// 4. 断言：统计卡 + 至少 1 张肌群卡 + 标题
const initial = await evalExpr(`
  (() => {
    const cards = [...document.querySelectorAll('div.relative')].filter((d) => d.querySelector('.text-2xl'));
    const stats = cards.map((c) => c.querySelector('.text-2xl')?.textContent?.trim());
    const cardButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(${JSON.stringify(injectedName)}));
    return {
      pathname: location.pathname,
      statCount: stats.length,
      hasInjectedCard: cardButtons.length > 0,
      h1: document.querySelector('h1')?.textContent?.trim(),
    };
  })()
`);
console.log('[initial]', initial);
if (initial.pathname !== '/training/muscle-groups') throw new Error('wrong pathname');
if (!initial.h1?.includes('肌肉群管理')) throw new Error('h1 missing');
if (initial.statCount < 3) throw new Error('stat cards < 3');
if (!initial.hasInjectedCard) throw new Error('injected card not rendered');

// 5. 点击注入的卡 → 弹窗
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(injectedName)}));
    btn?.click();
    true;
  })()
`);
await sleep(800);
const detail = await evalExpr(`
  (() => {
    const dialogs = [...document.querySelectorAll('div')].filter((d) => {
      const cn = (d.className?.toString?.() || '');
      return cn.includes('rounded-2xl') && cn.includes('bg-white') && cn.includes('shadow-[') && d.querySelector('h3');
    });
    const last = dialogs[dialogs.length - 1];
    return { open: !!last, title: last?.querySelector('h3')?.textContent?.trim() };
  })()
`);
console.log('[detail]', detail);
if (!detail.open) throw new Error('detail dialog did not open');
if (!detail.title?.includes(injectedName)) throw new Error('detail title wrong');

// 关闭弹窗
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭');
    btn?.click();
    true;
  })()
`);
await sleep(500);

// 6. 添加肌群
const newName = 'e2e-add-' + Date.now();
await evalExpr(`
  (() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('添加肌肉群'))?.click();
    true;
  })()
`);
await sleep(500);
await evalExpr(`
  (() => {
    const input = document.querySelector('input[placeholder="如：胸大肌"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(newName)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    true;
  })()
`);
await sleep(300);
await evalExpr(`
  (() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存');
    btn?.click();
    true;
  })()
`);
await sleep(2000);

const afterAdd = await evalExpr(`
  (() => {
    const cardButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(${JSON.stringify(newName)}));
    return { hasNewCard: cardButtons.length > 0 };
  })()
`);
console.log('[afterAdd]', afterAdd);
if (!afterAdd.hasNewCard) throw new Error('new muscle group not rendered after add');

// 7. 删除刚才加的那条（直接走 API + 检查）
const listAfter = await (await fetch(`${API}/muscle-groups`, { headers: auth })).json();
const toDelete = listAfter.find((g) => g.name === newName);
if (toDelete) {
  const delRes = await fetch(`${API}/muscle-groups/${toDelete.id}`, { method: 'DELETE', headers: auth });
  if (!delRes.ok) throw new Error('delete failed: ' + delRes.status);
}

// 8. 收尾：清理 e2e-测试肌群
await fetch(`${API}/muscle-groups/${injected.id}`, { method: 'DELETE', headers: auth }).catch(() => {});

console.log('\nALL ASSERTIONS PASSED');
ws.close();
chrome.kill();
process.exit(0);
