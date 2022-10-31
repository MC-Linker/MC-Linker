# To Build Run: docker build . -t Lianecx/mc-linker

# FROM node:lts
FROM node:18-slim
# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci \
    && npm install -g typescript

# Bundle app source
COPY . .

# Build
RUN tsc

EXPOSE 3100
CMD [ "node", "main.js" ]
