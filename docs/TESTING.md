# 驗證報告

最近核對日期：2026-10-04。以下為實際執行結果，非預期結果；歷史紀錄各自對應當時版本與驗證範圍。

## 2026-10-04 GitHub 上傳前核對

- 版本仍為 1.0.10；本輪補充 README 的功能概述、使用優點及適用情境，整理 Git 忽略規則，未修改應用程式行為。
- `npm run test` 通過：8 個測試檔、63 個測試。
- `npm run lint` 通過，無診斷訊息。
- `npm run build` 通過，TypeScript 檢查及 Vite 正式建置完成。
- 本輪未重跑瀏覽器 E2E 或 Mac／Windows 帳號同步驗收；以下歷史紀錄保留各次實際驗證範圍。

## 1.0.10 左右整列拖曳

- build／TypeScript strict／lint 通過；4 組相關隔離 Chromium 整合測試通過，包含 2 組新增左右列操作與既有 2 組主要工作台回歸。
- 左側 Space 名稱與圖示可啟動上下排序；拖曳不切換選取項目，Escape 保留順序，普通點擊與選單操作正常，重載後順序保存。
- 右側分頁名稱與 favicon 可拖入分類；原分頁不關閉、拖曳不啟用該分頁，取消不新增書籤；一般點擊可切換分頁，省略號選單仍可開啟，Chrome 內部頁面不啟動拖曳。
- 既有小把手拖曳、原生新增／移動／刪除／Undo／備份／Save & Close 回歸通過。未修改儲存模型，未另增單元測試。
- 1.0.10 ZIP 版本、CRC、SHA-256 與 dist／安裝文件一致性通過。本輪為本機回歸；下方使用者整體實機驗收對應 1.0.9。

## 使用者實機驗收與最終交付核對

- 2026-09-28，使用者回覆「驗證沒問題」，確認此前等待的 Windows 新版與 Mac／Windows 雙向同步實機驗收。未提供逐項紀錄、Chrome 版本或使用時長，依據與範圍詳見 DEVICE_ACCEPTANCE.md。
- 本輪核對規格對照表、測試覆蓋、Manifest 權限與 source-of-truth／事件處理，以及 1.0.9 ZIP 的 CRC／SHA-256、版本、Manifest 與 dist 逐檔一致性。沒有修改程式或重新打包，既有測試結果適用；未重複執行測試。
- 歷史報告中的「待實機」是當時狀態，以本節的使用者確認為最新狀態。

## 1.0.9 安裝文件補充

- 新增 docs/INSTALL.md，涵蓋 Windows／Mac 固定位置、首次安裝、搬移、同路徑更新與資料所在位置。ZIP 安裝說明由同一文件產生。
- 本輪只更新文件及包裝文字；未重跑 UI 測試。重新打包後逐檔比對 dist 程式內容一致，安裝說明與來源文件一致，CRC／版本／SHA-256 通過。
- 使用者取消的書籤說明欄位已記錄為不納入待辦；Windows 重測與 Mac ↔ Windows 帳號同步尚未取得新證據。

## 1.0.9 頂部精簡

- build／TypeScript strict／lint 通過；既有矮視窗與直接拖曳 2 組瀏覽器回歸通過。
- 移除拖曳說明與 WORKSPACE／LOCAL FIRST 頂列後，工作區名稱、數量、新增按鈕保留；已檢視縮減留白的畫面。右側展開按鈕不與新增按鈕重疊。
- 本次僅調整文案與版面，未新增單元測試。1.0.9 ZIP 版本與完整性通過。

[精簡頂部](compact-header-1.0.9.png)

## 1.0.8 左側收合與直接排序

- build／TypeScript strict／lint 通過；8 個測試檔、63 個單元與元件測試通過。舊版設定預設顯示左欄，明確收合值能保存，無效值回復預設。
- 6 組相關隔離 Chromium 回歸通過：Collection 鍵盤排序、書籤一般／背景／中鍵開啟、邊緣自動捲動與 Escape、左側字級、收合、新的直接拖曳。最後調整把手及插入線位置後，再跑收合、直接拖曳、鍵盤排序 3 組通過。
- 左側收合後工作台增加寬度、重新載入仍收合；設定可開啟，搜尋圖示與 `/` 都會展開且聚焦搜尋框，原本 300px 欄寬保留。1280／1000／768px 寬、494px 高、右欄開關組合無橫向溢出。
- 滑鼠直接拖曳 Collection 標題上下排序、書籤卡片前後排序及跨分類移動，Chrome 原生順序在重載後保留；拖曳不開分頁，Escape 不移動，普通點擊分類仍可摺疊。
- Collection 原有負 margin 使把手在 content-visibility 的繪製邊界外被裁切，已改為邊界內；上下插入線同樣放在分類範圍內。已檢視收合及拖曳中截圖。
- 首次 TypeScript 發現 dnd-kit listener 型別過寬，已改用有型別的事件包裝函式；尚未更新 dist 的測試已中止，未計入通過結果。
- 1.0.8 安裝包 CRC／版本／SHA-256 通過，內容與測試 dist 一致；跨裝置與 Windows 實機驗收狀態不變。

[左側收合](sidebar-collapsed-1.0.8.png) · [分類拖曳與下方插入線](sorting-in-progress-1.0.8.png)

## 1.0.7 Toby 匯入驗證

- build／TypeScript strict／lint 通過；8 個測試檔、62 個單元與元件測試通過。新增格式辨識、名稱／順序／重複 URL／空分類、筆記與不支援網址提示、損壞檔案與未知版本拒絕、數量上限及 BOM 測試。
- 4 組相關隔離 Chromium 測試通過：原生備份往返、矮視窗回歸、Toby 預覽／取消／追加／重載、使用者實際匯出檔。預覽加寬與字級調整後，另重跑 2 組 Toby 測試。
- 使用下載資料夾的 Toby v3 匯出檔，以臨時瀏覽器設定檔實際匯入並讀回原生書籤：4 個分類、41 個網址的順序、customTitle 優先名稱及完整網址均一致。檔案本身未修改；私人內容未加入測試 fixture 或文件。
- 該檔案包含 1 張筆記卡片與 12 個自訂說明，預覽明示不匯入；41 個書籤仍保留名稱與網址。取消不寫入，確認後既有 Space 不受覆蓋，重新載入後資料仍存在。
- 預覽限制文字依整體字級顯示（16px 驗證）；494px 高度可捲動到操作按鈕。已檢視匿名範例截圖。
- 1.0.7 ZIP CRC／版本及 SHA-256 通過；Windows 與跨裝置同步驗收狀態不變。

[匿名 Toby 匯入預覽](toby-import-preview-1.0.7.png)

## 1.0.6 矮視窗版面驗證

- 先以 1280×494、左側 16px 重現 Spaces 第一列裁切，修正前完整可見比例只有約 64%；加入中段捲動容器後同一測試通過。
- 1280×494／360、左側 22px、15 個新增 Space：末列可捲動到達及切換、設定可開啟、搜尋快捷鍵能帶回搜尋框，側欄無橫向溢出。
- 隱藏右側時，還原按鈕與 LOCAL FIRST 不重疊；360px 高度顯示雙側欄時，右側分頁與左側設定仍可見。
- build／TypeScript strict／lint／49 個單元與元件測試通過；5 組相關瀏覽器回歸通過，包含新矮視窗、左側字級、拖曳邊緣捲動與兩組主要 CRUD／拖曳／備份操作。
- 首輪誤以篩選單獨執行相依的第二組工作台測試，缺少第一組建立的 Development 資料而逾時；按原有序列執行第一、第二組後皆通過。
- 1.0.6 ZIP CRC／版本及 SHA-256 已驗證。以上是本機隔離 Chromium 的版面驗證；Windows 原裝置更新後重測尚未取得。

[494px 高度](short-viewport-1.0.6.png) · [360px 高度／雙側欄](short-both-panels-1.0.6.png)

## 1.0.5 左側字級驗證

- build／lint／49 個單元與元件測試通過；5 組相關瀏覽器測試通過，涵蓋左側、右側、整體字級以及主要 CRUD／拖曳／備份操作。
- 左側 A−／A＋、16／18／20／22px、跟隨整體、預覽取消及重載保存已驗證；搜尋、導覽、Space 名稱採用同一側欄字級，中央與右側保持獨立。
- 左側 22px 在 1280／1000／768px 視窗及 180px 側欄無橫向溢出。主要導覽窄欄可換行，Space 名稱過長時省略。
- 最後補強窄欄導覽換行與說明排列，另重跑左側字級測試；截圖見下方。

[左側 22px 預覽](sidebar-large-1.0.5.png) · [180px 窄側欄](sidebar-narrow-1.0.5.png)

## 1.0.4 配色與右側字級驗證

- build／TypeScript strict／lint 通過，48 個單元／元件測試通過。
- 15 個瀏覽器場景中 13 個首輪通過；修正測試定位（新增字級 output 也具有 status 角色）及三位數色碼解析後，其餘 2 個通過。沒有把測試工具錯誤算成產品已通過。
- 右側 A−／A＋依序 18→20→22px，最大值禁用加大；重載保留；縮小至 20px；設定草稿取消不影響已保存值。
- 設定 16／22px 與跟隨整體分別驗證。整體 14px 時右側仍可維持 22px，兩者獨立。
- 深／淺模式五組文字／背景代表色（書籤文字、輔助文字、選取色、青綠與琥珀分類色）對比均 ≥4.5:1；不是全面 WCAG 認證。
- 22px 與 1000px 視窗下右側面板及字級控制無橫向溢出。已檢視深淺截圖。
- ZIP 完整性檢查通過；本輪大量資料載入 129ms、搜尋 66ms（本機隔離測試）。

截圖：[深色與右側 22px](palette-dark-1.0.4.png)、[淺色與右側 22px](palette-light-1.0.4.png)。

## 1.0.3 選單與無障礙驗證

- build、TypeScript strict、lint、47 個單元／元件測試通過；1.0.3 ZIP 完整性通過。
- 14 組整合場景首輪 13 組通過；鍵盤排序測試過早接受「目前拖曳項目本身」的通用移動提示，已改為等待指定目標分類，再檢查放下順序與重載持久化。修正後同一測試連續三次通過。
- 大字級選單在 1280×480 及 700×240 視窗保持於可視範圍，過長內容可捲動，最後一項可鍵盤抵達；Home／End／Escape／Tab 操作通過。
- 工作台及設定介面的每個按鈕皆有非空 title／aria-label；原有命令、書籤、分頁與備份操作回歸通過。
- 該輪大量資料載入 143ms、搜尋 50ms，僅代表本機隔離環境。

選單畫面：[短視窗／18px 字級](menu-short-1.0.3.png)。本次打包僅升版，與整合測試的 JS/CSS 相同。

## 1.0.2 字體調整驗證

- `npm run build`、`npm run lint` 通過；7 個測試檔、47 個單元／元件測試通過。
- 完整 13 組真實 Chromium 外掛整合測試通過（約 1.1 分鐘），包含既有拖曳、對話框、備份與分頁操作。
- 新增字級驗證：預設書籤／分頁 16px、Collection 18px；14／18px 儲存於 sync 設定且重載保留；取消預覽不影響現值；緊湊模式不縮字。
- 18px 在 1280／1000／768px 視窗無頁面及主面板橫向溢出。深色標準、深色大字、淺色大字與設定預覽已檢視。
- 本次大量資料載入 131ms、搜尋 49ms，僅代表本機隔離測試。
- 1.0.2 ZIP CRC／版本與 SHA-256 已驗證。跨裝置同步與 Windows 實機仍未驗收。

截圖：[標準字級](font-standard-1.0.2.png)、[較大字級](font-large-1.0.2.png)、[淺色大字](font-light-1.0.2.png)、[設定預覽](font-settings-1.0.2.png)。

## 1.0.1 本機結果

| 驗證                   | 結果                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `npm run build`        | 通過，TypeScript strict 無錯誤；產生可直接側載的 dist                               |
| `npm run lint`         | 通過，無 ESLint 錯誤                                                                |
| `npm run test`         | 7 個檔案、46 個測試全部通過                                                         |
| `npm run test:e2e`     | 完整 11 組通過；之後 CSS 對比度回歸 1 組、追加 UI 分支 1 組個別通過（目前共 12 組） |
| `npm audit`            | 前次掃描 0 項已知漏洞（2026-09-27）；本次依賴版本未變更                             |
| `npm run test:preview` | 通過：dev server 啟停、首次啟動、收藏與重載保留、無 page errors                     |
| `npm run package`      | 通過：ZIP 內容、CRC、版本與 SHA-256 檢查                                            |
| 視覺檢查               | 已檢視淺色、深色與大量資料截圖，無重疊／文字溢出                                    |

環境：macOS、Node 23.11.0、Vitest 4.1.11、Playwright 1.63.0、Chromium 139.0.7258.5。開發建議使用 Node 22/24 LTS；測試是在本機現有 Node 執行並通過。沒有接觸使用者日常 Chrome profile，測試使用臨時 profile，結束後移除。

## 真實 API 驗證範圍

1. MV3 `chrome://newtab` override、首次建立 Boardmarks / Personal / Favorites。
2. 真實 `chrome.bookmarks` 新增 Space、Collection、Bookmark；書籤正向／反向排序、跨 Collection、跨 Space 拖曳、Space 排序。
3. 真實 Chrome 分頁拖入 Collection，確認原分頁保留。
4. 重複網址三分支；書籤、非空 Collection／Space 刪除與復原；移動復原；刪除計數與取消。
5. 全域搜尋、命令選單、主題設定、metadata 星號與重新命名保留。
6. JSON 檔案下載、匯入預覽確認、追加原生書籤。
7. 外部 Chrome API 建立書籤後 UI 自動同步。
8. 真實分頁 Save & Close，確認原分頁被關閉且書籤存在。
9. 整個視窗儲存到新／既有 Collection、略過 Chrome 內部頁面並保留原分頁。
10. 關閉 Chromium、以同一隔離 profile 重啟，確認書籤與偏好仍存在。
11. 空 Space 搜尋／星號／命令選單；metadata 外部重新命名、同名排序、刪除重建及 Undo。
12. 原生空白／超長標題下載 JSON 再匯入，內容保留。
13. Collection 鍵盤排序；拖曳邊緣自動捲動；Escape 取消不改原生 parent/index。
14. 前景／背景／中鍵／新視窗開啟；其他視窗的分頁啟用及關閉。
15. System 主題跟隨媒體變化；緊湊密度、欄寬、隱藏分頁面板保存；淺色輔助文字對面板 ≥4.5:1。
16. 複製網址選單把完整 query/hash 傳給 clipboard.writeText；該測試攔截 API，未變更使用者系統剪貼簿，也未驗證 OS 權限。

## 資料安全與元件測試

- URL normalization 保留 query、hash，包括 query 值與 hash 裡的斜線。
- 阻擋 javascript / data / Chrome 內部網址與錯誤 URL。
- 樹模型映射、ID、順序、全域搜尋、跨 profile metadata key。
- 備份 version/schema/型別/URL 驗證，無效資料在寫入前拒絕。
- 設定舊格式 migration 與未知未來版本拒絕。
- 禁止修改根目錄與 Boardmarks 範圍外；禁止不合層級的操作。
- Chrome API 失敗不偽造成功狀態；移動索引換算；確認期间外部變更時取消刪除。
- 原父資料夾不存在時拒絕 Undo。
- 收藏寫入失敗時不關閉分頁；原頁已換網址時保留；拖曳收藏預設保留。
- 超過 10 個分頁需要確認，取消不開啟任何分頁。
- Dialog 初始焦點、Tab 邊界循環、Escape、關閉後還原焦點。
- ErrorBoundary 顯示復原操作而非白屏。
- 編輯並搬移失敗時復原欄位；復原 API 再失敗時明確回報部分狀態；外部修改不遭覆寫。
- metadata 依 Chrome ID 遷移路徑、清除刪除項目、保留遠端已同步的新路徑。
- 忙碌 Dialog 無法以 Escape 關閉，hidden input 不進入焦點循環。

## 效能

以真實 Chrome API 另外建立 10 Spaces、100 Collections、1,000 Bookmarks，並同時存在 100 個開啟分頁（加上前述功能測試的少量資料）。

- 最後一次新分頁重新載入至工作台可操作：約 **171ms**。
- 1,000 筆書籤搜尋至單一相符結果：約 **57ms**，包含 Playwright 輸入與驗證時間。
- 先前版本同類測試重新載入 90–162ms、搜尋 45–55ms。數字僅代表此本機隔離環境，不是所有裝置的保證。
- 另以 5,000 Bookmarks 執行解析／搜尋單元測試，通過 <500ms 的測試門檻；未聲稱完成 5,000 張卡片的全量 UI 基準測試。

## 使用者實機驗收

以下需要使用者實際的另一台裝置／Chrome 帳號，尚未驗證：

- 在日常 Chrome 安裝 dist、接受新分頁 override 提示。
- macOS 與 Windows 使用相同固定 extension ID 與相同 Chrome 帳號，開啟書籤與擴充功能同步。
- A 裝置建立 Space / Collection / Bookmark；等待 Chrome Sync 後確認 B 裝置出現同一分類／網址。
- 調整主題、星號、摺疊後，等待 sync storage 同步確認 B 裝置的設定。
- 在兩台裝置分別重啟 Chrome 再確認書籤仍存在。
- 多視窗焦點切換、OS 專屬快捷鍵、企業政策及長時間日常使用。

不能將本機 persistence 與事件同步測試當作 Mac ↔ Windows 帳號同步測試。

## 參考與重現

測試原始碼：`tests/e2e/integrity.spec.ts`、`tests/e2e/workspace.spec.ts`、`tests/*.test.ts`、`tests/accessibility.test.tsx`。執行指令與 Chromium 路徑設定見 README。

API 行為依據：[Chrome Bookmarks](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)、[Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)、[Chrome favicon](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)。

1.0.1 視覺紀錄：[深色](workspace-1.0.1-dark.png)、[淺色](workspace-1.0.1-light.png)。逐項規格狀態見 [SPEC_AUDIT.md](SPEC_AUDIT.md)。
