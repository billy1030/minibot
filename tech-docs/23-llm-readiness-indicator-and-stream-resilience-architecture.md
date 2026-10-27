# 23. LLM 服務可用性指示器與串流彈性容錯架構 (LLM Readiness Indicator & Stream Resilience Architecture)

## 1. 概述與架構動機 (Executive Summary & Design Goals)

在現代 Agentic AI 系統中，使用者體驗高度依賴於長連線伺服器發送事件（Server-Sent Events, SSE）的即時串流反饋。當系統遇到網絡抖動、API 配額耗盡、金鑰失效或推論模型異常斷線時，前端若未具備完備的狀態機防禦機制，極易引發串流狀態掛起（Stream Freeze）、訊息懸掛與介面假死現象。

本文件記錄 **MiniBot** 在高並發與多工具迴圈架構下，針對串流異常中斷引發的「Reasoning... ⏱️ 0s」凍結問題進行的完整工程驗屍（Autopsy），並闡述全新建構的 **LLM Readiness 雙軌狀態監控指示器** 與 **端到端串流防禦性狀態機（Defensive Stream State Machine）**。

---

## 2. 串流異常「0s 凍結」問題架構驗屍 (Autopsy of the "0s" Stream Freeze)

### 2.1 故障現象 (Symptoms)
使用者在送出提示詞後，聊天對話泡泡長時間停留於：
```text
Reasoning through tool outputs... ⏱️ 0s
```
畫面既無進一步文字輸出，亦未觸發錯誤提示，且耗時數字固定在 `0s`。

### 2.2 根本原因分析 (Root Cause Analysis)

在 MiniBot 過去的前端串流接收與狀態管理架構中，存在以下關鍵漏洞：

```
[User Prompts] ──> fetch("/api/chat")
                         │
                         ├── (1) 伺服器回傳 4xx / 5xx 或未預期中斷
                         │   舊架構：未檢查 if (!response.ok)，直接調用 response.body.getReader()
                         │
                         ├── (2) 後端發送 SSE event: error
                         │   舊架構：SSE 解析器只處理 message，缺少 event === "error" 分支處理
                         │
                         ├── (3) 串流 reader 提前結束 (done: true)
                         │   舊架構：while 循環跳出，未進入 catch 區塊；
                         │           finally 僅設置 setLoading(false)，但未將訊息物件內的 isStreaming 置為 false！
                         │
                         └── (4) UI 渲染邏輯衝突：
                             舊 UI 條件：m.isStreaming
                             時間計算器：loading ? (now - startTime) : 0
                             ==> 當 loading = false 但 m.isStreaming = true 時，計算器重設為 0，
                                 UI 判定仍處於串流中，形成永久 "Reasoning... ⏱️ 0s" 殭屍狀態！
```

1. **HTTP 握手異常忽略**：前端未驗證 `fetch("/api/chat")` 回應之 `response.ok`，若後端噴出 `401 Unauthorized` 或 `500 Internal Error`，前端仍試圖將 HTML/JSON 錯誤當作 SSE 串流解析。
2. **SSE Error 事件丟失**：當後端 Agent Loop 發生執行期崩潰或逾時，後端發送 `event: error\ndata: ...`。前端事件監聽器僅過濾了標準資料塊，未攔截 `event === "error"`。
3. **狀態解耦不對稱**：全域 `loading` 狀態（控制輸入框與發送按鈕）與單則訊息的 `isStreaming` 屬性（控制泡泡內的思考動畫）未保持原子一致性。在 `finally` 區塊中僅將 `loading` 設為 `false`，遺留了帶有 `isStreaming: true` 的半成品訊息。
4. **計時器歸零衝突**：在 UI 渲染層，計時器依賴於 `loading ? liveElapsedSec : 0`。一旦 `loading` 被清掉但 `isStreaming` 未被清掉，耗時便強制歸零，導致泡泡永遠顯示 `0s`。

---

## 3. 雙軌健康指標：Agent Engine Online vs. LLM Ready

為了讓使用者與運維人員精準定位系統健康狀態，MiniBot 建立了明確的雙軌架構分離：

```
┌────────────────────────────────────────────────────────────────────────┐
│ MiniBot Operational Status Model                                      │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 1. ⚙️ Agent Engine Online         │ 2. 🤖 LLM Ready                     │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • 範疇：本機基礎設施 (Infrastructure) │ • 範疇：推論模型能力 (Cognitive Engine)   │
│ • 職責：                          │ • 職責：                            │
│   - Express API 伺服器 (Port 7009) │   - 與大語言模型 API 通訊 (MiniMax/   │
│   - ReAct 執行回圈核心            │     DeepSeek/Claude/Qwen/Ollama)    │
│   - 17+ 個本機 MCP 子程序運行與通訊  │   - API Key 認證與授權有效性         │
│   - 檔案系統/工作區存取權限       │   - 配額 (Quota) 與即時連線延遲      │
│   - WebSocket/SSE 管道狀態        │   - 模型端推理服務健康度            │
│ • 判定方式：本機 HTTP 心跳即時反映 │ • 判定方式：發送端到端輕量探針 (`/api/llm/test`) │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### 3.1 核心差異與典型情境對比

| 情境狀態 | Agent Engine Online | LLM Ready | 系統實際行為與用戶處置建議 |
|---|---|---|---|
| **完全正常** | 🟢 綠色正常 | 🟢 綠色正常 | 系統完全就緒，可執行高複雜度 Multi-Agent / MCP 工具循環任務。 |
| **API Key 失效 / 欠費** | 🟢 綠色正常 | 🔴 紅色異常 | 本機伺服器與 MCP 工具正常，但對話會失敗。使用者應點擊模型切換器檢查 API Key、餘額或切換備用模型。 |
| **遠端 LLM 服務當機 / 牆阻** | 🟢 綠色正常 | 🔴 紅色異常 | 網路或供應商故障。系統會即時在模型按鈕旁亮紅燈並提供點擊重新測試（Retest）。 |
| **本機後端服務未啟動** | 🔴 紅色斷線 | ⚪ 灰色/不可達 | Node.js 伺服器掛掉或 Port 7009 被阻擋。需執行 `startup.bat` 或檢查伺服器日誌。 |

---

## 4. 防禦性串流狀態機實作 (Defensive Stream State Machine)

針對串流崩潰問題，前端 [`frontend/src/App.tsx`](file:///c:/ai/loop-engg/frontend/src/App.tsx) 部署了五重防禦機制：

### 4.1 第一重：HTTP 響應狀態驗證
在進入 Reader 前，嚴格校驗 HTTP 響應：
```typescript
if (!response.ok) {
  let errorMsg = `Server error (HTTP ${response.status})`;
  try {
    const errorJson = await response.json();
    if (errorJson.error) errorMsg = errorJson.error;
  } catch {}
  throw new Error(errorMsg);
}
```

### 4.2 第二重：SSE `event: error` 攔截器
在 SSE 事件分發迴圈中，專門掛載錯誤事件處理，將錯誤內容寫入助理對話歷史中並中斷串流：
```typescript
if (currentEvent === "error") {
  const errorMsg = dataStr || "Unknown loop execution error";
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMsgId
        ? {
            ...msg,
            content: msg.content
              ? `${msg.content}\n\n> ⚠️ **[Loop Error]**: ${errorMsg}`
              : `> ⚠️ **[Loop Error]**: ${errorMsg}`,
            isStreaming: false,
          }
        : msg
    )
  );
  break; // 終止 reader 讀取
}
```

### 4.3 第三重：串流結束雙重收尾保證 (Dual Cleanup Assurance)
無論正常結束或是中途拋出例外，均確保清除 `isStreaming` 標記：
1. **Reader 正常完成收尾**：`while` 迴圈結束後，主動遍歷並強制將當前 `assistantMsgId` 的 `isStreaming` 設置為 `false`。
2. **`finally` 區塊終極兜底**：
```typescript
finally {
  setLoading(false);
  abortControllerRef.current = null;
  // 終極安全網：杜絕任何殭屍 isStreaming 狀態留在當前訊息中
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
    )
  );
}
```

### 4.4 第四重：對話載入清洗 (Session Hydration Sanitizer)
使用者在切換 Session 或重新整理網頁載入歷程記錄時，自動過濾殘留狀態：
```typescript
const sanitized = (sessionData.messages || []).map((m: any) => ({
  ...m,
  isStreaming: false, // 歷史訊息永不應帶有串流標記
}));
setMessages(sanitized);
```

### 4.5 第五重：UI 渲染雙條件約束與重試按鈕
UI 渲染邏輯調整為必須**同時符合** `loading` 與 `m.isStreaming`，才繪製即時計時器；若串流已結束但內容為空，則友善呈現重試按鈕：
```tsx
{loading && m.isStreaming ? (
  <div className="reasoning-pill">
    <span className="spinner" />
    <span>Reasoning through tool outputs...</span>
    <span className="timer">⏱️ {liveElapsedSec}s</span>
  </div>
) : !m.content ? (
  <div className="stream-fail-card">
    <span>*(No response received)*</span>
    <button onClick={() => retryTurn(m.id)}>🔄 Retry / Rollback</button>
  </div>
) : null}
```

---

## 5. UI/UX 視覺指示器設計 (Visual UI Implementations)

### 5.1 頂部導航列指示器 (Top Header Pill)
位於頂部導航列右側，與 `Agent Engine Online` 並列呈現：
- **綠燈**：`LLM Ready`（發光綠色光暈 `#10b981`，帶微光呼吸效果）。
- **紅燈**：`LLM Offline` 或 `LLM Error`（發光紅色警告 `#ef4444`）。
- **黃燈**：`LLM Checking...`（帶自轉動畫的測試中圖示）。

### 5.2 底部 Dock 快速模型切換器 (Bottom Quick Model Switcher)
在輸入框左下角的模型選擇器按鈕上，直接鑲嵌即時微型狀態圓點：
- 使用者無需打開設定面板即可一眼得知當前選定模型能否正常連線。
- 點擊展開模型切換選單後，頂部提供：
  - 當前模型狀態說明標籤。
  - **🔄 Re-test 按鈕**：一鍵向 `/api/llm/test` 發送輕量驗證封包，無縫更新狀態。

---

## 6. 驗證與測試矩陣 (Verification & Operational Testing Matrix)

| 測試場景 | 模擬方式 | 預期系統行為 | 驗證結果 |
|---|---|---|---|
| **後端斷網 / API Key 錯誤** | 在設定中填寫錯誤 API Key 並執行 `/api/llm/test` | 頂部與底部指示器即刻變紅，提示「LLM Error」，點擊切換器可重新測試。 | ✅ 通過 |
| **串流中途後端進程崩潰** | 串流生成過程中強制殺死後端 process | 前端立即捕獲 Fetch Error，中斷 Reader，對話框收斂並顯示錯誤訊息，計時器停止，絕不出現 `0s` 懸掛。 | ✅ 通過 |
| **後端拋出 SSE error 事件** | 工具執行逾時或 ReAct 迴圈達上限拋出 error | 前端捕捉到 `event: error`，以引用標籤格式印出 `[Loop Error]`，安全關閉串流。 | ✅ 通過 |
| **重新載入歷史 Session** | 切換至曾發生錯誤中斷的舊會話 | 經由 Session Sanitizer，所有歷程訊息的 `isStreaming` 均被重置為 `false`，無殭屍動畫。 | ✅ 通過 |
