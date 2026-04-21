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

const ReviewsInsightsPage = lazy(() =>
  import('./pages/reviews-insights-page').then((m) => ({ default: m.ReviewsInsightsPage })),
)

const ProductsPage = lazy(() =>
  import('./pages/products-page').then((m) => ({ default: m.ProductsPage })),
)

const ProductEditorPage = lazy(() =>
  import('./pages/product-editor-page').then((m) => ({ default: m.ProductEditorPage })),
)

const ProductDetailPage = lazy(() =>
  import('./pages/product-detail-page').then((m) => ({ default: m.ProductDetailPage })),
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

const ExclusiveOffersPage = lazy(() =>
  import('./pages/exclusive-offers-page').then((m) => ({ default: m.ExclusiveOffersPage })),
)

const ExclusiveOfferEditorPage = lazy(() =>
  import('./pages/exclusive-offer-editor-page').then((m) => ({ default: m.ExclusiveOfferEditorPage })),
)

const ExclusiveOfferDetailPage = lazy(() =>
  import('./pages/exclusive-offer-detail-page').then((m) => ({ default: m.ExclusiveOfferDetailPage })),
)

const ExclusiveOfferFilterCategoriesPage = lazy(() =>
  import('./pages/exclusive-offer-filter-categories-page').then((m) => ({
    default: m.ExclusiveOfferFilterCategoriesPage,
  })),
)

const BlogsPage = lazy(() =>
  import('./pages/blogs-page').then((m) => ({ default: m.BlogsPage })),
)

const BlogEditorPage = lazy(() =>
  import('./pages/blog-editor-page').then((m) => ({ default: m.BlogEditorPage })),
)

const BlogDetailPage = lazy(() =>
  import('./pages/blog-detail-page').then((m) => ({ default: m.BlogDetailPage })),
)

const BlogPromotionsPage = lazy(() =>
  import('./pages/blog-promotions-page').then((m) => ({ default: m.BlogPromotionsPage })),
)

const FaqsPage = lazy(() =>
  import('./pages/faqs-page').then((m) => ({ default: m.FaqsPage })),
)

const HazardsPage = lazy(() =>
  import('./pages/hazards-page').then((m) => ({ default: m.HazardsPage })),
)

const BlogPromotionEditorPage = lazy(() =>
  import('./pages/blog-promotion-editor-page').then((m) => ({ default: m.BlogPromotionEditorPage })),
)

const BlogPromotionDetailPage = lazy(() =>
  import('./pages/blog-promotion-detail-page').then((m) => ({ default: m.BlogPromotionDetailPage })),
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

const DeliveryPincodeRulesPage = lazy(() =>
  import('./pages/delivery-pincode-rules-page').then((m) => ({
    default: m.DeliveryPincodeRulesPage,
  })),
)

const StoreTaxSettingsPage = lazy(() =>
  import('./pages/store-tax-settings-page').then((m) => ({
    default: m.StoreTaxSettingsPage,
  })),
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
                  path="/reviews-insights"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ReviewsInsightsPage />
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
                  path="/products/:productId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ProductDetailPage />
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
                  path="/exclusive-offers"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ExclusiveOffersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exclusive-offers/filter-categories"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ExclusiveOfferFilterCategoriesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exclusive-offers/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ExclusiveOfferEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exclusive-offers/:offerId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ExclusiveOfferEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/exclusive-offers/:offerId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <ExclusiveOfferDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blogs"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blogs/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blogs/:blogId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blogs/:blogId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog-promotions"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogPromotionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/faqs"
                  element={
                    <Suspense fallback={pageFallback}>
                      <FaqsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/hazards"
                  element={
                    <Suspense fallback={pageFallback}>
                      <HazardsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog-promotions/new"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogPromotionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog-promotions/:blogPromotionId/edit"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogPromotionEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/blog-promotions/:blogPromotionId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <BlogPromotionDetailPage />
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
                  path="/delivery-pincode-rules"
                  element={
                    <Suspense fallback={pageFallback}>
                      <DeliveryPincodeRulesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/store-tax"
                  element={
                    <Suspense fallback={pageFallback}>
                      <StoreTaxSettingsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CustomersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/users/:userId"
                  element={
                    <Suspense fallback={pageFallback}>
                      <CustomerDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/users/:userId/edit"
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
