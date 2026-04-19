import { z } from "zod";
import { getCategories } from "@/lib/data/categories";

async function executeGetCategories({ categoryIds }: { categoryIds?: string[] }) {
  "use step";

  const categories = getCategories(categoryIds);
  return {
    categories,
    count: categories.length,
    message: categoryIds
      ? `Found ${categories.length} categories matching requested IDs`
      : `Found ${categories.length} categories in catalog`,
  };
}

export const getCategoriesToolDef = {
  description:
    "Get all categories in the catalog, or specific categories by IDs. Returns category names, IDs, catalogs, current descriptions, and SEO data.",
  inputSchema: z.object({
    categoryIds: z
      .array(z.string())
      .optional()
      .describe("Optional array of category IDs to fetch specific categories"),
  }),
  execute: executeGetCategories,
};
