# Builder image
FROM node:16.15.1-alpine3.16 AS builder
# Change the working directory to /app
WORKDIR /app
# Copy files required to build the application
COPY . .
# Execute `npm ci` with an externally mounted npmrc
RUN npm install
# Now do the build
RUN npm run build

## Production image
FROM node:16.15.1-alpine3.16 AS service
# Set the NODE_ENV value from the args
ARG NODE_ENV=production
## Export the NODE_ENV to the container environment
ENV NODE_ENV=${NODE_ENV}
### For security reasons don't run as root
USER node
### Change the working directory to /app
WORKDIR /app
## Copy the relevant files & dirs from the /app builder dir
COPY --chown=node:node --from=builder /app/*.json ./
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/release.txt ./
COPY --chown=node:node --from=builder /app/templates ./templates
## Disable next telemetry usage
ENV NEXT_TELEMETRY_DISABLED 1
## Run the compiled version
CMD ["npm", "run", "start:prod"]
