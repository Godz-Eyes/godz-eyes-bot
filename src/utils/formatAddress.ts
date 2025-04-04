import { OneID } from "@oneid-xyz/inspect";
import { getLabelFromCache, setLabelToCache } from "./addressCache";

const oneId = new OneID({
  rpcUrl: process.env.RPC_URL!,
});

let initialized = false;

const shortenAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export const formatAddress = async (address: string): Promise<string> => {
  const lower = address.toLowerCase();

  // ✅ Nếu đã cache → dùng luôn
  const cached = getLabelFromCache(lower);
  if (cached) return `${cached} <code>${shortenAddress(address)}</code>`;

  // 🧠 Init OneID config nếu chưa
  try {
    if (!initialized) {
      await oneId.systemConfig.initConfig();
      initialized = true;
    }

    const id = await oneId.getPrimaryName(address);
    if (id) {
      setLabelToCache(address, id);
      return `<code>${id}</code>`;
    }
    return `<code>${shortenAddress(address)}</code>`;
  } catch {
    return `<code>${shortenAddress(address)}</code>`;
  }
};
