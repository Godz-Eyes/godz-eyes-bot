// 📁 src/services/whaleMonitor.ts

import { logger } from "../utils/logger";

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

let lastProcessedBlock = 0n;

const processBlock = async (blockNumber: bigint) => {
  let fullBlock;
  try {
    fullBlock = await client.getBlock({ blockNumber });
  } catch (err) {
    logger.warn(`⚠️ Block ${blockNumber} not found/fetch error`);
    return;
  }

  if (!fullBlock || !fullBlock.transactions) return;

  for (const txHash of fullBlock.transactions) {
    let receipt;

    try {
      receipt = await client.getTransactionReceipt({ hash: txHash });
    } catch (err) {
      continue;
    }

    try {
      if (!receipt) {
         continue;
      }
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
      logger.error("❌ TX parse error:", txHash, err);
    }
  }
};

export const startWhaleMonitor = async () => {
  console.log("🚀 Starting Whale Monitor...");
  await sendAlert("🚀 Godz Eyes Bot Started! Monitoring Viction chain...");

  // Get initial block number to start from
  try {
    lastProcessedBlock = await client.getBlockNumber();
  } catch (err) {
     return;
  }

  client.watchBlocks({
    onBlock: async (block) => {
      const currentBlock = block.number;
      if (!currentBlock) return;

      // If we jumped ahead, catch up
      if (currentBlock > lastProcessedBlock) {
        // Log heartbeat every 100 blocks
        if (currentBlock % 100n === 0n) {
             console.log(`💓 Heartbeat: Processed up to block ${currentBlock}`);
        }

        // Iterate from next expected block up to current
        for (let b = lastProcessedBlock + 1n; b <= currentBlock; b++) {
          await processBlock(b);
        }
        lastProcessedBlock = currentBlock;
      }
    },
  });
};
