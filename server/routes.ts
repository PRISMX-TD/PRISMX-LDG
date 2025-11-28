import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTransactionSchema, supportedCurrencies } from "@shared/schema";
import { z } from "zod";

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
      if (!supportedCurrencyCodes.includes(currency)) {
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
      const { name, type, currency, color, icon } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      const walletCurrency = currency || "MYR";
      if (!supportedCurrencyCodes.includes(walletCurrency)) {
        return res.status(400).json({ message: "Unsupported currency" });
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
      const { name, type, currency, color, icon, isDefault, exchangeRateToDefault } = req.body;
      
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
        const validTypes = ['cash', 'bank_card', 'digital_wallet', 'credit_card'];
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

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
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

  return httpServer;
}
