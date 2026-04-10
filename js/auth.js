const supabase = window.RunwayDB.supabase;

// Reload on session expiry
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') window.location.reload();
});

window.RunwayAuth = {
  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this._showApp();
      return;
    }
    return new Promise((resolve) => this._showLogin(resolve));
  },

  _showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
  },

  _showLogin(onSuccess) {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const errorEl = document.getElementById('login-error');
      const btn = document.getElementById('login-btn');

      btn.disabled = true;
      btn.textContent = 'Signing in\u2026';
      errorEl.textContent = '';

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        errorEl.textContent = error.message;
        btn.disabled = false;
        btn.textContent = 'Sign In';
        return;
      }

      this._showApp();
      onSuccess();
    });
  },

  async signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }
};
