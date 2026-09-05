export function createOpenAiClient(config, fetchImpl = globalThis.fetch) {
  async function request(path, body) {
    const response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.openaiApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    return payload;
  }

  return {
    async createEmbedding(input) {
      const payload = await request("embeddings", {
        model: config.embeddingModel,
        input,
      });
      return payload.data[0].embedding;
    },

    async createChatAnswer(messages) {
      const payload = await request("chat/completions", {
        model: config.chatModel,
        messages,
        temperature: 0.2,
      });
      return payload.choices[0].message.content;
    },
  };
}
