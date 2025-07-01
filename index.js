const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Instancia o cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Geração de QR Code
client.on("qr", (qr) => {
  console.log("📱 Escaneie o QR Code abaixo com seu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot do WhatsApp conectado e pronto!");
});

//Controles de mensagens e suporte
const inSupport = new Map();
const mensagensRecebidasPorNumero = new Map();
const messageQueues = new Map(); // Fila por número

// Intercepta mensagens do WhatsApp e envia ao Flowise/Gemini
client.on("message", async (message) => {
  const number = message.from;
  console.log(`📩 Mensagem recebida de ${number}: ${message.body}`);

  if (!messageQueues.has(number)) {
    messageQueues.set(number, Promise.resolve());
  }

  const isInSupport = inSupport.has(number);

  const queue = messageQueues.get(number);
  const newQueue = queue.then(async () => {
    if (isInSupport) {
      console.log(
        `🙋 ${number} está em atendimento humano. Mensagem não enviada ao Flowise.`
      );

      try {
        const chat = await message.getChat();
        console.log("🕵️ Tentando marcar como não lido:", chat.id._serialized);
        await chat.markUnread();
        console.log("✅ Chat marcado como não lido");
      } catch (e) {
        console.error("❌ Erro ao marcar como não lido:", e);
      }

      return;
    }

    if (!mensagensRecebidasPorNumero.has(number)) {
      mensagensRecebidasPorNumero.set(number, []);
    }

    const userMessages = mensagensRecebidasPorNumero.get(number);
    userMessages.push(message.body);
    if (userMessages.length > 5) {
      userMessages.shift();
    }

    const isFirstMessage = userMessages.length === 1;

    if (isFirstMessage) {
      const welcomeMessage = `Olá! Seja bem-vindo(a)! Estou aqui para ajudar você. Pode enviar sua dúvida sobre qualquer assunto referente ao ENEM. 😊`;
      await client.sendMessage(number, welcomeMessage);
      console.log(`✅ Enviada mensagem de boas-vindas para ${number}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const flowisePayload = {
      text: message.body,
      number,
      messageObj: message,
    };

    try {
      const response = await sendToFlowise(flowisePayload);
      if (response) {
        await client.sendMessage(number, response);
      }
    } catch (err) {
      console.error("Erro ao enviar para Flowise:", err);
    }
  });

  messageQueues.set(number, newQueue);
});

// Endpoint para remover número do suporte
app.post("/remover-suporte", async (req, res) => {
  console.log("📥 Requisição recebida para /remover-suporte");
  const { numero } = req.body;

  // Validação de entrada
  if (typeof numero !== "string" || numero.trim() === "") {
    console.warn("⚠️ Número inválido recebido:", numero);
    return res.status(400).json({ erro: "Informe número válido" });
  }

  const chatId = numero.includes("@c.us") ? numero : `${numero}@c.us`;
  console.log(`🔍 ChatId formatado: ${chatId}`);

  // Verifica se o número está em atendimento
  if (!inSupport.has(chatId)) {
    console.warn(`⚠️ ${chatId} não está em atendimento.`);
    return res
      .status(404)
      .json({ erro: "Este número não está em atendimento" });
  }

  try {
    // Remove do mapa de atendimento
    inSupport.delete(chatId);
    console.log(`🟢 ${chatId} removido do suporte.`);

    // Envia mensagem de confirmação
    const mensagem =
      "✅ Atendimento encerrado. Se precisar de mais ajuda, estou por aqui!";
    const result = await client.sendMessage(chatId, mensagem);
    console.log(
      "📨 Mensagem enviada com sucesso:",
      result?.id?._serialized || result
    );

    res.json({ status: "Número removido do suporte com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao remover do suporte ou enviar mensagem:", err);
    res.status(500).json({ erro: "Erro ao processar a remoção" });
  }
});

// Endpoint para enviar mensagem programaticamente
app.post("/mensagem", async (req, res) => {
  const { numero, mensagem } = req.body;

  if (
    typeof numero !== "string" ||
    typeof mensagem !== "string" ||
    numero.trim() === "" ||
    mensagem.trim() === ""
  ) {
    return res.status(400).json({ erro: "Informe número e mensagem válidos" });
  }

  const chatId = numero.includes("@c.us") ? numero : `${numero}@c.us`;

  try {
    console.log("➡️ Enviando mensagem para:", chatId);
    console.log("📨 Conteúdo:", mensagem);

    const result = await client.sendMessage(chatId, mensagem);

    console.log("✅ Mensagem enviada:", result?.id?._serialized || result);

    res.json({ status: "Mensagem enviada com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
    res.status(500).json({ erro: "Erro ao enviar mensagem" });
  }
});

// Função que envia a pergunta ao Flowise (com Gemini)
async function sendToFlowise({ text, number, messageObj }) {
  if (inSupport.has(number)) {
    console.log(
      `⚠️ ${number} já está em atendimento. Ignorando envio ao Flowise.`
    );

    try {
      const chat = await messageObj.getChat();
      console.log("🕵️ Tentando marcar como não lido:", chat.id._serialized);
      await chat.markUnread();
      console.log("✅ Chat marcado como não lido");
    } catch (e) {
      console.error("❌ Erro ao marcar como não lido:", e);
    }

    return null;
  }

  try {
    const response = await axios.post(
      process.env.FLOWISE_URL,
      { question: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLOWISE_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[Resposta Flowise completa]", response.data);

    const respostaTexto =
      response.data?.text ||
      response.data?.output ||
      "Não entendi, pode repetir?";

    const redirecionaSuporte = respostaTexto.includes(
      "Estou encaminhando sua solicitação para nossa equipe. Eles irão analisar seu caso com prioridade e entrar em contato com você em breve."
    );

    if (redirecionaSuporte) {
      console.log(`🆘 Redirecionando ${number} para o suporte.`);
      inSupport.set(number, true);

      try {
        //Adicionar notificacao de suporte ou alerta
        console.log("✅ Chat redirecionado para o suporte.");
      } catch (e) {
        console.error("❌ Erro ao marcar como não lido:", e);
      }
    }

    return respostaTexto;
  } catch (err) {
    console.error("[Erro Flowise]", err);
    return "Estamos com problemas técnicos. Aguarde um momento.";
  }
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 API escutando na porta ${PORT}`);
});

client.initialize();
