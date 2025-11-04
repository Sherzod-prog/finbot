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

    // Acknowledge the callback to remove loading state
    try {
      await bot.answerCallbackQuery(query.id);
    } catch (e) {
      // ignore
    }
  });
}
