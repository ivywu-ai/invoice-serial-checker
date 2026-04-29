// /api/current-issuance — 取得當期字軌資料
// 實作 SPEC 第 6-4 節虛擬碼:查 Notion 字軌主檔「狀態=進行中」紀錄,標準化欄位後回傳
//
// 部署:Vercel Serverless Function(讀 process.env.NOTION_TOKEN / NOTION_DATA_SOURCE_ID)
// 本機:由 dev-server.js 載入,介面相容

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

// ⚠️ 欄位名稱直接對應 Notion 主檔(SPEC 第 5-1 節對照表)
// 「二店 iChef 範圍起/迄」中間是半形空格(已用診斷腳本確認)
const FIELDS = {
  PERIOD: '期別',
  PREFIX: '字軌前綴',
  SHOP_START: '二店 iChef 範圍起',
  SHOP_END: '二店 iChef 範圍迄',
  MRT_START: '捷運範圍起',
  MRT_END: '捷運範圍迄',
  STATUS: '狀態',
};

const STATUS_ACTIVE = '進行中';

export default async function handler(req, res) {
  // CORS — 同源理論上不需要,保險起見加上(SPEC 第 8 節 Sprint 1 第 5 點)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const token = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!token || !dataSourceId) {
    res.status(200).json({
      ok: false,
      error: 'NOTION_API_FAILED',
      message: '伺服器環境變數未設定(NOTION_TOKEN / NOTION_DATA_SOURCE_ID)',
    });
    return;
  }

  try {
    const apiRes = await fetch(`${NOTION_API_URL}/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: FIELDS.STATUS,
          select: { equals: STATUS_ACTIVE },
        },
      }),
    });

    if (!apiRes.ok) {
      const body = await apiRes.text();
      console.error('Notion API non-OK:', apiRes.status, body);
      res.status(200).json({
        ok: false,
        error: 'NOTION_API_FAILED',
        message: '無法連線到字軌主檔',
      });
      return;
    }

    const data = await apiRes.json();
    const results = data.results || [];

    if (results.length === 0) {
      res.status(200).json({
        ok: false,
        error: 'NO_ACTIVE_PERIOD',
        message: '字軌主檔沒有進行中期別',
      });
      return;
    }
    if (results.length > 1) {
      res.status(200).json({
        ok: false,
        error: 'MULTIPLE_ACTIVE_PERIODS',
        message: '字軌主檔有多筆進行中期別',
      });
      return;
    }

    const props = results[0].properties;

    // 中文欄位 → 英文標準欄位(SPEC 第 5-2 節格式)
    const period = props[FIELDS.PERIOD]?.title?.[0]?.plain_text ?? null;
    const prefix = props[FIELDS.PREFIX]?.rich_text?.[0]?.plain_text ?? null;
    const shop_start = props[FIELDS.SHOP_START]?.number ?? null;
    const shop_end = props[FIELDS.SHOP_END]?.number ?? null;
    const mrt_start = props[FIELDS.MRT_START]?.number ?? null;
    const mrt_end = props[FIELDS.MRT_END]?.number ?? null;

    // 必要欄位檢查
    // 注意:prefix 為空仍允許(SPEC E11 — 顯示「(前綴未設定)」標籤,但仍可查詢)
    const missing = [];
    if (period === null) missing.push(FIELDS.PERIOD);
    if (shop_start === null) missing.push(FIELDS.SHOP_START);
    if (shop_end === null) missing.push(FIELDS.SHOP_END);
    if (mrt_start === null) missing.push(FIELDS.MRT_START);
    if (mrt_end === null) missing.push(FIELDS.MRT_END);

    if (missing.length > 0) {
      res.status(200).json({
        ok: false,
        error: 'MISSING_FIELDS',
        message: `當期字軌欄位不完整:缺 ${missing.join('、')}`,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: { period, prefix, shop_start, shop_end, mrt_start, mrt_end },
    });
  } catch (e) {
    console.error('NOTION_API_FAILED exception:', e);
    res.status(200).json({
      ok: false,
      error: 'NOTION_API_FAILED',
      message: '無法連線到字軌主檔',
    });
  }
}
