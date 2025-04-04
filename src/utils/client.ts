import { createPublicClient, http } from "viem";

export const client = createPublicClient({
  chain: {
    id: 88,
    name: "viction",
    nativeCurrency: {
      name: "VIC",
      symbol: "VIC",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ["https://rpc.viction.xyz"],
      },
    },
  },
  transport: http(),
});
