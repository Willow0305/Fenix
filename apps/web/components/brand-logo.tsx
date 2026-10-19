import Image from 'next/image';

/** Brasão oficial. Usa o logo enviado pela configuração quando houver; senão, o arquivo de referência. */
export function BrandLogo({
  src,
  alt = 'Brasão Time Fênix Volleyball',
  size = 44
}: {
  readonly src?: string | undefined;
  readonly alt?: string | undefined;
  readonly size?: number;
}) {
  return (
    <Image
      src={src ?? '/brand/logo-fenix.png'}
      alt={alt}
      width={size}
      height={size}
      unoptimized={src !== undefined}
      priority
      style={{ objectFit: 'contain' }}
    />
  );
}
