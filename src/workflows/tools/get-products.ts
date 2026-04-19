import { z } from "zod";
import { getProducts } from "@/lib/data/products";

async function executeGetProducts({ categoryId }: { categoryId?: string }) {
  "use step";

  const products = getProducts(categoryId);
  return {
    products,
    count: products.length,
    message: categoryId
      ? `Found ${products.length} products in category "${categoryId}"`
      : `Found ${products.length} products in catalog`,
  };
}

export const getProductsToolDef = {
  description:
    "Get all products in the catalog, or filter by category ID. Returns product names, SKUs, categories, current descriptions, and SEO data.",
  inputSchema: z.object({
    categoryId: z
      .string()
      .optional()
      .describe("Optional category ID to filter products (e.g. 'electronics', 'sports')"),
  }),
  execute: executeGetProducts,
};
