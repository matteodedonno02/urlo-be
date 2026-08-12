# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=docker
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY config.docker.json ./
COPY migrations ./migrations
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npx /usr/local/bin/npm \
  && rm -rf /root/.npm
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
