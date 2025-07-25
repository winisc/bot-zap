const express = require("express");
const mensagemRoute = require("./routes/mensagem");
const removerSuporteRoute = require("./routes/remover-suporte");

const app = express();
app.use(express.json());

app.use("/mensagem", mensagemRoute);
app.use("/remover-suporte", removerSuporteRoute);

module.exports = app;
