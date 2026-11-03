FROM node:22-alpine AS build
WORKDIR /srv
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production
COPY --from=build /srv/node_modules ./node_modules
COPY --from=build /srv/dist/src ./dist
EXPOSE 8000
CMD ["node", "dist/server.js"]
