import mongoose from 'mongoose';

// One MongoDB connection pool across Next.js server bundles and HMR (same layout as St Mary's).
const cache = globalThis.__dpvnMongo || (globalThis.__dpvnMongo = { promise: null, connection: null });
export default async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI is missing. Set it in .env.local or deployment environment.');
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
      socketTimeoutMS: 15000, maxPoolSize: 10, bufferCommands: false,
    }).then((connection) => { cache.connection = connection; return connection; })
      .catch(async (error) => { cache.connection = null; await mongoose.disconnect().catch(() => {}); throw error; })
      .finally(() => { cache.promise = null; });
  }
  return cache.promise;
}
