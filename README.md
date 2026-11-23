# Buotany

An AI-powered disease identification web app made with NextJS and deployed in vercel.

Check out the link: https://buotany.vercel.app


## Prerequisites

Before you begin, ensure you have the following installed on your machine:
* **Node.js** (v18.18.0 or higher recommended)
* **pnpm** (v8 or higher) — Install via `npm install -g pnpm` or `corepack enable`

## Getting Started

Follow these steps to get a local copy of the project up and running.

### 1. Clone the repository

```bash
git clone https://github.com/buotany
cd buotany
```

### 2. Install dependencies

Install all required packages defined in `package.json`:

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example environment file and fill in your local configuration values (API keys, database URLs, etc.):

```bash
cp .env.example .env.local
```

Open `.env.local` and update the variables as needed.

### 4. Run the development server

Start the local Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the application. The page will automatically reload when you make edits to the code.

## Available Scripts

In the project directory, you can run:

* `pnpm dev` — Starts the development server on `http://localhost:3000`.
* `pnpm build` — Builds the application for production usage.
* `pnpm start` — Starts a Next.js production server (requires `pnpm build` first).
* `pnpm lint` — Runs ESLint to catch code quality and formatting issues.


## Learn More

* [Next.js Documentation](https://nextjs.org) — Learn about Next.js features and API.
* [Learn Next.js](https://nextjs.org) — An interactive Next.js tutorial.