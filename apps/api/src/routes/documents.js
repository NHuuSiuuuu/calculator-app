import { chunkText } from "../chunkText.js";

const ALLOWED_TYPES = new Set(["text/plain", "text/markdown"]);

export async function handleDocumentUpload({ user, file, repository, openAiClient }) {
  if (!ALLOWED_TYPES.has(file.contentType)) {
    const error = new Error("Only .txt and .md files are supported");
    error.statusCode = 400;
    throw error;
  }

  const document = await repository.createDocument({
    ownerId: user.id,
    filename: file.filename,
    contentType: file.contentType,
  });

  try {
    const chunks = chunkText(file.text);
    if (chunks.length === 0) {
      throw new Error("Uploaded document is empty");
    }

    const chunksWithEmbeddings = [];
    for (const chunk of chunks) {
      chunksWithEmbeddings.push({
        ...chunk,
        embedding: await openAiClient.createEmbedding(chunk.content),
      });
    }

    await repository.insertChunks(document.id, chunksWithEmbeddings);
    await repository.markDocumentReady(document.id, chunksWithEmbeddings.length);

    return { documentId: document.id, status: "ready", chunkCount: chunksWithEmbeddings.length };
  } catch (error) {
    await repository.markDocumentFailed(document.id, error.message);
    throw error;
  }
}
