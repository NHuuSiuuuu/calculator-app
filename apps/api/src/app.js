import { createClient } from "@supabase/supabase-js";

import { createAuthService } from "./auth.js";
import { readApiConfig, requireApiConfig } from "./config.js";
import { createApiServer } from "./http.js";
import { createOpenAiClient } from "./openaiClient.js";
import { createSupportRepository } from "./repositories/supportRepository.js";

export function createProductionApiServer(env = process.env) {
  const config = readApiConfig(env);
  requireApiConfig(config);

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return createApiServer({
    authService: createAuthService(supabase),
    repository: createSupportRepository(supabase),
    openAiClient: createOpenAiClient(config),
    config,
  });
}
