import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  defaultCurrency: varchar("default_currency", { length: 10 }).notNull().default("MYR"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallets table - supports different payment methods
export const wallets = pgTable("wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // cash, bank_card, digital_wallet, credit_card
  currency: varchar("currency", { length: 10 }).notNull().default("MYR"),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRateToDefault: decimal("exchange_rate_to_default", { precision: 15, scale: 6 }).default("1"), // rate to convert to user's default currency
  icon: varchar("icon", { length: 50 }), // icon name for display
  color: varchar("color", { length: 20 }), // hex color for card display
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories table - for transaction categorization
export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // expense, income
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions table - supports expense, income, and transfer
export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // expense, income, transfer
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // amount in wallet currency
  currency: varchar("currency", { length: 10 }).notNull().default("MYR"), // transaction input currency
  originalAmount: decimal("original_amount", { precision: 15, scale: 2 }), // amount in original currency
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }).default("1"), // rate to convert to wallet currency
  walletId: integer("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  toWalletId: integer("to_wallet_id").references(() => wallets.id, { onDelete: "cascade" }), // for transfers
  toWalletAmount: decimal("to_wallet_amount", { precision: 15, scale: 2 }), // amount received in destination wallet (for transfers with different currencies)
  toExchangeRate: decimal("to_exchange_rate", { precision: 15, scale: 6 }), // exchange rate for destination wallet
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  description: text("description"),
  tags: text("tags").array(), // tags for transaction
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Budgets table - monthly budget per category
export const budgets = pgTable("budgets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Savings goals table
export const savingsGoals = pgTable("savings_goals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("MYR"),
  targetDate: timestamp("target_date"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recurring transactions table
export const recurringTransactions = pgTable("recurring_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // expense, income
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  walletId: integer("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  description: text("description"),
  frequency: varchar("frequency", { length: 20 }).notNull(), // daily, weekly, monthly, yearly
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly
  dayOfWeek: integer("day_of_week"), // 0-6 for weekly (0=Sunday)
  nextExecutionDate: timestamp("next_execution_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bill reminders table
export const billReminders = pgTable("bill_reminders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  dueDate: timestamp("due_date").notNull(),
  frequency: varchar("frequency", { length: 20 }).notNull(), // once, weekly, monthly, yearly
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  walletId: integer("wallet_id").references(() => wallets.id, { onDelete: "set null" }),
  isPaid: boolean("is_paid").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  savingsGoals: many(savingsGoals),
  recurringTransactions: many(recurringTransactions),
  billReminders: many(billReminders),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  wallet: one(wallets, { fields: [transactions.walletId], references: [wallets.id] }),
  toWallet: one(wallets, { fields: [transactions.toWalletId], references: [wallets.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  user: one(users, { fields: [savingsGoals.userId], references: [users.id] }),
}));

export const recurringTransactionsRelations = relations(recurringTransactions, ({ one }) => ({
  user: one(users, { fields: [recurringTransactions.userId], references: [users.id] }),
  wallet: one(wallets, { fields: [recurringTransactions.walletId], references: [wallets.id] }),
  category: one(categories, { fields: [recurringTransactions.categoryId], references: [categories.id] }),
}));

export const billRemindersRelations = relations(billReminders, ({ one }) => ({
  user: one(users, { fields: [billReminders.userId], references: [users.id] }),
  category: one(categories, { fields: [billReminders.categoryId], references: [categories.id] }),
  wallet: one(wallets, { fields: [billReminders.walletId], references: [wallets.id] }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertWallet = typeof wallets.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;

export type InsertCategory = typeof categories.$inferInsert;
export type Category = typeof categories.$inferSelect;

export type InsertTransaction = typeof transactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBudget = typeof budgets.$inferInsert;
export type Budget = typeof budgets.$inferSelect;

export type InsertSavingsGoal = typeof savingsGoals.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

export type InsertRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;

export type InsertBillReminder = typeof billReminders.$inferInsert;
export type BillReminder = typeof billReminders.$inferSelect;

// Zod schemas for validation
export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({
  id: true,
  createdAt: true,
});

export const insertRecurringTransactionSchema = createInsertSchema(recurringTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertBillReminderSchema = createInsertSchema(billReminders).omit({
  id: true,
  createdAt: true,
});

// Transaction types enum
export const transactionTypes = ['expense', 'income', 'transfer'] as const;
export type TransactionType = typeof transactionTypes[number];

// Wallet types enum
export const walletTypes = ['cash', 'bank_card', 'digital_wallet', 'credit_card'] as const;
export type WalletType = typeof walletTypes[number];

// Category types enum  
export const categoryTypes = ['expense', 'income'] as const;
export type CategoryType = typeof categoryTypes[number];

// Supported currencies
export const supportedCurrencies = [
  { code: 'MYR', name: '马来西亚林吉特', symbol: 'RM' },
  { code: 'CNY', name: '人民币', symbol: '¥' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'SGD', name: '新加坡元', symbol: 'S$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'HKD', name: '港币', symbol: 'HK$' },
  { code: 'TWD', name: '新台币', symbol: 'NT$' },
  { code: 'THB', name: '泰铢', symbol: '฿' },
] as const;

export type CurrencyCode = typeof supportedCurrencies[number]['code'];

// Helper to get currency info
export function getCurrencyInfo(code: string) {
  return supportedCurrencies.find(c => c.code === code) || supportedCurrencies[0];
}
