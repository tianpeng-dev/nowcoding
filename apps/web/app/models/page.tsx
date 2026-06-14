import { routing } from '@/i18n/routing';
import { ModelsPageContent } from '../_components/models-page-content';

export default function ModelsPage() {
  return <ModelsPageContent locale={routing.defaultLocale} />;
}
