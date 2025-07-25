require("dotenv").config();
const client = require("./bot/client");
const { handleMessage } = require("./bot/handlers");
const app = require("./app");

client.on("message", handleMessage);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API escutando na porta ${PORT}`);
});

client.initialize();
