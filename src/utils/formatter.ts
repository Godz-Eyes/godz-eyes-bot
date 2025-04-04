import { OneID } from "@oneid-xyz/inspect";
import { formatAddress } from "./formatAddress";

export const formatAlertMessage = async ({
  amount,
  symbol,
  valueAmount,
  sender,
  receiver,
  txHash,
  direction,
}: {
  amount: string;
  symbol: string;
  valueAmount: string;
  sender: string;
  receiver: string;
  txHash: string;
  direction: "BUY" | "SELL" | "TRANSFER";
}) => {
  const emoji = direction === "BUY" ? "🟢" : direction === "SELL" ? "🔴" : "🔁";

  const senderLabel = await formatAddress(sender);
  const receiverLabel = await formatAddress(receiver);

  return `
  🚨 <b>BIG TRADE ALERT</b> 🐳
  
  🛒 <b>Action:</b> ${direction} ${emoji}
  💰 <b>Amount:</b> ${amount} ${symbol}
  💱 <b>Value:</b> ${valueAmount}
  
  👤 <b>From:</b> <code>${senderLabel}</code>
  🏦 <b>To:</b> <code>${receiverLabel}</code>
  
  🔗 <a href="https://vicscan.xyz/tx/${txHash}">View TX</a>
  ━━━━━━━━━━━━━━
    `.trim();
};
