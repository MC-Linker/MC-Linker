# To Build Run: docker build . -t lianecx/mc-linker
FROM node:latest

# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json
# are copied where available (npm@5+)
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

CMD [ "node", "main.js" ]
