// Every /admin URL: the panel works out the page from the address (see AdminApp).
import { Suspense } from "react";
import { AdminApp } from "../AdminApp";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  );
}
