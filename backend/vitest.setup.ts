// Test env defaults so importing the full app graph (which loads token-service,
// reading JWT secrets at module load) never throws under test — even with no .env.
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
process.env.WALLET_ENCRYPTION_KEY ||= '0'.repeat(64);
