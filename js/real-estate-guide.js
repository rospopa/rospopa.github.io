document.addEventListener('DOMContentLoaded', () => {
    const tree = {
        start: {
            text: "Welcome. What is your primary real estate objective?",
            options: [
                { label: "🏠 I want to Buy", next: "buy_type" },
                { label: "💰 I want to Sell", next: "sell_situation" },
                { label: "📈 I want to Invest", next: "invest_strategy" },
                { label: "🏢 Commercial / Industrial", next: "res_commercial" }
            ]
        },

        // --- BUYING BRANCH ---
        buy_type: {
            text: "What type of buyer are you?",
            options: [
                { label: "First-Time Homebuyer", next: "buy_finance" },
                { label: "Repeat Buyer (Upsizing/Downsizing)", next: "buy_contingency" },
                { label: "Relocating from out of state", next: "res_relocation" }
            ]
        },
        buy_finance: {
            text: "How do you plan to finance the purchase?",
            options: [
                { label: "Mortgage (Conventional/FHA/VA)", next: "buy_preapproval" },
                { label: "All-Cash Purchase", next: "res_cash_strategy" },
                { label: "Creative (Seller Finance/Subject-To)", next: "res_creative" }
            ]
        },
        buy_preapproval: {
            text: "Do you have an active pre-approval letter?",
            options: [
                { label: "Yes, I'm ready to shop", next: "res_buy_now" },
                { label: "No, I need a lender recommendation", next: "res_lender_match" }
            ]
        },
        buy_contingency: {
            text: "Do you need to sell your current home to buy the new one?",
            options: [
                { label: "Yes, I have a home-sale contingency", next: "res_contingent_plan" },
                { label: "No, I am non-contingent", next: "buy_finance" }
            ]
        },

        // --- SELLING BRANCH ---
        sell_situation: {
            text: "What best describes your selling scenario?",
            options: [
                { label: "Standard Residential Sale", next: "sell_condition" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031_info" },
                { label: "Inherited / Probate / Estate Sale", next: "res_probate_info" }
            ]
        },
        sell_condition: {
            text: "What is the current condition of the property?",
            options: [
                { label: "Turnkey (Ready for market)", next: "res_market_list" },
                { label: "Fixer (Needs significant work)", next: "sell_speed" }
            ]
        },
        sell_speed: {
            text: "Which is your priority: Highest Price or Fast Closing?",
            options: [
                { label: "Highest Price (I'll do the repairs)", next: "res_reno_guide" },
                { label: "Fast Closing (Sell 'As-Is' for cash)", next: "res_as_is_cash" }
            ]
        },

        // --- INVESTING BRANCH ---
        invest_strategy: {
            text: "What is your preferred investment vehicle?",
            options: [
                { label: "House Hacking (Live-in Multi-family)", next: "res_house_hack" },
                { label: "Short-Term Rental (Airbnb/VRBO)", next: "res_str_analysis" },
                { label: "Fix and Flip", next: "res_flip_ops" },
                { label: "Long-Term Rental (Buy & Hold)", next: "res_rental_hold" }
            ]
        },

        // --- FINAL RESULTS ---
        res_relocation: { text: "<h4>Relocation Strategy</h4>Focus on neighborhood data and commute times. I recommend a virtual tour sequence of top 3 zip codes before your visit.", options: [] },
        res_cash_strategy: { text: "<h4>Cash Strategy</h4>Prepare your 'Proof of Funds'. In a competitive market, we can leverage your cash position to shorten inspection periods.", options: [] },
        res_lender_match: { text: "<h4>Lender Matching</h4>I can connect you with lenders specializing in your specific loan type (FHA vs. Conventional) to get your pre-approval started.", options: [] },
        res_buy_now: { text: "<h4>Touring Mode</h4>Let's refine your criteria. I will set up a real-time MLS portal to alert you the second a match hits the market.", options: [] },
        res_contingent_plan: { text: "<h4>Contingent Planning</h4>We need to coordinate two timelines. We should list your current home 'subject to finding a replacement'.", options: [] },
        res_1031_info: { text: "<h4>1031 Exchange</h4>Crucial: Do not touch the proceeds. You need a Qualified Intermediary and must identify a new property within 45 days.", options: [] },
        res_probate_info: { text: "<h4>Probate Sale</h4>We will coordinate with your estate attorney. We need to verify if the sale requires court confirmation or has 'Full Authority'.", options: [] },
        res_market_list: { text: "<h4>Market Launch</h4>Step 1: Professional Photography and Staging. We want to maximize the 'First 7 Days' of market exposure.", options: [] },
        res_as_is_cash: { text: "<h4>As-Is Sale</h4>I will present your property to my private network of cash investors for a 7-14 day closing with no repairs needed.", options: [] },
        res_house_hack: { text: "<h4>House Hacking</h4>Look for 2-4 unit properties. You can use an FHA loan with only 3.5% down while the other units pay your mortgage.", options: [] },
        res_commercial: { text: "<h4>Commercial Interests</h4>Commercial deals are driven by NOI (Net Operating Income). Let's review the rent roll and P&L of your target sector.", options: [] }
    };

    let currentNode = 'start';
    let history = [];

    const questionEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const backBtn = document.getElementById('back-btn');
    const progressFill = document.getElementById('progress-bar-fill');
    const stepCounter = document.getElementById('step-counter');

    function renderNode() {
        const node = tree[currentNode];
        
        questionEl.innerHTML = node.text;
        optionsContainer.innerHTML = '';
        
        // Show/Hide Back Button
        backBtn.style.display = history.length > 0 ? 'block' : 'none';
        
        // Update Progress Bar (assuming ~4 steps max)
        const progress = Math.min((history.length + 1) * 25, 100);
        progressFill.style.width = (node.options.length === 0) ? '100%' : `${progress}%`;
        stepCounter.innerText = (node.options.length === 0) ? 'FINISH' : `STEP ${history.length + 1}`;

        if (node.options.length === 0) {
            questionEl.className = 'result-card';
            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start New Search";
            restartBtn.className = "tree-option-btn";
            restartBtn.style.marginTop = "25px";
            restartBtn.style.backgroundColor = "#333";
            restartBtn.style.color = "white";
            restartBtn.style.textAlign = "center";
            restartBtn.onclick = () => {
                history = [];
                currentNode = 'start';
                questionEl.className = '';
                renderNode();
            };
            optionsContainer.appendChild(restartBtn);
        } else {
            node.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                btn.className = "tree-option-btn";
                btn.onclick = () => {
                    history.push(currentNode);
                    currentNode = opt.next;
                    renderNode();
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

    backBtn.onclick = () => {
        if (history.length > 0) {
            currentNode = history.pop();
            questionEl.className = '';
            renderNode();
        }
    };

    renderNode();
});
