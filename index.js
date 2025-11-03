import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Start komandasi
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Salom, ${msg.from.first_name}! 💰
Bu bot sizning kirim va chiqimlaringizni hisoblaydi.`
  );
});
// Store user states. We'll keep an object per chat so we can handle multi-step flows
const userStates = new Map();

bot.onText(/\/kirim/, (msg) => {
  // Start income flow: first ask for amount, then description
  userStates.set(msg.chat.id, { step: "kirim_amount" });
  bot.sendMessage(msg.chat.id, `Kirim miqdorini kiriting (masalan: 5000):`);
});

bot.onText(/\/chiqim/, (msg) => {
  // Expense flow: ask amount only
  userStates.set(msg.chat.id, { step: "chiqim_amount" });
  bot.sendMessage(msg.chat.id, `Chiqim miqdorini kiriting (masalan: 3000):`);
});

bot.onText(/\/hisobot/, async (msg) => {
  let totalIncome = 0;
  let totalExpense = 0;
  const res = await pool.query(
    "SELECT type, SUM(amount) as total FROM transactions WHERE user_id = $1 GROUP BY type",
    [msg.chat.id]
  );

  res.rows.forEach((row) => {
    if (row.type === "kirim") {
      totalIncome = parseFloat(row.total);
    } else if (row.type === "chiqim") {
      totalExpense = parseFloat(row.total);
    }
  });

  const balance = totalIncome - totalExpense;
  const report = `📊 Hisobot:
- Jami kirim: ${totalIncome.toLocaleString()} so'm
- Jami chiqim: ${totalExpense.toLocaleString()} so'm
- Balans: ${balance.toLocaleString()} so'm`;
  bot.sendMessage(msg.chat.id, report);
});

// Handle all messages (amounts, descriptions)
bot.on("message", async (msg) => {
  if (!msg.text) return;

  // ignore commands here; they are handled elsewhere
  if (msg.text.startsWith("/")) return;

  const state = userStates.get(msg.chat.id);
  if (!state) return;

  try {
    // Income: first amount, then description
    if (state.step === "kirim_amount") {
      const amount = parseFloat(msg.text);
      if (isNaN(amount)) {
        bot.sendMessage(
          msg.chat.id,
          "❌ Iltimos, miqdor sifatida raqam kiriting!"
        );
        return;
      }
      // store amount and ask for description
      userStates.set(msg.chat.id, { step: "kirim_desc", amount });
      bot.sendMessage(msg.chat.id, `Iltimos, kirim uchun izoh kiriting:`);
      return;
    }

    if (state.step === "kirim_desc") {
      const desc = msg.text.trim();
      const amount = state.amount;
      await pool.query(
        "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)",
        [msg.chat.id, "kirim", amount, desc]
      );
      bot.sendMessage(
        msg.chat.id,
        `✅ ${amount.toLocaleString()} so'm daromad qo'shildi! Izoh: ${desc}`
      );
      userStates.delete(msg.chat.id);
      return;
    }

    // Expense: single-step amount
    if (state.step === "chiqim_amount") {
      const amount = parseFloat(msg.text);
      if (isNaN(amount)) {
        bot.sendMessage(
          msg.chat.id,
          "❌ Iltimos, miqdor sifatida raqam kiriting!"
        );
        return;
      }
      userStates.set(msg.chat.id, { step: "chiqim_desc", amount });
      bot.sendMessage(msg.chat.id, `Iltimos, chiqim uchun izoh kiriting:`);
      return;
    }
    if (state.step === "chiqim_desc") {
      const desc = msg.text.trim();
      const amount = state.amount;
      await pool.query(
        "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)",
        [msg.chat.id, "chiqim", amount, desc]
      );
      bot.sendMessage(
        msg.chat.id,
        `✅ ${amount.toLocaleString()} so'm chiqim qo'shildi! Izoh: ${desc}`
      );
      userStates.delete(msg.chat.id);
      return;
    }
  } catch (err) {
    console.error("DB error:", err);
    bot.sendMessage(
      msg.chat.id,
      "❌ Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring."
    );
    userStates.delete(msg.chat.id);
  }
});
