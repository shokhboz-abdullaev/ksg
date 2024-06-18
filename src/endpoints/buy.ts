import { FastifyReply, FastifyRequest } from "fastify";
import { app } from "../app";
import { fetchSkinPortItems } from "./items";

interface User {
  id: number;
  balance: number;
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

  const queryResult = await app.pg.query<User>(
    `SELECT "users"."id", "users"."balance" FROM "users" WHERE "users"."id" = 1`
  );

  const user = queryResult.rows[0];

  if (!user) {
    return reply
      .status(404)
      .send(
        `Something went wrong! Pre-loaded user does not exist at the moment.`
      );
  }

  const _items = await fetchSkinPortItems(app).catch((error) =>
    reply.status(400).send(error.message)
  );

  const item = _items.find(
    ({ market_hash_name }) => market_hash_name === req.body.market_hash_name
  );

  if (!item) {
    return reply.status(404).send(`Intended item not found!`);
  }

  if (!item.tradable_min_price) {
    return reply.status(400).send(`Item is not tradable!`);
  }

  if (item.tradable_min_price > Number(user.balance)) {
    return reply
      .status(400)
      .send(`User's balance is not sufficient to buy this item!`);
  }
  
  const updateQueryResult = await app.pg.query<User>(
    `UPDATE "users" SET "balance" = "balance" - $1 WHERE "users"."id" = $2 RETURNING *`,
    [item.tradable_min_price, user.id]
  );

  const result = updateQueryResult.rows[0];

  return { id: result.id, balance: Number(result.balance) };
};
