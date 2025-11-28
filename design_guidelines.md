# PRISMX Ledger - Design Guidelines

## Design Approach
**System-Based with Fintech Customization**: Drawing from Material Design principles adapted for financial applications, inspired by Mint and PocketGuard's clean, trust-building interfaces.

## Core Design Principles
1. **Clarity First**: Financial data must be immediately scannable and unambiguous
2. **Trust Through Restraint**: Professional, secure aesthetic without unnecessary decoration
3. **Action-Oriented**: Easy access to primary tasks (record transactions)
4. **Data Hierarchy**: Clear visual distinction between totals, categories, and individual transactions

## Typography System
**Font Families**: 
- Primary: Inter (via Google Fonts CDN)
- Fallback: -apple-system, SF Pro, system-ui

**Hierarchy**:
- H1 (页面标题): 32px, font-semibold (600)
- H2 (卡片标题): 24px, font-semibold
- H3 (分组标题): 18px, font-medium (500)
- Body (正文): 16px, font-normal (400)
- Small (辅助文字): 14px, font-normal
- Numbers (金额): font-mono for tabular alignment

## Layout & Spacing System
**Tailwind Spacing Units**: Consistently use 4, 6, 8, 12, 16, 24 (p-4, gap-6, mt-8, py-12, px-16, mb-24)

**Container Structure**:
- Max width: max-w-7xl for dashboard
- Section padding: py-8 mobile, py-12 desktop
- Card padding: p-6
- Card gaps in grid: gap-6

**Grid System**:
- Dashboard: 3-column grid on desktop (lg:grid-cols-3), 1-column mobile
- Transaction list: Single column with row-based cards
- Wallet cards: 2-column on tablet (md:grid-cols-2), 3-column desktop (lg:grid-cols-3)

## Component Library

### Navigation Bar
- Fixed top bar with white background, subtle shadow
- Logo left, user menu right
- Height: h-16, px-6 horizontal padding

### Dashboard Cards
- White background (#FFFFFF), rounded-xl borders
- Shadow: shadow-md, hover:shadow-lg transition
- Padding: p-6, gap-4 internal spacing
- Total assets card: Prominent display with large number (text-4xl) in primary color

### Transaction Cards
- Income: Left border (border-l-4) in green (#10B981)
- Expense: Left border in red (#EF4444)
- Transfer: Left border in blue (#2563EB)
- Layout: Flex row with icon, description/category (flex-grow), amount (right-aligned)

### Floating Action Button (FAB)
- Position: fixed bottom-8 right-8
- Size: w-16 h-16, rounded-full
- Background: Primary blue (#2563EB) with shadow-lg
- Icon: Plus sign, white color
- z-index: z-50

### Modal Overlays
- Full screen backdrop (bg-black/50)
- Centered modal: max-w-2xl, white background, rounded-2xl
- Header with tabs for transaction types (支出/收入/转账)
- Active tab: border-b-2 in primary color
- Form fields: gap-6 vertical spacing

### Form Components
- Input fields: h-12, px-4, rounded-lg, border-2, focus:border-primary
- Dropdowns: Custom styled select with chevron icon
- Amount input: Large text (text-2xl), right-aligned, font-mono
- Date picker: Icon prefix, calendar integration
- Submit button: w-full, h-12, rounded-lg, primary background

### Wallet Cards
- Icon + name in header
- Balance: Large (text-3xl), font-semibold, right-aligned
- Card type indicator: Small badge in top-right
- Grid layout: Responsive 1/2/3 columns

## Icons
**Library**: Heroicons (via CDN)
- Wallet: wallet icon
- Income: arrow-trending-up icon  
- Expense: arrow-trending-down icon
- Transfer: arrow-path icon
- Add: plus icon
- Category icons: Various outline icons per category type

## Interactions & States
**Minimal Animations**:
- Card hover: Subtle shadow elevation (300ms ease)
- Button active: Scale down slightly (scale-95)
- Modal: Fade in backdrop, slide up content (200ms)
- No scroll-triggered or complex animations

**Focus States**: 
- Blue outline ring (ring-2 ring-primary ring-offset-2)
- Clear keyboard navigation support

## Responsive Behavior
**Breakpoints**:
- Mobile (base): Single column, stacked layout, FAB bottom-6 right-6
- Tablet (md: 768px): 2-column grids, expanded navigation
- Desktop (lg: 1024px): 3-column grids, full dashboard layout

**Mobile Adaptations**:
- Navigation: Hamburger menu if needed
- Modal: Full screen on mobile (inset-0)
- Transaction cards: Simplified with icons only for categories
- FAB: Slightly smaller (w-14 h-14) on mobile

## Accessibility
- All interactive elements: Minimum 44x44px touch targets
- Form labels: Properly associated with inputs
- Color contrast: WCAG AA compliant (4.5:1 for text)
- Focus indicators: Visible on all interactive elements
- Chinese language: lang="zh-CN" attribute

## No Hero Image
This is a dashboard application - authentication pages use centered card layouts without hero imagery. Focus is on functional interface immediately upon login.