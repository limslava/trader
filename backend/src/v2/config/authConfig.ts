const devJwtSecret = 'russian-trader-local-dev-secret';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret !== 'your-super-secret-jwt-key-here') {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  return devJwtSecret;
};
