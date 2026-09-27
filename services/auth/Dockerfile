FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --omit=optional
COPY . .
RUN npm run build
EXPOSE 4001
CMD ["npm","start"]
