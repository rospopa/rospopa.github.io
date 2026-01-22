document.addEventListener('DOMContentLoaded', () => {
    const tree = {
        start: {
            text: "What is your primary focus in Real Estate today?",
            options: [
                { label: "🏠 Buying a Home", next: "buy_path" },
                { label: "💰 Selling a Property", next: "sell_path" },
                { label: "📈 Investing for Wealth", next: "invest_path" }
            ]
        },
        // BUYING
        buy_path: {
            text: "What is your current buying status?",
            options: [
                { label: "First-Time Buyer", next: "buy_finance" },
                { label: "Repeat Buyer", next: "buy_contingency" }
            ]
        },
        buy_finance: {
            text: "How do you plan to finance this purchase?",
            options: [
                { label: "Mortgage (Lender needed)", next: "res_finance" },
                { label: "All-Cash Purchase", next: "res_cash" }
            ]
        },
        buy_contingency: {
            text: "Do you need to sell your current home first?",
            options: [
                { label: "Yes, I need to sell first", next: "sell_path" },
                { label: "No, I am ready to buy", next: "buy_finance" }
            ]
        },
        // SELLING
        sell_path: {
            text: "What best describes your selling situation?",
            options: [
                { label: "Standard Residential Sale", next: "res_standard_sell" },
                { label: "Inherited / Probate Property", next: "res_probate" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031" }
            ]
        },
        // INVESTING
        invest_path: {
            text: "What is your target investment strategy?",
            options: [
                { label: "Rental Income (Passive)", next: "res_rental" },
                { label: "Fix and Flip (Active)", next: "res_flip" },
                { label: "House Hacking", next: "res_house_hack" }
            ]
        },
        // FINAL RESULTS (Dead Ends)
        res_finance: { text: "Action: Get Pre-Approved. In a competitive market, a lender's letter is your most powerful tool.", options: [] },
        res_cash: { text: "Action: Prepare Proof of Funds. Cash allows for aggressive negotiation and fast closings.", options: [] },
        res_standard_sell: { text: "Action: Comparative Market Analysis. We need to price your home accurately to capture peak interest.", options: [] },
        res_probate: { text: "Action: Verify court authority. We will coordinate with your estate attorney for a smooth sale.", options: [] },
        res_1031: { text: "Action: Identify your replacement property within 45 days. You MUST use a Qualified Intermediary.", options: [] },
        res_rental: { text: "Action: Focus on Cap Rate. We'll look for multi-family units with strong vacancy historical data.", options: [] },
        res_flip: { text: "Action: Secure your team. We'll identify distressed properties with a high 'After Repair Value' (ARV).", options: [] },
        res_house_hack: { text: "Action: Seek 2-4 unit properties. You can live in one unit while others pay your mortgage.", options: [] }
    };

    let currentNode = 'start';
    let history = [];
    let pathLabels = [];

    const questionEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const backBtn = document.getElementById('back-btn');
    const progressFill = document.getElementById('progress-bar-fill');
    const stepCounter = document.getElementById('step-counter');
    const contactFormContainer = document.getElementById('contact-form-container');
    const messageField = document.getElementById('message-field');

    function renderNode() {
        const node = tree[currentNode];
        if (!node) return; // Safety check

        questionEl.innerText = node.text;
        optionsContainer.innerHTML = '';
        
        // UI Logic: Back button visibility
        backBtn.style.display = history.length > 0 ? 'block' : 'none';
        
        // Progress bar and Step Counter logic
        const currentStep = history.length + 1;
        const progress = Math.min(currentStep * 25, 100); 
        
        progressFill.style.width = (node.options.length === 0) ? '100%' : `${progress}%`;
        stepCounter.innerText = (node.options.length === 0) ? 'FINISH' : `Step ${currentStep}`;

        if (node.options.length === 0) {
            // Dead end reached: Show Form
            questionEl.className = 'result-card';
            contactFormContainer.style.display = 'block';
            
            // Populate contact form message
            if (messageField) {
                messageField.value = `Hello Pavlo,\n\nI just completed the Real Estate Guide.\nPath Taken: ${pathLabels.join(" > ")}\nRecommendation: ${node.text}`;
            }
            
            // Add a "Start Over" button
            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start Over";
            restartBtn.className = "tree-option-btn";
            restartBtn.style.marginTop = "20px";
            restartBtn.style.textAlign = "center";
            restartBtn.style.backgroundColor = "#333";
            restartBtn.style.color = "#fff";
            restartBtn.onclick = () => {
                resetTree();
            };
            optionsContainer.appendChild(restartBtn);
        } else {
            // Question phase: Hide Form
            contactFormContainer.style.display = 'none';
            questionEl.className = '';
            
            node.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                btn.className = "tree-option-btn";
                btn.onclick = () => {
                    history.push(currentNode);
                    pathLabels.push(opt.label);
                    currentNode = opt.next;
                    renderNode();
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

    function resetTree() {
        history = [];
        pathLabels = [];
        currentNode = 'start';
        contactFormContainer.style.display = 'none';
        questionEl.className = '';
        renderNode();
    }

    backBtn.onclick = () => {
        if (history.length > 0) {
            currentNode = history.pop();
            pathLabels.pop();
            // Ensure form is hidden when going back from a result
            contactFormContainer.style.display = 'none';
            questionEl.className = '';
            renderNode();
        }
    };

    renderNode();
});
