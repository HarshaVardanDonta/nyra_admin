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
