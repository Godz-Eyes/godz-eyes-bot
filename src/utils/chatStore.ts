import fs from "fs";
import path from "path";

export type ChatTarget = {
  chatId: number;
  threadId?: number;
};

const filePath = path.join(process.cwd(), "chatIds.json");

let chatTargets: ChatTarget[] = [];

export const loadChatIds = () => {
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      chatTargets = JSON.parse(raw);

    } catch (err) {

      chatTargets = [];
    }
  } else {

  }
};

export const getAllChatTargets = (): ChatTarget[] => chatTargets;
