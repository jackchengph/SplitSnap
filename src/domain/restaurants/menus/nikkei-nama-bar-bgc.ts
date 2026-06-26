import type {
  MenuCategory,
  MenuItem,
  RestaurantMenuSnapshot
} from "../../restaurantTypes";

const restaurantId = "nikkei-nama-bar-bgc";
const verifiedAt = "2026-06-26";
const sourceUrl = "https://www.nikkei.com.ph/menu-bgc-highstreet";

type Row = {
  name: string;
  price: number | null;
  priceLabel?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pricedVariants(
  name: string,
  variants: Array<[label: string, price: number]>
): Row[] {
  return variants.map(([label, price]) => ({
    name: `${name} (${label})`,
    price
  }));
}

function category(id: string, name: string, rows: Row[]): MenuCategory {
  return {
    id,
    name,
    items: rows.map<MenuItem>((row) => ({
      id: `${id}-${slugify(row.name)}`,
      restaurantId,
      categoryId: id,
      name: row.name,
      description: "",
      price: row.price,
      priceLabel: row.priceLabel,
      requiresManualPrice: row.price === null,
      sourceUrl,
      available: true
    }))
  };
}

const traditionalJapanese: Row[] = [
  { name: "Sashimi - Salmon (4 cuts)", price: 480 },
  { name: "Sashimi - Maguro (4 cuts)", price: 300 },
  { name: "Sashimi - Prawn (4 cuts)", price: 420 },
  { name: "Sashimi - Snapper (4 cuts)", price: 320 },
  { name: "Sashimi - Tamago (4 cuts)", price: 180 },
  { name: "Nigiri - Salmon (2 pieces)", price: 280 },
  { name: "Nigiri - Unagi (2 pieces)", price: 320 },
  { name: "Nigiri - Prawn (2 pieces)", price: 250 },
  { name: "Nigiri - Maguro (2 pieces)", price: 220 },
  { name: "Nigiri - Uni (2 pieces)", price: 220 },
  { name: "Nigiri - Salmon Skin (2 pieces)", price: 150 },
  { name: "Nigiri - Snapper (2 pieces)", price: 220 },
  { name: "Nigiri - Tamago (2 pieces)", price: 140 },
  ...pricedVariants("Maki - Salmon", [
    ["5 pieces", 300],
    ["10 pieces", 595]
  ]),
  ...pricedVariants("Maki - Maguro", [
    ["5 pieces", 190],
    ["10 pieces", 380]
  ]),
  ...pricedVariants("Maki - Tamago", [
    ["5 pieces", 140],
    ["10 pieces", 280]
  ]),
  ...pricedVariants("Maki - Salmon Skin", [
    ["5 pieces", 140],
    ["10 pieces", 280]
  ]),
  { name: "Chirashi Sushi", price: 1580 },
  { name: "Chirashi Bara", price: 820 }
];

const cevicheAndTiradito: Row[] = [
  { name: "Nikkei Ceviche", price: 595 },
  { name: "Classic Ceviche", price: 595 },
  { name: "Ceviche Mixto", price: 595 },
  { name: "Salmon Ginger Tiradito", price: 280 },
  { name: "Chalaca Tiradito", price: 250 },
  { name: "Nikkei Tiradito", price: 275 }
];

const nigiriSpecials: Row[] = [
  { name: "Keiken (Experience) Nigiri Set (6 pieces)", price: 595 },
  { name: "Salmon Huevo", price: 280 },
  { name: "Truffle Salmon Nigiri", price: 300 },
  { name: "Aburi Salmon", price: 300 },
  { name: "Japanese Tofu Steak", price: 350 }
];

const rolls: Row[] = [
  ...pricedVariants("Soft Shell Crab Roll", [
    ["5 pieces", 450],
    ["10 pieces", 900]
  ]),
  ...pricedVariants("Panko Roll", [
    ["5 pieces", 360],
    ["10 pieces", 720]
  ]),
  ...pricedVariants("Smoked Salmon Roll", [
    ["5 pieces", 275],
    ["10 pieces", 545]
  ]),
  ...pricedVariants("Spicy Tuna Roll", [
    ["5 pieces", 250],
    ["10 pieces", 495]
  ]),
  ...pricedVariants("Miso Salmon Roll", [
    ["5 pieces", 300],
    ["10 pieces", 595]
  ]),
  ...pricedVariants("Unagi Asparagus Roll", [
    ["5 pieces", 395],
    ["10 pieces", 785]
  ])
];

const smallPlates: Row[] = [
  { name: "Yuzu Prawns", price: 620 },
  { name: "Honey Miso Cabbage", price: 320 },
  { name: "Kurobuta Gyoza (4 pieces)", price: 395 },
  { name: "Chipirones Fritos", price: 520 },
  { name: "Agedashi Tofu", price: 220 },
  { name: "Flamed Edamame", price: 300 },
  { name: "Truffled Edamame", price: 300 }
];

const namaDonburi: Row[] = [
  { name: "Seared Steak Bowl", price: 1350 },
  { name: "Salmon Aburi Bowl", price: 650 },
  { name: "Truffle Gyudon", price: 550 },
  { name: "Pollo Saltado Donburi", price: 495 },
  { name: "Tempura Bowl", price: 680 },
  { name: "Buta Bowl", price: 550 },
  { name: "Unagi Don", price: 950 }
];

const grillAndHotDishes: Row[] = [
  { name: "Gyu Anticucho (2 sticks)", price: 750 },
  { name: "Yakitori Platter (2 sticks each)", price: 650 },
  { name: "Pollo Anticucho (2 sticks)", price: 350 },
  { name: "Iberico Pork Ribs", price: 795 },
  { name: "Ikayaki (Grilled Squid)", price: 695 },
  { name: "Salmon Teriyaki", price: 780 },
  { name: "Chicken Teriyaki", price: 475 },
  { name: "Gyu Yakisoba", price: 595 },
  { name: "Tempura Moriawase", price: 595 },
  { name: "Char Siu Bao (Chifa Bao)", price: 340 },
  { name: "Tori Karaage", price: 420 }
];

const sidesAndDesserts: Row[] = [
  { name: "Chahan", price: 280 },
  { name: "Gohan", price: 95 },
  { name: "Matcha Deluxe", price: 495 },
  { name: "Tres Leches", price: 350 },
  { name: "Nikkei Chocolate Cake", price: 280 }
];

const nonAlcoholicBeverages: Row[] = [
  { name: "Drip Pour Over Coffee (12oz)", price: 250 },
  { name: "Triple Berry Iced Tea", price: 150 },
  { name: "Peach Iced Tea", price: 150 },
  { name: "Berries and Ginger Iced Tea", price: 150 },
  { name: "Sweet Bliss Hot Tea", price: 150 },
  { name: "Brighten Up Hot Tea", price: 150 },
  { name: "It's All Peachy Hot Tea", price: 150 },
  { name: "Matcha Tea", price: 200 },
  { name: "Perrier Sparkling Water (330ml)", price: 210 },
  { name: "Fever-Tree Tonic Water (200ml)", price: 250 },
  { name: "Fever-Tree Soda Water (200ml)", price: 250 },
  { name: "Summit Bottled Water (330ml)", price: 120 },
  { name: "Evian Still Water (330ml)", price: 250 },
  { name: "Ferrarelle Sparkling Water (330ml)", price: 220 },
  { name: "Coke Regular/Light/Zero or Sprite", price: 125 },
  { name: "Strawberry Basil Lemonade", price: 180 },
  { name: "Okinawa Lady", price: 180 },
  { name: "Jasmin and Basil Smash", price: 180 }
];

const sake: Row[] = [
  ...pricedVariants("Mutsu-Hassen Tokubetsu Junmai Red Label", [
    ["glass", 725],
    ["300ml tokkuri", 1450],
    ["720ml bottle", 3200]
  ]),
  ...pricedVariants("Kubota Senjyu Junmai Ginjo", [
    ["glass", 625],
    ["300ml tokkuri", 1250],
    ["720ml bottle", 3000]
  ]),
  { name: "Kubota Senjyu (300ml bottle)", price: 1200 },
  { name: "Manatsuru Tokubetsu Junmai (300ml bottle)", price: 1500 },
  { name: "Hakushika Ginjo Namachozo (300ml bottle)", price: 1500 },
  {
    name: "Ninki Ichi Sparkling Sake Junmai Ginjo (300ml bottle)",
    price: 1500
  },
  { name: "Dassai 45 Junmai Daiginjo (720ml bottle)", price: 4800 },
  { name: "Gekkeikan Horin Junmai Daiginjo (300ml bottle)", price: 2200 },
  { name: "Gekkeikan Nigori (720ml bottle)", price: 2800 },
  ...pricedVariants("Den En Barley Gold Label Shochu", [
    ["shot", 280],
    ["900ml bottle", 2500]
  ])
];

const cocktails: Row[] = [
  ...pricedVariants("Sake Sangria", [
    ["glass", 320],
    ["carafe", 950]
  ]),
  { name: "Norito", price: 320 },
  { name: "Hokkaido", price: 320 },
  { name: "Ruby Sake Soda", price: 320 },
  { name: "Dark Bokujo Lager", price: 320 },
  { name: "Tokyo Mule (2 for 595)", price: 595 },
  { name: "Okinawa Daiquiri", price: 320 },
  { name: "Nori Margarita", price: 420 },
  { name: "Shochu Highball", price: 320 },
  { name: "Hyogo Old Fashioned", price: 495 },
  { name: "Barrel Aged Negroni", price: 420 },
  { name: "Pisco de Chilcano", price: 495 },
  { name: "Pisco Sour", price: 495 },
  { name: "Burnt Boulevardier", price: 395 },
  { name: "Amber Highball", price: 550 },
  { name: "Velvet Amaretto", price: 350 },
  { name: "Nikkei Sour", price: 550 },
  { name: "Aperol Spritz", price: 350 },
  { name: "Botanist Gin and Tonic", price: 650 }
];

const spiritsBase: Array<[name: string, shot: number, bottle?: number]> = [
  ["Stoli", 150, 1700],
  ["Stoli Caramel", 150, 1700],
  ["Stoli Citrus", 150, 1700],
  ["Absolut Blue", 180, 1800],
  ["Tito's Handmade Vodka", 250, 2850],
  ["Belvedere Premium Vodka", 420, 5500],
  ["Bulldog London Dry Gin", 200, 2000],
  ["The Botanist", 600, 8500],
  ["Beefeater", 220, 2200],
  ["Hendricks", 520, 7200],
  ["Malfy Rosa", 395, 4000],
  ["St George Botanivore", 595, 6500],
  ["Suntory Roku", 400, 4500],
  ["Monkey 47", 695, 7200],
  ["Tanqueray Sevilla", 350, 5200],
  ["Martell VS", 380, 5500],
  ["Martell VSOP", 650, 8500],
  ["Hennessy VS", 420, 6000],
  ["Jose Cuervo Especial Reposado (Gold)", 250, 2150],
  ["Jose Cuervo Especial Silver", 250, 2150],
  ["1800 Blanco", 350, 4500],
  ["1800 Reposado", 395, 4950],
  ["1800 Anejo", 495, 7500],
  ["Olmeca Reposado", 260, 2250],
  ["Codigo Blanco", 520, 7500],
  ["Codigo Rosa Blanco", 550, 8000],
  ["Codigo Reposado", 595, 8500],
  ["Patron Silver", 550, 7800],
  ["Takara King Whisky", 220],
  ["Chita Suntory Whisky", 750],
  ["Nikka Taketsuru 21", 2700],
  ["Nikka Yoichi 15", 1850],
  ["400 Conejos Joven Espadin", 500, 6800],
  ["Alto del Carmen", 250, 2800],
  ["Luisita Oro", 200, 2000],
  ["Havana Club 7 y/o", 280, 4200],
  ["Bumbu Original", 400, 5500],
  ["Havana Club 3 Yrs", 220, 2000],
  ["Pyrat XO Reserve Rum", 450, 4500],
  ["Don Papa 7 Yrs", 300, 3600],
  ["Bushmills Original Irish Whiskey", 220, 3200],
  ["Jameson Irish Whiskey", 280, 3000],
  ["Monkey Shoulder", 320, 5500],
  ["Johnnie Walker Gold", 390, 4950],
  ["Jack Daniel's Old No.7", 300, 3600],
  ["Chivas Regal Mizunara", 450, 5500],
  ["Evan Williams Black Bourbon", 200, 2500],
  ["Buffalo Trace Bourbon", 380, 4800],
  ["Aperol", 180, 2500],
  ["Campari", 200, 2950],
  ["Disaronno Amaretto", 180, 2500],
  ["Baileys Irish Creme", 150, 2100],
  ["Kahlua", 150, 2000],
  ["Cointreau", 300, 4200],
  ["Glenmorangie 10", 450, 7000],
  ["Singleton Of Dufftown 12", 420, 5500],
  ["Darkness 8 Year Old Single Malt Sherry Cask Finish", 495],
  ["Nikka Yoichi Single Malt", 850, 11000],
  ["Glenlivet 12", 550, 7000]
];

const spirits: Row[] = spiritsBase.flatMap(([name, shot, bottle]) => [
  { name: `${name} (shot)`, price: shot },
  ...(bottle ? [{ name: `${name} (bottle)`, price: bottle }] : [])
]);

const wineAndBeer: Row[] = [
  ...pricedVariants("Chateau Gantonnet Bordeaux Blanc", [
    ["glass", 380],
    ["bottle", 1800]
  ]),
  { name: "Casamaro Rueda Verdejo (bottle)", price: 2450 },
  {
    name: "Tierra De Castilla Codice Blanco Tempranillo (bottle)",
    price: 1995
  },
  { name: "Matua Sauvignon Blanc (bottle)", price: 1800 },
  { name: "Terrazas Altos Del Plata Chardonnay (bottle)", price: 1995 },
  { name: "Cinzano Prosecco DOC (bottle)", price: 1995 },
  { name: "Chandon Brut (bottle)", price: 2500 },
  { name: "Chandon Rose (bottle)", price: 2500 },
  { name: "Franck Massard Mas Sardana Cava Brut Nature NV (bottle)", price: 1995 },
  ...pricedVariants("Wild House Pinotage", [
    ["glass", 320],
    ["bottle", 1500]
  ]),
  { name: "Finca El Origen Malbec (bottle)", price: 1850 },
  {
    name: "Tierra De Castilla Codice Tinto Tempranillo (bottle)",
    price: 1995
  },
  { name: "Penfolds Koonunga Hill Shiraz Cabernet (bottle)", price: 1995 },
  { name: "Bodegas Habla La Tierra (bottle)", price: 1995 },
  { name: "Vina Casablanca Cefiro Reserve Merlot (bottle)", price: 2500 },
  {
    name: "Casillero del Diablo Reserva Especial Cabernet Sauvignon 2021 (bottle)",
    price: 2850
  },
  { name: "Grant Burge 5th Generation Shiraz (bottle)", price: 2995 },
  { name: "Bread and Butter Merlot (bottle)", price: 3800 },
  { name: "Chateau Montreblant Saint Emillion 2016 (bottle)", price: 4950 },
  { name: "Coedo Beniaka Sweet Potato Amber", price: 550 },
  { name: "Sapporo Draft Premium", price: 250 },
  { name: "Sapporo Draft Black", price: 250 },
  { name: "Sapporo Draft Half and Half", price: 250 },
  { name: "Stella Artois", price: 280 },
  { name: "Corona", price: 220 },
  { name: "Asahi", price: 225 }
];

const promosAndSets: Row[] = [
  { name: "Happy Hour - 3 Drinks", price: 595, priceLabel: "3 for 595+" },
  {
    name: "Happy Hour - Sake Sangria",
    price: 495,
    priceLabel: "2 for 495+"
  },
  { name: "Tori Super Lunch", price: 595, priceLabel: "595+" },
  { name: "Tori Super Lunch - Chahan Upgrade", price: 100 },
  { name: "Available Bento Box - Tokyo Braised Wagyu Curry", price: 680 },
  {
    name: "Today's Specials",
    price: null,
    priceLabel: "Ask server for today's specials"
  }
];

const maketto: Row[] = [
  { name: "Soft Shell Crab Pomelo Salad", price: 450 },
  { name: "Wasabi Salmon Croquettas", price: 220 },
  { name: "Adlai Vegetable Chaufa", price: 340 },
  { name: "Nikkei Yuzu Taco (2 pieces)", price: 280 },
  ...pricedVariants("Peruvian Citrus Roll", [
    ["5 pieces", 375],
    ["10 pieces", 720]
  ]),
  { name: "Magurodon", price: 575 }
];

const snapshot: RestaurantMenuSnapshot = {
  restaurantId,
  verifiedAt,
  categories: [
    category("traditional-japanese", "Traditional Japanese", traditionalJapanese),
    category("ceviche-and-tiradito", "Ceviche and Tiradito", cevicheAndTiradito),
    category("nikkei-nigiri-specials", "Nikkei Nigiri Specials", nigiriSpecials),
    category("rolls", "Rolls", rolls),
    category("small-plates", "Small Plates", smallPlates),
    category("nama-donburi", "Nama Donburi", namaDonburi),
    category("grill-and-hot-dishes", "Grill and Hot Dishes", grillAndHotDishes),
    category("sides-and-desserts", "Sides and Desserts", sidesAndDesserts),
    category("non-alcoholic-beverages", "Non-alcoholic Beverages", nonAlcoholicBeverages),
    category("sake", "Sake", sake),
    category("cocktails", "Cocktails", cocktails),
    category("spirits", "Spirits", spirits),
    category("wine-and-beer", "Wine and Beer", wineAndBeer),
    category("promos-and-sets", "Promos and Sets", promosAndSets),
    category("maketto", "Maketto", maketto)
  ]
};

export default snapshot;
