import pandas as pd
from pathlib import Path

DATA_DIR = Path("data/raw")

orders = pd.read_csv(DATA_DIR / "olist_orders_dataset.csv")

print("\n===== ECOM PULSE DATA CHECK =====")
print(f"Rows: {len(orders):,}")
print(f"Columns: {len(orders.columns)}")

print("\n===== COLUMNS =====")
print(orders.columns.tolist())

print("\n===== FIRST 5 ROWS =====")
print(orders.head())

print("\n===== DATA TYPES =====")
print(orders.dtypes)

print("\n===== MISSING VALUES =====")
print(orders.isnull().sum())

print("\n===== DUPLICATES =====")
print(f"Duplicate rows: {orders.duplicated().sum():,}")
date_columns = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]

for column in date_columns:
    orders[column] = pd.to_datetime(orders[column], errors="coerce")
    print("\n===== ORDER STATUS =====")
print(orders["order_status"].value_counts())

print("\n===== DELIVERY PERFORMANCE =====")

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

print(f"Delivered orders: {len(delivered):,}")

print(
    f"Average delivery time: "
    f"{delivered['delivery_days'].mean():.2f} days"
)

print(
    f"Median delivery time: "
    f"{delivered['delivery_days'].median():.2f} days"
)

print(
    f"Average delivery delay: "
    f"{delivered['delivery_delay_days'].mean():.2f} days"
)

late_orders = delivered[
    delivered["delivery_delay_days"] > 0
]

print(
    f"Late deliveries: "
    f"{len(late_orders):,} "
    f"({len(late_orders) / len(delivered) * 100:.2f}%)"
)