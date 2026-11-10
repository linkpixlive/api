-- Taxa de saque personalizada por conta (nullable: null = usa a taxa global WITHDRAWAL_FEE_PERCENTAGE)
ALTER TABLE "users" ADD COLUMN "withdrawal_fee_percentage" DECIMAL(5,2);
