import http from "node:http";

import { handleChatRequest } from "./routes/chat.js";
import { handleDocumentUpload } from "./routes/documents.js";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const body = await readBody(request);
  if (body.length === 0) {
    return {};
  }

  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function headerParameters(value) {
  const [type, ...parameters] = String(value ?? "").split(";");
  return {
    type: type.trim().toLowerCase(),
    parameters: Object.fromEntries(parameters.map((parameter) => {
      const separator = parameter.indexOf("=");
      if (separator === -1) return [parameter.trim().toLowerCase(), ""];
      return [
        parameter.slice(0, separator).trim().toLowerCase(),
        parameter.slice(separator + 1).trim().replace(/^"|"$/g, ""),
      ];
    })),
  };
}

async function parseMultipartFile(request) {
  const { type, parameters } = headerParameters(request.headers["content-type"]);
  const boundary = parameters.boundary;
  if (type !== "multipart/form-data" || !boundary) {
    const error = new Error("Expected multipart/form-data with a file field");
    error.statusCode = 400;
    throw error;
  }

  const delimiter = `--${boundary}`;
  const parts = (await readBody(request)).toString("utf8").split(delimiter);
  for (const part of parts) {
    const normalizedPart = part.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    if (!normalizedPart || normalizedPart === "--") continue;

    const separator = normalizedPart.indexOf("\r\n\r\n");
    if (separator === -1) continue;

    const rawHeaders = normalizedPart.slice(0, separator);
    const content = normalizedPart.slice(separator + 4).replace(/\r\n$/, "");
    const headers = Object.fromEntries(rawHeaders.split("\r\n").map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
    }));
    const disposition = headerParameters(headers["content-disposition"]);

    if (disposition.parameters.name === "file" && disposition.parameters.filename) {
      return {
        filename: disposition.parameters.filename,
        contentType: headerParameters(headers["content-type"] ?? "text/plain").type,
        text: content,
      };
    }
  }

  const error = new Error("A file field is required");
  error.statusCode = 400;
  throw error;
}

function routeNotFound() {
  const error = new Error("Not found");
  error.statusCode = 404;
  return error;
}

function conversationNotFound() {
  const error = new Error("Conversation not found");
  error.statusCode = 404;
  return error;
}

function documentNotFound() {
  const error = new Error("Document not found");
  error.statusCode = 404;
  return error;
}

export function createApiServer({ authService, repository, openAiClient }) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, corsHeaders());
        response.end();
        return;
      }

      const url = new URL(request.url, "http://localhost");
      if (request.method === "POST" && url.pathname === "/api/documents/upload") {
        const user = await authService.requireUser(request);
        const file = await parseMultipartFile(request);
        sendJson(response, 201, await handleDocumentUpload({ user, file, repository, openAiClient }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/documents") {
        const user = await authService.requireUser(request);
        sendJson(response, 200, { documents: await repository.listDocuments(user.id) });
        return;
      }

      const documentMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
      if (request.method === "DELETE" && documentMatch) {
        const user = await authService.requireUser(request);
        const deleted = await repository.deleteDocument(user.id, decodeURIComponent(documentMatch[1]));
        if (!deleted) {
          throw documentNotFound();
        }
        sendJson(response, 200, { deleted: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        const user = await authService.requireUserWithRole(request);
        sendJson(response, 200, {
          user,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const user = await authService.requireUser(request);
        const body = await readJsonBody(request);
        sendJson(response, 200, await handleChatRequest({ user, body, repository, openAiClient }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/conversations") {
        const user = await authService.requireUser(request);
        sendJson(response, 200, { conversations: await repository.listConversations(user.id) });
        return;
      }

      const messagesMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (request.method === "GET" && messagesMatch) {
        const user = await authService.requireUser(request);
        sendJson(response, 200, {
          messages: await repository.getMessages(user.id, decodeURIComponent(messagesMatch[1])),
        });
        return;
      }

      const conversationMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/);
      if (request.method === "DELETE" && conversationMatch) {
        const user = await authService.requireUser(request);
        const deleted = await repository.deleteConversation(user.id, decodeURIComponent(conversationMatch[1]));
        if (!deleted) {
          throw conversationNotFound();
        }
        sendJson(response, 200, { deleted: true });
        return;
      }

      throw routeNotFound();
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      sendJson(response, statusCode, {
        error: statusCode === 500 && !error.expose ? "Internal server error" : error.message ?? "Internal server error",
      });
    }
  });
}
