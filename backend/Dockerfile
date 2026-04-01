# Backend Quiz – Node.js + Express
FROM node:20-alpine

WORKDIR /app

# Dépendances
COPY package*.json ./
RUN npm ci --only=production

# Code source
COPY . .

# Dossier uploads (créé au runtime si besoin)
RUN mkdir -p uploads/media

EXPOSE 3000

CMD ["node", "index.js"]
