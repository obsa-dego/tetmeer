import { db } from "./db";
import { shopItems, shopItemTranslations, shopItemPriceOptions, SUPPORTED_LOCALES } from "@shared/schema";
import { SHOP_ITEMS, DEFAULT_SHOP_DURATION } from "@shared/shop";
import * as fs from "fs";
import * as path from "path";

interface TranslationMap {
  [key: string]: string | TranslationMap;
}

function getTranslationValue(translations: TranslationMap, keyPath: string): string | null {
  const keys = keyPath.split(".");
  let current: TranslationMap | string = translations;
  
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return null;
    current = current[key] as TranslationMap | string;
    if (current === undefined) return null;
  }
  
  return typeof current === "string" ? current : null;
}

async function migrateShopItems() {
  console.log("Starting shop items migration...");
  
  const localesPath = path.join(process.cwd(), "client/src/locales");
  const localeData: Record<string, TranslationMap> = {};
  
  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(localesPath, locale, "common.json");
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      localeData[locale] = JSON.parse(content);
      console.log(`Loaded translations for ${locale}`);
    } catch (error) {
      console.warn(`Failed to load translations for ${locale}:`, error);
      localeData[locale] = {};
    }
  }
  
  let insertedItems = 0;
  let insertedTranslations = 0;
  let insertedPriceOptions = 0;
  
  for (const item of SHOP_ITEMS) {
    try {
      await db.insert(shopItems).values({
        id: item.id,
        type: item.type,
        basePrice: item.price,
        modelUrl: null,
        thumbnailUrl: null,
        previewData: null,
        isActive: true,
        isPremiumOnly: false,
        sortOrder: insertedItems,
        createdBy: null,
      }).onConflictDoNothing();
      
      insertedItems++;
      
      // Insert default price option for this item
      await db.insert(shopItemPriceOptions).values({
        itemId: item.id,
        isCustomItem: false,
        duration: DEFAULT_SHOP_DURATION,
        price: item.price,
        isDefault: true,
        sortOrder: 0,
      }).onConflictDoNothing();
      
      insertedPriceOptions++;
      
      for (const locale of SUPPORTED_LOCALES) {
        const translations = localeData[locale];
        
        const nameKey = item.nameKey.replace("shop.", "");
        const descKey = item.descriptionKey.replace("shop.", "");
        
        const name = getTranslationValue(translations, `shop.${nameKey}`);
        const description = getTranslationValue(translations, `shop.${descKey}`);
        
        if (name) {
          await db.insert(shopItemTranslations).values({
            itemId: item.id,
            locale: locale,
            name: name,
            description: description || "",
          }).onConflictDoNothing();
          
          insertedTranslations++;
        }
      }
    } catch (error) {
      console.error(`Failed to insert item ${item.id}:`, error);
    }
  }
  
  console.log(`Migration complete!`);
  console.log(`Inserted ${insertedItems} items`);
  console.log(`Inserted ${insertedTranslations} translations`);
  console.log(`Inserted ${insertedPriceOptions} price options`);
}

migrateShopItems()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
