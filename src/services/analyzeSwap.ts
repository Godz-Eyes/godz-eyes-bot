import { tokenMap, quoteTokenAddresses } from "../utils/tokenList";
import { logger } from "../utils/logger";

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
  txInitiator: string, // receipt.from, used for Native VIC checks
  threshold: number,
  txValue: number = 0, // amount of VIC sent (in VIC) by initiator
  nativeReceivedByInitiator: number = 0 // amount of VIC received (in VIC) by initiator
): SwapAction[] => {
  // 1. Identify all participants
  const participants = new Set<string>();
  logs.forEach(l => {
    participants.add(l.from.toLowerCase());
    participants.add(l.to.toLowerCase());
  });

  // Ensure initiator is in the list (for native checks)
  const normalizedInitiator = txInitiator.toLowerCase();
  participants.add(normalizedInitiator);

  const actions: SwapAction[] = [];

  // 2. Iterate each participant to see if THEY made a swap
  for (const userAddress of participants) {
      const normalizedUser = userAddress.toLowerCase();
      
      // Build token NET totals for this user
      // Net > 0 means Received
      // Net < 0 means Sent
      const tokenNets: Record<string, number> = {};
      
      for (const log of logs) {
        const addr = log.tokenAddress.toLowerCase();
        if (!tokenNets[addr]) tokenNets[addr] = 0;
    
        if (log.from.toLowerCase() === normalizedUser) {
          tokenNets[addr] -= log.value;
        }
    
        if (log.to.toLowerCase() === normalizedUser) {
          tokenNets[addr] += log.value;
        }
      }

      // Check for actions for this specific user based on Net Flow
      for (const [tokenAddress, netAmount] of Object.entries(tokenNets)) {
        // If net flow is negligible, ignore (Pool/Router pass-through)
        if (Math.abs(netAmount) < 1e-9) continue;

        const token = tokenMap[tokenAddress];
        if (!token) continue;
    
        const isQuoteToken = isQuote(tokenAddress);
        
        // --- Native VIC Checks (Initiator Only) ---
        if (normalizedUser === normalizedInitiator) {
           // Case 1: SELL Token -> Get VIC
           // Look for: Net Sent Token (netAmount < 0) AND Native Received > threshold
           if (!isQuoteToken && netAmount < 0 && nativeReceivedByInitiator >= threshold) {
              const amountSold = Math.abs(netAmount);
               actions.push({
                direction: DIRECTION_SELL,
                tokenSymbol: token.symbol,
                quoteSymbol: SYMBOL_VIC,
                amountToken: amountSold,
                amountQuote: nativeReceivedByInitiator,
                from: userAddress,
                to: userAddress,
              });
              continue; 
           }

           // Case 2: BUY Token <- Send VIC
           // Look for: Net Received Token (netAmount > 0) AND Native Sent > threshold
           if (!isQuoteToken && netAmount > 0 && txValue >= threshold) {
              actions.push({
                direction: DIRECTION_BUY,
                tokenSymbol: token.symbol,
                quoteSymbol: SYMBOL_VIC,
                amountToken: netAmount,
                amountQuote: txValue,
                from: userAddress,
                to: userAddress,
              });
              continue;
           }
        }
    
        // --- Token-to-Token Checks (Any Address) ---
        
        // Case 3: SELL Token -> Get Quote
        // Logic: Net Sent Token AND Net Received Quote
        if (!isQuoteToken && netAmount < 0) { // Sent Token
           const amountSold = Math.abs(netAmount);
           
           // Find a quote token that was Net Received
           const quoteEntry = Object.entries(tokenNets).find(
             ([addr, net]) => isQuote(addr) && net > 0
           );
           
           if (quoteEntry) {
             const [quoteAddr, quoteNet] = quoteEntry;
             if (quoteNet >= threshold) {
                const quoteToken = tokenMap[quoteAddr];
                actions.push({
                  direction: DIRECTION_SELL,
                  tokenSymbol: token.symbol,
                  quoteSymbol: quoteToken.symbol,
                  amountToken: amountSold,
                  amountQuote: quoteNet,
                  from: userAddress,
                  to: userAddress,
                });
             }
           }
        }
    
        // Case 4: BUY Token <- Send Quote
        // Logic: Net Received Token AND Net Sent Quote
        if (!isQuoteToken && netAmount > 0) { // Received Token
           // Find a quote token that was Net Sent
           const quoteEntry = Object.entries(tokenNets).find(
             ([addr, net]) => isQuote(addr) && net < 0
           );
           
           if (quoteEntry) {
             const [quoteAddr, quoteNet] = quoteEntry;
             const amountPaid = Math.abs(quoteNet);
             
             if (amountPaid >= threshold) {
                const quoteToken = tokenMap[quoteAddr];
                actions.push({
                  direction: DIRECTION_BUY,
                  tokenSymbol: token.symbol,
                  quoteSymbol: quoteToken.symbol,
                  amountToken: netAmount,
                  amountQuote: amountPaid,
                  from: userAddress,
                  to: userAddress,
                });
             }
           }
        }
      }
      
      // Case 5: Quote-to-Quote Swap
      // Logic: Net Sent Quote1 AND Net Received Quote2
      const quotePairs = Object.entries(tokenNets).filter(([addr, net]) =>
         isQuote(addr) && Math.abs(net) > 1e-9
       );
       
       if (quotePairs.length >= 2) {
          const sentQuote = quotePairs.find(([_, net]) => net < 0);
          const receivedQuote = quotePairs.find(([_, net]) => net > 0);
          
          if (sentQuote && receivedQuote) {
             const [sentAddr, sentNet] = sentQuote;
             const [receivedAddr, receivedNet] = receivedQuote;
             
             const amountSent = Math.abs(sentNet);
             const amountReceived = receivedNet; // already positive
             
             // Check threshold on what we "Bought" or "Sold"? 
             // Usually volume is determined by the size.
             // Let's use received amount for threshold check
             if (amountReceived >= threshold) {
                 actions.push({
                   direction: DIRECTION_BUY, // Bought Quote2
                   tokenSymbol: tokenMap[receivedAddr].symbol,
                   quoteSymbol: tokenMap[sentAddr].symbol,
                   amountToken: amountReceived,
                   amountQuote: amountSent,
                   from: userAddress,
                   to: userAddress,
                 });
             }
          }
       }
  }

  return actions;
};
