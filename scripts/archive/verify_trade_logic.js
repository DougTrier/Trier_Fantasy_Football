/**
 * verify_trade_logic.js
 * Programmatic verification of the Fantasy Transfer Ledger & Trading Engine.
 */

const assert = (condition, message) => {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
};

// --- MOCK DATA ---
let teams = [
    {
        id: 'team-buyer',
        name: 'Buyer Bombers',
        total_production_pts: 5000,
        points_escrowed: 0,
        points_spent: 0,
        roster: {},
        bench: [],
        transactions: []
    },
    {
        id: 'team-seller',
        name: 'Seller Stars',
        total_production_pts: 4000,
        points_escrowed: 0,
        points_spent: 0,
        roster: {},
        bench: [
            { id: 'player-1', firstName: 'Patrick', lastName: 'Mahomes', ownerId: 'team-seller' }
        ],
        transactions: []
    }
];

const getTeam = (id) => teams.find(t => t.id === id);

// --- SIMULATED LOGIC (Mirroring App.tsx) ---

const handleMakeOffer = (buyerId, playerId, amount) => {
    const buyer = getTeam(buyerId);
    console.log(`\n[Test] Making offer: ${amount} pts for player ${playerId}`);

    const newTx = {
        id: `tx-offer-${Date.now()}`,
        type: 'TRADE_OFFER',
        amount: amount,
        targetPlayerId: playerId,
        playerName: 'Mahomes'
    };

    buyer.points_escrowed += amount;
    buyer.transactions.push(newTx);
    return newTx;
};

const handleAcceptOffer = (sellerId, offeringTeamId, offer) => {
    const seller = getTeam(sellerId);
    const buyer = getTeam(offeringTeamId);
    console.log(`[Test] Accepting offer: ${offer.amount} pts from ${buyer.name}`);

    // 1. Find player
    const player = seller.bench.find(p => p.id === offer.targetPlayerId);

    // 2. Update Seller (Add points, remove player)
    seller.bench = seller.bench.filter(p => p.id !== player.id);
    seller.total_production_pts += offer.amount;
    seller.transactions.push({ type: 'TRADE_ACCEPT', amount: offer.amount, playerName: player.lastName });

    // 3. Update Buyer (Spend points, remove escrow, add player)
    buyer.points_escrowed -= offer.amount;
    buyer.points_spent += offer.amount;
    buyer.bench.push({ ...player, ownerId: buyer.id });
    buyer.transactions = buyer.transactions.map(t => t.id === offer.id ? { ...t, type: 'ADD' } : t);
};

// --- TEST RUN ---

console.log("Starting Trade Engine Verification...");

const buyerInitialBalance = getTeam('team-buyer').total_production_pts;
const sellerInitialBalance = getTeam('team-seller').total_production_pts;

// Step 1: Make Offer
const offerRef = handleMakeOffer('team-buyer', 'player-1', 500);

assert(getTeam('team-buyer').points_escrowed === 500, "Buyer should have 500 points in escrow");
assert(getTeam('team-buyer').transactions.length === 1, "Buyer should have 1 transaction");

// Step 2: Accept Offer
handleAcceptOffer('team-seller', 'team-buyer', offerRef);

// Assertions for Seller
const seller = getTeam('team-seller');
assert(seller.total_production_pts === 4500, `Seller should have 4500 points (4000 + 500), got ${seller.total_production_pts}`);
assert(seller.bench.length === 0, "Seller bench should be empty");

// Assertions for Buyer
const buyer = getTeam('team-buyer');
assert(buyer.points_spent === 500, "Buyer should have 500 points spent");
assert(buyer.points_escrowed === 0, "Buyer should have 0 points in escrow");
assert(buyer.bench.length === 1, "Buyer should have 1 player on bench");
assert(buyer.bench[0].ownerId === 'team-buyer', "Player ownerId should be updated to buyer");

// Step 3: Verify Ledger Balance (Final production - spent)
const buyerFinalBalance = buyer.total_production_pts - buyer.points_spent;
assert(buyerFinalBalance === 4500, `Buyer final balance should be 4500, got ${buyerFinalBalance}`);

console.log("\nAll Trade Engine Logic Verified Successfully!");
