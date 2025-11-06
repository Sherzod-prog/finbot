export default function registerMessageHandler(bot, userStates, pool) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    const menu = [
      [{ text: "➕ kiritish" }, { text: "📝 tahrirlash" }],
      [{ text: "📈 hisobot" }, { text: "⚙️ sozlamalar" }],
    ];

    if (text === "/start") {
      return bot.sendMessage(chatId, "Quyidagi buyruqlardan foydalaning:", {
        reply_markup: {
          keyboard: menu.map((row) => row.map((btn) => ({ text: btn.text }))),
          resize_keyboard: true,
        },
      });
    } else if (text === "➕ kiritish") {
      try {
        const { rows: categories } = await pool.query(
          "SELECT * FROM categories WHERE type IN ('kirim', 'chiqim') ORDER BY type DESC, name"
        );

        if (categories.length === 0) {
          return bot.sendMessage(
            chatId,
            "❌ Hozircha kategoriyalar mavjud emas. Iltimos avval sozlamalar bo'limidan kategoriyalarni qo'shing."
          );
        }

        // Group categories by type
        const kirimButtons = categories
          .filter((cat) => cat.type === "kirim")
          .map((cat) => [
            {
              text: `💰 ${cat.name}`,
              callback_data: `category_kirim_${cat.name}`,
            },
          ]);

        const chiqimButtons = categories
          .filter((cat) => cat.type === "chiqim")
          .map((cat) => [
            {
              text: `💸 ${cat.name}`,
              callback_data: `category_chiqim_${cat.name}`,
            },
          ]);

        const keyboard = [
          [{ text: "💰 Kirim kategoriyalari:", callback_data: "ignore" }],
          ...kirimButtons,
          [{ text: "💸 Chiqim kategoriyalari:", callback_data: "ignore" }],
          ...chiqimButtons,
          [{ text: "⬅️ Ortga", callback_data: "back_to_main" }],
        ];

        return bot.sendMessage(chatId, "Kategoriyani tanlang:", {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
      } catch (err) {
        console.error("Error fetching categories:", err);
        return bot.sendMessage(
          chatId,
          "❌ Kategoriyalarni yuklashda xatolik yuz berdi."
        );
      }
    } else if (text === "📝 tahrirlash") {
      return bot.sendMessage(
        chatId,
        "Qaysi turdagi yozuvni tahrirlashni xohlaysiz?",
        {
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
        }
      );
    } else if (text === "🖊️ kirimni tahrirlash") {
      const last = await pool.query(
        "SELECT id, amount, description FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY id DESC LIMIT 5",
        [chatId, "kirim"]
      );
      return bot.sendMessage(chatId, `So'nggi 5 kirim yozuvi:`, {
        reply_markup: {
          inline_keyboard: last.rows.map((row, i) => [
            {
              text: `${i + 1}. ${row.amount} so'm - ${row.description}`,
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
      return bot.sendMessage(chatId, `So'nggi 5 chiqim yozuvi:`, {
        reply_markup: {
          inline_keyboard: last.rows.map((row, i) => [
            {
              text: `${i + 1}. ${row.amount} so'm - ${row.description}`,
              callback_data: `edit_${row.id}`,
            },
          ]),
        },
      });
    } else if (text === "📈 hisobot") {
      let totalIncome = 0;
      let totalExpense = 0;
      const res = await pool.query(
        "SELECT type, SUM(amount) as total FROM transactions WHERE user_id = $1 GROUP BY type",
        [chatId]
      );

      res.rows.forEach((row) => {
        if (row.type === "kirim") totalIncome = parseFloat(row.total);
        else if (row.type === "chiqim") totalExpense = parseFloat(row.total);
      });

      const balance = totalIncome - totalExpense;
      const report = `📊 Hisobot:\n- Jami kirim: ${totalIncome.toLocaleString()} so'm\n- Jami chiqim: ${totalExpense.toLocaleString()} so'm\n- Balans: ${balance.toLocaleString()} so'm`;
      return bot.sendMessage(chatId, report);
    } else if (text === "⚙️ sozlamalar") {
      return bot.sendMessage(chatId, "Sozlamalar bo'limidasiz.", {
        reply_markup: {
          keyboard: [
            [{ text: "kirim kategoriya" }, { text: "chiqim kategoriya" }],
            [{ text: "⬅️ ortga" }],
          ],
          resize_keyboard: true,
        },
      });
    } else if (text === "⬅️ ortga") {
      return bot.sendMessage(chatId, "Asosiy menyu:", {
        reply_markup: {
          keyboard: menu.map((row) => row.map((btn) => ({ text: btn.text }))),
          resize_keyboard: true,
        },
      });
    } else if (text === "kirim kategoriya") {
      userStates.set(chatId, { step: "kirim_categoriya" });
      return bot.sendMessage(chatId, "Kirim categoriya nomini kiriting.");
    } else if (text === "chiqim kategoriya") {
      userStates.set(chatId, { step: "chiqim_categoriya" });
      return bot.sendMessage(chatId, "Kategoriyani tanlang.");
    }

    const newState = userStates.get(chatId);
    if (!newState) return;

    async function addCategory(type, name) {
      try {
        await pool.query(
          "INSERT INTO categories (name, type) VALUES ($1, $2) ON CONFLICT (name, type) DO NOTHING",
          [name, type]
        );
        bot.sendMessage(
          chatId,
          `✅ "${name}" nomli ${
            type === "kirim" ? "kirim" : "chiqim"
          } kategoriyasi muvaffaqiyatli qo'shildi!`
        );
      } catch (err) {
        console.error("Error adding category:", err);
        bot.sendMessage(
          chatId,
          "❌ Kategoriyani qo'shishda xatolik yuz berdi."
        );
      }
    }

    try {
      // Handle category selection state
      if (newState.step === "select_category") {
        const category = await pool.query(
          "SELECT name, type FROM categories WHERE name = $1",
          [text]
        );

        if (category.rows.length === 0) {
          bot.sendMessage(chatId, "❌ Bunday kategoriya topilmadi!");
          return;
        }

        const { name, type } = category.rows[0];
        userStates.set(chatId, {
          step: `${type}_amount`,
          category: name,
        });

        bot.sendMessage(
          chatId,
          `${
            type === "kirim" ? "💰" : "💸"
          } ${name} kategoriyasi tanlandi.\nMiqdorni kiriting:`
        );
        return;
      }
      if (newState.step === "kirim_categoriya") {
        const categoryName = text.trim();
        addCategory("kirim", categoryName);
        userStates.delete(chatId);
        return;
      }
      if (newState.step === "chiqim_categoriya") {
        const categoryName = text.trim();
        addCategory("chiqim", categoryName);
        userStates.delete(chatId);
        return;
      }
      if (newState.step === "kirim_amount") {
        const amount = parseFloat(text);
        if (isNaN(amount)) {
          return bot.sendMessage(
            chatId,
            "❌ Iltimos, miqdor sifatida raqam kiriting!"
          );
        }
        const category = newState.category || null;
        userStates.set(chatId, { step: "kirim_desc", category, amount });
        return bot.sendMessage(chatId, `Iltimos, kirim uchun izoh kiriting:`);
      }
      if (newState.step === "chiqim_amount") {
        const amount = parseFloat(text);
        if (isNaN(amount)) {
          return bot.sendMessage(
            chatId,
            "❌ Iltimos, miqdor sifatida raqam kiriting!"
          );
        }
        const category = newState.category || null;
        userStates.set(chatId, { step: "chiqim_desc", category, amount });
        return bot.sendMessage(chatId, `Iltimos, chiqim uchun izoh kiriting:`);
      }
      if (newState.step === "kirim_desc") {
        const desc = text.trim();
        const { amount, category } = newState;
        await pool.query(
          "INSERT INTO transactions (user_id, type, amount, category, description) VALUES ($1, $2, $3, $4, $5)",
          [chatId, "kirim", amount, category, desc]
        );
        bot.sendMessage(
          chatId,
          `✅ ${amount.toLocaleString()} so'm daromad qo'shildi!\nKategoriya: ${category}\nIzoh: ${desc}`
        );
        userStates.delete(chatId);
        return;
      }
      if (newState.step === "chiqim_desc") {
        const desc = text.trim();
        const { amount, category } = newState;
        await pool.query(
          "INSERT INTO transactions (user_id, type, amount, category, description) VALUES ($1, $2, $3, $4, $5)",
          [chatId, "chiqim", amount, category, desc]
        );
        bot.sendMessage(
          chatId,
          `✅ ${amount.toLocaleString()} so'm chiqim qo'shildi!\nKategoriya: ${category}\nIzoh: ${desc}`
        );
        userStates.delete(chatId);
        return;
      }
      if (newState.step === "edit_amount") {
        const amount = parseFloat(text);
        if (isNaN(amount)) {
          return bot.sendMessage(
            chatId,
            "❌ Iltimos, miqdor sifatida raqam kiriting!"
          );
        }
        userStates.set(chatId, {
          step: "edit_desc",
          transactionId: newState.transactionId,
          amount: amount,
        });
        return bot.sendMessage(chatId, "Yangi izohni kiriting:");
      }
      if (newState.step === "edit_desc") {
        const desc = text.trim();
        const { transactionId, amount } = newState;

        try {
          const checkResult = await pool.query(
            "SELECT id FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'chiqim'",
            [transactionId, chatId]
          );

          if (checkResult.rows.length === 0) {
            bot.sendMessage(chatId, "❌ Bu yozuvni tahrirlay olmaysiz.");
            userStates.delete(chatId);
            return;
          }

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
}
