# Boardmarks 架構

## 資料來源

```text
Chrome Bookmarks: Boardmarks → Space → Collection → Bookmark
                       ↓ read + bookmark events
                 parser / Zustand view
                       ↓ intents
                 guarded Chrome API writes
                       ↓ reread
                   React board

Chrome storage.sync: schemaVersion=1 settings + individually keyed metadata
Chrome storage.local: profile-local rootId + versioned ID/path metadata index
```

React / Zustand 只保存視圖與暫時 UI 狀態，書籤的永久來源是 `chrome.bookmarks`。沒有後端、帳號、資料庫、analytics、遠端 JS。Manifest V3 頁面直接呼叫 Chrome API，無常駐背景 service worker。

## 模組

- `src/chrome/bookmarks.ts`：根目錄探索、建立、層級與範圍驗證、CRUD、排序索引轉換、快照復原。
- `src/chrome/tabs.ts`：所有一般視窗、切換／開啟／關閉分頁。
- `src/chrome/storage.ts`：設定 migration、欄寬範圍驗證、metadata hash 與批次寫入。
- `src/chrome/preview.ts`：無 extension API 時的開發預覽，與正式資料隔離。
- `src/utils`：無副作用的 URL、樹模型、搜尋工具；統一 logger。
- `src/services/actions.ts`：使用者意圖，組合安全寫入、確認、Undo、Save & Close、Save Window。
- `src/services/backup.ts`：unknown → validated v1 backup；無效檔案在寫入前整體拒絕。
- `src/stores/board.ts`：Zustand 狀態、事件訂閱、通知、資料重新整理。
- `src/stores/ui.ts`：編輯器與選單顯示狀態。
- `src/components`：Sidebar、Board/Collection/Card、TabsPanel、Editors、Overlays、可及性共用元件。
- `src/app/App.tsx`：DndContext、全域快捷鍵、欄寬、初始化與主題。

## 安全與一致性決策

1. **寫入範圍**：每次 mutation 重新確認 ID 屬於所選 Boardmarks 根目錄，保護根目錄和 Chrome 系統資料夾。
2. **排序**：應用層 index 是移動完成後的位置；Chrome `move` 同父資料夾向後移動的 index 是移除來源前的位置，API adapter 會換算。
3. **不樂觀改動永久資料**：dnd-kit 提供拖曳視覺；完成 API 寫入後才更新樹。API 失敗時來源位置仍正確。
4. **同步設定**：根 ID 存 local；metadata 按分類路徑 hash 分項存 sync，避免 Chrome 跨 profile ID 不同、單一 item 8 KB 上限。名稱變更／移動會依仍相同的本機 ID 複製 metadata 至新路徑。批次匯入 metadata 只呼叫一次 sync.set，減少寫入配額消耗。
5. **URL**：使用 URL parser，白名單 HTTP/HTTPS/FTP/file；正規化不刪 query 或 hash。React 文字顯示，不插入 HTML。
6. **Save & Close**：先 await bookmark 建立，再讀取當下分頁；僅 URL 仍一致才關閉。任一步失敗皆顯示錯誤且不臆測成功。
7. **刪除**：非空資料夾先顯示數量；確認後再次比對快照，外部修改時拒絕刪除。5 秒 Undo 從完整原始子樹快照重建，保留外部深層資料夾。
8. **備份**：v1 schema；20 MB 檔案、50,000 網址、1,000 Spaces、10,000 Collections 單次上限。匯入先完整驗證，再新增；不對既有項目做覆寫式 rollback。
9. **權限與 CSP**：僅四個必要權限；script self、connect none、image self/data；完全本機 CSS/JS。style unsafe-inline 供 React/dnd-kit 幾何定位，沒有 eval/remote scripts。
10. **多頁面寫入**：extension origin 的 Web Locks 序列化每個書籤 mutation，防止兩個新分頁同時建立重複根／收藏。外部 Chrome 管理員與跨裝置同步不受此鎖控制，限制記錄於 README。

## 使用體驗與效能

dnd-kit Pointer / Keyboard sensors、overlay、drop highlight、插入提示、auto-scroll；拖曳把手可避免普通點擊誤觸移動。Space 懸停 650ms 切換，放到 Space 可選 Collection。

只渲染目前 Space，搜尋才跨 Space。memoized cards、Collection content-visibility、lazy favicon、事件合併；不需等待圖示。SHA-256 metadata key 只計算一次並快取，不快取網址。CSS transition 約 160ms，尊重 prefers-reduced-motion。

System theme 跟隨 prefers-color-scheme 變化。Modal focus trap／回復焦點、Escape、命令選單方向鍵、選單方向鍵、可見焦點、操作 aria-label。ErrorBoundary 提供重新載入入口。

## Migration

設定 `schemaVersion: 1`；舊的無版本偏好經型別與範圍驗證升級到 v1，未來版本拒絕覆寫。備份 `version: 1` 與設定 schema 分開。未引入書籤 ID 重寫或破壞性 migration。

## 1.0.1 一致性修正

- `services/metadata.ts` 使用獨立 Web Lock 序列化 metadata reconciliation；在 local 保存可重建的 ID/path 索引，sync 仍沿用既有 path hash keys。外部重新命名、同名排序、刪除後重新建立分類不會套錯偏好。已從另一台裝置同步的目的路徑值不被缺少的來源 key 清空。
- `utils/metadata.ts` 是純函式計畫器；先讀取所有來源值再做批次寫入，避免同名分類交换時先寫覆蓋掉另一個值。過期路徑清理後才提交 local index。
- 刪除前捕捉 metadata；Undo 將原子樹與重建子樹按原順序對應到新的 Chrome IDs，還原星號與摺疊。
- `editBookmarkNode` 在一個書籤寫入鎖內验证原編輯快照、目的 Collection、名稱、URL，然後執行更新與搬移。搬移失敗只在目前值仍是本次寫入且仍在原位置時補償；偵測外部變更或補償失敗則明確報告，保留當前資料。
- `exportData` 在產生 JSON 前重讀 Chrome source of truth，避免事件 debounce 期間使用過期 UI 快照；同時驗證產物可由 v1 importer 接受。
- `boardKeyboardCoordinates` 篩選同類型 sortable rectangles，避免 Collection 內的 drop zone 攔截 Collection／書籤鍵盤排序。Tab sensor 可用方向鍵選 Collection。

以上未改變 Boardmarks → Space → Collection → Bookmark 架構、extension key、四個必要權限或 sync settings schemaVersion。

## 1.0.2 字級偏好

Settings.fontSize 為 14 | 16 | 18，沿用 schemaVersion 1 的可選欄位升級；缺值或不合法值採用 16。App 把偏好套用至 documentElement，文字使用 rem，卡片寬度配合字級調整，間距與欄寬仍獨立。設定樣本以 em 呈現草稿字級，取消不影響已儲存偏好。

## 1.0.4 右側字級

Settings.tabsFontSize 為 inherit | 16 | 18 | 20 | 22，缺值採用 18，沿用 sync 設定與 v1 schema。TabsPanel 使用局部 font-size 與 em，讓右側字級独立於根元素；inherit 選項取用全域 fontSize。A−／A＋與設定對話框共用 saveSettings。

## 1.0.5 左側字級

Settings.sidebarFontSize 使用 inherit | 16 | 18 | 20 | 22，缺值採用 18。Sidebar 的局部 font-size 與 em 控制文字及主要導覽圖示，中央 fontSize 與右側 tabsFontSize 保持獨立。

## 1.0.6 短視窗

Sidebar 品牌與底部設定固定，中段 sidebar-scroll 為唯一垂直捲動容器，Spaces 依內容展開，避免 flex 高度分配壓縮清單。max-height:650px 降低留白並隱藏輔助說明；不改字級偏好與瀏覽器縮放。

## 1.0.7 Toby 匯入

`services/import.ts` 作為檔案匯入邊界：辨識 Boardmarks v1 或已觀察的 Toby v3（lists/cards），將後者轉成內部 Backup v1。版本未知或結構損壞會在寫入前拒絕；筆記／無效 URL 以數量列於預覽，說明與標籤亦明示不匯入。上限同時涵蓋被略過的卡片。ImportEditor 顯示來源與 notices，確認後沿用 importData 的追加、metadata 與部分失敗處理。原始檔不會被覆寫，未將 Toby 資料存進 sync 設定。

## 1.0.8 收合與排序

Settings 增加 showSidebar（舊設定預設 true）。Sidebar 保持掛載但以 hidden 隱藏，讓搜尋事件能展開後聚焦；收合時不渲染左 ResizeHandle，改用 44px 工具列及各斷點的 grid 欄位。寬度偏好保持原值。Collection 標題與 bookmark-link 使用既有 PointerSensor 的 activator，6px 門檻及取消／click suppression 沿用 dnd-kit；把手仍承接鍵盤感測器，移動仍經 action 的原生 Chrome bookmarks 更新。

## 1.0.10 左右整列拖曳

SpaceRow／TabRow 在列容器綁定既有 PointerSensor activator，子元素事件向上傳遞；icon-button 與 drag-handle 不由列層重複啟動。沿用 6px 門檻與 dnd-kit click suppression，不把鍵盤 listeners 套在名稱按鈕，保留 Enter 切換與把手鍵盤拖曳。不可收藏的分頁維持 disabled 並不顯示拖曳游標。
