document.addEventListener("DOMContentLoaded", function () {
    const USER = 'rospopa';
    const REPO = 'rospopa.github.io';
    const BRANCHES = ['main', 'master', 'gh-pages']; // tried in order

    const timeEl = document.getElementById('repo-update-time');
    const msgEl  = document.getElementById('repo-commit-msg');

    // 1. Build candidate file paths (handles clean URLs, trailing slash, case)
    function candidatePaths() {
        let p = decodeURIComponent(window.location.pathname).replace(/^\/+/, '');
        if (p === '' || p.endsWith('/')) p += 'index.html';

        const paths = new Set();
        paths.add(p);
        if (!/\.[a-z0-9]+$/i.test(p)) paths.add(p + '.html'); // /blog-posts -> blog-posts.html
        paths.add(p.toLowerCase());
        return [...paths];
    }

    async function tryFetch(path, branch) {
        const url = `https://api.github.com/repos/${USER}/${REPO}/commits`
                  + `?path=${encodeURIComponent(path)}&sha=${branch}&per_page=1`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.status === 403) throw new Error('rate-limited');
        if (!res.ok) return null;

        // GitHub paginates commits. By requesting per_page=1, the 'Link' header 
        // will tell us exactly how many pages (i.e. total commits) exist.
        let totalCommits = 1; 
        const linkHeader = res.headers.get('Link');
        if (linkHeader) {
            // Extract the page number from the 'last' rel link
            const match = linkHeader.match(/[?&]page=(\d+)[^>]*>; rel="last"/);
            if (match) {
                totalCommits = parseInt(match[1], 10);
            }
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length) {
            return { commit: data[0], totalCommits: totalCommits };
        }
        return null;
    }

    async function fetchPageStats() {
        try {
            for (const branch of BRANCHES) {
                for (const path of candidatePaths()) {
                    const result = await tryFetch(path, branch);
                    if (result) return render(result, false);
                }
            }
            // Fallback: latest commit on the repo (any file)
            for (const branch of BRANCHES) {
                const result = await tryFetch('', branch);
                if (result) return render(result, true);
            }
            timeEl.innerText = 'Unknown (file not tracked)';
            msgEl.innerText  = 'N/A';
        } catch (err) {
            console.error('github-update:', err);
            if (err.message === 'rate-limited') {
                timeEl.innerText = 'Temporarily unavailable';
                msgEl.innerText  = 'GitHub API rate limit reached — try again in ~1 hour.';
            } else {
                timeEl.innerText = 'Unavailable';
                msgEl.innerText  = 'N/A';
            }
        }
    }

    function render(result, isRepoWide = false) {
        const when = new Date(result.commit.commit.committer.date);
        const total = result.totalCommits;
        
        // Format date to: July 14, 2026
        const dateString = when.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Format time to: 02:13 PM CDT (Using en-US guarantees 12-hour AM/PM format)
        const timeString = when.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        // Set formatted output string
        timeEl.innerText = `${dateString} at ${timeString}`;

        // Display just the total number
        msgEl.innerHTML = total + (isRepoWide ? ' <em>(repo-wide)</em>' : '');
    }

    fetchPageStats();
});
