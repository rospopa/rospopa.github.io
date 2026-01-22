document.addEventListener('DOMContentLoaded', function() {
    const tree = {
        start: {
            text: "What is your primary focus in Real Estate today?",
            options: [
                { label: "🏠 Buying a Home", next: "buy_path" },
                { label: "💰 Selling a Property", next: "sell_path" },
                { label: "📈 Investing for Wealth", next: "invest_path" }
            ]
        },

        // --- BUYING BRANCH ---
        buy_path: {
            text: "What is your current buying status?",
            options: [
                { label: "First-Time Buyer", next: "buy_finance" },
                { label: "Repeat Buyer (Selling simultaneously)", next: "buy_contingency" },
                { label: "Relocating from Out-of-State", next: "res_relocation" }
            ]
        },
        buy_finance: {
            text: "How do you plan to finance this purchase?",
            options: [
                { label: "Standard Mortgage (FHA/Conventional)", next: "buy_preapproval" },
                { label: "VA Loan (Military/Veteran)", next: "res_va_loan" },
                { label: "All-Cash Purchase", next: "res_cash" }
            ]
        },
        buy_preapproval: {
            text: "Do you have an active pre-approval letter?",
            options: [
                { label: "Yes, I'm ready to shop", next: "res_buy_ready" },
                { label: "No, I need a lender recommendation", next: "res_lender" }
            ]
        },
        buy_contingency: {
            text: "Is your purchase contingent on the sale of your current home?",
            options: [
                { label: "Yes, it must sell first", next: "res_contingent_plan" },
                { label: "No, I can carry two mortgages", next: "buy_finance" }
            ]
        },

        // --- SELLING BRANCH ---
        sell_path: {
            text: "What best describes your selling situation?",
            options: [
                { label: "Standard Residential Sale", next: "sell_condition" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031" },
                { label: "Inherited / Probate Property", next: "res_probate" }
            ]
        },
        sell_condition: {
            text: "What is the condition of the property?",
            options: [
                { label: "Turnkey (Ready to list)", next: "res_standard_sell" },
                { label: "Fixer / Distressed", next: "sell_priority" }
            ]
        },
        sell_priority: {
            text: "What is your main priority for this sale?",
            options: [
                { label: "Highest Price (I'll do repairs)", next: "res_reno_guide" },
                { label: "Fastest Close (Sell 'As-Is')", next: "res_as_is_cash" }
            ]
        },

        // --- INVESTING BRANCH ---
        invest_path: {
            text: "What is your preferred investment strategy?",
            options: [
                { label: "Rental Income (Long-Term)", next: "res_rental" },
                { label: "Fix and Flip (Active)", next: "res_flip" },
                { label: "House Hacking (Live + Rent)", next: "res_house_hack" },
                { label: "Short-Term Rental (Airbnb/VRBO)", next: "res_str" }
            ]
        },

        // --- TERMINAL RESULTS (All trigger the form) ---
        res_lender: { text: "Action Plan: You need a pre-approval letter. I can connect you with local lenders to establish your buying power before we tour.", options: [] },
        res_buy_ready: { text: "Action Plan: Let's define your criteria. I'll set up a real-time MLS portal for your target zip codes immediately.", options: [] },
        res_cash: { text: "Action Plan: Prepare Proof of Funds (POF). Cash offers are powerful; we will use this to negotiate better terms and faster inspections.", options: [] },
        res_va_loan: { text: "Action Plan: VA appraisal requirements are specific. We will focus on homes that meet Minimum Property Requirements (MPR).", options: [] },
        res_relocation: { text: "Action Plan: Focus on area analytics. We need to review commute times, school ratings, and local market trends before your visit.", options: [] },
        res_contingent_plan: { text: "Action Plan: Coordination is key. We should list your home 'Subject to Finding Replacement' to protect your timeline.", options: [] },
        res_standard_sell: { text: "Action Plan: Market Launch. We'll perform a CMA to price your home for maximum buyer competition.", options: [] },
        res_1031: { text: "Action Plan: You must identify a replacement property within 45 days. We need to involve a Qualified Intermediary (QI) now.", options: [] },
        res_probate: { text: "Action Plan: Verify court authority. We'll coordinate with your estate attorney to ensure all legal notice periods are met.", options: [] },
        res_as_is_cash: { text: "Action Plan: Fast Exit. I'll present your home to my private network of cash investors for a 7-14 day closing.", options: [] },
        res_reno_guide: { text: "Action Plan: High ROI Repairs. We will identify which updates will net you the most profit before listing.", options: [] },
        res_rental: { text: "Action Plan: Cash-on-Cash Return. We'll analyze multi-family properties to maximize your monthly passive income.", options: [] },
        res_flip: { text: "Action Plan: Equity Play. We'll look for distressed assets with a high After-Repair Value (ARV) to ensure a safe margin.", options: [] },
        res_house_hack: { text: "Action Plan: Owner-Occupied Investing. We'll look for 2-4 unit homes where you can use an FHA loan with only 3.5% down.", options: [] },
        res_str: { text: "Action Plan: Yield Analysis. We'll check local short-term rental regulations and use AirDNA data to project occupancy.", options: [] }
    };

    // ... (Your existing optimized state management and rendering code goes here) ...
    // Note: The rest of the JS logic (history, backBtn, renderNode) remains the same as the previous optimized version.
});
