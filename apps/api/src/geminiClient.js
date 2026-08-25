const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function textPart(text) {
  return { text: String(text ?? "") };
}

function normalizeMessages(messages) {
  const systemMessages = messages.filter((message) => message.role === "system");
  const userMessages = messages.filter((message) => message.role !== "system");

  return {
    systemInstruction: systemMessages.length > 0
      ? { parts: systemMessages.map((message) => textPart(message.content)) }
      : undefined,
    contents: userMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [textPart(message.content)],
    })),
  };
}

function extractText(payload) {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
}

export function createGeminiClient(config, fetchImpl = globalThis.fetch) {
  async function request(model, method, body) {
    const response = await fetchImpl(`${GEMINI_API_BASE_URL}/models/${model}:${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message ?? `Gemini request failed with ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    return payload;
  }

  return {
    async createEmbedding(input, taskType = "QUESTION_ANSWERING") {
      const payload = await request(config.embeddingModel, "embedContent", {
        content: {
          parts: [textPart(input)],
        },
        embedContentConfig: {
          taskType,
          outputDimensionality: config.embeddingDimensions,
        },
      });
      if (!Array.isArray(payload.embedding?.values)) {
        const error = new Error("Gemini embedding response did not include embedding.values");
        error.statusCode = 502;
        throw error;
      }
      return payload.embedding.values;
    },

    async createChatAnswer(messages) {
      const { systemInstruction, contents } = normalizeMessages(messages);
      const payload = await request(config.chatModel, "generateContent", {
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        generationConfig: {
          temperature: 0.2,
        },
      });
      const answer = extractText(payload);
      if (!answer) {
        const error = new Error("Gemini response did not include text content");
        error.statusCode = 502;
        throw error;
      }
      return answer;
    },
  };
}
