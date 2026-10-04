# 規格逐項稽核

本次目標：依據 SPEC.md 繼續開發。以目前檔案與實際執行為依據。V1 功能與交付已核對；2026-09-28 使用者回覆「驗證沒問題」，補足先前 Windows 與跨裝置同步的整體實機驗收。逐項操作與耗時未提供，不擴張為代理親測或全面認證。後續使用者修改以最新指示為準：移除頂部教學、支援 Toby／收合與直接拖曳，書籤說明欄位取消。

| 規格項目                         | 目前證據／缺口                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. 專案目標                      | 新分頁、Space/Collection、原生書籤及無後端已實作；跨 Mac/Windows Sync 已由使用者整體確認。                                                                                                     |
| 2. 技術原則                      | package.json / public/manifest.json：React、TypeScript、Vite、Tailwind、dnd-kit、Zustand；src 無後端、帳號或 analytics。                                                             |
| 3. 支援平台                      | macOS Chromium 隔離測試通過；已收到 Windows 工作台截圖與 Spaces 裁切回報，1.0.6 修正已經本機重現驗證，Windows 新版已由使用者整體確認。                                                                                                                           |
| 4. Chrome Extension 類型         | public/manifest.json chrome_url_overrides；workspace.spec.ts 載入 chrome://newtab。                                                                                                  |
| 5. UI 整體架構                   | Sidebar、Board、TabsPanel；docs 截圖與 1280×720 回歸場景。                                                                                                                           |
| 6. UI 設計要求                   | 原創 CSS、dark/light tokens、三欄視覺；沒有引用 Toby 圖片／商標。                                                                                                                    |
| 7. Layout                        | App ResizeHandle、settings 欄寬；integrity.spec.ts 持久化場景；窄版 CSS；1.0.6 中段捲動與 494／360px 矮視窗驗證；1.0.8 左側收合及搜尋自動展開。                                                                                                            |
| 8. Dark / Light Mode             | App prefers-color-scheme listener；integrity.spec.ts System media 變化與設定重載。                                                                                                   |
| 9. 資料儲存架構                  | chrome/bookmarks.ts；Zustand 由來源重讀，不作永久書籤資料庫。                                                                                                                        |
| 10. Bookmark Root                | findRoot / scoped；safety.test.ts 拒絕根目錄與範圍外寫入。                                                                                                                           |
| 11. Bookmark Tree                | parseTree / createFolder / addBookmark；層級保護測試。                                                                                                                               |
| 12. Space                        | Sidebar / folder editor；真實 Space 建立、重排、星號、重新命名，以及非空刪除計數／取消／刪除／Undo；1.0.10 支援整列內容拖曳。                                                                                 |
| 13. Collection                   | CollectionBlock；Collection 鍵盤排序回歸、metadata 摺疊／星號與 Undo 場景；1.0.8 標題直接拖曳上下排序。                                                                                                          |
| 14. Bookmark Card                | BookmarkCard、Favicon、title URL；截圖不展開完整 URL。                                                                                                                               |
| 15. Bookmark Card 操作           | integrity.spec.ts 原生前景／背景／中鍵／新視窗場景；右鍵入口在 Board。                                                                                                               |
| 16. Bookmark Edit                | FormEditor / editBookmarkNode；editing.test.ts 驗證 stale edit、move failure 補償、外部修改保護。                                                                                    |
| 17. Bookmark 拖曳                | DndContext 與 BookmarkCard；workspace.spec.ts 正反排序及跨 Collection／Space；1.0.8 可直接拖曳卡片，驗證取消與不誤開網址。                                                                                                       |
| 18. Open Tabs Panel              | readWindows populate:true；TabsPanel；原生多視窗測試場景。                                                                                                                           |
| 19. Tab Item                     | activateTab 同時 windows.update/tabs.update；多視窗焦點驗證。                                                                                                                        |
| 20. Current Tab → Bookmark       | saveTab(...,false)；真實拖曳保存後原頁仍存在；1.0.10 名稱／圖示拖曳已驗證，不誤切換原分頁。                                                                                                                                       |
| 21. Save and Close               | saveTab 先寫入再確認原 URL 再關閉；tab-safety.test.ts 故障與導航案例。                                                                                                               |
| 22. 整個 Window 收藏             | saveWindow；真實新 Collection 保存，略過重複／內部頁，保留原分頁。既有 Collection 追加另有獨立 UI／原生樹斷言。                                                                      |
| 23. Open Collection              | openCollection；超過 10 先確認／取消；tab-safety.test.ts。                                                                                                                           |
| 24. Search                       | searchBoard + searchSpaces；新增空 Space 搜尋場景；全域 title/URL/collection/space。                                                                                                 |
| 25. Search Keyboard Shortcut     | App shortcuts；workspace/integrity 搜尋與 Ctrl/Meta+K；Windows 操作納入使用者整體驗收，未提供逐項紀錄。                                                                                                     |
| 26. Command Palette              | CommandPalette 命令及書籤／分類搜尋；忙碌對話框阻擋切換。                                                                                                                        |
| 27. Starred                      | metadata path sync；空 Space starred view／同名 reorder／外部 rename 真實測試。                                                                                                      |
| 28. Collapse                     | setMetadata / CollectionBlock；摺疊狀態重建、重載與 Undo 場景。                                                                                                                      |
| 29. Bookmark favicon             | Favicon 使用 _favicon，error 回退地球，lazy loading，沒有外部 favicon 服務。                                                                                                         |
| 30. Duplicate Detection          | DuplicateError / choose 三選項；取消、仍然加入、開啟既有三分支均有 E2E。                                                                                                             |
| 31. URL normalization            | url.ts + engine.test.ts：末尾 slash、query/hash，包括 suffix 內 slash 不誤刪。                                                                                                       |
| 32. Drag Feedback                | Overlay、opacity、drop highlight、插入標線；實際 pointer drag 測試／截圖。                                                                                                           |
| 33. Auto Scroll                  | 長列表拖到邊緣，直接驗證 scrollTop > 100；Escape 後原生 parent/index 不變。                                                                                                          |
| 34. UI Animation                 | CSS 約 160ms，reduced-motion；無 Framer Motion。                                                                                                                                     |
| 35. Settings                     | SettingsEditor：appearance/behavior/root/backup；更改與重載場景；root 顯示不允許任意改架構。                                                                                         |
| 36. Card Density                 | compact / comfortable CSS 與 settings；compact 重載場景；1.0.2 字級獨立於密度，14／16／18px 可選；1.0.4 右側、1.0.5 左側獨立字級及面板直接調整。                                     |
| 37. Export                       | exportData 驗證自身可匯入；downloadBackup JSON 包含整棵標準樹、metadata、settings。                                                                                                  |
| 38. Import                       | validateBackup + ImportEditor counts/confirm；下載 JSON 再匯入的原生標題往返測試；1.0.7 Toby v3 轉換及明示未匯入內容。                                                                                                   |
| 39. Undo                         | remove / move 的 5 秒 toast Undo；書籤／Collection／Space 刪除與 Move Undo 均有真實 UI 驗證。                                                                                        |
| 40. 刪除 Collection 保護         | 非空 Collection confirmation + 刪前 snapshot 比對；真實取消／確認／Undo。                                                                                                            |
| 41. 刪除 Space 保護              | 同一 remove 流程顯示資料夾及全部書籤數；非空 Space 已驗證計數、取消、刪除與 Undo。                                                                                                   |
| 42. Privacy                      | 無 fetch/analytics/backend；Chrome sync 使用者選用；CSP connect-src none。                                                                                                           |
| 43. 權限最小化                   | bootstrap.test.ts 精確驗證 bookmarks/tabs/storage/favicon 四權限。                                                                                                                   |
| 44. First Launch                 | initializeRoot 與 welcome；workspace.spec.ts 新 profile 首次啟動。                                                                                                                   |
| 45. Empty State                  | 無 Collection、空 Collection、無搜尋結果 UI；空 Space 搜尋不再漏掉。                                                                                                                 |
| 46. Error Handling               | run/refresh/errorBoundary；原生 API 拒絕與部分操作失敗的測試；非空白頁。                                                                                                             |
| 47. State Architecture           | stores 與 Chrome adapter；source of truth 仍是原生樹。                                                                                                                               |
| 48. Bookmark Events              | subscribe 書籤 created/removed/changed/moved/reordered/importEnded；外部變更真實測試。                                                                                               |
| 49. Tab Events                   | tabs/windows events 含 attach/detach/replaced；原生 Tab 與多視窗場景。                                                                                                               |
| 50. Performance                  | 本機大量資料測量見 TESTING.md，各版本留存結果；不推論所有電腦。                                                                                                                      |
| 51. 大型資料量測試               | 真實 10/100/1000/100；5,000 純解析／搜尋；尚非 5,000 卡片全量 UI 基準。                                                                                                              |
| 52. Accessibility                | Modal focus trap、busy／hidden-input 回歸、選單鍵盤、焦點 ring；淺色 muted/panel 計算對比度 ≥4.5:1；1.0.2 字級／窄視窗與 1.0.3 主要按鈕 title／aria-label 已補齊；非全面 WCAG 認證。 |
| 53. Keyboard                     | shortcuts、Escape、Enter、Delete confirm；Collection keyboard sorting 新增回歸。                                                                                                     |
| 54. Context Menu                 | Board／TabsPanel／Sidebar 選單；依實際尺寸定位、短視窗捲動及 Home／End／Tab／Escape；主要操作已有 E2E；Copy URL 驗證 API 呼叫內容，不改寫系統剪貼簿。                                |
| 55. 第一階段不要做的功能         | 未加入任一 Out of Scope V1 功能。                                                                                                                                                    |
| 56. Project Structure            | src 按 app/components/chrome/stores/services/utils/types 分層；Manifest 單一來源在 public。                                                                                          |
| 57. TypeScript Data Models       | types、parseTree 沿用 Chrome ID；沒有另建書籤 ID。                                                                                                                                   |
| 58. Metadata                     | sync metadata，local profile ID-path cache；重新命名／刪除／同名排序不互換偏好。                                                                                                     |
| 59. Storage Migration            | settings schemaVersion:1 舊值驗證，未知新版本拒絕；backup v1；local index version1為可重建cache。                                                                                    |
| 60. Testing                      | Vitest + RTL；URL/tree/mapping/duplicate/import/safety/editing/metadata/dialog 測試。                                                                                                |
| 61. Manual Chrome Extension Test | 多項由隔離 Chromium 真實 API 驗證；日常 Chrome／Windows／同帳號跨裝置同步由使用者整體確認。                                                                                                  |
| 62. Build Commands               | package.json 提供五項命令；build/test/lint/dev smoke 已執行；dist 直接側載；另有 package 指令。                                                                                      |
| 63. ESLint / Format              | ESLint/Prettier/TypeScript strict；來源無 any；解壓的 Boardmarks 發行資料夾從 lint 排除。                                                                                            |
| 64. Error Boundary               | main ErrorBoundary；RTL 模擬 component crash。                                                                                                                                       |
| 65. Logging                      | logger.debug 僅 DEV；warn/error 集中；E2E 無 page errors。                                                                                                                           |
| 66. Security                     | MV3 CSP、自帶 bundle、無 eval/new Function/remote script；manifest 測試。                                                                                                            |
| 67. 開發階段                     | 按照功能缺口分批修正並建置／lint／測試。                                                                                                                                             |
| 68. Phase 0 — Bootstrap          | 見 2、4、5、8、62、63。                                                                                                                                                              |
| 69. Phase 1 — Bookmark Engine    | 見 9–12、16–17、48。                                                                                                                                                                 |
| 70. Phase 2 — Board UI           | 見 5–8、12–14、27–28。                                                                                                                                                               |
| 71. Phase 3 — Drag & Drop        | 見 17、32–33；自動捲動與 Escape 安全取消已驗證。                                                                                                                                     |
| 72. Phase 4 — Open Tabs          | 見 18–19、49。                                                                                                                                                                       |
| 73. Phase 5 — Tab → Collection   | 見 20–22。                                                                                                                                                                           |
| 74. Phase 6 — Search             | 見 24–26、53。                                                                                                                                                                       |
| 75. Phase 7 — Backup             | 見 37–38。                                                                                                                                                                           |
| 76. Phase 8 — Polish             | 見 29、34–36、44–46、50–54；實機驗收由使用者整體確認。                                                                                                                                             |
| 77. MVP 定義                     | MVP 功能具有本機證據；Mac/Windows Chrome Sync 由使用者整體驗收確認。                                                                                                                 |
| 78. V1.0 完成條件                | 1.0.9 可安裝、測試覆蓋主要操作與安全性；使用者整體實機驗收確認，未宣稱特定時長的耐久測試。                                                                                                               |
| 79. 資料安全優先級               | 不樂觀移動永久樹；API write 後重讀；edit+move 補償與失敗保護回歸。                                                                                                                   |
| 80. Git Strategy                 | 文件中的 Git 工作流程建議；目前目錄不是 Git repo，未擅自推送遠端。                                                                                                                   |
| 81. 文件                         | README/SPEC/ARCHITECTURE/CHANGELOG/TODO 與 audit/testing文件維護。                                                                                                                   |
| 82. Codex 開發行為要求           | 附件內的代理行為建議，非新的使用者命令；依實際請求持續開發與測試。                                                                                                                   |
| 83. Codex 自主循環               | 附件自主循環建議；未執行破壞性 migration。                                                                                                                                           |
| 84. Codex 不可自行做的決策       | 維持框架、書籤儲存、root結構與四權限；沒有需要變更核心架構的新決策。                                                                                                                 |
| 85. UI 自主權                    | 原創UI細節調整；不改產品核心方向。                                                                                                                                                   |
| 86. 未來 V1.1                    | 未來 V1.1，不當作本次必交功能；Save Window已依第22節V1要求提供。                                                                                                                     |
| 87. 未來 V1.2                    | 未來 Workspace會話功能，V1範圍外。                                                                                                                                                   |
| 88. 未來 V2                      | 未來 Local LLM，V1範圍外。                                                                                                                                                           |
| 89. 第一個 Codex Goal            | Phase0 示範 Goal 是文件參考，不是使用者要求現在停在Phase0。                                                                                                                          |
| 90. 開發原則總結                 | 維持 Bookmark/dnd/source-of-truth 核心，不以測試全綠取代缺失的實機證據。                                                                                                             |

## 本次可重現缺陷

- 編輯+搬移失敗留下部分修改 → 加入單一寫入鎖與可安全執行的補償；外部更新時拒絕覆蓋。
- 空 Space 在搜尋與星號頁消失 → 新增 Space 結果與命令導覽。
- metadata 殘留、同名分類互換偏好 → local ID-path 索引、路徑搬移／清理與 Undo 快照。
- 原生空白／長標題匯出後無法匯入 → 保留原始標題、完整往返測試。
- 鍵盤 Collection 排序被巢狀 drop zone 攔截 → 依項目類型篩選 keyboard coordinates。
- busy 對話框遭快捷鍵取代、hidden input 進入焦點範圍 → busy modal 與可見焦點篩選。
- 使用者解壓的 Boardmarks/assets 被當來源 lint → 發行複本排除，不改動複本內容。

## 實機驗收收尾

2026-09-28 使用者在等待 Windows 新版與 Mac／Windows 雙向同步驗證結果的對話後回覆「驗證沒問題」。據此結清第 3、61、77、78 節的實機驗收缺口，並保留既有本機測試及原始驗收步驟。

證據範圍：使用者整體確認；沒有逐項操作紀錄、瀏覽器版本或使用時長。Windows 操作及同步不是代理親自執行的測試，也不代表全面 WCAG 或長期可靠性認證。詳見 [DEVICE_ACCEPTANCE.md](DEVICE_ACCEPTANCE.md)。
