import { RoleTabs } from '@/components/TabsLayout';

export default function AdminLayout() {
  return (
    <RoleTabs
      role="admin"
      tabs={[
        { name: 'index', title: 'Resumen', icon: 'stats-chart-outline' },
        { name: 'users', title: 'Usuarios', icon: 'people-outline' },
        { name: 'reports', title: 'Reportes', icon: 'flag-outline' },
        { name: 'bookings', title: 'Servicios', icon: 'briefcase-outline' },
        { name: 'account', title: 'Cuenta', icon: 'person-circle-outline' },
      ]}
    />
  );
}
