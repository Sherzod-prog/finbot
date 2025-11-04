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
    description TEXT,
    category VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`
  )
  .catch((err) => console.error("Error creating transactions table:", err));

export default pool;
