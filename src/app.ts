import fastifyPostgres from "@fastify/postgres";
import fastifyRedis from "@fastify/redis";
import fastify from "fastify";
import { buy } from "./endpoints/buy";
import { items } from "./endpoints/items";
import IORedis from "ioredis";
import fastifyCaching from "@fastify/caching";
import { env } from "./config";

const redis = new IORedis({
  host: env.REDIS_HOST!,
  port: parseInt(env.REDIS_PORT!),
});

const abcache = require("abstract-cache")({
  useAwait: false,
  driver: {
    name: "abstract-cache-redis",
    options: { client: redis },
  },
});

const app = fastify();

app.register(fastifyRedis, { client: redis });

app.register(fastifyCaching, { cache: abcache });

app.register(fastifyPostgres, {
  connectionString: `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`,
});

app.get("/items", items);

app.put("/buy", buy);

app.get("/health-check", (req, reply) => {
  return reply.status(200).send("Server is healthy!");
});

export { app };
