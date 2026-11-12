import { AppText, Card, Screen, StatusBadge } from '@/components/ui';
import { CONSENT_VERSION, LEGAL_SECTIONS } from '@/lib/legal';

export default function Legal() {
  return (
    <Screen>
      <AppText variant="title">Términos y tratamiento de datos</AppText>
      <StatusBadge label="Proyecto académico" tone="info" icon="school-outline" />
      <AppText variant="muted">Política de tratamiento de datos personales · versión {CONSENT_VERSION}. Aplica la Ley 1581 de 2012 y el Decreto 1377 de 2013 como ejercicio académico.</AppText>
      {LEGAL_SECTIONS.map((s) => (
        <Card key={s.title}>
          <AppText variant="heading">{s.title}</AppText>
          <AppText>{s.body}</AppText>
        </Card>
      ))}
    </Screen>
  );
}
