import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const appPath = path.join(__dirname, 'app.full.js');
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes('TOAST_META')) {
  app = app.replace(
    `function isProfileNotFoundError(error) {
  if (!error) return false;
  return error.code === 'PGRST116' || error.details?.includes('0 rows');
}`,
    `function isProfileNotFoundError(error) {
  if (!error) return false;
  return error.code === 'PGRST116' || String(error.details || '').includes('0 rows');
}

const TOAST_META = {
  success: {
    icon: 'check-circle',
    box: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: 'alert-circle',
    box: 'bg-red-50 border-red-200 text-red-900',
    iconColor: 'text-red-600',
  },
  info: {
    icon: 'info',
    box: 'bg-blue-50 border-blue-200 text-blue-900',
    iconColor: 'text-blue-600',
  },
};

const TOAST_DURATION_MS = 3000;`
  );

  app = app.replace(
    `      authBootstrapping: true,
      sessionSyncing: false,`,
    `      loading: true,
      toasts: [],
      _toastSeq: 0,
      isSidebarOpen: false,
      sessionSyncing: false,`
  );

  app = app.replaceAll('authBootstrapping', 'loading');

  app = app.replace(
    `    layout() {
      this.refreshIcons();
    },
  },`,
    `    layout() {
      this.refreshIcons();
    },
    toasts() {
      this.refreshIcons();
    },
  },`
  );

  app = app.replace(
    `    refreshIcons() {
      nextTick(() => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    },

    navigate(route) {`,
    `    refreshIcons() {
      nextTick(() => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    },

    showToast(message, type = 'success') {
      const safeType = TOAST_META[type] ? type : 'info';
      const id = ++this._toastSeq;
      this.toasts.push({ id, message, type: safeType });
      this.refreshIcons();
      setTimeout(() => this.dismissToast(id), TOAST_DURATION_MS);
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.refreshIcons();
    },

    toastBoxClass(type) {
      return (TOAST_META[type] || TOAST_META.info).box;
    },

    toastIconName(type) {
      return (TOAST_META[type] || TOAST_META.info).icon;
    },

    toastIconClass(type) {
      return (TOAST_META[type] || TOAST_META.info).iconColor;
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
      this.refreshIcons();
    },

    closeSidebar() {
      if (this.isSidebarOpen) {
        this.isSidebarOpen = false;
        this.refreshIcons();
      }
    },

    navigateTo(route) {
      this.navigate(route);
      this.closeSidebar();
    },

    navigate(route) {`
  );

  app = app.replace(
    `    async syncUserProfile() {
      this.profileError = null;

      if (!this.user?.id) {
        this.profile = null;
        return false;
      }

      const user = this.user;

      try {
        const { data: existing, error: selectError } = await window.supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (existing && !selectError) {
          this.profile = existing;
          return true;
        }

        const missing = !existing || isProfileNotFoundError(selectError);
        if (selectError && !missing) {
          throw selectError;
        }

        const insertPayload = buildProfileInsertPayload(user);

        const { data: created, error: insertError } = await window.supabaseClient
          .from('profiles')
          .insert(insertPayload)
          .select('*')
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: retry, error: retryErr } = await window.supabaseClient
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            if (retry && !retryErr) {
              this.profile = retry;
              return true;
            }
          }
          throw insertError;
        }

        this.profile = created;
        return true;
      } catch (err) {
        console.error('syncUserProfile:', err);
        this.profile = null;
        this.profileError =
          err.message ||
          'No se pudo crear tu perfil. Verifica las políticas RLS en Supabase e intenta de nuevo.';
        return false;
      }
    },`,
    `    async syncUserProfile({ silent = false } = {}) {
      this.profileError = null;

      if (!this.user?.id) {
        this.profile = null;
        return false;
      }

      const user = this.user;
      let wasCreated = false;

      try {
        const { data: existing, error: selectError } = await window.supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (existing && !selectError) {
          this.profile = existing;
          if (!silent) {
            this.showToast('Perfil sincronizado correctamente', 'success');
          }
          return true;
        }

        const missing = !existing || isProfileNotFoundError(selectError);
        if (selectError && !missing) {
          throw selectError;
        }

        const { data: created, error: insertError } = await window.supabaseClient
          .from('profiles')
          .insert(buildProfileInsertPayload(user))
          .select('*')
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: retry, error: retryErr } = await window.supabaseClient
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            if (retry && !retryErr) {
              this.profile = retry;
              if (!silent) {
                this.showToast('Perfil sincronizado correctamente', 'success');
              }
              return true;
            }
          }
          throw insertError;
        }

        this.profile = created;
        wasCreated = true;
        if (!silent) {
          this.showToast(
            wasCreated ? 'Perfil creado y sincronizado correctamente' : 'Perfil sincronizado correctamente',
            'success'
          );
        }
        return true;
      } catch (err) {
        console.error('syncUserProfile:', err);
        this.profile = null;
        this.profileError =
          err.message ||
          'No se pudo crear tu perfil. Verifica las políticas RLS en Supabase e intenta de nuevo.';
        if (!silent) {
          this.showToast(this.profileError, 'error');
        }
        return false;
      }
    },`
  );

  app = app.replace(
    `        await this.syncUserProfile();
        await this.loadFavoriteIds().catch(() => {});`,
    `        await this.syncUserProfile({ silent: event === 'TOKEN_REFRESHED' });
        await this.loadFavoriteIds().catch(() => {});`
  );

  app = app.replace(
    `      if (route === 'profile' && !this.profile) this.syncUserProfile();`,
    `      if (route === 'profile' && !this.profile) this.syncUserProfile({ silent: true });`
  );

  app = app.replace(
    `        if (error) throw error;
        this.authForm.password = '';
        this.navigate('dashboard');
      } catch (err) {
        this.authError = err.message || 'No se pudo iniciar sesión.';`,
    `        if (error) throw error;
        this.authForm.password = '';
        this.showToast('Sesión iniciada correctamente', 'success');
      } catch (err) {
        const msg = err.message || 'No se pudo iniciar sesión.';
        this.authError = msg;
        this.showToast(msg, 'error');`
  );

  app = app.replace(
    `        if (data.session) {
          this.authSuccess = 'Cuenta creada correctamente.';
          this.navigate('dashboard');
        } else {
          this.authSuccess = 'Revisa tu correo para confirmar la cuenta.';
        }`,
    `        if (data.session) {
          this.authSuccess = 'Cuenta creada correctamente.';
          this.showToast('Cuenta creada correctamente', 'success');
        } else {
          this.authSuccess = 'Revisa tu correo para confirmar la cuenta.';
          this.showToast('Revisa tu correo para confirmar la cuenta', 'info');
        }`
  );

  app = app.replace(
    `      } catch (err) {
        this.authError = err.message || 'No se pudo registrar la cuenta.';
      } finally {
        this.authSubmitting = false;
        this.refreshIcons();
      }
    },

    async signOut() {`,
    `      } catch (err) {
        const msg = err.message || 'No se pudo registrar la cuenta.';
        this.authError = msg;
        this.showToast(msg, 'error');
      } finally {
        this.authSubmitting = false;
        this.refreshIcons();
      }
    },

    async signOut() {`
  );

  app = app.replace(
    `      await window.supabaseClient.auth.signOut();
      this.authMode = 'login';
      this.authForm.password = '';
      this.navigate('auth');`,
    `      await window.supabaseClient.auth.signOut();
      this.authMode = 'login';
      this.authForm.password = '';
      this.closeSidebar();
      this.showToast('Sesión cerrada', 'info');
      this.navigate('auth');`
  );

  app = app.replace(
    `        this.formMessage = 'Receta guardada.';
        this.formMessageType = 'success';
        this.resetForm();`,
    `        this.formMessage = 'Receta guardada.';
        this.formMessageType = 'success';
        this.showToast('Receta guardada correctamente', 'success');
        this.resetForm();`
  );

  app = app.replace(
    `        this.formMessage = err.message || 'Error al guardar.';
        this.formMessageType = 'error';`,
    `        const msg = err.message || 'Error al guardar.';
        this.formMessage = msg;
        this.formMessageType = 'error';
        this.showToast(msg, 'error');`
  );

  fs.writeFileSync(appPath, app, 'utf8');
  console.log('Patched app.full.js');
}

// --- index.full.html ---
const indexPath = path.join(__dirname, 'index.full.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('toast-container')) {
  html = html.replace(
    `    <div v-if="layout === 'boot'" class="min-h-screen flex items-center justify-center bg-slate-50">`,
    `    <!-- Toasts globales -->
    <div id="toast-container" aria-live="polite" aria-atomic="true"
      class="fixed bottom-5 right-5 z-[60] space-y-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      <div v-for="t in toasts" :key="t.id"
        class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-in fade-in slide-in-from-bottom-2"
        :class="toastBoxClass(t.type)">
        <i :data-lucide="toastIconName(t.type)" class="w-5 h-5 shrink-0 mt-0.5" :class="toastIconClass(t.type)"></i>
        <p class="text-sm font-medium flex-1 leading-snug">{{ t.message }}</p>
        <button type="button" @click="dismissToast(t.id)" class="shrink-0 opacity-60 hover:opacity-100 p-0.5" aria-label="Cerrar">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    </div>

    <div v-if="layout === 'boot'" class="min-h-screen flex items-center justify-center bg-slate-50">`
  );

  html = html.replace(
    `    <!-- LAYOUT DASHBOARD: /#/dashboard, /#/recipes, … -->
    <div v-else class="flex h-screen overflow-hidden bg-slate-50">
      <aside class="w-64 shrink-0 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div class="p-5 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <i data-lucide="utensils-crossed" class="w-5 h-5 text-amber-400"></i>
            </div>
            <div>
              <p class="font-semibold text-white text-sm leading-tight">Kitchen App</p>
              <p class="text-xs text-slate-500">Panel principal</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto p-3 space-y-0.5">
          <button v-for="item in navItems" :key="item.route" type="button"
            :class="navLinkClass(item.route)" @click="navigate(item.route)">
            <i :data-lucide="item.icon" class="w-5 h-5 shrink-0"></i>
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="p-4 border-t border-slate-800">
          <p class="text-xs text-slate-500 truncate mb-1">{{ userEmail }}</p>
          <p v-if="profile" class="text-sm text-slate-300 truncate mb-3">@{{ profile.username }}</p>
          <button type="button" @click="signOut"
            class="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 py-2 rounded-lg hover:bg-slate-800 transition">
            <i data-lucide="log-out" class="w-4 h-4"></i> Salir
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header class="shrink-0 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-800">{{ pageTitle }}</h2>
          <span v-if="sessionSyncing" class="text-xs text-slate-400 flex items-center gap-1">
            <i data-lucide="refresh-cw" class="w-3 h-3 animate-spin"></i> Sincronizando
          </span>
        </header>

        <main class="flex-1 overflow-y-auto p-6 md:p-8">`,
    `    <!-- LAYOUT DASHBOARD: /#/dashboard, /#/recipes, … -->
    <div v-else class="flex h-screen overflow-hidden bg-slate-50">
      <div v-if="isSidebarOpen" @click="closeSidebar"
        class="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm" aria-hidden="true"></div>

      <aside
        class="fixed lg:static inset-y-0 left-0 z-50 w-64 max-w-[85vw] shrink-0 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
        :aria-hidden="!isSidebarOpen && 'true'">
        <div class="p-5 border-b border-slate-800 flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
              <i data-lucide="utensils-crossed" class="w-5 h-5 text-amber-400"></i>
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-white text-sm leading-tight truncate">Kitchen App</p>
              <p class="text-xs text-slate-500">Panel principal</p>
            </div>
          </div>
          <button type="button" @click="closeSidebar" class="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Cerrar menú">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto p-3 space-y-0.5">
          <button v-for="item in navItems" :key="item.route" type="button"
            :class="navLinkClass(item.route)" @click="navigateTo(item.route)">
            <i :data-lucide="item.icon" class="w-5 h-5 shrink-0"></i>
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="p-4 border-t border-slate-800">
          <p class="text-xs text-slate-500 truncate mb-1">{{ userEmail }}</p>
          <p v-if="profile" class="text-sm text-slate-300 truncate mb-3">@{{ profile.username }}</p>
          <button type="button" @click="signOut"
            class="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 py-2 rounded-lg hover:bg-slate-800 transition">
            <i data-lucide="log-out" class="w-4 h-4"></i> Salir
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        <header class="shrink-0 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center gap-3">
          <button type="button" @click="toggleSidebar"
            class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Abrir menú">
            <i data-lucide="menu" class="w-5 h-5"></i>
          </button>
          <h2 class="text-base sm:text-lg font-semibold text-slate-800 truncate flex-1">{{ pageTitle }}</h2>
          <span v-if="sessionSyncing" class="text-xs text-slate-400 flex items-center gap-1 shrink-0">
            <i data-lucide="refresh-cw" class="w-3 h-3 animate-spin"></i>
            <span class="hidden sm:inline">Sincronizando</span>
          </span>
        </header>

        <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">`
  );

  html = html.replace(
    `    <div v-if="layout === 'boot'" class="min-h-screen flex items-center justify-center bg-slate-50">`,
    `    <div v-if="layout === 'boot'" class="min-h-screen flex items-center justify-center bg-slate-50">`
  );

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Patched index.full.html');
}

fs.writeFileSync(path.join(root, 'app.js'), fs.readFileSync(appPath, 'utf8'), 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), fs.readFileSync(indexPath, 'utf8'), 'utf8');
console.log('Deployed app.js + index.html (UTF-8)');
