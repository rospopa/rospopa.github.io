const tree = {
    start: {
        text: "What is your primary real estate goal today?",
        options: [
            { label: "I want to Buy a home", next: "buy_start" },
            { label: "I want to Sell my property", next: "sell_start" },
            { label: "I want to Invest for profit", next: "invest_start" }
        ]
    },
    // BUYING BRANCH
    buy_start: {
        text: "Is this your first time buying a home?",
        options: [
            { label: "Yes, I'm a first-time buyer", next: "buy_preapproval" },
            { label: "No, I've done this before", next: "buy_search" }
        ]
    },
    buy_preapproval: {
        text: "Do you have a mortgage pre-approval letter yet?",
        options: [
            { label: "Yes, I'm ready to shop", next: "buy_search" },
            { label: "No, I need to know my budget", next: "res_finance" }
        ]
    },
    // SELLING BRANCH
    sell_start: {
        text: "How quickly do you need to sell?",
        options: [
            { label: "ASAP (Under 30 days)", next: "res_fast_sell" },
            { label: "No rush (Targeting top dollar)", next: "sell_prep" }
        ]
    },
    // INVESTING BRANCH
    invest_start: {
        text: "What is your preferred investment strategy?",
        options: [
            { label: "Rental Income (Passive)", next: "res_rentals" },
            { label: "Fix & Flip (Active)", next: "res_flip" }
        ]
    },
    // RESULTS (The Ends of the paths)
    res_finance: { text: "Focus on financing first. A pre-approval letter is your ticket to being taken seriously by sellers.", options: [] },
    res_rentals: { text: "Look for multi-family units. Focus on the Cap Rate and Cash-on-Cash return metrics.", options: [] },
    res_fast_sell: { text: "Consider off-market investor buyers or iBuyers to close in as little as 10 days.", options: [] }
};

let currentNode = 'start';
let history = [];

function renderNode() {
    const node = tree[currentNode];
    const questionEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const backBtn = document.getElementById('back-btn');
    const progressFill = document.getElementById('progress-bar-fill');
    const stepCounter = document.getElementById('step-counter');

    // Update UI
    questionEl.innerText = node.text;
    optionsContainer.innerHTML = '';
    
    // Toggle Back Button and Progress
    backBtn.style.display = history.length > 0 ? 'block' : 'none';
    const progressWidth = Math.min((history.length + 1) * 33, 100);
    progressFill.style.width = `${progressWidth}%`;
    stepCounter.innerText = `Step ${history.length + 1}`;

    if (node.options.length === 0) {
        // Result State
        questionEl.classList.add('result-node');
        const restartBtn = document.createElement('button');
        restartBtn.innerText = "Start Over";
        restartBtn.className = "tree-option-btn";
        restartBtn.style.marginTop = "20px";
        restartBtn.style.backgroundColor = "#333";
        restartBtn.style.color = "white";
        restartBtn.onclick = () => {
            history = [];
            currentNode = 'start';
            questionEl.classList.remove('result-node');
            renderNode();
        };
        optionsContainer.appendChild(restartBtn);
    } else {
        // Option State
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

document.getElementById('back-btn').onclick = () => {
    if (history.length > 0) {
        currentNode = history.pop();
        document.getElementById('question-text').classList.remove('result-node');
        renderNode();
    }
};

renderNode();
