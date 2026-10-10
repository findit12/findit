// Starting content of the reference lists. ReferenceService adds it when the server starts,
// only if the tables are still empty: editing this file later does not change a database that is already filled.

// Each category with its precise objects (FR-22: the precise object list follows the category).
export const SEED_CATEGORIES: Record<string, string[]> = {
  Electronics: ['Phone', 'Laptop', 'Tablet', 'Headphones', 'Charger or cable', 'Calculator'],
  'Bags and cases': ['Backpack', 'Handbag', 'Pencil case', 'Laptop sleeve'],
  Clothing: ['Jacket or coat', 'Sweater', 'Scarf', 'Cap or hat', 'Gloves'],
  'Keys and cards': ['Keys', 'Student card', 'Bank card', 'Wallet'],
  Accessories: ['Glasses', 'Watch', 'Jewellery', 'Umbrella', 'Water bottle'],
  'Books and stationery': ['Book', 'Notebook', 'USB drive'],
  Other: ['Other object'],
};

// Places on the campus.
export const SEED_PLACES: string[] = [
  'Library',
  'Cafeteria',
  'Main hall',
  'Amphitheatre',
  'Classroom',
  'Computer room',
  'Sports hall',
  'Student lounge',
  'Car park',
  'Outside the building',
];
