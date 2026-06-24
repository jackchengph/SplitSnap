import type { MenuCategory, Restaurant } from "./restaurantTypes";

export const seedRestaurants: Restaurant[] = [
  {
    id: "sora-sushi",
    name: "Sora Sushi",
    cuisine: "Japanese and sushi",
    area: "BGC, Taguig",
    priceLevel: 3,
    rating: 4.8,
    imageUrl: "/restaurants/sora-sushi.webp",
    menuSource: "sample",
    menuUpdatedAt: "2026-06-25"
  },
  {
    id: "manila-table",
    name: "Manila Table",
    cuisine: "Modern Filipino",
    area: "Poblacion, Makati",
    priceLevel: 2,
    rating: 4.7,
    imageUrl: "/restaurants/manila-table.webp",
    menuSource: "sample",
    menuUpdatedAt: "2026-06-25"
  },
  {
    id: "verde-kitchen",
    name: "Verde Kitchen",
    cuisine: "Fresh bowls and Mediterranean",
    area: "Legazpi Village, Makati",
    priceLevel: 2,
    rating: 4.6,
    imageUrl: "/restaurants/verde-kitchen.webp",
    menuSource: "sample",
    menuUpdatedAt: "2026-06-25"
  }
];

export const seedMenus: Record<string, MenuCategory[]> = {
  "sora-sushi": [
    {
      id: "sushi",
      name: "Sushi",
      items: [
        {
          id: "salmon-roll",
          restaurantId: "sora-sushi",
          categoryId: "sushi",
          name: "Salmon roll",
          description: "Salmon, cucumber, sesame, and house soy.",
          price: 380,
          available: true
        },
        {
          id: "sushi-platter-menu",
          restaurantId: "sora-sushi",
          categoryId: "sushi",
          name: "Sora sharing platter",
          description: "A mixed platter for three to four people.",
          price: 1280,
          available: true
        }
      ]
    },
    {
      id: "hot-kitchen",
      name: "Hot kitchen",
      items: [
        {
          id: "tonkotsu-menu",
          restaurantId: "sora-sushi",
          categoryId: "hot-kitchen",
          name: "Tonkotsu ramen",
          description: "Pork broth, chashu, egg, and spring onion.",
          price: 620,
          available: true
        },
        {
          id: "gyoza-menu",
          restaurantId: "sora-sushi",
          categoryId: "hot-kitchen",
          name: "Pan-fried gyoza",
          description: "Six pork dumplings with citrus soy.",
          price: 320,
          available: true
        }
      ]
    }
  ],
  "manila-table": [
    {
      id: "favorites",
      name: "House favorites",
      items: [
        {
          id: "crispy-kare-kare",
          restaurantId: "manila-table",
          categoryId: "favorites",
          name: "Crispy kare-kare",
          description: "Crispy pork, peanut sauce, and bagoong.",
          price: 690,
          available: true
        },
        {
          id: "sinigang-salmon",
          restaurantId: "manila-table",
          categoryId: "favorites",
          name: "Salmon sinigang",
          description: "Tamarind broth, salmon belly, and vegetables.",
          price: 640,
          available: true
        },
        {
          id: "garlic-rice-platter",
          restaurantId: "manila-table",
          categoryId: "favorites",
          name: "Garlic rice platter",
          description: "Good for four diners.",
          price: 260,
          available: true
        }
      ]
    }
  ],
  "verde-kitchen": [
    {
      id: "bowls",
      name: "Bowls",
      items: [
        {
          id: "chicken-harvest-bowl",
          restaurantId: "verde-kitchen",
          categoryId: "bowls",
          name: "Chicken harvest bowl",
          description: "Herb chicken, grains, greens, and tahini.",
          price: 490,
          available: true
        },
        {
          id: "falafel-bowl",
          restaurantId: "verde-kitchen",
          categoryId: "bowls",
          name: "Falafel bowl",
          description: "Falafel, hummus, tomato, cucumber, and couscous.",
          price: 430,
          available: true
        }
      ]
    },
    {
      id: "shareables",
      name: "Shareables",
      items: [
        {
          id: "mezze-board",
          restaurantId: "verde-kitchen",
          categoryId: "shareables",
          name: "Verde mezze board",
          description: "Hummus, labneh, vegetables, olives, and pita.",
          price: 760,
          available: true
        }
      ]
    }
  ]
};
