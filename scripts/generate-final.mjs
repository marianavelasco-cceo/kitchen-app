import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let app = fs.readFileSync(path.join(__dirname, 'app.full.js'), 'utf8');
let html = fs.readFileSync(path.join(__dirname, 'index.full.html'), 'utf8');

if (!app.includes('my-recipes')) {
  app = app.replace(
    `const DASHBOARD_ROUTES = new Set([
  'dashboard',
  'profile',
  'recipes',
  'explore',
  'favorites',
  'nutrition',
  'shopping',
  'collections',
  'share',
]);`,
    `const DASHBOARD_ROUTES = new Set([
  'dashboard', 'profile', 'my-recipes', 'recipes', 'explore', 'favorites',
  'nutrition', 'shopping', 'collections', 'share',
]);

const RECIPE_DETAIL = \`
  id, title, description, cooking_time, category, cuisine_type,
  image_url, calories, protein, created_at, user_id,
  recipe_ingredients ( id, name, amount, unit ),
  recipe_steps ( id, step_number, instruction )
\`;`
  );

  app = app.replace(
    `const NAV_ITEMS = [
  { route: 'dashboard', label: 'Inicio', icon: 'layout-dashboard' },
  { route: 'profile', label: 'Mi perfil', icon: 'user' },
  { route: 'recipes', label: 'Mis recetas', icon: 'chef-hat' },
  { route: 'explore', label: 'Explorar', icon: 'search' },
  { route: 'favorites', label: 'Favoritos', icon: 'heart' },
  { route: 'nutrition', label: 'Nutrición', icon: 'bar-chart-3' },
  { route: 'shopping', label: 'Compras', icon: 'shopping-cart' },
  { route: 'collections', label: 'Colecciones', icon: 'library' },
  { route: 'share', label: 'Compartir', icon: 'share-2' },
];

const PLACEHOLDER_META = {
  shopping: { title: 'Lista de compras', subtitle: 'US-06 · Próximamente', icon: 'shopping-cart' },
  collections: { title: 'Mis colecciones', subtitle: 'US-09 · Próximamente', icon: 'library' },
  share: { title: 'Compartir', subtitle: 'US-10 · Próximamente', icon: 'share-2' },
};`,
    `const NAV_ITEMS = [
  { route: 'dashboard', label: 'Inicio', icon: 'layout-dashboard' },
  { route: 'profile', label: 'Mi perfil', icon: 'user' },
  { route: 'my-recipes', label: 'Mis recetas', icon: 'book-open' },
  { route: 'recipes', label: 'Nueva receta', icon: 'plus-circle' },
  { route: 'explore', label: 'Explorar', icon: 'search' },
  { route: 'favorites', label: 'Favoritos', icon: 'heart' },
  { route: 'nutrition', label: 'Nutrición', icon: 'bar-chart-3' },
  { route: 'shopping', label: 'Compras', icon: 'shopping-cart' },
  { route: 'collections', label: 'Colecciones', icon: 'library' },
  { route: 'share', label: 'Reseñas', icon: 'star' },
];

function shoppingStorageKey(userId) {
  return \`kitchen-shopping-\${userId || 'guest'}\`;
}

function normalizeIngredientKey(name, unit) {
  return \`\${String(name || '').trim().toLowerCase()}::\${String(unit || '').trim().toLowerCase()}\`;
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
}`
  );

  app = app.replace(
    `      navItems: NAV_ITEMS,
      placeholderMeta: PLACEHOLDER_META,
      categories: CATEGORIES,`,
    `      navItems: NAV_ITEMS,
      categories: CATEGORIES,
      _iconTimer: null,
      _routeToken: 0,`
  );

  app = app.replace(
    `      hasSearched: false,
      _authSubscription: null,
      _onHashChange: null,
    };`,
    `      hasSearched: false,
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
      _authSubscription: null,
      _onHashChange: null,
    };`
  );

  app = app.replace(
    `        recipes: 'Nueva receta',
        explore: 'Explorar',`,
    `        'my-recipes': 'Mis recetas',
        recipes: 'Nueva / editar receta',
        explore: 'Explorar',`
  );

  app = app.replace(
    `        share: 'Compartir',
        auth: 'Acceso',
      };
      return map[this.currentRoute] || 'Kitchen App';
    },
    nutritionStats() {`,
    `        share: 'Reseñas',
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
    nutritionStats() {`
  );

  app = app.replace(
    `  watch: {
    currentRoute(route) {
      this.onRouteEntered(route);
    },
    layout() {
      this.refreshIcons();
    },
    toasts() {
      this.refreshIcons();
    },
  },`,
    `  watch: {
    currentRoute(route) {
      this.onRouteEntered(route);
      this.scheduleIconRefresh();
    },
    toasts() {
      this.scheduleIconRefresh();
    },
  },`
  );

  app = app.replace(
    `    await this.initAuth();
    this.syncRouteFromHash();
    this.refreshIcons();
  },`,
    `    await this.initAuth();
    this.syncRouteFromHash();
    this.scheduleIconRefresh();
  },`
  );

  app = app.replace(
    `    refreshIcons() {
      nextTick(() => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    },`,
    `    scheduleIconRefresh() {
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
    },`
  );

  app = app.replace(
    `      this.refreshIcons();
    },

    showToast(message, type = 'success') {`,
    `      this.scheduleIconRefresh();
    },

    showToast(message, type = 'success') {`
  );

  app = app.replaceAll('this.refreshIcons()', 'this.scheduleIconRefresh()');

  app = app.replace(
    `    onRouteEntered(route) {
      if (!this.isAuthenticated) return;
      if (route === 'favorites') this.loadFavorites();
      if (route === 'nutrition') this.loadNutrition();
      if (route === 'profile' && !this.profile) this.syncUserProfile({ silent: true });
      this.refreshIcons();
    },`,
    `    async onRouteEntered(route) {
      if (!this.isAuthenticated) return;
      const token = ++this._routeToken;
      try {
        if (route === 'favorites') await this.loadFavorites();
        else if (route === 'my-recipes') await this.loadMyRecipes();
        else if (route === 'nutrition') await this.loadNutrition();
        else if (route === 'shopping') await this.loadShoppingPickList();
        else if (route === 'collections') await this.loadCollections();
        else if (route === 'share') await this.loadReviewsForRecipe();
        else if (route === 'profile' && !this.profile) await this.syncUserProfile({ silent: true });
      } catch (e) {
        console.error('route load:', route, e);
      } finally {
        if (token === this._routeToken) {
          this.finishLoading();
          this.scheduleIconRefresh();
        }
      }
    },`
  );

  app = app.replace(
    `        if (error) {
          alert(error.message);
          return;
        }
        this.favoriteIds = this.favoriteIds.filter((id) => id !== recipeId);
        this.favoritesList = this.favoritesList.filter((r) => r.id !== recipeId);
      } else {
        const { error } = await window.supabaseClient.from('favorites').insert({
          user_id: this.currentUserId,
          recipe_id: recipeId,
        });
        if (error) {
          alert(error.message);
          return;
        }`,
    `        if (error) {
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
        }`
  );

  app = app.replace(
    `        this.favoriteIds = [...this.favoriteIds, recipeId];
        if (this.currentRoute === 'favorites') {
          this.favoritesList = [recipe, ...this.favoritesList];
        }
      }
      this.scheduleIconRefresh();
    },`,
    `        this.favoriteIds = [...this.favoriteIds, recipeId];
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

    async loadMyRecipes() {
      if (!this.currentUserId) return;
      this.myRecipesLoading = true;
      try {
        const { data, error } = await window.supabaseClient
          .from('recipes')
          .select(RECIPE_DETAIL)
          .eq('user_id', this.currentUserId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.myRecipesList = data ?? [];
      } catch (e) {
        this.myRecipesList = [];
        this.showToast(e.message || 'Error al cargar tus recetas', 'error');
      } finally {
        this.myRecipesLoading = false;
        this.finishLoading();
      }
    },

    async deleteRecipe(recipe) {
      if (!confirm(\`¿Eliminar "\${recipe.title}"? Esta acción no se puede deshacer.\`)) return;
      try {
        const { error } = await window.supabaseClient
          .from('recipes')
          .delete()
          .eq('id', recipe.id)
          .eq('user_id', this.currentUserId);
        if (error) throw error;
        this.myRecipesList = this.myRecipesList.filter((r) => r.id !== recipe.id);
        this.shoppingSelectedIds = this.shoppingSelectedIds.filter((id) => id !== recipe.id);
        this.persistShoppingSelection();
        if (this.editingRecipeId === recipe.id) {
          this.cancelEditRecipe();
        }
        this.showToast('Receta eliminada', 'success');
      } catch (e) {
        this.showToast(e.message || 'No se pudo eliminar', 'error');
      }
    },

    async editRecipe(recipe) {
      this.editingRecipeId = recipe.id;
      this.form = {
        title: recipe.title || '',
        description: recipe.description || '',
        cooking_time: recipe.cooking_time,
        category: recipe.category || '',
        cuisine_type: recipe.cuisine_type || '',
        image_url: recipe.image_url || '',
        calories: recipe.calories ?? 0,
        protein: recipe.protein ?? 0,
      };
      const ings = recipe.recipe_ingredients || [];
      this.ingredients = ings.length
        ? ings.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit }))
        : [{ name: '', amount: null, unit: '' }];
      const st = (recipe.recipe_steps || []).sort((a, b) => a.step_number - b.step_number);
      this.steps = st.length
        ? st.map((s) => ({ instruction: s.instruction }))
        : [{ instruction: '' }];
      this.formMessage = '';
      this.navigate('recipes');
      this.showToast('Modo edición: actualiza y guarda', 'info');
    },

    cancelEditRecipe() {
      this.editingRecipeId = null;
      this.resetForm();
      this.formMessage = '';
    },

    async loadCollections() {
      if (!this.currentUserId) return;
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
          .select('id, rating, comment, created_at, recipe_id, profiles(username, full_name)')
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
    },`
  );

  app = app.replace(
    `    resetForm() {
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
    },`,
    `    resetForm() {
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
    },`
  );

  app = app.replace(
    `      this.formLoading = true;
      let recipeId = null;
      try {
        const { data: recipe, error: e1 } = await window.supabaseClient
          .from('recipes')
          .insert({
            user_id: this.currentUserId,
            title: this.form.title.trim(),
            description: this.form.description?.trim() || null,
            cooking_time: Number(this.form.cooking_time),
            category: this.form.category,
            cuisine_type: this.form.cuisine_type || null,
            image_url: this.form.image_url?.trim() || null,
            calories: Number(this.form.calories) || 0,
            protein: Number(this.form.protein) || 0,
          })
          .select('id')
          .single();
        if (e1) throw e1;
        recipeId = recipe.id;

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

        this.formMessage = 'Receta guardada.';
        this.formMessageType = 'success';
        this.showToast('Receta guardada correctamente', 'success');
        this.resetForm();`,
    `      this.formLoading = true;
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
            .maybeSingle();
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
        this.showToast(this.editingRecipeId ? 'Receta actualizada' : 'Receta guardada correctamente', 'success');
        this.resetForm();
        if (this.currentRoute === 'my-recipes') await this.loadMyRecipes();`
  );

  fs.writeFileSync(path.join(__dirname, 'app.full.js'), app, 'utf8');
  console.log('app.full.js extended');
}

const viewsPath = path.join(__dirname, 'views-final.html');
if (!fs.existsSync(viewsPath)) {
  console.log('views-final.html missing - create manually');
}

fs.writeFileSync(path.join(root, 'app.js'), fs.readFileSync(path.join(__dirname, 'app.full.js'), 'utf8'), 'utf8');
console.log('Deployed app.js');
