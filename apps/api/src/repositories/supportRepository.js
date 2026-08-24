function raiseIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase request failed");
  }
}

function selectSingle(query) {
  return query.select("*").single();
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
      return data.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        filename: row.filename,
        similarity: row.similarity,
      }));
    },

    async createConversation(userId, title) {
      const { data, error } = await selectSingle(supabase.from("support_conversations").insert({
        user_id: userId,
        title: title.slice(0, 120),
      }));
      raiseIfError(error);
      return data;
    },

    async listConversations(userId) {
      const { data, error } = await supabase.from("support_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      raiseIfError(error);
      return data;
    },

    async getConversation(userId, conversationId) {
      const { data, error } = await supabase.from("support_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      raiseIfError(error);
      return data;
    },

    async getMessages(userId, conversationId) {
      const { data: conversation, error: conversationError } = await supabase.from("support_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single();
      raiseIfError(conversationError);
      if (!conversation) {
        return [];
      }

      const { data, error } = await supabase.from("support_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      raiseIfError(error);
      return data;
    },

    async insertMessage({ conversationId, role, content, retrievedChunkIds = [] }) {
      const { data, error } = await selectSingle(supabase.from("support_messages").insert({
        conversation_id: conversationId,
        role,
        content,
        retrieved_chunk_ids: retrievedChunkIds,
      }));
      raiseIfError(error);
      return data;
    },
  };
}
