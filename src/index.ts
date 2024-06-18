import { AddressInfo } from "net";
import { app } from "./app";
import { env } from "./config";


app.listen({ port: parseInt(env.PORT || '3000') }, (err) => {
  if (err) throw err;
  console.log(`Server listening on port ${(app.server.address() as AddressInfo).port}`);
});
