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
  threshold: number,
  txValue: number = 0, // amount of VIC sent (in VIC)
  nativeReceived: number = 0 // amount of VIC received (in VIC)
): SwapAction[] => {
  const tokenTotals: Record<string, { fromUser: number; toUser: number }> = {};

  for (const log of logs) {
    const addr = log.tokenAddress.toLowerCase();
    if (!tokenTotals[addr]) tokenTotals[addr] = { fromUser: 0, toUser: 0 };

    if (log.from.toLowerCase() === userAddress.toLowerCase()) {
      tokenTotals[addr].fromUser += log.value;
    }

    if (log.to.toLowerCase() === userAddress.toLowerCase()) {
      tokenTotals[addr].toUser += log.value;
    }
  }

  const actions: SwapAction[] = [];

  for (const [tokenAddress, { fromUser, toUser }] of Object.entries(
    tokenTotals
  )) {
    const token = tokenMap[tokenAddress];
    if (!token) continue;

    const isQuoteToken = isQuote(tokenAddress);

    // Case: SELL token → receive VIC (no Transfer log for VIC)
    if (
      !isQuoteToken &&
      fromUser > 0 &&
      toUser === 0 &&
      nativeReceived >= threshold
    ) {
      actions.push({
        direction: "SELL",
        tokenSymbol: token.symbol,
        quoteSymbol: "VIC",
        amountToken: fromUser,
        amountQuote: nativeReceived,
        from: userAddress,
        to: userAddress,
      });
      continue;
    }

    // Case: BUY token ← send VIC
    if (!isQuoteToken && toUser > 0 && fromUser === 0 && txValue >= threshold) {
      actions.push({
        direction: "BUY",
        tokenSymbol: token.symbol,
        quoteSymbol: "VIC",
        amountToken: toUser,
        amountQuote: txValue,
        from: userAddress,
        to: userAddress,
      });
      continue;
    }

    // Case: SELL token → receive quote (C98/WVIC...)
    if (!isQuoteToken && fromUser > 0 && toUser === 0) {
      const quote = Object.entries(tokenTotals).find(
        ([addr, t]) => isQuote(addr) && t.toUser >= threshold
      );

      if (quote) {
        const [quoteAddr, quoteData] = quote;
        const quoteToken = tokenMap[quoteAddr];

        const fromLog = logs.find(
          (l) =>
            l.tokenAddress.toLowerCase() === tokenAddress &&
            l.from.toLowerCase() === userAddress.toLowerCase()
        );

        const toLog = logs.find(
          (l) =>
            l.tokenAddress.toLowerCase() === quoteAddr &&
            l.to.toLowerCase() === userAddress.toLowerCase()
        );

        actions.push({
          direction: "SELL",
          tokenSymbol: token.symbol,
          quoteSymbol: quoteToken.symbol,
          amountToken: fromUser,
          amountQuote: quoteData.toUser,
          from: fromLog?.from || userAddress,
          to: toLog?.from || userAddress,
        });
      }
    }

    // Case: BUY token ← send quote
    if (!isQuoteToken && toUser > 0 && fromUser === 0) {
      const quote = Object.entries(tokenTotals).find(
        ([addr, t]) => isQuote(addr) && t.fromUser >= threshold
      );

      if (quote) {
        const [quoteAddr, quoteData] = quote;
        const quoteToken = tokenMap[quoteAddr];

        const fromLog = logs.find(
          (l) =>
            l.tokenAddress.toLowerCase() === quoteAddr &&
            l.from.toLowerCase() === userAddress.toLowerCase()
        );

        const toLog = logs.find(
          (l) =>
            l.tokenAddress.toLowerCase() === tokenAddress &&
            l.to.toLowerCase() === userAddress.toLowerCase()
        );

        actions.push({
          direction: "BUY",
          tokenSymbol: token.symbol,
          quoteSymbol: quoteToken.symbol,
          amountToken: toUser,
          amountQuote: quoteData.fromUser,
          from: fromLog?.to || userAddress,
          to: toLog?.to || userAddress,
        });
      }
    }

    // Swap 2 quote tokens (e.g. VIC <-> C98)
    const quotePairs = Object.entries(tokenTotals).filter(([addr]) =>
      isQuote(addr)
    );

    if (quotePairs.length >= 2) {
      const fromQuote = quotePairs.find(
        ([_, data]) => data.fromUser >= threshold
      );
      const toQuote = quotePairs.find(([_, data]) => data.toUser >= threshold);

      if (fromQuote && toQuote) {
        const [fromAddr, fromData] = fromQuote;
        const [toAddr, toData] = toQuote;

        actions.push({
          direction: "BUY", // or SELL, depending on the definition (e.g., SELL VIC to get C98)
          tokenSymbol: tokenMap[fromAddr].symbol,
          quoteSymbol: tokenMap[toAddr].symbol,
          amountToken: fromData.fromUser,
          amountQuote: toData.toUser,
          from: userAddress,
          to: userAddress,
        });
      }
    }
  }

  return actions;
};
