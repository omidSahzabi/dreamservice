import { ReviewOrdersView } from "@/features/order/review-orders";

export default function ReviewOrdersPage() {
  return (
    <main
      dir="rtl"
      className="relative z-10 w-full px-4 pb-24 pt-6 sm:px-6 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <ReviewOrdersView />
      </div>
    </main>
  );
}
