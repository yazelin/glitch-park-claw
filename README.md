# 格莉奇遊樂園・抓娃娃機

以 Three.js 製作的獨立 3D 抓娃娃機，也是格莉奇遊樂園的第二款小遊戲。機台裡有七名正篇角色的布偶；玩家移動吊爪、抓取獎品，成功後會顯示角色頭像並記錄收集進度。

## 操作

- 先點擊機台上閃爍的「投幣孔」，再開始操作。
- 電腦：拖動機台搖桿，或用方向鍵與 WASD 移動；按機台上的「夾取」，或按空白鍵開始抓取。也可按 C 鍵投幣。
- 手機：滑動機台上的搖桿移動，再點機台上的「夾取」。
- 點右上角的收集進度，可查看已經夾到的角色。
- 右上角可切換全部聲音；獨立開啟時會在第一次操作後循環播放遊樂園主題曲，投幣、移動、下降、夾取、落物及結果也都有聲音回饋。
- 獨立遊玩時，進度儲存在瀏覽器的 `localStorage`。
- 嵌入 Larch 時，本頁不播放背景音樂，而以 `glitch-park:music` 請外層持續播放同一首主題曲；另使用 `postMessage` 傳送 `claw:ready`、`claw:save` 與 `claw:exit`。

## 本機預覽

```bash
python3 -m http.server 8000
```

開啟 <http://localhost:8000>。本專案不需要安裝套件或建置。

## 素材與效能規則

- 七台背景機台和後方廣告牆共用 `assets/glitch-atlas.webp`，以 UV 位移選取不同圖格。
- 娃娃胸牌、右上角進度、結果卡與收藏清單共用 `assets/avatar-atlas.webp`，不會分別載入七張頭像。
- 手機版降低渲染像素比並停用即時陰影；立方體和圓球也共用幾何資料，減少 GPU 與記憶體負擔。
- 未來製作扭蛋機與遊樂園入口時，角色圖、機台廣告和介面頭像也沿用 atlas。新增圖片前，先併入用途相同的 atlas，不要在迴圈中逐張載入。
- 小圖維持 WebP，遠景貼圖只保留實際畫面需要的解析度；不為螢幕上不到 200 像素的圖面載入原始大圖。
- 遊樂園主題曲是 58 秒、96 kbps 的循環 MP3，延後到使用者開始操作才播放，不阻塞首屏 3D 場景。

## 測試介面

網址加上 `?test=1` 後，可從瀏覽器主控台使用 `window.__clawTest` 檢查狀態、移動吊爪或指定下一次抓到的角色。

主題曲改從 jsDelivr 載（五款共用同一個網址，瀏覽器快取共用）：`https://cdn.jsdelivr.net/gh/yazelin/glitch-park-claw@main/assets/audio/glitch-park-theme.mp3`。
Pages 直連 700 KB 要 11 秒、jsDelivr 1 秒。改檔要 purge：`https://purge.jsdelivr.net/gh/yazelin/glitch-park-claw@main/assets/audio/glitch-park-theme.mp3`。
