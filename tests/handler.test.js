import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/index.js';

test('normalizes shopping payload with description and instructions metadata', async () => {
  const payload = {
    shopping_title: ' Weekly Plan ',
    recipes: [
      {
        title: '  Chickpea Salad  ',
        description: '  A bright, protein-packed lunch.  ',
        instructions: [
          ' Drain and rinse chickpeas. ',
          'Toss with chopped vegetables and dressing.  ',
        ],
        line_items: [
          {
            name: 'Chickpeas',
            quantity: '2',
            unit: 'cups',
            price: '1.5',
            category: 'Pantry',
            estimated_price: '1.7',
          },
          { Name: 'Lemon', Quantity: 1, Unit: 'EA', Price: 0.89, Category: 'Produce' },
        ],
      },
      {
        Title: 'Shawarma Wraps',
        Description: 'Spiced chicken with garlic sauce.',
        Instructions: '  Roast chicken, slice, and assemble in warm pitas.  ',
        ingredients: [
          { name: 'Lemon', quantity: 1, unit: 'ea', estimatedPrice: 0.9 },
        ],
      },
    ],
  };

  const request = new Request('https://example.com/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const response = await handler(request);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.shopping_list_title, 'Weekly Plan');

  assert.deepEqual(body.recipes_clean, [
    {
      recipe_id: 1,
      title: 'Chickpea Salad',
      description: 'A bright, protein-packed lunch.',
      instructions: [
        'Drain and rinse chickpeas.',
        'Toss with chopped vegetables and dressing.',
      ],
    },
    {
      recipe_id: 2,
      title: 'Shawarma Wraps',
      description: 'Spiced chicken with garlic sauce.',
      instructions: 'Roast chicken, slice, and assemble in warm pitas.',
    },
  ]);

  assert.deepEqual(body.line_items_flat, [
    {
      recipe_id: 1,
      name: 'Chickpeas',
      quantity: 2,
      unit: 'cups',
      price: 1.5,
      category: 'Pantry',
    },
    {
      recipe_id: 1,
      name: 'Lemon',
      quantity: 1,
      unit: 'ea',
      price: 0.89,
      category: 'Produce',
    },
    {
      recipe_id: 2,
      name: 'Lemon',
      quantity: 1,
      unit: 'ea',
      price: 0.9,
    },
  ]);

  assert.deepEqual(body.shopping_items_merged, [
    {
      name: 'Chickpeas',
      quantity: 2,
      unit: 'cups',
      price: 1.5,
      category: 'Pantry',
    },
    {
      name: 'Lemon',
      quantity: 2,
      unit: 'ea',
      price: 1.79,
      category: 'Produce',
    },
  ]);
});

test('handles payload provided as a JSON string body', async () => {
  const payload = {
    title: 'String Plan',
    recipes: [
      {
        title: 'Test Recipe',
        line_items: [{ name: 'Item', quantity: 1, unit: 'ea', price: 2.5 }],
      },
    ],
  };

  const request = new Request('https://example.com/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(JSON.stringify(payload)),
  });

  const response = await handler(request);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.shopping_list_title, 'String Plan');
  assert.deepEqual(body.recipes_clean, [
    { recipe_id: 1, title: 'Test Recipe' },
  ]);
  assert.deepEqual(body.line_items_flat, [
    {
      recipe_id: 1,
      name: 'Item',
      quantity: 1,
      unit: 'ea',
      price: 2.5,
    },
  ]);
});

test('rejects unsupported methods and invalid payloads', async () => {
  const getResponse = await handler(new Request('https://example.com/api', { method: 'GET' }));
  assert.equal(getResponse.status, 405);

  const postResponse = await handler(
    new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(postResponse.status, 422);
});
