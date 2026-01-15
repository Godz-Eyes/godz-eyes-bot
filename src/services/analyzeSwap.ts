import { tokenMap, quoteTokenAddresses } from "../utils/tokenList";

const isQuote = (addr: string) =>
  quoteTokenAddresses.includes(addr.toLowerCase());

// Define logical constants to avoid magic strings
const SYMBOL_VIC = "VIC";
const DIRECTION_BUY = "BUY";
const DIRECTION_SELL = "SELL";

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
  const normalizedUser = userAddress.toLowerCase();

  for (const log of logs) {
    const addr = log.tokenAddress.toLowerCase();
    if (!tokenTotals[addr]) tokenTotals[addr] = { fromUser: 0, toUser: 0 };

    if (log.from.toLowerCase() === normalizedUser) {
      tokenTotals[addr].fromUser += log.value;
    }

    if (log.to.toLowerCase() === normalizedUser) {
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

    // Case 1: SELL token -> Receive VIC
    // User sends Token (>0), receives VIC via internal tx (nativeReceived >= threshold)
    // No other transfer logs for VIC since it's native.
    if (
      !isQuoteToken &&
      fromUser > 0 &&
      toUser === 0 &&
      nativeReceived >= threshold
    ) {
      actions.push({
        direction: DIRECTION_SELL,
        tokenSymbol: token.symbol,
        quoteSymbol: SYMBOL_VIC,
        amountToken: fromUser,
        amountQuote: nativeReceived,
        from: userAddress,
        to: userAddress,
      });
      continue;
    }

    // Case 2: BUY token <- Send VIC
    // User receives Token (>0), sent VIC via txValue (txValue >= threshold)
    if (!isQuoteToken && toUser > 0 && fromUser === 0 && txValue >= threshold) {
      actions.push({
        direction: DIRECTION_BUY,
        tokenSymbol: token.symbol,
        quoteSymbol: SYMBOL_VIC,
        amountToken: toUser,
        amountQuote: txValue,
        from: userAddress,
        to: userAddress,
      });
      continue;
    }

    // Case 3: SELL token -> Receive Quote Token (e.g., C98, USDT)
    if (!isQuoteToken && fromUser > 0 && toUser === 0) {
      // Find the quote token that the user RECEIVED
      const quote = Object.entries(tokenTotals).find(
        ([addr, t]) => isQuote(addr) && t.toUser > 0 // Check generic receive > 0 to match, then check threshold
      );

      if (quote) {
        const [quoteAddr, quoteData] = quote;
        // Verify value meets threshold
        if (quoteData.toUser >= threshold) {
            const quoteToken = tokenMap[quoteAddr];
    
            const fromLog = logs.find(
              (l) =>
                l.tokenAddress.toLowerCase() === tokenAddress &&
                l.from.toLowerCase() === normalizedUser
            );
    
            const toLog = logs.find(
              (l) =>
                l.tokenAddress.toLowerCase() === quoteAddr &&
                l.to.toLowerCase() === normalizedUser
            );
    
            actions.push({
              direction: DIRECTION_SELL,
              tokenSymbol: token.symbol,
              quoteSymbol: quoteToken.symbol,
              amountToken: fromUser,
              amountQuote: quoteData.toUser,
              from: fromLog?.from || userAddress,
              to: toLog?.from || userAddress,
            });
        }
      }
    }

    // Case 4: BUY token <- Send Quote Token
    if (!isQuoteToken && toUser > 0 && fromUser === 0) {
      // Find the quote token that the user SENT
      const quote = Object.entries(tokenTotals).find(
        ([addr, t]) => isQuote(addr) && t.fromUser > 0
      );

      if (quote) {
        const [quoteAddr, quoteData] = quote;
         if (quoteData.fromUser >= threshold) {
            const quoteToken = tokenMap[quoteAddr];
    
            const fromLog = logs.find(
              (l) =>
                l.tokenAddress.toLowerCase() === quoteAddr &&
                l.from.toLowerCase() === normalizedUser
            );
    
            const toLog = logs.find(
              (l) =>
                l.tokenAddress.toLowerCase() === tokenAddress &&
                l.to.toLowerCase() === normalizedUser
            );
    
            actions.push({
              direction: DIRECTION_BUY,
              tokenSymbol: token.symbol,
              quoteSymbol: quoteToken.symbol,
              amountToken: toUser,
              amountQuote: quoteData.fromUser,
              from: fromLog?.to || userAddress,
              to: toLog?.to || userAddress,
            });
         }
      }
    }

    // Case 5: Swap between 2 Quote tokens (e.g. VIC <-> C98 is covered above if VIC is native, but C98 <-> USDT)
    // We need to ensure we don't double count. We only process this if the *current* loop token is one of the quotes.
    // To simplify, we handled "Quote Pair" logic separately in previous code.
    // Here we can do it once:
    // Let's rely on the separate block logic below for clarity as per previous implementation, but hardened.
  }

   // Swap 2 quote tokens (e.g. USDT <-> C98)
    // We isolate this logic to ensure we don't process it multiple times inside the loop above
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

        // Ensure we haven't already added this action (unlikely with this logic, but good practice)
        // Simply push the action.
        actions.push({
          direction: DIRECTION_BUY, // Buying 'toToken' with 'fromToken'
          tokenSymbol: tokenMap[toAddr].symbol, // "Buying" target
          quoteSymbol: tokenMap[fromAddr].symbol, // Paying with quote
          amountToken: toData.toUser,
          amountQuote: fromData.fromUser,
          from: userAddress,
          to: userAddress,
        });
      }
    }

  return actions;
};
