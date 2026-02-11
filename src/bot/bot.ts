import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { getAllChatTargets } from "../utils/chatStore";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;

export const bot = new TelegramBot(token, { polling: false });

export const sendAlert = async (message: string) => {
  const chatTargets = getAllChatTargets();

  for (const target of chatTargets) {
    const { chatId, threadId } = target;

    try {
      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(threadId && threadId > 0 ? { message_thread_id: threadId } : {}),
      });
    } catch (err) {
      console.error(`❌ Failed to send alert to ${chatId}`, err);
    }
  }
};
