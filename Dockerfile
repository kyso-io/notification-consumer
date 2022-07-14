# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG BUILDER_IMG=registry.kyso.io/kyso-io/consumers/notification-consumer
ARG BUILDER_TAG=builder
ARG SERVICE_IMG=registry.kyso.io/docker/node-service
ARG SERVICE_TAG=latest

# Builder image
FROM ${BUILDER_IMG}:${BUILDER_TAG} AS builder
# Change the working directory to /app
WORKDIR /app
# Copy files required to build the application
COPY . .
# Execute `npm ci` with an externally mounted npmrc
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc,required npm ci
# Now do the build
RUN npm run build

## Production image
FROM ${SERVICE_IMG}:${SERVICE_TAG} AS service
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
COPY --chown=node:node --from=builder /app/templates ./templates
COPY --chown=node:node --from=builder /app/version.txt ./version.txt
## Disable next telemetry usage
ENV NEXT_TELEMETRY_DISABLED 1
## Run the compiled version
CMD ["npm", "run", "start:prod"]
