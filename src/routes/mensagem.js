const express = require("express");
const router = express.Router();
const client = require("../bot/client");

router.post("/", async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res.status(400).json({ erro: "Informe número e mensagem válidos" });
  }

  const chatId = numero.includes("@c.us") ? numero : `${numero}@c.us`;

  try {
    await client.sendMessage(chatId, mensagem);
    res.json({ status: "Mensagem enviada com sucesso" });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ erro: "Erro ao enviar mensagem" });
  }
});

module.exports = router;
