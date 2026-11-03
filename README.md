# Pitaka

A personal finance tracker built around how you actually log money: type `290 rcbc cc lunch at heybo` and it figures out the amount, card, category and date.

## What it does

- **Accounts** for cash, e-wallets, savings, investments, Pag-IBIG, credit cards and pay-later, in PHP or USD. Every account starts at ₱0; enter today's balances once and Pitaka tracks from there. "Update balances" lets you match any account to its app later without faking income or spending.
- **Quick entry** that understands chat-style text: `yesterday 180 rcbc cc dinner`, `35000 maya savings 1 to mp2 fee 5`, `dinner 85 + 12 cash`, `withdrew 2000 bpi php`.
- **Expenses, income, transfers and loan repayments**, including card payments, investments, cash withdrawals and USD to PHP conversions with the actual amount received. Transfer fees are logged as their own expense.
- **Early salary** can be counted in the month it's for.
- **Home dashboard** per month: income, spent, owed on cards, net cash flow, net worth, spending per day and by category.
- **Recurring bills** with an end month, and **loans owed to you** with changing monthly amounts, ahead/behind status and payoff month.
- **Backup and restore** as JSON, and CSV export.

## Accounts and where your data lives

With Supabase configured, people sign up with email and password, and each person's data is stored in their own row of the `pitaka_data` table, protected by row-level security so nobody else can read it. It syncs to every device you sign in on and is cached on the device for quick start-up.

Without Supabase settings, Pitaka runs on one device only and keeps data in the browser.

### Setting up Supabase

1. Create a project at supabase.com.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Authentication → URL Configuration, set the Site URL to your deployed address and add it to Redirect URLs.
4. Set these environment variables (in Vercel and in a local `.env`):
   - `VITE_SUPABASE_URL`: Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY`: Project Settings → API → anon public key

## Develop

```sh
npm install
npm run dev
npm run build
```

Built with Vite, React and TypeScript. Deployed on Vercel.
