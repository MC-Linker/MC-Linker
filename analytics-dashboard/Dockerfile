FROM node:lts

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD node .output/server/index.mjs
