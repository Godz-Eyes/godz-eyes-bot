import fs from "fs";
import path from "path";

type TokenMeta = {
  address: string;
  symbol: string;
  decimals: number;
};

const raw = fs.readFileSync(
  path.join(__dirname, "../../tokenList.json"),
  "utf-8"
);
const tokens = JSON.parse(raw) as TokenMeta[];

export const tokenMap: Record<string, TokenMeta> = {};
for (const token of tokens) {
  tokenMap[token.address.toLowerCase()] = token;
}

export const quoteTokens = ["C98", "WVIC", "RABBIT"];
export const quoteTokenAddresses = Object.values(tokenMap)
  .filter((t) => quoteTokens.includes(t.symbol.toUpperCase()))
  .map((t) => t.address.toLowerCase());
