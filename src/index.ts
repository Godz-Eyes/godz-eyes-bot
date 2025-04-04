import dotenv from "dotenv";
dotenv.config();

import { startWhaleMonitor } from "./services/whaleMonitor";
import { loadAddressCache } from "./utils/addressCache";
import { loadChatIds } from "./utils/chatStore";

loadChatIds();
loadAddressCache();
startWhaleMonitor();
