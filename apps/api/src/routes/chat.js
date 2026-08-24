import { buildGroundedPrompt, createNoContextAnswer } from "../ragPrompt.js";

function titleFromMessage(message) {
  return message.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function handleChatRequest({ user, body, repository, openAiClient }) {
  const message = String(body.message ?? "").trim();
  if (!message) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }

  const conversation = body.conversationId
    ? { id: body.conversationId }
    : await repository.createConversation(user.id, titleFromMessage(message));

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  const queryEmbedding = await openAiClient.createEmbedding(message);
  const chunks = await repository.matchChunks(queryEmbedding, 0.74, 5);
  const answer = chunks.length === 0
    ? createNoContextAnswer()
    : await openAiClient.createChatAnswer([
      { role: "system", content: buildGroundedPrompt(message, chunks).system },
      { role: "user", content: buildGroundedPrompt(message, chunks).user },
    ]);

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: answer,
    retrievedChunkIds: chunks.map((chunk) => chunk.chunkId),
  });

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
