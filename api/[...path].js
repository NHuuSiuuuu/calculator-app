import { createProductionApiServer } from "../apps/api/src/app.js";
import { createVercelHandler } from "../apps/api/src/vercelHandler.js";

export default createVercelHandler(createProductionApiServer);
