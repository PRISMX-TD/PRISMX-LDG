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
      
      // Validate request body using Zod schema
      const validationResult = insertTransactionSchema.safeParse({
        userId,
        type: req.body.type,
        amount: req.body.amount?.toString(),
        walletId: req.body.walletId,
        toWalletId: req.body.toWalletId || null,
        categoryId: req.body.categoryId || null,
        description: req.body.description || null,
        date: new Date(req.body.date),
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.flatten()
        });
      }

      const transactionData = validationResult.data;

      // Validate transaction type
      if (!['expense', 'income', 'transfer'].includes(transactionData.type)) {
        return res.status(400).json({ message: "Invalid transaction type" });
      }

      // Validate amount
      const amount = parseFloat(transactionData.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Verify wallet ownership
      const wallet = await storage.getWallet(transactionData.walletId, userId);
      if (!wallet) {
        return res.status(400).json({ message: "Invalid wallet" });
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

        // Update source wallet (decrease)
        const sourceBalance = parseFloat(wallet.balance || "0") - amount;
        await storage.updateWalletBalance(wallet.id, userId, sourceBalance.toString());

        // Update destination wallet (increase)
        const destBalance = parseFloat(toWallet.balance || "0") + amount;
        await storage.updateWalletBalance(toWallet.id, userId, destBalance.toString());
      } else if (transactionData.type === 'expense') {
        // Decrease wallet balance for expense
        const newBalance = parseFloat(wallet.balance || "0") - amount;
        await storage.updateWalletBalance(wallet.id, userId, newBalance.toString());
      } else if (transactionData.type === 'income') {
        // Increase wallet balance for income
        const newBalance = parseFloat(wallet.balance || "0") + amount;
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
