/**
 * Global test setup — runs before every test file.
 *
 * - Load test environment variables
 * - Any global mocks (Prisma, external services) go here
 */
import 'dotenv/config';

// Override NODE_ENV for the test suite
process.env['NODE_ENV'] = 'test';

// Stub out env vars that must pass validation during tests.
// Replace these with a proper .env.test file as needed.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/dvs_test';
process.env['JWT_SECRET'] ??= 'test-jwt-secret-32-characters-minimum-for-tests';
process.env['REFRESH_TOKEN_SECRET'] ??= 'test-refresh-secret-32-chars-minimum-for-tests';
