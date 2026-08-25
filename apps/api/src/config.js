export function readApiConfig(env = process.env) {
  const aiProvider = String(env.AI_PROVIDER || "gemini").toLowerCase();

  return {
    aiProvider,
    openaiApiKey: String(env.OPENAI_API_KEY ?? ""),
    geminiApiKey: String(env.GEMINI_API_KEY ?? ""),
    embeddingModel: String(
      env.GEMINI_EMBEDDING_MODEL
        || env.OPENAI_EMBEDDING_MODEL
        || (aiProvider === "gemini" ? "gemini-embedding-001" : "text-embedding-3-small"),
    ),
    chatModel: String(
      env.GEMINI_CHAT_MODEL
        || env.OPENAI_CHAT_MODEL
        || (aiProvider === "gemini" ? "gemini-2.5-flash-lite" : "gpt-4.1-mini"),
    ),
    embeddingDimensions: Number.parseInt(String(env.EMBEDDING_DIMENSIONS ?? "1536"), 10),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, ""),
    supabaseServiceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    port: Number.parseInt(String(env.PORT ?? "8787"), 10),
  };
}

export function requireApiConfig(config) {
  const missing = [];
  if (config.aiProvider === "gemini") {
    if (!config.geminiApiKey) missing.push("GEMINI_API_KEY");
  } else if (!config.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
  }
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    const error = new Error(`Missing API environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}
