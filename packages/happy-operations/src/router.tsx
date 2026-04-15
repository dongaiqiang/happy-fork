import { Navigate, createBrowserRouter } from 'react-router-dom';
import { OperationsLayout } from './shell/OperationsLayout';
import { UsersPage } from './users/UsersPage';
import { MachinesPage } from './machines/MachinesPage';
import { QuotaPage } from './quota/QuotaPage';
import { OrdersPage } from './orders/OrdersPage';
import { AuditPage } from './audit/AuditPage';
import { OperationsPage } from './dashboard/OperationsPage';
import { PaymentChannelsPage, ProvidersPage } from './providers/ProvidersPage';
import { SettingsPage } from './settings/SettingsPage';

export const operationsRouter = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/operations" replace />,
  },
  {
    path: '/operations',
    element: <OperationsLayout />,
    children: [
      {
        index: true,
        element: <OperationsPage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
      {
        path: 'machines',
        element: <MachinesPage />,
      },
      {
        path: 'quota',
        element: <QuotaPage />,
      },
      {
        path: 'orders',
        element: <OrdersPage />,
      },
      {
        path: 'audit',
        element: <AuditPage />,
      },
      {
        path: 'providers',
        element: <ProvidersPage />,
      },
      {
        path: 'payment-channels',
        element: <PaymentChannelsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
