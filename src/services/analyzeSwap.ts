// 📁 src/services/analyzeSwap.ts

import { tokenMap, quoteTokenAddresses } from "../utils/tokenList";

const isQuote = (addr: string) =>
  quoteTokenAddresses.includes(addr.toLowerCase());

export type TransferLog = {
  tokenAddress: string;
  symbol: string;
  from: string;
  to: string;
  value: number;
};

export type SwapAction = {
  tokenSymbol: string;
  quoteSymbol: string;
  amountToken: number;
  amountQuote: number;
  direction: "BUY" | "SELL";
  from: string;
  to: string;
};

export const analyzeSwap = (
  logs: TransferLog[],
  userAddress: string,
  threshold: number
): SwapAction[] => {
  const tokenMapByUser: Record<string, { fromUser: number; toUser: number }> =
    {};

  for (const log of logs) {
    const addr = log.tokenAddress.toLowerCase();
    if (!tokenMapByUser[addr])
      tokenMapByUser[addr] = { fromUser: 0, toUser: 0 };

    if (log.from.toLowerCase() === userAddress.toLowerCase()) {
      tokenMapByUser[addr].fromUser += log.value;
    }

    if (log.to.toLowerCase() === userAddress.toLowerCase()) {
      tokenMapByUser[addr].toUser += log.value;
    }
  }

  const actions: SwapAction[] = [];

  for (const tokenAddress in tokenMapByUser) {
    const token = tokenMap[tokenAddress];
    if (!token) continue;

    const { fromUser, toUser } = tokenMapByUser[tokenAddress];

    if (isQuote(tokenAddress)) {
      // User NHẬN quote → SELL
      if (toUser >= threshold) {
        const sellToken = logs.find(
          (l) =>
            !isQuote(l.tokenAddress) &&
            l.from.toLowerCase() === userAddress.toLowerCase()
        );
        if (sellToken) {
          actions.push({
            direction: "SELL",
            tokenSymbol: sellToken.symbol,
            quoteSymbol: token.symbol,
            amountToken: sellToken.value,
            amountQuote: toUser,
            from: sellToken.from,
            to: sellToken.to,
          });
        }
      }

      // User GỬI quote → BUY
      if (fromUser >= threshold) {
        const buyToken = logs.find(
          (l) =>
            !isQuote(l.tokenAddress) &&
            l.to.toLowerCase() === userAddress.toLowerCase()
        );
        if (buyToken) {
          actions.push({
            direction: "BUY",
            tokenSymbol: buyToken.symbol,
            quoteSymbol: token.symbol,
            amountToken: buyToken.value,
            amountQuote: fromUser,
            from: buyToken.from,
            to: buyToken.to,
          });
        }
      }
    }
  }

  return actions;
};
