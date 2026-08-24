export function createNoContextAnswer() {
  return "Em không tìm thấy thông tin phù hợp trong tài liệu công ty đã upload, nên chưa thể trả lời chắc chắn câu hỏi này.";
}

export function buildGroundedPrompt(message, chunks) {
  const context = chunks.map((chunk, index) => (
    `Nguồn ${index + 1}: ${chunk.filename}\n${chunk.content}`
  )).join("\n\n---\n\n");

  return {
    system: [
      "You are an internal customer support assistant.",
      "Answer only from the uploaded company documents provided in the context.",
      "If the context is insufficient, say you cannot find the answer in the company documents.",
      "Keep the answer concise and practical.",
    ].join(" "),
    user: `Company context:\n${context}\n\nUser question:\n${message}`,
  };
}
