export const config = { runtime: 'edge' };

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
};

const METHOD_NOT_ALLOWED = 405;
const UNPROCESSABLE_ENTITY = 422;

/* ----------------------------- Helpers ----------------------------- */
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const pickTitle = (recipe) =>
  normalizeString(recipe.title ?? recipe.Title ?? '');

const pickDescription = (recipe) => {
  const description = normalizeString(
    recipe.description ?? recipe.Description ?? ''
  );
  return description || null;
};

const pickInstructions = (recipe) => {
  const instructions = recipe.instructions ?? recipe.Instructions ?? null;

  if (Array.isArray(instructions)) {
    const steps = instructions
      .map((s) => normalizeString(s))
      .filter(Boolean);
    return steps.length ? steps : null;
  }

  const normalized = normalizeString(instructions);
  return normalized || null;
};

const pickShoppingTitle = (body) =>
  normalizeString(
    body?.shopping_title ??
      body?.shoppingTitle ??
      body?.title ??
      body?.Title ??
      ''
  );

/* ---------------------- Normalize Line Items ---------------------- */
const normalizeLineItem = (item) => {
  if (!isObject(item)) return null;

  const name = normalizeString(item.name ?? item.Name ?? '');
  const unit = normalizeString(item.unit ?? item.Unit ?? '').toLowerCase();
  const quantity = Number(item.quantity ?? item.Quantity ?? 0);
  const price = Number(item.price ?? item.Price ?? 0);

  if (
    !name ||
    Number.isNaN(quantity) ||
    !Number.isFinite(quantity) ||
    Number.isNaN(price) ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  return {
    name,
    unit,
    quantity,
    price,
  };
};

/* ----------------------------- Body Parser ----------------------------- */
const parseBody = async (request) => {
  try {
    const initial = await request.json();

    if (typeof initial === 'string') {
      return JSON.parse(initial);
    }

    return initial;
  } catch {
    try {
      const rawText = await request.text();
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch {
      return null;
    }
  }
};

/* --------------------------- Builders --------------------------- */
const buildMergedItems = (lineItems) => {
  const merged = new Map();

  for (const item of lineItems) {
    const key = `${item.name.toLowerCase()}::${item.unit.toLowerCase()}`;
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.quantity += item.quantity;
      existing.price += item.price;
      existing.price = Number(existing.price.toFixed(10));
    } else {
      const { name, unit, quantity, price } = item;
      merged.set(key, { name, unit, quantity, price });
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
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

  if (!Array.isArray(body.recipes) || body.recipes.length === 0) {
    return 'Missing or invalid "recipes" array.';
  }

  return null;
};

/* ---------------------------- Handler ---------------------------- */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Only POST requests are supported.' }),
      {
        status: METHOD_NOT_ALLOWED,
        headers: jsonHeaders,
      }
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

  const shoppingListTitle = pickShoppingTitle(body);

  let recipeId = 1;
  const recipes = [];

  for (const recipe of body.recipes) {
    if (!isObject(recipe)) continue;

    const title = pickTitle(recipe);
    if (!title) continue;

    const description = pickDescription(recipe);
    const instructions = pickInstructions(recipe);
    const normalizedItems = [];

    const items = Array.isArray(recipe.line_items ?? recipe.ingredients)
      ? recipe.line_items ?? recipe.ingredients
      : [];

    for (const item of items) {
      const normalized = normalizeLineItem(item);
      if (!normalized) continue;
      normalizedItems.push(normalized);
    }

    const recipeRecord = {
      recipe_id: recipeId,
      title,
      line_items: normalizedItems,
    };

    if (description) recipeRecord.description = description;
    if (instructions) recipeRecord.instructions = instructions;

    recipes.push(recipeRecord);
    recipeId += 1;
  }

  const recipesClean = recipes.map(
    ({ recipe_id, title, description, instructions }) => {
      const summary = { recipe_id, title };
      if (description) summary.description = description;
      if (instructions) summary.instructions = instructions;
      return summary;
    }
  );

  const lineItemsFlat = buildLineItemsFlat(recipes);
  const shoppingItemsMerged = buildMergedItems(lineItemsFlat);

  const responsePayload = {
    shopping_list_title: shoppingListTitle,
    recipes_clean: recipesClean,
    line_items_flat: lineItemsFlat,
    shopping_items_merged: shoppingItemsMerged,
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: jsonHeaders,
  });
}
