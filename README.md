# 格莉奇遊樂園・抓娃娃機

以 Three.js 製作的獨立 3D 抓娃娃機，也是格莉奇遊樂園的第二款小遊戲。機台裡有七名正篇角色的布偶；玩家移動吊爪、抓取獎品，成功後會顯示角色頭像並記錄收集進度。

## 操作

- 電腦：方向鍵或 WASD 移動，空白鍵抓取。
- 手機：使用畫面下方的方向鍵與「抓取」按鈕。
- 獨立遊玩時，進度儲存在瀏覽器的 `localStorage`。
- 嵌入 Larch 時，使用 `postMessage` 傳送 `claw:ready`、`claw:save` 與 `claw:exit`。

## 本機預覽

```bash
python3 -m http.server 8000
```

開啟 <http://localhost:8000>。本專案不需要安裝套件或建置。

## 測試介面

網址加上 `?test=1` 後，可從瀏覽器主控台使用 `window.__clawTest` 檢查狀態、移動吊爪或指定下一次抓到的角色。
