const express = require("express");
const router = express.Router();
const { inSupport } = require("../bot/support");
const client = require("../bot/client");

router.post("/", async (req, res) => {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ erro: "Informe número válido" });

  const chatId = numero.includes("@c.us") ? numero : `${numero}@c.us`;

  if (!inSupport.has(chatId)) {
    return res
      .status(404)
      .json({ erro: "Este número não está em atendimento" });
  }

  try {
    inSupport.delete(chatId);
    await client.sendMessage(chatId, "Atendimento encerrado.");
    res.json({ status: "Número removido do suporte com sucesso" });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: "Erro ao processar a remoção" });
  }
});

module.exports = router;
