
import { client } from "./utils/client";
import { tokenMap } from "./utils/tokenList";
import { decodeEventLog, parseAbi } from "viem";
import { analyzeSwap, TransferLog } from "./services/analyzeSwap";

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TX_HASH = "0xd6a5778eb23bf9ce6f8c711872db60442439bcd282e7978578eae924158ae78b";

const debug = async () => {
    console.log("🔍 Debugging TX:", TX_HASH);

    let receipt;
    try {
        receipt = await client.getTransactionReceipt({ hash: TX_HASH });
    } catch (err) {
        console.error("❌ Failed to fetch receipt", err);
        return;
    }

    if (!receipt) {
        console.log("❌ Receipt not found");
        return;
    }

    const userAddress = receipt.from.toLowerCase();
    console.log("👤 User Address:", userAddress);

    console.log(`📜 Receipt has ${receipt.logs.length} logs`);

    const transferLogs: TransferLog[] = [];

    for (const [index, log] of receipt.logs.entries()) {
        const tokenAddr = log.address.toLowerCase();
        const token = tokenMap[tokenAddr];
        
        console.log(`\n--- Log #${index} ---`);
        console.log(`Address: ${tokenAddr} (${token ? token.symbol : "UNKNOWN"})`);
        console.log(`Topics[0]: ${log.topics[0]}`);

        if (!token) {
            console.log("⚠️ Token not in tokenMap. Skipping.");
            continue;
        }

        if (log.topics[0] !== TRANSFER_TOPIC) {
            console.log("⚠️ Topic mismatch. Skipping.");
            continue;
        }

        try {
            const parsed = decodeEventLog({
                abi: transferAbi,
                data: log.data,
                topics: log.topics,
            });

            const { from, to, value } = parsed.args as {
                from: `0x${string}`;
                to: `0x${string}`;
                value: bigint;
            };

            const formattedValue = Number(value) / 10 ** token.decimals;
            console.log(`✅ Decoded Transfer: ${formattedValue} ${token.symbol}`);
            console.log(`   From: ${from}`);
            console.log(`   To:   ${to}`);

            transferLogs.push({
                tokenAddress: log.address,
                symbol: token.symbol,
                from,
                to,
                value: formattedValue,
            });
        } catch (err) {
            console.log("❌ Failed to decode log", err);
        }
    }

    console.log("\n--- Analysis ---");
    console.log(`Collected ${transferLogs.length} transfer logs.`);

    const actions = analyzeSwap(
        transferLogs,
        userAddress, // txInitiator
        0.0001, // Low threshold
        0, // txValue (VIC)
        0  // nativeReceived (VIC)
    );

    console.log(`Found ${actions.length} actions.`);
    if (actions.length === 0) {
        console.log("❌ No actions detected. Logic failure likely in analyzeSwap.");
        console.log("Logs dump:", JSON.stringify(transferLogs, null, 2));
    } else {
        console.log("✅ Actions detected:", JSON.stringify(actions, null, 2));
    }
};

debug();
