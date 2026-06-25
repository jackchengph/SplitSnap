import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const restaurants = {
  "din-tai-fung-bgc": {
    host: "https://dtf.momentfood.com",
    venueToken: "JLQoZoJfMbSZcqiTav6qztAN",
    sourceUrl: "https://dtf.momentfood.com/"
  },
  "ooma-bgc": {
    host: "https://ooma.momentfood.com",
    venueToken: "rEBfggjDHVJoi3VHhmseQaX8",
    sourceUrl: "https://ooma.momentfood.com/"
  },
  "eight-cuts-bgc": {
    host: "https://8cuts.momentfood.com",
    venueToken: "PDgqMaTCjX45n2xtQb5NMdXY",
    sourceUrl: "https://8cuts.momentfood.com/"
  }
};

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getJson(url, host) {
  const response = await fetch(url, {
    headers: {
      Origin: host,
      Referer: `${host}/`,
      "User-Agent": "SplitSnap menu verification"
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function buildRequiredVariants(item, categoryId, restaurantId, sourceUrl) {
  const requiredGroups = (item.customizations ?? []).filter(
    (customization) =>
      customization.required &&
      customization.kind === "single" &&
      customization.options?.length
  );
  const priceChangingGroup = requiredGroups.find((group) =>
    group.options.some((option) => option.price !== 0)
  );
  if (!priceChangingGroup) {
    return {
      items: [
        {
          id: item.sku.toLowerCase(),
          restaurantId,
          categoryId,
          name: item.name,
          description: "",
          price: item.price / 100,
          requiresManualPrice: false,
          sourceUrl,
          available: item.available && item.category_available
        }
      ],
      consumedOptionSkus: new Set()
    };
  }

  return {
    items: priceChangingGroup.options.map((option) => ({
      id: `${item.sku}-${option.sku}`.toLowerCase(),
      restaurantId,
      categoryId,
      name: `${item.name} - ${option.name}`,
      description: "",
      price: (item.price + option.price) / 100,
      requiresManualPrice: false,
      sourceUrl,
      available: item.available && item.category_available
    })),
    consumedOptionSkus: new Set(
      priceChangingGroup.options.map((option) => option.sku)
    )
  };
}

function collectPricedModifiers(
  item,
  restaurantId,
  sourceUrl,
  modifiers,
  consumedOptionSkus
) {
  for (const customization of item.customizations ?? []) {
    for (const option of customization.options ?? []) {
      if (option.price <= 0 || consumedOptionSkus.has(option.sku)) {
        continue;
      }
      const key = option.sku.toLowerCase();
      if (!modifiers.has(key)) {
        modifiers.set(key, {
          id: `modifier-${key}`,
          restaurantId,
          categoryId: "add-ons-and-modifiers",
          name: option.name,
          description: "",
          price: option.price / 100,
          requiresManualPrice: false,
          sourceUrl,
          available: true
        });
      }
    }
  }
}

function moduleText(snapshot) {
  return `import type { RestaurantMenuSnapshot } from "../../restaurantTypes";

const snapshot: RestaurantMenuSnapshot = ${JSON.stringify(snapshot, null, 2)};

export default snapshot;
`;
}

function auditText(manifest) {
  return `import type { MenuAuditManifest } from "../menuAudit";

const manifest: MenuAuditManifest = ${JSON.stringify(manifest, null, 2)};

export default manifest;
`;
}

async function capture(restaurantId) {
  const config = restaurants[restaurantId];
  if (!config) {
    throw new Error(`Unknown Moment restaurant: ${restaurantId}`);
  }

  const apiBase = `${config.host}/p/api/s/v2`;
  const list = await getJson(
    `${apiBase}/brand_venues/${config.venueToken}/menu/list?kind=pickup`,
    config.host
  );
  const modifiers = new Map();
  const categories = [];

  for (const category of list.categories) {
    const categoryResponse = category.items
      ? category
      : await getJson(
          `${apiBase}/brand_venues/${config.venueToken}/menu/categories/${category.token}?kind=pickup`,
          config.host
        );
    const categoryId = slug(category.name);
    const items = [];
    for (const summary of categoryResponse.items ?? []) {
      const item = await getJson(
        `${apiBase}/brand_venues/${config.venueToken}/menu/items/${summary.sku}?kind=pickup`,
        config.host
      );
      const variants = buildRequiredVariants(
        item,
        categoryId,
        restaurantId,
        config.sourceUrl
      );
      items.push(...variants.items);
      collectPricedModifiers(
        item,
        restaurantId,
        config.sourceUrl,
        modifiers,
        variants.consumedOptionSkus
      );
    }
    categories.push({ id: categoryId, name: category.name, items });
  }

  if (modifiers.size > 0) {
    categories.push({
      id: "add-ons-and-modifiers",
      name: "Add-ons and modifiers",
      items: [...modifiers.values()]
    });
  }

  const snapshot = {
    restaurantId,
    verifiedAt: "2026-06-25",
    categories
  };
  const manifest = {
    restaurantId,
    verifiedAt: "2026-06-25",
    sourceUrls: [config.sourceUrl],
    expectedCategoryCount: categories.length,
    expectedItemCount: categories.flatMap((category) => category.items).length
  };

  const root = path.resolve(import.meta.dirname, "..", "src", "domain", "restaurants");
  await mkdir(path.join(root, "menus"), { recursive: true });
  await mkdir(path.join(root, "audits"), { recursive: true });
  await writeFile(
    path.join(root, "menus", `${restaurantId}.ts`),
    moduleText(snapshot)
  );
  await writeFile(
    path.join(root, "audits", `${restaurantId}.ts`),
    auditText(manifest)
  );

  console.log(
    `${restaurantId}: ${manifest.expectedCategoryCount} categories, ${manifest.expectedItemCount} selectable rows`
  );
}

const restaurantId = process.argv[2];
if (!restaurantId) {
  throw new Error(
    `Usage: node scripts/capture-moment-menu.mjs ${Object.keys(restaurants).join("|")}`
  );
}

await capture(restaurantId);
