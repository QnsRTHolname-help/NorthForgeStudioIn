import { Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './router';
import { AuthUrlErrorHandler } from './providers/AuthUrlErrorHandler';
import { trackPageView } from '@/lib/analytics';
import { Loader } from '@/components/ui/Loader';

/** SPA page views — there are no full-page reloads to count for us. */
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <AppProviders>
      <PageViewTracker />
      <AuthUrlErrorHandler />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas"><Loader /></div>}>
        <Routes>
          {AppRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element}>
              {route.children?.map((child) => (
                <Route
                  key={child.path ?? String(child.index)}
                  index={child.index ? true : undefined}
                  path={child.path}
                  element={child.element}
                />
              ))}
            </Route>
          ))}
        </Routes>
      </Suspense>
    </AppProviders>
  );
}
