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
    *   [x] 3-2-1 Countdown timer implemented.
    *   [x] **Fix Power-up UI Visibility and Linter Error**
        *   Description: Modify `GamePage.tsx` so the power-ups display area is always visible (when the user is connected and account setup is complete), regardless of `gameState`. Individual power-up buttons will disable themselves based on `gameState === === 'running'`. Power-ups section now visible when `gameState` is 'idle' or 'running', hidden when 'gameOver'. Linter error resolved.
        *   Success Criteria: Power-up section is visible before, during, and after the game. Power-up buttons are disabled during gameplay (`gameState === === 'running'`). The linter error for `isGameRunning` comparison is resolved. Power-up section visible during 'idle' and 'running' states, hidden during 'gameOver'.
    *   [x] **Implement keyboard shortcuts (A/S) for power-up activation**
        *   Description: Added 'A' for Wide Basket and 'S' for Slow Mo keyboard shortcuts during active gameplay.
        *   Success Criteria: Pressing 'A' or 'S' during `gameState === 'running'` activates the respective power-ups, subject to standard activation conditions (cost, cooldown, etc.).
    *   [x] **Make Game Page the Application Homepage**
        *   Description: Moved game functionality from `src/app/game/page.tsx` to `src/app/page.tsx`, making the game the root page. Deleted the old `src/app/game/page.tsx` file and `src/app/game/` directory.
        *   Success Criteria: Game loads at `/`. Old `/game` path is non-functional. Obsolete files/directory removed.
*   [ ] **Task 11: Basic Testing Strategy & Implementation**
*   [ ] **Task 12: Documentation - User Flows & API (Initial Draft)**
*   [x] **New Major Task: Implement Game Account Spending Limit Progress Bar**
    *   Description: Display a progress bar and textual information indicating how much of the game account's configured spending allowance (derived from `src/wagmi.ts` defaults) has been used within the current allowance period. This allowance persists across sessions and replenishes periodically.
    *   **Sub-Tasks:**
        1.  [x] **Define Allowance Constants:**
            *   Description: Centralize constants for `DEFAULT_ALLOWANCE_ETH = 0.01` and `DEFAULT_ALLOWANCE_PERIOD_SECONDS = 86400` (1 day), based on `src/wagmi.ts`.
            *   Action: Create/update `src/lib/constants.ts`.
            *   Success Criteria: Constants defined and importable.
        2.  [x] **Update Prisma Schema (`Account` model):**
            *   Description: Add fields to `Account` model for allowance tracking.
            *   Action: Add `currentAllowanceLimitETH: Float`, `currentAllowancePeriodSeconds: Int`, `allowancePeriodStart: DateTime`, `allowanceSpentThisPeriodETH: Float @default(0)` to `src/prisma/schema.prisma`. Run `prisma db push` & `prisma generate`.
            *   Success Criteria: Schema updated, Prisma client regenerated.
        3.  [x] **Modify Backend API: Account Setup (`POST /api/account/setup`):**
            *   Description: Initialize allowance fields for new/updated accounts.
            *   Action: On account creation/update, set new allowance fields using constants and current timestamp for `allowancePeriodStart`.
            *   Success Criteria: Accounts correctly initialized with allowance data.
        4.  [x] **Modify Backend API: Fetch Account Details (`GET /api/account`):**
            *   Description: Implement period reset logic and return current allowance status.
            *   Action: If period expired (`allowancePeriodStart` + `currentAllowancePeriodSeconds` < now), reset `allowancePeriodStart` to now, `allowanceSpentThisPeriodETH` to 0, and save. Return all allowance fields.
            *   Success Criteria: API returns up-to-date allowance info, handles period resets.
        5.  [x] **Create Backend API: Record Spending (`POST /api/account/record-spend`):**
            *   Description: Endpoint to update cumulative spending for the current period.
            *   Action: Input `gameAccountAddress`, `amountSpentETH`. Fetch account, perform period reset. Validate `(spent + newSpend) <= limit`. If valid, increment `allowanceSpentThisPeriodETH`, save. Return success/error.
            *   Success Criteria: Spending recorded, validated against limit/period.
        6.  [x] **Modify Frontend: Power-Up Activation (`handleActivatePowerUp` in `src/app/page.tsx`):**
            *   Description: Client-side pre-check and call to backend to record spend.
            *   Action: Before `sendTransaction`, check if `(spent + cost) > limit`. If so, alert & return. After `sendTransaction` submits, call `POST /api/account/record-spend`.

## Project Status Board

*   [x] **Task 1: Project Setup & Initial Next.js App**
*   [x] **Task 2: Prisma & MongoDB Setup**
*   [x] **Task 3: Basic Game Canvas & Coin Spawning (Frontend)**
*   [x] **Task 4: Player Control & Coin Catching Logic (Frontend)**
*   [x] **Task 5: Game Session Management (Frontend + Backend Logic)**
*   [x] **Task 6: High Score Submission & Display** (Marking as complete based on previous work: automatic submission on game over, leaderboard component integration)
*   [x] **Task 7: User Authentication & Coinbase Smart Wallet Integration**
    *   [x] **Task 7.1: Implement Account Selection Dropdown**
    *   [x] **Task 7.2: Implement Subaccount Creation & Coin Allocation** (Simplified to automatic game account setup)
    *   [x] **Task 7.3: Implement User Record Sync on Connect** (Simplified to game account setup flow with username)
*   [x] **Task 8: Dynamic In-Game Currency Management** (Frontend display of ETH-derived coins complete; DB sync attempt reverted)
*   [x] **Task 9: Power-Up System - Basic Implementation (Frontend Focus)** (Initial effects and on-chain transaction logic implemented)
*   [x] **Task 10: UI/UX Polish based on GDD (Initial Pass)**
    *   [x] 3-2-1 Countdown timer implemented.
    *   [x] **Fix Power-up UI Visibility and Linter Error**
        *   Description: Modify `GamePage.tsx` so the power-ups display area is always visible (when the user is connected and account setup is complete), regardless of `gameState`. Individual power-up buttons will disable themselves based on `gameState === === 'running'`. Power-ups section now visible when `gameState` is 'idle' or 'running', hidden when 'gameOver'. Linter error resolved.
        *   Success Criteria: Power-up section is visible before, during, and after the game. Power-up buttons are disabled during gameplay (`gameState === === 'running'`). The linter error for `isGameRunning` comparison is resolved. Power-up section visible during 'idle' and 'running' states, hidden during 'gameOver'.
    *   [x] **Implement keyboard shortcuts (A/S) for power-up activation**
        *   Description: Added 'A' for Wide Basket and 'S' for Slow Mo keyboard shortcuts during active gameplay.
        *   Success Criteria: Pressing 'A' or 'S' during `gameState === 'running'` activates the respective power-ups, subject to standard activation conditions (cost, cooldown, etc.).
    *   [x] **Make Game Page the Application Homepage**
        *   Description: Moved game functionality from `src/app/game/page.tsx` to `src/app/page.tsx`, making the game the root page. Deleted the old `src/app/game/page.tsx` file and `src/app/game/` directory.
        *   Success Criteria: Game loads at `/`. Old `/game` path is non-functional. Obsolete files/directory removed.
*   [ ] **Task 11: Basic Testing Strategy & Implementation**
*   [ ] **Task 12: Documentation - User Flows & API (Initial Draft)**
*   [x] **New Major Task: Implement Game Account Spending Limit Progress Bar**
    *   Description: Display a progress bar and textual information indicating how much of the game account's configured spending allowance (derived from `src/wagmi.ts` defaults) has been used within the current allowance period. This allowance persists across sessions and replenishes periodically.
    *   **Sub-Tasks:**
        1.  [x] **Define Allowance Constants:**
            *   Description: Centralize constants for `DEFAULT_ALLOWANCE_ETH = 0.01` and `DEFAULT_ALLOWANCE_PERIOD_SECONDS = 86400` (1 day), based on `src/wagmi.ts`.
            *   Action: Create/update `src/lib/constants.ts`.
            *   Success Criteria: Constants defined and importable.
        2.  [x] **Update Prisma Schema (`Account` model):**
            *   Description: Add fields to `Account` model for allowance tracking.
            *   Action: Add `currentAllowanceLimitETH: Float`, `currentAllowancePeriodSeconds: Int`, `allowancePeriodStart: DateTime`, `allowanceSpentThisPeriodETH: Float @default(0)` to `src/prisma/schema.prisma`. Run `prisma db push` & `prisma generate`.
            *   Success Criteria: Schema updated, Prisma client regenerated.
        3.  [x] **Modify Backend API: Account Setup (`POST /api/account/setup`):**
            *   Description: Initialize allowance fields for new/updated accounts.
            *   Action: On account creation/update, set new allowance fields using constants and current timestamp for `allowancePeriodStart`.
            *   Success Criteria: Accounts correctly initialized with allowance data.
        4.  [x] **Modify Backend API: Fetch Account Details (`GET /api/account`):**
            *   Description: Implement period reset logic and return current allowance status.
            *   Action: If period expired (`allowancePeriodStart` + `currentAllowancePeriodSeconds` < now), reset `allowancePeriodStart` to now, `allowanceSpentThisPeriodETH` to 0, and save. Return all allowance fields.
            *   Success Criteria: API returns up-to-date allowance info, handles period resets.
        5.  [x] **Create Backend API: Record Spending (`POST /api/account/record-spend`):**
            *   Description: Endpoint to update cumulative spending for the current period.
            *   Action: Input `gameAccountAddress`, `amountSpentETH`. Fetch account, perform period reset. Validate `(spent + newSpend) <= limit`. If valid, increment `allowanceSpentThisPeriodETH`, save. Return success/error.
            *   Success Criteria: Spending recorded, validated against limit/period.
        6.  [x] **Modify Frontend: Power-Up Activation (`handleActivatePowerUp` in `src/app/page.tsx`):**
            *   Description: Client-side pre-check and call to backend to record spend.
            *   Action: Before `sendTransaction`, check if `(spent + cost) > limit`. If so, alert & return. After `sendTransaction` submits, call `POST /api/account/record-spend`.
*   [ ] **New Major Task: Celebrate New Personal High Score**
    *   Description: Detect when a player surpasses their previous personal best score and provide visual feedback on the game over screen.
    *   **Sub-Tasks:**
        1.  [x] **Update Prisma Schema (`Account` model):**
            *   Description: Add a field to store the personal best score for the account.
            *   Action: Add `personalBestScore: Int @default(0)` to the `Account` model in `src/prisma/schema.prisma`. Run `prisma db push` & `prisma generate`.
            *   Success Criteria: Schema updated, Prisma client regenerated. `personalBestScore` field exists with a default of 0.
        2.  [ ] **Modify Backend API: High Score Submission (`POST /api/highscore`):**
            *   Description: Compare submitted score with `personalBestScore`, update if needed, and return flag in response.
            *   Action: Fetch Account. If `submittedScore > account.personalBestScore`, set `newPersonalBest = true` and update Account. Return `{ ..., newPersonalBest: true/false }`.
*   [x] **New Major Task: Accessibility Review - Color Contrast**
    *   Description: Analyze and improve color contrast throughout the `GamePage` to ensure better accessibility and a more visually coherent theme.
    *   **Sub-Tasks (Initial Findings & Plan):**
        1.  [x] **Canvas Elements:**
            *   Issue: Silver coins (`#C0C0C0`) on light gray canvas background (`#f0f0f0`) may have insufficient contrast.
            *   Plan:
                *   Verify contrast ratio using an online tool.
                *   If insufficient, explore options:
                    *   Darken silver coin color slightly.
                    *   Add a subtle dark outline to coins.
                    *   Slightly adjust canvas background color.
                *   Goal: Achieve WCAG AA for non-text contrast.
        2.  [x] **Power-Up Button Text & States:**
            *   Issue: Default text color (inherited black/`text-gray-700`) on `bg-blue-100`.
            *   Issue: "Active" state text (`text-green-700`) on `bg-green-200`.
            *   Issue: Cost text (`text-gray-600`) on `bg-blue-100` or `bg-red-200`.
            *   Plan:
                *   Verify all text/background combinations within power-up buttons.
                *   Adjust text colors (e.g., to a darker gray or black) or background shades to meet WCAG AA for text.
                *   Ensure disabled states also maintain readability (Tailwind's `opacity-50` might reduce contrast too much on already lighter colors).
        3.  [x] **Informational Text (Gray Text):**
            *   Issue: `text-gray-500` used for EOA/Game Account details, allowance reset information, and various loading/status messages on default light background. This shade is often too light.
            *   Plan:
                *   Verify contrast.
                *   Change `text-gray-500` to a darker shade like `text-gray-700` or `text-gray-800` for these elements.
        4.  [x] **Error Text (Red Text):**
            *   Issue: Standard Tailwind `text-red-500`. While often okay, it's good practice to confirm.
            *   Plan:
                *   Verify `text-red-500` on the page background using a contrast checker.
                *   If needed, switch to a darker red like `text-red-600` or `text-red-700`.
        5.  [x] **Disabled Button with Opacity:**
            *   Issue: Connecting button (`bg-gray-500 text-white opacity-50`). Opacity reduces effective contrast.
            *   Plan:
                *   Calculate effective contrast with opacity.
                *   If too low, consider alternatives: using a different disabled style that doesn't rely solely on opacity (e.g., lighter background, grayer text, but ensuring these also have sufficient contrast).
        6.  [x] **General Review & Thematic Consistency:**
            *   Plan:
                *   Systematically review all interactive elements and text for WCAG AA compliance.
                *   Ensure color choices enhance the "Coin Catcher" theme (e.g., using metallic sheens, gem-like colors for highlights if appropriate, while maintaining accessibility).
                *   Document final color palette decisions.

## Current Status / Progress Tracking

*   Identified a linter error in `src/app/game/page.tsx` related to the `isGameRunning` variable within the power-up display section.
*   The error arose because the power-up section was conditionally rendered only when `gameState` is `'idle'` or `'gameOver'`, making the `isGameRunning` (which checks if `gameState === === 'running'`) check always false in that context.
*   The game was observed to end due to the timer expiring, which is an expected behavior alongside the missed coins limit.
*   Plan updated to address the power-up UI visibility to ensure it's always visible (when appropriate conditions like account connection are met) and to fix the linter error by ensuring the internal logic correctly disables buttons during active gameplay.
*   Power-up UI visibility has been corrected: The section is now visible when `gameState` is 'idle' (before game) and 'running' (during gameplay), and hidden when `gameState` is 'gameOver'. The related linter error has been resolved.
*   Keyboard shortcuts for power-up activation have been implemented: 'A' for Wide Basket and 'S' for Slow Mo can be used during active gameplay (`gameState === 'running'`) to trigger power-ups. Input fields now correctly prevent game control activation.
*   The game has been successfully moved to be the application's homepage (`/`). The content of `src/app/game/page.tsx` was moved to `src/app/page.tsx`, and the old `src/app/game/` directory and its page file were deleted.

## Executor's Feedback or Assistance Requests

*   The scratchpad has been updated with a new sub-task under Task 10 to address the power-up UI visibility and the related linter error.
*   Ready to proceed in Executor mode for this sub-task when instructed.
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
*   Coinbase's `wallet_addSubAccount` used with parent EOA key appears deterministic, likely generating one primary subaccount per parent/app context. Manual creation of multiple distinct subaccounts might require different SDK approaches (e.g., different keys, salts if supported).
*   Linter errors regarding type comparisons in conditional rendering (e.g., `A === === 'val1'` inside a block that only renders if `A === === 'val2'`) often indicate a logic flaw where the outer condition makes the inner check redundant or impossible. Revise the component's visibility logic or the inner check.

---
This GDD-informed plan is now in `.cursor/scratchpad.md`. Please let me know when you're ready to switch to Executor mode and which task to begin with. 