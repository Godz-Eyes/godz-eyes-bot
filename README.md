# 👁️ God's Eyes - VRC25 Whale Trade Detector

**God's Eyes** is a high-performance Telegram bot that monitors on-chain whale trades on the Viction network, specifically focusing on the **VRC25** token standard. Designed for traders and analysts who want to track big movements and act quickly.

---

## ⚙️ Features

- 🛰 Real-time monitoring of all swaps on Viction
- 💸 Alerts large trades ("whale trades") across VRC25 tokens
- 🔍 Detects both BUY/SELL direction even through multi-hop routes
- 🧠 Native token (VIC) handling without Transfer event
- 📡 Supports multi-group/topic broadcasting
- 🪪 Address labeling with OneID + local cache
- 📦 Fully production-ready (Railway / local)

---

## 📦 Structure

```
src/
├── bot/                 # Telegram bot logic
├── services/            # Core logic (block listener, analyzer)
├── utils/               # Helpers (cache, tokenList, label)
├── scripts/             # Manual scripts (e.g. send intro alert)
├── chatIds.json         # List of chatId + threadId for broadcasting
├── addressLabels.json   # Cached OneID labels
```

---

## 🔍 Whale Detection Logic

We track swaps involving **VRC25 tokens** against these base tokens:

- ✅ `C98`
- ✅ `WVIC` (Wrapped VIC)
- ✅ `VIC` (native)

A trade is considered a **whale trade** when:
- The value of the swap in quote token (C98/WVIC/VIC) is **greater than or equal to a defined `threshold`**

### ✅ Detected Actions:
| Direction | Swap Type | Detected via |
|-----------|-----------|-------------------|
| `SELL`    | token → VIC       | Native balance received (`txValue = 0`, but user gets VIC)
| `BUY`     | VIC → token       | `tx.value > 0`
| `SELL`    | token → C98/WVIC  | Transfer log (user sends token, receives quote)
| `BUY`     | C98/WVIC → token  | Transfer log (user sends quote, receives token)


---

## 🚀 How to Run

### 1. Clone repo & install deps
```bash
yarn install
```

### 2. Setup `.env`
```env
TELEGRAM_BOT_TOKEN=your_bot_token
THRESHOLD_TOKEN=10000
```

### 3. Add your group/topic to `chatIds.json`
```json
[
  { "chatId": -1001234567890 },
  { "chatId": -1009876543210, "threadId": 42 }
]
```

### 4. Start monitoring
```bash
yarn start
```

> Bot will connect to Viction RPC and begin watching for whale trades in real-time.

---

## 📤 Manual Broadcast

Want to send a one-time intro alert?
```bash
npx ts-node scripts/sendIntroAlert.ts
```

---

## 💡 Tech Stack
- [Viem](https://viem.sh) for RPC interactions
- `node-telegram-bot-api` for messaging
- TypeScript for type safety
- JSON file cache for address labeling + multi-chat

---

## 👨‍💻 Author
Built with clarity & purpose by **builders, for builders.**

> Crafted by builders, for the chain. No noise, no hype — just signal.

