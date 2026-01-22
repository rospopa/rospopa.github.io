/**
 * Real Estate Guide - Optimized for Cross-Browser & Mobile Compatibility
 */
document.addEventListener('DOMContentLoaded', function() {
    // 1. DATA STRUCTURE
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
        // Terminal Nodes (Results)
        res_finance: { text: "Action: Get Pre-Approved. In a competitive market, a lender's letter is your most powerful tool.", options: [] },
        res_cash: { text: "Action: Prepare Proof of Funds. Cash allows for aggressive negotiation and fast closings.", options: [] },
        res_standard_sell: { text: "Action: Comparative Market Analysis. We need to price your home accurately to capture peak interest.", options: [] },
        res_probate: { text: "Action: Verify court authority. We will coordinate with your estate attorney for a smooth sale.", options: [] },
        res_1031: { text: "Action: Identify your replacement property within 45 days. You MUST use a Qualified Intermediary.", options: [] },
        res_rental: { text: "Action: Focus on Cap Rate. We'll look for multi-family units with strong vacancy historical data.", options: [] },
        res_flip: { text: "Action: Secure your team. We'll identify distressed properties with a high After Repair Value.", options: [] },
        res_house_hack: { text: "Action: Seek 2-4 unit properties. You can live in one unit while others pay your mortgage.", options: [] }
    };

    // 2. STATE MANAGEMENT
    let currentNode = 'start';
    let history = []; 
    let pathLabels = []; 

    // 3. DOM ELEMENTS
    const elements = {
        question: document.getElementById('question-text'),
        options: document.getElementById('options-container'),
        backBtn: document.getElementById('back-btn'),
        progress: document.getElementById('progress-bar-fill'),
        step: document.getElementById('step-counter'),
        formContainer: document.getElementById('contact-form-container'),
        message: document.getElementById('message-field')
    };

    // 4. MOBILE-FRIENDLY RIPPLE EFFECT
    function createRipple(e, button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const rect = button.getBoundingClientRect();
        
        // Support for both Mouse and Touch coordinates
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (clientX - rect.left - size/2) + 'px';
        ripple.style.top = (clientY - rect.top - size/2) + 'px';
        
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    }

    // 5. CORE RENDER ENGINE
    function renderNode() {
        const node = tree[currentNode];
        if (!node) return;

        // Reset Styles & Content
        elements.question.innerText = node.text;
        elements.options.innerHTML = '';
        
        // Progress Logic
        const stepNum = history.length + 1;
        elements.step.innerText = (node.options.length === 0) ? 'Complete' : `Step ${stepNum}`;
        elements.progress.style.width = (node.options.length === 0) ? '100%' : (stepNum * 33) + '%';
        
        // Back Button Visibility
        elements.backBtn.style.display = (history.length > 0) ? 'block' : 'none';

        if (node.options.length === 0) {
            // Result Node
            elements.question.classList.add('result-card');
            elements.formContainer.style.display = 'block';
            if (elements.message) {
                elements.message.value = "Path: " + pathLabels.join(" > ") + "\nRecommendation: " + node.text;
            }

            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start Over";
            restartBtn.className = "tree-option-btn restart";
            restartBtn.style.textAlign = "center";
            restartBtn.addEventListener('click', function(e) {
                createRipple(e, restartBtn);
                setTimeout(resetGuide, 200);
            }, { passive: true });
            elements.options.appendChild(restartBtn);
        } else {
            // Question Node
            elements.question.classList.remove('result-card');
            elements.formContainer.style.display = 'none';

            node.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                btn.className = "tree-option-btn";
                // Use passive listener for better mobile scroll performance
                btn.addEventListener('click', function(e) {
                    createRipple(e, btn);
                    setTimeout(() => {
                        history.push(currentNode);
                        pathLabels.push(opt.label);
                        currentNode = opt.next;
                        renderNode();
                        window.scrollTo({ top: elements.question.offsetTop - 100, behavior: 'smooth' });
                    }, 180);
                }, { passive: true });
                elements.options.appendChild(btn);
            });
        }
    }

    function resetGuide() {
        history = []; pathLabels = []; currentNode = 'start';
        renderNode();
    }

    // 6. GLOBAL EVENT HANDLERS
    elements.backBtn.addEventListener('click', function() {
        if (history.length > 0) {
            currentNode = history.pop();
            pathLabels.pop();
            renderNode();
        }
    }, { passive: true });

    // 7. INITIALIZE
    renderNode();
});
