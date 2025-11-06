import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
// DB da ma'lumotlar bo'lmasa uni yaratish
pool
  .query(
    `
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,  
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('kirim', 'chiqim'))    
);
`
  )
  .catch((err) => console.error("Error creating transactions table:", err));

export default pool;
