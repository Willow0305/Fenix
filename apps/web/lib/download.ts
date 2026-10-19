'use client';

import { apiBlob, type RequestOptions } from './api-client';

/** Baixa arquivo protegido (com token) e abre no navegador sem expor URL pública. */
export async function openProtectedFile(
  path: string,
  query?: RequestOptions['query']
): Promise<void> {
  const blob = await apiBlob(path, query);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Baixa arquivo protegido salvando com o nome indicado. */
export async function downloadProtectedFile(
  path: string,
  fileName: string,
  query?: RequestOptions['query']
): Promise<void> {
  const blob = await apiBlob(path, query);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
