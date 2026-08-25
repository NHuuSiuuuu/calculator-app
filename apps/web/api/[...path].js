import { createProductionApiServer } from "../../api/src/app.js";

const server = createProductionApiServer();

export default function handler(request, response) {
  server.emit("request", request, response);
}
