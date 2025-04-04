import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = process.env.CHAT_ID!;
const threadId = process.env.THREAD_ID!;

export const bot = new TelegramBot(token, { polling: false });

bot.on("message", (msg) => {
  console.log("🔥 Chat Info:", {
    id: msg.chat.id,
    title: msg.chat.title,
    type: msg.chat.type,
  });
});

export const sendAlert = async (message: string) => {
  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      message_thread_id: Number(threadId),
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error("❌ Send alert error:", err);
  }
};
