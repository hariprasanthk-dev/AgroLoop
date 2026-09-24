// Runs before any test module is imported, so config/env.ts validates these
// values instead of reading the developer's real .env file.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://placeholder-overridden-by-memory-server";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "test-razorpay-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
process.env.CLIENT_URL = "http://localhost:5173";
