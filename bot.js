import TelegramBot from "node-telegram-bot-api";
import { pool } from "./db.js";
import registerMessageHandler from "./handlers/messages.js";
import registerCallbackHandler from "./handlers/callbacks.js";

export function init() {
  if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN not set in environment");
  }

  const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
  const userStates = new Map();

  bot.getMyCommands().then(() => {
    bot.setMyCommands([{ command: "/start", description: "Botni boshlash" }]);
  });

  registerMessageHandler(bot, userStates, pool);
  registerCallbackHandler(bot, userStates);

  console.log("Bot started");
}
