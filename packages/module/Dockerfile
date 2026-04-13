FROM oven/bun:1.1.0

WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
RUN bun build.ts

EXPOSE 3000
CMD ["bun", "dist/index.js"]
