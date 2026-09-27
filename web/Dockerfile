FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --include=optional \
 && ROLLUP_VERSION="$(node -p "require('./node_modules/rollup/package.json').version")" \
 && npm install --no-save "@rollup/rollup-linux-x64-musl@$ROLLUP_VERSION"
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","run","preview","--","--port","3000","--host","0.0.0.0"]
