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

## Where your data lives

Everything is stored in your browser (localStorage) on the device you use. Nothing is sent to a server. Use Settings → Download backup to keep a copy or move to another device.

## Develop

```sh
npm install
npm run dev
npm run build
```

Built with Vite, React and TypeScript. Deployed on Vercel.
