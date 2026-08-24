export function normalizeAuthSession(session) {
  if (!session?.access_token || !session?.user) {
    return null;
  }

  return {
    accessToken: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase auth request failed.");
  }
}

export function createAuthApi(supabase) {
  return {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      throwIfError(error);
    },
  };
}
