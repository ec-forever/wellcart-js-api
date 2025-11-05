# Wellcart JS API

A lightweight Vercel Edge Function that normalizes a meal plan JSON payload into:

- `recipes_clean`: an array of recipes with assigned `recipe_id` values
- `line_items_flat`: a flattened list of all ingredients including a `recipe_id` reference
- `shopping_items_merged`: a deduplicated shopping list with summed quantities per ingredient/unit

## Deployment

Deploy the repository to Vercel. The default export in `api/index.js` is configured for the Edge runtime.

## Usage

Send a `POST` request containing a `recipes` array. Each recipe should include a `title` (or `Title`) and `line_items` (or `ingredients`) array with objects containing `name`, `quantity`, and `unit` fields.

```json
{
  "title": "Plan",
  "recipes": [
    {
      "Title": "Chickpea Salad",
      "line_items": [
        { "name": "Lemon", "quantity": 1, "unit": "ea" },
        { "name": "Chickpeas", "quantity": 2, "unit": "cups" }
      ]
    },
    {
      "Title": "Shawarma Wraps",
      "line_items": [
        { "name": "Lemon", "quantity": 1, "unit": "ea" }
      ]
    }
  ]
}
```

### Example response

```json
{
  "recipes_clean": [
    { "recipe_id": 1, "title": "Chickpea Salad" },
    { "recipe_id": 2, "title": "Shawarma Wraps" }
  ],
  "line_items_flat": [
    { "recipe_id": 1, "name": "Lemon", "quantity": 1, "unit": "ea" },
    { "recipe_id": 1, "name": "Chickpeas", "quantity": 2, "unit": "cups" },
    { "recipe_id": 2, "name": "Lemon", "quantity": 1, "unit": "ea" }
  ],
  "shopping_items_merged": [
    { "name": "Chickpeas", "quantity": 2, "unit": "cups" },
    { "name": "Lemon", "quantity": 2, "unit": "ea" }
  ]
}
```

### Error responses

- `422` – Returned when the payload cannot be parsed or does not contain a `recipes` array.
- `405` – Returned when a method other than `POST` is used.

## Bubble integration

1. Use the Bubble API Connector to send the meal plan JSON to the deployed endpoint.
2. Schedule a backend workflow on the returned `recipes_clean` list to create `Recipe` things while storing the `recipe_id` as `external_recipe_id`.
3. Schedule a backend workflow on the `line_items_flat` list to create `Line Item` things. Match each item to a `Recipe` using the shared `recipe_id`/`external_recipe_id` values.
4. Display recipes in a repeating group and nest a repeating group filtered by the linked recipe to show its line items.
5. Use `shopping_items_merged` to drive a deduplicated shopping cart or Instacart UI.
