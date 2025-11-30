import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, TransactionFilters } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertTransactionSchema, 
  supportedCurrencies,
  insertBudgetSchema,
  insertSavingsGoalSchema,
  insertRecurringTransactionSchema,
  insertBillReminderSchema,
  insertCategorySchema,
} from "@shared/schema";
import { z } from "zod";
import { encrypt, decrypt, getBalancesWithValues, fetchMexcAccountInfo } from "./mexc";
import { validatePionexCredentials, getPionexBalancesWithValues } from "./pionex";

const supportedCurrencyCodes = supportedCurrencies.map(c => c.code);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user's default currency
  app.patch('/api/user/currency', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currency } = req.body;
      
      if (!currency || typeof currency !== 'string') {
        return res.status(400).json({ message: "Currency is required" });
      }
      
      // Validate against supported currencies
      if (!supportedCurrencyCodes.includes(currency as any)) {
        return res.status(400).json({ message: "Unsupported currency" });
      }
      
      const user = await storage.updateUserCurrency(userId, currency);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user currency:", error);
      res.status(500).json({ message: "Failed to update currency" });
    }
  });

  // Exchange rate API
  app.get('/api/exchange-rate', isAuthenticated, async (req: any, res) => {
    try {
      const { from, to } = req.query;
      
      if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
        return res.status(400).json({ message: "Both 'from' and 'to' currency codes are required" });
      }

      const fromCurrency = from.toUpperCase();
      const toCurrency = to.toUpperCase();

      if (!supportedCurrencyCodes.includes(fromCurrency as any) || !supportedCurrencyCodes.includes(toCurrency as any)) {
        return res.status(400).json({ message: "Unsupported currency code" });
      }

      if (fromCurrency === toCurrency) {
        return res.json({ rate: 1, from: fromCurrency, to: toCurrency });
      }

      // Use Frankfurter API (free, no API key required)
      const response = await fetch(
        `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`
      );

      if (!response.ok) {
        // Fallback: try with a different API or return error
        console.error("Frankfurter API error:", response.status);
        return res.status(503).json({ message: "无法获取汇率，请手动输入" });
      }

      const data = await response.json();
      const rate = data.rates?.[toCurrency];

      if (!rate) {
        return res.status(503).json({ message: "无法获取该币种汇率，请手动输入" });
      }

      res.json({ rate, from: fromCurrency, to: toCurrency });
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      res.status(503).json({ message: "无法获取汇率，请手动输入" });
    }
  });

  // Wallet routes
  app.get('/api/wallets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallets = await storage.getWallets(userId);
      res.json(wallets);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  app.get('/api/wallets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const wallet = await storage.getWallet(id, userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Create new wallet
  app.post('/api/wallets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, type, currency, color, icon, exchangeRateToDefault, isFlexible } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      const walletCurrency = currency || "MYR";
      if (!supportedCurrencyCodes.includes(walletCurrency)) {
        return res.status(400).json({ message: "Unsupported currency" });
      }
      
      // Validate exchange rate if provided
      let rateToDefault = "1";
      if (exchangeRateToDefault !== undefined) {
        const rate = parseFloat(exchangeRateToDefault);
        if (!isNaN(rate) && rate > 0) {
          rateToDefault = rate.toFixed(6);
        }
      }
      
      const wallet = await storage.createWallet({
        userId,
        name: name.trim(),
        type: type || "cash",
        currency: walletCurrency,
        color: color || "#3B82F6",
        icon: icon || "wallet",
        balance: "0",
        isDefault: false,
        exchangeRateToDefault: rateToDefault,
        isFlexible: isFlexible !== false,
      });
      res.status(201).json(wallet);
    } catch (error) {
      console.error("Error creating wallet:", error);
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  // Update wallet
  app.patch('/api/wallets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name, type, currency, color, icon, isDefault, exchangeRateToDefault, isFlexible } = req.body;
      
      const existingWallet = await storage.getWallet(id, userId);
      if (!existingWallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      // Handle setting as default wallet
      if (isDefault === true) {
        const wallet = await storage.setDefaultWallet(id, userId);
        return res.json(wallet);
      }
      
      const updateData: any = {};
      
      // Validate and trim name if provided
      if (name !== undefined) {
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (trimmedName.length === 0) {
          return res.status(400).json({ message: "Wallet name cannot be empty" });
        }
        updateData.name = trimmedName;
      }
      
      // Validate type if provided
      if (type !== undefined) {
        const validTypes = ['cash', 'bank_card', 'digital_wallet', 'credit_card', 'investment', 'savings', 'other'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ message: "Invalid wallet type" });
        }
        updateData.type = type;
      }
      
      // Validate currency if provided
      if (currency !== undefined) {
        if (!supportedCurrencyCodes.includes(currency)) {
          return res.status(400).json({ message: "Unsupported currency" });
        }
        updateData.currency = currency;
      }
      
      // Validate color if provided (hex format)
      if (color !== undefined) {
        if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return res.status(400).json({ message: "Invalid color format" });
        }
        updateData.color = color;
      }
      
      if (icon !== undefined) updateData.icon = icon;
      
      // Handle isFlexible flag
      if (isFlexible !== undefined) {
        updateData.isFlexible = isFlexible === true;
      }
      
      // Validate and handle exchange rate if provided
      if (exchangeRateToDefault !== undefined) {
        const rate = parseFloat(exchangeRateToDefault);
        if (isNaN(rate) || rate <= 0) {
          return res.status(400).json({ message: "Exchange rate must be a positive number" });
        }
        updateData.exchangeRateToDefault = rate.toFixed(6);
      }
      
      // Ensure at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const wallet = await storage.updateWallet(id, userId, updateData);
      res.json(wallet);
    } catch (error) {
      console.error("Error updating wallet:", error);
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  // Delete wallet
  app.delete('/api/wallets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const existingWallet = await storage.getWallet(id, userId);
      if (!existingWallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      
      // Check if this is the last wallet
      const wallets = await storage.getWallets(userId);
      if (wallets.length <= 1) {
        return res.status(400).json({ message: "Cannot delete the last wallet" });
      }
      
      // If deleting default wallet, set another as default
      if (existingWallet.isDefault) {
        const otherWallet = wallets.find(w => w.id !== id);
        if (otherWallet) {
          await storage.setDefaultWallet(otherWallet.id, userId);
        }
      }
      
      const deleted = await storage.deleteWallet(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete wallet" });
      }
    } catch (error) {
      console.error("Error deleting wallet:", error);
      res.status(500).json({ message: "Failed to delete wallet" });
    }
  });

  // Category routes
  app.get('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, type, icon, color } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Category name is required" });
      }
      
      if (!type || !['expense', 'income'].includes(type)) {
        return res.status(400).json({ message: "Invalid category type" });
      }
      
      const category = await storage.createCategory({
        userId,
        name: name.trim(),
        type,
        icon: icon || "other",
        color: color || "#6B7280",
        isDefault: false,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name, icon, color } = req.body;
      
      const existingCategory = await storage.getCategory(id, userId);
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const updateData: any = {};
      if (name !== undefined) {
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (trimmedName.length === 0) {
          return res.status(400).json({ message: "Category name cannot be empty" });
        }
        updateData.name = trimmedName;
      }
      if (icon !== undefined) updateData.icon = icon;
      if (color !== undefined) updateData.color = color;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const category = await storage.updateCategory(id, userId, updateData);
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const existingCategory = await storage.getCategory(id, userId);
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Don't allow deleting default categories
      if (existingCategory.isDefault) {
        return res.status(400).json({ message: "Cannot delete default category" });
      }
      
      const deleted = await storage.deleteCategory(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete category" });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Build filters from query params
      const filters: TransactionFilters = {};
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate);
      }
      if (req.query.categoryId) {
        filters.categoryId = parseInt(req.query.categoryId);
      }
      if (req.query.walletId) {
        filters.walletId = parseInt(req.query.walletId);
      }
      if (req.query.type) {
        filters.type = req.query.type;
      }
      if (req.query.search) {
        filters.search = req.query.search;
      }
      
      const transactions = await storage.getTransactions(userId, Object.keys(filters).length > 0 ? filters : undefined);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Transaction stats
  app.get('/api/transactions/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const stats = await storage.getTransactionStats(
        userId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(stats);
    } catch (error) {
      console.error("Error fetching transaction stats:", error);
      res.status(500).json({ message: "Failed to fetch transaction stats" });
    }
  });
  
  // Export transactions as CSV
  app.get('/api/transactions/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Build filters from query params
      const filters: TransactionFilters = {};
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate);
      }
      
      const transactions = await storage.getTransactions(userId, Object.keys(filters).length > 0 ? filters : undefined);
      
      // Build CSV content
      const headers = ['日期', '类型', '金额', '币种', '分类', '钱包', '描述', '标签'];
      const rows = transactions.map(t => [
        new Date(t.date).toLocaleDateString('zh-CN'),
        t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账',
        t.amount,
        t.wallet?.currency || 'MYR',
        t.category?.name || '',
        t.wallet?.name || '',
        t.description || '',
        (t.tags || []).join(', ')
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csv); // BOM for Excel compatibility
    } catch (error) {
      console.error("Error exporting transactions:", error);
      res.status(500).json({ message: "Failed to export transactions" });
    }
  });

  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get currency-related fields from request
      const inputCurrency = req.body.currency || null; // null means use wallet currency
      const inputAmount = parseFloat(req.body.amount);
      const exchangeRate = req.body.exchangeRate ? parseFloat(req.body.exchangeRate) : null;
      const toWalletAmount = req.body.toWalletAmount ? parseFloat(req.body.toWalletAmount) : null;
      const toExchangeRate = req.body.toExchangeRate ? parseFloat(req.body.toExchangeRate) : null;

      // Validate amount
      if (isNaN(inputAmount) || inputAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Validate transaction type
      if (!['expense', 'income', 'transfer'].includes(req.body.type)) {
        return res.status(400).json({ message: "Invalid transaction type" });
      }

      // Verify wallet ownership
      const wallet = await storage.getWallet(req.body.walletId, userId);
      if (!wallet) {
        return res.status(400).json({ message: "Invalid wallet" });
      }

      const walletCurrency = wallet.currency || "MYR";
      const transactionCurrency = inputCurrency || walletCurrency;
      const isCrosssCurrency = transactionCurrency !== walletCurrency;

      // Validate exchange rate when currencies differ
      if (isCrosssCurrency) {
        if (!exchangeRate || exchangeRate <= 0) {
          return res.status(400).json({ message: "Exchange rate is required for cross-currency transactions" });
        }
      }

      // Calculate wallet amount
      // Exchange rate meaning: 1 transaction currency = X wallet currency
      // So: walletAmount = inputAmount * exchangeRate
      const effectiveExchangeRate = exchangeRate || 1;
      const walletAmount = isCrosssCurrency 
        ? inputAmount * effectiveExchangeRate
        : inputAmount;

      // Build transaction data
      // Always store currency (default to wallet currency)
      const transactionData: any = {
        userId,
        type: req.body.type,
        amount: walletAmount.toFixed(2),
        currency: isCrosssCurrency ? transactionCurrency : walletCurrency,
        walletId: req.body.walletId,
        toWalletId: req.body.toWalletId || null,
        categoryId: req.body.categoryId || null,
        description: req.body.description || null,
        date: new Date(req.body.date),
      };

      // Only store originalAmount and exchangeRate when there's actual conversion
      if (isCrosssCurrency) {
        transactionData.originalAmount = inputAmount.toFixed(2);
        transactionData.exchangeRate = effectiveExchangeRate.toFixed(6);
      }

      // For transfers, verify toWallet ownership
      if (transactionData.type === 'transfer') {
        if (!transactionData.toWalletId) {
          return res.status(400).json({ message: "Transfer requires destination wallet" });
        }
        if (transactionData.toWalletId === transactionData.walletId) {
          return res.status(400).json({ message: "Cannot transfer to same wallet" });
        }
        const toWallet = await storage.getWallet(transactionData.toWalletId, userId);
        if (!toWallet) {
          return res.status(400).json({ message: "Invalid destination wallet" });
        }

        const toWalletCurrency = toWallet.currency || "MYR";
        const isToWalletCrossCurrency = walletCurrency !== toWalletCurrency;

        // Update source wallet (decrease by wallet amount)
        const sourceBalance = parseFloat(wallet.balance || "0") - walletAmount;
        await storage.updateWalletBalance(wallet.id, userId, sourceBalance.toString());

        // Calculate destination amount
        let destAmount = walletAmount;
        
        if (isToWalletCrossCurrency) {
          // Cross-currency transfer requires toWalletAmount
          if (toWalletAmount === null || toWalletAmount <= 0) {
            return res.status(400).json({ message: "Cross-currency transfer requires destination amount" });
          }
          destAmount = toWalletAmount;
          transactionData.toWalletAmount = destAmount.toFixed(2);
          if (toExchangeRate && toExchangeRate > 0) {
            transactionData.toExchangeRate = toExchangeRate.toFixed(6);
          }
        } else {
          // Same currency - ignore any toWalletAmount, use same amount
          destAmount = walletAmount;
          transactionData.toWalletAmount = walletAmount.toFixed(2);
        }

        // Update destination wallet (increase)
        const destBalance = parseFloat(toWallet.balance || "0") + destAmount;
        await storage.updateWalletBalance(toWallet.id, userId, destBalance.toString());
      } else if (transactionData.type === 'expense') {
        // Decrease wallet balance for expense
        const currentBalance = parseFloat(wallet.balance || "0");
        const newBalance = currentBalance - walletAmount;
        await storage.updateWalletBalance(wallet.id, userId, newBalance.toString());
      } else if (transactionData.type === 'income') {
        // Increase wallet balance for income
        const currentBalance = parseFloat(wallet.balance || "0");
        const newBalance = currentBalance + walletAmount;
        await storage.updateWalletBalance(wallet.id, userId, newBalance.toString());
      }

      // Create the transaction
      const transaction = await storage.createTransaction(transactionData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Budget routes
  app.get('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month, year } = req.query;
      
      const budgets = month && year 
        ? await storage.getBudgets(userId, parseInt(month as string), parseInt(year as string))
        : await storage.getBudgets(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budgets:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.get('/api/budgets/spending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { month, year } = req.query;
      
      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }
      
      const budgets = await storage.getBudgetSpending(userId, parseInt(month as string), parseInt(year as string));
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching budget spending:", error);
      res.status(500).json({ message: "Failed to fetch budget spending" });
    }
  });

  app.post('/api/budgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { categoryId, amount, month, year } = req.body;
      
      if (!categoryId || !amount || !month || !year) {
        return res.status(400).json({ message: "Category, amount, month, and year are required" });
      }
      
      const category = await storage.getCategory(categoryId, userId);
      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }
      
      const budget = await storage.createBudget({
        userId,
        categoryId,
        amount: amount.toString(),
        month: parseInt(month),
        year: parseInt(year),
      });
      res.status(201).json(budget);
    } catch (error) {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.patch('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { amount } = req.body;
      
      const existingBudget = await storage.getBudget(id, userId);
      if (!existingBudget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      const budget = await storage.updateBudget(id, userId, { amount: amount.toString() });
      res.json(budget);
    } catch (error) {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete('/api/budgets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteBudget(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Budget not found" });
      }
    } catch (error) {
      console.error("Error deleting budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Savings goal routes
  app.get('/api/savings-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getSavingsGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching savings goals:", error);
      res.status(500).json({ message: "Failed to fetch savings goals" });
    }
  });

  app.post('/api/savings-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, targetAmount, currency, targetDate, icon, color } = req.body;
      
      if (!name || !targetAmount) {
        return res.status(400).json({ message: "Name and target amount are required" });
      }
      
      const goal = await storage.createSavingsGoal({
        userId,
        name: name.trim(),
        targetAmount: targetAmount.toString(),
        currentAmount: "0",
        currency: currency || "MYR",
        targetDate: targetDate ? new Date(targetDate) : null,
        icon: icon || "piggy-bank",
        color: color || "#10B981",
        isCompleted: false,
      });
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating savings goal:", error);
      res.status(500).json({ message: "Failed to create savings goal" });
    }
  });

  app.patch('/api/savings-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name, targetAmount, currentAmount, targetDate, icon, color, isCompleted } = req.body;
      
      const existingGoal = await storage.getSavingsGoal(id, userId);
      if (!existingGoal) {
        return res.status(404).json({ message: "Savings goal not found" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (targetAmount !== undefined) updateData.targetAmount = targetAmount.toString();
      if (currentAmount !== undefined) updateData.currentAmount = currentAmount.toString();
      if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
      if (icon !== undefined) updateData.icon = icon;
      if (color !== undefined) updateData.color = color;
      if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
      
      const goal = await storage.updateSavingsGoal(id, userId, updateData);
      res.json(goal);
    } catch (error) {
      console.error("Error updating savings goal:", error);
      res.status(500).json({ message: "Failed to update savings goal" });
    }
  });

  app.delete('/api/savings-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteSavingsGoal(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Savings goal not found" });
      }
    } catch (error) {
      console.error("Error deleting savings goal:", error);
      res.status(500).json({ message: "Failed to delete savings goal" });
    }
  });

  // Recurring transaction routes
  app.get('/api/recurring-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recurring = await storage.getRecurringTransactions(userId);
      res.json(recurring);
    } catch (error) {
      console.error("Error fetching recurring transactions:", error);
      res.status(500).json({ message: "Failed to fetch recurring transactions" });
    }
  });

  app.post('/api/recurring-transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type, amount, walletId, categoryId, description, frequency, dayOfMonth, dayOfWeek, nextExecutionDate } = req.body;
      
      if (!type || !amount || !walletId || !frequency || !nextExecutionDate) {
        return res.status(400).json({ message: "Type, amount, wallet, frequency, and next execution date are required" });
      }
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(400).json({ message: "Invalid wallet" });
      }
      
      const recurring = await storage.createRecurringTransaction({
        userId,
        type,
        amount: amount.toString(),
        walletId,
        categoryId: categoryId || null,
        description: description || null,
        frequency,
        dayOfMonth: dayOfMonth || null,
        dayOfWeek: dayOfWeek || null,
        nextExecutionDate: new Date(nextExecutionDate),
        isActive: true,
      });
      res.status(201).json(recurring);
    } catch (error) {
      console.error("Error creating recurring transaction:", error);
      res.status(500).json({ message: "Failed to create recurring transaction" });
    }
  });

  app.patch('/api/recurring-transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { amount, categoryId, description, frequency, dayOfMonth, dayOfWeek, nextExecutionDate, isActive } = req.body;
      
      const existing = await storage.getRecurringTransaction(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Recurring transaction not found" });
      }
      
      const updateData: any = {};
      if (amount !== undefined) updateData.amount = amount.toString();
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (description !== undefined) updateData.description = description;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
      if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
      if (nextExecutionDate !== undefined) updateData.nextExecutionDate = new Date(nextExecutionDate);
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const recurring = await storage.updateRecurringTransaction(id, userId, updateData);
      res.json(recurring);
    } catch (error) {
      console.error("Error updating recurring transaction:", error);
      res.status(500).json({ message: "Failed to update recurring transaction" });
    }
  });

  app.delete('/api/recurring-transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteRecurringTransaction(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Recurring transaction not found" });
      }
    } catch (error) {
      console.error("Error deleting recurring transaction:", error);
      res.status(500).json({ message: "Failed to delete recurring transaction" });
    }
  });

  // Bill reminder routes
  app.get('/api/bill-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reminders = await storage.getBillReminders(userId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching bill reminders:", error);
      res.status(500).json({ message: "Failed to fetch bill reminders" });
    }
  });

  app.post('/api/bill-reminders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, amount, dueDate, frequency, categoryId, walletId, notes } = req.body;
      
      if (!name || !dueDate || !frequency) {
        return res.status(400).json({ message: "Name, due date, and frequency are required" });
      }
      
      const reminder = await storage.createBillReminder({
        userId,
        name: name.trim(),
        amount: amount ? amount.toString() : null,
        dueDate: new Date(dueDate),
        frequency,
        categoryId: categoryId || null,
        walletId: walletId || null,
        isPaid: false,
        notes: notes || null,
      });
      res.status(201).json(reminder);
    } catch (error) {
      console.error("Error creating bill reminder:", error);
      res.status(500).json({ message: "Failed to create bill reminder" });
    }
  });

  app.patch('/api/bill-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name, amount, dueDate, frequency, categoryId, walletId, isPaid, notes } = req.body;
      
      const existing = await storage.getBillReminder(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Bill reminder not found" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (amount !== undefined) updateData.amount = amount ? amount.toString() : null;
      if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
      if (frequency !== undefined) updateData.frequency = frequency;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (walletId !== undefined) updateData.walletId = walletId;
      if (isPaid !== undefined) updateData.isPaid = isPaid;
      if (notes !== undefined) updateData.notes = notes;
      
      const reminder = await storage.updateBillReminder(id, userId, updateData);
      res.json(reminder);
    } catch (error) {
      console.error("Error updating bill reminder:", error);
      res.status(500).json({ message: "Failed to update bill reminder" });
    }
  });

  app.delete('/api/bill-reminders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteBillReminder(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Bill reminder not found" });
      }
    } catch (error) {
      console.error("Error deleting bill reminder:", error);
      res.status(500).json({ message: "Failed to delete bill reminder" });
    }
  });

  // Dashboard preferences routes
  app.get('/api/dashboard-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getDashboardPreferences(userId);
      
      // Return defaults if no preferences exist
      if (!preferences) {
        return res.json({
          showTotalAssets: true,
          showMonthlyIncome: true,
          showMonthlyExpense: true,
          showWallets: true,
          showBudgets: true,
          showSavingsGoals: true,
          showRecentTransactions: true,
          showFlexibleFunds: false,
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching dashboard preferences:", error);
      res.status(500).json({ message: "Failed to fetch dashboard preferences" });
    }
  });

  app.patch('/api/dashboard-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        showTotalAssets,
        showMonthlyIncome,
        showMonthlyExpense,
        showWallets,
        showBudgets,
        showSavingsGoals,
        showRecentTransactions,
        showFlexibleFunds,
      } = req.body;
      
      const updateData: any = {};
      if (showTotalAssets !== undefined) updateData.showTotalAssets = showTotalAssets;
      if (showMonthlyIncome !== undefined) updateData.showMonthlyIncome = showMonthlyIncome;
      if (showMonthlyExpense !== undefined) updateData.showMonthlyExpense = showMonthlyExpense;
      if (showWallets !== undefined) updateData.showWallets = showWallets;
      if (showBudgets !== undefined) updateData.showBudgets = showBudgets;
      if (showSavingsGoals !== undefined) updateData.showSavingsGoals = showSavingsGoals;
      if (showRecentTransactions !== undefined) updateData.showRecentTransactions = showRecentTransactions;
      if (showFlexibleFunds !== undefined) updateData.showFlexibleFunds = showFlexibleFunds;
      
      const preferences = await storage.upsertDashboardPreferences(userId, updateData);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating dashboard preferences:", error);
      res.status(500).json({ message: "Failed to update dashboard preferences" });
    }
  });

  // Exchange credentials routes (MEXC API integration)
  app.get('/api/exchange-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const credentials = await storage.getExchangeCredentials(userId);
      
      // Return credentials without exposing full API keys
      const sanitized = credentials.map(c => ({
        id: c.id,
        exchange: c.exchange,
        label: c.label,
        manualBalance: c.manualBalance || '0',
        isActive: c.isActive,
        lastSyncAt: c.lastSyncAt,
        createdAt: c.createdAt,
        apiKeyPreview: c.apiKey ? `${decrypt(c.apiKey).substring(0, 8)}...` : '',
      }));
      
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching exchange credentials:", error);
      res.status(500).json({ message: "Failed to fetch exchange credentials" });
    }
  });

  app.post('/api/exchange-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { exchange, apiKey, apiSecret, label } = req.body;
      
      if (!exchange || !apiKey || !apiSecret) {
        return res.status(400).json({ message: "Exchange, API Key, and API Secret are required" });
      }

      if (exchange !== 'mexc' && exchange !== 'pionex') {
        return res.status(400).json({ message: "Currently only MEXC and Pionex exchanges are supported" });
      }

      // Test the API credentials before saving
      try {
        if (exchange === 'mexc') {
          await fetchMexcAccountInfo(apiKey, apiSecret);
        } else if (exchange === 'pionex') {
          const isValid = await validatePionexCredentials(apiKey, apiSecret);
          if (!isValid) {
            throw new Error('派网API凭证验证失败');
          }
        }
      } catch (testError: any) {
        return res.status(400).json({ 
          message: `API验证失败: ${testError.message}. 请检查您的API Key和Secret是否正确。` 
        });
      }

      // Check if credentials for this exchange already exist
      const existing = await storage.getExchangeCredentialByExchange(userId, exchange);
      if (existing) {
        // Update existing credentials
        const updated = await storage.updateExchangeCredential(existing.id, userId, {
          apiKey: encrypt(apiKey),
          apiSecret: encrypt(apiSecret),
          label: label || existing.label,
          isActive: true,
          lastSyncAt: new Date(),
        });
        return res.json({
          id: updated?.id,
          exchange: updated?.exchange,
          label: updated?.label,
          isActive: updated?.isActive,
          message: "API凭证已更新",
        });
      }

      // Create new credentials
      const defaultLabel = exchange === 'pionex' ? '派网账户' : 'MEXC账户';
      const credential = await storage.createExchangeCredential({
        userId,
        exchange,
        apiKey: encrypt(apiKey),
        apiSecret: encrypt(apiSecret),
        label: label || defaultLabel,
        isActive: true,
        lastSyncAt: new Date(),
      });

      res.status(201).json({
        id: credential.id,
        exchange: credential.exchange,
        label: credential.label,
        isActive: credential.isActive,
        message: "API凭证已保存",
      });
    } catch (error) {
      console.error("Error saving exchange credentials:", error);
      res.status(500).json({ message: "Failed to save exchange credentials" });
    }
  });

  app.delete('/api/exchange-credentials/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteExchangeCredential(id, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Exchange credentials not found" });
      }
    } catch (error) {
      console.error("Error deleting exchange credentials:", error);
      res.status(500).json({ message: "Failed to delete exchange credentials" });
    }
  });

  // Update manual balance for exchange credentials
  app.patch('/api/exchange-credentials/:id/manual-balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { manualBalance } = req.body;
      
      if (manualBalance === undefined || isNaN(parseFloat(manualBalance))) {
        return res.status(400).json({ message: "有效的余额金额是必需的" });
      }
      
      const updated = await storage.updateExchangeCredential(id, userId, {
        manualBalance: manualBalance.toString(),
      });
      
      if (updated) {
        res.json({ 
          id: updated.id,
          manualBalance: updated.manualBalance,
          message: "其他账户余额已更新" 
        });
      } else {
        res.status(404).json({ message: "凭证未找到" });
      }
    } catch (error) {
      console.error("Error updating manual balance:", error);
      res.status(500).json({ message: "更新余额失败" });
    }
  });

  // Pionex account balance endpoint
  app.get('/api/pionex/balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const credential = await storage.getExchangeCredentialByExchange(userId, 'pionex');
      if (!credential) {
        return res.status(404).json({ message: "请先配置派网API凭证" });
      }

      if (!credential.isActive) {
        return res.status(400).json({ message: "派网API凭证已禁用" });
      }

      const apiKey = decrypt(credential.apiKey);
      const apiSecret = decrypt(credential.apiSecret);

      const balances = await getPionexBalancesWithValues(apiKey, apiSecret);

      // Update last sync time
      await storage.updateExchangeCredential(credential.id, userId, {
        lastSyncAt: new Date(),
      });

      // Calculate total value in USDT (from API)
      const apiTotalValue = balances.reduce((sum, b) => {
        return sum + parseFloat(b.usdtValue || '0');
      }, 0);

      // Add manual balance for accounts API can't access (bots, earn)
      const manualBalance = parseFloat(credential.manualBalance || '0');
      const totalUsdtValue = apiTotalValue + manualBalance;

      res.json({
        balances,
        apiTotalValue: apiTotalValue.toFixed(2),
        manualBalance: manualBalance.toFixed(2),
        totalUsdtValue: totalUsdtValue.toFixed(2),
        lastSyncAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error fetching Pionex balances:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Pionex balances" });
    }
  });

  // MEXC account balance endpoint
  app.get('/api/mexc/balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const credential = await storage.getExchangeCredentialByExchange(userId, 'mexc');
      if (!credential) {
        return res.status(404).json({ message: "请先配置MEXC API凭证" });
      }

      if (!credential.isActive) {
        return res.status(400).json({ message: "MEXC API凭证已禁用" });
      }

      const apiKey = decrypt(credential.apiKey);
      const apiSecret = decrypt(credential.apiSecret);

      const balances = await getBalancesWithValues(apiKey, apiSecret);

      // Update last sync time
      await storage.updateExchangeCredential(credential.id, userId, {
        lastSyncAt: new Date(),
      });

      // Calculate total value in USDT (from API)
      const apiTotalValue = balances.reduce((sum, b) => {
        return sum + parseFloat(b.usdtValue || '0');
      }, 0);

      // Add manual balance for accounts API can't access
      const manualBalance = parseFloat(credential.manualBalance || '0');
      const totalUsdtValue = apiTotalValue + manualBalance;

      res.json({
        balances,
        apiTotalValue: apiTotalValue.toFixed(2),
        manualBalance: manualBalance.toFixed(2),
        totalUsdtValue: totalUsdtValue.toFixed(2),
        lastSyncAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error fetching MEXC balances:", error);
      res.status(500).json({ message: error.message || "Failed to fetch MEXC balances" });
    }
  });

  return httpServer;
}
