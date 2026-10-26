import { whatsappLink } from '../lib/contact-links';
import { Icon } from './icon';

/** Atalho fixo para o WhatsApp do clube nas páginas públicas (DT-048); some sem telefone. */
export function WhatsAppButton({
  phone,
  teamName
}: {
  readonly phone: string | null;
  readonly teamName: string;
}) {
  const href = whatsappLink(phone, `Olá, ${teamName}! Vim pelo site.`);

  if (!href) {
    return null;
  }

  return (
    <a
      className="whatsapp-float"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar com o Fênix no WhatsApp"
      title="Conversar no WhatsApp"
    >
      <Icon name="whatsapp" />
    </a>
  );
}
