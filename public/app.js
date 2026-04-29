// 字軌越界判斷工具 — 前端邏輯
// - 載入時 fetch /api/current-issuance,把 prefix 與 period 寫進畫面
// - 輸入框只允許數字
// - 按查詢時:空白 / 長度檢查 → 重新拉 API → 判斷 → 渲染三色卡片
// - API 失敗時:紅色橫幅 + 查詢按鈕變灰

const API_URL = '/api/current-issuance';

const els = {
  periodLabel: document.getElementById('period-label'),
  prefixLabel: document.getElementById('prefix-label'),
  input: document.getElementById('number-input'),
  button: document.getElementById('query-button'),
  hint: document.getElementById('hint'),
  result: document.getElementById('result'),
  errorBanner: document.getElementById('error-banner'),
  errorBannerText: document.getElementById('error-banner-text'),
};

// ── 工具函式 ────────────────────────────────────
function showHint(text) {
  els.hint.textContent = text;
  els.hint.hidden = false;
}

function hideHint() {
  els.hint.textContent = '';
  els.hint.hidden = true;
}

function clearResult() {
  els.result.innerHTML = '';
}

function showErrorBanner(errorCode, message) {
  els.errorBannerText.textContent = `${message}(${errorCode})`;
  els.errorBanner.hidden = false;
  els.button.disabled = true;
}

function hideErrorBanner() {
  els.errorBanner.hidden = true;
  els.button.disabled = false;
}

// ── API 呼叫 ────────────────────────────────────
async function fetchCurrentIssuance() {
  const res = await fetch(API_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// ── 流程 1:頁面載入 ────────────────────────────
async function loadInitial() {
  try {
    const json = await fetchCurrentIssuance();
    if (!json.ok) {
      showErrorBanner(json.error, json.message);
      return;
    }
    applyIssuance(json.data);
  } catch (e) {
    console.error('載入當期失敗:', e);
    showErrorBanner('NOTION_API_FAILED', '無法連線到字軌主檔');
  }
}

function applyIssuance(data) {
  hideErrorBanner();
  els.periodLabel.textContent = data.period || '(未設定期別)';
  // SPEC E11:前綴空白時顯示「(前綴未設定)」,但仍允許查詢
  els.prefixLabel.textContent = data.prefix && data.prefix.trim()
    ? data.prefix
    : '(前綴未設定)';
}

// ── 流程 2:輸入框只允許數字 ─────────────────────
els.input.addEventListener('input', (e) => {
  const filtered = e.target.value.replace(/\D/g, '').slice(0, 8);
  if (filtered !== e.target.value) {
    e.target.value = filtered;
  }
  // 使用者重新打字 → 清掉舊提示與舊結果
  hideHint();
  clearResult();
});

// ── 流程 3:按查詢 ───────────────────────────────
async function onQuery() {
  if (els.button.disabled) return;

  const value = els.input.value.trim();
  clearResult();

  // SPEC F3:空白
  if (value.length === 0) {
    showHint('請輸入號碼');
    els.input.focus();
    return;
  }
  // SPEC F4:長度非 8
  if (value.length !== 8) {
    showHint('號碼長度不對,請確認');
    els.input.focus();
    return;
  }

  hideHint();

  // SPEC E7:每次按查詢都重新拉 Notion(不快取)
  let json;
  try {
    json = await fetchCurrentIssuance();
  } catch (e) {
    console.error('查詢時 API 連線失敗:', e);
    showErrorBanner('NOTION_API_FAILED', '無法連線到字軌主檔');
    return;
  }

  if (!json.ok) {
    showErrorBanner(json.error, json.message);
    return;
  }

  // 拿到最新資料,順手刷新前綴與期別(處理 E7:皮皮中途切換期別)
  applyIssuance(json.data);

  // 判斷並渲染結果卡片
  const verdict = judgeNumber(value, json.data);
  renderResult(verdict, value);
}

// ── 判斷邏輯(SPEC 6-3) ─────────────────────────
function judgeNumber(input, current) {
  const num = parseInt(input, 10);
  if (current.mrt_start <= num && num <= current.mrt_end) return 'MRT_OK';
  if (current.shop_start <= num && num <= current.shop_end) return 'SHOP_BLOCK';
  return 'NOT_FOUND';
}

// ── 結果卡片渲染(SPEC 7-3) ─────────────────────
const VERDICT_VIEW = {
  MRT_OK: {
    cardClass: 'card card--green',
    icon: '✅',
    title: '可以開',
    subtitle: (n) => `${n} 在當期捷運範圍內`,
  },
  SHOP_BLOCK: {
    cardClass: 'card card--red',
    icon: '⚠️',
    title: '不要開,這是二店的',
    subtitle: (n) => `${n} 屬於二店 iChef 範圍`,
  },
  NOT_FOUND: {
    cardClass: 'card card--yellow',
    icon: '❓',
    title: '查無此號碼,請確認',
    subtitle: (n) => `${n} 不在當期任何範圍內,可能是過期或打錯`,
  },
};

function renderResult(verdict, inputNumber) {
  const view = VERDICT_VIEW[verdict];
  if (!view) return;

  // 用 createElement 而非 innerHTML,避免任何 XSS 風險
  els.result.innerHTML = '';

  const card = document.createElement('div');
  card.className = view.cardClass;
  card.setAttribute('role', 'status');

  const icon = document.createElement('div');
  icon.className = 'card__icon';
  icon.textContent = view.icon;

  const title = document.createElement('div');
  title.className = 'card__title';
  title.textContent = view.title;

  const subtitle = document.createElement('div');
  subtitle.className = 'card__subtitle';
  subtitle.textContent = view.subtitle(inputNumber);

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'card__again';
  again.textContent = '再查一次';
  again.addEventListener('click', resetForNewQuery);

  card.append(icon, title, subtitle, again);
  els.result.appendChild(card);

  // 平滑淡入(SPEC 第 8 節 Sprint 3 注意事項)
  requestAnimationFrame(() => card.classList.add('card--visible'));
}

// ── 「再查一次」:清空輸入、清空卡片、focus 輸入框 ──
function resetForNewQuery() {
  els.input.value = '';
  hideHint();
  clearResult();
  els.input.focus();
}

els.button.addEventListener('click', onQuery);

// 在輸入框按 Enter 也觸發查詢(手機鍵盤的「完成」/「Go」也會送 Enter)
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    onQuery();
  }
});

// ── 啟動 ────────────────────────────────────────
loadInitial();
