import {
  buildGroundedPrompt,
  createEmptyKnowledgeBaseAnswer,
  createGreetingAnswer,
  createNoContextAnswer,
  isShortGreeting,
} from "../ragPrompt.js";

const MAX_MESSAGE_CHARS = 4000;
const RETRIEVAL_TOP_K = 5;
const RETRIEVAL_MATCH_THRESHOLD = -1;

function titleFromMessage(message) {
  return message.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeGeneratedTitle(title) {
  return String(title ?? "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function generateConversationTitle({ userId, conversationId, message, answer, repository, openAiClient }) {
  if (typeof repository.updateConversationTitle !== "function") return;

  try {
    const generatedTitle = normalizeGeneratedTitle(await openAiClient.createChatAnswer([
      {
        role: "system",
        content: [
          "Bạn đặt tiêu đề ngắn cho cuộc trò chuyện như ChatGPT.",
          "Chỉ trả về tiêu đề, không giải thích, không dùng dấu ngoặc kép.",
          "Tiêu đề dài tối đa 8 từ và phải mô tả nội dung chính của cuộc trò chuyện.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Người dùng: ${message}\nTrợ lý: ${answer}`,
      },
    ]));
    if (generatedTitle) {
      await repository.updateConversationTitle(userId, conversationId, generatedTitle);
    }
  } catch {
    // Title generation is cosmetic; the chat response must remain usable.
  }
}

export async function handleChatRequest({ user, body, repository, openAiClient }) {
  const message = String(body.message ?? "").trim();
  if (!message) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    const error = new Error(`Message must be ${MAX_MESSAGE_CHARS} characters or fewer`);
    error.statusCode = 400;
    throw error;
  }

  let conversation;
  let createdConversation = false;
  if (body.conversationId) {
    conversation = await repository.getConversation(user.id, body.conversationId);
    if (!conversation) {
      const error = new Error("Conversation not found");
      error.statusCode = 404;
      throw error;
    }
  } else {
    conversation = await repository.createConversation(user.id, titleFromMessage(message));
    createdConversation = true;
  }

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  let chunks = [];
  let answer;
  if (isShortGreeting(message)) {
    answer = createGreetingAnswer();
  } else {
    const hasReadyDocuments = await repository.hasReadyDocuments();
    if (!hasReadyDocuments) {
      answer = createEmptyKnowledgeBaseAnswer();
    } else {
      const queryEmbedding = await openAiClient.createEmbedding(message, "QUESTION_ANSWERING");
      chunks = await repository.matchChunks(queryEmbedding, RETRIEVAL_MATCH_THRESHOLD, RETRIEVAL_TOP_K);
      if (chunks.length === 0) {
        answer = createNoContextAnswer();
      } else {
        const prompt = buildGroundedPrompt(message, chunks);
        answer = await openAiClient.createChatAnswer([
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ]);
      }
    }
  }

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: answer,
    retrievedChunkIds: chunks.map((chunk) => chunk.chunkId),
  });

  if (createdConversation) {
    await generateConversationTitle({
      userId: user.id,
      conversationId: conversation.id,
      message,
      answer,
      repository,
      openAiClient,
    });
  }

  return {
    conversationId: conversation.id,
    answer,
    sources: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      filename: chunk.filename,
      similarity: chunk.similarity,
    })),
  };
}
