import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/auth-provider'
import { ThemeProvider } from './contexts/theme-provider'
import { ToastProvider } from './contexts/toast-provider'
import { AdminLayout } from './components/admin-layout'
import { ProtectedRoute } from './components/protected-route'
import { HomeRedirect } from './pages/home-redirect'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'

const AnalyticsPage = lazy(() =>
  import('./pages/analytics-page').then((m) => ({ default: m.AnalyticsPage })),
)

const ProductsPage = lazy(() =>
  import('./pages/products-page').then((m) => ({ default: m.ProductsPage })),
)

const ProductEditorPage = lazy(() =>
  import('./pages/product-editor-page').then((m) => ({ default: m.ProductEditorPage })),
)

const BrandsPage = lazy(() =>
  import('./pages/brands-page').then((m) => ({ default: m.BrandsPage })),
)

const BrandEditorPage = lazy(() =>
  import('./pages/brand-editor-page').then((m) => ({ default: m.BrandEditorPage })),
)

const BrandDetailPage = lazy(() =>
  import('./pages/brand-detail-page').then((m) => ({ default: m.BrandDetailPage })),
)

const CategoriesPage = lazy(() =>
  import('./pages/categories-page').then((m) => ({ default: m.CategoriesPage })),
)

const CategoryEditorPage = lazy(() =>
  import('./pages/category-editor-page').then((m) => ({ default: m.CategoryEditorPage })),
)

const CategoryDetailPage = lazy(() =>
  import('./pages/category-detail-page').then((m) => ({ default: m.CategoryDetailPage })),
)

const CollectionsPage = lazy(() =>
  import('./pages/collections-page').then((m) => ({ default: m.CollectionsPage })),
)

const CollectionEditorPage = lazy(() =>
  import('./pages/collection-editor-page').then((m) => ({ default: m.CollectionEditorPage })),
)

const CollectionDetailPage = lazy(() =>
  import('./pages/collection-detail-page').then((m) => ({ default: m.CollectionDetailPage })),
)

const PromotionsPage = lazy(() =>
  import('./pages/promotions-page').then((m) => ({ default: m.PromotionsPage })),
)

const PromotionEditorPage = lazy(() =>
  import('./pages/promotion-editor-page').then((m) => ({ default: m.PromotionEditorPage })),
)

const PromotionDetailPage = lazy(() =>
  import('./pages/promotion-detail-page').then((m) => ({ default: m.PromotionDetailPage })),
)

const OrderLifecyclePage = lazy(() =>
  import('./pages/order-lifecycle-page').then((m) => ({ default: m.OrderLifecyclePage })),
)

const OrdersPage = lazy(() =>
  import('./pages/orders-page').then((m) => ({ default: m.OrdersPage })),
)

const OrderDetailPage = lazy(() =>
  import('./pages/order-detail-page').then((m) => ({ default: m.OrderDetailPage })),
)

const CouponsPage = lazy(() =>
  import('./pages/coupons-page').then((m) => ({ default: m.CouponsPage })),
)

const CouponDetailPage = lazy(() =>
  import('./pages/coupon-detail-page').then((m) => ({ default: m.CouponDetailPage })),
)

const CouponEditorPage = lazy(() =>
  import('./pages/coupon-editor-page').then((m) => ({ default: m.CouponEditorPage })),
)

const CustomersPage = lazy(() =>
  import('./pages/customers-page').then((m) => ({ default: m.CustomersPage })),
)

const CustomerDetailPage = lazy(() =>
  import('./pages/customer-detail-page').then((m) => ({ default: m.CustomerDetailPage })),
)

const CustomerEditorPage = lazy(() =>
  import('./pages/customer-editor-page').then((m) => ({ default: m.CustomerEditorPage })),
)

const pageFallback = (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
    Loading…
  </div>
)

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<HomeRedirect />} />
              <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  path="/analytics"
                  element={
                    <Suspense fallback={pageFallback}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ProductsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/products/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ProductEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/products/:productId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ProductEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/brands"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BrandsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/brands/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BrandEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/brands/:brandId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BrandEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/brands/:brandId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BrandDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CategoriesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/categories/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CategoryEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/categories/:categoryId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CategoryEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/categories/:categoryId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CategoryDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/collections"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CollectionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/collections/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CollectionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/collections/:collectionId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CollectionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/collections/:collectionId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CollectionDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/promotions"
                  element={
                    <Suspense fallback={pageFallback}>
                      <PromotionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/promotions/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <PromotionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/promotions/:promotionId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <PromotionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/promotions/:promotionId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <PromotionDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <Suspense fallback={pageFallback}>
                      <OrdersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/orders/:orderId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <OrderDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/order-lifecycle"
                  element={
                    <Suspense fallback={pageFallback}>
                      <OrderLifecyclePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/coupons"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CouponsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/coupons/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CouponEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/coupons/:couponId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CouponEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/coupons/:couponId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CouponDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CustomersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/customers/:customerId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CustomerDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/customers/:customerId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CustomerEditorPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
