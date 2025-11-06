export default function registerCallbackHandler(bot, userStates) {
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;

    if (query.data && query.data.startsWith("edit_")) {
      const transactionId = query.data.split("_")[1];
      userStates.set(chatId, {
        step: "edit_amount",
        transactionId: transactionId,
      });

      bot.sendMessage(chatId, "Yangi miqdorni kiriting:");
    }
    if (query.data && query.data.startsWith("category_")) {
      const categoryName = query.data.split("_")[2];
      const type = query.data.split("_")[1];
      userStates.set(chatId, {
        step: `${type}_amount`,
        category: categoryName,
      });
      bot.sendMessage(chatId, "Miqdorini kiriting:");
    }
    // Acknowledge the callback to remove loading state
    try {
      await bot.answerCallbackQuery(query.id);
    } catch (e) {
      // ignore
    }
  });
}
