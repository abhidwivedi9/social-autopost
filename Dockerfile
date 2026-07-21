FROM node:20-slim

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["node", "src/server.js"]
