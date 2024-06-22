import { FastifyReply, FastifyRequest } from "fastify";
import axios from "axios";
import { app } from "../app";

interface SkinPortItem {
  market_hash_name: string;
  currency: string;
  suggested_price: number;
  item_page: string;
  market_page: string;
  min_price: number;
  max_price: number;
  mean_price: number;
  quantity: number;
  created_at: number;
  updated_at: number;
}

interface ResultItem extends Omit<SkinPortItem, "min_price"> {
  tradable_min_price: number;
  non_tradable_min_price: number;
  min_price?: number;
}

const toObjectBy = <T>(arr: T[], by: (item: T) => string | number | symbol) => {
  const object: Record<ReturnType<typeof by>, T> = {};

  for (const item of arr) {
    object[by(item)] = item;
  }

  return object;
};

export const fetchSkinPortItems = async (_app: typeof app) => {
  const baseUrl = `https://api.skinport.com/v1/items`;

  const cacheKey = "skin_port_items";

  return new Promise<ResultItem[]>((resolve, reject) =>
    app.cache.get(cacheKey, async (error, cachedResult) => {
      if (error) reject(error);

      if (cachedResult) {
        return resolve(
          JSON.parse((cachedResult as { item: string }).item) as ResultItem[]
        );
      }

      const [{ data: tradable }, { data: nonTradable }] = await Promise.all([
        axios.get<SkinPortItem[]>(baseUrl, {
          params: {
            tradable: 1,
          },
        }),
        axios.get<SkinPortItem[]>(baseUrl, {
          params: {
            tradable: 0,
          },
        }),
      ]).catch(() => [{ data: undefined }, { data: undefined }]);

      if (!tradable || !nonTradable || !nonTradable?.length || !tradable?.length) return reject(new Error("RateLimit Exceeded"));

      const nonTradableObject = toObjectBy(
        nonTradable!,
        ({ market_hash_name }) => market_hash_name
      );

      const result = tradable!.map((item) => {
        const mapped: ResultItem = {
          ...item,
          non_tradable_min_price:
            nonTradableObject[item.market_hash_name].min_price,
          tradable_min_price: item.min_price,
        };

        delete mapped["min_price"];

        return mapped;
      });

      // 5 minutes
      const ttl = 60_000 * 5;

      app.cache.set(cacheKey, JSON.stringify(result), ttl, (error) => {
        if (error) reject(error);

        return resolve(result);
      });
    })
  );
};

export const items = async function (req: FastifyRequest, reply: FastifyReply) {
  const result = await fetchSkinPortItems(app).catch((error) => reply.status(400).send(error.message));

  return reply
    .code(200)
    .header("Content-Type", "application/json; charset=utf-8")
    .send(result);
};
