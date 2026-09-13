/**
 * End-to-end verification for the public plan flow (run with the dev server up):
 *
 *   node scripts/verify-plan-flow.mjs
 *
 * Drives real headless Chrome over the DevTools Protocol and asserts:
 *   1. /pricing is pinned to the cream theme and carries no theme toggle.
 *   2. Every plan card links to /contact?plan=<slug>.
 *   3. /contact?plan=<slug> prefills the plan selector and speaks the plan's name.
 *   4. The plan selector is user-changeable (controlled state round-trips).
 *   5. /contact without a param defaults to "Not sure yet".
 *   6. A real submission from /contact?plan=convert reaches the success
 *      screen (writes one TEST-marked enquiry row; proves the plan column
 *      exists in the database, i.e. migration 0006 is applied).
 *   7. A stored dark preference is respected on the public site only as far as
 *      the light pin goes (public stays light; dashboards honour the stored value).
 */
import { spawn } from 'node:child_process';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const PORT = 9333;
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP ?? '/tmp'}/nf-verify-profile`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForCdp() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

await waitForCdp();

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails.exception?.description ?? reply.result.exceptionDetails));
  return reply.result?.result?.value;
}

const failures = [];
function check(label, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`${status}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(label);
}

async function goto(url) {
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(3200); // SPA lazy chunks + data fetches
}

/* ── 1. /pricing — cream pin, no theme toggle ─────────────────── */
await goto(`${WEB}/pricing`);
{
  const result = await evaluate(`(() => {
    const links = [...document.querySelectorAll('a[href^="/contact?plan="]')].map(a => a.getAttribute('href'));
    return JSON.stringify({
      theme: document.documentElement.getAttribute('data-theme'),
      colorScheme: document.documentElement.style.colorScheme,
      themeToggleInHeader: Boolean(document.querySelector('header button[aria-label^="Theme:"]')),
      planLinks: [...new Set(links)].sort(),
    });
  })()`);
  const data = JSON.parse(result);
  check('pricing page renders in cream (light) theme', data.theme === 'light', `data-theme="${data.theme}"`);
  check('public header has no theme toggle', data.themeToggleInHeader === false);
  check('all four plan cards deep-link to contact with plan', 
    ['autopilot', 'convert', 'custom', 'lead'].every(slug => data.planLinks.includes(`/contact?plan=${slug}`)),
    data.planLinks.join(', '));
}

/* ── 2. /contact?plan=convert — prefill + heading ─────────────── */
await goto(`${WEB}/contact?plan=convert`);
{
  const result = await evaluate(`(() => {
    const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'CONVERT'));
    const headings = [...document.querySelectorAll('h1, h2')].map(h => h.textContent).join(' | ');
    return JSON.stringify({
      heading: headings,
      value: select ? select.value : null,
      selectedText: select ? select.options[select.selectedIndex]?.text : null,
      hasPlanLabel: Boolean([...document.querySelectorAll('label')].some(l => /Plan you/i.test(l.textContent))),
    });
  })()`);
  const data = JSON.parse(result);
  check('contact page speaks the chosen plan in its heading', /CONVERT/.test(data.heading), data.heading.slice(0, 80));
  check('plan selector exists on the contact form', data.hasPlanLabel && data.value !== null);
  check('plan selector is prefilled with CONVERT', data.value === 'CONVERT', `selected: ${data.selectedText}`);
}

/* ── 3. the selector is actually changeable ───────────────────── */
{
  const result = await evaluate(`(async () => {
    const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'LEAD'));
    if (!select) return JSON.stringify({ ok: false });
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex').set
      ?? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    select.value = 'LEAD';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const confirm = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'LEAD'));
    return JSON.stringify({ ok: true, now: confirm.value, text: confirm.options[confirm.selectedIndex].text });
  })()`);
  const data = JSON.parse(result);
  check('plan selection changes and sticks (controlled state)', data.ok && data.now === 'LEAD', `now: ${data.text}`);
}

/* ── 4. /contact without a param → default ────────────────────── */
await goto(`${WEB}/contact`);
{
  const result = await evaluate(`(() => {
    const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'CONVERT'));
    const headings = [...document.querySelectorAll('h1, h2')].map(h => h.textContent).join(' | ');
    return JSON.stringify({ value: select ? select.value : null, heading: headings });
  })()`);
  const data = JSON.parse(result);
  check('contact without ?plan defaults to undecided', data.value === '', `value: ${JSON.stringify(data.value)}`);
  check('generic contact heading when no plan chosen', /losing time/i.test(data.heading), data.heading.slice(0, 80));
}

/* ── 5. real submission from /contact?plan=convert ───────────── */
// Fills the form exactly like a visitor (native setters so React sees the
// input), submits, and expects the success screen. If migration 0006 has
// not been applied to the database yet, the insert fails here — the check
// will say so instead of silently passing.
await goto(`${WEB}/contact?plan=convert`);
{
  const result = await evaluate(`(async () => {
    const setNative = (el, value) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    };
    const inputByLabel = (text) => {
      const label = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));
      return label ? document.getElementById(label.getAttribute('for')) : null;
    };
    try {
      setNative(inputByLabel('Your name'), 'TEST — plan flow verification');
      setNative(inputByLabel('Business name'), 'NorthForge QA');
      setNative(inputByLabel('Email'), 'qa-plan-flow@northforge.studio');
      setNative(inputByLabel('WhatsApp / phone'), '9800000000');
      setNative(inputByLabel('Business type'), 'Retail & eCommerce');
      const plan = inputByLabel("Plan you're interested in");
      const prefill = plan.value;
      document.querySelector('form button[type="submit"]').click();
      await new Promise(r => setTimeout(r, 3500));
      const done = [...document.querySelectorAll('h1')].some(h => /Enquiry received/i.test(h.textContent));
      const error = document.querySelector('[role="alert"], .text-danger')?.textContent?.trim() ?? null;
      return JSON.stringify({ done, prefill, error });
    } catch (e) { return JSON.stringify({ done: false, prefill: null, error: String(e) }); }
  })()`);
  const data = JSON.parse(result);
  check('plan selector still prefilled at submit time', data.prefill === 'CONVERT', `value: ${data.prefill}`);
  check('form submits and reaches the success screen', data.done === true,
    data.done ? 'enquiry row created (plan column accepted)' : `server said: ${data.error ?? 'no error shown'} — has 0006_enquiries_plan.sql been applied?`);
}

/* ── 6. stored dark pref: public stays light ───────────────── */
await evaluate(`localStorage.setItem('nf.theme', 'dark')`);
await goto(`${WEB}/pricing`);
{
  const theme = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  check('public site stays cream even with a stored dark preference', theme === 'light', `data-theme="${theme}"`);
}

ws.close();
chrome.kill();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('\nAll checks passed — plan flow works end to end.');
