import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "addressLabels.json");

let cache: Record<string, string> = {};

export const loadAddressCache = () => {
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      cache = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to load addressLabels.json:", err);
      cache = {};
    }
  } else {
    // Nếu file chưa có, tạo file trống
    try {
      fs.writeFileSync(filePath, "{}", "utf-8");
      cache = {};
      console.log("✅ Created empty addressLabels.json");
    } catch (err) {
      console.error("❌ Failed to create addressLabels.json:", err);
    }
  }
};

export const getLabelFromCache = (address: string): string | undefined => {
  return cache[address.toLowerCase()];
};

export const setLabelToCache = (address: string, label: string) => {
  cache[address.toLowerCase()] = label;
  try {
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`💾 Cached label for ${address}: ${label}`);
  } catch (err) {
    console.error("❌ Failed to save address label:", err);
  }
};
