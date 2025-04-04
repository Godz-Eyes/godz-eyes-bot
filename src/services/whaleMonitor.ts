// 📁 src/services/whaleMonitor.ts

import { client } from "../utils/client";
import { tokenMap } from "../utils/tokenList";
import { formatAlertMessage } from "../utils/formatter";
import { sendAlert } from "../bot/bot";
import { decodeEventLog, parseAbi } from "viem";
import { getAlertKey, hasBeenAlerted, markAsAlerted } from "../utils/cache";
import { analyzeSwap, TransferLog } from "./analyzeSwap";

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const THRESHOLD_TOKEN = Number(process.env.THRESHOLD_TOKEN!) || 10000;

export const startWhaleMonitor = async () => {
  client.watchBlocks({
    onBlock: async (block) => {
      const fullBlock = await client.getBlock({ blockHash: block.hash });

      for (const txHash of fullBlock.transactions) {
        let receipt;

        try {
          receipt = await client.getTransactionReceipt({ hash: txHash });
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("Transaction receipt with hash")
          ) {
            console.warn(`⚠️ Receipt not found yet for tx: ${txHash}`);
            continue;
          }

          console.error(
            `❌ Unexpected error getting receipt for tx: ${txHash}`,
            err
          );
          continue;
        }

        try {
          const userAddress = receipt.from.toLowerCase();

          const transferLogs: TransferLog[] = [];

          for (const log of receipt.logs) {
            const token = tokenMap[log.address.toLowerCase()];
            if (!token) continue;

            if (log.topics[0] !== TRANSFER_TOPIC) continue;

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

              transferLogs.push({
                tokenAddress: log.address,
                symbol: token.symbol,
                from,
                to,
                value: Number(value) / 10 ** token.decimals,
              });
            } catch {}
          }

          if (transferLogs.length === 0) continue;

          const actions = analyzeSwap(
            transferLogs,
            userAddress,
            THRESHOLD_TOKEN
          );

          for (const action of actions) {
            const message = await formatAlertMessage({
              amount: action.amountToken.toLocaleString(),
              symbol: action.tokenSymbol,
              valueAmount: `${action.amountQuote.toLocaleString()} ${
                action.quoteSymbol
              }`,
              sender: action.from,
              receiver: action.to,
              txHash,
              direction: action.direction,
            });

            const key = getAlertKey(
              txHash,
              action.tokenSymbol,
              action.direction
            );
            if (hasBeenAlerted(key)) continue;

            await sendAlert(message);
            markAsAlerted(key);
          }
        } catch (err) {
          console.error("❌ TX parse error:", txHash, err);
        }
      }
    },
  });

  console.log("🛰️ Whale monitor is running...");
};
