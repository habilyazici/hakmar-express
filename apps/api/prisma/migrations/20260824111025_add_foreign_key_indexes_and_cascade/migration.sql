-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- CreateIndex
CREATE INDEX "branches_city_id_idx" ON "branches"("city_id");

-- CreateIndex
CREATE INDEX "brands_category_id_idx" ON "brands"("category_id");

-- CreateIndex
CREATE INDEX "cashiers_branch_id_idx" ON "cashiers"("branch_id");

-- CreateIndex
CREATE INDEX "cities_region_id_idx" ON "cities"("region_id");

-- CreateIndex
CREATE INDEX "product_costs_region_id_idx" ON "product_costs"("region_id");

-- CreateIndex
CREATE INDEX "products_brand_code_idx" ON "products"("brand_code");

-- CreateIndex
CREATE INDEX "products_subcategory_id_idx" ON "products"("subcategory_id");

-- CreateIndex
CREATE INDEX "receipt_items_receipt_id_idx" ON "receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "receipt_items_cost_id_idx" ON "receipt_items"("cost_id");

-- CreateIndex
CREATE INDEX "receipt_items_price_id_idx" ON "receipt_items"("price_id");

-- CreateIndex
CREATE INDEX "receipts_branch_id_idx" ON "receipts"("branch_id");

-- CreateIndex
CREATE INDEX "receipts_cashier_id_idx" ON "receipts"("cashier_id");

-- CreateIndex
CREATE INDEX "receipts_customer_id_idx" ON "receipts"("customer_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
