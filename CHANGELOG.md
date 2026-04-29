# CHANGELOG

本檔案記錄「字軌越界判斷工具」每個 Sprint 的進度。

## Sprint 3 — 判斷邏輯 + 三色結果卡片 (2026-04-29)

- `app.js` 加上 `judgeNumber(input, current)`(SPEC 6-3 虛擬碼):依 `mrt_*` / `shop_*` 範圍回傳 `MRT_OK` / `SHOP_BLOCK` / `NOT_FOUND`
- `app.js` 加上 `renderResult(verdict, inputNumber)`:用 `createElement` 動態渲染三色卡片(避開 innerHTML XSS)
- 卡片內容(SPEC 7-3):
  - 綠 #16A34A、✅、「可以開」+「{號碼} 在當期捷運範圍內」
  - 珊瑚紅 #E76F51、⚠️、「不要開,這是二店的」+「{號碼} 屬於二店 iChef 範圍」
  - 芥末黃 #E9C46A(深灰文字)、❓、「查無此號碼,請確認」+「{號碼} 不在當期任何範圍內,可能是過期或打錯」
- 「再查一次」按鈕:清空輸入框 + 清空結果區 + focus 回輸入框
- `style.css` 加 `.card`、`.card--green/red/yellow`、`.card--visible`(opacity + transform 0.2s 平滑淡入)
- 副標號碼用等寬字體(SF Mono / Menlo,SPEC 第 8 節 Sprint 3 注意事項)
- 驗證:
  - 三色判斷路徑(綠/紅/黃)各自正確
  - 4 個邊界值(54016300、54041499、54041500、54066499)分界線判定正確
  - 「再查一次」三件事(清空輸入、清空卡片、focus)全部到位
  - 手機 viewport 375x812 顯示正常,觸控區大於 44pt

## Sprint 2 — 前端骨架完成 (2026-04-29)

- `public/index.html`:標題、期別小字、前綴標籤(初始「載入中」)、純數字輸入框(`inputmode="numeric"` `maxlength="8"`)、查詢按鈕、結果區、頂部錯誤橫幅
- `public/app.js`:
  - 載入時 fetch `/api/current-issuance`,把 prefix 與 period 寫進畫面
  - input 事件即時過濾非數字 + 截斷至 8 碼
  - 按查詢時先做空白(SPEC F3)與長度(SPEC F4)檢查,再 fetch 一次拿最新資料
  - API 失敗 / 主檔異常時:紅色橫幅 + 查詢按鈕變灰(SPEC F9 / F10)
  - 在輸入框按 Enter 也觸發查詢(配合手機鍵盤的「完成」)
  - 三色判斷卡片暫不渲染,僅 console.log 出當期資料(留給 Sprint 3)
- `public/style.css`:依 SPEC 第 7 節設計
  - 米白底 `#FAF7F2`、深灰文字 `#1F2937`
  - 觸控區 64px(超過 44pt 最低標準)
  - 大圓角(輸入框 / 按鈕 12px)、粗字(700+)
  - 號碼用等寬字體(SF Mono / Menlo)
  - 手機優先 viewport,容器最大寬 480px
  - 全域 `[hidden]{display:none!important}`,避免 `display:flex` 覆蓋 `hidden` 屬性
- 驗證:7 條 Sprint 2 驗收標準全部通過(前綴載入、期別顯示、輸入過濾、空白/長度提示、API 整合、錯誤橫幅+按鈕禁用)

## Sprint 1 — Notion API 串接完成 (2026-04-29)

- 實作 `api/current-issuance.js`:用 Notion REST API 查詢「狀態 = 進行中」紀錄
  - 用 fetch 直打 REST API(`Notion-Version: 2025-09-03`),不依賴 SDK 版本差異
  - 中文欄位 → 英文標準欄位 mapping(SPEC 第 5-1 節對照表)
  - 完整處理 4 種錯誤:`NO_ACTIVE_PERIOD` / `MULTIPLE_ACTIVE_PERIODS` / `MISSING_FIELDS` / `NOTION_API_FAILED`
  - 加上 CORS headers
- 新增 `dev-server.js`:本機開發伺服器,模擬 Vercel routing(`/` 服務 `public/`、`/api/*` 動態載入 `api/*.js`)。取代 `vercel dev`,避免初次互動式設定的卡關
- `package.json` 加 `"type": "module"` 改用 ES Modules,scripts 加 `npm run dev`
- 安裝 `dotenv`(本機讀 `.env`,Vercel 部署不需要)
- 驗證:
  - 成功路徑 → `{ ok: true, data: { period: "2026 年 5-6 月期", prefix: "AY", shop_start: 54016300, shop_end: 54041499, mrt_start: 54041500, mrt_end: 54066499 } }`
  - 故意改錯 token → `{ ok: false, error: "NOTION_API_FAILED", message: "無法連線到字軌主檔" }`

## Sprint 0 — 環境建置完成 (2026-04-28)

- 建立資料夾結構:`public/`、`api/`
- 建立空檔案:`public/index.html`、`public/style.css`、`public/app.js`、`api/current-issuance.js`
- 建立 `package.json`,安裝 `@notionhq/client`(production)、`vercel`(dev)
- 建立 `.env.example`、`.gitignore`、`.env`(NOTION_TOKEN 留空待填入)
- 建立 `vercel.json` 基本設定
- `index.html` 顯示「字軌越界判斷工具」標題作為冒煙測試頁面
- 建立本 `CHANGELOG.md`
