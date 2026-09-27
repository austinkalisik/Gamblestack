FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=optional
COPY . .
RUN npm run build
EXPOSE 4004
CMD ["npm","start"]
