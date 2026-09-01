// import { OrderForm } from "@/features/order/OrderForm";

// export default function OrderPage() {
//   return (
//     <div>
//         <OrderForm />
//     </div>
// );
// }


import { OrdersTable } from "@/features/order/orders-table";

import type { Order } from "@/types/order";

const orders: Order[] = [
  {
    order_id: 1001,
    client_id: "client_001",
    type: "website",
    page_count: 5,
    budget_range: "$500 - $1000",
    description: "Build a business website",
    status: "pending",
    cr: "2026-08-30",
    meta: {
      language: "en",
      priority: "high",
    },
  },
  {
    order_id: 1002,
    client_id: "client_002",
    type: "landing-page",
    page_count: 1,
    budget_range: "$100 - $300",
    description: "Landing page",
    status: "completed",
    cr: "2026-08-29",
    meta: {
      language: "fa",
    },
  },
];

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Orders
        </h1>

        <p className="text-muted-foreground">
          Manage customer orders.
        </p>
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}