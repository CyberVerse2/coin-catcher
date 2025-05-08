# Coin Catcher - Project Scratchpad

## Background and Motivation

Coin Catcher is a fast-paced browser game designed to be a secure, budget-controlled family gaming experience. Players catch falling silver and gold coins to earn points and climb leaderboards. A key feature is the currency model where **1 in-game coin equals 0.000525 ETH**. Each player (parent user) derives their initial in-game coin balance from their connected wallet's ETH balance. The game will leverage Coinbase Smart Wallet for users to create subaccounts for children, tied to their parent's balance, allowing for seamless on-chain allowances and power-up purchases without disruptive pop-ups. The tech stack includes Next.js for the frontend and backend API, Prisma as the ORM, and MongoDB as the database. The project aims to implement the features outlined in the provided Game Design Document (GDD), with updated currency details.

## Key Challenges and Analysis

*   **Coinbase Smart Wallet Integration:** Implementing subaccounts (EIP-7895), managing USDC-backed coin balances, on-chain allowances, and ensuring gasless/seamless power-up purchases will be complex. Requires careful study of Coinbase SDK and smart contract interactions (even if simulated).
*   **Real-time Gameplay Performance:** Ensuring smooth animations, responsive controls, and accurate physics for coin falling and catching within a Next.js browser environment.
*   **Database Design & ORM Strategy:** Creating an efficient and scalable MongoDB schema using Prisma for users, subaccounts, game sessions, high scores, and financial transactions. Queries must be optimized for performance, especially for the leaderboard.
*   **Security:** Protecting user wallet connections, ensuring secure management of subaccount permissions and spending limits, and safeguarding API endpoints against common web vulnerabilities.
*   **Instant Power-Up Mechanism:** Designing and implementing the UI and backend logic for power-ups that are activated and paid for instantly from subaccounts without a traditional shop interface.
*   **High Score System Scalability:** Building a persistent leaderboard that can handle a large number of entries and updates efficiently.
*   **Adherence to GDD:** Consistently implementing features as described in the GDD, including UI/UX, game mechanics, and technical architecture.
*   **Asynchronous Operations:** Handling blockchain interactions and API calls without blocking the user interface or gameplay.
*   **Subaccount Creation Flow:** Integrating with Coinbase Smart Wallet SDK (or equivalent) to programmatically create subaccounts, obtain their addresses, and link them to parent accounts with defined allocations. This includes UI for the parent and backend logic to manage these relationships and balances.

## High-level Task Breakdown

The following tasks will guide the development process. Each task includes success criteria to verify completion.
2.  **Task 2: Prisma & MongoDB Setup in existing codebase**
    *   Description: Install Prisma and the Prisma client. Configure Prisma to connect to a local or cloud MongoDB instance. Define initial Prisma schema for `User` (id, email/walletAddress, createdAt) and `HighScore` (id, score, userId, createdAt, userName).
    *   Success Criteria: Prisma successfully connects to MongoDB. `User` and `HighScore` models are defined in `prisma/schema.prisma`. `npx prisma db push` (or equivalent for schema application) runs without errors. Basic programmatic tests to create/read a User and HighScore entry via Prisma Client are successful.

3.  **Task 3: Basic Game Canvas & Coin Spawning (Frontend)**
    *   Description: Create a new Next.js page for the game (e.g., `/game`). Implement a 2D canvas (using HTML5 Canvas API or a simple library like p5.js if preferred). Implement logic for silver and gold coins to fall from the top of the canvas at random horizontal positions. Implement the 10:1 silver to gold spawn ratio and different point values (Silver: +1, Gold: +5).
    *   Success Criteria: Game page renders a canvas. Silver and gold coins fall continuously from the top. The spawn ratio and point values are verifiable (e.g., via console logs or on-screen debug info).

4.  **Task 4: Player Control & Coin Catching Logic (Frontend)**
    *   Description: Implement a "basket" controllable by the player (e.g., using mouse movement or arrow keys). Implement collision detection between the basket and falling coins. When a coin is caught, it should disappear, and the player's score should update.
    *   Success Criteria: Player can move the basket horizontally. Caught coins are removed from the canvas. An on-screen score updates correctly based on the type of coin caught.

5.  **Task 5: Game Session Management (Frontend + Backend Logic)**
    *   Description: Implement game start functionality. Implement a 60-second timer for each game session. Implement game over conditions: either the timer reaches zero, or the player misses three coins (coins that reach the bottom of the canvas without being caught).
    *   Success Criteria: Game starts upon a user action. A visible timer counts down from 60 seconds. Game ends when the timer expires or after three coins are missed. A "Game Over" state is triggered.

6.  **Task 6: High Score Submission & Display**
    *   Description:
        *   Backend: Create a Next.js API route (e.g., `/api/highscore`) that accepts a score and a playerName/userId. This route will use Prisma to save the score to the `HighScore` collection in MongoDB.
        *   Frontend: On game over, allow the player to enter a name (or use a logged-in user's identifier). Submit the score and name to the backend API. Create a separate page or a section on the game page to display a global leaderboard fetched from another API endpoint (e.g., GET `/api/highscore`).
    *   Success Criteria: Player scores and names are successfully saved to MongoDB via the API. The leaderboard page/section correctly displays the top scores, ordered appropriately.

7.  **Task 7: User Authentication & Coinbase Smart Wallet Integration**
    *   Description:
        *   Frontend: Integrate and verify the existing "Connect Wallet" button functionality with Coinbase Smart Wallet.
        *   Backend: Implement logic to fetch the user's USDC balance from their connected wallet upon authentication. Calculate and assign the corresponding in-game coin balance (1 coin = 0.1 USDC; initial balance is 0 if no USDC). Ensure the `User` model and API correctly handle user creation/lookup based on wallet address and manage their dynamic coin balance.
        *   Integration: Build upon the existing implementation of subaccounts and transaction signing for features like parent-controlled child subaccounts and instant power-up purchases.
        *   Research: If the current subaccount implementation is basic, continue research and planning for the full EIP-7895 capabilities, especially around detailed spend permissions.
    *   Success Criteria: "Connect Wallet" button successfully connects to Coinbase Smart Wallet. User's in-game coin balance is correctly determined and displayed based on their USDC wallet balance. User model handles wallet addresses and dynamic coin balances derived from USDC. Existing subaccount/transaction signing features are confirmed as a suitable base. Research on advanced EIP-7895 features is documented if necessary.

8.  **Task 8: Dynamic In-Game Currency Management**
    *   Description:
        *   Frontend: Display the player's dynamic "in-game coin" balance, derived from their **ETH wallet balance using the 1 coin = 0.000525 ETH conversion rate.**
        *   Backend: The `User` model's `coinBalance` field (Prisma) must be updated dynamically based on the fetched ETH wallet balance. This might involve fetching on demand or setting up listeners if feasible. For subaccounts, their balance is `SubAccount.allocatedCoins`.
    *   Success Criteria: User's in-game coin balance accurately reflects their ETH wallet holdings and is displayed correctly. The `coinBalance` in the database for `User` is managed/updated. Subaccount balances are correctly displayed from `allocatedCoins`.

9.  **Task 9: Power-Up System - Basic Implementation (Frontend Focus)**
    *   Description:
        *   Frontend: Display placeholder icons for power-ups as described in the GDD (e.g., basket expansion, time slowdown, score multiplier). On click, simulate a purchase by deducting a predefined cost (e.g., 0.2-0.6 coins) from the player's displayed coin balance. Implement one basic power-up effect (e.g., basket temporarily becomes wider).
        *   Backend (Conceptual): Plan API endpoints for handling power-up activations and linking them to subaccount transactions (for future integration).
    *   Success Criteria: Clicking a power-up icon deducts the cost from the displayed coin balance. At least one power-up (e.g., wider basket) has a visible effect in the game.

10. **Task 10: UI/UX Polish based on GDD (Initial Pass)**
    *   Description: Implement the HUD layout (score, timer, remaining coins/misses). Create simple modals for "Game Over" and "Settings" (if any basic settings are planned). Apply a clean, flat 2D vector art style using basic shapes and colors if actual assets are unavailable.
    *   Success Criteria: Game interface includes the described HUD elements. Game Over modal is functional. Visual style is clean and functional, approximating the GDD's intent.

11. **Task 11: Basic Testing Strategy & Implementation**
    *   Description: Write basic unit tests for critical functions (e.g., scoring logic, timer logic, coin spawning probability). Plan integration tests for API endpoints (e.g., high score submission).
    *   Success Criteria: Key utility functions have unit tests. API endpoints for high scores are tested (e.g., using Postman or a testing library).

12. **Task 12: Documentation - User Flows & API (Initial Draft)**
    *   Description: Based on GDD Section 5, create initial textual or simple diagrammatic user flows for: Landing -> Connect Wallet -> Role Detection (mock), Parent (mock setup), Child -> Game Home -> Gameplay -> Game Over -> Leaderboard. Draft basic API documentation for the implemented endpoints (high score).
    *   Success Criteria: Initial user flow documentation exists. API endpoints (submit score, get leaderboard) are documented with request/response formats.

## Project Status Board

*   [x] **Task 1: Project Setup & Initial Next.js App**
*   [x] **Task 2: Prisma & MongoDB Setup**
*   [x] **Task 3: Basic Game Canvas & Coin Spawning (Frontend)**
*   [x] **Task 4: Player Control & Coin Catching Logic (Frontend)**
*   [x] **Task 5: Game Session Management (Frontend + Backend Logic)**
*   [ ] **Task 6: High Score Submission & Display**
*   [ ] **Task 7: User Authentication & Coinbase Smart Wallet Integration**
    *   [x] **Task 7.1: Implement Account Selection Dropdown**
    *   [ ] **Task 7.2: Implement Subaccount Creation & Coin Allocation** (Executor Mode)
        *   [x] **Schema:** Add `allocatedCoins Int @default(0)` to `SubAccount` model.
        *   [x] **Coinbase SDK Interaction (Frontend/Backend):** Implemented `wallet_addSubAccount` call.
        *   [x] **Frontend UI (Parent View):** Manual creation UI removed.
        *   [x] **Frontend Logic (Handle SDK Call & API):** Logic moved to automatic flow on connect.
        *   [x] **Backend API (`POST /api/subaccount`):** Updated to set default name/allocation and return existing if found.
        *   [x] **Frontend Logic (Post-Creation):** Logic moved to automatic flow.
    *   [x] **Task 7.3: Implement User Record Sync on Connect** (Executor Mode)
        *   [x] **Backend API (`POST /api/user/sync`):** Implemented using Prisma upsert.
        *   [x] **Frontend Logic (`GamePage.tsx`):** Calls `/api/user/sync` on parent EOA connect.
*   [ ] **Task 8: Dynamic In-Game Currency Management**
*   [ ] **Task 9: Power-Up System - Basic Implementation (Frontend Focus)**
*   [ ] **Task 10: UI/UX Polish based on GDD (Initial Pass)**
*   [ ] **Task 11: Basic Testing Strategy & Implementation**
*   [ ] **Task 12: Documentation - User Flows & API (Initial Draft)**

## Executor's Feedback or Assistance Requests

*   Task 1 (Project Setup & Initial Next.js App) completed.
*   Task 2 (Prisma & MongoDB Setup) completed.
*   Task 3 (Basic Game Canvas & Coin Spawning) completed.
*   Task 4 (Player Control & Coin Catching Logic) completed.
*   Task 5 (Game Session Management) completed.
*   Task 7.1 (Implement Account Selection Dropdown) completed: Resolved issues with dropdown being covered by overlays and corrected default account selection logic to prioritize the Main EOA based on its position in the `addresses` array from Wagmi.
*   Clarified requirements for subaccount creation UI (name, 0-100 coin slider) and backend logic.
*   Proposed adding `allocatedCoins` to `SubAccount` schema.
*   Outlined Task 7.2 for implementing this feature, including discussion on simplifying initial Coinbase SDK interaction.
*   Awaiting user feedback on the plan for Task 7.2, especially regarding the initial approach to Coinbase SDK integration for subaccount address generation.
*   Starting Task 7.2 (Subaccount Creation & Allocation) in Executor mode, opting for full SDK integration upfront.
*   Added `allocatedCoins` field to `SubAccount` model in `src/prisma/schema.prisma`.
*   User needs to run `npx prisma db push` to apply schema changes.
*   Awaiting confirmation before proceeding to UI development and SDK research for subaccount creation.
*   `npx prisma db push --schema=./src/prisma/schema.prisma` command successful.
*   Researched Coinbase Wallet SDK's `wallet_addSubAccount` RPC method (EIP-7895).
    *   Identified parameters: `[{ version: '1', account: { type: 'create', keys: [{ type: 'address', key: PARENT_EOA_ADDRESS }] } }]`.
    *   Expected return: `{ address: NEW_SUBACCOUNT_ADDRESS, ... }`.
    *   Plan to use `walletClient.request({ method: 'wallet_addSubAccount', params })` via Wagmi's `useWalletClient`.
*   Ready to proceed with Frontend UI development for subaccount creation.
*   Frontend UI for subaccount creation (name input, initial 0-100 slider, button) is implemented in `GamePage.tsx` and confirmed working by user (placeholder logic for button).
*   **Clarifications received:** 1 coin = 0.000525 ETH. Subaccount spending limit is an in-game allocation rule (`SubAccount.allocatedCoins`), not an on-chain SDK-configured limit for this feature.
*   Next step for Task 7.2: Fetch parent's ETH balance using `useBalance`, calculate max game coins, and update the allocation slider's max value dynamically.
*   Implemented `/api/user/sync` endpoint and integrated it into `GamePage.tsx` to ensure parent `User` record exists before subaccount creation.
*   Frontend for subaccount creation in `GamePage.tsx` now calls `wallet_addSubAccount` SDK method and then `/api/subaccount` backend.
*   User encountered Prisma error "Unknown argument `allocatedCoins`" when creating subaccount.
*   Regenerated Prisma Client using `npx prisma generate --schema=./src/prisma/schema.prisma`.
*   User needs to restart the Next.js development server to load the updated client.
*   Awaiting user testing of the full subaccount creation flow after server restart.
*   User *still* encountering Prisma error "Unknown argument `allocatedCoins`" after regenerating client and restarting server.
*   Suspecting deeper cache or build issue.
*   Instructed user to: 1. Stop server. 2. Run `rm -rf .next node_modules`. 3. Run `npm install` (or equivalent). 4. Await Prisma client regeneration.
*   Waiting for user confirmation before regenerating client again and proceeding with testing.
*   Resolved Prisma "Unknown argument `allocatedCoins`" error by cleaning project artifacts (`.next`, `node_modules`), reinstalling, regenerating client, and restarting server.
*   Confirmed `wallet_addSubAccount` SDK call is succeeding and returning the new subaccount address without requiring a user confirmation popup.
*   The full flow (UI -> SDK -> Backend DB Save) for subaccount creation appears functional.
*   Core logic for Task 7.2 is complete. UI enhancements (displaying subaccounts, available balance) remain.
*   Awaiting user confirmation of final test and direction for the next task.
*   **Pivoted approach:** Removed manual subaccount creation UI.
*   Implemented automatic subaccount creation/ensurance flow:
    1.  On parent connect, `/api/user/sync` ensures parent `User` exists.
    2.  A subsequent effect calls `wallet_addSubAccount` SDK method.
    3.  Calls `POST /api/subaccount` which now creates with fixed 100 coins / default name, or returns existing.
    4.  The obtained subaccount address is set as the default `selectedAddress` for gameplay.
*   Relevant state and effects in `GamePage.tsx` updated.
*   Backend `/api/subaccount` updated for the new logic.
*   Awaiting user testing of the automatic subaccount setup and default selection.

## Lessons

*   Include info useful for debugging in the program output.
*   Read the file before you try to edit it.
*   If there are vulnerabilities that appear in the terminal, run `npm audit` before proceeding.
*   Always ask before using the `-force` git command.
*   Tech Stack: Next.js, Prisma, MongoDB.
*   Currency: 1 in-game coin = 0.000525 ETH.
*   Initial User Balance: 0 coins (dynamically derived from user's ETH wallet balance; 0.1 ETH = 1 coin).
*   Coin Ratios: Silver (1pt, 10/11 spawn rate), Gold (5pts, 1/11 spawn rate).
*   If you have any assumptions that require you to make a change, ask me before you proceed
*   Coinbase Integration: Sub Accounts for children, tied to ETH. Power-ups via clicks (no shop UI).
*   Prisma with MongoDB requires the MongoDB server to be run as a replica set to support transactions.
*   Wagmi's `useAccount()` hook might return a subaccount as the main `address` if a subaccount is actively selected in the connected wallet (e.g. Coinbase Smart Wallet). The full list of accounts is in `addresses`. To reliably identify the EOA, assumptions about its position in the `addresses` array (e.g., last item) might be needed if `address` itself isn't the EOA.
*   CSS `pointer-events: none` on an overlay can prevent it from capturing clicks, allowing interaction with elements underneath. `pointer-events: auto` can be used on child elements (like buttons on the overlay) to make them interactive again.
*   Coinbase Wallet SDK provides `wallet_addSubAccount` (EIP-7895) for programmatically creating subaccounts. It can be called via `walletClient.request` (from Wagmi's `useWalletClient`). Parameters involve specifying account type (`create`) and owner keys.
*   Ensuring a `User` record exists in the DB (e.g., via an upsert API called on connect) is crucial before performing operations that rely on that user existing (like creating child subaccounts linked to a parent user ID).
*   After modifying the Prisma schema and running `prisma db push` or `prisma generate`, it's often necessary to restart the application server (e.g., Next.js dev server) to ensure it uses the newly generated Prisma Client.
*   Coinbase Smart Wallet's `wallet_addSubAccount` RPC (EIP-7895) may succeed and return a new subaccount address without an explicit user confirmation popup, streamlining the UX.
*   Coinbase's `wallet_addSubAccount` used with parent EOA key appears deterministic, likely generating one primary subaccount per parent/app context. Manual creation of multiple distinct subaccounts might require different SDK approaches (e.g., different keys, salts if supported).

---
This GDD-informed plan is now in `.cursor/scratchpad.md`. Please let me know when you're ready to switch to Executor mode and which task to begin with. 