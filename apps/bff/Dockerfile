FROM node:22-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

RUN npm install -g pnpm
COPY package*.json ./
RUN pnpm install --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
