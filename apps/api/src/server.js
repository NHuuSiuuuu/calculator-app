import { readApiConfig } from "./config.js";
import { createProductionApiServer } from "./app.js";

const config = readApiConfig();
const server = createProductionApiServer();
server.listen(config.port, () => {
  console.log(`AI Support API listening on ${config.port}`);
});
