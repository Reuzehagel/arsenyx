FROM mcr.microsoft.com/playwright:v1.59.1-jammy

RUN apt-get update && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
