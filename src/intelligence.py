import pandas as pd
import numpy as np
from pathlib import Path

# ==============================================================
# ECOMPULSE AI
# BUSINESS INTELLIGENCE ENGINE
# ==============================================================

print("=" * 70)
print("              ECOMPULSE AI")
print("          BUSINESS INTELLIGENCE ENGINE")
print("=" * 70)

# ==============================================================
# PATHS
# ==============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MASTER_FILE = BASE_DIR / "data" / "processed" / "master_ecommerce_dataset.csv"
REPORT_DIR = BASE_DIR / "reports"

REPORT_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================
# LOAD DATA
# ==============================================================

df = pd.read_csv(MASTER_FILE)

print(f"\nDataset loaded: {len(df):,} orders")

# ==============================================================
# NORMALIZE COLUMN NAMES
# ==============================================================

df.columns = df.columns.str.strip()

# ==============================================================
# HELPER FUNCTIONS
# ==============================================================

def find_column(possible_names):
    """
    Find the first matching column from a list of possible names.
    """
    for name in possible_names:
        if name in df.columns:
            return name
    return None


# Detect important columns automatically
category_col = find_column([
    "product_category_english",
    "product_category_name_english",
    "product_category",
    "product_categories",
    "product_category_name"
])

seller_col = find_column([
    "seller_id"
])

customer_col = find_column([
    "customer_unique_id",
    "customer_id"
])

revenue_col = find_column([
    "order_revenue",
    "payment_value",
    "price"
])

delivery_col = find_column([
    "delivery_days"
])

delay_col = find_column([
    "delivery_delay_days"
])

review_col = find_column([
    "review_score"
])

late_col = find_column([
    "is_late"
])

# ==============================================================
# 1. CUSTOMER INTELLIGENCE
# ==============================================================

print("\n[1/5] CUSTOMER INTELLIGENCE")

if customer_col:

    customer_stats = (
        df.groupby(customer_col)
        .agg(
            total_orders=("order_id", "nunique"),
            total_revenue=(revenue_col, "sum") if revenue_col else ("order_id", "count")
        )
        .reset_index()
    )

    def classify_customer(row):

        orders = row["total_orders"]
        revenue = row["total_revenue"]

        if orders >= 5 and revenue >= 1000:
            return "VIP"

        elif revenue >= 500:
            return "High Value"

        elif orders > 1:
            return "Repeat"

        else:
            return "One-Time"

    customer_stats["customer_segment"] = customer_stats.apply(
        classify_customer,
        axis=1
    )

    print(
        customer_stats["customer_segment"]
        .value_counts()
    )

    customer_stats.to_csv(
        REPORT_DIR / "customer_intelligence.csv",
        index=False
    )

else:
    print("Customer column not found. Skipping customer intelligence.")


# ==============================================================
# 2. SELLER RISK ANALYSIS
# ==============================================================

print("\n[2/5] SELLER RISK ANALYSIS")

if seller_col:

    seller_group = df.groupby(seller_col)

    seller_stats = seller_group.agg(
        total_orders=("order_id", "nunique")
    ).reset_index()

    # Delivery performance
    if late_col:
        late_rate = (
            seller_group[late_col]
            .mean()
            .reset_index(name="late_rate")
        )

        seller_stats = seller_stats.merge(
            late_rate,
            on=seller_col,
            how="left"
        )
    else:
        seller_stats["late_rate"] = 0

    # Review performance
    if review_col:

        review_avg = (
            seller_group[review_col]
            .mean()
            .reset_index(name="average_review")
        )

        seller_stats = seller_stats.merge(
            review_avg,
            on=seller_col,
            how="left"
        )

    else:
        seller_stats["average_review"] = 0

    seller_stats["late_rate"] = seller_stats["late_rate"].fillna(0)
    seller_stats["average_review"] = seller_stats["average_review"].fillna(0)

    # Risk score
    seller_stats["risk_score"] = (
        seller_stats["late_rate"] * 70
        +
        ((5 - seller_stats["average_review"]) / 5) * 30
    )

    def seller_risk(score):

        if score >= 45:
            return "HIGH"

        elif score >= 25:
            return "MEDIUM"

        else:
            return "LOW"

    seller_stats["risk_level"] = seller_stats["risk_score"].apply(
        seller_risk
    )

    print(
        seller_stats["risk_level"]
        .value_counts()
    )

    seller_stats.to_csv(
        REPORT_DIR / "seller_risk_analysis.csv",
        index=False
    )

else:
    print("Seller column not found. Skipping seller analysis.")


# ==============================================================
# 3. PRODUCT INTELLIGENCE
# ==============================================================

print("\n[3/5] PRODUCT INTELLIGENCE")

if category_col:

    print(f"Using product category column: {category_col}")

    product_group = df.groupby(category_col)

    product_stats = product_group.agg(
        total_orders=("order_id", "nunique")
    ).reset_index()

    # Revenue
    if revenue_col:

        revenue_stats = (
            product_group[revenue_col]
            .sum()
            .reset_index(name="total_revenue")
        )

        product_stats = product_stats.merge(
            revenue_stats,
            on=category_col,
            how="left"
        )

    else:
        product_stats["total_revenue"] = 0

    # Average review
    if review_col:

        review_stats = (
            product_group[review_col]
            .mean()
            .reset_index(name="average_review")
        )

        product_stats = product_stats.merge(
            review_stats,
            on=category_col,
            how="left"
        )

    else:
        product_stats["average_review"] = 0

    # Delivery
    if delivery_col:

        delivery_stats = (
            product_group[delivery_col]
            .mean()
            .reset_index(name="average_delivery_days")
        )

        product_stats = product_stats.merge(
            delivery_stats,
            on=category_col,
            how="left"
        )

    else:
        product_stats["average_delivery_days"] = 0

    product_stats = product_stats.sort_values(
        "total_revenue",
        ascending=False
    )

    print("\nTop 10 product categories by revenue:")

    print(
        product_stats[
            [
                category_col,
                "total_orders",
                "total_revenue",
                "average_review"
            ]
        ].head(10).to_string(index=False)
    )

    product_stats.to_csv(
        REPORT_DIR / "product_intelligence.csv",
        index=False
    )

else:

    print("WARNING: Product category column not found.")

    print("\nAvailable columns containing 'product' or 'categor':")

    matching_columns = [
        col for col in df.columns
        if "product" in col.lower()
        or "categor" in col.lower()
    ]

    for col in matching_columns:
        print(f"  - {col}")

    # Create fallback product intelligence
    product_stats = pd.DataFrame()


# ==============================================================
# 4. DELIVERY INTELLIGENCE
# ==============================================================

print("\n[4/5] DELIVERY INTELLIGENCE")

if delivery_col:

    delivery_stats = df[delivery_col].describe()

    print(f"Average delivery time : {df[delivery_col].mean():.2f} days")
    print(f"Median delivery time  : {df[delivery_col].median():.2f} days")
    print(f"Maximum delivery time : {df[delivery_col].max():.2f} days")

else:

    print("Delivery days column not found.")


if delay_col:

    print(
        f"Average delivery delay: "
        f"{df[delay_col].mean():.2f} days"
    )


if late_col:

    late_orders = df[late_col].sum()

    late_percentage = (
        df[late_col].mean() * 100
    )

    print(
        f"Late orders           : "
        f"{int(late_orders):,}"
    )

    print(
        f"Late order percentage : "
        f"{late_percentage:.2f}%"
    )

# Save delivery report
delivery_columns = [
    col for col in [
        "order_id",
        "customer_id",
        seller_col,
        category_col,
        delivery_col,
        delay_col,
        late_col,
        review_col
    ]
    if col is not None and col in df.columns
]

if delivery_columns:

    df[delivery_columns].to_csv(
        REPORT_DIR / "delivery_intelligence.csv",
        index=False
    )


# ==============================================================
# 5. BUSINESS INSIGHTS
# ==============================================================

print("\n[5/5] BUSINESS INSIGHTS")

insights = []

# --------------------------------------------------------------
# Revenue
# --------------------------------------------------------------

if revenue_col:

    total_revenue = df[revenue_col].sum()

    average_order_value = df[revenue_col].mean()

    insights.append(
        f"Total revenue: {total_revenue:,.2f}"
    )

    insights.append(
        f"Average order value: {average_order_value:,.2f}"
    )

    print(
        f"Total revenue        : "
        f"{total_revenue:,.2f}"
    )

    print(
        f"Average order value  : "
        f"{average_order_value:,.2f}"
    )


# --------------------------------------------------------------
# Customers
# --------------------------------------------------------------

if customer_col:

    unique_customers = df[customer_col].nunique()

    insights.append(
        f"Unique customers: {unique_customers:,}"
    )

    print(
        f"Unique customers     : "
        f"{unique_customers:,}"
    )


# --------------------------------------------------------------
# Sellers
# --------------------------------------------------------------

if seller_col:

    unique_sellers = df[seller_col].nunique()

    insights.append(
        f"Unique sellers: {unique_sellers:,}"
    )

    print(
        f"Unique sellers       : "
        f"{unique_sellers:,}"
    )


# --------------------------------------------------------------
# Reviews
# --------------------------------------------------------------

if review_col:

    average_review = df[review_col].mean()

    insights.append(
        f"Average review score: {average_review:.2f}"
    )

    print(
        f"Average review score : "
        f"{average_review:.2f}"
    )


# --------------------------------------------------------------
# Order Status
# --------------------------------------------------------------

if "order_status" in df.columns:

    print("\nOrder status distribution:")

    status_distribution = (
        df["order_status"]
        .value_counts()
    )

    print(status_distribution)

    status_distribution.to_csv(
        REPORT_DIR / "order_status_intelligence.csv"
    )


# ==============================================================
# SAVE BUSINESS INSIGHTS
# ==============================================================

with open(
    REPORT_DIR / "business_insights.txt",
    "w",
    encoding="utf-8"
) as file:

    file.write("ECOMPULSE AI - BUSINESS INSIGHTS\n")
    file.write("=" * 60 + "\n\n")

    for insight in insights:
        file.write(insight + "\n")


# ==============================================================
# FINAL SUMMARY
# ==============================================================

print("\n" + "=" * 70)
print("              INTELLIGENCE ENGINE COMPLETE")
print("=" * 70)

print("\nReports generated in:")

print(REPORT_DIR)

print("\nGenerated reports:")

reports = [
    "customer_intelligence.csv",
    "seller_risk_analysis.csv",
    "product_intelligence.csv",
    "delivery_intelligence.csv",
    "order_status_intelligence.csv",
    "business_insights.txt"
]

for report in reports:

    report_path = REPORT_DIR / report

    if report_path.exists():
        print(f"✓ {report}")

print("\nEcomPulse AI intelligence analysis completed successfully.")
print("=" * 70)