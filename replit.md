# PRISMX Ledger - 个人财务管理应用

## 项目概述
PRISMX Ledger 是一个安全可靠的个人财务跟踪Web应用，支持多用户数据隔离、多钱包管理和完整的交易记录系统。

## 技术栈
- **前端**: React + TypeScript + Tailwind CSS + Shadcn UI
- **后端**: Express.js + TypeScript
- **数据库**: PostgreSQL (Neon)
- **认证**: Replit Auth (OpenID Connect)
- **状态管理**: TanStack Query

## 项目结构
```
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   ├── ui/         # Shadcn UI组件
│   │   │   ├── Header.tsx
│   │   │   ├── WalletCard.tsx
│   │   │   ├── TransactionItem.tsx
│   │   │   ├── TransactionModal.tsx
│   │   │   ├── FloatingActionButton.tsx
│   │   │   ├── TotalAssetsCard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── hooks/          # React Hooks
│   │   │   ├── useAuth.ts
│   │   │   └── use-toast.ts
│   │   ├── lib/            # 工具函数
│   │   │   ├── queryClient.ts
│   │   │   ├── authUtils.ts
│   │   │   └── utils.ts
│   │   └── pages/          # 页面组件
│   │       ├── Landing.tsx
│   │       ├── Dashboard.tsx
│   │       └── not-found.tsx
│   └── index.html
├── server/                 # 后端代码
│   ├── db.ts               # 数据库连接
│   ├── replitAuth.ts       # 认证中间件
│   ├── storage.ts          # 数据存储接口
│   ├── routes.ts           # API路由
│   └── index.ts            # 服务器入口
└── shared/                 # 共享代码
    └── schema.ts           # 数据模型定义
```

## 核心功能
1. **用户认证**: 使用Replit Auth支持邮箱/密码和OAuth登录
2. **多钱包管理**: 支持现金、银行卡、数字钱包等多种支付方式
3. **交易管理**: 支持支出、收入、转账三种交易类型
4. **多币种支持**: 默认MYR (马来西亚林吉特)，支持跨币种交易和自定义汇率
5. **仪表盘**: 显示总资产摘要和最近交易历史
6. **数据隔离**: 严格的用户数据隔离确保安全

## 数据模型
- **users**: 用户信息表 (id, email, firstName, lastName, profileImageUrl, defaultCurrency)
- **sessions**: 会话存储表
- **wallets**: 钱包表 (id, userId, name, type, currency, balance, icon, color, isDefault)
- **categories**: 分类表 (id, userId, name, type, icon, color, isDefault)
- **transactions**: 交易表 (id, userId, type, amount, currency, originalAmount, exchangeRate, walletId, toWalletId, toWalletAmount, toExchangeRate, categoryId, description, date)

## API路由
- `GET /api/auth/user` - 获取当前用户信息
- `PATCH /api/user/currency` - 更新用户默认币种
- `GET /api/wallets` - 获取用户钱包列表
- `GET /api/categories` - 获取用户分类列表
- `GET /api/transactions` - 获取用户交易记录
- `POST /api/transactions` - 创建新交易

## 支持的货币
- MYR (马来西亚林吉特) - RM
- CNY (人民币) - ¥
- USD (美元) - $
- SGD (新加坡元) - S$
- EUR (欧元) - €
- GBP (英镑) - £
- JPY (日元) - ¥
- HKD (港币) - HK$
- TWD (新台币) - NT$
- THB (泰铢) - ฿

## 新用户初始化
新用户登录时自动创建:
- 4个默认钱包: 现金、银行卡、支付宝、微信
- 9个支出分类: 餐饮、购物、交通、住房、娱乐、医疗、教育、礼物、其他
- 4个收入分类: 工资、奖金、投资、其他

## 设计规范
- 主题色: Primary #2563EB (专业蓝)
- 收入色: #10B981 (成功绿)
- 支出色: #EF4444 (警告红)
- 字体: Inter
- 支持深色/浅色主题切换

## 开发命令
- `npm run dev` - 启动开发服务器
- `npm run db:push` - 推送数据库模式
