
import React, { useMemo, useState } from "react";
import "./SalesOrders.css";

export default function SalesOrders({ data = {}, save }) {
  const orders = Array.isArray(data.salesOrders) ? data.salesOrders : [];

  // Read from the existing product/inventory data only.
  const products = useMemo(() => {
    const candidates = [
      data.products,
      data.inventory,
      data.items,
      data.stockItems,
    ];

    const source = candidates.find(Array.isArray) || [];

    return source.filter(
      (product) =>
        product &&
        (product.id != null ||
          product._id != null ||
          product.product_id != null)
    );
  }, [data]);

  const [search, setSearch] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currency = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const productId = (product) =>
    String(product.id ?? product._id ?? product.product_id);

  const productName = (product) =>
    product.name ??
    product.product_name ??
    product.title ??
    product.item_name ??
    "Unnamed product";

  const productCode = (product) =>
    product.sku ?? product.code ?? product.product_code ?? "";

  const productPrice = (product) =>
    Number(
      product.selling_price ??
        product.sale_price ??
        product.unit_price ??
        product.price ??
        product.rate ??
        0
    ) || 0;

  const productStock = (product) => {
    const value =
      product.stock_quantity ??
      product.quantity_in_stock ??
      product.available_stock ??
      product.stock ??
      product.quantity;

    return value == null ? null : Number(value);
  };

  const orderId = (order) =>
    order.id ?? order._id ?? order.reference ?? "—";

  const orderCustomer = (order) =>
    typeof order.customer === "object"
      ? order.customer?.name ?? ""
      : order.customer ??
        order.customer_name ??
        order.party_name ??
        order.party?.name ??
        "";

  const orderDate = (order) =>
    order.date ?? order.order_date ?? order.created_at ?? "";

  const getItems = (order) =>
    order.items ?? order.products ?? order.order_items ?? [];

  const getLineTotal = (item) =>
    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

  const getItemsTotal = (items) =>
    items.reduce((sum, item) => sum + getLineTotal(item), 0);

  const getOrderTotal = (order) =>
    Number(
      order.total ??
        order.total_amount ??
        order.grand_total ??
        order.amount ??
        0
    ) || 0;

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  const normalizedItems = (order) =>
    getItems(order).map((item) => ({
      productId: String(
        item.productId ??
          item.product_id ??
          item.product?.id ??
          item.product?._id ??
          ""
      ),
      name:
        item.name ??
        item.product_name ??
        item.product?.name ??
        item.product?.product_name ??
        "",
      sku: item.sku ?? item.product_code ?? "",
      quantity: Number(item.quantity ?? item.qty ?? 1) || 1,
      unitPrice: Number(
        item.unitPrice ??
          item.unit_price ??
          item.price ??
          item.rate ??
          0
      ) || 0,
    }));

  const [unusedStateGuard] = useState(false);
  void unusedStateGuard;

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return orders;

    return orders.filter((order) => {
      const searchable = [
        orderId(order),
        orderCustomer(order),
        order.status,
        orderDate(order),
        ...getItems(order).map(
          (item) => item.name ?? item.product_name ?? item.product?.name ?? ""
        ),
      ];

      return searchable.some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [orders, search]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      confirmed: orders.filter(
        (order) =>
          String(order.status).toLowerCase() === "confirmed"
      ).length,
      pending: orders.filter(
        (order) =>
          String(order.status).toLowerCase() === "pending"
      ).length,
      value: orders.reduce(
        (sum, order) => sum + getOrderTotal(order),
        0
      ),
    }),
    [orders]
  );

  const startCreate = () => {
    setError("");
    setEditingOrder({
      __isNew: true,
      customer: "",
      status: "Pending",
      date: new Date().toISOString().slice(0, 10),
      items: [],
    });
  };

  const startEdit = (order) => {
    setError("");
    setEditingOrder({
      ...order,
      __isNew: false,
      customer: orderCustomer(order),
      date: String(orderDate(order)).slice(0, 10),
      status: order.status || "Pending",
      items: normalizedItems(order),
    });
  };

  const updateOrderField = (field, value) => {
    setEditingOrder((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addProductRow = () => {
    setEditingOrder((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId: "",
          name: "",
          sku: "",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  };

  const updateProductRow = (index, field, value) => {
    setEditingOrder((current) => {
      const items = [...current.items];
      const existing = { ...items[index] };

      if (field === "productId") {
        const selected = products.find(
          (product) => productId(product) === String(value)
        );

        if (!selected) {
          items[index] = {
            ...existing,
            productId: "",
            name: "",
            sku: "",
            unitPrice: 0,
          };
        } else {
          items[index] = {
            ...existing,
            productId: productId(selected),
            name: productName(selected),
            sku: productCode(selected),
            unitPrice: productPrice(selected),
          };
        }
      } else {
        items[index] = {
          ...existing,
          [field]: value,
        };
      }

      return { ...current, items };
    });
  };

  const removeProductRow = (index) => {
    setEditingOrder((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (typeof save !== "function") {
      setError("The existing BillBook save function is not connected.");
      return;
    }

    const customer = String(editingOrder.customer ?? "").trim();

    if (!customer) {
      setError("Please enter the customer name.");
      return;
    }

    if (!editingOrder.items.length) {
      setError("Add at least one product to this sales order.");
      return;
    }

    for (const item of editingOrder.items) {
      if (!item.productId) {
        setError("Please select a product for every order row.");
        return;
      }

      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        setError("Every product quantity must be greater than zero.");
        return;
      }

      if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) {
        setError("Please enter a valid product price.");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const isNew = editingOrder.__isNew;
      const { __isNew, ...formValues } = editingOrder;

      const savedItems = formValues.items.map((item) => ({
        productId: item.productId,
        product_id: item.productId,
        name: item.name,
        product_name: item.name,
        sku: item.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unit_price: Number(item.unitPrice),
        total: getLineTotal(item),
      }));

      const total = getItemsTotal(savedItems);

      if (isNew) {
        const newOrder = {
          ...formValues,
          id: `SO_${Date.now()}`,
          customer,
          items: savedItems,
          total,
          status: formValues.status || "Pending",
          date: formValues.date || new Date().toISOString().slice(0, 10),
        };

        await save({
          ...data,
          salesOrders: [...orders, newOrder],
        });
      } else {
        const id = orderId(formValues);

        if (id === "—") {
          throw new Error("This order does not have a usable ID.");
        }

        const updatedOrders = orders.map((order) => {
          if (String(orderId(order)) !== String(id)) return order;

          return {
            ...order,
            ...formValues,
            customer,
            items: savedItems,
            total,
            status: formValues.status || order.status || "Pending",
            date: formValues.date || order.date || "",
          };
        });

        await save({
          ...data,
          salesOrders: updatedOrders,
        });
      }

      setEditingOrder(null);
    } catch (err) {
      setError(err?.message || "Unable to save the sales order.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Order ID", "Customer", "Products", "Amount", "Status", "Date"],
      ...filteredOrders.map((order) => [
        orderId(order),
        orderCustomer(order),
        getItems(order)
          .map((item) => {
            const name =
              item.name ?? item.product_name ?? item.product?.name ?? "Product";
            return `${name} x${item.quantity ?? item.qty ?? 1}`;
          })
          .join("; "),
        getOrderTotal(order),
        order.status || "Pending",
        orderDate(order),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-orders.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const currentTotal = editingOrder
    ? getItemsTotal(editingOrder.items)
    : 0;

  return (
    <div className="sales-orders-page">
      <header className="so-heading">
        <div className="so-brand">
          <div className="so-brand-icon">BB</div>
          <div>
            <div className="so-eyebrow">MY BILLBOOK</div>
            <h1>Sales Orders</h1>
            <p>Create orders with products, quantities and prices.</p>
          </div>
        </div>

        <div className="so-heading-actions">
          <button type="button" className="so-button so-outline" onClick={exportCsv}>
            Export
          </button>
          <button type="button" className="so-button so-primary" onClick={startCreate}>
            + Create Order
          </button>
        </div>
      </header>

      <section className="so-stats">
        <article className="so-stat-card">
          <span>Total Orders</span>
          <strong>{stats.total}</strong>
          <small>Orders in current data</small>
        </article>
        <article className="so-stat-card">
          <span>Confirmed</span>
          <strong>{stats.confirmed}</strong>
          <small>Confirmed orders</small>
        </article>
        <article className="so-stat-card">
          <span>Pending</span>
          <strong>{stats.pending}</strong>
          <small>Awaiting confirmation</small>
        </article>
        <article className="so-stat-card">
          <span>Total Order Value</span>
          <strong>{currency(stats.value)}</strong>
          <small>Value of loaded orders</small>
        </article>
      </section>

      <section className="so-table-card">
        <div className="so-table-toolbar">
          <div>
            <h2>Orders</h2>
            <p>Review orders and the products each customer purchased.</p>
          </div>
          <input
            className="so-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders or customers..."
            aria-label="Search sales orders"
          />
        </div>

        <div className="so-table-scroll">
          <table className="so-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Products</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, index) => {
                const items = getItems(order);

                return (
                  <tr key={order.id ?? order._id ?? index}>
                    <td className="so-reference">{orderId(order)}</td>
                    <td>{orderCustomer(order) || "—"}</td>
                    <td>
                      {items.length ? (
                        <div>
                          {items.map((item, itemIndex) => (
                            <div key={itemIndex}>
                              {item.name ??
                                item.product_name ??
                                item.product?.name ??
                                "Product"}{" "}
                              × {item.quantity ?? item.qty ?? 1}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "No product details"
                      )}
                    </td>
                    <td className="so-amount">{currency(getOrderTotal(order))}</td>
                    <td>
                      <span
                        className={
                          "so-status so-status-" +
                          String(order.status || "Pending")
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                        }
                      >
                        {order.status || "Pending"}
                      </span>
                    </td>
                    <td>{formatDate(orderDate(order))}</td>
                    <td>
                      <button
                        type="button"
                        className="so-button so-edit"
                        onClick={() => startEdit(order)}
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="so-empty">
                    {search ? "No matching orders found." : "No sales orders found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingOrder && (
        <div className="so-modal-backdrop">
          <section
            className="so-modal so-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="so-modal-title"
          >
            <div className="so-modal-heading">
              <div>
                <h2 id="so-modal-title">
                  {editingOrder.__isNew ? "Create Sales Order" : "Edit Sales Order"}
                </h2>
                <p>Select products and enter quantities for this order.</p>
              </div>
              <button
                type="button"
                className="so-close"
                disabled={saving}
                onClick={() => {
                  setEditingOrder(null);
                  setError("");
                }}
                aria-label="Close editor"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <label className="so-field">
                Customer Name
                <input
                  required
                  value={editingOrder.customer ?? ""}
                  onChange={(event) =>
                    updateOrderField("customer", event.target.value)
                  }
                  placeholder="Enter customer name"
                />
              </label>

              <label className="so-field">
                Order Date
                <input
                  type="date"
                  value={String(editingOrder.date ?? "").slice(0, 10)}
                  onChange={(event) =>
                    updateOrderField("date", event.target.value)
                  }
                />
              </label>

              <div className="so-products-heading">
                <div>
                  <h3>Order Products</h3>
                  <p>Choose products from your existing inventory.</p>
                </div>
                <button
                  type="button"
                  className="so-button so-outline"
                  onClick={addProductRow}
                  disabled={products.length === 0}
                >
                  + Add Product
                </button>
              </div>

              {products.length === 0 && (
                <div className="so-empty">
                  No products were found in the current BillBook data.
                  Check which key your Inventory module uses for its product list.
                </div>
              )}

              {editingOrder.items.map((item, index) => {
                const selectedProduct = products.find(
                  (product) => productId(product) === String(item.productId)
                );
                const stock = selectedProduct
                  ? productStock(selectedProduct)
                  : null;

                return (
                  <div className="so-product-row" key={index}>
                    <label className="so-field so-product-select">
                      Product
                      <select
                        required
                        value={item.productId}
                        onChange={(event) =>
                          updateProductRow(index, "productId", event.target.value)
                        }
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={productId(product)} value={productId(product)}>
                            {productName(product)}
                            {productCode(product) ? ` (${productCode(product)})` : ""}
                          </option>
                        ))}
                      </select>
                      {selectedProduct && stock != null && (
                        <small>Available stock: {stock}</small>
                      )}
                    </label>

                    <label className="so-field">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={item.quantity}
                        onChange={(event) =>
                          updateProductRow(index, "quantity", event.target.value)
                        }
                      />
                    </label>

                    <label className="so-field">
                      Unit Price (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateProductRow(index, "unitPrice", event.target.value)
                        }
                      />
                    </label>

                    <div className="so-line-total">
                      <span>Line Total</span>
                      <strong>{currency(getLineTotal(item))}</strong>
                    </div>

                    <button
                      type="button"
                      className="so-remove-product"
                      onClick={() => removeProductRow(index)}
                      aria-label={`Remove product row ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}

              <label className="so-field">
                Status
                <select
                  value={editingOrder.status ?? "Pending"}
                  onChange={(event) =>
                    updateOrderField("status", event.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Processing">Processing</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>

              <div className="so-order-total">
                <span>Order Total</span>
                <strong>{currency(currentTotal)}</strong>
              </div>

              {error && <div className="so-error">{error}</div>}

              <div className="so-modal-actions">
                <button
                  type="button"
                  className="so-button so-outline"
                  disabled={saving}
                  onClick={() => {
                    setEditingOrder(null);
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="so-button so-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Order"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
