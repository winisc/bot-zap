const axios = require("axios");
const { inSupport } = require("./support");

async function sendToFlowise({ text, number, messageObj }) {
  if (inSupport.has(number)) {
    try {
      const chat = await messageObj.getChat();
      await chat.markUnread();
    } catch (e) {
      console.error("Erro ao marcar como não lido:", e);
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

    const respostaTexto =
      response.data?.text ||
      response.data?.output ||
      "Não entendi, pode repetir?";

    const redirecionaSuporte = respostaTexto.includes(
      "Estou encaminhando sua solicitação para nossa equipe"
    );
    if (redirecionaSuporte) {
      inSupport.set(number, true);
    }

    return respostaTexto;
  } catch (err) {
    console.error("[Erro Flowise]", err);
    return "Estamos com problemas técnicos. Aguarde um momento.";
  }
}

module.exports = { sendToFlowise };
