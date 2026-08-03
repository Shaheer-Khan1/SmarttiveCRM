import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import CustomersPage from "@/pages/CustomersPage";
import CustomerDetailPage from "@/pages/CustomerDetailPage";
import OpportunitiesPage from "@/pages/OpportunitiesPage";
import NewOpportunityPage from "@/pages/NewOpportunityPage";
import OpportunityDetailPage from "@/pages/OpportunityDetailPage";
import SearchPage from "@/pages/SearchPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminProductsPage from "@/pages/AdminProductsPage";
import AdminTagsPage from "@/pages/AdminTagsPage";
import CalendarPage from "@/pages/CalendarPage";
import ProductsPage from "@/pages/ProductsPage";
import NewProductPage from "@/pages/NewProductPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import VendorsPage from "@/pages/VendorsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import MeetingNotesPage from "@/pages/MeetingNotesPage";
import NewMeetingNotePage from "@/pages/NewMeetingNotePage";
import MeetingNoteDetailPage from "@/pages/MeetingNoteDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/opportunities/new" element={<NewOpportunityPage />} />
            <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="/meeting-notes" element={<MeetingNotesPage />} />
            <Route path="/meeting-notes/new" element={<NewMeetingNotePage />} />
            <Route path="/meeting-notes/:id" element={<MeetingNoteDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<NewProductPage />} />
            <Route path="/products/vendors" element={<VendorsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/tags" element={<AdminTagsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
