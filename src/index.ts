import dotenv from "dotenv";
dotenv.config();

console.log("🟢 Application Entry Point Reached");

import { startWhaleMonitor } from "./services/whaleMonitor";
import { loadAddressCache } from "./utils/addressCache";
import { loadChatIds } from "./utils/chatStore";

loadChatIds();
loadAddressCache();
startWhaleMonitor();
