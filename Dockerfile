FROM node:18-bookworm-slim@sha256:b50c0b5628a4a10093a2b4b8b7a7060c10e5983abb8ea89a7892fc6ddb0730e3 as build

# Compile TS
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY admin ./admin
RUN npm ci
COPY prisma ./prisma
RUN npm run db:generate
COPY src ./src
RUN npm run build

FROM node:18-bookworm-slim@sha256:b50c0b5628a4a10093a2b4b8b7a7060c10e5983abb8ea89a7892fc6ddb0730e3 as app

RUN apt-get update -y && apt-get install -y openssl

RUN mkdir -p /opt/service/
WORKDIR /opt/service

COPY package.json package-lock.json ./
# Ignore scripts to skip installing Husky
RUN npm ci --omit=dev --ignore-scripts
# Copy the compiled JS from the build image
COPY --from=build /app/build ./
COPY --from=build /app/admin/dist ./admin/dist
COPY prisma ./prisma
COPY static ./static
COPY entrypoint.sh .
RUN chown -R node: /opt/service
USER node

EXPOSE 8080
ENTRYPOINT ["/opt/service/entrypoint.sh"]
