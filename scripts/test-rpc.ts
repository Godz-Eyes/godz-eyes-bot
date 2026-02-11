
import { createPublicClient, http } from "viem";
import { viction } from "viem/chains";

const RPC_LIST = [
    "https://rpc.viction.xyz",
    "https://rpc-viction.tomochain.com",
    "https://viction.blockpi.network/v1/rpc/public" 
];

const testRpc = async (url: string) => {
  console.log(`\nTesting: ${url}`);
  const client = createPublicClient({
    chain: viction,
    transport: http(url),
  });

  try {
    const start = Date.now();
    // Timeout manually
    const block = await Promise.race([
        client.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
    ]);
    console.log(`✅ Success! Block: ${block} | Latency: ${Date.now() - start}ms`);
    return true;
  } catch (err) {
    console.error(`❌ Failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
};

const run = async () => {
    for (const rpc of RPC_LIST) {
        if (await testRpc(rpc)) {
            console.log(`\n🎉 RECOMMENDED RPC: ${rpc}`);
            process.exit(0);
        }
    }
    console.error("\n❌ ALL RPCs FAILED.");
    process.exit(1);
};

run();
