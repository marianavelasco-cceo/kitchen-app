# Kitchen App

## Perfil automático

Al iniciar sesión, `ensureProfileExists()` hace `SELECT` en `profiles` y, si no hay fila, `INSERT` con `username` (email o metadata) y `full_name`.

## Tabla favorites (US-03)

Ejecuta `sql/favorites.sql` en Supabase si no existe la tabla.

## Módulos

- US-01: Crear receta (recipes + ingredients + steps + calorías/proteína)
- US-02: Buscar con filtros (categoría destacada)
- US-03: Favoritos en tiempo real
- US-04: Panel nutricional por categoría
