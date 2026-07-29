import Image from 'next/image';

import styles from './brand-logo.module.scss';

interface BrandLogoProps {
  readonly size?: 'small' | 'medium';
}

export function BrandLogo({ size = 'small' }: BrandLogoProps) {
  return (
    <span className={`${styles.logo} ${styles[size]}`} aria-hidden="true">
      <Image
        alt=""
        fill
        priority
        sizes={size === 'medium' ? '64px' : '48px'}
        src="/brand/logo-fenix.png"
      />
    </span>
  );
}
