import { createProductionApiServer } from "../../api/src/app.js";
import { createVercelHandler } from "../../api/src/vercelHandler.js";

export default createVercelHandler(createProductionApiServer);
