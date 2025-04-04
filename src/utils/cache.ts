const alertedSet = new Set<string>();

export const getAlertKey = (
  txHash: string,
  tokenSymbol: string,
  direction: "BUY" | "SELL" | "TRANSFER"
) => {
  return `${txHash}_${tokenSymbol}_${direction}`;
};

export const hasBeenAlerted = (key: string) => {
  return alertedSet.has(key);
};

export const markAsAlerted = (key: string) => {
  alertedSet.add(key);

  // Optional: clear sau 10 phút cho nhẹ RAM
  setTimeout(() => {
    alertedSet.delete(key);
  }, 10 * 60 * 1000);
};
