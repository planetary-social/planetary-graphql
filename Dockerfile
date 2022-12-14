FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm update

RUN npm install

COPY . .

EXPOSE  4000
EXPOSE 26835

RUN npm install pm2 -g

CMD ["pm2-runtime", "index.js"]
