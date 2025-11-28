import {
  users,
  wallets,
  categories,
  transactions,
  type User,
  type UpsertUser,
  type Wallet,
  type InsertWallet,
  type Category,
  type InsertCategory,
  type Transaction,
  type InsertTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

// Default categories for new users
const defaultExpenseCategories = [
  { name: "餐饮", icon: "food", color: "#EF4444" },
  { name: "购物", icon: "shopping", color: "#F59E0B" },
  { name: "交通", icon: "transport", color: "#3B82F6" },
  { name: "住房", icon: "housing", color: "#8B5CF6" },
  { name: "娱乐", icon: "entertainment", color: "#EC4899" },
  { name: "医疗", icon: "health", color: "#10B981" },
  { name: "教育", icon: "education", color: "#06B6D4" },
  { name: "礼物", icon: "gift", color: "#F97316" },
  { name: "其他", icon: "other", color: "#6B7280" },
];

const defaultIncomeCategories = [
  { name: "工资", icon: "salary", color: "#10B981" },
  { name: "奖金", icon: "gift", color: "#22C55E" },
  { name: "投资", icon: "work", color: "#3B82F6" },
  { name: "其他", icon: "other", color: "#6B7280" },
];

const defaultWallets = [
  { name: "现金", type: "cash", icon: "cash", color: "#10B981", isDefault: true },
  { name: "银行卡", type: "bank_card", icon: "bank_card", color: "#3B82F6", isDefault: false },
  { name: "支付宝", type: "digital_wallet", icon: "digital_wallet", color: "#1677FF", isDefault: false },
  { name: "微信", type: "digital_wallet", icon: "digital_wallet", color: "#07C160", isDefault: false },
];

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCurrency(userId: string, currency: string): Promise<User | undefined>;

  // Wallet operations
  getWallets(userId: string): Promise<Wallet[]>;
  getWallet(id: number, userId: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(id: number, userId: string, data: Partial<InsertWallet>): Promise<Wallet | undefined>;
  deleteWallet(id: number, userId: string): Promise<boolean>;
  updateWalletBalance(id: number, userId: string, amount: string): Promise<Wallet | undefined>;
  setDefaultWallet(id: number, userId: string): Promise<Wallet | undefined>;

  // Category operations
  getCategories(userId: string): Promise<Category[]>;
  getCategory(id: number, userId: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Transaction operations
  getTransactions(userId: string): Promise<any[]>;
  getTransaction(id: number, userId: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Initialization
  initializeUserDefaults(userId: string, defaultCurrency?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Initialize defaults for new users
    await this.initializeUserDefaults(user.id, user.defaultCurrency);
    
    return user;
  }

  async updateUserCurrency(userId: string, currency: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ defaultCurrency: currency, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Wallet operations
  async getWallets(userId: string): Promise<Wallet[]> {
    return db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWallet(id: number, userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)));
    return wallet;
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const [newWallet] = await db.insert(wallets).values(wallet).returning();
    return newWallet;
  }

  async updateWalletBalance(
    id: number,
    userId: string,
    newBalance: string
  ): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return updated;
  }

  async updateWallet(
    id: number,
    userId: string,
    data: Partial<InsertWallet>
  ): Promise<Wallet | undefined> {
    const [updated] = await db
      .update(wallets)
      .set(data)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return updated;
  }

  async deleteWallet(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async setDefaultWallet(id: number, userId: string): Promise<Wallet | undefined> {
    await db
      .update(wallets)
      .set({ isDefault: false })
      .where(eq(wallets.userId, userId));
    
    const [updated] = await db
      .update(wallets)
      .set({ isDefault: true })
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return updated;
  }

  // Category operations
  async getCategories(userId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.userId, userId));
  }

  async getCategory(id: number, userId: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  // Transaction operations
  async getTransactions(userId: string): Promise<any[]> {
    const result = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amount: transactions.amount,
        walletId: transactions.walletId,
        toWalletId: transactions.toWalletId,
        categoryId: transactions.categoryId,
        description: transactions.description,
        date: transactions.date,
        createdAt: transactions.createdAt,
        category: categories,
        wallet: wallets,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    // Get toWallet data for transfers
    const transactionsWithToWallet = await Promise.all(
      result.map(async (t) => {
        let toWallet = null;
        if (t.toWalletId) {
          const [tw] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.id, t.toWalletId));
          toWallet = tw || null;
        }
        return {
          id: t.id,
          userId: t.userId,
          type: t.type,
          amount: t.amount,
          walletId: t.walletId,
          toWalletId: t.toWalletId,
          categoryId: t.categoryId,
          description: t.description,
          date: t.date,
          createdAt: t.createdAt,
          category: t.category,
          wallet: t.wallet,
          toWallet,
        };
      })
    );

    return transactionsWithToWallet;
  }

  async getTransaction(id: number, userId: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  // Initialize default data for new users with idempotent inserts
  async initializeUserDefaults(userId: string, defaultCurrency: string = "MYR"): Promise<void> {
    // Check if user already has wallets (not a new user)
    const existingWallets = await this.getWallets(userId);
    if (existingWallets.length > 0) {
      return;
    }

    // Create default wallets using batch insert with currency
    const walletInserts = defaultWallets.map((wallet) => ({
      userId,
      name: wallet.name,
      type: wallet.type,
      currency: defaultCurrency,
      icon: wallet.icon,
      color: wallet.color,
      isDefault: wallet.isDefault,
      balance: "0",
    }));

    // Insert all wallets at once
    await db.insert(wallets).values(walletInserts);

    // Create default expense categories
    const expenseCategoryInserts = defaultExpenseCategories.map((category) => ({
      userId,
      name: category.name,
      type: "expense" as const,
      icon: category.icon,
      color: category.color,
      isDefault: true,
    }));

    await db.insert(categories).values(expenseCategoryInserts);

    // Create default income categories
    const incomeCategoryInserts = defaultIncomeCategories.map((category) => ({
      userId,
      name: category.name,
      type: "income" as const,
      icon: category.icon,
      color: category.color,
      isDefault: true,
    }));

    await db.insert(categories).values(incomeCategoryInserts);
  }
}

export const storage = new DatabaseStorage();
