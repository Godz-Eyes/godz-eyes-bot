export const formatAlertMessage = ({
  amount,
  symbol,
  c98Amount,
  sender,
  receiver,
  txHash,
  direction,
}: {
  amount: string;
  symbol: string;
  c98Amount: string;
  sender: string;
  receiver: string;
  txHash: string;
  direction: "BUY" | "SELL" | "TRANSFER";
}) => {
  const emoji = direction === "BUY" ? "🟢" : direction === "SELL" ? "🔴" : "🔁";

  return `
  🚨 <b>BIG TRADE ALERT</b> 🐳
  
  🛒 <b>Action:</b> ${direction} ${emoji}
  💰 <b>Amount:</b> ${amount} ${symbol}
  💱 <b>Value:</b> ${c98Amount} C98
  
  👤 <b>From:</b> <code>${sender}</code>
  🏦 <b>To:</b> <code>${receiver}</code>
  
  🔗 <a href="https://vicscan.xyz/tx/${txHash}">View TX</a>
  ━━━━━━━━━━━━━━━━━━
    `.trim();
};
