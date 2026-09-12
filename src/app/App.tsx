import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './router';
import { Loader } from '@/components/ui/Loader';

export default function App() {
  return (
    <AppProviders>
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
