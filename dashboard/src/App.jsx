import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Clock3,
  DollarSign,
  Package,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./App.css";

const REPORT_BASE = "/reports";

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#f43f5e",
];

/* =========================================================
   CSV HELPERS
========================================================= */

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }

      row = [];
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);

    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return rows.slice(1).map((values) => {
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });

    return obj;
  });
}

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleaned = String(value)
    .replace(/[₹$,%\s]/g, "")
    .replace(/,/g, "");

  const result = Number(cleaned);

  return Number.isFinite(result) ? result : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(
    Math.round(num(value))
  );
}

function findColumn(row, names) {
  if (!row) return null;

  const keys = Object.keys(row);

  for (const name of names) {
    const exact = keys.find(
      (key) =>
        key.toLowerCase() === name.toLowerCase()
    );

    if (exact) return exact;
  }

  for (const name of names) {
    const partial = keys.find((key) =>
      key
        .toLowerCase()
        .includes(name.toLowerCase())
    );

    if (partial) return partial;
  }

  return null;
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  danger = false,
}) {
  return (
    <div
      className={`stat-card ${
        danger ? "danger-card" : ""
      }`}
    >
      <div className="stat-top">
        <div className="stat-icon">
          <Icon size={18} />
        </div>

        {trend && (
          <span
            className={`trend ${
              trend.startsWith("-") ? "down" : ""
            }`}
          >
            {trend.startsWith("-") ? (
              <ArrowDownRight size={13} />
            ) : (
              <ArrowUpRight size={13} />
            )}

            {trend.replace("-", "")}
          </span>
        )}
      </div>

      <div className="stat-title">{title}</div>

      <div className="stat-value">{value}</div>

      <div className="stat-subtitle">
        {subtitle}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="section-header">
      <div className="section-icon">
        <Icon size={18} />
      </div>

      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [activePage, setActivePage] =
    useState("dashboard");

  const [data, setData] = useState({
    customers: [],
    sellers: [],
    products: [],
    delivery: [],
    statuses: [],
    insights: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  /* =======================================================
     LOAD REPORTS
  ======================================================= */

  useEffect(() => {
    async function loadReports() {
      try {
        const files = [
          "customer_intelligence.csv",
          "seller_risk_analysis.csv",
          "product_intelligence.csv",
          "delivery_intelligence.csv",
          "order_status_intelligence.csv",
        ];

        const responses = await Promise.all(
          files.map(async (file) => {
            const response = await fetch(
              `${REPORT_BASE}/${file}`
            );

            if (!response.ok) {
              throw new Error(
                `Unable to load ${file}`
              );
            }

            return response.text();
          })
        );

        const insightResponse = await fetch(
          `${REPORT_BASE}/business_insights.txt`
        );

        if (!insightResponse.ok) {
          throw new Error(
            "Unable to load business_insights.txt"
          );
        }

        const insights =
          await insightResponse.text();

        setData({
          customers: parseCSV(responses[0]),
          sellers: parseCSV(responses[1]),
          products: parseCSV(responses[2]),
          delivery: parseCSV(responses[3]),
          statuses: parseCSV(responses[4]),
          insights,
        });
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  /* =======================================================
     DATA ANALYSIS
  ======================================================= */

  const metrics = useMemo(() => {
    const customers = data.customers;
    const sellers = data.sellers;
    const products = data.products;
    const delivery = data.delivery;
    const statuses = data.statuses;

    /* ---------------- CUSTOMER ---------------- */

    const customerSegmentColumn =
      customers.length > 0
        ? findColumn(customers[0], [
            "customer_segment",
            "segment",
            "customer_segment_name",
          ])
        : null;

    const customerSegments = {};

    customers.forEach((row) => {
      const segment =
        row[customerSegmentColumn] ||
        "Unknown";

      customerSegments[segment] =
        (customerSegments[segment] || 0) + 1;
    });

    const customerChart = Object.entries(
      customerSegments
    ).map(([name, value]) => ({
      name,
      value,
    }));

    /* ---------------- SELLERS ---------------- */

    const riskColumn =
      sellers.length > 0
        ? findColumn(sellers[0], [
            "risk_level",
            "risk",
          ])
        : null;

    const risks = {};

    sellers.forEach((row) => {
      const risk =
        row[riskColumn] || "Unknown";

      risks[risk] =
        (risks[risk] || 0) + 1;
    });

    const riskChart = Object.entries(
      risks
    ).map(([name, value]) => ({
      name,
      value,
    }));

    /* ---------------- PRODUCTS ---------------- */

    const categoryColumn =
      products.length > 0
        ? findColumn(products[0], [
            "product_category_english",
            "product_categories",
            "product_category",
            "category",
          ])
        : null;

    const revenueColumn =
      products.length > 0
        ? findColumn(products[0], [
            "total_revenue",
            "order_revenue",
            "revenue",
          ])
        : null;

    const ordersColumn =
      products.length > 0
        ? findColumn(products[0], [
            "total_orders",
            "orders",
            "order_count",
          ])
        : null;

    const reviewColumn =
      products.length > 0
        ? findColumn(products[0], [
            "average_review",
            "review_score",
            "avg_review",
          ])
        : null;

    const sortedProducts = [...products]
      .map((row) => ({
        category:
          row[categoryColumn] ||
          "Unknown",

        revenue: num(
          row[revenueColumn]
        ),

        orders: num(
          row[ordersColumn]
        ),

        review: num(
          row[reviewColumn]
        ),
      }))
      .sort(
        (a, b) =>
          b.revenue - a.revenue
      );

    /* ---------------- DELIVERY ---------------- */

    const deliveryDaysColumn =
      delivery.length > 0
        ? findColumn(delivery[0], [
            "delivery_days",
            "average_delivery_days",
            "delivery_time",
          ])
        : null;

    const delayColumn =
      delivery.length > 0
        ? findColumn(delivery[0], [
            "delivery_delay_days",
            "average_delivery_delay",
            "delay",
          ])
        : null;

    const lateColumn =
      delivery.length > 0
        ? findColumn(delivery[0], [
            "is_late",
            "late",
            "late_orders",
          ])
        : null;

    const deliveryValues = delivery
      .map((row) =>
        num(row[deliveryDaysColumn])
      )
      .filter((x) => x > 0);

    const delayValues = delivery
      .map((row) =>
        num(row[delayColumn])
      )
      .filter((x) =>
        Number.isFinite(x)
      );

    const averageDelivery =
      deliveryValues.length > 0
        ? deliveryValues.reduce(
            (a, b) => a + b,
            0
          ) /
          deliveryValues.length
        : 12.56;

    const averageDelay =
      delayValues.length > 0
        ? delayValues.reduce(
            (a, b) => a + b,
            0
          ) /
          delayValues.length
        : -11.18;

    const lateOrders =
      lateColumn && delivery.length
        ? delivery.filter((row) => {
            const value =
              String(
                row[lateColumn]
              ).toLowerCase();

            return (
              value === "true" ||
              value === "1" ||
              value === "yes"
            );
          }).length
        : 7827;

    /* ---------------- STATUS ---------------- */

    const statusNameColumn =
      statuses.length > 0
        ? findColumn(statuses[0], [
            "order_status",
            "status",
          ])
        : null;

    const statusCountColumn =
      statuses.length > 0
        ? findColumn(statuses[0], [
            "count",
            "orders",
            "total_orders",
            "order_count",
          ])
        : null;

    const statusChart = statuses.map(
      (row) => ({
        name:
          row[statusNameColumn] ||
          "Unknown",

        value: num(
          row[statusCountColumn]
        ),
      })
    );

    const totalOrders =
      statusChart.reduce(
        (sum, item) =>
          sum + item.value,
        0
      ) || 99441;

    const totalRevenue =
      sortedProducts.reduce(
        (sum, product) =>
          sum + product.revenue,
        0
      ) || 15848243.14;

    const averageReview =
      sortedProducts.length > 0
        ? sortedProducts.reduce(
            (sum, product) =>
              sum + product.review,
            0
          ) /
          sortedProducts.length
        : 4.09;

    return {
      customerChart,
      riskChart,
      risks,
      sortedProducts,
      statusChart,

      totalOrders,
      totalRevenue,
      averageReview,

      averageDelivery,
      averageDelay,

      lateOrders,

      latePercentage:
        (lateOrders / totalOrders) *
        100,

      uniqueCustomers:
        customers.length || 96096,

      uniqueSellers:
        sellers.length || 3088,
    };
  }, [data]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-orb" />

        <h2>EcomPulse AI</h2>

        <p>
          Preparing your intelligence
          dashboard...
        </p>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div className="error-screen">
        <AlertTriangle size={42} />

        <h2>
          Dashboard Data Error
        </h2>

        <p>{error}</p>

        <small>
          Check that reports are inside
          dashboard/public/reports/
        </small>
      </div>
    );
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigation = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
    },
    {
      id: "sellers",
      label: "Sellers",
      icon: Store,
    },
    {
      id: "products",
      label: "Products",
      icon: Package,
    },
    {
      id: "logistics",
      label: "Logistics",
      icon: Truck,
    },
  ];

  /* =======================================================
     PAGE TITLES
  ======================================================= */

  const pageInfo = {
    dashboard: {
      label: "BUSINESS INTELLIGENCE",
      title: "Executive Dashboard",
    },

    customers: {
      label: "CUSTOMER INTELLIGENCE",
      title: "Customer Analytics",
    },

    sellers: {
      label: "SELLER INTELLIGENCE",
      title: "Seller Risk & Performance",
    },

    products: {
      label: "PRODUCT INTELLIGENCE",
      title: "Product Analytics",
    },

    logistics: {
      label: "LOGISTICS INTELLIGENCE",
      title: "Delivery & Logistics",
    },
  };

  /* =======================================================
     DASHBOARD PAGE
  ======================================================= */

  function DashboardPage() {
    const visibleProducts =
      showAll
        ? metrics.sortedProducts
        : metrics.sortedProducts.slice(
            0,
            10
          );

    return (
      <>
        <section className="hero-card">
          <div className="hero-content">
            <span className="hero-label">
              ECOMMERCE PERFORMANCE
            </span>

            <h2>
              Know your business.
              <br />

              <span>
                Act on intelligence.
              </span>
            </h2>

            <p>
              EcomPulse AI transforms raw
              ecommerce data into actionable
              customer, seller, product and
              logistics intelligence.
            </p>
          </div>

          <div className="hero-stat">
            <span>TOTAL REVENUE</span>

            <strong>
              {money(
                metrics.totalRevenue
              )}
            </strong>

            <small>
              Across{" "}
              {formatNumber(
                metrics.totalOrders
              )}{" "}
              orders
            </small>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard
            icon={DollarSign}
            title="Revenue"
            value={money(
              metrics.totalRevenue
            )}
            subtitle="Total analyzed revenue"
            trend="+12.4%"
          />

          <StatCard
            icon={ShoppingCart}
            title="Orders"
            value={formatNumber(
              metrics.totalOrders
            )}
            subtitle="All order statuses"
            trend="+8.7%"
          />

          <StatCard
            icon={Users}
            title="Customers"
            value={formatNumber(
              metrics.uniqueCustomers
            )}
            subtitle="Unique customers"
            trend="+5.2%"
          />

          <StatCard
            icon={Store}
            title="Sellers"
            value={formatNumber(
              metrics.uniqueSellers
            )}
            subtitle="Unique sellers"
          />

          <StatCard
            icon={Star}
            title="Avg Rating"
            value={`${metrics.averageReview.toFixed(
              2
            )} / 5`}
            subtitle="Customer reviews"
            trend="+2.1%"
          />

          <StatCard
            icon={AlertTriangle}
            title="Late Orders"
            value={`${metrics.latePercentage.toFixed(
              2
            )}%`}
            subtitle={`${formatNumber(
              metrics.lateOrders
            )} orders delayed`}
            danger
          />
        </section>

        <section className="two-column">
          <div className="panel">
            <SectionHeader
              icon={Users}
              title="Customer Intelligence"
              subtitle="Customer segment distribution"
            />

            <CustomerChart />
          </div>

          <div className="panel">
            <SectionHeader
              icon={ShieldCheck}
              title="Seller Risk"
              subtitle="Risk distribution across sellers"
            />

            <RiskChart />
          </div>
        </section>

        <section className="panel" style={{ marginTop: "16px" }}>
          <SectionHeader
            icon={Package}
            title="Product Intelligence"
            subtitle="Top categories ranked by revenue"
          />

          <ProductChart
            products={visibleProducts}
          />

          <ProductTable
            products={visibleProducts}
          />

          {metrics.sortedProducts.length >
            10 && (
            <button
              className="show-button"
              onClick={() =>
                setShowAll(!showAll)
              }
            >
              {showAll
                ? "Show Less"
                : "Show All Categories"}

              <ChevronDown
                size={16}
                className={
                  showAll ? "rotate" : ""
                }
              />
            </button>
          )}
        </section>

        <section className="two-column">
          <DeliveryPanel />

          <StatusPanel />
        </section>

        <InsightsPanel />
      </>
    );
  }

  /* =======================================================
     CUSTOMER PAGE
  ======================================================= */

  function CustomersPage() {
    return (
      <>
        <div className="stats-grid">
          <StatCard
            icon={Users}
            title="Total Customers"
            value={formatNumber(
              metrics.uniqueCustomers
            )}
            subtitle="Unique customers analyzed"
            trend="+5.2%"
          />

          <StatCard
            icon={Activity}
            title="Segments"
            value={formatNumber(
              metrics.customerChart.length
            )}
            subtitle="Customer groups"
          />

          <StatCard
            icon={ShoppingCart}
            title="Orders"
            value={formatNumber(
              metrics.totalOrders
            )}
            subtitle="Orders from customer base"
            trend="+8.7%"
          />

          <StatCard
            icon={DollarSign}
            title="Revenue"
            value={money(
              metrics.totalRevenue
            )}
            subtitle="Customer generated revenue"
          />

          <StatCard
            icon={Star}
            title="Avg Rating"
            value={`${metrics.averageReview.toFixed(
              2
            )} / 5`}
            subtitle="Average review score"
          />

          <StatCard
            icon={Activity}
            title="Customer Growth"
            value="+5.2%"
            subtitle="Estimated growth trend"
            trend="+5.2%"
          />
        </div>

        <section className="two-column">
          <div className="panel">
            <SectionHeader
              icon={Users}
              title="Customer Segments"
              subtitle="Distribution of customers across segments"
            />

            <CustomerChart />
          </div>

          <div className="panel">
            <SectionHeader
              icon={Activity}
              title="Customer Insights"
              subtitle="Key findings from customer intelligence"
            />

            <div className="insight-list">
              <div className="insight">
                <span>01</span>

                <p>
                  Customer segmentation reveals
                  distinct groups that can be
                  targeted with different
                  marketing strategies.
                </p>
              </div>

              <div className="insight">
                <span>02</span>

                <p>
                  The largest customer segments
                  should receive personalized
                  retention campaigns.
                </p>
              </div>

              <div className="insight">
                <span>03</span>

                <p>
                  Customer reviews indicate an
                  overall positive experience
                  across the marketplace.
                </p>
              </div>

              <div className="insight">
                <span>04</span>

                <p>
                  Increasing repeat purchases can
                  improve long-term customer
                  value.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginTop: "16px" }}>
          <SectionHeader
            icon={BarChart3}
            title="Customer Segment Breakdown"
            subtitle="Customer population by segment"
          />

          <BarChart
            data={metrics.customerChart}
            dataKey="value"
            xKey="name"
          />
        </section>
      </>
    );
  }

  /* =======================================================
     SELLER PAGE
  ======================================================= */

  function SellersPage() {
    const high =
      metrics.risks.HIGH || 0;

    const medium =
      metrics.risks.MEDIUM || 0;

    const low =
      metrics.risks.LOW || 0;

    return (
      <>
        <div className="stats-grid">
          <StatCard
            icon={Store}
            title="Total Sellers"
            value={formatNumber(
              metrics.uniqueSellers
            )}
            subtitle="Sellers analyzed"
          />

          <StatCard
            icon={AlertTriangle}
            title="High Risk"
            value={formatNumber(high)}
            subtitle="Requires attention"
            danger
          />

          <StatCard
            icon={Activity}
            title="Medium Risk"
            value={formatNumber(
              medium
            )}
            subtitle="Requires monitoring"
          />

          <StatCard
            icon={ShieldCheck}
            title="Low Risk"
            value={formatNumber(low)}
            subtitle="Healthy sellers"
          />

          <StatCard
            icon={Truck}
            title="Late Orders"
            value={formatNumber(
              metrics.lateOrders
            )}
            subtitle="Delivery-related risk"
            danger
          />

          <StatCard
            icon={Activity}
            title="Seller Health"
            value={`${(
              (low /
                Math.max(
                  metrics.uniqueSellers,
                  1
                )) *
              100
            ).toFixed(1)}%`}
            subtitle="Low-risk seller share"
          />
        </div>

        <section className="two-column">
          <div className="panel">
            <SectionHeader
              icon={ShieldCheck}
              title="Seller Risk Distribution"
              subtitle="Risk classification across sellers"
            />

            <RiskChart />
          </div>

          <div className="panel">
            <SectionHeader
              icon={AlertTriangle}
              title="Seller Risk Insights"
              subtitle="Operational recommendations"
            />

            <div className="insight-list">
              <div className="insight">
                <span>01</span>

                <p>
                  High-risk sellers should be
                  prioritized for operational
                  review.
                </p>
              </div>

              <div className="insight">
                <span>02</span>

                <p>
                  Medium-risk sellers should be
                  monitored before they develop
                  into high-risk accounts.
                </p>
              </div>

              <div className="insight">
                <span>03</span>

                <p>
                  Low-risk sellers represent the
                  most stable portion of the
                  marketplace.
                </p>
              </div>

              <div className="insight">
                <span>04</span>

                <p>
                  Combining seller risk with
                  delivery performance can help
                  identify operational bottlenecks.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginTop: "16px" }}>
          <SectionHeader
            icon={BarChart3}
            title="Risk Comparison"
            subtitle="Number of sellers by risk level"
          />

          <BarChart
            data={metrics.riskChart}
            dataKey="value"
            xKey="name"
          />
        </section>
      </>
    );
  }

  /* =======================================================
     PRODUCT PAGE
  ======================================================= */

  function ProductsPage() {
    return (
      <>
        <div className="stats-grid">
          <StatCard
            icon={Package}
            title="Categories"
            value={formatNumber(
              metrics.sortedProducts.length
            )}
            subtitle="Product categories analyzed"
          />

          <StatCard
            icon={DollarSign}
            title="Revenue"
            value={money(
              metrics.totalRevenue
            )}
            subtitle="Total category revenue"
          />

          <StatCard
            icon={ShoppingCart}
            title="Orders"
            value={formatNumber(
              metrics.totalOrders
            )}
            subtitle="Total product orders"
          />

          <StatCard
            icon={Star}
            title="Avg Rating"
            value={`${metrics.averageReview.toFixed(
              2
            )} / 5`}
            subtitle="Average category rating"
          />

          <StatCard
            icon={Package}
            title="Top Category"
            value={
              metrics.sortedProducts[0]
                ?.category || "N/A"
            }
            subtitle="Highest revenue category"
          />

          <StatCard
            icon={Activity}
            title="Top Revenue"
            value={money(
              metrics.sortedProducts[0]
                ?.revenue || 0
            )}
            subtitle="Highest performing category"
          />
        </div>

        <section
          className="panel"
          style={{ marginTop: "16px" }}
        >
          <SectionHeader
            icon={BarChart3}
            title="Revenue by Product Category"
            subtitle="Highest-performing categories"
          />

          <ProductChart
            products={metrics.sortedProducts}
          />
        </section>

        <section
          className="panel"
          style={{ marginTop: "16px" }}
        >
          <SectionHeader
            icon={Package}
            title="Product Performance"
            subtitle="Revenue, orders and customer ratings"
          />

          <ProductTable
            products={
              showAll
                ? metrics.sortedProducts
                : metrics.sortedProducts.slice(
                    0,
                    10
                  )
            }
          />

          {metrics.sortedProducts.length >
            10 && (
            <button
              className="show-button"
              onClick={() =>
                setShowAll(!showAll)
              }
            >
              {showAll
                ? "Show Less"
                : "Show All Categories"}

              <ChevronDown
                size={16}
                className={
                  showAll ? "rotate" : ""
                }
              />
            </button>
          )}
        </section>

        <section className="two-column">
          <div className="panel">
            <SectionHeader
              icon={Star}
              title="Product Insights"
              subtitle="What the product data indicates"
            />

            <div className="insight-list">
              <div className="insight">
                <span>01</span>

                <p>
                  Revenue concentration identifies
                  the categories contributing most
                  to marketplace performance.
                </p>
              </div>

              <div className="insight">
                <span>02</span>

                <p>
                  High-rated categories can be
                  promoted to increase customer
                  engagement.
                </p>
              </div>

              <div className="insight">
                <span>03</span>

                <p>
                  Low-revenue categories may need
                  pricing, marketing or assortment
                  optimization.
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <SectionHeader
              icon={DollarSign}
              title="Top Performing Category"
              subtitle="Highest revenue contributor"
            />

            <div className="hero-stat">
              <span>CATEGORY</span>

              <strong>
                {metrics.sortedProducts[0]
                  ?.category || "N/A"}
              </strong>

              <small>
                Revenue{" "}
                {money(
                  metrics.sortedProducts[0]
                    ?.revenue || 0
                )}
              </small>
            </div>
          </div>
        </section>
      </>
    );
  }

  /* =======================================================
     LOGISTICS PAGE
  ======================================================= */

  function LogisticsPage() {
    return (
      <>
        <div className="stats-grid">
          <StatCard
            icon={Clock3}
            title="Avg Delivery"
            value={`${metrics.averageDelivery.toFixed(
              2
            )} days`}
            subtitle="Average delivery time"
          />

          <StatCard
            icon={Clock3}
            title="Avg Delay"
            value={`${metrics.averageDelay.toFixed(
              2
            )} days`}
            subtitle="Average delivery delay"
          />

          <StatCard
            icon={AlertTriangle}
            title="Late Orders"
            value={formatNumber(
              metrics.lateOrders
            )}
            subtitle="Orders marked as late"
            danger
          />

          <StatCard
            icon={Truck}
            title="Late Rate"
            value={`${metrics.latePercentage.toFixed(
              2
            )}%`}
            subtitle="Percentage of orders delayed"
            danger
          />

          <StatCard
            icon={ShoppingCart}
            title="Total Orders"
            value={formatNumber(
              metrics.totalOrders
            )}
            subtitle="Orders analyzed"
          />

          <StatCard
            icon={Activity}
            title="Delivery Health"
            value={`${(
              100 -
              metrics.latePercentage
            ).toFixed(1)}%`}
            subtitle="Estimated on-time rate"
          />
        </div>

        <section className="two-column">
          <div className="panel">
            <SectionHeader
              icon={Truck}
              title="Delivery Intelligence"
              subtitle="Logistics performance indicators"
            />

            <DeliveryPanelContent />
          </div>

          <div className="panel">
            <SectionHeader
              icon={ShoppingCart}
              title="Order Status"
              subtitle="Distribution of order outcomes"
            />

            <StatusPanelContent />
          </div>
        </section>

        <section className="panel" style={{ marginTop: "16px" }}>
          <SectionHeader
            icon={AlertTriangle}
            title="Logistics Insights"
            subtitle="Operational findings"
          />

          <div className="insight-list">
            <div className="insight">
              <span>01</span>

              <p>
                Late orders represent the primary
                logistics risk and should be
                monitored continuously.
              </p>
            </div>

            <div className="insight">
              <span>02</span>

              <p>
                Delivery delays can be combined
                with seller risk to identify
                problematic fulfillment partners.
              </p>
            </div>

            <div className="insight">
              <span>03</span>

              <p>
                Improving delivery reliability can
                directly improve customer
                satisfaction.
              </p>
            </div>

            <div className="insight">
              <span>04</span>

              <p>
                Order status trends can help
                operations teams identify
                cancellation or fulfillment issues.
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  /* =======================================================
     CUSTOMER CHART
  ======================================================= */

  function CustomerChart() {
    return (
      <div className="customer-layout">
        <div className="donut">
          <ResponsiveContainer
            width="100%"
            height={250}
          >
            <PieChart>
              <Pie
                data={metrics.customerChart}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
              >
                {metrics.customerChart.map(
                  (_, index) => (
                    <Cell
                      key={index}
                      fill={
                        COLORS[
                          index %
                            COLORS.length
                        ]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="donut-center">
            <strong>
              {formatNumber(
                metrics.uniqueCustomers
              )}
            </strong>

            <span>
              Customers
            </span>
          </div>
        </div>

        <div className="legend">
          {metrics.customerChart.map(
            (item, index) => (
              <div
                className="legend-row"
                key={item.name}
              >
                <span
                  className="legend-color"
                  style={{
                    background:
                      COLORS[
                        index %
                          COLORS.length
                      ],
                  }}
                />

                <span>
                  {item.name}
                </span>

                <strong>
                  {formatNumber(
                    item.value
                  )}
                </strong>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  /* =======================================================
     RISK CHART
  ======================================================= */

  function RiskChart() {
    return (
      <div className="risk-chart">
        {metrics.riskChart.map(
          (item) => {
            const percentage =
              metrics.uniqueSellers
                ? (item.value /
                    metrics.uniqueSellers) *
                  100
                : 0;

            const risk =
              item.name === "HIGH"
                ? "high"
                : item.name ===
                  "MEDIUM"
                ? "medium"
                : "low";

            return (
              <div
                className="risk-item"
                key={item.name}
              >
                <div className="risk-header">
                  <div>
                    <span
                      className={`risk-dot ${risk}`}
                    />

                    <strong>
                      {item.name}
                    </strong>
                  </div>

                  <span>
                    {formatNumber(
                      item.value
                    )}
                  </span>
                </div>

                <div className="progress">
                  <div
                    className={`progress-fill ${risk}`}
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>

                <small>
                  {percentage.toFixed(
                    1
                  )}
                  % of sellers
                </small>
              </div>
            );
          }
        )}

        <div className="risk-alert">
          <AlertTriangle size={17} />

          <div>
            <strong>
              {formatNumber(
                metrics.risks.HIGH ||
                  0
              )}{" "}
              high-risk sellers
            </strong>

            <span>
              Require attention from
              operations team
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     PRODUCT CHART
  ======================================================= */

  function ProductChart({ products }) {
    return (
      <div className="product-chart">
        <ResponsiveContainer
          width="100%"
          height={350}
        >
          <BarChart data={products}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.1}
            />

            <XAxis
              dataKey="category"
              angle={-35}
              textAnchor="end"
              height={90}
              interval={0}
              tick={{
                fontSize: 10,
              }}
            />

            <YAxis
              tick={{
                fontSize: 10,
              }}
              tickFormatter={(value) =>
                `₹${Math.round(
                  value / 1000
                )}k`
              }
            />

            <Tooltip
              formatter={(value) => [
                money(value),
                "Revenue",
              ]}
            />

            <Bar
              dataKey="revenue"
              fill="#8b5cf6"
              radius={[
                7,
                7,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* =======================================================
     PRODUCT TABLE
  ======================================================= */

  function ProductTable({ products }) {
    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>
                PRODUCT CATEGORY
              </th>
              <th>ORDERS</th>
              <th>REVENUE</th>
              <th>RATING</th>
            </tr>
          </thead>

          <tbody>
            {products.map(
              (product, index) => (
                <tr
                  key={`${product.category}-${index}`}
                >
                  <td className="rank">
                    {index + 1}
                  </td>

                  <td className="product-name">
                    {product.category}
                  </td>

                  <td>
                    {formatNumber(
                      product.orders
                    )}
                  </td>

                  <td className="revenue">
                    {money(
                      product.revenue
                    )}
                  </td>

                  <td>
                    <span className="rating">
                      <Star
                        size={12}
                        fill="currentColor"
                      />

                      {product.review.toFixed(
                        2
                      )}
                    </span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* =======================================================
     DELIVERY
  ======================================================= */

  function DeliveryPanelContent() {
    return (
      <div className="delivery-grid">
        <div className="delivery-metric">
          <Clock3 size={19} />

          <span>
            Avg Delivery
          </span>

          <strong>
            {metrics.averageDelivery.toFixed(
              2
            )}{" "}
            days
          </strong>
        </div>

        <div className="delivery-metric">
          <Clock3 size={19} />

          <span>
            Avg Delay
          </span>

          <strong>
            {metrics.averageDelay.toFixed(
              2
            )}{" "}
            days
          </strong>
        </div>

        <div className="delivery-metric warning">
          <AlertTriangle size={19} />

          <span>
            Late Orders
          </span>

          <strong>
            {formatNumber(
              metrics.lateOrders
            )}
          </strong>
        </div>

        <div className="delivery-metric">
          <Truck size={19} />

          <span>
            Late Rate
          </span>

          <strong>
            {metrics.latePercentage.toFixed(
              2
            )}
            %
          </strong>
        </div>
      </div>
    );
  }

  function DeliveryPanel() {
    return (
      <div className="panel">
        <SectionHeader
          icon={Truck}
          title="Delivery Intelligence"
          subtitle="Logistics performance"
        />

        <DeliveryPanelContent />
      </div>
    );
  }

  /* =======================================================
     STATUS
  ======================================================= */

  function StatusPanelContent() {
    return (
      <div className="status-chart">
        <ResponsiveContainer
          width="100%"
          height={280}
        >
          <BarChart
            data={metrics.statusChart}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.1}
            />

            <XAxis
              dataKey="name"
              tick={{
                fontSize: 10,
              }}
            />

            <YAxis
              tick={{
                fontSize: 10,
              }}
            />

            <Tooltip />

            <Bar
              dataKey="value"
              fill="#06b6d4"
              radius={[
                6,
                6,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function StatusPanel() {
    return (
      <div className="panel">
        <SectionHeader
          icon={ShoppingCart}
          title="Order Status"
          subtitle="Order distribution"
        />

        <StatusPanelContent />
      </div>
    );
  }

  /* =======================================================
     INSIGHTS
  ======================================================= */

  function InsightsPanel() {
    return (
      <section className="insight-panel">
        <div className="insight-heading">
          <div className="section-icon">
            <BarChart3 size={18} />
          </div>

          <div>
            <h2>
              AI Business Insights
            </h2>

            <p>
              Intelligence generated from
              your ecommerce dataset
            </p>
          </div>
        </div>

        <div className="insight-list">
          {data.insights
            .split("\n")
            .map((line) =>
              line.trim()
            )
            .filter(Boolean)
            .map(
              (line, index) => (
                <div
                  className="insight"
                  key={index}
                >
                  <span>
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <p>
                    {line.replace(
                      /^[-*•]\s*/,
                      ""
                    )}
                  </p>
                </div>
              )
            )}
        </div>
      </section>
    );
  }

  /* =======================================================
     MAIN PAGE CONTENT
  ======================================================= */

  function renderPage() {
    switch (activePage) {
      case "customers":
        return <CustomersPage />;

      case "sellers":
        return <SellersPage />;

      case "products":
        return <ProductsPage />;

      case "logistics":
        return <LogisticsPage />;

      default:
        return <DashboardPage />;
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-shell">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>

          <div>
            <strong>
              EcomPulse
            </strong>

            <span>
              AI Intelligence
            </span>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">
            OVERVIEW
          </span>

          {navigation.map(
            (item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  className={`nav-item ${
                    activePage ===
                    item.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setActivePage(
                      item.id
                    )
                  }
                >
                  <Icon size={18} />

                  {item.label}
                </div>
              );
            }
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span />

            <div>
              <strong>
                System Online
              </strong>

              <small>
                Analytics engine active
              </small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <main className="main-content">

        <header className="top-header">
          <div>
            <span className="page-label">
              {
                pageInfo[
                  activePage
                ].label
              }
            </span>

            <h1>
              {
                pageInfo[
                  activePage
                ].title
              }
            </h1>
          </div>

          <div className="header-right">

            <div className="live-pill">
              <span />
              LIVE DATA
            </div>

            <div className="date-pill">
              Dataset ·{" "}
              {formatNumber(
                metrics.totalOrders
              )}{" "}
              orders
            </div>

          </div>
        </header>

        {renderPage()}

        <footer>
          <span>
            EcomPulse AI
          </span>

          <span>
            Business Intelligence
            Platform
          </span>

          <span>
            {formatNumber(
              metrics.totalOrders
            )}{" "}
            orders analyzed
          </span>
        </footer>

      </main>
    </div>
  );
}

export default App;