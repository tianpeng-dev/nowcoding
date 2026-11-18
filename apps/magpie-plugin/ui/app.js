const element = (id) => document.getElementById(id);
const token = document.querySelector('meta[name=nowcoding-page]').content;
document.documentElement.dataset.theme = new URL(location.href).searchParams.get('theme');
const fmt = (n) => new Intl.NumberFormat('zh-CN').format(n);
async function call(action, body = null) {
  const response = await fetch(`api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-NowCoding-Page': token },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
function status(text, error = false) {
  element('status').textContent = text;
  element('status').dataset.error = String(error);
}
function event(id, fn, type = 'click') {
  element(id).addEventListener(type, async (e) => {
    e.preventDefault();
    const control = e.submitter ?? e.currentTarget;
    control.disabled = true;
    try {
      await fn();
    } catch (err) {
      status(err.message, true);
    } finally {
      control.disabled = false;
    }
  });
}
function rows(id, data) {
  const items = data.map(([label, value]) => {
    const li = document.createElement('li');
    for (const text of [label, value]) {
      const span = document.createElement('span');
      span.textContent = text;
      li.append(span);
    }
    return li;
  });
  element(id).replaceChildren(...items);
}
let state;
async function update() {
  state = await call('state');
  const choices = state.availableSources.map(({ source, displayName }) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = source;
    input.checked = state.sources.includes(source);
    label.append(input, ` ${displayName}`);
    return label;
  });
  element('choices').replaceChildren(...choices);
  element('connection').textContent = state.device
    ? [state.device.username, state.device.endpoint].filter(Boolean).join(' · ')
    : '仅在本机查看';
  element('sync-time').textContent = state.lastSync
    ? `最近成功同步 ${new Date(state.lastSync).toLocaleString()}`
    : '尚无同步记录';
  element('sync-error').textContent = state.lastError || '';
  element('sync').disabled = !state.device || !state.sources.length;
  element('share-state').textContent = state.profile || '连接 Cloud 或自托管服务后可使用公开主页。';
  element('share').hidden = !state.profile;
  element('markdown').value = state.profile
    ? `[![NowCoding](${state.profile}/card.svg)](${state.profile})`
    : '';
  for (const node of document.querySelectorAll('[data-open=settings],[data-open=devices]'))
    node.hidden = state.device?.mode !== 'cloud';
}
async function refresh() {
  await update();
  status('正在读取所选工具…');
  const result = await call('activity');
  element('today').textContent = fmt(result.days.at(-1).tokens);
  element('active').textContent = fmt(result.activeDays);
  element('cost').textContent = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(result.costUsd);
  element('unpriced').textContent = result.unpricedTokens
    ? `${fmt(result.unpricedTokens)} Token 缺少模型价格，未计入估算费用。`
    : '';
  rows(
    'days',
    result.days.map((day) => [day.day, fmt(day.tokens)]),
  );
  rows(
    'models',
    result.models.map(([model, count]) => [model, fmt(count)]),
  );
  element('tools').open = !state.sources.length;
  status(
    result.errors.map((e) => `${e.source} · ${e.message}`).join('\n') ||
      (state.sources.length ? '' : '请选择要查看的本机工具。'),
    result.errors.length > 0,
  );
}
let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    while ((await call('poll')).pending) await new Promise((done) => setTimeout(done, 2000));
    await update();
    status('设备已连接。');
  } finally {
    polling = false;
  }
}
event(
  'save-sources',
  async () => {
    await call(
      'sources',
      [...element('choices').querySelectorAll(':checked')].map((x) => x.value),
    );
    await refresh();
  },
  'click',
);
event('refresh', refresh);
event('sync', async () => {
  status('正在同步…');
  const result = await call('sync');
  await update();
  status(`已同步 ${result.buckets} 个用量时间段和 ${result.sessions} 个会话。`);
});
event('login', async () => {
  await call('login', { arena: element('arena').checked });
  status('请在系统浏览器完成 GitHub 授权。');
  await poll();
});
event(
  'connect-self',
  async () => {
    await call('self-host', Object.fromEntries(new FormData(element('selfhost'))));
    element('selfhost').reset();
    await update();
    status('自托管设备已连接。');
  },
  'click',
);
event('copy', async () => {
  element('markdown').select();
  if (!document.execCommand('copy')) {
    status('已选中代码，请使用系统复制快捷键。');
    return;
  }
  status('嵌入代码已复制。');
});
for (const button of document.querySelectorAll('[data-open]'))
  button.onclick = () => call('open', button.dataset.open).catch((e) => status(e.message, true));
for (const button of document.querySelectorAll('[data-tab]'))
  button.onclick = () => {
    for (const tab of document.querySelectorAll('[data-tab]')) {
      const active = tab === button;
      tab.setAttribute('aria-pressed', String(active));
      element(tab.dataset.tab).hidden = !active;
    }
  };
refresh()
  .then(() => {
    if (state.pendingLogin) return poll();
  })
  .catch((e) => status(e.message, true));
