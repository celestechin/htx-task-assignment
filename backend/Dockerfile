# stage 1: compile typescript to javascript
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# stage 2: a smaller image with only what's needed to run
# no typescript or test tools in here, just the compiled code
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY db ./db
# don't run as root
USER node
EXPOSE 3000
# bring the db up to date, add the seed data (safe to repeat), then start the api
# exec so node gets docker's stop signal directly
CMD ["sh", "-c", "npm run migrate && node dist/db/seed.js && exec node dist/index.js"]
