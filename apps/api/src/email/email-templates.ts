interface CodeTemplateInput {
  readonly code: string;
  readonly expiresIn: string;
}

export function passwordRecoveryTemplate(input: CodeTemplateInput) {
  return {
    subject: 'Código de recuperação — Fênix Vôlei',
    text: [
      'Recebemos uma solicitação para redefinir sua senha no Fênix Vôlei.',
      '',
      `Código: ${input.code}`,
      `Validade: ${input.expiresIn}.`,
      '',
      'Se você não solicitou a alteração, ignore esta mensagem.'
    ].join('\n')
  };
}

export function emailVerificationTemplate(input: CodeTemplateInput) {
  return {
    subject: 'Verifique seu e-mail — Fênix Vôlei',
    text: [
      'Use o código abaixo para verificar seu e-mail no Fênix Vôlei.',
      '',
      `Código: ${input.code}`,
      `Validade: ${input.expiresIn}.`,
      '',
      'O código é de uso único. Se você não reconhece esta conta, ignore a mensagem.'
    ].join('\n')
  };
}

export function securityAlertTemplate(eventDescription: string) {
  return {
    subject: 'Alerta de segurança — Fênix Vôlei',
    text: [
      'Uma alteração de segurança foi registrada na sua conta Fênix Vôlei.',
      '',
      eventDescription,
      '',
      'Se você não reconhece esta ação, use o canal oficial de segurança da organização.'
    ].join('\n')
  };
}
