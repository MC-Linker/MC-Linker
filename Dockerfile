# To Build Run: docker build . -t lianecx/mc-linker
FROM node:lts

# Create app directory
WORKDIR /usr/src/app

# Install docker
# Add Docker's official GPG key:
RUN apt-get update && \
    apt-get install -y ca-certificates curl && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null && \
  apt-get update

RUN apt-get install -y docker-ce-cli docker-compose-plugin

# A wildcard is used to ensure both package.json AND package-lock.json
# are copied where available (npm@5+)
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

CMD [ "node", "--max-old-space-size=8192", "main.js" ]
