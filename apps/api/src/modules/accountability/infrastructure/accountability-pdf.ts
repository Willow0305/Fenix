import PDFDocument from 'pdfkit';

import { formatBrl } from '../../../common/domain/money';
import type { AccountabilitySnapshot } from '../domain/accountability-snapshot';
import { verificationCode } from '../domain/accountability';

/**
 * PDF da prestação de contas (DT-103), sempre gerado a partir do retrato congelado: o mesmo
 * documento sai igual toda vez. A4, fontes padrão do PDF (acentos do português cabem nelas),
 * código de conferência e página em todas as folhas, para imprimir e mandar no WhatsApp.
 */
const MARGIN = 48;
const RED = '#9E0F16';
const INK = '#0B0613';
const MUTED = '#55505F';
const LINE = '#D9D6DE';

function civil(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-');

  return `${day}/${month}/${year}`;
}

function instant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone
  }).format(new Date(iso));
}

export function accountabilityFileName(snapshot: AccountabilitySnapshot): string {
  const version = snapshot.revision > 1 ? `-v${snapshot.revision}` : '';

  return `prestacao-de-contas-${snapshot.number}${version}.pdf`;
}

export function renderAccountabilityPdf(
  snapshot: AccountabilitySnapshot,
  hash: string
): Promise<Buffer> {
  const { content } = snapshot;
  const timeZone = content.period.timeZone;
  const title = `Prestação de contas ${snapshot.number}${snapshot.revision > 1 ? ` (versão ${snapshot.revision})` : ''}`;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN + 18, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: title,
      Author: snapshot.team.officialName,
      Subject: `Período de ${civil(content.period.from)} a ${civil(content.period.to)}`,
      Creator: 'Sistema Fênix Vôlei'
    }
  });
  const chunks: Buffer[] = [];
  const width = doc.page.width - MARGIN * 2;
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const ensureSpace = (height: number) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  /** Título da seção; `keepWith` é o espaço do que vem logo depois, para não ficar sozinho no pé. */
  const heading = (text: string, keepWith = 30) => {
    ensureSpace(48 + keepWith);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(RED).text(text.toUpperCase(), MARGIN);
    doc
      .moveTo(MARGIN, doc.y + 2)
      .lineTo(MARGIN + width, doc.y + 2)
      .strokeColor(RED)
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.5);
  };

  /** Linha de tabela: colunas com largura relativa; a última é o valor, à direita. */
  const row = (cells: readonly string[], widths: readonly number[], bold = false) => {
    const font = bold ? 'Helvetica-Bold' : 'Helvetica';

    doc.font(font).fontSize(9.5);

    const heights = cells.map((cell, index) =>
      doc.heightOfString(cell, { width: width * (widths[index] ?? 0) - 6 })
    );
    const height = Math.max(...heights, 12) + 6;

    ensureSpace(height);

    const top = doc.y;
    let x = MARGIN;

    cells.forEach((cell, index) => {
      const cellWidth = width * (widths[index] ?? 0);
      const last = index === cells.length - 1;

      doc
        .font(font)
        .fillColor(INK)
        .text(cell, x + (last ? 0 : 0), top + 3, {
          width: cellWidth - 6,
          align: last ? 'right' : 'left'
        });
      x += cellWidth;
    });
    doc
      .moveTo(MARGIN, top + height)
      .lineTo(MARGIN + width, top + height)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc.y = top + height;
    doc.x = MARGIN;
  };

  // ---------- Cabeçalho ----------
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(snapshot.team.officialName);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(RED).text(title);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MUTED)
    .text(
      `Período: ${civil(content.period.from)} a ${civil(content.period.to)} · Emitida em ${instant(snapshot.issuedAt, timeZone)} por ${snapshot.issuedBy.name}${snapshot.issuedBy.position ? ` (${snapshot.issuedBy.position})` : ''}`
    );

  if (snapshot.replaces) {
    doc
      .moveDown(0.3)
      .fillColor(RED)
      .text(
        `Esta versão substitui a versão ${snapshot.replaces.revision}. Motivo da correção: ${snapshot.replaces.reason}`
      );
  }

  doc
    .moveDown(0.3)
    .fillColor(MUTED)
    .text(
      'Documento interno da diretoria e dos atletas, gerado a partir dos lançamentos confirmados do Caixa Fênix. Entradas aparecem somadas por categoria, sem nome de quem pagou.'
    );

  // ---------- Resumo ----------
  heading('Resumo do período');
  const summary: [string, string][] = [
    ['Saldo no início do período', formatBrl(content.openingBalance.amount)],
    ...(content.openingEntries.amount !== '0.00'
      ? ([
          [
            'Saldo inicial de conta nova lançado no período',
            formatBrl(content.openingEntries.amount)
          ]
        ] as [string, string][])
      : []),
    ['(+) Entradas', formatBrl(content.income.total.amount)],
    // Travessão curto: a fonte padrão do PDF não tem o sinal de menos.
    ['(–) Saídas', formatBrl(content.expense.total.amount)],
    ['Resultado do período', formatBrl(content.result.amount)],
    ['Saldo no fim do período', formatBrl(content.closingBalance.amount)]
  ];

  summary.forEach(([label, value], index) =>
    row([label, value], [0.7, 0.3], index === 0 || index === summary.length - 1)
  );

  // ---------- Entradas ----------
  heading('Entradas por categoria');

  if (content.income.byCategory.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Nenhuma entrada no período.');
  } else {
    row(['Categoria', 'Total'], [0.7, 0.3], true);
    content.income.byCategory.forEach((item) =>
      row([item.category, formatBrl(item.total.amount)], [0.7, 0.3])
    );
    row(['Total de entradas', formatBrl(content.income.total.amount)], [0.7, 0.3], true);
  }

  // ---------- Saídas ----------
  heading('Saídas');

  if (content.expense.lines.length === 0 && content.expense.refunds.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Nenhuma saída no período.');
  } else {
    const widths = [0.14, 0.26, 0.42, 0.18];

    if (content.expense.lines.length > 0) {
      row(['Data', 'Categoria', 'Detalhe', 'Valor'], widths, true);
      content.expense.lines.forEach((line) =>
        row(
          [civil(line.date), line.category, line.detail ?? '—', formatBrl(line.amount.amount)],
          widths
        )
      );
    }

    if (content.expense.refunds.length > 0) {
      doc.moveDown(0.6);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(INK)
        .text('Estornos e devoluções a compradores e atletas (somados, sem nomes)');
      doc.moveDown(0.2);
      content.expense.refunds.forEach((item) =>
        row([item.category, formatBrl(item.total.amount)], [0.7, 0.3])
      );
    }

    row(['Total de saídas', formatBrl(content.expense.total.amount)], [0.7, 0.3], true);
  }

  // ---------- Contas ----------
  if (content.accounts.length > 0) {
    heading('Saldo por conta');
    row(['Conta', 'Início', 'Fim'], [0.5, 0.25, 0.25], true);
    content.accounts.forEach((account) =>
      row(
        [account.name, formatBrl(account.opening.amount), formatBrl(account.closing.amount)],
        [0.5, 0.25, 0.25]
      )
    );
  }

  // ---------- Observações ----------
  if (snapshot.notes) {
    heading('Observações da diretoria');
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(snapshot.notes, { width });
  }

  // ---------- Assinaturas ----------
  if (snapshot.signatories.length > 0) {
    heading('Assinaturas', 80);

    const columnWidth = (width - 24) / 2;

    for (let index = 0; index < snapshot.signatories.length; index += 2) {
      ensureSpace(70);

      const top = doc.y + 30;

      snapshot.signatories.slice(index, index + 2).forEach((person, column) => {
        const x = MARGIN + column * (columnWidth + 24);

        doc
          .moveTo(x, top)
          .lineTo(x + columnWidth, top)
          .strokeColor(INK)
          .lineWidth(0.7)
          .stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(INK)
          .text(person.name, x, top + 4, { width: columnWidth });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(MUTED)
          .text(person.position ?? 'Diretoria', x, doc.y, { width: columnWidth });
      });
      doc.y = top + 40;
      doc.x = MARGIN;
    }
  }

  // ---------- Rodapé em todas as páginas ----------
  const pages = doc.bufferedPageRange();
  const code = verificationCode(hash);

  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(pages.start + index);

    const bottom = doc.page.height - MARGIN + 4;

    // Sem margem inferior para escrever no rodapé sem abrir página nova.
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${snapshot.number}${snapshot.revision > 1 ? ` v${snapshot.revision}` : ''} · Código de conferência ${code} · Valores em reais (${content.currency}) · Página ${index + 1} de ${pages.count}`,
        MARGIN,
        bottom,
        { width, align: 'center', lineBreak: false }
      );
  }

  doc.end();

  return done;
}
