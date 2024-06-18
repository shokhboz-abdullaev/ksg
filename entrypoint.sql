CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "balance" NUMERIC(10, 2) CHECK (balance >= 0)
);

INSERT INTO "users" ("id", "balance")
VALUES (1, 1000.00)
ON CONFLICT ("id") DO NOTHING;