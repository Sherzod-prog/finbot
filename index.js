import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const userStates = new Map();

bot.getMyCommands().then(() => {
  bot.setMyCommands([{ command: "/start", description: "Botni boshlash" }]);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  if (text === "/start") {
    bot.sendMessage(chatId, "Quyidagi buyruqlardan foydalaning:", {
      reply_markup: {
        keyboard: [
          [{ text: "➕ kiritish" }, { text: "📝 tahrirlash" }],
          [{ text: "📈 hisobot" }],
        ],
        resize_keyboard: true,
      },
    });
  }

  // ➕ kiritish bosilganda
  else if (text === "➕ kiritish") {
    bot.sendMessage(chatId, "Qaysi turdagi kiritish?", {
      reply_markup: {
        keyboard: [
          [{ text: "💰 kirim" }, { text: "💸 chiqim" }],
          [{ text: "⬅️ ortga" }],
        ],
        resize_keyboard: true,
      },
    });
  }
  // tahrirlash bosilganda
  else if (text === "📝 tahrirlash") {
    bot.sendMessage(chatId, "Qaysi turdagi yozuvni tahrirlashni xohlaysiz?", {
      reply_markup: {
        keyboard: [
          [
            { text: "🖊️ kirimni tahrirlash" },
            { text: "🖊️ chiqimni tahrirlash" },
          ],
          [{ text: "⬅️ ortga" }],
        ],
        resize_keyboard: true,
      },
    });
  }
  // kirim yoki chiqimni qayta ishlash
  else if (text === "🖊️ kirimni tahrirlash") {
    const last = await pool.query(
      "SELECT id, amount, description FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY id DESC LIMIT 5",
      [chatId, "kirim"]
    );
    ``;
    bot.sendMessage(chatId, `So'nggi 5 kirim yozuvi:`, {
      reply_markup: {
        inline_keyboard: last.rows.map((row) => [
          {
            text: `ID: ${row.id}, ${row.amount} so'm - ${row.description}`,
            callback_data: `edit_${row.id}`,
          },
        ]),
      },
    });
  } else if (text === "🖊️ chiqimni tahrirlash") {
    const last = await pool.query(
      "SELECT id, amount, description FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY id DESC LIMIT 5",
      [chatId, "chiqim"]
    );
    bot.sendMessage(chatId, `So'nggi 5 chiqim yozuvi:`, {
      reply_markup: {
        inline_keyboard: last.rows.map((row) => [
          {
            text: `ID: ${row.id}, ${row.amount} so'm - ${row.description}`,
            callback_data: `edit_${row.id}`,
          },
        ]),
      },
    });
  }

  // hisobot bosilganda
  else if (text === "📈 hisobot") {
    let totalIncome = 0;
    let totalExpense = 0;
    const res = await pool.query(
      "SELECT type, SUM(amount) as total FROM transactions WHERE user_id = $1 GROUP BY type",
      [chatId]
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
    bot.sendMessage(chatId, report);
  }

  // "ortga" bosilganda asosiy menyuga qaytish
  else if (text === "⬅️ ortga") {
    bot.sendMessage(chatId, "Asosiy menyu:", {
      reply_markup: {
        keyboard: [
          [{ text: "➕ kiritish" }],
          [{ text: "📝 tahrirlash" }],
          [{ text: "📈 hisobot" }],
        ],
        resize_keyboard: true,
      },
    });
  }
  // kirim yoki chiqimni qayta ishlash
  else if (text === "💰 kirim") {
    userStates.set(chatId, { step: "kirim_amount" });
    return bot.sendMessage(chatId, "Kirim miqdorini kiriting:");
  } else if (text === "💸 chiqim") {
    userStates.set(chatId, { step: "chiqim_amount" });
    return bot.sendMessage(chatId, "Chiqim miqdorini kiriting:");
  }

  const newState = userStates.get(chatId);
  if (!newState) return;
  try {
    // Income: first amount, then description
    if (newState.step === "kirim_amount") {
      const amount = parseFloat(msg.text);
      if (isNaN(amount)) {
        bot.sendMessage(chatId, "❌ Iltimos, miqdor sifatida raqam kiriting!");
        return;
      }
      // store amount and ask for description
      userStates.set(chatId, { step: "kirim_desc", amount });
      bot.sendMessage(chatId, `Iltimos, kirim uchun izoh kiriting:`);
      return;
    }

    if (newState.step === "kirim_desc") {
      const desc = msg.text.trim();
      const amount = newState.amount;
      await pool.query(
        "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)",
        [chatId, "kirim", amount, desc]
      );
      bot.sendMessage(
        chatId,
        `✅ ${amount.toLocaleString()} so'm daromad qo'shildi! Izoh: ${desc}`
      );
      userStates.delete(chatId);
      return;
    }

    // Expense: single-step amount
    if (newState.step === "chiqim_amount") {
      const amount = parseFloat(msg.text);
      if (isNaN(amount)) {
        bot.sendMessage(chatId, "❌ Iltimos, miqdor sifatida raqam kiriting!");
        return;
      }
      userStates.set(chatId, { step: "chiqim_desc", amount });
      bot.sendMessage(chatId, `Iltimos, chiqim uchun izoh kiriting:`);
      return;
    }
    if (newState.step === "chiqim_desc") {
      const desc = msg.text.trim();
      const amount = newState.amount;
      await pool.query(
        "INSERT INTO transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)",
        [chatId, "chiqim", amount, desc]
      );
      bot.sendMessage(
        chatId,
        `✅ ${amount.toLocaleString()} so'm chiqim qo'shildi! Izoh: ${desc}`
      );
      userStates.delete(chatId);
      return;
    }

    // Handle expense editing
    if (newState.step === "edit_amount") {
      const amount = parseFloat(msg.text);
      if (isNaN(amount)) {
        bot.sendMessage(chatId, "❌ Iltimos, miqdor sifatida raqam kiriting!");
        return;
      }
      userStates.set(chatId, {
        step: "edit_desc",
        transactionId: newState.transactionId,
        amount: amount,
      });
      bot.sendMessage(chatId, "Yangi izohni kiriting:");
      return;
    }

    if (newState.step === "edit_desc") {
      const desc = msg.text.trim();
      const { transactionId, amount } = newState;

      try {
        // First verify the transaction belongs to this user
        const checkResult = await pool.query(
          "SELECT id FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'chiqim'",
          [transactionId, chatId]
        );

        if (checkResult.rows.length === 0) {
          bot.sendMessage(chatId, "❌ Bu yozuvni tahrirlay olmaysiz.");
          userStates.delete(chatId);
          return;
        }

        // Update the transaction
        await pool.query(
          "UPDATE transactions SET amount = $1, description = $2 WHERE id = $3 AND user_id = $4",
          [amount, desc, transactionId, chatId]
        );

        bot.sendMessage(
          chatId,
          `✅ Muvaffaqiyatli tahrirlandi!\nYangi miqdor: ${amount.toLocaleString()} so'm\nYangi izoh: ${desc}`
        );
      } catch (err) {
        console.error("Error updating transaction:", err);
        bot.sendMessage(chatId, "❌ Tahrirlashda xatolik yuz berdi.");
      }

      userStates.delete(chatId);
      return;
    }
  } catch (err) {
    console.error("DB error:", err);
    bot.sendMessage(
      chatId,
      "❌ Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring."
    );
    userStates.delete(chatId);
  }
});

// Handle edit callbacks
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;

  if (query.data.startsWith("edit_")) {
    const transactionId = query.data.split("_")[1];
    userStates.set(chatId, {
      step: "edit_amount",
      transactionId: transactionId,
    });

    bot.sendMessage(chatId, "Yangi miqdorni kiriting:");
  }

  // Acknowledge the callback query
  bot.answerCallbackQuery(query.id);
});
