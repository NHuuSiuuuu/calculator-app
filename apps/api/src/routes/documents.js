import { chunkText } from "../chunkText.js";

const ALLOWED_TYPES_BY_EXTENSION = {
  ".txt": new Set(["", "text/plain", "application/octet-stream"]),
  ".md": new Set(["", "text/plain", "text/markdown", "application/octet-stream"]),
};

const STORED_TYPE_BY_EXTENSION = {
  ".txt": "text/plain",
  ".md": "text/markdown",
};

function fileExtension(filename) {
  return String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0];
}

function isAllowedFile({ filename, contentType }) {
  const extension = fileExtension(filename);
  const allowedTypes = ALLOWED_TYPES_BY_EXTENSION[extension];
  return Boolean(allowedTypes?.has(String(contentType ?? "").toLowerCase()));
}

export async function handleDocumentUpload({ user, file, repository, openAiClient }) {
  if (!isAllowedFile(file)) {
    const error = new Error("Only .txt and .md files are supported");
    error.statusCode = 400;
    throw error;
  }

  const document = await repository.createDocument({
    ownerId: user.id,
    filename: file.filename,
    contentType: STORED_TYPE_BY_EXTENSION[fileExtension(file.filename)],
  });

  try {
    const chunks = chunkText(file.text);
    if (chunks.length === 0) {
      const error = new Error("Uploaded document is empty");
      error.statusCode = 400;
      throw error;
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
