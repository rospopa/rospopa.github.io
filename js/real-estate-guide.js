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
        sell_path: {
            text: "What best describes your selling situation?",
            options: [
                { label: "Standard Residential Sale", next: "res_standard_sell" },
                { label: "Inherited / Probate Property", next: "res_probate" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031" }
            ]
        },
        invest_path: {
            text: "What is your target investment strategy?",
            options: [
                { label: "Rental Income (Passive)", next: "res_rental" },
                { label: "Fix and Flip (Active)", next: "res_flip" },
                { label: "House Hacking", next: "res_house_hack" }
            ]
        },
        // DEAD ENDS
        res_finance: { text: "Action: Get Pre-Approved. In a competitive market, a lender's letter is your most powerful tool.", options: [] },
        res_cash: { text: "Action: Prepare Proof of Funds. Cash allows for aggressive negotiation and fast closings.", options: [] },
        res_standard_sell: { text: "Action: Comparative Market Analysis. We need to price your home accurately to capture peak interest.", options: [] },
        res_probate: { text: "Action: Verify court authority. We will coordinate with your estate attorney for a smooth sale.", options: [] },
        res_1031: { text: "Action: Identify your replacement property within 45 days. You MUST use a Qualified Intermediary.", options: [] },
        res_rental: { text: "Action: Focus on Cap Rate. We'll look for multi-family units with strong vacancy historical data.", options: [] },
        res_flip: { text: "Action: Secure your team. We'll identify distressed properties with a high After Repair Value.", options: [] },
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
        if (!node) return;

        questionEl.innerText = node.text;
        optionsContainer.innerHTML = '';
        
        const currentStep = history.length + 1;
        stepCounter.innerText = (node.options.length === 0) ? 'Complete' : `Step ${currentStep}`;
        
        const progressPercentage = Math.min(currentStep * 33, 100);
        progressFill.style.width = (node.options.length === 0) ? '100%' : `${progressPercentage}%`;

        backBtn.style.display = (history.length > 0) ? 'block' : 'none';

        if (node.options.length === 0) {
            questionEl.className = 'result-card';
            contactFormContainer.style.display = 'block';
            
            if (messageField) {
                messageField.value = `Path Taken: ${pathLabels.join(" → ")}\nRecommendation: ${node.text}`;
            }

            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start Over";
            restartBtn.className = "tree-option-btn";
            restartBtn.style.marginTop = "20px";
            restartBtn.onclick = () => resetGuide();
            optionsContainer.appendChild(restartBtn);
        } else {
            questionEl.className = '';
            contactFormContainer.style.display = 'none';

            node.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                btn.className = "tree-option-btn";
                btn.onclick = () => {
                    history.push(currentNode);
                    pathLabels.push(opt.label);
                    currentNode = opt.next;
                    renderNode();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

    function resetGuide() {
        history = []; pathLabels = []; currentNode = 'start';
        renderNode();
    }

    backBtn.onclick = () => {
        if (history.length > 0) {
            currentNode = history.pop();
            pathLabels.pop();
            renderNode(); 
        }
    };

    renderNode();
});
