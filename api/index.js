export const config = { runtime: 'edge' };

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
};

const METHOD_NOT_ALLOWED = 405;
const UNPROCESSABLE_ENTITY = 422;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const pickTitle = (recipe) => normalizeString(recipe.title ?? recipe.Title ?? '');

const normalizeLineItem = (item) => {
  if (!isObject(item)) return null;

  const name = normalizeString(item.name ?? item.Name ?? '');
  const unit = normalizeString(item.unit ?? item.Unit ?? '');
  const quantity = Number(item.quantity ?? item.Quantity ?? 0);

  if (!name || Number.isNaN(quantity) || !Number.isFinite(quantity)) {
    return null;
  }

  return {
    name,
    unit,
    quantity,
  };
};

const parseBody = async (request) => {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
};

const buildMergedItems = (lineItems) => {
  const merged = new Map();

  for (const item of lineItems) {
    const key = `${item.name.toLowerCase()}::${item.unit.toLowerCase()}`;
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.quantity += item.quantity;
    } else {
      const { name, unit, quantity } = item;
      merged.set(key, { name, unit, quantity });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const buildLineItemsFlat = (recipes) => {
  const flat = [];

  recipes.forEach((recipe) => {
    recipe.line_items.forEach((item) => {
      flat.push({
        recipe_id: recipe.recipe_id,
        ...item,
      });
    });
  });

  return flat;
};

const validatePayload = (body) => {
  if (!isObject(body)) {
    return 'Body must be a JSON object.';
  }

  if (!Array.isArray(body.recipes)) {
    return 'Body must include a "recipes" array.';
  }

  return null;
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Only POST requests are supported.' }),
      {
        status: METHOD_NOT_ALLOWED,
        headers: jsonHeaders,
      },
    );
  }

  const body = await parseBody(request);

  const validationError = validatePayload(body);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: UNPROCESSABLE_ENTITY,
      headers: jsonHeaders,
    });
  }

  let recipeId = 1;
  const recipes = [];
  for (const recipe of body.recipes) {
    if (!isObject(recipe)) continue;

    const title = pickTitle(recipe);
    if (!title) continue;

    const normalizedItems = [];

    const items = Array.isArray(recipe.line_items ?? recipe.ingredients)
      ? recipe.line_items ?? recipe.ingredients
      : [];

    for (const item of items) {
      const normalized = normalizeLineItem(item);
      if (!normalized) continue;
      normalizedItems.push(normalized);
    }

    recipes.push({
      recipe_id: recipeId,
      title,
      line_items: normalizedItems,
    });

    recipeId += 1;
  }

  const recipesClean = recipes.map(({ recipe_id, title }) => ({ recipe_id, title }));

  const lineItemsFlat = buildLineItemsFlat(recipes);

  const shoppingItemsMerged = buildMergedItems(lineItemsFlat);

  const responsePayload = {
    recipes_clean: recipesClean,
    line_items_flat: lineItemsFlat,
    shopping_items_merged: shoppingItemsMerged,
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: jsonHeaders,
  });
}
