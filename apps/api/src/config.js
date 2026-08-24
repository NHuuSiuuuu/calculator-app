export function readApiConfig(env = process.env) {
  return {
    openaiApiKey: String(env.OPENAI_API_KEY ?? ""),
    embeddingModel: String(env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"),
    chatModel: String(env.OPENAI_CHAT_MODEL || "gpt-4.1-mini"),
    supabaseUrl: String(env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    supabaseServiceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    port: Number.parseInt(String(env.PORT ?? "8787"), 10),
  };
}

export function requireApiConfig(config) {
  const missing = [];
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    const error = new Error(`Missing API environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}
