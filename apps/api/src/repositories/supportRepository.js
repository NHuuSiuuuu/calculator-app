function createSetupError(message) {
  const setupError = new Error(message);
  setupError.statusCode = 500;
  setupError.expose = true;
  return setupError;
}

function raiseIfError(error) {
  if (error) {
    const message = error.message ?? "Supabase request failed";
    if (/relation "support_(documents|document_chunks|conversations|messages)" does not exist/i.test(message)
      || /match_support_chunks/i.test(message)) {
      throw createSetupError("Supabase RAG migration is missing. Run supabase/migrations/0002_ai_rag_support.sql.");
    }
    if (/permission denied|row-level security|invalid api key|invalid jwt|jwt/i.test(message)) {
      throw createSetupError("Supabase service role key is invalid or not configured. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.");
    }
    if (/expected \d+ dimensions, not \d+/i.test(message)) {
      throw createSetupError("Embedding dimension mismatch. Gemini must return 1536-dimensional embeddings for the current Supabase schema.");
    }
    throw new Error(message);
  }
}

function selectSingle(query) {
  return query.select("*").single();
}

function scopeByNullableUser(query, userId) {
  return userId === null ? query.is("user_id", null) : query.eq("user_id", userId);
}

export function createSupportRepository(supabase) {
  return {
    async createDocument({ ownerId, filename, contentType }) {
      const { data, error } = await selectSingle(supabase.from("support_documents").insert({
        owner_id: ownerId,
        filename,
        content_type: contentType,
        status: "processing",
      }));
      raiseIfError(error);
      return data;
    },

    async markDocumentReady(documentId, chunkCount) {
      const { error } = await supabase.from("support_documents")
        .update({ status: "ready", chunk_count: chunkCount, error_message: null })
        .eq("id", documentId);
      raiseIfError(error);
    },

    async markDocumentFailed(documentId, message) {
      const { error } = await supabase.from("support_documents")
        .update({ status: "failed", error_message: String(message).slice(0, 240) })
        .eq("id", documentId);
      raiseIfError(error);
    },

    async insertChunks(documentId, chunksWithEmbeddings) {
      const rows = chunksWithEmbeddings.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
        embedding: chunk.embedding,
      }));
      const { data, error } = await supabase.from("support_document_chunks").insert(rows).select("*");
      raiseIfError(error);
      return data;
    },

    async listDocuments() {
      const { data, error } = await supabase.from("support_documents")
        .select("*")
        .order("created_at", { ascending: false });
      raiseIfError(error);
      return data;
    },

    async matchChunks(embedding, threshold = 0.74, count = 5) {
      const { data, error } = await supabase.rpc("match_support_chunks", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
      });
      raiseIfError(error);
      return (data ?? []).map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        filename: row.filename,
        similarity: row.similarity,
      }));
    },

    async hasReadyDocuments() {
      const { data, error } = await supabase.from("support_documents")
        .select("id")
        .eq("status", "ready")
        .limit(1);
      raiseIfError(error);
      return (data ?? []).length > 0;
    },

    async createConversation(userId, title) {
      const { data, error } = await selectSingle(supabase.from("support_conversations").insert({
        user_id: userId,
        title: title.slice(0, 120),
      }));
      raiseIfError(error);
      return data;
    },

    async updateConversationTitle(userId, conversationId, title) {
      const query = supabase.from("support_conversations")
        .update({ title: title.slice(0, 120) })
        .eq("id", conversationId);
      const { error } = await scopeByNullableUser(query, userId);
      raiseIfError(error);
    },

    async listConversations(userId) {
      const query = supabase.from("support_conversations")
        .select("*");
      const { data, error } = await scopeByNullableUser(query, userId)
        .order("updated_at", { ascending: false });
      raiseIfError(error);
      return data;
    },

    async getConversation(userId, conversationId) {
      const query = supabase.from("support_conversations")
        .select("id")
        .eq("id", conversationId);
      const { data, error } = await scopeByNullableUser(query, userId)
        .maybeSingle();
      raiseIfError(error);
      return data;
    },

    async deleteConversation(userId, conversationId) {
      const query = scopeByNullableUser(
        supabase.from("support_conversations")
          .delete()
          .eq("id", conversationId),
        userId,
      );
      const { data, error } = await query.select("id").maybeSingle();
      raiseIfError(error);
      return Boolean(data);
    },

    async getMessages(userId, conversationId) {
      const query = supabase.from("support_conversations")
        .select("id")
        .eq("id", conversationId);
      const { data: conversation, error: conversationError } = await scopeByNullableUser(query, userId)
        .maybeSingle();
      raiseIfError(conversationError);
      if (!conversation) {
        return [];
      }

      const { data, error } = await supabase.from("support_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      raiseIfError(error);
      const messages = data ?? [];
      const chunkIds = [...new Set(messages.flatMap((message) => message.retrieved_chunk_ids ?? []))];
      if (chunkIds.length === 0) {
        return messages.map((message) => ({ ...message, sources: [] }));
      }

      const { data: chunks, error: chunksError } = await supabase.from("support_document_chunks")
        .select("id, support_documents(filename)")
        .in("id", chunkIds);
      raiseIfError(chunksError);
      const sourceByChunkId = new Map((chunks ?? []).map((chunk) => {
        const document = Array.isArray(chunk.support_documents)
          ? chunk.support_documents[0]
          : chunk.support_documents;
        return [chunk.id, { chunkId: chunk.id, filename: document?.filename ?? "Unknown document" }];
      }));

      return messages.map((message) => ({
        ...message,
        sources: (message.retrieved_chunk_ids ?? [])
          .map((chunkId) => sourceByChunkId.get(chunkId))
          .filter(Boolean),
      }));
    },

    async insertMessage({ conversationId, role, content, retrievedChunkIds = [] }) {
      const { data, error } = await selectSingle(supabase.from("support_messages").insert({
        conversation_id: conversationId,
        role,
        content,
        retrieved_chunk_ids: retrievedChunkIds,
      }));
      raiseIfError(error);
      const { error: conversationError } = await supabase.from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      raiseIfError(conversationError);
      return data;
    },
  };
}
