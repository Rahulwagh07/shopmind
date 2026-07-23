import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DATABASE_PATH = resolve(import.meta.dir, "../../data/shop.db");

const customers = [
  [1, "Maya Chen", "Austin"],
  [2, "Noah Williams", "Denver"],
  [3, "Sofia Ramirez", "Seattle"],
  [4, "Liam Patel", "Austin"],
  [5, "Emma Johnson", "Denver"],
  [6, "Oliver Kim", "Portland"],
  [7, "Ava Thompson", "Seattle"],
  [8, "Ethan Brooks", "Austin"],
] as const;

const orders = [
  [101, 1, 129.5, "2026-01-08"],
  [102, 2, 84.25, "2026-01-12"],
  [103, 3, 215.0, "2026-01-15"],
  [104, 1, 45.9, "2026-02-03"],
  [105, 4, 320.4, "2026-02-09"],
  [106, 5, 72.1, "2026-02-18"],
  [107, 6, 150.0, "2026-03-02"],
  [108, 7, 98.75, "2026-03-11"],
  [109, 8, 410.2, "2026-03-19"],
  [110, 2, 64.8, "2026-04-04"],
  [111, 3, 187.35, "2026-04-16"],
  [112, 4, 55.6, "2026-05-01"],
  [113, 5, 240.0, "2026-05-14"],
  [114, 6, 33.45, "2026-06-07"],
  [115, 7, 126.9, "2026-06-21"],
  [116, 8, 89.99, "2026-07-05"],
  [117, 1, 175.25, "2026-07-18"],
  [118, 3, 61.3, "2026-08-02"],
  [119, 5, 134.7, "2026-08-20"],
  [120, 4, 205.0, "2026-09-09"],
] as const;

export function seedDatabase(): void {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  rmSync(DATABASE_PATH, { force: true });

  const database = new Database(DATABASE_PATH, { create: true, strict: true });

  try {
    database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL
      );

      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        amount REAL NOT NULL CHECK (amount >= 0),
        created_at TEXT NOT NULL
      );
    `);

    const insertCustomer = database.prepare(
      "INSERT INTO customers (id, name, city) VALUES (?, ?, ?)",
    );
    const insertOrder = database.prepare(
      "INSERT INTO orders (id, customer_id, amount, created_at) VALUES (?, ?, ?, ?)",
    );

    const insertRows = database.transaction(() => {
      for (const customer of customers) insertCustomer.run(...customer);
      for (const order of orders) insertOrder.run(...order);
    });

    insertRows();
  } finally {
    database.close();
  }

  console.log(
    `Seeded ${DATABASE_PATH} with ${customers.length} customers and ${orders.length} orders.`,
  );
}

if (import.meta.main) seedDatabase();
