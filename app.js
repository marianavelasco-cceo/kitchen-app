const { createApp, nextTick } = Vue;

const CATEGORIES = ['Entrada', 'Plato principal', 'Postre', 'Bebida', 'Snack', 'Ensalada'];
const CUISINE_TYPES = ['Mexicana', 'Italiana', 'Asiática', 'Mediterránea', 'Americana', 'Francesa', 'Otra'];

const RECIPE_CARD = `
  id, title, description, cooking_time, category, cuisine_type,
  image_url, calories, protein, created_at,
  recipe_ingredients ( name, amount, unit )
`;

const RECIPE_CARD_INNER = `
  id, title, description, cooking_time, category, cuisine_type,
  image_url, calories, protein, created_at,
  recipe_ingredients!inner ( name, amount, unit )
`;

const PUBLIC_ROUTES = new Set(['auth']);

const DASHBOARD_ROUTES = new Set([
  'dashboard', 'profile', 'my-recipes', 'recipes', 'explore', 'favorites',
  'nutrition', 'shopping', 'collections', 'share',
]);

const RECIPE_DETAIL = `
  id, title, description, cooking_time, category, cuisine_type,
  image_url, calories, protein, created_at, user_id,
  recipe_ingredients ( id, name, amount, unit ),
  recipe_steps ( id, step_number, instruction )
`;

/** Listados con hijos anidados (PostgREST / Supabase). */
const RECIPES_FULL_SELECT = '*, recipe_ingredients(*), recipe_steps(*)';

const NAV_ITEMS = [
  { route: 'dashboard', label: 'Inicio', icon: 'layout-dashboard', emoji: '🏠' },
  { route: 'profile', label: 'Mi perfil', icon: 'user', emoji: '👤' },
  { route: 'my-recipes', label: 'Mis recetas', icon: 'book-open', emoji: '📖' },
  { route: 'recipes', label: 'Nueva receta', icon: 'plus-circle', emoji: '➕' },
  { route: 'explore', label: 'Explorar', icon: 'search', emoji: '🔍' },
  { route: 'favorites', label: 'Favoritos', icon: 'heart', emoji: '❤️' },
  { route: 'nutrition', label: 'Nutrición', icon: 'bar-chart-3', emoji: '📊' },
  { route: 'shopping', label: 'Compras', icon: 'shopping-cart', emoji: '🛒' },
  { route: 'collections', label: 'Colecciones', icon: 'library', emoji: '📚' },
  { route: 'share', label: 'Reseñas', icon: 'star', emoji: '⭐' },
];

const TOAST_EMOJI = { success: '✅', error: '❌', info: 'ℹ️' };

function shoppingStorageKey(userId) {
  return `kitchen-shopping-${userId || 'guest'}`;
}

function normalizeIngredientKey(name, unit) {
  return `${String(name || '').trim().toLowerCase()}::${String(unit || '').trim().toLowerCase()}`;
}

function consolidateIngredientsFromRecipes(recipes) {
  const map = new Map();
  for (const recipe of recipes) {
    const ings = recipe.recipe_ingredients || [];
    for (const ing of ings) {
      const key = normalizeIngredientKey(ing.name, ing.unit);
      const prev = map.get(key);
      const amount = Number(ing.amount) || 0;
      if (prev) {
        prev.amount += amount;
        if (!prev.recipeTitles.includes(recipe.title)) prev.recipeTitles.push(recipe.title);
      } else {
        map.set(key, {
          name: ing.name,
          unit: ing.unit,
          amount,
          recipeTitles: [recipe.title],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function parseRouteFromHash() {
  const raw = (window.location.hash || '').replace(/^#/, '').trim();
  const segment = raw.replace(/^\//, '').split('/')[0] || 'auth';
  if (PUBLIC_ROUTES.has(segment)) return segment;
  if (DASHBOARD_ROUTES.has(segment)) return segment;
  return 'auth';
}

/** Payload de inserción automática en profiles (T1 — RLS: auth.uid() = id). */
function buildProfileInsertPayload(user) {
  const email = user.email || '';
  return {
    id: user.id,
    username: email.split('@')[0] || `user_${user.id.slice(0, 8)}`,
    full_name: user.user_metadata?.full_name || 'Usuario Nuevo',
    avatar_url: null,
  };
}

/** Mensaje legible para errores RLS / Postgres en sincronización de profiles. */
function formatProfileSyncError(err) {
  const code = String(err?.code ?? '');
  const msg = err?.message || '';
  if (code === '42501' || msg.includes('42501')) {
    return 'Permiso denegado (42501): verifica políticas RLS de SELECT e INSERT en profiles para auth.uid() = id.';
  }
  if (code === 'PGRST116') {
    return 'Perfil no encontrado. Se intentará crear uno nuevo en el próximo inicio de sesión.';
  }
  return msg || 'No se pudo sincronizar tu perfil. Revisa Supabase e intenta de nuevo.';
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

const TOAST_DURATION_MS = 3000;

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getHashQueryParam(name) {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  if (!query) return null;
  return new URLSearchParams(query).get(name);
}

function collectionsLocalKey(userId) {
  return `kitchen-collections-local-${userId || 'guest'}`;
}

createApp({
  data() {
    return {
      navItems: NAV_ITEMS,
      categories: CATEGORIES,
      _iconTimer: null,
      _routeToken: 0,
      cuisineTypes: CUISINE_TYPES,
      session: null,
      user: null,
      profile: null,
      profileError: null,
      loading: true,
      toasts: [],
      _toastSeq: 0,
      isSidebarOpen: false,
      sessionSyncing: false,
      authSubmitting: false,
      authError: '',
      authSuccess: '',
      authMode: 'login',
      authForm: { email: '', password: '', username: '', full_name: '' },
      currentRoute: 'auth',
      favoriteIds: [],
      favoritesList: [],
      favoritesLoading: false,
      nutritionRecipes: [],
      nutritionLoading: false,
      nutritionFilter: { category: '' },
      form: {
        title: '',
        description: '',
        cooking_time: null,
        category: '',
        cuisine_type: '',
        image_url: '',
        calories: 0,
        protein: 0,
      },
      ingredients: [{ name: '', amount: null, unit: '' }],
      steps: [{ instruction: '' }],
      formLoading: false,
      formMessage: '',
      formMessageType: 'error',
      search: { title: '', ingredient: '', category: '', cuisine_type: '' },
      recipes: [],
      recipesLoading: false,
      results: [],
      searchLoading: false,
      searchMessage: '',
      hasSearched: false,
      myRecipesList: [],
      myRecipesLoading: false,
      editingRecipeId: null,
      shoppingSelectedIds: [],
      shoppingPickList: [],
      shoppingPickLoading: false,
      collectionsList: [],
      collectionsLoading: false,
      collectionForm: { name: '', description: '' },
      collectionSaving: false,
      selectedCollectionId: null,
      reviewsRecipeId: '',
      reviewsList: [],
      reviewsLoading: false,
      reviewForm: { recipe_id: '', rating: 5, comment: '' },
      reviewSubmitting: false,
      recipeDetail: null,
      recipeDetailLoading: false,
      detailReviews: [],
      detailReviewsLoading: false,
      detailReviewForm: { rating: 5, comment: '' },
      detailReviewHover: 0,
      pendingDeleteRecipe: null,
      deleteInProgress: false,
      collectionPickerRecipeId: '',
      collectionsLocalMap: {},
      _authSubscription: null,
      _onHashChange: null,
    };
  },
  computed: {
    isAuthenticated() {
      return !!this.session && !!this.user;
    },
    currentUserId() {
      return this.user?.id ?? null;
    },
    userEmail() {
      return this.user?.email ?? '';
    },
    layout() {
      if (this.loading) return 'boot';
      if (!this.isAuthenticated) return 'auth';
      return this.currentRoute === 'auth' ? 'auth' : 'dashboard';
    },
    pageTitle() {
      const map = {
        dashboard: 'Panel',
        profile: 'Mi perfil',
        'my-recipes': 'Mis recetas',
        recipes: 'Nueva / editar receta',
        explore: 'Explorar',
        favorites: 'Favoritos',
        nutrition: 'Nutrición',
        shopping: 'Compras',
        collections: 'Colecciones',
        share: 'Reseñas',
        auth: 'Acceso',
      };
      return map[this.currentRoute] || 'Kitchen App';
    },
    isEditingRecipe() {
      return !!this.editingRecipeId;
    },
    consolidatedShoppingList() {
      const selected = this.shoppingPickList.filter((r) =>
        this.shoppingSelectedIds.includes(r.id)
      );
      return consolidateIngredientsFromRecipes(selected);
    },
    exploreList() {
      if (this.currentRoute === 'explore' && this.hasSearched) {
        return this.results;
      }
      return this.recipes;
    },
    formImagePreviewValid() {
      return isValidImageUrl(this.form.image_url);
    },
    detailReviewStars() {
      return this.detailReviewHover || this.detailReviewForm.rating;
    },
    sortedDetailSteps() {
      const steps = this.recipeDetail?.recipe_steps || [];
      return [...steps].sort((a, b) => (a.step_number || 0) - (b.step_number || 0));
    },
    nutritionStats() {
      const list = this.nutritionRecipes;
      if (!list.length) return { count: 0, totalCalories: 0, totalProtein: 0 };
      return {
        count: list.length,
        totalCalories: list.reduce((s, r) => s + (Number(r.calories) || 0), 0),
        totalProtein: list.reduce((s, r) => s + (Number(r.protein) || 0), 0),
      };
    },
  },
  watch: {
    currentRoute(route) {
      this.onRouteEntered(route);
      this.scheduleIconRefresh();
    },
    toasts() {
      this.scheduleIconRefresh();
    },
  },
  async mounted() {
    this._onHashChange = () => this.syncRouteFromHash();
    window.addEventListener('hashchange', this._onHashChange);
    this.syncRouteFromHash();
    await this.initAuth();
    this.syncRouteFromHash();
    this.scheduleIconRefresh();
  },
  unmounted() {
    window.removeEventListener('hashchange', this._onHashChange);
    this._authSubscription?.unsubscribe();
  },
  methods: {
    scheduleIconRefresh() {
      if (this._iconTimer) cancelAnimationFrame(this._iconTimer);
      this._iconTimer = requestAnimationFrame(() => {
        nextTick(() => this.refreshIcons());
      });
    },

    refreshIcons() {
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {
        console.warn('Lucide:', e);
      }
    },

    finishLoading() {
      this.loading = false;
      this.sessionSyncing = false;
    },

    showToast(message, type = 'success') {
      const safeType = TOAST_META[type] ? type : 'info';
      const id = ++this._toastSeq;
      this.toasts.push({ id, message, type: safeType });
      this.scheduleIconRefresh();
      setTimeout(() => this.dismissToast(id), TOAST_DURATION_MS);
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.scheduleIconRefresh();
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

    toastEmoji(type) {
      return TOAST_EMOJI[type] || TOAST_EMOJI.info;
    },

    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
      this.scheduleIconRefresh();
    },

    closeSidebar() {
      if (this.isSidebarOpen) {
        this.isSidebarOpen = false;
        this.scheduleIconRefresh();
      }
    },

    navigateTo(route) {
      this.navigate(route);
      this.closeSidebar();
    },

    navigate(route) {
      const target = route.startsWith('/') ? route : `/${route}`;
      if (window.location.hash !== `#${target}`) {
        window.location.hash = target;
      } else {
        this.syncRouteFromHash();
      }
    },

    syncRouteFromHash() {
      let route = parseRouteFromHash();

      if (!this.loading) {
        if (!this.isAuthenticated && route !== 'auth') route = 'auth';
        if (this.isAuthenticated && route === 'auth') route = 'dashboard';
      }

      if (this.currentRoute !== route) this.currentRoute = route;

      const expected = `#/${route}`;
      if (window.location.hash !== expected && !this.loading) {
        window.location.replace(`${window.location.pathname}${expected}`);
      }
    },

    async initAuth() {
      this.loading = true;
      try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) console.error('getSession:', error.message);
        await this.applySession(session, 'INITIAL');

        if (!this._authSubscription) {
          const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange(
            async (event, session) => {
              this.sessionSyncing = true;
              try {
                await this.applySession(session, event);
              } catch (e) {
                console.error('auth state:', e);
                this.profileError =
                  e?.message || 'Error de sesión. Puedes reintentar iniciando sesión de nuevo.';
              } finally {
                this.sessionSyncing = false;
                this.loading = false;
                this.syncRouteFromHash();
                this.scheduleIconRefresh();
              }
            }
          );
          this._authSubscription = subscription;
        }
      } catch (e) {
        console.error('initAuth:', e);
      } finally {
        this.loading = false;
        this.syncRouteFromHash();
        if (this.isAuthenticated && this.currentRoute !== 'auth') {
          await this.onRouteEntered(this.currentRoute);
        }
        this.scheduleIconRefresh();
      }
    },

    async applySession(session, event = null) {
      this.session = session;
      this.user = session?.user ?? null;

      if (this.user) {
        await this.syncUserProfile({ silent: event === 'TOKEN_REFRESHED' });
        await this.loadFavoriteIds().catch(() => {});
        this.redirectAfterAuth(event);
      } else {
        this.profile = null;
        this.profileError = null;
        this.favoriteIds = [];
        this.favoritesList = [];
        this.clearSensitiveState();
        if (event === 'SIGNED_OUT' || !session) this.navigate('auth');
      }
    },

    /**
     * T1: maybeSingle() evita PGRST116 si no hay fila → INSERT si data es null.
     * Siempre destraba loading/sessionSyncing en finally.
     */
    async syncUserProfile({ silent = false } = {}) {
      this.profileError = null;

      if (!this.user?.id) {
        this.profile = null;
        this.loading = false;
        this.sessionSyncing = false;
        return false;
      }

      const user = this.user;

      try {
        const { data: existing, error: selectError } = await window.supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
          this.profile = existing;
          if (!silent) {
            this.showToast('Perfil sincronizado correctamente', 'success');
          }
          return true;
        }

        const { data: created, error: insertError } = await window.supabaseClient
          .from('profiles')
          .insert(buildProfileInsertPayload(user))
          .select('*')
          .maybeSingle();

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: retry, error: retryErr } = await window.supabaseClient
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            if (retry && !retryErr) {
              this.profile = retry;
              if (!silent) {
                this.showToast('Perfil sincronizado correctamente', 'success');
              }
              return true;
            }
            if (retryErr) throw retryErr;
          }
          throw insertError;
        }

        if (!created) {
          throw new Error('El insert no devolvió datos del perfil.');
        }

        this.profile = created;
        if (!silent) {
          this.showToast('Perfil creado y sincronizado correctamente', 'success');
        }
        return true;
      } catch (err) {
        console.error('syncUserProfile:', err);
        this.profile = null;
        this.profileError = formatProfileSyncError(err);
        if (!silent) {
          this.showToast(this.profileError, 'error');
        }
        return false;
      } finally {
        this.loading = false;
        this.sessionSyncing = false;
      }
    },

    async retrySyncProfile() {
      this.sessionSyncing = true;
      const ok = await this.syncUserProfile();
      this.sessionSyncing = false;
      this.scheduleIconRefresh();
      if (ok) this.navigate('dashboard');
    },

    redirectAfterAuth(event) {
      const authEvents = [
        'SIGNED_IN',
        'INITIAL_SESSION',
        'TOKEN_REFRESHED',
        'INITIAL',
        'USER_UPDATED',
      ];
      if (!authEvents.includes(event)) return;

      const route = parseRouteFromHash();
      const hashEmpty = !window.location.hash || window.location.hash === '#';
      if (route === 'auth' || hashEmpty) {
        this.navigate('dashboard');
      }
    },

    async onRouteEntered(route) {
      if (!this.isAuthenticated) return;
      const token = ++this._routeToken;
      try {
        if (route === 'dashboard') {
          await this.fetchRecipes({ limit: 24 });
        } else if (route === 'explore') {
          await this.fetchRecipes({ assignToResults: true });
          await this.maybeOpenRecipeFromHash();
        } else if (route === 'favorites') await this.loadFavorites();
        else if (route === 'my-recipes') {
          await this.fetchRecipes({ onlyMine: true, syncMyRecipesList: true });
        }
        else if (route === 'nutrition') await this.loadNutrition();
        else if (route === 'shopping') await this.loadShoppingPickList();
        else if (route === 'collections') {
          this.hydrateCollectionsLocal();
          if (!this.myRecipesList.length) await this.loadMyRecipes();
          await this.loadCollections();
        } else if (route === 'share') await this.loadReviewsForRecipe();
        else if (route === 'profile' && !this.profile) await this.syncUserProfile({ silent: true });
      } catch (e) {
        console.error('route load:', route, e);
        this.showToast(e?.message || 'Error al cargar datos', 'error');
      } finally {
        if (token === this._routeToken) {
          this.finishLoading();
          this.scheduleIconRefresh();
        }
      }
    },

    /** ID de usuario desde JWT verificado (no caché obsoleto de sesión). */
    async getVerifiedUserId() {
      if (!window.supabaseClient) return null;
      try {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        if (error) {
          console.warn('getUser:', error.message);
          return this.user?.id ?? null;
        }
        if (user?.id) {
          if (!this.user || this.user.id !== user.id) {
            this.user = user;
          }
          return user.id;
        }
      } catch (e) {
        console.warn('getVerifiedUserId:', e);
      }
      return this.user?.id ?? null;
    },

    /**
     * Carga recetas desde Supabase con ingredientes y pasos anidados.
     * Sin filtro user_id salvo onlyMine (vista «Mis recetas»).
     * @param {{ limit?: number, assignToResults?: boolean, onlyMine?: boolean, syncMyRecipesList?: boolean }} opts
     */
    async fetchRecipes(opts = {}) {
      const {
        limit,
        assignToResults = false,
        onlyMine = false,
        syncMyRecipesList = false,
      } = opts;

      if (!window.supabaseClient) {
        this.recipes = [];
        if (syncMyRecipesList) this.myRecipesList = [];
        if (assignToResults) this.results = [];
        this.showToast('Cliente Supabase no configurado (supabase-config.js)', 'error');
        this.finishLoading();
        return [];
      }

      this.recipesLoading = true;
      if (onlyMine || syncMyRecipesList) this.myRecipesLoading = true;

      try {
        await window.supabaseClient.auth.getSession();

        let query = window.supabaseClient
          .from('recipes')
          .select(RECIPES_FULL_SELECT)
          .order('created_at', { ascending: false });

        if (onlyMine) {
          const userId = await this.getVerifiedUserId();
          if (!userId) {
            this.recipes = [];
            if (syncMyRecipesList) this.myRecipesList = [];
            if (assignToResults) this.results = [];
            this.showToast('Inicia sesión para ver tus recetas', 'error');
            return [];
          }
          query = query.eq('user_id', userId);
        }

        if (limit && Number(limit) > 0) {
          query = query.limit(Number(limit));
        }

        const { data, error } = await query;
        if (error) throw error;

        const list = Array.isArray(data) ? data : [];
        this.recipes = list;
        if (syncMyRecipesList || onlyMine) {
          this.myRecipesList = list;
        }
        if (assignToResults) {
          this.results = list;
          this.hasSearched = true;
          this.searchMessage = '';
        }

        await this.loadFavoriteIds().catch(() => {});
        await nextTick();
        return list;
      } catch (e) {
        console.error('fetchRecipes:', e);
        this.recipes = [];
        if (syncMyRecipesList || onlyMine) this.myRecipesList = [];
        if (assignToResults) {
          this.results = [];
          this.hasSearched = false;
        }
        this.showToast(e?.message || 'No se pudieron cargar las recetas', 'error');
        return [];
      } finally {
        this.recipesLoading = false;
        this.myRecipesLoading = false;
        this.loading = false;
        this.sessionSyncing = false;
        this.scheduleIconRefresh();
      }
    },

    navLinkClass(route) {
      const base =
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors';
      const active = this.currentRoute === route;
      return active
        ? `${base} bg-amber-500/15 text-amber-300 border border-amber-500/30`
        : `${base} text-slate-400 hover:text-slate-100 hover:bg-slate-800`;
    },

    clearSensitiveState() {
      this.results = [];
      this.recipes = [];
      this.hasSearched = false;
      this.searchMessage = '';
      this.formMessage = '';
      this.nutritionRecipes = [];
    },

    async signIn() {
      this.authError = '';
      this.authSuccess = '';
      if (!this.authForm.email?.trim() || !this.authForm.password) {
        this.authError = 'Email y contraseña son obligatorios.';
        return;
      }
      this.authSubmitting = true;
      try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({
          email: this.authForm.email.trim(),
          password: this.authForm.password,
        });
        if (error) throw error;
        this.authForm.password = '';
      } catch (err) {
        const msg = err.message || 'No se pudo iniciar sesión.';
        this.authError = msg;
        this.showToast(msg, 'error');
      } finally {
        this.authSubmitting = false;
        this.scheduleIconRefresh();
      }
    },

    async signUp() {
      this.authError = '';
      this.authSuccess = '';
      const { email, password, username, full_name } = this.authForm;
      if (!email?.trim() || !password) {
        this.authError = 'Email y contraseña son obligatorios.';
        return;
      }
      this.authSubmitting = true;
      try {
        const { data, error } = await window.supabaseClient.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username?.trim() || email.split('@')[0],
              full_name: full_name?.trim() || 'Usuario Nuevo',
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          this.authSuccess = 'Cuenta creada correctamente.';
          this.showToast('Cuenta creada correctamente', 'success');
        } else {
          this.authSuccess = 'Revisa tu correo para confirmar la cuenta.';
          this.showToast('Revisa tu correo para confirmar la cuenta', 'info');
        }
        this.authForm.password = '';
      } catch (err) {
        const msg = err.message || 'No se pudo registrar la cuenta.';
        this.authError = msg;
        this.showToast(msg, 'error');
      } finally {
        this.authSubmitting = false;
        this.scheduleIconRefresh();
      }
    },

    async signOut() {
      await window.supabaseClient.auth.signOut();
      this.authMode = 'login';
      this.authForm.password = '';
      this.closeSidebar();
      this.showToast('Sesión cerrada', 'info');
      this.navigate('auth');
    },

    isFavorite(recipeId) {
      return this.favoriteIds.includes(recipeId);
    },

    async loadFavoriteIds() {
      if (!this.currentUserId) {
        this.favoriteIds = [];
        return;
      }
      const { data, error } = await window.supabaseClient
        .from('favorites')
        .select('recipe_id')
        .eq('user_id', this.currentUserId);
      if (error) throw error;
      this.favoriteIds = (data || []).map((r) => r.recipe_id);
    },

    async toggleFavorite(recipe) {
      if (!this.isAuthenticated) {
        this.navigate('auth');
        return;
      }
      const recipeId = recipe.id;
      if (this.isFavorite(recipeId)) {
        const { error } = await window.supabaseClient
          .from('favorites')
          .delete()
          .eq('user_id', this.currentUserId)
          .eq('recipe_id', recipeId);
        if (error) {
          this.showToast(error.message, 'error');
          return;
        }
        this.favoriteIds = this.favoriteIds.filter((id) => id !== recipeId);
        this.favoritesList = this.favoritesList.filter((r) => r.id !== recipeId);
        this.showToast('Eliminado de favoritos', 'info');
      } else {
        const { error } = await window.supabaseClient.from('favorites').insert({
          user_id: this.currentUserId,
          recipe_id: recipeId,
        });
        if (error) {
          this.showToast(error.message, 'error');
          return;
        }
        this.favoriteIds = [...this.favoriteIds, recipeId];
        if (this.currentRoute === 'favorites') {
          this.favoritesList = [recipe, ...this.favoritesList];
        }
        this.showToast('Añadido a favoritos', 'success');
      }
      this.scheduleIconRefresh();
    },

    persistShoppingSelection() {
      if (!this.currentUserId) return;
      try {
        localStorage.setItem(
          shoppingStorageKey(this.currentUserId),
          JSON.stringify(this.shoppingSelectedIds)
        );
      } catch (e) {
        console.warn('localStorage:', e);
      }
    },

    hydrateShoppingSelection() {
      if (!this.currentUserId) {
        this.shoppingSelectedIds = [];
        return;
      }
      try {
        const raw = localStorage.getItem(shoppingStorageKey(this.currentUserId));
        this.shoppingSelectedIds = raw ? JSON.parse(raw) : [];
      } catch {
        this.shoppingSelectedIds = [];
      }
    },

    isRecipeInShopping(recipeId) {
      return this.shoppingSelectedIds.includes(recipeId);
    },

    toggleShoppingRecipe(recipe) {
      const id = recipe.id;
      if (this.isRecipeInShopping(id)) {
        this.shoppingSelectedIds = this.shoppingSelectedIds.filter((x) => x !== id);
        this.showToast('Receta quitada de la lista de compras', 'info');
      } else {
        this.shoppingSelectedIds = [...this.shoppingSelectedIds, id];
        if (!this.shoppingPickList.find((r) => r.id === id)) {
          this.shoppingPickList.push(recipe);
        }
        this.showToast('Ingredientes añadidos a compras', 'success');
      }
      this.persistShoppingSelection();
    },

    clearShoppingList() {
      this.shoppingSelectedIds = [];
      this.persistShoppingSelection();
      this.showToast('Lista de compras vaciada', 'info');
    },

    async loadShoppingPickList() {
      this.hydrateShoppingSelection();
      this.shoppingPickLoading = true;
      try {
        const { data, error } = await window.supabaseClient
          .from('recipes')
          .select(RECIPE_CARD)
          .order('title');
        if (error) throw error;
        this.shoppingPickList = data ?? [];
      } catch (e) {
        this.shoppingPickList = [];
        console.error(e);
      } finally {
        this.shoppingPickLoading = false;
        this.finishLoading();
      }
    },

    loadAllRecipes() {
      this.searchMessage = '';
      this.fetchRecipes({ assignToResults: true });
    },

    async loadMyRecipes() {
      return this.fetchRecipes({ onlyMine: true, syncMyRecipesList: true });
    },

    hasRecipeImage(url) {
      return isValidImageUrl(url);
    },

    requestDeleteRecipe(recipe) {
      this.pendingDeleteRecipe = recipe;
      this.showToast(`Confirma la eliminación de "${recipe.title}" en el diálogo.`, 'info');
      this.scheduleIconRefresh();
    },

    cancelDeleteRecipe() {
      this.pendingDeleteRecipe = null;
      this.scheduleIconRefresh();
    },

    async confirmDeleteRecipe() {
      const recipe = this.pendingDeleteRecipe;
      if (!recipe) return;
      this.deleteInProgress = true;
      try {
        const { error } = await window.supabaseClient
          .from('recipes')
          .delete()
          .eq('id', recipe.id)
          .eq('user_id', this.currentUserId);
        if (error) throw error;
        this.myRecipesList = this.myRecipesList.filter((r) => r.id !== recipe.id);
        this.results = this.results.filter((r) => r.id !== recipe.id);
        this.shoppingSelectedIds = this.shoppingSelectedIds.filter((id) => id !== recipe.id);
        this.persistShoppingSelection();
        if (this.editingRecipeId === recipe.id) this.cancelEditRecipe();
        if (this.recipeDetail?.id === recipe.id) this.closeRecipeDetail();
        this.pendingDeleteRecipe = null;
        this.showToast('Receta eliminada correctamente', 'success');
      } catch (e) {
        this.showToast(e.message || 'No se pudo eliminar', 'error');
      } finally {
        this.deleteInProgress = false;
        this.scheduleIconRefresh();
      }
    },

    async editRecipe(recipe) {
      let full = recipe;
      if (!recipe.recipe_steps?.length) {
        try {
          const { data, error } = await window.supabaseClient
            .from('recipes')
            .select(RECIPE_DETAIL)
            .eq('id', recipe.id)
            .maybeSingle();
          if (!error && data) full = data;
        } catch (e) {
          console.warn('editRecipe fetch:', e);
        }
      }
      this.editingRecipeId = full.id;
      this.form = {
        title: full.title || '',
        description: full.description || '',
        cooking_time: full.cooking_time,
        category: full.category || '',
        cuisine_type: full.cuisine_type || '',
        image_url: full.image_url || '',
        calories: full.calories ?? 0,
        protein: full.protein ?? 0,
      };
      const ings = full.recipe_ingredients || [];
      this.ingredients = ings.length
        ? ings.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit }))
        : [{ name: '', amount: null, unit: '' }];
      const st = (full.recipe_steps || []).sort((a, b) => a.step_number - b.step_number);
      this.steps = st.length
        ? st.map((s) => ({ instruction: s.instruction }))
        : [{ instruction: '' }];
      this.formMessage = '';
      this.navigate('recipes');
      this.showToast('Modo edición: actualiza ingredientes, pasos y foto', 'info');
      this.scheduleIconRefresh();
    },

    async openRecipeDetail(recipe) {
      this.recipeDetailLoading = true;
      this.recipeDetail = { ...recipe };
      this.detailReviewForm = { rating: 5, comment: '' };
      this.detailReviewHover = 0;
      try {
        const { data, error } = await window.supabaseClient
          .from('recipes')
          .select(RECIPE_DETAIL)
          .eq('id', recipe.id)
          .maybeSingle();
        if (!error && data) this.recipeDetail = data;
        this.reviewForm.recipe_id = recipe.id;
        await this.loadDetailReviews(recipe.id);
      } catch (e) {
        console.error(e);
        this.showToast('No se pudo cargar el detalle completo', 'error');
      } finally {
        this.recipeDetailLoading = false;
        this.scheduleIconRefresh();
      }
    },

    closeRecipeDetail() {
      this.recipeDetail = null;
      this.detailReviews = [];
      this.scheduleIconRefresh();
    },

    async maybeOpenRecipeFromHash() {
      const id = getHashQueryParam('recipe');
      if (!id) return;
      await this.openRecipeDetail({ id });
    },

    async loadDetailReviews(recipeId) {
      this.detailReviewsLoading = true;
      try {
        const { data, error } = await window.supabaseClient
          .from('reviews')
          .select('id, rating, comment, created_at, user_id')
          .eq('recipe_id', recipeId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.detailReviews = data ?? [];
      } catch (e) {
        this.detailReviews = [];
      } finally {
        this.detailReviewsLoading = false;
        this.scheduleIconRefresh();
      }
    },

    setDetailReviewStars(n) {
      this.detailReviewForm.rating = n;
      this.scheduleIconRefresh();
    },

    setDetailReviewHover(n) {
      this.detailReviewHover = n;
    },

    clearDetailReviewHover() {
      this.detailReviewHover = 0;
    },

    async submitDetailReview() {
      if (!this.recipeDetail?.id) return;
      if (!this.isAuthenticated) {
        this.showToast('Inicia sesión para dejar una reseña', 'error');
        return;
      }
      this.reviewSubmitting = true;
      try {
        const { error } = await window.supabaseClient.from('reviews').upsert(
          {
            user_id: this.currentUserId,
            recipe_id: this.recipeDetail.id,
            rating: Number(this.detailReviewForm.rating),
            comment: this.detailReviewForm.comment?.trim() || null,
          },
          { onConflict: 'user_id,recipe_id' }
        );
        if (error) throw error;
        this.showToast('Tu reseña se publicó correctamente', 'success');
        this.detailReviewForm.comment = '';
        await this.loadDetailReviews(this.recipeDetail.id);
      } catch (e) {
        this.showToast(e.message || 'Error al publicar reseña', 'error');
      } finally {
        this.reviewSubmitting = false;
        this.scheduleIconRefresh();
      }
    },

    async shareRecipe(recipe) {
      const base = `${window.location.origin}${window.location.pathname}`;
      const link = `${base}#/explore?recipe=${recipe.id}`;
      try {
        await navigator.clipboard.writeText(link);
        this.showToast('¡Enlace de la receta copiado al portapapeles para compartir!', 'success');
      } catch {
        this.showToast(link, 'info');
      }
    },

    hydrateCollectionsLocal() {
      if (!this.currentUserId) return;
      try {
        const raw = localStorage.getItem(collectionsLocalKey(this.currentUserId));
        this.collectionsLocalMap = raw ? JSON.parse(raw) : {};
      } catch {
        this.collectionsLocalMap = {};
      }
    },

    persistCollectionsLocal() {
      if (!this.currentUserId) return;
      try {
        localStorage.setItem(
          collectionsLocalKey(this.currentUserId),
          JSON.stringify(this.collectionsLocalMap)
        );
      } catch (e) {
        console.warn(e);
      }
    },

    getCollectionRecipeIds(collectionId) {
      const col = this.collectionsList.find((c) => c.id === collectionId);
      const dbIds = (col?.collection_recipes || []).map((r) => r.recipe_id);
      const localIds = this.collectionsLocalMap[collectionId] || [];
      return [...new Set([...dbIds, ...localIds])];
    },

    async addRecipeToCollection(collectionId, recipeId) {
      if (!collectionId || !recipeId) {
        this.showToast('Selecciona colección y receta', 'error');
        return;
      }
      try {
        const { error } = await window.supabaseClient.from('collection_recipes').insert({
          collection_id: collectionId,
          recipe_id: recipeId,
        });
        if (error && error.code !== '23505') throw error;
        if (!this.collectionsLocalMap[collectionId]) this.collectionsLocalMap[collectionId] = [];
        if (!this.collectionsLocalMap[collectionId].includes(recipeId)) {
          this.collectionsLocalMap[collectionId].push(recipeId);
        }
        this.persistCollectionsLocal();
        this.showToast('Receta añadida a la colección', 'success');
        await this.loadCollections();
      } catch (e) {
        if (!this.collectionsLocalMap[collectionId]) this.collectionsLocalMap[collectionId] = [];
        if (!this.collectionsLocalMap[collectionId].includes(recipeId)) {
          this.collectionsLocalMap[collectionId].push(recipeId);
          this.persistCollectionsLocal();
          this.showToast('Guardado en colección (modo local)', 'info');
        } else {
          this.showToast(e.message || 'No se pudo añadir', 'error');
        }
      }
    },

    cancelEditRecipe() {
      this.editingRecipeId = null;
      this.resetForm();
      this.formMessage = '';
    },

    async loadCollections() {
      if (!this.currentUserId) return;
      this.hydrateCollectionsLocal();
      this.collectionsLoading = true;
      try {
        const { data, error } = await window.supabaseClient
          .from('collections')
          .select('id, name, description, created_at, collection_recipes(recipe_id)')
          .eq('user_id', this.currentUserId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.collectionsList = data ?? [];
      } catch (e) {
        this.collectionsList = [];
        this.showToast('Ejecuta sql/collections_reviews.sql en Supabase', 'error');
      } finally {
        this.collectionsLoading = false;
        this.finishLoading();
      }
    },

    async createCollection() {
      if (!this.collectionForm.name?.trim()) {
        this.showToast('El nombre de la colección es obligatorio', 'error');
        return;
      }
      this.collectionSaving = true;
      try {
        const { error } = await window.supabaseClient.from('collections').insert({
          user_id: this.currentUserId,
          name: this.collectionForm.name.trim(),
          description: this.collectionForm.description?.trim() || null,
        });
        if (error) throw error;
        this.collectionForm = { name: '', description: '' };
        this.showToast('Colección creada', 'success');
        await this.loadCollections();
      } catch (e) {
        this.showToast(e.message || 'Error al crear colección', 'error');
      } finally {
        this.collectionSaving = false;
      }
    },

    async loadReviewsForRecipe() {
      this.reviewsLoading = true;
      try {
        let query = window.supabaseClient
          .from('reviews')
            .select('id, rating, comment, created_at, recipe_id')
          .order('created_at', { ascending: false })
          .limit(50);
        if (this.reviewsRecipeId) query = query.eq('recipe_id', this.reviewsRecipeId);
        const { data, error } = await query;
        if (error) throw error;
        this.reviewsList = data ?? [];
      } catch (e) {
        this.reviewsList = [];
      } finally {
        this.reviewsLoading = false;
        this.finishLoading();
      }
    },

    setReviewStars(n) {
      this.reviewForm.rating = n;
    },

    async submitReview() {
      if (!this.reviewForm.recipe_id) {
        this.showToast('Indica el ID de la receta a valorar', 'error');
        return;
      }
      this.reviewSubmitting = true;
      try {
        const { error } = await window.supabaseClient.from('reviews').upsert(
          {
            user_id: this.currentUserId,
            recipe_id: this.reviewForm.recipe_id.trim(),
            rating: Number(this.reviewForm.rating),
            comment: this.reviewForm.comment?.trim() || null,
          },
          { onConflict: 'user_id,recipe_id' }
        );
        if (error) throw error;
        this.showToast('Reseña guardada', 'success');
        this.reviewForm.comment = '';
        await this.loadReviewsForRecipe();
      } catch (e) {
        this.showToast(e.message || 'Error al guardar reseña', 'error');
      } finally {
        this.reviewSubmitting = false;
      }
    },

    async loadFavorites() {
      if (!this.currentUserId) return;
      this.favoritesLoading = true;
      try {
        const { data, error } = await window.supabaseClient
          .from('favorites')
          .select(
            `recipe_id, recipes (
              id, title, description, cooking_time, category, cuisine_type,
              image_url, calories, protein, created_at,
              recipe_ingredients ( name, amount, unit )
            )`
          )
          .eq('user_id', this.currentUserId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.favoritesList = (data || []).map((r) => r.recipes).filter(Boolean);
        this.favoriteIds = this.favoritesList.map((r) => r.id);
      } catch (err) {
        this.favoritesList = [];
        console.error(err);
      } finally {
        this.favoritesLoading = false;
        this.scheduleIconRefresh();
      }
    },

    async loadNutrition() {
      this.nutritionLoading = true;
      try {
        let query = window.supabaseClient
          .from('recipes')
          .select('id, title, category, calories, protein, cooking_time')
          .order('title');
        if (this.nutritionFilter.category) {
          query = query.eq('category', this.nutritionFilter.category);
        }
        const { data, error } = await query;
        if (error) throw error;
        this.nutritionRecipes = data ?? [];
      } catch (err) {
        this.nutritionRecipes = [];
      } finally {
        this.nutritionLoading = false;
        this.scheduleIconRefresh();
      }
    },

    addIngredient() {
      this.ingredients.push({ name: '', amount: null, unit: '' });
    },
    removeIngredient(i) {
      this.ingredients.splice(i, 1);
    },
    addStep() {
      this.steps.push({ instruction: '' });
    },
    removeStep(i) {
      this.steps.splice(i, 1);
    },

    validateForm() {
      if (!this.isAuthenticated) return 'Inicia sesión para guardar.';
      if (!this.form.title?.trim()) return 'El título es obligatorio.';
      if (!this.form.cooking_time || this.form.cooking_time < 1) return 'Tiempo de cocción inválido.';
      if (!this.form.category) return 'Selecciona categoría.';
      if (!this.ingredients.some((i) => i.name?.trim() && i.amount > 0 && i.unit?.trim())) {
        return 'Añade al menos un ingrediente.';
      }
      if (!this.steps.some((s) => s.instruction?.trim())) return 'Añade al menos un paso.';
      return null;
    },

    resetForm() {
      this.editingRecipeId = null;
      this.form = {
        title: '',
        description: '',
        cooking_time: null,
        category: '',
        cuisine_type: '',
        image_url: '',
        calories: 0,
        protein: 0,
      };
      this.ingredients = [{ name: '', amount: null, unit: '' }];
      this.steps = [{ instruction: '' }];
    },

    async saveRecipe() {
      this.formMessage = '';
      const errMsg = this.validateForm();
      if (errMsg) {
        this.formMessage = errMsg;
        this.formMessageType = 'error';
        return;
      }

      const profileOk = await this.syncUserProfile();
      if (!profileOk) {
        this.formMessage = this.profileError || 'Completa tu perfil antes de guardar recetas.';
        this.formMessageType = 'error';
        return;
      }

      this.formLoading = true;
      let recipeId = this.editingRecipeId;
      try {
        const payload = {
          title: this.form.title.trim(),
          description: this.form.description?.trim() || null,
          cooking_time: Number(this.form.cooking_time),
          category: this.form.category,
          cuisine_type: this.form.cuisine_type || null,
          image_url: this.form.image_url?.trim() || null,
          calories: Number(this.form.calories) || 0,
          protein: Number(this.form.protein) || 0,
        };

        if (recipeId) {
          const { error: eu } = await window.supabaseClient
            .from('recipes')
            .update(payload)
            .eq('id', recipeId)
            .eq('user_id', this.currentUserId);
          if (eu) throw eu;
          await window.supabaseClient.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
          await window.supabaseClient.from('recipe_steps').delete().eq('recipe_id', recipeId);
        } else {
          const { data: recipe, error: e1 } = await window.supabaseClient
            .from('recipes')
            .insert({ ...payload, user_id: this.currentUserId })
            .select('id')
            .single();
          if (e1) throw e1;
          recipeId = recipe.id;
        }

        const { error: e2 } = await window.supabaseClient.from('recipe_ingredients').insert(
          this.ingredients
            .filter((i) => i.name?.trim() && i.amount > 0 && i.unit?.trim())
            .map((i) => ({
              recipe_id: recipeId,
              name: i.name.trim(),
              amount: Number(i.amount),
              unit: i.unit.trim(),
            }))
        );
        if (e2) throw e2;

        const { error: e3 } = await window.supabaseClient.from('recipe_steps').insert(
          this.steps
            .filter((s) => s.instruction?.trim())
            .map((s, idx) => ({
              recipe_id: recipeId,
              step_number: idx + 1,
              instruction: s.instruction.trim(),
            }))
        );
        if (e3) throw e3;

        this.formMessage = this.editingRecipeId ? 'Receta actualizada.' : 'Receta guardada.';
        this.formMessageType = 'success';
        const wasEdit = !!this.editingRecipeId;
        this.showToast(wasEdit ? 'Receta actualizada' : 'Receta guardada correctamente', 'success');
        this.resetForm();
        if (this.currentRoute === 'my-recipes') await this.loadMyRecipes();
      } catch (err) {
        if (recipeId) {
          await window.supabaseClient.from('recipes').delete().eq('id', recipeId);
        }
        const msg = err.message || 'Error al guardar.';
        this.formMessage = msg;
        this.formMessageType = 'error';
        this.showToast(msg, 'error');
      } finally {
        this.formLoading = false;
        this.scheduleIconRefresh();
      }
    },

    hasActiveSearchFilters() {
      const s = this.search;
      return Boolean(s.title?.trim() || s.ingredient?.trim() || s.category || s.cuisine_type);
    },

    async searchRecipes() {
      if (!this.hasActiveSearchFilters()) {
        this.searchMessage = 'Indica al menos un filtro o pulsa "Ver todas".';
        return;
      }
      this.searchLoading = true;
      this.hasSearched = true;
      try {
        const ing = this.search.ingredient?.trim();
        let query = window.supabaseClient
          .from('recipes')
          .select(RECIPES_FULL_SELECT);
        if (this.search.title?.trim()) {
          query = query.ilike('title', `%${this.search.title.trim()}%`);
        }
        if (this.search.category) query = query.eq('category', this.search.category);
        if (this.search.cuisine_type) query = query.eq('cuisine_type', this.search.cuisine_type);
        if (ing) query = query.ilike('recipe_ingredients.name', `%${ing}%`);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        this.results = data ?? [];
        this.recipes = this.results;
        await this.loadFavoriteIds().catch(() => {});
      } catch (err) {
        this.results = [];
        this.searchMessage = err.message || 'Error en búsqueda.';
        this.showToast(this.searchMessage, 'error');
      } finally {
        this.searchLoading = false;
        this.finishLoading();
        this.scheduleIconRefresh();
      }
    },

    clearSearch() {
      this.search = { title: '', ingredient: '', category: '', cuisine_type: '' };
      this.results = [];
      this.searchMessage = '';
      this.hasSearched = false;
      this.fetchRecipes({ assignToResults: true });
    },
  },
}).mount('#app');
