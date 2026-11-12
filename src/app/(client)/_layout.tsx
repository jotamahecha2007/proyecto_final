import { RoleTabs } from '@/components/TabsLayout';

export default function ClientLayout() {
  return (
    <RoleTabs
      role="client"
      tabs={[
        { name: 'index', title: 'Inicio', icon: 'home-outline' },
        { name: 'services', title: 'Mis servicios', icon: 'list-outline' },
        { name: 'chats', title: 'Mensajes', icon: 'chatbubbles-outline' },
        { name: 'profile', title: 'Perfil', icon: 'person-circle-outline' },
      ]}
    />
  );
}
