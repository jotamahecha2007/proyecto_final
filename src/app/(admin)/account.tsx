import { useEffect, useState } from 'react';

import { AdminLogList } from '@/components/admin/AdminWidgets';
import { AccountCard, SettingsButton, LogoutButton } from '@/components/sharedScreens';
import { AppText, Card, Screen } from '@/components/ui';
import type { AdminLogEntry } from '@/lib/types';
import { subscribeAdminLog } from '@/services/admin';

export default function AdminAccount() {
  const [log, setLog] = useState<AdminLogEntry[]>([]);
  useEffect(() => subscribeAdminLog(setLog, 100), []);

  return (
    <Screen>
      <AccountCard />
      <Card>
        <AppText variant="label">Bitácora de administración</AppText>
        <AppText variant="small">Cada acción de un administrador queda registrada aquí: quién, qué, a quién y por qué.</AppText>
        <AdminLogList entries={log} />
      </Card>
      <SettingsButton />
      <LogoutButton />
    </Screen>
  );
}
