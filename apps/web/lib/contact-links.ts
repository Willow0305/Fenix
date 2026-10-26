/**
 * Links de contato direto (DT-048): abrem o WhatsApp ou o programa de e-mail de quem
 * clica, sem atendimento dentro do site.
 */

/** Número internacional para o wa.me; telefones brasileiros com DDD ganham o 55. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? digits : null;
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const digits = whatsappDigits(phone);

  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function mailtoLink(email: string | null | undefined, subject?: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}
