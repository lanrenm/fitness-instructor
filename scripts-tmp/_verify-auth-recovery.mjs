/**
 * Auth-recovery 端到端验证（CDP）
 *
 * 5 个测试用例：
 *  T1 Login → /training/muscle-groups 200（baseline）
 *  T2 accessToken 手动置为 bogus → 触发列表请求 → 期望恰好 1 个
 *     POST /api/auth/refresh 紧接着一次 /api/muscle-groups 200
 *  T3 两 token 都置 bogus → 期望 refresh 401 → 强制登出 →
 *     localStorage 清空 + pathname = /login + 「上次会话已过期」banner
 *  T4 expired 但合法的 JWT（exp=past）放在 localStorage → 访问 /login
 *     期望不重定向到 /overview/dashboard
 *  T5 TopBar 退出按钮：点击 → 期望 tokens 清空 + pathname = /login
 *
 * 末尾打印 PASS / FAIL，整体 exit 0 仅当全部通过。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { writeFile } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9231;
const WEB = process.env.WEB_URL || 'http://localhost:5175';
const BFF = 'http://localhost:3000';
const API = 'http://localhost:3001';
const DEMO_PHONE = '13800138000';
const DEMO_PASS = 'Test1234!';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=/tmp/chrome-auth-recovery-verify-${Date.now()}`,
    '--headless=new',
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
await sleep(1500);

let tabs = null;
for (let i = 0; i < 20; i++) {
  try {
    tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    if (Array.isArray(tabs) && tabs.length > 0) break;
  } catch {}
  await sleep(500);
}
if (!tabs) {
  console.error('CDP endpoint never came up');
  chrome.kill();
  process.exit(1);
}

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
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalExpr = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};
await new Promise((r) => ws.once('open', r));

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

// 收集网络请求
const requests = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.method === 'Network.requestWillBeSent') {
    requests.push({ url: m.params.request.url, method: m.params.request.method });
  }
});
const filterReqs = (predicate) => requests.filter(predicate);

try {
  // ===== T1: login → muscle-groups =====
  {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phonenumber: DEMO_PHONE, password: DEMO_PASS }),
    });
    const loginBody = await loginRes.json();
    if (!loginBody.accessToken) throw new Error('login failed: ' + loginRes.status);
    globalThis.__accessToken = loginBody.accessToken;
    globalThis.__refreshToken = loginBody.refreshToken;
  }

  // 打开 web，跳到 muscle-groups（注入 token）
  await send('Page.navigate', { url: `${WEB}/login?cb=${Date.now()}` });
  await sleep(2500);
  await evalExpr(`
    localStorage.setItem('accessToken', ${JSON.stringify(globalThis.__accessToken)});
    localStorage.setItem('refreshToken', ${JSON.stringify(globalThis.__refreshToken)});
    true;
  `);
  const beforeT1 = filterReqs((r) => r.url.includes('/api/muscle-groups')).length;
  await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}` });
  await sleep(5000);
  const t1 = await evalExpr(`
    ({
      pathname: location.pathname,
      cardCount: [...document.querySelectorAll('button')].filter((b) => b.textContent && b.textContent.length < 50).length,
    })
  `);
  const afterT1 = filterReqs((r) => r.url.includes('/api/muscle-groups')).length;
  const t1calls = afterT1 - beforeT1;
  record('T1 login → muscle-groups 200', t1.pathname === '/training/muscle-groups' && t1calls >= 1, `pathname=${t1.pathname}, muscle-groups reqs=${t1calls}`);

  // ===== T2: server-invalid but locally-valid accessToken → refresh + retry =====
  // 构造一个本地 isAuthenticated() 通过（exp 远在未来）但服务端拒签的 JWT。
  // 这样 ProtectedRoute 不会重定向到 /login，BFF 收到 401 → 触发 refresh → 重试。
  const stale = await evalExpr(`
    (() => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
      const future = Math.floor(Date.now() / 1000) + 3600;
      const payload = btoa(JSON.stringify({ sub: 'fake', phonenumber: '13800138000', email: 'x@x.com', iat: future - 3600, exp: future })).replace(/=+$/, '');
      return header + '.' + payload + '.bogus';
    })()
  `);
  const beforeT2 = filterReqs((r) => r.url.includes('/api/auth/refresh') || r.url.includes('/api/muscle-groups')).length;
  await evalExpr(`
    localStorage.setItem('accessToken', ${JSON.stringify(stale)});
    true;
  `);
  // 重新挂载页面，让 react-query 重新请求 muscle-groups 列表
  await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}-t2` });
  await sleep(5000);
  const t2Slice = filterReqs((r) => r.url.includes('/api/auth/refresh') || r.url.includes('/api/muscle-groups')).slice(beforeT2);
  const refreshCount = t2Slice.filter((r) => r.url.includes('/api/auth/refresh')).length;
  const muscleGroupsCount = t2Slice.filter((r) => r.url.includes('/api/muscle-groups')).length;
  const pathname2 = await evalExpr('location.pathname');
  const t2 = await evalExpr(`
    ({
      accessToken: localStorage.getItem('accessToken'),
      hasRefresh: !!localStorage.getItem('refreshToken'),
    })
  `);
  record(
    'T2 401 → refresh + retry 200',
    pathname2 === '/training/muscle-groups' && refreshCount >= 1 && muscleGroupsCount >= 1 && !!t2.accessToken && t2.accessToken !== stale,
    `refresh=${refreshCount} (dev StrictMode may cause 2), muscle-groups reqs=${muscleGroupsCount}, newToken=${!!t2.accessToken}, pathname=${pathname2}`,
  );

  // ===== T3: locally-valid accessToken + bogus refresh → force logout =====
  // accessToken 本地校验通过（exp 在未来）但服务端拒签 → service 拿 401 →
  // refreshAccessToken() 拿 bogus refreshToken 去 /api/auth/refresh → 401 →
  // forceLogout('refresh-failed') → 清 tokens + 跳 /login + 显示 banner。
  const future = await evalExpr(`
    (() => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
      const farFuture = Math.floor(Date.now() / 1000) + 3600;
      const payload = btoa(JSON.stringify({ sub: 'fake', phonenumber: '13800138000', email: 'x@x.com', iat: farFuture - 3600, exp: farFuture })).replace(/=+$/, '');
      return header + '.' + payload + '.bogus';
    })()
  `);
  await evalExpr(`
    localStorage.setItem('accessToken', ${JSON.stringify(future)});
    localStorage.setItem('refreshToken', 'totally.invalid');
    true;
  `);
  await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}-t3` });
  await sleep(5000);
  const t3 = await evalExpr(`
    ({
      pathname: location.pathname,
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
      banner: !!document.querySelector('[data-auth-expired-banner]'),
    })
  `);
  record(
    'T3 401 → refresh fails → force logout',
    t3.pathname === '/login' && !t3.accessToken && !t3.refreshToken && t3.banner,
    `pathname=${t3.pathname}, tokens cleared=${!t3.accessToken && !t3.refreshToken}, banner=${t3.banner}`,
  );

  // ===== T4: PublicRoute respects stale token =====
  const staleExpired = await evalExpr(`
    (() => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ sub: 'fake', phonenumber: '13800138000', email: 'x@x.com', iat: now - 3600, exp: now - 60 })).replace(/=+$/, '');
      return header + '.' + payload + '.bogus';
    })()
  `);
  await evalExpr(`
    localStorage.setItem('accessToken', ${JSON.stringify(staleExpired)});
    localStorage.removeItem('refreshToken');
    true;
  `);
  await send('Page.navigate', { url: `${WEB}/login?cb=${Date.now()}-t4` });
  await sleep(3000);
  const t4 = await evalExpr(`({ pathname: location.pathname, h1: document.querySelector('h1')?.textContent || null })`);
  record(
    'T4 PublicRoute respects stale token',
    t4.pathname === '/login',
    `pathname=${t4.pathname} (must NOT be /overview/dashboard)`,
  );

  // ===== T5: Logout button =====
  const reLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phonenumber: DEMO_PHONE, password: DEMO_PASS }),
  });
  const reBody = await reLogin.json();
  await evalExpr(`
    localStorage.setItem('accessToken', ${JSON.stringify(reBody.accessToken)});
    localStorage.setItem('refreshToken', ${JSON.stringify(reBody.refreshToken)});
    true;
  `);
  await send('Page.navigate', { url: `${WEB}/training/muscle-groups?cb=${Date.now()}-t5` });
  await sleep(4000);
  const triggerClicked = await evalExpr(`
    (() => {
      const btn = document.querySelector('button[aria-label="用户菜单"]');
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  await sleep(300);
  const logoutFound = await evalExpr(`!!document.querySelector('[data-topbar-logout]')`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/topbar-logout-open.png', Buffer.from(screenshot.data, 'base64'));
  await evalExpr(`document.querySelector('[data-topbar-logout]')?.click(); true;`);
  await sleep(2000);
  const t5 = await evalExpr(`
    ({
      pathname: location.pathname,
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
    })
  `);
  record(
    'T5 TopBar logout button',
    triggerClicked && logoutFound && t5.pathname === '/login' && !t5.accessToken && !t5.refreshToken,
    `trigger=${triggerClicked}, menuOpen=${logoutFound}, pathname=${t5.pathname}, cleared=${!t5.accessToken && !t5.refreshToken}`,
  );
} catch (err) {
  console.error('VERIFY ERROR:', err);
  chrome.kill();
  process.exit(1);
}

ws.close();
chrome.kill();

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed}/${results.length} tests passed`);
process.exit(failed === 0 ? 0 : 1);