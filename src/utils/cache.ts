const alertedTxs = new Set<string>();

export const hasBeenAlerted = (txHash: string) => {
  return alertedTxs.has(txHash);
};

export const markAsAlerted = (txHash: string) => {
  alertedTxs.add(txHash);

  // Optional: Xoá sau 10 phút để không tốn RAM
  setTimeout(() => {
    alertedTxs.delete(txHash);
  }, 10 * 60 * 1000);
};
