import pandas as pd
from pathlib import Path

# ==========================================
# EcomPulse AI - Data Analysis Engine
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw"

orders = pd.read_csv(DATA_DIR / "olist_orders_dataset.csv")

print("\n" + "=" * 60)
print("ECOMPULSE AI - ORDER INTELLIGENCE")
print("=" * 60)

# -----------------------------
# 1. Convert date columns
# -----------------------------

date_columns = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date"
]

for column in date_columns:
    orders[column] = pd.to_datetime(orders[column], errors="coerce")

# -----------------------------
# 2. Delivery analysis
# -----------------------------

delivered = orders[
    orders["order_delivered_customer_date"].notna()
].copy()

delivered["delivery_days"] = (
    delivered["order_delivered_customer_date"]
    - delivered["order_purchase_timestamp"]
).dt.total_seconds() / 86400

delivered["delivery_delay_days"] = (
    delivered["order_delivered_customer_date"]
    - delivered["order_estimated_delivery_date"]
).dt.total_seconds() / 86400

delivered["is_late"] = delivered["delivery_delay_days"] > 0

# -----------------------------
# 3. Business metrics
# -----------------------------

total_orders = len(orders)
delivered_orders = len(delivered)
late_orders = delivered["is_late"].sum()

late_rate = (
    late_orders / delivered_orders * 100
    if delivered_orders > 0 else 0
)

avg_delivery = delivered["delivery_days"].mean()
median_delivery = delivered["delivery_days"].median()

avg_delay = delivered["delivery_delay_days"].mean()

# -----------------------------
# 4. Print executive summary
# -----------------------------

print("\nEXECUTIVE SUMMARY")
print("-" * 60)

print(f"Total orders          : {total_orders:,}")
print(f"Delivered orders      : {delivered_orders:,}")
print(f"Late deliveries       : {late_orders:,}")
print(f"Late delivery rate    : {late_rate:.2f}%")
print(f"Average delivery      : {avg_delivery:.2f} days")
print(f"Median delivery       : {median_delivery:.2f} days")
print(f"Average delivery gap  : {avg_delay:.2f} days")

# -----------------------------
# 5. Order status analysis
# -----------------------------

print("\nORDER STATUS")
print("-" * 60)

status_analysis = (
    orders["order_status"]
    .value_counts()
    .to_frame("orders")
)

status_analysis["percentage"] = (
    status_analysis["orders"] / total_orders * 100
).round(2)

print(status_analysis)

# -----------------------------
# 6. Monthly order trend
# -----------------------------

orders["purchase_month"] = (
    orders["order_purchase_timestamp"]
    .dt.to_period("M")
)

monthly_orders = (
    orders.groupby("purchase_month")
    .size()
    .reset_index(name="orders")
)

print("\nMONTHLY ORDER TREND")
print("-" * 60)
print(monthly_orders.tail(12).to_string(index=False))

# -----------------------------
# 7. Save processed data
# -----------------------------

processed_dir = DATA_DIR.parent / "processed"
processed_dir.mkdir(exist_ok=True)

delivered.to_csv(
    processed_dir / "delivery_analysis.csv",
    index=False
)

monthly_orders.to_csv(
    processed_dir / "monthly_orders.csv",
    index=False
)

status_analysis.to_csv(
    processed_dir / "order_status_analysis.csv"
)

print("\n" + "=" * 60)
print("ANALYSIS COMPLETE")
print("=" * 60)

print(f"\nProcessed files saved to:")
print(processed_dir)