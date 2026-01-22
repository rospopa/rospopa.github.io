<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Pavlo Rospopa Website</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>

    <style>
        /* SECURITY / DISABLE SELECTION */
        body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; font-family: sans-serif; margin: 0; padding: 0; background-color: #fff; color: #333; }
        input, textarea { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }

        /* HEADER & FOOTER STYLES */
        .site-header { border-bottom: 1px solid #e0e0e0; padding: 20px 0; }
        .wrap { max-width: 800px; margin: 0 auto; padding: 0 20px; }
        .site-title { font-size: 1.2rem; font-weight: bold; color: #333; text-decoration: none; }
        .site-nav { float: right; }
        
        /* GUIDE UI STYLES */
        #real-estate-guide-container {
            margin: 40px auto; 
            padding: 30px; 
            border: 1px solid #e0e0e0; 
            border-radius: 12px; 
            background-color: #ffffff; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
        }
        .tree-option-btn {
            padding: 16px 20px; background-color: #f8f9fa; color: #333; border: 2px solid #eef0f2;
            border-radius: 8px; cursor: pointer; font-size: 1.05rem; text-align: left;
            transition: all 0.25s ease; font-weight: 500; width: 100%; margin-bottom: 10px;
            position: relative; overflow: hidden; display: block;
        }
        .tree-option-btn:hover { border-color: #4285F4; color: #4285F4; transform: translateY(-2px); background-color: #fff; }
        
        .result-card { background: #f4f7ff; border-left: 6px solid #4285F4; padding: 25px; border-radius: 8px; color: #334155; line-height: 1.7; margin-bottom: 20px; }
        
        /* CONTACT FORM STYLES */
        #contact-form-container { margin-top: 30px; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #eee; }
        #contact-form { display: flex; flex-direction: column; gap: 15px; }
        #contact-form input, #contact-form textarea { padding: 12px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; font-size: 1rem; }
        #contact-form button { padding: 12px 24px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }

        footer { border-top: 1px solid #e0e0e0; margin-top: 40px; padding: 20px 0; text-align: center; font-size: 0.9rem; color: #666; }

        /* ANIMATIONS */
        .ripple { position: absolute; background: rgba(66, 133, 244, 0.2); border-radius: 50%; transform: scale(0); animation: ripple-effect 0.7s linear; pointer-events: none; }
        @keyframes ripple-effect { to { transform: scale(4); opacity: 0; } }
    </style>
</head>
<body>

<header class="site-header">
    <div class="wrap">
        <a class="site-title" href="https://rospopa.com">Pavlo Rospopa Website</a>
        <nav class="site-nav">
            <a style="text-decoration: none; color: #4285F4;" href="mailto:pavlo@rospopa.com?subject=rospopa.github.io">pavlo@rospopa.com</a>
        </nav>
    </div>
</header>

<main class="wrap">
    <div id="real-estate-guide-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <span id="back-btn" style="cursor: pointer; font-size: 0.9rem; color: #4285F4; font-weight: 600; display: none;">← Back</span>
            <div style="flex-grow: 1; height: 6px; background: #eee; margin: 0 20px; border-radius: 10px;">
                <div id="progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4285F4, #a855f7); border-radius: 10px; transition: width 0.4s ease;"></div>
            </div>
            <span id="step-counter" style="font-size: 0.8rem; color: #999; font-weight: bold;">Step 1</span>
        </div>

        <div id="tree-content">
            <h2 id="question-text" style="margin-bottom: 25px; font-size: 1.4rem; color: #222;">Preparing your guide...</h2>
            <div id="options-container"></div>
        </div>

        <div id="contact-form-container" style="display: none;">
            <h3 style="margin-top: 0;">Next Step: Get in Touch</h3>
            <form id="contact-form">
                <input type="text" name="name" placeholder="Your Name" required />
                <input type="email" name="email" placeholder="Your Email" required />
                <textarea id="message-field" name="message" rows="4" required></textarea>
                <div class="g-recaptcha" data-sitekey="6Let_E8sAAAAAP948s5QuqjQ-HKYRuoXxLzILZ9p"></div>
                <button type="submit" id="submit-btn">Send My Strategy</button>
            </form>
        </div>
    </div>
</main>

<footer>
    <div class="wrap">
        <p>Copyright © <span id="currentYear"></span> Pavlo Rospopa. All Rights Reserved.</p>
    </div>
</footer>

<script>
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('currentYear').textContent = new Date().getFullYear();

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

    const elements = {
        question: document.getElementById('question-text'),
        options: document.getElementById('options-container'),
        backBtn: document.getElementById('back-btn'),
        progress: document.getElementById('progress-bar-fill'),
        step: document.getElementById('step-counter'),
        formContainer: document.getElementById('contact-form-container'),
        message: document.getElementById('message-field')
    };

    function renderNode() {
        const node = tree[currentNode];
        elements.question.innerText = node.text;
        elements.options.innerHTML = '';
        
        const stepNum = history.length + 1;
        elements.step.innerText = (node.options.length === 0) ? 'Complete' : `Step ${stepNum}`;
        elements.progress.style.width = (node.options.length === 0) ? '100%' : (stepNum * 33) + '%';
        elements.backBtn.style.display = (history.length > 0) ? 'block' : 'none';

        if (node.options.length === 0) {
            elements.question.classList.add('result-card');
            elements.formContainer.style.display = 'block';
            elements.message.value = "User Path: " + pathLabels.join(" > ") + "\n\nRecommendation: " + node.text;

            const restartBtn = document.createElement('button');
            restartBtn.innerText = "Start Over";
            restartBtn.className = "tree-option-btn";
            restartBtn.style.textAlign = "center";
            restartBtn.style.marginTop = "20px";
            restartBtn.onclick = () => { history = []; pathLabels = []; currentNode = 'start'; renderNode(); };
            elements.options.appendChild(restartBtn);
        } else {
            elements.question.classList.remove('result-card');
            elements.formContainer.style.display = 'none';

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
                elements.options.appendChild(btn);
            });
        }
    }

    elements.backBtn.onclick = () => {
        if (history.length > 0) {
            currentNode = history.pop();
            pathLabels.pop();
            renderNode();
        }
    };

    renderNode();
});
</script>
</body>
</html>
