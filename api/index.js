// api/index.js
export const config = { runtime: 'edge' };

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };
const METHOD_NOT_ALLOWED = 405;
const UNPROCESSABLE_ENTITY = 422;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const normalizeString = (v) => (typeof v === 'string' ? v.trim() : '');
const toNumber = (v, fallback = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* --- Extractors ---------------------------------------------------- */
const pickTitle = (recipe) =>
  normalizeString(recipe.title ?? recipe.Title ?? '');

const pickDescription = (recipe) => {
  const d = normalizeString(recipe.description ?? recipe.Description ?? '');
  return d || null;
};

const pickInstructions = (recipe) => {
  const raw = recipe.instructions ?? recipe.Instructions ?? null;

  if (Array.isArray(raw)) {
    const steps = raw.map((s) => normalizeString(s)).filter(Boolean);
    return steps.length ? steps : null;
  }

  const s = normalizeString(raw);
  return s || null;
};

const pickShoppingTitle = (body) =>
  normalizeString(
    body?.shopping_title ??
      body?.shoppingTitle ??
      body?.title ??
      body?.Title ??
      ''
  );

/* --- Normalize a single line item ---------------------------------- */
/* Only "name" is mandatory                                           */
const normalizeLineItem = (item) => {
  if (!isObject(item)) return null;

  const name = normalizeString(item.name ?? item.Name ?? '');
  if (!name) return null;

  const unitRaw = normalizeString(item.unit ?? item.Unit ?? '');
  const unit = unitRaw ? unitRaw.toLowerCase() : '';

  const quantity = toNumber(item.quantity ?? item.Quantity);
  const price = toNumber(item.price ?? item.Price);

  return { name, unit, quantity, price };
};

/* --- Merge flat line items ----------------------------------------- */
const buildMergedItems = (lineItemsFlat) => {
  const merged = new Map();

  for (const li of lineItemsFlat) {
    const key = `${li.name.toLowerCase()}::${li.unit.toLowerCase()}`;

    if (!merged.has(key)) {
      merged.set(key, { name: li.name, unit: li.unit, quantity: 0, price: 0 });
    }

    const m = merged.get(key);

    if (Number.isFinite(li.quantity)) m.quantity += li.quantity;
    if (Number.isFinite(li.price)) m.price += li.price;

    m.price = Math.round(m.price * 100) / 100;
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};

/* --- Flatten recipes → line items ---------------------------------- */
const buildLineItemsFlat = (recipes) => {
  const out = [];
  for (const r of recipes) {
    for (const item of r.line_items) {
      out.push({ recipe_id: r.recipe_id, ...item });
    }
  }
  return out;
};

/* --- Validate basic payload ---------------------------------------- */
const validatePayload = (body) => {
  if (!isObject(body)) return 'Body must be a JSON object.';
  if (!Array.isArray(body.recipes) || body.recipes.length === 0) {
    return '`recipes` must be a non-empty array.';
  }
  return null;
};

/* --- Parse JSON & double-encoded JSON ------------------------------ */
const parseBody = async (request) => {
  try {
    const parsed = await request.json();
    if (typeof parsed === 'string') return JSON.parse(parsed);
    return parsed;
  } catch {
    try {
      const raw = await request.text();
      if (!raw) return null;
      const first = JSON.parse(raw);
      return typeof first === 'string' ? JSON.parse(first) : first;
    } catch {
      return null;
    }
  }
};

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST requests are supported.' }), {
      status: METHOD_NOT_ALLOWED,
      headers: jsonHeaders,
    });
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

  /* Build normalized recipes */
  const recipes = [];
  let recipeIdSeq = 1;

  for (const rawRecipe of body.recipes) {
    if (!isObject(rawRecipe)) continue;

    const title = pickTitle(rawRecipe);
    if (!title) continue;

    const description = pickDescription(rawRecipe);
    const instructions = pickInstructions(rawRecipe);

    const rawItems = Array.isArray(rawRecipe.line_items ?? rawRecipe.ingredients)
      ? (rawRecipe.line_items ?? rawRecipe.ingredients)
      : [];

    const normalizedItems = [];
    for (const item of rawItems) {
      const norm = normalizeLineItem(item);
      if (norm) normalizedItems.push(norm);
    }

    const recipeRecord = {
      recipe_id: recipeIdSeq++,
      title,
      line_items: normalizedItems,
    };

    if (description) recipeRecord.description = description;
    if (instructions) recipeRecord.instructions = instructions;

    recipes.push(recipeRecord);
  }

  /* Clean summary format */
  const recipes_clean = recipes.map((r) => {
    const s = { recipe_id: r.recipe_id, title: r.title };
    if (r.description) s.description = r.description;
    if (r.instructions) s.instructions = r.instructions;
    return s;
  });

  /* Build final flat + merged lists */
  const line_items_flat = buildLineItemsFlat(recipes);
  const shopping_items_merged = buildMergedItems(line_items_flat);

  /* Final payload */
  const responsePayload = {
    shopping_list_title: shoppingListTitle,
    recipes_clean,
    line_items_flat,
    shopping_items_merged,
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: jsonHeaders,
  });
}
