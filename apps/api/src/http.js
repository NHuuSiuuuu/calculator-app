import http from "node:http";

import { handleChatRequest } from "./routes/chat.js";
import { handleDocumentUpload } from "./routes/documents.js";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const DEMO_SUPPORT_USER = { id: null, email: null, role: "admin" };

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
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
        const file = await parseMultipartFile(request);
        sendJson(response, 201, await handleDocumentUpload({ user: DEMO_SUPPORT_USER, file, repository, openAiClient }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/documents") {
        sendJson(response, 200, { documents: await repository.listDocuments() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        sendJson(response, 200, {
          user: DEMO_SUPPORT_USER,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await handleChatRequest({ user: DEMO_SUPPORT_USER, body, repository, openAiClient }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/conversations") {
        sendJson(response, 200, { conversations: await repository.listConversations(DEMO_SUPPORT_USER.id) });
        return;
      }

      const messagesMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (request.method === "GET" && messagesMatch) {
        sendJson(response, 200, {
          messages: await repository.getMessages(DEMO_SUPPORT_USER.id, decodeURIComponent(messagesMatch[1])),
        });
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
