// Global test setup
// Set test environment variables before any tests run

process.env["NODE_ENV"] = "test";
process.env["PORT"] = "5001";
process.env["JWT_SECRET"] = "test-jwt-secret";
process.env["JWT_EXPIRES_IN"] = "1h";
process.env["JWT_REFRESH_SECRET"] = "test-jwt-refresh-secret";
process.env["JWT_REFRESH_EXPIRES_IN"] = "7d";
process.env["CLOUDINARY_CLOUD_NAME"] = "test-cloud";
process.env["CLOUDINARY_API_KEY"] = "test-api-key";
process.env["CLOUDINARY_API_SECRET"] = "test-api-secret";
process.env["ARCJET_KEY"] = "test-arcjet-key";
process.env["CORS_ORIGIN"] = "http://localhost:3000";
process.env["COOKIE_SECRET"] = "test-cookie-secret";
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/workflowhub_test";
