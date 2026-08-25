function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

export function createVercelHandler(createServer) {
  let server;

  return function handler(request, response) {
    try {
      server ??= createServer();
      server.emit("request", request, response);
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, {
        error: error.message ?? "Internal server error",
      });
    }
  };
}
