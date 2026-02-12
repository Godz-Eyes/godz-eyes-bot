// 📁 src/services/whaleMonitor.ts

import { logger } from "../utils/logger";
import { client } from "../utils/client";
import { tokenMap } from "../utils/tokenList";
import { formatAlertMessage } from "../utils/formatter";
import { sendAlert } from "../bot/bot";
import { decodeEventLog, parseAbi, Transaction } from "viem";
import { getAlertKey, hasBeenAlerted, markAsAlerted } from "../utils/cache";
import { analyzeSwap, TransferLog } from "./analyzeSwap";

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const THRESHOLD_TOKEN = Number(process.env.THRESHOLD_TOKEN!) || 10000;

// CONFIGURABLE PERFORMANCE SETTINGS
const BATCH_SIZE = Number(process.env.BATCH_SIZE!) || 1; // Default to 1 (Serial)
const RPC_DELAY = Number(process.env.RPC_DELAY!) || 300; 
const MAX_TX_PER_BLOCK = Number(process.env.MAX_TX_PER_BLOCK!) || 50;
const MAX_BLOCK_LAG = Number(process.env.MAX_BLOCK_LAG!) || 50; // Allow 50 blocks backlog before skipping

const POLLING_INTERVAL = 5000;
const TX_TIMEOUT = 10000;
const BLOCK_FETCH_TIMEOUT = 20000; 
const BASE_ERROR_BACKOFF = 5000;
const MAX_ERROR_BACKOFF = 60000;

let lastProcessedBlock = 0n;
let errorBackoff = BASE_ERROR_BACKOFF;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), ms)
        )
    ]);
};

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processTransaction = async (tx: Transaction) => {
  const txHash = tx.hash;

  if (tx.input === '0x') return; 

  let receipt;

  try {
    receipt = await withTimeout(
        client.getTransactionReceipt({ hash: txHash }), 
        TX_TIMEOUT
    );
  } catch (err) {
    return;
  }

  try {
    if (!receipt) return;
    const userAddress = receipt.from.toLowerCase();

    // DEBUG: print if we see logs
    if (receipt.logs.length > 0) {
        // logger.log(`🔎 Inspecting ${receipt.logs.length} logs for TX: ${txHash}`);
    }

    const transferLogs: TransferLog[] = [];

    for (const log of receipt.logs) {
      const logAddress = log.address.toLowerCase();
      const token = tokenMap[logAddress];
      
      // DEBUG: If it looks like a Transfer but we don't know the token, LOG IT.
      if (!token) {
         if (log.topics[0] === TRANSFER_TOPIC) {
          logger.log(`❓ Ignored Transfer from Unknown Token: ${logAddress}`);
         }
         continue;
      }

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
        
        // DEBUG: Found a valid transfer
        logger.log(`🧾 Found Transfer: ${Number(value)} ${token.symbol} (${from} -> ${to})`);

        transferLogs.push({
          tokenAddress: log.address,
          symbol: token.symbol,
          from,
          to,
          value: Number(value) / 10 ** token.decimals,
        });
      } catch (e) {
          logger.error(`❌ Decode Error for ${token.symbol}:`, e);
      }
    }

    if (transferLogs.length === 0) return;
    
    // DEBUG: Analyzing swap
    logger.log(`🧠 Analyzing ${transferLogs.length} transfers for ${userAddress}...`);

    const txValueVIC = Number(tx.value) / 1e18;

    const actions = analyzeSwap(
      transferLogs, 
      userAddress, 
      THRESHOLD_TOKEN,
      txValueVIC,
      0 
    );
    
    if (actions.length === 0) {
        logger.log(`⚠️ Analysis returned 0 actions. Threshold=${THRESHOLD_TOKEN}, TxVal=${txValueVIC}`);
    } else {
        logger.log(`✅ Found ${actions.length} action(s) in TX: ${txHash}`);
    }

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

      const key = getAlertKey(txHash, action.tokenSymbol, action.direction);
      if (hasBeenAlerted(key)) continue;

      await sendAlert(message);
      markAsAlerted(key);
    }
  } catch (err) {
    logger.error("❌ TX parse error:", txHash, err);
  }
};

const processBlock = async (blockNumber: bigint) => {
    const start = Date.now();
    let fullBlock;
    try {
      fullBlock = await withTimeout(
          client.getBlock({ 
            blockNumber: blockNumber, 
            includeTransactions: true 
          }),
          BLOCK_FETCH_TIMEOUT
      );
    } catch (err) {
      logger.warn(`⚠️ Block fetch failed/timed out: ${blockNumber}. Skipping.`);
      return;
    }

    if (!fullBlock || !fullBlock.transactions) return;

    const allTxs = fullBlock.transactions as Transaction[];
    const candidates = allTxs.filter(tx => tx.input !== '0x');
    const skippedCount = allTxs.length - candidates.length;
    
    if (candidates.length > MAX_TX_PER_BLOCK) {
        logger.warn(`⚠️ Block ${fullBlock.number} TOO HEAVY (${candidates.length} relevant TXs). Skipping to prevent freeze.`);
        return;
    }
    
    logger.log(
      `📦 New Block: ${fullBlock.number} | Relevant: ${candidates.length} (Skipped ${skippedCount})`
    );

    // BATCH PROCESSING (Configurable Concurrency)
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map((tx) => processTransaction(tx)));
      
      // Delay between batches
      if (i + BATCH_SIZE < candidates.length) {
          await delay(RPC_DELAY); 
      }
    }
    
    const duration = Date.now() - start;
    logger.log(
      `✅ Processed Block ${fullBlock.number} in ${duration}ms`
    );
    
    if (fullBlock.number && fullBlock.number % 50n === 0n) {
        logger.log(`💓 Heartbeat: Alive at block ${fullBlock.number}`);
    }
    
    errorBackoff = BASE_ERROR_BACKOFF;
};

export const startWhaleMonitor = async () => {
  logger.log("🚀 Starting Optimized Whale Monitor (Configurable + Queue Mode)...");
  logger.log(`⚙️ Config: BATCH=${BATCH_SIZE}, Delay=${RPC_DELAY}, LAG_LIMIT=${MAX_BLOCK_LAG}`);
  
  const connect = async () => {
    try {
      const currentBlock = await withTimeout(client.getBlockNumber(), 10000);
      logger.log(`✅ Connected to RPC. Current Block: ${currentBlock}`);
      lastProcessedBlock = currentBlock;
      errorBackoff = BASE_ERROR_BACKOFF;
      poll();
    } catch (err) {
      logger.error(`❌ Retrying connection in ${errorBackoff}ms...`);
      errorBackoff = Math.min(errorBackoff * 2, MAX_ERROR_BACKOFF);
      setTimeout(connect, errorBackoff);
    }
  };

  const poll = async () => {
    try {
      const latestBlock = await withTimeout(client.getBlockNumber(), 10000);
      
      if (latestBlock > lastProcessedBlock) {
        const lag = latestBlock - lastProcessedBlock;
        
        // RELAXED SKIP LOGIC
        // Only skip if we are dangerously behind (e.g. > 50 blocks)
        if (lag > BigInt(MAX_BLOCK_LAG)) {
             const skipped = lag - 1n;
             logger.warn(`⏭️ Extreme Lag (${lag} blocks). Skipping ${skipped} blocks to Tip ${latestBlock}`);
             lastProcessedBlock = latestBlock - 1n; // Jump to tip
        }
        
        // Simply process the NEXT block in queue
        // We do NOT jump to latestBlock immediately unless lag is huge
        const nextBlockToProcess = lastProcessedBlock + 1n;
        await processBlock(nextBlockToProcess);
        
        lastProcessedBlock = nextBlockToProcess;
        errorBackoff = BASE_ERROR_BACKOFF; 
        
        // If we have a backlog (lag > 1), poll FASTER (don't wait 5s)
        // gracefully catch up by processing next block immediately
        const nextDelay = lag > 1n ? 1000 : POLLING_INTERVAL;
        
        setTimeout(poll, nextDelay);
      } else {
        setTimeout(poll, POLLING_INTERVAL);
      }
    } catch (err) {
      logger.error(`❌ Polling RPC Error: ${err instanceof Error ? err.message : err}. Backing off ${errorBackoff}ms...`);
      setTimeout(poll, errorBackoff);
      errorBackoff = Math.min(errorBackoff * 2, MAX_ERROR_BACKOFF);
    }
  };

  connect();
};
