document.addEventListener('DOMContentLoaded', () => {
    const tree = {
        start: {
            text: "How can I help you with your real estate journey today?",
            options: [
                { label: "🏠 I am looking to Buy", next: "buy_path" },
                { label: "💰 I am looking to Sell", next: "sell_path" },
                { label: "📈 I am looking to Invest", next: "invest_path" }
            ]
        },
        // BUY BRANCH
        buy_path: {
            text: "What is your primary goal for this purchase?",
            options: [
                { label: "Buying a Primary Residence", next: "buy_status" },
                { label: "Second Home / Vacation", next: "res_vacation" },
                { label: "New Construction / Land", next: "res_land" }
            ]
        },
        buy_status: {
            text: "Are you a first-time buyer or moving from another home?",
            options: [
                { label: "First-Time Buyer", next: "buy_finance" },
                { label: "Relocating / Upsizing", next: "buy_contingency" }
            ]
        },
        buy_finance: {
            text: "How do you plan to finance this home?",
            options: [
                { label: "Mortgage (Lender needed)", next: "res_lender" },
                { label: "All-Cash Purchase", next: "res_cash" }
            ]
        },
        // SELL BRANCH
        sell_path: {
            text: "What best describes your selling situation?",
            options: [
                { label: "Standard Market Sale", next: "sell_prep" },
                { label: "1031 Tax-Deferred Exchange", next: "res_1031" },
                { label: "Probate / Estate Sale", next: "res_probate" }
            ]
        },
        sell_prep: {
            text: "What is the current condition of the property?",
            options: [
                { label: "Turnkey (Ready to list)", next: "res_list" },
                { label: "Needs Repairs / Fixer", next: "res_as_is" }
            ]
        },
        // INVEST BRANCH
        invest_path: {
            text: "What is your preferred investment strategy?",
            options: [
                { label: "Long-Term Rental (Passive)", next: "res_rental" },
                { label: "Fix and Flip (Active)", next: "res_flip" },
                { label: "House Hacking", next: "res_house_hack" }
            ]
        },
        // RESULTS (Dead Ends)
        res_lender: { text: "Action: Get Pre-Approved. In a competitive market, sellers won't consider offers without a lender's letter.", options: [] },
        res_1031: { text: "Action: Identify your property within 45 days. You MUST use a Qualified Intermediary to avoid taxes.", options: [] },
        res_probate: { text: "Action: Verify court authority. Estate sales require specific legal notice periods before closing.", options: [] },
        res_cash: { text: "Action: Prepare Proof of Funds (POF). Cash allows for shorter inspection periods and stronger negotiations.", options: [] },
        res_list: { text: "Action: Market Launch. We should focus on professional staging and photography to maximize value.", options: [] },
        res_house_hack: { text: "Action: Seek Multi-Family (2-4 units). You can use FHA 3.5% down while tenants pay your mortgage.", options: [] }
    };

    let currentNode = 'start';
    let history = [];
    let pathTaken = [];

    const questionEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const backBtn = document.getElementById('back-btn');
    const progressFill = document.getElementById('progress-bar-fill');
    const contactForm = document.getElementById('contact-form-container');
    const messageField = document.getElementById('message-field');

    function renderNode() {
        const node = tree[currentNode];
        questionEl.innerHTML = node.text;
        optionsContainer.innerHTML = '';
        
        backBtn.style.display = history.length > 0 ? 'block' : 'none';
        const progress = Math.min((history.length + 1) * 25, 100);
        progressFill.style.width = (node.options.length === 0) ? '100%' : `${progress}%`;

        if (node.options.length === 0) {
            questionEl.className = 'result-card';
            contactForm.style.display = 'block';
            
            const journey = pathTaken.join(" → ");
            messageField.value = `I completed the Real Estate Guide.\nPath: ${journey}\n\nConclusion: ${node.text}\n\nI would like to schedule a consultation.`;
            contactForm.scrollIntoView({ behavior: 'smooth' });
        } else {
            contactForm.style.display = 'none';
            questionEl.className = '';
            node.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                btn.className = "tree-option-btn";
                btn.onclick = () => {
                    history.push(currentNode);
                    pathTaken.push(opt.label);
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
            pathTaken.pop();
            renderNode();
        }
    };

    renderNode();
});
