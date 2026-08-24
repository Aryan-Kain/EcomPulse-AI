import pandas as pd
from pathlib import Path

# ==========================================
# EcomPulse AI - Master Dataset Builder
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

PROCESSED_DIR.mkdir(exist_ok=True)

print("\n" + "=" * 60)
print("ECOMPULSE AI - BUILDING MASTER DATASET")
print("=" * 60)

# ------------------------------------------
# 1. LOAD DATASETS
# ------------------------------------------

print("\nLoading datasets...")

orders = pd.read_csv(
    DATA_DIR / "olist_orders_dataset.csv"
)

items = pd.read_csv(
    DATA_DIR / "olist_order_items_dataset.csv"
)

products = pd.read_csv(
    DATA_DIR / "olist_products_dataset.csv"
)

customers = pd.read_csv(
    DATA_DIR / "olist_customers_dataset.csv"
)

sellers = pd.read_csv(
    DATA_DIR / "olist_sellers_dataset.csv"
)

payments = pd.read_csv(
    DATA_DIR / "olist_order_payments_dataset.csv"
)

reviews = pd.read_csv(
    DATA_DIR / "olist_order_reviews_dataset.csv"
)

translation = pd.read_csv(
    DATA_DIR / "product_category_name_translation.csv"
)

print("✓ Orders loaded")
print("✓ Items loaded")
print("✓ Products loaded")
print("✓ Customers loaded")
print("✓ Sellers loaded")
print("✓ Payments loaded")
print("✓ Reviews loaded")
print("✓ Category translation loaded")


# ------------------------------------------
# 2. CONVERT DATE COLUMNS
# ------------------------------------------

date_columns = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date"
]

for column in date_columns:
    orders[column] = pd.to_datetime(
        orders[column],
        errors="coerce"
    )


# ------------------------------------------
# 3. AGGREGATE ORDER ITEMS
# ------------------------------------------

print("\nProcessing order items...")

item_summary = (
    items.groupby("order_id")
    .agg(
        total_items=("order_item_id", "count"),
        total_product_value=("price", "sum"),
        total_freight=("freight_value", "sum"),
        unique_sellers=("seller_id", "nunique")
    )
    .reset_index()
)


# ------------------------------------------
# 4. AGGREGATE PAYMENTS
# ------------------------------------------

print("Processing payments...")

payment_summary = (
    payments.groupby("order_id")
    .agg(
        total_payment=("payment_value", "sum"),
        payment_installments=("payment_installments", "max"),
        payment_types=("payment_type", "nunique")
    )
    .reset_index()
)


# ------------------------------------------
# 5. AGGREGATE REVIEWS
# ------------------------------------------

print("Processing reviews...")

review_summary = (
    reviews.groupby("order_id")
    .agg(
        review_score=("review_score", "mean"),
        review_count=("review_id", "count")
    )
    .reset_index()
)


# ------------------------------------------
# 6. CUSTOMER INFORMATION
# ------------------------------------------

print("Processing customers...")

customer_info = customers[
    [
        "customer_id",
        "customer_unique_id",
        "customer_zip_code_prefix",
        "customer_city",
        "customer_state"
    ]
].copy()


# ------------------------------------------
# 7. SELLER INFORMATION
# ------------------------------------------

print("Processing sellers...")

seller_info = sellers[
    [
        "seller_id",
        "seller_zip_code_prefix",
        "seller_city",
        "seller_state"
    ]
].copy()


# ------------------------------------------
# 8. PRODUCT INFORMATION
# ------------------------------------------

print("Processing products...")

product_info = products[
    [
        "product_id",
        "product_category_name",
        "product_weight_g",
        "product_length_cm",
        "product_height_cm",
        "product_width_cm"
    ]
].copy()


# ------------------------------------------
# 9. TRANSLATE PRODUCT CATEGORIES
# ------------------------------------------

print("Translating product categories...")

product_info = product_info.merge(
    translation,
    on="product_category_name",
    how="left"
)

product_info["product_category_english"] = (
    product_info["product_category_name_english"]
    .fillna(product_info["product_category_name"])
)

product_info.drop(
    columns=["product_category_name_english"],
    inplace=True
)


# ------------------------------------------
# 10. BUILD MAIN ORDER DATASET
# ------------------------------------------

print("Building main order dataset...")

master = orders.merge(
    item_summary,
    on="order_id",
    how="left"
)

master = master.merge(
    payment_summary,
    on="order_id",
    how="left"
)

master = master.merge(
    review_summary,
    on="order_id",
    how="left"
)

master = master.merge(
    customer_info,
    on="customer_id",
    how="left"
)


# ------------------------------------------
# 11. BUILD ITEM-LEVEL INFORMATION
# ------------------------------------------

print("Building product and seller information...")

item_level = items[
    [
        "order_id",
        "order_item_id",
        "product_id",
        "seller_id",
        "price",
        "freight_value"
    ]
].copy()

item_level = item_level.merge(
    product_info,
    on="product_id",
    how="left"
)

item_level = item_level.merge(
    seller_info,
    on="seller_id",
    how="left"
)


# ------------------------------------------
# 12. ORDER-LEVEL PRODUCT + SELLER DETAILS
# ------------------------------------------

print("Aggregating product and seller details...")

item_details = (
    item_level.groupby("order_id")
    .agg(

        # Product categories in the order
        product_categories=(
            "product_category_english",
            lambda x: ", ".join(
                sorted(
                    set(
                        str(v)
                        for v in x
                        if pd.notna(v)
                    )
                )
            )
        ),

        # IMPORTANT:
        # Keep an actual seller_id
        seller_id=(
            "seller_id",
            "first"
        ),

        # Number of sellers involved
        seller_count=(
            "seller_id",
            "nunique"
        ),

        # Number of products
        product_count=(
            "product_id",
            "nunique"
        ),

        # Number of seller states
        seller_states=(
            "seller_state",
            "nunique"
        )
    )
    .reset_index()
)


# ------------------------------------------
# 13. MERGE ITEM DETAILS INTO MASTER
# ------------------------------------------

master = master.merge(
    item_details,
    on="order_id",
    how="left"
)


# ------------------------------------------
# 14. DELIVERY METRICS
# ------------------------------------------

print("Calculating delivery metrics...")

master["delivery_days"] = (
    master["order_delivered_customer_date"]
    - master["order_purchase_timestamp"]
).dt.total_seconds() / 86400

master["delivery_delay_days"] = (
    master["order_delivered_customer_date"]
    - master["order_estimated_delivery_date"]
).dt.total_seconds() / 86400

master["is_late"] = (
    master["delivery_delay_days"] > 0
)


# ------------------------------------------
# 15. REVENUE METRICS
# ------------------------------------------

print("Calculating revenue metrics...")

master["total_product_value"] = (
    master["total_product_value"]
    .fillna(0)
)

master["total_freight"] = (
    master["total_freight"]
    .fillna(0)
)

master["order_revenue"] = (
    master["total_product_value"]
    +
    master["total_freight"]
)


# ------------------------------------------
# 16. CUSTOMER REPEAT BEHAVIOR
# ------------------------------------------

print("Calculating customer behavior...")

master = master.sort_values(
    [
        "customer_unique_id",
        "order_purchase_timestamp"
    ]
)

master["customer_previous_orders"] = (
    master
    .groupby("customer_unique_id")
    .cumcount()
)

master["is_repeat_customer"] = (
    master["customer_previous_orders"] > 0
)


# ------------------------------------------
# 17. RESET INDEX
# ------------------------------------------

master = master.reset_index(drop=True)


# ------------------------------------------
# 18. DATA QUALITY CHECK
# ------------------------------------------

print("\nRunning data quality checks...")

print(
    f"Orders in master dataset : {len(master):,}"
)

print(
    f"Columns in master dataset: {len(master.columns):,}"
)

print(
    f"Unique orders            : "
    f"{master['order_id'].nunique():,}"
)

print(
    f"Unique customers         : "
    f"{master['customer_unique_id'].nunique():,}"
)

print(
    f"Unique sellers           : "
    f"{master['seller_id'].nunique():,}"
)

print(
    f"Unique products          : "
    f"{master['product_count'].sum():,.0f}"
)


# ------------------------------------------
# 19. SAVE MASTER DATASET
# ------------------------------------------

output_file = (
    PROCESSED_DIR
    / "master_ecommerce_dataset.csv"
)

print("\nSaving master dataset...")

master.to_csv(
    output_file,
    index=False
)


# ------------------------------------------
# 20. FINAL SUMMARY
# ------------------------------------------

print("\n" + "=" * 60)
print("MASTER DATASET CREATED")
print("=" * 60)

print(
    f"\nRows    : {len(master):,}"
)

print(
    f"Columns : {len(master.columns):,}"
)

print(
    "\nSaved to:"
)

print(output_file)

print("\nImportant columns:")

important_columns = [
    "order_id",
    "customer_id",
    "customer_unique_id",
    "seller_id",
    "product_categories",
    "order_revenue",
    "delivery_days",
    "delivery_delay_days",
    "is_late",
    "review_score",
    "customer_previous_orders",
    "is_repeat_customer"
]

for column in important_columns:

    if column in master.columns:
        print(f"✓ {column}")

print("\n" + "=" * 60)
print("EcomPulse master dataset is ready!")
print("=" * 60)