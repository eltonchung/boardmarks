# Boardmarks Chrome 書籤工作台開發規格

## Project Codename：Boardmarks

### 1. 專案目標

開發一套 Chrome Extension，作為 Chrome 新分頁（New Tab）首頁。

核心概念類似：

- Toby
- Bookmark Manager
- Tab Manager
- Workspace Manager
- Kanban Board

但必須自行設計 UI、程式架構與資料模型，不直接複製 Toby 的程式碼、圖片、商標或視覺素材。

使用者可以：

1. 將大量網站依照 Space / Collection 分類。
2. 以卡片方式顯示收藏網址。
3. 查看目前 Chrome 所有視窗與分頁。
4. 將目前分頁直接拖曳至 Collection 收藏。
5. 從 Collection 快速重新開啟網址。
6. 跨 Mac / Windows Chrome 自動同步。
7. 不依賴自建 Server。
8. 不需要會員系統。
9. 不需要付費服務。
10. 即使移除 Extension，網址資料仍然存在於 Chrome Bookmarks 中。

---

## 2. 技術原則

### 2.1 核心技術

```text
Chrome Extension
Manifest V3

Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

Drag & Drop
- dnd-kit

State
- Zustand

Persistent Data
- chrome.bookmarks
- chrome.storage.sync
- chrome.storage.local

Chrome APIs
- chrome.tabs
- chrome.windows
- chrome.bookmarks
- chrome.storage
- chrome.runtime
- chrome.commands
```

禁止第一版導入：

```text
Backend Server
PHP
Laravel
Node.js Server
MySQL
PostgreSQL
Firebase
Supabase
AWS
會員系統
OAuth
AI API
Analytics
廣告 SDK
```

---

## 3. 支援平台

第一階段：

```text
Google Chrome
macOS
Windows
```

第二階段可考慮：

```text
Microsoft Edge
```

暫不支援：

```text
Safari
Firefox
Mobile Chrome
Android
iOS
```

---

## 4. Chrome Extension 類型

必須使用：

```text
Manifest V3
```

Extension 必須覆蓋：

```text
chrome://newtab
```

Manifest：

```json
{
  "chrome_url_overrides": {
    "newtab": "index.html"
  }
}
```

也就是：

```text
Command + T
Ctrl + T
```

直接開啟 Boardmarks。

---

## 5. UI 整體架構

桌面版主要為三欄：

```text
┌────────────────┬─────────────────────────────────────┬──────────────────┐
│                │                                     │                  │
│ LEFT SIDEBAR   │            MAIN BOARD               │    OPEN TABS     │
│                │                                     │                  │
│ Search         │ Space / Collections                 │ Window 1         │
│                │                                     │                  │
│ Starred        │ ┌────────┐ ┌────────┐ ┌────────┐    │ Tab             │
│ My Collections │ │ Link   │ │ Link   │ │ Link   │    │ Tab             │
│ Work           │ └────────┘ └────────┘ └────────┘    │ Tab             │
│ PHP            │                                     │                  │
│ Personal       │ Collection                          │ Window 2         │
│                │                                     │                  │
│                │ ┌────────┐ ┌────────┐               │ Tab             │
│                │ │ Link   │ │ Link   │               │ Tab             │
│                │ └────────┘ └────────┘               │                  │
│                │                                     │                  │
└────────────────┴─────────────────────────────────────┴──────────────────┘
```

---

## 6. UI 設計要求

### 6.1 視覺方向

整體定位：

```text
現代
簡潔
高資訊密度
Dark Mode 優先
專業
快速
適合每天工作使用
```

避免：

```text
過度鮮豔
卡通風
大型圓角
過度動畫
大量玻璃擬態
手機 App 風格
```

參考：

```text
Linear
Raycast
Arc
Notion
VS Code
Toby
```

但不可直接複製。

---

## 7. Layout

桌面最低建議解析度：

```text
1280 × 720
```

最佳：

```text
1440p
4K
```

必須支援：

```text
Responsive width
```

三欄初始比例：

```text
Left Sidebar
220px

Main
flex: 1

Open Tabs
300px
```

允許使用者調整：

```text
Left Sidebar width
Right Tabs width
```

設定存在：

```text
chrome.storage.sync
```

---

## 8. Dark / Light Mode

支援：

```text
Dark
Light
System
```

預設：

```text
System
```

使用：

```text
prefers-color-scheme
```

保存：

```text
chrome.storage.sync
```

---

## 9. 資料儲存架構

核心原則：

> 網址與分類本體存在 Chrome Bookmarks，而不是 Extension 私有資料庫。

---

## 10. Bookmark Root

Extension 第一次執行時，在 Chrome Bookmarks 建立：

```text
Boardmarks
```

例如：

```text
Bookmarks Bar
└── Boardmarks
```

或：

```text
Other Bookmarks
└── Boardmarks
```

不得修改 Boardmarks 以外既有 Bookmark。

---

## 11. Bookmark Tree

資料結構：

```text
Boardmarks
│
├── Personal
│   │
│   ├── Social
│   │   ├── X
│   │   ├── Instagram
│   │   └── Facebook
│   │
│   └── Gaming
│       ├── Steam
│       ├── PSN
│       └── Nintendo
│
├── Work
│   │
│   ├── Redmine
│   │   ├── Redmine
│   │   ├── GanttPRO
│   │   └── Planner
│   │
│   └── Development
│       ├── GitHub
│       └── Claude
```

對應：

```text
Boardmarks
    ↓
Space
    ↓
Collection
    ↓
Bookmark
```

---

## 12. Space

Space 為第一層分類。

例如：

```text
Personal
Work
PHP
Development
Shopping
```

功能：

```text
新增
刪除
重新命名
拖曳排序
Star
```

點擊 Space：

```text
切換中央內容
```

---

## 13. Collection

每一個 Space 包含多個 Collection。

例如：

```text
Work

├─ Redmine
├─ Important
├─ Server
├─ Development
└─ Monitoring
```

每個 Collection 支援：

```text
名稱
排序
Collapse
Expand
Card layout
Star
```

---

## 14. Bookmark Card

每張 Card 顯示：

```text
favicon
title
```

預設不直接顯示完整 URL。

Hover 才顯示：

```text
URL
```

例如：

```text
┌──────────────────────────────┐
│ 🔵 Redmine Issue Tracking    │
└──────────────────────────────┘
```

---

## 15. Bookmark Card 操作

單擊：

```text
在目前 Window 新 Tab 開啟
```

Ctrl / Cmd + Click：

```text
背景分頁開啟
```

Middle Click：

```text
背景分頁
```

右鍵：

```text
Open
Open in new window
Edit
Move
Copy URL
Delete
```

---

## 16. Bookmark Edit

Edit Dialog：

```text
Title
URL
Collection
```

支援：

```text
Save
Cancel
Delete
```

---

## 17. Bookmark 拖曳

必須支援：

```text
Card → 同 Collection 排序
Card → 其他 Collection
Card → 其他 Space / Collection
```

使用：

```text
dnd-kit
```

不可自己手刻 HTML5 Drag & Drop，除非有明確技術理由。

---

## 18. Open Tabs Panel

右側顯示目前 Chrome：

```text
所有 Windows
所有 Tabs
```

例如：

```text
Window 1
├─ Outlook
├─ Gmail
└─ Redmine

Window 2
├─ Claude
├─ Facebook
└─ GitHub
```

取得：

```text
chrome.windows.getAll({
  populate: true
})
```

---

## 19. Tab Item

顯示：

```text
favicon
title
```

Hover：

```text
URL
```

點擊：

```text
切換到該 Window + Tab
```

---

## 20. Current Tab → Bookmark

最重要核心功能之一。

必須支援：

```text
Open Tab
    ↓ drag
Collection
    ↓
建立 Bookmark
```

建立資料：

```text
title
url
```

成功後：

```text
保留原本 Tab
```

預設：

```text
不關閉 Tab
```

---

## 21. Save and Close

Tab 右鍵提供：

```text
Save to Collection
Save & Close
Close
```

Save & Close：

```text
建立 Bookmark
↓
成功確認
↓
chrome.tabs.remove()
```

一定要：

```text
Bookmark 建立成功後才能 Close
```

---

## 22. 整個 Window 收藏

提供：

```text
Save Window
```

使用者選擇：

```text
Existing Collection
New Collection
```

例如目前：

```text
Window 2

Claude
ChatGPT
GitHub
VS Code Web
Redmine
```

按下：

```text
Save Window
```

可以產生：

```text
Collection
Development 2026-09-27

├─ Claude
├─ ChatGPT
├─ GitHub
├─ VS Code Web
└─ Redmine
```

---

## 23. Open Collection

Collection Header：

```text
Open All
```

開啟 Collection 所有 Bookmark。

必須加入保護：

如果網址：

```text
> 10
```

詢問：

```text
Open 23 tabs?
```

---

## 24. Search

左上角提供全域 Search。

搜尋：

```text
Space
Collection
Bookmark title
URL
```

搜尋應：

```text
即時
Debounce <= 150 ms
```

例如：

```text
redmine
```

顯示：

```text
Work > Redmine > Redmine Production
Work > Redmine > Issue List
```

---

## 25. Search Keyboard Shortcut

直接輸入：

```text
/
```

Focus Search。

另外：

```text
Cmd + K
Ctrl + K
```

打開 Command Palette。

---

## 26. Command Palette

第一版可以做基本版：

```text
Search Bookmark
Create Collection
Create Space
Open Settings
Toggle Open Tabs
Toggle Theme
```

介面：

```text
┌─────────────────────────────┐
│ Search commands...          │
├─────────────────────────────┤
│ Search bookmarks            │
│ Create collection           │
│ Toggle dark mode            │
└─────────────────────────────┘
```

---

## 27. Starred

支援：

```text
Star Space
Star Collection
```

Starred 顯示於左側：

```text
★ Starred
```

Star metadata 存：

```text
chrome.storage.sync
```

不要修改 Bookmark 名稱加入：

```text
★
```

---

## 28. Collapse

Collection：

```text
Expand
Collapse
```

Collapse 狀態儲存在：

```text
chrome.storage.sync
```

---

## 29. Bookmark favicon

優先使用 Chrome favicon。

不得：

```text
下載 favicon 到 Cloud
```

Fallback：

```text
default globe icon
```

favicon 載入失敗不得影響 Card。

---

## 30. Duplicate Detection

當加入 Bookmark 時檢查：

```text
normalized URL
```

如果相同 Collection 已存在：

```text
This bookmark already exists.
```

提供：

```text
Open existing
Add anyway
Cancel
```

---

## 31. URL normalization

比較時忽略：

```text
Trailing slash
```

可選擇忽略：

```text
utm_source
utm_medium
utm_campaign
```

但：

```text
不得隨意刪除網站 query string
```

因為部分網站 query 是必要資訊。

---

## 32. Drag Feedback

拖曳必須明確：

```text
Original Card opacity
Drag Overlay
Drop target highlight
Insertion position indicator
```

目標：

> 使用者必須清楚知道放開滑鼠後 Card 會去哪。

---

## 33. Auto Scroll

拖曳到畫面：

```text
top
bottom
```

時：

```text
自動 Scroll
```

---

## 34. UI Animation

動畫：

```text
150–220 ms
```

使用：

```text
CSS transition
```

避免：

```text
大量 Framer Motion
```

除非有明確理由。

目標：

```text
快速
穩定
不卡頓
```

---

## 35. Settings

Settings 頁面：

```text
Appearance

Theme
Card density
Sidebar width
Tabs panel width

Behavior

Open bookmark:
- Current window
- New window

Save Tab:
- Keep tab
- Close after save

Bookmarks

Boardmarks Root Folder

Backup

Export
Import
```

---

## 36. Card Density

支援：

```text
Compact
Comfortable
```

Compact：

```text
適合大量 Bookmark
```

---

## 37. Export

支援匯出：

```text
JSON
```

例如：

```json
{
  "version": 1,
  "exportedAt": "2026-09-27T00:00:00Z",
  "spaces": []
}
```

Export 必須包含：

```text
Space
Collection
Bookmark
metadata
```

---

## 38. Import

支援：

```text
Boardmarks JSON
```

必須有：

```text
Preview
```

顯示：

```text
3 spaces
12 collections
186 bookmarks
```

使用者確認才能 Import。

---

## 39. Undo

至少支援：

```text
Delete Bookmark
Move Bookmark
Delete Collection
```

Undo Toast：

```text
Bookmark deleted. Undo
```

Undo 時限：

```text
5 seconds
```

---

## 40. 刪除 Collection 保護

Collection 非空時：

禁止直接刪除。

確認：

```text
Delete "Redmine" and its 17 bookmarks?
```

必須明確標示。

---

## 41. 刪除 Space 保護

同理。

顯示：

```text
3 collections
48 bookmarks
```

再確認。

---

## 42. Privacy

核心原則：

```text
Local First
No Tracking
No Analytics
No Ads
No Server
```

不得將：

```text
URL
Bookmark
Tab
History
```

傳送到外部 Server。

---

## 43. 權限最小化

Manifest 僅要求實際需要：

```text
bookmarks
tabs
storage
favicon
```

若功能未使用：

```text
history
downloads
cookies
webRequest
```

不得要求。

---

## 44. First Launch

第一次啟動顯示：

```text
Welcome to Boardmarks
```

提供：

```text
Create workspace
```

建立：

```text
Boardmarks
└── Personal
    └── Favorites
```

---

## 45. Empty State

例如沒有 Collection：

```text
No collections yet

Create your first collection
```

沒有 Bookmark：

```text
Drag an open tab here
or
Add bookmark
```

---

## 46. Error Handling

任何 Chrome API：

```text
try/catch
```

錯誤不得導致整個頁面白屏。

提供：

```text
Toast error
```

例如：

```text
Unable to save bookmark.
```

---

## 47. State Architecture

建議：

```text
UI State
    ↓
Zustand

Persistent Bookmark State
    ↓
Chrome Bookmarks

Settings
    ↓
chrome.storage.sync

Temporary cache
    ↓
chrome.storage.local
```

重要：

> Bookmark tree 才是 Source of Truth。

React State 不得成為永久資料來源。

---

## 48. Bookmark Events

必須監聽：

```text
chrome.bookmarks.onCreated
chrome.bookmarks.onRemoved
chrome.bookmarks.onChanged
chrome.bookmarks.onMoved
```

當使用者透過：

```text
Chrome Bookmark Manager
```

直接修改時，Boardmarks UI 也要同步更新。

---

## 49. Tab Events

監聽：

```text
chrome.tabs.onCreated
chrome.tabs.onRemoved
chrome.tabs.onUpdated
chrome.tabs.onMoved
chrome.tabs.onActivated

chrome.windows.onCreated
chrome.windows.onRemoved
chrome.windows.onFocusChanged
```

Open Tabs Panel 應即時更新。

---

## 50. Performance

目標：

新分頁載入：

```text
< 500 ms perceived load
```

不需要等所有 favicon 完成。

Render：

```text
UI first
favicon lazy
```

---

## 51. 大型資料量測試

至少測試：

```text
10 Spaces
100 Collections
1,000 Bookmarks
100 Open Tabs
```

不能明顯 lag。

進階：

```text
5,000 Bookmarks
```

---

## 52. Accessibility

最基本：

```text
Keyboard navigation
Focus indication
aria-label
Contrast
```

所有重要 Button 都要：

```text
title
aria-label
```

---

## 53. Keyboard

至少：

```text
/
Search

Cmd/Ctrl + K
Command Palette

Esc
Close dialog

Enter
Open selected

Delete
Delete selected bookmark
```

Delete 必須避免誤觸。

---

## 54. Context Menu

Bookmark Card：

```text
Open
Open in new window
Edit
Move
Copy URL
Delete
```

Collection：

```text
Open All
Rename
Collapse
Move
Delete
```

Tab：

```text
Activate
Save
Save & Close
Close
```

---

## 55. 第一階段不要做的功能

以下全部列為：

```text
Out of Scope V1
```

包含：

```text
AI 自動分類
AI 摘要
AI 搜尋
多人共享
Team
帳號
Server Sync
Cloud Database
手機版
Safari
Firefox
公開分享
聊天功能
歷史瀏覽紀錄分析
Screenshot Preview
網頁內容全文索引
RSS
Notes
Task Manager
Calendar
Password Manager
```

避免 scope creep。

---

## 56. Project Structure

建議：

```text
boardmarks/
│
├── src/
│   │
│   ├── app/
│   │
│   ├── components/
│   │   ├── sidebar/
│   │   ├── board/
│   │   ├── collection/
│   │   ├── bookmark/
│   │   ├── tabs/
│   │   ├── dialog/
│   │   └── common/
│   │
│   ├── chrome/
│   │   ├── bookmarks.ts
│   │   ├── tabs.ts
│   │   ├── windows.ts
│   │   └── storage.ts
│   │
│   ├── hooks/
│   ├── stores/
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── styles/
│
├── public/
│
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── ARCHITECTURE.md
├── SPEC.md
└── CHANGELOG.md
```

---

## 57. TypeScript Data Models

概念模型：

```typescript
interface Space {
  id: string;
  bookmarkFolderId: string;
  name: string;
  starred: boolean;
  order: number;
}

interface Collection {
  id: string;
  bookmarkFolderId: string;
  spaceId: string;
  name: string;
  starred: boolean;
  collapsed: boolean;
  order: number;
}

interface BookmarkItem {
  id: string;
  bookmarkId: string;
  collectionId: string;
  title: string;
  url: string;
  index: number;
}

interface OpenWindow {
  id: number;
  focused: boolean;
  tabs: OpenTab[];
}

interface OpenTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
}
```

注意：

```text
Space / Collection ID 優先直接沿用 bookmark folder ID。
```

避免建立不必要的 duplicate ID system。

---

## 58. Metadata

Bookmark 本身無法存大量自訂 metadata。

因此：

```text
starred
collapsed
custom color
UI state
```

使用：

```text
chrome.storage.sync
```

例如：

```json
{
  "collections": {
    "123": {
      "starred": true,
      "collapsed": false
    }
  }
}
```

---

## 59. Storage Migration

一定要設：

```text
schemaVersion
```

例如：

```json
{
  "schemaVersion": 1
}
```

未來修改資料結構時：

```text
migration V1 → V2
```

不可直接假設資料格式永遠不變。

---

## 60. Testing

使用：

```text
Vitest
React Testing Library
```

重要 Unit Test：

```text
URL normalize
Bookmark tree parser
Space mapping
Collection mapping
Duplicate detection
Import validation
```

---

## 61. Manual Chrome Extension Test

測試：

```text
New Tab override
Create Space
Create Collection
Create Bookmark
Rename
Move
Delete
Drag Tab
Save & Close
Window switch
Chrome restart
Mac ↔ Windows sync
```

---

## 62. Build Commands

必須：

```bash
npm install
npm run dev
npm run build
npm run test
npm run lint
```

Build：

```text
dist/
```

可以直接：

```text
chrome://extensions
↓
Load unpacked
↓
dist
```

---

## 63. ESLint / Format

加入：

```text
ESLint
Prettier
```

禁止大量：

```typescript
any
```

除非有註解說明原因。

---

## 64. Error Boundary

React root 必須：

```text
ErrorBoundary
```

防止單一 Component 問題：

```text
整個 New Tab 白屏
```

---

## 65. Logging

Development：

```text
console.debug
```

Production：

避免大量 log。

建立統一：

```typescript
logger.debug()
logger.warn()
logger.error()
```

---

## 66. Security

不得：

```text
eval()
new Function()
Remote JS
```

所有 JS：

```text
bundle inside extension
```

符合 Manifest V3 CSP。

---

## 67. 開發階段

不要一次把所有功能寫完。

---

## 68. Phase 0 — Bootstrap

完成：

```text
React
TypeScript
Vite
Tailwind
Manifest V3
New Tab Override
Basic Layout
```

驗收：

```text
Chrome 安裝 Extension
↓
New Tab
↓
顯示 Boardmarks
```

---

## 69. Phase 1 — Bookmark Engine

完成：

```text
Create Boardmarks Root
Read Bookmark Tree
Space
Collection
Bookmark
Create
Edit
Delete
Move
```

驗收：

```text
Chrome Bookmarks
↕

Boardmarks UI
```

雙向同步。

---

## 70. Phase 2 — Board UI

完成：

```text
Sidebar
Space
Collection
Cards
Collapse
Star
Dark Mode
```

---

## 71. Phase 3 — Drag & Drop

完成：

```text
Bookmark reorder
Bookmark cross Collection
Collection reorder
```

必須優先確保：

```text
資料正確
```

再處理動畫。

---

## 72. Phase 4 — Open Tabs

完成：

```text
Window list
Tab list
Activate Tab
Close Tab
```

---

## 73. Phase 5 — Tab → Collection

完成：

```text
Drag Tab
↓
Collection
↓
Bookmark
```

這是 MVP 最關鍵驗收項目。

---

## 74. Phase 6 — Search

完成：

```text
Search
Command Palette
Keyboard
```

---

## 75. Phase 7 — Backup

完成：

```text
JSON Export
JSON Import
Validation
```

---

## 76. Phase 8 — Polish

最後才做：

```text
animations
hover
tooltips
empty states
responsive
performance
accessibility
```

---

## 77. MVP 定義

MVP 完成必須滿足：

```text
✓ 新分頁顯示 Boardmarks
✓ 可以建立 Space
✓ 可以建立 Collection
✓ 可以建立 Bookmark
✓ Bookmark 可以重新排序
✓ Bookmark 可以跨 Collection 移動
✓ 右側顯示所有 Chrome Tabs
✓ Tab 可以拖進 Collection
✓ 收藏後 Chrome 重開仍存在
✓ Mac / Windows Chrome Sync 後資料存在
✓ 全域搜尋
✓ Dark Mode
✓ Export JSON
```

---

## 78. V1.0 完成條件

V1.0：

```text
每天可以直接使用 Boardmarks
```

而不是：

```text
Demo
Prototype
Proof of Concept
```

品質要求：

```text
無明顯錯誤
無資料遺失
無嚴重卡頓
無 Console flooding
無 TypeScript error
無 ESLint blocking error
```

---

## 79. 資料安全優先級

此專案最重要原則：

```text
Data Integrity > UI Animation
```

如果：

```text
Drag operation
```

發生失敗：

UI 必須：

```text
rollback
```

不能出現：

```text
UI 顯示移動
但 Bookmark 實際沒有移動
```

---

## 80. Git Strategy

Branch：

```text
main
develop

feature/*
fix/*
```

Commit：

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

例如：

```text
feat: implement bookmark collection drag and drop
```

---

## 81. 文件

維護：

```text
README.md
SPEC.md
ARCHITECTURE.md
CHANGELOG.md
TODO.md
```

每完成 Phase：

更新：

```text
TODO.md
```

---

## 82. Codex 開發行為要求

以下這段建議直接一起給 Codex。

```text
你現在負責自主開發 Boardmarks。

請遵守以下規則：

1. 先完整閱讀 SPEC.md。
2. 不要一次實作所有功能。
3. 按照 Phase 0 → Phase 8 依序進行。
4. 每個 Phase 完成後先進行：
   - npm run build
   - npm run lint
   - npm run test
5. 修正所有 blocking errors 後才進下一階段。
6. 不得任意改變既定核心架構。
7. 不得自行增加 Backend。
8. 不得自行增加 AI 功能。
9. 不得自行增加會員系統。
10. 不得加入 Analytics。
11. Chrome Bookmark 必須保持 Source of Truth。
12. 所有破壞性操作都必須有錯誤處理。
13. 優先確保資料安全，其次才是 UI 美化。
14. 新功能完成後更新 TODO.md。
15. 重大架構決策更新 ARCHITECTURE.md。
16. 每個主要功能應建立合理的 reusable components。
17. 避免建立巨大單一 Component。
18. TypeScript strict mode。
19. 避免 any。
20. 不要留下大量 TODO / placeholder function。
```

---

## 83. Codex 自主循環

也可以加入：

```text
開發循環：

Read SPEC
↓
Identify next unfinished Phase
↓
Inspect current code
↓
Plan
↓
Implement
↓
Build
↓
Lint
↓
Test
↓
Fix
↓
Manual sanity review
↓
Update documentation
↓
Commit
↓
Proceed to next task
```

但：

> 遇到涉及資料模型大改、Chrome Bookmark 架構變更、破壞性 migration 時停止自主開發並等待人工確認。

---

## 84. Codex 不可自行做的決策

必須停下來詢問：

```text
更換 Framework
更換 Bookmark 儲存方式
增加 Backend
增加 Cloud DB
加入付費服務
增加登入
大幅修改資料結構
修改 Boardmarks Root Folder 架構
需要新增高風險 Chrome permissions
可能導致現有 Bookmark 遺失的 migration
```

---

## 85. UI 自主權

以下 Codex 可自行調整：

```text
spacing
font size
border radius
shadow
hover
minor layout
component naming
internal utility
```

前提：

```text
維持整體設計方向。
```

---

## 86. 未來 V1.1

V1.0 穩定後再考慮：

```text
Recent Tabs
Recently Closed
Tab Sessions
Restore Workspace
Save Current Window
Custom Collection Color
Custom Icons
Pin Collection
Tab Groups
Edge support
```

---

## 87. 未來 V1.2

可以加入一個很實用的功能：

### Workspace

例如：

```text
Development
```

按：

```text
Start Workspace
```

自動開：

```text
ChatGPT
Claude
GitHub
Redmine
GanttPRO
Wiki
```

結束：

```text
Save Workspace
```

目前 Tabs 狀態重新保存。

這時 Boardmarks 就開始從：

> Bookmark Manager

變成：

> Workspace Manager

---

## 88. 未來 V2

才研究：

```text
Local LLM
```

例如：

```text
Smart Categorization

「這個網址要放哪？」
↓

Development
→ AI Tools
```

可以走：

```text
Ollama
```

而不是必須付 API Token。

但這完全不屬於 V1。

---

## 89. 第一個 Codex Goal

建議開新專案後，不要直接要求一次全部做完。

第一個 Goal：

```text
根據 SPEC.md 建立 Boardmarks Chrome Extension 專案。

本階段僅執行 Phase 0：

1. 建立 React + TypeScript + Vite 專案。
2. 使用 Manifest V3。
3. 實作 Chrome New Tab Override。
4. 建立三欄式基本 Layout：
   - Left Sidebar
   - Main Board
   - Open Tabs Panel
5. 建立基本 Dark / Light theme 架構。
6. 建立建議的 src 目錄結構。
7. 設定 ESLint、Prettier、Vitest。
8. 建立 README.md、SPEC.md、ARCHITECTURE.md、TODO.md。
9. npm run build 必須成功。
10. 暫時不要實作 Bookmark、Tabs API、Drag & Drop。

完成後停止，回報：
- 建立了哪些檔案
- 架構說明
- Build 結果
- 下一階段 Phase 1 的建議
```

---

## 90. 開發原則總結

不要第一個 Goal 就讓 Codex 把所有 Phase 一次寫完。

這個專案最容易出問題的地方是：

```text
Bookmark Data Model
        +
Drag & Drop
        +
Chrome Bookmark 真實資料同步
```

只要前面架構定好，後面開發會快很多。

建議以 SPEC 作為最高規格來源，再按照 Phase 0 → Phase 8 逐步執行。
