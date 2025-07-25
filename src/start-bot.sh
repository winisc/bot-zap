#!/bin/bash

# Caminho opcional para o arquivo .env
ENV_FILE=".env"

# Verifica se o .env existe
if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo .env não encontrado!"
  exit 1
fi

# Exporta as variáveis do .env
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Inicia o servidor
echo "Iniciando o bot WhatsApp..."
node index.js
