document.addEventListener('DOMContentLoaded', () => {
    const tree = {
        start: {
            text: "How can I help you with your real estate journey today?",
            options: [
                { label: "I am looking to Buy", next: "buy_path" },
                { label: "I am looking to Sell", next: "sell_path" },
                { label: "I am looking to Invest", next: "invest_path" }
            ]
        },
        // --- BUYING ---
        buy_path: {
            text: "Wonderful. Have you already been pre-approved for a mortgage?",
            options: [
                { label: "Yes, I have my letter", next: "buy_search" },
                { label: "No, I need a recommendation", next: "res_finance" }
            ]
        },
        buy_search: {
            text: "Are you looking for a primary residence or a second home?",
            options: [
                { label: "Primary Residence", next: "res_buy_ready" },
                { label: "Vacation / Second Home", next: "res_buy_second" }
            ]
        },
        // --- SELLING ---
        sell_path: {
            text: "Is your property currently occupied by tenants or yourself?",
            options: [
                { label: "Owner-Occupied", next: "sell_timeline" },
                { label: "Tenant-Occupied", next: "res_sell_tenant" }
            ]
        },
        sell_timeline: {
            text: "What is your target move-out date?",
            options: [
                { label: "Within 3 months", next: "res_sell_now" },
                { label: "6+ months / Just curious", next: "res_sell_curious" }
            ]
        },
        // --- INVESTING ---
        invest_path: {
            text: "What is your primary investment goal?",
            options: [
                { label: "Monthly Cash Flow", next: "res_invest_cash" },
                { label: "Value Appreciation / Flip", next: "res_invest_flip" }
            ]
        },
        // --- RESULTS ---
        res_finance: { text: "Step 1: Get Pre-Approved. I can connect you with trusted local lenders to ensure you're ready to make a winning offer.", options: [] },
        res_buy_ready: { text: "Step 1: Let's define your criteria. I'll set up a real-time MLS alert for homes that match your specific needs.", options: [] },
        res_buy_second: { text: "Step 1: Tax and Rental Analysis. We should review the local short-term rental regulations for your target area.", options: [] },
        res_sell_now: { text: "Step 1: Comparative Market Analysis (CMA). We need to price your home accurately to capture peak market interest immediately.", options: [] },
        res_sell_tenant: { text: "Step 1: Lease Review. Selling with tenants requires specific notice periods; let's review your current lease agreement together.", options: [] },
        res_invest_cash: { text: "Step 1: Cap Rate Analysis. We will focus on multi-family units or high-yield rental markets.", options: [] },
        res_invest_flip: { text: "Step 1: Off-Market Search. Successful flips start with buying right. I can help you find distressed or off-market opportunities.", options: [] }
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
        
        // Reset classes
        questionEl.classList.remove('result-text');
        questionEl.innerText = node.text;
        optionsContainer.innerHTML = '';
        
        // UI Updates
        backBtn.style.display = history.length > 0 ? 'block' : 'none';
        const progress = Math.min((history.length + 1) * 25, 100);
        progressFill.style.width = `${progress}%`;
        stepCounter.innerText = `Step ${history.length + 1}`;

        if (node.options.length === 0) {
            // Final Result Styling
            questionEl.classList.add('result-text');
            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start Over";
            restartBtn.className = "tree-option-btn";
            restartBtn.style.marginTop = "20px";
            restartBtn.style.backgroundColor = "#333";
            restartBtn.style.color = "white";
            restartBtn.onclick = () => {
                history = [];
                currentNode = 'start';
                renderNode();
            };
            optionsContainer.appendChild(restartBtn);
        } else {
            // Question Options
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
            renderNode();
        }
    };

    renderNode();
});
