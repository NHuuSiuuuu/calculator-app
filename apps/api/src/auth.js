export function extractBearerToken(headers) {
  const value = headers?.get?.("authorization")
    ?? headers?.authorization
    ?? headers?.Authorization
    ?? "";
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createAuthService(supabase) {
  async function requireUser(request) {
    const token = extractBearerToken(request.headers);
    if (!token) {
      throw httpError("Missing bearer token", 401);
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw httpError("Invalid bearer token", 401);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      token,
    };
  }

  async function requireUserWithRole(request) {
    const user = await requireUser(request);
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? "Unable to load user role");
    }

    return { ...user, role: data?.role ?? "user" };
  }

  async function requireAdmin(request) {
    const user = await requireUserWithRole(request);

    if (user.role !== "admin") {
      throw httpError("Admin role required", 403);
    }

    return user;
  }

  return { requireUser, requireUserWithRole, requireAdmin };
}
