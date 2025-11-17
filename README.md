# Wellcart JS API

A lightweight Vercel Edge Function that normalizes a meal plan JSON payload into a bubble app:

- `shopping_list_title`: the normalized plan title to display alongside shopping data
- `recipes_clean`: an array of recipes with assigned `recipe_id`, optional `description`, and optional `instructions` values
- `line_items_flat`: a flattened list of all ingredients including a `recipe_id` reference and category/price metadata
- `shopping_items_merged`: a deduplicated shopping list with summed quantities and prices per ingredient/unit that preserves categories

## Deployment

Deploy the repository to Vercel. The default export in `api/index.js` is configured for the Edge runtime.

## Usage

Send a `POST` request containing a `recipes` array. Each recipe should include a `title` (or `Title`) and `line_items` (or `ingredients`) array with objects containing `name`, `quantity`, `unit`, and `price` fields. Optional `category` values on the line items are normalized, and `price` may also be provided as `estimated_price` or `estimatedPrice`—all names are treated interchangeably. The top-level payload may include a `shopping_title`, `shoppingTitle`, or `title` value for the returned `shopping_list_title`. Bodies encoded as either JSON objects or stringified JSON are accepted, and environments that pass a pre-parsed `body` property (like Next.js API routes running on the Node runtime) are supported without additional configuration.

```json
{
  "title": "Plan",
  "recipes": [
    {
      "Title": "Chickpea Salad",
      "description": "A bright, protein-packed lunch.",
      "instructions": [
        "Drain and rinse chickpeas.",
        "Toss with chopped vegetables and dressing."
      ],
      "line_items": [
        { "name": "Lemon", "quantity": 1, "unit": "ea", "price": 0.89, "category": "Produce" },
        {
          "name": "Chickpeas",
          "quantity": 2,
          "unit": "cups",
          "price": 1.5,
          "category": "Pantry"
        }
      ]
    },
    {
      "Title": "Shawarma Wraps",
      "Description": "Spiced chicken with garlic sauce.",
      "Instructions": "Roast chicken, slice, and assemble in warm pitas.",
      "line_items": [
        {
          "name": "Lemon",
          "quantity": 1,
          "unit": "ea",
          "estimatedPrice": 0.9
        }
      ]
    }
  ]
}
```

### Example response

```json
{
  "shopping_list_title": "Plan",
  "recipes_clean": [
    {
      "recipe_id": 1,
      "title": "Chickpea Salad",
      "description": "A bright, protein-packed lunch.",
      "instructions": [
        "Drain and rinse chickpeas.",
        "Toss with chopped vegetables and dressing."
      ]
    },
    {
      "recipe_id": 2,
      "title": "Shawarma Wraps",
      "description": "Spiced chicken with garlic sauce.",
      "instructions": "Roast chicken, slice, and assemble in warm pitas."
    }
  ],
  "line_items_flat": [
    {
      "recipe_id": 1,
      "name": "Lemon",
      "quantity": 1,
      "unit": "ea",
      "price": 0.89,
      "category": "Produce"
    },
    {
      "recipe_id": 1,
      "name": "Chickpeas",
      "quantity": 2,
      "unit": "cups",
      "price": 1.5,
      "category": "Pantry"
    },
    {
      "recipe_id": 2,
      "name": "Lemon",
      "quantity": 1,
      "unit": "ea",
      "price": 0.9
    }
  ],
  "shopping_items_merged": [
    {
      "name": "Chickpeas",
      "quantity": 2,
      "unit": "cups",
      "price": 1.5,
      "category": "Pantry"
    },
    {
      "name": "Lemon",
      "quantity": 2,
      "unit": "ea",
      "price": 1.79,
      "category": "Produce"
    }
  ]
}
```

### Error responses

- `422` – Returned when the payload cannot be parsed or does not contain a `recipes` array.
- `405` – Returned when a method other than `POST` is used.

## integration

1. Send the meal plan JSON to the deployed endpoint.
2. Schedule a backend function on the returned `recipes_clean` list to create `Recipe` object while storing the `recipe_id` as `external_recipe_id`.
3. Schedule a backend function on the `line_items_flat` list to create `Line Item` object. Match each item to a `Recipe` using the shared `recipe_id`/`external_recipe_id` values.
4. Display recipes in a list and nest a list filtered by the linked recipe to show its line items.
5. Use `shopping_items_merged` to drive a deduplicated shopping cart or Instacart API POST Endpoint.
