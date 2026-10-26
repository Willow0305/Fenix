import { mailtoLink, whatsappLink } from '../lib/contact-links';
import { Icon } from './icon';

/**
 * Contato direto da diretoria com a pessoa (DT-048): abre o WhatsApp ou o e-mail de quem
 * clica. Nada passa pelo site; sem telefone ou e-mail válido, o botão não aparece.
 */
export function ContactActions({
  phone,
  email,
  who,
  subject = 'Fênix Vôlei'
}: {
  readonly phone?: string | null;
  readonly email?: string | null;
  /** Quem será contatado, para o rótulo acessível (ex.: "atleta", "responsável"). */
  readonly who: string;
  readonly subject?: string;
}) {
  const whatsapp = whatsappLink(phone);
  const mailto = mailtoLink(email, subject);

  if (!whatsapp && !mailto) {
    return null;
  }

  return (
    <span className="row gap-sm">
      {whatsapp ? (
        <a
          className="btn btn-secondary btn-sm"
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir WhatsApp do(a) ${who}`}
        >
          <Icon name="whatsapp" /> WhatsApp
        </a>
      ) : null}
      {mailto ? (
        <a
          className="btn btn-secondary btn-sm"
          href={mailto}
          aria-label={`Enviar e-mail ao(à) ${who}`}
        >
          <Icon name="envelope" /> E-mail
        </a>
      ) : null}
    </span>
  );
}
