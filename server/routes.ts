import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

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
      const inputCurrency = req.body.currency || "MYR";
      const inputAmount = parseFloat(req.body.amount);
      const exchangeRate = parseFloat(req.body.exchangeRate) || 1;
      const toWalletAmount = req.body.toWalletAmount ? parseFloat(req.body.toWalletAmount) : null;
      const toExchangeRate = req.body.toExchangeRate ? parseFloat(req.body.toExchangeRate) : null;

      // Validate amount
      if (isNaN(inputAmount) || inputAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Validate exchange rate
      if (exchangeRate <= 0) {
        return res.status(400).json({ message: "Invalid exchange rate" });
      }

      // Verify wallet ownership
      const wallet = await storage.getWallet(req.body.walletId, userId);
      if (!wallet) {
        return res.status(400).json({ message: "Invalid wallet" });
      }

      // Calculate wallet amount (convert input currency to wallet currency)
      // If input currency matches wallet currency, no conversion needed
      const walletAmount = inputCurrency === wallet.currency 
        ? inputAmount 
        : inputAmount * exchangeRate;

      // Validate transaction type
      if (!['expense', 'income', 'transfer'].includes(req.body.type)) {
        return res.status(400).json({ message: "Invalid transaction type" });
      }

      // Build transaction data with currency fields
      const transactionData = {
        userId,
        type: req.body.type,
        amount: walletAmount.toFixed(2),
        currency: inputCurrency,
        originalAmount: inputAmount.toFixed(2),
        exchangeRate: exchangeRate.toFixed(6),
        walletId: req.body.walletId,
        toWalletId: req.body.toWalletId || null,
        toWalletAmount: toWalletAmount?.toFixed(2) || null,
        toExchangeRate: toExchangeRate?.toFixed(6) || null,
        categoryId: req.body.categoryId || null,
        description: req.body.description || null,
        date: new Date(req.body.date),
      };

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

        // Update source wallet (decrease by wallet amount)
        const sourceBalance = parseFloat(wallet.balance || "0") - walletAmount;
        await storage.updateWalletBalance(wallet.id, userId, sourceBalance.toString());

        // Calculate destination amount
        // If toWalletAmount is provided, use it (user specified conversion)
        // Otherwise, if same currency, use same amount
        // Otherwise, require toWalletAmount
        let destAmount = walletAmount;
        if (toWalletAmount !== null) {
          destAmount = toWalletAmount;
        } else if (toWallet.currency !== wallet.currency) {
          // Different currencies but no conversion provided - use original amount
          destAmount = walletAmount;
        }

        // Update destination wallet (increase)
        const destBalance = parseFloat(toWallet.balance || "0") + destAmount;
        await storage.updateWalletBalance(toWallet.id, userId, destBalance.toString());

        // Update transaction data with to wallet amount
        transactionData.toWalletAmount = destAmount.toFixed(2);
      } else if (transactionData.type === 'expense') {
        // Decrease wallet balance for expense
        const newBalance = parseFloat(wallet.balance || "0") - walletAmount;
        await storage.updateWalletBalance(wallet.id, userId, newBalance.toString());
      } else if (transactionData.type === 'income') {
        // Increase wallet balance for income
        const newBalance = parseFloat(wallet.balance || "0") + walletAmount;
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
