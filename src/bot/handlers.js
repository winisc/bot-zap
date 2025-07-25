const {
  inSupport,
  mensagensRecebidasPorNumero,
  messageQueues,
} = require("./support");
const { sendToFlowise } = require("./flowise");
const client = require("./client");

async function handleMessage(message) {
  const number = message.from;
  console.log(`Mensagem recebida de ${number}: ${message.body}`);

  if (!messageQueues.has(number)) {
    messageQueues.set(number, Promise.resolve());
  }

  const isInSupport = inSupport.has(number);
  const queue = messageQueues.get(number);

  const newQueue = queue.then(async () => {
    if (isInSupport) {
      try {
        const chat = await message.getChat();
        await chat.markUnread();
      } catch (e) {
        console.error("Erro ao marcar como não lido:", e);
      }
      return;
    }

    if (!mensagensRecebidasPorNumero.has(number)) {
      mensagensRecebidasPorNumero.set(number, []);
    }

    const userMessages = mensagensRecebidasPorNumero.get(number);
    userMessages.push(message.body);
    if (userMessages.length > 5) userMessages.shift();

    const isFirstMessage = userMessages.length === 1;
    if (isFirstMessage) {
      await client.sendMessage(number, "Olá! Seja bem-vindo(a)...");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const response = await sendToFlowise({
      text: message.body,
      number,
      messageObj: message,
    });
    if (response) await client.sendMessage(number, response);
  });

  messageQueues.set(number, newQueue);
}

module.exports = { handleMessage };
