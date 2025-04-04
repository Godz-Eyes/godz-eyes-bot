import { client } from "../utils/client";
import { tokenMap, tokenC98, quoteTokenAddresses } from "../utils/tokenList";
import { formatAlertMessage } from "../utils/formatter";
import { sendAlert } from "../bot/bot";
import { decodeEventLog, parseAbi } from "viem";
import { hasBeenAlerted, markAsAlerted } from "../utils/cache";

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // keccak256(Transfer)

const THRESHOLD_TOKEN = process.env.THRESHOLD_TOKEN!;

export const startWhaleMonitor = async () => {
  client.watchBlocks({
    onBlock: async (block) => {
      const fullBlock = await client.getBlock({ blockHash: block.hash });

      for (const txHash of fullBlock.transactions) {
        if (hasBeenAlerted(txHash)) continue;

        try {
          const receipt = await client.getTransactionReceipt({ hash: txHash });

          // Parse all logs with Transfer events from tokens in list
          const tokenTransfers: {
            symbol: string;
            from: string;
            to: string;
            value: number;
            address: string;
          }[] = [];

          for (const log of receipt.logs) {
            const token = tokenMap[log.address.toLowerCase()];
            if (!token) continue;

            // 💡 Chỉ parse nếu đúng event Transfer
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

              tokenTransfers.push({
                symbol: token.symbol,
                from,
                to,
                value: Number(value) / 10 ** token.decimals,
                address: log.address.toLowerCase(),
              });
            } catch {}
          }

          const quoteTransfers = tokenTransfers.filter((t) =>
            quoteTokenAddresses.includes(t.address)
          );

          const otherTokenTransfers = tokenTransfers.filter(
            (t) => !quoteTokenAddresses.includes(t.address)
          );

          if (quoteTransfers.length === 0 || otherTokenTransfers.length === 0)
            continue;

          console.log("detected : ", txHash);

          for (const tokenTx of otherTokenTransfers) {
            for (const quoteTx of quoteTransfers) {
              const amountInQuote = quoteTx.value;

              if (amountInQuote >= Number(THRESHOLD_TOKEN)) {
                const action =
                  tokenTx.from === quoteTx.to
                    ? "BUY"
                    : tokenTx.to === quoteTx.from
                    ? "SELL"
                    : "TRANSFER";

                const message = formatAlertMessage({
                  amount: tokenTx.value.toLocaleString(),
                  symbol: tokenTx.symbol,
                  c98Amount: `${amountInQuote.toLocaleString()} ${
                    quoteTx.symbol
                  }`,
                  sender: tokenTx.from,
                  receiver: tokenTx.to,
                  txHash,
                  direction: action as "BUY" | "SELL" | "TRANSFER",
                });

                await sendAlert(message);
                markAsAlerted(txHash);
              }
            }
          }
        } catch (err) {
          console.error("❌ TX parse error:", txHash, err);
        }
      }
    },
  });

  console.log("🛰️ Whale monitor is running...");
};
