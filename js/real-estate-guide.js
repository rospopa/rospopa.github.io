const tree = {
    start: {
        text: "What kind of project are you building?",
        options: [
            { label: "Web App", next: "web_path" },
            { label: "Mobile App", next: "mobile_path" }
        ]
    },
    web_path: {
        text: "Do you need SEO (Search Engine Optimization)?",
        options: [
            { label: "Yes, it's a public site", next: "seo_yes" },
            { label: "No, it's a private dashboard", next: "seo_no" }
        ]
    },
    // End states
    seo_yes: { text: "Use Next.js for Server-Side Rendering.", options: [] },
    seo_no: { text: "A standard React or Vue app will work great!", options: [] }
};

let currentNode = 'start';
let history = []; // Keeps track of where the user has been

const questionEl = document.getElementById('question-text');
const optionsEl = document.getElementById('options-container');
const backBtn = document.getElementById('back-btn');

function renderNode() {
    const node = tree[currentNode];
    questionEl.innerText = node.text;
    optionsEl.innerHTML = '';

    // Show/Hide back button
    backBtn.style.display = history.length > 0 ? 'inline-block' : 'none';

    // Create buttons for each option
    node.options.forEach(option => {
        const btn = document.createElement('button');
        btn.innerText = option.label;
        btn.className = "choice-button"; // For styling later
        btn.onclick = () => {
            history.push(currentNode); // Save current spot before moving
            currentNode = option.next;
            renderNode();
        };
        optionsEl.appendChild(btn);
    });
}

// Back button logic
backBtn.onclick = () => {
    if (history.length > 0) {
        currentNode = history.pop(); // Get the last item from history
        renderNode();
    }
};

// Initial start
renderNode();
