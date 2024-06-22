import { FastifyReply, FastifyRequest } from "fastify";
import { app } from "../app";
import { fetchSkinPortItems } from "./items";

interface User {
  id: number;
  balance: number;
}

class ErrorWithCode {
  constructor(public data: { code: number; message: string }) {}
}

export const buy = async function (
  req: FastifyRequest<{ Body: { market_hash_name: string } }>,
  reply: FastifyReply
) {
  if (!req.body.market_hash_name) {
    return reply
      .status(400)
      .send(`Body parameter "market_hash_name" has to be provided`);
  }

  try {
    const _items = await fetchSkinPortItems(app).catch((error) => {
      throw new ErrorWithCode({ code: 400, message: error.message });
    });

    const item = _items.find(
      ({ market_hash_name }) => market_hash_name === req.body.market_hash_name
    );

    if (!item) {
      return reply.status(404).send(`Intended item not found!`);
    }

    if (!item.tradable_min_price) {
      return reply.status(400).send(`Item is not tradable!`);
    }

    const updateQueryResult = await app.pg.transact(async (client) => {
      const queryResult = await client.query<User>(
        `SELECT "users"."id", "users"."balance" FROM "users" WHERE "users"."id" = 1 FOR UPDATE`
      );

      const user = queryResult.rows[0];

      if (!user) {


        throw new ErrorWithCode({
          code: 404,
          message: `Something went wrong! Pre-loaded user does not exist at the moment.`,
        });
      }

      if (item.tradable_min_price > Number(user.balance)) {
 
        throw new ErrorWithCode({
          code: 404,
          message: `User's balance is not sufficient to buy this item!`,
        });
      }

      const updateQueryResult = await client.query<User>(
        `UPDATE "users" SET "balance" = "balance" - $1 WHERE "users"."id" = $2 RETURNING *`,
        [item.tradable_min_price, user.id]
      );

      return updateQueryResult;
    });

    const result = updateQueryResult.rows[0];

    return reply.status(200).send({ id: result.id, balance: Number(result.balance) });
  } catch (err) {
    const _err = err as ErrorWithCode;

    if (_err.data) {
      return reply.status(_err.data.code).send(_err.data.message);
    }

    return reply.status(500).send(`Internal Server Error: ${(err as Error)?.message}`)
  }
};
