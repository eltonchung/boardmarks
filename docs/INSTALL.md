# Boardmarks 安裝、搬移與更新

這是以「載入未封裝項目」使用的 Chrome 外掛。Chrome 會從指定資料夾讀取程式，載入後必須保留該資料夾；ZIP 壓縮檔可以刪除。

## 固定安裝位置

- Windows：`%LOCALAPPDATA%\Boardmarks\extension`
- Mac：`~/Library/Application Support/Boardmarks/extension`

Windows 在檔案總管網址列輸入 `%LOCALAPPDATA%`；Mac 在 Finder 按 `⌘⇧G`，輸入 `~/Library/Application Support`。再建立 `Boardmarks` 及其內的 `extension` 資料夾。

資料夾名稱保持固定，不加版本號。不要放在下載資料夾、桌面、Chrome.app 內，或 Chrome 的 User Data／Extensions 內部目錄。

## 第一次安裝

1. 解壓縮 ZIP，將其中 `Boardmarks` 資料夾內的全部內容複製到上述 `extension` 資料夾。
2. 確認 `extension` 裡直接有 `manifest.json`、`index.html`、`assets` 等檔案，不是多包了一層 Boardmarks。
3. 在 Chrome 開啟 `chrome://extensions`，開啟「開發人員模式」。
4. 點「載入未封裝項目」，選擇固定位置的 `extension` 資料夾。
5. 開啟新分頁，若出現新分頁變更提示，確認使用 Boardmarks。沒有既有工作區時，再點「建立我的工作區」。

## 已安裝後搬到固定位置

1. 先在 Boardmarks「設定 → 匯出 JSON」留一份書籤備份。
2. 將目前載入資料夾的全部內容複製到固定位置，暫時保留舊資料夾。
3. 在同一個 Chrome 個人資料的 `chrome://extensions`，點「載入未封裝項目」，選擇新位置。不要先移除外掛。
4. 核對 Boardmarks 的 ID 為 `dpmhkjmgcjapjmkeaeocemmmfnadgdnh`，並確認載入來源已指向新位置。
5. 開啟新分頁，檢查原有收藏及設定正常後，才刪除舊資料夾。

如果新位置沒有成功載入，保留舊資料夾繼續使用；不要在未確認前清理檔案。

## 日後更新

1. 解壓縮新版 ZIP。
2. 將新版 `Boardmarks` 裡的全部內容複製到同一個 `extension` 資料夾，覆蓋同名檔案；不要只複製 manifest，也不要建立版本子資料夾。
3. 到 `chrome://extensions`，點 Boardmarks 的「重新載入」。
4. 開啟新分頁，在設定底部核對版本。

一般更新不需要移除外掛。原生書籤存於 Chrome；設定及星號等額外資料存於外掛儲存區，都不在安裝資料夾內。JSON 匯入會追加收藏，不會覆蓋既有資料，也不會自動套用備份中的外觀設定。

## Mac／Windows

兩台可使用不同安裝路徑，但應使用相同版本及上述相同外掛 ID。書籤和設定跨裝置同步需要相同 Chrome 帳號與相應同步選項；安裝包本身不會啟用同步，也不會上傳到 Boardmarks 自建伺服器。
