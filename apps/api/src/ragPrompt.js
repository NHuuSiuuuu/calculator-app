export function createNoContextAnswer() {
  return "Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có.";
}

export function createEmptyKnowledgeBaseAnswer() {
  return "Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có.";
}

export function createGreetingAnswer() {
  return "Xin chào! Bạn có thể tải tài liệu lên rồi hỏi tôi tóm tắt hoặc tra cứu nội dung trong tài liệu đó.";
}

export function isShortGreeting(message) {
  return /^(hi|hello|hey|chào|xin chào|chao|alo|a lô)$/i.test(message.trim());
}

export function buildGroundedPrompt(message, chunks) {
  const context = chunks.map((chunk, index) => (
    `Nguồn ${index + 1}: ${chunk.filename}\n${chunk.content}`
  )).join("\n\n---\n\n");

  return {
    system: [
      "Bạn là trợ lý AI đọc tài liệu cá nhân.",
      "",
      "Nhiệm vụ của bạn là trả lời câu hỏi, tóm tắt, trích ý chính,",
      "và giải thích nội dung dựa trên tài liệu người dùng đã tải lên.",
      "",
      "QUY TẮC:",
      "",
      "1. Chỉ sử dụng thông tin được cung cấp trong phần CONTEXT để trả lời.",
      "",
      "2. Không tự bịa thông tin hoặc sử dụng kiến thức bên ngoài nếu thông tin",
      "không có trong CONTEXT.",
      "",
      "3. Nếu CONTEXT không chứa thông tin đủ để trả lời, hãy nói rõ:",
      "\"Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có.\"",
      "",
      "4. Nếu câu hỏi của người dùng mơ hồ, hãy yêu cầu họ cung cấp thêm thông tin.",
      "",
      "5. Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu và thân thiện.",
      "",
      "6. Nếu người dùng yêu cầu tóm tắt, hãy nêu ý chính ngắn gọn, có cấu trúc.",
      "",
      "7. Không nói rằng bạn đã được \"huấn luyện\" với tài liệu.",
      "Hãy trả lời dựa trên thông tin được cung cấp.",
      "",
      "CÁCH TRẢ LỜI:",
      "",
      "- Trả lời ngắn gọn, dễ hiểu, đi thẳng vào ý chính.",
      "- Tối đa 4 ý chính. Nếu có nhiều thông tin, chỉ chọn phần liên quan nhất với câu hỏi.",
      "- Dùng Markdown để format: mỗi ý nằm trên một dòng riêng hoặc một gạch đầu dòng ngắn.",
      "- in đậm các cụm quan trọng bằng **...**, ví dụ **Nghỉ lễ**, **Nghỉ phép năm**.",
      "- Với tóm tắt, quy định, quy trình hoặc danh sách ý chính: dùng gạch đầu dòng ngắn, không viết thành đoạn dài.",
      "- Không chép lại nguyên văn CONTEXT dài. Không lặp lại thông tin không cần thiết.",
    ].join("\n"),
    user: `CONTEXT:\n${context}\n\nCÂU HỎI CỦA NGƯỜI DÙNG:\n${message}`,
  };
}
