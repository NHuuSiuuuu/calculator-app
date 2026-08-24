import { createClient } from "@supabase/supabase-js";

import { createAuthService } from "./auth.js";
import { readApiConfig, requireApiConfig } from "./config.js";
import { createApiServer } from "./http.js";
import { createOpenAiClient } from "./openaiClient.js";
import { createSupportRepository } from "./repositories/supportRepository.js";

const config = readApiConfig();
requireApiConfig(config);

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const server = createApiServer({
  authService: createAuthService(supabase),
  repository: createSupportRepository(supabase),
  openAiClient: createOpenAiClient(config),
  config,
});

server.listen(config.port, () => {
  console.log(`AI Support API listening on ${config.port}`);
});
