document.addEventListener('DOMContentLoaded', () => {
    const tree = {
        start: {
            text: "What is your primary focus in Real Estate today?",
            options: [
                { label: "🏠 Buying a Home", next: "buy_type" },
                { label: "💰 Selling a Property", next: "sell_reason" },
                { label: "📈 Investing for Wealth", next: "invest_strategy" },
                { label: "🏢 Commercial / Industrial", next: "res_commercial" }
            ]
        },

        // --- BUYING PATH ---
        buy_type: {
            text: "What type of buyer are you?",
            options: [
                { label: "First-Time Buyer", next: "buy_finance" },
                { label: "Moving Up / Downsizing", next: "buy_contingency" },
                { label: "Relocating from out of state", next: "res_relocation" }
            ]
        },
        buy_finance: {
            text: "How do you plan to finance the purchase?",
            options: [
                { label: "Conventional / FHA Loan", next: "res_finance_standard" },
                { label: "Cash Purchase", next: "res_cash_buyer" },
                { label: "VA Loan (Military)", next: "res_va_loan" }
            ]
        },
        buy_contingency: {
            text: "Do you need to sell your current home to buy the new one?",
            options: [
                { label: "Yes (Contingent Offer)", next: "res_contingency" },
                { label: "No (Funds are separate)", next: "buy_finance" }
            ]
        },

        // --- SELLING PATH ---
        sell_reason: {
            text: "What best describes your selling situation?",
            options: [
                { label: "Standard Sale (Market Value)", next: "sell_condition" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031" },
                { label: "Inherited / Probate Property", next: "res_probate" }
            ]
        },
        sell_condition: {
            text: "What is the condition of the property?",
            options: [
                { label: "Turnkey / Great Shape", next: "res_market_list" },
                { label: "Needs Significant Repair", next: "sell_urgent" }
            ]
        },
        sell_urgent: {
            text: "Is speed or price more important to you?",
            options: [
                { label: "Speed (Cash offer now)", next: "res_as_is" },
                { label: "Price (I'll fix it first)", next: "res_prep_guide" }
            ]
        },

        // --- INVESTING PATH ---
        invest_strategy: {
            text: "What is your preferred investing vehicle?",
            options: [
                { label: "House Hacking (Live + Rent)", next: "res_house_hack" },
                { label: "Short-Term Rental (Airbnb)", next: "res_str" },
                { label: "Fix and Flip", next: "res_flip" },
                { label: "Buy and Hold (Long-Term)", next: "res_rental" }
            ]
        },

        // --- FINAL RESULTS ---
        res_finance_standard: { text: "<h4>Your Action Plan:</h4>Get pre-approved immediately. In a competitive market, a standard offer without a pre-approval letter is rarely considered.", options: [] },
        res_cash_buyer: { text: "<h4>Your Action Plan:</h4>Prepare your 'Proof of Funds' (POF). Cash is king, but you still need to act fast on quality inventory.", options: [] },
        res_va_loan: { text: "<h4>Your Action Plan:</h4>Ensure your lender is VA-certified. We will focus on homes that meet VA 'Minimum Property Requirements' (MPR).", options: [] },
        res_1031: { text: "<h4>Your Action Plan:</h4>Identify your replacement property within 45 days. You need a Qualified Intermediary (QI) to handle the funds to avoid taxes.", options: [] },
        res_probate: { text: "<h4>Your Action Plan:</h4>Verify the 'Letters of Administration.' I can help coordinate with your attorney for a smooth court-ordered sale.", options: [] },
        res_house_hack: { text: "<h4>Your Action Plan:</h4>We'll look for duplexes or homes with ADUs (Accessory Dwelling Units) that qualify for FHA 3.5% down payments.", options: [] },
        res_commercial: { text: "<h4>Your Action Plan:</h4>Commercial deals are driven by NOI (Net Operating Income). Let's review the rent roll and P&L of your target sector.", options: [] },
        res_as_is: { text: "<h4>Your Action Plan:</h4>Skip the repairs. We will market to my private list of cash investors for a 10-day close.", options: [] },
        res_contingency: { text: "<h4>Your Action Plan:</h4>We should list your home 'Subject to Seller Finding Replacement Home' to ensure you aren't homeless between closings.", options: [] }
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
        
        // Setup Question
        questionEl.innerHTML = node.text;
        optionsContainer.innerHTML = '';
        
        // UI Updates
        backBtn.style.display = history.length > 0 ? 'block' : 'none';
        const progress = Math.min((history.length) * 33 + 10, 100);
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
