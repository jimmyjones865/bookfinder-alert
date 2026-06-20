FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
