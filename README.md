# Coin Catcher Game

Coin Catcher is a fast-paced browser-based game where players control a basket to catch falling coins, earn points, and compete on a leaderboard. A key feature of this project is its integration with Ethereum-based wallets, specifically focusing on Coinbase Smart Wallet capabilities. The game aims to demonstrate dynamic in-game currency derived from a user's ETH balance and the use of a dedicated game account for in-game actions like purchasing power-ups.

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Blockchain Interaction:**
    *   Wagmi
    *   Viem
    *   Coinbase Wallet SDK (for smart account features like `wallet_addSubAccount`)
*   **Database:** MongoDB
*   **ORM:** Prisma
*   **Styling:** Tailwind CSS (implicitly, based on typical Next.js setups and class names observed)
*   **Language:** TypeScript

## Key Features

*   **Core Gameplay:**
    *   Falling silver and gold coins with different point values.
    *   Player-controlled basket (keyboard controlled: Left/Right arrows).
    *   Scoring system.
    *   Game session management (30-second timer, missed coin limit).
    *   Game states: idle, running, countdown, game over.
*   **User & Account Management:**
    *   Wallet connection using Wagmi (Coinbase Wallet prioritized).
    *   Automatic game account address generation/retrieval via Coinbase SDK (`wallet_addSubAccount`) linked to the parent EOA.
    *   Usernames stored in the database, with a welcome modal for first-time users to set their name.
*   **In-Game Economy:**
    *   "Game Coins" balance dynamically calculated and displayed based on the connected parent EOA's ETH balance (1 game coin = 0.000525 ETH).
*   **Power-Ups:**
    *   Activate power-ups like "Wide Basket" and "Slow Mo".
    *   Purchased using an on-chain transaction (ETH transfer from the game account address to a designated treasury address).
    *   Activatable via UI buttons or keyboard shortcuts ('A' for Wide Basket, 'S' for Slow Mo) during gameplay.
*   **High Scores & Leaderboard:**
    *   Scores automatically submitted to the backend on game over.
    *   Leaderboard display to show top scores.
*   **Backend API:**
    *   Next.js API routes for:
        *   Managing high scores (`/api/highscore`).
        *   Setting up and retrieving game account details (`/api/account`, `/api/account/setup`).

## Getting Started

### Prerequisites

*   Node.js (version recommended by Next.js, e.g., 18.x or later)
*   npm or yarn
*   MongoDB instance (local or cloud-hosted)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project and add your MongoDB connection string:
    ```
    DATABASE_URL="mongodb+srv://<user>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority"
    ```
    Replace the placeholder values with your actual MongoDB credentials and details. Ensure your MongoDB instance is configured as a replica set if you haven't already, as Prisma requires this for some operations.

4.  **Initialize Prisma:**
    Ensure your Prisma schema (`src/prisma/schema.prisma`) is in sync with your database:
    ```bash
    npx prisma db push --schema=./src/prisma/schema.prisma
    ```
    You might also need to generate the Prisma client if it hasn't been done automatically:
    ```bash
    npx prisma generate --schema=./src/prisma/schema.prisma
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The main game page is typically at `/game`.

## Folder Structure (Simplified)

```
.
├── prisma/                 # Prisma schema and migrations
│   └── schema.prisma
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # Backend API routes
│   │   │   ├── account/
│   │   │   └── highscore/
│   │   ├── game/           # Game page component and logic
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │   └── page.tsx
│   ├── components/         # Reusable UI components (e.g., Leaderboard.tsx)
│   └── lib/                # Library files (e.g., prisma.ts for Prisma client instance)
├── .env.local              # Environment variables (Gitignored)
├── next.config.js
├── package.json
└── README.md
```

## Notes

*   The project utilizes the Coinbase Wallet SDK to interact with smart accounts, particularly for creating/managing a dedicated game account address.
*   Power-up costs are transferred in ETH from the game account. Ensure this account has sufficient ETH for transactions (including gas).
*   The game is designed for desktop browser interaction.
