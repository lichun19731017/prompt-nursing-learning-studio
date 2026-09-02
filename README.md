# Prompt 小組共學室

「教 AI 聽懂你的任務｜Prompt 設計與迭代」課程的小組學習網站。

[開啟目前網站](https://prompt-nursing-learning-studio.lichunlee.chatgpt.site) · [教師操作稿](教師操作稿.md)

## 課堂使用

- A、B、C、D 四班，每班六組。
- 個人練習 9 分鐘 → 兩人比較 3 分鐘 → 小組整合 4 分鐘 → 教師回饋 2 分鐘。
- 兩人比較卡必填兩位姓名，記錄 Prompt 修改、回答差異及依講義查證的結果。
- 小組共同結論引用本組比較卡，由組員討論並確認。
- 教師可閱讀各組成果並匯出 CSV，包含兩位姓名。
- 講義由任課教師提供，未在此儲存庫附上。

原提交裝置可修訂自己的成果；版本檢查防止同時修改互相覆蓋。班級選單是導覽，教師總覽是唯讀檢視，兩者都不是身分認證。

## GitHub 與執行環境

此儲存庫保存程式、資料表結構及教師操作稿，不包含學生實際提交資料。
網站使用 Vinext／React、Cloudflare Workers 與 D1，現有網站由 Sites 執行，目前僅擁有者可存取。將程式保存到 GitHub 不會改變網站分享權限；學生上課前仍需另行確認存取設定。

本專案包含伺服器 API 與共用資料庫，不能直接當作完整功能的 GitHub Pages 網站。GitHub Pages 是靜態網站服務，說明見 [GitHub 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。若日後改用其他主機，需設定相容的 Workers 執行環境及 D1 綁定。

## 本機執行

需求：Node.js 22.13.0 以上、pnpm。以下指令均在專案根目錄執行。

```sh
pnpm install --frozen-lockfile
```

全新的本機資料庫請依序套用遷移；已套用的遷移不要重複執行：

```sh
pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/state --config .openai/local-wrangler.json --file drizzle/0000_material_cable.sql
pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/state --config .openai/local-wrangler.json --file drizzle/0001_little_proudstar.sql
pnpm dev
```

開啟終端機顯示的網址。班級連結可使用 `?class=A&group=1`，班級支援 A–D，小組支援 1–6；舊數字班級網址亦相容。

## 檢查

```sh
pnpm exec tsc --noEmit
pnpm build
node -e "require('fs').mkdirSync('outputs',{recursive:true})"
node scripts/verify-class-labels.mjs
```

啟動本機網站後，可另開終端機執行 API 測試。測試固定連線至 localhost:3000，請使用測試用本機資料庫，保留 D 班第 6 組為空白：

```sh
node scripts/verify-workflow.mjs
pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/state --config .openai/local-wrangler.json --file .openai/test-cleanup.sql
```

API 測試包含兩位姓名必填、固定兩人、班級查詢與引用限制、重複提交、修訂權限、版本衝突及姓名讀回。測試完成後以產生的清理檔移除本次合成測試資料。

## 檔案

- `app/`：網頁與提交 API。
- `lib/`：資料型別、D1 存取與 CSV 匯出。
- `db/`、`drizzle/`：資料表定義與遷移。
- `教師操作稿.md`：教學流程。
- `HANDOFF.md`：目前進度與接手說明。
- `.openai/hosting.json`：既有 Sites 專案識別及邏輯綁定，不含金鑰。

`.env*`、本機資料庫、產出目錄及測試清理檔已排除。請勿將學生名單、提交資料、金鑰或存取權杖加入儲存庫。

